import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useFetch } from '../hooks/useFetch';
import { apiClient } from '../api/client';
import { Incident } from '../types';
import IncidentStatusBadge from '../components/IncidentStatusBadge';

const SEVERITY_COLORS: Record<string, string> = { low: '#3fb950', medium: '#d29922', high: '#f85149', critical: '#ff7b72' };
const STATUS_COLORS: Record<string, string> = { open: '#58a6ff', contained: '#d29922', closed: '#8b949e' };

function badge(color: string, text: string) {
  return <span style={{ background: `${color}22`, color, border: `1px solid ${color}44`, borderRadius: '12px', padding: '3px 10px', fontSize: '11px', fontWeight: 600 }}>{text}</span>;
}

export default function IncidentList() {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');

  const { data, loading, error } = useFetch<{ incidents: Incident[]; total: number }>(
    () => {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      if (severityFilter) params.set('severity', severityFilter);
      return apiClient.get(`/incidents?${params}`).then((r) => r.data);
    },
    [statusFilter, severityFilter],
  );

  const filterBtn = (active: boolean): React.CSSProperties => ({
    background: active ? '#21262d' : 'transparent', border: '1px solid #30363d', borderRadius: '6px',
    padding: '6px 14px', color: active ? '#e6edf3' : '#8b949e', cursor: 'pointer', fontSize: '13px',
  });

  return (
    <div style={{ padding: '32px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#e6edf3' }}>Incidents</div>
          {data && <div style={{ color: '#8b949e', fontSize: '13px', marginTop: '4px' }}>{data.total} total</div>}
        </div>
        <Link to="/incidents/new" style={{ background: '#238636', border: 'none', borderRadius: '6px', padding: '10px 20px', color: '#fff', fontSize: '14px', fontWeight: 600, cursor: 'pointer', textDecoration: 'none' }}>+ New Incident</Link>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {['', 'open', 'contained', 'closed'].map((v) => (
          <button key={v} onClick={() => setStatusFilter(v)} style={filterBtn(statusFilter === v)}>{v || 'All status'}</button>
        ))}
        <span style={{ width: '1px', background: '#30363d', margin: '0 4px' }} />
        {['', 'low', 'medium', 'high', 'critical'].map((v) => (
          <button key={v} onClick={() => setSeverityFilter(v)} style={filterBtn(severityFilter === v)}>{v || 'All severity'}</button>
        ))}
      </div>

      {error && <div style={{ background: '#3d1a1a', border: '1px solid #f85149', color: '#f85149', borderRadius: '6px', padding: '16px', marginBottom: '16px' }}>{error}</div>}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: '#8b949e' }}>Loading incidents…</div>
      ) : data?.incidents.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px', color: '#8b949e' }}>No incidents found. <Link to="/incidents/new" style={{ color: '#58a6ff' }}>Create one</Link>.</div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Title', 'Severity', 'Status', 'Op. Status', 'Entities', 'Created'].map((h) => (
                <th key={h} style={{ textAlign: 'left', padding: '12px 16px', borderBottom: '1px solid #30363d', color: '#8b949e', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data?.incidents.map((inc) => (
              <tr key={inc.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/incidents/${inc.id}`)}>
                <td style={{ padding: '14px 16px', borderBottom: '1px solid #21262d', color: '#58a6ff', fontWeight: 600 }}>{inc.title}</td>
                <td style={{ padding: '14px 16px', borderBottom: '1px solid #21262d' }}>{badge(SEVERITY_COLORS[inc.severity], inc.severity)}</td>
                <td style={{ padding: '14px 16px', borderBottom: '1px solid #21262d' }}>{badge(STATUS_COLORS[inc.status], inc.status)}</td>
                <td style={{ padding: '14px 16px', borderBottom: '1px solid #21262d' }}>
                  {inc.incident_status && <IncidentStatusBadge status={inc.incident_status} />}
                </td>
                <td style={{ padding: '14px 16px', borderBottom: '1px solid #21262d', color: '#e6edf3' }}>{inc.entity_count ?? 0}</td>
                <td style={{ padding: '14px 16px', borderBottom: '1px solid #21262d', color: '#8b949e', fontSize: '13px' }}>{new Date(inc.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
