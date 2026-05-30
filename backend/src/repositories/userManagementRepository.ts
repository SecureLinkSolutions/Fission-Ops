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

export async function listUsers(): Promise<ManagedUser[]> {
  const result = await pool.query(
    `SELECT id, email, name, role, sso_provider, sso_subject, deactivated_at, last_login_at, password_reset_required, created_at
     FROM users ORDER BY created_at DESC`,
  );
  return result.rows;
}

export async function createUser(data: {
  email: string;
  name: string;
  role: UserRole;
  password: string;
}): Promise<ManagedUser> {
  const hash = await bcrypt.hash(data.password, 12);
  const result = await pool.query(
    `INSERT INTO users (email, name, role, password_hash)
     VALUES ($1, $2, $3, $4)
     RETURNING id, email, name, role, sso_provider, sso_subject, deactivated_at, last_login_at, password_reset_required, created_at`,
    [data.email, data.name, data.role, hash],
  );
  return result.rows[0];
}

export async function deactivateUser(id: string): Promise<ManagedUser | null> {
  const result = await pool.query(
    `UPDATE users SET deactivated_at = NOW() WHERE id = $1
     RETURNING id, email, name, role, sso_provider, sso_subject, deactivated_at, last_login_at, password_reset_required, created_at`,
    [id],
  );
  return result.rows[0] ?? null;
}

export async function reactivateUser(id: string): Promise<ManagedUser | null> {
  const result = await pool.query(
    `UPDATE users SET deactivated_at = NULL WHERE id = $1
     RETURNING id, email, name, role, sso_provider, sso_subject, deactivated_at, last_login_at, password_reset_required, created_at`,
    [id],
  );
  return result.rows[0] ?? null;
}

export async function resetUserPassword(id: string, newPassword: string): Promise<boolean> {
  const hash = await bcrypt.hash(newPassword, 12);
  const result = await pool.query(
    `UPDATE users SET password_hash = $1, password_reset_required = TRUE WHERE id = $2`,
    [hash, id],
  );
  return (result.rowCount ?? 0) > 0;
}

export async function updateUserRole(id: string, role: UserRole): Promise<ManagedUser | null> {
  const result = await pool.query(
    `UPDATE users SET role = $1 WHERE id = $2
     RETURNING id, email, name, role, sso_provider, sso_subject, deactivated_at, last_login_at, password_reset_required, created_at`,
    [role, id],
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
