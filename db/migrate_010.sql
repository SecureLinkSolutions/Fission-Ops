-- Add bidirectional flag to entity relationships
ALTER TABLE entity_relationships ADD COLUMN IF NOT EXISTS bidirectional BOOLEAN NOT NULL DEFAULT false;
