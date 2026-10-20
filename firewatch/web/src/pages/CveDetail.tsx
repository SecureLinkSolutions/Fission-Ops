import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CVE_PLATFORMS, PLATFORM_BY_ID } from '../../../shared/platforms.ts';
import { NewsList } from '../components/NewsList.tsx';
import { RuleView, TechniqueChips } from '../components/RuleView.tsx';
import { Badge, Empty, EpssHistoryChart, Ext, FindTags, Loading, Page, Section } from '../components/ui.tsx';
import { useAttack, useCve, useNews } from '../lib/data.ts';
import { FIND_HELP, daysBetween, fmtDate, fmtEpss, fmtPercentile } from '../lib/format.ts';
import { usePlatform, useWatchlist } from '../lib/prefs.ts';

export function CveDetail() {
  const { id = '' } = useParams();
  const cveId = id.toUpperCase();
  const { data, error } = useCve(cveId);
  const { data: attack } = useAttack();
  const { data: news } = useNews();
  const [platform] = usePlatform();
  const [watch, setWatch] = useWatchlist();

  const mentions = useMemo(() => news?.items.filter((i) => i.cves.includes(cveId)) ?? [], [news, cveId]);

  if (error) {
    return (
      <Page title={cveId}>
        <p className="notice">
          {cveId} is not in this snapshot of the CISA KEV catalog. Firewatch covers known exploited vulnerabilities only.{' '}
          <Ext href={`https://nvd.nist.gov/vuln/detail/${cveId}`}>Open it on NVD</Ext>.
        </p>
      </Page>
    );
  }
  if (!data) return <Page title={cveId}><Loading what={cveId} /></Page>;

  const { kev: k, nvd } = data;
  const watching = watch.cves.includes(k.cve);
  const ordered = [...CVE_PLATFORMS].sort((a, b) => Number(b.id === platform) - Number(a.id === platform));
  const age = daysBetween(k.added, new Date());

  return (
    <Page
      title={k.cve}
      intro={k.name}
      actions={
        <button
          type="button"
          className="btn btn-small"
          aria-pressed={watching}
          onClick={() => setWatch((w) => ({ ...w, cves: watching ? w.cves.filter((c) => c !== k.cve) : [...w.cves, k.cve] }))}
        >
          {watching ? 'Watching' : 'Watch this CVE'}
        </button>
      }
    >
      <div className="row-badges big">
        {k.ransomware && <Badge tone="bad">Known ransomware use</Badge>}
        {k.triage && <Badge tone="warn">Forensic triage required</Badge>}
        <FindTags tags={k.find} />
      </div>

      <div className="grid-2">
        <Section eyebrow="CISA KEV" title="Catalog entry" id="kev">
          <dl className="facts">
            <dt>Vendor</dt>
            <dd>
              <Link to={`/catalog?vendor=${encodeURIComponent(k.vendor)}`}>{k.vendor}</Link>
            </dd>
            <dt>Product</dt>
            <dd>{k.product}</dd>
            <dt>Added to KEV</dt>
            <dd>
              {fmtDate(k.added)} <span className="muted">({age} days ago)</span>
            </dd>
            <dt>Federal due date</dt>
            <dd>{fmtDate(k.due)}</dd>
            <dt>CWE</dt>
            <dd>{k.cwes.length ? k.cwes.map((c) => <Ext key={c} href={`https://cwe.mitre.org/data/definitions/${c.replace('CWE-', '')}.html`}>{c}</Ext>) : '—'}</dd>
          </dl>
          <p>{k.desc}</p>
          <h3>Required action</h3>
          <p>{k.action}</p>
          {k.notes && (
            <details>
              <summary>CISA notes and links</summary>
              <ul className="link-list">
                {k.notes
                  .split(/\s;\s|\s+(?=https?:)/)
                  .map((n) => n.trim())
                  .filter(Boolean)
                  .map((n) => {
                    const url = /https?:\/\/\S+/.exec(n)?.[0];
                    return <li key={n}>{url ? <Ext href={url}>{n.replace(url, '').replace(/:\s*$/, '') || url}</Ext> : n}</li>;
                  })}
              </ul>
            </details>
          )}
        </Section>

        <Section eyebrow="Exploit prediction and severity" title="Scores" id="scores">
          <dl className="facts">
            <dt>EPSS</dt>
            <dd>
              {fmtEpss(k.epss)} <span className="muted">{fmtPercentile(k.pct)}</span>
            </dd>
            <dt>CVSS</dt>
            <dd>
              {nvd?.cvss.length
                ? nvd.cvss.slice(0, 3).map((c) => (
                    <span key={`${c.version}${c.source}`} className="cvss">
                      {c.score} {c.severity} <span className="muted">v{c.version} · {c.source}</span>
                    </span>
                  ))
                : '—'}
            </dd>
          </dl>
          <h3>EPSS, last 30 days</h3>
          <EpssHistoryChart series={data.epssHistory} />
          <p className="note">EPSS estimates the probability of exploitation activity in the next 30 days. It is not a severity rating, and every KEV entry is already exploited.</p>
        </Section>
      </div>

      <Section eyebrow="Which kind of tool finds it" title="How to find" id="find">
        <ul className="plain-list">
          {k.find.map((t) => (
            <li key={t}>
              <FindTags tags={[t]} /> {FIND_HELP[t]}
            </li>
          ))}
        </ul>
        <div className="grid-2 tight">
          <div>
            <h3>Open-source packages</h3>
            {data.packages.length ? (
              <table className="data-table compact">
                <thead>
                  <tr>
                    <th scope="col">Package</th>
                    <th scope="col">Ecosystem</th>
                    <th scope="col">Fixed in</th>
                  </tr>
                </thead>
                <tbody>
                  {data.packages.map((p) => (
                    <tr key={`${p.source}${p.ecosystem}${p.name}`}>
                      <td>
                        <Ext href={p.url}>{p.name}</Ext>
                      </td>
                      <td>{p.ecosystem}</td>
                      <td className="mono small">{p.fixed.slice(0, 4).join(', ') || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <Empty>No GitHub or Debian advisory names this CVE.</Empty>
            )}
          </div>
          <div>
            <h3>Network checks</h3>
            {data.nuclei.length ? (
              <ul className="plain-list">
                {data.nuclei.map((n) => (
                  <li key={n.url}>
                    <Ext href={n.url}>{n.name}</Ext> <span className="muted">Nuclei · {n.severity}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>No public Nuclei template.</Empty>
            )}
            <h3>Public exploits</h3>
            {data.metasploit.length || data.exploitdb.length ? (
              <ul className="plain-list">
                {data.metasploit.map((m) => (
                  <li key={m.url}>
                    <Ext href={m.url}>{m.name}</Ext>{' '}
                    <span className="muted">
                      Metasploit <span className="mono">{m.fullname}</span> · {m.rank}
                      {m.check ? ' · has a check' : ''}
                    </span>
                  </li>
                ))}
                {data.exploitdb.map((x) => (
                  <li key={x.id}>
                    <Ext href={x.url}>{x.title}</Ext>{' '}
                    <span className="muted">
                      Exploit-DB {x.id} · {x.type} · {fmtDate(x.date)}
                      {x.verified ? ' · verified' : ''}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>No Metasploit module or Exploit-DB entry.</Empty>
            )}
          </div>
        </div>
      </Section>

      <Section eyebrow="Published by vendors and communities, shown verbatim and untested" title="CVE-specific detection rules" id="rules">
        <TechniqueChips ids={k.techniques} attack={attack} />
        {data.rules.length === 0 && (
          <Empty>
            No published rule names {k.cve}. That is not a gap: a CVE-specific rule is a bonus that looks for signs of exploitation; technique coverage in the{' '}
            <Link to="/library">Library</Link> is what a SIEM is for.
          </Empty>
        )}
        {ordered.map((p) => {
          const rules = data.rules.filter((r) => r.platform === p.id);
          if (!rules.length) return null;
          return (
            <div key={p.id} className="platform-rules">
              <h3>
                {p.name} <span className="count">{rules.length}</span> {p.id === platform && <Badge tone="info">My platform</Badge>}
              </h3>
              {rules.map((r) => (
                <RuleView key={r.id} rule={r} attack={attack} collapsed={rules.length > 2 || data.rules.length > 4} />
              ))}
            </div>
          );
        })}
        {!data.rules.some((r) => r.platform === platform) && data.rules.length > 0 && (
          <p className="note">{PLATFORM_BY_ID[platform].name} publishes no rule naming this CVE; the rules above could be adapted.</p>
        )}
      </Section>

      {nvd && (
        <Section eyebrow="NIST NVD" title="CVE record" id="nvd">
          <p>{nvd.description}</p>
          <dl className="facts">
            <dt>Status</dt>
            <dd>{nvd.status}</dd>
            <dt>Published</dt>
            <dd>{fmtDate(nvd.published)}</dd>
            <dt>Last modified</dt>
            <dd>{fmtDate(nvd.modified)}</dd>
            <dt>Affected products (CPE)</dt>
            <dd>
              {[...new Set(nvd.cpes.filter((c) => !c.part.endsWith('platform')).map((c) => `${c.vendor}:${c.product}`))].slice(0, 12).join(', ') || '—'}
            </dd>
          </dl>
          <details>
            <summary>References ({nvd.references.length})</summary>
            <ul className="link-list">
              {nvd.references.map((r) => (
                <li key={r.url}>
                  <Ext href={r.url}>{r.url}</Ext> {r.tags.length > 0 && <span className="muted small">{r.tags.join(', ')}</span>}
                </li>
              ))}
            </ul>
          </details>
          <p>
            <Ext href={`https://nvd.nist.gov/vuln/detail/${k.cve}`}>Open on NVD</Ext> · <Ext href={`https://www.cve.org/CVERecord?id=${k.cve}`}>Primary CVE record</Ext>
          </p>
        </Section>
      )}

      <Section eyebrow="Headlines naming this CVE" title="In the news" id="mentions">
        {news ? <NewsList news={news} items={mentions} limit={10} /> : <Loading what="headlines" />}
      </Section>
    </Page>
  );
}
