-- Stores the current unlimited mode round per authenticated user per category.
-- Allows the game state to be restored on any device/browser.
CREATE TABLE IF NOT EXISTS unlimited_sessions (
  id                   SERIAL PRIMARY KEY,
  user_id              UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category             TEXT NOT NULL,
  target_tmdb_id       INTEGER NOT NULL,
  guesses              JSONB DEFAULT '[]',
  game_over            BOOLEAN DEFAULT FALSE,
  won                  BOOLEAN DEFAULT NULL,
  hints_revealed       JSONB DEFAULT '[]',
  hints_revealed_count INTEGER DEFAULT 0,
  started_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, category)
);
