-- Add publisher column for yellow-match logic on universe tile
ALTER TABLE movies
  ADD COLUMN IF NOT EXISTS superhero_publisher TEXT;
