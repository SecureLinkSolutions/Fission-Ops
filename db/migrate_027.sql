-- Record which connection point (handle) on each node a relationship was
-- drawn from/to, so the graph renders the edge at the point the analyst
-- actually dragged instead of falling back to a default side.
ALTER TABLE entity_relationships ADD COLUMN IF NOT EXISTS source_handle TEXT;
ALTER TABLE entity_relationships ADD COLUMN IF NOT EXISTS target_handle TEXT;
