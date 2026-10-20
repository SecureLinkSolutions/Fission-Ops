import { XMLParser } from 'fast-xml-parser';
import { findCves } from '../shared/platforms.ts';
import type { FeedHealth, NewsFile, NewsItem, NewsStory, NewsType } from '../shared/types.ts';
import { errMsg, fetchText, log, mapLimit, shortHash, toIso } from './util.ts';

interface FeedDef {
  id: string;
  name: string;
  type: NewsType;
  url: string;
  publisher: string;
  /** Item links must be on one of these hosts; anything else is skipped as off-site. */
  domains: string[];
  licence?: string;
  terms?: string;
  attribution?: string;
}

const HEADLINE_ONLY = 'No reuse terms published; headline, date, and link only';

export const FEEDS: FeedDef[] = [
  // Government
  { id: 'cisa', name: 'CISA cybersecurity advisories', type: 'government', url: 'https://www.cisa.gov/cybersecurity-advisories/all.xml', publisher: 'https://www.cisa.gov/news-events/cybersecurity-advisories', domains: ['cisa.gov'], licence: 'US government work (public domain)', terms: 'https://www.cisa.gov/privacy-policy', attribution: 'Advisories from CISA (cisa.gov); no endorsement by CISA is implied' },
  { id: 'ncsc-uk', name: 'NCSC UK (all content)', type: 'government', url: 'https://www.ncsc.gov.uk/api/1/services/v1/all-rss-feed.xml', publisher: 'https://www.ncsc.gov.uk/', domains: ['ncsc.gov.uk'], licence: 'Open Government Licence v3.0', terms: 'https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/', attribution: 'Contains public sector information from the National Cyber Security Centre, licensed under the Open Government Licence v3.0' },
  { id: 'cccs', name: 'Canadian Centre for Cyber Security alerts and advisories', type: 'government', url: 'https://www.cyber.gc.ca/api/cccs/rss/v1/get?feed=alerts_advisories&lang=en', publisher: 'https://www.cyber.gc.ca/en/alerts-advisories', domains: ['cyber.gc.ca'], licence: 'Crown copyright; headline, date, and link only', attribution: 'Headlines from the Canadian Centre for Cyber Security; not endorsed by the Government of Canada' },
  { id: 'cert-eu-advisories', name: 'CERT-EU security advisories', type: 'government', url: 'https://cert.europa.eu/publications/security-advisories-rss', publisher: 'https://cert.europa.eu/publications/security-advisories/', domains: ['cert.europa.eu'], attribution: 'Headlines from CERT-EU' },
  { id: 'cert-eu-ti', name: 'CERT-EU threat intelligence', type: 'government', url: 'https://cert.europa.eu/publications/threat-intelligence-rss', publisher: 'https://cert.europa.eu/publications/threat-intelligence/', domains: ['cert.europa.eu'], attribution: 'Headlines from CERT-EU' },
  // Vendor threat research
  { id: 'msti', name: 'Microsoft Threat Intelligence', type: 'research', url: 'https://www.microsoft.com/en-us/security/blog/topic/threat-intelligence/feed/', publisher: 'https://www.microsoft.com/en-us/security/blog/topic/threat-intelligence/', domains: ['microsoft.com'] },
  { id: 'talos', name: 'Cisco Talos blog', type: 'research', url: 'https://blog.talosintelligence.com/rss/', publisher: 'https://blog.talosintelligence.com/', domains: ['talosintelligence.com'] },
  { id: 'unit42', name: 'Palo Alto Networks Unit 42', type: 'research', url: 'https://unit42.paloaltonetworks.com/feed/', publisher: 'https://unit42.paloaltonetworks.com/', domains: ['paloaltonetworks.com'] },
  { id: 'crowdstrike', name: 'CrowdStrike blog', type: 'research', url: 'https://www.crowdstrike.com/en-us/blog/feed', publisher: 'https://www.crowdstrike.com/en-us/blog/', domains: ['crowdstrike.com'] },
  { id: 'sentinellabs', name: 'SentinelOne SentinelLabs', type: 'research', url: 'https://www.sentinelone.com/labs/feed/', publisher: 'https://www.sentinelone.com/labs/', domains: ['sentinelone.com'] },
  { id: 'securelist', name: 'Kaspersky Securelist', type: 'research', url: 'https://securelist.com/feed/', publisher: 'https://securelist.com/', domains: ['securelist.com'] },
  { id: 'eset', name: 'ESET WeLiveSecurity', type: 'research', url: 'https://www.welivesecurity.com/en/rss/feed/', publisher: 'https://www.welivesecurity.com/', domains: ['welivesecurity.com'] },
  { id: 'checkpoint', name: 'Check Point Research', type: 'research', url: 'https://research.checkpoint.com/feed/', publisher: 'https://research.checkpoint.com/', domains: ['checkpoint.com'] },
  { id: 'sophos', name: 'Sophos X-Ops threat research', type: 'research', url: 'https://news.sophos.com/en-us/category/threat-research/feed/', publisher: 'https://news.sophos.com/en-us/category/threat-research/', domains: ['sophos.com'] },
  { id: 'proofpoint', name: 'Proofpoint Threat Insight', type: 'research', url: 'https://www.proofpoint.com/us/threat-insight-blog.xml', publisher: 'https://www.proofpoint.com/us/blog/threat-insight', domains: ['proofpoint.com'] },
  { id: 'elastic-labs', name: 'Elastic Security Labs', type: 'research', url: 'https://www.elastic.co/security-labs/rss/feed.xml', publisher: 'https://www.elastic.co/security-labs', domains: ['elastic.co'] },
  { id: 'rapid7', name: 'Rapid7 blog', type: 'research', url: 'https://www.rapid7.com/blog/rss/', publisher: 'https://www.rapid7.com/blog/', domains: ['rapid7.com'] },
  { id: 'recorded-future', name: 'Recorded Future research', type: 'research', url: 'https://www.recordedfuture.com/feed', publisher: 'https://www.recordedfuture.com/research', domains: ['recordedfuture.com'] },
  { id: 'huntress', name: 'Huntress blog', type: 'research', url: 'https://www.huntress.com/blog/rss.xml', publisher: 'https://www.huntress.com/blog', domains: ['huntress.com'] },
  { id: 'fortinet', name: 'Fortinet threat research', type: 'research', url: 'https://feeds.fortinet.com/fortinet/blog/threat-research', publisher: 'https://www.fortinet.com/blog/threat-research', domains: ['fortinet.com'] },
  { id: 'volexity', name: 'Volexity threat intelligence', type: 'research', url: 'https://www.volexity.com/blog/feed/', publisher: 'https://www.volexity.com/blog/', domains: ['volexity.com'] },
  { id: 'dfir-report', name: 'The DFIR Report', type: 'research', url: 'https://thedfirreport.com/feed/', publisher: 'https://thedfirreport.com/', domains: ['thedfirreport.com'] },
  { id: 'red-canary', name: 'Red Canary blog', type: 'research', url: 'https://redcanary.com/blog/feed/', publisher: 'https://redcanary.com/blog/', domains: ['redcanary.com'] },
  // News
  { id: 'bleepingcomputer', name: 'BleepingComputer', type: 'news', url: 'https://www.bleepingcomputer.com/feed/', publisher: 'https://www.bleepingcomputer.com/', domains: ['bleepingcomputer.com'] },
  { id: 'the-record', name: 'The Record by Recorded Future News', type: 'news', url: 'https://therecord.media/feed', publisher: 'https://therecord.media/', domains: ['therecord.media'] },
  { id: 'securityweek', name: 'SecurityWeek', type: 'news', url: 'https://www.securityweek.com/feed/', publisher: 'https://www.securityweek.com/', domains: ['securityweek.com'] },
  { id: 'thehackernews', name: 'The Hacker News', type: 'news', url: 'https://feeds.feedburner.com/TheHackersNews', publisher: 'https://thehackernews.com/', domains: ['thehackernews.com'] },
  { id: 'darkreading', name: 'Dark Reading', type: 'news', url: 'https://www.darkreading.com/rss.xml', publisher: 'https://www.darkreading.com/', domains: ['darkreading.com'] },
  { id: 'krebs', name: 'Krebs on Security', type: 'news', url: 'https://krebsonsecurity.com/feed/', publisher: 'https://krebsonsecurity.com/', domains: ['krebsonsecurity.com'] },
  { id: 'cyberscoop', name: 'CyberScoop', type: 'news', url: 'https://cyberscoop.com/feed/', publisher: 'https://cyberscoop.com/', domains: ['cyberscoop.com'] },
  { id: 'risky-biz', name: 'Risky Business News', type: 'news', url: 'https://news.risky.biz/rss/', publisher: 'https://news.risky.biz/', domains: ['risky.biz'] },
];

