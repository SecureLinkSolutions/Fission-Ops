import { pool } from '../db/pool';
import { Entity, EntityType } from '../types';

export async function listEntitiesByIncident(incidentId: string): Promise<Entity[]> {
  const result = await pool.query(
    'SELECT * FROM entities WHERE incident_id = $1 ORDER BY created_at DESC',
    [incidentId],
  );
  return result.rows;
}

export async function getEntityById(id: string): Promise<Entity | null> {
  const result = await pool.query('SELECT * FROM entities WHERE id = $1', [id]);
  return result.rows[0] ?? null;
}

export async function getEntityWithMappings(id: string): Promise<unknown | null> {
  const entityResult = await pool.query('SELECT * FROM entities WHERE id = $1', [id]);
  if (!entityResult.rows[0]) return null;

  const entity = entityResult.rows[0];

  const killChain = await pool.query(
    `SELECT ekm.*, kcs.name AS stage_name, kcs.order_index
     FROM entity_kill_chain_mappings ekm
     JOIN kill_chain_stages kcs ON kcs.id = ekm.stage_id
     WHERE ekm.entity_id = $1
     ORDER BY kcs.order_index`,
    [id],
  );

  const boundaries = await pool.query(
    `SELECT ebm.*, nb.name AS boundary_name, nb.zone_type
     FROM entity_boundary_mappings ebm
     JOIN network_boundaries nb ON nb.id = ebm.boundary_id
     WHERE ebm.entity_id = $1`,
    [id],
  );

  return {
    ...entity,
    kill_chain_mappings: killChain.rows,
    boundary_mappings: boundaries.rows,
  };
}

export async function createEntity(data: {
  incident_id: string;
  type: EntityType;
  value: string;
  notes?: string;
  entity_details?: Record<string, unknown>;
  created_by: string;
}): Promise<Entity> {
  const result = await pool.query(
    `INSERT INTO entities (incident_id, type, value, notes, entity_details, created_by)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [data.incident_id, data.type, data.value, data.notes ?? null, data.entity_details ? JSON.stringify(data.entity_details) : null, data.created_by],
  );
  return result.rows[0];
}

export async function updateEntity(
  id: string,
  data: Partial<Pick<Entity, 'value' | 'notes' | 'entity_details'>>,
): Promise<Entity | null> {
  const fields: string[] = [];
  const params: unknown[] = [];
  let i = 1;

  if (data.value !== undefined) { fields.push(`value = $${i++}`); params.push(data.value); }
  if (data.notes !== undefined) { fields.push(`notes = $${i++}`); params.push(data.notes); }
  if (data.entity_details !== undefined) { fields.push(`entity_details = $${i++}`); params.push(JSON.stringify(data.entity_details)); }

  if (!fields.length) return null;
  params.push(id);

  const result = await pool.query(
    `UPDATE entities SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`,
    params,
  );
  return result.rows[0] ?? null;
}

export async function updateEntityStatus(id: string, status: string, userId: string): Promise<Entity | null> {
  const result = await pool.query(
    `UPDATE entities SET status = $1 WHERE id = $2 RETURNING *`,
    [status, id],
  );
  const entity = result.rows[0] ?? null;
  if (entity) {
    await pool.query(
      `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, new_values)
       VALUES ($1, 'entity_status_changed', 'entity', $2, $3)`,
      [userId, id, JSON.stringify({ status })],
    );
  }
  return entity;
}

export async function deleteEntity(id: string): Promise<boolean> {
  const result = await pool.query('DELETE FROM entities WHERE id = $1', [id]);
  return (result.rowCount ?? 0) > 0;
}
