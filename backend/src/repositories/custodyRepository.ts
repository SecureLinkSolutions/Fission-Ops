import { pool } from '../db/pool';

export interface CustodyEntry {
  id: string;
  entity_id: string;
  incident_id?: string;
  action: string;
  actor_id?: string;
  actor_name?: string;
  actor_role?: string;
  actor_ip?: string;
  details?: Record<string, unknown>;
  created_at: string;
}

export type CustodyAction =
  | 'entity_viewed'
  | 'enrichment_retrieved'
  | 'entity_edited'
  | 'ioc_status_changed'
  | 'entity_exported'
  | 'kill_chain_mapped'
  | 'checklist_updated'
  | 'comment_added';

export async function recordCustody(data: {
  entity_id: string;
  incident_id?: string;
  action: CustodyAction;
  actor_id?: string;
  actor_name?: string;
  actor_role?: string;
  actor_ip?: string;
  details?: Record<string, unknown>;
}): Promise<void> {
  await pool.query(
    `INSERT INTO evidence_custody_log
       (entity_id, incident_id, action, actor_id, actor_name, actor_role, actor_ip, details)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [data.entity_id, data.incident_id ?? null, data.action,
     data.actor_id ?? null, data.actor_name ?? null, data.actor_role ?? null,
     data.actor_ip ?? null, data.details ? JSON.stringify(data.details) : null],
  );
}

export async function getCustodyLog(entityId: string): Promise<CustodyEntry[]> {
  const result = await pool.query(
    `SELECT * FROM evidence_custody_log WHERE entity_id = $1 ORDER BY created_at ASC`,
    [entityId],
  );
  return result.rows;
}
