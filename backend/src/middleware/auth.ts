import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { JwtPayload } from '../types';
import { pool } from '../db/pool';

interface CacheEntry {
  deactivated: boolean;
  expires: number;
}

const deactivationCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 30_000;

async function isUserDeactivated(userId: string): Promise<boolean> {
  const now = Date.now();
  const cached = deactivationCache.get(userId);
  if (cached && cached.expires > now) return cached.deactivated;

  const result = await pool.query(
    'SELECT deactivated_at FROM users WHERE id = $1',
    [userId],
  );

  const deactivated = result.rows.length > 0 && result.rows[0].deactivated_at != null;
  deactivationCache.set(userId, { deactivated, expires: now + CACHE_TTL_MS });
  return deactivated;
}

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid authorization header', code: 'UNAUTHORIZED' });
    return;
  }
  const token = header.slice(7);
  let payload: JwtPayload;
  try {
    payload = jwt.verify(token, config.JWT_SECRET) as JwtPayload;
  } catch {
    res.status(401).json({ error: 'Invalid or expired token', code: 'TOKEN_INVALID' });
    return;
  }
  req.user = payload;

  // Await the deactivation check so response cannot be sent after headers are flushed.
  // Fail closed: if the DB is unreachable, reject the request rather than allowing through.
  isUserDeactivated(payload.sub).then((deactivated) => {
    if (deactivated) {
      res.status(401).json({ error: 'Account deactivated', code: 'ACCOUNT_DEACTIVATED' });
      return;
    }
    next();
  }).catch(() => {
    res.status(503).json({ error: 'Authentication service unavailable', code: 'SERVICE_UNAVAILABLE' });
  });
}
