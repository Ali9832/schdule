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
