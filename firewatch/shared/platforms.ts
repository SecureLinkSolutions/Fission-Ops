import type { PlatformId } from './types.ts';

export interface PlatformInfo {
  id: PlatformId;
  name: string;
  short: string;
  /** Library holds every rule from SIEM platforms; IDS and SOAR content is kept only when it names a KEV CVE. */
  inLibrary: boolean;
  /** Whether the platform's rules name CVEs at all. XSIAM correlation rules do not. */
  namesCves: boolean;
  language: string;
}

export const PLATFORMS: PlatformInfo[] = [
  { id: 'sentinel', name: 'Microsoft Sentinel', short: 'Sentinel', inLibrary: true, namesCves: true, language: 'KQL' },
  { id: 'splunk', name: 'Splunk', short: 'Splunk', inLibrary: true, namesCves: true, language: 'SPL' },
  { id: 'elastic', name: 'Elastic Security', short: 'Elastic', inLibrary: true, namesCves: true, language: 'EQL / KQL / ES|QL' },
  { id: 'sigma', name: 'Sigma (vendor-neutral)', short: 'Sigma', inLibrary: true, namesCves: true, language: 'Sigma YAML' },
  { id: 'xsiam', name: 'Cortex XSIAM', short: 'XSIAM', inLibrary: true, namesCves: false, language: 'XQL' },
  { id: 'suricata', name: 'Suricata (ET Open)', short: 'Suricata', inLibrary: false, namesCves: true, language: 'Suricata rules' },
  { id: 'xsoar', name: 'Cortex XSOAR', short: 'XSOAR', inLibrary: false, namesCves: true, language: 'Playbook YAML' },
];

export const PLATFORM_BY_ID = Object.fromEntries(PLATFORMS.map((p) => [p.id, p])) as Record<PlatformId, PlatformInfo>;

/** Platforms whose CVE-specific rule counts appear on the overview and in the catalog. */
export const CVE_PLATFORMS = PLATFORMS.filter((p) => p.namesCves);

export const LIBRARY_PLATFORMS = PLATFORMS.filter((p) => p.inLibrary);

export const DEFAULT_PLATFORM: PlatformId = 'sigma';

export const CVE_RE = /CVE-\d{4}-\d{4,7}/gi;

export function normaliseCve(raw: string): string {
  return raw.toUpperCase().replace(/^CVE[._]/, 'CVE-').replace(/_/g, '-');
}

/** Extract CVE IDs from free text, including the `cve.2021-44228` and `CVE_2021_44228` spellings. */
export function findCves(text: string): string[] {
  const out = new Set<string>();
  for (const m of text.matchAll(/CVE[-_.](\d{4})[-_](\d{4,7})/gi)) out.add(`CVE-${m[1]}-${m[2]}`);
  return [...out];
}

export function findTechniques(text: string): string[] {
  const out = new Set<string>();
  for (const m of text.matchAll(/\bT(\d{4})(?:[./](\d{3}))?\b/gi)) out.add(m[2] ? `T${m[1]}.${m[2]}` : `T${m[1]}`);
  return [...out];
}
