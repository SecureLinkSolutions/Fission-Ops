import { useState } from 'react';
import { apiClient } from '../api/client';
import { useAuth } from '../context/AuthContext';

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
}

interface TeamMember {
  id: string;
  email: string;
  name: string;
}

interface TaskBoardProps {
  incidentId: string;
  tasks: Task[];
  teamMembers?: TeamMember[];
  onRefresh: () => void;
}

const PRIORITY_COLORS: Record<string, string> = {
  critical: '#f85149',
  high: '#f0883e',
  medium: '#d29922',
  low: '#8b949e',
};

const ROLE_RANK: Record<string, number> = { analyst: 1, senior_analyst: 2, incident_commander: 3, super_admin: 99 };

interface TaskCardProps {
  task: Task;
  teamMembers: TeamMember[];
  onRefresh: () => void;
  canManage: boolean;
}

function TaskCard({ task, teamMembers, onRefresh, canManage }: TaskCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ title: task.title, description: task.description ?? '', assignee_id: task.assignee_id ?? '', priority: task.priority, status: task.status, due_date: task.due_date ?? '' });
  const isOverdue = task.due_date && task.status !== 'complete' && new Date(task.due_date) < new Date();

  async function handleSave() {
    const payload: Record<string, unknown> = { title: form.title, priority: form.priority, status: form.status };
    if (form.description) payload.description = form.description;
    if (form.assignee_id) payload.assignee_id = form.assignee_id;
    if (form.due_date) payload.due_date = form.due_date;
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
    <div style={{ background: '#21262d', border: '1px solid #30363d', borderRadius: '6px', padding: '10px 12px', marginBottom: '8px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer' }} onClick={() => setExpanded(!expanded)}>
        <span style={{ background: `${PRIORITY_COLORS[task.priority]}22`, color: PRIORITY_COLORS[task.priority], border: `1px solid ${PRIORITY_COLORS[task.priority]}44`, borderRadius: '4px', padding: '1px 6px', fontSize: '10px', fontWeight: 700, flexShrink: 0 }}>
          {task.priority.toUpperCase()}
        </span>
        <span style={{ color: '#e6edf3', fontSize: '13px', flex: 1 }}>{task.title}</span>
        <span style={{ color: '#484f58', fontSize: '11px' }}>{expanded ? '▲' : '▼'}</span>
      </div>

      {task.assignee_name && (
        <div style={{ color: '#8b949e', fontSize: '11px', marginTop: '4px' }}>
          👤 {task.assignee_name}
        </div>
      )}
      {task.due_date && (
        <div style={{ color: isOverdue ? '#f85149' : '#8b949e', fontSize: '11px' }}>
          📅 {new Date(task.due_date).toLocaleDateString()}{isOverdue ? ' OVERDUE' : ''}
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
            {canManage && <button onClick={() => setEditing(true)} style={{ background: 'transparent', border: '1px solid #30363d', borderRadius: '4px', padding: '3px 8px', color: '#8b949e', fontSize: '11px', cursor: 'pointer' }}>Edit</button>}
            {canManage && <button onClick={handleDelete} style={{ background: 'transparent', border: '1px solid #f8514944', borderRadius: '4px', padding: '3px 8px', color: '#f85149', fontSize: '11px', cursor: 'pointer' }}>Delete</button>}
          </div>
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
          <div style={{ display: 'flex', gap: '6px' }}>
            <button onClick={handleSave} style={{ background: '#238636', border: 'none', borderRadius: '4px', padding: '4px 10px', color: '#fff', fontSize: '12px', cursor: 'pointer' }}>Save</button>
            <button onClick={() => setEditing(false)} style={{ background: 'transparent', border: '1px solid #30363d', borderRadius: '4px', padding: '4px 10px', color: '#8b949e', fontSize: '12px', cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function TaskBoard({ incidentId, tasks, teamMembers = [], onRefresh }: TaskBoardProps) {
  const { user } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', assignee_id: '', priority: 'medium', due_date: '' });
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
    await apiClient.post(`/incidents/${incidentId}/tasks`, payload).catch(() => {});
    setForm({ title: '', description: '', assignee_id: '', priority: 'medium', due_date: '' });
    setShowForm(false);
    onRefresh();
  }

  const inputStyle: React.CSSProperties = { background: '#0d1117', border: '1px solid #30363d', borderRadius: '4px', padding: '6px 8px', color: '#e6edf3', fontSize: '13px', outline: 'none', width: '100%', boxSizing: 'border-box' };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <span style={{ color: '#8b949e', fontSize: '13px' }}>{tasks.filter((t) => t.status === 'complete').length}/{tasks.length} tasks complete</span>
        {canManage && (
          <button
            onClick={() => setShowForm(!showForm)}
            style={{ background: '#238636', border: 'none', borderRadius: '6px', padding: '6px 14px', color: '#fff', fontSize: '13px', cursor: 'pointer' }}
          >
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
            <input style={inputStyle} type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} placeholder="Due date" />
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={handleCreate} style={{ background: '#238636', border: 'none', borderRadius: '6px', padding: '6px 14px', color: '#fff', fontSize: '13px', cursor: 'pointer' }}>Create</button>
            <button onClick={() => setShowForm(false)} style={{ background: 'transparent', border: '1px solid #30363d', borderRadius: '6px', padding: '6px 14px', color: '#8b949e', fontSize: '13px', cursor: 'pointer' }}>Cancel</button>
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
                <TaskCard key={t.id} task={t} teamMembers={teamMembers} onRefresh={onRefresh} canManage={canManage} />
              ))}
              {colTasks.length === 0 && <div style={{ color: '#484f58', fontSize: '12px', textAlign: 'center', paddingTop: '20px' }}>No tasks</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
