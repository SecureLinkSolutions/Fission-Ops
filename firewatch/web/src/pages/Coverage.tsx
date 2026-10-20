import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { CVE_PLATFORMS, PLATFORM_BY_ID, PLATFORMS } from '../../../shared/platforms.ts';
import { Badge, CveLink, Empty, LoadError, Loading, Page, PlatformPicker, RuleChips, Section } from '../components/ui.tsx';
import { useAttack, useCoverage, useKev, useSnapshot } from '../lib/data.ts';
import { adaptable, download, fmtNum, pctOf, techniqueGaps, toCsv, todayIso } from '../lib/format.ts';
import { usePlatform } from '../lib/prefs.ts';

export function Coverage() {
  const { data: snap, error } = useSnapshot();
  const { data: kev } = useKev();
  const { data: coverage } = useCoverage();
  const { data: attack } = useAttack();
  const [platform] = usePlatform();
  const p = PLATFORM_BY_ID[platform];

  const adapt = useMemo(() => (kev ? adaptable(kev, platform) : []), [kev, platform]);
  const gaps = useMemo(() => (coverage ? techniqueGaps(coverage, platform) : []), [coverage, platform]);

  /** Per tactic: techniques with any library rule, and how many of those `platform` covers. */
  const tactics = useMemo(() => {
    if (!attack || !coverage) return [];
    return attack.tactics.map((t) => {
      const ids = Object.entries(attack.techniques)
        .filter(([, tech]) => tech.tactics.includes(t.short))
        .map(([id]) => id);
      const anyone = ids.filter((id) => coverage[id] && Object.values(coverage[id]).some(Boolean));
      const mine = ids.filter((id) => coverage[id]?.[platform]);
      return { ...t, total: ids.length, anyone: anyone.length, mine: mine.length };
    });
  }, [attack, coverage, platform]);

  if (error) return <Page title="Coverage"><LoadError error={error} /></Page>;
  if (!snap || !kev) return <Page title="Coverage"><Loading /></Page>;

  const totals = snap.totals.platforms;
  const exportReport = () => {
    const rows: (string | number | null)[][] = [
      ['section', 'id', 'name', 'detail', 'value'],
      ...PLATFORMS.map((x) => ['platform', x.id, x.name, 'kev_entries_with_cve_rule', totals[x.id].kevCovered]),
      ...adapt.map((e) => ['adapt', e.cve, `${e.vendor} ${e.product}`, Object.entries(e.rules).map(([k, v]) => `${k}:${v}`).join(' '), e.epss]),
      ...gaps.map((g) => ['technique_gap', g.id, attack?.techniques[g.id]?.name ?? '', g.platforms.join(' '), g.elsewhere]),
    ];
    download(`firewatch-coverage-${platform}-${todayIso()}.csv`, toCsv(rows));
  };

  return (
    <Page
      title="Coverage"
      intro="How each platform’s published content lines up against the KEV catalog and ATT&CK, and what you could borrow from the others."
      actions={
        <>
          <PlatformPicker />
          <button type="button" className="btn btn-small" onClick={exportReport}>
            Export coverage report
          </button>
        </>
      }
    >
      <Section eyebrow="All platforms" title="Published content compared" id="compare">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Platform</th>
                <th scope="col">KEV entries with a CVE-specific rule</th>
                <th scope="col">Rules naming a KEV CVE</th>
                <th scope="col">Rules in the Library</th>
                <th scope="col">ATT&CK techniques covered</th>
              </tr>
            </thead>
            <tbody>
              {PLATFORMS.map((x) => (
                <tr key={x.id} className={x.id === platform ? 'row-mine' : undefined}>
                  <th scope="row">
                    {x.name} {x.id === platform && <Badge tone="info">My platform</Badge>}
                  </th>
                  <td className="num">{x.namesCves ? `${fmtNum(totals[x.id].kevCovered)} (${pctOf(totals[x.id].kevCovered, snap.totals.kev)})` : 'Rules do not name CVEs'}</td>
                  <td className="num">{x.namesCves ? fmtNum(totals[x.id].rulesNamingKev) : '—'}</td>
                  <td className="num">{x.inLibrary ? <Link to={`/library?platform=${x.id}`}>{fmtNum(totals[x.id].libraryRules)}</Link> : 'Only rules naming a KEV CVE are kept'}</td>
                  <td className="num">{x.inLibrary ? fmtNum(totals[x.id].techniques) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="note">
          Counts are of rules each publisher released, not of rules you have deployed. Cortex XSIAM correlation rules do not name CVEs, so XSIAM has no
          CVE-specific count. Suricata and XSOAR content is kept only where it names a KEV CVE.
        </p>
      </Section>

      {p.inLibrary && (
        <Section eyebrow={`ATT&CK coverage by tactic for ${p.name}`} title="Technique coverage" id="report">
          {!tactics.length ? (
            <Loading what="ATT&CK" />
          ) : (
            <div className="tactic-grid">
              {tactics.map((t) => (
                <Link key={t.id} to={`/library?tactic=${t.short}&platform=${platform}`} className="tactic">
                  <span className="tactic-name">{t.name}</span>
                  <span className="meter" aria-hidden="true">
                    <span className="meter-any" style={{ width: `${(t.anyone / Math.max(t.total, 1)) * 100}%` }} />
                    <span className="meter-mine" style={{ width: `${(t.mine / Math.max(t.total, 1)) * 100}%` }} />
                  </span>
                  <span className="tactic-count">
                    {t.mine} of {t.anyone} covered elsewhere · {t.total} techniques
                  </span>
                </Link>
              ))}
            </div>
          )}
          <p className="note">
            Dark bar: techniques with at least one {p.name} rule. Light bar: techniques any SIEM platform publishes a rule for. Technique coverage is the SIEM's
            job; CVE-specific rules are a bonus.
          </p>
        </Section>
      )}

      <div className="grid-2">
        <Section eyebrow={`Other platforms publish rules, ${p.name} does not`} title="ATT&CK techniques to borrow rules for" id="gaps" aside={<span className="count">{gaps.length}</span>}>
          {!p.inLibrary ? (
            <Empty>Pick a SIEM platform to compare technique coverage.</Empty>
          ) : gaps.length ? (
            <ul className="plain-list scroll">
              {gaps.map((g) => (
                <li key={g.id}>
                  <Link to={`/library?technique=${g.id}`} className="mono">
                    {g.id}
                  </Link>{' '}
                  {attack?.techniques[g.id]?.name}
                  <span className="muted">
                    {' '}
                    · {g.elsewhere} rules in {g.platforms.map((x) => PLATFORM_BY_ID[x].short).join(', ')}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>No gaps against the other SIEM platforms.</Empty>
          )}
          {p.inLibrary && gaps.length > 0 && (
            <p>
              <Link to={`/library?gaps=${platform}`}>Open all {gaps.length} in the Library</Link>
            </p>
          )}
        </Section>

        <Section eyebrow="Optional: published for other platforms" title="CVE-specific rules you could adapt" id="adapt-all" aside={<span className="count">{adapt.length}</span>}>
          {adapt.length ? (
            <ul className="plain-list scroll">
              {adapt.map((e) => (
                <li key={e.cve}>
                  <CveLink id={e.cve} /> <span className="muted">{e.vendor} {e.product}</span>
                  <div className="row-badges">
                    {e.ransomware && <Badge tone="bad">Known ransomware use</Badge>}
                    <RuleChips entry={e} exclude={platform} />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>Nothing to adapt.</Empty>
          )}
        </Section>
      </div>

      <Section eyebrow="Where coverage overlaps" title="KEV entries covered by more than one platform" id="overlap">
        <div className="table-wrap">
          <table className="data-table compact">
            <thead>
              <tr>
                <th scope="col">Platform</th>
                {CVE_PLATFORMS.map((x) => (
                  <th key={x.id} scope="col">
                    {x.short}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {CVE_PLATFORMS.map((a) => (
                <tr key={a.id}>
                  <th scope="row">{a.short}</th>
                  {CVE_PLATFORMS.map((b) => (
                    <td key={b.id} className="num">
                      {fmtNum(kev.filter((e) => e.rules[a.id] && e.rules[b.id]).length)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="note">Each cell counts KEV entries with a CVE-specific rule on both platforms. The diagonal is each platform’s own total.</p>
      </Section>
    </Page>
  );
}
