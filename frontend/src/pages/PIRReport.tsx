import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { apiClient } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useLicense } from '../context/LicenseContext';
import { Incident } from '../types';
import { ROLE_RANK } from '../utils/constants';

const API_BASE = import.meta.env.VITE_API_URL || '/api/v1';

type Template = 'full' | 'executive';

interface PirReport {
  id?: string;
  incident_id: string;
  template?: Template;
  prepared_by?: string;
  classification?: string;
  executive_summary?: string;
  root_cause?: string;
  impact_assessment?: string;
  response_summary?: string;
  lessons_learned?: string;
  recommendations?: string;
  updated_at?: string;
}

interface EntityRow { id: string; type: string; value: string; notes?: string; status?: string; ioc_status?: string; }
interface TimelineRow { ts: string; action_type: string; user_email: string; description: string; }
interface KillChainRow { stage_name: string; value: string; type: string; confidence: string; technique_id?: string; name?: string; }
interface RelationshipRow { source_value?: string; relationship_type: string; target_value?: string; }
interface TaskRow { id: string; title: string; assignee_name?: string; assignee_email?: string; priority: string; status: string; }
interface BoundaryRow { id: string; name: string; zone_type: string; }

interface PreviewData {
  entities: EntityRow[];
  timeline: TimelineRow[];
  matrix: KillChainRow[];
  relationships: RelationshipRow[];
  tasks: TaskRow[];
  boundaries: BoundaryRow[];
  remediation: { total: number; verified: number };
}

async function fetchPreviewData(incidentId: string): Promise<PreviewData> {
  const [entitiesRes, timelineRes, matrixRes, relationshipsRes, tasksRes, boundariesRes, remediationRes] = await Promise.allSettled([
    apiClient.get(`/incidents/${incidentId}/entities`),
    apiClient.get(`/incidents/${incidentId}/timeline`),
    apiClient.get(`/incidents/${incidentId}/kill-chain/matrix`),
    apiClient.get(`/incidents/${incidentId}/relationships`),
    apiClient.get(`/incidents/${incidentId}/tasks`),
    apiClient.get(`/incidents/${incidentId}/boundaries`),
    apiClient.get(`/incidents/${incidentId}/remediation/progress`),
  ]);
  const ok = <T,>(r: PromiseSettledResult<{ data: T }>, fallback: T): T => (r.status === 'fulfilled' ? r.value.data : fallback);
  return {
    entities: ok(entitiesRes, []),
    // /incidents/:id/timeline rows are { ts, action_type, user_email, description, ... } — not event_time/event_type.
    timeline: ok(timelineRes, []),
    // /incidents/:id/kill-chain/matrix is a flat array of entity-to-stage rows, not { stages: [...] }.
    matrix: ok(matrixRes, []),
    relationships: ok(relationshipsRes, []),
    tasks: ok(tasksRes, []),
    boundaries: ok(boundariesRes, []),
    remediation: ok(remediationRes, { total: 0, verified: 0 }),
  };
}

