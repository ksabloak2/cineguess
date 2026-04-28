-- Animated-category specific metadata columns
ALTER TABLE movies
  ADD COLUMN IF NOT EXISTS animation_style    TEXT,
  ADD COLUMN IF NOT EXISTS animation_studio   TEXT,
  ADD COLUMN IF NOT EXISTS has_sequel         BOOLEAN,
  ADD COLUMN IF NOT EXISTS protagonist_type   TEXT,
  ADD COLUMN IF NOT EXISTS is_musical         BOOLEAN;
