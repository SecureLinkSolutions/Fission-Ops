import { useState, useRef } from 'react';
import { apiClient } from '../api/client';
import { useFetch } from '../hooks/useFetch';
import { useAuth } from '../context/AuthContext';
import { ROLE_RANK, ENTITY_TYPE_ICONS, ENTITY_TYPE_COLORS } from '../utils/constants';
import { relativeTime } from '../utils/time';
import { Entity } from '../types';

interface RemediationItem {
  id: string;
  incident_id: string;
  entity_id?: string;
  entity_value?: string;
  entity_type?: string;
  title: string;
  description?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'verified';
  assignee_id?: string;
  assignee_name?: string;
  before_state?: string;
  after_state?: string;
  completed_at?: string;
  verified_by?: string;
  verified_by_name?: string;
  verified_at?: string;
  created_by: string;
  created_by_name?: string;
  created_at: string;
  updated_at: string;
}

interface Props {
  incidentId: string;
  entities: Entity[];
  teamMembers: { id: string; email: string; name: string }[];
}

const COLUMNS: { key: RemediationItem['status']; label: string; color: string }[] = [
  { key: 'pending', label: 'Pending', color: '#8b949e' },
  { key: 'in_progress', label: 'In Progress', color: '#58a6ff' },
  { key: 'completed', label: 'Completed', color: '#d29922' },
  { key: 'verified', label: 'Verified', color: '#3fb950' },
];

const STATUS_ORDER: RemediationItem['status'][] = ['pending', 'in_progress', 'completed', 'verified'];

function InlineEdit({ value, onSave, placeholder }: { value?: string; onSave: (v: string) => void; placeholder: string }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? '');

  if (editing) {
    return (
      <textarea
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => { setEditing(false); onSave(draft); }}
        style={{
          width: '100%', background: '#0d1117', border: '1px solid #30363d', borderRadius: '4px',
          padding: '4px 6px', color: '#e6edf3', fontSize: '11px', resize: 'vertical', minHeight: '48px',
          fontFamily: 'monospace', boxSizing: 'border-box',
        }}
      />
    );
  }

  return (
    <div
      onClick={() => { setDraft(value ?? ''); setEditing(true); }}
      style={{ color: value ? '#c9d1d9' : '#484f58', fontSize: '11px', fontFamily: 'monospace', cursor: 'text', minHeight: '20px', padding: '2px 0' }}
    >
      {value || placeholder}
    </div>
  );
}