// Derives draft narrative text from already-fetched incident data — client-side
// only, no AI call, mirroring ExecutiveSummary.tsx's buildAutoPopulate.
function buildAutoPopulate(incident: Incident, data: PreviewData): Partial<PirReport> {
  const { entities, timeline, matrix, relationships, tasks, remediation } = data;

  const typeCounts: Record<string, number> = {};
  for (const e of entities) typeCounts[e.type] = (typeCounts[e.type] ?? 0) + 1;
  const entitySummary = Object.entries(typeCounts).map(([t, n]) => `${n} ${t}${n > 1 ? 's' : ''}`).join(', ');
  const confirmedCount = entities.filter((e) => e.ioc_status === 'confirmed' || e.status === 'confirmed_malicious').length;
  const detected = new Date(incident.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  const executive_summary = [
    `This report documents the investigation and response to "${incident.title}", a ${incident.severity} severity incident detected on ${detected} and currently ${incident.status}.`,
    incident.description || null,
    entities.length > 0 ? `${entities.length} entities were identified during the investigation: ${entitySummary}.` : 'No entities were recorded for this incident.',
    confirmedCount > 0 ? `${confirmedCount} indicator${confirmedCount > 1 ? 's were' : ' was'} confirmed malicious.` : null,
  ].filter(Boolean).join('\n\n');

  const stageOrder = [...new Set(matrix.map((r) => r.stage_name))];
  const root_cause = stageOrder.length > 0
    ? `Observed activity mapped to the following kill chain stages, in order of first observation: ${stageOrder.join(' → ')}. Review the Kill Chain tab for full stage-by-stage detail and update this section with the confirmed initial access vector and root cause once determined.`
    : 'Root cause analysis is pending. No kill chain stages have been mapped yet — use the incident\'s Kill Chain tab to document the attack progression, then summarize the confirmed root cause here.';

  const highValue = entities.filter((e) => ['hostname', 'account', 'ip'].includes(e.type));
  const impactLines: string[] = [];
  if (incident.severity === 'critical' || incident.severity === 'high') {
    impactLines.push(`This is a ${incident.severity.toUpperCase()} severity incident.`);
  }
  if (highValue.length > 0) {
    impactLines.push(`${highValue.length} high-value asset(s) involved (${highValue.slice(0, 5).map((e) => e.value).join(', ')}${highValue.length > 5 ? '…' : ''}).`);
  }
  if (relationships.length > 0) {
    impactLines.push(`${relationships.length} entity relationship(s) identified, indicating possible lateral movement or propagation.`);
  }
  if (impactLines.length === 0) impactLines.push('Impact assessment is pending — document affected systems, data, and operational disruption here.');
  const impact_assessment = impactLines.join('\n');

  const completedTasks = tasks.filter((t) => t.status === 'complete').length;
  const response_summary = [
    tasks.length > 0 ? `${completedTasks} of ${tasks.length} response task(s) completed.` : 'No response tasks have been logged for this incident.',
    remediation.total > 0 ? `${remediation.verified} of ${remediation.total} remediation item(s) verified complete.` : null,
    timeline.length > 0 ? `${timeline.length} timeline event(s) recorded across the response.` : null,
  ].filter(Boolean).join('\n');

  const lessons_learned = 'Document what went well, what could be improved, and any process or tooling gaps surfaced during this response.';

  const recLines = ['Recommended next steps:'];
  const isolated = entities.filter((e) => e.status === 'isolated');
  if (isolated.length > 0) recLines.push(`  • Complete remediation of ${isolated.length} isolated asset(s) before returning to production.`);
  recLines.push('  • Validate all confirmed indicators against current threat intelligence.');
  recLines.push('  • Review and tighten any network boundary controls identified during the investigation.');
  recLines.push('  • Schedule a post-incident review with all involved stakeholders.');
  const recommendations = recLines.join('\n');

  return { executive_summary, root_cause, impact_assessment, response_summary, lessons_learned, recommendations };
}

const RISK_COLORS: Record<string, string> = { low: '#3fb950', medium: '#d29922', high: '#f0883e', critical: '#f85149' };

const s: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', background: '#0d1117', padding: '32px 24px', color: '#e6edf3' },
  container: { maxWidth: '900px', margin: '0 auto' },
  section: { background: '#161b22', border: '1px solid #30363d', borderRadius: '8px', padding: '20px', marginBottom: '16px' },
  label: { fontSize: '12px', fontWeight: 600, color: '#8b949e', textTransform: 'uppercase' as const, letterSpacing: '0.5px', marginBottom: '6px' },
  value: { fontSize: '14px', color: '#e6edf3', lineHeight: '1.6', whiteSpace: 'pre-wrap' as const },
  textarea: { width: '100%', background: '#0d1117', border: '1px solid #30363d', borderRadius: '6px', padding: '10px 12px', color: '#e6edf3', fontSize: '14px', fontFamily: 'inherit', resize: 'vertical' as const, minHeight: '90px', outline: 'none', boxSizing: 'border-box' as const, lineHeight: '1.5' },
  input: { background: '#0d1117', border: '1px solid #30363d', borderRadius: '6px', padding: '8px 12px', color: '#e6edf3', fontSize: '14px', outline: 'none', boxSizing: 'border-box' as const, width: '100%' },
  btn: { background: '#238636', border: 'none', borderRadius: '6px', padding: '8px 16px', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer' },
  outlineBtn: { background: 'transparent', border: '1px solid #30363d', borderRadius: '6px', padding: '8px 16px', color: '#8b949e', fontSize: '13px', cursor: 'pointer' },
  table: { width: '100%', borderCollapse: 'collapse' as const, fontSize: '13px' },
  th: { textAlign: 'left' as const, color: '#8b949e', fontSize: '11px', textTransform: 'uppercase' as const, letterSpacing: '0.4px', padding: '6px 8px', borderBottom: '1px solid #30363d' },
  td: { padding: '6px 8px', borderBottom: '1px solid #21262d', color: '#c9d1d9' },
};

const NARRATIVE_FIELDS: Array<{ key: keyof PirReport; label: string; fullOnly?: boolean }> = [
  { key: 'executive_summary', label: 'Executive Summary' },
  { key: 'root_cause', label: 'Root Cause', fullOnly: true },
  { key: 'impact_assessment', label: 'Impact Assessment' },
  { key: 'response_summary', label: 'Response Summary', fullOnly: true },
  { key: 'lessons_learned', label: 'Lessons Learned' },
  { key: 'recommendations', label: 'Recommendations' },
];

export default function PIRReport() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { isFeatureEnabled } = useLicense();
  const [incident, setIncident] = useState<Incident | null>(null);
  const [pir, setPir] = useState<PirReport | null>(null);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Partial<PirReport>>({});
  const [template, setTemplate] = useState<Template>('full');
  const [saving, setSaving] = useState(false);
  const [populating, setPopulating] = useState(false);

  const canEdit = ROLE_RANK[user?.role ?? ''] >= ROLE_RANK['senior_analyst'];

  const load = useCallback(async () => {
    if (!id) return;
    const [incRes, pirRes, previewData] = await Promise.all([
      apiClient.get<Incident>(`/incidents/${id}`).catch(() => null),
      apiClient.get<PirReport | null>(`/incidents/${id}/pir`).catch(() => null),
      fetchPreviewData(id),
    ]);
    if (incRes) setIncident(incRes.data);
    if (pirRes?.data) {
      setPir(pirRes.data);
      setForm(pirRes.data);
      if (pirRes.data.template) setTemplate(pirRes.data.template);
    }
    setPreview(previewData);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function handleAutoPopulate() {
    if (!incident || !preview) return;
    setPopulating(true);
    try {
      const populated = buildAutoPopulate(incident, preview);
      setForm((prev) => ({ ...prev, ...populated }));
      setEditing(true);
    } finally {
      setPopulating(false);
    }
  }

  async function handleSave() {
    if (!id) return;
    setSaving(true);
    try {
      const r = await apiClient.put<PirReport>(`/incidents/${id}/pir`, { ...form, template });
      setPir(r.data);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  function startEdit() {
    setForm(pir ?? { incident_id: id!, prepared_by: user?.name || user?.email });
    setEditing(true);
  }

  if (!incident || !preview) {
    return <div style={{ ...s.page, textAlign: 'center' as const, color: '#8b949e' }}>Loading…</div>;
  }

  const isFull = template === 'full';

  // Condensed timeline for the executive preview: one entry per distinct
  // action type (earliest occurrence), mirroring the backend PDF's logic.
  const sortedTimeline = [...preview.timeline].sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());
  const milestoneTimeline = (() => {
    const seen = new Set<string>();
    const out: TimelineRow[] = [];
    for (const e of sortedTimeline) { if (!seen.has(e.action_type)) { seen.add(e.action_type); out.push(e); } }
    return out;
  })();
  const timelineToShow = isFull ? sortedTimeline : milestoneTimeline;
  const hiddenEventCount = isFull ? 0 : preview.timeline.length - milestoneTimeline.length;

  const entityTypes = [...new Set(preview.entities.map((e) => e.type))];

  return (
    <div style={s.page}>
      <style>{`@media print { .pir-no-print { display: none !important; } }`}</style>
      <div style={s.container}>
        <div className="pir-no-print" style={{ color: '#58a6ff', fontSize: '13px', marginBottom: '20px' }}>
          <Link to={`/incidents/${id}`} style={{ color: '#58a6ff', textDecoration: 'none' }}>← Back to incident</Link>
        </div>

        <div className="pir-no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', flexWrap: 'wrap' as const, gap: '12px' }}>
          <div>
            <div style={{ fontSize: '22px', fontWeight: 700, color: '#e6edf3', marginBottom: '4px' }}>Post-Incident Report</div>
            <div style={{ color: '#8b949e', fontSize: '14px' }}>{incident.title}</div>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' as const }}>
            {isFeatureEnabled('pdf_export') ? (
              <button type="button"
                onClick={() => window.open(`${API_BASE}/incidents/${id}/pir-report?template=${template}`, '_blank')}
                style={s.outlineBtn}
              >
                Export PDF
              </button>
            ) : (
              <button type="button" title="PDF Export requires Professional license" disabled
                style={{ ...s.outlineBtn, color: '#484f58', cursor: 'not-allowed', opacity: 0.5 }}
              >
                Export PDF
              </button>
            )}
            {canEdit && (
              <button type="button"
                onClick={handleAutoPopulate}
                disabled={populating}
                title="Pre-fill narrative sections from this incident's entities, timeline, kill chain and tasks. You can edit before saving."
                style={{ background: '#1f6feb', border: 'none', borderRadius: '6px', padding: '8px 16px', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: populating ? 'wait' : 'pointer', opacity: populating ? 0.7 : 1 }}
              >
                {populating ? 'Populating…' : 'Auto-populate'}
              </button>
            )}
            {canEdit && !editing && <button type="button" onClick={startEdit} style={s.btn}>Edit</button>}
            {editing && <button type="button" onClick={handleSave} disabled={saving} style={s.btn}>{saving ? 'Saving…' : 'Save'}</button>}
            {editing && <button type="button" onClick={() => setEditing(false)} style={s.outlineBtn}>Cancel</button>}
          </div>
        </div>

        {/* Template selector */}
        <div className="pir-no-print" style={{ ...s.section, display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' as const }}>
          <div style={{ ...s.label, marginBottom: 0 }}>Template</div>
          <div style={{ display: 'flex', gap: '6px' }}>
            {([
              ['full', 'Full Technical Report'],
              ['executive', 'Executive Briefing'],
            ] as [Template, string][]).map(([val, label]) => (
              <button type="button" key={val}
                onClick={() => setTemplate(val)}
                style={{
                  background: template === val ? '#58a6ff22' : 'transparent',
                  border: `1px solid ${template === val ? '#58a6ff' : '#30363d'}`,
                  borderRadius: '20px', padding: '6px 16px', fontSize: '13px', fontWeight: 600,
                  color: template === val ? '#58a6ff' : '#8b949e', cursor: 'pointer',
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <div style={{ color: '#484f58', fontSize: '12px' }}>
            {isFull ? 'Complete technical detail — for SOC/IR archival.' : 'Condensed, leadership-facing summary.'}
          </div>
        </div>

        {/* Header fields: classification / prepared by */}
        <div style={s.section}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '16px', alignItems: 'end' }}>
            <div>
              <div style={s.label}>Classification</div>
              {editing ? (
                <input style={s.input} value={form.classification ?? ''} onChange={(e) => setForm({ ...form, classification: e.target.value })} placeholder="e.g. TLP:AMBER" />
              ) : <div style={s.value}>{pir?.classification || <span style={{ color: '#484f58' }}>Not set</span>}</div>}
            </div>
            <div>
              <div style={s.label}>Prepared By</div>
              {editing ? (
                <input style={s.input} value={form.prepared_by ?? ''} onChange={(e) => setForm({ ...form, prepared_by: e.target.value })} placeholder={user?.name || user?.email || ''} />
              ) : <div style={s.value}>{pir?.prepared_by || <span style={{ color: '#484f58' }}>Not set</span>}</div>}
            </div>
            <div>
              <span style={{ background: `${RISK_COLORS[incident.severity] ?? '#8b949e'}22`, color: RISK_COLORS[incident.severity] ?? '#8b949e', border: `1px solid ${RISK_COLORS[incident.severity] ?? '#8b949e'}44`, borderRadius: '12px', padding: '4px 14px', fontSize: '13px', fontWeight: 700 }}>
                {incident.severity.toUpperCase()}
              </span>
            </div>
          </div>
        </div>

        {/* Narrative sections */}
        {NARRATIVE_FIELDS.filter((f) => isFull || !f.fullOnly).map(({ key, label }) => (
          <div key={key} style={s.section}>
            <div style={s.label}>{label}</div>
            {editing ? (
              <textarea style={s.textarea} value={(form[key] as string) ?? ''} onChange={(e) => setForm({ ...form, [key]: e.target.value })} placeholder={`Enter ${label.toLowerCase()}…`} />
            ) : (
              <div style={s.value}>{(pir?.[key] as string) || <span style={{ color: '#484f58' }}>Not yet documented.</span>}</div>
            )}
          </div>
        ))}

        {/* Remediation progress — both templates */}
        <div style={s.section}>
          <div style={s.label}>Remediation Progress</div>
          <div style={s.value}>
            {preview.remediation.total > 0
              ? `${preview.remediation.verified} of ${preview.remediation.total} remediation item(s) verified complete.`
              : 'No remediation items recorded.'}
          </div>
        </div>

        {/* Timeline preview */}
        <div style={s.section}>
          <div style={s.label}>{isFull ? 'Incident Timeline' : 'Timeline Milestones'}</div>
          {timelineToShow.length === 0 ? (
            <div style={{ color: '#484f58', fontSize: '13px' }}>No timeline events recorded.</div>
          ) : (
            <table style={s.table}>
              <thead>
                <tr>
                  <th style={s.th}>Time</th>
                  <th style={s.th}>Type</th>
                  {isFull && <th style={s.th}>Actor</th>}
                  <th style={s.th}>Description</th>
                </tr>
              </thead>
              <tbody>
                {timelineToShow.map((e, i) => (
                  <tr key={i}>
                    <td style={s.td}>{new Date(e.ts).toLocaleString()}</td>
                    <td style={s.td}>{(e.action_type ?? '').replace(/_/g, ' ')}</td>
                    {isFull && <td style={s.td}>{e.user_email}</td>}
                    <td style={s.td}>{e.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {hiddenEventCount > 0 && (
            <div style={{ color: '#484f58', fontSize: '12px', marginTop: '8px' }}>+{hiddenEventCount} more event(s) in the full report.</div>
          )}
        </div>

        {isFull && (
          <>
            {/* Entity inventory */}
            <div style={s.section}>
              <div style={s.label}>Entity Inventory ({preview.entities.length})</div>
              {preview.entities.length === 0 ? (
                <div style={{ color: '#484f58', fontSize: '13px' }}>No entities recorded.</div>
              ) : entityTypes.map((type) => (
                <div key={type} style={{ marginBottom: '12px' }}>
                  <div style={{ color: '#c9d1d9', fontSize: '12px', fontWeight: 700, marginBottom: '4px', textTransform: 'capitalize' as const }}>{type}</div>
                  <table style={s.table}>
                    <thead><tr><th style={s.th}>Value</th><th style={s.th}>IOC Status</th><th style={s.th}>Notes</th></tr></thead>
                    <tbody>
                      {preview.entities.filter((e) => e.type === type).map((e) => (
                        <tr key={e.id}>
                          <td style={{ ...s.td, fontFamily: 'monospace' }}>{e.value}</td>
                          <td style={s.td}>{e.ioc_status ?? e.status ?? ''}</td>
                          <td style={s.td}>{e.notes ?? ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>

            {/* Kill chain */}
            <div style={s.section}>
              <div style={s.label}>Kill Chain Breakdown</div>
              {preview.matrix.length === 0 ? (
                <div style={{ color: '#484f58', fontSize: '13px' }}>No kill chain mappings recorded.</div>
              ) : (
                [...new Set(preview.matrix.map((r) => r.stage_name))].map((stage) => (
                  <div key={stage} style={{ marginBottom: '8px' }}>
                    <div style={{ color: '#c9d1d9', fontSize: '12px', fontWeight: 700, marginBottom: '4px' }}>{stage}</div>
                    {preview.matrix.filter((r) => r.stage_name === stage).map((r, i) => (
                      <div key={i} style={{ color: '#8b949e', fontSize: '13px', marginLeft: '8px' }}>• [{r.type}] {r.value} — confidence: {r.confidence}</div>
                    ))}
                  </div>
                ))
              )}
            </div>

            {/* Relationships */}
            <div style={s.section}>
              <div style={s.label}>Entity Relationships ({preview.relationships.length})</div>
              {preview.relationships.length === 0 ? (
                <div style={{ color: '#484f58', fontSize: '13px' }}>No relationships recorded.</div>
              ) : (
                <table style={s.table}>
                  <thead><tr><th style={s.th}>Source</th><th style={s.th}>Relationship</th><th style={s.th}>Target</th></tr></thead>
                  <tbody>
                    {preview.relationships.map((r, i) => (
                      <tr key={i}><td style={s.td}>{r.source_value}</td><td style={s.td}>{r.relationship_type}</td><td style={s.td}>{r.target_value}</td></tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Response actions */}
            <div style={s.section}>
              <div style={s.label}>Response Actions ({preview.tasks.length})</div>
              {preview.tasks.length === 0 ? (
                <div style={{ color: '#484f58', fontSize: '13px' }}>No tasks recorded.</div>
              ) : (
                <table style={s.table}>
                  <thead><tr><th style={s.th}>Task</th><th style={s.th}>Assignee</th><th style={s.th}>Priority</th><th style={s.th}>Status</th></tr></thead>
                  <tbody>
                    {preview.tasks.map((t) => (
                      <tr key={t.id}><td style={s.td}>{t.title}</td><td style={s.td}>{t.assignee_name ?? t.assignee_email ?? 'Unassigned'}</td><td style={s.td}>{t.priority}</td><td style={s.td}>{t.status.replace(/_/g, ' ')}</td></tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Boundaries */}
            <div style={s.section}>
              <div style={s.label}>Network Boundaries ({preview.boundaries.length})</div>
              {preview.boundaries.length === 0 ? (
                <div style={{ color: '#484f58', fontSize: '13px' }}>No network boundaries defined.</div>
              ) : (
                preview.boundaries.map((b) => (
                  <div key={b.id} style={{ color: '#8b949e', fontSize: '13px' }}>{b.name} ({b.zone_type})</div>
                ))
              )}
            </div>
          </>
        )}

        {pir?.updated_at && (
          <div style={{ color: '#484f58', fontSize: '12px', textAlign: 'center' as const }}>
            Last updated: {new Date(pir.updated_at).toLocaleString()}
          </div>
        )}
      </div>
    </div>
  );
}
