import { Router, Request, Response } from 'express';
import { config } from '../config';
import { createLicense, validateLicense, activateLicense, revokeLicense, getLicenseStatus } from '../services/licenseService';

const router = Router();

function requireAdminKey(req: Request, res: Response, next: () => void): void {
  const key = req.headers['x-admin-api-key'] || req.headers['admin-api-key'];
  if (key !== config.ADMIN_API_KEY) {
    res.status(401).json({ error: 'Invalid admin API key' });
    return;
  }
  next();
}

// POST /licenses/generate
router.post('/generate', requireAdminKey, async (req: Request, res: Response) => {
  const { org_name, org_email, tier, max_users, max_incidents, features, expires_days } = req.body;
  if (!org_name || !org_email || !tier || !expires_days) {
    res.status(400).json({ error: 'Missing required fields: org_name, org_email, tier, expires_days' });
    return;
  }
  const result = await createLicense({
    org_name, org_email,
    tier: tier as 'starter' | 'professional' | 'enterprise',
    max_users: max_users ?? 3,
    max_incidents: max_incidents ?? 10,
    features,
    expires_days: Number(expires_days),
  });
  res.json(result);
});

// POST /licenses/validate
router.post('/validate', async (req: Request, res: Response) => {
  const { license_key, fingerprint } = req.body;
  if (!license_key) {
    res.status(400).json({ error: 'license_key is required' });
    return;
  }
  const ip = req.ip ?? null;
  const result = await validateLicense(license_key, fingerprint ?? null, ip);
  res.json(result);
});

// POST /licenses/activate
router.post('/activate', async (req: Request, res: Response) => {
  const { license_key, fingerprint, org_name } = req.body;
  if (!license_key || !fingerprint) {
    res.status(400).json({ error: 'license_key and fingerprint are required' });
    return;
  }
  await activateLicense(license_key, fingerprint, org_name ?? '');
  res.json({ success: true });
});

// GET /licenses/:key/status
router.get('/:key/status', requireAdminKey, async (req: Request, res: Response) => {
  const status = await getLicenseStatus(req.params.key);
  res.json(status);
});

// POST /licenses/revoke
router.post('/revoke', requireAdminKey, async (req: Request, res: Response) => {
  const { license_key, reason } = req.body;
  if (!license_key) {
    res.status(400).json({ error: 'license_key is required' });
    return;
  }
  await revokeLicense(license_key, reason ?? '');
  res.json({ success: true });
});

export default router;
