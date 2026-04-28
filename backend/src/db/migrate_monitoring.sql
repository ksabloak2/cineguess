-- =============================================================================
-- CineGuess Monitoring Migration
-- Run once: psql $DATABASE_URL -f src/db/migrate_monitoring.sql
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. log_events — centralised event log for both server and client errors.
--    level: 'error' | 'warn' | 'info'
--    source: 'server' | 'client'
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS log_events (
  id          BIGSERIAL PRIMARY KEY,
  level       TEXT        NOT NULL DEFAULT 'error',  -- 'error' | 'warn' | 'info'
  source      TEXT        NOT NULL DEFAULT 'server', -- 'server' | 'client'
  message     TEXT        NOT NULL,
  stack       TEXT,                                  -- full stack trace if available
  url         TEXT,                                  -- page URL (client errors)
  browser     TEXT,                                  -- User-Agent (client errors)
  meta        JSONB,                                 -- arbitrary extra context
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Fast tail-log queries (newest first)
CREATE INDEX IF NOT EXISTS idx_log_events_created
  ON log_events (created_at DESC);

-- Filter by level/source
CREATE INDEX IF NOT EXISTS idx_log_events_level_source
  ON log_events (level, source, created_at DESC);

-- Auto-prune: keep only the last 30 days of logs via a partial index hint.
-- Actual deletion is handled by the nightly cron in server.js.

-- ---------------------------------------------------------------------------
-- 2. app_settings — simple key/value store for operational toggles.
--    maintenance_mode: 'true' | 'false'
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app_settings (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default settings (idempotent)
INSERT INTO app_settings (key, value)
VALUES ('maintenance_mode', 'false')
ON CONFLICT (key) DO NOTHING;
