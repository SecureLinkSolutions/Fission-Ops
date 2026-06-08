import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../api/client';
import { useFetch } from '../hooks/useFetch';
import { ManagedUser, UserRole, Incident } from '../types';
import { useAuth } from '../context/AuthContext';
import { validatePassword, policyHint, STANDARD_MIN } from '../utils/passwordPolicy';

const ROLE_COLORS: Record<UserRole, string> = {
  analyst: '#3fb950',
  senior_analyst: '#58a6ff',
  incident_commander: '#a371f7',
  platform_admin: '#f0883e',
};

const ROLE_LABELS: Record<UserRole, string> = {
  analyst: 'Analyst',
  senior_analyst: 'Senior Analyst',
  incident_commander: 'Incident Commander',
  platform_admin: 'Platform Admin',
};

function roleBadge(role: UserRole) {
  const color = ROLE_COLORS[role] ?? '#8b949e';
  return (
    <span style={{ background: `${color}22`, color, border: `1px solid ${color}44`, borderRadius: '12px', padding: '2px 10px', fontSize: '11px', fontWeight: 600 }}>
      {ROLE_LABELS[role] ?? role.replace(/_/g, ' ')}
    </span>
  );
}

function formatDate(d: string | null) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString();
}

const inputStyle: React.CSSProperties = {
  background: '#0d1117', border: '1px solid #30363d', borderRadius: '6px',
  padding: '8px 12px', color: '#e6edf3', fontSize: '13px', width: '100%',
};
const selectStyle: React.CSSProperties = { ...inputStyle };
const btnStyle: React.CSSProperties = {
  background: '#238636', border: 'none', borderRadius: '6px',
  padding: '8px 16px', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
};
const smallBtnStyle: React.CSSProperties = {
  background: '#21262d', border: '1px solid #30363d', borderRadius: '4px',
  padding: '4px 10px', color: '#8b949e', fontSize: '12px', cursor: 'pointer',
};

