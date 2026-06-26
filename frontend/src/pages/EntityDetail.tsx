import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useFetch } from '../hooks/useFetch';
import { apiClient } from '../api/client';
import { Entity, NetworkBoundary } from '../types';
import KillChainPanel from '../components/KillChainPanel';
import BoundaryMappingPanel from '../components/BoundaryMappingPanel';
import CommentThread from '../components/CommentThread';
import EnrichmentHistory from '../components/EnrichmentHistory';
import { useAuth } from '../context/AuthContext';
import EntityStatusBadge, { ENTITY_STATUS_CONFIG } from '../components/EntityStatusBadge';
import SuggestedActions from '../components/SuggestedActions';
import ContainmentChecklist from '../components/ContainmentChecklist';
import CustodyLog from '../components/CustodyLog';
import { ROLE_RANK, ENTITY_TYPE_ICONS, ENTITY_TYPE_COLORS } from '../utils/constants';

const IOC_STATUS_DISPLAY: Record<string, { label: string; color: string }> = {
  confirmed: { label: '💀 CONFIRMED', color: '#f85149' },
  suspected: { label: '⚠ SUSPECTED', color: '#d29922' },
  cleared: { label: '✓ CLEARED', color: '#3fb950' },
};

const ENRICHMENT_STATUS_COLORS: Record<string, string> = {
  pending: '#8b949e',
  running: '#58a6ff',
  complete: '#3fb950',
  failed: '#f85149',
  skipped: '#8b949e',
};

const LABEL_MAP: Record<string, string> = {
  sha256: 'SHA-256', md5: 'MD5', sha1: 'SHA-1', file_size: 'File Size', file_type: 'File Type',
  file_path: 'File Path', first_seen: 'First Seen', last_seen: 'Last Seen',
  signature_status: 'Signature Status', asn: 'ASN', isp: 'ISP/Organization', open_ports: 'Open Ports',
  reverse_dns: 'Reverse DNS', registrar: 'Registrar', registration_date: 'Registration Date',
  expiry_date: 'Expiry Date', nameservers: 'Nameservers', a_records: 'A Records',
  mx_records: 'MX Records', whois_data: 'WHOIS Data', full_url: 'Full URL',
  http_status: 'HTTP Status', redirect_chain: 'Redirect Chain', page_title: 'Page Title',
  hosting_ip: 'Hosting IP', username: 'Username', account_type: 'Account Type',
  last_login: 'Last Login', mfa_enabled: 'MFA Enabled', created_date: 'Created Date',
  ip_address: 'IP Address', operating_system: 'Operating System', os_version: 'OS Version',
  mac_address: 'MAC Address', domain_joined: 'Domain Joined', sender_address: 'Sender Address',
  recipients: 'Recipients', date_sent: 'Date Sent', sending_ip: 'Sending IP',
  attachments: 'Attachments', process_name: 'Process Name', pid: 'PID',
  parent_process: 'Parent Process', command_line: 'Command Line', executable_path: 'Executable Path',
  user_context: 'User Context', key_path: 'Key Path', value_name: 'Value Name',
  value_data: 'Value Data', last_modified: 'Last Modified', serial_number: 'Serial Number',
  valid_from: 'Valid From', valid_to: 'Valid To', thumbprint: 'Thumbprint',
};

