import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { TabletopExercise } from '../types';

const STATUS_COLORS: Record<string, string> = {
  draft: '#8b949e',
  ready: '#58a6ff',
  active: '#3fb950',
  completed: '#a371f7',
  archived: '#484f58',
};

const STATUS_TABS = ['All', 'Draft', 'Ready', 'Active', 'Completed'] as const;

const ROLE_RANK: Record<string, number> = {
  analyst: 1,
  senior_analyst: 2,
  incident_commander: 3,
  platform_admin: 99,
};

export default function TabletopExercises() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [exercises, setExercises] = useState<TabletopExercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>('All');
  const [showModal, setShowModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: '',
    description: '',
    scenario: '',
    objectives: '',
    scheduled_at: '',
    duration_minutes: 0,
  });

  const canCreate = ROLE_RANK[user?.role ?? 'analyst'] >= ROLE_RANK['senior_analyst'];

  useEffect(() => {
    apiClient.get<TabletopExercise[]>('/tabletop/exercises')
      .then(r => setExercises(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = activeTab === 'All'
    ? exercises
    : exercises.filter(e => e.status === activeTab.toLowerCase());

  async function handleDelete(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    if (!confirm('Delete this exercise? This cannot be undone.')) return;
    setDeletingId(id);
    try {
      await apiClient.delete(`/tabletop/exercises/${id}`);
      setExercises(prev => prev.filter(ex => ex.id !== id));
    } catch { alert('Failed to delete exercise.'); }
    finally { setDeletingId(null); }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await apiClient.post<TabletopExercise>('/tabletop/exercises', {
        ...form,
        duration_minutes: form.duration_minutes > 0 ? form.duration_minutes : undefined,
        scheduled_at: form.scheduled_at || undefined,
      });
      navigate(`/tabletop/${res.data.id}`);
    } catch {
      setCreating(false);
    }
  }

  if (loading) {
    return (
      <div style={{ padding: '32px', color: '#8b949e', background: '#0d1117', minHeight: '100vh' }}>
        Loading exercises…
      </div>
    );
  }

  return (
    <div style={{ padding: '32px', background: '#0d1117', minHeight: '100vh', color: '#e6edf3' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 700 }}>🎯 Tabletop Exercises</h1>
          <p style={{ margin: '4px 0 0', color: '#8b949e', fontSize: '13px' }}>
            Build and run IR tabletop exercises for your team
          </p>
        </div>
        {canCreate && (
          <button
            onClick={() => setShowModal(true)}
            style={{
              background: '#238636',
              border: '1px solid #2ea043',
              color: '#e6edf3',
              padding: '8px 16px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 600,
            }}
          >
            + New Exercise
          </button>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', borderBottom: '1px solid #30363d', paddingBottom: '0' }}>
        {STATUS_TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              background: 'transparent',
              border: 'none',
              color: activeTab === tab ? '#e6edf3' : '#8b949e',
              padding: '8px 16px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: activeTab === tab ? 600 : 400,
              borderBottom: activeTab === tab ? '2px solid #58a6ff' : '2px solid transparent',
              marginBottom: '-1px',
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Exercise cards */}
      {filtered.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '60px 20px',
          color: '#8b949e',
          background: '#161b22',
          borderRadius: '8px',
          border: '1px solid #30363d',
        }}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>🎯</div>
          <div style={{ fontSize: '16px', fontWeight: 600, color: '#e6edf3', marginBottom: '8px' }}>No exercises yet</div>
          <div style={{ fontSize: '13px', marginBottom: '20px' }}>Create your first tabletop exercise to get started</div>
          {canCreate && (
            <button
              onClick={() => setShowModal(true)}
              style={{
                background: '#238636',
                border: '1px solid #2ea043',
                color: '#e6edf3',
                padding: '8px 20px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '13px',
              }}
            >
              + New Exercise
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '12px' }}>
          {filtered.map(ex => (
            <div
              key={ex.id}
              onClick={() => navigate(`/tabletop/${ex.id}`)}
              style={{
                background: '#161b22',
                border: '1px solid #30363d',
                borderRadius: '8px',
                padding: '16px 20px',
                cursor: 'pointer',
                transition: 'border-color 0.15s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = '#58a6ff44'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = '#30363d'; }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                    <span style={{ fontWeight: 600, fontSize: '15px', color: '#e6edf3' }}>{ex.title}</span>
                    <span style={{
                      background: STATUS_COLORS[ex.status] + '22',
                      color: STATUS_COLORS[ex.status],
                      border: `1px solid ${STATUS_COLORS[ex.status]}44`,
                      borderRadius: '12px',
                      padding: '1px 8px',
                      fontSize: '11px',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      flexShrink: 0,
                    }}>
                      {ex.status}
                    </span>
                  </div>
                  <p style={{ margin: '0 0 8px', color: '#8b949e', fontSize: '13px', lineHeight: 1.5 }}>
                    {ex.scenario.length > 100 ? ex.scenario.substring(0, 100) + '…' : ex.scenario}
                  </p>
                  <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: '#484f58' }}>
                    <span>📌 {ex.inject_count ?? 0} injects</span>
                    {ex.duration_minutes ? <span>⏱ {ex.duration_minutes >= 1440 ? `${Math.round(ex.duration_minutes / 1440)}d` : ex.duration_minutes >= 60 ? `${Math.round(ex.duration_minutes / 60)}h` : `${ex.duration_minutes}m`}</span> : null}
                    {ex.scheduled_at && (
                      <span>📅 {new Date(ex.scheduled_at).toLocaleDateString()}</span>
                    )}
                    <span>{new Date(ex.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
                {ROLE_RANK[user?.role ?? 'analyst'] >= ROLE_RANK['incident_commander'] && (
                  <button
                    onClick={(e) => handleDelete(e, ex.id)}
                    disabled={deletingId === ex.id}
                    style={{ background: '#f8514922', border: '1px solid #f8514944', borderRadius: '6px', padding: '5px 12px', color: '#f85149', fontSize: '12px', cursor: 'pointer', flexShrink: 0, alignSelf: 'center' }}
                  >
                    {deletingId === ex.id ? 'Deleting…' : 'Delete'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create modal */}
      {showModal && (
        <div style={{
          position: 'fixed', inset: 0, background: '#00000088', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            background: '#161b22',
            border: '1px solid #30363d',
            borderRadius: '10px',
            width: '580px',
            maxHeight: '85vh',
            overflowY: 'auto',
            padding: '24px',
          }}>
            <h2 style={{ margin: '0 0 20px', fontSize: '16px', fontWeight: 600 }}>New Tabletop Exercise</h2>
            <form onSubmit={handleCreate}>
              {[
                { label: 'Title', key: 'title', type: 'text', required: true },
                { label: 'Description', key: 'description', type: 'textarea' },
                { label: 'Scenario', key: 'scenario', type: 'textarea', required: true },
                { label: 'Objectives', key: 'objectives', type: 'textarea' },
              ].map(({ label, key, type, required }) => (
                <div key={key} style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'block', fontSize: '12px', color: '#8b949e', marginBottom: '4px' }}>
                    {label}{required && ' *'}
                  </label>
                  {type === 'textarea' ? (
                    <textarea
                      value={(form as Record<string, string | number>)[key] as string}
                      onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                      required={required}
                      rows={3}
                      style={{
                        width: '100%', boxSizing: 'border-box',
                        background: '#0d1117', border: '1px solid #30363d',
                        borderRadius: '6px', padding: '8px 10px',
                        color: '#e6edf3', fontSize: '13px',
                        resize: 'vertical', outline: 'none',
                      }}
                    />
                  ) : (
                    <input
                      type="text"
                      value={(form as Record<string, string | number>)[key] as string}
                      onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                      required={required}
                      style={{
                        width: '100%', boxSizing: 'border-box',
                        background: '#0d1117', border: '1px solid #30363d',
                        borderRadius: '6px', padding: '8px 10px',
                        color: '#e6edf3', fontSize: '13px', outline: 'none',
                      }}
                    />
                  )}
                </div>
              ))}
              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '12px', color: '#8b949e', marginBottom: '4px' }}>Scheduled Date</label>
                  <input
                    type="datetime-local"
                    value={form.scheduled_at}
                    onChange={e => setForm(f => ({ ...f, scheduled_at: e.target.value }))}
                    style={{
                      width: '100%', boxSizing: 'border-box',
                      background: '#0d1117', border: '1px solid #30363d',
                      borderRadius: '6px', padding: '8px 10px',
                      color: '#e6edf3', fontSize: '13px', outline: 'none',
                    }}
                  />
                </div>
                <div style={{ width: '150px' }}>
                  <label style={{ display: 'block', fontSize: '12px', color: '#8b949e', marginBottom: '4px' }}>Duration (mins, optional)</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="e.g. 480"
                    value={form.duration_minutes || ''}
                    onChange={e => setForm(f => ({ ...f, duration_minutes: Number(e.target.value) }))}
                    style={{
                      width: '100%', boxSizing: 'border-box',
                      background: '#0d1117', border: '1px solid #30363d',
                      borderRadius: '6px', padding: '8px 10px',
                      color: '#e6edf3', fontSize: '13px', outline: 'none',
                    }}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px' }}>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  style={{
                    background: 'transparent', border: '1px solid #30363d',
                    color: '#8b949e', padding: '8px 16px',
                    borderRadius: '6px', cursor: 'pointer', fontSize: '13px',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  style={{
                    background: '#238636', border: '1px solid #2ea043',
                    color: '#e6edf3', padding: '8px 16px',
                    borderRadius: '6px', cursor: 'pointer', fontSize: '13px',
                    opacity: creating ? 0.6 : 1,
                  }}
                >
                  {creating ? 'Creating…' : 'Create Exercise'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
