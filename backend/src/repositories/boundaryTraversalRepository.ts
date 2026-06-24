import { pool } from '../db/pool';

export async function listEntityZoneAssignments(incidentId: string): Promise<unknown[]> {
  const result = await pool.query(
    `SELECT eza.entity_id, e.type AS entity_type, e.value AS entity_value,
            eza.boundary_id, nb.name AS boundary_name, nb.zone_type,
            eza.assigned_by, eza.assigned_at
     FROM entity_zone_assignments eza
     JOIN entities e ON e.id = eza.entity_id
     JOIN network_boundaries nb ON nb.id = eza.boundary_id
     WHERE e.incident_id = $1
     ORDER BY nb.name, e.value`,
    [incidentId],
  );
  return result.rows;
}

export async function assignEntityToZone(
  entityId: string,
  boundaryId: string,
  assignedBy: string,
): Promise<unknown> {
  const result = await pool.query(
    `INSERT INTO entity_zone_assignments (entity_id, boundary_id, assigned_by)
     VALUES ($1, $2, $3)
     ON CONFLICT (entity_id) DO UPDATE
       SET boundary_id = EXCLUDED.boundary_id, assigned_by = EXCLUDED.assigned_by, assigned_at = NOW()
     RETURNING *`,
    [entityId, boundaryId, assignedBy],
  );
  return result.rows[0];
}

export async function listBoundaryTraversals(incidentId: string): Promise<unknown[]> {
  const result = await pool.query(
    `SELECT bt.id, bt.incident_id,
            bt.source_boundary_id, sb.name AS source_boundary_name, sb.zone_type AS source_zone_type,
            bt.target_boundary_id, tb.name AS target_boundary_name, tb.zone_type AS target_zone_type,
            bt.label, bt.notes, bt.created_by, bt.created_at
     FROM boundary_traversals bt
     JOIN network_boundaries sb ON sb.id = bt.source_boundary_id
     JOIN network_boundaries tb ON tb.id = bt.target_boundary_id
     WHERE bt.incident_id = $1
     ORDER BY bt.created_at`,
    [incidentId],
  );
  return result.rows;
}

export async function createBoundaryTraversal(data: {
  incident_id: string;
  source_boundary_id: string;
  target_boundary_id: string;
  label?: string;
  notes?: string;
  created_by: string;
}): Promise<unknown> {
  const result = await pool.query(
    `INSERT INTO boundary_traversals (incident_id, source_boundary_id, target_boundary_id, label, notes, created_by)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [data.incident_id, data.source_boundary_id, data.target_boundary_id, data.label ?? null, data.notes ?? null, data.created_by],
  );
  return result.rows[0];
}

export async function deleteBoundaryTraversal(id: string): Promise<boolean> {
  const result = await pool.query('DELETE FROM boundary_traversals WHERE id = $1', [id]);
  return (result.rowCount ?? 0) > 0;
}
