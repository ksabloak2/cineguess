-- Add cast_list to movies for Bollywood "lead actor in cast" yellow check
ALTER TABLE movies ADD COLUMN IF NOT EXISTS cast_list TEXT[];
