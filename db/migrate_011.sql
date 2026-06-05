CREATE TABLE IF NOT EXISTS task_comments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id     UUID NOT NULL REFERENCES incident_tasks(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id),
  content     TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
