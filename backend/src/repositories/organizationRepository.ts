import { pool } from '../db/pool';
import { Organization } from '../types';

export async function listOrganizations(): Promise<Organization[]> {
  const result = await pool.query(
    `SELECT * FROM organizations ORDER BY created_at DESC`,
  );
  return result.rows;
}

export async function getOrganizationById(id: string): Promise<Organization | null> {
  const result = await pool.query(
    `SELECT * FROM organizations WHERE id = $1`,
    [id],
  );
  return result.rows[0] ?? null;
}

export async function getOrganizationBySlug(slug: string): Promise<Organization | null> {
  const result = await pool.query(
    `SELECT * FROM organizations WHERE slug = $1`,
    [slug],
  );
  return result.rows[0] ?? null;
}

export async function createOrganization(data: { name: string; slug: string; tier: string }): Promise<Organization> {
  const result = await pool.query(
    `INSERT INTO organizations (name, slug, tier) VALUES ($1, $2, $3) RETURNING *`,
    [data.name, data.slug, data.tier],
  );
  return result.rows[0];
}

export async function deactivateOrganization(id: string): Promise<Organization | null> {
  const result = await pool.query(
    `UPDATE organizations SET active = FALSE WHERE id = $1 RETURNING *`,
    [id],
  );
  return result.rows[0] ?? null;
}

export async function reactivateOrganization(id: string): Promise<Organization | null> {
  const result = await pool.query(
    `UPDATE organizations SET active = TRUE WHERE id = $1 RETURNING *`,
    [id],
  );
  return result.rows[0] ?? null;
}

export interface OrgStats {
  incident_count: number;
  entity_count: number;
  active_user_count: number;
  ttp_assignment_count: number;
}

export async function getOrgStats(orgId: string): Promise<OrgStats> {
  const result = await pool.query(
    `SELECT
       (SELECT COUNT(*) FROM incidents WHERE org_id = $1)::int AS incident_count,
       (SELECT COUNT(*) FROM entities e JOIN incidents i ON i.id = e.incident_id WHERE i.org_id = $1)::int AS entity_count,
       (SELECT COUNT(*) FROM users WHERE org_id = $1 AND deactivated_at IS NULL)::int AS active_user_count,
       (SELECT COUNT(*) FROM entity_kill_chain_mappings ekm JOIN entities e ON e.id = ekm.entity_id JOIN incidents i ON i.id = e.incident_id WHERE i.org_id = $1)::int AS ttp_assignment_count`,
    [orgId],
  );
  return result.rows[0];
}
