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
