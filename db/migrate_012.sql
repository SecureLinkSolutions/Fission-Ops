-- Migration 012: add task_id to notifications
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS task_id UUID REFERENCES incident_tasks(id) ON DELETE SET NULL;
