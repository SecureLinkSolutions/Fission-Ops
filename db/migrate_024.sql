-- Extend entity_type enum with types added after initial schema
ALTER TYPE entity_type ADD VALUE IF NOT EXISTS 'file';
ALTER TYPE entity_type ADD VALUE IF NOT EXISTS 'process';
ALTER TYPE entity_type ADD VALUE IF NOT EXISTS 'registry';
ALTER TYPE entity_type ADD VALUE IF NOT EXISTS 'certificate';
ALTER TYPE entity_type ADD VALUE IF NOT EXISTS 'url';
ALTER TYPE entity_type ADD VALUE IF NOT EXISTS 'custom';
