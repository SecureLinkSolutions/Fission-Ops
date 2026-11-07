-- Post-Incident Report (PIR): one analyst-authored narrative record per
-- incident, plus a template choice controlling how much live incident data
-- gets included when the report is rendered/exported.
CREATE TABLE IF NOT EXISTS incident_pir_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID NOT NULL UNIQUE REFERENCES incidents(id) ON DELETE CASCADE,
  template TEXT NOT NULL DEFAULT 'full' CHECK (template IN ('full', 'executive')),
  prepared_by TEXT,
  classification TEXT,
  executive_summary TEXT,
  root_cause TEXT,
  impact_assessment TEXT,
  response_summary TEXT,
  lessons_learned TEXT,
  recommendations TEXT,
  updated_by UUID NOT NULL REFERENCES users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
