/**
 * buildPercentileSnapshot.js
 *
 * Queries the current streak distribution for every category and stores a
 * compact JSONB snapshot in the percentile_snapshots table.  The snapshot
 * lets getPercentiles / getFriendPercentiles answer "Top X% Globally" in a
 * single cheap row-lookup instead of running heavy CTE queries on every
 * request.
 *
 * Snapshot shape:
 *   {
 *     "top250":           { "total": 1500, "dist": [[30,1],[25,5],[20,12]] },
 *     "superhero":        { "total":  800, "dist": [[15,3],[10,40]]        },
 *     ...
 *   }
 *
 * "dist" rows are [streak_value, player_count] sorted descending by streak.
 * "total" is the count of players with current_streak > 0.
 *
 * Usage (manual):  node src/scripts/buildPercentileSnapshot.js
 * Usage (cron):    imported and called from server.js every 15 min.
 */

const pool   = require('../db/pool');
const logger = require('../utils/logger');

// Daily categories have avg_guesses as a tiebreaker (lower avg = better).
// Unlimited categories are streak-only (their guesses aren't in the daily table).
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
    // ── Daily categories: per-user (streak, avg_guesses) → distribution ──
    // Each entry in dist is [streak, avg_guesses, count].
    // Lower avg_guesses = better when streaks tie.
    const dailyResults = await Promise.all(
      DAILY_CATS.map((cat) =>
        client.query(
          `SELECT streak, avg_guesses, COUNT(*)::int AS cnt
           FROM (
             SELECT s.user_id,
                    s.current_streak AS streak,
                    ROUND(COALESCE(AVG(g.guesses_taken), 0)::numeric, 1) AS avg_guesses
             FROM streaks s
             LEFT JOIN guesses g
               ON g.user_id = s.user_id AND g.category = s.category AND g.won = true
             WHERE s.category = $1 AND s.current_streak > 0
             GROUP BY s.user_id, s.current_streak
           ) sub
           GROUP BY streak, avg_guesses
           ORDER BY streak DESC, avg_guesses ASC`,
          [cat]
        ).then(({ rows }) => ({ cat, rows }))
      )
    );

    // ── Unlimited categories: streak-only distribution ──
    // Each entry in dist is [streak, null, count].
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
      // dist: [streak, avg_guesses, count]
      const dist  = rows.map((r) => [Number(r.streak), Number(r.avg_guesses), Number(r.cnt)]);
      const total = dist.reduce((sum, [,, cnt]) => sum + cnt, 0);
      snapshotData[cat] = { total, dist };
    }

    for (const { cat, rows } of unlimitedResults) {
      // dist: [streak, null, count]  (null signals no avg tiebreaker)
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
