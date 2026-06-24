import { pool } from '../db/pool';

export interface AuditLog {
  id: string;
  user_id: string | null;
  user_email: string | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  old_values: unknown;
  new_values: unknown;
  ip_address: string | null;
  created_at: Date;
}

interface LogAuditData {
  user_id?: string;
  user_email?: string;
  action: string;
  resource_type: string;
  resource_id?: string;
  old_values?: unknown;
  new_values?: unknown;
  ip_address?: string;
}

export async function logAudit(data: LogAuditData): Promise<void> {
  await pool.query(
    `INSERT INTO audit_logs (user_id, user_email, action, resource_type, resource_id, old_values, new_values, ip_address)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      data.user_id ?? null,
      data.user_email ?? null,
      data.action,
      data.resource_type,
      data.resource_id ?? null,
      data.old_values ? JSON.stringify(data.old_values) : null,
      data.new_values ? JSON.stringify(data.new_values) : null,
      data.ip_address ?? null,
    ],
  );
}

interface QueryAuditOptions {
  userId?: string;
  action?: string;
  resourceType?: string;
  from?: string;
  to?: string;
  page: number;
  limit: number;
}

export async function queryAuditLogs(
  opts: QueryAuditOptions,
): Promise<{ logs: AuditLog[]; total: number }> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let i = 1;

  if (opts.userId) {
    conditions.push(`user_id = $${i++}`);
    params.push(opts.userId);
  }
  if (opts.action) {
    conditions.push(`action = $${i++}`);
    params.push(opts.action);
  }
  if (opts.resourceType) {
    conditions.push(`resource_type = $${i++}`);
    params.push(opts.resourceType);
  }
  if (opts.from) {
    conditions.push(`created_at >= $${i++}`);
    params.push(opts.from);
  }
  if (opts.to) {
    conditions.push(`created_at <= $${i++}`);
    params.push(opts.to);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const offset = (opts.page - 1) * opts.limit;

  const countResult = await pool.query(`SELECT COUNT(*) FROM audit_logs ${where}`, params);
  const total = parseInt(countResult.rows[0].count, 10);

  params.push(opts.limit, offset);
  const result = await pool.query(
    `SELECT * FROM audit_logs ${where} ORDER BY created_at DESC LIMIT $${i++} OFFSET $${i++}`,
    params,
  );

  return { logs: result.rows, total };
}
