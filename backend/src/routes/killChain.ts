import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { killChainMappingSchema } from '../schemas/mapping';
import * as repo from '../repositories/killChainRepository';
import * as entityRepo from '../repositories/entityRepository';
import { createError } from '../middleware/errorHandler';

const router = Router();

router.get('/kill-chain/stages', authenticate, async (_req: Request, res: Response) => {
  const stages = await repo.listStages();
  res.json(stages);
});

router.post('/entities/:entityId/kill-chain', authenticate, requireRole('analyst'), async (req: Request, res: Response) => {
  const entity = await entityRepo.getEntityById(req.params.entityId);
  if (!entity) throw createError('Entity not found', 404, 'NOT_FOUND');
  const body = killChainMappingSchema.parse(req.body);
  const mapping = await repo.mapEntityToStage({ ...body, entity_id: req.params.entityId, mapped_by: req.user!.sub });
  res.status(201).json(mapping);
});

router.delete('/entities/:entityId/kill-chain/:mappingId', authenticate, requireRole('senior_analyst'), async (req: Request, res: Response) => {
  const deleted = await repo.removeMappingById(req.params.mappingId);
  if (!deleted) throw createError('Mapping not found', 404, 'NOT_FOUND');
  res.status(204).send();
});

router.get('/incidents/:incidentId/kill-chain/matrix', authenticate, async (req: Request, res: Response) => {
  const matrix = await repo.getKillChainMatrix(req.params.incidentId);
  res.json(matrix);
});

export default router;
