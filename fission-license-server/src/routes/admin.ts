import { Router, Request, Response } from 'express';
import { config } from '../config';
import { pool } from '../db/pool';
import { createLicense, revokeLicense } from '../services/licenseService';

const router = Router();

function requireAdminKey(req: Request, res: Response, next: () => void): void {
  const key = req.headers['x-admin-api-key'] || req.headers['admin-api-key'];
  if (key !== config.ADMIN_API_KEY) {
    res.status(401).json({ error: 'Invalid admin API key' });
    return;
  }
  next();
}

router.use(requireAdminKey);

// GET /admin/stats
router.get('/stats', async (_req: Request, res: Response) => {
  const now = new Date();
  const in30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const result = await pool.query(`
    SELECT
      COUNT(*) FILTER (WHERE NOT revoked) AS active,
      COUNT(*) FILTER (WHERE revoked) AS revoked,
      COUNT(*) FILTER (WHERE tier = 'starter' AND NOT revoked) AS starter,
      COUNT(*) FILTER (WHERE tier = 'professional' AND NOT revoked) AS professional,
      COUNT(*) FILTER (WHERE tier = 'enterprise' AND NOT revoked) AS enterprise,
      COUNT(*) FILTER (WHERE NOT revoked AND expires_at > NOW() AND expires_at <= $1) AS expiring_30d,
      COUNT(*) AS total
    FROM licenses
  `, [in30]);

  const row = result.rows[0];
  res.json({
    total: parseInt(row.total),
    active: parseInt(row.active),
    revoked: parseInt(row.revoked),
    by_tier: {
      starter: parseInt(row.starter),
      professional: parseInt(row.professional),
      enterprise: parseInt(row.enterprise),
    },
    expiring_30d: parseInt(row.expiring_30d),
  });
});

// GET /admin/licenses
router.get('/licenses', async (_req: Request, res: Response) => {
  const result = await pool.query('SELECT * FROM licenses ORDER BY created_at DESC');
  res.json(result.rows);
});

// POST /admin/licenses (alias for generate)
router.post('/licenses', async (req: Request, res: Response) => {
  const { org_name, org_email, tier, max_users, max_incidents, features, expires_days } = req.body;
  if (!org_name || !org_email || !tier || !expires_days) {
    res.status(400).json({ error: 'Missing required fields' });
    return;
  }
  const result = await createLicense({
    org_name, org_email,
    tier: tier as 'starter' | 'professional' | 'enterprise',
    max_users: max_users ?? 3,
    max_incidents: max_incidents ?? 10,
    features,
    expires_days: Number(expires_days),
  });
  res.json(result);
});

// DELETE /admin/licenses/:key
router.delete('/licenses/:key', async (req: Request, res: Response) => {
  const { reason } = req.body;
  await revokeLicense(req.params.key, reason ?? 'Revoked by admin');
  res.json({ success: true });
});

export default router;
