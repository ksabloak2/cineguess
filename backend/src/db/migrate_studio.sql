-- Add production_studio column to movies table
-- Used by the Most Popular (top250) category to replace the Language tile.
ALTER TABLE movies ADD COLUMN IF NOT EXISTS production_studio TEXT;
