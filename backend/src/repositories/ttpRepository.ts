import { pool } from '../db/pool';

export async function searchTtps(query?: string, tactic?: string, framework?: string): Promise<unknown[]> {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (query) {
    params.push(`%${query}%`);
    conditions.push(`(technique_id ILIKE $${params.length} OR name ILIKE $${params.length})`);
  }
  if (tactic) {
    params.push(tactic);
    conditions.push(`tactic = $${params.length}`);
  }
  if (framework) {
    params.push(framework);
    conditions.push(`framework = $${params.length}`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const result = await pool.query(
    `SELECT * FROM ttps ${where} ORDER BY tactic, technique_id LIMIT 50`,
    params,
  );
  return result.rows;
}

export async function getTtpsForMapping(mappingId: string): Promise<unknown[]> {
  const result = await pool.query(
    `SELECT est.id AS entity_stage_ttp_id, t.id AS ttp_id, t.technique_id, t.name, t.tactic, t.framework, t.is_subtechnique
     FROM entity_stage_ttps est
     JOIN ttps t ON t.id = est.ttp_id
     WHERE est.kill_chain_mapping_id = $1
     ORDER BY t.tactic, t.technique_id`,
    [mappingId],
  );
  return result.rows;
}

export async function assignTtpToMapping(mappingId: string, ttpId: string, userId: string): Promise<unknown> {
  const result = await pool.query(
    `INSERT INTO entity_stage_ttps (kill_chain_mapping_id, ttp_id, created_by)
     VALUES ($1, $2, $3)
     ON CONFLICT (kill_chain_mapping_id, ttp_id) DO NOTHING
     RETURNING *`,
    [mappingId, ttpId, userId],
  );
  return result.rows[0];
}

export async function removeTtpFromMapping(entityStageTtpId: string): Promise<boolean> {
  const result = await pool.query('DELETE FROM entity_stage_ttps WHERE id = $1', [entityStageTtpId]);
  return (result.rowCount ?? 0) > 0;
}

export async function getTtpsByIncident(incidentId: string): Promise<unknown[]> {
  const result = await pool.query(
    `SELECT DISTINCT t.id, t.technique_id, t.name, t.tactic, t.framework, t.is_subtechnique,
            kcs.name AS stage_name, e.value AS entity_value, e.type AS entity_type
     FROM entity_stage_ttps est
     JOIN ttps t ON t.id = est.ttp_id
     JOIN entity_kill_chain_mappings ekm ON ekm.id = est.kill_chain_mapping_id
     JOIN kill_chain_stages kcs ON kcs.id = ekm.stage_id
     JOIN entities e ON e.id = ekm.entity_id
     WHERE e.incident_id = $1
     ORDER BY kcs.name, t.technique_id`,
    [incidentId],
  );
  return result.rows;
}
