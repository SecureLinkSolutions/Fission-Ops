import { pool } from '../db/pool';
import { createNotification } from './notificationRepository';
import { emitToIncident, emitToUser } from '../socket';

export interface Comment {
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

export async function listForIncident(incidentId: string): Promise<Comment[]> {
  const result = await pool.query(
    `SELECT c.*, u.name AS author_name, u.email AS author_email, u.role AS author_role
     FROM comments c
     JOIN users u ON u.id = c.author_id
     WHERE c.incident_id = $1
     ORDER BY c.created_at ASC`,
    [incidentId],
  );
  return result.rows;
}

export async function listForEntity(entityId: string): Promise<Comment[]> {
  const result = await pool.query(
    `SELECT c.*, u.name AS author_name, u.email AS author_email, u.role AS author_role
     FROM comments c
     JOIN users u ON u.id = c.author_id
     WHERE c.entity_id = $1
     ORDER BY c.created_at ASC`,
    [entityId],
  );
  return result.rows;
}

export async function countForEntity(entityId: string): Promise<number> {
  const result = await pool.query(
    'SELECT COUNT(*) FROM comments WHERE entity_id = $1',
    [entityId],
  );
  return parseInt(result.rows[0].count, 10);
}

async function parseMentions(body: string, incidentId: string, authorId: string, commentId: string): Promise<void> {
  // Extract @email mentions
  const mentionRegex = /@([\w.+-]+@[\w-]+\.[\w.]+)/g;
  const mentions: string[] = [];
  let match;
  while ((match = mentionRegex.exec(body)) !== null) {
    mentions.push(match[1]);
  }
  if (!mentions.length) return;

  for (const email of mentions) {
    const userResult = await pool.query(
      'SELECT id, org_id FROM users WHERE email = $1',
      [email],
    );
    if (userResult.rows[0] && userResult.rows[0].id !== authorId) {
      const notif = await createNotification({
        user_id: userResult.rows[0].id,
        org_id: userResult.rows[0].org_id,
        type: 'mention',
        title: 'You were mentioned in a comment',
        body: body.slice(0, 200),
        incident_id: incidentId,
        entity_id: undefined,
      });
      emitToUser(userResult.rows[0].id, 'notification:new', notif);
    }
  }
}

export async function createComment(data: {
  incident_id?: string;
  entity_id?: string;
  author_id: string;
  body: string;
  org_id?: string;
}): Promise<Comment> {
  const result = await pool.query(
    `INSERT INTO comments (incident_id, entity_id, author_id, body)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [data.incident_id ?? null, data.entity_id ?? null, data.author_id, data.body],
  );
  const comment = result.rows[0] as Comment;

  // Parse @mentions
  if (data.incident_id) {
    await parseMentions(data.body, data.incident_id, data.author_id, comment.id).catch(() => {});
    // Emit to incident room
    try {
      emitToIncident(data.incident_id, 'comment:created', comment);
    } catch {}
  }

  return comment;
}

export async function updateComment(id: string, body: string, authorId: string): Promise<Comment | null> {
  const result = await pool.query(
    `UPDATE comments SET body = $1, edited_at = NOW()
     WHERE id = $2 AND author_id = $3
     RETURNING *`,
    [body, id, authorId],
  );
  return result.rows[0] ?? null;
}

export async function deleteComment(id: string, userId: string, role: string): Promise<boolean> {
  const ROLE_RANK: Record<string, number> = { analyst: 1, senior_analyst: 2, incident_commander: 3, super_admin: 99 };
  let result;
  if ((ROLE_RANK[role] ?? 0) >= ROLE_RANK['incident_commander']) {
    result = await pool.query('DELETE FROM comments WHERE id = $1', [id]);
  } else {
    result = await pool.query('DELETE FROM comments WHERE id = $1 AND author_id = $2', [id, userId]);
  }
  return (result.rowCount ?? 0) > 0;
}