function humanLabel(key: string): string {
  return LABEL_MAP[key] ?? key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

interface ExtendedEntity extends Entity {
  ioc_status?: 'suspected' | 'confirmed' | 'cleared';
  ioc_notes?: string;
  ioc_flagged_at?: string;
  enrichment_status?: 'pending' | 'running' | 'complete' | 'failed' | 'skipped';
  enrichment_data?: Record<string, unknown>;
  enrichment_updated_at?: string;
}

export default function EntityDetail() {
  const { id, entityId } = useParams<{ id: string; entityId: string }>();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'overview' | 'enrichment' | 'checklist' | 'custody'>('overview');
  const [iocNotes, setIocNotes] = useState('');
  const [statusChanging, setStatusChanging] = useState(false);
  const [settingIOC, setSettingIOC] = useState(false);
  const [reenrichHover, setReenrichHover] = useState(false);

  const { data: entity, loading, error, refetch } = useFetch<ExtendedEntity>(
    () => apiClient.get(`/entities/${entityId}`).then((r) => r.data), [entityId],
  );
  const { data: boundaries } = useFetch<NetworkBoundary[]>(
    () => apiClient.get(`/incidents/${id}/boundaries`).then((r) => r.data), [id],
  );

  async function handleSetIOC(status: 'suspected' | 'confirmed' | 'cleared') {
    setSettingIOC(true);
    try {
      await apiClient.patch(`/entities/${entityId}/ioc-status`, { status, notes: iocNotes || undefined });
      refetch();
      setIocNotes('');
    } finally {
      setSettingIOC(false);
    }
  }

  async function handleSetEntityStatus(status: string) {
    setStatusChanging(true);
    try {
      await apiClient.patch(`/entities/${entityId}/status`, { status });
      refetch();
    } finally {
      setStatusChanging(false);
    }
  }

  async function handleReenrich() {
    await apiClient.post(`/entities/${entityId}/enrich`).catch(() => {});
    refetch();
  }

  if (loading) return <div style={{ padding: '32px', color: '#8b949e' }}>Loading entity…</div>;
  if (error || !entity) return <div style={{ padding: '32px', color: '#f85149' }}>Failed to load entity.</div>;

  const color = ENTITY_TYPE_COLORS[entity.type] ?? '#8b949e';
  const ioc = entity.ioc_status ? IOC_STATUS_DISPLAY[entity.ioc_status] : null;
  const canConfirmIOC = ROLE_RANK[user?.role ?? ''] >= ROLE_RANK['senior_analyst'];
  const enrichData = entity.enrichment_data as Record<string, unknown> | undefined;
  const vt = enrichData?.virustotal as { malicious?: number; suspicious?: number; harmless?: number; undetected?: number; engines_total?: number } | undefined;
  const abuse = enrichData?.abuseipdb as { abuse_confidence_score?: number; country?: string; isp?: string; total_reports?: number } | undefined;
  const shodan = enrichData?.shodan as { ports?: number[]; vulns?: string[]; org?: string; os?: string } | undefined;
  const verdict = enrichData?.verdict as string | undefined;

  return (
    <div style={{ padding: '32px', maxWidth: '900px', margin: '0 auto' }}>
      <div style={{ color: '#58a6ff', fontSize: '13px', marginBottom: '20px', display: 'flex', gap: '8px', alignItems: 'center' }}>
        <Link to={`/incidents/${id}`} style={{ color: '#58a6ff', textDecoration: 'none' }}>← Back to incident</Link>
        <span style={{ color: '#30363d' }}>/</span>
        <span style={{ color: '#8b949e' }}>Entity</span>
      </div>

      <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: '8px', padding: '20px', marginBottom: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px', flexWrap: 'wrap' }}>
          <div style={{ background: `${color}22`, color, border: `1px solid ${color}44`, borderRadius: '6px', padding: '6px 14px', fontSize: '14px', fontWeight: 600 }}>
            {ENTITY_TYPE_ICONS[entity.type]} {entity.type}
          </div>
          {ioc && (
            <span style={{ background: `${ioc.color}22`, color: ioc.color, border: `1px solid ${ioc.color}44`, borderRadius: '6px', padding: '6px 14px', fontSize: '13px', fontWeight: 700 }}>
              {ioc.label}
            </span>
          )}
          <EntityStatusBadge status={entity.status ?? 'unreviewed'} />
        </div>
        <div style={{ fontFamily: 'monospace', fontSize: '20px', fontWeight: 700, color: '#e6edf3', marginBottom: '8px' }}>{entity.value}</div>
        {entity.notes && <div style={{ color: '#8b949e', fontSize: '13px', lineHeight: '1.5' }}>{entity.notes}</div>}
        {entity.entity_details && Object.keys(entity.entity_details).length > 0 && (
          <div style={{ marginTop: '16px' }}>
            <div style={{ color: '#8b949e', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', marginBottom: '8px' }}>Metadata</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
              {Object.entries(entity.entity_details).map(([k, v]) => {
                const isTi = k.startsWith('ti_');
                if (isTi && (v === null || v === undefined || v === '')) return null;
                const label = isTi
                  ? k.slice(3).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
                  : humanLabel(k);
                return (
                  <div key={k} style={{ background: '#0d1117', borderRadius: '6px', padding: '8px 12px', border: isTi ? '1px solid #58a6ff22' : 'none' }}>
                    <div style={{ color: '#8b949e', fontSize: '11px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {label}
                      {isTi && (
                        <span style={{ background: '#58a6ff22', color: '#58a6ff', border: '1px solid #58a6ff44', borderRadius: '4px', padding: '1px 5px', fontSize: '10px', fontWeight: 700 }}>
                          🔍 TI
                        </span>
                      )}
                    </div>
                    <div style={{ color: '#e6edf3', fontSize: '13px', marginTop: '2px', fontFamily: 'monospace', wordBreak: 'break-all' }}>{String(v)}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Tab Bar */}
      <div style={{ display: 'flex', gap: '0', borderBottom: '1px solid #30363d', marginBottom: '24px' }}>
        {(['overview', 'enrichment', 'checklist', 'custody'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            style={{
              background: 'none',
              border: 'none',
              borderBottom: activeTab === tab ? '2px solid #58a6ff' : '2px solid transparent',
              color: activeTab === tab ? '#e6edf3' : '#8b949e',
              fontWeight: activeTab === tab ? 600 : 400,
              fontSize: '14px',
              padding: '8px 16px',
              cursor: 'pointer',
              marginBottom: '-1px',
            }}
          >
            {tab === 'enrichment' ? 'Enrichment' : tab === 'checklist' ? 'Checklist' : tab === 'custody' ? 'Chain of Custody' : 'Overview'}
          </button>
        ))}
      </div>

      {activeTab === 'enrichment' && entityId && (
        <EnrichmentHistory entityId={entityId} />
      )}

      {activeTab === 'checklist' && entityId && entity && (
        <ContainmentChecklist entityId={entityId} entityType={entity.type} />
      )}

      {activeTab === 'custody' && entityId && (
        <CustodyLog entityId={entityId} />
      )}

      {activeTab === 'overview' && (<>
      {/* Entity Status Section */}
      <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: '8px', padding: '20px', marginBottom: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }}>
        <div style={{ fontWeight: 600, fontSize: '11px', color: '#8b949e', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px' }}>Entity Status</div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {Object.entries(ENTITY_STATUS_CONFIG).map(([s, cfg]) => (
            <button
              key={s}
              onClick={() => handleSetEntityStatus(s)}
              disabled={statusChanging || entity.status === s}
              style={{
                background: `${cfg.color}22`, color: cfg.color, border: `1px solid ${cfg.color}${entity.status === s ? '88' : '44'}`,
                borderRadius: '12px', padding: '4px 12px', fontSize: '12px', fontWeight: 600,
                cursor: entity.status === s ? 'default' : 'pointer',
                opacity: entity.status === s ? 1 : 0.7,
                outline: entity.status === s ? `2px solid ${cfg.color}` : 'none',
              }}
            >
              {cfg.label}
            </button>
          ))}
        </div>
      </div>

      {/* IOC Section */}
      <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: '8px', padding: '20px', marginBottom: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }}>
        <div style={{ fontWeight: 600, fontSize: '11px', color: '#8b949e', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px' }}>IOC Status</div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '12px' }}>
          {ioc ? (
            <span style={{ background: `${ioc.color}22`, color: ioc.color, border: `1px solid ${ioc.color}44`, borderRadius: '6px', padding: '4px 12px', fontSize: '13px', fontWeight: 700 }}>
              {ioc.label}
            </span>
          ) : (
            <span style={{ color: '#8b949e', fontSize: '13px' }}>Not flagged</span>
          )}
          {entity.ioc_notes && <span style={{ color: '#8b949e', fontSize: '12px' }}>Notes: {entity.ioc_notes}</span>}
        </div>
        <textarea
          placeholder="Notes (optional)"
          value={iocNotes}
          onChange={(e) => setIocNotes(e.target.value)}
          style={{ width: '100%', background: '#0d1117', border: '1px solid #30363d', borderRadius: '6px', padding: '8px', color: '#e6edf3', fontSize: '13px', fontFamily: 'inherit', resize: 'vertical', minHeight: '48px', boxSizing: 'border-box', marginBottom: '8px' }}
        />
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            onClick={() => handleSetIOC('suspected')}
            disabled={settingIOC}
            style={{ background: '#d2992222', border: '1px solid #d2992244', borderRadius: '6px', padding: '6px 14px', color: '#d29922', fontSize: '13px', cursor: 'pointer' }}
          >
            ⚠ Mark Suspected
          </button>
          {canConfirmIOC && (
            <>
              <button
                onClick={() => handleSetIOC('confirmed')}
                disabled={settingIOC}
                style={{ background: '#f8514922', border: '1px solid #f8514944', borderRadius: '6px', padding: '6px 14px', color: '#f85149', fontSize: '13px', cursor: 'pointer' }}
              >
                💀 Confirm IOC
              </button>
              <button
                onClick={() => handleSetIOC('cleared')}
                disabled={settingIOC}
                style={{ background: '#3fb95022', border: '1px solid #3fb95044', borderRadius: '6px', padding: '6px 14px', color: '#3fb950', fontSize: '13px', cursor: 'pointer' }}
              >
                ✓ Clear IOC
              </button>
            </>
          )}
        </div>
      </div>

      <SuggestedActions
        entity={{ id: entity.id, type: entity.type, value: entity.value, status: entity.status, ioc_status: entity.ioc_status }}
        incidentId={id!}
        canCreateTask={ROLE_RANK[user?.role ?? ''] >= ROLE_RANK['senior_analyst']}
        onCreateTask={async (title) => {
          try {
            await apiClient.post(`/incidents/${entity.incident_id}/tasks`, { title, priority: 'high' });
          } catch {
            alert('Failed to create task. You may not have permission (Senior Analyst or above required).');
          }
        }}
      />

      {/* Enrichment Panel */}
      <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: '8px', padding: '20px', marginBottom: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <div style={{ fontWeight: 600, fontSize: '11px', color: '#8b949e', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Threat Intelligence</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {entity.enrichment_status && (
              <span style={{ fontSize: '12px', fontWeight: 600, color: ENRICHMENT_STATUS_COLORS[entity.enrichment_status] ?? '#8b949e', textTransform: 'uppercase' }}>
                {entity.enrichment_status}
              </span>
            )}
            <button
              onClick={handleReenrich}
              onMouseEnter={() => setReenrichHover(true)}
              onMouseLeave={() => setReenrichHover(false)}
              style={{ background: reenrichHover ? '#30363d' : '#21262d', border: '1px solid #30363d', borderRadius: '4px', padding: '4px 10px', color: reenrichHover ? '#e6edf3' : '#8b949e', fontSize: '12px', cursor: 'pointer' }}
            >
              Re-enrich
            </button>
          </div>
        </div>

        {verdict && entity.enrichment_status === 'complete' && (
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', alignItems: 'center' }}>
            <span style={{ fontWeight: 600, fontSize: '12px', color: '#8b949e' }}>Verdict:</span>
            <span style={{
              fontWeight: 700,
              fontSize: '13px',
              color: verdict === 'malicious' ? '#f85149' : verdict === 'suspicious' ? '#d29922' : verdict === 'clean' ? '#3fb950' : '#8b949e',
            }}>
              {verdict.toUpperCase()}
            </span>
          </div>
        )}

        {entity.enrichment_status === 'complete' && (vt || abuse || shodan) && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
            {vt && (
              <div style={{ background: '#0d1117', borderRadius: '6px', padding: '12px' }}>
                <div style={{ fontWeight: 600, fontSize: '12px', color: '#58a6ff', marginBottom: '8px' }}>VirusTotal</div>
                <div style={{ fontSize: '12px', color: '#8b949e' }}>Malicious: <span style={{ color: vt.malicious ? '#f85149' : '#3fb950' }}>{vt.malicious}</span></div>
                <div style={{ fontSize: '12px', color: '#8b949e' }}>Suspicious: <span style={{ color: vt.suspicious ? '#d29922' : '#8b949e' }}>{vt.suspicious}</span></div>
                <div style={{ fontSize: '12px', color: '#8b949e' }}>Engines: {vt.engines_total}</div>
              </div>
            )}
            {abuse && (
              <div style={{ background: '#0d1117', borderRadius: '6px', padding: '12px' }}>
                <div style={{ fontWeight: 600, fontSize: '12px', color: '#d29922', marginBottom: '8px' }}>AbuseIPDB</div>
                <div style={{ fontSize: '12px', color: '#8b949e' }}>Score: <span style={{ color: abuse.abuse_confidence_score! > 25 ? '#f85149' : '#3fb950', fontWeight: 700 }}>{abuse.abuse_confidence_score}%</span></div>
                <div style={{ fontSize: '12px', color: '#8b949e' }}>Country: {abuse.country}</div>
                <div style={{ fontSize: '12px', color: '#8b949e' }}>Reports: {abuse.total_reports}</div>
              </div>
            )}
            {shodan && (
              <div style={{ background: '#0d1117', borderRadius: '6px', padding: '12px' }}>
                <div style={{ fontWeight: 600, fontSize: '12px', color: '#a371f7', marginBottom: '8px' }}>Shodan</div>
                <div style={{ fontSize: '12px', color: '#8b949e' }}>Ports: <span style={{ fontFamily: 'monospace', color: '#e6edf3' }}>{(shodan.ports ?? []).slice(0, 5).join(', ')}</span></div>
                {shodan.org && <div style={{ fontSize: '12px', color: '#8b949e' }}>Org: {shodan.org}</div>}
                {(shodan.vulns ?? []).length > 0 && (
                  <div style={{ fontSize: '12px', color: '#f85149' }}>Vulns: {(shodan.vulns ?? []).slice(0, 3).join(', ')}</div>
                )}
              </div>
            )}
          </div>
        )}

        {entity.enrichment_status === 'skipped' && (
          <div style={{ color: '#8b949e', fontSize: '13px' }}>No API keys configured. Add keys in Org Settings to enable enrichment.</div>
        )}

        {(!entity.enrichment_status || entity.enrichment_status === 'pending') && (
          <div style={{ color: '#8b949e', fontSize: '13px' }}>Enrichment pending.</div>
        )}
      </div>

      <KillChainPanel entityId={entityId!} mappings={entity.kill_chain_mappings ?? []} onUpdated={refetch} />
      <BoundaryMappingPanel entityId={entityId!} boundaries={boundaries ?? []} mappings={entity.boundary_mappings ?? []} onUpdated={refetch} />

      {/* Comments */}
      <div style={{ marginTop: '24px' }}>
        <CommentThread entityId={entityId} />
      </div>
      </>)}
    </div>
  );
}
