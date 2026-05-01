/**
 * buildPercentileSnapshot.js
 *
 * Queries the current rating distribution for every category and stores a
 * compact JSONB snapshot in the percentile_snapshots table.  The snapshot
 * lets getPercentiles answer "Top X% Globally" in a single cheap row-lookup.
 *
 * Ranking uses the same Global Rating formula as the leaderboard:
 *   Global Rating = (current_streak × 10) + avg_score
 * Tiebreaker: lower avg_guesses (fewer attempts = better).
 *
 * Snapshot shape:
 *   {
 *     "top250": { "total": 1500, "dist": [[125.3, 2.1, 1], [110.0, 3.0, 5], ...] },
 *     ...
 *   }
 * "dist" rows are [global_rating, avg_guesses, count].
 * Unlimited categories remain streak-only (no score tracking there).
 *
 * Usage (manual):  node src/scripts/buildPercentileSnapshot.js
 * Usage (cron):    imported and called from server.js every 15 min.
 */

const pool   = require('../db/pool');
const logger = require('../utils/logger');

const DAILY_CATS    = ['top250', 'superhero', 'animated', 'indiancinema'];
const UNLIMITED_CATS = [
  'unlimited_top250', 'unlimited_superhero', 'unlimited_animated', 'unlimited_indiancinema',
];

// Keep only the most recent N snapshots to prevent unbounded table growth.
const KEEP_SNAPSHOTS = 10;

async function buildPercentileSnapshot() {
  const done   = logger.startTimer('percentile_snapshot');
  const client = await pool.connect();
  try {
    // ── Daily categories: per-user (global_rating, avg_guesses) → distribution ──
    // global_rating = (streak × 10) + avg_score  (matches leaderboard formula)
    // Tiebreaker: avg_guesses ASC (fewer attempts = better rank)
    const dailyResults = await Promise.all(
      DAILY_CATS.map((cat) =>
        client.query(
          `SELECT global_rating, avg_guesses, COUNT(*)::int AS cnt
           FROM (
             SELECT
               s.user_id,
               ROUND((
                 s.current_streak * 10
                 + COALESCE(AVG(g.score) FILTER (WHERE g.won = true AND g.score IS NOT NULL), 0)
               )::numeric, 1) AS global_rating,
               ROUND(COALESCE(AVG(g.guesses_taken) FILTER (WHERE g.won = true), 0)::numeric, 2) AS avg_guesses
             FROM streaks s
             LEFT JOIN guesses g
               ON g.user_id = s.user_id AND g.category = s.category
             WHERE s.category = $1 AND s.current_streak > 0
             GROUP BY s.user_id, s.current_streak
           ) sub
           GROUP BY global_rating, avg_guesses
           ORDER BY global_rating DESC, avg_guesses ASC`,
          [cat]
        ).then(({ rows }) => ({ cat, rows }))
      )
    );

    // ── Unlimited categories: streak-only distribution (unchanged) ──
    const unlimitedResults = await Promise.all(
      UNLIMITED_CATS.map((cat) =>
        client.query(
          `SELECT current_streak AS streak, COUNT(DISTINCT user_id)::int AS cnt
           FROM streaks
           WHERE category = $1 AND current_streak > 0
           GROUP BY current_streak
           ORDER BY current_streak DESC`,
          [cat]
        ).then(({ rows }) => ({ cat, rows, unlimited: true }))
      )
    );

    const snapshotData = {};

    for (const { cat, rows } of dailyResults) {
      // dist: [global_rating, avg_guesses, count]
      const dist  = rows.map((r) => [Number(r.global_rating), Number(r.avg_guesses), Number(r.cnt)]);
      const total = dist.reduce((sum, [,, cnt]) => sum + cnt, 0);
      snapshotData[cat] = { total, dist };
    }

    for (const { cat, rows } of unlimitedResults) {
      // dist: [streak, null, count]  (null signals streak-only, no rating tiebreaker)
      const dist  = rows.map((r) => [Number(r.streak), null, Number(r.cnt)]);
      const total = dist.reduce((sum, [,, cnt]) => sum + cnt, 0);
      snapshotData[cat] = { total, dist };
    }

    // Insert the new snapshot
    await client.query(
      `INSERT INTO percentile_snapshots (data) VALUES ($1)`,
      [JSON.stringify(snapshotData)]
    );

    // Prune old rows — keep the N most recent
    await client.query(
      `DELETE FROM percentile_snapshots
       WHERE id NOT IN (
         SELECT id FROM percentile_snapshots
         ORDER BY computed_at DESC
         LIMIT $1
       )`,
      [KEEP_SNAPSHOTS]
    );

    const duration_ms = done();
    logger.info(`Percentile snapshot built`, { meta: { duration_ms } });
  } catch (err) {
    logger.error(`Percentile snapshot failed: ${err.message}`, { stack: err.stack });
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { buildPercentileSnapshot };

// Allow direct invocation: `node src/scripts/buildPercentileSnapshot.js`
if (require.main === module) {
  buildPercentileSnapshot()
    .then(() => { console.log('[snapshot] Done.'); process.exit(0); })
    .catch((err) => { console.error(err); process.exit(1); });
}
