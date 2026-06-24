CREATE TABLE IF NOT EXISTS ttp_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_technique_id VARCHAR(20) NOT NULL,
  target_technique_id VARCHAR(20) NOT NULL,
  relationship_type VARCHAR(50) NOT NULL DEFAULT 'related',
  weight INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(source_technique_id, target_technique_id)
);
CREATE INDEX IF NOT EXISTS idx_ttp_relationships_source ON ttp_relationships(source_technique_id);
CREATE INDEX IF NOT EXISTS idx_ttp_relationships_target ON ttp_relationships(target_technique_id);

CREATE TABLE IF NOT EXISTS ttp_suggestion_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID REFERENCES incidents(id) ON DELETE CASCADE,
  entity_id UUID REFERENCES entities(id) ON DELETE CASCADE,
  suggested_technique_id VARCHAR(20) NOT NULL,
  trigger_technique_id VARCHAR(20) NOT NULL,
  action VARCHAR(20) NOT NULL CHECK (action IN ('accepted', 'dismissed')),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
