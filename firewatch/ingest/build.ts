import fs from 'node:fs';
import path from 'node:path';
import { LIBRARY_PLATFORMS, PLATFORMS } from '../shared/platforms.ts';
import {
  PRODUCTS_VERSION,
  SNAPSHOT_SCHEMA,
  TRANSFORMATION,
  type AttackFile,
  type CveDetail,
  type FeedHealth,
  type FindTag,
  type HistoryPoint,
  type KevEntry,
  type NewsFile,
  type NvdRecord,
  type PlatformId,
  type PlatformTotals,
  type Rule,
  type RuleBody,
  type RuleMeta,
  type Snapshot,
  type SourceHealth,
  type TechniqueCoverage,
  type UpdatesFile,
} from '../shared/types.ts';
import type { Ctx } from './context.ts';
import { REPO_PARSERS, UPDATE_WINDOW_DAYS, loadRepoDetections, loadSuricata } from './detections.ts';
import { loadNews } from './news.ts';
import { loadAttack, loadDebian, loadEpss, loadEpssHistory, loadExploitDb, loadGhsa, loadKev, loadMetasploit, loadNuclei, loadNvd, type RawKev } from './vuln.ts';
import { FatalIngestError, bucketOf, ensureDir, errMsg, isoDay, log, readJson, writeJson, writeJsonAtomic } from './util.ts';

export const RULE_BUCKETS = 32;

export interface Paths {
  data: string;
  cache: string;
  state: string;
}

export function resolvePaths(): Paths {
  const root = path.resolve(process.env.FIREWATCH_VAR ?? path.join(import.meta.dirname, '..', 'var'));
  return { data: path.join(root, 'data'), cache: path.join(root, 'cache'), state: path.join(root, 'state') };
}

// Appliances are found by checking firmware against the vendor advisory, not by a scanner agent.
const APPLIANCE_RE =
  /\b(firewall|router|gateway|vpn|appliance|firmware|nas|ip camera|camera|dvr|nvr|switch(es)?|access point|modem|load balancer|adc|asa|ftd|fortios|fortigate|fortiproxy|fortiweb|fortimanager|fortianalyzer|fortisiem|pan-os|globalprotect|sonicos|sma ?\d*|netscaler|big-ip|connect secure|policy secure|pulse connect|ios xe|ios xr|nx-os|junos|srx|edgerouter|secure email gateway|esa|wlc|expressway|meraki|smartzone|ivanti epmm|mobileiron|zyxel|d-link|tp-link|netgear|draytek|mikrotik|ubiquiti|qnap|synology|hikvision|dahua|sonicwall|tenda|totolink|linksys|four-faith|digiever|arcadyan|realtek sdk)\b/i;

function findTags(k: RawKev, nvd: NvdRecord | undefined, hasPackage: boolean, hasNuclei: boolean): FindTag[] {
  const tags = new Set<FindTag>();
  const vulnerable = (nvd?.cpes ?? []).filter((c) => !c.part.endsWith('-platform'));
  // Only hardware the NVD marks vulnerable; "running on" platform CPEs over-count firmware for general OSes.
  const hardware = vulnerable.some((c) => c.part === 'h');
  const appliance = hardware || APPLIANCE_RE.test(`${k.vendorProject} ${k.product} ${k.vulnerabilityName}`);
  if (vulnerable.some((c) => c.part === 'a')) tags.add('software');
  if (vulnerable.some((c) => c.part === 'o') && !appliance) tags.add('os');
  if (appliance) tags.add('appliance');
  if (hasNuclei) tags.add('network');
  if (hasPackage) tags.add('package');
  if (!tags.has('software') && !tags.has('os') && !appliance) tags.add(/windows|macos|linux|ios|android/i.test(k.product) ? 'os' : 'software');
  return [...tags];
}

function primaryCvss(nvd: NvdRecord | undefined): number | null {
  if (!nvd?.cvss.length) return null;
  const primary = nvd.cvss.filter((c) => !c.source.includes('secondary'));
  return (primary[0] ?? nvd.cvss[0]).score;
}

const meta = (r: Rule): RuleMeta => ({
  id: r.id,
  platform: r.platform,
  title: r.title,
  techniques: r.techniques,
  cves: r.cves,
  product: r.product,
  severity: r.severity,
  kind: r.kind,
  path: r.path,
  url: r.url,
  updated: r.updated,
  status: r.status,
});

