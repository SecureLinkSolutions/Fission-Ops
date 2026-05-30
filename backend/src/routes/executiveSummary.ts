import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { pool } from '../db/pool';

const router = Router();

router.get('/incidents/:id/executive-summary', authenticate, async (req: Request, res: Response) => {
  const result = await pool.query(
    'SELECT * FROM incident_executive_summaries WHERE incident_id = $1',
    [req.params.id],
  );
  res.json(result.rows[0] ?? null);
});

const summarySchema = z.object({
  overview: z.string().optional(),
  attack_timeline: z.string().optional(),
  business_impact: z.string().optional(),
  key_findings: z.string().optional(),
  remediation: z.string().optional(),
  risk_rating: z.enum(['low', 'medium', 'high', 'critical']).optional(),
});

router.put('/incidents/:id/executive-summary', authenticate, requireRole('senior_analyst'), async (req: Request, res: Response) => {
  const body = summarySchema.parse(req.body);
  const result = await pool.query(
    `INSERT INTO incident_executive_summaries
       (incident_id, overview, attack_timeline, business_impact, key_findings, remediation, risk_rating, updated_by, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
     ON CONFLICT (incident_id) DO UPDATE SET
       overview = EXCLUDED.overview,
       attack_timeline = EXCLUDED.attack_timeline,
       business_impact = EXCLUDED.business_impact,
       key_findings = EXCLUDED.key_findings,
       remediation = EXCLUDED.remediation,
       risk_rating = EXCLUDED.risk_rating,
       updated_by = EXCLUDED.updated_by,
       updated_at = NOW()
     RETURNING *`,
    [
      req.params.id,
      body.overview ?? null,
      body.attack_timeline ?? null,
      body.business_impact ?? null,
      body.key_findings ?? null,
      body.remediation ?? null,
      body.risk_rating ?? null,
      req.user!.sub,
    ],
  );
  res.json(result.rows[0]);
});

export default router;
