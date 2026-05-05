/**
 * addStarterInfo.js
 *
 * Populates oscar_nominations, oscar_nomination_categories, and franchise_name
 * for every movie in the top250 category.
 *
 * Data sources:
 *   - Franchise : TMDB belongs_to_collection
 *   - Oscars    : Wikidata SPARQL (free, no API key needed)
 *
 * Usage:
 *   node src/scripts/addStarterInfo.js           # skip already-populated rows
 *   node src/scripts/addStarterInfo.js --force   # re-fetch everything
 */

require('dotenv').config();
const axios = require('axios');
const pool  = require('../db/pool');

const TMDB_KEY = process.env.TMDB_API_KEY;
if (!TMDB_KEY) { console.error('TMDB_API_KEY missing'); process.exit(1); }

const FORCE = process.argv.includes('--force');

// ── TMDB: franchise (belongs_to_collection) ──────────────────────────────────
async function fetchFranchise(tmdbId) {
  const res = await axios.get(`https://api.themoviedb.org/3/movie/${tmdbId}`, {
    params: { api_key: TMDB_KEY },
    timeout: 8000,
  });
  const col = res.data.belongs_to_collection;
  return col ? col.name : null;
}

// ── Wikidata SPARQL: Oscar nominations by IMDB ID ────────────────────────────
// Returns array of clean category strings e.g. ["Best Picture", "Best Director"]
async function fetchOscarNominations(imdbId) {
  if (!imdbId) return [];

  // Fetch both P1411 (nominated for) and P166 (award received) to capture wins too.
  // Filter to items that are instances of (P31) Academy Award (Q19020).
  const sparql = `
    SELECT DISTINCT ?awardLabel WHERE {
      ?film wdt:P345 "${imdbId}" .
      {
        ?film p:P1411 ?stmt .
        ?stmt ps:P1411 ?award .
      } UNION {
        ?film p:P166 ?stmt .
        ?stmt ps:P166 ?award .
      }
      ?award wdt:P31 wd:Q19020 .
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
    }
  `;

  const res = await axios.get('https://query.wikidata.org/sparql', {
    params:  { format: 'json', query: sparql },
    headers: { 'User-Agent': 'CineGuess/1.0 (https://cineguess.app)' },
    timeout: 20000,
  });

  return res.data.results.bindings
    .map(b => b.awardLabel?.value || '')
    .filter(Boolean)
    .map(label => label.replace(/^Academy Award for /, '').trim())
    // Wikidata sometimes returns unresolved QIDs — skip those
    .filter(label => !label.match(/^Q\d+$/));
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

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
      const [franchise, oscars] = await Promise.all([
        fetchFranchise(row.tmdb_id),
        fetchOscarNominations(row.imdb_id),
      ]);

      await pool.query(
        `UPDATE movies
         SET franchise_name              = $1,
             oscar_nominations           = $2,
             oscar_nomination_categories = $3
         WHERE tmdb_id = $4`,
        [franchise, oscars.length, oscars, row.tmdb_id]
      );

      const franchiseStr = franchise
        ? franchise.replace(/ Collection$/, ' series')
        : 'standalone';
      console.log(
        `✓ ${row.title.padEnd(45)} franchise=${franchiseStr.padEnd(30)} oscars=${oscars.length}`
        + (oscars.length ? ` [${oscars.slice(0, 2).join(', ')}${oscars.length > 2 ? '…' : ''}]` : '')
      );
      ok++;
    } catch (err) {
      console.error(`✗ ${row.title} (${row.tmdb_id}):`, err.message);
      failed++;
      await sleep(1000);
    }

    // Wikidata asks for a polite crawl delay; 700ms is safe for 250 movies.
    await sleep(700);
  }

  console.log(`\nDone. ${ok} updated, ${failed} failed.`);
  await pool.end();
}

run().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
