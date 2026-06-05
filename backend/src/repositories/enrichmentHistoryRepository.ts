import { pool } from '../db/pool';

export interface EnrichmentHistoryEntry {
  id: string;
  entity_id: string;
  source: string;
  triggered_by?: string;
  triggered_by_name?: string;
  verdict?: string;
  raw_result?: Record<string, unknown>;
  summary?: string;
  created_at: string;
}

export async function recordEnrichment(data: {
  entity_id: string;
  source: string;
  triggered_by?: string;
  triggered_by_name?: string;
  verdict?: string;
  raw_result?: Record<string, unknown>;
  summary?: string;
}): Promise<EnrichmentHistoryEntry> {
  const result = await pool.query(
    `INSERT INTO entity_enrichment_history
       (entity_id, source, triggered_by, triggered_by_name, verdict, raw_result, summary)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [data.entity_id, data.source, data.triggered_by ?? null, data.triggered_by_name ?? null,
     data.verdict ?? null, data.raw_result ? JSON.stringify(data.raw_result) : null, data.summary ?? null],
  );
  return result.rows[0];
}

export async function getEnrichmentHistory(entityId: string): Promise<EnrichmentHistoryEntry[]> {
  const result = await pool.query(
    `SELECT * FROM entity_enrichment_history WHERE entity_id = $1 ORDER BY created_at DESC`,
    [entityId],
  );
  return result.rows;
}
