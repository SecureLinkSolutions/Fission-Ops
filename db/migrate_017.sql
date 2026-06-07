CREATE TABLE IF NOT EXISTS evidence_custody_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  incident_id UUID REFERENCES incidents(id) ON DELETE CASCADE,
  action VARCHAR(50) NOT NULL,
  actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  actor_name VARCHAR(255),
  actor_role VARCHAR(50),
  actor_ip VARCHAR(45),
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_custody_entity ON evidence_custody_log(entity_id, created_at DESC);
-- Prevent any DELETE or UPDATE via rule (append-only enforcement at DB level)
CREATE OR REPLACE RULE no_delete_custody AS ON DELETE TO evidence_custody_log DO INSTEAD NOTHING;
CREATE OR REPLACE RULE no_update_custody AS ON UPDATE TO evidence_custody_log DO INSTEAD NOTHING;
