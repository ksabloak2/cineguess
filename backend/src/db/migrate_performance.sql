-- =============================================================================
-- CineGuess Performance Migration
-- Run once: psql $DATABASE_URL -f src/db/migrate_performance.sql
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Movie search indexes
--    • idx_movies_title_lower  → fast ILIKE / lower() searches
--    • idx_movies_year         → fast year-range filtering
--    • idx_movies_categories   → fast WHERE $1 = ANY(categories)
--    • idx_movies_popularity   → ORDER BY popularity DESC (used in getMoviePool)
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_movies_title_lower
  ON movies (lower(title));

CREATE INDEX IF NOT EXISTS idx_movies_year
  ON movies (year);

CREATE INDEX IF NOT EXISTS idx_movies_categories
  ON movies USING GIN (categories);

CREATE INDEX IF NOT EXISTS idx_movies_popularity
  ON movies (popularity DESC NULLS LAST);

-- ---------------------------------------------------------------------------
-- 2. Daily-pick lookup index
--    Used in getDailyState and submitGuess on every request.
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_daily_picks_lookup
  ON daily_picks (category, pick_date);

-- ---------------------------------------------------------------------------
-- 3. Guesses table indexes
--    • user_date composite → fetch a user's guess for a given day (O(1))
--    • user_category       → fetch all guesses for a user+category (calendar)
--    • category_date       → server-side stats queries
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_guesses_user_date
  ON guesses (user_id, guess_date);

CREATE INDEX IF NOT EXISTS idx_guesses_user_category
  ON guesses (user_id, category);

CREATE INDEX IF NOT EXISTS idx_guesses_category_date
  ON guesses (category, guess_date DESC);

-- ---------------------------------------------------------------------------
-- 4. Streaks table indexes
--    • user_category (UNIQUE enforced by upsert) → single-row lookups
--    • category_streak DESC → percentile distribution queries
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_streaks_user_cat
  ON streaks (user_id, category);

CREATE INDEX IF NOT EXISTS idx_streaks_cat_streak
  ON streaks (category, current_streak DESC)
  WHERE current_streak > 0;

-- ---------------------------------------------------------------------------
-- 5. Friends table indexes
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_friends_lookup
  ON friends (requester_id, receiver_id, status);

CREATE INDEX IF NOT EXISTS idx_friends_receiver
  ON friends (receiver_id, status);

-- ---------------------------------------------------------------------------
-- 6. Percentile snapshots table
--    Stores precomputed streak distributions. Built every 15 min by cron.
--    schema: { category: { total: N, dist: [[streak, count], ...] } }
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS percentile_snapshots (
  id          SERIAL PRIMARY KEY,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  data        JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_snapshots_time
  ON percentile_snapshots (computed_at DESC);

-- Seed an empty snapshot so getPercentiles never 404s on first deploy
INSERT INTO percentile_snapshots (data)
SELECT '{}'::JSONB
WHERE NOT EXISTS (SELECT 1 FROM percentile_snapshots);
