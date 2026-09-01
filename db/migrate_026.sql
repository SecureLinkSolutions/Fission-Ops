CREATE TABLE IF NOT EXISTS yara_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  entity_id UUID REFERENCES entities(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  author TEXT,
  reference TEXT,
  tags TEXT[] DEFAULT '{}',
  strings JSONB NOT NULL DEFAULT '[]',
  hashes JSONB NOT NULL DEFAULT '{}',
  condition TEXT NOT NULL,
  rule_text TEXT NOT NULL,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_yara_rules_incident_id ON yara_rules(incident_id);
CREATE INDEX IF NOT EXISTS idx_yara_rules_entity_id ON yara_rules(entity_id);
