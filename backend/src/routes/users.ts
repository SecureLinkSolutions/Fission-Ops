import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import * as repo from '../repositories/userManagementRepository';
import { createError } from '../middleware/errorHandler';
import { standardPasswordSchema, passwordSchemaForRole } from '../utils/passwordPolicy';

const router = Router();
const icOnly = [authenticate, requireRole('incident_commander')];

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
