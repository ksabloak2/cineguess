/**
 * removeMovies.js
 *
 * Removes specified movies from the database:
 *  - Full deletions: removed from ALL categories / tables entirely
 *  - Category-specific removals: array_remove the category; if movie has
 *    no categories left it gets deleted too
 *
 * After DB changes the script also deletes local frame files and rebuilds
 * the gallery index.
 *
 * Usage: node src/scripts/removeMovies.js
 */

require('dotenv').config({ override: true });
const fs   = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const pool = require('../db/pool');

const FRAMES_DIR = path.join(__dirname, '..', '..', 'public', 'frames');

// ── Full deletions (remove from every category) ────────────────────────────
const FULL_DELETES = [
  { title: 'The Deadly Little Mermaid', year: 2026 },
  { title: 'Ultraman: Rising',          year: null },  // "Ultraman 2 – The Frozen Station" — search broadly
  { title: 'Twilight of the Warriors: Walled In', year: 2024 },
  { title: 'The Last Witch Hunter',     year: 2015 },
];

// Patterns for fuzzy DB lookup (title ILIKE)
const FULL_DELETE_PATTERNS = [
  { pattern: '%deadly%mermaid%',          year: null },
  { pattern: '%ultraman%frozen%',         year: null },
  { pattern: '%ultraman%',               year: null },   // broad fallback
  { pattern: '%twilight of the warriors%',year: 2024 },
  { pattern: '%last witch hunter%',       year: 2015 },
];

// ── Category-specific removals ─────────────────────────────────────────────
const REMOVE_FROM_ANIMATED = [
  { pattern: '%princess kaguya%',    year: 2013 },
  { pattern: '%tale of%kaguya%',     year: 2013 },
  { pattern: '%sword in the stone%', year: 1963 },
  { pattern: '%ruby gillman%',       year: 2023 },
];

const REMOVE_FROM_INDIANCINEMA = [
  { pattern: '%vicky donor%',                    year: 2012 },
  { pattern: '%kashmir files%',                  year: 2022 },
  { pattern: '%thappad%',                        year: 2020 },
  { pattern: '%talaash%',                        year: 2012 },
  { pattern: '%super deluxe%',                   year: 2019 },
  { pattern: '%stree 2%',                        year: 2024 },
  { pattern: '%sholay%',                         year: 1975 },
  { pattern: '%shershaah%',                      year: 2021 },
  { pattern: '%shakuntala devi%',                year: 2020 },
  { pattern: '%sarfarosh%',                      year: 1999 },
  { pattern: '%satya%',                          year: 1998 },
  { pattern: '%rocket singh%',                   year: 2009 },
  { pattern: '%race 2%',                         year: 2013 },
  { pattern: '%qayamat se qayamat tak%',         year: 1988 },
  { pattern: '%prem ratan dhan payo%',           year: 2015 },
  { pattern: '%phata poster nikhla hero%',       year: 2013 },
  { pattern: '%paa%',                            year: 2009 },
  { pattern: '%omg 2%',                          year: 2023 },
  { pattern: '%mughal%azam%',                    year: 1960 },
  { pattern: '%manikarnika%',                    year: 2019 },
  { pattern: '%maine pyar kiya%',                year: 1989 },
  { pattern: '%lage raho munna bhai%',           year: 2006 },
  { pattern: '%kumbalangi nights%',              year: 2019 },
  { pattern: '%kisi ka bhai%',                   year: 2023 },
  { pattern: '%karan arjun%',                    year: 1995 },
  { pattern: '%jo jeeta wohi sikandar%',         year: 1992 },
  { pattern: '%gehraiyaan%',                     year: 2022 },
  { pattern: '%gangs of wasseypur%part 2%',      year: 2012 },
  { pattern: '%gangs of wasseypur 2%',           year: 2012 },
  { pattern: '%fighter%',                        year: 2024 },
  { pattern: '%drishyam 2%',                     year: 2022 },
  { pattern: '%deewaar%',                        year: 1975 },
  { pattern: '%crew%',                           year: 2024 },
  { pattern: '%bombay%',                         year: 1995 },
  { pattern: '%black%',                          year: 2005 },
  { pattern: '%baazigar%',                       year: 1993 },
  { pattern: '%a wednesday%',                    year: 2008 },
];

// ── Helpers ────────────────────────────────────────────────────────────────

async function findMovies(client, pattern, year) {
  if (year) {
    const { rows } = await client.query(
      `SELECT id, tmdb_id, title, year, categories FROM movies WHERE title ILIKE $1 AND year = $2`,
      [pattern, year]
    );
    return rows;
  }
  const { rows } = await client.query(
    `SELECT id, tmdb_id, title, year, categories FROM movies WHERE title ILIKE $1`,
    [pattern]
  );
  return rows;
}

function deleteFramesForMovie(tmdbId) {
  let count = 0;
  for (let i = 0; i < 10; i++) {
    const filePath = path.join(FRAMES_DIR, `${tmdbId}_${i}.jpg`);
    if (fs.existsSync(filePath)) {
      try { fs.unlinkSync(filePath); count++; } catch {}
    }
  }
  return count;
}

