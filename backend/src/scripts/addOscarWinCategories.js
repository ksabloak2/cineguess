/**
 * addOscarWinCategories.js
 *
 * One-time backfill: fetches Oscar win category names (Wikidata P166)
 * for top250 movies that have wins recorded but no win category names yet.
 *
 * Does NOT touch oscar_nomination_categories, oscar_wins, or franchise_name.
 *
 * Usage:
 *   node src/scripts/addOscarWinCategories.js           # only missing entries
 *   node src/scripts/addOscarWinCategories.js --force   # re-fetch all with wins
 */

require('dotenv').config();
const axios = require('axios');
const pool  = require('../db/pool');

const FORCE = process.argv.includes('--force');
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function fetchWikidataWinCategories(imdbId) {
  if (!imdbId) return [];

  const sparql = `
    SELECT DISTINCT ?awardLabel WHERE {
      ?film wdt:P345 "${imdbId}" .
      ?film p:P166 ?stmt .
      ?stmt ps:P166 ?award .
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
    .map(label => label.replace(/^Academy Award for /i, '').trim())
    .sort();
}

async function run() {
  const where = FORCE
    ? `WHERE 'top250' = ANY(categories) AND oscar_wins > 0`
    : `WHERE 'top250' = ANY(categories)
       AND oscar_wins > 0
       AND (oscar_win_categories IS NULL OR oscar_win_categories = '[]'::jsonb)`;

  const { rows } = await pool.query(
    `SELECT tmdb_id, title, imdb_id FROM movies ${where} ORDER BY popularity DESC`
  );

  console.log(`\nFound ${rows.length} movies to process${FORCE ? ' (--force)' : ''}.\n`);

  let ok = 0, failed = 0, wikiFailed = 0;

  for (const row of rows) {
    try {
      let winCategories = [];
      try {
        winCategories = await fetchWikidataWinCategories(row.imdb_id);
      } catch (wikiErr) {
        wikiFailed++;
        process.stdout.write(`  ⚠ Wikidata skipped for ${row.title}: ${wikiErr.message}\n`);
      }

      await pool.query(
        `UPDATE movies SET oscar_win_categories = $1 WHERE tmdb_id = $2`,
        [winCategories, row.tmdb_id]
      );

      const winStr = winCategories.length > 0
        ? `[${winCategories.slice(0, 3).join(', ')}${winCategories.length > 3 ? '…' : ''}]`
        : '(none on Wikidata)';
      console.log(`✓ ${row.title.padEnd(45)} wins=${winStr}`);
      ok++;
    } catch (err) {
      console.error(`✗ ${row.title} (${row.tmdb_id}):`, err.message);
      failed++;
    }

    await sleep(400); // polite delay for Wikidata
  }

  console.log(`\nDone. ${ok} updated, ${failed} failed, ${wikiFailed} Wikidata skips.`);
  await pool.end();
}

run().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
