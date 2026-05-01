/**
 * addProductionStudio.js
 *
 * Fetches the primary production studio for every movie in the top250 category
 * from TMDB and writes it to movies.production_studio.
 *
 * Usage:
 *   node src/scripts/addProductionStudio.js
 *   node src/scripts/addProductionStudio.js --force   # re-fetch already-populated rows
 */
require('dotenv').config();
const axios = require('axios');
const pool  = require('../db/pool');

const TMDB_KEY = process.env.TMDB_API_KEY;
if (!TMDB_KEY) { console.error('TMDB_API_KEY missing'); process.exit(1); }

const FORCE = process.argv.includes('--force');

// ── Normalise TMDB company names to clean, consistent display names ──────────
const NORMALIZE = {
  'Warner Bros. Pictures':                    'Warner Bros.',
  'Warner Bros.':                             'Warner Bros.',
  'Warner Bros. Animation':                   'Warner Bros.',
  'Columbia Pictures':                        'Columbia Pictures',
  'Columbia Pictures Corporation':            'Columbia Pictures',
  'Universal Pictures':                       'Universal Pictures',
  'Universal Pictures International (UPI)':   'Universal Pictures',
  'Paramount Pictures':                       'Paramount Pictures',
  'Paramount':                                'Paramount Pictures',
  'Walt Disney Pictures':                     'Walt Disney Pictures',
  'Walt Disney Animation Studios':            'Walt Disney Pictures',
  'Pixar':                                    'Pixar Animation Studios',
  'Pixar Animation Studios':                  'Pixar Animation Studios',
  'Marvel Studios':                           'Marvel Studios',
  'Lucasfilm':                                'Lucasfilm',
  'Lucasfilm Ltd.':                           'Lucasfilm',
  '20th Century Fox':                         '20th Century Studios',
  '20th Century Fox Film Corporation':        '20th Century Studios',
  'Twentieth Century Fox':                    '20th Century Studios',
  '20th Century Studios':                     '20th Century Studios',
  'Fox 2000 Pictures':                        '20th Century Studios',
  'Fox Searchlight Pictures':                 'Searchlight Pictures',
  'Searchlight Pictures':                     'Searchlight Pictures',
  'Touchstone Pictures':                      'Touchstone Pictures',
  'Hollywood Pictures':                       'Touchstone Pictures',
  'New Line Cinema':                          'New Line Cinema',
  'New Line Productions':                     'New Line Cinema',
  'Metro-Goldwyn-Mayer':                      'MGM',
  'Metro-Goldwyn-Mayer (MGM)':                'MGM',
  'MGM':                                      'MGM',
  'United Artists':                           'MGM',
  'United Artists Pictures':                  'MGM',
  'Orion Pictures':                           'MGM',
  'Orion Pictures Corporation':               'MGM',
  'TriStar Pictures':                         'TriStar Pictures',
  'Lionsgate':                                'Lionsgate',
  'Lions Gate Films':                         'Lionsgate',
  'Summit Entertainment':                     'Lionsgate',
  'DreamWorks Pictures':                      'DreamWorks',
  'DreamWorks':                               'DreamWorks',
  'DreamWorks Animation':                     'DreamWorks',
  'Amblin Entertainment':                     'Amblin Entertainment',
  'Legendary Entertainment':                  'Legendary Entertainment',
  'Legendary Pictures':                       'Legendary Entertainment',
  'Legendary East':                           'Legendary Entertainment',
  'Village Roadshow Pictures':               'Village Roadshow',
  'Castle Rock Entertainment':               'Castle Rock Entertainment',
  'Miramax':                                 'Miramax',
  'Miramax Films':                           'Miramax',
  'The Weinstein Company':                   'Miramax',
  'Weinstein Company':                       'Miramax',
  'Working Title Films':                     'Working Title Films',
  'A24':                                     'A24',
  'Netflix':                                 'Netflix',
  'Amazon Studios':                          'Amazon Studios',
  'Apple Original Films':                    'Apple Original Films',
  'StudioCanal':                             'StudioCanal',
  'Focus Features':                          'Focus Features',
  'Blumhouse Productions':                   'Blumhouse Productions',
  'Bad Robot':                               'Bad Robot',
};

