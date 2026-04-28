/**
 * Populate movies.backdrop_paths from TMDB /movie/{id}/images.
 *
 * Prefers "textless" backdrops (iso_639_1 = null), i.e. clean in-movie stills
 * without title cards, logos, or taglines overlaid. Falls back to English-text
 * backdrops only if a movie has no textless ones.
 *
 * Results are shuffled (not sorted by vote_average) so we don't bias toward
 * the iconic poster-like shots — those are usually the giveaway frames.
 *
 * Usage: node src/scripts/populateBackdrops.js [--force]
 *   --force   Re-fetch even movies that already have backdrop_paths populated.
 */

const { Pool } = require('pg');
require('dotenv').config();

const TMDB_API_KEY = process.env.TMDB_API_KEY;
if (!TMDB_API_KEY) {
  console.error('Missing TMDB_API_KEY in .env');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const FORCE = process.argv.includes('--force');
const MAX_BACKDROPS = 10;

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function fetchBackdrops(tmdbId) {
  // Ask for both textless and English — then filter to textless first.
  const url = `https://api.themoviedb.org/3/movie/${tmdbId}/images?api_key=${TMDB_API_KEY}&include_image_language=null,en`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`TMDB ${res.status} for ${tmdbId}`);
  }
  const data = await res.json();
  const all = data.backdrops || [];

  // Textless only — these are the clean in-movie stills we want.
  const textless = all.filter((b) => b.iso_639_1 === null);

  // Fall back to the full set (including text overlays) if a movie has no
  // textless backdrops at all — better than showing nothing.
  const source = textless.length > 0 ? textless : all;

  return shuffle(source).slice(0, MAX_BACKDROPS).map((b) => b.file_path);
}

async function main() {
  const filter = FORCE
    ? ''
    : `WHERE backdrop_paths IS NULL OR cardinality(backdrop_paths) = 0`;

  const { rows: movies } = await pool.query(
    `SELECT id, tmdb_id, title, year, categories FROM movies ${filter} ORDER BY title`
  );

  console.log(`Processing ${movies.length} movies (force=${FORCE})...\n`);

  const empty = [];
  let updated = 0;
  let failed = 0;

  for (let i = 0; i < movies.length; i++) {
    const m = movies[i];
    try {
      const paths = await fetchBackdrops(m.tmdb_id);
      await pool.query(
        `UPDATE movies SET backdrop_paths = $1, updated_at = NOW() WHERE id = $2`,
        [paths, m.id]
      );
      if (paths.length === 0) {
        empty.push(`${m.title} (${m.year}) [${m.categories.join(',')}]`);
        process.stdout.write('·');
      } else {
        updated++;
        process.stdout.write('.');
      }
    } catch (err) {
      failed++;
      console.log(`\n  ✗ ${m.title} (${m.year}): ${err.message}`);
    }

    if ((i + 1) % 50 === 0) process.stdout.write(` ${i + 1}\n`);

    // gentle rate limit — TMDB allows ~50 req/s but be polite
    await new Promise((r) => setTimeout(r, 30));
  }

  console.log(`\n\nDone. updated=${updated} empty=${empty.length} failed=${failed}\n`);

  if (empty.length) {
    console.log(`Movies with NO backdrops on TMDB (${empty.length}):`);
    empty.forEach((t) => console.log('  ' + t));
  }

  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
