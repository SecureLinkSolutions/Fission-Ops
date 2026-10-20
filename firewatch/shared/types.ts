// Data contract between the ingest pipeline (writes) and the web app (reads).
// Bump SNAPSHOT_SCHEMA whenever a published file changes shape.

export const SNAPSHOT_SCHEMA = 'firewatch-snapshot-v1';
export const TRANSFORMATION = 'firewatch-ingest-v1';
export const PRODUCTS_VERSION = 'firewatch-products-v1';

export type PlatformId = 'sentinel' | 'splunk' | 'elastic' | 'sigma' | 'xsiam' | 'suricata' | 'xsoar';

/** How a defender finds out whether they run the vulnerable thing. */
export type FindTag = 'software' | 'os' | 'appliance' | 'network' | 'package';

export interface KevEntry {
  cve: string;
  vendor: string;
  product: string;
  name: string;
  added: string;
  due: string;
  ransomware: boolean;
  triage: boolean;
  desc: string;
  action: string;
  notes: string;
  cwes: string[];
  epss: number | null;
  pct: number | null;
  cvss: number | null;
  find: FindTag[];
  /** Public exploit counts: Metasploit modules, Exploit-DB entries. */
  msf: number;
  edb: number;
  /** CVE-specific rule counts per platform. */
  rules: Partial<Record<PlatformId, number>>;
  /** ATT&CK technique IDs from rules naming this CVE. */
  techniques: string[];
}

export interface RuleMeta {
  id: string;
  platform: PlatformId;
  title: string;
  techniques: string[];
  cves: string[];
  product: string | null;
  severity: string | null;
  kind: string;
  path: string;
  url: string;
  updated: string | null;
  status: string | null;
}

export interface RuleBody {
  description: string;
  query: string;
  language: string;
  references: string[];
  author: string | null;
}

export type Rule = RuleMeta & RuleBody;

export interface CvssMetric {
  version: string;
  score: number;
  severity: string;
  vector: string;
  source: string;
}

export interface NvdRecord {
  description: string;
  published: string;
  modified: string;
  status: string;
  cvss: CvssMetric[];
  cwes: string[];
  references: { url: string; tags: string[] }[];
  cpes: { part: string; vendor: string; product: string }[];
}

export interface PackageRef {
  source: 'ghsa' | 'debian';
  id: string;
  ecosystem: string;
  name: string;
  fixed: string[];
  url: string;
}

export interface CveDetail {
  kev: KevEntry;
  nvd: NvdRecord | null;
  epssHistory: { date: string; epss: number; pct: number }[];
  packages: PackageRef[];
  nuclei: { id: string; name: string; severity: string; url: string }[];
  metasploit: { name: string; fullname: string; rank: string; check: boolean; url: string }[];
  exploitdb: { id: string; title: string; date: string; type: string; platform: string; verified: boolean; url: string }[];
  rules: Rule[];
}

export type SourceGroup = 'vuln' | 'detection';
export type SourceStatus = 'ok' | 'fallback' | 'failed';

export interface SourceHealth {
  id: string;
  name: string;
  group: SourceGroup;
  terms: string;
  licence: string;
  attribution: string;
  version: string | null;
  published: string | null;
  retrieved: string | null;
  count: number;
  countLabel: string;
  /** Hours after `retrieved` (or `published` for EPSS) at which the source is stale. */
  staleAfterHours: number;
  staleFrom: 'retrieved' | 'published';
  status: SourceStatus;
  note: string | null;
}

export type NewsType = 'news' | 'research' | 'government';

export interface FeedHealth {
  id: string;
  name: string;
  type: NewsType;
  licence: string;
  terms: string | null;
  publisher: string;
  attribution: string | null;
  retrieved: string | null;
  newest: string | null;
  kept: number;
  skippedOffsite: number;
  status: 'ok' | 'failed';
  error: string | null;
}

export interface NewsItem {
  id: string;
  feed: string;
  source: string;
  type: NewsType;
  title: string;
  url: string;
  date: string;
  cves: string[];
  story: string | null;
}

export interface NewsStory {
  id: string;
  title: string;
  latest: string;
  items: string[];
}

export interface NewsFile {
  generated: string;
  items: NewsItem[];
  stories: NewsStory[];
}

export interface PlatformTotals {
  kevCovered: number;
  rulesNamingKev: number;
  libraryRules: number;
  techniques: number;
}

export interface Snapshot {
  schema: string;
  transformation: string;
  generated: string;
  newsGenerated: string | null;
  kev: { version: string; released: string; count: number };
  epss: { version: string | null; date: string | null; scored: number };
  attack: { version: string; techniques: number };
  sources: SourceHealth[];
  newsFeeds: FeedHealth[];
  warnings: string[];
  totals: {
    kev: number;
    added30: number;
    ransomware: number;
    triage: number;
    withDetections: number;
    find: Record<FindTag, number>;
    platforms: Record<PlatformId, PlatformTotals>;
    library: { rules: number; withTechnique: number; withProduct: number; productsVersion: string };
  };
}

export interface AttackTechnique {
  name: string;
  tactics: string[];
  sub: boolean;
  url: string;
}

export interface AttackFile {
  version: string;
  tactics: { id: string; short: string; name: string }[];
  techniques: Record<string, AttackTechnique>;
}

export interface HistoryPoint {
  date: string;
  kev: number;
  ransomware: number;
  platforms: Partial<Record<PlatformId, { kevCovered: number; libraryRules: number }>>;
}

export interface ContentUpdate {
  date: string;
  platform: PlatformId;
  change: 'added' | 'modified' | 'removed';
  title: string;
  path: string;
  url: string;
  ruleId: string | null;
  cves: string[];
  commit: string | null;
}

export interface UpdatesFile {
  since: string;
  items: ContentUpdate[];
}

/** technique ID -> platform -> number of library rules mapped to it */
export type TechniqueCoverage = Record<string, Partial<Record<PlatformId, number>>>;
