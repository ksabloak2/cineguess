/**
 * addStarterInfo.js
 *
 * Populates oscar_nominations, oscar_nomination_categories, and franchise_name
 * for every movie in the top250 category.
 *
 * Data sources:
 *   - Franchise : TMDB  belongs_to_collection
 *   - Oscars    : OMDb  Awards string  (fast, reliable, free — 1000 req/day)
 *
 * Usage:
 *   node src/scripts/addStarterInfo.js           # skip already-populated rows
 *   node src/scripts/addStarterInfo.js --force   # re-fetch everything
 */

require('dotenv').config();
const axios = require('axios');
const pool  = require('../db/pool');

const TMDB_KEY = process.env.TMDB_API_KEY;
const OMDB_KEY = process.env.OMDB_API_KEY;

if (!TMDB_KEY) { console.error('TMDB_API_KEY missing'); process.exit(1); }
if (!OMDB_KEY) { console.error('OMDB_API_KEY missing — get a free key at https://www.omdbapi.com/apikey.aspx'); process.exit(1); }

const FORCE = process.argv.includes('--force');
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── TMDB: franchise name ─────────────────────────────────────────────────────
async function fetchFranchise(tmdbId) {
  const res = await axios.get(`https://api.themoviedb.org/3/movie/${tmdbId}`, {
    params: { api_key: TMDB_KEY },
    timeout: 8000,
  });
  const col = res.data.belongs_to_collection;
  return col ? col.name : null;
}

// ── OMDb: parse Oscar nominations from Awards string ─────────────────────────
// OMDb returns e.g. "Won 4 Oscars. Another 10 wins & 19 nominations."
//                   "Nominated for 13 Oscars. Another 102 wins & 174 nominations."
//                   "N/A"
function parseOscars(awardsStr) {
  if (!awardsStr || awardsStr === 'N/A') return 0;

  // "Won X Oscar(s)"
  const wonMatch = awardsStr.match(/Won (\d+) Oscar/i);
  if (wonMatch) return parseInt(wonMatch[1], 10);

  // "Nominated for X Oscar(s)"
  const nomMatch = awardsStr.match(/Nominated for (\d+) Oscar/i);
  if (nomMatch) return parseInt(nomMatch[1], 10);

  return 0;
}

async function fetchOmdb(imdbId) {
  if (!imdbId) return 0;
  const res = await axios.get('https://www.omdbapi.com/', {
    params: { i: imdbId, apikey: OMDB_KEY },
    timeout: 8000,
  });
  return parseOscars(res.data?.Awards);
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function run() {
  const where = FORCE
    ? `WHERE 'top250' = ANY(categories)`
    : `WHERE 'top250' = ANY(categories) AND oscar_nominations IS NULL`;

  const { rows } = await pool.query(
    `SELECT tmdb_id, title, imdb_id FROM movies ${where} ORDER BY popularity DESC`
  );

  console.log(`\nFound ${rows.length} top250 movies to process${FORCE ? ' (--force)' : ''}.\n`);

  let ok = 0, failed = 0;

  for (const row of rows) {
    try {
      const [franchise, oscarCount] = await Promise.all([
        fetchFranchise(row.tmdb_id),
        fetchOmdb(row.imdb_id),
      ]);

      await pool.query(
        `UPDATE movies
         SET franchise_name              = $1,
             oscar_nominations           = $2,
             oscar_nomination_categories = $3
         WHERE tmdb_id = $4`,
        [franchise, oscarCount, [], row.tmdb_id]
      );

      const franchiseStr = franchise ? franchise.replace(/ Collection$/, ' series') : 'standalone';
      console.log(`✓ ${row.title.padEnd(45)} franchise=${franchiseStr.padEnd(28)} oscars=${oscarCount}`);
      ok++;
    } catch (err) {
      console.error(`✗ ${row.title} (${row.tmdb_id}):`, err.message);
      failed++;
      await sleep(500);
    }

    await sleep(300); // OMDb free tier is generous — 300ms is plenty
  }

  console.log(`\nDone. ${ok} updated, ${failed} failed.`);
  await pool.end();
}

run().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
