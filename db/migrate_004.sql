-- Organizations table
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  tier TEXT NOT NULL DEFAULT 'standard',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add 'super_admin' to user_role enum (idempotent)
DO $$ BEGIN
  ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'super_admin';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Add org_id to users
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='org_id') THEN
    ALTER TABLE users ADD COLUMN org_id UUID REFERENCES organizations(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add org_id to incidents
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='incidents' AND column_name='org_id') THEN
    ALTER TABLE incidents ADD COLUMN org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add org_id to audit_logs
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audit_logs' AND column_name='org_id') THEN
    ALTER TABLE audit_logs ADD COLUMN org_id UUID REFERENCES organizations(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create default organization for existing data
INSERT INTO organizations (id, name, slug, tier)
VALUES ('00000000-0000-0000-0000-000000000001', 'Default Organization', 'default', 'standard')
ON CONFLICT (slug) DO NOTHING;

-- Assign all existing users to default org
UPDATE users SET org_id = '00000000-0000-0000-0000-000000000001' WHERE org_id IS NULL;

-- Assign all existing incidents to default org
UPDATE incidents SET org_id = '00000000-0000-0000-0000-000000000001' WHERE org_id IS NULL;

-- Assign all existing audit_logs to default org
UPDATE audit_logs SET org_id = '00000000-0000-0000-0000-000000000001' WHERE org_id IS NULL;

-- Seed a super_admin user (password: superadmin123)
INSERT INTO users (email, name, role, password_hash, org_id)
VALUES ('superadmin@fission.local', 'Super Admin', 'super_admin', '$2a$10$7M7mkF0cQf.y3kkaKytINe5s1UX2DHeuV/oCUQbrgWQmhwbGhmTOy', NULL)
ON CONFLICT (email) DO NOTHING;
