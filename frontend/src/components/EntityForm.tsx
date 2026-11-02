import { useState, FormEvent } from 'react';
import { apiClient } from '../api/client';
import { EntityType } from '../types';
import { addToast } from './ToastContainer';

interface Props {
  incidentId: string;
  onCreated: () => void;
}

const ENTITY_TYPES: EntityType[] = ['hostname', 'ip', 'email', 'domain', 'account', 'file', 'process', 'registry', 'certificate', 'url', 'custom'];

const s: Record<string, React.CSSProperties> = {
  form: { background: '#161b22', border: '1px solid #30363d', borderRadius: '8px', padding: '20px', marginBottom: '24px' },
  title: { fontSize: '14px', fontWeight: 600, color: '#e6edf3', marginBottom: '16px' },
  row: { display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', gap: '12px', alignItems: 'end' },
  label: { display: 'block', color: '#8b949e', fontSize: '11px', fontWeight: 600, marginBottom: '4px', textTransform: 'uppercase' as const },
  input: { width: '100%', background: '#0d1117', border: '1px solid #30363d', borderRadius: '6px', padding: '8px 12px', color: '#e6edf3', fontSize: '13px', outline: 'none', boxSizing: 'border-box' as const },
  select: { width: '100%', background: '#0d1117', border: '1px solid #30363d', borderRadius: '6px', padding: '8px 12px', color: '#e6edf3', fontSize: '13px' },
  btn: { background: '#238636', border: 'none', borderRadius: '6px', padding: '9px 18px', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer' },
  error: { color: '#f85149', fontSize: '12px', marginTop: '8px' },
  detailsSection: { marginTop: '16px', borderTop: '1px solid #30363d', paddingTop: '16px' },
  detailsTitle: { color: '#8b949e', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase' as const, marginBottom: '12px' },
  detailsGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' },
  textarea: { width: '100%', background: '#0d1117', border: '1px solid #30363d', borderRadius: '6px', padding: '8px 12px', color: '#e6edf3', fontSize: '13px', outline: 'none', resize: 'vertical' as const, minHeight: '60px', boxSizing: 'border-box' as const, fontFamily: 'inherit' },
};

type MetaField = { key: string; label: string; type?: 'text' | 'textarea' | 'select'; options?: string[] };

const TYPE_FIELDS: Record<string, MetaField[]> = {
  file: [
    { key: 'md5', label: 'MD5 Hash' },
    { key: 'sha1', label: 'SHA1 Hash' },
    { key: 'sha256', label: 'SHA256 Hash' },
    { key: 'file_size', label: 'File Size' },
    { key: 'file_type', label: 'File Type/Extension' },
    { key: 'file_path', label: 'File Path' },
    { key: 'first_seen', label: 'First Seen' },
    { key: 'last_seen', label: 'Last Seen' },
    { key: 'signature_status', label: 'Signature Status', type: 'select', options: ['', 'signed', 'unsigned', 'unknown'] },
  ],
  ip: [
    { key: 'asn', label: 'ASN' },
    { key: 'isp', label: 'ISP/Organization' },
    { key: 'country', label: 'Country' },
    { key: 'open_ports', label: 'Open Ports (comma-separated)' },
    { key: 'reverse_dns', label: 'Reverse DNS' },
    { key: 'first_seen', label: 'First Seen' },
    { key: 'last_seen', label: 'Last Seen' },
  ],
  domain: [
    { key: 'registrar', label: 'Registrar' },
    { key: 'registration_date', label: 'Registration Date' },
    { key: 'expiry_date', label: 'Expiry Date' },
    { key: 'nameservers', label: 'Nameservers' },
    { key: 'a_records', label: 'A Records' },
    { key: 'mx_records', label: 'MX Records' },
    { key: 'whois_data', label: 'WHOIS Data', type: 'textarea' },
  ],
  url: [
    { key: 'full_url', label: 'Full URL' },
    { key: 'http_status', label: 'HTTP Status Code' },
    { key: 'redirect_chain', label: 'Redirect Chain' },
    { key: 'page_title', label: 'Page Title' },
    { key: 'hosting_ip', label: 'Hosting IP' },
  ],
  account: [
    { key: 'username', label: 'Username' },
    { key: 'email', label: 'Email' },
    { key: 'domain', label: 'Domain' },
    { key: 'account_type', label: 'Account Type', type: 'select', options: ['', 'admin', 'standard', 'service'] },
    { key: 'last_login', label: 'Last Login' },
    { key: 'mfa_enabled', label: 'MFA Enabled', type: 'select', options: ['', 'yes', 'no', 'unknown'] },
    { key: 'created_date', label: 'Created Date' },
  ],
  hostname: [
    { key: 'ip_address', label: 'IP Address' },
    { key: 'operating_system', label: 'Operating System' },
    { key: 'os_version', label: 'OS Version' },
    { key: 'mac_address', label: 'MAC Address' },
    { key: 'last_seen', label: 'Last Seen' },
    { key: 'domain_joined', label: 'Domain Joined', type: 'select', options: ['', 'yes', 'no', 'unknown'] },
  ],
  email: [
    { key: 'sender_address', label: 'Sender Address' },
    { key: 'recipients', label: 'Recipients (comma-separated)' },
    { key: 'subject', label: 'Subject' },
    { key: 'date_sent', label: 'Date Sent' },
    { key: 'sending_ip', label: 'Sending IP' },
    { key: 'attachments', label: 'Attachments (comma-separated)' },
  ],
  process: [
    { key: 'process_name', label: 'Process Name' },
    { key: 'pid', label: 'PID' },
    { key: 'parent_process', label: 'Parent Process' },
    { key: 'command_line', label: 'Command Line', type: 'textarea' },
    { key: 'executable_path', label: 'Executable Path' },
    { key: 'user_context', label: 'User Context' },
  ],
  registry: [
    { key: 'key_path', label: 'Key Path' },
    { key: 'value_name', label: 'Value Name' },
    { key: 'value_data', label: 'Value Data' },
    { key: 'last_modified', label: 'Last Modified' },
  ],
  certificate: [
    { key: 'subject', label: 'Subject' },
    { key: 'issuer', label: 'Issuer' },
    { key: 'serial_number', label: 'Serial Number' },
    { key: 'valid_from', label: 'Valid From' },
    { key: 'valid_to', label: 'Valid To' },
    { key: 'thumbprint', label: 'Thumbprint' },
  ],
  custom: [],
};

export default function EntityForm({ incidentId, onCreated }: Props) {
  const [type, setType] = useState<EntityType>('ip');
  const [value, setValue] = useState('');
  const [notes, setNotes] = useState('');
  const [metaValues, setMetaValues] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function handleTypeChange(t: EntityType) {
    setType(t);
    setMetaValues({});
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const entity_details: Record<string, string> = {};
      for (const [k, v] of Object.entries(metaValues)) {
        if (v.trim()) entity_details[k] = v.trim();
      }
      const submittedValue = value;
      await apiClient.post(`/incidents/${incidentId}/entities`, {
        type,
        value,
        notes: notes || undefined,
        entity_details: Object.keys(entity_details).length > 0 ? entity_details : undefined,
      });
      setValue('');
      setNotes('');
      setMetaValues({});
      addToast({ id: Date.now().toString(), type: 'success', title: 'Entity Added', body: submittedValue, read: false, created_at: new Date().toISOString() });
      onCreated();
    } catch (err: unknown) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setError((err as any)?.response?.data?.error ?? 'Failed to create entity');
    } finally {
      setLoading(false);
    }
  }

  const fields = TYPE_FIELDS[type] ?? [];

  return (
    <div style={s.form}>
      <div style={s.title}>Add Entity</div>
      <form onSubmit={handleSubmit}>
        <div style={s.row}>
          <div>
            <label style={s.label}>Type</label>
            <select style={s.select} value={type} onChange={(e) => handleTypeChange(e.target.value as EntityType)}>
              {ENTITY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label style={s.label}>Value</label>
            <input style={s.input} value={value} onChange={(e) => setValue(e.target.value)} required placeholder="192.168.1.1" />
          </div>
          <div>
            <label style={s.label}>Notes</label>
            <input style={s.input} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes…" />
          </div>
        </div>

        {fields.length > 0 && (
          <div style={s.detailsSection}>
            <div style={s.detailsTitle}>Additional Details</div>
            <div style={s.detailsGrid}>
              {fields.map((f) => (
                <div key={f.key} style={f.type === 'textarea' ? { gridColumn: '1 / -1' } : {}}>
                  <label style={s.label}>{f.label}</label>
                  {f.type === 'textarea' ? (
                    <textarea
                      style={s.textarea}
                      value={metaValues[f.key] ?? ''}
                      onChange={(e) => setMetaValues((prev) => ({ ...prev, [f.key]: e.target.value }))}
                    />
                  ) : f.type === 'select' ? (
                    <select
                      style={s.select}
                      value={metaValues[f.key] ?? ''}
                      onChange={(e) => setMetaValues((prev) => ({ ...prev, [f.key]: e.target.value }))}
                    >
                      {(f.options ?? []).map((o) => <option key={o} value={o}>{o || '— select —'}</option>)}
                    </select>
                  ) : (
                    <input
                      style={s.input}
                      value={metaValues[f.key] ?? ''}
                      onChange={(e) => setMetaValues((prev) => ({ ...prev, [f.key]: e.target.value }))}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {error && <div style={s.error}>{error}</div>}
        <button style={{ ...s.btn, marginTop: '12px' }} type="submit" disabled={loading}>{loading ? 'Adding…' : 'Add Entity'}</button>
      </form>
    </div>
  );
}
