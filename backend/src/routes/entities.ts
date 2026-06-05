import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { auditLog } from '../middleware/audit';
import { createEntitySchema } from '../schemas/entity';
import * as repo from '../repositories/entityRepository';
import * as incidentRepo from '../repositories/incidentRepository';
import { runEnrichment } from '../services/enrichment/enrichmentService';
import { getEnrichmentHistory, recordEnrichment } from '../repositories/enrichmentHistoryRepository';
import * as checklistRepo from '../repositories/checklistRepository';
import { emitToIncident } from '../socket';
import { z } from 'zod';
import { pool } from '../db/pool';

const router = Router({ mergeParams: true });

router.get('/', authenticate, async (req: Request, res: Response) => {
  const entities = await repo.listEntitiesByIncident(req.params.incidentId);
  res.json(entities);
});

router.post('/', authenticate, requireRole('analyst'), auditLog('entity', 'CREATE'), async (req: Request, res: Response) => {
  const incident = await incidentRepo.getIncidentById(req.params.incidentId);
  if (!incident) {
    res.status(404).json({ error: 'Incident not found', code: 'NOT_FOUND' });
    return;
  }
  const body = createEntitySchema.parse(req.body);
  const entity = await repo.createEntity({ ...body, incident_id: req.params.incidentId, created_by: req.user!.sub });
  res.status(201).json(entity);
  // Fire-and-forget enrichment
  if (req.user!.org_id) {
    runEnrichment(entity.id, req.user!.org_id).catch(() => {});
  }
  emitToIncident(req.params.incidentId, 'entity:created', entity);
});


router.post('/:id/enrich', authenticate, requireRole('analyst'), async (req: Request, res: Response) => {
  const entity = await repo.getEntityById(req.params.id);
  if (!entity) {
    res.status(404).json({ error: 'Entity not found', code: 'NOT_FOUND' });
    return;
  }
  if (!req.user!.org_id) {
    res.status(400).json({ error: 'No org context', code: 'NO_ORG' });
    return;
  }
  // Run enrichment with triggered_by context via wrapping
  const triggeredBy = req.user!.sub;
  const triggeredByName = req.user!.email;
  runEnrichment(entity.id, req.user!.org_id, triggeredBy, triggeredByName).catch(() => {});
  res.json({ success: true });
});

router.get('/:id/enrichment-history', authenticate, async (req: Request, res: Response) => {
  const history = await getEnrichmentHistory(req.params.id);
  res.json(history);
});

export default router;

// Checklist routes
router.get('/:id/checklist', authenticate, async (req: Request, res: Response) => {
  const entityId = req.params.id;
  let items = await checklistRepo.getChecklist(entityId);
  if (items.length === 0) {
    // Auto-init from entity type defaults
    const entityResult = await pool.query('SELECT type FROM entities WHERE id = $1', [entityId]);
    if (entityResult.rowCount === 0) {
      res.status(404).json({ error: 'Entity not found', code: 'NOT_FOUND' });
      return;
    }
    const entityType = entityResult.rows[0].type as string;
    const defaults = checklistRepo.DEFAULT_CHECKLIST_ITEMS[entityType] ?? [];
    items = await checklistRepo.initChecklist(
      entityId,
      defaults,
      req.user!.sub,
      req.user!.email,
    );
  }
  res.json(items);
});

router.post('/:id/checklist', authenticate, requireRole('senior_analyst'), async (req: Request, res: Response) => {
  const { item_text } = z.object({ item_text: z.string().min(1) }).parse(req.body);
  const item = await checklistRepo.addCustomItem(
    req.params.id,
    item_text,
    req.user!.sub,
    req.user!.email,
  );
  res.status(201).json(item);
});

router.patch('/:id/checklist/:itemId', authenticate, requireRole('analyst'), async (req: Request, res: Response) => {
  const { checked } = z.object({ checked: z.boolean() }).parse(req.body);
  const item = await checklistRepo.checkItem(
    req.params.itemId,
    req.user!.sub,
    req.user!.email,
    checked,
  );
  if (!item) {
    res.status(404).json({ error: 'Item not found', code: 'NOT_FOUND' });
    return;
  }
  res.json(item);
});

router.delete('/:id/checklist/:itemId', authenticate, requireRole('senior_analyst'), async (req: Request, res: Response) => {
  const deleted = await checklistRepo.deleteCustomItem(req.params.itemId);
  if (!deleted) {
    res.status(404).json({ error: 'Item not found or not a custom item', code: 'NOT_FOUND' });
    return;
  }
  res.status(204).send();
});
