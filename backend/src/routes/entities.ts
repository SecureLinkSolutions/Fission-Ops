import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { auditLog } from '../middleware/audit';
import { createEntitySchema } from '../schemas/entity';
import * as repo from '../repositories/entityRepository';
import * as incidentRepo from '../repositories/incidentRepository';

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
});

export default router;
