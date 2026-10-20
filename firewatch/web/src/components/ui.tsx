import { useEffect, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { CVE_PLATFORMS, PLATFORM_BY_ID, PLATFORMS } from '../../../shared/platforms.ts';
import type { FindTag, KevEntry, PlatformId } from '../../../shared/types.ts';
import { FIND_HELP, FIND_LABEL, fmtEpss, fmtPercentile, otherPlatformRules } from '../lib/format.ts';
import { usePlatform } from '../lib/prefs.ts';

export function Page({ title, intro, children, actions }: { title: string; intro?: ReactNode; children: ReactNode; actions?: ReactNode }) {
  useEffect(() => {
    document.title = `${title} · Project Firewatch`;
  }, [title]);
  return (
    <>
      <header className="page-head">
        <div>
          <h1 id="page-title" tabIndex={-1}>
            {title}
          </h1>
          {intro && <p className="lede">{intro}</p>}
        </div>
        {actions && <div className="page-actions">{actions}</div>}
      </header>
      {children}
    </>
  );
}

export function Section({ eyebrow, title, children, aside, id }: { eyebrow?: string; title: string; children: ReactNode; aside?: ReactNode; id?: string }) {
  return (
    <section className="card" aria-labelledby={id} id={id ? `${id}-section` : undefined}>
      <div className="card-head">
        <div>
          {eyebrow && <p className="eyebrow">{eyebrow}</p>}
          <h2 id={id}>{title}</h2>
        </div>
        {aside && <div className="card-aside">{aside}</div>}
      </div>
      {children}
    </section>
  );
}

export function Stat({ label, value, sub, to, tone }: { label: ReactNode; value: ReactNode; sub?: ReactNode; to?: string; tone?: 'warn' | 'bad' | 'good' }) {
  const inner = (
    <>
      <span className="stat-label">{label}</span>
      <span className={`stat-value${tone ? ` tone-${tone}` : ''}`}>{value}</span>
      {sub && <span className="stat-sub">{sub}</span>}
    </>
  );
  return to ? (
    <Link className="stat stat-link" to={to}>
      {inner}
    </Link>
  ) : (
    <div className="stat">{inner}</div>
  );
}

export function Loading({ what = 'data' }: { what?: string }) {
  return (
    <p className="muted loading" role="status">
      Loading {what}…
    </p>
  );
}

export function LoadError({ error }: { error: string }) {
  return (
    <p className="notice notice-bad" role="alert">
      Could not load this data ({error}). The ingest may not have run yet; check Data Health.
    </p>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="empty">{children}</p>;
}

export function Badge({ children, tone = 'neutral', title }: { children: ReactNode; tone?: 'neutral' | 'bad' | 'warn' | 'good' | 'info'; title?: string }) {
  return (
    <span className={`badge badge-${tone}`} title={title}>
      {children}
    </span>
  );
}

export function FindTags({ tags }: { tags: FindTag[] }) {
  return (
    <span className="tags">
      {tags.map((t) => (
        <span key={t} className={`tag tag-${t}`} title={FIND_HELP[t]}>
          {FIND_LABEL[t]}
        </span>
      ))}
    </span>
  );
}

export function Epss({ e, p }: { e: number | null; p: number | null }) {
  if (e == null) return <span className="muted">Not scored</span>;
  return (
    <span className="epss">
      <span className="epss-score">{fmtEpss(e)}</span>
      <span className="epss-pct">{fmtPercentile(p)}</span>
    </span>
  );
}

export function RuleChips({ entry, exclude }: { entry: KevEntry; exclude?: PlatformId }) {
  const others = exclude ? otherPlatformRules(entry, exclude) : CVE_PLATFORMS.filter((p) => entry.rules[p.id]).map((p) => ({ platform: p, count: entry.rules[p.id]! }));
  if (!others.length) return <span className="muted">—</span>;
  return (
    <span className="chips">
      {others.map(({ platform, count }) => (
        <span key={platform.id} className={`chip chip-${platform.id}`}>
          {platform.name} {count}
        </span>
      ))}
    </span>
  );
}

export function CveLink({ id }: { id: string }) {
  return (
    <Link className="cve-link mono" to={`/cve/${id}`}>
      {id}
    </Link>
  );
}

export function PlatformPicker({ label = 'My platform', includeNonLibrary = true }: { label?: string; includeNonLibrary?: boolean }) {
  const [platform, setPlatform] = usePlatform();
  return (
    <label className="platform-picker">
      <span>{label}</span>
      <select value={platform} onChange={(e) => setPlatform(e.target.value as PlatformId)}>
        {PLATFORMS.filter((p) => includeNonLibrary || p.inLibrary).map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
    </label>
  );
}

export function platformName(id: PlatformId): string {
  return PLATFORM_BY_ID[id]?.name ?? id;
}

export function CopyButton({ text, label = 'Copy', done = 'Copied' }: { text: string | (() => string); label?: string; done?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="btn btn-small"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(typeof text === 'function' ? text() : text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          /* clipboard blocked; nothing useful to do */
        }
      }}
    >
      <span aria-live="polite">{copied ? done : label}</span>
    </button>
  );
}

/** Copies the current page address, including filters held in the URL. */
export function CopyAddress() {
  useLocation();
  return <CopyButton text={() => window.location.href} label="Copy address" done="Address copied" />;
}

export function Ext({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
      {children}
      <span className="sr-only"> (opens in a new tab)</span>
      <span aria-hidden="true" className="ext-icon">
        ↗
      </span>
    </a>
  );
}

export function Tabs<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode }[]; label: string }) {
  return (
    <div className="tabs" role="tablist" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" role="tab" aria-selected={value === o.value} className={value === o.value ? 'tab active' : 'tab'} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Pager({ page, pages, onPage }: { page: number; pages: number; onPage: (p: number) => void }) {
  if (pages <= 1) return null;
  return (
    <nav className="pager" aria-label="Pages">
      <button type="button" className="btn btn-small" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        Previous
      </button>
      <span>
        Page {page} of {pages}
      </span>
      <button type="button" className="btn btn-small" disabled={page >= pages} onClick={() => onPage(page + 1)}>
        Next
      </button>
    </nav>
  );
}

/** Minimal SVG line chart for daily totals. Points are drawn only where a snapshot exists. */
export function Sparkline({ points, label }: { points: { date: string; value: number }[]; label: string }) {
  if (points.length < 2) return <div className="spark spark-empty" aria-hidden="true" />;
  const w = 240;
  const h = 56;
  const xs = points.map((p) => new Date(p.date).getTime());
  const ys = points.map((p) => p.value);
  const [x0, x1] = [Math.min(...xs), Math.max(...xs)];
  const [y0, y1] = [Math.min(...ys), Math.max(...ys)];
  const px = (x: number) => (x1 === x0 ? w / 2 : ((x - x0) / (x1 - x0)) * (w - 8) + 4);
  const py = (y: number) => (y1 === y0 ? h / 2 : h - 6 - ((y - y0) / (y1 - y0)) * (h - 12));
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${px(xs[i]).toFixed(1)},${py(p.value).toFixed(1)}`).join(' ');
  return (
    <svg className="spark" viewBox={`0 0 ${w} ${h}`} role="img" aria-label={label} preserveAspectRatio="none">
      <path d={d} fill="none" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" />
      {points.map((p, i) => (
        <circle key={p.date} cx={px(xs[i])} cy={py(p.value)} r="2.5" fill="currentColor">
          <title>{`${p.date}: ${p.value.toLocaleString('en-GB')}`}</title>
        </circle>
      ))}
    </svg>
  );
}

/** Daily EPSS history as a bar strip. */
export function EpssHistoryChart({ series }: { series: { date: string; epss: number; pct: number }[] }) {
  if (!series.length) return <Empty>No EPSS history in this snapshot.</Empty>;
  const max = Math.max(...series.map((s) => s.epss), 0.0001);
  return (
    <div className="epss-history" role="img" aria-label={`EPSS over ${series.length} days, from ${fmtEpss(series[0].epss)} to ${fmtEpss(series[series.length - 1].epss)}`}>
      {series.map((s) => (
        <span key={s.date} className="bar" style={{ height: `${Math.max(3, (s.epss / max) * 100)}%` }} title={`${s.date}: ${fmtEpss(s.epss)}, ${fmtPercentile(s.pct)}`} />
      ))}
    </div>
  );
}