export const NEWS_WINDOW_DAYS = 30;
export const NEWS_PER_FEED = 100;
/** The run fails, and the previous news is kept, if fewer feeds than this succeed. */
export const NEWS_MIN_SUCCESS = 0.6;

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_', textNodeName: '#text', trimValues: true });

/* eslint-disable @typescript-eslint/no-explicit-any */
const text = (v: any): string => {
  if (v == null) return '';
  if (typeof v === 'string' || typeof v === 'number') return String(v);
  if (Array.isArray(v)) return text(v[0]);
  return String(v['#text'] ?? '');
};
const decode = (s: string) =>
  s
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&(amp|lt|gt|quot|apos|nbsp|rsquo|lsquo|ldquo|rdquo|ndash|mdash|hellip);/g, (_, e) =>
      ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”', ndash: '–', mdash: '—', hellip: '…' })[e as string] ?? '',
    )
    .replace(/\s+/g, ' ')
    .trim();

function atomLink(link: any): string {
  const links = Array.isArray(link) ? link : [link];
  const alt = links.find((l) => l && typeof l === 'object' && (!l['@_rel'] || l['@_rel'] === 'alternate')) ?? links[0];
  return typeof alt === 'string' ? alt : String(alt?.['@_href'] ?? '');
}

function hostAllowed(url: string, domains: string[]): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return domains.some((d) => host === d || host.endsWith(`.${d}`));
  } catch {
    return false;
  }
}

