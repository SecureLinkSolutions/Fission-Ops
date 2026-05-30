import { pool } from '../db/pool';

export interface Notification {
  id: string;
  user_id: string;
  org_id?: string;
  type: string;
  title: string;
  body?: string;
  incident_id?: string;
  entity_id?: string;
  read: boolean;
  created_at: string;
}

export async function createNotification(data: {
  user_id: string;
  org_id?: string;
  type: string;
  title: string;
  body?: string;
  incident_id?: string;
  entity_id?: string;
}): Promise<Notification> {
  const result = await pool.query(
    `INSERT INTO notifications (user_id, org_id, type, title, body, incident_id, entity_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [data.user_id, data.org_id ?? null, data.type, data.title, data.body ?? null, data.incident_id ?? null, data.entity_id ?? null],
  );
  return result.rows[0];
}

export async function getUserNotifications(userId: string, limit = 20): Promise<Notification[]> {
  const result = await pool.query(
    `SELECT * FROM notifications WHERE user_id = $1
     ORDER BY read ASC, created_at DESC
     LIMIT $2`,
    [userId, limit],
  );
  return result.rows;
}

export async function markRead(notificationId: string, userId: string): Promise<void> {
  await pool.query(
    'UPDATE notifications SET read = TRUE WHERE id = $1 AND user_id = $2',
    [notificationId, userId],
  );
}

export async function markAllRead(userId: string): Promise<void> {
  await pool.query('UPDATE notifications SET read = TRUE WHERE user_id = $1', [userId]);
}

export async function getUnreadCount(userId: string): Promise<number> {
  const result = await pool.query(
    'SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND read = FALSE',
    [userId],
  );
  return parseInt(result.rows[0].count, 10);
}
