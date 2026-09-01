import { useState, useEffect, useCallback, useRef } from 'react';
import { apiClient } from '../api/client';
import { Entity, YaraRule, YaraStringDef, YaraHashes } from '../types';
import { addToast } from './ToastContainer';

interface Props {
  incidentId: string;
  entities: Entity[];
  presetFromEntityId?: string | null;
  onPresetConsumed?: () => void;
}

interface ValidationError {
  field: string;
  message: string;
}

const s: Record<string, React.CSSProperties> = {
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' },
  title: { fontSize: '15px', fontWeight: 700, color: '#e6edf3' },
  btnPrimary: { background: '#238636', border: 'none', borderRadius: '6px', padding: '8px 16px', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer' },
  btnSecondary: { background: 'transparent', border: '1px solid #30363d', borderRadius: '6px', padding: '8px 16px', color: '#8b949e', fontSize: '13px', cursor: 'pointer' },
  card: { background: '#161b22', border: '1px solid #30363d', borderRadius: '8px', padding: '16px', marginBottom: '12px' },
  cardTitle: { fontSize: '14px', fontWeight: 700, color: '#e6edf3', fontFamily: 'monospace' },
  cardMeta: { color: '#8b949e', fontSize: '12px', marginTop: '4px' },
  pre: {
    background: '#0d1117', border: '1px solid #21262d', borderRadius: '6px', padding: '12px',
    fontSize: '12px', fontFamily: 'monospace', color: '#c9d1d9', overflowX: 'auto' as const,
    whiteSpace: 'pre' as const, margin: '10px 0 0',
  },
  label: { display: 'block', fontSize: '11px', fontWeight: 600, color: '#8b949e', textTransform: 'uppercase' as const, marginBottom: '4px', letterSpacing: '0.04em' },
  input: { width: '100%', background: '#0d1117', border: '1px solid #30363d', borderRadius: '6px', padding: '8px 10px', color: '#e6edf3', fontSize: '13px', outline: 'none', boxSizing: 'border-box' as const },
  textarea: { width: '100%', background: '#0d1117', border: '1px solid #30363d', borderRadius: '6px', padding: '8px 10px', color: '#e6edf3', fontSize: '13px', fontFamily: 'monospace', outline: 'none', boxSizing: 'border-box' as const, resize: 'vertical' as const, minHeight: '80px' },
  row: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' },
  errorBox: { background: '#f8514911', border: '1px solid #f8514944', borderRadius: '6px', padding: '10px 12px', marginTop: '10px', fontSize: '12px', color: '#f85149' },
  chip: { display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#21262d', border: '1px solid #30363d', borderRadius: '14px', padding: '4px 10px', fontSize: '11px', color: '#c9d1d9', cursor: 'pointer' },
};

const EMPTY_STRING: YaraStringDef = { identifier: '', type: 'text', value: '', nocase: false, wide: false, ascii: false, fullword: false };

function downloadFile(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function nextIdentifier(existing: YaraStringDef[]): string {
  let n = existing.length + 1;
  const used = new Set(existing.map((s) => s.identifier));
  while (used.has(`s${n}`)) n++;
  return `s${n}`;
}

export default function YaraRules({ incidentId, entities, presetFromEntityId, onPresetConsumed }: Props) {
  const [rules, setRules] = useState<YaraRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<YaraRule | null>(null);
  const [creating, setCreating] = useState(false);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [author, setAuthor] = useState('');
  const [reference, setReference] = useState('');
  const [tags, setTags] = useState('');
  const [strings, setStrings] = useState<YaraStringDef[]>([]);
  const [hashes, setHashes] = useState<YaraHashes>({});
  const [condition, setCondition] = useState('');
  const [entityId, setEntityId] = useState<string | undefined>(undefined);

  const [previewText, setPreviewText] = useState('');
  const [previewErrors, setPreviewErrors] = useState<ValidationError[]>([]);
  const [saving, setSaving] = useState(false);
  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fileEntities = entities.filter((e) => e.type === 'file');

  const loadRules = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get<YaraRule[]>(`/incidents/${incidentId}/yara-rules`);
      setRules(res.data);
    } catch {
      // list failure is non-fatal — the tab still renders with an empty list
    } finally {
      setLoading(false);
    }
  }, [incidentId]);

  useEffect(() => { loadRules(); }, [loadRules]);

  const resetForm = useCallback(() => {
    setName('');
    setDescription('');
    setAuthor('');
    setReference('');
    setTags('');
    setStrings([]);
    setHashes({});
    setCondition('');
    setEntityId(undefined);
    setPreviewText('');
    setPreviewErrors([]);
  }, []);

  const applySuggestion = useCallback(async (fromEntityId: string) => {
    try {
      const res = await apiClient.get<{
        name: string;
        hashes: YaraHashes;
        suggestedStrings: YaraStringDef[];
      }>(`/incidents/${incidentId}/yara-rules/suggest/${fromEntityId}`);
      setName(res.data.name);
      setHashes(res.data.hashes ?? {});
      setStrings(res.data.suggestedStrings ?? []);
      setEntityId(fromEntityId);
      const parts: string[] = [];
      if (res.data.hashes?.sha256) parts.push(`hash.sha256(0, filesize) == "${res.data.hashes.sha256.toLowerCase()}"`);
      else if (res.data.hashes?.md5) parts.push(`hash.md5(0, filesize) == "${res.data.hashes.md5.toLowerCase()}"`);
      if (res.data.suggestedStrings?.length) parts.push('any of them');
      setCondition(parts.join(' or ') || 'any of them');
    } catch {
      addToast({ id: Date.now().toString(), type: 'error', title: 'Suggestion Failed', body: 'Could not load entity metadata for this rule.', read: false, created_at: new Date().toISOString() });
    }
  }, [incidentId]);

  useEffect(() => {
    if (presetFromEntityId) {
      resetForm();
      setCreating(true);
      setEditing(null);
      applySuggestion(presetFromEntityId);
      onPresetConsumed?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presetFromEntityId]);

  // Debounced live preview
  useEffect(() => {
    if (!creating && !editing) return;
    if (previewTimer.current) clearTimeout(previewTimer.current);
    previewTimer.current = setTimeout(async () => {
      try {
        const res = await apiClient.post<{ errors: ValidationError[]; rule_text: string }>(
          `/incidents/${incidentId}/yara-rules/preview`,
          {
            name: name || 'Unnamed_Rule',
            description: description || undefined,
            author: author || undefined,
            reference: reference || undefined,
            tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
            strings,
            hashes,
            condition: condition || 'false',
          },
        );
        setPreviewText(res.data.rule_text);
        setPreviewErrors(res.data.errors);
      } catch {
        // preview is best-effort
      }
    }, 350);
    return () => { if (previewTimer.current) clearTimeout(previewTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, description, author, reference, tags, strings, hashes, condition, creating, editing]);

  function startCreate() {
    resetForm();
    setCreating(true);
    setEditing(null);
  }

  function startEdit(rule: YaraRule) {
    setName(rule.name);
    setDescription(rule.description ?? '');
    setAuthor(rule.author ?? '');
    setReference(rule.reference ?? '');
    setTags((rule.tags ?? []).join(', '));
    setStrings(rule.strings ?? []);
    setHashes(rule.hashes ?? {});
    setCondition(rule.condition);
    setEntityId(rule.entity_id ?? undefined);
    setEditing(rule);
    setCreating(false);
  }

  function cancelForm() {
    setCreating(false);
    setEditing(null);
    resetForm();
  }

  function addStringRow() {
    setStrings((prev) => [...prev, { ...EMPTY_STRING, identifier: nextIdentifier(prev) }]);
  }

  function updateStringRow(idx: number, patch: Partial<YaraStringDef>) {
    setStrings((prev) => prev.map((row, i) => (i === idx ? { ...row, ...patch } : row)));
  }

  function removeStringRow(idx: number) {
    setStrings((prev) => prev.filter((_, i) => i !== idx));
  }

  function insertIntoCondition(snippet: string) {
    setCondition((prev) => (prev.trim() ? `${prev.trim()} ${snippet}` : snippet));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const payload = {
        name,
        description: description || undefined,
        author: author || undefined,
        reference: reference || undefined,
        tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
        strings,
        hashes,
        condition,
        entity_id: entityId,
      };
      if (editing) {
        await apiClient.put(`/yara-rules/${editing.id}`, payload);
        addToast({ id: Date.now().toString(), type: 'info', title: 'Rule Updated', body: `"${name}" saved.`, read: false, created_at: new Date().toISOString() });
      } else {
        await apiClient.post(`/incidents/${incidentId}/yara-rules`, payload);
        addToast({ id: Date.now().toString(), type: 'info', title: 'Rule Created', body: `"${name}" saved.`, read: false, created_at: new Date().toISOString() });
      }
      cancelForm();
      loadRules();
    } catch (err: unknown) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = (err as any)?.response?.data;
      const details = Array.isArray(data?.details) ? (data.details as ValidationError[]) : [];
      if (details.length > 0) setPreviewErrors(details);
      addToast({ id: Date.now().toString(), type: 'error', title: 'Save Failed', body: data?.error ?? 'Could not save YARA rule.', read: false, created_at: new Date().toISOString() });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(rule: YaraRule) {
    if (!window.confirm(`Delete rule "${rule.name}"? This cannot be undone.`)) return;
    try {
      await apiClient.delete(`/yara-rules/${rule.id}`);
      addToast({ id: Date.now().toString(), type: 'info', title: 'Rule Deleted', body: `"${rule.name}" removed.`, read: false, created_at: new Date().toISOString() });
      loadRules();
    } catch {
      addToast({ id: Date.now().toString(), type: 'error', title: 'Delete Failed', body: 'You may not have permission (Senior Analyst or above required).', read: false, created_at: new Date().toISOString() });
    }
  }

  const showForm = creating || editing;
  const hasBlockingErrors = previewErrors.length > 0;

  return (
    <div>
      {!showForm && (
        <>
          <div style={s.header}>
            <span style={s.title}>YARA Rules ({rules.length})</span>
            <button type="button" style={s.btnPrimary} onClick={startCreate}>+ New Rule</button>
          </div>

          {loading && <div style={{ color: '#8b949e', fontSize: '13px' }}>Loading…</div>}
          {!loading && rules.length === 0 && (
            <div style={{ color: '#8b949e', fontSize: '14px', padding: '24px 0' }}>
              No YARA rules yet. Build one from scratch, or open a file entity and click "Generate YARA Rule".
            </div>
          )}

          {rules.map((rule) => (
            <div key={rule.id} style={s.card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
                <div>
                  <div style={s.cardTitle}>{rule.name}</div>
                  <div style={s.cardMeta}>
                    {rule.author ? `by ${rule.author} · ` : ''}
                    {new Date(rule.created_at).toLocaleString()}
                    {rule.tags?.length > 0 ? ` · ${rule.tags.join(', ')}` : ''}
                  </div>
                  {rule.description && <div style={{ ...s.cardMeta, marginTop: '6px', color: '#c9d1d9' }}>{rule.description}</div>}
                </div>
                <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                  <button type="button" style={s.btnSecondary} onClick={() => downloadFile(`${rule.name}.yar`, rule.rule_text)}>⇩ Download</button>
                  <button type="button" style={s.btnSecondary} onClick={() => startEdit(rule)}>Edit</button>
                  <button type="button" style={{ ...s.btnSecondary, color: '#f85149', borderColor: '#f8514944' }} onClick={() => handleDelete(rule)}>Delete</button>
                </div>
              </div>
              <pre style={s.pre}>{rule.rule_text}</pre>
            </div>
          ))}
        </>
      )}

      {showForm && (
        <div>
          <div style={s.header}>
            <span style={s.title}>{editing ? `Edit Rule: ${editing.name}` : 'New YARA Rule'}</span>
            <button type="button" style={s.btnSecondary} onClick={cancelForm}>Cancel</button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <div>
              <div style={s.card}>
                <div style={s.row}>
                  <div>
                    <label style={s.label}>Rule Name</label>
                    <input style={s.input} value={name} onChange={(e) => setName(e.target.value)} placeholder="Suspicious_Dropper_2026" />
                  </div>
                  <div>
                    <label style={s.label}>Author</label>
                    <input style={s.input} value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Your name" />
                  </div>
                </div>
                <div style={{ marginBottom: '12px' }}>
                  <label style={s.label}>Description</label>
                  <input style={s.input} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What does this rule detect?" />
                </div>
                <div style={s.row}>
                  <div>
                    <label style={s.label}>Reference</label>
                    <input style={s.input} value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Incident ID, CTI report link…" />
                  </div>
                  <div>
                    <label style={s.label}>Tags (comma-separated)</label>
                    <input style={s.input} value={tags} onChange={(e) => setTags(e.target.value)} placeholder="ransomware, dropper" />
                  </div>
                </div>

                {fileEntities.length > 0 && !editing && (
                  <div style={{ marginTop: '8px' }}>
                    <label style={s.label}>Pre-fill from file entity</label>
                    <select
                      style={s.input}
                      value={entityId ?? ''}
                      onChange={(e) => e.target.value && applySuggestion(e.target.value)}
                    >
                      <option value="">— select a file entity —</option>
                      {fileEntities.map((e) => <option key={e.id} value={e.id}>{e.value}</option>)}
                    </select>
                  </div>
                )}
              </div>

              <div style={s.card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <label style={{ ...s.label, marginBottom: 0 }}>Hashes (optional)</label>
                </div>
                {(['md5', 'sha1', 'sha256'] as const).map((k) => (
                  <div key={k} style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
                    <span style={{ width: '54px', color: '#8b949e', fontSize: '11px', textTransform: 'uppercase' as const, flexShrink: 0 }}>{k}</span>
                    <input
                      style={{ ...s.input, fontFamily: 'monospace' }}
                      value={hashes[k] ?? ''}
                      onChange={(e) => setHashes((prev) => ({ ...prev, [k]: e.target.value }))}
                      placeholder={`${k} hash…`}
                    />
                    {hashes[k] && (
                      <button
                        type="button"
                        style={{ ...s.btnSecondary, padding: '6px 10px', fontSize: '11px', whiteSpace: 'nowrap' as const }}
                        onClick={() => insertIntoCondition(`hash.${k}(0, filesize) == "${(hashes[k] ?? '').toLowerCase()}"`)}
                      >
                        Insert
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div style={s.card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <label style={{ ...s.label, marginBottom: 0 }}>Strings</label>
                  <button type="button" style={{ ...s.btnSecondary, padding: '4px 10px', fontSize: '11px' }} onClick={addStringRow}>+ Add String</button>
                </div>
                {strings.length === 0 && <div style={{ color: '#484f58', fontSize: '12px' }}>No strings defined.</div>}
                {strings.map((row, idx) => (
                  <div key={idx} style={{ border: '1px solid #21262d', borderRadius: '6px', padding: '10px', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                      <input
                        style={{ ...s.input, width: '90px', flexShrink: 0, fontFamily: 'monospace' }}
                        value={row.identifier}
                        onChange={(e) => updateStringRow(idx, { identifier: e.target.value.replace(/[^a-zA-Z0-9_]/g, '') })}
                        placeholder="s1"
                      />
                      <select style={{ ...s.input, width: '110px', flexShrink: 0 }} value={row.type} onChange={(e) => updateStringRow(idx, { type: e.target.value as YaraStringDef['type'] })}>
                        <option value="text">text</option>
                        <option value="hex">hex</option>
                        <option value="regex">regex</option>
                      </select>
                      <input
                        style={{ ...s.input, fontFamily: 'monospace' }}
                        value={row.value}
                        onChange={(e) => updateStringRow(idx, { value: e.target.value })}
                        placeholder={row.type === 'hex' ? '6A 40 ?? 00' : row.type === 'regex' ? 'regex pattern' : 'string value'}
                      />
                      <button type="button" style={{ ...s.btnSecondary, padding: '6px 10px', flexShrink: 0 }} onClick={() => removeStringRow(idx)}>✕</button>
                    </div>
                    <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' as const }}>
                      {(['nocase', 'wide', 'ascii', 'fullword'] as const).map((mod) => (
                        <label key={mod} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: '#8b949e', cursor: 'pointer' }}>
                          <input type="checkbox" checked={!!row[mod]} onChange={(e) => updateStringRow(idx, { [mod]: e.target.checked })} />
                          {mod}
                        </label>
                      ))}
                      <button type="button" style={{ ...s.chip, marginLeft: 'auto' }} onClick={() => insertIntoCondition(`$${row.identifier}`)}>
                        Insert ${row.identifier || '?'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div style={s.card}>
                <label style={s.label}>Condition</label>
                <textarea style={s.textarea} value={condition} onChange={(e) => setCondition(e.target.value)} placeholder="any of them" />
                <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' as const }}>
                  <button type="button" style={s.chip} onClick={() => insertIntoCondition('any of them')}>any of them</button>
                  <button type="button" style={s.chip} onClick={() => insertIntoCondition('all of them')}>all of them</button>
                  <button type="button" style={s.chip} onClick={() => insertIntoCondition('filesize < 1MB')}>filesize &lt; 1MB</button>
                  <button type="button" style={s.chip} onClick={() => setCondition('')}>clear</button>
                </div>
              </div>

              <button type="button" style={{ ...s.btnPrimary, width: '100%', padding: '12px', opacity: saving ? 0.6 : 1 }} onClick={handleSave} disabled={saving || !name.trim()}>
                {saving ? 'Saving…' : editing ? 'Save Changes' : 'Create Rule'}
              </button>
            </div>

            <div>
              <div style={{ ...s.card, position: 'sticky' as const, top: '16px' }}>
                <label style={s.label}>Live Preview</label>
                <pre style={s.pre}>{previewText || '// Fill in the form to preview the generated rule'}</pre>
                {hasBlockingErrors && (
                  <div style={s.errorBox}>
                    <strong>Validation issues:</strong>
                    <ul style={{ margin: '6px 0 0', paddingLeft: '18px' }}>
                      {previewErrors.map((e, i) => <li key={i}>{e.message}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
