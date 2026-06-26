import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../api/client';
import { SEVERITY_COLORS, ENTITY_TYPE_ICONS } from '../utils/constants';
import logoUrl from '../assets/logo.svg';

interface SearchIncident {
  id: string;
  title: string;
  severity: string;
  status: string;
  created_at: string;
}

interface SearchEntity {
  id: string;
  incident_id: string;
  type: string;
  value: string;
  ioc_status: string | null;
  incident_title: string;
}

interface SearchResults {
  incidents: SearchIncident[];
  entities: SearchEntity[];
}


interface ConnectionDotProps {
  state: 'connected' | 'reconnecting' | 'disconnected';
}

function ConnectionDot({ state }: ConnectionDotProps) {
  const color = state === 'connected' ? '#3fb950' : state === 'reconnecting' ? '#d29922' : '#8b949e';
  const title = state === 'connected' ? 'Connected' : state === 'reconnecting' ? 'Reconnecting…' : 'Disconnected';
  return (
    <span title={title} style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: color }} />
  );
}

interface NavLinkProps {
  to: string;
  icon: string;
  label: string;
  active: boolean;
}

function NavLink({ to, icon, label, active }: NavLinkProps) {
  const [hover, setHover] = useState(false);
  return (
    <Link
      to={to}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 12px',
        textDecoration: 'none',
        borderRadius: '6px',
        marginBottom: '2px',
        color: active ? '#e6edf3' : hover ? '#c9d1d9' : '#8b949e',
        background: active ? '#58a6ff11' : hover ? '#21262d' : 'transparent',
        borderLeft: active ? '3px solid #58a6ff' : '3px solid transparent',
        fontWeight: active ? 600 : 400,
        fontSize: '13px',
      }}
    >
      <span style={{ fontSize: '14px', lineHeight: 1 }}>{icon}</span>
      {label}
    </Link>
  );
}

interface NavBarProps {
  connectionState?: 'connected' | 'reconnecting' | 'disconnected';
}

