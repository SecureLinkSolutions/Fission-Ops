import type { FindTag, KevEntry, PlatformId, SourceHealth, TechniqueCoverage } from '../../../shared/types.ts';
import { CVE_PLATFORMS, LIBRARY_PLATFORMS } from '../../../shared/platforms.ts';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'June', 'July', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'];

/** "20 Oct 2026" */
export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** "20 Oct 2026, 11:49 UTC" */
export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return `${fmtDate(iso)}, ${hh}:${mm} UTC`;
}

/** Show the time only when the feed gave one; many feeds give midnight. */
export function fmtNewsDate(iso: string): string {
  const d = new Date(iso);
  return d.getUTCHours() === 0 && d.getUTCMinutes() === 0 ? fmtDate(iso) : fmtDateTime(iso);
}

export const fmtNum = (n: number | null | undefined) => (n == null ? '—' : n.toLocaleString('en-GB'));

export function fmtEpss(e: number | null): string {
  if (e == null) return 'Not scored';
  const pct = e * 100;
  return `${pct >= 10 ? pct.toFixed(3).replace(/\.?0+$/, '') : pct.toPrecision(4).replace(/\.?0+$/, '')}%`;
}

export const fmtPercentile = (p: number | null) => (p == null ? '' : `percentile ${(p * 100).toFixed(2).replace(/\.?0+$/, '')}`);

export const pctOf = (n: number, total: number) => (total ? `${((n / total) * 100).toFixed(1)}%` : '—');

export function daysBetween(fromIso: string, to: Date): number {
  return Math.floor((to.getTime() - new Date(`${fromIso.slice(0, 10)}T00:00:00Z`).getTime()) / 86_400_000);
}

export function todayIso(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export const FIND_LABEL: Record<FindTag, string> = {
  software: 'Software',
  os: 'OS',
  appliance: 'Appliance',
  network: 'Network',
  package: 'Package',
};

export const FIND_HELP: Record<FindTag, string> = {
  software: 'Installed software: authenticated vulnerability scanning or an endpoint agent finds the version',
  os: 'Operating system: patch management and authenticated scanning find it',
  appliance: 'Appliance firmware: check the running version against the vendor advisory',
  network: 'A public network check exists (Nuclei template): external scanning finds it',
  package: 'Ships in open-source packages: container, SCA, and CNAPP scanning find it',
};

export function isStale(s: SourceHealth, now = new Date()): boolean {
  const from = s.staleFrom === 'published' ? s.published : s.retrieved;
  if (!from) return true;
  return now.getTime() - new Date(from).getTime() > s.staleAfterHours * 3_600_000;
}

/** KEV entries another platform has a CVE-specific rule for and `platform` does not. Ransomware first, then EPSS. */
export function adaptable(kev: KevEntry[], platform: PlatformId): KevEntry[] {
  return kev
    .filter((e) => !e.rules[platform] && Object.keys(e.rules).length > 0)
    .sort((a, b) => Number(b.ransomware) - Number(a.ransomware) || (b.epss ?? -1) - (a.epss ?? -1));
}

export interface TechniqueGap {
  id: string;
  elsewhere: number;
  platforms: PlatformId[];
}

export const parentTechnique = (id: string) => id.split('.')[0];

/**
 * ATT&CK techniques other SIEM platforms publish rules for and `platform` does not.
 * Sub-techniques roll up to their parent: a rule for T1037.001 covers T1037.
 */
export function techniqueGaps(coverage: TechniqueCoverage, platform: PlatformId): TechniqueGap[] {
  if (!LIBRARY_PLATFORMS.some((p) => p.id === platform)) return [];
  const rolled: TechniqueCoverage = {};
  for (const [id, row] of Object.entries(coverage)) {
    const parent = (rolled[parentTechnique(id)] ??= {});
    for (const [p, n] of Object.entries(row) as [PlatformId, number][]) parent[p] = (parent[p] ?? 0) + n;
  }
  const gaps: TechniqueGap[] = [];
  for (const [id, row] of Object.entries(rolled)) {
    if (row[platform]) continue;
    const others = Object.entries(row).filter(([p, n]) => p !== platform && n) as [PlatformId, number][];
    if (!others.length) continue;
    gaps.push({ id, elsewhere: others.reduce((s, [, n]) => s + n, 0), platforms: others.map(([p]) => p) });
  }
  return gaps.sort((a, b) => b.elsewhere - a.elsewhere || a.id.localeCompare(b.id));
}

export function otherPlatformRules(e: KevEntry, platform: PlatformId) {
  return CVE_PLATFORMS.filter((p) => p.id !== platform && e.rules[p.id]).map((p) => ({ platform: p, count: e.rules[p.id]! }));
}

export function toCsv(rows: (string | number | null | undefined)[][]): string {
  return rows
    .map((r) =>
      r
        .map((v) => {
          const s = v == null ? '' : String(v);
          return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(','),
    )
    .join('\n');
}

export function download(name: string, text: string, type = 'text/csv'): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
