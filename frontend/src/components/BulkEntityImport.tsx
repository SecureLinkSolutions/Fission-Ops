import { useState, useRef } from 'react';
import { apiClient } from '../api/client';
import { EntityType } from '../types';
import { addToast } from './ToastContainer';

interface Props {
  incidentId: string;
  onImported: () => void;
}

const VALID_TYPES: EntityType[] = ['hostname', 'ip', 'email', 'domain', 'account', 'file', 'process', 'registry', 'certificate', 'url', 'custom'];

interface ParsedRow {
  type: string;
  value: string;
  notes?: string;
  valid: boolean;
  error?: string;
}

interface BulkResult {
  created: unknown[];
  errors: { index: number; value: string; error: string }[];
  total: number;
  succeeded: number;
  failed: number;
}

const s: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(1,4,9,0.75)', backdropFilter: 'blur(2px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
  },
  modal: {
    background: '#161b22', border: '1px solid #30363d', borderRadius: '10px',
    width: '720px', maxWidth: '92vw', maxHeight: '85vh', display: 'flex', flexDirection: 'column',
    boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
  },
  header: {
    padding: '16px 20px', borderBottom: '1px solid #30363d',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  },
  title: { fontSize: '15px', fontWeight: 700, color: '#e6edf3' },
  body: { padding: '20px', overflowY: 'auto', flex: 1 },
  footer: { padding: '14px 20px', borderTop: '1px solid #30363d', display: 'flex', justifyContent: 'flex-end', gap: '10px' },
  closeBtn: { background: 'transparent', border: 'none', color: '#8b949e', fontSize: '18px', cursor: 'pointer', lineHeight: 1 },
  textarea: {
    width: '100%', minHeight: '160px', background: '#0d1117', border: '1px solid #30363d',
    borderRadius: '6px', padding: '10px 12px', color: '#e6edf3', fontSize: '13px', fontFamily: 'monospace',
    resize: 'vertical' as const, outline: 'none', boxSizing: 'border-box' as const,
  },
  hint: { color: '#8b949e', fontSize: '12px', marginTop: '8px', lineHeight: 1.6 },
  btnPrimary: { background: '#238636', border: 'none', borderRadius: '6px', padding: '8px 18px', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer' },
  btnSecondary: { background: 'transparent', border: '1px solid #30363d', borderRadius: '6px', padding: '8px 18px', color: '#8b949e', fontSize: '13px', cursor: 'pointer' },
  table: { width: '100%', borderCollapse: 'collapse' as const, fontSize: '12px' },
  th: { textAlign: 'left' as const, color: '#8b949e', fontWeight: 600, padding: '6px 8px', borderBottom: '1px solid #30363d', textTransform: 'uppercase' as const, fontSize: '10px' },
  td: { padding: '6px 8px', borderBottom: '1px solid #21262d', color: '#e6edf3', fontFamily: 'monospace' },
  fileBtn: { background: '#21262d', border: '1px solid #30363d', borderRadius: '6px', padding: '7px 14px', color: '#c9d1d9', fontSize: '12px', cursor: 'pointer' },
};

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') { inQuotes = false; }
      else { cur += ch; }
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ',') { fields.push(cur); cur = ''; }
      else cur += ch;
    }
  }
  fields.push(cur);
  return fields.map((f) => f.trim());
}

function parseInput(raw: string): ParsedRow[] {
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  if (lines.length === 0) return [];

  // Detect and skip a header row (e.g. "type,value,notes")
  const first = parseCsvLine(lines[0]).map((f) => f.toLowerCase());
  const startIdx = first[0] === 'type' && first[1] === 'value' ? 1 : 0;

  const rows: ParsedRow[] = [];
  for (let i = startIdx; i < lines.length; i++) {
    const fields = parseCsvLine(lines[i]);
    const type = (fields[0] ?? '').toLowerCase();
    const value = fields[1] ?? '';
    const notes = fields[2] || undefined;

    if (!type && !value) continue;

    if (!VALID_TYPES.includes(type as EntityType)) {
      rows.push({ type, value, notes, valid: false, error: `Unknown type "${type}"` });
    } else if (!value) {
      rows.push({ type, value, notes, valid: false, error: 'Missing value' });
    } else if (value.length > 255) {
      rows.push({ type, value, notes, valid: false, error: 'Value too long (max 255 chars)' });
    } else {
      rows.push({ type, value, notes, valid: true });
    }
  }
  return rows;
}

