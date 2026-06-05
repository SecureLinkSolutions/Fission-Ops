CREATE TABLE IF NOT EXISTS entity_enrichment_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  source VARCHAR(50) NOT NULL,
  triggered_by UUID REFERENCES users(id) ON DELETE SET NULL,
  triggered_by_name VARCHAR(255),
  verdict VARCHAR(20),
  raw_result JSONB,
  summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_enrichment_history_entity ON entity_enrichment_history(entity_id, created_at DESC);
