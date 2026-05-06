/**
 * addStarterInfo.js
 *
 * Populates oscar_nominations, oscar_nomination_categories, and franchise_name
 * for every movie in the top250 category.
 *
 * Data sources:
 *   - Franchise   : TMDB  belongs_to_collection
 *   - Oscar count : OMDb  Awards string  (fast, reliable, free — 1000 req/day)
 *   - Oscar cats  : Wikidata SPARQL  (best-effort — skipped on timeout/error)
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

// ── Wikidata: Oscar category names (best-effort) ─────────────────────────────
// prop: 'P1411' = nominated for, 'P166' = award received
async function fetchWikidataAwardCategories(imdbId, prop) {
  if (!imdbId) return [];

  const sparql = `
    SELECT DISTINCT ?awardLabel WHERE {
      ?film wdt:P345 "${imdbId}" .
      ?film p:${prop} ?stmt .
      ?stmt ps:${prop} ?award .
      ?award rdfs:label ?awardLabel .
      FILTER(LANG(?awardLabel) = "en")
      FILTER(CONTAINS(LCASE(?awardLabel), "academy award"))
    }
  `;

  const res = await axios.get('https://query.wikidata.org/sparql', {
    params: { query: sparql, format: 'json' },
    headers: { 'User-Agent': 'CineGuess/1.0 (movie trivia app; mailto:admin@cineguess.com)' },
    timeout: 15000,
  });

  const bindings = res.data?.results?.bindings || [];
  return bindings
    .map(b => b.awardLabel?.value)
    .filter(Boolean)
    // Clean up: "Academy Award for Best Picture" → "Best Picture"
    .map(label => label.replace(/^Academy Award for /i, '').trim());
}

// Convenience wrappers
const fetchWikidataCategories    = (imdbId) => fetchWikidataAwardCategories(imdbId, 'P1411');
const fetchWikidataWinCategories = (imdbId) => fetchWikidataAwardCategories(imdbId, 'P166');

// ── Main ─────────────────────────────────────────────────────────────────────
async function run() {
  const where = FORCE
    ? `WHERE 'top250' = ANY(categories)`
    : `WHERE 'top250' = ANY(categories)
       AND (oscar_wins IS NULL
            OR oscar_win_categories IS NULL
            OR oscar_win_categories = '[]'::jsonb)`;

  const { rows } = await pool.query(
    `SELECT tmdb_id, title, imdb_id,
            oscar_nomination_categories
     FROM movies ${where} ORDER BY popularity DESC`
  );

  console.log(`\nFound ${rows.length} top250 movies to process${FORCE ? ' (--force)' : ''}.\n`);

  let ok = 0, failed = 0, wikiFailed = 0;

  for (const row of rows) {
    try {
      // Step 1: TMDB (franchise) + OMDb (count) — both fast and reliable
      const [franchise, oscarCount] = await Promise.all([
        fetchFranchise(row.tmdb_id),
        fetchOmdb(row.imdb_id),
      ]);

      // Step 2: Wikidata (win categories always; nomination categories only if not already set)
      // Never overwrite nomination categories that were manually curated.
      const existingNomCats = Array.isArray(row.oscar_nomination_categories)
        ? row.oscar_nomination_categories
        : [];
      const nomCatsAlreadySet = existingNomCats.length > 0;

      let categories = existingNomCats; // preserve existing by default
      let winCategories = [];
      if (oscarCount > 0) {
        try {
          const toFetch = nomCatsAlreadySet
            ? [Promise.resolve(existingNomCats), fetchWikidataWinCategories(row.imdb_id)]
            : [fetchWikidataCategories(row.imdb_id), fetchWikidataWinCategories(row.imdb_id)];
          [categories, winCategories] = await Promise.all(toFetch);
        } catch (wikiErr) {
          wikiFailed++;
          process.stdout.write('  ⚠ Wikidata skipped: ' + wikiErr.message + '\n');
        }
        // Small delay to be polite to Wikidata
        await sleep(600);
      }

      await pool.query(
        `UPDATE movies
         SET franchise_name              = $1,
             oscar_wins                  = $2,
             oscar_nomination_categories = CASE
               WHEN oscar_nomination_categories IS NULL OR oscar_nomination_categories = '[]'::jsonb
               THEN $3::jsonb
               ELSE oscar_nomination_categories
             END,
             oscar_win_categories        = $4
         WHERE tmdb_id = $5`,
        [franchise, oscarCount, JSON.stringify(categories), winCategories, row.tmdb_id]
      );

      const nomStr = categories.length > 0
        ? `noms=[${categories.slice(0, 2).join(', ')}${categories.length > 2 ? '…' : ''}]${nomCatsAlreadySet ? '(kept)' : ''}`
        : 'noms=[]';
      const winStr = winCategories.length > 0 ? `wins=[${winCategories.slice(0, 2).join(', ')}${winCategories.length > 2 ? '…' : ''}]` : 'wins=[]';
      console.log(`✓ ${row.title.padEnd(45)} oscars=${String(oscarCount).padEnd(3)} ${nomStr} ${winStr}`);
      ok++;
    } catch (err) {
      console.error(`✗ ${row.title} (${row.tmdb_id}):`, err.message);
      failed++;
      await sleep(500);
    }

    await sleep(300); // OMDb free tier: 300ms between requests
  }

  console.log(`\nDone. ${ok} updated, ${failed} failed, ${wikiFailed} Wikidata skips (count still saved).`);
  await pool.end();
}

run().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
