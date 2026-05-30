import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { killChainMappingSchema } from '../schemas/mapping';
import * as repo from '../repositories/killChainRepository';
import * as entityRepo from '../repositories/entityRepository';
import { createError } from '../middleware/errorHandler';
import { ttpMappingRouter } from './ttps';

const router = Router();

const frameworkSchema = z.enum(['lockheed_martin', 'mitre_attack', 'mitre_ics']).optional();

router.get('/kill-chain/stages', authenticate, async (req: Request, res: Response) => {
  const framework = frameworkSchema.parse(req.query.framework);
  const stages = await repo.listStages(framework);
  res.json(stages);
});

router.post('/entities/:entityId/kill-chain', authenticate, requireRole('analyst'), async (req: Request, res: Response) => {
  const entity = await entityRepo.getEntityById(req.params.entityId);
  if (!entity) throw createError('Entity not found', 404, 'NOT_FOUND');
  const body = killChainMappingSchema.parse(req.body);
  const mapping = await repo.mapEntityToStage({ ...body, entity_id: req.params.entityId, mapped_by: req.user!.sub });
  res.status(201).json(mapping);
});

router.patch('/entities/:entityId/kill-chain/:mappingId', authenticate, requireRole('analyst'), async (req: Request, res: Response) => {
  const { stage_id } = z.object({ stage_id: z.string().uuid() }).parse(req.body);
  const mapping = await repo.updateMappingStage(req.params.mappingId, stage_id, req.user!.sub);
  if (!mapping) throw createError('Mapping not found', 404, 'NOT_FOUND');
  res.json(mapping);
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

router.use('/entities/:entityId/kill-chain/:mappingId/ttps', ttpMappingRouter);

export default router;
