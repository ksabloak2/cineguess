-- ============================================================
-- migrate_rls.sql — Row Level Security policies for CineGUESS
-- ============================================================
-- Run ONCE against the production database:
--   psql $DATABASE_URL -f src/db/migrate_rls.sql
--
-- PURPOSE
-- -------
-- The backend uses SUPABASE_SERVICE_ROLE_KEY (bypasses RLS) for all
-- legitimate API calls, so these policies have zero impact on normal
-- app traffic.  Their value is defense-in-depth:
--   • A compromised ANON_KEY cannot be used to read other users' data.
--   • Direct Supabase SDK calls from a rogue client are blocked.
--   • Data exfiltration via the REST/GraphQL auto-API is prevented.
--
-- ROLLBACK
-- --------
--   psql $DATABASE_URL -f src/db/rollback_rls.sql
-- ============================================================

-- ── Enable RLS on every user-data table ──────────────────────────────────────

ALTER TABLE users           ENABLE ROW LEVEL SECURITY;
ALTER TABLE guesses         ENABLE ROW LEVEL SECURITY;
ALTER TABLE streaks         ENABLE ROW LEVEL SECURITY;
ALTER TABLE friends         ENABLE ROW LEVEL SECURITY;
ALTER TABLE log_events      ENABLE ROW LEVEL SECURITY;

-- Read-only tables — any authenticated or anonymous user may SELECT,
-- but nobody may INSERT/UPDATE/DELETE via the auto-API.
ALTER TABLE movies          ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_picks     ENABLE ROW LEVEL SECURITY;
ALTER TABLE used_movies     ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings    ENABLE ROW LEVEL SECURITY;

-- ── movies — public read, no writes via auto-API ─────────────────────────────

CREATE POLICY "movies_select_all"
  ON movies FOR SELECT
  USING (true);

-- ── daily_picks — public read, no writes ─────────────────────────────────────

CREATE POLICY "daily_picks_select_all"
  ON daily_picks FOR SELECT
  USING (true);

-- ── used_movies — public read, no writes ─────────────────────────────────────

CREATE POLICY "used_movies_select_all"
  ON used_movies FOR SELECT
  USING (true);

-- ── app_settings — public read, no writes ────────────────────────────────────

CREATE POLICY "app_settings_select_all"
  ON app_settings FOR SELECT
  USING (true);

-- ── users — users can read any profile (for friend search / leaderboards)
--            but can only UPDATE their own row ──────────────────────────────

CREATE POLICY "users_select_all"
  ON users FOR SELECT
  USING (true);

CREATE POLICY "users_update_own"
  ON users FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- No direct INSERT — the backend's registerProfile endpoint handles this
-- via service role.  Block it from the auto-API.

-- ── guesses — users can only see and insert their own rows ───────────────────

CREATE POLICY "guesses_select_own"
  ON guesses FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "guesses_insert_own"
  ON guesses FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "guesses_update_own"
  ON guesses FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── streaks — users can only see and modify their own rows ───────────────────

CREATE POLICY "streaks_select_own"
  ON streaks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "streaks_insert_own"
  ON streaks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "streaks_update_own"
  ON streaks FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── friends — users can see rows where they are requester OR receiver ─────────

CREATE POLICY "friends_select_own"
  ON friends FOR SELECT
  USING (auth.uid() = requester_id OR auth.uid() = receiver_id);

CREATE POLICY "friends_insert_own"
  ON friends FOR INSERT
  WITH CHECK (auth.uid() = requester_id);

CREATE POLICY "friends_update_own"
  ON friends FOR UPDATE
  USING (auth.uid() = requester_id OR auth.uid() = receiver_id)
  WITH CHECK (auth.uid() = requester_id OR auth.uid() = receiver_id);

CREATE POLICY "friends_delete_own"
  ON friends FOR DELETE
  USING (auth.uid() = requester_id OR auth.uid() = receiver_id);

-- ── log_events — insert-only for authenticated users; no SELECT via auto-API
--                (logs may contain stack traces — keep them server-only) ──────

CREATE POLICY "log_events_insert_auth"
  ON log_events FOR INSERT
  WITH CHECK (true);   -- anyone (including anon) may POST an error report

-- No SELECT policy → nobody can read logs via the auto-API.

-- ── Verification ─────────────────────────────────────────────────────────────
-- After running, confirm all tables have RLS enabled:
--   SELECT tablename, rowsecurity
--   FROM pg_tables
--   WHERE schemaname = 'public'
--   ORDER BY tablename;
