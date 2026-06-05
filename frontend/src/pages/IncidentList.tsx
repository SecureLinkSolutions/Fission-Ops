import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useFetch } from '../hooks/useFetch';
import { apiClient } from '../api/client';
import { Incident } from '../types';
import IncidentStatusBadge from '../components/IncidentStatusBadge';
import { useAuth } from '../context/AuthContext';

const SEVERITY_COLORS: Record<string, string> = { low: '#3fb950', medium: '#d29922', high: '#f85149', critical: '#ff7b72' };
const STATUS_COLORS: Record<string, string> = { open: '#58a6ff', contained: '#d29922', closed: '#8b949e' };
const STATUS_DOT_COLORS: Record<string, string> = { open: '#3fb950', contained: '#d29922', closed: '#8b949e' };

function relativeTime(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(ts).toLocaleDateString();
}

function IncidentCard({ inc, onClick }: { inc: Incident & { task_total?: number; task_complete?: number }; onClick: () => void }) {
  const [hover, setHover] = useState(false);
  const sevColor = SEVERITY_COLORS[inc.severity] ?? '#8b949e';
  const statColor = STATUS_COLORS[inc.status] ?? '#8b949e';
  const dotColor = STATUS_DOT_COLORS[inc.status] ?? '#8b949e';
  const taskTotal = inc.task_total ?? 0;
  const taskComplete = inc.task_complete ?? 0;
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex',
        alignItems: 'stretch',
        background: hover ? '#1c2128' : '#161b22',
        border: `1px solid ${hover ? '#444c56' : '#30363d'}`,
        borderRadius: '8px',
        marginBottom: '8px',
        cursor: 'pointer',
        overflow: 'hidden',
        boxShadow: hover ? '0 2px 8px rgba(0,0,0,0.4)' : '0 1px 3px rgba(0,0,0,0.3)',
        transition: 'none',
      }}
    >
      {/* Severity color bar */}
      <div style={{ width: '4px', background: sevColor, flexShrink: 0 }} />
      <div style={{ flex: 1, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
        {/* Title */}
        <div style={{ flex: 1, minWidth: '200px' }}>
          <div style={{ color: '#e6edf3', fontWeight: 600, fontSize: '14px', marginBottom: '4px' }}>{inc.title}</div>
          {inc.description && <div style={{ color: '#8b949e', fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '400px' }}>{inc.description}</div>}
        </div>
        {/* Severity pill */}
        <span style={{ background: `${sevColor}22`, color: sevColor, border: `1px solid ${sevColor}44`, borderRadius: '12px', padding: '3px 10px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
          {inc.severity}
        </span>
        {/* Status pill with dot */}
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: `${statColor}18`, color: statColor, border: `1px solid ${statColor}44`, borderRadius: '12px', padding: '3px 10px', fontSize: '11px', fontWeight: 600, whiteSpace: 'nowrap' }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: dotColor, display: 'inline-block' }} />
          {inc.status}
        </span>
        {/* Op status */}
        {inc.incident_status && <IncidentStatusBadge status={inc.incident_status} />}
        {/* Entities */}
        <span style={{ color: '#8b949e', fontSize: '12px', whiteSpace: 'nowrap' }}>
          <span style={{ color: '#e6edf3', fontWeight: 600 }}>{inc.entity_count ?? 0}</span> entities
        </span>
        {/* Task progress */}
        {taskTotal > 0 && (
          <span style={{ color: '#8b949e', fontSize: '12px', whiteSpace: 'nowrap' }}>
            <span style={{ color: taskComplete === taskTotal ? '#3fb950' : '#e6edf3', fontWeight: 600 }}>{taskComplete}/{taskTotal}</span> tasks
          </span>
        )}
        {/* Time ago */}
        <span style={{ color: '#8b949e', fontSize: '12px', whiteSpace: 'nowrap' }}>{relativeTime(inc.created_at)}</span>
      </div>
    </div>
  );
}

const ROLE_RANK: Record<string, number> = { analyst: 1, senior_analyst: 2, incident_commander: 3, super_admin: 99 };

export default function IncidentList() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [statusFilter, setStatusFilter] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  const canCreate = ROLE_RANK[user?.role ?? ''] >= ROLE_RANK['incident_commander'];

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
        {canCreate && <Link to="/incidents/new" style={{ background: '#238636', border: 'none', borderRadius: '6px', padding: '10px 20px', color: '#fff', fontSize: '14px', fontWeight: 600, cursor: 'pointer', textDecoration: 'none' }}>+ New Incident</Link>}
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
        <div>
          {data?.incidents.map((inc) => (
            <IncidentCard key={inc.id} inc={inc} onClick={() => navigate(`/incidents/${inc.id}`)} />
          ))}
        </div>
      )}
    </div>
  );
}
