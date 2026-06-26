import { useState } from 'react';
import { useFetch } from '../hooks/useFetch';
import { apiClient } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { ROLE_RANK } from '../utils/constants';
import { relativeTime } from '../utils/time';

interface ChecklistItem {
  id: string;
  entity_id: string;
  item_text: string;
  checked: boolean;
  checked_by?: string;
  checked_by_name?: string;
  checked_at?: string;
  is_custom: boolean;
  order_index: number;
}

interface Props {
  entityId: string;
  entityType: string;
}

export default function ContainmentChecklist({ entityId }: Props) {
  const { user } = useAuth();
  const isSeniorAnalyst = ROLE_RANK[user?.role ?? ''] >= ROLE_RANK['senior_analyst'];
  const [newItemText, setNewItemText] = useState('');
  const [adding, setAdding] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);

  const { data: items, refetch } = useFetch<ChecklistItem[]>(
    () => apiClient.get(`/entities/${entityId}/checklist`).then((r) => r.data),
    [entityId],
  );

  const checkedCount = (items ?? []).filter((i) => i.checked).length;
  const total = (items ?? []).length;
  const pct = total > 0 ? Math.round((checkedCount / total) * 100) : 0;

  async function handleToggle(item: ChecklistItem) {
    setToggling(item.id);
    try {
      await apiClient.patch(`/entities/${entityId}/checklist/${item.id}`, { checked: !item.checked });
      refetch();
    } finally {
      setToggling(null);
    }
  }

  async function handleDelete(itemId: string) {
    await apiClient.delete(`/entities/${entityId}/checklist/${itemId}`).catch(() => {});
    refetch();
  }

  async function handleAddItem() {
    if (!newItemText.trim()) return;
    setAdding(true);
    try {
      await apiClient.post(`/entities/${entityId}/checklist`, { item_text: newItemText.trim() });
      setNewItemText('');
      refetch();
    } finally {
      setAdding(false);
    }
  }

  return (
    <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: '8px', padding: '20px' }}>
      <div style={{ fontWeight: 600, fontSize: '11px', color: '#8b949e', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '16px' }}>
        Containment Checklist
      </div>

      {/* Progress bar */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
          <span style={{ fontSize: '13px', color: '#8b949e' }}>
            {checkedCount}/{total} items completed
          </span>
          <span style={{ fontSize: '13px', fontWeight: 600, color: pct === 100 ? '#3fb950' : '#8b949e' }}>
            {pct}%
          </span>
        </div>
        <div style={{ background: '#21262d', borderRadius: '4px', height: '6px', overflow: 'hidden' }}>
          <div style={{
            width: `${pct}%`,
            height: '100%',
            background: pct === 100 ? '#3fb950' : pct > 0 ? '#3fb950aa' : '#3fb95033',
            transition: 'width 0.3s ease',
          }} />
        </div>
      </div>

      {/* Items list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '16px' }}>
        {(items ?? []).map((item) => (
          <div key={item.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '8px 10px', borderRadius: '6px', background: item.checked ? '#3fb95008' : '#0d1117', border: `1px solid ${item.checked ? '#3fb95022' : '#21262d'}` }}>
            <input
              type="checkbox"
              checked={item.checked}
              disabled={toggling === item.id}
              onChange={() => handleToggle(item)}
              style={{ marginTop: '2px', cursor: 'pointer', accentColor: '#3fb950', flexShrink: 0 }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: '13px',
                color: item.checked ? '#484f58' : '#e6edf3',
                textDecoration: item.checked ? 'line-through' : 'none',
                wordBreak: 'break-word',
              }}>
                {item.item_text}
              </div>
              {item.checked && item.checked_by_name && item.checked_at && (
                <div style={{ fontSize: '11px', color: '#484f58', marginTop: '2px' }}>
                  ✓ {item.checked_by_name} · {relativeTime(item.checked_at)}
                </div>
              )}
            </div>
            {item.is_custom && isSeniorAnalyst && (
              <button type="button"
                onClick={() => handleDelete(item.id)}
                title="Remove custom item"
                style={{ background: 'transparent', border: 'none', color: '#f85149', fontSize: '13px', cursor: 'pointer', padding: '0 2px', flexShrink: 0, lineHeight: 1 }}
              >
                ✕
              </button>
            )}
          </div>
        ))}
        {total === 0 && !isSeniorAnalyst && (
          <div style={{ color: '#8b949e', fontSize: '13px' }}>No checklist items for this entity type.</div>
        )}
      </div>

      {/* Add custom item */}
      {isSeniorAnalyst && (
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            type="text"
            placeholder="Add custom checklist item…"
            value={newItemText}
            onChange={(e) => setNewItemText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAddItem(); }}
            style={{ flex: 1, background: '#0d1117', border: '1px solid #30363d', borderRadius: '6px', padding: '6px 10px', color: '#e6edf3', fontSize: '13px', fontFamily: 'inherit' }}
          />
          <button type="button"
            onClick={handleAddItem}
            disabled={adding || !newItemText.trim()}
            style={{ background: '#238636', border: '1px solid #3fb95044', borderRadius: '6px', padding: '6px 14px', color: '#fff', fontSize: '13px', cursor: 'pointer', opacity: adding || !newItemText.trim() ? 0.5 : 1 }}
          >
            Add
          </button>
        </div>
      )}
    </div>
  );
}