const body = (r: Rule): RuleBody => ({ description: r.description, query: r.query, language: r.language, references: r.references, author: r.author });

/** Library rule counts per current ATT&CK technique and platform; drives the technique gap lists. */
function techniqueCoverage(rules: Rule[], techniques: AttackFile['techniques']): TechniqueCoverage {
  const out: TechniqueCoverage = {};
  for (const r of rules) {
    for (const t of new Set(r.techniques)) {
      if (!techniques[t]) continue;
      const row = (out[t] ??= {});
      row[r.platform] = (row[r.platform] ?? 0) + 1;
    }
  }
  return out;
}

/** Replace the published directory in one step. Readers see either the old or the new snapshot. */
function publish(next: string, live: string): void {
  const prev = `${live}-prev`;
  fs.rmSync(prev, { recursive: true, force: true });
  if (fs.existsSync(live)) fs.renameSync(live, prev);
  fs.renameSync(next, live);
  fs.rmSync(prev, { recursive: true, force: true });
}

async function runNews(now: Date, dataDir: string, warnings: string[]): Promise<{ news: NewsFile; feeds: FeedHealth[] }> {
  const previous = readJson<NewsFile>(path.join(dataDir, 'news.json'));
  try {
    return await loadNews(now, previous);
  } catch (err) {
    warnings.push(`News: ${errMsg(err)}; no earlier headlines to fall back on`);
    return { news: { generated: now.toISOString(), items: [], stories: [] }, feeds: [] };
  }
}

export async function runFull(paths: Paths): Promise<Snapshot> {
  const ctx: Ctx = { cacheDir: paths.cache, stateDir: paths.state, now: new Date(), warnings: [] };
  ensureDir(paths.cache);
  ensureDir(paths.state);

  const kev = await loadKev(ctx);
  const kevIds = kev.data.entries.map((e) => e.cveID);
  const kevSet = new Set(kevIds);

  const [epss, attack, nvd, msf, nuclei, edb, ghsa, debian] = await Promise.all([
    loadEpss(ctx, kevSet),
    loadAttack(ctx),
    loadNvd(ctx, kevIds),
    loadMetasploit(ctx, kevSet),
    loadNuclei(ctx, kevSet),
    loadExploitDb(ctx, kevSet),
    loadGhsa(ctx, kevSet),
    loadDebian(ctx, kevSet),
  ]);
  const epssHistory = await loadEpssHistory(ctx, kevIds);

  // Git-backed sources run one after another: the large partial clones are disk and CPU heavy.
  const detections = [];
  for (const p of REPO_PARSERS) detections.push({ platform: p.platform, ...(await loadRepoDetections(ctx, p, kevSet)) });
  detections.push({ platform: 'suricata' as PlatformId, ...(await loadSuricata(ctx, kevSet)) });

  const { news, feeds } = await runNews(ctx.now, paths.data, ctx.warnings);

  return assemble(ctx, paths, {
    kev: kev.data,
    epss: epss.data,
    attack: attack.data,
    nvd: nvd.data,
    msf: msf.data,
    nuclei: nuclei.data,
    edb: edb.data,
    ghsa: ghsa.data,
    debian: debian.data,
    epssHistory: epssHistory.data,
    rules: detections.flatMap((d) => d.data.rules),
    updates: detections.flatMap((d) => d.data.updates),
    news,
    feeds,
    sources: [kev, epss, attack, nvd, msf, nuclei, edb, ghsa, debian, epssHistory].map((s) => s.health).concat(detections.map((d) => d.health)),
  });
}

interface Inputs {
  kev: Awaited<ReturnType<typeof loadKev>>['data'];
  epss: Awaited<ReturnType<typeof loadEpss>>['data'];
  attack: AttackFile;
  nvd: Record<string, NvdRecord>;
  msf: Awaited<ReturnType<typeof loadMetasploit>>['data'];
  nuclei: Awaited<ReturnType<typeof loadNuclei>>['data'];
  edb: Awaited<ReturnType<typeof loadExploitDb>>['data'];
  ghsa: Awaited<ReturnType<typeof loadGhsa>>['data'];
  debian: Awaited<ReturnType<typeof loadDebian>>['data'];
  epssHistory: Awaited<ReturnType<typeof loadEpssHistory>>['data'];
  rules: Rule[];
  updates: UpdatesFile['items'];
  news: NewsFile;
  feeds: FeedHealth[];
  sources: SourceHealth[];
}

