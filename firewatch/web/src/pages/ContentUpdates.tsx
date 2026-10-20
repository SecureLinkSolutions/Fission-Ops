import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { PLATFORM_BY_ID, PLATFORMS } from '../../../shared/platforms.ts';
import type { ContentUpdate, PlatformId } from '../../../shared/types.ts';
import { Badge, CopyAddress, Empty, Ext, LoadError, Loading, Page, Pager, Stat } from '../components/ui.tsx';
import { useKev, useUpdates } from '../lib/data.ts';
import { fmtDate, fmtNum } from '../lib/format.ts';

const PAGE_SIZE = 100;
const TONE = { added: 'good', modified: 'neutral', removed: 'bad' } as const;

export function ContentUpdates() {
  const { data, error } = useUpdates();
  const { data: kev } = useKev();
  const [params, setParams] = useSearchParams();
  const platform = (params.get('platform') ?? '') as PlatformId | '';
  const change = params.get('change') ?? '';
  const kevOnly = params.get('kev') === '1';
  const page = Math.max(1, Number(params.get('page') ?? 1));

  const set = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.delete('page');
    setParams(next, { replace: true });
  };

  const kevSet = useMemo(() => new Set(kev?.map((e) => e.cve) ?? []), [kev]);
  const filtered = useMemo(
    () =>
      data?.items.filter(
        (u) => (!platform || u.platform === platform) && (!change || u.change === change) && (!kevOnly || u.cves.some((c) => kevSet.has(c))),
      ) ?? [],
    [data, platform, change, kevOnly, kevSet],
  );

  const byDay = useMemo(() => {
    const groups = new Map<string, ContentUpdate[]>();
    for (const u of filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)) {
      const d = u.date.slice(0, 10);
      groups.set(d, [...(groups.get(d) ?? []), u]);
    }
    return [...groups.entries()];
  }, [filtered, page]);

  if (error) return <Page title="Content Updates"><LoadError error={error} /></Page>;
  if (!data) return <Page title="Content Updates"><Loading what="content updates" /></Page>;

  const count = (c: string) => filtered.filter((u) => u.change === c).length;

  return (
    <Page
      title="Content Updates"
      intro={`Rules each publisher added, changed, or removed since ${fmtDate(data.since)}, from the repositories’ commit history. Emerging Threats publishes no history, so its changes are compared between Firewatch snapshots.`}
      actions={<CopyAddress />}
    >
      <div className="stats">
        <Stat label="Added" value={fmtNum(count('added'))} tone="good" />
        <Stat label="Changed" value={fmtNum(count('modified'))} />
        <Stat label="Removed" value={fmtNum(count('removed'))} tone="bad" />
        <Stat label="Naming a KEV CVE" value={fmtNum(filtered.filter((u) => u.cves.some((c) => kevSet.has(c))).length)} />
      </div>
      <form className="filters card" onSubmit={(e) => e.preventDefault()} aria-label="Filter content updates">
        <label>
          <span>Platform</span>
          <select value={platform} onChange={(e) => set('platform', e.target.value)}>
            <option value="">All platforms</option>
            {PLATFORMS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Change</span>
          <select value={change} onChange={(e) => set('change', e.target.value)}>
            <option value="">Any</option>
            <option value="added">Added</option>
            <option value="modified">Changed</option>
            <option value="removed">Removed</option>
          </select>
        </label>
        <label className="check">
          <input type="checkbox" checked={kevOnly} onChange={(e) => set('kev', e.target.checked ? '1' : null)} /> Names a KEV CVE
        </label>
      </form>
      {byDay.length === 0 && <Empty>No content updates match these filters.</Empty>}
      {byDay.map(([day, items]) => (
        <section key={day} className="card" aria-label={fmtDate(day)}>
          <h2 className="day-head">{fmtDate(day)}</h2>
          <ul className="update-list">
            {items.map((u, i) => (
              <li key={`${u.path}${u.change}${i}`}>
                <Badge tone={TONE[u.change]}>{u.change === 'modified' ? 'changed' : u.change}</Badge>
                <span className={`chip chip-${u.platform}`}>{PLATFORM_BY_ID[u.platform].short}</span>
                {u.ruleId && PLATFORM_BY_ID[u.platform].inLibrary ? (
                  <Link to={`/rule/${u.platform}/${encodeURIComponent(u.ruleId)}`}>{u.title}</Link>
                ) : u.change === 'removed' ? (
                  <span>{u.title}</span>
                ) : (
                  <Ext href={u.url}>{u.title}</Ext>
                )}
                {u.cves.filter((c) => kevSet.has(c)).map((c) => (
                  <Link key={c} to={`/cve/${c}`} className="chip mono chip-cve">
                    {c}
                  </Link>
                ))}
                {u.commit && (
                  <Ext href={u.url.includes('/commit/') ? u.url : `${u.url.split('/blob/')[0]}/commit/${u.commit}`} className="muted small">
                    {u.commit.slice(0, 7)}
                  </Ext>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
      <Pager page={page} pages={Math.ceil(filtered.length / PAGE_SIZE)} onPage={(n) => set('page', String(n))} />
    </Page>
  );
}
