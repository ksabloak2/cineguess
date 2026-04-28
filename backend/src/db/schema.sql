-- CineGuess Database Schema

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ---------------------------------------------------------------
-- Movie pools (populated by fetchMovies script)
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS movies (
  id            SERIAL PRIMARY KEY,
  tmdb_id       INTEGER UNIQUE NOT NULL,
  title         TEXT NOT NULL,
  year          INTEGER,
  genres        TEXT[],          -- top 2 genres from TMDB
  director      TEXT,
  primary_language TEXT,
  oscar_nominated BOOLEAN DEFAULT FALSE,
  lead_actor    TEXT,
  popular_quote TEXT,
  poster_path   TEXT,
  imdb_id       TEXT,
  categories    TEXT[],          -- ['top250','superhero','animated','indiancinema']
  popularity    NUMERIC,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_movies_categories ON movies USING GIN(categories);
CREATE INDEX IF NOT EXISTS idx_movies_tmdb_id    ON movies(tmdb_id);

-- ---------------------------------------------------------------
-- Daily picks (one per category per day)
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS daily_picks (
  id         SERIAL PRIMARY KEY,
  category   TEXT NOT NULL,      -- 'top250' | 'superhero' | 'animated' | 'indiancinema'
  movie_id   INTEGER REFERENCES movies(id) ON DELETE CASCADE,
  pick_date  DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (category, pick_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_picks_date ON daily_picks(pick_date);

-- ---------------------------------------------------------------
-- Used movies (for repeat-prevention within 21 days)
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS used_movies (
  id             SERIAL PRIMARY KEY,
  category       TEXT NOT NULL,
  movie_id       INTEGER REFERENCES movies(id) ON DELETE CASCADE,
  last_used_date DATE NOT NULL,
  UNIQUE (category, movie_id)
);

-- ---------------------------------------------------------------
-- Users (mirrors Supabase Auth users; extended profile)
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id         UUID PRIMARY KEY,   -- matches Supabase auth.users.id
  username   TEXT UNIQUE NOT NULL,
  email      TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---------------------------------------------------------------
-- Guesses (one row per user per category per day)
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS guesses (
  id           SERIAL PRIMARY KEY,
  user_id      UUID REFERENCES users(id) ON DELETE CASCADE,
  category     TEXT NOT NULL,
  guess_date   DATE NOT NULL,
  guess_list   JSONB NOT NULL DEFAULT '[]', -- array of tmdb_ids in order guessed
  guesses_taken INTEGER,
  won          BOOLEAN,
  completed_at TIMESTAMPTZ,
  UNIQUE (user_id, category, guess_date)
);

CREATE INDEX IF NOT EXISTS idx_guesses_user_date ON guesses(user_id, guess_date);

-- ---------------------------------------------------------------
-- Streaks
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS streaks (
  id              SERIAL PRIMARY KEY,
  user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
  category        TEXT NOT NULL,
  current_streak  INTEGER DEFAULT 0,
  longest_streak  INTEGER DEFAULT 0,
  last_win_date   DATE,
  UNIQUE (user_id, category)
);

-- ---------------------------------------------------------------
-- Friends
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS friends (
  id           SERIAL PRIMARY KEY,
  requester_id UUID REFERENCES users(id) ON DELETE CASCADE,
  receiver_id  UUID REFERENCES users(id) ON DELETE CASCADE,
  status       TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'accepted'
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (requester_id, receiver_id)
);

CREATE INDEX IF NOT EXISTS idx_friends_receiver ON friends(receiver_id);