function assemble(ctx: Ctx, paths: Paths, inp: Inputs): Snapshot {
  const now = ctx.now;
  const techniques = inp.attack.techniques;
  const kevSet = new Set(inp.kev.entries.map((e) => e.cveID));

  const rulesByCve = new Map<string, Rule[]>();
  for (const r of inp.rules) {
    r.techniques = r.techniques.map((t) => t.toUpperCase());
    for (const c of r.cves) if (kevSet.has(c)) rulesByCve.set(c, [...(rulesByCve.get(c) ?? []), r]);
  }

  const entries: KevEntry[] = [];
  const details: Record<string, CveDetail> = {};
  for (const k of inp.kev.entries) {
    const cve = k.cveID;
    const n = inp.nvd[cve];
    const packages = [...(inp.ghsa[cve] ?? []), ...(inp.debian[cve] ?? [])];
    const rules = rulesByCve.get(cve) ?? [];
    const counts: KevEntry['rules'] = {};
    for (const r of rules) counts[r.platform] = (counts[r.platform] ?? 0) + 1;
    const score = inp.epss.scores[cve];
    const entry: KevEntry = {
      cve,
      vendor: k.vendorProject,
      product: k.product,
      name: k.vulnerabilityName,
      added: k.dateAdded,
      due: k.dueDate,
      ransomware: k.knownRansomwareCampaignUse === 'Known',
      triage: k.forensicTriage === 'Yes',
      desc: k.shortDescription,
      action: k.requiredAction,
      notes: k.notes,
      cwes: k.cwes ?? [],
      epss: score ? score[0] : null,
      pct: score ? score[1] : null,
      cvss: primaryCvss(n),
      find: findTags(k, n, packages.length > 0, !!inp.nuclei[cve]),
      msf: inp.msf[cve]?.length ?? 0,
      edb: inp.edb[cve]?.length ?? 0,
      rules: counts,
      techniques: [...new Set(rules.flatMap((r) => r.techniques))].filter((t) => techniques[t]).sort(),
    };
    entries.push(entry);
    details[cve] = {
      kev: entry,
      nvd: n ?? null,
      epssHistory: inp.epssHistory[cve] ?? [],
      packages,
      nuclei: inp.nuclei[cve] ?? [],
      metasploit: inp.msf[cve] ?? [],
      exploitdb: (inp.edb[cve] ?? []).slice(0, 25),
      rules,
    };
  }
  entries.sort((a, b) => b.added.localeCompare(a.added) || b.cve.localeCompare(a.cve));

  // ------------------------------------------------ totals
  const added30Cutoff = isoDay(new Date(now.getTime() - 30 * 86_400_000));
  const platformTotals = {} as Record<PlatformId, PlatformTotals>;
  for (const p of PLATFORMS) {
    const own = inp.rules.filter((r) => r.platform === p.id);
    platformTotals[p.id] = {
      kevCovered: entries.filter((e) => e.rules[p.id]).length,
      rulesNamingKev: own.filter((r) => r.cves.some((c) => kevSet.has(c))).length,
      libraryRules: p.inLibrary ? own.length : 0,
      techniques: new Set(own.flatMap((r) => r.techniques).filter((t) => techniques[t])).size,
    };
  }
  const libraryRules = inp.rules.filter((r) => LIBRARY_PLATFORMS.some((p) => p.id === r.platform));
  const pct = (n: number) => (libraryRules.length ? Math.round((n / libraryRules.length) * 1000) / 10 : 0);
  const findCount = (t: FindTag) => entries.filter((e) => e.find.includes(t)).length;

  const scored = Object.keys(inp.epss.scores).length;
  if (scored < entries.length) ctx.warnings.push(`${entries.length - scored} KEV ${entries.length - scored === 1 ? 'entry has' : 'entries have'} no EPSS score`);

  const snapshot: Snapshot = {
    schema: SNAPSHOT_SCHEMA,
    transformation: TRANSFORMATION,
    generated: now.toISOString(),
    newsGenerated: inp.news.generated,
    kev: { version: inp.kev.version, released: inp.kev.released, count: entries.length },
    epss: { version: inp.epss.version, date: inp.epss.date, scored },
    attack: { version: inp.attack.version, techniques: Object.keys(techniques).length },
    sources: inp.sources,
    newsFeeds: inp.feeds,
    warnings: ctx.warnings,
    totals: {
      kev: entries.length,
      added30: entries.filter((e) => e.added >= added30Cutoff).length,
      ransomware: entries.filter((e) => e.ransomware).length,
      triage: entries.filter((e) => e.triage).length,
      withDetections: entries.filter((e) => Object.keys(e.rules).length > 0).length,
      find: { software: findCount('software'), os: findCount('os'), appliance: findCount('appliance'), network: findCount('network'), package: findCount('package') },
      platforms: platformTotals,
      library: {
        rules: libraryRules.length,
        withTechnique: pct(libraryRules.filter((r) => r.techniques.some((t) => techniques[t])).length),
        withProduct: pct(libraryRules.filter((r) => r.product).length),
        productsVersion: PRODUCTS_VERSION,
      },
    },
  };

  // ------------------------------------------------ structural validation: never publish a broken snapshot
  if (entries.length !== inp.kev.entries.length) throw new FatalIngestError('KEV entries were lost while assembling');
  if (!Object.keys(techniques).length) throw new FatalIngestError('ATT&CK technique table is empty');
  if (!inp.sources.some((s) => s.group === 'detection' && s.status !== 'failed')) throw new FatalIngestError('Every detection repository failed');

  // ------------------------------------------------ history and updates
  const historyFile = path.join(paths.state, 'history.json');
  const history = (readJson<HistoryPoint[]>(historyFile) ?? []).filter((h) => h.date !== isoDay(now));
  history.push({
    date: isoDay(now),
    kev: entries.length,
    ransomware: snapshot.totals.ransomware,
    platforms: Object.fromEntries(PLATFORMS.map((p) => [p.id, { kevCovered: platformTotals[p.id].kevCovered, libraryRules: platformTotals[p.id].libraryRules }])),
  });
  history.sort((a, b) => a.date.localeCompare(b.date));
  writeJson(historyFile, history);

  const updates: UpdatesFile = {
    since: new Date(now.getTime() - UPDATE_WINDOW_DAYS * 86_400_000).toISOString(),
    items: inp.updates.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5000),
  };

  // ------------------------------------------------ write
  const next = `${paths.data}-next`;
  fs.rmSync(next, { recursive: true, force: true });
  ensureDir(next);
  writeJson(path.join(next, 'snapshot.json'), snapshot);
  writeJson(path.join(next, 'kev.json'), entries);
  writeJson(path.join(next, 'attack.json'), inp.attack);
  writeJson(path.join(next, 'news.json'), inp.news);
  writeJson(path.join(next, 'history.json'), history);
  writeJson(path.join(next, 'updates.json'), updates);
  writeJson(path.join(next, 'coverage.json'), techniqueCoverage(libraryRules, techniques));
  for (const [cve, d] of Object.entries(details)) writeJson(path.join(next, 'cve', `${cve}.json`), d);
  for (const p of LIBRARY_PLATFORMS) {
    const own = inp.rules.filter((r) => r.platform === p.id).sort((a, b) => a.title.localeCompare(b.title));
    writeJson(path.join(next, 'library', `${p.id}.json`), own.map(meta));
    const buckets: Record<string, RuleBody>[] = Array.from({ length: RULE_BUCKETS }, () => ({}));
    for (const r of own) buckets[bucketOf(r.id, RULE_BUCKETS)][r.id] = body(r);
    buckets.forEach((b, i) => writeJson(path.join(next, 'rules', p.id, `${i}.json`), b));
  }
  publish(next, paths.data);
  log(`published snapshot: ${entries.length} KEV entries, ${libraryRules.length} library rules, ${ctx.warnings.length} warnings`);
  return snapshot;
}

/** Refresh headlines between full runs without touching the rest of the snapshot. */
export async function runNewsOnly(paths: Paths): Promise<void> {
  const snapFile = path.join(paths.data, 'snapshot.json');
  const snapshot = readJson<Snapshot>(snapFile);
  if (!snapshot) throw new FatalIngestError('No published snapshot yet; run a full ingest first');
  const now = new Date();
  const previous = readJson<NewsFile>(path.join(paths.data, 'news.json'));
  const { news, feeds } = await loadNews(now, previous);
  writeJsonAtomic(path.join(paths.data, 'news.json'), news);
  writeJsonAtomic(snapFile, { ...snapshot, newsGenerated: news.generated, newsFeeds: feeds });
  log(`published news: ${news.items.length} headlines, ${news.stories.length} stories`);
}
