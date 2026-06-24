CREATE TABLE IF NOT EXISTS licenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  license_key TEXT UNIQUE NOT NULL,
  org_name TEXT NOT NULL,
  org_email TEXT NOT NULL,
  tier TEXT NOT NULL CHECK (tier IN ('starter','professional','enterprise')),
  max_users INTEGER NOT NULL DEFAULT 3,
  max_incidents INTEGER NOT NULL DEFAULT 10,
  features JSONB NOT NULL DEFAULT '[]',
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  last_validated_at TIMESTAMPTZ,
  hardware_fingerprint TEXT,
  fingerprint_changed_at TIMESTAMPTZ,
  revoked BOOLEAN NOT NULL DEFAULT FALSE,
  revoke_reason TEXT,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS license_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  license_key TEXT NOT NULL,
  event TEXT NOT NULL,
  ip_address TEXT,
  fingerprint TEXT,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
