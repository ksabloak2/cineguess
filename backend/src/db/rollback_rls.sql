-- ============================================================
-- rollback_rls.sql — Remove all CineGUESS RLS policies
-- ============================================================
-- Run if you need to revert migrate_rls.sql:
--   psql $DATABASE_URL -f src/db/rollback_rls.sql

-- Drop all policies
DROP POLICY IF EXISTS "movies_select_all"         ON movies;
DROP POLICY IF EXISTS "daily_picks_select_all"    ON daily_picks;
DROP POLICY IF EXISTS "used_movies_select_all"    ON used_movies;
DROP POLICY IF EXISTS "app_settings_select_all"   ON app_settings;
DROP POLICY IF EXISTS "users_select_all"          ON users;
DROP POLICY IF EXISTS "users_update_own"          ON users;
DROP POLICY IF EXISTS "guesses_select_own"        ON guesses;
DROP POLICY IF EXISTS "guesses_insert_own"        ON guesses;
DROP POLICY IF EXISTS "guesses_update_own"        ON guesses;
DROP POLICY IF EXISTS "streaks_select_own"        ON streaks;
DROP POLICY IF EXISTS "streaks_insert_own"        ON streaks;
DROP POLICY IF EXISTS "streaks_update_own"        ON streaks;
DROP POLICY IF EXISTS "friends_select_own"        ON friends;
DROP POLICY IF EXISTS "friends_insert_own"        ON friends;
DROP POLICY IF EXISTS "friends_update_own"        ON friends;
DROP POLICY IF EXISTS "friends_delete_own"        ON friends;
DROP POLICY IF EXISTS "log_events_insert_auth"    ON log_events;

-- Disable RLS on all tables
ALTER TABLE users        DISABLE ROW LEVEL SECURITY;
ALTER TABLE guesses      DISABLE ROW LEVEL SECURITY;
ALTER TABLE streaks      DISABLE ROW LEVEL SECURITY;
ALTER TABLE friends      DISABLE ROW LEVEL SECURITY;
ALTER TABLE log_events   DISABLE ROW LEVEL SECURITY;
ALTER TABLE movies       DISABLE ROW LEVEL SECURITY;
ALTER TABLE daily_picks  DISABLE ROW LEVEL SECURITY;
ALTER TABLE used_movies  DISABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings DISABLE ROW LEVEL SECURITY;

SELECT 'RLS rollback complete' AS status;
