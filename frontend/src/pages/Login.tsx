import { useState, FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const s: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0d1117' },
  card: { background: '#161b22', border: '1px solid #30363d', borderRadius: '12px', padding: '40px', width: '400px' },
  title: { fontSize: '24px', fontWeight: 700, marginBottom: '8px', color: '#e6edf3' },
  sub: { color: '#8b949e', marginBottom: '32px', fontSize: '14px' },
  label: { display: 'block', color: '#8b949e', fontSize: '12px', fontWeight: 600, marginBottom: '6px', textTransform: 'uppercase' as const },
  input: { width: '100%', background: '#0d1117', border: '1px solid #30363d', borderRadius: '6px', padding: '10px 14px', color: '#e6edf3', fontSize: '14px', outline: 'none', marginBottom: '20px' },
  btn: { width: '100%', background: '#238636', border: 'none', borderRadius: '6px', padding: '12px', color: '#fff', fontSize: '14px', fontWeight: 600, cursor: 'pointer', marginBottom: '12px' },
  ssoBtn: { width: '100%', background: '#21262d', border: '1px solid #30363d', borderRadius: '6px', padding: '10px', color: '#8b949e', fontSize: '13px', cursor: 'pointer', marginBottom: '8px' },
  error: { background: '#3d1a1a', border: '1px solid #f85149', color: '#f85149', borderRadius: '6px', padding: '10px 14px', marginBottom: '16px', fontSize: '13px' },
  divider: { borderTop: '1px solid #30363d', margin: '20px 0', position: 'relative' as const },
  dividerText: { position: 'absolute' as const, top: '-10px', left: '50%', transform: 'translateX(-50%)', background: '#161b22', padding: '0 8px', color: '#8b949e', fontSize: '12px' },
};

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('analyst@fission.local');
  const [password, setPassword] = useState('analyst123');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/incidents');
    } catch (err: unknown) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setError((err as any)?.response?.data?.error ?? 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={s.title}>Fission Ops</div>
        <div style={s.sub}>Incident Response Platform</div>
        {error && <div style={s.error}>{error}</div>}
        <form onSubmit={handleSubmit}>
          <label style={s.label}>Email</label>
          <input style={s.input} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <label style={s.label}>Password</label>
          <input style={s.input} type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          <div style={{ textAlign: 'right', marginTop: '-14px', marginBottom: '20px' }}>
            <Link to="/forgot-password" style={{ color: '#58a6ff', fontSize: '12px', textDecoration: 'none' }}>Forgot password?</Link>
          </div>
          <button style={s.btn} type="submit" disabled={loading}>{loading ? 'Signing in…' : 'Sign in'}</button>
        </form>
        <div style={s.divider}><span style={s.dividerText}>OR</span></div>
        <button type="button" style={s.ssoBtn} onClick={() => { window.location.href = `${import.meta.env.VITE_API_URL || '/api/v1'}/auth/sso/azure`; }}>Sign in with Azure AD</button>
        <button type="button" style={s.ssoBtn} onClick={() => { window.location.href = `${import.meta.env.VITE_API_URL || '/api/v1'}/auth/sso/okta`; }}>Sign in with Okta</button>
      </div>
    </div>
  );
}
