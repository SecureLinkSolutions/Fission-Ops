import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function SSOCallback() {
  const navigate = useNavigate();
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');
  const error = params.get('error');

  useEffect(() => {
    if (token) {
      localStorage.setItem('token', token);
      // Reload to let AuthContext pick up the token
      window.location.href = '/incidents';
    }
  }, [token, navigate]);

  if (error) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0d1117' }}>
        <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: '12px', padding: '40px', width: '400px', textAlign: 'center' }}>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#f85149', marginBottom: '16px' }}>SSO Error</div>
          <div style={{ color: '#8b949e', marginBottom: '24px', fontSize: '14px' }}>{decodeURIComponent(error)}</div>
          <a href="/login" style={{ color: '#58a6ff', textDecoration: 'none', fontSize: '14px' }}>← Back to Login</a>
        </div>
      </div>
    );
  }

  if (!token) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0d1117' }}>
        <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: '12px', padding: '40px', width: '400px', textAlign: 'center' }}>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#f85149', marginBottom: '16px' }}>SSO Failed</div>
          <div style={{ color: '#8b949e', marginBottom: '24px', fontSize: '14px' }}>No token received from SSO provider.</div>
          <a href="/login" style={{ color: '#58a6ff', textDecoration: 'none', fontSize: '14px' }}>← Back to Login</a>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0d1117' }}>
      <div style={{ color: '#8b949e', fontSize: '14px' }}>Signing in…</div>
    </div>
  );
}

