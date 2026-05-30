import { useState, useEffect, FormEvent, useCallback } from 'react';
import { apiClient } from '../api/client';
import { useAuth } from '../context/AuthContext';

interface OrgStats {
  incident_count: number;
  entity_count: number;
  active_user_count: number;
  ttp_assignment_count: number;
}

interface OrgData {
  id: string;
  name: string;
  slug: string;
  tier: string;
  active: boolean;
  created_at: string;
  stats: OrgStats;
}

const s: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', background: '#0d1117', padding: '32px 24px', color: '#e6edf3' },
  container: { maxWidth: '720px', margin: '0 auto' },
  title: { fontSize: '22px', fontWeight: 700, marginBottom: '4px' },
  sub: { color: '#8b949e', fontSize: '14px', marginBottom: '32px' },
  section: { background: '#161b22', border: '1px solid #30363d', borderRadius: '10px', padding: '24px', marginBottom: '24px' },
  sectionTitle: { fontSize: '16px', fontWeight: 600, marginBottom: '16px', color: '#e6edf3' },
  row: { display: 'flex', alignItems: 'center', marginBottom: '12px', gap: '12px' },
  fieldLabel: { color: '#8b949e', fontSize: '13px', width: '140px', flexShrink: 0 },
  fieldValue: { color: '#e6edf3', fontSize: '13px' },
  badge: { background: '#21262d', border: '1px solid #30363d', borderRadius: '12px', padding: '2px 10px', fontSize: '12px', color: '#58a6ff' },
  input: { background: '#0d1117', border: '1px solid #30363d', borderRadius: '6px', padding: '8px 12px', color: '#e6edf3', fontSize: '14px', outline: 'none' },
  btn: { background: '#238636', border: 'none', borderRadius: '6px', padding: '8px 16px', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer' },
  stat: { background: '#0d1117', border: '1px solid #30363d', borderRadius: '8px', padding: '16px 20px', flex: 1, textAlign: 'center' as const },
  statNum: { fontSize: '28px', fontWeight: 700, color: '#58a6ff' },
  statLabel: { fontSize: '12px', color: '#8b949e', marginTop: '4px' },
  danger: { background: '#161b22', border: '1px solid #6e1a1a', borderRadius: '10px', padding: '24px', marginBottom: '24px' },
  dangerTitle: { fontSize: '16px', fontWeight: 600, marginBottom: '8px', color: '#f85149' },
  ssoRow: { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' },
  ssoLabel: { color: '#8b949e', fontSize: '13px', width: '120px' },
  ssoStatus: (active: boolean): React.CSSProperties => ({ color: active ? '#3fb950' : '#8b949e', fontSize: '13px', fontWeight: 600 }),
};

export default function OrgSettings() {
  const { user } = useAuth();
  const [org, setOrg] = useState<OrgData | null>(null);
  const [editName, setEditName] = useState('');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [apiKeys, setApiKeys] = useState<{ service: string; api_key_masked: string }[]>([]);
  const [keyInputs, setKeyInputs] = useState<Record<string, string>>({ virustotal: '', abuseipdb: '', shodan: '' });
  const [keySaving, setKeySaving] = useState<Record<string, boolean>>({});

  const fetchApiKeys = useCallback(() => {
    apiClient.get<{ service: string; api_key_masked: string }[]>('/organizations/me/api-keys').then((r) => {
      setApiKeys(r.data);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    fetchApiKeys();
  }, [fetchApiKeys]);

  async function handleSaveKey(service: string) {
    const key = keyInputs[service];
    if (!key.trim()) return;
    setKeySaving((prev) => ({ ...prev, [service]: true }));
    try {
      await apiClient.put(`/organizations/me/api-keys/${service}`, { api_key: key });
      setKeyInputs((prev) => ({ ...prev, [service]: '' }));
      fetchApiKeys();
    } finally {
      setKeySaving((prev) => ({ ...prev, [service]: false }));
    }
  }

  async function handleDeleteKey(service: string) {
    await apiClient.delete(`/organizations/me/api-keys/${service}`).catch(() => {});
    fetchApiKeys();
  }

  useEffect(() => {
    apiClient.get<OrgData>('/organizations/me').then((r) => {
      setOrg(r.data);
      setEditName(r.data.name);
    });
  }, []);

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const r = await apiClient.patch<OrgData>('/organizations/me', { name: editName });
      setOrg((prev) => prev ? { ...prev, name: r.data.name } : prev);
      setEditing(false);
      setSuccess('Organization name updated.');
    } catch (err: unknown) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setError((err as any)?.response?.data?.error ?? 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  // Check env-level SSO config via window env hints (not available; show generic status)
  const azureEnabled = false; // Runtime env not exposed to frontend by default
  const oktaEnabled = false;

  if (!org) return <div style={{ ...s.page, color: '#8b949e', textAlign: 'center' }}>Loading…</div>;

  const canEdit = user?.role === 'incident_commander' || user?.role === 'super_admin';

  return (
    <div style={s.page}>
      <div style={s.container}>
        <div style={s.title}>Organization Settings</div>
        <div style={s.sub}>Manage your organization configuration and view usage statistics.</div>

        {/* Org Info */}
        <div style={s.section}>
          <div style={s.sectionTitle}>Organization Info</div>
          {error && <div style={{ color: '#f85149', fontSize: '13px', marginBottom: '12px' }}>{error}</div>}
          {success && <div style={{ color: '#3fb950', fontSize: '13px', marginBottom: '12px' }}>{success}</div>}

          <div style={s.row}>
            <span style={s.fieldLabel}>Name</span>
            {editing && canEdit ? (
              <form onSubmit={handleSave} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input style={s.input} value={editName} onChange={(e) => setEditName(e.target.value)} required />
                <button style={s.btn} type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
                <button type="button" style={{ ...s.btn, background: 'transparent', border: '1px solid #30363d', color: '#8b949e' }} onClick={() => setEditing(false)}>Cancel</button>
              </form>
            ) : (
              <span style={{ ...s.fieldValue, display: 'flex', alignItems: 'center', gap: '10px' }}>
                {org.name}
                {canEdit && <button onClick={() => setEditing(true)} style={{ ...s.btn, padding: '4px 10px', fontSize: '12px', background: '#21262d', border: '1px solid #30363d', color: '#8b949e' }}>Edit</button>}
              </span>
            )}
          </div>
          <div style={s.row}>
            <span style={s.fieldLabel}>Slug</span>
            <span style={{ ...s.fieldValue, fontFamily: 'monospace', color: '#8b949e' }}>{org.slug}</span>
          </div>
          <div style={s.row}>
            <span style={s.fieldLabel}>Tier</span>
            <span style={s.badge}>{org.tier}</span>
          </div>
          <div style={s.row}>
            <span style={s.fieldLabel}>Status</span>
            <span style={{ ...s.fieldValue, color: org.active ? '#3fb950' : '#f85149' }}>{org.active ? 'Active' : 'Inactive'}</span>
          </div>
          <div style={s.row}>
            <span style={s.fieldLabel}>Created</span>
            <span style={s.fieldValue}>{new Date(org.created_at).toLocaleDateString()}</span>
          </div>
        </div>

        {/* SSO Configuration */}
        <div style={s.section}>
          <div style={s.sectionTitle}>SSO Configuration</div>
          <div style={{ color: '#8b949e', fontSize: '13px', marginBottom: '16px' }}>
            SSO is configured via environment variables on the server. Contact your administrator to enable Azure AD or Okta SSO for your organization.
          </div>
          <div style={s.ssoRow}>
            <span style={s.ssoLabel}>Azure AD</span>
            <span style={s.ssoStatus(azureEnabled)}>{azureEnabled ? 'Enabled' : 'Not configured'}</span>
          </div>
          <div style={s.ssoRow}>
            <span style={s.ssoLabel}>Okta</span>
            <span style={s.ssoStatus(oktaEnabled)}>{oktaEnabled ? 'Enabled' : 'Not configured'}</span>
          </div>
          <div style={{ color: '#484f58', fontSize: '12px', marginTop: '12px' }}>
            Variables: OIDC_AZURE_CLIENT_ID, OIDC_AZURE_CLIENT_SECRET, OIDC_AZURE_TENANT_ID, OIDC_OKTA_CLIENT_ID, OIDC_OKTA_CLIENT_SECRET, OIDC_OKTA_DOMAIN
          </div>
        </div>

        {/* Usage Stats */}
        <div style={s.section}>
          <div style={s.sectionTitle}>Usage Statistics</div>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' as const }}>
            <div style={s.stat}>
              <div style={s.statNum}>{org.stats.incident_count}</div>
              <div style={s.statLabel}>Incidents</div>
            </div>
            <div style={s.stat}>
              <div style={s.statNum}>{org.stats.entity_count}</div>
              <div style={s.statLabel}>Entities</div>
            </div>
            <div style={s.stat}>
              <div style={s.statNum}>{org.stats.active_user_count}</div>
              <div style={s.statLabel}>Active Users</div>
            </div>
            <div style={s.stat}>
              <div style={s.statNum}>{org.stats.ttp_assignment_count}</div>
              <div style={s.statLabel}>TTP Assignments</div>
            </div>
          </div>
        </div>

        {/* API Keys */}
        {canEdit && (
          <div style={s.section}>
            <div style={s.sectionTitle}>Threat Intelligence API Keys</div>
            <div style={{ color: '#8b949e', fontSize: '12px', marginBottom: '16px' }}>
              API keys are stored encrypted and used for entity enrichment.
            </div>
            {(['virustotal', 'abuseipdb', 'shodan'] as const).map((service) => {
              const existing = apiKeys.find((k) => k.service === service);
              return (
                <div key={service} style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                  <span style={{ ...s.fieldLabel, width: '120px', textTransform: 'capitalize' }}>{service}</span>
                  {existing && (
                    <span style={{ ...s.fieldValue, fontFamily: 'monospace', color: '#8b949e', fontSize: '12px' }}>{existing.api_key_masked}</span>
                  )}
                  <input
                    style={{ ...s.input, flex: 1 }}
                    type="password"
                    placeholder={existing ? 'Update key…' : 'Enter API key…'}
                    value={keyInputs[service]}
                    onChange={(e) => setKeyInputs((prev) => ({ ...prev, [service]: e.target.value }))}
                  />
                  <button
                    style={s.btn}
                    onClick={() => handleSaveKey(service)}
                    disabled={keySaving[service] || !keyInputs[service].trim()}
                  >
                    {keySaving[service] ? 'Saving…' : 'Save'}
                  </button>
                  {existing && (
                    <button
                      style={{ ...s.btn, background: '#6e1a1a', marginLeft: 0 }}
                      onClick={() => handleDeleteKey(service)}
                    >
                      Delete
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Danger Zone */}
        <div style={s.danger}>
          <div style={s.dangerTitle}>Danger Zone</div>
          <div style={{ color: '#8b949e', fontSize: '13px' }}>
            To change your subscription tier or delete your organization, please contact support.
          </div>
        </div>
      </div>
    </div>
  );
}
