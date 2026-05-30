import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { pool } from '../db/pool';
import { runEnrichment } from '../services/enrichment/enrichmentService';

const router = Router();

router.post('/entities/:entityId/enrich', authenticate, async (req: Request, res: Response) => {
  const entityResult = await pool.query('SELECT * FROM entities WHERE id = $1', [req.params.entityId]);
  const entity = entityResult.rows[0];
  if (!entity) {
    res.status(404).json({ error: 'Entity not found', code: 'NOT_FOUND' });
    return;
  }

  const orgId = req.user!.org_id;
  if (!orgId) {
    res.status(400).json({ error: 'No org associated', code: 'NO_ORG' });
    return;
  }

  // Fire and forget
  runEnrichment(req.params.entityId, orgId).catch(() => {});
  res.status(202).json({ message: 'Enrichment started' });
});

router.get('/entities/:entityId/enrichment', authenticate, async (req: Request, res: Response) => {
  const result = await pool.query(
    'SELECT enrichment_status, enrichment_data, enrichment_updated_at FROM entities WHERE id = $1',
    [req.params.entityId],
  );
  if (!result.rows[0]) {
    res.status(404).json({ error: 'Entity not found', code: 'NOT_FOUND' });
    return;
  }
  res.json(result.rows[0]);
});

export default router;
