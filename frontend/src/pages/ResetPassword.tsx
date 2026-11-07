import { useState, FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { apiClient } from '../api/client';

const s: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0d1117' },
  card: { background: '#161b22', border: '1px solid #30363d', borderRadius: '12px', padding: '40px', width: '420px' },
  title: { fontSize: '24px', fontWeight: 700, marginBottom: '8px', color: '#e6edf3' },
  sub: { color: '#8b949e', marginBottom: '32px', fontSize: '14px' },
  label: { display: 'block', color: '#8b949e', fontSize: '12px', fontWeight: 600, marginBottom: '6px', textTransform: 'uppercase' as const },
  input: { width: '100%', background: '#0d1117', border: '1px solid #30363d', borderRadius: '6px', padding: '10px 14px', color: '#e6edf3', fontSize: '14px', outline: 'none', marginBottom: '20px', boxSizing: 'border-box' as const },
  btn: { width: '100%', background: '#238636', border: 'none', borderRadius: '6px', padding: '12px', color: '#fff', fontSize: '14px', fontWeight: 600, cursor: 'pointer', marginBottom: '12px' },
  error: { background: '#3d1a1a', border: '1px solid #f85149', color: '#f85149', borderRadius: '6px', padding: '10px 14px', marginBottom: '16px', fontSize: '13px' },
  success: { background: '#0f2a1a', border: '1px solid #3fb950', color: '#3fb950', borderRadius: '6px', padding: '12px 14px', marginBottom: '16px', fontSize: '13px' },
  hint: { color: '#8b949e', fontSize: '12px', marginTop: '-14px', marginBottom: '20px' },
  backLink: { display: 'block', textAlign: 'center' as const, color: '#58a6ff', fontSize: '13px', textDecoration: 'none', marginTop: '8px' },
};

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!token) {
    return (
      <div style={s.page}>
        <div style={s.card}>
          <div style={s.title}>Fission Ops</div>
          <div style={s.error}>Invalid reset link. Please request a new one.</div>
          <Link to="/forgot-password" style={s.backLink}>Request a new reset link</Link>
        </div>
      </div>
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      await apiClient.post('/auth/reset-password', { token, password });
      setSuccess(true);
    } catch (err: unknown) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setError((err as any)?.response?.data?.error ?? 'Failed to reset password. The link may have expired.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={s.title}>Fission Ops</div>
        <div style={s.sub}>Set a new password</div>

        {success ? (
          <>
            <div style={s.success}>Password reset successfully.</div>
            <Link to="/login" style={s.backLink}>Sign in with your new password</Link>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            {error && <div style={s.error}>{error}</div>}
            <label style={s.label}>New Password</label>
            <input
              style={s.input}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <div style={s.hint}>Minimum 15 characters</div>
            <label style={s.label}>Confirm Password</label>
            <input
              style={s.input}
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
            />
            <button type="submit" style={s.btn} disabled={loading}>
              {loading ? 'Resetting…' : 'Reset Password'}
            </button>
            <Link to="/login" style={s.backLink}>Back to Login</Link>
          </form>
        )}
      </div>
    </div>
  );
}
