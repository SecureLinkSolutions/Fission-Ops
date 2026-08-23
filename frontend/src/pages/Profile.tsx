import { useState, useEffect, FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../api/client';

const s: Record<string, React.CSSProperties> = {
  page: { padding: '40px 32px', background: '#0d1117', minHeight: '100vh', color: '#e6edf3' },
  heading: { fontSize: '20px', fontWeight: 700, marginBottom: '24px' },
  card: { background: '#161b22', border: '1px solid #30363d', borderRadius: '8px', padding: '24px', marginBottom: '24px', maxWidth: '540px' },
  sectionTitle: { fontSize: '13px', fontWeight: 700, color: '#8b949e', textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: '16px' },
  label: { display: 'block', fontSize: '12px', color: '#8b949e', fontWeight: 600, marginBottom: '6px' },
  input: { width: '100%', boxSizing: 'border-box' as const, background: '#0d1117', border: '1px solid #30363d', borderRadius: '6px', padding: '9px 12px', color: '#e6edf3', fontSize: '14px', outline: 'none', marginBottom: '14px' },
  readOnly: { width: '100%', boxSizing: 'border-box' as const, background: '#0d111700', border: '1px solid #21262d', borderRadius: '6px', padding: '9px 12px', color: '#8b949e', fontSize: '14px', marginBottom: '14px' },
  btn: { background: '#238636', border: '1px solid #2ea043', borderRadius: '6px', padding: '8px 18px', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer' },
  btnGhost: { background: 'transparent', border: '1px solid #30363d', borderRadius: '6px', padding: '8px 18px', color: '#8b949e', fontSize: '13px', cursor: 'pointer' },
  error: { background: '#3d1a1a', border: '1px solid #f8514966', color: '#f85149', borderRadius: '6px', padding: '10px 14px', marginBottom: '14px', fontSize: '13px' },
  success: { background: '#0f2a1a', border: '1px solid #3fb95066', color: '#3fb950', borderRadius: '6px', padding: '10px 14px', marginBottom: '14px', fontSize: '13px' },
  hint: { color: '#8b949e', fontSize: '12px', marginTop: '-10px', marginBottom: '14px' },
  roleBadge: { display: 'inline-block', background: '#58a6ff22', color: '#58a6ff', border: '1px solid #58a6ff44', borderRadius: '12px', padding: '2px 10px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' as const },
  row: { display: 'flex', gap: '8px', alignItems: 'center' },
};

export default function Profile() {
  const { user, setUser } = useAuth();

  const [name, setName] = useState(user?.name ?? '');
  const [savingName, setSavingName] = useState(false);
  const [nameMsg, setNameMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPw, setSavingPw] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => { setName(user?.name ?? ''); }, [user]);

  async function handleSaveName(e: FormEvent) {
    e.preventDefault();
    setSavingName(true);
    setNameMsg(null);
    try {
      const res = await apiClient.patch<{ name: string }>('/users/me', { name });
      if (user) setUser({ ...user, name: res.data.name });
      setNameMsg({ type: 'success', text: 'Name updated.' });
    } catch (err: unknown) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setNameMsg({ type: 'error', text: (err as any)?.response?.data?.error ?? 'Failed to update name.' });
    } finally {
      setSavingName(false);
    }
  }

  async function handleChangePassword(e: FormEvent) {
    e.preventDefault();
    setPwMsg(null);
    if (newPassword !== confirmPassword) {
      setPwMsg({ type: 'error', text: 'Passwords do not match.' });
      return;
    }
    setSavingPw(true);
    try {
      await apiClient.post('/users/me/change-password', {
        current_password: currentPassword,
        new_password: newPassword,
      });
      if (user) setUser({ ...user, password_reset_required: false });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPwMsg({ type: 'success', text: 'Password updated successfully.' });
    } catch (err: unknown) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setPwMsg({ type: 'error', text: (err as any)?.response?.data?.error ?? 'Failed to update password.' });
    } finally {
      setSavingPw(false);
    }
  }

  const roleLabel: Record<string, string> = {
    analyst: 'Analyst',
    senior_analyst: 'Senior Analyst',
    incident_commander: 'Incident Commander',
    platform_admin: 'Platform Admin',
  };

  return (
    <div style={s.page}>
      <div style={s.heading}>My Profile</div>

      {/* Account info */}
      <div style={s.card}>
        <div style={s.sectionTitle}>Account</div>

        <label style={s.label}>Email</label>
        <div style={s.readOnly}>{user?.email}</div>

        <label style={s.label}>Role</label>
        <div style={{ marginBottom: '14px' }}>
          <span style={s.roleBadge}>{roleLabel[user?.role ?? ''] ?? user?.role}</span>
        </div>

        <form onSubmit={handleSaveName}>
          <label style={s.label}>Display name</label>
          <input
            style={s.input}
            value={name}
            onChange={(e) => setName(e.target.value)}
            minLength={1}
            required
          />
          {nameMsg && <div style={nameMsg.type === 'success' ? s.success : s.error}>{nameMsg.text}</div>}
          <div style={s.row}>
            <button type="submit" style={s.btn} disabled={savingName}>
              {savingName ? 'Saving…' : 'Save name'}
            </button>
          </div>
        </form>
      </div>

      {/* Change password */}
      <div style={s.card}>
        <div style={s.sectionTitle}>Change Password</div>

        <form onSubmit={handleChangePassword}>
          <label style={s.label}>Current password</label>
          <input style={s.input} type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />

          <label style={s.label}>New password</label>
          <input style={s.input} type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
          <div style={s.hint}>Minimum 15 characters</div>

          <label style={s.label}>Confirm new password</label>
          <input style={s.input} type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />

          {pwMsg && <div style={pwMsg.type === 'success' ? s.success : s.error}>{pwMsg.text}</div>}

          <button type="submit" style={s.btn} disabled={savingPw}>
            {savingPw ? 'Updating…' : 'Update password'}
          </button>
        </form>
      </div>
    </div>
  );
}
