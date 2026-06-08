import { pool } from '../db/pool';
import bcrypt from 'bcryptjs';
import { UserRole } from '../types';

export interface ManagedUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  sso_provider: string | null;
  sso_subject: string | null;
  deactivated_at: Date | null;
  last_login_at: Date | null;
  password_reset_required: boolean;
  created_at: Date;
}

const USER_COLS = 'id, email, name, role, org_id, sso_provider, sso_subject, deactivated_at, last_login_at, password_reset_required, created_at';

export async function listUsers(orgId?: string, platformAdminAccessOnly?: boolean): Promise<ManagedUser[]> {
  if (orgId) {
    const result = await pool.query(
      `SELECT ${USER_COLS} FROM users WHERE org_id = $1 ORDER BY created_at DESC`,
      [orgId],
    );
    return result.rows;
  }
  if (platformAdminAccessOnly) {
    // Only return users from orgs that have granted platform admin access
    const result = await pool.query(
      `SELECT u.id, u.email, u.name, u.role, u.org_id, u.sso_provider, u.sso_subject,
              u.deactivated_at, u.last_login_at, u.password_reset_required, u.created_at
       FROM users u
       JOIN organizations o ON o.id = u.org_id
       WHERE o.platform_admin_access = TRUE
       ORDER BY u.created_at DESC`,
    );
    return result.rows;
  }
  const result = await pool.query(`SELECT ${USER_COLS} FROM users ORDER BY created_at DESC`);
  return result.rows;
}

export async function createUser(data: {
  email: string;
  name: string;
  role: UserRole;
  password: string;
  org_id?: string;
}): Promise<ManagedUser> {
  const hash = await bcrypt.hash(data.password, 12);
  const result = await pool.query(
    `INSERT INTO users (email, name, role, password_hash, org_id)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING ${USER_COLS}`,
    [data.email, data.name, data.role, hash, data.org_id ?? null],
  );
  return result.rows[0];
}

export async function deactivateUser(id: string, orgId?: string): Promise<ManagedUser | null> {
  const filter = orgId ? ' AND org_id = $2' : '';
  const params: unknown[] = [id];
  if (orgId) params.push(orgId);
  const result = await pool.query(
    `UPDATE users SET deactivated_at = NOW() WHERE id = $1${filter} RETURNING ${USER_COLS}`,
    params,
  );
  return result.rows[0] ?? null;
}

export async function reactivateUser(id: string, orgId?: string): Promise<ManagedUser | null> {
  const filter = orgId ? ' AND org_id = $2' : '';
  const params: unknown[] = [id];
  if (orgId) params.push(orgId);
  const result = await pool.query(
    `UPDATE users SET deactivated_at = NULL WHERE id = $1${filter} RETURNING ${USER_COLS}`,
    params,
  );
  return result.rows[0] ?? null;
}

export async function resetUserPassword(id: string, newPassword: string, orgId?: string): Promise<boolean> {
  const hash = await bcrypt.hash(newPassword, 12);
  const filter = orgId ? ' AND org_id = $3' : '';
  const params: unknown[] = [hash, id];
  if (orgId) params.push(orgId);
  const result = await pool.query(
    `UPDATE users SET password_hash = $1, password_reset_required = TRUE WHERE id = $2${filter}`,
    params,
  );
  return (result.rowCount ?? 0) > 0;
}

export async function updateUserRole(id: string, role: UserRole, orgId?: string): Promise<ManagedUser | null> {
  const filter = orgId ? ' AND org_id = $3' : '';
  const params: unknown[] = [role, id];
  if (orgId) params.push(orgId);
  const result = await pool.query(
    `UPDATE users SET role = $1 WHERE id = $2${filter} RETURNING ${USER_COLS}`,
    params,
  );
  return result.rows[0] ?? null;
}

export async function listIncidentAssignments(incidentId: string): Promise<unknown[]> {
  const result = await pool.query(
    `SELECT ia.id, ia.incident_id, ia.user_id, ia.assigned_by, ia.assigned_at,
            u.email AS user_email, u.name AS user_name, u.role AS user_role
     FROM incident_assignments ia
     JOIN users u ON u.id = ia.user_id
     WHERE ia.incident_id = $1
     ORDER BY ia.assigned_at`,
    [incidentId],
  );
  return result.rows;
}

export async function assignUserToIncident(
  incidentId: string,
  userId: string,
  assignedBy: string,
): Promise<unknown> {
  const result = await pool.query(
    `INSERT INTO incident_assignments (incident_id, user_id, assigned_by)
     VALUES ($1, $2, $3)
     ON CONFLICT (incident_id, user_id) DO NOTHING
     RETURNING *`,
    [incidentId, userId, assignedBy],
  );
  return result.rows[0];
}

export async function removeUserFromIncident(incidentId: string, userId: string): Promise<boolean> {
  const result = await pool.query(
    `DELETE FROM incident_assignments WHERE incident_id = $1 AND user_id = $2`,
    [incidentId, userId],
  );
  return (result.rowCount ?? 0) > 0;
}
