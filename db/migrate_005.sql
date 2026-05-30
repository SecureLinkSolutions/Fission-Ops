-- Migration 005: Notifications, Comments, Tasks, Executive Summary, TI Enrichment, IOC Flagging

-- Executive Summary
CREATE TABLE IF NOT EXISTS incident_executive_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  overview TEXT,
  attack_timeline TEXT,
  business_impact TEXT,
  key_findings TEXT,
  remediation TEXT,
  risk_rating TEXT CHECK (risk_rating IN ('low','medium','high','critical')),
  updated_by UUID REFERENCES users(id),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(incident_id)
);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  incident_id UUID REFERENCES incidents(id) ON DELETE SET NULL,
  entity_id UUID REFERENCES entities(id) ON DELETE SET NULL,
  read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, read, created_at DESC);

-- Comments
CREATE TABLE IF NOT EXISTS comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID REFERENCES incidents(id) ON DELETE CASCADE,
  entity_id UUID REFERENCES entities(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES users(id),
  body TEXT NOT NULL,
  edited_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (incident_id IS NOT NULL OR entity_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_comments_incident ON comments(incident_id, created_at);
CREATE INDEX IF NOT EXISTS idx_comments_entity ON comments(entity_id, created_at);

-- Incident Tasks
CREATE TABLE IF NOT EXISTS incident_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  assignee_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_by UUID NOT NULL REFERENCES users(id),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('critical','high','medium','low')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','complete')),
  due_date DATE,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tasks_incident ON incident_tasks(incident_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON incident_tasks(assignee_id, status);

-- TI Enrichment columns on entities
ALTER TABLE entities ADD COLUMN IF NOT EXISTS ioc_status TEXT CHECK (ioc_status IN ('suspected','confirmed','cleared'));
ALTER TABLE entities ADD COLUMN IF NOT EXISTS enrichment_status TEXT DEFAULT 'pending' CHECK (enrichment_status IN ('pending','running','complete','failed','skipped'));
ALTER TABLE entities ADD COLUMN IF NOT EXISTS enrichment_data JSONB;
ALTER TABLE entities ADD COLUMN IF NOT EXISTS enrichment_updated_at TIMESTAMPTZ;

-- IOC flagging columns on entities
ALTER TABLE entities ADD COLUMN IF NOT EXISTS ioc_flagged_by UUID REFERENCES users(id);
ALTER TABLE entities ADD COLUMN IF NOT EXISTS ioc_flagged_at TIMESTAMPTZ;
ALTER TABLE entities ADD COLUMN IF NOT EXISTS ioc_notes TEXT;

-- Org API Keys for TI enrichment
CREATE TABLE IF NOT EXISTS org_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  service TEXT NOT NULL CHECK (service IN ('virustotal','abuseipdb','shodan')),
  api_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(org_id, service)
);
