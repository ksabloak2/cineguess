/**
 * fixGallery.js
 *
 * One-shot fix for the gallery state:
 *
 *  1. Run all pending DB deletions from migrate_indiancinema.sql
 *     (Ghibli cleanup, Disney cleanup, The Losers, Indian Cinema orphans,
 *      bollywood→indiancinema rename — safe to re-run because array_remove
 *      and conditional DELETEs are idempotent).
 *
 *  2. Revert 3 movies that were force-extracted from YouTube back to TMDB
 *     backdrop images (user explicitly requested TMDB photos for these):
 *       • 3 Idiots (2009)
 *       • Bāhubali 2: The Conclusion (2017)
 *       • Kalki 2898-AD (2024)
 *
 * After this script run:
 *   node src/scripts/cleanupFrames.js   ← deletes orphaned .jpg files
 *   node src/scripts/buildFrameGallery.js ← rebuilds index.html
 */

require('dotenv').config({ override: true });
const pool = require('../db/pool');

const TMDB_BASE = process.env.TMDB_BASE_URL || 'https://api.themoviedb.org/3';
const TMDB_KEY  = process.env.TMDB_API_KEY;
if (!TMDB_KEY) { console.error('TMDB_API_KEY missing'); process.exit(1); }

async function tmdb(pathname, params = {}) {
  const qs = new URLSearchParams({ api_key: TMDB_KEY, ...params }).toString();
  const res = await fetch(`${TMDB_BASE}${pathname}?${qs}`);
  if (!res.ok) throw new Error(`TMDB ${res.status} for ${pathname}`);
  return res.json();
}

async function fetchTmdbBackdrops(tmdbId, max = 10) {
  const data = await tmdb(`/movie/${tmdbId}/images`, { include_image_language: 'null,en' });
  const backdrops = (data.backdrops || [])
    .sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0))
    .slice(0, max)
    .map((b) => b.file_path);
  return backdrops;
}

