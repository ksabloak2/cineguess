-- Adds a column to store the names of Oscar categories a movie actually WON.
-- Used as a richer fallback when oscar_nomination_categories is empty.
ALTER TABLE movies
  ADD COLUMN IF NOT EXISTS oscar_win_categories JSONB DEFAULT '[]';
