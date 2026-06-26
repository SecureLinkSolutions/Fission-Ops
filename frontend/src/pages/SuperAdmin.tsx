import { useState, useEffect, FormEvent } from 'react';
import { apiClient } from '../api/client';

interface Org {
  id: string;
  name: string;
  slug: string;
  tier: string;
  active: boolean;
  created_at: string;
}

interface OrgWithStats extends Org {
  stats: { incident_count: number; entity_count: number; active_user_count: number };
}

const s: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', background: '#0d1117', padding: '32px 24px', color: '#e6edf3' },
  container: { maxWidth: '960px', margin: '0 auto' },
  title: { fontSize: '22px', fontWeight: 700, marginBottom: '4px' },
  sub: { color: '#8b949e', fontSize: '14px', marginBottom: '32px' },
  section: { background: '#161b22', border: '1px solid #30363d', borderRadius: '10px', padding: '24px', marginBottom: '24px' },
  sectionTitle: { fontSize: '16px', fontWeight: 600, marginBottom: '16px', color: '#e6edf3' },
  table: { width: '100%', borderCollapse: 'collapse' as const },
  th: { textAlign: 'left' as const, color: '#8b949e', fontSize: '12px', fontWeight: 600, padding: '8px 12px', borderBottom: '1px solid #30363d', textTransform: 'uppercase' as const },
  td: { padding: '10px 12px', fontSize: '13px', color: '#e6edf3', borderBottom: '1px solid #21262d' },
  badgeActive: { display: 'inline-block', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 600, background: '#1a3a1a', color: '#3fb950', border: '1px solid #3fb95044' },
  badgeInactive: { display: 'inline-block', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 600, background: '#3a1a1a', color: '#f85149', border: '1px solid #f8514944' },
  tierBadge: { background: '#21262d', border: '1px solid #30363d', borderRadius: '12px', padding: '2px 8px', fontSize: '11px', color: '#58a6ff' },
  btn: { background: '#21262d', border: '1px solid #30363d', borderRadius: '4px', padding: '4px 10px', color: '#e6edf3', fontSize: '12px', cursor: 'pointer', marginRight: '4px' },
  btnDanger: { background: '#3d1a1a', border: '1px solid #f8514944', borderRadius: '4px', padding: '4px 10px', color: '#f85149', fontSize: '12px', cursor: 'pointer' },
  label: { display: 'block', color: '#8b949e', fontSize: '12px', fontWeight: 600, marginBottom: '6px', textTransform: 'uppercase' as const },
  input: { width: '100%', background: '#0d1117', border: '1px solid #30363d', borderRadius: '6px', padding: '8px 12px', color: '#e6edf3', fontSize: '14px', outline: 'none', marginBottom: '12px', boxSizing: 'border-box' as const },
  select: { width: '100%', background: '#0d1117', border: '1px solid #30363d', borderRadius: '6px', padding: '8px 12px', color: '#e6edf3', fontSize: '14px', outline: 'none', marginBottom: '12px', boxSizing: 'border-box' as const },
  createBtn: { background: '#238636', border: 'none', borderRadius: '6px', padding: '10px 20px', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer' },
  error: { color: '#f85149', fontSize: '13px', marginBottom: '8px' },
  success: { color: '#3fb950', fontSize: '13px', marginBottom: '8px' },
};

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export default function SuperAdmin() {
  const [orgs, setOrgs] = useState<OrgWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: '', slug: '', tier: 'standard', adminEmail: '', adminPassword: '' });
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadOrgs();
  }, []);

  async function loadOrgs() {
    setLoading(true);
    try {
      const r = await apiClient.get<Org[]>('/organizations');
      // Fetch stats for each org in parallel
      const withStats = await Promise.all(
        r.data.map(async (org) => {
          try {
            const sr = await apiClient.get<OrgWithStats>(`/organizations/${org.id}`);
            return sr.data;
          } catch {
            return { ...org, stats: { incident_count: 0, entity_count: 0, active_user_count: 0 } };
          }
        }),
      );
      setOrgs(withStats);
    } finally {
      setLoading(false);
    }
  }

  async function handleDeactivate(id: string) {
    if (!confirm('Deactivate this organization?')) return;
    await apiClient.patch(`/organizations/${id}/deactivate`);
    loadOrgs();
  }

  async function handleReactivate(id: string) {
    await apiClient.patch(`/organizations/${id}/reactivate`);
    loadOrgs();
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');
    setCreating(true);
    try {
      await apiClient.post('/organizations', { name: form.name, slug: form.slug, tier: form.tier });
      setFormSuccess(`Organization "${form.name}" created.`);
      setForm({ name: '', slug: '', tier: 'standard', adminEmail: '', adminPassword: '' });
      loadOrgs();
    } catch (err: unknown) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setFormError((err as any)?.response?.data?.error ?? 'Failed to create organization');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div style={s.page}>
      <div style={s.container}>
        <div style={s.title}>Platform Admin Console</div>
        <div style={s.sub}>Manage all organizations and platform-wide settings.</div>

        {/* Organizations Table */}
        <div style={s.section}>
          <div style={s.sectionTitle}>Organizations ({orgs.length})</div>
          {loading ? (
            <div style={{ color: '#8b949e', fontSize: '13px' }}>Loading…</div>
          ) : (
            <table style={s.table}>
              <thead>
                <tr>
                  <th style={s.th}>Name</th>
                  <th style={s.th}>Slug</th>
                  <th style={s.th}>Tier</th>
                  <th style={s.th}>Status</th>
                  <th style={s.th}>Incidents</th>
                  <th style={s.th}>Users</th>
                  <th style={s.th}>Created</th>
                  <th style={s.th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {orgs.map((org) => (
                  <tr key={org.id}>
                    <td style={s.td}>{org.name}</td>
                    <td style={{ ...s.td, fontFamily: 'monospace', color: '#8b949e' }}>{org.slug}</td>
                    <td style={s.td}><span style={s.tierBadge}>{org.tier}</span></td>
                    <td style={s.td}><span style={org.active ? s.badgeActive : s.badgeInactive}>{org.active ? 'Active' : 'Inactive'}</span></td>
                    <td style={s.td}>{org.stats?.incident_count ?? '—'}</td>
                    <td style={s.td}>{org.stats?.active_user_count ?? '—'}</td>
                    <td style={{ ...s.td, color: '#8b949e' }}>{new Date(org.created_at).toLocaleDateString()}</td>
                    <td style={s.td}>
                      {org.active ? (
                        <button type="button" style={s.btnDanger} onClick={() => handleDeactivate(org.id)}>Deactivate</button>
                      ) : (
                        <button type="button" style={s.btn} onClick={() => handleReactivate(org.id)}>Reactivate</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Create Organization */}
        <div style={s.section}>
          <div style={s.sectionTitle}>Create Organization</div>
          {formError && <div style={s.error}>{formError}</div>}
          {formSuccess && <div style={s.success}>{formSuccess}</div>}
          <form onSubmit={handleCreate}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
              <div>
                <label style={s.label}>Organization Name</label>
                <input style={s.input} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value, slug: slugify(e.target.value) }))} placeholder="Acme Security" required />
              </div>
              <div>
                <label style={s.label}>Slug</label>
                <input style={s.input} value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))} placeholder="acme-security" pattern="[a-z0-9-]+" required />
              </div>
              <div>
                <label style={s.label}>Tier</label>
                <select style={s.select} value={form.tier} onChange={(e) => setForm((f) => ({ ...f, tier: e.target.value }))}>
                  <option value="standard">Standard</option>
                  <option value="enterprise">Enterprise</option>
                </select>
              </div>
            </div>
            <button type="button" style={s.createBtn} type="submit" disabled={creating}>{creating ? 'Creating…' : 'Create Organization'}</button>
          </form>
        </div>
      </div>
    </div>
  );
}
