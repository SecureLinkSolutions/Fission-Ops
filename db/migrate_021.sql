-- Migration 021: Tabletop exercise participants, session inject releases, and incident linking

-- Link exercises to a real incident (optional -- enables parallel IR work)
ALTER TABLE tabletop_exercises ADD COLUMN IF NOT EXISTS incident_id UUID REFERENCES incidents(id) ON DELETE SET NULL;

-- Participants: IC adds users to an exercise
CREATE TABLE IF NOT EXISTS exercise_participants (
  exercise_id UUID NOT NULL REFERENCES tabletop_exercises(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  added_by UUID REFERENCES users(id),
  added_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (exercise_id, user_id)
);

-- Per-session inject release timestamps (separate from injects so same exercise can be run multiple times)
CREATE TABLE IF NOT EXISTS session_inject_releases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES exercise_sessions(id) ON DELETE CASCADE,
  inject_id UUID NOT NULL REFERENCES exercise_injects(id) ON DELETE CASCADE,
  released_by UUID REFERENCES users(id),
  released_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(session_id, inject_id)
);
