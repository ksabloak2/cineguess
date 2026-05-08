/**
 * fixLetterboxdSlugs.js
 *
 * For every movie in the DB:
 *   1. Generate a plain slug from the title (e.g. "corpse-bride")
 *   2. Fetch https://letterboxd.com/film/{plain-slug}/ and parse the year from <title>
 *   3. If the year on that page matches our movie's year → plain slug is correct
 *   4. If the year doesn't match → try the year-appended slug (e.g. "smile-2022")
 *   5. Verify that page, then store whichever slug is confirmed correct
 *   6. Updates movies.letterboxd_slug in the DB
 *
 * Resumable: movies that already have a letterboxd_slug are skipped unless --force.
 *
 * Usage:
 *   node src/scripts/fixLetterboxdSlugs.js               # all missing
 *   node src/scripts/fixLetterboxdSlugs.js --force        # re-check all
 *   node src/scripts/fixLetterboxdSlugs.js --limit=50
 */

require('dotenv').config({ override: true });
const pool = require('../db/pool');

const args  = process.argv.slice(2);
const FORCE = args.includes('--force');
const LIMIT = parseInt((args.find(a => a.startsWith('--limit=')) || '').split('=')[1], 10) || null;

// Rate limit: 1 request per N ms to avoid hammering Letterboxd
const DELAY_MS = 600;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// Roman numeral → Arabic digit map (word-boundary matched)
const ROMAN = { 'viii': 8, 'vii': 7, 'vi': 6, 'iv': 4, 'ix': 9, 'iii': 3, 'ii': 2, 'v': 5 };
function convertRoman(str) {
  // Replace standalone Roman numerals (surrounded by spaces or string boundaries)
  return str.replace(/\b(viii|vii|vi|ix|iv|iii|ii|v)\b/gi, m => ROMAN[m.toLowerCase()]);
}

// Converts a movie title to the base Letterboxd slug format:
//   "Spider-Man: Homecoming" → "spider-man-homecoming"
//   "Frozen II"              → "frozen-2"
//   "(500) Days of Summer"   → "500-days-of-summer"
function toSlug(title) {
  return convertRoman(title)
    .toLowerCase()
    .replace(/[''`]/g, '')          // remove apostrophes
    .replace(/[^a-z0-9\s-]/g, ' ') // replace non-alphanumeric (except hyphens) with space
    .trim()
    .replace(/\s+/g, '-')           // spaces → hyphens
    .replace(/-+/g, '-')            // collapse multiple hyphens
    .replace(/^-|-$/g, '');         // trim leading/trailing hyphens
}

// Fetch a Letterboxd film page and return the year in the <title>, or null
async function fetchLBYear(slug) {
  const url = `https://letterboxd.com/film/${slug}/`;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CineGuessBot/1.0)' },
      signal: AbortSignal.timeout(8000),
    });
    if (res.status === 404) return null;
    if (!res.ok) return undefined; // undefined = network error, not a clean 404
    const html = await res.text();
    // <title>‎Movie Title (YEAR) directed by …</title>
    const m = html.match(/<title[^>]*>.*?\((\d{4})\)/);
    return m ? parseInt(m[1], 10) : null;
  } catch {
    return undefined;
  }
}

async function resolveSlug(title, year) {
  const plain = toSlug(title);
  const withYear = `${plain}-${year}`;

  // Step 1: check plain slug
  const plainYear = await fetchLBYear(plain);
  await sleep(DELAY_MS);

  if (plainYear === year) return plain; // perfect match

  // Step 2: plain was wrong year or 404 — try year-appended
  const withYearYear = await fetchLBYear(withYear);
  await sleep(DELAY_MS);

  if (withYearYear === year) return withYear;

  // Step 3: neither matched cleanly — default to year-appended as a best-effort
  // (Letterboxd may not have this movie at all, but the year slug is safer)
  return withYear;
}

async function main() {
  let conditions = FORCE ? [] : [`letterboxd_slug IS NULL`];
  let query = `SELECT id, title, year FROM movies`;
  if (conditions.length) query += ` WHERE ${conditions.join(' AND ')}`;
  query += ` ORDER BY popularity DESC NULLS LAST`;
  if (LIMIT) query += ` LIMIT ${LIMIT}`;

  const { rows: movies } = await pool.query(query);
  console.log(`\nChecking ${movies.length} movies (force=${FORCE})\n`);

  let ok = 0, fallback = 0, errors = 0;

  for (let i = 0; i < movies.length; i++) {
    const m = movies[i];
    try {
      const slug = await resolveSlug(m.title, m.year);
      await pool.query(
        `UPDATE movies SET letterboxd_slug = $1, updated_at = NOW() WHERE id = $2`,
        [slug, m.id]
      );

      const usedYear = slug.endsWith(`-${m.year}`);
      if (usedYear) fallback++;
      else ok++;

      console.log(`[${i + 1}/${movies.length}] ${usedYear ? '📅' : '✓'} ${m.title} (${m.year}) → /film/${slug}/`);
    } catch (err) {
      errors++;
      console.log(`[${i + 1}/${movies.length}] ✗ ${m.title} — ${err.message}`);
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`  Plain slug:       ${ok}`);
  console.log(`  Year-appended:    ${fallback}`);
  console.log(`  Errors:           ${errors}`);

  await pool.end();
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
