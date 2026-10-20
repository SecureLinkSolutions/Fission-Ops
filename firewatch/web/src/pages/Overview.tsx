import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PLATFORM_BY_ID } from '../../../shared/platforms.ts';
import type { HistoryPoint, NewsType } from '../../../shared/types.ts';
import { KevTable } from '../components/KevTable.tsx';
import { NewsList } from '../components/NewsList.tsx';
import { Badge, CopyAddress, CveLink, Empty, LoadError, Loading, Page, PlatformPicker, RuleChips, Section, Sparkline, Stat, Tabs } from '../components/ui.tsx';
import { useAttack, useCoverage, useHistory, useKev, useNews, useSnapshot } from '../lib/data.ts';
import { adaptable, addDays, fmtDate, fmtDateTime, fmtNum, pctOf, techniqueGaps, todayIso } from '../lib/format.ts';
import { isWatchEmpty, usePlatform, useSeen, useWatchlist, watchMatches } from '../lib/prefs.ts';

export function Overview() {
  const snap = useSnapshot();
  const kev = useKev();
  const coverage = useCoverage();
  const attack = useAttack();
  const [platform] = usePlatform();
  const p = PLATFORM_BY_ID[platform];

  const err = snap.error ?? kev.error;
  if (err) return <Page title="Overview"><LoadError error={err} /></Page>;
  if (!snap.data || !kev.data) return <Page title="Overview"><Loading what="the snapshot" /></Page>;

  const s = snap.data;
  const entries = kev.data;
  const total = s.totals.kev;
  const cutoff30 = addDays(todayIso(), -30);
  const recent = entries.filter((e) => e.added >= cutoff30);
  const adapt = adaptable(entries, platform);
  const gaps = coverage.data ? techniqueGaps(coverage.data, platform) : [];
  const mineCovered = s.totals.platforms[platform].kevCovered;

  return (
    <Page title="Overview" intro="What is being exploited right now, from the CISA KEV catalog and FIRST EPSS.">
      <Section eyebrow="Your platform" title={p.name} aside={<PlatformPicker />} id="your-platform">
        <div className="stats">
          <Stat
            label={<>ATT&CK techniques other platforms cover and {p.name} does not</>}
            value={p.inLibrary ? fmtNum(gaps.length) : 'n/a'}
            sub={p.inLibrary ? undefined : 'Technique coverage is compared across SIEM platforms'}
            to={p.inLibrary ? `/library?gaps=${platform}` : undefined}
          />
          <Stat
            label={<>KEV entries with a CVE-specific {p.name} rule</>}
            value={p.namesCves ? fmtNum(mineCovered) : 'n/a'}
            sub={p.namesCves ? `${pctOf(mineCovered, total)} of ${fmtNum(total)}` : `${p.name} rules do not name CVEs`}
            to={`/coverage`}
          />
          <Stat label="In open-source packages: container, SCA, and CNAPP scanning" value={fmtNum(s.totals.find.package)} sub={`of ${fmtNum(total)} KEV entries`} to="/catalog?find=package" />
          <Stat label="With a public network check: external scanning" value={fmtNum(s.totals.find.network)} sub={`of ${fmtNum(total)}`} to="/catalog?find=network" />
          <Stat label="Appliance firmware: check against the vendor advisory" value={fmtNum(s.totals.find.appliance)} sub={`of ${fmtNum(total)}`} to="/catalog?find=appliance" />
        </div>
        <p className="note">
          A SIEM is not a vulnerability scanner. Whether you run a vulnerable version is for vulnerability management or a CNAPP to find; a CVE-specific SIEM
          rule is a bonus that looks for signs of exploitation, so a CVE without one is not a gap in {p.name}. Technique coverage is the SIEM's job.
        </p>
      </Section>

      <Section
        eyebrow={`New exploited CVEs, with how to find them and ${p.name} rules`}
        title="New exploited CVEs"
        id="new-cves"
        aside={
          <div className="row-actions">
            <CopyAddress />
            <Link className="btn btn-small" to="/coverage">
              Open {p.name} coverage
            </Link>
            <Link className="btn btn-small" to="/coverage#report">
              Coverage report
            </Link>
          </div>
        }
      >
        <p className="muted">Added in the last 30 days, newest first</p>
        {recent.length ? (
          <>
            <KevTable entries={recent.slice(0, 8)} platform={platform} caption="KEV entries added in the last 30 days" />
            {recent.length > 8 && (
              <p>
                <Link to="/catalog?added=30">Show all {recent.length}</Link>
              </p>
            )}
          </>
        ) : (
          <Empty>No KEV entries were added in the last 30 days.</Empty>
        )}
        <p className="note">
          How to find says which kind of tool finds each CVE; open a CVE for details. CVE-specific rules look for signs of exploitation and often follow a new
          KEV entry by days or weeks. Firewatch lists rules others published; it does not write or test them.
        </p>
      </Section>

      <div className="grid-2">
        <Section eyebrow="Optional: published for other platforms" title="CVE-specific rules you could adapt" id="adapt" aside={<span className="count">{fmtNum(adapt.length)} entries</span>}>
          {adapt.length ? (
            <ul className="plain-list">
              {adapt.slice(0, 6).map((e) => (
                <li key={e.cve}>
                  <CveLink id={e.cve} />
                  <span className="muted">
                    {' '}
                    {e.vendor} {e.product}
                  </span>
                  <div className="row-badges">
                    {e.ransomware && <Badge tone="bad">Known ransomware use</Badge>}
                    <RuleChips entry={e} exclude={platform} />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>Every KEV entry with a published rule elsewhere also has a {p.name} rule.</Empty>
          )}
          <p className="note">
            Exploitation signs another platform looks for, where {p.name} publishes no CVE-specific rule. Known ransomware use first, then by EPSS. Open a CVE to
            read the queries. <Link to="/coverage#adapt-all">See all {fmtNum(adapt.length)}</Link>
          </p>
        </Section>

        <Section eyebrow={`Other platforms publish rules, ${p.name} does not`} title="ATT&CK techniques to borrow rules for" id="borrow" aside={<span className="count">{fmtNum(gaps.length)} techniques</span>}>
          {!p.inLibrary ? (
            <Empty>Technique coverage is compared across the SIEM platforms in the Library. Pick a SIEM as your platform to see gaps.</Empty>
          ) : gaps.length ? (
            <>
              <ul className="plain-list">
                {gaps.slice(0, 6).map((g) => (
                  <li key={g.id}>
                    <Link to={`/library?technique=${g.id}`} className="mono">
                      {g.id}
                    </Link>{' '}
                    {attack.data?.techniques[g.id]?.name ?? ''}
                    <span className="muted"> · {fmtNum(g.elsewhere)} rules elsewhere</span>
                  </li>
                ))}
              </ul>
              <p>
                <Link to={`/library?gaps=${platform}`}>Open all {gaps.length} in the Library</Link>
              </p>
            </>
          ) : (
            <Empty>{coverage.data ? `${p.name} has rules for every technique the other platforms cover.` : 'Loading…'}</Empty>
          )}
        </Section>
      </div>

      <NewSinceVisit />
      <LatestIntel />
      <AtAGlance />
      <Trends />
      <div className="grid-2">
        <Deadlines />
        <WatchMatches />
      </div>
    </Page>
  );
}

function NewSinceVisit() {
  const { data: kev } = useKev();
  const { data: news } = useNews();
  const [seen, setSeen] = useSeen();

  const markAll = () =>
    setSeen({ enabled: true, markedAt: new Date().toISOString(), kev: kev?.map((e) => e.cve) ?? [], news: news?.items.map((i) => i.id) ?? [] });

  if (!seen.enabled) {
    return (
      <Section eyebrow="Optional, saved only in this browser" title="New since your last visit" id="new-since">
        <p>Firewatch can remember what you have already seen.</p>
        <p className="muted">
          Turn this on to see the KEV entries and headlines added since you last marked them as seen. It keeps a list of their IDs in this browser only;
          nothing is sent anywhere.
        </p>
        <button type="button" className="btn" onClick={markAll}>
          Start tracking
        </button>
      </Section>
    );
  }
  const seenKev = new Set(seen.kev);
  const seenNews = new Set(seen.news);
  const newKev = kev?.filter((e) => !seenKev.has(e.cve)) ?? [];
  const newNews = news?.items.filter((i) => !seenNews.has(i.id)) ?? [];
  return (
    <Section
      eyebrow="Saved only in this browser"
      title="New since your last visit"
      id="new-since"
      aside={
        <div className="row-actions">
          <button type="button" className="btn btn-small" onClick={markAll}>
            Mark all as seen
          </button>
          <button type="button" className="btn btn-small btn-ghost" onClick={() => setSeen({ enabled: false, markedAt: null, kev: [], news: [] })}>
            Stop tracking
          </button>
        </div>
      }
    >
      <p className="muted">Last marked as seen {fmtDateTime(seen.markedAt)}.</p>
      <div className="grid-2 tight">
        <div>
          <h3>KEV entries ({newKev.length})</h3>
          {newKev.length ? (
            <ul className="plain-list">
              {newKev.slice(0, 10).map((e) => (
                <li key={e.cve}>
                  <CveLink id={e.cve} /> <span className="muted">{e.vendor} {e.product} · added {fmtDate(e.added)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>Nothing new.</Empty>
          )}
        </div>
        <div>
          <h3>Headlines ({newNews.length})</h3>
          {newNews.length ? (
            <ul className="plain-list">
              {newNews.slice(0, 10).map((i) => (
                <li key={i.id}>
                  <a href={i.url} target="_blank" rel="noopener noreferrer">
                    {i.title}
                  </a>{' '}
                  <span className="muted">{i.source}</span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>Nothing new.</Empty>
          )}
        </div>
      </div>
    </Section>
  );
}

function LatestIntel() {
  const { data: news, error } = useNews();
  const [tab, setTab] = useState<NewsType>('news');
  const items = useMemo(() => news?.items.filter((i) => i.type === tab) ?? [], [news, tab]);
  return (
    <Section eyebrow="Security news, government advisories, and vendor threat research" title="Latest threat intelligence" id="latest-intel">
      <Tabs
        label="Headline type"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'news', label: 'Security news' },
          { value: 'research', label: 'Threat intel' },
          { value: 'government', label: 'Government' },
        ]}
      />
      {error ? <LoadError error={error} /> : !news ? <Loading what="headlines" /> : <NewsList news={news} items={items} limit={6} />}
      <p>
        <Link to={tab === 'news' ? '/news' : '/intel'}>More {tab === 'news' ? 'security news' : 'threat intelligence'}</Link>
      </p>
    </Section>
  );
}

function AtAGlance() {
  const { data: s } = useSnapshot();
  const { data: kev } = useKev();
  if (!s || !kev) return null;
  const today = todayIso();
  const due14 = kev.filter((e) => e.due >= today && e.due <= addDays(today, 14)).length;
  return (
    <Section eyebrow="Known exploited vulnerabilities" title="Catalog at a glance" id="glance">
      <div className="stats">
        <Stat label="KEV entries" value={fmtNum(s.totals.kev)} to="/catalog" />
        <Stat label="Added in the last 30 days" value={fmtNum(s.totals.added30)} to="/catalog?added=30" />
        <Stat label="Known ransomware use" value={fmtNum(s.totals.ransomware)} to="/catalog?ransomware=1" tone="bad" />
        <Stat label="Forensic triage required" value={fmtNum(s.totals.triage)} to="/catalog?triage=1" tone="warn" />
        <Stat label="Federal due date in the next 14 days" value={fmtNum(due14)} to="/catalog?due=14" />
        <Stat label="With published detections" value={fmtNum(s.totals.withDetections)} to="/catalog?rules=any" tone="good" />
      </div>
      <p className="source-line">
        Source: CISA KEV catalog {s.kev.version}, released {fmtDateTime(s.kev.released)}
      </p>
    </Section>
  );
}

type Window = '30' | '90' | 'all';

function Trends() {
  const { data: history } = useHistory();
  const { data: snap } = useSnapshot();
  const [platform] = usePlatform();
  const [win, setWin] = useState<Window>('30');
  if (!history || !snap) return null;
  const p = PLATFORM_BY_ID[platform];
  const from = win === 'all' ? '' : addDays(todayIso(), -Number(win));
  const pts = history.filter((h) => h.date >= from);
  const series: { label: string; get: (h: HistoryPoint) => number | undefined }[] = [
    { label: 'KEV entries', get: (h) => h.kev },
    { label: `KEV entries with a ${p.name} rule`, get: (h) => h.platforms[platform]?.kevCovered },
    ...(p.inLibrary ? [{ label: `${p.name} rules in the Library`, get: (h: HistoryPoint) => h.platforms[platform]?.libraryRules }] : []),
    { label: 'KEV entries with known ransomware use', get: (h) => h.ransomware },
  ];
  return (
    <Section eyebrow={`Daily totals from each published snapshot${history.length ? `, since ${fmtDate(history[0].date)}` : ''}`} title="Trends" id="trends">
      <Tabs
        label="Time window"
        value={win}
        onChange={setWin}
        options={[
          { value: '30', label: '30 days' },
          { value: '90', label: '90 days' },
          { value: 'all', label: 'All' },
        ]}
      />
      <div className="trends">
        {series.map((sr) => {
          const points = pts.map((h) => ({ date: h.date, value: sr.get(h) })).filter((x): x is { date: string; value: number } => x.value != null);
          const last = points[points.length - 1]?.value;
          const first = points[0];
          const delta = last != null && first ? last - first.value : null;
          return (
            <div key={sr.label} className="trend">
              <p className="stat-label">{sr.label}</p>
              <p className="stat-value">{fmtNum(last)}</p>
              <p className="stat-sub">{delta == null ? 'No data yet' : `${delta > 0 ? '+' : delta < 0 ? '−' : '±'}${fmtNum(Math.abs(delta))} since ${fmtDate(first.date)}`}</p>
              <Sparkline points={points} label={`${sr.label} over time`} />
            </div>
          );
        })}
      </div>
      <p className="note">Counts of what each day's snapshot published; days without an update have no point, and nothing is estimated.</p>
    </Section>
  );
}

function Deadlines() {
  const { data: kev } = useKev();
  const { data: s } = useSnapshot();
  if (!kev || !s) return null;
  const today = todayIso();
  const due = kev.filter((e) => e.due >= today && e.due <= addDays(today, 14)).sort((a, b) => a.due.localeCompare(b.due));
  return (
    <Section eyebrow="Deadlines for US federal civilian agencies" title="Due in the next 14 days" id="deadlines">
      {due.length ? (
        <ul className="plain-list">
          {due.map((e) => (
            <li key={e.cve}>
              <CveLink id={e.cve} /> <span className="muted">{e.vendor} {e.product}</span> <Badge tone="warn">due {fmtDate(e.due)}</Badge>
            </li>
          ))}
        </ul>
      ) : (
        <Empty>No federal due dates in the next 14 days.</Empty>
      )}
      <p className="muted">Checked against {fmtDate(today)}.</p>
      <p className="source-line">
        Source: CISA KEV catalog {s.kev.version}, released {fmtDateTime(s.kev.released)}
      </p>
    </Section>
  );
}

function WatchMatches() {
  const { data: kev } = useKev();
  const [watch] = useWatchlist();
  const matches = kev?.filter((e) => watchMatches(watch, e)) ?? [];
  return (
    <Section eyebrow="Saved in this browser" title="Watchlist matches" id="watch-matches">
      {isWatchEmpty(watch) ? (
        <>
          <Empty>Your watchlist is empty.</Empty>
          <p className="muted">Watch vendors or products to track their KEV entries here.</p>
        </>
      ) : matches.length ? (
        <ul className="plain-list">
          {matches.slice(0, 8).map((e) => (
            <li key={e.cve}>
              <CveLink id={e.cve} /> <span className="muted">{e.vendor} {e.product} · added {fmtDate(e.added)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <Empty>No KEV entries match your watchlist.</Empty>
      )}
      <p>
        <Link to="/watchlist">Open Watchlist</Link>
      </p>
    </Section>
  );
}