export default function UserManagement() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('analyst');
  const [newPassword, setNewPassword] = useState('');
  const [createError, setCreateError] = useState('');
  const [createLoading, setCreateLoading] = useState(false);

  const [selectedIncidentId, setSelectedIncidentId] = useState('');
  const [assignUserId, setAssignUserId] = useState('');

  if (user?.role !== 'incident_commander') {
    navigate('/incidents');
    return null;
  }

  const { data: users, refetch: refetchUsers } = useFetch<ManagedUser[]>(
    () => apiClient.get('/users').then((r) => r.data),
    [],
  );

  const { data: incidents } = useFetch<{ incidents: Incident[] }>(
    () => apiClient.get('/incidents?limit=100').then((r) => r.data),
    [],
  );

  const { data: assignments, refetch: refetchAssignments } = useFetch<unknown[]>(
    () => selectedIncidentId
      ? apiClient.get(`/incidents/${selectedIncidentId}/assignments`).then((r) => r.data)
      : Promise.resolve([]),
    [selectedIncidentId],
  );

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    setCreateError('');
    setCreateLoading(true);
    try {
      await apiClient.post('/users', { email: newEmail, name: newName, role: newRole, password: newPassword });
      setNewEmail(''); setNewName(''); setNewPassword('');
      refetchUsers();
    } catch (err: unknown) {
      setCreateError((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Failed to create user');
    } finally {
      setCreateLoading(false);
    }
  }

  async function deactivate(id: string) {
    await apiClient.patch(`/users/${id}/deactivate`);
    refetchUsers();
  }

  async function reactivate(id: string) {
    await apiClient.patch(`/users/${id}/reactivate`);
    refetchUsers();
  }

  async function changeRole(id: string, role: UserRole) {
    await apiClient.patch(`/users/${id}/role`, { role });
    refetchUsers();
  }

  async function resetPassword(id: string, role: UserRole) {
    const hint = policyHint(role);
    const pw = window.prompt(`Enter new password (${hint}):`);
    if (!pw) return;
    const check = validatePassword(pw, role);
    if (!check.valid) { alert(`Password does not meet policy:\n• ${check.errors.join('\n• ')}`); return; }
    await apiClient.patch(`/users/${id}/password`, { password: pw });
    alert('Password reset. User must reset on next login.');
  }

  async function assignUser() {
    if (!selectedIncidentId || !assignUserId) return;
    await apiClient.post(`/incidents/${selectedIncidentId}/assignments`, { user_id: assignUserId });
    setAssignUserId('');
    refetchAssignments();
  }

  async function removeAssignment(userId: string) {
    await apiClient.delete(`/incidents/${selectedIncidentId}/assignments/${userId}`);
    refetchAssignments();
  }

  return (
    <div style={{ padding: '32px', maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{ fontSize: '24px', fontWeight: 700, color: '#e6edf3', marginBottom: '24px' }}>User Management</div>

      {/* Create user form */}
      <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: '8px', padding: '20px', marginBottom: '24px' }}>
        <div style={{ fontSize: '16px', fontWeight: 600, color: '#e6edf3', marginBottom: '16px' }}>Create User</div>
        {createError && <div style={{ background: '#3d1a1a', border: '1px solid #f85149', color: '#f85149', borderRadius: '6px', padding: '8px 12px', marginBottom: '12px', fontSize: '13px' }}>{createError}</div>}
        <form onSubmit={createUser} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr auto', gap: '12px', alignItems: 'end' }}>
          <div>
            <div style={{ color: '#8b949e', fontSize: '11px', marginBottom: '4px', textTransform: 'uppercase' }}>Email</div>
            <input style={inputStyle} type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} required />
          </div>
          <div>
            <div style={{ color: '#8b949e', fontSize: '11px', marginBottom: '4px', textTransform: 'uppercase' }}>Name</div>
            <input style={inputStyle} value={newName} onChange={(e) => setNewName(e.target.value)} required />
          </div>
          <div>
            <div style={{ color: '#8b949e', fontSize: '11px', marginBottom: '4px', textTransform: 'uppercase' }}>Role</div>
            <select style={selectStyle} value={newRole} onChange={(e) => setNewRole(e.target.value as UserRole)}>
              <option value="analyst">Analyst</option>
              <option value="senior_analyst">Senior Analyst</option>
              <option value="incident_commander">Incident Commander</option>
            </select>
          </div>
          <div>
            <div style={{ color: '#8b949e', fontSize: '11px', marginBottom: '4px', textTransform: 'uppercase' }}>Password</div>
            <input style={inputStyle} type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} minLength={STANDARD_MIN} required />
          </div>
          <button type="submit" style={btnStyle} disabled={createLoading}>{createLoading ? 'Creating…' : 'Create'}</button>
        </form>
      </div>

      {/* User list */}
      <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: '8px', overflow: 'hidden', marginBottom: '24px' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #30363d', fontSize: '16px', fontWeight: 600, color: '#e6edf3' }}>Users ({users?.length ?? 0})</div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #30363d' }}>
              {['Email', 'Name', 'Role', 'Status', 'Last Login', 'Actions'].map((h) => (
                <th key={h} style={{ padding: '10px 16px', textAlign: 'left', color: '#8b949e', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(users ?? []).map((u) => (
              <tr key={u.id} style={{ borderBottom: '1px solid #21262d', opacity: u.deactivated_at ? 0.6 : 1 }}>
                <td style={{ padding: '10px 16px', color: '#e6edf3', fontSize: '13px' }}>{u.email}</td>
                <td style={{ padding: '10px 16px', color: '#8b949e', fontSize: '13px' }}>{u.name}</td>
                <td style={{ padding: '10px 16px' }}>{roleBadge(u.role)}</td>
                <td style={{ padding: '10px 16px' }}>
                  <span style={{ color: u.deactivated_at ? '#f85149' : '#3fb950', fontSize: '12px' }}>
                    {u.deactivated_at ? 'Deactivated' : 'Active'}
                  </span>
                </td>
                <td style={{ padding: '10px 16px', color: '#8b949e', fontSize: '12px' }}>{formatDate(u.last_login_at)}</td>
                <td style={{ padding: '10px 16px' }}>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {u.deactivated_at ? (
                      <button style={{ ...smallBtnStyle, color: '#3fb950' }} onClick={() => reactivate(u.id)}>Reactivate</button>
                    ) : (
                      <button style={{ ...smallBtnStyle, color: '#f85149' }} onClick={() => deactivate(u.id)}>Deactivate</button>
                    )}
                    <select style={{ ...smallBtnStyle, background: '#21262d' }} value={u.role} onChange={(e) => changeRole(u.id, e.target.value as UserRole)}>
                      <option value="analyst">Analyst</option>
                      <option value="senior_analyst">Senior Analyst</option>
                      <option value="incident_commander">Incident Commander</option>
                    </select>
                    <button style={smallBtnStyle} onClick={() => resetPassword(u.id, u.role)}>Reset PW</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Incident Assignments */}
      <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: '8px', padding: '20px' }}>
        <div style={{ fontSize: '16px', fontWeight: 600, color: '#e6edf3', marginBottom: '16px' }}>Incident Assignments</div>
        <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', alignItems: 'center' }}>
          <select style={{ ...selectStyle, flex: 1 }} value={selectedIncidentId} onChange={(e) => setSelectedIncidentId(e.target.value)}>
            <option value="">Select incident…</option>
            {(incidents?.incidents ?? []).map((inc) => (
              <option key={inc.id} value={inc.id}>{inc.title}</option>
            ))}
          </select>
          {selectedIncidentId && (
            <>
              <select style={{ ...selectStyle, flex: 1 }} value={assignUserId} onChange={(e) => setAssignUserId(e.target.value)}>
                <option value="">Select user to assign…</option>
                {(users ?? []).filter((u) => !u.deactivated_at).map((u) => (
                  <option key={u.id} value={u.id}>{u.email} ({u.role})</option>
                ))}
              </select>
              <button style={btnStyle} onClick={assignUser} disabled={!assignUserId}>Assign</button>
            </>
          )}
        </div>
        {selectedIncidentId && (
          <div>
            {((assignments ?? []) as Array<{ user_id: string; user_email: string; user_name: string; user_role: UserRole; assigned_at: string }>).map((a) => (
              <div key={a.user_id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 12px', background: '#0d1117', border: '1px solid #30363d', borderRadius: '6px', marginBottom: '6px' }}>
                <span style={{ color: '#e6edf3', fontSize: '13px', flex: 1 }}>{a.user_email}</span>
                <span style={{ color: '#8b949e', fontSize: '12px' }}>{a.user_name}</span>
                {roleBadge(a.user_role)}
                <span style={{ color: '#8b949e', fontSize: '11px' }}>{formatDate(a.assigned_at)}</span>
                <button style={{ ...smallBtnStyle, color: '#f85149' }} onClick={() => removeAssignment(a.user_id)}>Remove</button>
              </div>
            ))}
            {(assignments ?? []).length === 0 && (
              <div style={{ color: '#8b949e', fontSize: '14px' }}>No users assigned to this incident.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
