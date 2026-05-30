import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import * as orgRepo from '../repositories/organizationRepository';

const router = Router();

// GET /organizations/me — any authenticated user gets their own org
router.get('/me', authenticate, async (req: Request, res: Response) => {
  const orgId = req.user!.org_id;
  if (!orgId) {
    res.status(400).json({ error: 'No organization associated with this account', code: 'NO_ORG' });
    return;
  }
  const org = await orgRepo.getOrganizationById(orgId);
  if (!org) {
    res.status(404).json({ error: 'Organization not found', code: 'NOT_FOUND' });
    return;
  }
  const stats = await orgRepo.getOrgStats(orgId);
  res.json({ ...org, stats });
});

// PATCH /organizations/me — incident_commander can update their org name
router.patch('/me', authenticate, requireRole('incident_commander'), async (req: Request, res: Response) => {
  const orgId = req.user!.org_id;
  if (!orgId) {
    res.status(400).json({ error: 'No organization associated with this account', code: 'NO_ORG' });
    return;
  }
  const { name } = z.object({ name: z.string().min(1) }).parse(req.body);
  const result = await (async () => {
    const { pool } = await import('../db/pool');
    const r = await pool.query(
      `UPDATE organizations SET name = $1 WHERE id = $2 RETURNING *`,
      [name, orgId],
    );
    return r.rows[0] ?? null;
  })();
  if (!result) {
    res.status(404).json({ error: 'Organization not found', code: 'NOT_FOUND' });
    return;
  }
  res.json(result);
});

// GET /organizations — super_admin only: list all orgs
router.get('/', authenticate, requireRole('super_admin'), async (_req: Request, res: Response) => {
  const orgs = await orgRepo.listOrganizations();
  res.json(orgs);
});

// POST /organizations — super_admin only: create org
router.post('/', authenticate, requireRole('super_admin'), async (req: Request, res: Response) => {
  const schema = z.object({
    name: z.string().min(1),
    slug: z.string().regex(/^[a-z0-9-]+$/, 'Slug must only contain lowercase letters, numbers, and hyphens'),
    tier: z.enum(['standard', 'enterprise']).default('standard'),
  });
  const data = schema.parse(req.body);
  const existing = await orgRepo.getOrganizationBySlug(data.slug);
  if (existing) {
    res.status(409).json({ error: 'Slug already taken', code: 'SLUG_TAKEN' });
    return;
  }
  const org = await orgRepo.createOrganization(data);
  res.status(201).json(org);
});

// GET /organizations/:id — super_admin only: get org with stats
router.get('/:id', authenticate, requireRole('super_admin'), async (req: Request, res: Response) => {
  const org = await orgRepo.getOrganizationById(req.params.id);
  if (!org) {
    res.status(404).json({ error: 'Organization not found', code: 'NOT_FOUND' });
    return;
  }
  const stats = await orgRepo.getOrgStats(org.id);
  res.json({ ...org, stats });
});

// PATCH /organizations/:id/deactivate — super_admin only
router.patch('/:id/deactivate', authenticate, requireRole('super_admin'), async (req: Request, res: Response) => {
  const org = await orgRepo.deactivateOrganization(req.params.id);
  if (!org) {
    res.status(404).json({ error: 'Organization not found', code: 'NOT_FOUND' });
    return;
  }
  res.json(org);
});

// PATCH /organizations/:id/reactivate — super_admin only
router.patch('/:id/reactivate', authenticate, requireRole('super_admin'), async (req: Request, res: Response) => {
  const org = await orgRepo.reactivateOrganization(req.params.id);
  if (!org) {
    res.status(404).json({ error: 'Organization not found', code: 'NOT_FOUND' });
    return;
  }
  res.json(org);
});

// GET /organizations/me/api-keys — list org API keys (masked)
router.get('/me/api-keys', authenticate, requireRole('incident_commander'), async (req: Request, res: Response) => {
  const orgId = req.user!.org_id;
  if (!orgId) { res.status(400).json({ error: 'No org', code: 'NO_ORG' }); return; }
  const { pool } = await import('../db/pool');
  const result = await pool.query(
    `SELECT id, service, LEFT(api_key, 4) || '****' AS api_key_masked, created_at FROM org_api_keys WHERE org_id = $1`,
    [orgId],
  );
  res.json(result.rows);
});

// PUT /organizations/me/api-keys/:service — upsert key
router.put('/me/api-keys/:service', authenticate, requireRole('incident_commander'), async (req: Request, res: Response) => {
  const orgId = req.user!.org_id;
  if (!orgId) { res.status(400).json({ error: 'No org', code: 'NO_ORG' }); return; }
  const service = z.enum(['virustotal', 'abuseipdb', 'shodan']).parse(req.params.service);
  const { api_key } = z.object({ api_key: z.string().min(1) }).parse(req.body);
  const { pool } = await import('../db/pool');
  await pool.query(
    `INSERT INTO org_api_keys (org_id, service, api_key)
     VALUES ($1, $2, $3)
     ON CONFLICT (org_id, service) DO UPDATE SET api_key = EXCLUDED.api_key`,
    [orgId, service, api_key],
  );
  res.json({ ok: true });
});

// DELETE /organizations/me/api-keys/:service
router.delete('/me/api-keys/:service', authenticate, requireRole('incident_commander'), async (req: Request, res: Response) => {
  const orgId = req.user!.org_id;
  if (!orgId) { res.status(400).json({ error: 'No org', code: 'NO_ORG' }); return; }
  const { pool } = await import('../db/pool');
  await pool.query('DELETE FROM org_api_keys WHERE org_id = $1 AND service = $2', [orgId, req.params.service]);
  res.status(204).send();
});

export default router;
