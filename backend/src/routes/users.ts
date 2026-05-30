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

router.get('/', ...icOnly, async (_req: Request, res: Response) => {
  const users = await repo.listUsers();
  res.json(users);
});

router.post('/', ...icOnly, async (req: Request, res: Response) => {
  const body = createUserSchema.parse(req.body);
  const user = await repo.createUser(body);
  res.status(201).json(user);
});

router.patch('/:id/deactivate', ...icOnly, async (req: Request, res: Response) => {
  const user = await repo.deactivateUser(req.params.id);
  if (!user) throw createError('User not found', 404, 'NOT_FOUND');
  res.json(user);
});

router.patch('/:id/reactivate', ...icOnly, async (req: Request, res: Response) => {
  const user = await repo.reactivateUser(req.params.id);
  if (!user) throw createError('User not found', 404, 'NOT_FOUND');
  res.json(user);
});

router.patch('/:id/role', ...icOnly, async (req: Request, res: Response) => {
  const { role } = updateRoleSchema.parse(req.body);
  const user = await repo.updateUserRole(req.params.id, role);
  if (!user) throw createError('User not found', 404, 'NOT_FOUND');
  res.json(user);
});

router.patch('/:id/password', ...icOnly, async (req: Request, res: Response) => {
  const { password } = resetPasswordSchema.parse(req.body);
  const ok = await repo.resetUserPassword(req.params.id, password);
  if (!ok) throw createError('User not found', 404, 'NOT_FOUND');
  res.json({ success: true });
});

export default router;
