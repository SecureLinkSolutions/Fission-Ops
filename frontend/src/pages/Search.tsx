import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { apiClient } from '../api/client';
import { SEVERITY_COLORS } from '../utils/constants';

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


const ENTITY_ICONS: Record<string, string> = {
  hostname: '🖥',
  ip: '🌐',
  email: '📧',
  domain: '🔗',
  account: '👤',
  file: '📄',
  url: '🔗',
  hash: '#️⃣',
};

export default function Search() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQ = searchParams.get('q') ?? '';
  const [input, setInput] = useState(initialQ);
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const q = searchParams.get('q') ?? '';
    if (q.length < 2) {
      setResults(null);
      return;
    }
    setLoading(true);
    apiClient.get<SearchResults>('/search?q=' + encodeURIComponent(q))
      .then(r => setResults(r.data))
      .catch(() => setResults(null))
      .finally(() => setLoading(false));
  }, [searchParams]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setInput(val);
    setSearchParams({ q: val }, { replace: true });
  }

  const q = searchParams.get('q') ?? '';

  return (
    <div style={{ padding: '32px', maxWidth: '800px' }}>
      <h1 style={{ color: '#e6edf3', fontSize: '20px', fontWeight: 700, marginBottom: '20px' }}>Global Search</h1>
      <input
        type="text"
        placeholder="Search incidents and entities…"
        value={input}
        onChange={handleChange}
        autoFocus
        style={{
          width: '100%',
          boxSizing: 'border-box',
          background: '#0d1117',
          border: '1px solid #30363d',
          borderRadius: '6px',
          padding: '10px 14px',
          color: '#e6edf3',
          fontSize: '14px',
          outline: 'none',
          marginBottom: '24px',
        }}
      />

      {loading && <div style={{ color: '#8b949e', fontSize: '13px' }}>Searching…</div>}

      {!loading && q.length >= 2 && results && (
        <>
          {results.incidents.length > 0 && (
            <section style={{ marginBottom: '28px' }}>
              <div style={{ color: '#484f58', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>
                Incidents ({results.incidents.length})
              </div>
              <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: '8px', overflow: 'hidden' }}>
                {results.incidents.map((inc, i) => (
                  <Link
                    key={inc.id}
                    to={`/incidents/${inc.id}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '10px 16px',
                      textDecoration: 'none',
                      color: '#c9d1d9',
                      fontSize: '13px',
                      borderTop: i > 0 ? '1px solid #21262d' : 'none',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#21262d'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                  >
                    <span style={{
                      background: SEVERITY_COLORS[inc.severity] ?? '#8b949e',
                      borderRadius: '4px',
                      padding: '2px 6px',
                      fontSize: '11px',
                      color: '#fff',
                      flexShrink: 0,
                      fontWeight: 600,
                    }}>{inc.severity}</span>
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{inc.title}</span>
                    <span style={{ color: '#484f58', fontSize: '11px', flexShrink: 0 }}>{inc.status}</span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {results.entities.length > 0 && (
            <section style={{ marginBottom: '28px' }}>
              <div style={{ color: '#484f58', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>
                Entities ({results.entities.length})
              </div>
              <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: '8px', overflow: 'hidden' }}>
                {results.entities.map((ent, i) => (
                  <Link
                    key={ent.id}
                    to={`/incidents/${ent.incident_id}/entities/${ent.id}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '10px 16px',
                      textDecoration: 'none',
                      color: '#c9d1d9',
                      fontSize: '13px',
                      borderTop: i > 0 ? '1px solid #21262d' : 'none',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#21262d'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                  >
                    <span style={{ fontSize: '14px', flexShrink: 0 }}>{ENTITY_ICONS[ent.type] ?? '•'}</span>
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'monospace' }}>{ent.value}</span>
                    <span style={{ color: '#484f58', fontSize: '11px', flexShrink: 0, maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ent.incident_title}</span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {results.incidents.length === 0 && results.entities.length === 0 && (
            <div style={{ color: '#484f58', fontSize: '13px' }}>No results found for "{q}"</div>
          )}
        </>
      )}

      {!loading && q.length > 0 && q.length < 2 && (
        <div style={{ color: '#484f58', fontSize: '13px' }}>Enter at least 2 characters to search</div>
      )}
    </div>
  );
}
