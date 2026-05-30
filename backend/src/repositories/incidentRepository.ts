import { pool } from '../db/pool';
import { Incident, IncidentSeverity, IncidentStatus, UserRole } from '../types';

interface ListOptions {
  status?: IncidentStatus;
  severity?: IncidentSeverity;
  page: number;
  limit: number;
  requestingUserId?: string;
  requestingUserRole?: UserRole;
  orgId?: string;
}

export async function listIncidents(opts: ListOptions): Promise<{ incidents: Incident[]; total: number }> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let i = 1;

  if (opts.orgId) { conditions.push(`i.org_id = $${i++}`); params.push(opts.orgId); }
  if (opts.status) { conditions.push(`i.status = $${i++}`); params.push(opts.status); }
  if (opts.severity) { conditions.push(`i.severity = $${i++}`); params.push(opts.severity); }

  // Visibility filter for non-commanders
  if (opts.requestingUserId && opts.requestingUserRole !== 'incident_commander' && opts.requestingUserRole !== 'super_admin') {
    params.push(opts.requestingUserId);
    const uidParam = `$${i++}`;
    conditions.push(
      `(i.created_by = ${uidParam} OR EXISTS (SELECT 1 FROM incident_assignments ia WHERE ia.incident_id = i.id AND ia.user_id = ${uidParam}))`,
    );
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const offset = (opts.page - 1) * opts.limit;

  const countResult = await pool.query(`SELECT COUNT(*) FROM incidents i ${where}`, params);
  const total = parseInt(countResult.rows[0].count, 10);

  params.push(opts.limit, offset);
  const result = await pool.query(
    `SELECT i.*, COUNT(e.id)::int AS entity_count
     FROM incidents i
     LEFT JOIN entities e ON e.incident_id = i.id
     ${where}
     GROUP BY i.id
     ORDER BY i.created_at DESC
     LIMIT $${i++} OFFSET $${i++}`,
    params,
  );

  return { incidents: result.rows, total };
}

export async function getIncidentById(id: string, orgId?: string): Promise<(Incident & { entity_count: number }) | null> {
  const params: unknown[] = [id];
  let orgFilter = '';
  if (orgId) {
    orgFilter = ' AND i.org_id = $2';
    params.push(orgId);
  }
  const result = await pool.query(
    `SELECT i.*, COUNT(e.id)::int AS entity_count
     FROM incidents i
     LEFT JOIN entities e ON e.incident_id = i.id
     WHERE i.id = $1${orgFilter}
     GROUP BY i.id`,
    params,
  );
  return result.rows[0] ?? null;
}

export async function createIncident(data: {
  title: string;
  description?: string;
  severity: IncidentSeverity;
  created_by: string;
  org_id?: string;
}): Promise<Incident> {
  const result = await pool.query(
    `INSERT INTO incidents (title, description, severity, created_by, org_id)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [data.title, data.description ?? null, data.severity, data.created_by, data.org_id ?? null],
  );
  return result.rows[0];
}

export async function updateIncident(
  id: string,
  data: Partial<Pick<Incident, 'title' | 'description' | 'severity' | 'status'>>,
  orgId?: string,
): Promise<Incident | null> {
  const fields: string[] = [];
  const params: unknown[] = [];
  let i = 1;

  if (data.title !== undefined) { fields.push(`title = $${i++}`); params.push(data.title); }
  if (data.description !== undefined) { fields.push(`description = $${i++}`); params.push(data.description); }
  if (data.severity !== undefined) { fields.push(`severity = $${i++}`); params.push(data.severity); }
  if (data.status !== undefined) { fields.push(`status = $${i++}`); params.push(data.status); }

  if (!fields.length) return null;

  fields.push(`updated_at = NOW()`);
  params.push(id);
  let orgFilter = '';
  if (orgId) {
    params.push(orgId);
    orgFilter = ` AND org_id = $${i + 1}`;
  }

  const result = await pool.query(
    `UPDATE incidents SET ${fields.join(', ')} WHERE id = $${i}${orgFilter} RETURNING *`,
    params,
  );
  return result.rows[0] ?? null;
}

export async function closeIncident(id: string, orgId?: string): Promise<Incident | null> {
  const params: unknown[] = [id];
  let orgFilter = '';
  if (orgId) {
    params.push(orgId);
    orgFilter = ' AND org_id = $2';
  }
  const result = await pool.query(
    `UPDATE incidents SET status = 'closed', updated_at = NOW() WHERE id = $1${orgFilter} RETURNING *`,
    params,
  );
  return result.rows[0] ?? null;
}

/**
 * Assert that the given incident belongs to the given org. Throws a 404-like error if not.
 * Super admin callers should skip this check entirely.
 */
export async function assertIncidentOrg(incidentId: string, orgId: string): Promise<void> {
  const result = await pool.query(
    `SELECT 1 FROM incidents WHERE id = $1 AND org_id = $2`,
    [incidentId, orgId],
  );
  if ((result.rowCount ?? 0) === 0) {
    const err = new Error('Incident not found') as Error & { statusCode?: number };
    err.statusCode = 404;
    throw err;
  }
}
