-- Migration 001: MITRE ATT&CK frameworks + entity relationships

-- Add framework column to kill_chain_stages if not exists
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'kill_chain_stages' AND column_name = 'framework'
  ) THEN
    ALTER TABLE kill_chain_stages ADD COLUMN framework TEXT NOT NULL DEFAULT 'lockheed_martin';
  END IF;
END $$;

-- Seed MITRE ATT&CK Enterprise stages
INSERT INTO kill_chain_stages (name, description, order_index, framework) VALUES
  ('Initial Access', 'Adversary attempts to get into your network', 1, 'mitre_attack'),
  ('Execution', 'Adversary attempts to run malicious code', 2, 'mitre_attack'),
  ('Persistence', 'Adversary tries to maintain their foothold', 3, 'mitre_attack'),
  ('Privilege Escalation', 'Adversary tries to gain higher-level permissions', 4, 'mitre_attack'),
  ('Defense Evasion', 'Adversary tries to avoid being detected', 5, 'mitre_attack'),
  ('Credential Access', 'Adversary tries to steal account names and passwords', 6, 'mitre_attack'),
  ('Discovery', 'Adversary tries to figure out your environment', 7, 'mitre_attack'),
  ('Lateral Movement', 'Adversary tries to move through your environment', 8, 'mitre_attack'),
  ('Collection', 'Adversary gathers data of interest to their goal', 9, 'mitre_attack'),
  ('Command and Control', 'Adversary communicates with compromised systems', 10, 'mitre_attack'),
  ('Exfiltration', 'Adversary steals data from your network', 11, 'mitre_attack'),
  ('Impact', 'Adversary manipulates, interrupts, or destroys systems', 12, 'mitre_attack')
ON CONFLICT (name) DO NOTHING;

-- Seed MITRE ATT&CK ICS stages
INSERT INTO kill_chain_stages (name, description, order_index, framework) VALUES
  ('Initial Access', 'Adversary attempts to gain entry to ICS network', 1, 'mitre_ics'),
  ('Execution', 'Adversary runs malicious code on ICS systems', 2, 'mitre_ics'),
  ('Persistence', 'Adversary maintains presence on ICS systems', 3, 'mitre_ics'),
  ('Privilege Escalation', 'Adversary gains higher-level access to ICS', 4, 'mitre_ics'),
  ('Evasion', 'Adversary avoids detection in ICS environment', 5, 'mitre_ics'),
  ('Discovery', 'Adversary learns about ICS environment and devices', 6, 'mitre_ics'),
  ('Lateral Movement', 'Adversary pivots between ICS systems', 7, 'mitre_ics'),
  ('Collection', 'Adversary gathers ICS process data', 8, 'mitre_ics'),
  ('Command and Control', 'Adversary controls compromised ICS systems', 9, 'mitre_ics'),
  ('Inhibit Response Function', 'Adversary prevents safety and protection functions', 10, 'mitre_ics'),
  ('Impair Process Control', 'Adversary manipulates physical control processes', 11, 'mitre_ics'),
  ('Impact', 'Adversary disrupts or damages physical processes', 12, 'mitre_ics')
ON CONFLICT (name) DO NOTHING;

-- Create entity_relationships table
CREATE TABLE IF NOT EXISTS entity_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  source_entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  target_entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  relationship_type TEXT NOT NULL,
  notes TEXT,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(source_entity_id, target_entity_id, relationship_type)
);
