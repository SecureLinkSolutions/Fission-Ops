-- Fix exercise_sessions foreign key to cascade on exercise delete
ALTER TABLE exercise_sessions
  DROP CONSTRAINT IF EXISTS exercise_sessions_exercise_id_fkey;

ALTER TABLE exercise_sessions
  ADD CONSTRAINT exercise_sessions_exercise_id_fkey
  FOREIGN KEY (exercise_id) REFERENCES tabletop_exercises(id) ON DELETE CASCADE;
