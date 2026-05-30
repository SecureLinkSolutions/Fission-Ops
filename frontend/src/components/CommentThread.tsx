import { useState, useEffect } from 'react';
import { apiClient } from '../api/client';
import { useAuth } from '../context/AuthContext';

interface Comment {
  id: string;
  incident_id?: string;
  entity_id?: string;
  author_id: string;
  author_name?: string;
  author_email?: string;
  author_role?: string;
  body: string;
  edited_at?: string;
  created_at: string;
}

interface TeamMember {
  id: string;
  email: string;
  name: string;
}

const ROLE_RANK: Record<string, number> = { analyst: 1, senior_analyst: 2, incident_commander: 3, super_admin: 99 };

function renderMarkdown(text: string): string {
  // Strip dangerous tags
  let safe = text.replace(/<script[^>]*>.*?<\/script>/gi, '').replace(/<iframe[^>]*>.*?<\/iframe>/gi, '');
  // Inline markdown
  safe = safe
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code style="background:#21262d;padding:1px 4px;border-radius:3px;font-family:monospace;font-size:0.9em">$1</code>')
    .replace(/\n/g, '<br/>');
  return safe;
}

function relativeTime(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

const ROLE_COLORS: Record<string, string> = {
  analyst: '#8b949e',
  senior_analyst: '#58a6ff',
  incident_commander: '#d29922',
  super_admin: '#a371f7',
};

interface CommentThreadProps {
  incidentId?: string;
  entityId?: string;
  teamMembers?: TeamMember[];
  onNewComment?: () => void;
}

export default function CommentThread({ incidentId, entityId, teamMembers = [], onNewComment }: CommentThreadProps) {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState('');
  const [mention, setMention] = useState<{ show: boolean; query: string; pos: number }>({ show: false, query: '', pos: 0 });

  const url = incidentId ? `/incidents/${incidentId}/comments` : `/entities/${entityId}/comments`;

  async function fetchComments() {
    try {
      const r = await apiClient.get<Comment[]>(url);
      setComments(r.data);
    } catch {}
  }

  useEffect(() => {
    fetchComments();
  }, [incidentId, entityId]);

  async function handleSubmit() {
    if (!body.trim()) return;
    setSubmitting(true);
    try {
      await apiClient.post(url, { body });
      setBody('');
      await fetchComments();
      onNewComment?.();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleEdit(id: string) {
    if (!editBody.trim()) return;
    await apiClient.patch(`/comments/${id}`, { body: editBody }).catch(() => {});
    setEditingId(null);
    await fetchComments();
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this comment?')) return;
    await apiClient.delete(`/comments/${id}`).catch(() => {});
    await fetchComments();
  }

  function handleBodyChange(val: string) {
    setBody(val);
    const lastAt = val.lastIndexOf('@');
    if (lastAt >= 0) {
      const after = val.slice(lastAt + 1);
      if (!after.includes(' ') && teamMembers.length > 0) {
        setMention({ show: true, query: after.toLowerCase(), pos: lastAt });
        return;
      }
    }
    setMention({ show: false, query: '', pos: 0 });
  }

  function insertMention(email: string) {
    const before = body.slice(0, mention.pos);
    const after = body.slice(mention.pos + mention.query.length + 1);
    setBody(`${before}@${email} ${after}`);
    setMention({ show: false, query: '', pos: 0 });
  }

  const filteredMembers = teamMembers.filter((m) =>
    m.email.toLowerCase().includes(mention.query) || m.name.toLowerCase().includes(mention.query),
  ).slice(0, 5);

  return (
    <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: '8px', padding: '16px' }}>
      <div style={{ fontWeight: 600, fontSize: '14px', color: '#e6edf3', marginBottom: '16px' }}>
        Comments ({comments.length})
      </div>

      {comments.map((c) => (
        <div key={c.id} style={{ marginBottom: '12px', paddingBottom: '12px', borderBottom: '1px solid #21262d' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <span style={{ fontWeight: 600, fontSize: '13px', color: '#e6edf3' }}>{c.author_name || c.author_email}</span>
            {c.author_role && (
              <span style={{ fontSize: '10px', background: `${ROLE_COLORS[c.author_role] ?? '#8b949e'}22`, color: ROLE_COLORS[c.author_role] ?? '#8b949e', border: `1px solid ${ROLE_COLORS[c.author_role] ?? '#8b949e'}44`, borderRadius: '8px', padding: '1px 6px', fontWeight: 600 }}>
                {c.author_role.replace(/_/g, ' ')}
              </span>
            )}
            <span style={{ color: '#484f58', fontSize: '11px', marginLeft: 'auto' }}>{relativeTime(c.created_at)}{c.edited_at ? ' (edited)' : ''}</span>
          </div>

          {editingId === c.id ? (
            <div>
              <textarea
                value={editBody}
                onChange={(e) => setEditBody(e.target.value)}
                style={{ width: '100%', background: '#0d1117', border: '1px solid #30363d', borderRadius: '6px', padding: '8px', color: '#e6edf3', fontSize: '13px', fontFamily: 'inherit', resize: 'vertical', minHeight: '60px', boxSizing: 'border-box' }}
              />
              <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                <button onClick={() => handleEdit(c.id)} style={{ background: '#238636', border: 'none', borderRadius: '4px', padding: '4px 10px', color: '#fff', fontSize: '12px', cursor: 'pointer' }}>Save</button>
                <button onClick={() => setEditingId(null)} style={{ background: 'transparent', border: '1px solid #30363d', borderRadius: '4px', padding: '4px 10px', color: '#8b949e', fontSize: '12px', cursor: 'pointer' }}>Cancel</button>
              </div>
            </div>
          ) : (
            <div
              style={{ color: '#e6edf3', fontSize: '13px', lineHeight: '1.5' }}
              dangerouslySetInnerHTML={{ __html: renderMarkdown(c.body) }}
            />
          )}

          {editingId !== c.id && (
            <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
              {user?.id === c.author_id && (
                <button
                  onClick={() => { setEditingId(c.id); setEditBody(c.body); }}
                  style={{ background: 'transparent', border: 'none', color: '#8b949e', fontSize: '11px', cursor: 'pointer', padding: 0 }}
                >
                  Edit
                </button>
              )}
              {(user?.id === c.author_id || ROLE_RANK[user?.role ?? ''] >= ROLE_RANK['incident_commander']) && (
                <button
                  onClick={() => handleDelete(c.id)}
                  style={{ background: 'transparent', border: 'none', color: '#f85149', fontSize: '11px', cursor: 'pointer', padding: 0 }}
                >
                  Delete
                </button>
              )}
            </div>
          )}
        </div>
      ))}

      {comments.length === 0 && (
        <div style={{ color: '#8b949e', fontSize: '13px', marginBottom: '12px' }}>No comments yet.</div>
      )}

      <div style={{ position: 'relative' }}>
        <textarea
          value={body}
          onChange={(e) => handleBodyChange(e.target.value)}
          placeholder="Add a comment… (supports **bold**, *italic*, `code`, @mentions)"
          style={{ width: '100%', background: '#0d1117', border: '1px solid #30363d', borderRadius: '6px', padding: '8px', color: '#e6edf3', fontSize: '13px', fontFamily: 'inherit', resize: 'vertical', minHeight: '72px', boxSizing: 'border-box' }}
        />
        {mention.show && filteredMembers.length > 0 && (
          <div style={{ position: 'absolute', bottom: 'calc(100% + 4px)', left: 0, background: '#161b22', border: '1px solid #30363d', borderRadius: '6px', zIndex: 50, minWidth: '200px' }}>
            {filteredMembers.map((m) => (
              <div
                key={m.id}
                onClick={() => insertMention(m.email)}
                style={{ padding: '8px 12px', cursor: 'pointer', color: '#e6edf3', fontSize: '13px' }}
              >
                {m.name} <span style={{ color: '#8b949e', fontSize: '11px' }}>{m.email}</span>
              </div>
            ))}
          </div>
        )}
        <button
          onClick={handleSubmit}
          disabled={submitting || !body.trim()}
          style={{ marginTop: '8px', background: '#238636', border: 'none', borderRadius: '6px', padding: '6px 14px', color: '#fff', fontSize: '13px', cursor: 'pointer', opacity: submitting || !body.trim() ? 0.5 : 1 }}
        >
          {submitting ? 'Sending…' : 'Comment'}
        </button>
      </div>
    </div>
  );
}
