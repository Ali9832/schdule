CREATE TABLE IF NOT EXISTS project_reports (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  text TEXT NOT NULL CHECK (char_length(text) BETWEEN 1 AND 8000),
  report_date DATE NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS project_reports_owner_idx ON project_reports(user_id,project_id,created_at DESC);
CREATE INDEX IF NOT EXISTS project_reports_recent_idx ON project_reports(user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS planner_events_project_meetings_idx ON planner_events(user_id,project_id,start_at) WHERE type='meeting';
