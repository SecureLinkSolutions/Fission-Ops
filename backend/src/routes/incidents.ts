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
  const isSuperAdmin = req.user!.role === 'super_admin';
  // Super admin can pass ?org_id= to inspect a specific org; otherwise no org filter
  const orgId = isSuperAdmin
    ? (req.query.org_id as string | undefined)
    : req.user!.org_id;
  const result = await repo.listIncidents({
    ...query,
    requestingUserId: req.user!.sub,
    requestingUserRole: req.user!.role,
    orgId,
  });
  res.json(result);
});

router.post(
  '/',
  authenticate,
  requireRole('incident_commander'),
  auditLog('incident', 'CREATE'),
  async (req: Request, res: Response) => {
    const body = createIncidentSchema.parse(req.body);
    const incident = await repo.createIncident({ ...body, created_by: req.user!.sub, org_id: req.user!.org_id });
    res.status(201).json(incident);
  },
);

router.get('/:id', authenticate, async (req: Request, res: Response) => {
  const isSuperAdmin = req.user!.role === 'super_admin';
  const orgId = isSuperAdmin ? undefined : req.user!.org_id;
  const incident = await repo.getIncidentById(req.params.id, orgId);
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
    const isSuperAdmin = req.user!.role === 'super_admin';
    const orgId = isSuperAdmin ? undefined : req.user!.org_id;
    const incident = await repo.updateIncident(req.params.id, body, orgId);
    if (!incident) {
      res.status(404).json({ error: 'Incident not found', code: 'NOT_FOUND' });
      return;
    }
    res.json(incident);
  },
);

router.patch(
  '/:id',
  authenticate,
  requireRole('incident_commander'),
  auditLog('incident', 'UPDATE'),
  async (req: Request, res: Response) => {
    const body = updateIncidentSchema.parse(req.body);
    const isSuperAdmin = req.user!.role === 'super_admin';
    const orgId = isSuperAdmin ? undefined : req.user!.org_id;
    const incident = await repo.updateIncident(req.params.id, body, orgId);
    if (!incident) {
      res.status(404).json({ error: 'Incident not found', code: 'NOT_FOUND' });
      return;
    }
    res.json(incident);
  },
);

router.patch(
  '/:id/incident-status',
  authenticate,
  requireRole('senior_analyst'),
  async (req: Request, res: Response) => {
    const { incident_status } = z.object({
      incident_status: z.enum(['active', 'contained', 'eradicated', 'recovered', 'closed']),
    }).parse(req.body);
    const isSuperAdmin = req.user!.role === 'super_admin';
    const orgId = isSuperAdmin ? undefined : req.user!.org_id;
    const incident = await repo.updateIncidentOperationalStatus(req.params.id, incident_status, req.user!.sub, orgId);
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
    const isSuperAdmin = req.user!.role === 'super_admin';
    const orgId = isSuperAdmin ? undefined : req.user!.org_id;
    const incident = await repo.closeIncident(req.params.id, orgId);
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

// Checklist summary for all entities in an incident
router.get('/:id/checklist-summary', authenticate, async (req: Request, res: Response) => {
  const result = await (await import('../db/pool')).pool.query(
    `SELECT ec.entity_id,
            COUNT(*) AS total,
            SUM(CASE WHEN ec.checked THEN 1 ELSE 0 END) AS checked
     FROM entity_checklists ec
     JOIN entities e ON e.id = ec.entity_id
     WHERE e.incident_id = $1
     GROUP BY ec.entity_id`,
    [req.params.id],
  );
  res.json(result.rows.map((r) => ({
    entity_id: r.entity_id,
    total: Number(r.total),
    checked: Number(r.checked),
  })));
});
