import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useFetch } from '../hooks/useFetch';
import { apiClient } from '../api/client';
import { Incident, Entity, TimelineEntry } from '../types';
import EntityForm from '../components/EntityForm';
import KillChainFlow from '../components/KillChainFlow';
import EntityRelationshipGraph from '../components/EntityRelationshipGraph';
import NetworkBoundaryFlow from '../components/NetworkBoundaryFlow';
import CommentThread from '../components/CommentThread';
import TaskBoard, { Task } from '../components/TaskBoard';
import PresenceBar from '../components/PresenceBar';
import { useIncidentSocket } from '../hooks/useIncidentSocket';
import { useAuth } from '../context/AuthContext';

const API_BASE = import.meta.env.VITE_API_URL || '/api/v1';

const ENTITY_TYPE_ICONS: Record<string, string> = { hostname: '🖥', ip: '🌐', email: '📧', domain: '🔗', account: '👤' };
const ENTITY_TYPE_COLORS: Record<string, string> = { hostname: '#58a6ff', ip: '#3fb950', email: '#d29922', domain: '#a371f7', account: '#f0883e' };
const SEVERITY_COLORS: Record<string, string> = { low: '#3fb950', medium: '#d29922', high: '#f85149', critical: '#ff7b72' };
const STATUS_COLORS: Record<string, string> = { open: '#58a6ff', contained: '#d29922', closed: '#8b949e' };
const IOC_STATUS_DISPLAY: Record<string, { label: string; color: string }> = {
  confirmed: { label: '💀 CONFIRMED', color: '#f85149' },
  suspected: { label: '⚠ SUSPECTED', color: '#d29922' },
  cleared: { label: '✓ CLEARED', color: '#3fb950' },
};

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

type Tab = 'entities' | 'killchain' | 'relationships' | 'network' | 'timeline' | 'tasks' | 'summary';