interface ParsedItem {
  title: string;
  url: string;
  date: string;
  /** Used only to find CVE IDs; never stored. */
  body: string;
}

export function parseFeed(xml: string): ParsedItem[] {
  const doc = parser.parse(xml);
  const rssItems = doc?.rss?.channel?.item ?? doc?.['rdf:RDF']?.item;
  if (rssItems) {
    return (Array.isArray(rssItems) ? rssItems : [rssItems]).map((i: any) => ({
      title: decode(text(i.title)),
      url: text(i.link).trim() || text(i.guid).trim(),
      date: toIso(text(i.pubDate) || text(i['dc:date']) || text(i.published)) ?? '',
      body: decode(text(i.description) + ' ' + text(i['content:encoded'])),
    }));
  }
  const entries = doc?.feed?.entry;
  if (entries) {
    return (Array.isArray(entries) ? entries : [entries]).map((e: any) => ({
      title: decode(text(e.title)),
      url: atomLink(e.link).trim(),
      date: toIso(text(e.published) || text(e.updated)) ?? '',
      body: decode(text(e.summary) + ' ' + text(e.content)),
    }));
  }
  throw new Error('not an RSS or Atom feed');
}

// ---------------------------------------------------------------- story clustering

const STOP = new Set(
  'a an the and or of to in on for with by from at as is are was were be been it its this that new over after into about via how why what who amid says say said'.split(' '),
);

