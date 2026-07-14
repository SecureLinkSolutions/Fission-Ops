import { useState, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { apiClient } from '../api/client';

const s: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0d1117' },
  card: { background: '#161b22', border: '1px solid #30363d', borderRadius: '12px', padding: '40px', width: '400px' },
  title: { fontSize: '24px', fontWeight: 700, marginBottom: '8px', color: '#e6edf3' },
  sub: { color: '#8b949e', marginBottom: '32px', fontSize: '14px' },
  label: { display: 'block', color: '#8b949e', fontSize: '12px', fontWeight: 600, marginBottom: '6px', textTransform: 'uppercase' as const },
  input: { width: '100%', background: '#0d1117', border: '1px solid #30363d', borderRadius: '6px', padding: '10px 14px', color: '#e6edf3', fontSize: '14px', outline: 'none', marginBottom: '20px', boxSizing: 'border-box' as const },
  btn: { width: '100%', background: '#238636', border: 'none', borderRadius: '6px', padding: '12px', color: '#fff', fontSize: '14px', fontWeight: 600, cursor: 'pointer', marginBottom: '12px' },
  success: { background: '#0f2a1a', border: '1px solid #3fb950', color: '#3fb950', borderRadius: '6px', padding: '12px 14px', marginBottom: '16px', fontSize: '13px' },
  backLink: { display: 'block', textAlign: 'center' as const, color: '#58a6ff', fontSize: '13px', textDecoration: 'none', marginTop: '8px' },
};

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await apiClient.post('/auth/forgot-password', { email });
    } catch {
      // intentionally swallow — always show neutral message
    } finally {
      setLoading(false);
      setSubmitted(true);
    }
  }

  return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={s.title}>⚡ Fission Ops</div>
        <div style={s.sub}>Reset your password</div>

        {submitted ? (
          <>
            <div style={s.success}>
              If that email is registered, a password reset link has been sent. Check your inbox.
            </div>
            <Link to="/login" style={s.backLink}>Back to Login</Link>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            <label style={s.label}>Email</label>
            <input
              style={s.input}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
            <button type="submit" style={s.btn} disabled={loading}>
              {loading ? 'Sending…' : 'Send Reset Link'}
            </button>
            <Link to="/login" style={s.backLink}>Back to Login</Link>
          </form>
        )}
      </div>
    </div>
  );
}
