import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { apiClient } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Incident } from '../types';
import { ROLE_RANK } from '../utils/constants';

async function buildAutoPopulate(incidentId: string, incident: Incident): Promise<Partial<Summary>> {
  const [entitiesRes, matrixRes, timelineRes, relationshipsRes] = await Promise.allSettled([
    apiClient.get(`/incidents/${incidentId}/entities`),
    apiClient.get(`/incidents/${incidentId}/kill-chain/matrix`),
    apiClient.get(`/incidents/${incidentId}/timeline`),
    apiClient.get(`/incidents/${incidentId}/relationships`),
  ]);

  const entities: Record<string, unknown>[] = entitiesRes.status === 'fulfilled' ? entitiesRes.value.data : [];
  const matrix: Record<string, unknown>[] = matrixRes.status === 'fulfilled' ? matrixRes.value.data : [];
  const timeline: Record<string, unknown>[] = timelineRes.status === 'fulfilled' ? timelineRes.value.data : [];
  const relationships: Record<string, unknown>[] = relationshipsRes.status === 'fulfilled' ? relationshipsRes.value.data : [];

  // --- Overview ---
  const entityTypeCounts: Record<string, number> = {};
  for (const e of entities) {
    const t = e.type as string;
    entityTypeCounts[t] = (entityTypeCounts[t] ?? 0) + 1;
  }
  const entitySummary = Object.entries(entityTypeCounts)
    .map(([t, n]) => `${n} ${t}${n > 1 ? 's' : ''}`)
    .join(', ');
  const maliciousCount = entities.filter((e) => e.status === 'confirmed_malicious').length;
  const createdDate = new Date(incident.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const overview = [
    `Incident: ${incident.title}`,
    `Severity: ${incident.severity.toUpperCase()} | Status: ${incident.status.toUpperCase()}`,
    `Detected: ${createdDate}`,
    '',
    incident.description ? incident.description : null,
    '',
    entities.length > 0
      ? `${entities.length} entities identified across the incident scope: ${entitySummary}.`
      : 'No entities have been recorded for this incident.',
    maliciousCount > 0
      ? `${maliciousCount} entity${maliciousCount > 1 ? 'ies' : 'y'} confirmed malicious.`
      : null,
  ].filter((l) => l !== null).join('\n').trim();

  // --- Attack Timeline ---
  const timelineLines: string[] = [];
  if (timeline.length > 0) {
    // GET /incidents/:id/timeline returns rows shaped { ts, action_type, user_email, description, ... }
    // (see TimelineEntry in types.ts) — not event_time/event_type.
    const sorted = [...timeline].sort((a, b) =>
      new Date(a.ts as string).getTime() - new Date(b.ts as string).getTime(),
    );
    for (const evt of sorted) {
      const d = new Date(evt.ts as string).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
      const actionLabel = (evt.action_type as string)?.replace(/_/g, ' ') ?? 'EVENT';
      const actor = (evt.user_email as string) ?? 'unknown';
      timelineLines.push(`[${d}] ${actionLabel} (${actor}): ${evt.description as string}`);
    }
  }

  // Supplement with kill chain stage progression
  const stageMap: Record<string, string[]> = {};
  for (const row of matrix) {
    const stage = row.stage_name as string;
    if (!stageMap[stage]) stageMap[stage] = [];
    stageMap[stage].push(row.value as string);
  }
  const kcLines = Object.entries(stageMap).map(
    ([stage, vals]) => `${stage}: ${vals.slice(0, 3).join(', ')}${vals.length > 3 ? ` +${vals.length - 3} more` : ''}`,
  );

  const attackTimeline = [
    timelineLines.length > 0 ? timelineLines.join('\n') : 'No timeline events recorded.',
    kcLines.length > 0 ? '\nKill Chain Progression:\n' + kcLines.join('\n') : '',
  ].join('\n').trim();

  // --- Business Impact ---
  const highValueTypes = ['hostname', 'account', 'ip'];
  const highValueEntities = entities.filter((e) => highValueTypes.includes(e.type as string));
  const isolatedOrContained = entities.filter((e) =>
    ['isolated', 'contained', 'confirmed_malicious'].includes(e.status as string),
  );
  const impactLines: string[] = [];
  if (incident.severity === 'critical' || incident.severity === 'high') {
    impactLines.push(`This is a ${incident.severity.toUpperCase()} severity incident requiring immediate attention.`);
  }
  if (highValueEntities.length > 0) {
    impactLines.push(`${highValueEntities.length} high-value asset${highValueEntities.length > 1 ? 's' : ''} involved (${highValueEntities.slice(0, 5).map((e) => e.value as string).join(', ')}${highValueEntities.length > 5 ? '…' : ''}).`);
  }
  if (isolatedOrContained.length > 0) {
    impactLines.push(`${isolatedOrContained.length} asset${isolatedOrContained.length > 1 ? 's' : ''} isolated or contained as a result of the incident.`);
  }
  if (relationships.length > 0) {
    impactLines.push(`${relationships.length} entity relationship${relationships.length > 1 ? 's' : ''} identified, indicating lateral movement or propagation paths.`);
  }
  if (impactLines.length === 0) {
    impactLines.push('Business impact is currently under assessment. Please update this section with affected systems, data, and operational disruption details.');
  }
  const businessImpact = impactLines.join('\n');

  // --- Key Findings ---
  const findingLines: string[] = [];
  const uniqueTtps = Array.from(
    new Map(
      (matrix as { technique_id?: string; name?: string }[])
        .filter((r) => r.technique_id)
        .map((r) => [r.technique_id, r])
    ).values(),
  );
  if (uniqueTtps.length > 0) {
    findingLines.push(`MITRE ATT&CK TTPs Observed (${uniqueTtps.length}):`);
    for (const t of uniqueTtps.slice(0, 10)) {
      findingLines.push(`  • ${t.technique_id}: ${t.name ?? ''}`);
    }
    if (uniqueTtps.length > 10) findingLines.push(`  … and ${uniqueTtps.length - 10} more`);
  }
  if (kcLines.length > 0 && uniqueTtps.length === 0) {
    findingLines.push('Kill Chain Stages with Activity:');
    for (const l of kcLines) findingLines.push(`  • ${l}`);
  }
  const malicious = entities.filter((e) => e.status === 'confirmed_malicious');
  if (malicious.length > 0) {
    findingLines.push('');
    findingLines.push('Confirmed Malicious Indicators:');
    for (const e of malicious.slice(0, 10)) {
      findingLines.push(`  • [${e.type}] ${e.value}`);
    }
  }
  if (findingLines.length === 0) {
    findingLines.push('Key findings are pending analysis. Assign entities to kill chain stages and mark confirmed indicators to populate this section.');
  }
  const keyFindings = findingLines.join('\n');

  // --- Remediation ---
  const remLines: string[] = [];
  const isolatedEntities = entities.filter((e) => e.status === 'isolated');
  const containedEntities = entities.filter((e) => e.status === 'contained');
  const underInvestigation = entities.filter((e) => e.status === 'under_investigation');
  if (isolatedEntities.length > 0) {
    remLines.push(`Isolated assets requiring remediation (${isolatedEntities.length}): ${isolatedEntities.slice(0, 5).map((e) => e.value as string).join(', ')}${isolatedEntities.length > 5 ? '…' : ''}.`);
  }
  if (containedEntities.length > 0) {
    remLines.push(`Contained entities pending clearance (${containedEntities.length}): ${containedEntities.slice(0, 5).map((e) => e.value as string).join(', ')}${containedEntities.length > 5 ? '…' : ''}.`);
  }
  if (underInvestigation.length > 0) {
    remLines.push(`Entities still under investigation (${underInvestigation.length}) — do not clear until analysis is complete.`);
  }
  remLines.push('');
  remLines.push('Recommended actions:');
  remLines.push('  1. Validate all confirmed malicious indicators against threat intelligence feeds.');
  remLines.push('  2. Reset credentials for any compromised accounts identified.');
  remLines.push('  3. Patch or reimage affected endpoints.');
  remLines.push('  4. Review and update network boundary controls based on identified traversal paths.');
  remLines.push('  5. Conduct post-incident review within 5 business days.');
  const remediation = remLines.join('\n');

  // --- Risk Rating ---
  const risk_rating = (incident.severity === 'critical' ? 'critical'
    : incident.severity === 'high' ? 'high'
    : incident.severity === 'medium' ? 'medium'
    : 'low') as Summary['risk_rating'];

  return { overview, attack_timeline: attackTimeline, business_impact: businessImpact, key_findings: keyFindings, remediation, risk_rating };
}

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
  const [populating, setPopulating] = useState(false);

  const canEdit = ROLE_RANK[user?.role ?? ''] >= ROLE_RANK['senior_analyst'];

  async function handleAutoPopulate() {
    if (!incident) return;
    setPopulating(true);
    try {
      const populated = await buildAutoPopulate(id!, incident);
      setForm((prev) => ({ ...prev, ...populated }));
      setEditing(true);
    } finally {
      setPopulating(false);
    }
  }

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
            <button type="button" onClick={() => window.print()} style={s.printBtn}>Print / Export PDF</button>
            {canEdit && (
              <button type="button"
                onClick={handleAutoPopulate}
                disabled={populating}
                title="Pre-fill all fields from incident entities, kill chain, TTPs and timeline. You can edit before saving."
                style={{ background: '#1f6feb', border: 'none', borderRadius: '6px', padding: '8px 16px', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: populating ? 'wait' : 'pointer', opacity: populating ? 0.7 : 1 }}
              >
                {populating ? 'Populating…' : 'Auto-populate'}
              </button>
            )}
            {canEdit && !editing && <button type="button" onClick={startEdit} style={s.btn}>Edit</button>}
            {editing && <button type="button" onClick={handleSave} disabled={saving} style={s.btn}>{saving ? 'Saving…' : 'Save'}</button>}
            {editing && <button type="button" onClick={() => setEditing(false)} style={{ ...s.printBtn, marginLeft: 0 }}>Cancel</button>}
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
