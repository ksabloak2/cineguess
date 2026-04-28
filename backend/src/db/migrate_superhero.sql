-- Superhero-specific tile columns
ALTER TABLE movies
  ADD COLUMN IF NOT EXISTS superhero_universe  TEXT,
  ADD COLUMN IF NOT EXISTS hero_villain_focus  TEXT,
  ADD COLUMN IF NOT EXISTS solo_or_team        TEXT,
  ADD COLUMN IF NOT EXISTS superpower_type     TEXT;
