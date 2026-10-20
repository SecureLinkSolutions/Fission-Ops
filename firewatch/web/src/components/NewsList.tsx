import { Link } from 'react-router-dom';
import type { NewsFile, NewsItem, NewsStory, NewsType } from '../../../shared/types.ts';
import { fmtDateTime, fmtNewsDate } from '../lib/format.ts';
import { Badge, Empty, Ext } from './ui.tsx';

export const TYPE_LABEL: Record<NewsType, string> = { news: 'News', research: 'Research', government: 'Government' };

type Row = { kind: 'item'; item: NewsItem } | { kind: 'story'; story: NewsStory; items: NewsItem[] };

/** Group items into stories (headlines from two or more publishers about the same event), newest first. */
export function rowsFor(news: NewsFile, items: NewsItem[]): Row[] {
  const byId = new Map(items.map((i) => [i.id, i]));
  const rows: Row[] = [];
  const doneStories = new Set<string>();
  for (const item of items) {
    if (item.story) {
      if (doneStories.has(item.story)) continue;
      const story = news.stories.find((s) => s.id === item.story);
      const members = story?.items.map((id) => byId.get(id)).filter((i): i is NewsItem => !!i) ?? [];
      if (story && members.length > 1) {
        doneStories.add(story.id);
        rows.push({ kind: 'story', story, items: members });
        continue;
      }
    }
    rows.push({ kind: 'item', item });
  }
  return rows;
}

function ItemLine({ item, isNew }: { item: NewsItem; isNew?: boolean }) {
  return (
    <div className="news-item">
      <div className="news-meta">
        <Badge tone={item.type === 'government' ? 'info' : item.type === 'research' ? 'good' : 'neutral'}>{TYPE_LABEL[item.type]}</Badge>
        <span className="news-source">{item.source}</span>
        <time dateTime={item.date}>{fmtNewsDate(item.date)}</time>
        {isNew && <Badge tone="info">New</Badge>}
      </div>
      <Ext href={item.url} className="news-title">
        {item.title}
      </Ext>
      {item.cves.length > 0 && (
        <div className="news-cves">
          {item.cves.slice(0, 6).map((c) => (
            <Link key={c} to={`/cve/${c}`} className="mono chip">
              {c}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export function NewsList({ news, items, limit, isNew }: { news: NewsFile; items: NewsItem[]; limit?: number; isNew?: (id: string) => boolean }) {
  const rows = rowsFor(news, items).slice(0, limit);
  if (!rows.length) return <Empty>No headlines in this snapshot.</Empty>;
  return (
    <ol className="news-list">
      {rows.map((r) =>
        r.kind === 'item' ? (
          <li key={r.item.id}>
            <ItemLine item={r.item} isNew={isNew?.(r.item.id)} />
          </li>
        ) : (
          <li key={r.story.id} className="story">
            <p className="story-head">
              <Badge tone="info">Story</Badge> Covered by {new Set(r.items.map((i) => i.feed)).size} publishers · latest {fmtDateTime(r.story.latest)}
            </p>
            <p className="story-title">{r.story.title}</p>
            <ul>
              {r.items.map((i) => (
                <li key={i.id}>
                  <ItemLine item={i} isNew={isNew?.(i.id)} />
                </li>
              ))}
            </ul>
          </li>
        ),
      )}
    </ol>
  );
}
