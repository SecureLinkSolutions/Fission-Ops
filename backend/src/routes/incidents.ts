import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { createIncidentSchema, updateIncidentSchema, listIncidentsQuerySchema } from '../schemas/incident';
import * as repo from '../repositories/incidentRepository';

const router = Router();

router.get('/', authenticate, async (req: Request, res: Response) => {
  const query = listIncidentsQuerySchema.parse(req.query);
  const result = await repo.listIncidents(query);
  res.json(result);
});

router.post('/', authenticate, requireRole('analyst'), async (req: Request, res: Response) => {
  const body = createIncidentSchema.parse(req.body);
  const incident = await repo.createIncident({ ...body, created_by: req.user!.sub });
  res.status(201).json(incident);
});

router.get('/:id', authenticate, async (req: Request, res: Response) => {
  const incident = await repo.getIncidentById(req.params.id);
  if (!incident) {
    res.status(404).json({ error: 'Incident not found', code: 'NOT_FOUND' });
    return;
  }
  res.json(incident);
});

router.put('/:id', authenticate, requireRole('senior_analyst'), async (req: Request, res: Response) => {
  const body = updateIncidentSchema.parse(req.body);
  const incident = await repo.updateIncident(req.params.id, body);
  if (!incident) {
    res.status(404).json({ error: 'Incident not found', code: 'NOT_FOUND' });
    return;
  }
  res.json(incident);
});

router.delete('/:id', authenticate, requireRole('incident_commander'), async (req: Request, res: Response) => {
  const incident = await repo.closeIncident(req.params.id);
  if (!incident) {
    res.status(404).json({ error: 'Incident not found', code: 'NOT_FOUND' });
    return;
  }
  res.json(incident);
});

export default router;
