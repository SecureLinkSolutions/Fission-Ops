import { useState } from 'react';
import { apiClient } from '../api/client';

interface Suggestion {
  technique_id: string;
  name: string;
  weight: number;
}

interface Props {
  incidentId: string;
  entityId: string;
  triggerTechniqueId: string;
  triggerTechniqueName: string;
  suggestions: Suggestion[];
  onAddTTP: (techniqueId: string, techniqueName: string) => void;
  onDismiss: () => void;
}

async function logAction(
  incidentId: string, entityId: string,
  suggestedId: string, triggerId: string,
  action: 'accepted' | 'dismissed',
) {
  await apiClient.post(`/incidents/${incidentId}/ttp-suggestions/log`, {
    suggested_technique_id: suggestedId,
    trigger_technique_id: triggerId,
    action,
    entity_id: entityId,
  }).catch(() => {});
}

export default function TTPSuggestionPanel({
  incidentId, entityId, triggerTechniqueId, triggerTechniqueName,
  suggestions: initial, onAddTTP, onDismiss,
}: Props) {
  const [visible, setVisible] = useState<Suggestion[]>(initial);

  if (visible.length === 0) return null;

  function dismissOne(s: Suggestion) {
    logAction(incidentId, entityId, s.technique_id, triggerTechniqueId, 'dismissed');
    setVisible((prev) => prev.filter((x) => x.technique_id !== s.technique_id));
  }

  function dismissAll() {
    visible.forEach((s) =>
      logAction(incidentId, entityId, s.technique_id, triggerTechniqueId, 'dismissed'),
    );
    onDismiss();
  }

  function accept(s: Suggestion) {
    logAction(incidentId, entityId, s.technique_id, triggerTechniqueId, 'accepted');
    setVisible((prev) => prev.filter((x) => x.technique_id !== s.technique_id));
    onAddTTP(s.technique_id, s.name);
    if (visible.length === 1) onDismiss();
  }

  return (
    <div style={{
      marginTop: '10px',
      background: '#58a6ff08',
      border: '1px solid #58a6ff33',
      borderRadius: '8px',
      padding: '12px 14px',
    }}>
      <div style={{ fontSize: '12px', color: '#58a6ff', fontWeight: 600, marginBottom: '8px' }}>
        Analysts commonly see these TTPs alongside{' '}
        <span style={{ fontFamily: 'monospace' }}>{triggerTechniqueId}</span>{' '}
        {triggerTechniqueName}:
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {visible.map((s) => (
          <div key={s.technique_id} style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            background: '#161b22', borderRadius: '6px', padding: '6px 10px',
            border: '1px solid #21262d',
          }}>
            <span style={{
              fontFamily: 'monospace', fontSize: '11px', fontWeight: 700,
              background: '#58a6ff22', color: '#58a6ff',
              border: '1px solid #58a6ff44', borderRadius: '4px',
              padding: '1px 6px', flexShrink: 0,
            }}>
              {s.technique_id}
            </span>
            <span style={{ flex: 1, fontSize: '12px', color: '#c9d1d9' }}>{s.name}</span>
            <button type="button"
              onClick={() => accept(s)}
              style={{
                background: '#23863622', border: '1px solid #23863644',
                borderRadius: '4px', padding: '2px 8px',
                color: '#3fb950', fontSize: '11px', fontWeight: 600, cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              ＋ Add
            </button>
            <button type="button"
              onClick={() => dismissOne(s)}
              style={{
                background: 'transparent', border: 'none',
                color: '#484f58', fontSize: '13px', cursor: 'pointer',
                padding: '0 2px', flexShrink: 0, lineHeight: 1,
              }}
              title="Dismiss"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      <div style={{ textAlign: 'right', marginTop: '8px' }}>
        <button type="button"
          onClick={dismissAll}
          style={{ background: 'transparent', border: 'none', color: '#484f58', fontSize: '11px', cursor: 'pointer' }}
        >
          Dismiss all suggestions
        </button>
      </div>
    </div>
  );
}
