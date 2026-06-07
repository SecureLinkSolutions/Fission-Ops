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

// Returns the orgId to use for scoping queries (undefined for super_admin = no filter).
// Call at the start of any endpoint that accepts an incidentId path param.
// Returns null if the incident doesn't belong to the user's org (caller should 404).
async function resolveOrgId(
  incidentId: string,
  userRole: string,
  userOrgId: string | undefined,
): Promise<{ orgId: string | undefined } | null> {
  if (userRole === 'super_admin') return { orgId: undefined };
  const incident = await repo.getIncidentById(incidentId, userOrgId);
  if (!incident) return null;
  return { orgId: userOrgId };
}

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
  const scope = await resolveOrgId(req.params.id, req.user!.role, req.user!.org_id);
  if (!scope) { res.status(404).json({ error: 'Incident not found', code: 'NOT_FOUND' }); return; }
  const actionType = req.query.action_type as string | undefined;
  const userId = req.query.user_id as string | undefined;
  const entries = await getIncidentTimeline(req.params.id, actionType, userId);
  res.json(entries);
});

// Incident assignments
router.get('/:incidentId/assignments', authenticate, async (req: Request, res: Response) => {
  const scope = await resolveOrgId(req.params.incidentId, req.user!.role, req.user!.org_id);
  if (!scope) { res.status(404).json({ error: 'Incident not found', code: 'NOT_FOUND' }); return; }
  const assignments = await assignRepo.listIncidentAssignments(req.params.incidentId);
  res.json(assignments);
});

router.post(
  '/:incidentId/assignments',
  authenticate,
  requireRole('incident_commander'),
  async (req: Request, res: Response) => {
    const scope = await resolveOrgId(req.params.incidentId, req.user!.role, req.user!.org_id);
    if (!scope) { res.status(404).json({ error: 'Incident not found', code: 'NOT_FOUND' }); return; }
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
    const scope = await resolveOrgId(req.params.incidentId, req.user!.role, req.user!.org_id);
    if (!scope) { res.status(404).json({ error: 'Incident not found', code: 'NOT_FOUND' }); return; }
    await assignRepo.removeUserFromIncident(req.params.incidentId, req.params.userId);
    res.status(204).send();
  },
);


// Remediation routes
import * as remediationRepo from '../repositories/remediationRepository';

router.get('/:id/remediation/progress', authenticate, async (req: Request, res: Response) => {
  const scope = await resolveOrgId(req.params.id, req.user!.role, req.user!.org_id);
  if (!scope) { res.status(404).json({ error: 'Incident not found', code: 'NOT_FOUND' }); return; }
  const progress = await remediationRepo.getRemediationProgress(req.params.id);
  res.json(progress);
});

router.get('/:id/remediation', authenticate, async (req: Request, res: Response) => {
  const scope = await resolveOrgId(req.params.id, req.user!.role, req.user!.org_id);
  if (!scope) { res.status(404).json({ error: 'Incident not found', code: 'NOT_FOUND' }); return; }
  const items = await remediationRepo.listRemediationItems(req.params.id);
  res.json(items);
});

router.post(
  '/:id/remediation',
  authenticate,
  requireRole('senior_analyst'),
  async (req: Request, res: Response) => {
    const scope = await resolveOrgId(req.params.id, req.user!.role, req.user!.org_id);
    if (!scope) { res.status(404).json({ error: 'Incident not found', code: 'NOT_FOUND' }); return; }
    const body = z.object({
      title: z.string().min(1),
      description: z.string().optional(),
      entity_id: z.string().uuid().optional(),
      assignee_id: z.string().uuid().optional(),
      assignee_name: z.string().optional(),
    }).parse(req.body);
    const item = await remediationRepo.createRemediationItem({
      ...body,
      incident_id: req.params.id,
      created_by: req.user!.sub,
      created_by_name: req.user!.email ?? '',
    });
    res.status(201).json(item);
  },
);

