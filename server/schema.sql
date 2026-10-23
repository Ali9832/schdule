-- NOVA V11.12 Final canonical PostgreSQL schema.
-- Core canonical entities are relational; compatibility and selected personal modules
-- may still use user_life_data JSONB while the staged migration remains backward-compatible.

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  due_date DATE,
  color TEXT DEFAULT '#7165f3',
  icon TEXT DEFAULT '✦',
  status TEXT DEFAULT 'in_progress',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  due_date DATE,
  priority TEXT DEFAULT 'medium',
  status TEXT DEFAULT 'todo',
  estimate_minutes INTEGER DEFAULT 30,
  category TEXT DEFAULT 'شخصی',
  tags JSONB DEFAULT '[]'::jsonb,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'شخصی';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS tags JSONB DEFAULT '[]'::jsonb;

CREATE TABLE IF NOT EXISTS activity (
  id UUID PRIMARY KEY,
  kind TEXT DEFAULT 'default',
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS planner_events (
  id UUID PRIMARY KEY,
  title TEXT NOT NULL,
  type TEXT DEFAULT 'focus',
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  color TEXT DEFAULT '#7165f3',
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS planner_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS life_data (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS roles (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS activity_logs (
  id UUID PRIMARY KEY,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_settings (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_life_data (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE activity ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE planner_events ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS activity_created_at_idx ON activity (created_at DESC);
CREATE INDEX IF NOT EXISTS tasks_project_id_idx ON tasks (project_id);
CREATE INDEX IF NOT EXISTS tasks_due_date_idx ON tasks (due_date);
CREATE INDEX IF NOT EXISTS planner_events_start_at_idx ON planner_events (start_at);
CREATE INDEX IF NOT EXISTS activity_logs_created_at_idx ON activity_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS tasks_user_id_idx ON tasks (user_id);
CREATE INDEX IF NOT EXISTS projects_user_id_idx ON projects (user_id);
CREATE INDEX IF NOT EXISTS planner_events_user_id_idx ON planner_events (user_id);
CREATE INDEX IF NOT EXISTS activity_user_id_idx ON activity (user_id);

INSERT INTO roles (name, permissions) VALUES
  ('owner', '{"manage_tasks":true,"manage_projects":true,"manage_finance":true,"use_ai":true}'::jsonb)
  ON CONFLICT (name) DO NOTHING;


-- ============================================================
-- NOVA V11 — Canonical entity architecture
-- One source of truth, many linked views.
-- ============================================================

CREATE TABLE IF NOT EXISTS areas (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  icon TEXT DEFAULT '◫',
  status TEXT DEFAULT 'active',
  standard TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, name)
);

CREATE TABLE IF NOT EXISTS outcomes (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  area_id UUID REFERENCES areas(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'active',
  target_value NUMERIC DEFAULT 0,
  current_value NUMERIC DEFAULT 0,
  unit TEXT DEFAULT '',
  due_date DATE,
  next_action TEXT DEFAULT '',
  note TEXT DEFAULT '',
  metric_name TEXT DEFAULT '',
  baseline_value NUMERIC DEFAULT 0,
  target_direction TEXT DEFAULT 'increase',
  review_at DATE,
  measurement_note TEXT DEFAULT '',
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE outcomes ADD COLUMN IF NOT EXISTS metric_name TEXT DEFAULT '';
ALTER TABLE outcomes ADD COLUMN IF NOT EXISTS baseline_value NUMERIC DEFAULT 0;
ALTER TABLE outcomes ADD COLUMN IF NOT EXISTS target_direction TEXT DEFAULT 'increase';
ALTER TABLE outcomes ADD COLUMN IF NOT EXISTS review_at DATE;
ALTER TABLE outcomes ADD COLUMN IF NOT EXISTS measurement_note TEXT DEFAULT '';
ALTER TABLE outcomes ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS routines (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  area_id UUID REFERENCES areas(id) ON DELETE SET NULL,
  routine_type TEXT DEFAULT 'general',
  description TEXT DEFAULT '',
  target_weekly INTEGER DEFAULT 1,
  status TEXT DEFAULT 'active',
  color TEXT DEFAULT '#7165f3',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS routine_logs (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  routine_id UUID NOT NULL REFERENCES routines(id) ON DELETE CASCADE,
  log_date DATE NOT NULL,
  value BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, routine_id, log_date)
);

CREATE TABLE IF NOT EXISTS resources (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  area_id UUID REFERENCES areas(id) ON DELETE SET NULL,
  resource_type TEXT DEFAULT 'note',
  status TEXT DEFAULT 'backlog',
  url TEXT DEFAULT '',
  note TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS meeting_details (
  event_id UUID PRIMARY KEY REFERENCES planner_events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  area_id UUID REFERENCES areas(id) ON DELETE SET NULL,
  participants JSONB DEFAULT '[]'::jsonb,
  agenda TEXT DEFAULT '',
  pre_read TEXT DEFAULT '',
  summary TEXT DEFAULT '',
  decisions JSONB DEFAULT '[]'::jsonb,
  action_items JSONB DEFAULT '[]'::jsonb,
  waiting_items JSONB DEFAULT '[]'::jsonb,
  next_meeting_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS entity_links (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL,
  source_id UUID NOT NULL,
  relation TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, source_type, source_id, relation, target_type, target_id)
);

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS area_id UUID REFERENCES areas(id) ON DELETE SET NULL;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS context TEXT DEFAULT '';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS energy TEXT DEFAULT '';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS waiting_on TEXT DEFAULT '';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS resume_note TEXT DEFAULT '';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS source_meeting_id UUID REFERENCES planner_events(id) ON DELETE SET NULL;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;

ALTER TABLE projects ADD COLUMN IF NOT EXISTS area_id UUID REFERENCES areas(id) ON DELETE SET NULL;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS outcome TEXT DEFAULT '';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS lifecycle_status TEXT DEFAULT 'active';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS review_at DATE;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS last_touched_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE projects ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;

ALTER TABLE planner_events ADD COLUMN IF NOT EXISTS area_id UUID REFERENCES areas(id) ON DELETE SET NULL;
ALTER TABLE planner_events ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS areas_user_id_idx ON areas(user_id);
CREATE INDEX IF NOT EXISTS outcomes_user_id_idx ON outcomes(user_id);
CREATE INDEX IF NOT EXISTS routines_user_id_idx ON routines(user_id);
CREATE INDEX IF NOT EXISTS routine_logs_user_date_idx ON routine_logs(user_id, log_date);
CREATE INDEX IF NOT EXISTS resources_user_id_idx ON resources(user_id);
CREATE INDEX IF NOT EXISTS entity_links_source_idx ON entity_links(user_id, source_type, source_id);
CREATE INDEX IF NOT EXISTS entity_links_target_idx ON entity_links(user_id, target_type, target_id);
CREATE INDEX IF NOT EXISTS tasks_area_id_idx ON tasks(area_id);
CREATE INDEX IF NOT EXISTS projects_area_id_idx ON projects(area_id);

ALTER TABLE resources ADD COLUMN IF NOT EXISTS author TEXT DEFAULT '';
ALTER TABLE resources ADD COLUMN IF NOT EXISTS source_name TEXT DEFAULT '';
ALTER TABLE resources ADD COLUMN IF NOT EXISTS started_at DATE;
ALTER TABLE resources ADD COLUMN IF NOT EXISTS completed_at DATE;
ALTER TABLE resources ADD COLUMN IF NOT EXISTS progress_percent INTEGER NOT NULL DEFAULT 0;
ALTER TABLE resources ADD COLUMN IF NOT EXISTS next_action TEXT DEFAULT '';
ALTER TABLE resources ADD COLUMN IF NOT EXISTS key_takeaways TEXT DEFAULT '';
ALTER TABLE resources ADD COLUMN IF NOT EXISTS learning_output TEXT DEFAULT '';
ALTER TABLE resources ADD COLUMN IF NOT EXISTS rating INTEGER NOT NULL DEFAULT 0;
ALTER TABLE resources ADD COLUMN IF NOT EXISTS last_reviewed_at DATE;
ALTER TABLE resources ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;
CREATE INDEX IF NOT EXISTS resources_user_status_idx ON resources(user_id, status);
CREATE INDEX IF NOT EXISTS resources_user_area_idx ON resources(user_id, area_id);


-- NOVA V11.9 — Health, Energy & Sustainable Performance
CREATE TABLE IF NOT EXISTS health_metric_definitions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'custom',
  unit TEXT DEFAULT '',
  value_type TEXT NOT NULL DEFAULT 'number',
  target_min NUMERIC,
  target_max NUMERIC,
  good_direction TEXT NOT NULL DEFAULT 'range',
  icon TEXT DEFAULT '•',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, slug)
);

CREATE TABLE IF NOT EXISTS health_metric_logs (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  metric_id UUID NOT NULL REFERENCES health_metric_definitions(id) ON DELETE CASCADE,
  log_date DATE NOT NULL,
  value_numeric NUMERIC,
  value_text TEXT DEFAULT '',
  note TEXT DEFAULT '',
  source TEXT DEFAULT 'manual',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, metric_id, log_date)
);

CREATE INDEX IF NOT EXISTS health_metrics_user_idx ON health_metric_definitions(user_id, active, sort_order);
CREATE INDEX IF NOT EXISTS health_logs_user_date_idx ON health_metric_logs(user_id, log_date DESC);
CREATE INDEX IF NOT EXISTS health_logs_metric_date_idx ON health_metric_logs(metric_id, log_date DESC);

-- NOVA V11.10 — Relationships, People & Commitments
CREATE TABLE IF NOT EXISTS people (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  relation_type TEXT NOT NULL DEFAULT 'سایر',
  organization TEXT DEFAULT '',
  contact TEXT DEFAULT '',
  tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  cadence_days INTEGER NOT NULL DEFAULT 0,
  last_contact_at DATE,
  next_contact_at DATE,
  important_date DATE,
  important_date_label TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS relationship_commitments (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  direction TEXT NOT NULL DEFAULT 'i_owe',
  kind TEXT NOT NULL DEFAULT 'commitment',
  status TEXT NOT NULL DEFAULT 'open',
  due_date DATE,
  task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  meeting_event_id UUID REFERENCES planner_events(id) ON DELETE SET NULL,
  note TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS people_user_status_idx ON people(user_id, status, name);
CREATE INDEX IF NOT EXISTS people_user_followup_idx ON people(user_id, next_contact_at);
CREATE INDEX IF NOT EXISTS relationship_commitments_user_status_idx ON relationship_commitments(user_id, status, due_date);
CREATE INDEX IF NOT EXISTS relationship_commitments_person_idx ON relationship_commitments(person_id, status);



-- NOVA V11.11 — Spiritual & Religious Integration
-- Spiritual is a specialized view over canonical routines.
-- Religious occasions are specialized details over canonical planner_events(type='religious').

CREATE TABLE IF NOT EXISTS spiritual_routine_details (
  routine_id UUID PRIMARY KEY REFERENCES routines(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  intention TEXT DEFAULT '',
  preferred_time TEXT DEFAULT '',
  minimum_action TEXT DEFAULT '',
  reflection_prompt TEXT DEFAULT '',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS religious_event_details (
  event_id UUID PRIMARY KEY REFERENCES planner_events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  observance_notes TEXT DEFAULT '',
  preparation_notes TEXT DEFAULT '',
  reminder_days INTEGER NOT NULL DEFAULT 1 CHECK (reminder_days >= 0 AND reminder_days <= 365),
  source_label TEXT DEFAULT 'manual',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS spiritual_routine_details_user_idx ON spiritual_routine_details(user_id);
CREATE INDEX IF NOT EXISTS religious_event_details_user_idx ON religious_event_details(user_id);
CREATE INDEX IF NOT EXISTS planner_events_religious_idx ON planner_events(user_id, start_at) WHERE type='religious';

CREATE TABLE IF NOT EXISTS calendar_attachments (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source TEXT NOT NULL CHECK (source IN ('task','event','project','outcome')),
  entity_id TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  size INTEGER NOT NULL CHECK (size > 0 AND size <= 2097152),
  bytes BYTEA NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS calendar_attachments_owner_idx ON calendar_attachments(user_id,source,entity_id);

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
