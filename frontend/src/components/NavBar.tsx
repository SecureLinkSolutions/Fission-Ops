import { useState } from 'react';
import { Link, useNavigate, useMatch } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import NotificationBell from './NotificationBell';

const styles: Record<string, React.CSSProperties> = {
  nav: { background: '#161b22', borderBottom: '1px solid #30363d', padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  brand: { color: '#58a6ff', fontWeight: 700, fontSize: '18px', textDecoration: 'none' },
  right: { display: 'flex', alignItems: 'center', gap: '16px' },
  role: { color: '#8b949e', fontSize: '12px', background: '#21262d', padding: '4px 8px', borderRadius: '4px' },
  btn: { background: 'transparent', border: '1px solid #30363d', color: '#8b949e', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer' },
  adminBtn: { background: 'transparent', border: '1px solid #30363d', color: '#a371f7', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', position: 'relative' as const },
  dropdown: { position: 'absolute' as const, top: '100%', right: 0, background: '#161b22', border: '1px solid #30363d', borderRadius: '6px', minWidth: '160px', zIndex: 100, marginTop: '4px' },
  dropdownItem: { display: 'block', padding: '10px 16px', color: '#e6edf3', textDecoration: 'none', fontSize: '13px' },
};

interface ConnectionDotProps {
  state: 'connected' | 'reconnecting' | 'disconnected';
}

function ConnectionDot({ state }: ConnectionDotProps) {
  const color = state === 'connected' ? '#3fb950' : state === 'reconnecting' ? '#d29922' : '#8b949e';
  const title = state === 'connected' ? 'Connected' : state === 'reconnecting' ? 'Reconnecting…' : 'Disconnected';
  return (
    <span title={title} style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: color }} />
  );
}

interface NavBarProps {
  connectionState?: 'connected' | 'reconnecting' | 'disconnected';
}

export default function NavBar({ connectionState }: NavBarProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [adminOpen, setAdminOpen] = useState(false);
  const onIncidentPage = useMatch('/incidents/:id/*') || useMatch('/incidents/:id');

  return (
    <nav style={styles.nav}>
      <Link to="/incidents" style={styles.brand}>⚡ Fission Ops</Link>
      <div style={styles.right}>
        {onIncidentPage && connectionState && <ConnectionDot state={connectionState} />}
        <Link to="/tasks/mine" style={{ color: '#8b949e', fontSize: '13px', textDecoration: 'none' }}>My Tasks</Link>
        <NotificationBell />
        <span style={styles.role}>{user?.role?.replace(/_/g, ' ').toUpperCase()}</span>
        <span style={{ color: '#e6edf3', fontSize: '14px' }}>{user?.email}</span>
        {(user?.role === 'incident_commander' || user?.role === 'super_admin') && (
          <div style={{ position: 'relative' }}>
            <button style={styles.adminBtn} onClick={() => setAdminOpen(!adminOpen)}>
              Admin ▾
            </button>
            {adminOpen && (
              <div style={styles.dropdown} onMouseLeave={() => setAdminOpen(false)}>
                <Link to="/admin/audit" style={styles.dropdownItem} onClick={() => setAdminOpen(false)}>Audit Log</Link>
                <Link to="/admin/users" style={styles.dropdownItem} onClick={() => setAdminOpen(false)}>Users</Link>
                <Link to="/settings/org" style={styles.dropdownItem} onClick={() => setAdminOpen(false)}>Org Settings</Link>
                {user?.role === 'super_admin' && (
                  <Link to="/superadmin" style={{ ...styles.dropdownItem, color: '#a371f7' }} onClick={() => setAdminOpen(false)}>Super Admin</Link>
                )}
              </div>
            )}
          </div>
        )}
        <button style={styles.btn} onClick={() => { logout(); navigate('/login'); }}>Sign out</button>
      </div>
    </nav>
  );
}