function RemediationCard({
  item,
  onRefresh,
  canVerify,
  onDragStart,
}: {
  item: RemediationItem;
  onRefresh: () => void;
  canVerify: boolean;
  onDragStart: (id: string) => void;
}) {
  const { user } = useAuth();
  const currentStatusIdx = STATUS_ORDER.indexOf(item.status);

  async function patchItem(data: Record<string, unknown>) {
    await apiClient.patch(`/incidents/${item.incident_id}/remediation/${item.id}`, data);
    onRefresh();
  }

  async function moveNext() {
    const next = STATUS_ORDER[currentStatusIdx + 1];
    if (!next) return;
    const data: Record<string, unknown> = { status: next };
    if (next === 'verified') {
      data.verified_by = user?.id;
      data.verified_by_name = user?.name ?? user?.email ?? '';
    }
    await patchItem(data);
  }

  async function movePrev() {
    const prev = STATUS_ORDER[currentStatusIdx - 1];
    if (!prev) return;
    await patchItem({ status: prev });
  }

  const col = COLUMNS.find((c) => c.key === item.status)!;

  return (
    <div
      draggable
      onDragStart={() => onDragStart(item.id)}
      style={{
        background: '#161b22', border: '1px solid #30363d', borderRadius: '8px',
        padding: '12px', marginBottom: '8px', cursor: 'grab',
      }}
    >
      <div style={{ fontWeight: 600, fontSize: '13px', color: '#e6edf3', marginBottom: '8px' }}>{item.title}</div>

      {item.entity_id && item.entity_type ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px', flexWrap: 'wrap' }}>
          <span style={{
            background: `${ENTITY_TYPE_COLORS[item.entity_type] ?? '#8b949e'}22`,
            color: ENTITY_TYPE_COLORS[item.entity_type] ?? '#8b949e',
            border: `1px solid ${ENTITY_TYPE_COLORS[item.entity_type] ?? '#8b949e'}44`,
            borderRadius: '4px', padding: '2px 6px', fontSize: '10px', fontWeight: 700,
            fontFamily: 'monospace', display: 'inline-flex', alignItems: 'center', gap: '4px',
          }}>
            <span>{ENTITY_TYPE_ICONS[item.entity_type] ?? '•'}</span>
            <span>{item.entity_value}</span>
          </span>
        </div>
      ) : (
        <div style={{ color: '#484f58', fontSize: '11px', marginBottom: '6px' }}>No entity linked</div>
      )}

      <div style={{ color: item.assignee_name ? '#8b949e' : '#484f58', fontSize: '11px', marginBottom: '8px' }}>
        {item.assignee_name ? `Assigned: ${item.assignee_name}` : 'Unassigned'}
      </div>

      <div style={{ marginBottom: '8px' }}>
        <div style={{ color: '#6e7681', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>Before State</div>
        <InlineEdit value={item.before_state} placeholder="Click to add before state…" onSave={(v) => patchItem({ before_state: v })} />
      </div>
      <div style={{ marginBottom: '8px' }}>
        <div style={{ color: '#6e7681', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>After State</div>
        <InlineEdit value={item.after_state} placeholder="Click to add after state…" onSave={(v) => patchItem({ after_state: v })} />
      </div>

      {(item.status === 'completed' || item.status === 'verified') && item.completed_at && (
        <div style={{ color: '#8b949e', fontSize: '11px', marginBottom: '4px' }}>
          Completed {relativeTime(item.completed_at)}
        </div>
      )}
      {item.status === 'verified' && item.verified_at && (
        <div style={{ color: '#3fb950', fontSize: '11px', marginBottom: '4px' }}>
          ✓ Verified by {item.verified_by_name ?? 'unknown'} · {relativeTime(item.verified_at)}
        </div>
      )}

      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '8px' }}>
        {currentStatusIdx > 0 && (
          <button type="button"
            onClick={movePrev}
            style={{ background: '#21262d', border: '1px solid #30363d', borderRadius: '4px', padding: '3px 8px', color: '#8b949e', fontSize: '11px', cursor: 'pointer' }}
          >
            ← Back
          </button>
        )}
        {currentStatusIdx < STATUS_ORDER.length - 1 && item.status !== 'completed' && (
          <button type="button"
            onClick={moveNext}
            style={{ background: `${col.color}22`, border: `1px solid ${col.color}44`, borderRadius: '4px', padding: '3px 8px', color: col.color, fontSize: '11px', cursor: 'pointer', fontWeight: 600 }}
          >
            → {COLUMNS[currentStatusIdx + 1]?.label}
          </button>
        )}
        {item.status === 'completed' && canVerify && (
          <button type="button"
            onClick={moveNext}
            style={{ background: '#3fb95022', border: '1px solid #3fb95044', borderRadius: '4px', padding: '3px 8px', color: '#3fb950', fontSize: '11px', cursor: 'pointer', fontWeight: 600 }}
          >
            ✓ Verify
          </button>
        )}
        {item.status === 'completed' && !canVerify && (
          <span style={{ color: '#484f58', fontSize: '11px' }}>Awaiting verification</span>
        )}
      </div>
    </div>
  );
}

export default function RemediationBoard({ incidentId, entities, teamMembers }: Props) {
  const { user } = useAuth();
  const canCreate = ROLE_RANK[user?.role ?? ''] >= ROLE_RANK['senior_analyst'];
  const canVerify = ROLE_RANK[user?.role ?? ''] >= ROLE_RANK['incident_commander'];

  const { data: items, refetch } = useFetch<RemediationItem[]>(
    () => apiClient.get(`/incidents/${incidentId}/remediation`).then((r) => r.data),
    [incidentId],
  );

  const dragItemId = useRef<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);

  async function handleDrop(targetStatus: RemediationItem['status']) {
    const id = dragItemId.current;
    if (!id) return;
    const item = (items ?? []).find((i) => i.id === id);
    if (!item || item.status === targetStatus) return;
    const data: Record<string, unknown> = { status: targetStatus };
    if (targetStatus === 'verified') {
      data.verified_by = user?.id;
      data.verified_by_name = user?.name ?? user?.email ?? '';
    }
    await apiClient.patch(`/incidents/${incidentId}/remediation/${id}`, data);
    refetch();
  }

  const [showForm, setShowForm] = useState(false);
  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formEntity, setFormEntity] = useState('');
  const [formAssignee, setFormAssignee] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!formTitle.trim()) return;
    setSubmitting(true);
    try {
      const assignee = teamMembers.find((m) => m.id === formAssignee);
      await apiClient.post(`/incidents/${incidentId}/remediation`, {
        title: formTitle.trim(),
        description: formDesc.trim() || undefined,
        entity_id: formEntity || undefined,
        assignee_id: assignee?.id,
        assignee_name: assignee?.name ?? assignee?.email,
      });
      setFormTitle('');
      setFormDesc('');
      setFormEntity('');
      setFormAssignee('');
      setShowForm(false);
      refetch();
    } finally {
      setSubmitting(false);
    }
  }

  const columnItems = (status: RemediationItem['status']) =>
    (items ?? []).filter((i) => i.status === status);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div style={{ fontWeight: 600, fontSize: '15px', color: '#e6edf3' }}>Remediation Tracking</div>
        {canCreate && !showForm && (
          <button type="button"
            onClick={() => setShowForm(true)}
            style={{ background: '#21262d', border: '1px solid #30363d', borderRadius: '6px', padding: '6px 14px', color: '#58a6ff', fontSize: '13px', cursor: 'pointer', fontWeight: 600 }}
          >
            + Add Remediation Item
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleCreate} style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: '8px', padding: '16px', marginBottom: '20px' }}>
          <div style={{ fontWeight: 600, fontSize: '13px', color: '#e6edf3', marginBottom: '12px' }}>New Remediation Item</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <input
              required
              placeholder="Title *"
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              style={{ background: '#0d1117', border: '1px solid #30363d', borderRadius: '6px', padding: '7px 10px', color: '#e6edf3', fontSize: '13px' }}
            />
            <textarea
              placeholder="Description (optional)"
              value={formDesc}
              onChange={(e) => setFormDesc(e.target.value)}
              rows={2}
              style={{ background: '#0d1117', border: '1px solid #30363d', borderRadius: '6px', padding: '7px 10px', color: '#e6edf3', fontSize: '13px', resize: 'vertical' }}
            />
            <select
              value={formEntity}
              onChange={(e) => setFormEntity(e.target.value)}
              style={{ background: '#0d1117', border: '1px solid #30363d', borderRadius: '6px', padding: '7px 10px', color: '#e6edf3', fontSize: '13px' }}
            >
              <option value="">No entity linked</option>
              {entities.map((e) => (
                <option key={e.id} value={e.id}>{ENTITY_TYPE_ICONS[e.type] ?? '•'} {e.value}</option>
              ))}
            </select>
            <select
              value={formAssignee}
              onChange={(e) => setFormAssignee(e.target.value)}
              style={{ background: '#0d1117', border: '1px solid #30363d', borderRadius: '6px', padding: '7px 10px', color: '#e6edf3', fontSize: '13px' }}
            >
              <option value="">Unassigned</option>
              {teamMembers.map((m) => (
                <option key={m.id} value={m.id}>{m.name ?? m.email}</option>
              ))}
            </select>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="button"
               type="button"
                type="submit"
                disabled={submitting}
                style={{ background: '#238636', border: '1px solid #2ea043', borderRadius: '6px', padding: '7px 16px', color: '#fff', fontSize: '13px', cursor: 'pointer', fontWeight: 600 }}
              >
                {submitting ? 'Creating…' : 'Create Item'}
              </button>
              <button type="button"
               type="button"
                type="button"
                onClick={() => setShowForm(false)}
                style={{ background: 'transparent', border: '1px solid #30363d', borderRadius: '6px', padding: '7px 12px', color: '#8b949e', fontSize: '13px', cursor: 'pointer' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </form>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
        {COLUMNS.map((col) => {
          const colItems = columnItems(col.key);
          const isOver = dragOverCol === col.key;
          return (
            <div
              key={col.key}
              onDragOver={(e) => { e.preventDefault(); setDragOverCol(col.key); }}
              onDragLeave={() => setDragOverCol(null)}
              onDrop={() => { setDragOverCol(null); handleDrop(col.key); }}
              style={{
                background: isOver ? '#1c2128' : '#0d1117',
                border: `1px solid ${isOver ? col.color : '#30363d'}`,
                borderRadius: '8px', padding: '12px',
                transition: 'border-color 0.15s, background 0.15s',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: col.color }} />
                <span style={{ fontWeight: 600, fontSize: '13px', color: col.color }}>{col.label}</span>
                <span style={{ marginLeft: 'auto', background: '#21262d', color: '#8b949e', borderRadius: '10px', padding: '1px 7px', fontSize: '11px' }}>{colItems.length}</span>
              </div>
              {colItems.length === 0 ? (
                <div style={{ color: '#484f58', fontSize: '12px', textAlign: 'center', padding: '16px 0' }}>
                  {isOver ? 'Drop here' : 'No items'}
                </div>
              ) : (
                colItems.map((item) => (
                  <RemediationCard
                    key={item.id}
                    item={item}
                    onRefresh={refetch}
                    canVerify={canVerify}
                    onDragStart={(id) => { dragItemId.current = id; }}
                  />
                ))
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