export default function IncidentDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('entities');
  const [timelineActionType, setTimelineActionType] = useState('');
  const [timelineUserId, setTimelineUserId] = useState('');

  const { data: incident, loading: incLoading, error: incError } = useFetch<Incident>(
    () => apiClient.get(`/incidents/${id}`).then((r) => r.data), [id],
  );
  const { data: entities, refetch: refetchEntities } = useFetch<Entity[]>(
    () => apiClient.get(`/incidents/${id}/entities`).then((r) => r.data), [id],
  );
  const { data: tasks, refetch: refetchTasks } = useFetch<Task[]>(
    () => apiClient.get(`/incidents/${id}/tasks`).then((r) => r.data), [id],
  );
  const { data: assignments } = useFetch<{ user_id: string; email: string; name: string }[]>(
    () => apiClient.get(`/incidents/${id}/assignments`).then((r) => r.data), [id],
  );

  const { data: taskStats } = useFetch<{ total: number; complete: number }>(
    () => apiClient.get(`/incidents/${id}/tasks`).then((r) => {
      const tl = r.data as Task[];
      return { total: tl.length, complete: tl.filter((t: Task) => t.status === 'complete').length };
    }), [id],
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

  // Real-time collaboration
  const { connected, presenceList } = useIncidentSocket({
    incidentId: id!,
    userId: user?.id ?? '',
    userName: user?.email ?? '',
    userEmail: user?.email ?? '',
    onEntityCreated: () => refetchEntities(),
    onEntityUpdated: () => refetchEntities(),
    onKillchainMapped: () => {},
    onKillchainUpdated: () => {},
  });

  // IOC summary: entities with ioc_status
  const iocEntities = (entities ?? []).filter((e) => (e as Entity & { ioc_status?: string }).ioc_status);

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

  const teamMembers = (assignments ?? []).map((a) => ({ id: a.user_id, email: a.email, name: a.name }));

  return (
    <div style={{ padding: '32px', maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: '28px', fontWeight: 700, color: '#e6edf3', marginBottom: '8px' }}>{incident.title}</div>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
            {badge(SEVERITY_COLORS[incident.severity], incident.severity)}
            {badge(STATUS_COLORS[incident.status], incident.status)}
            {incident.description && <span style={{ color: '#8b949e', fontSize: '13px' }}>{incident.description}</span>}
            {taskStats && taskStats.total > 0 && (
              <span style={{ color: '#8b949e', fontSize: '13px', background: '#21262d', padding: '2px 8px', borderRadius: '4px' }}>
                {taskStats.complete}/{taskStats.total} tasks
              </span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
          <PresenceBar presenceList={presenceList} connected={connected} />
          <button
            onClick={() => window.open(`${API_BASE}/incidents/${id}/report`, '_blank')}
            style={{
              background: '#21262d', border: '1px solid #30363d', borderRadius: '6px',
              padding: '8px 16px', color: '#8b949e', fontSize: '13px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '6px',
            }}
          >
            📄 Export Report
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', borderBottom: '1px solid #30363d', marginBottom: '24px', flexWrap: 'wrap' }}>
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
        <button style={tabStyle(activeTab === 'tasks')} onClick={() => setActiveTab('tasks')}>
          Tasks ({tasks?.length ?? 0})
        </button>
        <Link
          to={`/incidents/${id}/executive-summary`}
          style={{ ...tabStyle(activeTab === 'summary'), textDecoration: 'none', display: 'inline-block' }}
        >
          Executive Summary
        </Link>
      </div>

      {activeTab === 'entities' && (
        <>
          <EntityForm incidentId={id!} onCreated={refetchEntities} />
          {(entities ?? []).map((e) => {
            const ext = e as Entity & { ioc_status?: string; enrichment_status?: string; enrichment_data?: { verdict?: string } };
            const ioc = ext.ioc_status ? IOC_STATUS_DISPLAY[ext.ioc_status] : null;
            return (
              <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', background: '#161b22', border: '1px solid #30363d', borderRadius: '8px', marginBottom: '8px' }}>
                <span style={{ background: `${ENTITY_TYPE_COLORS[e.type]}22`, color: ENTITY_TYPE_COLORS[e.type], border: `1px solid ${ENTITY_TYPE_COLORS[e.type]}44`, borderRadius: '6px', padding: '4px 10px', fontSize: '12px', fontWeight: 600 }}>
                  {ENTITY_TYPE_ICONS[e.type]} {e.type}
                </span>
                <span style={{ color: '#e6edf3', fontSize: '14px', flex: 1, fontFamily: 'monospace' }}>{e.value}</span>
                {ioc && (
                  <span style={{ background: `${ioc.color}22`, color: ioc.color, border: `1px solid ${ioc.color}44`, borderRadius: '4px', padding: '2px 8px', fontSize: '11px', fontWeight: 700 }}>
                    {ioc.label}
                  </span>
                )}
                {e.notes && <span style={{ color: '#8b949e', fontSize: '12px' }}>{e.notes}</span>}
                <Link to={`/incidents/${id}/entities/${e.id}`} style={{ color: '#58a6ff', textDecoration: 'none', fontSize: '12px' }}>View →</Link>
              </div>
            );
          })}
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
            {(timeline ?? []).length > 0 && (
              <div style={{ position: 'absolute', left: '7px', top: '12px', bottom: '12px', width: '2px', background: '#30363d' }} />
            )}

            {(timeline ?? []).map((entry) => {
              const color = ACTION_TYPE_COLORS[entry.action_type] ?? '#8b949e';
              return (
                <div key={entry.resource_id + entry.ts} style={{ display: 'flex', gap: '16px', marginBottom: '20px', position: 'relative' }}>
                  <div style={{ position: 'absolute', left: '-20px', top: '4px', width: '14px', height: '14px', borderRadius: '50%', background: color, border: '2px solid #0d1117', flexShrink: 0 }} />
                  <div style={{ flex: 1, background: '#161b22', border: '1px solid #30363d', borderRadius: '8px', padding: '12px 16px' }}>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '6px', flexWrap: 'wrap' }}>
                      <span title={new Date(entry.ts).toLocaleString()} style={{ color: '#8b949e', fontSize: '12px', cursor: 'default' }}>
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

      {activeTab === 'tasks' && (
        <TaskBoard
          incidentId={id!}
          tasks={tasks ?? []}
          teamMembers={teamMembers}
          onRefresh={refetchTasks}
        />
      )}

      {/* IOC Summary panel — always visible */}
      {iocEntities.length > 0 && (
        <div style={{ marginTop: '32px', background: '#161b22', border: '1px solid #30363d', borderRadius: '8px', padding: '16px' }}>
          <div style={{ fontWeight: 600, fontSize: '14px', color: '#e6edf3', marginBottom: '12px' }}>IOC Summary</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {iocEntities.map((e) => {
              const ext = e as Entity & { ioc_status?: string };
              const ioc = ext.ioc_status ? IOC_STATUS_DISPLAY[ext.ioc_status] : null;
              if (!ioc) return null;
              return (
                <Link
                  key={e.id}
                  to={`/incidents/${id}/entities/${e.id}`}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', background: `${ioc.color}11`, border: `1px solid ${ioc.color}33`, borderRadius: '6px', padding: '6px 12px', textDecoration: 'none' }}
                >
                  <span style={{ color: ioc.color, fontSize: '11px', fontWeight: 700 }}>{ioc.label}</span>
                  <span style={{ color: '#e6edf3', fontSize: '12px', fontFamily: 'monospace' }}>{e.value}</span>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Comments panel — always visible */}
      <div style={{ marginTop: '32px' }}>
        <CommentThread incidentId={id} teamMembers={teamMembers} />
      </div>
    </div>
  );
}
