import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import * as repo from '../repositories/relationshipRepository';
import { createError } from '../middleware/errorHandler';

const router = Router({ mergeParams: true });

// One of the 8 connection points on an EntityNode (see EntityRelationshipGraph.tsx):
// one source + one target handle per side.
const HANDLE_IDS = ['left-s', 'left-t', 'top-s', 'top-t', 'right-s', 'right-t', 'bottom-s', 'bottom-t'] as const;

const createRelationshipSchema = z.object({
  source_entity_id: z.string().uuid(),
  target_entity_id: z.string().uuid(),
  relationship_type: z.string().min(1).max(100),
  bidirectional: z.boolean().optional(),
  notes: z.string().optional(),
  source_handle: z.enum(HANDLE_IDS).optional(),
  target_handle: z.enum(HANDLE_IDS).optional(),
});

router.get('/', authenticate, async (req: Request, res: Response) => {
  const relationships = await repo.listRelationships(req.params.incidentId);
  res.json(relationships);
});

router.post('/', authenticate, requireRole('analyst'), async (req: Request, res: Response) => {
  const body = createRelationshipSchema.parse(req.body);
  const relationship = await repo.createRelationship({
    ...body,
    bidirectional: body.bidirectional ?? false,
    incident_id: req.params.incidentId,
    created_by: req.user!.sub,
  });
  res.status(201).json(relationship);
});

router.delete('/:id', authenticate, requireRole('analyst'), async (req: Request, res: Response) => {
  const deleted = await repo.deleteRelationship(req.params.id);
  if (!deleted) throw createError('Relationship not found', 404, 'NOT_FOUND');
  res.status(204).send();
});

export default router;
