import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import * as repo from '../repositories/userManagementRepository';
import { createError } from '../middleware/errorHandler';

const router = Router();
const icOnly = [authenticate, requireRole('incident_commander')];

const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  role: z.enum(['analyst', 'senior_analyst', 'incident_commander']),
  password: z.string().min(8),
});

const updateRoleSchema = z.object({
  role: z.enum(['analyst', 'senior_analyst', 'incident_commander']),
});

const resetPasswordSchema = z.object({
  password: z.string().min(8),
});

router.get('/', ...icOnly, async (req: Request, res: Response) => {
  const isPlatformAdmin = req.user!.role === 'platform_admin';
  const users = isPlatformAdmin
    ? await repo.listUsers(undefined, true)
    : await repo.listUsers(req.user!.org_id);
  res.json(users);
});

router.post('/', ...icOnly, async (req: Request, res: Response) => {
  const body = createUserSchema.parse(req.body);
  // platform_admin cannot create users without belonging to an org themselves
  const orgId = req.user!.role === 'platform_admin' ? req.user!.org_id : req.user!.org_id;
  const user = await repo.createUser({ ...body, org_id: orgId });
  res.status(201).json(user);
});

router.patch('/:id/deactivate', ...icOnly, async (req: Request, res: Response) => {
  // platform_admin can only act on users in orgs with platform_admin_access
  const orgId = req.user!.role === 'platform_admin' ? undefined : req.user!.org_id;
  const user = await repo.deactivateUser(req.params.id, orgId);
  if (!user) throw createError('User not found', 404, 'NOT_FOUND');
  res.json(user);
});

router.patch('/:id/reactivate', ...icOnly, async (req: Request, res: Response) => {
  const orgId = req.user!.role === 'platform_admin' ? undefined : req.user!.org_id;
  const user = await repo.reactivateUser(req.params.id, orgId);
  if (!user) throw createError('User not found', 404, 'NOT_FOUND');
  res.json(user);
});

router.patch('/:id/role', ...icOnly, async (req: Request, res: Response) => {
  const { role } = updateRoleSchema.parse(req.body);
  const orgId = req.user!.role === 'platform_admin' ? undefined : req.user!.org_id;
  const user = await repo.updateUserRole(req.params.id, role, orgId);
  if (!user) throw createError('User not found', 404, 'NOT_FOUND');
  res.json(user);
});

router.patch('/:id/password', ...icOnly, async (req: Request, res: Response) => {
  const { password } = resetPasswordSchema.parse(req.body);
  const orgId = req.user!.role === 'platform_admin' ? undefined : req.user!.org_id;
  const ok = await repo.resetUserPassword(req.params.id, password, orgId);
  if (!ok) throw createError('User not found', 404, 'NOT_FOUND');
  res.json({ success: true });
});

export default router;
