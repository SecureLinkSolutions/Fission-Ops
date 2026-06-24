import { pool } from '../db/pool';

export interface TTPSuggestion {
  technique_id: string;
  name: string;
  weight: number;
}

// Strip subtechnique suffix so T1566.001 → T1566
function parentId(techniqueId: string): string {
  return techniqueId.split('.')[0];
}

export async function getSuggestionsForTechnique(
  techniqueId: string,
  alreadyAssignedIds: string[],
  limit = 5,
): Promise<TTPSuggestion[]> {
  const parent = parentId(techniqueId);
  const excluded = [parent, ...alreadyAssignedIds.map(parentId)];
  const result = await pool.query(
    `SELECT r.target_technique_id AS technique_id, t.name, r.weight
     FROM ttp_relationships r
     JOIN ttps t ON t.technique_id = r.target_technique_id
     WHERE r.source_technique_id = $1
       AND r.target_technique_id <> ALL($2::text[])
     ORDER BY r.weight DESC, r.target_technique_id
     LIMIT $3`,
    [parent, excluded, limit],
  );
  return result.rows;
}

export async function logSuggestion(data: {
  incident_id: string;
  entity_id: string;
  suggested_technique_id: string;
  trigger_technique_id: string;
  action: 'accepted' | 'dismissed';
  user_id: string;
}): Promise<void> {
  await pool.query(
    `INSERT INTO ttp_suggestion_log
       (incident_id, entity_id, suggested_technique_id, trigger_technique_id, action, user_id)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [data.incident_id, data.entity_id, data.suggested_technique_id,
     data.trigger_technique_id, data.action, data.user_id],
  );
}

const SEED_PAIRS: Array<[string, string, number]> = [
  ['T1566', 'T1078', 3], ['T1566', 'T1204', 3], ['T1566', 'T1059', 2], ['T1566', 'T1105', 2],
  ['T1078', 'T1021', 3], ['T1078', 'T1098', 2], ['T1078', 'T1550', 2],
  ['T1059', 'T1105', 3], ['T1059', 'T1027', 2], ['T1059', 'T1053', 2],
  ['T1055', 'T1036', 2], ['T1055', 'T1070', 2],
  ['T1003', 'T1078', 3], ['T1003', 'T1021', 2],
  ['T1021', 'T1570', 3], ['T1021', 'T1105', 2],
  ['T1105', 'T1059', 2], ['T1105', 'T1027', 2],
  ['T1486', 'T1490', 3], ['T1486', 'T1489', 2],
  ['T1070', 'T1036', 2],
  ['T1036', 'T1055', 2],
  ['T1190', 'T1059', 3], ['T1190', 'T1105', 2],
  ['T1133', 'T1078', 3], ['T1133', 'T1021', 2],
];

export async function seedTTPRelationships(): Promise<void> {
  const existing = await pool.query('SELECT COUNT(*) FROM ttp_relationships');
  if (parseInt(existing.rows[0].count, 10) > 0) return;

  const values: string[] = [];
  const params: unknown[] = [];
  let i = 1;

  for (const [src, tgt, w] of SEED_PAIRS) {
    // Both directions
    for (const [s, t] of [[src, tgt], [tgt, src]]) {
      values.push(`($${i++}, $${i++}, $${i++})`);
      params.push(s, t, w);
    }
  }

  await pool.query(
    `INSERT INTO ttp_relationships (source_technique_id, target_technique_id, weight)
     VALUES ${values.join(', ')}
     ON CONFLICT (source_technique_id, target_technique_id) DO NOTHING`,
    params,
  );
}
