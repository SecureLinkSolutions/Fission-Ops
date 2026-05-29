import { useParams, Link } from 'react-router-dom';
import { useFetch } from '../hooks/useFetch';
import { apiClient } from '../api/client';
import { Entity, NetworkBoundary } from '../types';
import KillChainPanel from '../components/KillChainPanel';
import BoundaryMappingPanel from '../components/BoundaryMappingPanel';

const ENTITY_TYPE_ICONS: Record<string, string> = { hostname: '🖥', ip: '🌐', email: '📧', domain: '🔗', account: '👤' };
const ENTITY_TYPE_COLORS: Record<string, string> = { hostname: '#58a6ff', ip: '#3fb950', email: '#d29922', domain: '#a371f7', account: '#f0883e' };

export default function EntityDetail() {
  const { id, entityId } = useParams<{ id: string; entityId: string }>();

  const { data: entity, loading, error, refetch } = useFetch<Entity>(
    () => apiClient.get(`/entities/${entityId}`).then((r) => r.data), [entityId],
  );
  const { data: boundaries } = useFetch<NetworkBoundary[]>(
    () => apiClient.get(`/incidents/${id}/boundaries`).then((r) => r.data), [id],
  );

  if (loading) return <div style={{ padding: '32px', color: '#8b949e' }}>Loading entity…</div>;
  if (error || !entity) return <div style={{ padding: '32px', color: '#f85149' }}>Failed to load entity.</div>;

  const color = ENTITY_TYPE_COLORS[entity.type] ?? '#8b949e';

  return (
    <div style={{ padding: '32px', maxWidth: '900px', margin: '0 auto' }}>
      <div style={{ color: '#58a6ff', fontSize: '13px', marginBottom: '20px', display: 'flex', gap: '8px', alignItems: 'center' }}>
        <Link to={`/incidents/${id}`} style={{ color: '#58a6ff', textDecoration: 'none' }}>← Back to incident</Link>
        <span style={{ color: '#30363d' }}>/</span>
        <span style={{ color: '#8b949e' }}>Entity</span>
      </div>

      <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: '8px', padding: '20px', marginBottom: '24px' }}>
        <div style={{ background: `${color}22`, color, border: `1px solid ${color}44`, borderRadius: '6px', padding: '6px 14px', fontSize: '14px', fontWeight: 600, display: 'inline-block', marginBottom: '12px' }}>
          {ENTITY_TYPE_ICONS[entity.type]} {entity.type}
        </div>
        <div style={{ fontFamily: 'monospace', fontSize: '20px', fontWeight: 700, color: '#e6edf3', marginBottom: '8px' }}>{entity.value}</div>
        {entity.notes && <div style={{ color: '#8b949e', fontSize: '13px', lineHeight: '1.5' }}>{entity.notes}</div>}
        {entity.entity_details && Object.keys(entity.entity_details).length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', marginTop: '12px' }}>
            {Object.entries(entity.entity_details).map(([k, v]) => (
              <div key={k} style={{ background: '#0d1117', borderRadius: '6px', padding: '8px 12px' }}>
                <div style={{ color: '#8b949e', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase' }}>{k}</div>
                <div style={{ color: '#e6edf3', fontSize: '13px', marginTop: '2px', fontFamily: 'monospace' }}>{String(v)}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <KillChainPanel entityId={entityId!} mappings={entity.kill_chain_mappings ?? []} onUpdated={refetch} />
      <BoundaryMappingPanel entityId={entityId!} boundaries={boundaries ?? []} mappings={entity.boundary_mappings ?? []} onUpdated={refetch} />
    </div>
  );
}
