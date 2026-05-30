import { pool } from '../db/pool';
import { createNotification } from './notificationRepository';

export interface Task {
  id: string;
  incident_id: string;
  org_id?: string;
  title: string;
  description?: string;
  assignee_id?: string;
  assignee_name?: string;
  assignee_email?: string;
  created_by: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  status: 'open' | 'in_progress' | 'complete';
  due_date?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
  incident_title?: string;
}

export async function listForIncident(incidentId: string): Promise<Task[]> {
  const result = await pool.query(
    `SELECT t.*, u.name AS assignee_name, u.email AS assignee_email
     FROM incident_tasks t
     LEFT JOIN users u ON u.id = t.assignee_id
     WHERE t.incident_id = $1
     ORDER BY
       CASE t.priority WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END,
       t.created_at DESC`,
    [incidentId],
  );
  return result.rows;
}

export async function listForUser(userId: string): Promise<Task[]> {
  const result = await pool.query(
    `SELECT t.*, u.name AS assignee_name, u.email AS assignee_email, i.title AS incident_title
     FROM incident_tasks t
     LEFT JOIN users u ON u.id = t.assignee_id
     JOIN incidents i ON i.id = t.incident_id
     WHERE t.assignee_id = $1
     ORDER BY t.due_date ASC NULLS LAST, t.created_at DESC`,
    [userId],
  );
  return result.rows;
}

export async function createTask(data: {
  incident_id: string;
  org_id?: string;
  title: string;
  description?: string;
  assignee_id?: string;
  created_by: string;
  priority?: string;
  status?: string;
  due_date?: string;
}): Promise<Task> {
  const result = await pool.query(
    `INSERT INTO incident_tasks (incident_id, org_id, title, description, assignee_id, created_by, priority, status, due_date)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [
      data.incident_id,
      data.org_id ?? null,
      data.title,
      data.description ?? null,
      data.assignee_id ?? null,
      data.created_by,
      data.priority ?? 'medium',
      data.status ?? 'open',
      data.due_date ?? null,
    ],
  );
  const task = result.rows[0] as Task;

  // Notify assignee
  if (data.assignee_id) {
    const assignee = await pool.query('SELECT org_id FROM users WHERE id = $1', [data.assignee_id]);
    await createNotification({
      user_id: data.assignee_id,
      org_id: assignee.rows[0]?.org_id,
      type: 'task_assigned',
      title: `Task assigned: ${data.title}`,
      body: data.description?.slice(0, 200),
      incident_id: data.incident_id,
    }).catch(() => {});
  }

  return task;
}

export async function updateTask(id: string, data: Partial<{
  title: string;
  description: string;
  assignee_id: string | null;
  priority: string;
  status: string;
  due_date: string | null;
}>): Promise<Task | null> {
  const fields: string[] = ['updated_at = NOW()'];
  const params: unknown[] = [];
  let i = 1;

  if (data.title !== undefined) { fields.push(`title = $${i++}`); params.push(data.title); }
  if (data.description !== undefined) { fields.push(`description = $${i++}`); params.push(data.description); }
  if ('assignee_id' in data) { fields.push(`assignee_id = $${i++}`); params.push(data.assignee_id); }
  if (data.priority !== undefined) { fields.push(`priority = $${i++}`); params.push(data.priority); }
  if (data.status !== undefined) {
    fields.push(`status = $${i++}`);
    params.push(data.status);
    if (data.status === 'complete') {
      fields.push(`completed_at = NOW()`);
    }
  }
  if ('due_date' in data) { fields.push(`due_date = $${i++}`); params.push(data.due_date); }

  params.push(id);

  const result = await pool.query(
    `UPDATE incident_tasks SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`,
    params,
  );
  const task = result.rows[0] as Task | undefined;

  // Notify new assignee if changed
  if (task && data.assignee_id) {
    const assignee = await pool.query('SELECT org_id FROM users WHERE id = $1', [data.assignee_id]);
    await createNotification({
      user_id: data.assignee_id,
      org_id: assignee.rows[0]?.org_id,
      type: 'task_assigned',
      title: `Task assigned: ${task.title}`,
      incident_id: task.incident_id,
    }).catch(() => {});
  }

  return task ?? null;
}

export async function deleteTask(id: string): Promise<boolean> {
  const result = await pool.query('DELETE FROM incident_tasks WHERE id = $1', [id]);
  return (result.rowCount ?? 0) > 0;
}

export async function getTaskStats(incidentId: string): Promise<{ total: number; complete: number }> {
  const result = await pool.query(
    `SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE status = 'complete') AS complete
     FROM incident_tasks WHERE incident_id = $1`,
    [incidentId],
  );
  return {
    total: parseInt(result.rows[0].total, 10),
    complete: parseInt(result.rows[0].complete, 10),
  };
}
