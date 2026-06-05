import { useState, useEffect } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { useFetch } from '../hooks/useFetch';
import { apiClient } from '../api/client';
import { Incident, Entity, TimelineEntry } from '../types';
import EntityStatusBadge from '../components/EntityStatusBadge';
import IncidentStatusBadge, { INCIDENT_STATUS_CONFIG } from '../components/IncidentStatusBadge';
import EntityForm from '../components/EntityForm';
import KillChainFlow from '../components/KillChainFlow';
import EntityRelationshipGraph from '../components/EntityRelationshipGraph';
import NetworkBoundaryFlow from '../components/NetworkBoundaryFlow';
import CommentThread from '../components/CommentThread';
import TaskBoard, { Task } from '../components/TaskBoard';
import PresenceBar from '../components/PresenceBar';
import SuggestedActions from '../components/SuggestedActions';
import { useIncidentSocket } from '../hooks/useIncidentSocket';
import { useAuth } from '../context/AuthContext';
import { useLicense } from '../context/LicenseContext';
import { relativeTime } from '../utils/time';
import { ROLE_RANK, SEVERITY_COLORS, INCIDENT_STATUS_COLORS, ENTITY_TYPE_ICONS, ENTITY_TYPE_COLORS, ENTITY_TYPE_LABELS } from '../utils/constants';

const API_BASE = import.meta.env.VITE_API_URL || '/api/v1';
const STATUS_COLORS = INCIDENT_STATUS_COLORS;
const IOC_STATUS_DISPLAY: Record<string, { label: string; color: string }> = {
  confirmed: { label: 'CONFIRMED', color: '#f85149' },
  suspected: { label: 'SUSPECTED', color: '#d29922' },
  cleared: { label: 'CLEARED', color: '#3fb950' },
};

const ACTION_TYPE_COLORS: Record<string, string> = {
  ENTITY_CREATED: '#3fb950',
  KILL_CHAIN_MAPPED: '#58a6ff',
  TTP_ASSIGNED: '#a371f7',
  RELATIONSHIP_CREATED: '#d29922',
  BOUNDARY_TRAVERSAL: '#f0883e',
};

function badge(color: string, text: string): React.ReactElement {
  return <span style={{ background: `${color}22`, color, border: `1px solid ${color}44`, borderRadius: '20px', padding: '3px 10px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' as const }}>{text}</span>;
}

type Tab = 'entities' | 'killchain' | 'relationships' | 'network' | 'timeline' | 'tasks' | 'summary';