function tokens(title: string): Set<string> {
  return new Set(
    title
      .toLowerCase()
      .replace(/[’'`]s\b/g, '')
      .split(/[^a-z0-9-]+/)
      .filter((t) => t.length > 2 && !STOP.has(t)),
  );
}

/**
 * Group headlines from different publishers about the same event: titles
 * published within three days that share a CVE or enough distinctive words.
 */
export function clusterStories(items: NewsItem[]): NewsStory[] {
  const toks = items.map((i) => tokens(i.title));
  const parent = items.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      if (items[i].feed === items[j].feed) continue;
      if (Math.abs(Date.parse(items[i].date) - Date.parse(items[j].date)) > 3 * 86_400_000) continue;
      const sharedCve = items[i].cves.some((c) => items[j].cves.includes(c));
      let inter = 0;
      for (const t of toks[i]) if (toks[j].has(t)) inter++;
      const jaccard = inter / (toks[i].size + toks[j].size - inter || 1);
      if (sharedCve || (inter >= 3 && jaccard >= 0.3)) parent[find(i)] = find(j);
    }
  }
  const groups = new Map<number, number[]>();
  items.forEach((_, i) => {
    const r = find(i);
    groups.set(r, [...(groups.get(r) ?? []), i]);
  });
  const stories: NewsStory[] = [];
  for (const idx of groups.values()) {
    const publishers = new Set(idx.map((i) => items[i].feed));
    if (publishers.size < 2) continue;
    const members = idx.map((i) => items[i]).sort((a, b) => b.date.localeCompare(a.date));
    const id = `s-${shortHash(members.map((m) => m.id).sort().join('|'), 10)}`;
    for (const m of members) m.story = id;
    stories.push({ id, title: members[0].title, latest: members[0].date, items: members.map((m) => m.id) });
  }
  return stories.sort((a, b) => b.latest.localeCompare(a.latest));
}

// ---------------------------------------------------------------- runner

export async function loadNews(now: Date, previous: NewsFile | null): Promise<{ news: NewsFile; feeds: FeedHealth[] }> {
  const cutoff = now.getTime() - NEWS_WINDOW_DAYS * 86_400_000;
  const results = await mapLimit(FEEDS, 8, async (f): Promise<{ health: FeedHealth; items: NewsItem[] }> => {
    const health: FeedHealth = {
      id: f.id,
      name: f.name,
      type: f.type,
      licence: f.licence ?? HEADLINE_ONLY,
      terms: f.terms ?? null,
      publisher: f.publisher,
      attribution: f.attribution ?? null,
      retrieved: null,
      newest: null,
      kept: 0,
      skippedOffsite: 0,
      status: 'failed',
      error: null,
    };
    try {
      const parsed = parseFeed(await fetchText(f.url, { timeoutMs: 30_000, retries: 1, headers: { accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml' } }));
      health.retrieved = now.toISOString();
      health.status = 'ok';
      const items: NewsItem[] = [];
      for (const p of parsed) {
        if (!p.title || !p.url || !p.date) continue;
        if (!health.newest || p.date > health.newest) health.newest = p.date;
        if (!hostAllowed(p.url, f.domains)) {
          health.skippedOffsite++;
          continue;
        }
        if (Date.parse(p.date) < cutoff || Date.parse(p.date) > now.getTime() + 86_400_000) continue;
        items.push({
          id: `${f.id}-${shortHash(p.url, 10)}`,
          feed: f.id,
          source: f.name,
          type: f.type,
          title: p.title,
          url: p.url,
          date: p.date,
          cves: findCves(`${p.title} ${p.body}`),
          story: null,
        });
      }
      items.sort((a, b) => b.date.localeCompare(a.date));
      const kept = items.slice(0, NEWS_PER_FEED);
      health.kept = kept.length;
      return { health, items: kept };
    } catch (err) {
      health.error = errMsg(err).slice(0, 200);
      return { health, items: [] };
    }
  });
  const ok = results.filter((r) => r.health.status === 'ok').length;
  log(`news: ${ok} of ${FEEDS.length} feeds ok`);
  if (ok < FEEDS.length * NEWS_MIN_SUCCESS) {
    const reason = `only ${ok} of ${FEEDS.length} news feeds succeeded (minimum ${Math.round(NEWS_MIN_SUCCESS * 100)}%)`;
    if (previous) {
      log(`news: ${reason}; keeping the previous news file`);
      return { news: previous, feeds: results.map((r) => r.health) };
    }
    throw new Error(reason);
  }
  const seen = new Set<string>();
  const items = results
    .flatMap((r) => r.items)
    .filter((i) => (seen.has(i.url) ? false : (seen.add(i.url), true)))
    .sort((a, b) => b.date.localeCompare(a.date));
  const stories = clusterStories(items);
  return { news: { generated: now.toISOString(), items, stories }, feeds: results.map((r) => r.health) };
}
