import { useLocation, Link, useParams } from 'react-router-dom';
import NotificationBell from './NotificationBell';
import { useAuth } from '../context/AuthContext';
import logoUrl from '../assets/logo.svg';

// Derive a readable breadcrumb from the current path
function useBreadcrumb(): { label: string; href?: string }[] {
  const location = useLocation();
  const { id, entityId } = useParams<{ id?: string; entityId?: string }>();
  const parts = location.pathname.split('/').filter(Boolean);

  if (parts[0] === 'incidents' && !id) return [{ label: 'Incidents' }];
  if (parts[0] === 'incidents' && id && !entityId) return [{ label: 'Incidents', href: '/incidents' }, { label: 'Incident Detail' }];
  if (parts[0] === 'incidents' && entityId) return [{ label: 'Incidents', href: '/incidents' }, { label: 'Incident', href: `/incidents/${id}` }, { label: 'Entity' }];
  if (parts[0] === 'tasks') return [{ label: 'My Tasks' }];
  if (parts[0] === 'settings') return [{ label: 'Settings' }, { label: 'Organisation' }];
  if (parts[0] === 'admin' && parts[1] === 'audit') return [{ label: 'Admin' }, { label: 'Audit Log' }];
  if (parts[0] === 'admin' && parts[1] === 'users') return [{ label: 'Admin' }, { label: 'User Management' }];
  return [{ label: parts[0] ?? '' }];
}

export default function TopBar() {
  const { user } = useAuth();
  const crumbs = useBreadcrumb();

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: '220px',
      right: 0,
      height: '48px',
      background: '#161b22',
      borderBottom: '1px solid #30363d',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 24px',
      zIndex: 90,
    }}>
      {/* Breadcrumb */}
      <nav style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <img src={logoUrl} alt="" style={{ width: '18px', height: '18px', marginRight: '4px', opacity: 0.85 }} />
        {crumbs.map((crumb, i) => (
          <span key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {i > 0 && <span style={{ color: '#30363d', fontSize: '14px' }}>/</span>}
            {crumb.href ? (
              <Link
                to={crumb.href}
                style={{ color: '#6e7681', fontSize: '13px', textDecoration: 'none', fontWeight: 400 }}
                onMouseOver={e => (e.currentTarget.style.color = '#58a6ff')}
                onMouseOut={e => (e.currentTarget.style.color = '#6e7681')}
              >
                {crumb.label}
              </Link>
            ) : (
              <span style={{ color: '#e6edf3', fontSize: '13px', fontWeight: 500 }}>{crumb.label}</span>
            )}
          </span>
        ))}
      </nav>

      {/* Right side: notifications + user chip */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <NotificationBell />
        <div style={{ width: '1px', height: '20px', background: '#30363d' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: '28px', height: '28px', borderRadius: '50%',
            background: '#58a6ff22', border: '1px solid #58a6ff44',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#58a6ff', fontSize: '11px', fontWeight: 700,
          }}>
            {(user?.email?.[0] ?? '?').toUpperCase()}
          </div>
          <div>
            <div style={{ color: '#e6edf3', fontSize: '12px', fontWeight: 500, lineHeight: 1.2 }}>{user?.email}</div>
            <div style={{ color: '#6e7681', fontSize: '10px', lineHeight: 1.2, textTransform: 'capitalize' }}>{user?.role?.replace(/_/g, ' ')}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
