import { Router, Request, Response } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { pool } from '../db/pool';
import { standardPasswordSchema, platformAdminPasswordSchema } from '../utils/passwordPolicy';

const router = Router();

// All superadmin routes require platform_admin role
router.use(authenticate, requireRole('platform_admin'));

// GET /superadmin/users — list all users across all orgs
router.get('/users', async (_req: Request, res: Response) => {
  const result = await pool.query(
    `SELECT u.id, u.email, u.name, u.role, u.org_id, o.name AS org_name,
            u.sso_provider, u.deactivated_at, u.last_login_at, u.created_at
     FROM users u
     LEFT JOIN organizations o ON o.id = u.org_id
     ORDER BY u.created_at DESC`,
  );
  res.json(result.rows);
});

// POST /superadmin/users — create a user in a specific org
router.post('/users', async (req: Request, res: Response) => {
  const baseSchema = z.object({
    email: z.string().email(),
    name: z.string().min(1),
    role: z.enum(['analyst', 'senior_analyst', 'incident_commander', 'platform_admin']),
    org_id: z.string().uuid().optional(),
  });
  const base = baseSchema.parse(req.body);
  const pwSchema = z.object({
    password: base.role === 'platform_admin' ? platformAdminPasswordSchema : standardPasswordSchema,
  });
  const { password } = pwSchema.parse(req.body);
  const data = { ...base, password };
  const passwordHash = await bcrypt.hash(data.password, 12);
  const result = await pool.query(
    `INSERT INTO users (email, name, role, password_hash, org_id)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, email, name, role, org_id, created_at`,
    [data.email, data.name, data.role, passwordHash, data.org_id],
  );
  res.status(201).json(result.rows[0]);
});

// PATCH /superadmin/users/:id/deactivate
router.patch('/users/:id/deactivate', async (req: Request, res: Response) => {
  const result = await pool.query(
    `UPDATE users SET deactivated_at = NOW() WHERE id = $1 RETURNING id, email, deactivated_at`,
    [req.params.id],
  );
  if ((result.rowCount ?? 0) === 0) {
    res.status(404).json({ error: 'User not found', code: 'NOT_FOUND' });
    return;
  }
  res.json(result.rows[0]);
});

// PATCH /superadmin/users/:id/reactivate
router.patch('/users/:id/reactivate', async (req: Request, res: Response) => {
  const result = await pool.query(
    `UPDATE users SET deactivated_at = NULL WHERE id = $1 RETURNING id, email, deactivated_at`,
    [req.params.id],
  );
  if ((result.rowCount ?? 0) === 0) {
    res.status(404).json({ error: 'User not found', code: 'NOT_FOUND' });
    return;
  }
  res.json(result.rows[0]);
});

export default router;
