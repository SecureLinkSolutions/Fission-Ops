import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import * as repo from '../repositories/taskRepository';
import { pool } from '../db/pool';

const router = Router();

const taskSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  assignee_id: z.string().uuid().optional(),
  priority: z.enum(['critical', 'high', 'medium', 'low']).optional(),
  status: z.enum(['open', 'in_progress', 'complete']).optional(),
  due_date: z.string().optional(),
  entity_ids: z.array(z.string().uuid()).optional(),
});

async function setTaskEntities(taskId: string, entityIds: string[]) {
  await pool.query('DELETE FROM task_entities WHERE task_id = $1', [taskId]);
  for (const eid of entityIds) {
    await pool.query(
      'INSERT INTO task_entities (task_id, entity_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [taskId, eid],
    );
  }
}

async function getTaskEntities(taskId: string): Promise<{ id: string; type: string; value: string }[]> {
  const r = await pool.query(
    `SELECT e.id, e.type, e.value FROM entities e
     JOIN task_entities te ON te.entity_id = e.id
     WHERE te.task_id = $1 ORDER BY e.type, e.value`,
    [taskId],
  );
  return r.rows;
}

router.get('/incidents/:incidentId/tasks', authenticate, async (req: Request, res: Response) => {
  const tasks = await repo.listForIncident(req.params.incidentId);
  const withEntities = await Promise.all(
    tasks.map(async (t) => ({ ...t, entities: await getTaskEntities(t.id) })),
  );
  res.json(withEntities);
});

router.post('/incidents/:incidentId/tasks', authenticate, requireRole('senior_analyst'), async (req: Request, res: Response) => {
  const { entity_ids, ...body } = taskSchema.parse(req.body);
  const task = await repo.createTask({
    ...body,
    incident_id: req.params.incidentId,
    org_id: req.user!.org_id,
    created_by: req.user!.sub,
  });
  if (entity_ids?.length) await setTaskEntities(task.id, entity_ids);
  res.status(201).json({ ...task, entities: await getTaskEntities(task.id) });
});

router.patch('/incidents/:incidentId/tasks/:taskId', authenticate, async (req: Request, res: Response) => {
  const { entity_ids, ...body } = taskSchema.partial().parse(req.body);
  const task = await repo.updateTask(req.params.taskId, body);
  if (!task) {
    res.status(404).json({ error: 'Task not found', code: 'NOT_FOUND' });
    return;
  }
  if (entity_ids !== undefined) await setTaskEntities(task.id, entity_ids);
  res.json({ ...task, entities: await getTaskEntities(task.id) });
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

// Task comments
router.get('/incidents/:incidentId/tasks/:taskId/comments', authenticate, async (req, res) => {
  const result = await pool.query(
    `SELECT tc.*, u.email AS user_email, u.name AS user_name
     FROM task_comments tc JOIN users u ON u.id = tc.user_id
     WHERE tc.task_id = $1 ORDER BY tc.created_at ASC`,
    [req.params.taskId],
  );
  res.json(result.rows);
});

router.post('/incidents/:incidentId/tasks/:taskId/comments', authenticate, async (req, res) => {
  const { content } = z.object({ content: z.string().min(1) }).parse(req.body);
  const result = await pool.query(
    `INSERT INTO task_comments (task_id, user_id, content) VALUES ($1, $2, $3) RETURNING *`,
    [req.params.taskId, req.user!.sub, content],
  );
  res.status(201).json(result.rows[0]);
});

export default router;
