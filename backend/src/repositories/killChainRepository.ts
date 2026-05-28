import { pool } from '../db/pool';
import { KillChainStage, EntityKillChainMapping, ConfidenceLevel } from '../types';

export async function listStages(): Promise<KillChainStage[]> {
  const result = await pool.query('SELECT * FROM kill_chain_stages ORDER BY order_index');
  return result.rows;
}

export async function mapEntityToStage(data: {
  entity_id: string;
  stage_id: string;
  confidence: ConfidenceLevel;
  notes?: string;
  mapped_by: string;
}): Promise<EntityKillChainMapping> {
  const result = await pool.query(
    `INSERT INTO entity_kill_chain_mappings (entity_id, stage_id, confidence, notes, mapped_by)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (entity_id, stage_id) DO UPDATE
       SET confidence = EXCLUDED.confidence, notes = EXCLUDED.notes, mapped_by = EXCLUDED.mapped_by, mapped_at = NOW()
     RETURNING *`,
    [data.entity_id, data.stage_id, data.confidence, data.notes ?? null, data.mapped_by],
  );
  return result.rows[0];
}

export async function removeMappingById(mappingId: string): Promise<boolean> {
  const result = await pool.query('DELETE FROM entity_kill_chain_mappings WHERE id = $1', [mappingId]);
  return (result.rowCount ?? 0) > 0;
}

export async function getKillChainMatrix(incidentId: string): Promise<unknown[]> {
  const result = await pool.query(
    `SELECT e.id AS entity_id, e.type, e.value,
            kcs.id AS stage_id, kcs.name AS stage_name, kcs.order_index,
            ekm.confidence, ekm.id AS mapping_id
     FROM entities e
     JOIN entity_kill_chain_mappings ekm ON ekm.entity_id = e.id
     JOIN kill_chain_stages kcs ON kcs.id = ekm.stage_id
     WHERE e.incident_id = $1
     ORDER BY kcs.order_index, e.value`,
    [incidentId],
  );
  return result.rows;
}
