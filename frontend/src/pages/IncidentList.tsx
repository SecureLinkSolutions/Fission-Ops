import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useFetch } from '../hooks/useFetch';
import { apiClient } from '../api/client';
import { Incident } from '../types';
import IncidentStatusBadge from '../components/IncidentStatusBadge';
import { useAuth } from '../context/AuthContext';
import { relativeTime } from '../utils/time';
import { ROLE_RANK, SEVERITY_COLORS, INCIDENT_STATUS_COLORS } from '../utils/constants';

const STATUS_COLORS = INCIDENT_STATUS_COLORS;
const STATUS_DOT_COLORS: Record<string, string> = { open: '#3fb950', contained: '#d29922', closed: '#8b949e' };

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
      <div style={{ width: '3px', background: sevColor, flexShrink: 0 }} />
      <div style={{ flex: 1, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        {/* Title + description */}
        <div style={{ flex: 1, minWidth: '200px', overflow: 'hidden' }}>
          <div style={{ color: '#e6edf3', fontWeight: 600, fontSize: '14px', marginBottom: '2px' }}>{inc.title}</div>
          {inc.description && (
            <div style={{ color: '#6e7681', fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{inc.description}</div>
          )}
          <div style={{ color: '#6e7681', fontSize: '11px', marginTop: '4px' }}>
            {inc.entity_count ?? 0} {inc.entity_count === 1 ? 'entity' : 'entities'}
            {taskTotal > 0 && <> · <span style={{ color: taskComplete === taskTotal ? '#3fb950' : '#6e7681' }}>{taskComplete}/{taskTotal} tasks</span></>}
          </div>
        </div>
        {/* Right-aligned chips */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          {/* Severity */}
          <span style={{ background: `${sevColor}22`, color: sevColor, border: `1px solid ${sevColor}44`, borderRadius: '20px', padding: '3px 10px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
            {inc.severity}
          </span>
          {/* Status */}
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: `${statColor}18`, color: statColor, border: `1px solid ${statColor}44`, borderRadius: '20px', padding: '3px 10px', fontSize: '11px', fontWeight: 600, whiteSpace: 'nowrap' }}>
            <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: dotColor, display: 'inline-block' }} />
            {inc.status}
          </span>
          {/* Op status */}
          {inc.incident_status && <IncidentStatusBadge status={inc.incident_status} />}
          {/* Time */}
          <span style={{ color: '#6e7681', fontSize: '11px', whiteSpace: 'nowrap' }}>{relativeTime(inc.created_at)}</span>
        </div>
      </div>
    </div>
  );
}

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
    background: 'transparent',
    border: active ? '1px solid #58a6ff' : '1px solid #30363d',
    borderRadius: '20px',
    padding: '4px 12px',
    color: active ? '#58a6ff' : '#6e7681',
    cursor: 'pointer',
    fontSize: '12px',
  });

  return (
    <div style={{ padding: '32px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        {data && <div style={{ color: '#6e7681', fontSize: '12px' }}>{data.total} incidents</div>}
        {!data && <div />}
        {canCreate && <Link to="/incidents/new" style={{ background: '#238636', border: '1px solid #2ea043', borderRadius: '6px', padding: '7px 16px', color: '#fff', fontSize: '13px', fontWeight: 500, cursor: 'pointer', textDecoration: 'none' }}>New Incident</Link>}
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {['', 'open', 'contained', 'closed'].map((v) => (
          <button type="button" key={v} onClick={() => setStatusFilter(v)} style={filterBtn(statusFilter === v)}>{v || 'All status'}</button>
        ))}
        <span style={{ width: '1px', background: '#30363d', margin: '0 4px' }} />
        {['', 'low', 'medium', 'high', 'critical'].map((v) => (
          <button type="button" key={v} onClick={() => setSeverityFilter(v)} style={filterBtn(severityFilter === v)}>{v || 'All severity'}</button>
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
