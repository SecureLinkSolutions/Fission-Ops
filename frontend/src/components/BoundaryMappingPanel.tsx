import { useState } from 'react';
import { apiClient } from '../api/client';
import { NetworkBoundary, BoundaryMappingWithBoundary, DirectionType } from '../types';

interface Props {
  entityId: string;
  boundaries: NetworkBoundary[];
  mappings: BoundaryMappingWithBoundary[];
  onUpdated: () => void;
}

const DIRECTION_COLORS: Record<string, string> = { ingress: '#f85149', egress: '#d29922', lateral: '#a371f7' };
const ZONE_COLORS: Record<string, string> = { IT: '#58a6ff', OT: '#d29922', trusted: '#3fb950', untrusted: '#f85149', dmz: '#a371f7' };

const s: Record<string, React.CSSProperties> = {
  section: { background: '#161b22', border: '1px solid #30363d', borderRadius: '8px', padding: '20px', marginBottom: '16px' },
  title: { fontSize: '14px', fontWeight: 600, color: '#e6edf3', marginBottom: '16px' },
  row: { display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0', borderBottom: '1px solid #21262d' },
  select: { background: '#0d1117', border: '1px solid #30363d', borderRadius: '6px', padding: '6px 10px', color: '#e6edf3', fontSize: '12px' },
  addBtn: { background: '#238636', border: 'none', borderRadius: '6px', padding: '7px 14px', color: '#fff', fontSize: '12px', cursor: 'pointer' },
  removeBtn: { background: 'transparent', border: '1px solid #f8514944', borderRadius: '4px', color: '#f85149', padding: '3px 8px', fontSize: '11px', cursor: 'pointer' },
};

function badge(color: string, text: string) {
  return <span style={{ background: `${color}22`, color, border: `1px solid ${color}44`, borderRadius: '12px', padding: '2px 8px', fontSize: '11px' }}>{text}</span>;
}

export default function BoundaryMappingPanel({ entityId, boundaries, mappings, onUpdated }: Props) {
  const [selectedBoundary, setSelectedBoundary] = useState('');
  const [direction, setDirection] = useState<DirectionType>('ingress');

  async function addMapping() {
    if (!selectedBoundary) return;
    await apiClient.post(`/entities/${entityId}/boundaries`, { boundary_id: selectedBoundary, direction });
    setSelectedBoundary('');
    onUpdated();
  }

  async function removeMapping(mappingId: string) {
    await apiClient.delete(`/entities/${entityId}/boundaries/${mappingId}`);
    onUpdated();
  }

  return (
    <div style={s.section}>
      <div style={s.title}>Network Boundary Traversal</div>
      {mappings.length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          {mappings.map((m) => (
            <div key={m.id} style={s.row}>
              {badge(ZONE_COLORS[m.zone_type] ?? '#8b949e', m.zone_type)}
              <span style={{ color: '#e6edf3', fontSize: '13px', flex: 1 }}>{m.boundary_name}</span>
              {badge(DIRECTION_COLORS[m.direction] ?? '#8b949e', m.direction)}
              <button type="button" style={s.removeBtn} onClick={() => removeMapping(m.id)}>✕</button>
            </div>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <select style={s.select} value={selectedBoundary} onChange={(e) => setSelectedBoundary(e.target.value)}>
          <option value="">Select boundary…</option>
          {boundaries.map((b) => <option key={b.id} value={b.id}>{b.name} ({b.zone_type})</option>)}
        </select>
        <select style={s.select} value={direction} onChange={(e) => setDirection(e.target.value as DirectionType)}>
          <option value="ingress">Ingress</option>
          <option value="egress">Egress</option>
          <option value="lateral">Lateral</option>
        </select>
        <button type="button" style={s.addBtn} onClick={addMapping} disabled={!selectedBoundary}>Map</button>
      </div>
    </div>
  );
}
