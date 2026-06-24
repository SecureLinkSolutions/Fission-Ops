import { pool } from '../db/pool';

export interface ChecklistItem {
  id: string;
  entity_id: string;
  item_text: string;
  checked: boolean;
  checked_by?: string;
  checked_by_name?: string;
  checked_at?: string;
  created_by?: string;
  created_by_name?: string;
  order_index: number;
  is_custom: boolean;
  created_at: string;
}

export const DEFAULT_CHECKLIST_ITEMS: Record<string, string[]> = {
  ip: [
    'Block at perimeter firewall (inbound and outbound)',
    'Block at internal firewall',
    'Add to EDR network blocklist',
    'Check for active connections to/from this IP',
    'Notify network team',
    'Document block timestamp and approver',
  ],
  domain: [
    'Block at DNS resolver',
    'Add to web proxy blocklist',
    'Check for active DNS queries in SIEM logs',
    'Notify network team',
    'Document block timestamp and approver',
  ],
  account: [
    'Disable account in Active Directory / IdP',
    'Reset password via secure out-of-band channel',
    'Revoke all active sessions and OAuth/API tokens',
    'Check for persistence mechanisms created by this account',
    'Notify HR if insider threat suspected',
    'Document account disable timestamp and approver',
  ],
  hostname: [
    'Isolate host from network via EDR or switch port',
    'Capture memory image before shutdown',
    'Capture forensic disk image',
    'Run EDR full scan on host',
    'Check for lateral movement originating from host',
    'Notify asset owner',
    'Document isolation timestamp and approver',
  ],
  file: [
    'Quarantine all instances via EDR',
    'Add file hash to EDR and AV blocklist',
    'Check for execution history across endpoints',
    'Submit to sandbox for analysis',
    'Document quarantine timestamp and approver',
  ],
  email: [
    'Block sender at email gateway',
    'Quarantine all similar emails across mailboxes',
    'Identify and notify all recipients',
    'Check if any recipients clicked links or opened attachments',
    'Document block timestamp and approver',
  ],
  process: [
    'Kill process on all affected systems via EDR',
    'Check for child processes and persistence mechanisms',
    'Dump process memory for analysis',
    'Document kill timestamp and approver',
  ],
  url: [
    'Block URL at web proxy and DNS',
    'Identify all users who visited the URL in proxy logs',
    'Notify users who visited — instruct to report symptoms',
    'Document block timestamp and approver',
  ],
  registry: [
    'Delete registry key from all affected hosts',
    'Monitor for automatic re-creation',
    'Identify and remediate the process responsible',
    'Document remediation timestamp',
  ],
  certificate: [
    'Revoke certificate via issuing CA',
    'Replace certificate across all services',
    'Audit all services that used this certificate',
    'Document revocation timestamp',
  ],
  custom: [],
};

export async function getChecklist(entityId: string): Promise<ChecklistItem[]> {
  const result = await pool.query(
    `SELECT * FROM entity_checklists WHERE entity_id = $1 ORDER BY order_index, created_at`,
    [entityId],
  );
  return result.rows;
}

export async function initChecklist(
  entityId: string,
  items: string[],
  createdBy: string,
  createdByName: string,
): Promise<ChecklistItem[]> {
  const existing = await pool.query(
    `SELECT id FROM entity_checklists WHERE entity_id = $1 LIMIT 1`,
    [entityId],
  );
  if ((existing.rowCount ?? 0) > 0) {
    return getChecklist(entityId);
  }
  if (items.length === 0) {
    return [];
  }
  const valueClauses = items.map((_, i) => `($1, $${i * 3 + 2}, $${i * 3 + 3}, $${i * 3 + 4}, ${i})`).join(', ');
  const params: unknown[] = [entityId];
  for (const text of items) {
    params.push(text, createdBy, createdByName);
  }
  await pool.query(
    `INSERT INTO entity_checklists (entity_id, item_text, created_by, created_by_name, order_index) VALUES ${valueClauses}`,
    params,
  );
  return getChecklist(entityId);
}

export async function checkItem(
  itemId: string,
  userId: string,
  userName: string,
  checked: boolean,
): Promise<ChecklistItem | null> {
  const result = await pool.query(
    `UPDATE entity_checklists
     SET checked = $2,
         checked_by = CASE WHEN $2 THEN $3::uuid ELSE NULL END,
         checked_by_name = CASE WHEN $2 THEN $4 ELSE NULL END,
         checked_at = CASE WHEN $2 THEN NOW() ELSE NULL END
     WHERE id = $1
     RETURNING *`,
    [itemId, checked, userId, userName],
  );
  return result.rows[0] ?? null;
}

export async function addCustomItem(
  entityId: string,
  text: string,
  createdBy: string,
  createdByName: string,
): Promise<ChecklistItem> {
  const maxResult = await pool.query(
    `SELECT COALESCE(MAX(order_index), -1) + 1 AS next_index FROM entity_checklists WHERE entity_id = $1`,
    [entityId],
  );
  const nextIndex = maxResult.rows[0].next_index;
  const result = await pool.query(
    `INSERT INTO entity_checklists (entity_id, item_text, created_by, created_by_name, order_index, is_custom)
     VALUES ($1, $2, $3, $4, $5, TRUE)
     RETURNING *`,
    [entityId, text, createdBy, createdByName, nextIndex],
  );
  return result.rows[0];
}

export async function deleteCustomItem(itemId: string): Promise<boolean> {
  const result = await pool.query(
    `DELETE FROM entity_checklists WHERE id = $1 AND is_custom = TRUE`,
    [itemId],
  );
  return (result.rowCount ?? 0) > 0;
}
