import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import * as repo from '../repositories/taskRepository';

const router = Router();

const taskSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  assignee_id: z.string().uuid().optional(),
  priority: z.enum(['critical', 'high', 'medium', 'low']).optional(),
  status: z.enum(['open', 'in_progress', 'complete']).optional(),
  due_date: z.string().optional(),
});

router.get('/incidents/:incidentId/tasks', authenticate, async (req: Request, res: Response) => {
  const tasks = await repo.listForIncident(req.params.incidentId);
  res.json(tasks);
});

router.post('/incidents/:incidentId/tasks', authenticate, requireRole('senior_analyst'), async (req: Request, res: Response) => {
  const body = taskSchema.parse(req.body);
  const task = await repo.createTask({
    ...body,
    incident_id: req.params.incidentId,
    org_id: req.user!.org_id,
    created_by: req.user!.sub,
  });
  res.status(201).json(task);
});

router.patch('/incidents/:incidentId/tasks/:taskId', authenticate, async (req: Request, res: Response) => {
  const body = taskSchema.partial().parse(req.body);
  const task = await repo.updateTask(req.params.taskId, body);
  if (!task) {
    res.status(404).json({ error: 'Task not found', code: 'NOT_FOUND' });
    return;
  }
  res.json(task);
});

router.delete('/incidents/:incidentId/tasks/:taskId', authenticate, requireRole('senior_analyst'), async (req: Request, res: Response) => {
  const deleted = await repo.deleteTask(req.params.taskId);
  if (!deleted) {
    res.status(404).json({ error: 'Task not found', code: 'NOT_FOUND' });
    return;
  }
  res.status(204).send();
});

router.get('/tasks/mine', authenticate, async (req: Request, res: Response) => {
  const tasks = await repo.listForUser(req.user!.sub);
  res.json(tasks);
});

export default router;
