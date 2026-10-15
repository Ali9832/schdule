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
