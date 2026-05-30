import { Request, Response, NextFunction } from 'express';
import { logAudit } from '../repositories/auditRepository';

export function auditLog(resourceType: string, action: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const originalJson = res.json.bind(res);
    res.json = (body) => {
      if (res.statusCode < 400) {
        logAudit({
          user_id: req.user?.sub,
          user_email: req.user?.email,
          action,
          resource_type: resourceType,
          resource_id: body?.id ?? req.params.id ?? req.params.entityId,
          new_values: ['CREATE', 'UPDATE'].includes(action) ? body : undefined,
          ip_address: req.ip,
        }).catch(() => {});
      }
      return originalJson(body);
    };
    next();
  };
}
