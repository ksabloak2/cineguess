-- Adds AI-generated cryptic clue + TMDB backdrop frame URLs for the new hint system.
ALTER TABLE movies ADD COLUMN IF NOT EXISTS ai_hint_quote TEXT;
ALTER TABLE movies ADD COLUMN IF NOT EXISTS backdrop_paths TEXT[];
