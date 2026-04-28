/**
 * switchBackdrops.js
 *
 * 1. Restore 3 Idiots + Bāhubali 2 back to their local /frames/ paths
 *    (the files were never deleted — we just need to point DB back at them).
 *
 * 2. Switch specified movies FROM local frames → TMDB backdrop images.
 *
 * Usage: node src/scripts/switchBackdrops.js
 */

require('dotenv').config({ override: true });
const fs   = require('fs');
const path = require('path');
const pool = require('../db/pool');

const FRAMES_DIR = path.join(__dirname, '..', '..', 'public', 'frames');
const TMDB_BASE  = process.env.TMDB_BASE_URL || 'https://api.themoviedb.org/3';
const TMDB_KEY   = process.env.TMDB_API_KEY;
if (!TMDB_KEY) { console.error('TMDB_API_KEY missing'); process.exit(1); }

async function tmdb(pathname, params = {}) {
  const qs = new URLSearchParams({ api_key: TMDB_KEY, ...params }).toString();
  const res = await fetch(`${TMDB_BASE}${pathname}?${qs}`);
  if (!res.ok) throw new Error(`TMDB ${res.status} for ${pathname}`);
  return res.json();
}

async function fetchTmdbBackdrops(tmdbId, max = 10) {
  const data = await tmdb(`/movie/${tmdbId}/images`, { include_image_language: 'null,en' });
  return (data.backdrops || [])
    .sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0))
    .slice(0, max)
    .map((b) => b.file_path);
}

// ── 1. Movies to restore to /frames/ ──────────────────────────────────────
const RESTORE_TO_FRAMES = [
  { tmdb_id: 20453,  title: '3 Idiots' },
  { tmdb_id: 350312, title: 'Bāhubali 2: The Conclusion' },
];

// ── 2. Movies to switch to TMDB backdrops ─────────────────────────────────
// title/year combos — we'll fuzzy-match by title ILIKE in the DB
const SWITCH_TO_TMDB = [
  { title: '500 Days of Summer',         year: 2009 },
  { title: 'The Minecraft Movie',        year: 2025 },
  { title: 'Brahmāstra: Part One – Shiva', year: 2022 },
  { title: 'Hasee Toh Phasee',           year: 2014 },
  { title: 'Jab We Met',                 year: 2007 },
  { title: 'Jawan',                      year: 2023 },
  { title: 'Killers of the Flower Moon', year: 2023 },
  { title: 'Oppenheimer',                year: 2023 }, // "Oboa" likely typo → skip, but let's try a search
  { title: 'Pathaan',                    year: 2023 },
  { title: 'Sinners',                    year: 2025 },
  { title: 'Superman',                   year: 2025 },
  { title: 'The Conjuring',             year: 2013 },
  { title: 'The Parent Trap',            year: 1998 },
  { title: 'Yeh Jawaani Hai Deewani',   year: 2013 },
];

// Additional search terms for fuzzy DB lookup (title ILIKE patterns)
const TMDB_SEARCH_PATTERNS = [
  { pattern: '%500 days of summer%',         year: 2009 },
  { pattern: '%minecraft%',                  year: 2025 },
  { pattern: '%brahm%stra%',                 year: 2022 },
  { pattern: '%hasee toh phasee%',           year: 2014 },
  { pattern: '%jab we met%',                 year: 2007 },
  { pattern: '%jawan%',                      year: 2023 },
  { pattern: '%killers of the flower moon%', year: 2023 },
  { pattern: '%pathaan%',                    year: 2023 },
  { pattern: '%sinners%',                    year: 2025 },
  { pattern: '%superman%',                   year: 2025 },
  { pattern: '%conjuring%',                  year: 2013 },
  { pattern: '%parent trap%',                year: 1998 },
  { pattern: '%yeh jawaani%',                year: 2013 },
];

// "Oboa" — likely Pathaan misspelling already covered, but also try standalone search
const EXTRA_PATTERN = { pattern: '%oboa%', year: null };

