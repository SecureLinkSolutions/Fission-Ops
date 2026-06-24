import { pool } from '../db/pool';
import { generateLicenseKey, verifyLicenseKey } from './crypto';
import { v4 as uuidv4 } from 'uuid';

export interface CreateLicenseInput {
  org_name: string;
  org_email: string;
  tier: 'starter' | 'professional' | 'enterprise';
  max_users: number;
  max_incidents: number;
  features?: string[];
  expires_days: number;
}

const TIER_FEATURES: Record<string, string[]> = {
  starter: ['core_incidents', 'basic_kill_chain'],
  professional: ['core_incidents', 'basic_kill_chain', 'relationships', 'network_boundaries', 'mitre_full', 'pdf_export'],
  enterprise: [
    'core_incidents', 'basic_kill_chain', 'relationships', 'network_boundaries', 'mitre_full', 'pdf_export',
    'sso', 'multi_tenancy', 'threat_intelligence', 'realtime_collab', 'audit_log', 'api_access', 'webhooks',
  ],
};

export async function createLicense(input: CreateLicenseInput): Promise<{ license_key: string; tier: string; expires_at: Date }> {
  const issued_at = new Date();
  const expires_at = new Date(issued_at.getTime() + input.expires_days * 24 * 60 * 60 * 1000);
  const features = input.features ?? TIER_FEATURES[input.tier] ?? [];

  const payload = {
    org_name: input.org_name,
    org_email: input.org_email,
    tier: input.tier,
    max_users: input.max_users,
    max_incidents: input.max_incidents,
    features,
    issued_at: issued_at.toISOString(),
    expires_at: expires_at.toISOString(),
  };

  const license_key = generateLicenseKey(payload);

  await pool.query(
    `INSERT INTO licenses (license_key, org_name, org_email, tier, max_users, max_incidents, features, issued_at, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [license_key, input.org_name, input.org_email, input.tier, input.max_users, input.max_incidents, JSON.stringify(features), issued_at, expires_at],
  );

  await auditEvent(license_key, 'created', null, null, { tier: input.tier, org_name: input.org_name });

  return { license_key, tier: input.tier, expires_at };
}

export async function validateLicense(
  license_key: string,
  fingerprint: string | null,
  ip: string | null,
): Promise<{
  valid: boolean;
  tier: string;
  max_users: number;
  max_incidents: number;
  features: string[];
  expires_at: Date;
  fingerprint_warning?: boolean;
}> {
  // Verify RSA signature first
  const payload = verifyLicenseKey(license_key);

  // Check DB record
  const res = await pool.query('SELECT * FROM licenses WHERE license_key = $1', [license_key]);
  if (res.rowCount === 0) throw new Error('License not found');

  const lic = res.rows[0];

  if (lic.revoked) throw new Error('License has been revoked');
  if (new Date(lic.expires_at) < new Date()) throw new Error('License has expired');

  let fingerprint_warning = false;

  if (fingerprint) {
    if (!lic.hardware_fingerprint) {
      // Bind fingerprint
      await pool.query('UPDATE licenses SET hardware_fingerprint = $1 WHERE license_key = $2', [fingerprint, license_key]);
    } else if (lic.hardware_fingerprint !== fingerprint) {
      const now = new Date();
      const changedAt = lic.fingerprint_changed_at ? new Date(lic.fingerprint_changed_at) : null;
      const overDay = !changedAt || (now.getTime() - changedAt.getTime()) > 24 * 60 * 60 * 1000;
      if (overDay) {
        await pool.query(
          'UPDATE licenses SET fingerprint_changed_at = $1 WHERE license_key = $2',
          [now, license_key],
        );
      }
      fingerprint_warning = true;
    }
  }

  await pool.query('UPDATE licenses SET last_validated_at = NOW() WHERE license_key = $1', [license_key]);
  await auditEvent(license_key, 'validated', ip, fingerprint, null);

  return {
    valid: true,
    tier: payload.tier,
    max_users: payload.max_users,
    max_incidents: payload.max_incidents,
    features: payload.features,
    expires_at: new Date(payload.expires_at),
    ...(fingerprint_warning ? { fingerprint_warning: true } : {}),
  };
}

export async function activateLicense(license_key: string, fingerprint: string, org_name: string): Promise<void> {
  verifyLicenseKey(license_key);
  const res = await pool.query('SELECT * FROM licenses WHERE license_key = $1', [license_key]);
  if (res.rowCount === 0) throw new Error('License not found');
  await pool.query(
    'UPDATE licenses SET hardware_fingerprint = $1 WHERE license_key = $2',
    [fingerprint, license_key],
  );
  await auditEvent(license_key, 'activated', null, fingerprint, { org_name });
}

export async function revokeLicense(license_key: string, reason: string): Promise<void> {
  await pool.query(
    'UPDATE licenses SET revoked = TRUE, revoke_reason = $1, revoked_at = NOW() WHERE license_key = $2',
    [reason, license_key],
  );
  await auditEvent(license_key, 'revoked', null, null, { reason });
}

export async function getLicenseStatus(license_key: string): Promise<object> {
  const res = await pool.query('SELECT * FROM licenses WHERE license_key = $1', [license_key]);
  if (res.rowCount === 0) throw new Error('License not found');
  const lic = res.rows[0];
  const now = new Date();
  const expired = new Date(lic.expires_at) < now;
  const status = lic.revoked ? 'revoked' : expired ? 'expired' : 'active';
  return { ...lic, status };
}

async function auditEvent(
  license_key: string,
  event: string,
  ip: string | null,
  fingerprint: string | null,
  details: object | null,
): Promise<void> {
  try {
    await pool.query(
      'INSERT INTO license_audit (license_key, event, ip_address, fingerprint, details) VALUES ($1, $2, $3, $4, $5)',
      [license_key, event, ip, fingerprint, details ? JSON.stringify(details) : null],
    );
  } catch (e) {
    console.error('Audit log error:', e);
  }
}
