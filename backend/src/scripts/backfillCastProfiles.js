/**
 * backfillCastProfiles.js
 *
 * Populates movies.cast_profiles (TMDb profile_path for each cast_list entry,
 * in the same order) for every movie in the DB.
 *
 * cast_profiles is a TEXT[] that mirrors cast_list — each element is the
 * TMDb profile_path (e.g. "/abc123.jpg") or null if the actor has no photo.
 *
 * Usage:
 *   node src/scripts/backfillCastProfiles.js          # only rows missing profiles
 *   node src/scripts/backfillCastProfiles.js --force  # re-fetch everything
 */

require('dotenv').config({ override: true });
const pool = require('../db/pool');

const TMDB_BASE = process.env.TMDB_BASE_URL || 'https://api.themoviedb.org/3';
const TMDB_KEY  = process.env.TMDB_API_KEY;
if (!TMDB_KEY) { console.error('TMDB_API_KEY missing'); process.exit(1); }

const FORCE    = process.argv.includes('--force');
const DELAY_MS = 150;
const sleep    = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Fetch cast credits for a movie and return parallel arrays:
 *   names[]   — actor names (same as cast_list)
 *   profiles[] — profile_path strings (null when missing)
 */
async function getCredits(tmdbId) {
  const url = `${TMDB_BASE}/movie/${tmdbId}/credits?api_key=${TMDB_KEY}`;
  const res  = await fetch(url);
  if (!res.ok) throw new Error(`TMDB ${res.status}`);
  const data = await res.json();
  const top10 = (data.cast || []).slice(0, 10);
  return {
    names:    top10.map((c) => c.name),
    profiles: top10.map((c) => c.profile_path || null),
  };
}

async function main() {
  const filter = FORCE
    ? ''
    : `WHERE cast_profiles IS NULL OR cardinality(cast_profiles) = 0`;

  const { rows } = await pool.query(
    `SELECT id, tmdb_id, title, year FROM movies ${filter} ORDER BY id`
  );
  console.log(`\nBackfilling cast_profiles for ${rows.length} movies (force=${FORCE})\n`);

  let ok = 0, failed = 0;
  for (let i = 0; i < rows.length; i++) {
    const m = rows[i];
    try {
      const { names, profiles } = await getCredits(m.tmdb_id);
      await pool.query(
        `UPDATE movies SET cast_list = $1, cast_profiles = $2, updated_at = NOW() WHERE id = $3`,
        [names, profiles, m.id]
      );
      ok++;
      if ((i + 1) % 25 === 0) console.log(`  ${i + 1}/${rows.length} — ${m.title}`);
    } catch (err) {
      failed++;
      console.log(`  ✗ ${m.title} (${m.year}) — ${err.message}`);
    }
    await sleep(DELAY_MS);
  }

  console.log(`\nDone. ok=${ok}  failed=${failed}`);
  await pool.end();
}

main().catch((err) => { console.error(err); process.exit(1); });
