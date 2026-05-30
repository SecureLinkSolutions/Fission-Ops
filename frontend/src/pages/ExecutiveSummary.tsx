import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { apiClient } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Incident } from '../types';

interface Summary {
  id?: string;
  incident_id: string;
  overview?: string;
  attack_timeline?: string;
  business_impact?: string;
  key_findings?: string;
  remediation?: string;
  risk_rating?: 'low' | 'medium' | 'high' | 'critical';
  updated_at?: string;
}

const RISK_COLORS: Record<string, string> = {
  low: '#3fb950',
  medium: '#d29922',
  high: '#f0883e',
  critical: '#f85149',
};

const ROLE_RANK: Record<string, number> = { analyst: 1, senior_analyst: 2, incident_commander: 3, super_admin: 99 };

const s: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', background: '#0d1117', padding: '32px 24px', color: '#e6edf3' },
  container: { maxWidth: '860px', margin: '0 auto' },
  section: { background: '#161b22', border: '1px solid #30363d', borderRadius: '8px', padding: '20px', marginBottom: '16px' },
  label: { fontSize: '12px', fontWeight: 600, color: '#8b949e', textTransform: 'uppercase' as const, letterSpacing: '0.5px', marginBottom: '6px' },
  value: { fontSize: '14px', color: '#e6edf3', lineHeight: '1.6', whiteSpace: 'pre-wrap' as const },
  textarea: { width: '100%', background: '#0d1117', border: '1px solid #30363d', borderRadius: '6px', padding: '10px 12px', color: '#e6edf3', fontSize: '14px', fontFamily: 'inherit', resize: 'vertical' as const, minHeight: '100px', outline: 'none', boxSizing: 'border-box' as const, lineHeight: '1.5' },
  select: { background: '#0d1117', border: '1px solid #30363d', borderRadius: '6px', padding: '8px 12px', color: '#e6edf3', fontSize: '14px', outline: 'none' },
  btn: { background: '#238636', border: 'none', borderRadius: '6px', padding: '8px 16px', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer' },
  printBtn: { background: 'transparent', border: '1px solid #30363d', borderRadius: '6px', padding: '8px 16px', color: '#8b949e', fontSize: '13px', cursor: 'pointer' },
};

export default function ExecutiveSummary() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [incident, setIncident] = useState<Incident | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Partial<Summary>>({});
  const [saving, setSaving] = useState(false);

  const canEdit = ROLE_RANK[user?.role ?? ''] >= ROLE_RANK['senior_analyst'];

  useEffect(() => {
    apiClient.get<Incident>(`/incidents/${id}`).then((r) => setIncident(r.data)).catch(() => {});
    apiClient.get<Summary | null>(`/incidents/${id}/executive-summary`).then((r) => {
      setSummary(r.data);
      if (r.data) setForm(r.data);
    }).catch(() => {});
  }, [id]);

  async function handleSave() {
    setSaving(true);
    try {
      const r = await apiClient.put<Summary>(`/incidents/${id}/executive-summary`, form);
      setSummary(r.data);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  function startEdit() {
    setForm(summary ?? { incident_id: id! });
    setEditing(true);
  }

  const fields: Array<{ key: keyof Summary; label: string }> = [
    { key: 'overview', label: 'Executive Overview' },
    { key: 'attack_timeline', label: 'Attack Timeline' },
    { key: 'business_impact', label: 'Business Impact' },
    { key: 'key_findings', label: 'Key Findings' },
    { key: 'remediation', label: 'Recommended Remediation' },
  ];

  return (
    <div style={s.page}>
      <div style={s.container}>
        <div style={{ color: '#58a6ff', fontSize: '13px', marginBottom: '20px' }}>
          <Link to={`/incidents/${id}`} style={{ color: '#58a6ff', textDecoration: 'none' }}>← Back to incident</Link>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
          <div>
            <div style={{ fontSize: '22px', fontWeight: 700, color: '#e6edf3', marginBottom: '4px' }}>Executive Summary</div>
            {incident && <div style={{ color: '#8b949e', fontSize: '14px' }}>{incident.title}</div>}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => window.print()} style={s.printBtn}>🖨 Print / Export PDF</button>
            {canEdit && !editing && <button onClick={startEdit} style={s.btn}>Edit</button>}
            {editing && <button onClick={handleSave} disabled={saving} style={s.btn}>{saving ? 'Saving…' : 'Save'}</button>}
            {editing && <button onClick={() => setEditing(false)} style={{ ...s.printBtn, marginLeft: 0 }}>Cancel</button>}
          </div>
        </div>

        {/* Risk Rating */}
        <div style={s.section}>
          <div style={s.label}>Risk Rating</div>
          {editing ? (
            <select style={s.select} value={form.risk_rating ?? ''} onChange={(e) => setForm({ ...form, risk_rating: e.target.value as Summary['risk_rating'] || undefined })}>
              <option value="">Not set</option>
              {['low', 'medium', 'high', 'critical'].map((r) => <option key={r} value={r}>{r.toUpperCase()}</option>)}
            </select>
          ) : (
            summary?.risk_rating ? (
              <span style={{ background: `${RISK_COLORS[summary.risk_rating]}22`, color: RISK_COLORS[summary.risk_rating], border: `1px solid ${RISK_COLORS[summary.risk_rating]}44`, borderRadius: '12px', padding: '4px 14px', fontSize: '13px', fontWeight: 700 }}>
                {summary.risk_rating.toUpperCase()}
              </span>
            ) : <span style={{ color: '#8b949e', fontSize: '13px' }}>Not set</span>
          )}
        </div>

        {fields.map(({ key, label }) => (
          <div key={key} style={s.section}>
            <div style={s.label}>{label}</div>
            {editing ? (
              <textarea
                style={s.textarea}
                value={(form[key] as string) ?? ''}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                placeholder={`Enter ${label.toLowerCase()}…`}
              />
            ) : (
              <div style={s.value}>{(summary?.[key] as string) || <span style={{ color: '#484f58' }}>Not yet documented.</span>}</div>
            )}
          </div>
        ))}

        {summary?.updated_at && (
          <div style={{ color: '#484f58', fontSize: '12px', textAlign: 'center' as const }}>
            Last updated: {new Date(summary.updated_at).toLocaleString()}
          </div>
        )}
      </div>
    </div>
  );
}
