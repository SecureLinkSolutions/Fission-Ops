import { Request, Response, NextFunction } from 'express';
import { UserRole } from '../types';

export const ROLE_RANK: Record<UserRole, number> = {
  analyst: 1,
  senior_analyst: 2,
  incident_commander: 3,
  super_admin: 99,
};

export function requireRole(minRole: UserRole) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const userRole = req.user?.role;
    if (!userRole || ROLE_RANK[userRole] < ROLE_RANK[minRole]) {
      res.status(403).json({ error: 'Insufficient permissions', code: 'FORBIDDEN' });
      return;
    }
    next();
  };
}
