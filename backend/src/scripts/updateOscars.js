/**
 * updateOscars.js
 *
 * Downloads the full Oscar nominations dataset (with TMDB IDs),
 * finds all Best Picture nominees, and updates the oscar_nominated
 * column in our movies table accordingly.
 *
 * Run: node src/scripts/updateOscars.js
 */

require('dotenv').config();
const axios = require('axios');
const pool  = require('../db/pool');

const DATASET_URL = 'https://raw.githubusercontent.com/delventhalz/json-nominations/main/oscar-nominations.json';

// Also try the DLu CSV as fallback for any gaps
const CSV_URL = 'https://raw.githubusercontent.com/DLu/oscar_data/main/oscars.csv';

async function main() {
  console.log('CineGuess — Oscar Best Picture update\n');

  // ---------------------------------------------------------------
  // Step 1: Download nominations dataset
  // ---------------------------------------------------------------
  console.log('Downloading Oscar nominations dataset...');
  let nominations;
  try {
    const res = await axios.get(DATASET_URL, { timeout: 15000 });
    nominations = res.data;
    console.log(`  Downloaded ${nominations.length} total nominations`);
  } catch (err) {
    console.error('Failed to download dataset:', err.message);
    process.exit(1);
  }

  // ---------------------------------------------------------------
  // Step 2: Extract Best Picture nominees — collect TMDB IDs + IMDb IDs + titles
  // ---------------------------------------------------------------
  const bestPictureCategories = [
    'best picture',
    'outstanding picture',
    'outstanding production',
    'best motion picture',
  ];

  const bestPictureTmdbIds  = new Set();
  const bestPictureImdbIds  = new Set();
  const bestPictureTitles   = new Map(); // title+year -> true

  for (const nom of nominations) {
    const cat = (nom.category || '').toLowerCase();
    const isBestPicture = bestPictureCategories.some(c => cat.includes(c));
    if (!isBestPicture) continue;

    const movies = nom.movies || [];
    for (const m of movies) {
      if (m.tmdb_id)  bestPictureTmdbIds.add(parseInt(m.tmdb_id));
      if (m.imdb_id)  bestPictureImdbIds.add(m.imdb_id);
      if (m.title)    bestPictureTitles.set(m.title.toLowerCase().trim(), true);
    }
  }

  console.log(`  Best Picture nominees found:`);
  console.log(`    TMDB IDs:  ${bestPictureTmdbIds.size}`);
  console.log(`    IMDb IDs:  ${bestPictureImdbIds.size}`);
  console.log(`    Titles:    ${bestPictureTitles.size}`);

  // ---------------------------------------------------------------
  // Step 3: Reset all oscar_nominated to false, then set true for matches
  // ---------------------------------------------------------------
  const client = await pool.connect();
  try {
    console.log('\nResetting all oscar_nominated to false...');
    await client.query(`UPDATE movies SET oscar_nominated = false`);

    // Match by TMDB ID (most reliable)
    const { rowCount: tmdbMatches } = await client.query(
      `UPDATE movies SET oscar_nominated = true
       WHERE tmdb_id = ANY($1::int[])`,
      [Array.from(bestPictureTmdbIds)]
    );
    console.log(`  Updated by TMDB ID:  ${tmdbMatches} movies`);

    // Match by IMDb ID (catches movies the dataset has imdb but not tmdb for)
    const { rowCount: imdbMatches } = await client.query(
      `UPDATE movies SET oscar_nominated = true
       WHERE imdb_id = ANY($1::text[]) AND oscar_nominated = false`,
      [Array.from(bestPictureImdbIds)]
    );
    console.log(`  Updated by IMDb ID:  ${imdbMatches} additional movies`);

    // Match by exact title (last resort for older films)
    const { rows: allMovies } = await client.query(
      `SELECT id, title FROM movies WHERE oscar_nominated = false`
    );
    let titleMatches = 0;
    for (const m of allMovies) {
      if (bestPictureTitles.has(m.title.toLowerCase().trim())) {
        await client.query(`UPDATE movies SET oscar_nominated = true WHERE id = $1`, [m.id]);
        titleMatches++;
      }
    }
    console.log(`  Updated by title:    ${titleMatches} additional movies`);

    // ---------------------------------------------------------------
    // Step 4: Show results
    // ---------------------------------------------------------------
    const { rows: stats } = await client.query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE oscar_nominated = true) as nominated
      FROM movies
    `);
    console.log(`\nFinal counts:`);
    console.log(`  Total movies in DB:        ${stats[0].total}`);
    console.log(`  Best Picture nominees:     ${stats[0].nominated}`);

    const { rows: nominees } = await client.query(`
      SELECT title, year FROM movies
      WHERE oscar_nominated = true
      ORDER BY year DESC
    `);
    console.log(`\nMovies in your pool marked as Best Picture nominees:`);
    nominees.forEach(r => console.log(`  - ${r.title} (${r.year})`));

  } finally {
    client.release();
  }

  console.log('\nDone! The "Oscar" tile now reflects Best Picture nominations.');
  process.exit(0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
