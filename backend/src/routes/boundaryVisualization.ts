import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import * as repo from '../repositories/boundaryTraversalRepository';
import { createError } from '../middleware/errorHandler';

const router = Router({ mergeParams: true });

router.get('/entity-zones', authenticate, async (req: Request, res: Response) => {
  const assignments = await repo.listEntityZoneAssignments(req.params.incidentId);
  res.json(assignments);
});

router.post('/entity-zones', authenticate, requireRole('analyst'), async (req: Request, res: Response) => {
  const { entity_id, boundary_id } = z.object({
    entity_id: z.string().uuid(),
    boundary_id: z.string().uuid(),
  }).parse(req.body);
  const assignment = await repo.assignEntityToZone(entity_id, boundary_id, req.user!.sub);
  res.status(201).json(assignment);
});

router.get('/traversals', authenticate, async (req: Request, res: Response) => {
  const traversals = await repo.listBoundaryTraversals(req.params.incidentId);
  res.json(traversals);
});

router.post('/traversals', authenticate, requireRole('analyst'), async (req: Request, res: Response) => {
  const body = z.object({
    source_boundary_id: z.string().uuid(),
    target_boundary_id: z.string().uuid(),
    label: z.string().optional(),
    notes: z.string().optional(),
  }).parse(req.body);
  const traversal = await repo.createBoundaryTraversal({
    ...body,
    incident_id: req.params.incidentId,
    created_by: req.user!.sub,
  });
  res.status(201).json(traversal);
});

router.delete('/traversals/:id', authenticate, requireRole('analyst'), async (req: Request, res: Response) => {
  const deleted = await repo.deleteBoundaryTraversal(req.params.id);
  if (!deleted) throw createError('Traversal not found', 404, 'NOT_FOUND');
  res.status(204).send();
});

export default router;
