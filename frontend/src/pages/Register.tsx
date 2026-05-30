import { useState } from 'react';
import { Link } from 'react-router-dom';
import { apiClient } from '../api/client';

export default function Register() {
  const [form, setForm] = useState({ orgName: '', orgSlug: '', email: '', name: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  const handleOrgName = (v: string) => setForm((f) => ({ ...f, orgName: v, orgSlug: slugify(v) }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirm) { setError('Passwords do not match'); return; }
    if (form.password.length < 8) { setError('Password must be at least 8 characters'); return; }
    setLoading(true);
    try {
      const { data } = await apiClient.post('/auth/register', {
        orgName: form.orgName,
        orgSlug: form.orgSlug,
        email: form.email,
        name: form.name,
        password: form.password,
      });
      localStorage.setItem('token', data.token);
      window.location.href = '/onboarding';
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg ?? 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', background: '#0d1117', border: '1px solid #30363d',
    borderRadius: '6px', color: '#e6edf3', fontSize: '14px', boxSizing: 'border-box',
  };
  const labelStyle: React.CSSProperties = { display: 'block', color: '#8b949e', fontSize: '13px', marginBottom: '4px' };

  return (
    <div style={{ minHeight: '100vh', background: '#0d1117', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ width: '100%', maxWidth: '440px' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ fontSize: '32px', fontWeight: 800, color: '#58a6ff', marginBottom: '8px' }}>⚡ Fission Ops</div>
          <div style={{ color: '#8b949e', fontSize: '14px' }}>Create your organization account</div>
        </div>
        <form onSubmit={handleSubmit} style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: '12px', padding: '32px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ borderBottom: '1px solid #30363d', paddingBottom: '16px', marginBottom: '4px' }}>
            <div style={{ color: '#8b949e', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>Organization</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={labelStyle}>Organization Name</label>
                <input style={inputStyle} value={form.orgName} onChange={(e) => handleOrgName(e.target.value)} placeholder="Acme Security" required />
              </div>
              <div>
                <label style={labelStyle}>Slug</label>
                <input style={inputStyle} value={form.orgSlug} onChange={(e) => setForm((f) => ({ ...f, orgSlug: e.target.value }))} placeholder="acme-security" pattern="[a-z0-9-]+" required />
                <div style={{ color: '#484f58', fontSize: '11px', marginTop: '4px' }}>Lowercase letters, numbers, hyphens only</div>
              </div>
            </div>
          </div>
          <div>
            <div style={{ color: '#8b949e', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>Admin Account</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={labelStyle}>Full Name</label>
                <input style={inputStyle} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Jane Doe" required />
              </div>
              <div>
                <label style={labelStyle}>Email</label>
                <input style={inputStyle} type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="admin@example.com" required />
              </div>
              <div>
                <label style={labelStyle}>Password</label>
                <input style={inputStyle} type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} placeholder="Min 8 characters" required />
              </div>
              <div>
                <label style={labelStyle}>Confirm Password</label>
                <input style={inputStyle} type="password" value={form.confirm} onChange={(e) => setForm((f) => ({ ...f, confirm: e.target.value }))} placeholder="Repeat password" required />
              </div>
            </div>
          </div>
          {error && <div style={{ background: '#f8514922', border: '1px solid #f8514944', borderRadius: '6px', padding: '10px 14px', color: '#f85149', fontSize: '13px' }}>{error}</div>}
          <button type="submit" disabled={loading} style={{ padding: '12px', background: '#238636', border: 'none', borderRadius: '6px', color: '#fff', fontSize: '14px', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}>
            {loading ? 'Creating account…' : 'Create Organization'}
          </button>
          <div style={{ textAlign: 'center', color: '#8b949e', fontSize: '13px' }}>
            Already have an account? <Link to="/login" style={{ color: '#58a6ff' }}>Sign in</Link>
          </div>
        </form>
      </div>
    </div>
  );
}