router.patch(
  '/:id/remediation/:itemId',
  authenticate,
  async (req: Request, res: Response) => {
    const scope = await resolveOrgId(req.params.id, req.user!.role, req.user!.org_id);
    if (!scope) { res.status(404).json({ error: 'Incident not found', code: 'NOT_FOUND' }); return; }
    const userRank = (req.user!.role === 'super_admin' ? 99 : ['analyst', 'senior_analyst', 'incident_commander'].indexOf(req.user!.role));
    const isSeniorPlus = req.user!.role === 'super_admin' || ['senior_analyst', 'incident_commander'].includes(req.user!.role);
    const body = z.object({
      status: z.enum(['pending', 'in_progress', 'completed', 'verified']).optional(),
      before_state: z.string().optional(),
      after_state: z.string().optional(),
      assignee_id: z.string().uuid().optional().nullable(),
      assignee_name: z.string().optional(),
      verified_by: z.string().uuid().optional(),
      verified_by_name: z.string().optional(),
    }).parse(req.body);

    // Only senior_analyst+ can change assignee
    if ((body.assignee_id !== undefined || body.assignee_name !== undefined) && !isSeniorPlus) {
      res.status(403).json({ error: 'Insufficient permissions to change assignee' });
      return;
    }
    // Only incident_commander+ can verify
    if (body.status === 'verified' && req.user!.role !== 'incident_commander' && req.user!.role !== 'super_admin') {
      res.status(403).json({ error: 'Insufficient permissions to verify items' });
      return;
    }

    const updateData: Parameters<typeof remediationRepo.updateRemediationItem>[1] = {};
    if (body.status !== undefined) updateData.status = body.status;
    if (body.before_state !== undefined) updateData.before_state = body.before_state;
    if (body.after_state !== undefined) updateData.after_state = body.after_state;
    if (body.assignee_id !== undefined) updateData.assignee_id = body.assignee_id ?? undefined;
    if (body.assignee_name !== undefined) updateData.assignee_name = body.assignee_name;
    if (body.status === 'verified') {
      updateData.verified_by = req.user!.sub;
      updateData.verified_by_name = req.user!.email ?? '';
    }

    const item = await remediationRepo.updateRemediationItem(req.params.itemId, updateData);
    if (!item) {
      res.status(404).json({ error: 'Remediation item not found' });
      return;
    }
    res.json(item);
  },
);

export default router;

