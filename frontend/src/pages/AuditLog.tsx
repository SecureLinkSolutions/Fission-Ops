import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../api/client';
import { useFetch } from '../hooks/useFetch';
import { AuditLog as AuditLogEntry } from '../types';
import { useAuth } from '../context/AuthContext';

const ACTION_COLORS: Record<string, string> = {
  CREATE: '#3fb950',
  UPDATE: '#58a6ff',
  DELETE: '#f85149',
};

function actionBadge(action: string) {
  const color = ACTION_COLORS[action] ?? '#8b949e';
  return (
    <span style={{ background: `${color}22`, color, border: `1px solid ${color}44`, borderRadius: '12px', padding: '2px 10px', fontSize: '11px', fontWeight: 600 }}>
      {action}
    </span>
  );
}

function formatTs(ts: string) {
  return new Date(ts).toLocaleString();
}

export default function AuditLog() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [actionFilter, setActionFilter] = useState('');
  const [resourceTypeFilter, setResourceTypeFilter] = useState('');
  const [fromFilter, setFromFilter] = useState('');
  const [toFilter, setToFilter] = useState('');
  const [userFilter, setUserFilter] = useState('');
  const [page, setPage] = useState(1);
  const limit = 50;

  if (user?.role !== 'incident_commander') {
    navigate('/incidents');
    return null;
  }

  const params = new URLSearchParams();
  if (actionFilter) params.set('action', actionFilter);
  if (resourceTypeFilter) params.set('resource_type', resourceTypeFilter);
  if (fromFilter) params.set('from', fromFilter);
  if (toFilter) params.set('to', toFilter);
  if (userFilter) params.set('user_id', userFilter);
  params.set('page', String(page));
  params.set('limit', String(limit));

  const { data, loading } = useFetch<{ logs: AuditLogEntry[]; total: number }>(
    () => apiClient.get(`/audit?${params.toString()}`).then((r) => r.data),
    [actionFilter, resourceTypeFilter, fromFilter, toFilter, userFilter, page],
  );

  const logs = data?.logs ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / limit);

  const inputStyle: React.CSSProperties = {
    background: '#0d1117', border: '1px solid #30363d', borderRadius: '6px',
    padding: '6px 10px', color: '#e6edf3', fontSize: '13px',
  };
  const selectStyle: React.CSSProperties = { ...inputStyle };

  return (
    <div style={{ padding: '32px', maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{ fontSize: '24px', fontWeight: 700, color: '#e6edf3', marginBottom: '24px' }}>Audit Log</div>

      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '24px', background: '#161b22', border: '1px solid #30363d', borderRadius: '8px', padding: '16px' }}>
        <select style={selectStyle} value={actionFilter} onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}>
          <option value="">All Actions</option>
          <option value="CREATE">CREATE</option>
          <option value="UPDATE">UPDATE</option>
          <option value="DELETE">DELETE</option>
        </select>
        <select style={selectStyle} value={resourceTypeFilter} onChange={(e) => { setResourceTypeFilter(e.target.value); setPage(1); }}>
          <option value="">All Resource Types</option>
          <option value="incident">incident</option>
          <option value="entity">entity</option>
          <option value="kill_chain_mapping">kill_chain_mapping</option>
          <option value="relationship">relationship</option>
        </select>
        <input type="date" style={inputStyle} value={fromFilter} onChange={(e) => { setFromFilter(e.target.value); setPage(1); }} placeholder="From date" />
        <input type="date" style={inputStyle} value={toFilter} onChange={(e) => { setToFilter(e.target.value); setPage(1); }} placeholder="To date" />
        <input style={inputStyle} value={userFilter} onChange={(e) => { setUserFilter(e.target.value); setPage(1); }} placeholder="User ID..." />
      </div>

      {loading ? (
        <div style={{ color: '#8b949e', padding: '32px' }}>Loading audit logs…</div>
      ) : (
        <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: '8px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #30363d' }}>
                {['Timestamp', 'User', 'Action', 'Resource Type', 'Resource ID', 'Details'].map((h) => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', color: '#8b949e', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} style={{ borderBottom: '1px solid #21262d' }}>
                  <td style={{ padding: '10px 16px', color: '#8b949e', fontSize: '12px', whiteSpace: 'nowrap' }}>{formatTs(log.created_at)}</td>
                  <td style={{ padding: '10px 16px', color: '#e6edf3', fontSize: '13px' }}>{log.user_email ?? '-'}</td>
                  <td style={{ padding: '10px 16px' }}>{actionBadge(log.action)}</td>
                  <td style={{ padding: '10px 16px', color: '#8b949e', fontSize: '12px' }}>{log.resource_type}</td>
                  <td style={{ padding: '10px 16px', color: '#8b949e', fontSize: '12px', fontFamily: 'monospace' }}>{log.resource_id ?? '-'}</td>
                  <td style={{ padding: '10px 16px', color: '#8b949e', fontSize: '11px', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {log.new_values ? JSON.stringify(log.new_values).slice(0, 80) : '-'}
                  </td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: '32px', textAlign: 'center', color: '#8b949e' }}>No audit logs found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div style={{ display: 'flex', gap: '8px', marginTop: '16px', justifyContent: 'center', alignItems: 'center' }}>
          <button disabled={page <= 1} onClick={() => setPage(page - 1)} style={{ background: '#21262d', border: '1px solid #30363d', color: '#e6edf3', padding: '6px 14px', borderRadius: '6px', cursor: page > 1 ? 'pointer' : 'not-allowed', opacity: page <= 1 ? 0.5 : 1 }}>Prev</button>
          <span style={{ color: '#8b949e', fontSize: '13px' }}>Page {page} of {totalPages} ({total} total)</span>
          <button disabled={page >= totalPages} onClick={() => setPage(page + 1)} style={{ background: '#21262d', border: '1px solid #30363d', color: '#e6edf3', padding: '6px 14px', borderRadius: '6px', cursor: page < totalPages ? 'pointer' : 'not-allowed', opacity: page >= totalPages ? 0.5 : 1 }}>Next</button>
        </div>
      )}
    </div>
  );
}