async function step1_runMigrations(client) {
  console.log('\n── Step 1: DB migrations (idempotent) ──────────────────────────');

  // ── Rename bollywood → indiancinema ────────────────────────────────────────
  const r1 = await client.query(
    `UPDATE movies SET categories = array_replace(categories, 'bollywood', 'indiancinema')
     WHERE 'bollywood' = ANY(categories)`
  );
  console.log(`  bollywood→indiancinema movies: ${r1.rowCount}`);

  // daily_picks has a UNIQUE(category, pick_date) constraint.
  // If indiancinema already exists for the same pick_date, delete the bollywood
  // duplicate rather than trying to rename it (avoids unique constraint violation).
  await client.query(`
    DELETE FROM daily_picks dp
    WHERE dp.category = 'bollywood'
      AND EXISTS (
        SELECT 1 FROM daily_picks ic
        WHERE ic.category = 'indiancinema' AND ic.pick_date = dp.pick_date
      )
  `);
  await client.query(`UPDATE daily_picks  SET category = 'indiancinema'           WHERE category = 'bollywood'`);

  // used_movies may also have a unique constraint; handle similarly
  await client.query(`
    DELETE FROM used_movies um
    WHERE um.category = 'bollywood'
      AND EXISTS (
        SELECT 1 FROM used_movies ic
        WHERE ic.category = 'indiancinema' AND ic.movie_id = um.movie_id
      )
  `);
  await client.query(`UPDATE used_movies  SET category = 'indiancinema'           WHERE category = 'bollywood'`);
  await client.query(`UPDATE guesses      SET category = 'indiancinema'           WHERE category = 'bollywood'`);
  await client.query(`UPDATE streaks      SET category = 'indiancinema'           WHERE category = 'bollywood'`);
  await client.query(`UPDATE streaks      SET category = 'unlimited_indiancinema' WHERE category = 'unlimited_bollywood'`);

  // ── The Losers (2010) from superhero ───────────────────────────────────────
  await client.query(
    `UPDATE movies SET categories = array_remove(categories, 'superhero')
     WHERE title = 'The Losers' AND year = 2010`
  );

  // ── Disney animated removals ───────────────────────────────────────────────
  await client.query(`
    UPDATE movies SET categories = array_remove(categories, 'animated')
    WHERE (title, year) IN (
      ('The Great Mouse Detective', 1986),
      ('Oliver & Company',          1988),
      ('The Rescuers Down Under',   1990),
      ('Atlantis: The Lost Empire', 2001),
      ('Treasure Planet',           2002)
    )
  `);

  // ── Ghibli animated removals (keep only the 5 approved ones) ──────────────
  await client.query(`
    UPDATE movies SET categories = array_remove(categories, 'animated')
    WHERE title ILIKE ANY(ARRAY[
      'Kiki''s Delivery Service',
      'Castle in the Sky',
      'Laputa: Castle in the Sky',
      'The Wind Rises',
      'Porco Rosso',
      'Whisper of the Heart',
      'Nausicaä of the Valley of the Wind',
      'Nausicaa of the Valley of the Wind',
      'The Secret World of Arrietty',
      'Arrietty',
      'The Tale of Princess Kaguya',
      'When Marnie Was There',
      'From Up on Poppy Hill',
      'The Cat Returns',
      'Only Yesterday',
      'Ocean Waves',
      'Pom Poko',
      'Tales from Earthsea',
      'My Neighbors the Yamadas',
      'Earwig and the Witch'
    ])
  `);

  // ── Indian Cinema cleanup titles ───────────────────────────────────────────
  await client.query(`
    UPDATE movies SET categories = array_remove(categories, 'indiancinema')
    WHERE (title, year) IN (
      ('Chhaava',                     2025),
      ('Lootcase',                    2020),
      ('Dial 100',                    2021),
      ('Uri: The Surgical Strike',    2019),
      ('Zanjeer',                     1973),
      ('Don',                         1978),
      ('Muqaddar Ka Sikandar',        1978),
      ('Amar Akbar Anthony',          1977),
      ('Shaan',                       1980),
      ('Govinda Naam Mera',           2022),
      ('Darlings',                    2022),
      ('Gulabo Sitabo',               2020),
      ('Merry Christmas',             2024),
      ('Selfiee',                     2023),
      ('Adipurush',                   2023),
      ('Kisi Ka Bhai Kisi Ki Jaan',   2023),
      ('Runway 34',                   2022),
      ('Sardar Udham',                2021),
      ('Aradhana',                    1969),
      ('Bobby',                       1973),
      ('Pyaasa',                      1957),
      ('Guide',                       1965),
      ('Lootera',                     2013),
      ('Sam Bahadur',                 2023),
      ('Hum',                         1991),
      ('Kahaani 2',                   2016),
      ('Dabangg 3',                   2019),
      ('Tiger 3',                     2023),
      ('Bhool Bhulaiyaa 3',           2024),
      ('Highway',                     2014),
      ('Haider',                      2014),
      ('Pink',                        2016),
      ('Tumbbad',                     2018),
      ('Baby',                        2015),
      ('Talvar',                      2015),
      ('Article 15',                  2019),
      ('Mughal-E-Azam',               1960),
      ('Mother India',                1957),
      ('NH10',                        2015),
      ('Mission Mangal',              2019),
      ('Chhichhore',                  2019),
      ('Dil Bechara',                 2020),
      ('Roohi',                       2021),
      ('Bell Bottom',                 2021),
      ('JugJugg Jeeyo',               2022),
      ('Dream Girl 2',                2023),
      ('Tu Jhoothi Main Makkaar',     2023)
    )
  `);

  // ── Delete orphaned rows (no categories left) ──────────────────────────────
  const del = await client.query(
    `DELETE FROM movies WHERE categories = '{}' OR categories IS NULL`
  );
  console.log(`  Orphaned movies deleted: ${del.rowCount}`);

  // Verification
  const counts = await client.query(`
    SELECT
      (SELECT COUNT(*) FROM movies WHERE 'bollywood'    = ANY(categories)) AS bollywood,
      (SELECT COUNT(*) FROM movies WHERE 'indiancinema' = ANY(categories)) AS indiancinema,
      (SELECT COUNT(*) FROM movies WHERE 'animated'     = ANY(categories)) AS animated,
      (SELECT COUNT(*) FROM movies WHERE 'superhero'    = ANY(categories)) AS superhero
  `);
  const c = counts.rows[0];
  console.log(`  Category counts after migration:`);
  console.log(`    bollywood (should be 0): ${c.bollywood}`);
  console.log(`    indiancinema           : ${c.indiancinema}`);
  console.log(`    animated               : ${c.animated}`);
  console.log(`    superhero              : ${c.superhero}`);
}

