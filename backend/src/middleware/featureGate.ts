import { Request, Response, NextFunction } from 'express';
import { isFeatureEnabled } from '../services/licenseService';

export function requireFeature(feature: string) {
  return (_req: Request, res: Response, next: NextFunction): void => {
    if (isFeatureEnabled(feature)) {
      next();
      return;
    }
    res.status(402).json({
      error: 'Feature not available on your current license tier',
      code: 'FEATURE_GATED',
      feature,
      upgrade_required: true,
    });
  };
}
