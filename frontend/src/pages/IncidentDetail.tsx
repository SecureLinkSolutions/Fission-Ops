import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useFetch } from '../hooks/useFetch';
import { apiClient } from '../api/client';
import { Incident, Entity, TimelineEntry } from '../types';
import EntityForm from '../components/EntityForm';
import KillChainFlow from '../components/KillChainFlow';
import EntityRelationshipGraph from '../components/EntityRelationshipGraph';
import NetworkBoundaryFlow from '../components/NetworkBoundaryFlow';

const API_BASE = import.meta.env.VITE_API_URL || '/api/v1';

const ENTITY_TYPE_ICONS: Record<string, string> = { hostname: '🖥', ip: '🌐', email: '📧', domain: '🔗', account: '👤' };
const ENTITY_TYPE_COLORS: Record<string, string> = { hostname: '#58a6ff', ip: '#3fb950', email: '#d29922', domain: '#a371f7', account: '#f0883e' };
const SEVERITY_COLORS: Record<string, string> = { low: '#3fb950', medium: '#d29922', high: '#f85149', critical: '#ff7b72' };
const STATUS_COLORS: Record<string, string> = { open: '#58a6ff', contained: '#d29922', closed: '#8b949e' };

const ACTION_TYPE_COLORS: Record<string, string> = {
  ENTITY_CREATED: '#3fb950',
  KILL_CHAIN_MAPPED: '#58a6ff',
  TTP_ASSIGNED: '#a371f7',
  RELATIONSHIP_CREATED: '#d29922',
  BOUNDARY_TRAVERSAL: '#f0883e',
};

function badge(color: string, text: string): React.ReactElement {
  return <span style={{ background: `${color}22`, color, border: `1px solid ${color}44`, borderRadius: '12px', padding: '4px 12px', fontSize: '12px', fontWeight: 600 }}>{text}</span>;
}

