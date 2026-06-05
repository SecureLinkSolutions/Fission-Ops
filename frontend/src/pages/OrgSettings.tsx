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

interface ApiKeyInfo {
  service: string;
  has_key: boolean;
  masked_key: string | null;
}

const s: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', background: '#0d1117', padding: '32px 24px', color: '#e6edf3' },
  container: { maxWidth: '720px', margin: '0 auto' },
  title: { fontSize: '22px', fontWeight: 700, marginBottom: '4px' },
  sub: { color: '#8b949e', fontSize: '14px', marginBottom: '24px' },
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
  ssoStatusActive: { color: '#3fb950', fontSize: '13px', fontWeight: 600 },
  ssoStatusInactive: { color: '#8b949e', fontSize: '13px', fontWeight: 600 },
  tabBar: { display: 'flex', gap: '0', borderBottom: '1px solid #30363d', marginBottom: '24px' },
};

function tabStyle(active: boolean): React.CSSProperties {
  return {
    padding: '10px 20px', cursor: 'pointer', border: 'none', background: 'transparent',
    color: active ? '#e6edf3' : '#8b949e',
    borderBottom: active ? '2px solid #58a6ff' : '2px solid transparent',
    fontSize: '14px', fontWeight: active ? 600 : 400,
  };
}

type Tab = 'general' | 'integrations';