export default function NavBar({ connectionState }: NavBarProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const onIncidentPage = /^\/incidents\/[^/]+(\/|$)/.test(location.pathname);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResults | null>(null);
  const [open, setOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (query.length < 2) {
      setResults(null);
      setOpen(false);
      return;
    }
    const timer = setTimeout(() => {
      apiClient.get<SearchResults>('/search?q=' + encodeURIComponent(query))
        .then(r => {
          setResults(r.data);
          setOpen(true);
        })
        .catch(() => {/* ignore */});
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function closeSearch() {
    setOpen(false);
    setQuery('');
  }

  const isAdmin = user?.role === 'incident_commander' || user?.role === 'platform_admin';

  return (
    <nav style={{
      width: '220px',
      minHeight: '100vh',
      background: '#161b22',
      borderRight: '1px solid #30363d',
      display: 'flex',
      flexDirection: 'column',
      position: 'fixed',
      top: 0,
      left: 0,
      zIndex: 100,
    }}>
      {/* Brand */}
      <div style={{ padding: '14px 16px 12px', borderBottom: '1px solid #30363d', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <img src={logoUrl} alt="FissionOps" style={{ width: '28px', height: '28px', flexShrink: 0 }} />
        <div>
          <Link to="/incidents" style={{ textDecoration: 'none', display: 'block', lineHeight: 1.1 }}>
            <span style={{ color: '#e6edf3', fontWeight: 700, fontSize: '14px', letterSpacing: '0.01em' }}>Fission</span><span style={{ color: '#f97316', fontWeight: 700, fontSize: '14px' }}>Ops</span>
          </Link>
          <div style={{ color: '#484f58', fontSize: '9px', letterSpacing: '0.04em', marginTop: '1px' }}>by NullVector Security</div>
        </div>
      </div>

      {/* Global search */}
      <div ref={searchRef} style={{ padding: '8px 10px', borderBottom: '1px solid #30363d', position: 'relative' }}>
        <input
          type="text"
          placeholder="Search…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => { if (results) setOpen(true); }}
          style={{
            width: '100%',
            boxSizing: 'border-box',
            background: '#0d1117',
            border: '1px solid #30363d',
            borderRadius: '6px',
            padding: '6px 10px',
            color: '#e6edf3',
            fontSize: '12px',
            outline: 'none',
          }}
        />
        {open && results && (
          <div style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: '100%',
            zIndex: 200,
            background: '#161b22',
            border: '1px solid #30363d',
            borderRadius: '0 0 8px 8px',
            maxHeight: '400px',
            overflowY: 'auto',
          }}>
            {results.incidents.length > 0 && (
              <div>
                <div style={{ padding: '6px 12px', fontSize: '10px', color: '#484f58', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Incidents</div>
                {results.incidents.map(inc => (
                  <Link
                    key={inc.id}
                    to={`/incidents/${inc.id}`}
                    onClick={closeSearch}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', textDecoration: 'none', color: '#c9d1d9', fontSize: '12px' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#21262d'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                  >
                    <span style={{ background: SEVERITY_COLORS[inc.severity] ?? '#8b949e', borderRadius: '4px', padding: '1px 5px', fontSize: '10px', color: '#fff', flexShrink: 0 }}>{inc.severity}</span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{inc.title}</span>
                  </Link>
                ))}
              </div>
            )}
            {results.entities.length > 0 && (
              <div>
                <div style={{ padding: '6px 12px', fontSize: '10px', color: '#484f58', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Entities</div>
                {results.entities.map(ent => (
                  <Link
                    key={ent.id}
                    to={`/incidents/${ent.incident_id}/entities/${ent.id}`}
                    onClick={closeSearch}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', textDecoration: 'none', color: '#c9d1d9', fontSize: '12px' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#21262d'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                  >
                    <span style={{ flexShrink: 0 }}>{ENTITY_TYPE_ICONS[ent.type] ?? '•'}</span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{ent.value}</span>
                    <span style={{ color: '#484f58', fontSize: '11px', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '80px', whiteSpace: 'nowrap' }}>{ent.incident_title}</span>
                  </Link>
                ))}
              </div>
            )}
            {results.incidents.length === 0 && results.entities.length === 0 && (
              <div style={{ padding: '10px 12px', fontSize: '12px', color: '#484f58' }}>No results found</div>
            )}
          </div>
        )}
      </div>

      {/* Connection dot for incident pages */}
      {onIncidentPage && connectionState && (
        <div style={{ padding: '6px 16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <ConnectionDot state={connectionState} />
          <span style={{ fontSize: '11px', color: '#8b949e' }}>
            {connectionState === 'connected' ? 'Live' : connectionState === 'reconnecting' ? 'Reconnecting…' : 'Offline'}
          </span>
        </div>
      )}

      {/* Nav links */}
      <div style={{ padding: '12px 8px', flex: 1 }}>
        <NavLink to="/incidents" icon="⚡" label="Incidents" active={location.pathname.startsWith('/incidents')} />
        <NavLink to="/tasks/mine" icon="✅" label="My Tasks" active={location.pathname.startsWith('/tasks')} />
        <NavLink to="/tabletop" icon="🎯" label="Tabletop" active={location.pathname.startsWith('/tabletop')} />
        {isAdmin && (
          <>
            <div style={{ padding: '12px 12px 4px', color: '#484f58', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: '8px' }}>Admin</div>
            <NavLink to="/admin/audit" icon="📋" label="Audit Log" active={location.pathname === '/admin/audit'} />
            <NavLink to="/admin/users" icon="👥" label="Users" active={location.pathname === '/admin/users'} />
            <NavLink to="/settings/org" icon="🔐" label="Org Settings" active={location.pathname === '/settings/org'} />
            {user?.role === 'platform_admin' && (
              <NavLink to="/superadmin" icon="🛡" label="Platform Admin" active={location.pathname === '/superadmin'} />
            )}
          </>
        )}
      </div>

      {/* Footer - sign out only */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid #30363d' }}>
        <button type="button"
          onClick={() => { logout(); navigate('/login'); }}
          style={{
            background: 'transparent',
            border: '1px solid #30363d',
            color: '#6e7681',
            padding: '6px 12px',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '12px',
            width: '100%',
            textAlign: 'left',
          }}
          onMouseOver={e => { e.currentTarget.style.borderColor = '#f85149'; e.currentTarget.style.color = '#f85149'; }}
          onMouseOut={e => { e.currentTarget.style.borderColor = '#30363d'; e.currentTarget.style.color = '#6e7681'; }}
        >
          Sign out
        </button>
      </div>
    </nav>
  );
}
