-- Migration 006: License support tables

CREATE TABLE IF NOT EXISTS deployment_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS license_cache (
  id INTEGER PRIMARY KEY DEFAULT 1,
  license_key TEXT,
  tier TEXT NOT NULL DEFAULT 'starter',
  max_users INTEGER NOT NULL DEFAULT 3,
  max_incidents INTEGER NOT NULL DEFAULT 10,
  features JSONB NOT NULL DEFAULT '[]',
  expires_at TIMESTAMPTZ,
  last_validated_at TIMESTAMPTZ,
  fingerprint_warning BOOLEAN DEFAULT FALSE,
  grace_mode BOOLEAN DEFAULT FALSE,
  grace_started_at TIMESTAMPTZ,
  validated_ok BOOLEAN DEFAULT FALSE
);

INSERT INTO license_cache (id) VALUES (1) ON CONFLICT DO NOTHING;
