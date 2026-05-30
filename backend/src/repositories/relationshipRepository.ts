import { pool } from '../db/pool';

export interface EntityRelationship {
  id: string;
  incident_id: string;
  source_entity_id: string;
  target_entity_id: string;
  relationship_type: string;
  notes?: string;
  created_by: string;
  created_at: Date;
  source_value?: string;
  source_type?: string;
  target_value?: string;
  target_type?: string;
}

export async function listRelationships(incidentId: string): Promise<EntityRelationship[]> {
  const result = await pool.query(
    `SELECT er.*,
            se.value AS source_value, se.type AS source_type,
            te.value AS target_value, te.type AS target_type
     FROM entity_relationships er
     JOIN entities se ON se.id = er.source_entity_id
     JOIN entities te ON te.id = er.target_entity_id
     WHERE er.incident_id = $1
     ORDER BY er.created_at`,
    [incidentId],
  );
  return result.rows;
}

export async function createRelationship(data: {
  incident_id: string;
  source_entity_id: string;
  target_entity_id: string;
  relationship_type: string;
  notes?: string;
  created_by: string;
}): Promise<EntityRelationship> {
  const result = await pool.query(
    `INSERT INTO entity_relationships
       (incident_id, source_entity_id, target_entity_id, relationship_type, notes, created_by)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (source_entity_id, target_entity_id, relationship_type) DO UPDATE
       SET notes = EXCLUDED.notes, created_by = EXCLUDED.created_by
     RETURNING *`,
    [data.incident_id, data.source_entity_id, data.target_entity_id, data.relationship_type, data.notes ?? null, data.created_by],
  );
  return result.rows[0];
}

export async function deleteRelationship(id: string): Promise<boolean> {
  const result = await pool.query('DELETE FROM entity_relationships WHERE id = $1', [id]);
  return (result.rowCount ?? 0) > 0;
}
