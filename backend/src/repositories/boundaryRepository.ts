import { pool } from '../db/pool';
import { NetworkBoundary, EntityBoundaryMapping, ZoneType, DirectionType } from '../types';

export async function listBoundaries(incidentId: string): Promise<NetworkBoundary[]> {
  const result = await pool.query(
    'SELECT * FROM network_boundaries WHERE incident_id = $1 ORDER BY created_at',
    [incidentId],
  );
  return result.rows;
}

export async function createBoundary(data: {
  incident_id: string;
  name: string;
  zone_type: ZoneType;
  description?: string;
  created_by: string;
}): Promise<NetworkBoundary> {
  const result = await pool.query(
    `INSERT INTO network_boundaries (incident_id, name, zone_type, description, created_by)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [data.incident_id, data.name, data.zone_type, data.description ?? null, data.created_by],
  );
  return result.rows[0];
}

export async function mapEntityToBoundary(data: {
  entity_id: string;
  boundary_id: string;
  direction: DirectionType;
  notes?: string;
  mapped_by: string;
}): Promise<EntityBoundaryMapping> {
  const result = await pool.query(
    `INSERT INTO entity_boundary_mappings (entity_id, boundary_id, direction, notes, mapped_by)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (entity_id, boundary_id, direction) DO UPDATE
       SET notes = EXCLUDED.notes, mapped_by = EXCLUDED.mapped_by, mapped_at = NOW()
     RETURNING *`,
    [data.entity_id, data.boundary_id, data.direction, data.notes ?? null, data.mapped_by],
  );
  return result.rows[0];
}

export async function removeBoundaryMapping(mappingId: string): Promise<boolean> {
  const result = await pool.query('DELETE FROM entity_boundary_mappings WHERE id = $1', [mappingId]);
  return (result.rowCount ?? 0) > 0;
}
