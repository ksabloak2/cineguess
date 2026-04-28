/**
 * backfillSupportingActor.js
 *
 * Fetches TMDB credits for every movie in the DB and populates
 * the supporting_actor column with the second-billed cast member.
 *
 * Usage:
 *   node src/scripts/backfillSupportingActor.js
 */

require('dotenv').config();
const axios = require('axios');
const pool  = require('../db/pool');

const TMDB_BASE = process.env.TMDB_BASE_URL || 'https://api.themoviedb.org/3';
const TMDB_KEY  = process.env.TMDB_API_KEY;
const DELAY_MS  = 260;

if (!TMDB_KEY) { console.error('TMDB_API_KEY not set'); process.exit(1); }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const client = await pool.connect();

  let rows;
  try {
    const res = await client.query(
      `SELECT id, tmdb_id, title FROM movies ORDER BY id`
    );
    rows = res.rows;
  } finally {
    client.release();
  }

  console.log(`\nBackfilling supporting_actor for ${rows.length} movies...\n`);

  let updated = 0;
  let failed  = 0;

  for (let i = 0; i < rows.length; i++) {
    const { id, tmdb_id, title } = rows[i];
    process.stdout.write(`\r  [${i + 1}/${rows.length}] "${title}" — updated: ${updated}, failed: ${failed}   `);

    try {
      await sleep(DELAY_MS);
      const res = await axios.get(`${TMDB_BASE}/movie/${tmdb_id}/credits`, {
        params: { api_key: TMDB_KEY },
        timeout: 10000,
      });

      const cast = res.data.cast || [];
      const supportingActor = cast[1]?.name || null;  // second-billed cast member

      const c2 = await pool.connect();
      try {
        await c2.query(
          `UPDATE movies SET supporting_actor = $1, updated_at = NOW() WHERE id = $2`,
          [supportingActor, id]
        );
      } finally {
        c2.release();
      }

      updated++;
    } catch (err) {
      failed++;
    }
  }

  console.log(`\n\nDone!`);
  console.log(`  Updated: ${updated}`);
  console.log(`  Failed:  ${failed}`);

  process.exit(0);
}

main().catch((err) => {
  console.error('\nFatal:', err.message);
  process.exit(1);
});
