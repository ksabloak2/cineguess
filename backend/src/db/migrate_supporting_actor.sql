-- Add supporting_actor column (second-billed cast member from TMDB credits).
-- Run: psql $DATABASE_URL -f src/db/migrate_supporting_actor.sql
ALTER TABLE movies ADD COLUMN IF NOT EXISTS supporting_actor TEXT;
