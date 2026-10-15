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