async function step2_revertToTmdbBackdrops(client) {
  console.log('\n── Step 2: Revert 3 movies from /frames/ → TMDB backdrops ─────');

  const targets = [
    { title: '3 Idiots',                    year: 2009 },
    { title: 'Bāhubali 2: The Conclusion',  year: 2017 },
    { title: 'Kalki 2898-AD',               year: 2024 },
  ];

  // Also handle alternate spellings / TMDB title variants
  const altTitles = [
    'Baahubali: The Conclusion',
    'Baahubali 2',
    'Baahubali 2: The Conclusion',
    'Bahubali 2: The Conclusion',
    'Bāhubali 2: The Conclusion',
    'Kalki 2898 - AD',
    'Kalki 2898-AD',
  ];

  // Fetch all movies that match (by title+year) OR have /frames/ paths and are these movies
  const { rows: movies } = await client.query(`
    SELECT id, tmdb_id, title, year, backdrop_paths
    FROM movies
    WHERE
      (title = '3 Idiots' AND year = 2009) OR
      (title ILIKE ANY($1) AND year = 2017) OR
      (title ILIKE ANY($2) AND year = 2024)
  `, [
    ['Baahubali: The Conclusion', 'Baahubali 2', 'Baahubali 2: The Conclusion',
     'Bahubali 2: The Conclusion', 'Bāhubali 2: The Conclusion'],
    ['Kalki 2898 - AD', 'Kalki 2898-AD', 'Kalki 2898 AD'],
  ]);

  if (!movies.length) {
    console.log('  No matching movies found — checking by backdrop_paths pattern...');
    // Try to find by /frames/ pattern if title mismatch
    const { rows: frameMovies } = await client.query(`
      SELECT id, tmdb_id, title, year, backdrop_paths
      FROM movies
      WHERE EXISTS (SELECT 1 FROM unnest(backdrop_paths) p WHERE p LIKE '/frames/%')
        AND year IN (2009, 2017, 2024)
        AND (
          title ILIKE '%idiot%' OR
          title ILIKE '%baahubali%' OR title ILIKE '%bahubali%' OR
          title ILIKE '%kalki%'
        )
    `);
    movies.push(...frameMovies);
  }

  if (!movies.length) {
    console.log('  ⚠ None of the 3 target movies found in DB — skipping.');
    return;
  }

  for (const movie of movies) {
    console.log(`\n  Processing: ${movie.title} (${movie.year}) [tmdb_id=${movie.tmdb_id}]`);
    const currentPaths = movie.backdrop_paths || [];
    const hasFrames = currentPaths.some((p) => p.startsWith('/frames/'));
    if (!hasFrames) {
      console.log('    → Already using TMDB paths, skipping.');
      continue;
    }
    try {
      const backdrops = await fetchTmdbBackdrops(movie.tmdb_id);
      if (!backdrops.length) {
        console.log('    ⚠ No TMDB backdrops found, leaving as-is.');
        continue;
      }
      await client.query(
        `UPDATE movies SET backdrop_paths = $1, updated_at = NOW() WHERE id = $2`,
        [backdrops, movie.id]
      );
      console.log(`    ✓ Updated to ${backdrops.length} TMDB backdrop paths.`);
    } catch (err) {
      console.log(`    ✗ Error: ${err.message}`);
    }
  }
}

async function main() {
  console.log('CineGuess — Gallery Fix Script\n');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await step1_runMigrations(client);
    await client.query('COMMIT');
    console.log('\n  ✓ Migrations committed.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\n  ✗ Migration failed, rolled back:', err.message);
    throw err;
  } finally {
    client.release();
  }

  // Step 2 runs outside the transaction (needs TMDB API calls between DB writes)
  const client2 = await pool.connect();
  try {
    await step2_revertToTmdbBackdrops(client2);
  } finally {
    client2.release();
  }

  console.log('\n\n✅ Done. Now run:\n');
  console.log('   node src/scripts/cleanupFrames.js');
  console.log('   node src/scripts/buildFrameGallery.js\n');
  await pool.end();
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