async function restoreFrames(client) {
  console.log('\n── Restoring /frames/ paths ────────────────────────────────────');
  for (const { tmdb_id, title } of RESTORE_TO_FRAMES) {
    // Find all frame files that exist on disk for this tmdb_id
    const framePaths = [];
    for (let i = 0; i < 10; i++) {
      const filename = `${tmdb_id}_${i}.jpg`;
      if (fs.existsSync(path.join(FRAMES_DIR, filename))) {
        framePaths.push(`/frames/${filename}`);
      }
    }
    if (!framePaths.length) {
      console.log(`  ⚠ ${title}: no frame files found on disk`);
      continue;
    }
    const { rowCount } = await client.query(
      `UPDATE movies SET backdrop_paths = $1, updated_at = NOW() WHERE tmdb_id = $2`,
      [framePaths, tmdb_id]
    );
    if (rowCount) {
      console.log(`  ✓ ${title}: restored ${framePaths.length} frame paths`);
    } else {
      console.log(`  ⚠ ${title}: no DB row found for tmdb_id=${tmdb_id}`);
    }
  }
}

async function switchToTmdb(client) {
  console.log('\n── Switching to TMDB backdrops ─────────────────────────────────');
  const seen = new Set();

  for (const { pattern, year } of TMDB_SEARCH_PATTERNS) {
    let queryText, queryParams;
    if (year) {
      queryText  = `SELECT id, tmdb_id, title, year FROM movies WHERE title ILIKE $1 AND year = $2`;
      queryParams = [pattern, year];
    } else {
      queryText  = `SELECT id, tmdb_id, title, year FROM movies WHERE title ILIKE $1`;
      queryParams = [pattern];
    }
    const { rows } = await client.query(queryText, queryParams);

    for (const movie of rows) {
      if (seen.has(movie.id)) continue;
      seen.add(movie.id);
      try {
        const backdrops = await fetchTmdbBackdrops(movie.tmdb_id);
        if (!backdrops.length) {
          console.log(`  ⚠ ${movie.title} (${movie.year}): no TMDB backdrops found`);
          continue;
        }
        await client.query(
          `UPDATE movies SET backdrop_paths = $1, updated_at = NOW() WHERE id = $2`,
          [backdrops, movie.id]
        );
        console.log(`  ✓ ${movie.title} (${movie.year}): ${backdrops.length} TMDB backdrop paths`);
      } catch (err) {
        console.log(`  ✗ ${movie.title} (${movie.year}): ${err.message}`);
      }
    }
    if (!rows.length) {
      console.log(`  · No match in DB for pattern "${pattern}"${year ? ` (${year})` : ''}`);
    }
  }

  // Extra: try "oboa" — user may have meant something else
  const { rows: extraRows } = await client.query(
    `SELECT id, tmdb_id, title, year FROM movies WHERE title ILIKE '%oboa%'`
  );
  if (!extraRows.length) {
    console.log(`  · "Oboa" — no DB match (possible typo; check title manually)`);
  } else {
    for (const movie of extraRows) {
      if (seen.has(movie.id)) continue;
      seen.add(movie.id);
      const backdrops = await fetchTmdbBackdrops(movie.tmdb_id).catch(() => []);
      if (backdrops.length) {
        await client.query(
          `UPDATE movies SET backdrop_paths = $1, updated_at = NOW() WHERE id = $2`,
          [backdrops, movie.id]
        );
        console.log(`  ✓ ${movie.title} (${movie.year}): ${backdrops.length} TMDB backdrop paths`);
      }
    }
  }
}

async function main() {
  console.log('CineGuess — Switch Backdrop Sources\n');
  const client = await pool.connect();
  try {
    await restoreFrames(client);
    await switchToTmdb(client);
    console.log('\n✅ Done. Rebuilding gallery...\n');
  } finally {
    client.release();
  }
  await pool.end();
}

main().catch((err) => { console.error('Fatal:', err); process.exit(1); });
