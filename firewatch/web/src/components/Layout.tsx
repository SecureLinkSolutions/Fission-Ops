import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useKev, useSnapshot } from '../lib/data.ts';
import { fmtDateTime, isStale } from '../lib/format.ts';
import { useTheme, type Theme } from '../lib/prefs.ts';

const NAV: { group: string; links: { to: string; label: string }[] }[] = [
  {
    group: 'Vulnerabilities',
    links: [
      { to: '/', label: 'Overview' },
      { to: '/catalog', label: 'Catalog' },
      { to: '/watchlist', label: 'Watchlist' },
    ],
  },
  {
    group: 'Intelligence',
    links: [
      { to: '/news', label: 'Security News' },
      { to: '/intel', label: 'Threat Intel' },
    ],
  },
  {
    group: 'Detections',
    links: [
      { to: '/coverage', label: 'Coverage' },
      { to: '/library', label: 'Library' },
      { to: '/updates', label: 'Content Updates' },
    ],
  },
  { group: 'Data', links: [{ to: '/health', label: 'Data Health' }] },
];

function SearchBox() {
  const { data: kev } = useKev();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key === '/' && !/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) && !t.isContentEditable) {
        e.preventDefault();
        input.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!kev || term.length < 2) return [];
    const words = term.split(/\s+/);
    return kev.filter((e) => {
      const hay = `${e.cve} ${e.vendor} ${e.product} ${e.name}`.toLowerCase();
      return words.every((w) => hay.includes(w));
    }).slice(0, 8);
  }, [kev, q]);

  const go = (to: string) => {
    setOpen(false);
    setQ('');
    navigate(to);
  };

  return (
    <form
      className="search"
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        const exact = /^cve-\d{4}-\d{4,}$/i.test(q.trim()) ? q.trim().toUpperCase() : null;
        if (results[active] && open) go(`/cve/${results[active].cve}`);
        else if (exact) go(`/cve/${exact}`);
        else if (q.trim()) go(`/catalog?q=${encodeURIComponent(q.trim())}`);
      }}
    >
      <label htmlFor="kev-search" className="search-label">
        Search the KEV catalog
      </label>
      <div className="search-field">
        <input
          id="kev-search"
          ref={input}
          type="search"
          placeholder="CVE ID, vendor, product, or name"
          autoComplete="off"
          value={q}
          role="combobox"
          aria-expanded={open && results.length > 0}
          aria-controls="kev-search-results"
          aria-activedescendant={open && results[active] ? `sr-${results[active].cve}` : undefined}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
            setActive(0);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setActive((a) => Math.min(a + 1, results.length - 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === 'Escape') {
              setOpen(false);
            }
          }}
        />
        <kbd className="search-kbd" aria-hidden="true">
          /
        </kbd>
      </div>
      {open && results.length > 0 && (
        <ul id="kev-search-results" className="search-results" role="listbox">
          {results.map((r, i) => (
            <li
              key={r.cve}
              id={`sr-${r.cve}`}
              role="option"
              aria-selected={i === active}
              className={i === active ? 'active' : ''}
              onMouseDown={(e) => {
                e.preventDefault();
                go(`/cve/${r.cve}`);
              }}
            >
              <span className="mono">{r.cve}</span>
              <span className="muted">
                {r.vendor} {r.product}
              </span>
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}

function SnapshotStrip() {
  const { data: snap } = useSnapshot();
  if (!snap) return <div className="snapshot-strip muted">Loading snapshot…</div>;
  const stale = snap.sources.filter((s) => s.status === 'failed' || isStale(s));
  return (
    <div className="snapshot-strip">
      <span className={`live-dot${stale.length ? ' warn' : ''}`} aria-hidden="true" />
      <span className="eyebrow">Live snapshot</span>
      <span>
        KEV {snap.kev.version}
        {snap.epss.version && <> · EPSS {snap.epss.version}</>} · {fmtDateTime(snap.generated)}
      </span>
      <Link to="/health" className="strip-link">
        {stale.length ? `${stale.length} source${stale.length > 1 ? 's' : ''} need attention` : 'open Data Health'}
      </Link>
    </div>
  );
}

function ThemeToggle() {
  const [theme, setTheme] = useTheme();
  const next: Record<Theme, Theme> = { system: 'light', light: 'dark', dark: 'system' };
  return (
    <button type="button" className="btn btn-ghost btn-small theme-toggle" onClick={() => setTheme(next[theme])} title="Switch colour theme">
      Theme: {theme}
    </button>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [navOpen, setNavOpen] = useState(false);

  useEffect(() => {
    setNavOpen(false);
    // Move focus to the new page's heading so screen readers announce navigation.
    const h = document.getElementById('page-title');
    if (h && location.key !== 'default') h.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }, [location.pathname, location.key]);

  return (
    <div className="shell">
      <a className="skip-link" href="#workspace" onClick={(e) => { e.preventDefault(); document.getElementById('page-title')?.focus(); }}>
        Skip to workspace
      </a>
      <header className="topbar">
        <div className="brand">
          <button type="button" className="btn btn-ghost nav-toggle" aria-expanded={navOpen} aria-controls="sidenav" onClick={() => setNavOpen((o) => !o)}>
            Menu
          </button>
          <Link to="/" className="brand-link">
            <span className="brand-mark" aria-hidden="true">▲</span>
            <span>
              <span className="brand-name">Project Firewatch</span>
              <span className="brand-tag">Exploited vulnerability watch</span>
            </span>
          </Link>
        </div>
        <SearchBox />
        <ThemeToggle />
      </header>
      <SnapshotStrip />
      <div className="body">
        <nav id="sidenav" className={`sidenav${navOpen ? ' open' : ''}`} aria-label="Main">
          {NAV.map((g) => (
            <div key={g.group} className="nav-group">
              <p className="nav-group-title">{g.group}</p>
              <ul>
                {g.links.map((l) => (
                  <li key={l.to}>
                    <NavLink to={l.to} end={l.to === '/'}>
                      {l.label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <NavLink to="/feedback" className="nav-feedback">
            Send feedback
          </NavLink>
        </nav>
        <main id="workspace" className="workspace">
          {children}
          <Footer />
        </main>
      </div>
    </div>
  );
}

function Footer() {
  return (
    <footer className="footer">
      <p>
        Source: CISA Known Exploited Vulnerabilities Catalog. EPSS scores from FIRST.org, generated by Empirical Security. © The MITRE Corporation. This work is
        reproduced and distributed with the permission of The MITRE Corporation. ATT&CK® is a registered trademark of The MITRE Corporation. This product uses
        data from the NVD API but is not endorsed or certified by the NVD. Detection rules and queries come from six vendor and community repositories under
        their own licences, shown verbatim and untested by Firewatch.
      </p>
      <p>
        Not an authoritative advisory: confirm details with the vendor and the primary CVE record. KEV due dates apply to US federal civilian agencies.
        Independent project, not affiliated with or endorsed by CISA, FIRST, Empirical Security, or any detection publisher.
      </p>
      <p className="footer-links">
        <Link to="/licences">Licences and attribution</Link>
        <Link to="/privacy">Privacy</Link>
        <Link to="/feedback">Send feedback</Link>
      </p>
    </footer>
  );
}
