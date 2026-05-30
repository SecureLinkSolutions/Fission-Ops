import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { queryAuditLogs } from '../repositories/auditRepository';

const router = Router();

const querySchema = z.object({
  user_id: z.string().optional(),
  action: z.string().optional(),
  resource_type: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(50),
});

router.get('/', authenticate, requireRole('incident_commander'), async (req: Request, res: Response) => {
  const opts = querySchema.parse(req.query);
  const result = await queryAuditLogs(opts);
  res.json(result);
});

export default router;
