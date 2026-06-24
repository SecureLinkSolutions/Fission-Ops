import { Router, Request, Response } from 'express';
import { pool } from '../db/pool';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { getLicenseStatusResponse, validateWithServer, loadCachedLicense } from '../services/licenseService';
import { getDeploymentFingerprint } from '../services/fingerprintService';
import { config } from '../config';

const router = Router();

// GET /license/status — no auth required (frontend polls this)
router.get('/status', async (_req: Request, res: Response) => {
  try {
    const status = await getLicenseStatusResponse();
    res.json(status);
  } catch (err) {
    res.json({
      tier: 'starter',
      features: [],
      max_users: 3,
      max_incidents: 10,
      expires_at: null,
      grace_mode: false,
      grace_mode_expired: false,
      fingerprint_warning: false,
      validated_ok: false,
      license_key: null,
    });
  }
});

// POST /license/activate — requires incident_commander+
router.post('/activate', authenticate, requireRole('incident_commander'), async (req: Request, res: Response) => {
  const { license_key } = req.body;
  if (!license_key) {
    res.status(400).json({ error: 'license_key is required' });
    return;
  }

  try {
    const fingerprint = await getDeploymentFingerprint();
    const licenseServerUrl = config.LICENSE_SERVER_URL ?? 'http://license-server:3002';

    const response = await fetch(`${licenseServerUrl}/licenses/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ license_key, fingerprint }),
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Validation failed' }));
      res.status(400).json({ error: (err as { error: string }).error ?? 'License validation failed' });
      return;
    }

    const data = await response.json() as {
      valid: boolean;
      tier: string;
      max_users: number;
      max_incidents: number;
      features: string[];
      expires_at: string;
      fingerprint_warning?: boolean;
    };

    // Store validated license in cache
    await pool.query(`
      UPDATE license_cache SET
        license_key = $1,
        tier = $2,
        max_users = $3,
        max_incidents = $4,
        features = $5,
        expires_at = $6,
        last_validated_at = NOW(),
        fingerprint_warning = $7,
        grace_mode = FALSE,
        grace_started_at = NULL,
        validated_ok = TRUE
      WHERE id = 1
    `, [
      license_key,
      data.tier,
      data.max_users,
      data.max_incidents,
      JSON.stringify(data.features),
      data.expires_at,
      data.fingerprint_warning ?? false,
    ]);

    await loadCachedLicense();

    const status = await getLicenseStatusResponse();
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message ?? 'Activation failed' });
  }
});

// GET /license/public-key — returns license server public key
router.get('/public-key', async (_req: Request, res: Response) => {
  try {
    const licenseServerUrl = config.LICENSE_SERVER_URL ?? 'http://license-server:3002';
    const response = await fetch(`${licenseServerUrl}/public-key`, {
      signal: AbortSignal.timeout(5000),
    });
    const data = await response.json() as { public_key: string };
    res.json(data);
  } catch {
    res.status(503).json({ error: 'License server unavailable' });
  }
});

export default router;
