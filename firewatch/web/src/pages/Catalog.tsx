import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CVE_PLATFORMS, PLATFORM_BY_ID } from '../../../shared/platforms.ts';
import type { FindTag, KevEntry } from '../../../shared/types.ts';
import { KevTable } from '../components/KevTable.tsx';
import { CopyAddress, Empty, LoadError, Loading, Page, Pager, PlatformPicker } from '../components/ui.tsx';
import { useKev } from '../lib/data.ts';
import { FIND_LABEL, addDays, download, fmtNum, toCsv, todayIso } from '../lib/format.ts';
import { usePlatform } from '../lib/prefs.ts';

const PAGE_SIZE = 50;

type Sort = 'added' | 'epss' | 'cvss' | 'due' | 'cve';

export function Catalog() {
  const { data: kev, error } = useKev();
  const [params, setParams] = useSearchParams();
  const [platform] = usePlatform();

  const q = params.get('q') ?? '';
  const vendor = params.get('vendor') ?? '';
  const find = (params.get('find') ?? '') as FindTag | '';
  const ransomware = params.get('ransomware') === '1';
  const triage = params.get('triage') === '1';
  const exploit = params.get('exploit') === '1';
  const rules = params.get('rules') ?? '';
  const added = params.get('added') ?? '';
  const due = params.get('due') ?? '';
  const sort = (params.get('sort') ?? 'added') as Sort;
  const page = Math.max(1, Number(params.get('page') ?? 1));

  const set = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.delete('page');
    setParams(next, { replace: true });
  };

  const vendors = useMemo(() => [...new Set(kev?.map((e) => e.vendor) ?? [])].sort((a, b) => a.localeCompare(b)), [kev]);

  const filtered = useMemo(() => {
    if (!kev) return [];
    const today = todayIso();
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    const out = kev.filter((e) => {
      if (words.length) {
        const hay = `${e.cve} ${e.vendor} ${e.product} ${e.name} ${e.desc} ${e.cwes.join(' ')}`.toLowerCase();
        if (!words.every((w) => hay.includes(w))) return false;
      }
      if (vendor && e.vendor !== vendor) return false;
      if (find && !e.find.includes(find)) return false;
      if (ransomware && !e.ransomware) return false;
      if (triage && !e.triage) return false;
      if (exploit && !e.msf && !e.edb) return false;
      if (rules === 'any' && !Object.keys(e.rules).length) return false;
      if (rules === 'none' && Object.keys(e.rules).length) return false;
      if (rules === 'mine' && !e.rules[platform]) return false;
      if (rules === 'missing' && (e.rules[platform] || !Object.keys(e.rules).length)) return false;
      if (added && e.added < addDays(today, -Number(added))) return false;
      if (due && (e.due < today || e.due > addDays(today, Number(due)))) return false;
      return true;
    });
    const by: Record<Sort, (a: KevEntry, b: KevEntry) => number> = {
      added: (a, b) => b.added.localeCompare(a.added) || b.cve.localeCompare(a.cve),
      epss: (a, b) => (b.epss ?? -1) - (a.epss ?? -1),
      cvss: (a, b) => (b.cvss ?? -1) - (a.cvss ?? -1),
      due: (a, b) => a.due.localeCompare(b.due),
      cve: (a, b) => a.cve.localeCompare(b.cve, undefined, { numeric: true }),
    };
    return out.sort(by[sort]);
  }, [kev, q, vendor, find, ransomware, triage, exploit, rules, added, due, sort, platform]);

  if (error) return <Page title="Catalog"><LoadError error={error} /></Page>;
  if (!kev) return <Page title="Catalog"><Loading what="the KEV catalog" /></Page>;

  const pages = Math.ceil(filtered.length / PAGE_SIZE);
  const shown = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const exportCsv = () => {
    const rows = [
      ['cve', 'vendor', 'product', 'name', 'date_added', 'due_date', 'known_ransomware', 'forensic_triage', 'epss', 'epss_percentile', 'cvss', 'how_to_find', 'metasploit_modules', 'exploitdb_entries', ...CVE_PLATFORMS.map((p) => `${p.id}_rules`)],
      ...filtered.map((e) => [e.cve, e.vendor, e.product, e.name, e.added, e.due, e.ransomware ? 'yes' : 'no', e.triage ? 'yes' : 'no', e.epss, e.pct, e.cvss, e.find.join(' '), e.msf, e.edb, ...CVE_PLATFORMS.map((p) => e.rules[p.id] ?? 0)]),
    ];
    download(`firewatch-kev-${todayIso()}.csv`, toCsv(rows));
  };

  return (
    <Page
      title="Catalog"
      intro="Every entry in the CISA Known Exploited Vulnerabilities catalog, with EPSS, how to find it, public exploits, and published rules."
      actions={
        <>
          <CopyAddress />
          <button type="button" className="btn btn-small" onClick={exportCsv}>
            Export CSV
          </button>
        </>
      }
    >
      <form className="filters card" onSubmit={(e) => e.preventDefault()} aria-label="Filter the catalog">
        <label className="grow">
          <span>Search</span>
          <input type="search" value={q} placeholder="CVE, vendor, product, name, CWE" onChange={(e) => set('q', e.target.value)} />
        </label>
        <label>
          <span>Vendor</span>
          <select value={vendor} onChange={(e) => set('vendor', e.target.value)}>
            <option value="">All vendors</option>
            {vendors.map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
        <label>
          <span>How to find</span>
          <select value={find} onChange={(e) => set('find', e.target.value)}>
            <option value="">Any</option>
            {(Object.keys(FIND_LABEL) as FindTag[]).map((t) => (
              <option key={t} value={t}>
                {FIND_LABEL[t]}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Published rules</span>
          <select value={rules} onChange={(e) => set('rules', e.target.value)}>
            <option value="">Any</option>
            <option value="any">At least one platform</option>
            <option value="mine">{PLATFORM_BY_ID[platform].name}</option>
            <option value="missing">Elsewhere, not {PLATFORM_BY_ID[platform].short}</option>
            <option value="none">None published</option>
          </select>
        </label>
        <label>
          <span>Added</span>
          <select value={added} onChange={(e) => set('added', e.target.value)}>
            <option value="">Any time</option>
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
            <option value="365">Last year</option>
          </select>
        </label>
        <label>
          <span>Federal due</span>
          <select value={due} onChange={(e) => set('due', e.target.value)}>
            <option value="">Any</option>
            <option value="14">Next 14 days</option>
            <option value="30">Next 30 days</option>
          </select>
        </label>
        <label>
          <span>Sort</span>
          <select value={sort} onChange={(e) => set('sort', e.target.value === 'added' ? null : e.target.value)}>
            <option value="added">Newest added</option>
            <option value="epss">Highest EPSS</option>
            <option value="cvss">Highest CVSS</option>
            <option value="due">Earliest due date</option>
            <option value="cve">CVE ID</option>
          </select>
        </label>
        <fieldset className="checks">
          <legend className="sr-only">Flags</legend>
          <label>
            <input type="checkbox" checked={ransomware} onChange={(e) => set('ransomware', e.target.checked ? '1' : null)} /> Known ransomware use
          </label>
          <label>
            <input type="checkbox" checked={triage} onChange={(e) => set('triage', e.target.checked ? '1' : null)} /> Forensic triage
          </label>
          <label>
            <input type="checkbox" checked={exploit} onChange={(e) => set('exploit', e.target.checked ? '1' : null)} /> Public exploit
          </label>
        </fieldset>
        <PlatformPicker />
        {[...params.keys()].length > 0 && (
          <button type="button" className="btn btn-ghost btn-small" onClick={() => setParams(new URLSearchParams(), { replace: true })}>
            Clear filters
          </button>
        )}
      </form>
      <p className="result-count" role="status">
        {fmtNum(filtered.length)} of {fmtNum(kev.length)} KEV entries
      </p>
      {shown.length ? <KevTable entries={shown} platform={platform} caption="Filtered KEV entries" showAdded showDue /> : <Empty>No KEV entries match these filters.</Empty>}
      <Pager page={page} pages={pages} onPage={(n) => set('page', String(n))} />
    </Page>
  );
}