// ── Prefer a recognised major distributor over smaller production shingles ───
const MAJOR_STUDIOS = new Set([
  'Marvel Studios', 'Walt Disney Pictures', 'Walt Disney Animation Studios',
  'Pixar Animation Studios', 'Pixar', 'Lucasfilm', 'Lucasfilm Ltd.',
  '20th Century Fox', '20th Century Studios', 'Fox Searchlight Pictures',
  'Searchlight Pictures', 'Touchstone Pictures', 'Hollywood Pictures',
  'Universal Pictures', 'Amblin Entertainment', 'DreamWorks Pictures',
  'DreamWorks Animation', 'DreamWorks', 'Working Title Films',
  'Focus Features', 'Blumhouse Productions', 'Illumination',
  'Warner Bros. Pictures', 'Warner Bros.', 'New Line Cinema',
  'New Line Productions', 'Legendary Entertainment', 'Legendary Pictures',
  'Castle Rock Entertainment', 'Village Roadshow Pictures', 'DC Films',
  'Columbia Pictures', 'Columbia Pictures Corporation', 'TriStar Pictures',
  'Sony Pictures',
  'Paramount Pictures', 'Paramount',
  'Metro-Goldwyn-Mayer', 'MGM', 'United Artists', 'Orion Pictures',
  'Lionsgate', 'Lions Gate Films', 'Summit Entertainment',
  'A24', 'Miramax', 'Miramax Films', 'The Weinstein Company',
  'Netflix', 'Amazon Studios', 'Apple Original Films',
  'StudioCanal',
]);

function pickStudio(companies) {
  if (!companies || !companies.length) return null;
  // Prefer a known major studio/distributor
  const major = companies.find((c) => MAJOR_STUDIOS.has(c.name));
  const chosen = major || companies[0];
  const name = chosen?.name;
  if (!name) return null;
  return NORMALIZE[name] || name;
}

async function fetchStudio(tmdbId) {
  const url = `https://api.themoviedb.org/3/movie/${tmdbId}`;
  const res = await axios.get(url, {
    params: { api_key: TMDB_KEY },
    timeout: 8000,
  });
  const companies = res.data.production_companies || [];
  return pickStudio(companies);
}

async function run() {
  const whereClause = FORCE
    ? `WHERE 'top250' = ANY(categories)`
    : `WHERE 'top250' = ANY(categories) AND (production_studio IS NULL OR production_studio = '')`;

  const { rows } = await pool.query(
    `SELECT tmdb_id, title FROM movies ${whereClause} ORDER BY popularity DESC`
  );

  console.log(`Found ${rows.length} top250 movies to update${FORCE ? ' (--force mode)' : ''}.\n`);

  let ok = 0, failed = 0;
  for (const row of rows) {
    try {
      const studio = await fetchStudio(row.tmdb_id);
      if (studio) {
        await pool.query(
          'UPDATE movies SET production_studio = $1 WHERE tmdb_id = $2',
          [studio, row.tmdb_id]
        );
        console.log(`✓ ${row.title.padEnd(45)} → ${studio}`);
        ok++;
      } else {
        console.warn(`⚠ ${row.title} — no production company found`);
        failed++;
      }
      // Respect TMDB rate limit (~40 req/s; 250ms gap = safe)
      await new Promise((r) => setTimeout(r, 250));
    } catch (err) {
      console.error(`✗ ${row.title} (${row.tmdb_id}):`, err.message);
      failed++;
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  console.log(`\nDone. ${ok} updated, ${failed} failed.`);
  await pool.end();
}

run().catch((err) => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
