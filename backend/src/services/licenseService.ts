import { pool } from '../db/pool';
import { getDeploymentFingerprint } from './fingerprintService';
import { config } from '../config';

export interface LicenseStatus {
  tier: string;
  features: string[];
  max_users: number;
  max_incidents: number;
  expires_at: Date | null;
  grace_mode: boolean;
  grace_mode_expired: boolean;
  fingerprint_warning: boolean;
  validated_ok: boolean;
  license_key: string | null;
}

const GRACE_PERIOD_DAYS = 7;

function isGraceModeExpiredFn(grace_started_at: Date | null): boolean {
  if (!grace_started_at) return false;
  const now = new Date();
  return (now.getTime() - grace_started_at.getTime()) > GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000;
}

export function isFeatureEnabled(feature: string): boolean {
  // If no LICENSE_KEY configured, full access (dev mode)
  if (!config.LICENSE_KEY) return true;

  try {
    const cache = getCachedLicenseSync();
    if (!cache) return true; // no cache yet, allow

    const graceExpired = isGraceModeExpiredFn(cache.grace_started_at ? new Date(cache.grace_started_at) : null);

    if (graceExpired) {
      // Only allow starter features
      const starterFeatures = ['core_incidents', 'basic_kill_chain'];
      return starterFeatures.includes(feature);
    }

    return (cache.features as string[]).includes(feature);
  } catch {
    return true;
  }
}

export function getTier(): string {
  try {
    const cache = getCachedLicenseSync();
    return cache?.tier ?? 'starter';
  } catch {
    return 'starter';
  }
}

export function isGraceModeExpired(): boolean {
  try {
    const cache = getCachedLicenseSync();
    if (!cache?.grace_mode) return false;
    return isGraceModeExpiredFn(cache.grace_started_at ? new Date(cache.grace_started_at) : null);
  } catch {
    return false;
  }
}

// Synchronous in-memory cache for hot path
let _cachedStatus: LicenseCacheRow | null = null;

interface LicenseCacheRow {
  license_key: string | null;
  tier: string;
  max_users: number;
  max_incidents: number;
  features: string[];
  expires_at: string | null;
  last_validated_at: string | null;
  fingerprint_warning: boolean;
  grace_mode: boolean;
  grace_started_at: string | null;
  validated_ok: boolean;
}

function getCachedLicenseSync(): LicenseCacheRow | null {
  return _cachedStatus;
}

export async function loadCachedLicense(): Promise<LicenseCacheRow | null> {
  try {
    const res = await pool.query('SELECT * FROM license_cache WHERE id = 1');
    if (res.rowCount === 0) return null;
    _cachedStatus = res.rows[0];
    return _cachedStatus;
  } catch {
    return null;
  }
}

export async function validateWithServer(): Promise<boolean> {
  if (!config.LICENSE_KEY || !config.LICENSE_SERVER_URL) return true;

  try {
    const fingerprint = await getDeploymentFingerprint();

    const response = await fetch(`${config.LICENSE_SERVER_URL}/licenses/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ license_key: config.LICENSE_KEY, fingerprint }),
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Unknown error' }));
      console.warn('⚠️  License validation failed:', err.error);
      return false;
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

    // Save to license_cache
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
      config.LICENSE_KEY,
      data.tier,
      data.max_users,
      data.max_incidents,
      JSON.stringify(data.features),
      data.expires_at,
      data.fingerprint_warning ?? false,
    ]);

    await loadCachedLicense();
    console.log(`✅ License validated: ${data.tier} tier`);
    return true;
  } catch (err) {
    console.warn('⚠️  License server unreachable:', (err as Error).message);
    return false;
  }
}

export async function runStartupValidation(): Promise<void> {
  if (!config.LICENSE_KEY) {
    console.log('ℹ️  No LICENSE_KEY configured — running in dev mode (full access)');
    return;
  }

  try {
    await loadCachedLicense();
    const ok = await validateWithServer();

    if (!ok) {
      // Server unreachable — check cache
      const cache = await loadCachedLicense();
      if (cache && cache.last_validated_at) {
        const lastValidated = new Date(cache.last_validated_at);
        const daysSince = (Date.now() - lastValidated.getTime()) / (1000 * 60 * 60 * 24);
        if (daysSince > GRACE_PERIOD_DAYS) {
          // Enter grace mode
          await pool.query(`
            UPDATE license_cache SET
              grace_mode = TRUE,
              grace_started_at = COALESCE(grace_started_at, NOW())
            WHERE id = 1
          `);
          console.warn('⚠️  License server unreachable and cache expired. Entering grace mode.');
        } else {
          console.log(`ℹ️  Using cached license (${Math.round(daysSince * 10) / 10} days old)`);
        }
      } else {
        console.warn('⚠️  License server unreachable and no cache. Features may be limited.');
      }
      await loadCachedLicense();
    }

    // Schedule 24h re-validation
    setInterval(async () => {
      try {
        await validateWithServer();
      } catch (e) {
        console.error('Periodic license validation error:', e);
      }
    }, 24 * 60 * 60 * 1000);
  } catch (err) {
    console.error('License startup validation error (non-fatal):', err);
  }
}

export async function getLicenseStatusResponse(): Promise<LicenseStatus> {
  const cache = await loadCachedLicense();
  const graceExpired = cache?.grace_mode
    ? isGraceModeExpiredFn(cache.grace_started_at ? new Date(cache.grace_started_at) : null)
    : false;

  return {
    tier: cache?.tier ?? 'starter',
    features: (cache?.features as string[]) ?? [],
    max_users: cache?.max_users ?? 3,
    max_incidents: cache?.max_incidents ?? 10,
    expires_at: cache?.expires_at ? new Date(cache.expires_at) : null,
    grace_mode: cache?.grace_mode ?? false,
    grace_mode_expired: graceExpired,
    fingerprint_warning: cache?.fingerprint_warning ?? false,
    validated_ok: cache?.validated_ok ?? false,
    license_key: cache?.license_key ?? null,
  };
}
