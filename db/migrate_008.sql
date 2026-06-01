-- Entity status
ALTER TABLE entities ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'unreviewed';

-- Incident operational status (separate from the existing open/contained/closed status column)
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS incident_status TEXT NOT NULL DEFAULT 'active';

-- Org threat intel enrichment mode
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS threat_intel_mode TEXT NOT NULL DEFAULT 'automatic';