export default function OrgSettings() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('general');
  const [org, setOrg] = useState<OrgData | null>(null);
  const [editName, setEditName] = useState('');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // API keys state
  const [apiKeys, setApiKeys] = useState<ApiKeyInfo[]>([
    { service: 'virustotal', has_key: false, masked_key: null },
    { service: 'abuseipdb', has_key: false, masked_key: null },
    { service: 'shodan', has_key: false, masked_key: null },
    { service: 'anthropic', has_key: false, masked_key: null },
  ]);
  const [keyInputs, setKeyInputs] = useState<Record<string, string>>({ virustotal: '', abuseipdb: '', shodan: '', anthropic: '' });
  const [showKey, setShowKey] = useState<Record<string, boolean>>({});
  const [keySaving, setKeySaving] = useState<Record<string, boolean>>({});
  const [keyTestResult, setKeyTestResult] = useState<Record<string, { success: boolean; message: string } | null>>({});
  const [keyTesting, setKeyTesting] = useState<Record<string, boolean>>({});

  // Threat intel mode state
  const [threatIntelMode, setThreatIntelMode] = useState<'automatic' | 'manual'>('automatic');
  const [threatModeSaving, setThreatModeSaving] = useState(false);

  const fetchApiKeys = useCallback(() => {
    apiClient.get<ApiKeyInfo[]>('/organizations/me/api-keys').then((r) => {
      setApiKeys(r.data);
    }).catch(() => {});
  }, []);

  const fetchSettings = useCallback(() => {
    apiClient.get<{ threat_intel_mode: 'automatic' | 'manual' }>('/organizations/me/settings').then((r) => {
      setThreatIntelMode(r.data.threat_intel_mode);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    fetchApiKeys();
    fetchSettings();
  }, [fetchApiKeys, fetchSettings]);

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
    setKeyTestResult((prev) => ({ ...prev, [service]: null }));
    fetchApiKeys();
  }

  async function handleTestKey(service: string) {
    setKeyTesting((prev) => ({ ...prev, [service]: true }));
    setKeyTestResult((prev) => ({ ...prev, [service]: null }));
    try {
      const r = await apiClient.post<{ success: boolean; message: string }>(`/organizations/me/api-keys/${service}/test`);
      setKeyTestResult((prev) => ({ ...prev, [service]: r.data }));
    } catch (_e) {
      setKeyTestResult((prev) => ({ ...prev, [service]: { success: false, message: 'Request failed' } }));
    } finally {
      setKeyTesting((prev) => ({ ...prev, [service]: false }));
    }
  }

  async function handleSaveThreatMode() {
    setThreatModeSaving(true);
    try {
      await apiClient.put('/organizations/me/settings', { threat_intel_mode: threatIntelMode });
    } finally {
      setThreatModeSaving(false);
    }
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

  const azureEnabled = false;
  const oktaEnabled = false;

  if (!org) return <div style={{ ...s.page, color: '#8b949e', textAlign: 'center' }}>Loading…</div>;

  const canEdit = user?.role === 'incident_commander' || user?.role === 'super_admin';

  const SERVICE_LABELS: Record<string, string> = { virustotal: 'VirusTotal', abuseipdb: 'AbuseIPDB', shodan: 'Shodan', anthropic: 'Anthropic (AI Narrative)' };
  const SERVICE_DESCRIPTIONS: Record<string, string> = {
    virustotal: 'Threat intelligence enrichment for IPs, domains, and files',
    abuseipdb: 'IP reputation and abuse reports',
    shodan: 'Internet-facing device and service discovery',
    anthropic: 'Powers AI-generated attack narratives in the Kill Chain view (uses claude-haiku-4-5)',
  };

  return (
    <div style={s.page}>
      <div style={s.container}>
        <div style={{ color: '#8b949e', fontSize: '12px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ color: '#58a6ff', fontSize: '12px' }}>Admin</span>
          <span style={{ color: '#30363d' }}>/</span>
          <span style={{ color: '#8b949e' }}>Org Settings</span>
        </div>
        <div style={s.title}>Organization Settings</div>
        <div style={s.sub}>Manage your organization configuration and view usage statistics.</div>

        <div style={s.tabBar}>
          <button style={tabStyle(activeTab === 'general')} onClick={() => setActiveTab('general')}>General</button>
          {canEdit && <button style={tabStyle(activeTab === 'integrations')} onClick={() => setActiveTab('integrations')}>Integrations</button>}
        </div>

        {activeTab === 'general' && (
          <>
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
                <span style={azureEnabled ? s.ssoStatusActive : s.ssoStatusInactive}>{azureEnabled ? 'Enabled' : 'Not configured'}</span>
              </div>
              <div style={s.ssoRow}>
                <span style={s.ssoLabel}>Okta</span>
                <span style={oktaEnabled ? s.ssoStatusActive : s.ssoStatusInactive}>{oktaEnabled ? 'Enabled' : 'Not configured'}</span>
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

            {/* Danger Zone */}
            <div style={s.danger}>
              <div style={s.dangerTitle}>Danger Zone</div>
              <div style={{ color: '#8b949e', fontSize: '13px' }}>
                To change your subscription tier or delete your organization, please contact support.
              </div>
            </div>
          </>
        )}

        {activeTab === 'integrations' && canEdit && (
          <>
            {/* API Keys */}
            <div style={s.section}>
              <div style={s.sectionTitle}>API Keys & Integrations</div>
              <div style={{ color: '#8b949e', fontSize: '12px', marginBottom: '20px' }}>
                API keys are stored per organisation and masked after saving. Threat intel keys are used for entity enrichment; the Anthropic key enables AI-generated attack narratives.
              </div>
              {apiKeys.map((keyInfo) => {
                const service = keyInfo.service;
                const testResult = keyTestResult[service];
                return (
                  <div key={service} style={{ marginBottom: '20px', paddingBottom: '20px', borderBottom: '1px solid #21262d' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                      <span style={{ color: '#e6edf3', fontSize: '14px', fontWeight: 600, width: '100px' }}>{SERVICE_LABELS[service]}</span>
                      {keyInfo.has_key ? (
                        <span style={{ background: '#3fb95022', color: '#3fb950', border: '1px solid #3fb95044', borderRadius: '12px', padding: '2px 10px', fontSize: '11px', fontWeight: 600 }}>● Connected</span>
                      ) : (
                        <span style={{ background: '#8b949e22', color: '#8b949e', border: '1px solid #8b949e44', borderRadius: '12px', padding: '2px 10px', fontSize: '11px', fontWeight: 600 }}>○ Not Configured</span>
                      )}
                    </div>
                    {keyInfo.has_key && keyInfo.masked_key && (
                      <div style={{ color: '#8b949e', fontFamily: 'monospace', fontSize: '12px', marginBottom: '8px' }}>{keyInfo.masked_key}</div>
                    )}
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' as const }}>
                      <div style={{ position: 'relative' as const, flex: 1, minWidth: '200px' }}>
                        <input
                          style={{ ...s.input, width: '100%', boxSizing: 'border-box' as const, paddingRight: '40px' }}
                          type={showKey[service] ? 'text' : 'password'}
                          placeholder={keyInfo.has_key ? 'Update key…' : 'Enter API key…'}
                          value={keyInputs[service] ?? ''}
                          onChange={(e) => setKeyInputs((prev) => ({ ...prev, [service]: e.target.value }))}
                        />
                        <button
                          type="button"
                          onClick={() => setShowKey((prev) => ({ ...prev, [service]: !prev[service] }))}
                          style={{ position: 'absolute' as const, right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', color: '#8b949e', cursor: 'pointer', fontSize: '14px', padding: '0' }}
                        >
                          👁
                        </button>
                      </div>
                      <button
                        style={s.btn}
                        onClick={() => handleSaveKey(service)}
                        disabled={keySaving[service] || !keyInputs[service]?.trim()}
                      >
                        {keySaving[service] ? 'Saving…' : 'Save'}
                      </button>
                      {keyInfo.has_key && (
                        <>
                          <button
                            style={{ ...s.btn, background: '#1f6feb', border: '1px solid #1f6feb' }}
                            onClick={() => handleTestKey(service)}
                            disabled={keyTesting[service]}
                          >
                            {keyTesting[service] ? 'Testing…' : 'Test'}
                          </button>
                          <button
                            style={{ ...s.btn, background: '#6e1a1a' }}
                            onClick={() => handleDeleteKey(service)}
                          >
                            Clear
                          </button>
                        </>
                      )}
                    </div>
                    {testResult && (
                      <div style={{ marginTop: '6px', fontSize: '12px', color: testResult.success ? '#3fb950' : '#f85149' }}>
                        {testResult.success ? '✓' : '✗'} {testResult.message}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Threat Intel Mode */}
            <div style={s.section}>
              <div style={s.sectionTitle}>Enrichment Mode</div>
              <div style={{ color: '#8b949e', fontSize: '12px', marginBottom: '16px' }}>
                Controls when threat intelligence enrichment runs for new entities.
              </div>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap' as const }}>
                <span style={{ color: '#8b949e', fontSize: '13px', width: '120px' }}>Current Mode:</span>
                {threatIntelMode === 'automatic' ? (
                  <span style={{ background: '#3fb95022', color: '#3fb950', border: '1px solid #3fb95044', borderRadius: '6px', padding: '2px 10px', fontSize: '12px', fontWeight: 700 }}>AUTO</span>
                ) : (
                  <span style={{ background: '#d2992222', color: '#d29922', border: '1px solid #d2992244', borderRadius: '6px', padding: '2px 10px', fontSize: '12px', fontWeight: 700 }}>MANUAL</span>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '10px', marginBottom: '16px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="threatIntelMode"
                    value="automatic"
                    checked={threatIntelMode === 'automatic'}
                    onChange={() => setThreatIntelMode('automatic')}
                    style={{ accentColor: '#58a6ff' }}
                  />
                  <span style={{ color: '#e6edf3', fontSize: '13px' }}>
                    <strong>Automatic</strong> — enrich on entity creation
                  </span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="threatIntelMode"
                    value="manual"
                    checked={threatIntelMode === 'manual'}
                    onChange={() => setThreatIntelMode('manual')}
                    style={{ accentColor: '#58a6ff' }}
                  />
                  <span style={{ color: '#e6edf3', fontSize: '13px' }}>
                    <strong>Manual</strong> — analyst triggers enrichment
                  </span>
                </label>
              </div>
              <button style={s.btn} onClick={handleSaveThreatMode} disabled={threatModeSaving}>
                {threatModeSaving ? 'Saving…' : 'Save Mode'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
