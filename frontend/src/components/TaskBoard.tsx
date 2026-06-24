import { useState, useEffect, useRef } from 'react';
import { apiClient } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { ROLE_RANK, ENTITY_TYPE_ICONS } from '../utils/constants';

export interface TaskEntity { id: string; type: string; value: string; }

export interface Task {
  id: string;
  incident_id: string;
  title: string;
  description?: string;
  assignee_id?: string;
  assignee_name?: string;
  assignee_email?: string;
  created_by: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  status: 'open' | 'in_progress' | 'complete';
  due_date?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
  entities?: TaskEntity[];
}

interface TeamMember { id: string; email: string; name: string; }

interface TaskBoardProps {
  incidentId: string;
  tasks: Task[];
  teamMembers?: TeamMember[];
  availableEntities?: TaskEntity[];
  onRefresh: () => void;
  highlightTaskId?: string;
}

const PRIORITY_COLORS: Record<string, string> = {
  critical: '#f85149', high: '#f0883e', medium: '#d29922', low: '#8b949e',
};

interface TaskCardProps {
  task: Task;
  teamMembers: TeamMember[];
  availableEntities: TaskEntity[];
  onRefresh: () => void;
  canManage: boolean;
  highlight?: boolean;
}

function EntityPicker({ entities, selected, onChange }: {
  entities: TaskEntity[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  return (
    <div style={{ border: '1px solid #30363d', borderRadius: '4px', background: '#0d1117', maxHeight: '120px', overflowY: 'auto', padding: '4px' }}>
      {entities.length === 0 && <div style={{ color: '#484f58', fontSize: '11px', padding: '4px' }}>No entities on this incident</div>}
      {entities.map((e) => {
        const checked = selected.includes(e.id);
        return (
          <label key={e.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '3px 4px', cursor: 'pointer', borderRadius: '3px', background: checked ? '#58a6ff11' : 'transparent' }}>
            <input type="checkbox" checked={checked} onChange={() => onChange(checked ? selected.filter((id) => id !== e.id) : [...selected, e.id])} />
            <span style={{ fontSize: '11px' }}>{ENTITY_TYPE_ICONS[e.type] ?? '•'}</span>
            <span style={{ fontSize: '11px', fontFamily: 'monospace', color: '#e6edf3' }}>{e.value}</span>
          </label>
        );
      })}
    </div>
  );
}

function TaskCard({ task, teamMembers, availableEntities, onRefresh, canManage, highlight }: TaskCardProps) {
  const [expanded, setExpanded] = useState(highlight ?? false);
  const cardRef = useRef<HTMLDivElement>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    title: task.title,
    description: task.description ?? '',
    assignee_id: task.assignee_id ?? '',
    priority: task.priority,
    status: task.status,
    due_date: task.due_date ?? '',
  });
  const [selectedEntityIds, setSelectedEntityIds] = useState<string[]>((task.entities ?? []).map((e) => e.id));
  const [comments, setComments] = useState<{id:string; user_email:string; user_name:string; content:string; created_at:string}[]>([]);
  const [commentText, setCommentText] = useState('');
  const [commentsLoaded, setCommentsLoaded] = useState(false);
  const isOverdue = task.due_date && task.status !== 'complete' && new Date(task.due_date) < new Date();

  async function loadComments() {
    const r = await apiClient.get(`/incidents/${task.incident_id}/tasks/${task.id}/comments`).catch(() => ({ data: [] }));
    setComments(r.data);
    setCommentsLoaded(true);
  }

  useEffect(() => {
    if (highlight) {
      setExpanded(true);
      loadComments();
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlight]);

  async function handleSave() {
    const payload: Record<string, unknown> = { title: form.title, priority: form.priority, status: form.status };
    if (form.description) payload.description = form.description;
    if (form.assignee_id) payload.assignee_id = form.assignee_id;
    if (form.due_date) payload.due_date = form.due_date;
    payload.entity_ids = selectedEntityIds;
    await apiClient.patch(`/incidents/${task.incident_id}/tasks/${task.id}`, payload).catch(() => {});
    setEditing(false);
    onRefresh();
  }

  async function handleStatusChange(status: string) {
    await apiClient.patch(`/incidents/${task.incident_id}/tasks/${task.id}`, { status }).catch(() => {});
    onRefresh();
  }

  async function handleDelete() {
    if (!confirm('Delete this task?')) return;
    await apiClient.delete(`/incidents/${task.incident_id}/tasks/${task.id}`).catch(() => {});
    onRefresh();
  }

  const inputStyle: React.CSSProperties = { background: '#0d1117', border: '1px solid #30363d', borderRadius: '4px', padding: '4px 8px', color: '#e6edf3', fontSize: '12px', outline: 'none', width: '100%', boxSizing: 'border-box' };

  return (
    <div ref={cardRef} style={{ background: highlight ? '#1c2128' : '#21262d', border: `1px solid ${highlight ? '#f97316' : '#30363d'}`, borderRadius: '6px', padding: '10px 12px', marginBottom: '8px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer' }} onClick={() => { const next = !expanded; setExpanded(next); if (next) loadComments(); }}>
        <span style={{ background: `${PRIORITY_COLORS[task.priority]}22`, color: PRIORITY_COLORS[task.priority], border: `1px solid ${PRIORITY_COLORS[task.priority]}44`, borderRadius: '4px', padding: '1px 6px', fontSize: '10px', fontWeight: 700, flexShrink: 0 }}>
          {task.priority.toUpperCase()}
        </span>
        <span style={{ color: '#e6edf3', fontSize: '13px', flex: 1 }}>{task.title}</span>
        <span style={{ color: '#484f58', fontSize: '11px' }}>{expanded ? '▲' : '▼'}</span>
      </div>

      {task.assignee_name && (
        <div style={{ color: '#8b949e', fontSize: '11px', marginTop: '4px' }}>👤 {task.assignee_name}</div>
      )}
      {!task.assignee_name && task.assignee_email && (
        <div style={{ color: '#8b949e', fontSize: '11px', marginTop: '4px' }}>👤 {task.assignee_email}</div>
      )}
      {task.due_date && (
        <div style={{ color: isOverdue ? '#f85149' : '#8b949e', fontSize: '11px' }}>
          📅 {new Date(task.due_date).toLocaleDateString()}{isOverdue ? ' OVERDUE' : ''}
        </div>
      )}

      {/* Entity chips */}
      {(task.entities ?? []).length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
          {(task.entities ?? []).map((e) => (
            <span key={e.id} style={{ background: '#0d1117', border: '1px solid #30363d', borderRadius: '4px', padding: '2px 6px', fontSize: '10px', color: '#8b949e', fontFamily: 'monospace' }}>
              {ENTITY_TYPE_ICONS[e.type] ?? '•'} {e.value}
            </span>
          ))}
        </div>
      )}

      {expanded && !editing && (
        <div style={{ marginTop: '8px', borderTop: '1px solid #30363d', paddingTop: '8px' }}>
          {task.description && <p style={{ color: '#8b949e', fontSize: '12px', margin: '0 0 8px' }}>{task.description}</p>}
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' as const }}>
            {(['open', 'in_progress', 'complete'] as const).map((s) => (
              <button key={s} onClick={() => handleStatusChange(s)} style={{ background: task.status === s ? '#58a6ff22' : 'transparent', border: `1px solid ${task.status === s ? '#58a6ff' : '#30363d'}`, borderRadius: '4px', padding: '3px 8px', color: task.status === s ? '#58a6ff' : '#8b949e', fontSize: '11px', cursor: 'pointer' }}>
                {s.replace(/_/g, ' ')}
              </button>
            ))}
            {canManage && <button onClick={() => { setSelectedEntityIds((task.entities ?? []).map((e) => e.id)); setEditing(true); }} style={{ background: 'transparent', border: '1px solid #30363d', borderRadius: '4px', padding: '3px 8px', color: '#8b949e', fontSize: '11px', cursor: 'pointer' }}>Edit</button>}
            {canManage && <button onClick={handleDelete} style={{ background: 'transparent', border: '1px solid #f8514944', borderRadius: '4px', padding: '3px 8px', color: '#f85149', fontSize: '11px', cursor: 'pointer' }}>Delete</button>}
          </div>
          {commentsLoaded && (
            <div style={{ marginTop: '10px', borderTop: '1px solid #21262d', paddingTop: '8px' }}>
              <div style={{ color: '#8b949e', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '6px' }}>
                Comments ({comments.length})
              </div>
              {comments.map(c => (
                <div key={c.id} style={{ marginBottom: '6px' }}>
                  <span style={{ color: '#58a6ff', fontSize: '11px', fontWeight: 600 }}>{c.user_name || c.user_email}</span>
                  <span style={{ color: '#484f58', fontSize: '10px', marginLeft: '6px' }}>{new Date(c.created_at).toLocaleString()}</span>
                  <div style={{ color: '#c9d1d9', fontSize: '12px', marginTop: '2px' }}>{c.content}</div>
                </div>
              ))}
              <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                <input
                  style={{ flex: 1, background: '#0d1117', border: '1px solid #30363d', borderRadius: '4px', padding: '4px 8px', color: '#e6edf3', fontSize: '12px', outline: 'none' }}
                  placeholder="Add a comment…"
                  value={commentText}
                  onChange={e => setCommentText(e.target.value)}
                  onKeyDown={async e => {
                    if (e.key === 'Enter' && commentText.trim()) {
                      await apiClient.post(`/incidents/${task.incident_id}/tasks/${task.id}/comments`, { content: commentText });
                      setCommentText('');
                      loadComments();
                    }
                  }}
                />
                <button
                  onClick={async () => {
                    if (!commentText.trim()) return;
                    await apiClient.post(`/incidents/${task.incident_id}/tasks/${task.id}/comments`, { content: commentText });
                    setCommentText('');
                    loadComments();
                  }}
                  style={{ background: '#21262d', border: '1px solid #30363d', borderRadius: '4px', padding: '4px 10px', color: '#8b949e', fontSize: '11px', cursor: 'pointer' }}
                >
                  Post
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {expanded && editing && (
        <div style={{ marginTop: '8px', borderTop: '1px solid #30363d', paddingTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <input style={inputStyle} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Title" />
          <textarea style={{ ...inputStyle, resize: 'vertical', minHeight: '50px' }} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Description" />
          <select style={inputStyle} value={form.assignee_id} onChange={(e) => setForm({ ...form, assignee_id: e.target.value })}>
            <option value="">Unassigned</option>
            {teamMembers.map((m) => <option key={m.id} value={m.id}>{m.name || m.email}</option>)}
          </select>
          <select style={inputStyle} value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as Task['priority'] })}>
            {['critical', 'high', 'medium', 'low'].map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <input style={inputStyle} type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
          <div>
            <div style={{ color: '#8b949e', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>Assign Entities to Investigate</div>
            <EntityPicker entities={availableEntities} selected={selectedEntityIds} onChange={setSelectedEntityIds} />
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button onClick={handleSave} style={{ background: '#238636', border: 'none', borderRadius: '4px', padding: '4px 10px', color: '#fff', fontSize: '12px', cursor: 'pointer' }}>Save</button>
            <button onClick={() => setEditing(false)} style={{ background: 'transparent', border: '1px solid #30363d', borderRadius: '4px', padding: '4px 10px', color: '#8b949e', fontSize: '12px', cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function TaskBoard({ incidentId, tasks, teamMembers = [], availableEntities = [], onRefresh, highlightTaskId }: TaskBoardProps) {
  const { user } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', assignee_id: '', priority: 'medium', due_date: '' });
  const [selectedEntityIds, setSelectedEntityIds] = useState<string[]>([]);
  const canManage = ROLE_RANK[user?.role ?? ''] >= ROLE_RANK['senior_analyst'];

  const columns: { key: Task['status']; label: string }[] = [
    { key: 'open', label: 'Open' },
    { key: 'in_progress', label: 'In Progress' },
    { key: 'complete', label: 'Complete' },
  ];

  async function handleCreate() {
    if (!form.title.trim()) return;
    const payload: Record<string, unknown> = { title: form.title, priority: form.priority };
    if (form.description) payload.description = form.description;
    if (form.assignee_id) payload.assignee_id = form.assignee_id;
    if (form.due_date) payload.due_date = form.due_date;
    if (selectedEntityIds.length) payload.entity_ids = selectedEntityIds;
    await apiClient.post(`/incidents/${incidentId}/tasks`, payload).catch(() => {});
    setForm({ title: '', description: '', assignee_id: '', priority: 'medium', due_date: '' });
    setSelectedEntityIds([]);
    setShowForm(false);
    onRefresh();
  }

  const inputStyle: React.CSSProperties = { background: '#0d1117', border: '1px solid #30363d', borderRadius: '4px', padding: '6px 8px', color: '#e6edf3', fontSize: '13px', outline: 'none', width: '100%', boxSizing: 'border-box' };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <span style={{ color: '#8b949e', fontSize: '13px' }}>{tasks.filter((t) => t.status === 'complete').length}/{tasks.length} tasks complete</span>
        {canManage && (
          <button onClick={() => setShowForm(!showForm)} style={{ background: '#238636', border: 'none', borderRadius: '6px', padding: '6px 14px', color: '#fff', fontSize: '13px', cursor: 'pointer' }}>
            + New Task
          </button>
        )}
      </div>

      {showForm && (
        <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: '8px', padding: '16px', marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <input style={inputStyle} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Task title" />
          <textarea style={{ ...inputStyle, resize: 'vertical', minHeight: '60px' }} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Description (optional)" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
            <select style={inputStyle} value={form.assignee_id} onChange={(e) => setForm({ ...form, assignee_id: e.target.value })}>
              <option value="">Unassigned</option>
              {teamMembers.map((m) => <option key={m.id} value={m.id}>{m.name || m.email}</option>)}
            </select>
            <select style={inputStyle} value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
              {['critical', 'high', 'medium', 'low'].map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            <input style={inputStyle} type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
          </div>
          <div>
            <div style={{ color: '#8b949e', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>Entities to Investigate (optional)</div>
            <EntityPicker entities={availableEntities} selected={selectedEntityIds} onChange={setSelectedEntityIds} />
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={handleCreate} style={{ background: '#238636', border: 'none', borderRadius: '6px', padding: '6px 14px', color: '#fff', fontSize: '13px', cursor: 'pointer' }}>Create</button>
            <button onClick={() => { setShowForm(false); setSelectedEntityIds([]); }} style={{ background: 'transparent', border: '1px solid #30363d', borderRadius: '6px', padding: '6px 14px', color: '#8b949e', fontSize: '13px', cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
        {columns.map(({ key, label }) => {
          const colTasks = tasks.filter((t) => t.status === key);
          return (
            <div key={key} style={{ background: '#0d1117', borderRadius: '8px', padding: '12px', minHeight: '200px' }}>
              <div style={{ fontWeight: 600, fontSize: '13px', color: '#8b949e', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {label} ({colTasks.length})
              </div>
              {colTasks.map((t) => (
                <TaskCard key={t.id} task={t} teamMembers={teamMembers} availableEntities={availableEntities} onRefresh={onRefresh} canManage={canManage} highlight={highlightTaskId === t.id} />
              ))}
              {colTasks.length === 0 && <div style={{ color: '#484f58', fontSize: '12px', textAlign: 'center', paddingTop: '20px' }}>No tasks</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
