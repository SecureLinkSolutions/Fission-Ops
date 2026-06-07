import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import { pool } from '../db/pool';

const router = Router();

const searchQuerySchema = z.object({
  q: z.string().min(2, 'Query must be at least 2 characters'),
});

router.get('/', authenticate, async (req: Request, res: Response) => {
  const { q } = searchQuerySchema.parse(req.query);
  const pattern = `%${q}%`;
  const orgId = req.user!.org_id;

  const [incidentsResult, entitiesResult] = await Promise.all([
    pool.query<{
      id: string;
      title: string;
      severity: string;
      status: string;
      created_at: string;
    }>(
      `SELECT id, title, severity, status, created_at
       FROM incidents
       WHERE org_id = $2
         AND (title ILIKE $1 OR description ILIKE $1)
       ORDER BY created_at DESC
       LIMIT 10`,
      [pattern, orgId],
    ),
    pool.query<{
      id: string;
      incident_id: string;
      type: string;
      value: string;
      ioc_status: string | null;
      incident_title: string;
    }>(
      `SELECT e.id, e.incident_id, e.type, e.value, e.ioc_status, i.title AS incident_title
       FROM entities e
       JOIN incidents i ON i.id = e.incident_id
       WHERE i.org_id = $2
         AND e.value ILIKE $1
       ORDER BY e.created_at DESC
       LIMIT 10`,
      [pattern, orgId],
    ),
  ]);

  res.json({
    incidents: incidentsResult.rows,
    entities: entitiesResult.rows,
  });
});

export default router;
