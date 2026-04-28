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

const SNAPSHOT_CATEGORIES = [
  'top250', 'superhero', 'animated', 'indiancinema',
  'unlimited_top250', 'unlimited_superhero', 'unlimited_animated', 'unlimited_indiancinema',
];

// Keep only the most recent N snapshots to prevent unbounded table growth.
const KEEP_SNAPSHOTS = 10;

async function buildPercentileSnapshot() {
  const done   = logger.startTimer('percentile_snapshot');
  const client = await pool.connect();
  try {
    // Run all category queries in parallel to avoid serial round-trips.
    const results = await Promise.all(
      SNAPSHOT_CATEGORIES.map((cat) =>
        client.query(
          `SELECT current_streak AS streak, COUNT(DISTINCT user_id)::int AS cnt
           FROM streaks
           WHERE category = $1 AND current_streak > 0
           GROUP BY current_streak
           ORDER BY current_streak DESC`,
          [cat]
        ).then(({ rows }) => ({ cat, rows }))
      )
    );

    const snapshotData = {};
    for (const { cat, rows } of results) {
      const dist  = rows.map((r) => [Number(r.streak), Number(r.cnt)]);
      const total = dist.reduce((sum, [, cnt]) => sum + cnt, 0);
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
