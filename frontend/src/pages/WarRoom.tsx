import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { apiClient } from '../api/client';
import { Incident, Entity, TimelineEntry } from '../types';
import { useIncidentSocket } from '../hooks/useIncidentSocket';
import { useAuth } from '../context/AuthContext';
import { relativeTime } from '../utils/time';
import { SEVERITY_COLORS } from '../utils/constants';

const INCIDENT_STATUS_COLORS: Record<string, string> = {
  open: '#58a6ff',
  contained: '#d29922',
  closed: '#8b949e',
};

const OPERATIONAL_STATUS_COLORS: Record<string, string> = {
  active: '#f85149',
  contained: '#d29922',
  eradicated: '#3fb950',
  recovered: '#58a6ff',
  closed: '#8b949e',
};

const ACTION_TYPE_COLORS: Record<string, string> = {
  ENTITY_CREATED: '#3fb950',
  KILL_CHAIN_MAPPED: '#58a6ff',
  TTP_ASSIGNED: '#a371f7',
  RELATIONSHIP_CREATED: '#d29922',
  BOUNDARY_TRAVERSAL: '#f0883e',
  COMMENT_CREATED: '#8b949e',
  IOC_STATUS_CHANGED: '#f85149',
};

function formatDuration(ms: number): string {
  const totalSecs = Math.floor(ms / 1000);
  const secs = totalSecs % 60;
  const totalMins = Math.floor(totalSecs / 60);
  const mins = totalMins % 60;
  const totalHours = Math.floor(totalMins / 60);
  const hours = totalHours % 24;
  const days = Math.floor(totalHours / 24);
  const pad = (n: number) => String(n).padStart(2, '0');
  if (days > 0) return `${days}d ${pad(hours)}:${pad(mins)}:${pad(secs)}`;
  return `${pad(hours)}:${pad(mins)}:${pad(secs)}`;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

interface KillChainStageMatrix {
  stage_id: string;
  stage_name: string;
  entity_count: number;
}

interface KillChainMatrix {
  stages: KillChainStageMatrix[];
}

type EntityWithIOC = Entity & { ioc_status?: string };

export default function WarRoom() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();

  const [incident, setIncident] = useState<Incident | null>(null);
  const [entities, setEntities] = useState<EntityWithIOC[]>([]);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [killChain, setKillChain] = useState<KillChainMatrix | null>(null);
  const [now, setNow] = useState(Date.now());
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [tickerItems, setTickerItems] = useState<string[]>([]);

  const fetchAll = useCallback(async () => {
    if (!id) return;
    const [incRes, entRes, tlRes, kcRes, stagesRes] = await Promise.allSettled([
      apiClient.get(`/incidents/${id}`),
      apiClient.get(`/incidents/${id}/entities`),
      apiClient.get(`/incidents/${id}/timeline`),
      apiClient.get(`/incidents/${id}/kill-chain/matrix`),
      apiClient.get(`/kill-chain/stages`),
    ]);
    if (incRes.status === 'fulfilled') setIncident(incRes.value.data);
    if (entRes.status === 'fulfilled') setEntities(entRes.value.data ?? []);
    if (tlRes.status === 'fulfilled') {
      const entries: TimelineEntry[] = tlRes.value.data ?? [];
      setTimeline(entries.slice(0, 10));
      setTickerItems(entries.slice(0, 5).map((e) => `${e.action_type.replace(/_/g, ' ')} — ${e.description}`));
    }
    // /kill-chain/matrix returns a flat array of entity→stage mapping rows, one
    // per mapped entity — not { stages: [...] } — and only includes stages that
    // have at least one mapping. Build per-stage counts against the full stage
    // list (from /kill-chain/stages) so unmapped stages still show as 0, not
    // vanish from the total.
    if (stagesRes.status === 'fulfilled') {
      const stages: { id: string; name: string }[] = stagesRes.value.data ?? [];
      const matrixRows: { stage_id: string; entity_id: string }[] = kcRes.status === 'fulfilled' ? (kcRes.value.data ?? []) : [];
      const countByStage = new Map<string, Set<string>>();
      for (const row of matrixRows) {
        if (!countByStage.has(row.stage_id)) countByStage.set(row.stage_id, new Set());
        countByStage.get(row.stage_id)!.add(row.entity_id);
      }
      setKillChain({
        stages: stages.map((s) => ({ stage_id: s.id, stage_name: s.name, entity_count: countByStage.get(s.id)?.size ?? 0 })),
      });
    }
  }, [id]);

  const refetchTimeline = useCallback(async () => {
    if (!id) return;
    try {
      const res = await apiClient.get(`/incidents/${id}/timeline`);
      const entries: TimelineEntry[] = res.data ?? [];
      setTimeline(entries.slice(0, 10));
      setTickerItems(entries.slice(0, 5).map((e) => `${e.action_type.replace(/_/g, ' ')} — ${e.description}`));
    } catch (_e) { /* silent */ }
  }, [id]);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 30000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  useEffect(() => {
    if (incident?.status === 'closed') return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [incident?.status]);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  const { presenceList } = useIncidentSocket({
    incidentId: id ?? '',
    userId: user?.id ?? '',
    userName: user?.name ?? user?.email ?? '',
    userEmail: user?.email ?? '',
    onEntityCreated: refetchTimeline,
    onEntityUpdated: refetchTimeline,
    onKillchainMapped: refetchTimeline,
    onKillchainUpdated: refetchTimeline,
    onRelationshipCreated: refetchTimeline,
    onTtpAssigned: refetchTimeline,
    onCommentCreated: refetchTimeline,
    onIocConfirmed: refetchTimeline,
    onEntityEnriched: refetchTimeline,
  });

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const confirmedIOC = entities.filter((e) => e.ioc_status === 'confirmed').length;
  const suspectedIOC = entities.filter((e) => e.ioc_status === 'suspected').length;
  const totalEntities = entities.length;
  const isClosed = incident?.status === 'closed';
  const durationEnd = isClosed && incident?.updated_at ? new Date(incident.updated_at).getTime() : now;
  const duration = incident ? durationEnd - new Date(incident.created_at).getTime() : 0;

  const kcStages = killChain?.stages ?? [];
  const totalStages = kcStages.length;
  const activeStages = kcStages.filter((s) => s.entity_count > 0).length;
  const kcPercent = totalStages > 0 ? (activeStages / totalStages) * 100 : 0;

  const severityColor = SEVERITY_COLORS[incident?.severity ?? ''] ?? '#8b949e';
  const statusColor = INCIDENT_STATUS_COLORS[incident?.status ?? ''] ?? '#8b949e';
  const opStatusColor = OPERATIONAL_STATUS_COLORS[incident?.incident_status ?? ''] ?? '#8b949e';

  const tickerText = tickerItems.length > 0 ? tickerItems.join('   ━━━   ') : 'No recent activity';

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: '#0d1117',
        color: '#e6edf3',
        fontFamily: "'Segoe UI', system-ui, sans-serif",
        display: 'flex',
        flexDirection: 'column',
        zIndex: 9999,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 24px', borderBottom: '1px solid #30363d', background: '#161b22', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1, minWidth: 0 }}>
          <span style={{ color: '#f97316', fontWeight: 800, fontSize: '15px', letterSpacing: '0.05em', flexShrink: 0 }}>⚡ FISSION OPS</span>
          <span style={{ color: '#e6edf3', fontSize: '28px', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {incident?.title ?? 'Loading…'}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0, marginLeft: '16px' }}>
          {incident && (
            <>
              <span style={{ background: `${severityColor}22`, color: severityColor, border: `1px solid ${severityColor}55`, borderRadius: '20px', padding: '3px 12px', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase' as const, letterSpacing: '0.08em' }}>
                {incident.severity}
              </span>
              <span style={{ background: `${statusColor}22`, color: statusColor, border: `1px solid ${statusColor}55`, borderRadius: '20px', padding: '3px 12px', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase' as const, letterSpacing: '0.08em' }}>
                {incident.status}
              </span>
              <span style={{ background: `${opStatusColor}22`, color: opStatusColor, border: `1px solid ${opStatusColor}55`, borderRadius: '20px', padding: '3px 12px', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase' as const, letterSpacing: '0.08em' }}>
                {incident.incident_status?.replace(/_/g, ' ')}
              </span>
            </>
          )}
          <Link
            to={`/incidents/${id}`}
            style={{ background: 'transparent', border: '1px solid #f97316', borderRadius: '6px', padding: '6px 14px', color: '#f97316', fontSize: '13px', fontWeight: 700, textDecoration: 'none', letterSpacing: '0.05em' }}
          >
            EXIT
          </Link>
          <button type="button"
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
            style={{ background: 'transparent', border: '1px solid #30363d', borderRadius: '6px', padding: '6px 10px', color: '#8b949e', fontSize: '16px', cursor: 'pointer' }}
          >
            {isFullscreen ? '⊠' : '⛶'}
          </button>
        </div>
      </div>

      {/* Stat Tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', padding: '14px 24px', flexShrink: 0 }}>
        <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: '10px', padding: '14px 20px', textAlign: 'center' as const }}>
          <div style={{ color: '#8b949e', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.08em', marginBottom: '6px' }}>⏱ DURATION</div>
          <div style={{ color: '#e6edf3', fontSize: '40px', fontWeight: 800, fontFamily: 'monospace', lineHeight: 1 }}>{formatDuration(duration)}</div>
        </div>
        <div style={{ background: '#161b22', border: '1px solid #f8514944', borderRadius: '10px', padding: '14px 20px', textAlign: 'center' as const }}>
          <div style={{ color: '#f85149', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.08em', marginBottom: '6px' }}>🔴 CONFIRMED IOC</div>
          <div style={{ color: '#ffffff', fontSize: '48px', fontWeight: 800, lineHeight: 1 }}>{confirmedIOC}</div>
        </div>
        <div style={{ background: '#161b22', border: '1px solid #d2992244', borderRadius: '10px', padding: '14px 20px', textAlign: 'center' as const }}>
          <div style={{ color: '#d29922', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.08em', marginBottom: '6px' }}>🟡 SUSPECTED IOC</div>
          <div style={{ color: '#ffffff', fontSize: '48px', fontWeight: 800, lineHeight: 1 }}>{suspectedIOC}</div>
        </div>
        <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: '10px', padding: '14px 20px', textAlign: 'center' as const }}>
          <div style={{ color: '#8b949e', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.08em', marginBottom: '6px' }}>📦 ENTITIES</div>
          <div style={{ color: '#ffffff', fontSize: '48px', fontWeight: 800, lineHeight: 1 }}>{totalEntities}</div>
        </div>
      </div>

      {/* Kill Chain & Analysts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', padding: '0 24px 12px', flexShrink: 0 }}>
        <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: '10px', padding: '14px 20px' }}>
          <div style={{ color: '#8b949e', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.08em', marginBottom: '10px' }}>KILL CHAIN PROGRESS</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ flex: 1, background: '#21262d', borderRadius: '6px', height: '14px', overflow: 'hidden' }}>
              <div style={{ width: `${kcPercent}%`, background: 'linear-gradient(90deg, #f97316, #f85149)', height: '100%', borderRadius: '6px', transition: 'width 0.5s ease' }} />
            </div>
            <span style={{ color: '#e6edf3', fontSize: '16px', fontWeight: 700, fontFamily: 'monospace', flexShrink: 0 }}>{activeStages}/{totalStages} stages</span>
          </div>
          {kcStages.length > 0 && (
            <div style={{ display: 'flex', gap: '5px', marginTop: '10px', flexWrap: 'wrap' as const }}>
              {kcStages.map((s) => (
                <span key={s.stage_id} style={{ background: s.entity_count > 0 ? '#f9731622' : '#21262d', color: s.entity_count > 0 ? '#f97316' : '#484f58', border: `1px solid ${s.entity_count > 0 ? '#f9731644' : '#30363d'}`, borderRadius: '4px', padding: '2px 7px', fontSize: '10px', fontWeight: 600 }}>
                  {s.stage_name}
                </span>
              ))}
            </div>
          )}
        </div>
        <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: '10px', padding: '14px 20px' }}>
          <div style={{ color: '#8b949e', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.08em', marginBottom: '10px' }}>ACTIVE ANALYSTS</div>
          <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '10px', alignItems: 'center' }}>
            {presenceList.length === 0 ? (
              <span style={{ color: '#484f58', fontSize: '14px' }}>No analysts online</span>
            ) : (
              presenceList.map((u) => (
                <div key={u.userId} title={u.email} style={{ width: '42px', height: '42px', borderRadius: '50%', background: '#f9731622', border: '2px solid #f97316', color: '#f97316', fontSize: '14px', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {getInitials(u.name || u.email)}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Activity Feed */}
      <div style={{ flex: 1, padding: '0 24px 12px', overflow: 'hidden', display: 'flex', flexDirection: 'column' as const, minHeight: 0 }}>
        <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: '10px', padding: '14px 20px', flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' as const, minHeight: 0 }}>
          <div style={{ color: '#8b949e', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.08em', marginBottom: '8px', flexShrink: 0 }}>RECENT ACTIVITY</div>
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' as const, gap: '5px', minHeight: 0 }}>
            {timeline.length === 0 ? (
              <span style={{ color: '#484f58', fontSize: '14px' }}>No activity yet</span>
            ) : (
              timeline.map((entry, i) => {
                const actionColor = ACTION_TYPE_COLORS[entry.action_type] ?? '#8b949e';
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '5px 10px', background: '#0d1117', borderRadius: '6px', flexShrink: 0 }}>
                    <span style={{ color: '#484f58', fontSize: '12px', fontFamily: 'monospace', flexShrink: 0, minWidth: '48px' }}>{relativeTime(entry.ts)}</span>
                    <span style={{ background: `${actionColor}22`, color: actionColor, border: `1px solid ${actionColor}44`, borderRadius: '4px', padding: '1px 6px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.05em', flexShrink: 0 }}>
                      {entry.action_type.replace(/_/g, ' ')}
                    </span>
                    <span style={{ color: '#58a6ff', fontSize: '13px', flexShrink: 0, maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
                      {entry.user_email}
                    </span>
                    <span style={{ color: '#e6edf3', fontSize: '14px', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
                      {entry.description}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Live Ticker */}
      <div style={{ background: '#0d1117', borderTop: '2px solid #30363d', padding: '7px 0', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center' }}>
        <span style={{ color: '#f97316', fontSize: '11px', fontWeight: 700, padding: '0 14px', flexShrink: 0, letterSpacing: '0.05em', whiteSpace: 'nowrap' as const }}>━ LIVE ━</span>
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <div style={{ display: 'inline-block', whiteSpace: 'nowrap' as const, fontSize: '13px', color: '#8b949e', animation: 'warroom-ticker 45s linear infinite' }}>
            {tickerText}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{tickerText}
          </div>
        </div>
        <style>{`@keyframes warroom-ticker { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }`}</style>
      </div>
    </div>
  );
}
