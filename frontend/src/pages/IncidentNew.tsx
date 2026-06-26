import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../api/client';

const s: Record<string, React.CSSProperties> = {
  page: { padding: '32px', maxWidth: '600px', margin: '0 auto' },
  title: { fontSize: '24px', fontWeight: 700, color: '#e6edf3', marginBottom: '32px' },
  label: { display: 'block', color: '#8b949e', fontSize: '12px', fontWeight: 600, marginBottom: '6px', textTransform: 'uppercase' as const },
  input: { width: '100%', background: '#0d1117', border: '1px solid #30363d', borderRadius: '6px', padding: '10px 14px', color: '#e6edf3', fontSize: '14px', outline: 'none', marginBottom: '20px' },
  select: { width: '100%', background: '#0d1117', border: '1px solid #30363d', borderRadius: '6px', padding: '10px 14px', color: '#e6edf3', fontSize: '14px', marginBottom: '20px' },
  textarea: { width: '100%', background: '#0d1117', border: '1px solid #30363d', borderRadius: '6px', padding: '10px 14px', color: '#e6edf3', fontSize: '14px', resize: 'vertical' as const, minHeight: '100px', marginBottom: '20px' },
  btn: { background: '#238636', border: 'none', borderRadius: '6px', padding: '12px 24px', color: '#fff', fontSize: '14px', fontWeight: 600, cursor: 'pointer', marginRight: '12px' },
  cancel: { background: 'transparent', border: '1px solid #30363d', borderRadius: '6px', padding: '12px 24px', color: '#8b949e', fontSize: '14px', cursor: 'pointer' },
  error: { background: '#3d1a1a', border: '1px solid #f85149', color: '#f85149', borderRadius: '6px', padding: '12px', marginBottom: '20px', fontSize: '13px' },
};

export default function IncidentNew() {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState('medium');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await apiClient.post('/incidents', { title, description, severity });
      navigate(`/incidents/${res.data.id}`);
    } catch (err: unknown) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setError((err as any)?.response?.data?.error ?? 'Failed to create incident');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={s.page}>
      <div style={s.title}>Create Incident</div>
      {error && <div style={s.error}>{error}</div>}
      <form onSubmit={handleSubmit}>
        <label style={s.label}>Title *</label>
        <input style={s.input} value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="e.g. Ransomware incident - Finance servers" />
        <label style={s.label}>Description</label>
        <textarea style={s.textarea} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe the incident…" />
        <label style={s.label}>Severity</label>
        <select style={s.select} value={severity} onChange={(e) => setSeverity(e.target.value)}>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="critical">Critical</option>
        </select>
        <button type="button" style={s.btn} type="submit" disabled={loading}>{loading ? 'Creating…' : 'Create Incident'}</button>
        <button type="button" style={s.cancel} type="button" onClick={() => navigate(-1)}>Cancel</button>
      </form>
    </div>
  );
}
