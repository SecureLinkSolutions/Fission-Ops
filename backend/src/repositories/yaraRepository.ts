import { pool } from '../db/pool';
import { YaraHashes, YaraStringDef } from '../services/yaraBuilder';

export interface YaraRule {
  id: string;
  incident_id: string;
  entity_id: string | null;
  name: string;
  description: string | null;
  author: string | null;
  reference: string | null;
  tags: string[];
  strings: YaraStringDef[];
  hashes: YaraHashes;
  condition: string;
  rule_text: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export async function listByIncident(incidentId: string): Promise<YaraRule[]> {
  const result = await pool.query(
    'SELECT * FROM yara_rules WHERE incident_id = $1 ORDER BY created_at DESC',
    [incidentId],
  );
  return result.rows;
}

export async function getById(id: string): Promise<YaraRule | null> {
  const result = await pool.query('SELECT * FROM yara_rules WHERE id = $1', [id]);
  return result.rows[0] ?? null;
}

export async function createRule(data: {
  incident_id: string;
  entity_id?: string | null;
  name: string;
  description?: string;
  author?: string;
  reference?: string;
  tags?: string[];
  strings: YaraStringDef[];
  hashes: YaraHashes;
  condition: string;
  rule_text: string;
  created_by: string;
}): Promise<YaraRule> {
  const result = await pool.query(
    `INSERT INTO yara_rules (incident_id, entity_id, name, description, author, reference, tags, strings, hashes, condition, rule_text, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     RETURNING *`,
    [
      data.incident_id,
      data.entity_id ?? null,
      data.name,
      data.description ?? null,
      data.author ?? null,
      data.reference ?? null,
      data.tags ?? [],
      JSON.stringify(data.strings),
      JSON.stringify(data.hashes),
      data.condition,
      data.rule_text,
      data.created_by,
    ],
  );
  return result.rows[0];
}

export async function updateRule(
  id: string,
  data: {
    name: string;
    description?: string;
    author?: string;
    reference?: string;
    tags?: string[];
    strings: YaraStringDef[];
    hashes: YaraHashes;
    condition: string;
    rule_text: string;
  },
): Promise<YaraRule | null> {
  const result = await pool.query(
    `UPDATE yara_rules
     SET name = $1, description = $2, author = $3, reference = $4, tags = $5,
         strings = $6, hashes = $7, condition = $8, rule_text = $9, updated_at = NOW()
     WHERE id = $10
     RETURNING *`,
    [
      data.name,
      data.description ?? null,
      data.author ?? null,
      data.reference ?? null,
      data.tags ?? [],
      JSON.stringify(data.strings),
      JSON.stringify(data.hashes),
      data.condition,
      data.rule_text,
      id,
    ],
  );
  return result.rows[0] ?? null;
}

export async function deleteRule(id: string): Promise<boolean> {
  const result = await pool.query('DELETE FROM yara_rules WHERE id = $1', [id]);
  return (result.rowCount ?? 0) > 0;
}
