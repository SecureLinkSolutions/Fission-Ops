import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import { apiClient } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { TabletopExercise, ExerciseSession, ExerciseInjectResponse, ExerciseAAR, ExerciseParticipant, SessionInjectRelease, ManagedUser, Incident } from '../types';

const SOCKET_URL = (() => {
  const base = import.meta.env.VITE_API_URL || '/api/v1';
  return base.replace(/\/api\/v1\/?$/, '');
})();

const STATUS_COLORS: Record<string, string> = {
  draft: '#8b949e',
  ready: '#58a6ff',
  active: '#3fb950',
  completed: '#a371f7',
  archived: '#484f58',
};

const INJECT_TYPE_COLORS: Record<string, string> = {
  information: '#58a6ff',
  decision: '#e3b341',
  complication: '#f0883e',
  escalation: '#f85149',
  resolution: '#3fb950',
};

const ROLE_RANK: Record<string, number> = {
  analyst: 1,
  senior_analyst: 2,
  incident_commander: 3,
  platform_admin: 99,
};

const SCENARIO_TYPES = [
  { value: 'ransomware', label: 'Ransomware' },
  { value: 'phishing', label: 'Phishing' },
  { value: 'insider_threat', label: 'Insider Threat' },
  { value: 'supply_chain', label: 'Supply Chain' },
  { value: 'ddos', label: 'DDoS' },
  { value: 'data_breach', label: 'Data Breach' },
  { value: 'apt', label: 'APT' },
];

interface InjectFormData {
  title: string;
  description: string;
  inject_type: string;
  trigger_minutes: string;
  expected_actions: string;
  discussion_prompts: string;
}

const emptyInjectForm: InjectFormData = {
  title: '',
  description: '',
  inject_type: 'information',
  trigger_minutes: '',
  expected_actions: '',
  discussion_prompts: '',
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span style={{
      background: (STATUS_COLORS[status] ?? '#8b949e') + '22',
      color: STATUS_COLORS[status] ?? '#8b949e',
      border: `1px solid ${(STATUS_COLORS[status] ?? '#8b949e')}44`,
      borderRadius: '12px',
      padding: '2px 10px',
      fontSize: '11px',
      fontWeight: 600,
      textTransform: 'uppercase' as const,
      letterSpacing: '0.04em',
    }}>
      {status}
    </span>
  );
}