export default function IncidentDetail() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { isFeatureEnabled } = useLicense();
  const initialTab = (searchParams.get('tab') as Tab) ?? 'entities';
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);
  const [visitedTabs, setVisitedTabs] = useState<Set<Tab>>(new Set<Tab>([initialTab]));
  const [highlightTaskId, setHighlightTaskId] = useState<string | undefined>(searchParams.get('task') ?? undefined);

  useEffect(() => {
    const tab = searchParams.get('tab') as Tab | null;
    const taskParam = searchParams.get('task');
    if (tab) {
      setActiveTab(tab);
      setVisitedTabs((prev) => { const s = new Set(prev); s.add(tab); return s; });
    }
    if (taskParam) {
      setHighlightTaskId(taskParam);
    }
  }, [searchParams]);

  function switchTab(tab: Tab) {
    setActiveTab(tab);
    setVisitedTabs((prev) => { const s = new Set(prev); s.add(tab); return s; });
  }
  const [timelineActionType, setTimelineActionType] = useState('');
  const [incidentStatusChanging, setIncidentStatusChanging] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [timelineUserId, setTimelineUserId] = useState('');

  const { data: incident, loading: incLoading, error: incError, refetch: refetchIncident } = useFetch<Incident>(
    () => apiClient.get(`/incidents/${id}`).then((r) => r.data), [id],
  );
  const { data: entities, refetch: refetchEntities } = useFetch<Entity[]>(
    () => apiClient.get(`/incidents/${id}/entities`).then((r) => r.data), [id],
  );
  const { data: tasks, refetch: refetchTasks } = useFetch<Task[]>(
    () => apiClient.get(`/incidents/${id}/tasks`).then((r) => r.data), [id],
  );
  const { data: assignments } = useFetch<{ user_id: string; user_email: string; user_name: string }[]>(
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
    () => apiClient.get(`/incidents/${id}/timeline?${timelineParams.toString()}`).then((r) => r.data),
    [id, timelineActionType, timelineUserId],
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

  async function handleIncidentStatusChange(newStatus: string) {
    setIncidentStatusChanging(true);
    setShowStatusDropdown(false);
    try {
      await apiClient.patch(`/incidents/${id}/incident-status`, { incident_status: newStatus });
      refetchIncident();
    } catch (_e) {
      // ignore
    } finally {
      setIncidentStatusChanging(false);
    }
  }

  // IOC summary: entities with ioc_status
  const iocEntities = (entities ?? []).filter((e) => (e as Entity & { ioc_status?: string }).ioc_status);

  const [commentPanelOpen, setCommentPanelOpen] = useState(false);
  const [tabHover, setTabHover] = useState<string | null>(null);
  const tabStyle = (active: boolean, key: string): React.CSSProperties => ({
    padding: '10px 16px', cursor: 'pointer', border: 'none',
    background: 'transparent',
    color: active ? '#e6edf3' : tabHover === key ? '#c9d1d9' : '#6e7681',
    borderBottom: active ? '2px solid #58a6ff' : '2px solid transparent',
    fontSize: '13px', fontWeight: active ? 600 : 400,
    borderRadius: 0,
  });

  if (incLoading) return (
    <div style={{ padding: '48px 32px', color: '#6e7681', fontSize: '13px' }}>Loading…</div>
  );
  if (incError || !incident) return (
    <div style={{ padding: '48px 32px', color: '#f85149', fontSize: '13px' }}>Failed to load incident.</div>
  );

  // Unique users from timeline for filter dropdown
  const timelineUsers = Array.from(
    new Map((timeline ?? []).map((e) => [e.user_id, e.user_email])).entries(),
  );

  const teamMembers = (assignments ?? []).map((a) => ({ id: a.user_id, email: a.user_email, name: a.user_name }));
  const canChangeIncidentStatus = ROLE_RANK[user?.role ?? ''] >= ROLE_RANK['senior_analyst'];
  const canChangeStatusField = ROLE_RANK[user?.role ?? ''] >= ROLE_RANK['incident_commander'];

  return (
    <div style={{ padding: '32px', maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ color: '#8b949e', fontSize: '12px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Link to="/incidents" style={{ color: '#58a6ff', textDecoration: 'none', fontSize: '12px' }}>Incidents</Link>
            <span style={{ color: '#30363d' }}>/</span>
            <span style={{ color: '#8b949e' }}>{incident.title}</span>
          </div>
          <div style={{ fontSize: '22px', fontWeight: 700, color: '#e6edf3', marginBottom: '4px' }}>{incident.title}</div>
          {incident.description && (
            <div style={{ color: '#6e7681', fontSize: '13px', marginBottom: '8px' }}>{incident.description}</div>
          )}
          <div style={{ color: '#6e7681', fontSize: '12px', marginBottom: '10px' }}>
            Created {relativeTime(incident.created_at)} · Updated {relativeTime(incident.updated_at)}
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            {badge(SEVERITY_COLORS[incident.severity], incident.severity)}
            {badge(STATUS_COLORS[incident.status], incident.status)}
            {!showStatusDropdown && (
              canChangeIncidentStatus ? (
                <button
                  onClick={() => setShowStatusDropdown(true)}
                  disabled={incidentStatusChanging}
                  style={{ background: 'transparent', border: '1px solid #30363d', borderRadius: '8px', padding: '2px 6px 2px 2px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                  title="Change operational status"
                >
                  <IncidentStatusBadge status={incident.incident_status ?? 'active'} />
                  <span style={{ color: '#484f58', fontSize: '10px' }}>▾</span>
                </button>
              ) : (
                <IncidentStatusBadge status={incident.incident_status ?? 'active'} />
              )
            )}
            {showStatusDropdown && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                {Object.entries(INCIDENT_STATUS_CONFIG).map(([s, cfg]) => (
                  <button
                    key={s}
                    onClick={() => handleIncidentStatusChange(s)}
                    style={{
                      background: `${cfg.color}22`, color: cfg.color, border: `1px solid ${cfg.color}44`,
                      borderRadius: '12px', padding: '3px 10px', fontSize: '11px', fontWeight: 600,
                      cursor: 'pointer',
                      outline: incident.incident_status === s ? `2px solid ${cfg.color}` : 'none',
                    }}
                  >
                    {cfg.label}
                  </button>
                ))}
                <button onClick={() => setShowStatusDropdown(false)} style={{ background: 'transparent', border: '1px solid #30363d', borderRadius: '6px', padding: '2px 8px', color: '#8b949e', fontSize: '11px', cursor: 'pointer' }}>✕</button>
              </div>
            )}
            {canChangeStatusField && (
              <button
                onClick={async () => {
                  const newStatus = incident.status === 'closed' ? 'open' : 'closed';
                  await apiClient.patch(`/incidents/${id}`, { status: newStatus });
                  refetchIncident();
                }}
                style={{
                  background: incident.status === 'closed' ? '#3fb95022' : '#f8514922',
                  border: `1px solid ${incident.status === 'closed' ? '#3fb95044' : '#f8514944'}`,
                  borderRadius: '8px', padding: '3px 10px', color: incident.status === 'closed' ? '#3fb950' : '#f85149',
                  fontSize: '11px', fontWeight: 600, cursor: 'pointer'
                }}
                title={incident.status === 'closed' ? 'Reopen incident' : 'Close incident'}
              >
                {incident.status === 'closed' ? '↩ Reopen' : '✕ Close Incident'}
              </button>
            )}
            {taskStats && taskStats.total > 0 && (
              <span style={{ color: '#8b949e', fontSize: '13px', background: '#21262d', padding: '2px 8px', borderRadius: '4px' }}>
                {taskStats.complete}/{taskStats.total} tasks
              </span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
          <PresenceBar presenceList={presenceList} connected={connected} />
          {isFeatureEnabled('pdf_export') ? (
            <button
              onClick={() => window.open(`${API_BASE}/incidents/${id}/report`, '_blank')}
              style={{
                background: '#21262d', border: '1px solid #30363d', borderRadius: '6px',
                padding: '8px 16px', color: '#8b949e', fontSize: '13px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '6px',
              }}
            >
              Export Report
            </button>
          ) : (
            <button
              title="PDF Export requires Professional license"
              onClick={() => {}}
              style={{
                background: '#21262d', border: '1px solid #30363d', borderRadius: '6px',
                padding: '8px 16px', color: '#484f58', fontSize: '13px', cursor: 'not-allowed',
                display: 'flex', alignItems: 'center', gap: '6px', opacity: 0.5,
              }}
            >
              Export Report
            </button>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', borderBottom: '2px solid #30363d', marginBottom: '24px', flexWrap: 'wrap' }}>
        {([
          ['entities', `Entities (${entities?.length ?? 0})`],
          ['killchain', 'Kill Chain'],
          ['relationships', 'Relationships'],
          ['network', 'Network Map'],
          ['timeline', 'Timeline'],
          ['tasks', `Tasks (${tasks?.length ?? 0})`],
        ] as [Tab, string][]).map(([key, label]) => (
          <button
            key={key}
            style={tabStyle(activeTab === key, key)}
            onClick={() => switchTab(key)}
            onMouseEnter={() => setTabHover(key)}
            onMouseLeave={() => setTabHover(null)}
          >
            {label}
          </button>
        ))}
        <Link
          to={`/incidents/${id}/executive-summary`}
          style={{ ...tabStyle(activeTab === 'summary', 'summary'), textDecoration: 'none', display: 'inline-block' }}
          onMouseEnter={() => setTabHover('summary')}
          onMouseLeave={() => setTabHover(null)}
        >
          Executive Summary
        </Link>
      </div>

      <div style={{ display: activeTab === 'entities' ? undefined : 'none' }}>
        <EntityForm incidentId={id!} onCreated={refetchEntities} />
        {(entities ?? []).map((e) => {
          const ext = e as Entity & { ioc_status?: string; enrichment_status?: string; enrichment_data?: { verdict?: string } };
          const ioc = ext.ioc_status ? IOC_STATUS_DISPLAY[ext.ioc_status] : null;
          const isFlagged = ext.status === 'confirmed_malicious' || ext.ioc_status === 'confirmed';
          const borderColor = isFlagged ? '#f0883e44' : '#30363d';
          return (
            <div key={e.id} style={{ background: '#161b22', border: `1px solid ${borderColor}`, borderRadius: '8px', marginBottom: '8px', overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px' }}>
                <span style={{ background: `${ENTITY_TYPE_COLORS[e.type]}22`, color: ENTITY_TYPE_COLORS[e.type], border: `1px solid ${ENTITY_TYPE_COLORS[e.type]}44`, borderRadius: '4px', padding: '3px 8px', fontSize: '10px', fontWeight: 700, letterSpacing: '0.05em', fontFamily: 'monospace', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <span>{ENTITY_TYPE_ICONS[e.type] ?? '•'}</span>
                  <span>{ENTITY_TYPE_LABELS[e.type] ?? e.type.toUpperCase()}</span>
                </span>
                <span style={{ color: '#e6edf3', fontSize: '14px', flex: 1, fontFamily: 'monospace' }}>{e.value}</span>
                {ioc && (
                  <span style={{ background: `${ioc.color}22`, color: ioc.color, border: `1px solid ${ioc.color}44`, borderRadius: '4px', padding: '2px 8px', fontSize: '11px', fontWeight: 700 }}>
                    {ioc.label}
                  </span>
                )}
                <EntityStatusBadge status={e.status ?? 'unreviewed'} compact />
                {e.notes && <span style={{ color: '#8b949e', fontSize: '12px' }}>{e.notes}</span>}
                <Link to={`/incidents/${id}/entities/${e.id}`} style={{ color: '#58a6ff', textDecoration: 'none', fontSize: '12px' }}>View →</Link>
              </div>
              {isFlagged && (
                <div style={{ borderTop: '1px solid #f0883e22', padding: '12px 16px', background: '#f0883e05' }}>
                  <SuggestedActions
                    entity={{ id: e.id, type: e.type, value: e.value, status: e.status, ioc_status: ext.ioc_status }}
                    incidentId={id!}
                    onCreateTask={async (title) => {
                      await apiClient.post(`/incidents/${id}/tasks`, { title, priority: 'high' }).catch(() => {});
                      refetchTasks();
                    }}
                  />
                </div>
              )}
            </div>
          );
        })}
        {entities?.length === 0 && <div style={{ color: '#8b949e', fontSize: '14px' }}>No entities added yet.</div>}
      </div>

      <div style={{ display: activeTab === 'killchain' ? undefined : 'none' }}>
        {visitedTabs.has('killchain') && <KillChainFlow incidentId={id!} />}
      </div>

      <div style={{ display: activeTab === 'relationships' ? undefined : 'none' }}>
        {visitedTabs.has('relationships') && <EntityRelationshipGraph incidentId={id!} />}
      </div>

      <div style={{ display: activeTab === 'network' ? undefined : 'none' }}>
        {visitedTabs.has('network') && <NetworkBoundaryFlow incidentId={id!} />}
      </div>

      <div style={{ display: activeTab === 'timeline' ? undefined : 'none' }}>
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
      </div>

      <div style={{ display: activeTab === 'tasks' ? undefined : 'none' }}>
        <TaskBoard
          incidentId={id!}
          tasks={tasks ?? []}
          teamMembers={teamMembers}
          availableEntities={(entities ?? []).map((e) => ({ id: e.id, type: e.type, value: e.value }))}
          onRefresh={refetchTasks}
          highlightTaskId={highlightTaskId}
        />
      </div>

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

      {/* Floating comment toggle button */}
      <button
        onClick={() => setCommentPanelOpen((v) => !v)}
        title={commentPanelOpen ? 'Close discussion' : 'Open discussion'}
        style={{
          position: 'fixed',
          right: commentPanelOpen ? '404px' : '0px',
          top: '50%',
          transform: 'translateY(-50%)',
          zIndex: 400,
          background: '#161b22',
          border: '1px solid #30363d',
          borderRight: commentPanelOpen ? '1px solid #30363d' : 'none',
          borderRadius: commentPanelOpen ? '8px 0 0 8px' : '8px 0 0 8px',
          padding: '14px 10px',
          cursor: 'pointer',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '6px',
          transition: 'right 0.25s ease',
          boxShadow: '-2px 0 12px rgba(0,0,0,0.4)',
        }}
      >
        <span style={{ fontSize: '16px' }}>💬</span>
        <span style={{
          writingMode: 'vertical-rl',
          textOrientation: 'mixed',
          fontSize: '10px',
          fontWeight: 600,
          color: commentPanelOpen ? '#58a6ff' : '#8b949e',
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
        }}>
          {commentPanelOpen ? 'Close' : 'Discussion'}
        </span>
      </button>

      {/* Slide-out comment drawer */}
      <div style={{
        position: 'fixed',
        top: 0,
        right: commentPanelOpen ? 0 : '-400px',
        width: '400px',
        height: '100vh',
        background: '#161b22',
        borderLeft: '1px solid #30363d',
        zIndex: 399,
        display: 'flex',
        flexDirection: 'column',
        transition: 'right 0.25s ease',
        boxShadow: commentPanelOpen ? '-4px 0 24px rgba(0,0,0,0.5)' : 'none',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #30363d', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '15px' }}>💬</span>
            <span style={{ fontWeight: 600, fontSize: '14px', color: '#e6edf3' }}>Discussion</span>
          </div>
          <button
            onClick={() => setCommentPanelOpen(false)}
            style={{ background: 'transparent', border: 'none', color: '#8b949e', fontSize: '16px', cursor: 'pointer', padding: '2px 6px', borderRadius: '4px' }}
            title="Close"
          >
            ✕
          </button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          {commentPanelOpen && (
            <CommentThread incidentId={id} teamMembers={teamMembers} />
          )}
        </div>
      </div>
    </div>
  );
}
