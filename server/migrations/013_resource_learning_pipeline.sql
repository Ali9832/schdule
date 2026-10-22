-- ============================================================
-- NOVA V11.8 — Knowledge, Learning & Resource Pipeline
-- Capture -> Backlog -> Active Learning -> Synthesis -> Applied -> Archive
-- ============================================================
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
