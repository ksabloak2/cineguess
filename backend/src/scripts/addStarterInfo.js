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

const sleep = ms => new Promise(r => setTimeout(r, ms));

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
// Retries up to MAX_RETRIES times on timeout/error before giving up.
const MAX_RETRIES = 3;

async function fetchOscarNominations(imdbId) {
  if (!imdbId) return [];

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

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await axios.get('https://query.wikidata.org/sparql', {
        params:  { format: 'json', query: sparql },
        headers: { 'User-Agent': 'CineGuess/1.0 (https://cineguess.app)' },
        timeout: 25000,
      });

      return res.data.results.bindings
        .map(b => b.awardLabel?.value || '')
        .filter(Boolean)
        .map(label => label.replace(/^Academy Award for /, '').trim())
        .filter(label => !label.match(/^Q\d+$/));
    } catch (err) {
      if (attempt < MAX_RETRIES) {
        const delay = attempt * 3000; // 3s, 6s between retries
        console.warn(`  ↻ Wikidata timeout for ${imdbId}, retry ${attempt}/${MAX_RETRIES - 1} in ${delay / 1000}s…`);
        await sleep(delay);
      } else {
        throw err; // bubble up after all retries exhausted
      }
    }
  }
}

async function run() {
  const where = FORCE
    ? `WHERE 'top250' = ANY(categories)`
    : `WHERE 'top250' = ANY(categories) AND oscar_nominations IS NULL`;

  const { rows } = await pool.query(
    `SELECT tmdb_id, title, imdb_id FROM movies ${where} ORDER BY popularity DESC`
  );

  console.log(`\nFound ${rows.length} top250 movies to process${FORCE ? ' (--force)' : ''}.\n`);

  let ok = 0, skipped = 0;

  for (const row of rows) {
    // ── Franchise (TMDB) ──
    let franchise = null;
    try {
      franchise = await fetchFranchise(row.tmdb_id);
    } catch (err) {
      console.warn(`  ⚠ TMDB franchise failed for ${row.title}: ${err.message}`);
    }

    // ── Oscar nominations (Wikidata) — non-fatal ──
    let oscars = [];
    try {
      oscars = await fetchOscarNominations(row.imdb_id);
    } catch (err) {
      console.warn(`  ⚠ Wikidata failed for ${row.title} after ${MAX_RETRIES} retries — storing 0 noms (re-run --force to retry)`);
      skipped++;
    }

    // Always write what we have — franchise may succeed even if Wikidata fails
    try {
      await pool.query(
        `UPDATE movies
         SET franchise_name              = $1,
             oscar_nominations           = $2,
             oscar_nomination_categories = $3
         WHERE tmdb_id = $4`,
        [franchise, oscars.length, oscars, row.tmdb_id]
      );

      const franchiseStr = franchise ? franchise.replace(/ Collection$/, ' series') : 'standalone';
      console.log(
        `✓ ${row.title.padEnd(45)} franchise=${franchiseStr.padEnd(28)} oscars=${oscars.length}`
        + (oscars.length ? ` [${oscars.slice(0, 2).join(', ')}${oscars.length > 2 ? '…' : ''}]` : '')
      );
      ok++;
    } catch (err) {
      console.error(`✗ DB write failed for ${row.title}:`, err.message);
    }

    // Polite delay between movies
    await sleep(800);
  }

  console.log(`\nDone. ${ok} written, ${skipped} had Wikidata failures (oscar_nominations stored as 0).`);
  if (skipped > 0) console.log('Re-run with --force to retry the Wikidata failures.');
  await pool.end();
}

run().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
