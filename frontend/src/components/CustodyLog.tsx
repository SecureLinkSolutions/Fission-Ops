import { useState } from 'react';
import { useFetch } from '../hooks/useFetch';
import { apiClient } from '../api/client';
import { relativeTime } from '../utils/time';

interface CustodyEntry {
  id: string;
  entity_id: string;
  incident_id?: string;
  action: string;
  actor_id?: string;
  actor_name?: string;
  actor_role?: string;
  actor_ip?: string;
  details?: Record<string, unknown>;
  created_at: string;
}

interface Props {
  entityId: string;
}

const ACTION_DISPLAY: Record<string, { icon: string; label: string }> = {
  entity_viewed:        { icon: '👁', label: 'Viewed' },
  enrichment_retrieved: { icon: '🔍', label: 'Enrichment Retrieved' },
  entity_edited:        { icon: '✏️', label: 'Edited' },
  ioc_status_changed:   { icon: '🚩', label: 'IOC Status Changed' },
  entity_exported:      { icon: '📤', label: 'Exported' },
  kill_chain_mapped:    { icon: '⛓', label: 'Kill Chain Mapped' },
  checklist_updated:    { icon: '✅', label: 'Checklist Updated' },
  comment_added:        { icon: '💬', label: 'Comment Added' },
};

const ROLE_COLORS: Record<string, string> = {
  analyst:            '#8b949e',
  senior_analyst:     '#58a6ff',
  incident_commander: '#d29922',
  platform_admin:        '#a371f7',
};

export default function CustodyLog({ entityId }: Props) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const { data: log, loading, error, refetch } = useFetch<CustodyEntry[]>(
    () => apiClient.get(`/entities/${entityId}/custody-log`).then((r) => r.data),
    [entityId],
  );

  function toggleDetails(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div style={{ padding: '16px 0' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 style={{ margin: 0, color: '#e6edf3', fontSize: '14px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Chain of Custody
        </h3>
        <button type="button"
          onClick={refetch}
          style={{
            background: '#21262d',
            border: '1px solid #30363d',
            borderRadius: '6px',
            color: '#8b949e',
            padding: '4px 10px',
            fontSize: '12px',
            cursor: 'pointer',
          }}
        >
          ↻ Refresh
        </button>
      </div>

      {loading && <div style={{ color: '#8b949e', fontSize: '13px' }}>Loading custody log…</div>}
      {error && <div style={{ color: '#f85149', fontSize: '13px' }}>Failed to load custody log.</div>}

      {!loading && !error && log && log.length === 0 && (
        <div style={{ color: '#8b949e', fontSize: '13px', fontStyle: 'italic' }}>
          No custody records yet. Records are created automatically when the entity is accessed or modified.
        </div>
      )}

      {!loading && !error && log && log.length > 0 && (
        <div style={{ position: 'relative' }}>
          {/* Vertical timeline line */}
          <div style={{
            position: 'absolute',
            left: '20px',
            top: '12px',
            bottom: '12px',
            width: '2px',
            background: '#21262d',
            zIndex: 0,
          }} />

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {log.map((entry, index) => {
              const actionInfo = ACTION_DISPLAY[entry.action] ?? { icon: '•', label: entry.action };
              const roleColor = entry.actor_role ? (ROLE_COLORS[entry.actor_role] ?? '#8b949e') : '#8b949e';
              const hasDetails = entry.details && Object.keys(entry.details).length > 0;
              const isExpanded = expandedIds.has(entry.id);

              return (
                <div key={entry.id} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', position: 'relative', zIndex: 1 }}>
                  {/* Entry number badge */}
                  <div style={{
                    minWidth: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    background: '#161b22',
                    border: '2px solid #30363d',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#8b949e',
                    fontSize: '11px',
                    fontWeight: 600,
                    flexShrink: 0,
                  }}>
                    #{index + 1}
                  </div>

                  {/* Entry card */}
                  <div style={{
                    flex: 1,
                    background: '#161b22',
                    border: '1px solid #21262d',
                    borderRadius: '8px',
                    padding: '10px 14px',
                  }}>
                    {/* Top row: action + actor */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '16px' }}>{actionInfo.icon}</span>
                        <span style={{ color: '#e6edf3', fontWeight: 600, fontSize: '13px' }}>{actionInfo.label}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {entry.actor_name && (
                          <span style={{ color: '#c9d1d9', fontSize: '12px' }}>{entry.actor_name}</span>
                        )}
                        {entry.actor_role && (
                          <span style={{
                            color: roleColor,
                            fontSize: '10px',
                            fontWeight: 600,
                            border: `1px solid ${roleColor}`,
                            borderRadius: '4px',
                            padding: '1px 5px',
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em',
                          }}>
                            {entry.actor_role === 'platform_admin' ? 'Platform Admin' : entry.actor_role.replace(/_/g, ' ')}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* IP + timestamp */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '6px', flexWrap: 'wrap' }}>
                      {entry.actor_ip && (
                        <span style={{ color: '#6e7681', fontSize: '11px', fontFamily: 'monospace' }}>{entry.actor_ip}</span>
                      )}
                      <span style={{ color: '#6e7681', fontSize: '11px' }}>
                        {new Date(entry.created_at).toLocaleString()} ({relativeTime(entry.created_at)})
                      </span>
                    </div>

                    {/* Details toggle */}
                    {hasDetails && (
                      <div style={{ marginTop: '8px' }}>
                        <button type="button"
                          onClick={() => toggleDetails(entry.id)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#58a6ff',
                            fontSize: '11px',
                            cursor: 'pointer',
                            padding: '0',
                          }}
                        >
                          {isExpanded ? '▾ Hide details' : '▸ Show details'}
                        </button>
                        {isExpanded && (
                          <div style={{
                            marginTop: '6px',
                            background: '#0d1117',
                            borderRadius: '4px',
                            padding: '8px',
                            fontSize: '12px',
                          }}>
                            {Object.entries(entry.details!).map(([k, v]) => (
                              <div key={k} style={{ display: 'flex', gap: '8px', marginBottom: '3px' }}>
                                <span style={{ color: '#8b949e', minWidth: '120px' }}>{k}:</span>
                                <span style={{ color: '#c9d1d9', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                                  {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={{ marginTop: '20px', color: '#6e7681', fontSize: '11px', borderTop: '1px solid #21262d', paddingTop: '12px' }}>
        🔒 This log is append-only and cannot be modified by any user.
      </div>
    </div>
  );
}
