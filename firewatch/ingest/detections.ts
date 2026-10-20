import fs from 'node:fs';
import path from 'node:path';
import { parseAllDocuments, parse as parseYaml } from 'yaml';
import { parse as parseToml } from 'smol-toml';
import { findCves, findTechniques } from '../shared/platforms.ts';
import type { ContentUpdate, PlatformId, Rule, SourceHealth } from '../shared/types.ts';
import { withFallback, type Ctx } from './context.ts';
import { productOf } from './products.ts';
import { fetchText, readJson, repoChanges, shortHash, syncRepo, untarGz, walk, writeJson, type GitChange, type RepoSpec } from './util.ts';

export const UPDATE_WINDOW_DAYS = 30;

export interface DetectionData {
  rules: Rule[];
  updates: ContentUpdate[];
}

/* eslint-disable @typescript-eslint/no-explicit-any */
type Doc = Record<string, any>;

const asArray = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : v == null || v === '' ? [] : [String(v)]);
const uniq = <T>(xs: T[]): T[] => [...new Set(xs)];
const day = (v: unknown): string | null => {
  if (v == null || v === '') return null;
  const s = String(v instanceof Date ? v.toISOString() : v).replace(/\//g, '-').replace(/_/g, '-');
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : null;
};
const severity = (v: unknown): string | null => {
  if (v == null || v === '') return null;
  const s = String(v).toLowerCase().replace(/^sev_\d+_/, '');
  return s === 'informational' ? 'info' : s;
};
const ghUrl = (repo: string, branch: string, rel: string) => `https://github.com/${repo}/blob/${branch}/${rel.split('/').map(encodeURIComponent).join('/')}`;

interface RepoParser {
  platform: PlatformId;
  health: Omit<SourceHealth, 'status' | 'note' | 'retrieved' | 'version' | 'published' | 'count'>;
  repo: string;
  branch: string;
  spec: Omit<RepoSpec, 'dir' | 'url' | 'historyDays'>;
  cacheName: string;
  roots: string[];
  match: (rel: string) => boolean;
  parse: (text: string, rel: string) => Rule | null;
  /** Some repos (XSOAR) keep only rules naming a CVE. */
  keep?: (rule: Rule) => boolean;
}

function base(id: string, name: string, terms: string, licence: string, attribution: string): RepoParser['health'] {
  return { id, name, group: 'detection', terms, licence, attribution, countLabel: 'rules name a KEV CVE', staleAfterHours: 72, staleFrom: 'retrieved' };
}

// ---------------------------------------------------------------- per-repository parsers

const sigma: RepoParser = {
  platform: 'sigma',
  health: base('sigma', 'Sigma rules (SigmaHQ/sigma)', 'https://github.com/SigmaHQ/Detection-Rule-License', 'DRL-1.1',
    'Sigma rules by the SigmaHQ community and the named rule authors, Detection Rule License 1.1'),
  repo: 'SigmaHQ/sigma',
  branch: 'master',
  spec: {},
  cacheName: 'sigma',
  roots: ['rules', 'rules-emerging-threats', 'rules-threat-hunting', 'rules-dfir'],
  match: (rel) => /^rules(-emerging-threats|-threat-hunting|-dfir)?\/.*\.ya?ml$/.test(rel),
  parse(text, rel) {
    const doc = parseAllDocuments(text)[0]?.toJSON() as Doc | undefined;
    if (!doc?.id || !doc.title || !doc.detection) return null;
    const tags = asArray(doc.tags);
    const ls = doc.logsource ?? {};
    const dir = rel.split('/')[0];
    return {
      id: `sigma:${doc.id}`,
      platform: 'sigma',
      title: doc.title,
      techniques: findTechniques(tags.filter((t) => t.startsWith('attack.t')).join(' ')),
      cves: uniq([...findCves(tags.join(' ')), ...findCves(doc.title), ...findCves(path.basename(rel)), ...findCves(String(doc.description ?? ''))]),
      product: productOf(ls.product, ls.service, ls.category),
      severity: severity(doc.level),
      kind: dir === 'rules-emerging-threats' ? 'Emerging threat' : dir === 'rules-threat-hunting' ? 'Threat hunting' : dir === 'rules-dfir' ? 'DFIR' : 'Detection',
      path: rel,
      url: ghUrl('SigmaHQ/sigma', 'master', rel),
      updated: day(doc.modified ?? doc.date),
      status: doc.status ?? null,
      description: String(doc.description ?? '').trim(),
      query: text,
      language: 'sigma',
      references: asArray(doc.references),
      author: doc.author ? String(doc.author) : null,
    };
  },
};

const splunk: RepoParser = {
  platform: 'splunk',
  health: base('splunk', 'Splunk Security Content (splunk/security_content)', 'https://github.com/splunk/security_content/blob/develop/LICENSE', 'Apache-2.0',
    'Splunk Security Content detections, Apache License 2.0'),
  repo: 'splunk/security_content',
  branch: 'develop',
  spec: {},
  cacheName: 'splunk',
  roots: ['detections'],
  match: (rel) => rel.startsWith('detections/') && !rel.startsWith('detections/deprecated/') && /\.ya?ml$/.test(rel),
  parse(text, rel) {
    const doc = parseYaml(text) as Doc;
    if (!doc?.id || !doc.name || !doc.search) return null;
    const tags = doc.tags ?? {};
    return {
      id: `splunk:${doc.id}`,
      platform: 'splunk',
      title: doc.name,
      techniques: uniq(asArray(doc.mitre_attack_id ?? tags.mitre_attack_id)),
      cves: uniq([...asArray(doc.cve ?? tags.cve).flatMap(findCves), ...findCves(doc.name), ...findCves(String(doc.description ?? ''))]),
      product: productOf(asArray(doc.data_source).join(' '), doc.category, tags.asset_type ?? doc.asset_type),
      severity: null,
      kind: doc.type ?? 'Detection',
      path: rel,
      url: ghUrl('splunk/security_content', 'develop', rel),
      updated: day(doc.modification_date ?? doc.date),
      status: doc.status ?? null,
      description: String(doc.description ?? '').trim(),
      query: String(doc.search),
      language: 'spl',
      references: asArray(doc.references),
      author: doc.author ?? null,
    };
  },
};

const elastic: RepoParser = {
  platform: 'elastic',
  health: base('elastic', 'Elastic detection rules (elastic/detection-rules)', 'https://github.com/elastic/detection-rules/blob/main/LICENSE.txt', 'Elastic-2.0',
    'Elastic detection rules, Elastic License 2.0'),
  repo: 'elastic/detection-rules',
  branch: 'main',
  spec: {},
  cacheName: 'elastic',
  roots: ['rules', 'rules_building_block'],
  match: (rel) => /^rules(_building_block)?\//.test(rel) && !rel.includes('/_deprecated/') && rel.endsWith('.toml'),
  parse(text, rel) {
    const doc = parseToml(text) as Doc;
    const r = doc.rule as Doc | undefined;
    if (!r?.rule_id || !r.name) return null;
    const tags = asArray(r.tags);
    const techniques: string[] = [];
    for (const t of (r.threat ?? []) as Doc[]) {
      for (const tech of (t.technique ?? []) as Doc[]) {
        techniques.push(tech.id);
        for (const sub of (tech.subtechnique ?? []) as Doc[]) techniques.push(sub.id);
      }
    }
    const query = r.query ?? (r.machine_learning_job_id ? `machine_learning_job_id: ${asArray(r.machine_learning_job_id).join(', ')}` : '');
    return {
      id: `elastic:${r.rule_id}`,
      platform: 'elastic',
      title: r.name,
      techniques: uniq(techniques),
      cves: uniq([...findCves(r.name), ...findCves(tags.join(' ')), ...findCves(String(r.description ?? ''))]),
      product: productOf(tags.filter((t) => /^(OS|Domain|Data Source):/.test(t)).join(' '), asArray(r.index).join(' ')),
      severity: severity(r.severity),
      kind: rel.startsWith('rules_building_block/') ? 'Building block' : `${r.type ?? 'query'} rule`,
      path: rel,
      url: ghUrl('elastic/detection-rules', 'main', rel),
      updated: day(doc.metadata?.updated_date ?? doc.metadata?.creation_date),
      status: doc.metadata?.maturity ?? null,
      description: String(r.description ?? '').trim(),
      query: String(query),
      language: String(r.language ?? r.type ?? 'kuery'),
      references: asArray(r.references),
      author: asArray(r.author).join(', ') || null,
    };
  },
};

const sentinelIds = new Set<string>();
const sentinel: RepoParser = {
  platform: 'sentinel',
  health: base('sentinel', 'Microsoft Sentinel content (Azure/Azure-Sentinel)', 'https://github.com/Azure/Azure-Sentinel/blob/master/LICENSE', 'MIT',
    'Microsoft Sentinel analytics rules and hunting queries from Azure/Azure-Sentinel, MIT License, Copyright (c) Microsoft Corporation'),
  repo: 'Azure/Azure-Sentinel',
  branch: 'master',
  spec: {
    blobless: true,
    sparse: ['/Detections/**', '/Hunting Queries/**', '/Solutions/*/Analytic Rules/**', '/Solutions/*/Hunting Queries/**'],
  },
  cacheName: 'azure-sentinel',
  roots: ['Detections', 'Hunting Queries', 'Solutions'],
  match: (rel) =>
    /\.ya?ml$/i.test(rel) && (/^(Detections|Hunting Queries)\//.test(rel) || /^Solutions\/[^/]+\/(Analytic Rules|Hunting Queries)\//.test(rel)),
  parse(text, rel) {
    const doc = parseYaml(text) as Doc;
    if (!doc?.id || !doc.name || !doc.query) return null;
    let id = `sentinel:${doc.id}`;
    // The same rule ships in Detections/ and in a Solution; keep both, they can differ.
    if (sentinelIds.has(id)) id = `${id}:${shortHash(rel, 8)}`;
    sentinelIds.add(id);
    const connectors = ((doc.requiredDataConnectors ?? []) as Doc[]).flatMap((c) => [c.connectorId, ...asArray(c.dataTypes)]);
    const solution = /^Solutions\/([^/]+)\//.exec(rel)?.[1];
    const tags = asArray(doc.tags);
    return {
      id,
      platform: 'sentinel',
      title: doc.name,
      techniques: uniq(asArray(doc.relevantTechniques).flatMap(findTechniques)),
      cves: uniq([...findCves(doc.name), ...findCves(tags.join(' ')), ...findCves(String(doc.description ?? ''))]),
      product: productOf(connectors.join(' '), solution, rel.split('/')[1]),
      severity: severity(doc.severity),
      kind: /Hunting Queries/.test(rel) ? 'Hunting query' : `${doc.kind ?? 'Scheduled'} analytics rule`,
      path: rel,
      url: ghUrl('Azure/Azure-Sentinel', 'master', rel),
      updated: null,
      status: doc.status ?? null,
      description: String(doc.description ?? '').trim(),
      query: String(doc.query),
      language: 'kql',
      references: [],
      author: doc.metadata?.author?.name ?? null,
    };
  },
};

const xsiam: RepoParser = {
  platform: 'xsiam',
  health: base('xsiam', 'Cortex XSIAM correlation rules (demisto/content)', 'https://github.com/demisto/content/blob/master/LICENSE', 'MIT',
    'Cortex XSIAM correlation rules from demisto/content, MIT License'),
  repo: 'demisto/content',
  branch: 'master',
  spec: { blobless: true, sparse: ['/Packs/*/CorrelationRules/**', '/Packs/*/Playbooks/**'] },
  cacheName: 'demisto-content',
  roots: ['Packs'],
  match: (rel) => /^Packs\/[^/]+\/CorrelationRules\/[^/]+\.ya?ml$/.test(rel),
  parse(text, rel) {
    const doc = parseYaml(text) as Doc;
    if (!doc?.global_rule_id || !doc.name) return null;
    const pack = rel.split('/')[1];
    const mitre = Object.entries((doc.mitre_defs ?? {}) as Record<string, unknown>).flatMap(([k, v]) => [k, ...asArray(v)]);
    return {
      id: `xsiam:${doc.global_rule_id}`,
      platform: 'xsiam',
      title: doc.name,
      techniques: findTechniques(mitre.join(' ')),
      cves: uniq([...findCves(doc.name), ...findCves(String(doc.description ?? ''))]),
      product: productOf(pack, doc.dataset) ?? pack.replace(/([a-z])([A-Z])/g, '$1 $2'),
      severity: severity(doc.severity),
      kind: 'Correlation rule',
      path: rel,
      url: ghUrl('demisto/content', 'master', rel),
      updated: null,
      status: doc.is_enabled === false ? 'disabled' : null,
      description: String(doc.description ?? doc.alert_description ?? '').trim(),
      query: String(doc.xql_query ?? ''),
      language: 'xql',
      references: [],
      author: null,
    };
  },
};

const xsoar: RepoParser = {
  platform: 'xsoar',
  health: base('xsoar', 'Cortex XSOAR response playbooks (demisto/content)', 'https://github.com/demisto/content/blob/master/LICENSE', 'MIT',
    'Cortex XSOAR/XSIAM response playbooks from demisto/content, MIT License'),
  repo: 'demisto/content',
  branch: 'master',
  spec: xsiam.spec,
  cacheName: 'demisto-content',
  roots: ['Packs'],
  match: (rel) => /^Packs\/[^/]+\/Playbooks\/[^/]*CVE[^/]*\.ya?ml$/i.test(rel),
  parse(text, rel) {
    const doc = parseYaml(text) as Doc;
    if (!doc?.id || !doc.name) return null;
    return {
      id: `xsoar:${doc.id}`,
      platform: 'xsoar',
      title: doc.name,
      techniques: findTechniques(String(doc.description ?? '')),
      cves: uniq([...findCves(doc.name), ...findCves(path.basename(rel))]),
      product: rel.split('/')[1].replace(/_/g, ' '),
      severity: null,
      kind: 'Response playbook',
      path: rel,
      url: ghUrl('demisto/content', 'master', rel),
      updated: null,
      status: doc.deprecated ? 'deprecated' : null,
      description: String(doc.description ?? '').trim(),
      query: text,
      language: 'yaml',
      references: [],
      author: null,
    };
  },
  keep: (r) => r.cves.length > 0,
};

export const REPO_PARSERS = [sentinel, splunk, elastic, sigma, xsiam, xsoar];

// ---------------------------------------------------------------- runners

function updatesFromChanges(p: RepoParser, changes: GitChange[], byPath: Map<string, Rule>): ContentUpdate[] {
  const seen = new Set<string>();
  const out: ContentUpdate[] = [];
  for (const c of changes) {
    const key = `${c.path}|${c.date.slice(0, 10)}`;
    if (seen.has(key)) continue; // git log is newest first; keep the latest change per file per day
    seen.add(key);
    const rule = byPath.get(c.path);
    if (c.status !== 'D' && !rule) continue; // file changed but is not a rule we index
    out.push({
      date: c.date,
      platform: p.platform,
      change: c.status === 'A' ? 'added' : c.status === 'D' ? 'removed' : 'modified',
      title: rule?.title ?? path.basename(c.path).replace(/\.(ya?ml|toml)$/i, '').replace(/[_-]+/g, ' '),
      path: c.path,
      url: c.status === 'D' ? `https://github.com/${p.repo}/commit/${c.commit}` : rule!.url,
      ruleId: rule?.id ?? null,
      cves: rule?.cves ?? [],
      commit: c.commit,
    });
  }
  return out;
}

const synced = new Map<string, ReturnType<typeof syncRepo>>();

export async function loadRepoDetections(ctx: Ctx, p: RepoParser, kev: Set<string>) {
  return withFallback<DetectionData>(
    ctx,
    p.health,
    async () => {
      const dir = path.join(ctx.cacheDir, 'repos', p.cacheName);
      let state = synced.get(dir);
      if (!state) {
        state = syncRepo({ url: `https://github.com/${p.repo}.git`, dir, historyDays: UPDATE_WINDOW_DAYS, ...p.spec });
        synced.set(dir, state);
      }
      const files = p.roots.flatMap((root) => walk(path.join(dir, root), (f) => p.match(path.relative(dir, f).split(path.sep).join('/'))));
      const rules: Rule[] = [];
      let failed = 0;
      for (const file of uniq(files)) {
        const rel = path.relative(dir, file).split(path.sep).join('/');
        try {
          const rule = p.parse(fs.readFileSync(file, 'utf8'), rel);
          if (rule && (!p.keep || p.keep(rule))) rules.push(rule);
        } catch {
          failed++;
        }
      }
      if (files.length && rules.length === 0) throw new Error(`no rules parsed from ${files.length} files`);
      if (failed > files.length * 0.2) throw new Error(`${failed} of ${files.length} rule files failed to parse`);
      if (failed) ctx.warnings.push(`${p.health.name}: ${failed} of ${files.length} rule files could not be parsed and were skipped`);
      const byPath = new Map(rules.map((r) => [r.path, r]));
      const updates = updatesFromChanges(p, repoChanges(dir, UPDATE_WINDOW_DAYS, p.match), byPath);
      const count = rules.filter((r) => r.cves.some((c) => kev.has(c))).length;
      return { data: { rules, updates }, version: state.commit.slice(0, 12), published: state.committed, count };
    },
    { rules: [], updates: [] },
  );
}

// ---------------------------------------------------------------- Emerging Threats Open (Suricata)

const ET_BASE = 'https://rules.emergingthreats.net/open/suricata-7.0';

function etOption(body: string, key: string): string[] {
  const out: string[] = [];
  const re = new RegExp(`(?:^|;)\\s*${key}\\s*:\\s*("(?:[^"\\\\]|\\\\.)*"|[^;]*)`, 'g');
  for (const m of body.matchAll(re)) out.push(m[1].replace(/^"|"$/g, '').trim());
  return out;
}

export async function loadSuricata(ctx: Ctx, kev: Set<string>) {
  return withFallback<DetectionData>(
    ctx,
    {
      id: 'suricata',
      name: 'Emerging Threats Open ruleset (Suricata 7)',
      group: 'detection',
      terms: 'https://rules.emergingthreats.net/OPEN_download_instructions.html',
      licence: 'BSD (ET Open SIDs 2000000–2799999)',
      attribution: 'Emerging Threats Open rules, Copyright (c) Emerging Threats, BSD licence',
      countLabel: 'rules name a KEV CVE',
      staleAfterHours: 72,
      staleFrom: 'retrieved',
    },
    async () => {
      const version = (await fetchText(`${ET_BASE}/version.txt`)).trim();
      const res = await fetch(`${ET_BASE}/emerging.rules.tar.gz`, { signal: AbortSignal.timeout(300_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status} for ET Open tarball`);
      const published = res.headers.get('last-modified');
      const files = untarGz(Buffer.from(await res.arrayBuffer()));
      const rules: Rule[] = [];
      const revs: Record<string, string> = {};
      for (const [name, buf] of files) {
        if (!name.endsWith('.rules')) continue;
        const file = path.basename(name);
        for (const raw of buf.toString('utf8').split('\n')) {
          const line = raw.trim();
          const m = /^(#\s*)?(alert|drop|reject|pass)\s.*\((.*)\)\s*$/.exec(line);
          if (!m) continue;
          const body = m[3];
          const sid = etOption(body, 'sid')[0];
          const msg = etOption(body, 'msg')[0] ?? '';
          if (!sid) continue;
          const metadata = etOption(body, 'metadata').join(',');
          const cves = uniq([
            ...etOption(body, 'reference').filter((r) => r.toLowerCase().startsWith('cve,')).flatMap((r) => findCves(`CVE-${r.slice(4).replace(/^cve-/i, '')}`)),
            ...findCves(msg),
            ...findCves(metadata),
          ]);
          if (!cves.some((c) => kev.has(c))) continue;
          revs[sid] = etOption(body, 'rev')[0] ?? '1';
          const meta = (k: string) => new RegExp(`\\b${k}\\s+([^,]+)`).exec(metadata)?.[1]?.trim();
          rules.push({
            id: `suricata:${sid}`,
            platform: 'suricata',
            title: msg,
            techniques: uniq(findTechniques([...metadata.matchAll(/mitre_technique_id\s+(T[\d.]+)/g)].map((x) => x[1]).join(' '))),
            cves,
            product: 'Network',
            severity: meta('signature_severity')?.toLowerCase() ?? null,
            kind: m[1] ? 'Signature (disabled by default)' : 'Signature',
            path: file,
            url: `${ET_BASE}/rules/${file}`,
            updated: day(meta('updated_at') ?? meta('created_at')),
            status: m[1] ? 'disabled' : 'enabled',
            description: `SID ${sid}, rev ${revs[sid]}, in ${file}`,
            query: line.replace(/^#\s*/, ''),
            language: 'suricata',
            references: etOption(body, 'reference').filter((r) => r.startsWith('url,')).map((r) => `https://${r.slice(4)}`),
            author: null,
          });
        }
      }
      if (rules.length === 0) throw new Error('ET Open ruleset contained no KEV rules; refusing it');
      // ET has no public history, so content updates are diffs against our previous snapshot.
      const stateFile = path.join(ctx.stateDir, 'suricata-revs.json');
      const prev = readJson<{ at: string; revs: Record<string, string>; titles: Record<string, string>; updates: ContentUpdate[] }>(stateFile);
      const cutoff = new Date(ctx.now.getTime() - UPDATE_WINDOW_DAYS * 86_400_000).toISOString();
      const updates: ContentUpdate[] = (prev?.updates ?? []).filter((u) => u.date >= cutoff);
      if (prev) {
        for (const r of rules) {
          const sid = r.id.slice('suricata:'.length);
          if (!(sid in prev.revs) || prev.revs[sid] !== revs[sid]) {
            updates.unshift({ date: ctx.now.toISOString(), platform: 'suricata', change: sid in prev.revs ? 'modified' : 'added', title: r.title, path: r.path, url: r.url, ruleId: r.id, cves: r.cves, commit: null });
          }
        }
        for (const sid of Object.keys(prev.revs)) {
          if (!(sid in revs)) updates.unshift({ date: ctx.now.toISOString(), platform: 'suricata', change: 'removed', title: prev.titles[sid] ?? `SID ${sid}`, path: '', url: `${ET_BASE}/`, ruleId: null, cves: [], commit: null });
        }
      }
      writeJson(stateFile, { at: ctx.now.toISOString(), revs, titles: Object.fromEntries(rules.map((r) => [r.id.slice(9), r.title])), updates });
      return { data: { rules, updates }, version, published: published ? new Date(published).toISOString() : null, count: rules.length };
    },
    { rules: [], updates: [] },
  );
}
