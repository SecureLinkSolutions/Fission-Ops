import { Link } from 'react-router-dom';
import { useFetch } from '../hooks/useFetch';
import { apiClient } from '../api/client';

interface Task {
  id: string;
  incident_id: string;
  incident_title?: string;
  title: string;
  description?: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  status: 'open' | 'in_progress' | 'complete';
  due_date?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
}

const PRIORITY_COLORS: Record<string, string> = {
  critical: '#f85149',
  high: '#f0883e',
  medium: '#d29922',
  low: '#8b949e',
};

const STATUS_COLORS: Record<string, string> = {
  open: '#58a6ff',
  in_progress: '#d29922',
  complete: '#3fb950',
};

export default function MyTasks() {
  const { data: tasks, loading } = useFetch<Task[]>(
    () => apiClient.get('/tasks/mine').then((r) => r.data),
    [],
  );

  if (loading) return <div style={{ padding: '32px', color: '#8b949e' }}>Loading tasks…</div>;

  const grouped = (tasks ?? []).reduce<Record<string, Task[]>>((acc, t) => {
    const key = t.incident_id;
    if (!acc[key]) acc[key] = [];
    acc[key].push(t);
    return acc;
  }, {});

  return (
    <div style={{ padding: '32px', maxWidth: '900px', margin: '0 auto' }}>
      <div style={{ fontSize: '22px', fontWeight: 700, color: '#e6edf3', marginBottom: '8px' }}>My Tasks</div>
      <div style={{ color: '#8b949e', fontSize: '13px', marginBottom: '28px' }}>
        {(tasks ?? []).filter((t) => t.status !== 'complete').length} open tasks across {Object.keys(grouped).length} incidents
      </div>

      {Object.keys(grouped).length === 0 && (
        <div style={{ color: '#8b949e', fontSize: '14px' }}>No tasks assigned to you.</div>
      )}

      {Object.entries(grouped).map(([incidentId, incidentTasks]) => (
        <div key={incidentId} style={{ marginBottom: '28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <Link to={`/incidents/${incidentId}`} style={{ color: '#58a6ff', textDecoration: 'none', fontWeight: 600, fontSize: '14px' }}>
              {incidentTasks[0].incident_title ?? `Incident ${incidentId.slice(0, 8)}`}
            </Link>
            <span style={{ color: '#8b949e', fontSize: '12px' }}>
              {incidentTasks.filter((t) => t.status === 'complete').length}/{incidentTasks.length} complete
            </span>
          </div>

          {incidentTasks.map((task) => {
            const isOverdue = task.due_date && task.status !== 'complete' && new Date(task.due_date) < new Date();
            return (
              <div key={task.id} style={{ background: '#161b22', border: `1px solid ${isOverdue ? '#f8514944' : '#30363d'}`, borderRadius: '8px', padding: '12px 16px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ background: `${PRIORITY_COLORS[task.priority]}22`, color: PRIORITY_COLORS[task.priority], border: `1px solid ${PRIORITY_COLORS[task.priority]}44`, borderRadius: '4px', padding: '2px 8px', fontSize: '10px', fontWeight: 700, flexShrink: 0 }}>
                  {task.priority.toUpperCase()}
                </span>
                <span style={{ color: task.status === 'complete' ? '#8b949e' : '#e6edf3', fontSize: '14px', flex: 1, textDecoration: task.status === 'complete' ? 'line-through' : 'none' }}>
                  {task.title}
                </span>
                <span style={{ background: `${STATUS_COLORS[task.status]}22`, color: STATUS_COLORS[task.status], border: `1px solid ${STATUS_COLORS[task.status]}44`, borderRadius: '4px', padding: '2px 8px', fontSize: '11px', fontWeight: 600, flexShrink: 0 }}>
                  {task.status.replace(/_/g, ' ')}
                </span>
                {task.due_date && (
                  <span style={{ color: isOverdue ? '#f85149' : '#8b949e', fontSize: '12px', flexShrink: 0 }}>
                    Due {new Date(task.due_date).toLocaleDateString()}{isOverdue ? ' — OVERDUE' : ''}
                  </span>
                )}
                <Link
                  to={`/incidents/${task.incident_id}?tab=tasks&task=${task.id}`}
                  style={{ background: '#21262d', border: '1px solid #30363d', borderRadius: '4px', padding: '3px 10px', color: '#58a6ff', fontSize: '12px', fontWeight: 600, textDecoration: 'none', flexShrink: 0 }}
                >
                  Open →
                </Link>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