async function fullyDeleteMovie(client, movie) {
  // Remove FK-constrained rows first (guesses has no movie_id FK, skip it)
  await client.query(`DELETE FROM daily_picks WHERE movie_id = $1`, [movie.id]);
  await client.query(`DELETE FROM used_movies  WHERE movie_id = $1`, [movie.id]);
  await client.query(`DELETE FROM movies       WHERE id = $1`,       [movie.id]);
  const frames = deleteFramesForMovie(movie.tmdb_id);
  console.log(`  ✓ DELETED ${movie.title} (${movie.year}) — ${frames} frame(s) removed`);
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log('CineGuess — Remove Movies\n');
  const client = await pool.connect();
  const seen = new Set();

  try {
    // ── 1. Full deletions ───────────────────────────────────────────────────
    console.log('── Full deletions ───────────────────────────────────────────────');
    for (const { pattern, year } of FULL_DELETE_PATTERNS) {
      const movies = await findMovies(client, pattern, year);
      for (const m of movies) {
        if (seen.has(m.id)) continue;
        seen.add(m.id);
        await fullyDeleteMovie(client, m);
      }
      if (!movies.length) {
        console.log(`  · No match: "${pattern}"${year ? ` (${year})` : ''}`);
      }
    }

    // ── 2. Remove from animated ─────────────────────────────────────────────
    console.log('\n── Remove from animated ────────────────────────────────────────');
    for (const { pattern, year } of REMOVE_FROM_ANIMATED) {
      const movies = await findMovies(client, pattern, year);
      for (const m of movies) {
        if (seen.has(m.id)) continue;
        seen.add(m.id);
        await client.query(
          `UPDATE movies SET categories = array_remove(categories, 'animated') WHERE id = $1`,
          [m.id]
        );
        // Check if now orphaned
        const { rows } = await client.query(`SELECT categories FROM movies WHERE id = $1`, [m.id]);
        const cats = rows[0]?.categories || [];
        if (!cats.length) {
          await fullyDeleteMovie(client, m);
        } else {
          console.log(`  ✓ Removed 'animated' from ${m.title} (${m.year}) — remaining: [${cats.join(', ')}]`);
        }
      }
      if (!movies.length) {
        console.log(`  · No match: "${pattern}"${year ? ` (${year})` : ''}`);
      }
    }

    // ── 3. Remove from indiancinema ─────────────────────────────────────────
    console.log('\n── Remove from indiancinema ─────────────────────────────────────');
    for (const { pattern, year } of REMOVE_FROM_INDIANCINEMA) {
      const movies = await findMovies(client, pattern, year);
      for (const m of movies) {
        if (seen.has(m.id)) continue;
        seen.add(m.id);
        await client.query(
          `UPDATE movies SET categories = array_remove(categories, 'indiancinema') WHERE id = $1`,
          [m.id]
        );
        const { rows } = await client.query(`SELECT categories FROM movies WHERE id = $1`, [m.id]);
        const cats = rows[0]?.categories || [];
        if (!cats.length) {
          await fullyDeleteMovie(client, m);
        } else {
          console.log(`  ✓ Removed 'indiancinema' from ${m.title} (${m.year}) — remaining: [${cats.join(', ')}]`);
        }
      }
      if (!movies.length) {
        console.log(`  · No match: "${pattern}"${year ? ` (${year})` : ''}`);
      }
    }

    // ── 4. Final orphan sweep ──────────────────────────────────────────────
    const { rowCount } = await client.query(
      `DELETE FROM movies WHERE categories = '{}' OR categories IS NULL`
    );
    if (rowCount) console.log(`\n  + Swept ${rowCount} additional orphaned movie(s)`);

    // ── Count check ─────────────────────────────────────────────────────────
    const { rows: counts } = await client.query(`
      SELECT
        COUNT(*) FILTER (WHERE 'animated'     = ANY(categories)) AS animated,
        COUNT(*) FILTER (WHERE 'indiancinema' = ANY(categories)) AS indiancinema,
        COUNT(*) FILTER (WHERE 'superhero'    = ANY(categories)) AS superhero,
        COUNT(*) FILTER (WHERE 'top250'       = ANY(categories)) AS top250,
        COUNT(*) AS total
      FROM movies
    `);
    const c = counts[0];
    console.log(`\n── Final counts ─────────────────────────────────────────────────`);
    console.log(`  Total movies  : ${c.total}`);
    console.log(`  Animated      : ${c.animated}`);
    console.log(`  Indian Cinema : ${c.indiancinema}`);
    console.log(`  Superhero     : ${c.superhero}`);
    console.log(`  Top 250       : ${c.top250}`);

  } finally {
    client.release();
  }

  await pool.end();
  console.log('\n✅ Done.\n');
}

main().catch((err) => { console.error('Fatal:', err); process.exit(1); });
