-- Track platform admin access grants/revocations per org
CREATE TABLE IF NOT EXISTS platform_admin_access_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  action VARCHAR(20) NOT NULL CHECK (action IN ('granted', 'revoked', 'expired')),
  actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  actor_name VARCHAR(255),
  actor_role VARCHAR(50),
  actor_ip VARCHAR(45),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pa_access_log_org ON platform_admin_access_log(org_id, created_at DESC);

-- Add expiry column to organizations
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS platform_admin_access_expires_at TIMESTAMPTZ;
