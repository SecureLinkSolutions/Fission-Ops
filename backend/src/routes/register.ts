import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { pool } from '../db/pool';
import { config } from '../config';
import { getOrganizationBySlug, createOrganization } from '../repositories/organizationRepository';

const router = Router();

const registerSchema = z.object({
  orgName: z.string().min(1, 'Organization name is required'),
  orgSlug: z.string().regex(/^[a-z0-9-]+$/, 'Slug must only contain lowercase letters, numbers, and hyphens'),
  email: z.string().email('Valid email is required'),
  name: z.string().min(1, 'Full name is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

router.post('/', async (req: Request, res: Response) => {
  const body = registerSchema.parse(req.body);

  // Check slug uniqueness
  const existingOrg = await getOrganizationBySlug(body.orgSlug);
  if (existingOrg) {
    res.status(409).json({ error: 'Organization slug already taken', code: 'SLUG_TAKEN' });
    return;
  }

  // Check email uniqueness
  const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [body.email]);
  if ((existingUser.rowCount ?? 0) > 0) {
    res.status(409).json({ error: 'Email already registered', code: 'EMAIL_TAKEN' });
    return;
  }

  // Create org
  const org = await createOrganization({ name: body.orgName, slug: body.orgSlug, tier: 'standard' });

  // Create user as incident_commander
  const passwordHash = await bcrypt.hash(body.password, 10);
  const userResult = await pool.query(
    `INSERT INTO users (email, name, role, password_hash, org_id)
     VALUES ($1, $2, 'incident_commander', $3, $4)
     RETURNING *`,
    [body.email, body.name, passwordHash, org.id],
  );
  const user = userResult.rows[0];

  const token = jwt.sign(
    { sub: user.id, email: user.email, role: user.role, org_id: org.id },
    config.JWT_SECRET,
    { expiresIn: '8h' },
  );

  res.status(201).json({
    token,
    user: { id: user.id, email: user.email, name: user.name, role: user.role, org_id: org.id },
    org: { id: org.id, name: org.name, slug: org.slug },
  });
});

export default router;
