import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { loginSchema } from '../schemas/auth';
import { findUserByEmail, findUserById } from '../repositories/userRepository';
import { config } from '../config';
import { pool } from '../db/pool';

// openid-client v6 API
import {
  discovery,
  buildAuthorizationUrl,
  authorizationCodeGrant,
  randomState,
  randomNonce,
} from 'openid-client';

const router = Router();

// In-memory state store for OIDC flows
interface OidcState {
  nonce: string;
  provider: 'azure' | 'okta';
  expires: number;
}
const stateStore = new Map<string, OidcState>();

function cleanExpiredStates() {
  const now = Date.now();
  for (const [k, v] of stateStore.entries()) {
    if (v.expires < now) stateStore.delete(k);
  }
}

router.post('/login', async (req: Request, res: Response) => {
  const body = loginSchema.parse(req.body);
  const user = await findUserByEmail(body.email);

  if (!user || !user.password_hash) {
    res.status(401).json({ error: 'Invalid credentials', code: 'INVALID_CREDENTIALS' });
    return;
  }

  if ((user as unknown as { deactivated_at: unknown }).deactivated_at) {
    res.status(401).json({ error: 'Account deactivated', code: 'ACCOUNT_DEACTIVATED' });
    return;
  }

  const valid = await bcrypt.compare(body.password, user.password_hash);
  if (!valid) {
    res.status(401).json({ error: 'Invalid credentials', code: 'INVALID_CREDENTIALS' });
    return;
  }

  // Update last_login_at
  await pool.query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [user.id]);

  const fullUser = await pool.query(
    'SELECT password_reset_required, org_id FROM users WHERE id = $1',
    [user.id],
  );
  const passwordResetRequired = fullUser.rows[0]?.password_reset_required ?? false;
  const orgId: string | null = fullUser.rows[0]?.org_id ?? null;

  const token = jwt.sign(
    { sub: user.id, email: user.email, role: user.role, password_reset_required: passwordResetRequired, ...(orgId ? { org_id: orgId } : {}) },
    config.JWT_SECRET,
    { expiresIn: '8h' },
  );

  res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role, org_id: orgId, password_reset_required: passwordResetRequired } });
});

router.get('/sso/azure', async (req: Request, res: Response) => {
  cleanExpiredStates();

  if (!config.OIDC_AZURE_CLIENT_ID || !config.OIDC_AZURE_CLIENT_SECRET || !config.OIDC_AZURE_TENANT_ID) {
    res.status(501).json({ error: 'Azure SSO not configured', code: 'SSO_NOT_CONFIGURED' });
    return;
  }

  try {
    const issuerUrl = new URL(
      `https://login.microsoftonline.com/${config.OIDC_AZURE_TENANT_ID}/v2.0`,
    );
    const clientConfig = await discovery(
      issuerUrl,
      config.OIDC_AZURE_CLIENT_ID,
      config.OIDC_AZURE_CLIENT_SECRET,
    );

    const state = randomState();
    const nonce = randomNonce();
    stateStore.set(state, { nonce, provider: 'azure', expires: Date.now() + 5 * 60 * 1000 });

    const redirectUri = `${config.SSO_REDIRECT_BASE_URL}/api/v1/auth/sso/callback`;
    const authUrl = buildAuthorizationUrl(clientConfig, {
      redirect_uri: redirectUri,
      scope: 'openid email profile',
      state,
      nonce,
    });

    res.redirect(authUrl.href);
  } catch (err) {
    console.error('Azure SSO init error:', err);
    res.status(500).json({ error: 'SSO initialization failed' });
  }
});

router.get('/sso/okta', async (req: Request, res: Response) => {
  cleanExpiredStates();

  if (!config.OIDC_OKTA_CLIENT_ID || !config.OIDC_OKTA_CLIENT_SECRET || !config.OIDC_OKTA_DOMAIN) {
    res.status(501).json({ error: 'Okta SSO not configured', code: 'SSO_NOT_CONFIGURED' });
    return;
  }

  try {
    const issuerUrl = new URL(`https://${config.OIDC_OKTA_DOMAIN}`);
    const clientConfig = await discovery(
      issuerUrl,
      config.OIDC_OKTA_CLIENT_ID,
      config.OIDC_OKTA_CLIENT_SECRET,
    );

    const state = randomState();
    const nonce = randomNonce();
    stateStore.set(state, { nonce, provider: 'okta', expires: Date.now() + 5 * 60 * 1000 });

    const redirectUri = `${config.SSO_REDIRECT_BASE_URL}/api/v1/auth/sso/callback`;
    const authUrl = buildAuthorizationUrl(clientConfig, {
      redirect_uri: redirectUri,
      scope: 'openid email profile groups',
      state,
      nonce,
    });

    res.redirect(authUrl.href);
  } catch (err) {
    console.error('Okta SSO init error:', err);
    res.status(500).json({ error: 'SSO initialization failed' });
  }
});

