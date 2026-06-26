import { useState, FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { apiClient } from '../api/client';
import { useAuth } from '../context/AuthContext';

const s: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', background: '#0d1117', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' },
  card: { width: '100%', maxWidth: '560px', background: '#161b22', border: '1px solid #30363d', borderRadius: '12px', padding: '40px' },
  progress: { display: 'flex', gap: '8px', marginBottom: '32px', alignItems: 'center' },
  step: { flex: 1, height: '4px', borderRadius: '2px', background: '#30363d' },
  stepActive: { flex: 1, height: '4px', borderRadius: '2px', background: '#238636' },
  stepLabel: { color: '#8b949e', fontSize: '12px', marginBottom: '4px' },
  title: { color: '#e6edf3', fontSize: '22px', fontWeight: 700, marginBottom: '8px' },
  sub: { color: '#8b949e', fontSize: '14px', marginBottom: '28px' },
  label: { display: 'block', color: '#8b949e', fontSize: '12px', fontWeight: 600, marginBottom: '6px', textTransform: 'uppercase' as const },
  input: { width: '100%', background: '#0d1117', border: '1px solid #30363d', borderRadius: '6px', padding: '10px 14px', color: '#e6edf3', fontSize: '14px', outline: 'none', marginBottom: '16px', boxSizing: 'border-box' as const },
  select: { width: '100%', background: '#0d1117', border: '1px solid #30363d', borderRadius: '6px', padding: '10px 14px', color: '#e6edf3', fontSize: '14px', outline: 'none', marginBottom: '16px', boxSizing: 'border-box' as const },
  btnPrimary: { background: '#238636', border: 'none', borderRadius: '6px', padding: '10px 20px', color: '#fff', fontSize: '14px', fontWeight: 600, cursor: 'pointer', marginRight: '8px' },
  btnSecondary: { background: 'transparent', border: '1px solid #30363d', borderRadius: '6px', padding: '10px 20px', color: '#8b949e', fontSize: '14px', cursor: 'pointer' },
  error: { background: '#3d1a1a', border: '1px solid #f85149', color: '#f85149', borderRadius: '6px', padding: '10px 14px', marginBottom: '16px', fontSize: '13px' },
  successLink: { display: 'inline-block', color: '#58a6ff', fontSize: '14px', marginBottom: '12px', textDecoration: 'none' },
};

export default function Onboarding() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [title, setTitle] = useState('');
  const [severity, setSeverity] = useState<'low' | 'medium' | 'high' | 'critical'>('medium');
  const [createdIncidentId, setCreatedIncidentId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function createIncident(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await apiClient.post<{ id: string }>('/incidents', { title, severity });
      setCreatedIncidentId(res.data.id);
      setStep(3);
    } catch (err: unknown) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setError((err as any)?.response?.data?.error ?? 'Failed to create incident');
    } finally {
      setLoading(false);
    }
  }

  const progressSteps = [1, 2, 3];

  return (
    <div style={s.page}>
      <div style={s.card}>
        {/* Progress indicator */}
        <div style={s.progress}>
          {progressSteps.map((n) => (
            <div key={n} style={n <= step ? s.stepActive : s.step} />
          ))}
        </div>
        <div style={s.stepLabel}>Step {step} of 3</div>

        {step === 1 && (
          <>
            <div style={s.title}>Welcome to Fission Ops{user?.org_id ? '' : ''}! 🎉</div>
            <div style={s.sub}>Your organization is ready. Let&apos;s set up your first incident so you can see the platform in action.</div>
            <button type="button" style={s.btnPrimary} onClick={() => setStep(2)}>Get Started →</button>
            <button type="button" style={s.btnSecondary} onClick={() => navigate('/incidents')}>Skip setup</button>
          </>
        )}

        {step === 2 && (
          <>
            <div style={s.title}>Create your first incident</div>
            <div style={s.sub}>Fill in the basic details. You can add more information later.</div>
            {error && <div style={s.error}>{error}</div>}
            <form onSubmit={createIncident}>
              <label style={s.label}>Incident Title</label>
              <input style={s.input} type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Ransomware activity on CORP-WS-001" required />
              <label style={s.label}>Severity</label>
              <select style={s.select} value={severity} onChange={(e) => setSeverity(e.target.value as typeof severity)}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
              <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                <button type="button" style={s.btnPrimary} type="submit" disabled={loading}>{loading ? 'Creating…' : 'Create Incident →'}</button>
                <button type="button" style={s.btnSecondary} type="button" onClick={() => setStep(3)}>Skip</button>
              </div>
            </form>
          </>
        )}

        {step === 3 && (
          <>
            <div style={s.title}>You&apos;re ready! ✅</div>
            <div style={s.sub}>Your organization is set up and you&apos;re ready to start investigating incidents.</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
              {createdIncidentId && (
                <Link to={`/incidents/${createdIncidentId}`} style={s.successLink}>
                  → View your first incident
                </Link>
              )}
              <Link to="/admin/users" style={s.successLink}>→ Invite your team</Link>
              <Link to="/settings/org" style={s.successLink}>→ Organization settings</Link>
              <Link to="/incidents" style={s.successLink}>→ Go to incident dashboard</Link>
            </div>
            <button type="button" style={s.btnPrimary} onClick={() => navigate('/incidents')}>Go to Dashboard</button>
          </>
        )}
      </div>
    </div>
  );
}
