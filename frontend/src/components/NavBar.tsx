import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const styles: Record<string, React.CSSProperties> = {
  nav: { background: '#161b22', borderBottom: '1px solid #30363d', padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  brand: { color: '#58a6ff', fontWeight: 700, fontSize: '18px', textDecoration: 'none' },
  right: { display: 'flex', alignItems: 'center', gap: '16px' },
  role: { color: '#8b949e', fontSize: '12px', background: '#21262d', padding: '4px 8px', borderRadius: '4px' },
  btn: { background: 'transparent', border: '1px solid #30363d', color: '#8b949e', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer' },
};

export default function NavBar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  return (
    <nav style={styles.nav}>
      <Link to="/incidents" style={styles.brand}>⚡ Fission Ops</Link>
      <div style={styles.right}>
        <span style={styles.role}>{user?.role?.replace(/_/g, ' ').toUpperCase()}</span>
        <span style={{ color: '#e6edf3', fontSize: '14px' }}>{user?.email}</span>
        <button style={styles.btn} onClick={() => { logout(); navigate('/login'); }}>Sign out</button>
      </div>
    </nav>
  );
}
