import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { auditLog } from '../middleware/audit';
import { createIncidentSchema, updateIncidentSchema, listIncidentsQuerySchema } from '../schemas/incident';
import * as repo from '../repositories/incidentRepository';
import { getIncidentTimeline } from '../repositories/timelineRepository';
import * as assignRepo from '../repositories/userManagementRepository';

const router = Router();

router.get('/', authenticate, async (req: Request, res: Response) => {
  const query = listIncidentsQuerySchema.parse(req.query);
  const result = await repo.listIncidents({
    ...query,
    requestingUserId: req.user!.sub,
    requestingUserRole: req.user!.role,
  });
  res.json(result);
});

router.post(
  '/',
  authenticate,
  requireRole('analyst'),
  auditLog('incident', 'CREATE'),
  async (req: Request, res: Response) => {
    const body = createIncidentSchema.parse(req.body);
    const incident = await repo.createIncident({ ...body, created_by: req.user!.sub });
    res.status(201).json(incident);
  },
);

router.get('/:id', authenticate, async (req: Request, res: Response) => {
  const incident = await repo.getIncidentById(req.params.id);
  if (!incident) {
    res.status(404).json({ error: 'Incident not found', code: 'NOT_FOUND' });
    return;
  }
  res.json(incident);
});

router.put(
  '/:id',
  authenticate,
  requireRole('senior_analyst'),
  auditLog('incident', 'UPDATE'),
  async (req: Request, res: Response) => {
    const body = updateIncidentSchema.parse(req.body);
    const incident = await repo.updateIncident(req.params.id, body);
    if (!incident) {
      res.status(404).json({ error: 'Incident not found', code: 'NOT_FOUND' });
      return;
    }
    res.json(incident);
  },
);

router.delete(
  '/:id',
  authenticate,
  requireRole('incident_commander'),
  auditLog('incident', 'DELETE'),
  async (req: Request, res: Response) => {
    const incident = await repo.closeIncident(req.params.id);
    if (!incident) {
      res.status(404).json({ error: 'Incident not found', code: 'NOT_FOUND' });
      return;
    }
    res.json(incident);
  },
);

// Timeline endpoint
router.get('/:id/timeline', authenticate, async (req: Request, res: Response) => {
  const actionType = req.query.action_type as string | undefined;
  const userId = req.query.user_id as string | undefined;
  const entries = await getIncidentTimeline(req.params.id, actionType, userId);
  res.json(entries);
});

// Incident assignments
router.get('/:incidentId/assignments', authenticate, async (req: Request, res: Response) => {
  const assignments = await assignRepo.listIncidentAssignments(req.params.incidentId);
  res.json(assignments);
});

router.post(
  '/:incidentId/assignments',
  authenticate,
  requireRole('incident_commander'),
  async (req: Request, res: Response) => {
    const { user_id } = z.object({ user_id: z.string().uuid() }).parse(req.body);
    const assignment = await assignRepo.assignUserToIncident(
      req.params.incidentId,
      user_id,
      req.user!.sub,
    );
    res.status(201).json(assignment ?? { message: 'Already assigned' });
  },
);

router.delete(
  '/:incidentId/assignments/:userId',
  authenticate,
  requireRole('incident_commander'),
  async (req: Request, res: Response) => {
    await assignRepo.removeUserFromIncident(req.params.incidentId, req.params.userId);
    res.status(204).send();
  },
);

export default router;
