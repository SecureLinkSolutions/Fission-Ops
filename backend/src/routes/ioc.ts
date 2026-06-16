import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import { ROLE_RANK } from '../middleware/rbac';
import { pool } from '../db/pool';
import { createNotification } from '../repositories/notificationRepository';
import { sendEmail } from '../services/emailService';
import { emitToIncident } from '../socket';
import { recordCustody } from '../repositories/custodyRepository';

const router = Router();

router.patch('/entities/:entityId/ioc-status', authenticate, async (req: Request, res: Response) => {
  const schema = z.object({
    status: z.enum(['suspected', 'confirmed', 'cleared', 'false_positive']),
    notes: z.string().optional(),
  });
  const { status, notes } = schema.parse(req.body);
  const userRole = req.user!.role;

  // Analysts can only set suspected or false_positive
  if (status !== 'suspected' && status !== 'false_positive' && ROLE_RANK[userRole] < ROLE_RANK['senior_analyst']) {
    res.status(403).json({ error: 'Insufficient permissions to set this IOC status', code: 'FORBIDDEN' });
    return;
  }

  const result = await pool.query(
    `UPDATE entities
     SET ioc_status = $1, ioc_flagged_by = $2, ioc_flagged_at = NOW(), ioc_notes = $3
     WHERE id = $4
     RETURNING *`,
    [status, req.user!.sub, notes ?? null, req.params.entityId],
  );
  const entity = result.rows[0];
  if (!entity) {
    res.status(404).json({ error: 'Entity not found', code: 'NOT_FOUND' });
    return;
  }

  if (status === 'confirmed' && entity.incident_id) {
    // Notify all incident assignees
    const assignees = await pool.query(
      `SELECT u.id, u.email, u.org_id FROM incident_assignments ia
       JOIN users u ON u.id = ia.user_id
       WHERE ia.incident_id = $1`,
      [entity.incident_id],
    );
    for (const assignee of assignees.rows) {
      await createNotification({
        user_id: assignee.id,
        org_id: assignee.org_id,
        type: 'ioc_confirmed',
        title: `IOC Confirmed: ${entity.value}`,
        body: notes,
        incident_id: entity.incident_id,
        entity_id: entity.id,
      }).catch(() => {});

      await sendEmail(
        assignee.email,
        `[Fission Ops] IOC Confirmed: ${entity.value}`,
        `An IOC has been confirmed in your incident.\nEntity: ${entity.value}\nNotes: ${notes ?? 'N/A'}`,
      ).catch(() => {});
    }

    emitToIncident(entity.incident_id, 'ioc:confirmed', { entityId: entity.id, value: entity.value });
  }

  res.json(entity);
  recordCustody({
    entity_id: req.params.entityId,
    incident_id: entity.incident_id,
    action: 'ioc_status_changed',
    actor_id: req.user!.sub,
    actor_name: req.user!.email,
    actor_role: req.user!.role,
    actor_ip: req.ip,
    details: { new_status: status, notes },
  }).catch(() => {});
});

export default router;
