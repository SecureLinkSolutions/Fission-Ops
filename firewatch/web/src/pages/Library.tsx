import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { LIBRARY_PLATFORMS, PLATFORM_BY_ID } from '../../../shared/platforms.ts';
import type { PlatformId, RuleMeta } from '../../../shared/types.ts';
import { RuleMetaLine } from '../components/RuleView.tsx';
import { CopyAddress, Empty, LoadError, Loading, Page, Pager } from '../components/ui.tsx';
import { useAttack, useCoverage, useMany, useSnapshot } from '../lib/data.ts';
import { download, fmtNum, parentTechnique, techniqueGaps, toCsv, todayIso } from '../lib/format.ts';

const PAGE_SIZE = 50;

export function Library() {
  const [params, setParams] = useSearchParams();
  const { data: snap } = useSnapshot();
  const { data: attack } = useAttack();
  const { data: coverage } = useCoverage();
  const platformParam = (params.get('platform') ?? '') as PlatformId | '';
  const gapsFor = (params.get('gaps') ?? '') as PlatformId | '';
  const technique = params.get('technique') ?? '';
  const tactic = params.get('tactic') ?? '';
  const product = params.get('product') ?? '';
  const q = params.get('q') ?? '';
  const cveOnly = params.get('cve') === '1';
  const page = Math.max(1, Number(params.get('page') ?? 1));

  // Load only the platforms the view needs; each library file is large.
  const platforms = platformParam ? [platformParam] : gapsFor ? LIBRARY_PLATFORMS.filter((p) => p.id !== gapsFor).map((p) => p.id) : LIBRARY_PLATFORMS.map((p) => p.id);
  const { data: libs, error } = useMany<RuleMeta[]>(platforms.map((p) => `library/${p}.json`));

  const set = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.delete('page');
    setParams(next, { replace: true });
  };

  const gapSet = useMemo(() => (gapsFor && coverage ? new Set(techniqueGaps(coverage, gapsFor).map((g) => g.id)) : null), [gapsFor, coverage]);
  const all = useMemo(() => libs?.flat() ?? [], [libs]);
  const products = useMemo(() => [...new Set(all.map((r) => r.product).filter((x): x is string => !!x))].sort(), [all]);

  const filtered = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    const techMatch = (r: RuleMeta) => !technique || r.techniques.some((t) => t === technique || t.startsWith(`${technique}.`));
    const tacticMatch = (r: RuleMeta) => !tactic || r.techniques.some((t) => attack?.techniques[t]?.tactics.includes(tactic));
    return all.filter(
      (r) =>
        techMatch(r) &&
        tacticMatch(r) &&
        (!product || r.product === product) &&
        (!cveOnly || r.cves.length > 0) &&
        (!gapSet || r.techniques.some((t) => gapSet.has(parentTechnique(t)))) &&
        words.every((w) => `${r.title} ${r.techniques.join(' ')} ${r.cves.join(' ')} ${r.path}`.toLowerCase().includes(w)),
    );
  }, [all, q, technique, tactic, product, cveOnly, gapSet, attack]);

  const pages = Math.ceil(filtered.length / PAGE_SIZE);
  const shown = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const tech = technique ? attack?.techniques[technique] : null;

  return (
    <Page
      title="Library"
      intro={`Every published rule from the SIEM platforms${snap ? ` (${fmtNum(snap.totals.library.rules)} rules, ATT&CK ${snap.attack.version})` : ''}, shown verbatim with a link to its source. Firewatch indexes these rules; it does not write or test them.`}
      actions={
        <>
          <CopyAddress />
          <button
            type="button"
            className="btn btn-small"
            disabled={!filtered.length}
            onClick={() =>
              download(
                `firewatch-library-${todayIso()}.csv`,
                toCsv([['platform', 'id', 'title', 'techniques', 'cves', 'product', 'severity', 'kind', 'url'], ...filtered.map((r) => [r.platform, r.id, r.title, r.techniques.join(' '), r.cves.join(' '), r.product, r.severity, r.kind, r.url])]),
              )
            }
          >
            Export CSV
          </button>
        </>
      }
    >
      {gapsFor && (
        <p className="notice">
          Showing rules from other platforms for the ATT&CK techniques {PLATFORM_BY_ID[gapsFor].name} publishes no rule for{gapSet ? ` (${gapSet.size} techniques)` : ''}.{' '}
          <button type="button" className="link-btn" onClick={() => set('gaps', null)}>
            Show the whole Library
          </button>
        </p>
      )}
      {technique && (
        <p className="notice">
          Technique <strong className="mono">{technique}</strong> {tech ? tech.name : '(not in the current ATT&CK release)'}
          {tech && (
            <>
              {' '}
              · <a href={tech.url} target="_blank" rel="noopener noreferrer">ATT&CK page</a>
            </>
          )}{' '}
          <button type="button" className="link-btn" onClick={() => set('technique', null)}>
            Clear
          </button>
        </p>
      )}
      <form className="filters card" onSubmit={(e) => e.preventDefault()} aria-label="Filter the Library">
        <label className="grow">
          <span>Search</span>
          <input type="search" value={q} placeholder="Title, technique, CVE, or path" onChange={(e) => set('q', e.target.value)} />
        </label>
        <label>
          <span>Platform</span>
          <select value={platformParam} onChange={(e) => set('platform', e.target.value)}>
            <option value="">All SIEM platforms</option>
            {LIBRARY_PLATFORMS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Tactic</span>
          <select value={tactic} onChange={(e) => set('tactic', e.target.value)}>
            <option value="">Any tactic</option>
            {attack?.tactics.map((t) => (
              <option key={t.short} value={t.short}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Technique ID</span>
          <input value={technique} placeholder="T1190" size={8} onChange={(e) => set('technique', e.target.value.toUpperCase().trim())} />
        </label>
        <label>
          <span>Product</span>
          <select value={product} onChange={(e) => set('product', e.target.value)}>
            <option value="">Any product</option>
            {products.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
        <label className="check">
          <input type="checkbox" checked={cveOnly} onChange={(e) => set('cve', e.target.checked ? '1' : null)} /> Names a CVE
        </label>
      </form>
      {error && <LoadError error={error} />}
      {!libs && !error && <Loading what="the Library" />}
      {libs && (
        <>
          <p className="result-count" role="status">
            {fmtNum(filtered.length)} rules
          </p>
          {shown.length ? (
            <ul className="rule-list">
              {shown.map((r) => (
                <li key={r.id}>
                  <div className="rule-row-head">
                    <span className={`chip chip-${r.platform}`}>{PLATFORM_BY_ID[r.platform].short}</span>
                    <Link to={`/rule/${r.platform}/${encodeURIComponent(r.id)}`}>{r.title}</Link>
                  </div>
                  <RuleMetaLine rule={r} />
                  {(r.techniques.length > 0 || r.cves.length > 0) && (
                    <div className="chips small">
                      {r.techniques.slice(0, 6).map((t) => (
                        <button key={t} type="button" className="chip mono" onClick={() => set('technique', t)} title={attack?.techniques[t]?.name}>
                          {t}
                        </button>
                      ))}
                      {r.cves.slice(0, 4).map((c) => (
                        <Link key={c} to={`/cve/${c}`} className="chip mono chip-cve">
                          {c}
                        </Link>
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <Empty>No rules match these filters.</Empty>
          )}
          <Pager page={page} pages={pages} onPage={(n) => set('page', String(n))} />
        </>
      )}
    </Page>
  );
}
