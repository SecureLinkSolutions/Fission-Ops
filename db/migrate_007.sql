-- Fix seeded demo account password hashes.
-- The original hashes in init.sql and migrate_004.sql did not match the
-- documented passwords. This migration force-updates them so existing
-- databases (where the INSERT ON CONFLICT DO NOTHING already ran) get
-- working credentials.
--
-- analyst@fission.local    → analyst123
-- commander@fission.local  → analyst123
-- superadmin@fission.local → superadmin123

UPDATE users
SET password_hash = '$2a$10$uvHFKAKbSxDrTwoCoXM2nuOuhY4J7AWvwG/lGH7uScccNrid/qrOe'
WHERE email IN ('analyst@fission.local', 'commander@fission.local');

UPDATE users
SET password_hash = '$2a$10$7M7mkF0cQf.y3kkaKytINe5s1UX2DHeuV/oCUQbrgWQmhwbGhmTOy'
WHERE email = 'superadmin@fission.local';

-- Ensure platform_admin exists even if migrate_004 was skipped
INSERT INTO users (email, name, role, password_hash, org_id)
VALUES (
  'superadmin@fission.local',
  'Platform Admin',
  'platform_admin',
  '$2a$10$7M7mkF0cQf.y3kkaKytINe5s1UX2DHeuV/oCUQbrgWQmhwbGhmTOy',
  NULL
)
ON CONFLICT (email) DO UPDATE
  SET password_hash = EXCLUDED.password_hash;