export default function BulkEntityImport({ incidentId, onImported }: Props) {
  const [open, setOpen] = useState(false);
  const [raw, setRaw] = useState('');
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<BulkResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function reset() {
    setRaw('');
    setRows([]);
    setResult(null);
  }

  function close() {
    setOpen(false);
    reset();
  }

  function handleParse() {
    setRows(parseInput(raw));
    setResult(null);
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? '');
      setRaw(text);
      setRows(parseInput(text));
      setResult(null);
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  async function handleImport() {
    const validRows = rows.filter((r) => r.valid);
    if (validRows.length === 0) return;
    setImporting(true);
    try {
      const res = await apiClient.post<BulkResult>(`/incidents/${incidentId}/entities/bulk`, {
        entities: validRows.map((r) => ({ type: r.type, value: r.value, notes: r.notes })),
      });
      setResult(res.data);
      onImported();
      if (res.data.failed === 0) {
        addToast({
          id: Date.now().toString(),
          type: 'info',
          title: 'Bulk Import Complete',
          body: `${res.data.succeeded} entities created.`,
          read: false,
          created_at: new Date().toISOString(),
        });
      }
    } catch (err: unknown) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const msg = (err as any)?.response?.data?.error ?? 'Bulk import failed';
      addToast({
        id: Date.now().toString(),
        type: 'error',
        title: 'Bulk Import Failed',
        body: msg,
        read: false,
        created_at: new Date().toISOString(),
      });
    } finally {
      setImporting(false);
    }
  }

  const validCount = rows.filter((r) => r.valid).length;
  const invalidCount = rows.length - validCount;

  if (!open) {
    return (
      <button type="button" style={s.fileBtn} onClick={() => setOpen(true)}>
        ⇪ Bulk Import
      </button>
    );
  }

  return (
    <div style={s.overlay} onClick={close}>
      <div style={s.modal} onClick={(e) => e.stopPropagation()}>
        <div style={s.header}>
          <span style={s.title}>Bulk Import Entities</span>
          <button type="button" style={s.closeBtn} onClick={close}>✕</button>
        </div>
        <div style={s.body}>
          {!result && (
            <>
              <textarea
                style={s.textarea}
                value={raw}
                onChange={(e) => { setRaw(e.target.value); setRows([]); }}
                placeholder={'type,value,notes\nip,192.168.1.50,Suspicious beacon\ndomain,evil-domain.com,\nfile,malware.exe,Dropped by phishing email'}
              />
              <div style={s.hint}>
                One entity per line: <code>type,value,notes</code> (notes optional). Valid types: {VALID_TYPES.join(', ')}.
                {' '}A header row is auto-detected and skipped.
              </div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '12px', alignItems: 'center' }}>
                <input ref={fileInputRef} type="file" accept=".csv,text/csv,text/plain" onChange={handleFileSelect} style={{ display: 'none' }} />
                <button type="button" style={s.fileBtn} onClick={() => fileInputRef.current?.click()}>
                  Upload CSV File
                </button>
                <button type="button" style={s.btnSecondary} onClick={handleParse} disabled={!raw.trim()}>
                  Preview
                </button>
              </div>

              {rows.length > 0 && (
                <div style={{ marginTop: '16px' }}>
                  <div style={{ display: 'flex', gap: '12px', marginBottom: '10px', fontSize: '12px' }}>
                    <span style={{ color: '#3fb950' }}>{validCount} valid</span>
                    {invalidCount > 0 && <span style={{ color: '#f85149' }}>{invalidCount} invalid (will be skipped)</span>}
                  </div>
                  <div style={{ maxHeight: '260px', overflowY: 'auto', border: '1px solid #21262d', borderRadius: '6px' }}>
                    <table style={s.table}>
                      <thead>
                        <tr>
                          <th style={s.th}>Type</th>
                          <th style={s.th}>Value</th>
                          <th style={s.th}>Notes</th>
                          <th style={s.th}>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((r, i) => (
                          <tr key={i}>
                            <td style={s.td}>{r.type}</td>
                            <td style={s.td}>{r.value}</td>
                            <td style={{ ...s.td, color: '#8b949e' }}>{r.notes ?? '—'}</td>
                            <td style={s.td}>
                              {r.valid
                                ? <span style={{ color: '#3fb950' }}>✓ OK</span>
                                : <span style={{ color: '#f85149' }} title={r.error}>✕ {r.error}</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}

          {result && (
            <div>
              <div style={{ fontSize: '14px', fontWeight: 600, color: '#e6edf3', marginBottom: '10px' }}>
                Import Complete
              </div>
              <div style={{ display: 'flex', gap: '16px', marginBottom: '14px' }}>
                <span style={{ color: '#3fb950', fontSize: '13px' }}>{result.succeeded} created</span>
                {result.failed > 0 && <span style={{ color: '#f85149', fontSize: '13px' }}>{result.failed} failed</span>}
              </div>
              {result.errors.length > 0 && (
                <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid #21262d', borderRadius: '6px' }}>
                  <table style={s.table}>
                    <thead>
                      <tr>
                        <th style={s.th}>Value</th>
                        <th style={s.th}>Error</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.errors.map((e, i) => (
                        <tr key={i}>
                          <td style={s.td}>{e.value}</td>
                          <td style={{ ...s.td, color: '#f85149' }}>{e.error}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
        <div style={s.footer}>
          {result ? (
            <button type="button" style={s.btnPrimary} onClick={close}>Done</button>
          ) : (
            <>
              <button type="button" style={s.btnSecondary} onClick={close}>Cancel</button>
              <button
                type="button"
                style={{ ...s.btnPrimary, opacity: validCount === 0 || importing ? 0.6 : 1, cursor: validCount === 0 || importing ? 'not-allowed' : 'pointer' }}
                onClick={handleImport}
                disabled={validCount === 0 || importing}
              >
                {importing ? 'Importing…' : `Import ${validCount || ''} ${validCount === 1 ? 'Entity' : 'Entities'}`}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
