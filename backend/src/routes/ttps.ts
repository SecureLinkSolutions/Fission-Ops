import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import * as repo from '../repositories/ttpRepository';
import { createError } from '../middleware/errorHandler';

export const ttpSearchRouter = Router();

ttpSearchRouter.get('/', authenticate, async (req: Request, res: Response) => {
  const q = req.query.q as string | undefined;
  const tactic = req.query.tactic as string | undefined;
  const framework = req.query.framework as string | undefined;
  const ttps = await repo.searchTtps(q, tactic, framework);
  res.json(ttps);
});

export const ttpMappingRouter = Router({ mergeParams: true });

ttpMappingRouter.get('/', authenticate, async (req: Request, res: Response) => {
  const ttps = await repo.getTtpsForMapping(req.params.mappingId);
  res.json(ttps);
});

ttpMappingRouter.post('/', authenticate, requireRole('analyst'), async (req: Request, res: Response) => {
  const { ttp_id } = z.object({ ttp_id: z.string().uuid() }).parse(req.body);
  const assignment = await repo.assignTtpToMapping(req.params.mappingId, ttp_id, req.user!.sub);
  if (!assignment) {
    // Already assigned — return current list
    const ttps = await repo.getTtpsForMapping(req.params.mappingId);
    return res.json(ttps);
  }
  res.status(201).json(assignment);
});

ttpMappingRouter.delete('/:entityStageTtpId', authenticate, requireRole('analyst'), async (req: Request, res: Response) => {
  const deleted = await repo.removeTtpFromMapping(req.params.entityStageTtpId);
  if (!deleted) throw createError('TTP assignment not found', 404, 'NOT_FOUND');
  res.status(204).send();
});
