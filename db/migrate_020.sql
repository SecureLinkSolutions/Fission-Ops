-- Migration 020: Tabletop IR Exercise Builder & Runner

CREATE TABLE IF NOT EXISTS tabletop_exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  title TEXT NOT NULL,
  description TEXT,
  scenario TEXT NOT NULL,
  objectives TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','ready','active','completed','archived')),
  scheduled_at TIMESTAMPTZ,
  duration_minutes INT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS exercise_injects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exercise_id UUID NOT NULL REFERENCES tabletop_exercises(id) ON DELETE CASCADE,
  sequence_order INT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  inject_type TEXT NOT NULL DEFAULT 'information' CHECK (inject_type IN ('information','decision','complication','escalation','resolution')),
  trigger_minutes INT,
  expected_actions TEXT,
  discussion_prompts TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS exercise_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exercise_id UUID NOT NULL REFERENCES tabletop_exercises(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id),
  facilitator_id UUID REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress','completed')),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  participant_notes TEXT
);

CREATE TABLE IF NOT EXISTS exercise_inject_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES exercise_sessions(id) ON DELETE CASCADE,
  inject_id UUID NOT NULL REFERENCES exercise_injects(id),
  response_text TEXT NOT NULL,
  gaps_identified TEXT,
  submitted_by UUID REFERENCES users(id),
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (session_id, inject_id)
);

CREATE TABLE IF NOT EXISTS exercise_aar (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID UNIQUE NOT NULL REFERENCES exercise_sessions(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id),
  strengths TEXT,
  weaknesses TEXT,
  gaps TEXT,
  recommendations TEXT,
  overall_rating INT CHECK (overall_rating BETWEEN 1 AND 5),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
