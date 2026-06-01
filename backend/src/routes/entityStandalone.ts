import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { updateEntitySchema } from '../schemas/entity';
import * as repo from '../repositories/entityRepository';
import { createError } from '../middleware/errorHandler';

const router = Router();

router.get('/:id', authenticate, async (req: Request, res: Response) => {
  const entity = await repo.getEntityWithMappings(req.params.id);
  if (!entity) throw createError('Entity not found', 404, 'NOT_FOUND');
  res.json(entity);
});

router.put('/:id', authenticate, requireRole('senior_analyst'), async (req: Request, res: Response) => {
  const body = updateEntitySchema.parse(req.body);
  const entity = await repo.updateEntity(req.params.id, body);
  if (!entity) throw createError('Entity not found', 404, 'NOT_FOUND');
  res.json(entity);
});

router.patch('/:id/status', authenticate, requireRole('analyst'), async (req: Request, res: Response) => {
  const { status } = z.object({
    status: z.enum(['unreviewed', 'under_investigation', 'isolated', 'contained', 'cleared', 'confirmed_malicious']),
  }).parse(req.body);
  const entity = await repo.updateEntityStatus(req.params.id, status, req.user!.sub);
  if (!entity) throw createError('Entity not found', 404, 'NOT_FOUND');
  res.json(entity);
});

router.delete('/:id', authenticate, requireRole('incident_commander'), async (req: Request, res: Response) => {
  const deleted = await repo.deleteEntity(req.params.id);
  if (!deleted) throw createError('Entity not found', 404, 'NOT_FOUND');
  res.status(204).send();
});

export default router;
