import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { createBoundarySchema, boundaryMappingSchema } from '../schemas/mapping';
import * as repo from '../repositories/boundaryRepository';
import * as entityRepo from '../repositories/entityRepository';
import { createError } from '../middleware/errorHandler';

const router = Router({ mergeParams: true });

router.get('/', authenticate, async (req: Request, res: Response) => {
  const boundaries = await repo.listBoundaries(req.params.incidentId);
  res.json(boundaries);
});

router.post('/', authenticate, requireRole('analyst'), async (req: Request, res: Response) => {
  const body = createBoundarySchema.parse(req.body);
  const boundary = await repo.createBoundary({ ...body, incident_id: req.params.incidentId, created_by: req.user!.sub });
  res.status(201).json(boundary);
});

export const entityBoundaryRouter = Router({ mergeParams: true });

entityBoundaryRouter.post('/', authenticate, requireRole('analyst'), async (req: Request, res: Response) => {
  const entity = await entityRepo.getEntityById(req.params.entityId);
  if (!entity) throw createError('Entity not found', 404, 'NOT_FOUND');
  const body = boundaryMappingSchema.parse(req.body);
  const mapping = await repo.mapEntityToBoundary({ ...body, entity_id: req.params.entityId, mapped_by: req.user!.sub });
  res.status(201).json(mapping);
});

entityBoundaryRouter.delete('/:mappingId', authenticate, requireRole('senior_analyst'), async (req: Request, res: Response) => {
  const deleted = await repo.removeBoundaryMapping(req.params.mappingId);
  if (!deleted) throw createError('Mapping not found', 404, 'NOT_FOUND');
  res.status(204).send();
});

export default router;
