import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useFetch } from '../hooks/useFetch';
import { apiClient } from '../api/client';
import { Incident, Entity, NetworkBoundary, KillChainStage } from '../types';
import EntityForm from '../components/EntityForm';
import NetworkMapPanel from '../components/NetworkMapPanel';

const ENTITY_TYPE_ICONS: Record<string, string> = { hostname: '🖥', ip: '🌐', email: '📧', domain: '🔗', account: '👤' };
const ENTITY_TYPE_COLORS: Record<string, string> = { hostname: '#58a6ff', ip: '#3fb950', email: '#d29922', domain: '#a371f7', account: '#f0883e' };
const SEVERITY_COLORS: Record<string, string> = { low: '#3fb950', medium: '#d29922', high: '#f85149', critical: '#ff7b72' };
const STATUS_COLORS: Record<string, string> = { open: '#58a6ff', contained: '#d29922', closed: '#8b949e' };

function badge(color: string, text: string): React.ReactElement {
  return <span style={{ background: `${color}22`, color, border: `1px solid ${color}44`, borderRadius: '12px', padding: '4px 12px', fontSize: '12px', fontWeight: 600 }}>{text}</span>;
}

interface MatrixRow {
  entity_id: string;
  value: string;
  type: string;
  stage_id: string;
  stage_name: string;
  order_index: number;
  confidence: string;
}

export default function IncidentDetail() {
  const { id } = useParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState<'entities' | 'killchain' | 'network'>('entities');
  const [newBoundaryName, setNewBoundaryName] = useState('');
  const [newBoundaryZone, setNewBoundaryZone] = useState('IT');
  const [addingBoundary, setAddingBoundary] = useState(false);

  const { data: incident, loading: incLoading, error: incError } = useFetch<Incident>(
    () => apiClient.get(`/incidents/${id}`).then((r) => r.data), [id],
  );
  const { data: entities, refetch: refetchEntities } = useFetch<Entity[]>(
    () => apiClient.get(`/incidents/${id}/entities`).then((r) => r.data), [id],
  );
  const { data: boundaries, refetch: refetchBoundaries } = useFetch<NetworkBoundary[]>(
    () => apiClient.get(`/incidents/${id}/boundaries`).then((r) => r.data), [id],
  );
  const { data: killChainMatrix } = useFetch<MatrixRow[]>(
    () => apiClient.get(`/incidents/${id}/kill-chain/matrix`).then((r) => r.data), [id],
  );
  const { data: stages } = useFetch<KillChainStage[]>(
    () => apiClient.get('/kill-chain/stages').then((r) => r.data),
  );

  async function addBoundary() {
    if (!newBoundaryName) return;
    setAddingBoundary(true);
    try {
      await apiClient.post(`/incidents/${id}/boundaries`, { name: newBoundaryName, zone_type: newBoundaryZone });
      setNewBoundaryName('');
      refetchBoundaries();
    } finally {
      setAddingBoundary(false);
    }
  }

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '10px 20px', cursor: 'pointer', border: 'none', background: 'transparent',
    color: active ? '#e6edf3' : '#8b949e',
    borderBottom: active ? '2px solid #58a6ff' : '2px solid transparent',
    fontSize: '14px', fontWeight: active ? 600 : 400,
  });

  const inputStyle: React.CSSProperties = { background: '#0d1117', border: '1px solid #30363d', borderRadius: '6px', padding: '8px 12px', color: '#e6edf3', fontSize: '13px', outline: 'none' };

  if (incLoading) return <div style={{ padding: '32px', color: '#8b949e' }}>Loading incident…</div>;
  if (incError || !incident) return <div style={{ padding: '32px', color: '#f85149' }}>Failed to load incident.</div>;

  return (
    <div style={{ padding: '32px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ marginBottom: '24px' }}>
        <div style={{ fontSize: '28px', fontWeight: 700, color: '#e6edf3', marginBottom: '8px' }}>{incident.title}</div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {badge(SEVERITY_COLORS[incident.severity], incident.severity)}
          {badge(STATUS_COLORS[incident.status], incident.status)}
          {incident.description && <span style={{ color: '#8b949e', fontSize: '13px' }}>{incident.description}</span>}
        </div>
      </div>

      <div style={{ display: 'flex', borderBottom: '1px solid #30363d', marginBottom: '24px' }}>
        <button style={tabStyle(activeTab === 'entities')} onClick={() => setActiveTab('entities')}>Entities ({entities?.length ?? 0})</button>
        <button style={tabStyle(activeTab === 'killchain')} onClick={() => setActiveTab('killchain')}>Kill Chain</button>
        <button style={tabStyle(activeTab === 'network')} onClick={() => setActiveTab('network')}>Network Map</button>
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

      {activeTab === 'killchain' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px', marginBottom: '24px' }}>
            {(stages ?? []).map((stage) => {
              const stageEntities = (killChainMatrix ?? []).filter((m) => m.stage_id === stage.id);
              const active = stageEntities.length > 0;
              return (
                <div key={stage.id} style={{ background: active ? '#1f3a2b' : '#161b22', border: `1px solid ${active ? '#3fb950' : '#30363d'}`, borderRadius: '6px', padding: '12px 8px', textAlign: 'center', minHeight: '80px' }}>
                  <div style={{ color: '#8b949e', fontSize: '11px', fontWeight: 600, marginBottom: '8px', textTransform: 'uppercase' }}>{stage.name}</div>
                  {stageEntities.map((m) => (
                    <span key={m.entity_id + m.stage_id} style={{ background: '#21262d', border: '1px solid #30363d', borderRadius: '4px', padding: '3px 6px', fontSize: '11px', color: '#e6edf3', margin: '2px', display: 'inline-block' }}>
                      {ENTITY_TYPE_ICONS[m.type]} {m.value}
                    </span>
                  ))}
                </div>
              );
            })}
          </div>
          <div style={{ color: '#8b949e', fontSize: '12px' }}>Map entities to stages from the entity detail page.</div>
        </>
      )}

      {activeTab === 'network' && (
        <>
          <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: '8px', padding: '20px', marginBottom: '24px' }}>
            <div style={{ fontSize: '14px', fontWeight: 600, color: '#e6edf3', marginBottom: '12px' }}>Add Network Boundary</div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <input style={{ ...inputStyle, flex: 1 }} value={newBoundaryName} onChange={(e) => setNewBoundaryName(e.target.value)} placeholder="Boundary name (e.g. Corporate LAN)" />
              <select style={{ ...inputStyle, width: '160px' }} value={newBoundaryZone} onChange={(e) => setNewBoundaryZone(e.target.value)}>
                {['IT', 'OT', 'trusted', 'untrusted', 'dmz'].map((z) => <option key={z} value={z}>{z}</option>)}
              </select>
              <button style={{ background: '#238636', border: 'none', borderRadius: '6px', padding: '8px 16px', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }} onClick={addBoundary} disabled={addingBoundary || !newBoundaryName}>Add</button>
            </div>
          </div>
          <NetworkMapPanel boundaries={boundaries ?? []} />
        </>
      )}
    </div>
  );
}
