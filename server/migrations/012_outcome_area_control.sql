-- NOVA V11.7 — measurable outcomes and area-control support
ALTER TABLE outcomes ADD COLUMN IF NOT EXISTS metric_name TEXT DEFAULT '';
ALTER TABLE outcomes ADD COLUMN IF NOT EXISTS baseline_value NUMERIC DEFAULT 0;
ALTER TABLE outcomes ADD COLUMN IF NOT EXISTS target_direction TEXT DEFAULT 'increase';
ALTER TABLE outcomes ADD COLUMN IF NOT EXISTS review_at DATE;
ALTER TABLE outcomes ADD COLUMN IF NOT EXISTS measurement_note TEXT DEFAULT '';
ALTER TABLE outcomes ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;
CREATE INDEX IF NOT EXISTS outcomes_area_id_idx ON outcomes(area_id);
CREATE INDEX IF NOT EXISTS outcomes_due_date_idx ON outcomes(user_id,due_date);
