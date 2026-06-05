CREATE TABLE IF NOT EXISTS entity_checklists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  item_text TEXT NOT NULL,
  checked BOOLEAN NOT NULL DEFAULT FALSE,
  checked_by UUID REFERENCES users(id) ON DELETE SET NULL,
  checked_by_name VARCHAR(255),
  checked_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_by_name VARCHAR(255),
  order_index INTEGER NOT NULL DEFAULT 0,
  is_custom BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_entity_checklists_entity ON entity_checklists(entity_id, order_index);
