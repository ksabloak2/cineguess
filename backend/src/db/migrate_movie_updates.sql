-- ─────────────────────────────────────────────────────────────────────────────
-- migrate_movie_updates.sql
--
-- 1. Fix Pretty Woman: replace the 1991 placeholder entry with the correct
--    1990 American film (TMDB ID 1585).
--
-- 2. Add The Drama (2026) to the top250 category.
--    Fill in the real TMDB ID before running — search at:
--    https://www.themoviedb.org/search?query=The+Drama+2026
--    and replace <<TMDB_ID_THE_DRAMA>> below.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Pretty Woman: update to correct 1990 version ─────────────────────────
UPDATE movies
SET
  tmdb_id = 1585,
  year    = 1990,
  updated_at = NOW()
WHERE
  title ILIKE 'Pretty Woman'
  AND (tmdb_id = 360731 OR year = 1991);

-- Verify (run separately to confirm):
-- SELECT id, tmdb_id, title, year, categories FROM movies WHERE title ILIKE 'Pretty Woman';

-- ── 2. The Drama (2026) — upsert into top250 ─────────────────────────────────
-- Prerequisites: frames must already be extracted and frame_images rows exist,
-- or the daily picker must not select it until frames are ready.
--
-- Replace <<TMDB_ID_THE_DRAMA>> with the real integer TMDB movie ID.
--
-- INSERT INTO movies (tmdb_id, title, year, categories)
-- VALUES (
--   <<TMDB_ID_THE_DRAMA>>,
--   'The Drama',
--   2026,
--   ARRAY['top250']
-- )
-- ON CONFLICT (tmdb_id) DO UPDATE
--   SET
--     categories = CASE
--       WHEN NOT ('top250' = ANY(movies.categories))
--       THEN array_append(movies.categories, 'top250')
--       ELSE movies.categories
--     END,
--     updated_at = NOW();

-- ─────────────────────────────────────────────────────────────────────────────
-- HOW TO RUN
-- ─────────────────────────────────────────────────────────────────────────────
-- psql $DATABASE_URL -f src/db/migrate_movie_updates.sql
-- ─────────────────────────────────────────────────────────────────────────────
