import { useState, FormEvent } from 'react';
import { apiClient } from '../api/client';
import { EntityType } from '../types';

interface Props {
  incidentId: string;
  onCreated: () => void;
}

const ENTITY_TYPES: EntityType[] = ['hostname', 'ip', 'email', 'domain', 'account', 'file'];

const s: Record<string, React.CSSProperties> = {
  form: { background: '#161b22', border: '1px solid #30363d', borderRadius: '8px', padding: '20px', marginBottom: '24px' },
  title: { fontSize: '14px', fontWeight: 600, color: '#e6edf3', marginBottom: '16px' },
  row: { display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', gap: '12px', alignItems: 'end' },
  label: { display: 'block', color: '#8b949e', fontSize: '11px', fontWeight: 600, marginBottom: '4px', textTransform: 'uppercase' as const },
  input: { width: '100%', background: '#0d1117', border: '1px solid #30363d', borderRadius: '6px', padding: '8px 12px', color: '#e6edf3', fontSize: '13px', outline: 'none' },
  select: { width: '100%', background: '#0d1117', border: '1px solid #30363d', borderRadius: '6px', padding: '8px 12px', color: '#e6edf3', fontSize: '13px' },
  btn: { background: '#238636', border: 'none', borderRadius: '6px', padding: '9px 18px', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer' },
  error: { color: '#f85149', fontSize: '12px', marginTop: '8px' },
};

export default function EntityForm({ incidentId, onCreated }: Props) {
  const [type, setType] = useState<EntityType>('ip');
  const [value, setValue] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await apiClient.post(`/incidents/${incidentId}/entities`, { type, value, notes: notes || undefined });
      setValue('');
      setNotes('');
      onCreated();
    } catch (err: unknown) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setError((err as any)?.response?.data?.error ?? 'Failed to create entity');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={s.form}>
      <div style={s.title}>Add Entity</div>
      <form onSubmit={handleSubmit}>
        <div style={s.row}>
          <div>
            <label style={s.label}>Type</label>
            <select style={s.select} value={type} onChange={(e) => setType(e.target.value as EntityType)}>
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
        {error && <div style={s.error}>{error}</div>}
        <button style={{ ...s.btn, marginTop: '12px' }} type="submit" disabled={loading}>{loading ? 'Adding…' : 'Add Entity'}</button>
      </form>
    </div>
  );
}