// Checklist summary for all entities in an incident
router.get('/:id/checklist-summary', authenticate, async (req: Request, res: Response) => {
  const scope = await resolveOrgId(req.params.id, req.user!.role, req.user!.org_id);
  if (!scope) { res.status(404).json({ error: 'Incident not found', code: 'NOT_FOUND' }); return; }
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

// Activity heatmap endpoint
router.get('/:id/activity-heatmap', authenticate, async (req: Request, res: Response) => {
  const { pool } = await import('../db/pool');
  const incidentId = req.params.id;

  // Get incident start — scoped to org
  const orgFilter = req.user!.role === 'super_admin' ? '' : ' AND org_id = $2';
  const incParams: unknown[] = [incidentId];
  if (req.user!.role !== 'super_admin') incParams.push(req.user!.org_id);
  const incResult = await pool.query<{ created_at: Date }>(
    `SELECT created_at FROM incidents WHERE id = $1${orgFilter}`,
    incParams,
  );
  if (incResult.rowCount === 0) {
    res.status(404).json({ error: 'Incident not found', code: 'NOT_FOUND' });
    return;
  }
  const incidentStart = incResult.rows[0].created_at;
  const incidentEnd = new Date();
  const durationDays = (incidentEnd.getTime() - incidentStart.getTime()) / (1000 * 60 * 60 * 24);

  let bucketSize: 'hour' | '6hour' | 'day';
  if (durationDays < 2) {
    bucketSize = 'hour';
  } else if (durationDays < 14) {
    bucketSize = '6hour';
  } else {
    bucketSize = 'day';
  }

  const bucketExpr = bucketSize === '6hour'
    ? `date_trunc('hour', ts) - (EXTRACT(HOUR FROM ts)::int % 6) * INTERVAL '1 hour'`
    : bucketSize === 'hour'
      ? `date_trunc('hour', ts)`
      : `date_trunc('day', ts)`;

  const eventsQuery = await pool.query<{ bucket: Date; action_type: string; cnt: string }>(
    `WITH events AS (
      SELECT e.created_at AS ts, 'ENTITY_CREATED' AS action_type
      FROM entities e WHERE e.incident_id = $1
      UNION ALL
      SELECT ekm.mapped_at, 'KILL_CHAIN_MAPPED'
      FROM entity_kill_chain_mappings ekm
      JOIN entities e ON e.id = ekm.entity_id
      WHERE e.incident_id = $1
      UNION ALL
      SELECT est.created_at, 'TTP_ASSIGNED'
      FROM entity_stage_ttps est
      JOIN entity_kill_chain_mappings ekm ON ekm.id = est.kill_chain_mapping_id
      JOIN entities e ON e.id = ekm.entity_id
      WHERE e.incident_id = $1
      UNION ALL
      SELECT er.created_at, 'RELATIONSHIP_CREATED'
      FROM entity_relationships er
      WHERE er.incident_id = $1
      UNION ALL
      SELECT al.created_at, CASE
        WHEN al.action IN ('CREATE', 'UPDATE') THEN 'STATUS_CHANGED'
        ELSE 'OTHER'
      END
      FROM audit_logs al
      WHERE al.resource_type = 'incident' AND al.resource_id = $1
    )
    SELECT ${bucketExpr} AS bucket, action_type, COUNT(*)::text AS cnt
    FROM events
    GROUP BY bucket, action_type
    ORDER BY bucket`,
    [incidentId],
  );

  type TypeKey = 'ENTITY_CREATED' | 'KILL_CHAIN_MAPPED' | 'TTP_ASSIGNED' | 'RELATIONSHIP_CREATED' | 'IOC_FLAGGED' | 'STATUS_CHANGED' | 'OTHER';
  const typeKeys: TypeKey[] = ['ENTITY_CREATED', 'KILL_CHAIN_MAPPED', 'TTP_ASSIGNED', 'RELATIONSHIP_CREATED', 'IOC_FLAGGED', 'STATUS_CHANGED', 'OTHER'];
  const emptyByType = (): Record<TypeKey, number> => Object.fromEntries(typeKeys.map((k) => [k, 0])) as Record<TypeKey, number>;

  const bucketMap = new Map<string, { bucket_start: Date; by_type: Record<TypeKey, number>; count: number }>();
  for (const row of eventsQuery.rows) {
    const key = new Date(row.bucket).toISOString();
    if (!bucketMap.has(key)) {
      bucketMap.set(key, { bucket_start: new Date(row.bucket), by_type: emptyByType(), count: 0 });
    }
    const bucket = bucketMap.get(key)!;
    const typeKey: TypeKey = typeKeys.includes(row.action_type as TypeKey) ? (row.action_type as TypeKey) : 'OTHER';
    bucket.by_type[typeKey] += Number(row.cnt);
    bucket.count += Number(row.cnt);
  }

  const buckets: Array<{ bucket_start: string; count: number; by_type: Record<TypeKey, number> }> = [];
  const typeTotals = emptyByType();

  let cursor = new Date(incidentStart);
  if (bucketSize === 'hour') {
    cursor.setMinutes(0, 0, 0);
  } else if (bucketSize === '6hour') {
    cursor.setMinutes(0, 0, 0);
    cursor.setHours(Math.floor(cursor.getHours() / 6) * 6);
  } else {
    cursor.setHours(0, 0, 0, 0);
  }

  while (cursor <= incidentEnd) {
    const key = cursor.toISOString();
    const existing = bucketMap.get(key);
    const by_type = existing ? existing.by_type : emptyByType();
    const count = existing ? existing.count : 0;
    buckets.push({ bucket_start: cursor.toISOString(), count, by_type });
    for (const k of typeKeys) typeTotals[k] += by_type[k];

    const next = new Date(cursor);
    if (bucketSize === 'hour') next.setHours(next.getHours() + 1);
    else if (bucketSize === '6hour') next.setHours(next.getHours() + 6);
    else next.setDate(next.getDate() + 1);
    cursor = next;
  }

  res.json({
    bucket_size: bucketSize,
    incident_start: incidentStart.toISOString(),
    incident_end: incidentEnd.toISOString(),
    buckets,
    type_totals: typeTotals,
  });
});
