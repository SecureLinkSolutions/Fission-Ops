-- Task entity assignments (many-to-many)
CREATE TABLE IF NOT EXISTS task_entities (
  task_id   UUID NOT NULL REFERENCES incident_tasks(id) ON DELETE CASCADE,
  entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, entity_id)
);