router.get('/sso/callback', async (req: Request, res: Response) => {
  cleanExpiredStates();

  const state = req.query.state as string | undefined;
  if (!state || !stateStore.has(state)) {
    res.status(400).json({ error: 'Invalid or expired state', code: 'INVALID_STATE' });
    return;
  }

  const stateData = stateStore.get(state)!;
  stateStore.delete(state);

  try {
    let issuerUrl: URL;
    let clientId: string;
    let clientSecret: string;

    if (stateData.provider === 'azure') {
      if (!config.OIDC_AZURE_CLIENT_ID || !config.OIDC_AZURE_CLIENT_SECRET || !config.OIDC_AZURE_TENANT_ID) {
        res.status(501).json({ error: 'Azure SSO not configured' });
        return;
      }
      issuerUrl = new URL(`https://login.microsoftonline.com/${config.OIDC_AZURE_TENANT_ID}/v2.0`);
      clientId = config.OIDC_AZURE_CLIENT_ID;
      clientSecret = config.OIDC_AZURE_CLIENT_SECRET;
    } else {
      if (!config.OIDC_OKTA_CLIENT_ID || !config.OIDC_OKTA_CLIENT_SECRET || !config.OIDC_OKTA_DOMAIN) {
        res.status(501).json({ error: 'Okta SSO not configured' });
        return;
      }
      issuerUrl = new URL(`https://${config.OIDC_OKTA_DOMAIN}`);
      clientId = config.OIDC_OKTA_CLIENT_ID;
      clientSecret = config.OIDC_OKTA_CLIENT_SECRET;
    }

    const clientConfig = await discovery(issuerUrl, clientId, clientSecret);
    const redirectUri = `${config.SSO_REDIRECT_BASE_URL}/api/v1/auth/sso/callback`;

    const currentUrl = new URL(
      req.url,
      `${config.SSO_REDIRECT_BASE_URL}`,
    );
    // Reconstruct full URL
    const callbackUrl = new URL(`${config.SSO_REDIRECT_BASE_URL}/api/v1/auth/sso/callback`);
    for (const [k, v] of Object.entries(req.query)) {
      callbackUrl.searchParams.set(k, v as string);
    }

    const tokens = await authorizationCodeGrant(clientConfig, callbackUrl, {
      pkceCodeVerifier: undefined,
      expectedNonce: stateData.nonce,
      expectedState: state,
    });

    const claims = tokens.claims();
    const email = (claims?.email ?? claims?.preferred_username) as string | undefined;
    const name = (claims?.name ?? email) as string | undefined;

    if (!email) {
      res.status(400).json({ error: 'No email in SSO token claims' });
      return;
    }

    // Find or create user
    let user = await findUserByEmail(email);
    const ssoSubject = claims?.sub as string;

    if (!user) {
      // Auto-provision as analyst
      const newUserResult = await pool.query(
        `INSERT INTO users (email, name, role, sso_provider, sso_subject)
         VALUES ($1, $2, 'analyst', $3, $4)
         RETURNING *`,
        [email, name ?? email, stateData.provider, ssoSubject],
      );
      user = newUserResult.rows[0];
    } else {
      // Update SSO info
      await pool.query(
        `UPDATE users SET sso_provider = $1, sso_subject = $2, last_login_at = NOW() WHERE id = $3`,
        [stateData.provider, ssoSubject, user.id],
      );
    }

    if (!user) {
      res.status(500).json({ error: 'Failed to create or find user' });
      return;
    }

    const ssoUserFull = await pool.query('SELECT org_id FROM users WHERE id = $1', [user.id]);
    const ssoOrgId: string | null = ssoUserFull.rows[0]?.org_id ?? null;

    const token = jwt.sign(
      { sub: user.id, email: user.email, role: user.role, ...(ssoOrgId ? { org_id: ssoOrgId } : {}) },
      config.JWT_SECRET,
      { expiresIn: '8h' },
    );

    // Redirect frontend to SSO callback page with token
    res.redirect(`${config.FRONTEND_URL}/sso-callback?token=${encodeURIComponent(token)}`);
  } catch (err) {
    console.error('SSO callback error:', err);
    const errMsg = encodeURIComponent('SSO authentication failed');
    res.redirect(`${config.FRONTEND_URL}/sso-callback?error=${errMsg}`);
  }
});

export default router;
