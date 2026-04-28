/**
 * backfillCastList.js
 *
 * Populates movies.cast_list (top 10 billed cast) for every movie that's
 * missing it. Required for the Lead Actor tile's yellow state, which asks
 * "is the guess's lead actor anywhere in the target movie's cast?"
 *
 * Safe to run alongside other TMDB scripts — it only reads /movie/{id}/credits
 * and writes the cast_list column.
 *
 * Usage:
 *   node src/scripts/backfillCastList.js          # only missing rows
 *   node src/scripts/backfillCastList.js --force  # re-fetch everything
 */

require('dotenv').config({ override: true });
const pool = require('../db/pool');

const TMDB_BASE = process.env.TMDB_BASE_URL || 'https://api.themoviedb.org/3';
const TMDB_KEY  = process.env.TMDB_API_KEY;
if (!TMDB_KEY) { console.error('TMDB_API_KEY missing'); process.exit(1); }

const FORCE = process.argv.includes('--force');
const DELAY_MS = 120;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getCredits(tmdbId) {
  const url = `${TMDB_BASE}/movie/${tmdbId}/credits?api_key=${TMDB_KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`TMDB ${res.status}`);
  const data = await res.json();
  return (data.cast || []).slice(0, 10).map((c) => c.name);
}

async function main() {
  const filter = FORCE
    ? ''
    : `WHERE cast_list IS NULL OR cardinality(cast_list) = 0`;
  const { rows } = await pool.query(
    `SELECT id, tmdb_id, title, year FROM movies ${filter} ORDER BY id`
  );
  console.log(`\nBackfilling cast_list for ${rows.length} movies (force=${FORCE})\n`);

  let ok = 0, failed = 0;
  for (let i = 0; i < rows.length; i++) {
    const m = rows[i];
    try {
      const cast = await getCredits(m.tmdb_id);
      await pool.query(
        `UPDATE movies SET cast_list = $1, updated_at = NOW() WHERE id = $2`,
        [cast, m.id]
      );
      ok++;
      if ((i + 1) % 50 === 0) console.log(`  ${i + 1}/${rows.length}`);
    } catch (err) {
      failed++;
      console.log(`  ✗ ${m.title} (${m.year}) — ${err.message}`);
    }
    await sleep(DELAY_MS);
  }

  console.log(`\nDone. ok=${ok} failed=${failed}`);
  await pool.end();
}

main().catch((err) => { console.error(err); process.exit(1); });
