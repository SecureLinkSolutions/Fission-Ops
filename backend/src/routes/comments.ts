import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import * as repo from '../repositories/commentRepository';

const router = Router({ mergeParams: true });

// GET /incidents/:incidentId/comments
router.get('/incidents/:incidentId/comments', authenticate, async (req: Request, res: Response) => {
  const comments = await repo.listForIncident(req.params.incidentId);
  res.json(comments);
});

// POST /incidents/:incidentId/comments
router.post('/incidents/:incidentId/comments', authenticate, async (req: Request, res: Response) => {
  const { body } = z.object({ body: z.string().min(1) }).parse(req.body);
  const comment = await repo.createComment({
    incident_id: req.params.incidentId,
    author_id: req.user!.sub,
    body,
    org_id: req.user!.org_id,
  });
  res.status(201).json(comment);
});

// GET /entities/:entityId/comments
router.get('/entities/:entityId/comments', authenticate, async (req: Request, res: Response) => {
  const comments = await repo.listForEntity(req.params.entityId);
  res.json(comments);
});

// POST /entities/:entityId/comments
router.post('/entities/:entityId/comments', authenticate, async (req: Request, res: Response) => {
  const { body } = z.object({ body: z.string().min(1) }).parse(req.body);
  const comment = await repo.createComment({
    entity_id: req.params.entityId,
    author_id: req.user!.sub,
    body,
    org_id: req.user!.org_id,
  });
  res.status(201).json(comment);
});

// PATCH /comments/:id
router.patch('/comments/:id', authenticate, async (req: Request, res: Response) => {
  const { body } = z.object({ body: z.string().min(1) }).parse(req.body);
  const comment = await repo.updateComment(req.params.id, body, req.user!.sub);
  if (!comment) {
    res.status(404).json({ error: 'Comment not found or not authorized', code: 'NOT_FOUND' });
    return;
  }
  res.json(comment);
});

// DELETE /comments/:id
router.delete('/comments/:id', authenticate, async (req: Request, res: Response) => {
  const deleted = await repo.deleteComment(req.params.id, req.user!.sub, req.user!.role);
  if (!deleted) {
    res.status(404).json({ error: 'Comment not found or not authorized', code: 'NOT_FOUND' });
    return;
  }
  res.status(204).send();
});

export default router;
