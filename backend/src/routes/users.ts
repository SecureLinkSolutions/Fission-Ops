import { Router, Request, Response } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import * as repo from '../repositories/userManagementRepository';
import { createError } from '../middleware/errorHandler';
import { standardPasswordSchema, passwordSchemaForRole } from '../utils/passwordPolicy';
import { pool } from '../db/pool';

const router = Router();
const icOnly = [authenticate, requireRole('incident_commander')];

// Self-service profile endpoints
router.get('/me', authenticate, async (req: Request, res: Response) => {
  const result = await pool.query(
    'SELECT id, email, name, role, org_id, created_at FROM users WHERE id = $1',
    [req.user!.sub],
  );
  if (result.rowCount === 0) { res.status(404).json({ error: 'User not found' }); return; }
  res.json(result.rows[0]);
});

router.patch('/me', authenticate, async (req: Request, res: Response) => {
  const schema = z.object({ name: z.string().min(1) });
  const { name } = schema.parse(req.body);
  const result = await pool.query(
    'UPDATE users SET name = $1 WHERE id = $2 RETURNING id, email, name, role, org_id, created_at',
    [name, req.user!.sub],
  );
  res.json(result.rows[0]);
});

router.post('/me/change-password', authenticate, async (req: Request, res: Response) => {
  const schema = z.object({ current_password: z.string(), new_password: z.string() });
  const { current_password, new_password } = schema.parse(req.body);

  const userResult = await pool.query('SELECT password_hash, role FROM users WHERE id = $1', [req.user!.sub]);
  if (userResult.rowCount === 0) { res.status(404).json({ error: 'User not found' }); return; }
  const { password_hash, role } = userResult.rows[0];

  if (!password_hash) {
    res.status(400).json({ error: 'Password change not available for SSO accounts' });
    return;
  }

  const valid = await bcrypt.compare(current_password, password_hash);
  if (!valid) {
    res.status(400).json({ error: 'Current password is incorrect' });
    return;
  }

  const pwSchema = passwordSchemaForRole(role);
  const parsed = pwSchema.safeParse(new_password);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0]?.message ?? 'Invalid password' });
    return;
  }

  const newHash = await bcrypt.hash(new_password, 12);
  await pool.query(
    'UPDATE users SET password_hash = $1, password_reset_required = false WHERE id = $2',
    [newHash, req.user!.sub],
  );
  res.json({ success: true });
});

const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  role: z.enum(['analyst', 'senior_analyst', 'incident_commander']),
  password: standardPasswordSchema,
});

const updateRoleSchema = z.object({
  role: z.enum(['analyst', 'senior_analyst', 'incident_commander']),
});

const PLATFORM_ADMIN_FORBIDDEN = { error: 'Platform admins manage the platform, not org users', code: 'FORBIDDEN' };

router.get('/', ...icOnly, async (req: Request, res: Response) => {
  if (req.user!.role === 'platform_admin') { res.status(403).json(PLATFORM_ADMIN_FORBIDDEN); return; }
  const users = await repo.listUsers(req.user!.org_id);
  res.json(users);
});

router.post('/', ...icOnly, async (req: Request, res: Response) => {
  if (req.user!.role === 'platform_admin') { res.status(403).json(PLATFORM_ADMIN_FORBIDDEN); return; }
  const body = createUserSchema.parse(req.body);
  const user = await repo.createUser({ ...body, org_id: req.user!.org_id });
  res.status(201).json(user);
});

router.patch('/:id/deactivate', ...icOnly, async (req: Request, res: Response) => {
  if (req.user!.role === 'platform_admin') { res.status(403).json(PLATFORM_ADMIN_FORBIDDEN); return; }
  const user = await repo.deactivateUser(req.params.id, req.user!.org_id);
  if (!user) throw createError('User not found', 404, 'NOT_FOUND');
  res.json(user);
});

router.patch('/:id/reactivate', ...icOnly, async (req: Request, res: Response) => {
  if (req.user!.role === 'platform_admin') { res.status(403).json(PLATFORM_ADMIN_FORBIDDEN); return; }
  const user = await repo.reactivateUser(req.params.id, req.user!.org_id);
  if (!user) throw createError('User not found', 404, 'NOT_FOUND');
  res.json(user);
});

router.patch('/:id/role', ...icOnly, async (req: Request, res: Response) => {
  if (req.user!.role === 'platform_admin') { res.status(403).json(PLATFORM_ADMIN_FORBIDDEN); return; }
  const { role } = updateRoleSchema.parse(req.body);
  const user = await repo.updateUserRole(req.params.id, role, req.user!.org_id);
  if (!user) throw createError('User not found', 404, 'NOT_FOUND');
  res.json(user);
});

router.patch('/:id/password', ...icOnly, async (req: Request, res: Response) => {
  if (req.user!.role === 'platform_admin') { res.status(403).json(PLATFORM_ADMIN_FORBIDDEN); return; }
  // Fetch the target user's role so we can enforce the right password policy
  const targetUser = await repo.getUserById(req.params.id);
  const schema = z.object({ password: passwordSchemaForRole(targetUser?.role) });
  const { password } = schema.parse(req.body);
  const ok = await repo.resetUserPassword(req.params.id, password, req.user!.org_id);
  if (!ok) throw createError('User not found', 404, 'NOT_FOUND');
  res.json({ success: true });
});

export default router;