function InjectTypeBadge({ type }: { type: string }) {
  return (
    <span style={{
      background: (INJECT_TYPE_COLORS[type] ?? '#8b949e') + '22',
      color: INJECT_TYPE_COLORS[type] ?? '#8b949e',
      border: `1px solid ${(INJECT_TYPE_COLORS[type] ?? '#8b949e')}44`,
      borderRadius: '10px',
      padding: '1px 8px',
      fontSize: '11px',
      fontWeight: 600,
    }}>
      {type}
    </span>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  background: '#0d1117',
  border: '1px solid #30363d',
  borderRadius: '6px',
  padding: '8px 10px',
  color: '#e6edf3',
  fontSize: '13px',
  outline: 'none',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '12px',
  color: '#8b949e',
  marginBottom: '4px',
};

export default function TabletopDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [exercise, setExercise] = useState<TabletopExercise | null>(null);
  const [session, setSession] = useState<ExerciseSession | null>(null);
  const [aar, setAAR] = useState<ExerciseAAR | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'Build' | 'Run'>('Build');

  // Scenario edit state
  const [editingScenario, setEditingScenario] = useState(false);
  const [scenarioForm, setScenarioForm] = useState({ title: '', scenario: '', objectives: '' });
  const [savingScenario, setSavingScenario] = useState(false);

  // Inject form state
  const [showInjectForm, setShowInjectForm] = useState(false);
  const [injectForm, setInjectForm] = useState<InjectFormData>(emptyInjectForm);
  const [editingInjectId, setEditingInjectId] = useState<string | null>(null);
  const [savingInject, setSavingInject] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generatingStep, setGeneratingStep] = useState('');
  const [showScenarioDropdown, setShowScenarioDropdown] = useState(false);

  // Run tab state
  const [expandedInjects, setExpandedInjects] = useState<Set<string>>(new Set());
  const [responses, setResponses] = useState<Map<string, { response_text: string; gaps_identified: string }>>(new Map());
  const [savedResponses, setSavedResponses] = useState<Map<string, ExerciseInjectResponse>>(new Map());
  const [sessionNotes, setSessionNotes] = useState('');
  const [completing, setCompleting] = useState(false);
  const [releases, setReleases] = useState<Map<string, SessionInjectRelease>>(new Map());
  const [sessionCompleted, setSessionCompleted] = useState(false);

  // AAR state
  const [aarForm, setAARForm] = useState({
    strengths: '',
    weaknesses: '',
    gaps: '',
    recommendations: '',
    overall_rating: 0,
  });
  const [savingAAR, setSavingAAR] = useState(false);
  const [editingAAR, setEditingAAR] = useState(false);

  // Participants state
  const [participants, setParticipants] = useState<ExerciseParticipant[]>([]);
  const [orgUsers, setOrgUsers] = useState<ManagedUser[]>([]);
  const [loadingParticipants, setLoadingParticipants] = useState(false);

  // Incident linking state
  const [orgIncidents, setOrgIncidents] = useState<Incident[]>([]);
  const [addParticipantId, setAddParticipantId] = useState('');

  const socketRef = useRef<Socket | null>(null);

  const canEdit = ROLE_RANK[user?.role ?? 'analyst'] >= ROLE_RANK['senior_analyst'];
  const canCommand = ROLE_RANK[user?.role ?? 'analyst'] >= ROLE_RANK['incident_commander'];

  const loadExercise = useCallback(async () => {
    if (!id) return;
    try {
      const res = await apiClient.get<TabletopExercise>(`/tabletop/exercises/${id}`);
      setExercise(res.data);

      // Try to find an active/latest session
      try {
        const sessions = await apiClient.get<ExerciseSession[]>(`/tabletop/exercises/${id}/sessions`).catch(() => null);
        if (sessions && sessions.data && sessions.data.length > 0) {
          const latest = sessions.data[0];
          // Fetch full session with releases
          const fullSession = await apiClient.get<ExerciseSession>(`/tabletop/sessions/${latest.id}`).catch(() => null);
          const sessionData = fullSession?.data ?? latest;
          setSession(sessionData);
          if (sessionData.responses) {
            const map = new Map<string, ExerciseInjectResponse>();
            for (const r of sessionData.responses) {
              map.set(r.inject_id, r);
            }
            setSavedResponses(map);
          }
          if (sessionData.releases) {
            const rmap = new Map<string, SessionInjectRelease>();
            for (const r of sessionData.releases) {
              rmap.set(r.inject_id, r);
            }
            setReleases(rmap);
          }
          setSessionNotes(latest.participant_notes ?? '');
          if (latest.status === 'completed') {
            try {
              const aarRes = await apiClient.get<ExerciseAAR>(`/tabletop/sessions/${latest.id}/aar`);
              if (aarRes.data) {
                setAAR(aarRes.data);
                setAARForm({
                  strengths: aarRes.data.strengths ?? '',
                  weaknesses: aarRes.data.weaknesses ?? '',
                  gaps: aarRes.data.gaps ?? '',
                  recommendations: aarRes.data.recommendations ?? '',
                  overall_rating: aarRes.data.overall_rating ?? 0,
                });
              }
            } catch { /* no aar yet */ }
          }
        }
      } catch { /* no sessions */ }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadExercise();
  }, [loadExercise]);

  const loadParticipants = useCallback(async () => {
    if (!id) return;
    setLoadingParticipants(true);
    try {
      const res = await apiClient.get<ExerciseParticipant[]>(`/tabletop/exercises/${id}/participants`);
      setParticipants(res.data);
    } catch { /* ignore */ } finally {
      setLoadingParticipants(false);
    }
  }, [id]);

  useEffect(() => {
    if (canCommand) {
      loadParticipants();
      apiClient.get<ManagedUser[]>('/users').then(r => setOrgUsers(r.data)).catch(() => null);
      apiClient.get<{ incidents: Incident[] }>('/incidents?limit=100').then(r => setOrgIncidents(r.data.incidents ?? [])).catch(() => null);
    }
  }, [canCommand, loadParticipants]);

  // Socket.io for Run tab — join tabletop session room
  useEffect(() => {
    if (!session?.id || activeTab !== 'Run') return;
    const token = localStorage.getItem('token');
    if (!token) return;

    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('join:tabletop_session', session.id);
    });

    socket.on('tabletop:inject_released', (data: { sessionId: string; injectId: string; releasedAt: string; releasedBy: string; releasedByName?: string }) => {
      if (data.sessionId !== session.id) return;
      setReleases(prev => new Map(prev).set(data.injectId, {
        id: '',
        session_id: data.sessionId,
        inject_id: data.injectId,
        released_by: data.releasedBy,
        released_by_name: data.releasedByName,
        released_at: data.releasedAt,
      }));
    });

    socket.on('tabletop:response_saved', (data: { sessionId: string; injectId: string; response: ExerciseInjectResponse }) => {
      if (data.sessionId !== session.id) return;
      setSavedResponses(prev => new Map(prev).set(data.injectId, data.response));
    });

    socket.on('tabletop:session_completed', (data: { sessionId: string }) => {
      if (data.sessionId !== session.id) return;
      setSessionCompleted(true);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [session?.id, activeTab]);

  // Check session by getting the exercise with session info
  useEffect(() => {
    if (!id) return;
    apiClient.get<ExerciseSession>(`/tabletop/sessions/${id}`).catch(() => null);
  }, [id]);

  async function handleReleaseInject(injectId: string) {
    if (!session) return;
    const res = await apiClient.post<SessionInjectRelease>(`/tabletop/sessions/${session.id}/release/${injectId}`, {});
    setReleases(prev => new Map(prev).set(injectId, res.data));
  }

  async function handleAddParticipant(userId: string) {
    if (!id) return;
    await apiClient.post(`/tabletop/exercises/${id}/participants`, { user_id: userId });
    await loadParticipants();
  }

  async function handleRemoveParticipant(userId: string) {
    if (!id) return;
    await apiClient.delete(`/tabletop/exercises/${id}/participants/${userId}`);
    await loadParticipants();
  }

  async function handleLinkIncident(incidentId: string | null) {
    if (!exercise) return;
    const res = await apiClient.put<TabletopExercise>(`/tabletop/exercises/${exercise.id}`, { incident_id: incidentId });
    setExercise(e => ({ ...res.data, injects: e?.injects ?? [] }));
  }

  async function handleSaveScenario(e: React.FormEvent) {
    e.preventDefault();
    if (!exercise) return;
    setSavingScenario(true);
    try {
      const res = await apiClient.put<TabletopExercise>(`/tabletop/exercises/${exercise.id}`, scenarioForm);
      setExercise(ex => ({ ...res.data, injects: ex?.injects ?? [] }));
      setEditingScenario(false);
    } finally {
      setSavingScenario(false);
    }
  }

  async function handleStatusChange(status: string) {
    if (!exercise) return;
    const res = await apiClient.patch<TabletopExercise>(`/tabletop/exercises/${exercise.id}/status`, { status });
    setExercise(e => ({ ...res.data, injects: e?.injects ?? [] }));
  }

  async function handleStartSession() {
    if (!exercise) return;
    const res = await apiClient.post<ExerciseSession>(`/tabletop/exercises/${exercise.id}/sessions`, {});
    setSession(res.data);
    await loadExercise();
    setActiveTab('Run');
  }

  async function handleSaveInject(e: React.FormEvent) {
    e.preventDefault();
    if (!exercise) return;
    setSavingInject(true);
    try {
      const body = {
        title: injectForm.title,
        description: injectForm.description,
        inject_type: injectForm.inject_type,
        trigger_minutes: injectForm.trigger_minutes ? Number(injectForm.trigger_minutes) : undefined,
        expected_actions: injectForm.expected_actions || undefined,
        discussion_prompts: injectForm.discussion_prompts || undefined,
      };
      if (editingInjectId) {
        await apiClient.put(`/tabletop/exercises/${exercise.id}/injects/${editingInjectId}`, body);
      } else {
        await apiClient.post(`/tabletop/exercises/${exercise.id}/injects`, body);
      }
      await loadExercise();
      setShowInjectForm(false);
      setEditingInjectId(null);
      setInjectForm(emptyInjectForm);
    } finally {
      setSavingInject(false);
    }
  }

  async function handleDeleteInject(injectId: string) {
    if (!exercise) return;
    if (!confirm('Delete this inject?')) return;
    await apiClient.delete(`/tabletop/exercises/${exercise.id}/injects/${injectId}`);
    await loadExercise();
  }

  async function handleGenerateScenario(scenarioType: string) {
    setGenerating(true);
    setGeneratingStep('Sending request to AI…');
    setShowScenarioDropdown(false);
    try {
      let res;
      try {
        res = await apiClient.post<{
          title: string;
          scenario: string;
          objectives: string;
          injects: Array<{
            title: string;
            description: string;
            inject_type: string;
            trigger_minutes: number;
            expected_actions: string;
            discussion_prompts: string;
          }>;
          error?: string;
        }>('/tabletop/exercises/generate-scenario', { scenarioType });
      } catch (err: unknown) {
        const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'AI generation request failed. Check that the Anthropic API key is saved in Org Settings.';
        alert(msg);
        return;
      }

      if (res.data.error) {
        alert(res.data.error);
        return;
      }

      if (!res.data.title || !res.data.injects?.length) {
        alert('AI returned an empty response. Please try again.');
        return;
      }

      if (!exercise) return;
      setGeneratingStep('Saving scenario…');
      // Update exercise with generated content
      await apiClient.put(`/tabletop/exercises/${exercise.id}`, {
        title: res.data.title,
        scenario: res.data.scenario,
        objectives: res.data.objectives,
      });

      const validInjectTypes = ['information', 'decision', 'complication', 'escalation', 'resolution'];
      setGeneratingStep(`Saving ${res.data.injects.length} injects…`);
      // Add all injects
      for (const inject of res.data.injects) {
        const normalised = {
          ...inject,
          inject_type: validInjectTypes.includes(inject.inject_type?.toLowerCase())
            ? inject.inject_type.toLowerCase()
            : 'information',
        };
        await apiClient.post(`/tabletop/exercises/${exercise.id}/injects`, normalised);
      }
      setGeneratingStep('Finalising…');
      await loadExercise();
    } catch (err: unknown) {
      alert('Failed to save generated content: ' + ((err as Error)?.message ?? 'unknown error'));
    } finally {
      setGenerating(false);
      setGeneratingStep('');
    }
  }

  function toggleInject(injectId: string) {
    setExpandedInjects(prev => {
      const next = new Set(prev);
      if (next.has(injectId)) next.delete(injectId);
      else next.add(injectId);
      return next;
    });
  }

  async function handleSaveResponse(injectId: string) {
    if (!session) return;
    const resp = responses.get(injectId) ?? { response_text: '', gaps_identified: '' };
    if (!resp.response_text) return;
    const res = await apiClient.post<ExerciseInjectResponse>(`/tabletop/sessions/${session.id}/responses`, {
      inject_id: injectId,
      response_text: resp.response_text,
      gaps_identified: resp.gaps_identified || undefined,
    });
    setSavedResponses(prev => new Map(prev).set(injectId, res.data));
  }

  async function handleCompleteSession() {
    if (!session) return;
    setCompleting(true);
    try {
      const res = await apiClient.patch<ExerciseSession>(`/tabletop/sessions/${session.id}/complete`, {
        notes: sessionNotes || undefined,
      });
      setSession(res.data);
      setExercise(e => e ? { ...e, status: 'completed' } : e);
    } finally {
      setCompleting(false);
    }
  }

  async function handleSaveAAR(e: React.FormEvent) {
    e.preventDefault();
    if (!session) return;
    setSavingAAR(true);
    try {
      const res = await apiClient.put<ExerciseAAR>(`/tabletop/sessions/${session.id}/aar`, {
        ...aarForm,
        overall_rating: aarForm.overall_rating || undefined,
      });
      setAAR(res.data);
      setEditingAAR(false);
    } finally {
      setSavingAAR(false);
    }
  }

  if (loading) {
    return <div style={{ padding: '32px', color: '#8b949e', background: '#0d1117', minHeight: '100vh' }}>Loading…</div>;
  }

  if (!exercise) {
    return <div style={{ padding: '32px', color: '#f85149', background: '#0d1117', minHeight: '100vh' }}>Exercise not found.</div>;
  }

  const injects = exercise.injects ?? [];

  return (
    <div style={{ padding: '32px', background: '#0d1117', minHeight: '100vh', color: '#e6edf3' }}>
      {generating && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(1,4,9,0.85)', backdropFilter: 'blur(4px)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: '24px',
        }}>
          <div style={{ position: 'relative', width: '64px', height: '64px' }}>
            <div style={{
              position: 'absolute', inset: 0, borderRadius: '50%',
              border: '3px solid #21262d',
            }} />
            <div style={{
              position: 'absolute', inset: 0, borderRadius: '50%',
              border: '3px solid transparent',
              borderTopColor: '#58a6ff',
              animation: 'tabletop-spin 0.9s linear infinite',
            }} />
            <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px' }}>✨</span>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '18px', fontWeight: 600, color: '#e6edf3', marginBottom: '8px' }}>
              Generating with AI
            </div>
            <div style={{ fontSize: '13px', color: '#8b949e' }}>{generatingStep}</div>
          </div>
          <div style={{ fontSize: '12px', color: '#484f58', maxWidth: '300px', textAlign: 'center', lineHeight: 1.6 }}>
            This may take 20–40 seconds. The AI is building your scenario and all injects from scratch.
          </div>
        </div>
      )}
      <style>{`
        @keyframes tabletop-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <button
          onClick={() => navigate('/tabletop')}
          style={{ background: 'transparent', border: 'none', color: '#8b949e', cursor: 'pointer', fontSize: '13px', padding: '0 0 8px', display: 'flex', alignItems: 'center', gap: '4px' }}
        >
          ← Back to Exercises
        </button>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
              <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 700 }}>{exercise.title}</h1>
              <StatusBadge status={exercise.status} />
            </div>
            <div style={{ color: '#8b949e', fontSize: '13px', display: 'flex', gap: '16px' }}>
              <span>⏱ {exercise.duration_minutes}m</span>
              {exercise.scheduled_at && <span>📅 {new Date(exercise.scheduled_at).toLocaleString()}</span>}
              <span>📌 {injects.length} injects</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
            {exercise.status === 'draft' && canEdit && (
              <button onClick={() => handleStatusChange('ready')} style={{ background: '#1f6feb', border: '1px solid #388bfd', color: '#e6edf3', padding: '7px 14px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}>
                Mark Ready
              </button>
            )}
            {exercise.status === 'ready' && canEdit && !session && (
              <button onClick={handleStartSession} style={{ background: '#238636', border: '1px solid #2ea043', color: '#e6edf3', padding: '7px 14px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}>
                ▶ Start Session
              </button>
            )}
            {exercise.status === 'completed' && canCommand && (
              <button onClick={() => handleStatusChange('archived')} style={{ background: 'transparent', border: '1px solid #30363d', color: '#8b949e', padding: '7px 14px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}>
                Archive
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', borderBottom: '1px solid #30363d' }}>
        {(['Build', 'Run'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              background: 'transparent', border: 'none',
              color: activeTab === tab ? '#e6edf3' : '#8b949e',
              padding: '8px 18px', cursor: 'pointer', fontSize: '13px',
              fontWeight: activeTab === tab ? 600 : 400,
              borderBottom: activeTab === tab ? '2px solid #58a6ff' : '2px solid transparent',
              marginBottom: '-1px',
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* BUILD TAB */}
      {activeTab === 'Build' && (
        <div>
          {/* Exercise metadata */}
          <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: '8px', padding: '20px', marginBottom: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '14px', color: '#8b949e', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Scenario</h3>
              {canEdit && !editingScenario && (
                <button
                  onClick={() => { setScenarioForm({ title: exercise.title, scenario: exercise.scenario, objectives: exercise.objectives ?? '' }); setEditingScenario(true); }}
                  style={{ background: 'transparent', border: '1px solid #30363d', color: '#8b949e', padding: '4px 12px', borderRadius: '5px', cursor: 'pointer', fontSize: '12px' }}
                >
                  Edit
                </button>
              )}
            </div>
            {editingScenario ? (
              <form onSubmit={handleSaveScenario}>
                <div style={{ marginBottom: '12px' }}>
                  <label style={labelStyle}>Title *</label>
                  <input
                    type="text"
                    value={scenarioForm.title}
                    onChange={e => setScenarioForm(f => ({ ...f, title: e.target.value }))}
                    required
                    style={inputStyle}
                  />
                </div>
                <div style={{ marginBottom: '12px' }}>
                  <label style={labelStyle}>Scenario *</label>
                  <textarea
                    value={scenarioForm.scenario}
                    onChange={e => setScenarioForm(f => ({ ...f, scenario: e.target.value }))}
                    required
                    rows={8}
                    style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }}
                    placeholder="Describe the scenario background, threat actor, initial indicators, and organisational context…"
                  />
                </div>
                <div style={{ marginBottom: '14px' }}>
                  <label style={labelStyle}>Objectives</label>
                  <textarea
                    value={scenarioForm.objectives}
                    onChange={e => setScenarioForm(f => ({ ...f, objectives: e.target.value }))}
                    rows={4}
                    style={{ ...inputStyle, resize: 'vertical' }}
                    placeholder="Learning objectives, one per line…"
                  />
                </div>
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                  <button type="button" onClick={() => setEditingScenario(false)} style={{ background: 'transparent', border: '1px solid #30363d', color: '#8b949e', padding: '7px 14px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}>
                    Cancel
                  </button>
                  <button type="submit" disabled={savingScenario} style={{ background: '#238636', border: '1px solid #2ea043', color: '#e6edf3', padding: '7px 14px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', opacity: savingScenario ? 0.6 : 1 }}>
                    {savingScenario ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </form>
            ) : (
              <>
                <p style={{ margin: '0 0 16px', lineHeight: 1.6, color: '#e6edf3', whiteSpace: 'pre-wrap' }}>{exercise.scenario}</p>
                {exercise.objectives && (
                  <>
                    <h3 style={{ margin: '0 0 8px', fontSize: '14px', color: '#8b949e', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Objectives</h3>
                    <pre style={{ margin: 0, fontFamily: 'inherit', lineHeight: 1.6, color: '#c9d1d9', whiteSpace: 'pre-wrap' }}>{exercise.objectives}</pre>
                  </>
                )}
              </>
            )}
          </div>

          {/* Incident linking (IC+) */}
          {canCommand && (
            <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: '8px', padding: '16px 20px', marginBottom: '16px' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#8b949e', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '10px' }}>Linked Incident</div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <select
                  value={exercise.incident_id ?? ''}
                  onChange={e => handleLinkIncident(e.target.value || null)}
                  style={{ flex: 1, background: '#0d1117', border: '1px solid #30363d', borderRadius: '6px', padding: '7px 10px', color: '#e6edf3', fontSize: '13px' }}
                >
                  <option value="">— No linked incident —</option>
                  {orgIncidents.map((inc: Incident) => (
                    <option key={inc.id} value={inc.id}>{inc.title}</option>
                  ))}
                </select>
                {exercise.incident_id && (
                  <a href={`/incidents/${exercise.incident_id}`} target="_blank" rel="noreferrer"
                    style={{ background: '#1f6feb', border: '1px solid #388bfd', borderRadius: '6px', padding: '7px 14px', color: '#e6edf3', fontSize: '13px', textDecoration: 'none', whiteSpace: 'nowrap' }}>
                    🔗 Open Incident
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Participants (IC+) */}
          {canCommand && (
            <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: '8px', padding: '16px 20px', marginBottom: '16px' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#8b949e', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '10px' }}>
                Participants {loadingParticipants && <span style={{ color: '#484f58', fontSize: '11px', fontWeight: 400 }}>Loading…</span>}
              </div>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                <select
                  value={addParticipantId}
                  onChange={e => setAddParticipantId(e.target.value)}
                  style={{ flex: 1, background: '#0d1117', border: '1px solid #30363d', borderRadius: '6px', padding: '7px 10px', color: '#e6edf3', fontSize: '13px' }}
                >
                  <option value="">Add participant…</option>
                  {orgUsers.filter((u: ManagedUser) => !participants.some((p: ExerciseParticipant) => p.user_id === u.id) && !u.deactivated_at).map((u: ManagedUser) => (
                    <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                  ))}
                </select>
                <button
                  onClick={() => { if (addParticipantId) { handleAddParticipant(addParticipantId); setAddParticipantId(''); } }}
                  disabled={!addParticipantId}
                  style={{ background: '#238636', border: 'none', borderRadius: '6px', padding: '7px 14px', color: '#fff', fontSize: '13px', cursor: addParticipantId ? 'pointer' : 'not-allowed', opacity: addParticipantId ? 1 : 0.5 }}
                >
                  Add
                </button>
              </div>
              {participants.length === 0 ? (
                <div style={{ color: '#484f58', fontSize: '13px' }}>No participants added yet.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {participants.map((p: ExerciseParticipant) => (
                    <div key={p.user_id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 10px', background: '#0d1117', borderRadius: '6px', border: '1px solid #21262d' }}>
                      <span style={{ flex: 1, color: '#e6edf3', fontSize: '13px' }}>{p.user_name}</span>
                      <span style={{ color: '#8b949e', fontSize: '12px' }}>{p.user_email}</span>
                      <button onClick={() => handleRemoveParticipant(p.user_id)} style={{ background: 'transparent', border: '1px solid #30363d', borderRadius: '4px', padding: '3px 8px', color: '#f85149', fontSize: '11px', cursor: 'pointer' }}>Remove</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Injects header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>Injects</h2>
            {canEdit && (
              <div style={{ display: 'flex', gap: '8px', position: 'relative' }}>
                <div style={{ position: 'relative' }}>
                  <button
                    onClick={() => setShowScenarioDropdown(d => !d)}
                    disabled={generating}
                    style={{
                      background: 'transparent', border: '1px solid #30363d',
                      color: generating ? '#484f58' : '#8b949e',
                      padding: '7px 12px', borderRadius: '6px', cursor: generating ? 'not-allowed' : 'pointer', fontSize: '12px',
                    }}
                  >
                    {generating ? '⏳ Generating…' : '✨ Generate with AI ▾'}
                  </button>
                  {showScenarioDropdown && (
                    <div style={{
                      position: 'absolute', right: 0, top: '100%', marginTop: '4px',
                      background: '#161b22', border: '1px solid #30363d', borderRadius: '6px',
                      zIndex: 100, minWidth: '160px',
                    }}>
                      {SCENARIO_TYPES.map(st => (
                        <button
                          key={st.value}
                          onClick={() => handleGenerateScenario(st.value)}
                          style={{
                            display: 'block', width: '100%', textAlign: 'left',
                            background: 'transparent', border: 'none', color: '#c9d1d9',
                            padding: '8px 14px', cursor: 'pointer', fontSize: '13px',
                          }}
                          onMouseEnter={e => { e.currentTarget.style.background = '#21262d'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                        >
                          {st.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => { setShowInjectForm(true); setEditingInjectId(null); setInjectForm(emptyInjectForm); }}
                  style={{
                    background: '#238636', border: '1px solid #2ea043',
                    color: '#e6edf3', padding: '7px 14px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px',
                  }}
                >
                  + Add Inject
                </button>
              </div>
            )}
          </div>

          {/* Linked Incident (incident_commander+) */}
          {canCommand && (
            <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: '8px', padding: '16px 20px', marginBottom: '16px' }}>
              <h3 style={{ margin: '0 0 10px', fontSize: '13px', color: '#8b949e', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Linked Incident</h3>
              {exercise.incident_id ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ color: '#58a6ff', fontSize: '13px' }}>🔗 {exercise.incident_title ?? exercise.incident_id}</span>
                  <a href={`/incidents/${exercise.incident_id}`} target="_blank" rel="noreferrer" style={{ color: '#8b949e', fontSize: '12px', textDecoration: 'underline' }}>Open Incident</a>
                  <button onClick={() => handleLinkIncident(null)} style={{ background: 'transparent', border: '1px solid #f8514944', color: '#f85149', padding: '3px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>Unlink</button>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <select
                    defaultValue=""
                    onChange={e => { if (e.target.value) handleLinkIncident(e.target.value); }}
                    style={{ ...inputStyle, width: 'auto', minWidth: '260px' }}
                  >
                    <option value="">— Select incident to link —</option>
                    {orgIncidents.map(inc => (
                      <option key={inc.id} value={inc.id}>{inc.title}</option>
                    ))}
                  </select>
                  <span style={{ color: '#484f58', fontSize: '12px' }}>Links this exercise to a live incident for parallel IR work</span>
                </div>
              )}
            </div>
          )}

          {/* Inject list */}
          {injects.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px', color: '#484f58', background: '#161b22', borderRadius: '8px', border: '1px solid #30363d' }}>
              No injects yet. Add one manually or generate with AI.
            </div>
          )}
          <div style={{ display: 'grid', gap: '10px' }}>
            {injects.map((inject, idx) => (
              <div key={inject.id} style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: '8px', overflow: 'hidden' }}>
                {/* Inject header */}
                <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{
                    width: '24px', height: '24px', borderRadius: '50%',
                    background: INJECT_TYPE_COLORS[inject.inject_type] + '33',
                    border: `1px solid ${INJECT_TYPE_COLORS[inject.inject_type]}`,
                    color: INJECT_TYPE_COLORS[inject.inject_type],
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '12px', fontWeight: 700, flexShrink: 0,
                  }}>
                    {idx + 1}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '3px' }}>{inject.title}</div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <InjectTypeBadge type={inject.inject_type} />
                      {inject.trigger_minutes !== undefined && inject.trigger_minutes !== null && (
                        <span style={{ color: '#484f58', fontSize: '12px' }}>T+{inject.trigger_minutes}m</span>
                      )}
                    </div>
                  </div>
                  {canEdit && (
                    <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                      <button
                        onClick={() => {
                          setEditingInjectId(inject.id);
                          setInjectForm({
                            title: inject.title,
                            description: inject.description,
                            inject_type: inject.inject_type,
                            trigger_minutes: inject.trigger_minutes?.toString() ?? '',
                            expected_actions: inject.expected_actions ?? '',
                            discussion_prompts: inject.discussion_prompts ?? '',
                          });
                          setShowInjectForm(true);
                        }}
                        style={{ background: 'transparent', border: '1px solid #30363d', color: '#8b949e', padding: '4px 10px', borderRadius: '5px', cursor: 'pointer', fontSize: '12px' }}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteInject(inject.id)}
                        style={{ background: 'transparent', border: '1px solid #30363d', color: '#f85149', padding: '4px 10px', borderRadius: '5px', cursor: 'pointer', fontSize: '12px' }}
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
                {/* Inject body preview */}
                <div style={{ borderTop: '1px solid #21262d', padding: '12px 16px 12px 52px', background: '#0d111788' }}>
                  <p style={{ margin: 0, color: '#8b949e', fontSize: '13px', lineHeight: 1.5 }}>
                    {inject.description.length > 160 ? inject.description.substring(0, 160) + '…' : inject.description}
                  </p>
                  {inject.expected_actions && (
                    <p style={{ margin: '8px 0 0', color: '#484f58', fontSize: '12px' }}>
                      <strong style={{ color: '#6e7681' }}>Expected: </strong>{inject.expected_actions.length > 100 ? inject.expected_actions.substring(0, 100) + '…' : inject.expected_actions}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* RUN TAB */}
      {activeTab === 'Run' && (
        <div>
          {!session ? (
            <div style={{ textAlign: 'center', padding: '60px', color: '#8b949e', background: '#161b22', borderRadius: '8px', border: '1px solid #30363d' }}>
              <div style={{ fontSize: '32px', marginBottom: '12px' }}>▶</div>
              <div style={{ fontSize: '15px', color: '#e6edf3', marginBottom: '8px' }}>No active session</div>
              <div style={{ fontSize: '13px', marginBottom: '20px' }}>Start a session from the Build tab to run this exercise</div>
              {canEdit && exercise.status === 'ready' && (
                <button onClick={() => { setActiveTab('Build'); }} style={{ background: 'transparent', border: '1px solid #30363d', color: '#8b949e', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}>
                  Go to Build tab
                </button>
              )}
            </div>
          ) : (
            <div>
              {/* Session completed banner (real-time) */}
              {sessionCompleted && session?.status !== 'completed' && (
                <div style={{ background: '#a371f722', border: '1px solid #a371f744', borderRadius: '8px', padding: '12px 16px', marginBottom: '16px', color: '#a371f7', fontSize: '13px', fontWeight: 600 }}>
                  Session has been completed by the facilitator.
                </div>
              )}

              {/* Linked incident banner */}
              {exercise.incident_id && (
                <div style={{ background: '#58a6ff11', border: '1px solid #58a6ff33', borderRadius: '8px', padding: '10px 16px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ color: '#58a6ff', fontSize: '13px' }}>🔗 Linked to Incident: <strong>{exercise.incident_title ?? exercise.incident_id}</strong></span>
                  <a href={`/incidents/${exercise.incident_id}`} target="_blank" rel="noreferrer" style={{ background: '#1f6feb', border: '1px solid #388bfd', color: '#e6edf3', padding: '4px 10px', borderRadius: '5px', fontSize: '12px', textDecoration: 'none' }}>Open Incident ↗</a>
                </div>
              )}

              {/* Scenario box */}
              <div style={{ background: '#161b22', border: '1px solid #58a6ff33', borderLeft: '3px solid #58a6ff', borderRadius: '8px', padding: '16px 20px', marginBottom: '24px' }}>
                <div style={{ fontSize: '11px', color: '#58a6ff', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>Active Scenario</div>
                <p style={{ margin: 0, color: '#c9d1d9', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{exercise.scenario}</p>
              </div>

              {/* Inject timeline */}
              <h3 style={{ margin: '0 0 12px', fontSize: '14px', color: '#8b949e', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Inject Timeline</h3>
              <div style={{ display: 'grid', gap: '10px', marginBottom: '24px' }}>
                {injects.map((inject, idx) => {
                  const isExpanded = expandedInjects.has(inject.id);
                  const saved = savedResponses.get(inject.id);
                  const resp = responses.get(inject.id) ?? { response_text: saved?.response_text ?? '', gaps_identified: saved?.gaps_identified ?? '' };
                  const release = releases.get(inject.id);
                  const isReleased = !!release;

                  return (
                    <div key={inject.id} style={{ background: '#161b22', border: `1px solid ${isReleased ? '#30363d' : '#21262d'}`, borderRadius: '8px', overflow: 'hidden', opacity: (!isReleased && !canEdit) ? 0.7 : 1 }}>
                      <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{
                          width: '24px', height: '24px', borderRadius: '50%',
                          background: saved ? '#3fb95022' : INJECT_TYPE_COLORS[inject.inject_type] + '22',
                          border: `1px solid ${saved ? '#3fb950' : INJECT_TYPE_COLORS[inject.inject_type]}`,
                          color: saved ? '#3fb950' : INJECT_TYPE_COLORS[inject.inject_type],
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '12px', fontWeight: 700, flexShrink: 0,
                        }}>
                          {saved ? '✓' : idx + 1}
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '3px' }}>{inject.title}</div>
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                            <InjectTypeBadge type={inject.inject_type} />
                            {inject.trigger_minutes !== undefined && inject.trigger_minutes !== null && (
                              <span style={{ color: '#484f58', fontSize: '12px' }}>T+{inject.trigger_minutes}m</span>
                            )}
                            {isReleased ? (
                              <span style={{ fontSize: '11px', color: '#3fb950' }}>
                                Released at {new Date(release.released_at).toLocaleTimeString()}{release.released_by_name ? ` by ${release.released_by_name}` : ''}
                              </span>
                            ) : !canEdit ? (
                              <span style={{ fontSize: '11px', color: '#484f58' }}>🔒 Awaiting release…</span>
                            ) : null}
                          </div>
                        </div>
                        {session.status === 'in_progress' && canEdit && !isReleased && (
                          <button
                            onClick={() => handleReleaseInject(inject.id)}
                            style={{
                              background: '#1f6feb22',
                              border: '1px solid #388bfd44',
                              color: '#58a6ff',
                              padding: '5px 12px', borderRadius: '5px', cursor: 'pointer', fontSize: '12px',
                            }}
                          >
                            Release Inject
                          </button>
                        )}
                        {(isReleased || session.status === 'completed' || saved) && (
                          <button
                            onClick={() => toggleInject(inject.id)}
                            style={{
                              background: isExpanded ? '#21262d' : 'transparent',
                              border: '1px solid #30363d', color: '#8b949e',
                              padding: '5px 12px', borderRadius: '5px', cursor: 'pointer', fontSize: '12px',
                            }}
                          >
                            {isExpanded ? 'Collapse' : 'View'}
                          </button>
                        )}
                      </div>

                      {isExpanded && (isReleased || session.status === 'completed') && (
                        <div style={{ borderTop: '1px solid #21262d', padding: '16px' }}>
                          <p style={{ margin: '0 0 12px', color: '#c9d1d9', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{inject.description}</p>
                          {inject.discussion_prompts && (
                            <div style={{ marginBottom: '16px' }}>
                              <div style={{ fontSize: '12px', color: '#58a6ff', fontWeight: 600, marginBottom: '6px' }}>Discussion Prompts</div>
                              <ul style={{ margin: 0, paddingLeft: '20px', color: '#8b949e', fontSize: '13px', lineHeight: 1.8 }}>
                                {inject.discussion_prompts.split('\n').filter(Boolean).map((p, i) => (
                                  <li key={i}>{p}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {saved && session.status === 'completed' ? (
                            <div style={{ background: '#0d1117', borderRadius: '6px', padding: '12px', border: '1px solid #30363d' }}>
                              <div style={{ fontSize: '12px', color: '#3fb950', marginBottom: '6px', fontWeight: 600 }}>Response</div>
                              <p style={{ margin: '0 0 8px', color: '#c9d1d9', fontSize: '13px', whiteSpace: 'pre-wrap' }}>{saved.response_text}</p>
                              {saved.gaps_identified && (
                                <>
                                  <div style={{ fontSize: '12px', color: '#f85149', marginBottom: '4px', fontWeight: 600 }}>Gaps Identified</div>
                                  <p style={{ margin: 0, color: '#c9d1d9', fontSize: '13px', whiteSpace: 'pre-wrap' }}>{saved.gaps_identified}</p>
                                </>
                              )}
                            </div>
                          ) : session.status === 'in_progress' && (
                            <div>
                              <div style={{ marginBottom: '10px' }}>
                                <label style={labelStyle}>Team Response</label>
                                <textarea
                                  value={resp.response_text}
                                  onChange={e => setResponses(prev => new Map(prev).set(inject.id, { ...resp, response_text: e.target.value }))}
                                  rows={3}
                                  style={{ ...inputStyle, resize: 'vertical' }}
                                  placeholder="Document team actions and decisions…"
                                />
                              </div>
                              <div style={{ marginBottom: '10px' }}>
                                <label style={labelStyle}>Gaps Identified</label>
                                <textarea
                                  value={resp.gaps_identified}
                                  onChange={e => setResponses(prev => new Map(prev).set(inject.id, { ...resp, gaps_identified: e.target.value }))}
                                  rows={2}
                                  style={{ ...inputStyle, resize: 'vertical' }}
                                  placeholder="Any gaps in process, tooling, or knowledge…"
                                />
                              </div>
                              <button
                                onClick={() => handleSaveResponse(inject.id)}
                                disabled={!resp.response_text}
                                style={{
                                  background: resp.response_text ? '#238636' : '#21262d',
                                  border: `1px solid ${resp.response_text ? '#2ea043' : '#30363d'}`,
                                  color: resp.response_text ? '#e6edf3' : '#484f58',
                                  padding: '7px 16px', borderRadius: '6px',
                                  cursor: resp.response_text ? 'pointer' : 'not-allowed',
                                  fontSize: '13px',
                                }}
                              >
                                {saved ? '✓ Update Response' : 'Save Response'}
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Session notes */}
              {session.status === 'in_progress' && (
                <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: '8px', padding: '16px', marginBottom: '16px' }}>
                  <label style={{ ...labelStyle, fontSize: '13px', color: '#c9d1d9', marginBottom: '8px' }}>Session Notes</label>
                  <textarea
                    value={sessionNotes}
                    onChange={e => setSessionNotes(e.target.value)}
                    rows={4}
                    style={{ ...inputStyle, resize: 'vertical' }}
                    placeholder="General session notes, observations, facilitator comments…"
                  />
                </div>
              )}

              {/* Complete session button */}
              {session.status === 'in_progress' && canEdit && (
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    onClick={handleCompleteSession}
                    disabled={completing}
                    style={{
                      background: '#a371f722', border: '1px solid #a371f744',
                      color: '#a371f7', padding: '8px 20px', borderRadius: '6px',
                      cursor: completing ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: 600,
                    }}
                  >
                    {completing ? 'Completing…' : '✓ Complete Session'}
                  </button>
                </div>
              )}

              {/* AAR section */}
              {session.status === 'completed' && (
                <div style={{ marginTop: '32px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                    <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>After Action Review (AAR)</h2>
                    {canCommand && !editingAAR && (
                      <button
                        onClick={() => setEditingAAR(true)}
                        style={{ background: 'transparent', border: '1px solid #30363d', color: '#8b949e', padding: '6px 14px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}
                      >
                        {aar ? 'Edit AAR' : '+ Write AAR'}
                      </button>
                    )}
                  </div>

                  {editingAAR ? (
                    <form onSubmit={handleSaveAAR} style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: '8px', padding: '20px' }}>
                      {[
                        { key: 'strengths', label: 'Strengths', color: '#3fb950' },
                        { key: 'weaknesses', label: 'Weaknesses', color: '#f85149' },
                        { key: 'gaps', label: 'Gaps Identified', color: '#e3b341' },
                        { key: 'recommendations', label: 'Recommendations', color: '#58a6ff' },
                      ].map(({ key, label, color }) => (
                        <div key={key} style={{ marginBottom: '14px' }}>
                          <label style={{ ...labelStyle, color }}>{label}</label>
                          <textarea
                            value={(aarForm as Record<string, string | number>)[key] as string}
                            onChange={e => setAARForm(f => ({ ...f, [key]: e.target.value }))}
                            rows={3}
                            style={{ ...inputStyle, resize: 'vertical' }}
                          />
                        </div>
                      ))}
                      <div style={{ marginBottom: '16px' }}>
                        <label style={labelStyle}>Overall Rating</label>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          {[1, 2, 3, 4, 5].map(n => (
                            <button
                              key={n}
                              type="button"
                              onClick={() => setAARForm(f => ({ ...f, overall_rating: n }))}
                              style={{
                                width: '36px', height: '36px', borderRadius: '6px',
                                border: `1px solid ${aarForm.overall_rating >= n ? '#e3b341' : '#30363d'}`,
                                background: aarForm.overall_rating >= n ? '#e3b34122' : 'transparent',
                                color: aarForm.overall_rating >= n ? '#e3b341' : '#484f58',
                                cursor: 'pointer', fontSize: '18px',
                              }}
                            >
                              ★
                            </button>
                          ))}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                        <button type="button" onClick={() => setEditingAAR(false)} style={{ background: 'transparent', border: '1px solid #30363d', color: '#8b949e', padding: '7px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}>
                          Cancel
                        </button>
                        <button type="submit" disabled={savingAAR} style={{ background: '#238636', border: '1px solid #2ea043', color: '#e6edf3', padding: '7px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}>
                          {savingAAR ? 'Saving…' : 'Save AAR'}
                        </button>
                      </div>
                    </form>
                  ) : aar ? (
                    <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: '8px', padding: '20px' }}>
                      {aar.overall_rating && (
                        <div style={{ marginBottom: '16px' }}>
                          <div style={{ fontSize: '12px', color: '#8b949e', marginBottom: '4px' }}>Overall Rating</div>
                          <div style={{ color: '#e3b341', fontSize: '20px', letterSpacing: '2px' }}>
                            {'★'.repeat(aar.overall_rating)}{'☆'.repeat(5 - aar.overall_rating)}
                          </div>
                        </div>
                      )}
                      {[
                        { key: 'strengths', label: 'Strengths', color: '#3fb950' },
                        { key: 'weaknesses', label: 'Weaknesses', color: '#f85149' },
                        { key: 'gaps', label: 'Gaps Identified', color: '#e3b341' },
                        { key: 'recommendations', label: 'Recommendations', color: '#58a6ff' },
                      ].map(({ key, label, color }) => {
                        const val = (aar as unknown as Record<string, unknown>)[key] as string | undefined;
                        if (!val) return null;
                        return (
                          <div key={key} style={{ marginBottom: '16px' }}>
                            <div style={{ fontSize: '12px', color, fontWeight: 600, marginBottom: '6px' }}>{label}</div>
                            <p style={{ margin: 0, color: '#c9d1d9', fontSize: '13px', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{val}</p>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '32px', color: '#484f58', background: '#161b22', borderRadius: '8px', border: '1px solid #30363d' }}>
                      {canCommand ? 'Click "Write AAR" to document lessons learned.' : 'AAR not yet completed.'}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Inject form modal */}
      {showInjectForm && (
        <div style={{ position: 'fixed', inset: 0, background: '#00000088', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: '10px', width: '580px', maxHeight: '85vh', overflowY: 'auto', padding: '24px' }}>
            <h2 style={{ margin: '0 0 20px', fontSize: '16px', fontWeight: 600 }}>{editingInjectId ? 'Edit Inject' : 'Add Inject'}</h2>
            <form onSubmit={handleSaveInject}>
              <div style={{ marginBottom: '12px' }}>
                <label style={labelStyle}>Title *</label>
                <input type="text" value={injectForm.title} onChange={e => setInjectForm(f => ({ ...f, title: e.target.value }))} required style={inputStyle} />
              </div>
              <div style={{ marginBottom: '12px' }}>
                <label style={labelStyle}>Description *</label>
                <textarea value={injectForm.description} onChange={e => setInjectForm(f => ({ ...f, description: e.target.value }))} required rows={4} style={{ ...inputStyle, resize: 'vertical' }} />
              </div>
              <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Type</label>
                  <select value={injectForm.inject_type} onChange={e => setInjectForm(f => ({ ...f, inject_type: e.target.value }))} style={{ ...inputStyle }}>
                    {['information', 'decision', 'complication', 'escalation', 'resolution'].map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div style={{ width: '130px' }}>
                  <label style={labelStyle}>Trigger (minutes)</label>
                  <input type="number" min="0" value={injectForm.trigger_minutes} onChange={e => setInjectForm(f => ({ ...f, trigger_minutes: e.target.value }))} style={inputStyle} placeholder="e.g. 15" />
                </div>
              </div>
              <div style={{ marginBottom: '12px' }}>
                <label style={labelStyle}>Expected Actions</label>
                <textarea value={injectForm.expected_actions} onChange={e => setInjectForm(f => ({ ...f, expected_actions: e.target.value }))} rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={labelStyle}>Discussion Prompts (one per line)</label>
                <textarea value={injectForm.discussion_prompts} onChange={e => setInjectForm(f => ({ ...f, discussion_prompts: e.target.value }))} rows={3} style={{ ...inputStyle, resize: 'vertical' }} placeholder="What should the team prioritize?&#10;Who needs to be notified?&#10;What evidence should be collected?" />
              </div>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => { setShowInjectForm(false); setEditingInjectId(null); }} style={{ background: 'transparent', border: '1px solid #30363d', color: '#8b949e', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}>
                  Cancel
                </button>
                <button type="submit" disabled={savingInject} style={{ background: '#238636', border: '1px solid #2ea043', color: '#e6edf3', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', opacity: savingInject ? 0.6 : 1 }}>
                  {savingInject ? 'Saving…' : editingInjectId ? 'Save Changes' : 'Add Inject'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
