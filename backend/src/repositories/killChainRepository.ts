import { pool } from '../db/pool';
import { KillChainStage, EntityKillChainMapping, ConfidenceLevel } from '../types';

export async function listStages(framework?: string): Promise<KillChainStage[]> {
  const fw = framework ?? 'lockheed_martin';
  const result = await pool.query(
    'SELECT * FROM kill_chain_stages WHERE framework = $1 ORDER BY order_index',
    [fw],
  );
  // Fallback: if no rows (migration not yet run), return all without framework filter
  if (result.rowCount === 0) {
    const fallback = await pool.query('SELECT * FROM kill_chain_stages ORDER BY order_index');
    return fallback.rows;
  }
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

export async function updateMappingStage(mappingId: string, stageId: string, mappedBy: string): Promise<EntityKillChainMapping | null> {
  const result = await pool.query(
    `UPDATE entity_kill_chain_mappings SET stage_id = $1, mapped_by = $2, mapped_at = NOW() WHERE id = $3 RETURNING *`,
    [stageId, mappedBy, mappingId],
  );
  return result.rows[0] ?? null;
}

export async function removeMappingById(mappingId: string): Promise<boolean> {
  const result = await pool.query('DELETE FROM entity_kill_chain_mappings WHERE id = $1', [mappingId]);
  return (result.rowCount ?? 0) > 0;
}

export interface KillChainMatrixRow {
  entity_id: string;
  type: string;
  value: string;
  stage_id: string;
  stage_name: string;
  order_index: number;
  framework: string;
  confidence: string;
  mapping_id: string;
  ttps: { id: string; ttp_id: string; technique_id: string; name: string }[];
  entity_details: Record<string, unknown> | null;
  ioc_status: string | null;
  entity_status: string | null;
}

export async function getKillChainMatrix(incidentId: string): Promise<KillChainMatrixRow[]> {
  const result = await pool.query(
    `SELECT e.id AS entity_id, e.type, e.value,
            kcs.id AS stage_id, kcs.name AS stage_name, kcs.order_index, kcs.framework,
            ekm.confidence, ekm.id AS mapping_id,
            e.entity_details,
            e.ioc_status,
            e.status AS entity_status,
            COALESCE(
              json_agg(
                json_build_object('id', est.id, 'ttp_id', t.id, 'technique_id', t.technique_id, 'name', t.name)
              ) FILTER (WHERE t.id IS NOT NULL), '[]'
            ) AS ttps
     FROM entities e
     JOIN entity_kill_chain_mappings ekm ON ekm.entity_id = e.id
     JOIN kill_chain_stages kcs ON kcs.id = ekm.stage_id
     LEFT JOIN entity_stage_ttps est ON est.kill_chain_mapping_id = ekm.id
     LEFT JOIN ttps t ON t.id = est.ttp_id
     WHERE e.incident_id = $1
     GROUP BY e.id, e.type, e.value, kcs.id, kcs.name, kcs.order_index, kcs.framework, ekm.confidence, ekm.id, e.entity_details, e.ioc_status, e.status
     ORDER BY kcs.order_index, e.value`,
    [incidentId],
  );
  return result.rows;
}
