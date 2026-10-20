import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import type { NewsItem, NewsType } from '../../../shared/types.ts';
import { NewsList } from '../components/NewsList.tsx';
import { CopyAddress, LoadError, Loading, Page, Section, Tabs } from '../components/ui.tsx';
import { useKev, useNews, useSnapshot } from '../lib/data.ts';
import { fmtDateTime, fmtNum } from '../lib/format.ts';
import { useSeen } from '../lib/prefs.ts';

interface Config {
  title: string;
  intro: string;
  types: NewsType[];
}

const PAGES: Record<'news' | 'intel', Config> = {
  news: {
    title: 'Security News',
    intro: 'Headlines from security news publishers over the last 30 days. Firewatch shows the headline, date, and a link; read the story on the publisher’s site.',
    types: ['news'],
  },
  intel: {
    title: 'Threat Intel',
    intro: 'Vendor threat research and government advisories from the last 30 days, with the KEV entries they name.',
    types: ['research', 'government'],
  },
};

function NewsPage({ kind }: { kind: 'news' | 'intel' }) {
  const cfg = PAGES[kind];
  const { data: news, error } = useNews();
  const { data: snap } = useSnapshot();
  const { data: kev } = useKev();
  const [params, setParams] = useSearchParams();
  const [seen] = useSeen();
  const type = (params.get('type') as NewsType | null) ?? 'all';
  const source = params.get('source') ?? '';
  const q = params.get('q') ?? '';
  const kevOnly = params.get('kev') === '1';

  const set = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  const kevSet = useMemo(() => new Set(kev?.map((e) => e.cve) ?? []), [kev]);
  const pool = useMemo(() => news?.items.filter((i) => cfg.types.includes(i.type)) ?? [], [news, cfg]);
  const sources = useMemo(() => [...new Set(pool.map((i) => i.source))].sort(), [pool]);
  const items = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    return pool.filter(
      (i: NewsItem) =>
        (type === 'all' || i.type === type) &&
        (!source || i.source === source) &&
        (!kevOnly || i.cves.some((c) => kevSet.has(c))) &&
        words.every((w) => i.title.toLowerCase().includes(w)),
    );
  }, [pool, type, source, q, kevOnly, kevSet]);

  const mentioned = useMemo(() => {
    const counts = new Map<string, number>();
    for (const i of pool) for (const c of i.cves) if (kevSet.has(c)) counts.set(c, (counts.get(c) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
  }, [pool, kevSet]);

  const seenSet = new Set(seen.news);

  return (
    <Page title={cfg.title} intro={cfg.intro} actions={<CopyAddress />}>
      {error && <LoadError error={error} />}
      {!news && !error && <Loading what="headlines" />}
      {news && (
        <>
          <form className="filters card" onSubmit={(e) => e.preventDefault()} aria-label="Filter headlines">
            {cfg.types.length > 1 && (
              <Tabs
                label="Headline type"
                value={type}
                onChange={(v) => set('type', v === 'all' ? null : v)}
                options={[{ value: 'all' as const, label: 'All' }, ...cfg.types.map((t) => ({ value: t, label: t === 'research' ? 'Vendor research' : 'Government' }))]}
              />
            )}
            <label className="grow">
              <span>Search headlines</span>
              <input type="search" value={q} onChange={(e) => set('q', e.target.value)} />
            </label>
            <label>
              <span>Publisher</span>
              <select value={source} onChange={(e) => set('source', e.target.value)}>
                <option value="">All publishers</option>
                {sources.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <label className="check">
              <input type="checkbox" checked={kevOnly} onChange={(e) => set('kev', e.target.checked ? '1' : null)} /> Names a KEV CVE
            </label>
          </form>
          {mentioned.length > 0 && (
            <Section eyebrow="Most mentioned in these headlines" title="KEV entries in the news" id="mentioned">
              <ul className="chips">
                {mentioned.map(([cve, n]) => (
                  <li key={cve}>
                    <Link to={`/cve/${cve}`} className="chip mono">
                      {cve} · {n}
                    </Link>
                  </li>
                ))}
              </ul>
            </Section>
          )}
          <p className="result-count" role="status">
            {fmtNum(items.length)} headlines · updated {fmtDateTime(snap?.newsGenerated ?? news.generated)}
          </p>
          <NewsList news={news} items={items} isNew={seen.enabled ? (id) => !seenSet.has(id) : undefined} />
          <p className="note">
            Items from the last 30 days are kept, up to 100 per feed. Headlines link to each publisher’s own page; Firewatch copies no article text. Feed status
            is on <Link to="/health#news-feeds">Data Health</Link>.
          </p>
        </>
      )}
    </Page>
  );
}

export const SecurityNews = () => <NewsPage kind="news" />;
export const ThreatIntel = () => <NewsPage kind="intel" />;
