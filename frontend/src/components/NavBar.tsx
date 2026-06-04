import { useState } from 'react';
import { Link, useNavigate, useMatch, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import NotificationBell from './NotificationBell';

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

interface NavLinkProps {
  to: string;
  icon: string;
  label: string;
  active: boolean;
}

function NavLink({ to, icon, label, active }: NavLinkProps) {
  const [hover, setHover] = useState(false);
  return (
    <Link
      to={to}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '9px 16px',
        textDecoration: 'none',
        borderRadius: '6px',
        marginBottom: '2px',
        color: active ? '#e6edf3' : hover ? '#c9d1d9' : '#8b949e',
        background: active ? '#58a6ff11' : hover ? '#21262d' : 'transparent',
        borderLeft: active ? '3px solid #58a6ff' : '3px solid transparent',
        fontWeight: active ? 600 : 400,
        fontSize: '14px',
        transition: 'none',
      }}
    >
      <span style={{ fontSize: '16px', lineHeight: 1 }}>{icon}</span>
      {label}
    </Link>
  );
}

interface NavBarProps {
  connectionState?: 'connected' | 'reconnecting' | 'disconnected';
}

export default function NavBar({ connectionState }: NavBarProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const onIncidentPage = useMatch('/incidents/:id/*') || useMatch('/incidents/:id');

  const isAdmin = user?.role === 'incident_commander' || user?.role === 'super_admin';

  return (
    <nav style={{
      width: '220px',
      minHeight: '100vh',
      background: '#161b22',
      borderRight: '1px solid #30363d',
      display: 'flex',
      flexDirection: 'column',
      position: 'fixed',
      top: 0,
      left: 0,
      zIndex: 100,
    }}>
      {/* Brand */}
      <div style={{ padding: '20px 16px 16px', borderBottom: '1px solid #30363d' }}>
        <Link to="/incidents" style={{ color: '#58a6ff', fontWeight: 700, fontSize: '17px', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>⚡</span> Fission Ops
        </Link>
      </div>

      {/* Connection dot for incident pages */}
      {onIncidentPage && connectionState && (
        <div style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <ConnectionDot state={connectionState} />
          <span style={{ fontSize: '11px', color: '#8b949e' }}>
            {connectionState === 'connected' ? 'Live' : connectionState === 'reconnecting' ? 'Reconnecting…' : 'Offline'}
          </span>
        </div>
      )}

      {/* Nav links */}
      <div style={{ padding: '12px 8px', flex: 1 }}>
        <NavLink to="/incidents" icon="⚡" label="Incidents" active={location.pathname.startsWith('/incidents')} />
        <NavLink to="/tasks/mine" icon="✅" label="My Tasks" active={location.pathname.startsWith('/tasks')} />
        <div style={{ padding: '4px 16px' }}><NotificationBell /></div>
        {isAdmin && (
          <>
            <div style={{ padding: '12px 16px 4px', color: '#484f58', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: '8px' }}>Admin</div>
            <NavLink to="/admin/audit" icon="📋" label="Audit Log" active={location.pathname === '/admin/audit'} />
            <NavLink to="/admin/users" icon="👥" label="Users" active={location.pathname === '/admin/users'} />
            <NavLink to="/settings/org" icon="🔐" label="Org Settings" active={location.pathname === '/settings/org'} />
            {user?.role === 'super_admin' && (
              <NavLink to="/superadmin" icon="🛡" label="Super Admin" active={location.pathname === '/superadmin'} />
            )}
          </>
        )}
      </div>

      {/* Footer - user info + sign out */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid #30363d' }}>
        <div style={{ marginBottom: '8px' }}>
          <div style={{ color: '#e6edf3', fontSize: '12px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.email}</div>
          <div style={{ background: '#21262d', color: '#8b949e', fontSize: '10px', fontWeight: 600, borderRadius: '4px', padding: '2px 6px', display: 'inline-block', marginTop: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {user?.role?.replace(/_/g, ' ')}
          </div>
        </div>
        <button
          onClick={() => { logout(); navigate('/login'); }}
          style={{
            background: 'transparent',
            border: '1px solid #30363d',
            color: '#8b949e',
            padding: '5px 12px',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '12px',
            width: '100%',
          }}
        >
          Sign out
        </button>
      </div>
    </nav>
  );
}
