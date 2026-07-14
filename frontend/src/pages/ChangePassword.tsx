import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../api/client';

const s: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0d1117' },
  card: { background: '#161b22', border: '1px solid #30363d', borderRadius: '12px', padding: '40px', width: '420px' },
  title: { fontSize: '22px', fontWeight: 700, marginBottom: '8px', color: '#e6edf3' },
  banner: { background: '#1c2033', border: '1px solid #58a6ff', color: '#58a6ff', borderRadius: '6px', padding: '10px 14px', marginBottom: '24px', fontSize: '13px' },
  label: { display: 'block', color: '#8b949e', fontSize: '12px', fontWeight: 600, marginBottom: '6px', textTransform: 'uppercase' as const },
  input: { width: '100%', background: '#0d1117', border: '1px solid #30363d', borderRadius: '6px', padding: '10px 14px', color: '#e6edf3', fontSize: '14px', outline: 'none', marginBottom: '20px', boxSizing: 'border-box' as const },
  btn: { width: '100%', background: '#238636', border: 'none', borderRadius: '6px', padding: '12px', color: '#fff', fontSize: '14px', fontWeight: 600, cursor: 'pointer', marginBottom: '12px' },
  error: { background: '#3d1a1a', border: '1px solid #f85149', color: '#f85149', borderRadius: '6px', padding: '10px 14px', marginBottom: '16px', fontSize: '13px' },
  success: { background: '#0f2a1a', border: '1px solid #3fb950', color: '#3fb950', borderRadius: '6px', padding: '12px 14px', marginBottom: '16px', fontSize: '13px' },
  hint: { color: '#8b949e', fontSize: '12px', marginTop: '-14px', marginBottom: '20px' },
};

export default function ChangePassword() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const isForced = user?.password_reset_required === true;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (newPassword !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      await apiClient.post('/users/me/change-password', {
        current_password: currentPassword,
        new_password: newPassword,
      });
      // Clear password_reset_required in context
      if (user) {
        setUser({ ...user, password_reset_required: false });
      }
      navigate('/incidents');
    } catch (err: unknown) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setError((err as any)?.response?.data?.error ?? 'Failed to change password.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={s.title}>Change Password</div>

        {isForced && (
          <div style={s.banner}>
            Your administrator has required you to set a new password before continuing.
          </div>
        )}

        {error && <div style={s.error}>{error}</div>}

        <form onSubmit={handleSubmit}>
          <label style={s.label}>Current Password</label>
          <input
            style={s.input}
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
          />
          <label style={s.label}>New Password</label>
          <input
            style={s.input}
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
          />
          <div style={s.hint}>Minimum 15 characters</div>
          <label style={s.label}>Confirm New Password</label>
          <input
            style={s.input}
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />
          <button type="submit" style={s.btn} disabled={loading}>
            {loading ? 'Updating…' : 'Update Password'}
          </button>
        </form>
      </div>
    </div>
  );
}