function relativeTime(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

type Tab = 'entities' | 'killchain' | 'relationships' | 'network' | 'timeline';

export default function IncidentDetail() {
  const { id } = useParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState<Tab>('entities');
  const [timelineActionType, setTimelineActionType] = useState('');
  const [timelineUserId, setTimelineUserId] = useState('');

  const { data: incident, loading: incLoading, error: incError } = useFetch<Incident>(
    () => apiClient.get(`/incidents/${id}`).then((r) => r.data), [id],
  );
  const { data: entities, refetch: refetchEntities } = useFetch<Entity[]>(
    () => apiClient.get(`/incidents/${id}/entities`).then((r) => r.data), [id],
  );

  const timelineParams = new URLSearchParams();
  if (timelineActionType) timelineParams.set('action_type', timelineActionType);
  if (timelineUserId) timelineParams.set('user_id', timelineUserId);
  const { data: timeline } = useFetch<TimelineEntry[]>(
    () => activeTab === 'timeline'
      ? apiClient.get(`/incidents/${id}/timeline?${timelineParams.toString()}`).then((r) => r.data)
      : Promise.resolve([]),
    [activeTab, id, timelineActionType, timelineUserId],
  );

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '10px 20px', cursor: 'pointer', border: 'none', background: 'transparent',
    color: active ? '#e6edf3' : '#8b949e',
    borderBottom: active ? '2px solid #58a6ff' : '2px solid transparent',
    fontSize: '14px', fontWeight: active ? 600 : 400,
  });

  if (incLoading) return <div style={{ padding: '32px', color: '#8b949e' }}>Loading incident…</div>;
  if (incError || !incident) return <div style={{ padding: '32px', color: '#f85149' }}>Failed to load incident.</div>;

  // Unique users from timeline for filter dropdown
  const timelineUsers = Array.from(
    new Map((timeline ?? []).map((e) => [e.user_id, e.user_email])).entries(),
  );

  return (
    <div style={{ padding: '32px', maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: '28px', fontWeight: 700, color: '#e6edf3', marginBottom: '8px' }}>{incident.title}</div>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            {badge(SEVERITY_COLORS[incident.severity], incident.severity)}
            {badge(STATUS_COLORS[incident.status], incident.status)}
            {incident.description && <span style={{ color: '#8b949e', fontSize: '13px' }}>{incident.description}</span>}
          </div>
        </div>
        <button
          onClick={() => window.open(`${API_BASE}/incidents/${id}/report`, '_blank')}
          style={{
            background: '#21262d', border: '1px solid #30363d', borderRadius: '6px',
            padding: '8px 16px', color: '#8b949e', fontSize: '13px', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0,
          }}
        >
          📄 Export Report
        </button>
      </div>

      <div style={{ display: 'flex', borderBottom: '1px solid #30363d', marginBottom: '24px' }}>
        <button style={tabStyle(activeTab === 'entities')} onClick={() => setActiveTab('entities')}>
          Entities ({entities?.length ?? 0})
        </button>
        <button style={tabStyle(activeTab === 'killchain')} onClick={() => setActiveTab('killchain')}>
          Kill Chain
        </button>
        <button style={tabStyle(activeTab === 'relationships')} onClick={() => setActiveTab('relationships')}>
          Relationships
        </button>
        <button style={tabStyle(activeTab === 'network')} onClick={() => setActiveTab('network')}>
          Network Map
        </button>
        <button style={tabStyle(activeTab === 'timeline')} onClick={() => setActiveTab('timeline')}>
          Timeline
        </button>
      </div>

      {activeTab === 'entities' && (
        <>
          <EntityForm incidentId={id!} onCreated={refetchEntities} />
          {(entities ?? []).map((e) => (
            <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', background: '#161b22', border: '1px solid #30363d', borderRadius: '8px', marginBottom: '8px' }}>
              <span style={{ background: `${ENTITY_TYPE_COLORS[e.type]}22`, color: ENTITY_TYPE_COLORS[e.type], border: `1px solid ${ENTITY_TYPE_COLORS[e.type]}44`, borderRadius: '6px', padding: '4px 10px', fontSize: '12px', fontWeight: 600 }}>
                {ENTITY_TYPE_ICONS[e.type]} {e.type}
              </span>
              <span style={{ color: '#e6edf3', fontSize: '14px', flex: 1, fontFamily: 'monospace' }}>{e.value}</span>
              {e.notes && <span style={{ color: '#8b949e', fontSize: '12px' }}>{e.notes}</span>}
              <Link to={`/incidents/${id}/entities/${e.id}`} style={{ color: '#58a6ff', textDecoration: 'none', fontSize: '12px' }}>View →</Link>
            </div>
          ))}
          {entities?.length === 0 && <div style={{ color: '#8b949e', fontSize: '14px' }}>No entities added yet.</div>}
        </>
      )}

      {activeTab === 'killchain' && <KillChainFlow incidentId={id!} />}

      {activeTab === 'relationships' && <EntityRelationshipGraph incidentId={id!} />}

      {activeTab === 'network' && <NetworkBoundaryFlow incidentId={id!} />}

      {activeTab === 'timeline' && (
        <div>
          {/* Filters */}
          <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
            <select
              style={{ background: '#0d1117', border: '1px solid #30363d', borderRadius: '6px', padding: '6px 10px', color: '#e6edf3', fontSize: '13px' }}
              value={timelineActionType}
              onChange={(e) => setTimelineActionType(e.target.value)}
            >
              <option value="">All Action Types</option>
              <option value="ENTITY_CREATED">Entity Created</option>
              <option value="KILL_CHAIN_MAPPED">Kill Chain Mapped</option>
              <option value="TTP_ASSIGNED">TTP Assigned</option>
              <option value="RELATIONSHIP_CREATED">Relationship Created</option>
              <option value="BOUNDARY_TRAVERSAL">Boundary Traversal</option>
            </select>
            <select
              style={{ background: '#0d1117', border: '1px solid #30363d', borderRadius: '6px', padding: '6px 10px', color: '#e6edf3', fontSize: '13px' }}
              value={timelineUserId}
              onChange={(e) => setTimelineUserId(e.target.value)}
            >
              <option value="">All Analysts</option>
              {timelineUsers.map(([uid, email]) => (
                <option key={uid} value={uid}>{email}</option>
              ))}
            </select>
          </div>

          {/* Timeline entries */}
          <div style={{ position: 'relative', paddingLeft: '24px' }}>
            {/* Vertical line */}
            {(timeline ?? []).length > 0 && (
              <div style={{ position: 'absolute', left: '7px', top: '12px', bottom: '12px', width: '2px', background: '#30363d' }} />
            )}

            {(timeline ?? []).map((entry) => {
              const color = ACTION_TYPE_COLORS[entry.action_type] ?? '#8b949e';
              return (
                <div key={entry.resource_id + entry.ts} style={{ display: 'flex', gap: '16px', marginBottom: '20px', position: 'relative' }}>
                  {/* Dot */}
                  <div style={{ position: 'absolute', left: '-20px', top: '4px', width: '14px', height: '14px', borderRadius: '50%', background: color, border: '2px solid #0d1117', flexShrink: 0 }} />

                  <div style={{ flex: 1, background: '#161b22', border: '1px solid #30363d', borderRadius: '8px', padding: '12px 16px' }}>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '6px', flexWrap: 'wrap' }}>
                      <span
                        title={new Date(entry.ts).toLocaleString()}
                        style={{ color: '#8b949e', fontSize: '12px', cursor: 'default' }}
                      >
                        {relativeTime(entry.ts)}
                      </span>
                      <span style={{ background: '#21262d', color: '#8b949e', borderRadius: '10px', padding: '2px 8px', fontSize: '11px' }}>
                        {entry.user_email}
                      </span>
                      <span style={{ background: `${color}22`, color, border: `1px solid ${color}44`, borderRadius: '10px', padding: '2px 8px', fontSize: '11px', fontWeight: 600 }}>
                        {entry.action_type.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <div style={{ color: '#e6edf3', fontSize: '13px' }}>{entry.description}</div>
                  </div>
                </div>
              );
            })}

            {(timeline ?? []).length === 0 && (
              <div style={{ color: '#8b949e', fontSize: '14px' }}>No timeline entries found.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
