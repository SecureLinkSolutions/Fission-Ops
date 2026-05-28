import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { loginSchema } from '../schemas/auth';
import { findUserByEmail } from '../repositories/userRepository';
import { config } from '../config';

const router = Router();

router.post('/login', async (req: Request, res: Response) => {
  const body = loginSchema.parse(req.body);
  const user = await findUserByEmail(body.email);

  if (!user || !user.password_hash) {
    res.status(401).json({ error: 'Invalid credentials', code: 'INVALID_CREDENTIALS' });
    return;
  }

  const valid = await bcrypt.compare(body.password, user.password_hash);
  if (!valid) {
    res.status(401).json({ error: 'Invalid credentials', code: 'INVALID_CREDENTIALS' });
    return;
  }

  const token = jwt.sign(
    { sub: user.id, email: user.email, role: user.role },
    config.JWT_SECRET,
    { expiresIn: '8h' },
  );

  res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
});

router.get('/sso/azure', (_req: Request, res: Response) => {
  res.status(501).json({ error: 'SSO not configured', code: 'SSO_NOT_IMPLEMENTED' });
});

router.get('/sso/okta', (_req: Request, res: Response) => {
  res.status(501).json({ error: 'SSO not configured', code: 'SSO_NOT_IMPLEMENTED' });
});

router.post('/sso/callback', (_req: Request, res: Response) => {
  res.status(501).json({ error: 'SSO not configured', code: 'SSO_NOT_IMPLEMENTED' });
});

export default router;
