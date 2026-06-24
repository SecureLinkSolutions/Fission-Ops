import { pool } from '../db/pool';

export interface RemediationItem {
  id: string;
  incident_id: string;
  entity_id?: string;
  entity_value?: string;
  entity_type?: string;
  title: string;
  description?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'verified';
  assignee_id?: string;
  assignee_name?: string;
  before_state?: string;
  after_state?: string;
  completed_at?: string;
  verified_by?: string;
  verified_by_name?: string;
  verified_at?: string;
  created_by: string;
  created_by_name?: string;
  created_at: string;
  updated_at: string;
}

export async function listRemediationItems(incidentId: string): Promise<RemediationItem[]> {
  const result = await pool.query(
    `SELECT r.*, e.value AS entity_value, e.type AS entity_type
     FROM remediation_items r
     LEFT JOIN entities e ON e.id = r.entity_id
     WHERE r.incident_id = $1
     ORDER BY r.created_at ASC`,
    [incidentId],
  );
  return result.rows;
}

export async function createRemediationItem(data: {
  incident_id: string;
  entity_id?: string;
  title: string;
  description?: string;
  assignee_id?: string;
  assignee_name?: string;
  created_by: string;
  created_by_name: string;
}): Promise<RemediationItem> {
  const result = await pool.query(
    `INSERT INTO remediation_items
       (incident_id, entity_id, title, description, assignee_id, assignee_name, created_by, created_by_name)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      data.incident_id,
      data.entity_id ?? null,
      data.title,
      data.description ?? null,
      data.assignee_id ?? null,
      data.assignee_name ?? null,
      data.created_by,
      data.created_by_name,
    ],
  );
  return result.rows[0];
}

export async function updateRemediationItem(
  id: string,
  data: {
    status?: string;
    before_state?: string;
    after_state?: string;
    assignee_id?: string;
    assignee_name?: string;
    completed_at?: string;
    verified_by?: string;
    verified_by_name?: string;
    verified_at?: string;
  },
): Promise<RemediationItem | null> {
  // Build SET clauses dynamically
  const sets: string[] = ['updated_at = NOW()'];
  const params: unknown[] = [];
  let idx = 1;

  if (data.status !== undefined) {
    sets.push(`status = $${idx++}`);
    params.push(data.status);
    if (data.status === 'completed') {
      sets.push(`completed_at = COALESCE(completed_at, NOW())`);
    }
    if (data.status === 'verified') {
      sets.push(`completed_at = COALESCE(completed_at, NOW())`);
      sets.push(`verified_at = NOW()`);
    }
  }
  if (data.before_state !== undefined) { sets.push(`before_state = $${idx++}`); params.push(data.before_state); }
  if (data.after_state !== undefined) { sets.push(`after_state = $${idx++}`); params.push(data.after_state); }
  if (data.assignee_id !== undefined) { sets.push(`assignee_id = $${idx++}`); params.push(data.assignee_id); }
  if (data.assignee_name !== undefined) { sets.push(`assignee_name = $${idx++}`); params.push(data.assignee_name); }
  if (data.verified_by !== undefined) { sets.push(`verified_by = $${idx++}`); params.push(data.verified_by); }
  if (data.verified_by_name !== undefined) { sets.push(`verified_by_name = $${idx++}`); params.push(data.verified_by_name); }

  params.push(id);
  const result = await pool.query(
    `UPDATE remediation_items SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
    params,
  );
  if (result.rowCount === 0) return null;
  const item = result.rows[0] as RemediationItem;

  // Auto-clear entity status when all items for that entity are verified
  if (item.entity_id) {
    const check = await pool.query(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN status = 'verified' THEN 1 ELSE 0 END) AS verified
       FROM remediation_items
       WHERE entity_id = $1`,
      [item.entity_id],
    );
    const row = check.rows[0];
    if (Number(row.total) > 0 && Number(row.verified) === Number(row.total)) {
      await pool.query(
        `UPDATE entities SET status = 'cleared' WHERE id = $1`,
        [item.entity_id],
      );
    }
  }

  return item;
}

export async function getRemediationProgress(incidentId: string): Promise<{ total: number; verified: number }> {
  const result = await pool.query(
    `SELECT COUNT(*) AS total,
            SUM(CASE WHEN status = 'verified' THEN 1 ELSE 0 END) AS verified
     FROM remediation_items
     WHERE incident_id = $1`,
    [incidentId],
  );
  const row = result.rows[0];
  return { total: Number(row.total), verified: Number(row.verified) };
}
