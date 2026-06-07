import { useState } from 'react';
import { useFetch } from '../hooks/useFetch';
import { apiClient } from '../api/client';

interface TTP {
  id: string;
  technique_id: string;
  name: string;
  tactic: string;
  framework: string;
  is_subtechnique: boolean;
}

interface AssignedTTP {
  entity_stage_ttp_id: string;
  ttp_id: string;
  technique_id: string;
  name: string;
  tactic: string;
}

interface Props {
  mappingId: string;
  entityId: string;
  entityValue: string;
  onUpdated: (techniqueId?: string, techniqueName?: string) => void;
  onClose: () => void;
}

const TACTIC_COLORS: Record<string, string> = {
  'Initial Access': '#58a6ff',
  'Execution': '#d29922',
  'Persistence': '#3fb950',
  'Privilege Escalation': '#f0883e',
  'Defense Evasion': '#a371f7',
  'Credential Access': '#f85149',
  'Discovery': '#58a6ff',
  'Lateral Movement': '#d29922',
  'Collection': '#3fb950',
  'Command and Control': '#f0883e',
  'Exfiltration': '#a371f7',
  'Impact': '#f85149',
};

export default function TTPSearch({ mappingId, entityId, entityValue, onUpdated, onClose }: Props) {
  const [query, setQuery] = useState('');
  const [tactic, setTactic] = useState('');

  const { data: assigned, refetch: refetchAssigned } = useFetch<AssignedTTP[]>(
    () => apiClient.get(`/entities/${entityId}/kill-chain/${mappingId}/ttps`).then((r) => r.data),
    [mappingId],
  );

  const { data: results } = useFetch<TTP[]>(
    () => apiClient.get(`/ttps?q=${encodeURIComponent(query)}&tactic=${encodeURIComponent(tactic)}`).then((r) => r.data),
    [query, tactic],
  );

  const assignedIds = new Set((assigned ?? []).map((a) => a.ttp_id));

  async function assign(ttp: TTP) {
    await apiClient.post(`/entities/${entityId}/kill-chain/${mappingId}/ttps`, { ttp_id: ttp.id });
    refetchAssigned();
    onUpdated(ttp.technique_id, ttp.name);
  }

  async function remove(entityStageTtpId: string) {
    await apiClient.delete(`/entities/${entityId}/kill-chain/${mappingId}/ttps/${entityStageTtpId}`);
    refetchAssigned();
    onUpdated();
  }

  const tactics = [
    'Initial Access', 'Execution', 'Persistence', 'Privilege Escalation',
    'Defense Evasion', 'Credential Access', 'Discovery', 'Lateral Movement',
    'Collection', 'Command and Control', 'Exfiltration', 'Impact',
  ];

  const inputStyle: React.CSSProperties = {
    background: '#0d1117', border: '1px solid #30363d', borderRadius: '6px',
    padding: '8px 12px', color: '#e6edf3', fontSize: '13px', outline: 'none',
  };

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
      }}
    >
      <div style={{
        background: '#161b22', border: '1px solid #30363d', borderRadius: '12px',
        width: '640px', maxHeight: '80vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 16px 48px rgba(0,0,0,0.6)',
      }}>
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #30363d', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '15px', fontWeight: 700, color: '#e6edf3' }}>Assign TTPs</div>
            <div style={{ fontSize: '12px', color: '#8b949e', marginTop: '2px' }}>{entityValue}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#8b949e', cursor: 'pointer', fontSize: '18px', padding: '4px 8px' }}>✕</button>
        </div>

        {/* Assigned TTPs */}
        {(assigned ?? []).length > 0 && (
          <div style={{ padding: '12px 20px', borderBottom: '1px solid #30363d' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: '#8b949e', textTransform: 'uppercase', marginBottom: '8px' }}>Assigned</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {(assigned ?? []).map((a) => {
                const color = TACTIC_COLORS[a.tactic] ?? '#8b949e';
                return (
                  <div key={a.entity_stage_ttp_id} style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    background: `${color}15`, border: `1px solid ${color}44`,
                    borderRadius: '8px', padding: '4px 10px',
                  }}>
                    <span style={{ fontFamily: 'monospace', fontSize: '11px', color, fontWeight: 700 }}>{a.technique_id}</span>
                    <span style={{ fontSize: '11px', color: '#e6edf3' }}>{a.name}</span>
                    <button onClick={() => remove(a.entity_stage_ttp_id)} style={{ background: 'none', border: 'none', color: '#8b949e', cursor: 'pointer', fontSize: '12px', padding: '0', lineHeight: 1 }}>✕</button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Search */}
        <div style={{ padding: '12px 20px', borderBottom: '1px solid #30363d', display: 'flex', gap: '8px' }}>
          <input
            style={{ ...inputStyle, flex: 1 }}
            placeholder="Search technique ID or name..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <select
            style={{ ...inputStyle, width: '180px' }}
            value={tactic}
            onChange={(e) => setTactic(e.target.value)}
          >
            <option value="">All tactics</option>
            {tactics.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        {/* Results */}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {(results ?? []).filter((r) => !assignedIds.has(r.id)).map((ttp) => {
            const color = TACTIC_COLORS[ttp.tactic] ?? '#8b949e';
            return (
              <div
                key={ttp.id}
                onClick={() => assign(ttp)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '10px 20px', cursor: 'pointer', borderBottom: '1px solid #21262d',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = '#21262d'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
              >
                <span style={{
                  fontFamily: 'monospace', fontSize: '11px', fontWeight: 700, color: '#e6edf3',
                  background: '#21262d', border: '1px solid #30363d', borderRadius: '4px',
                  padding: '2px 6px', minWidth: '72px', textAlign: 'center',
                }}>
                  {ttp.technique_id}
                </span>
                <span style={{
                  fontSize: '11px', fontWeight: 600, color,
                  background: `${color}15`, border: `1px solid ${color}33`,
                  borderRadius: '10px', padding: '2px 8px', whiteSpace: 'nowrap',
                }}>
                  {ttp.tactic}
                </span>
                <span style={{ fontSize: '13px', color: '#e6edf3', flex: 1 }}>{ttp.name}</span>
                {ttp.is_subtechnique && (
                  <span style={{ fontSize: '10px', color: '#8b949e', background: '#21262d', border: '1px solid #30363d', borderRadius: '4px', padding: '2px 6px' }}>sub</span>
                )}
              </div>
            );
          })}
          {(results ?? []).filter((r) => !assignedIds.has(r.id)).length === 0 && (
            <div style={{ padding: '20px', color: '#8b949e', fontSize: '13px', textAlign: 'center' }}>
              {query || tactic ? 'No matching TTPs' : 'Type to search TTPs'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
