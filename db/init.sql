-- Enums
CREATE TYPE user_role AS ENUM ('analyst', 'senior_analyst', 'incident_commander');
CREATE TYPE incident_severity AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE incident_status AS ENUM ('open', 'contained', 'closed');
CREATE TYPE entity_type AS ENUM ('hostname', 'ip', 'email', 'domain', 'account');
CREATE TYPE confidence_level AS ENUM ('low', 'medium', 'high');
CREATE TYPE zone_type AS ENUM ('IT', 'OT', 'trusted', 'untrusted', 'dmz');
CREATE TYPE direction_type AS ENUM ('ingress', 'egress', 'lateral');

-- Users
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'analyst',
  password_hash TEXT,
  sso_provider TEXT,
  sso_subject TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Incidents
CREATE TABLE incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  severity incident_severity NOT NULL DEFAULT 'medium',
  status incident_status NOT NULL DEFAULT 'open',
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Entities
CREATE TABLE entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  type entity_type NOT NULL,
  value TEXT NOT NULL,
  notes TEXT,
  entity_details JSONB,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Kill chain stages
CREATE TABLE kill_chain_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  order_index INTEGER NOT NULL
);

-- Entity kill chain mappings
CREATE TABLE entity_kill_chain_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  stage_id UUID NOT NULL REFERENCES kill_chain_stages(id),
  confidence confidence_level NOT NULL DEFAULT 'medium',
  notes TEXT,
  mapped_by UUID NOT NULL REFERENCES users(id),
  mapped_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(entity_id, stage_id)
);

-- Network boundaries
CREATE TABLE network_boundaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  zone_type zone_type NOT NULL,
  description TEXT,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Entity boundary mappings
CREATE TABLE entity_boundary_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  boundary_id UUID NOT NULL REFERENCES network_boundaries(id) ON DELETE CASCADE,
  direction direction_type NOT NULL,
  notes TEXT,
  mapped_by UUID NOT NULL REFERENCES users(id),
  mapped_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(entity_id, boundary_id, direction)
);

-- Seed kill chain stages (Lockheed Martin)
INSERT INTO kill_chain_stages (name, description, order_index) VALUES
  ('Reconnaissance', 'Adversary harvests information about target', 1),
  ('Weaponization', 'Adversary creates a deliverable payload', 2),
  ('Delivery', 'Payload is transmitted to target environment', 3),
  ('Exploitation', 'Code executes on victim system', 4),
  ('Installation', 'Malware installed on asset for persistent access', 5),
  ('Command & Control', 'Adversary establishes remote command channel', 6),
  ('Actions on Objectives', 'Adversary achieves original goals', 7);

-- Seed demo users (password for both: analyst123)
INSERT INTO users (email, name, role, password_hash) VALUES
  ('analyst@fission.local', 'Demo Analyst', 'analyst', '$2a$10$uvHFKAKbSxDrTwoCoXM2nuOuhY4J7AWvwG/lGH7uScccNrid/qrOe'),
  ('commander@fission.local', 'Incident Commander', 'incident_commander', '$2a$10$uvHFKAKbSxDrTwoCoXM2nuOuhY4J7AWvwG/lGH7uScccNrid/qrOe');
