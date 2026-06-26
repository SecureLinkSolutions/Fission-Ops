import { useState } from 'react';
import { useFetch } from '../hooks/useFetch';
import { apiClient } from '../api/client';
import { KillChainStage, KillChainMappingWithStage } from '../types';

interface Props {
  entityId: string;
  mappings: KillChainMappingWithStage[];
  onUpdated: () => void;
}

const CONFIDENCE_COLORS: Record<string, string> = { low: '#d29922', medium: '#58a6ff', high: '#3fb950' };

const s: Record<string, React.CSSProperties> = {
  section: { background: '#161b22', border: '1px solid #30363d', borderRadius: '8px', padding: '20px', marginBottom: '16px' },
  title: { fontSize: '14px', fontWeight: 600, color: '#e6edf3', marginBottom: '16px' },
  stagePill: { display: 'inline-block', background: '#21262d', border: '1px solid #30363d', borderRadius: '6px', padding: '6px 14px', margin: '4px', fontSize: '13px', color: '#8b949e', cursor: 'pointer' },
  stagePillActive: { background: '#1f3a2b', border: '1px solid #3fb950', color: '#3fb950' },
  row: { display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 0', borderBottom: '1px solid #21262d' },
  removeBtn: { background: 'transparent', border: '1px solid #f8514944', borderRadius: '4px', color: '#f85149', padding: '3px 8px', fontSize: '11px', cursor: 'pointer' },
  select: { background: '#0d1117', border: '1px solid #30363d', borderRadius: '6px', padding: '6px 10px', color: '#e6edf3', fontSize: '12px' },
  addBtn: { background: '#238636', border: 'none', borderRadius: '6px', padding: '7px 14px', color: '#fff', fontSize: '12px', cursor: 'pointer' },
};

function confidenceBadge(c: string): React.CSSProperties {
  const color = CONFIDENCE_COLORS[c] ?? '#8b949e';
  return { background: `${color}22`, color, border: `1px solid ${color}44`, borderRadius: '12px', padding: '2px 8px', fontSize: '11px' };
}

export default function KillChainPanel({ entityId, mappings, onUpdated }: Props) {
  const [selectedStage, setSelectedStage] = useState('');
  const [confidence, setConfidence] = useState<'low' | 'medium' | 'high'>('medium');

  const { data: stages } = useFetch<KillChainStage[]>(() => apiClient.get('/kill-chain/stages').then((r) => r.data));

  async function addMapping() {
    if (!selectedStage) return;
    await apiClient.post(`/entities/${entityId}/kill-chain`, { stage_id: selectedStage, confidence });
    setSelectedStage('');
    onUpdated();
  }

  async function removeMapping(mappingId: string) {
    await apiClient.delete(`/entities/${entityId}/kill-chain/${mappingId}`);
    onUpdated();
  }

  const mappedStageIds = new Set(mappings.map((m) => m.stage_id));

  return (
    <div style={s.section}>
      <div style={s.title}>Kill Chain Stages</div>
      <div style={{ marginBottom: '16px' }}>
        {stages?.map((st) => (
          <span key={st.id}
            style={{ ...s.stagePill, ...(mappedStageIds.has(st.id) ? s.stagePillActive : {}) }}
            onClick={() => setSelectedStage(st.id)}>
            {st.order_index}. {st.name}
          </span>
        ))}
      </div>
      {mappings.length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          {[...mappings].sort((a, b) => a.order_index - b.order_index).map((m) => (
            <div key={m.id} style={s.row}>
              <span style={{ color: '#e6edf3', fontSize: '13px', flex: 1 }}>{m.stage_name}</span>
              <span style={confidenceBadge(m.confidence)}>{m.confidence}</span>
              <button type="button" style={s.removeBtn} onClick={() => removeMapping(m.id)}>✕</button>
            </div>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <select style={s.select} value={selectedStage} onChange={(e) => setSelectedStage(e.target.value)}>
          <option value="">Select stage…</option>
          {stages?.map((st) => <option key={st.id} value={st.id}>{st.name}</option>)}
        </select>
        <select style={s.select} value={confidence} onChange={(e) => setConfidence(e.target.value as 'low' | 'medium' | 'high')}>
          <option value="low">Low confidence</option>
          <option value="medium">Medium confidence</option>
          <option value="high">High confidence</option>
        </select>
        <button type="button" style={s.addBtn} onClick={addMapping} disabled={!selectedStage}>Map</button>
      </div>
    </div>
  );
}
