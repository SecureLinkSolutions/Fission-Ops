-- Migration 018: Add platform_admin_access column to organizations
-- Allows orgs to opt-in to platform admin visibility of their data.
-- New orgs default to FALSE; existing orgs are set to TRUE for dev continuity.

ALTER TABLE organizations ADD COLUMN IF NOT EXISTS platform_admin_access BOOLEAN NOT NULL DEFAULT FALSE;

-- Grant existing orgs access so dev environments continue working
UPDATE organizations SET platform_admin_access = TRUE WHERE platform_admin_access = FALSE;

-- Rename 'super_admin' enum value to 'platform_admin' if it exists
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'user_role' AND e.enumlabel = 'super_admin'
  ) THEN
    ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'platform_admin';
  END IF;
END $$;
