/**
 * importLetterboxd.js
 *
 * Scrapes a Letterboxd list, looks each movie up on TMDB,
 * and upserts them into the database under a specified category.
 *
 * Usage:
 *   node src/scripts/importLetterboxd.js <letterboxd-list-url> <category>
 *
 * Example:
 *   node src/scripts/importLetterboxd.js \
 *     https://letterboxd.com/official/list/top-250-films-with-the-most-fans/ \
 *     top250
 */

require('dotenv').config();
const axios   = require('axios');
const cheerio = require('cheerio');
const pool    = require('../db/pool');

const TMDB_BASE = process.env.TMDB_BASE_URL || 'https://api.themoviedb.org/3';
const TMDB_KEY  = process.env.TMDB_API_KEY;
const DELAY_MS  = 275;

if (!TMDB_KEY) { console.error('TMDB_API_KEY not set'); process.exit(1); }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------
// Scrape one page of a Letterboxd list
// Returns array of { title, year, slug }
// ---------------------------------------------------------------
async function scrapePage(url) {
  const res = await axios.get(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Cache-Control': 'no-cache',
    },
    timeout: 15000,
  });

  const $ = cheerio.load(res.data);
  const movies = [];
  const seen = new Set();

  // Extract film slugs from /film/slug/ URL patterns in the page
  const html = res.data;
  const slugRegex = /\/film\/([a-z0-9][a-z0-9-]+[a-z0-9])\/(?!image|json|fans|likes|reviews|page)/g;
  let match;

  while ((match = slugRegex.exec(html)) !== null) {
    const slug = match[1];
    // Skip common non-film slugs
    if (['members', 'lists', 'films', 'reviews', 'diary', 'tags'].includes(slug)) continue;
    if (seen.has(slug)) continue;
    seen.add(slug);

    // Check if slug ends with a 4-digit year (e.g. little-women-2019)
    const yearSuffixMatch = slug.match(/-(\d{4})$/);
    let cleanSlug = slug;
    let extractedYear = null;

    if (yearSuffixMatch) {
      const y = parseInt(yearSuffixMatch[1]);
      if (y >= 1900 && y <= 2030) {
        extractedYear = y;
        cleanSlug = slug.slice(0, slug.lastIndexOf(`-${yearSuffixMatch[1]}`));
      }
    }

    // Convert clean slug to title: replace hyphens with spaces, title case
    const title = cleanSlug
      .split('-')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');

    movies.push({ title, year: extractedYear, slug: cleanSlug });
  }

  // Check for next page
  const nextLink = $('a.next').attr('href');
  return { movies, nextUrl: nextLink ? `https://letterboxd.com${nextLink}` : null };
}

// ---------------------------------------------------------------
// Scrape all pages of a Letterboxd list
// ---------------------------------------------------------------
async function scrapeAll(startUrl) {
  const allMovies = [];
  let url = startUrl;
  let page = 1;

  while (url) {
    console.log(`  Scraping page ${page}: ${url}`);
    try {
      const { movies, nextUrl } = await scrapePage(url);
      allMovies.push(...movies);
      console.log(`    Found ${movies.length} movies (total: ${allMovies.length})`);
      url = nextUrl;
      page++;
      await sleep(500); // be polite to Letterboxd
    } catch (err) {
      console.warn(`  Page scrape failed: ${err.message}`);
      break;
    }
  }

  return allMovies;
}

// ---------------------------------------------------------------
// Search TMDB for a movie by title + year
// Tries multiple strategies to maximise match rate
// ---------------------------------------------------------------
async function searchTMDB(title, year, slug) {
  const attempts = [title];

  // Also try slug with hyphens replaced by spaces (lowercase) for articles etc.
  if (slug) {
    const fromSlug = slug.replace(/-/g, ' ');
    if (fromSlug !== title.toLowerCase()) attempts.push(fromSlug);
  }

  // Try without leading "The " / "A " (sometimes Letterboxd sorts differently)
  const withoutArticle = title.replace(/^(The|A|An) /i, '');
  if (withoutArticle !== title) attempts.push(withoutArticle);

  for (const query of attempts) {
    try {
      // First try: with year
      if (year) {
        const res = await axios.get(`${TMDB_BASE}/search/movie`, {
          params: { api_key: TMDB_KEY, query, year, language: 'en-US' },
        });
        const results = res.data.results || [];
        if (results.length) {
          const exact = results.find((r) => {
            const ry = r.release_date ? parseInt(r.release_date.split('-')[0]) : null;
            return ry === year;
          });
          if (exact) return exact;
          if (results[0]) return results[0];
        }
      }

      // Second try: without year
      const res2 = await axios.get(`${TMDB_BASE}/search/movie`, {
        params: { api_key: TMDB_KEY, query, language: 'en-US' },
      });
      const results2 = res2.data.results || [];
      if (results2.length) return results2[0];
    } catch (err) {
      // continue to next attempt
    }
    await sleep(150);
  }

  return null;
}

// ---------------------------------------------------------------
// Fetch full movie details + credits from TMDB
// ---------------------------------------------------------------
async function fetchDetails(tmdbId) {
  try {
    const [details, credits] = await Promise.all([
      axios.get(`${TMDB_BASE}/movie/${tmdbId}`, {
        params: { api_key: TMDB_KEY, append_to_response: 'keywords,external_ids' },
      }),
      axios.get(`${TMDB_BASE}/movie/${tmdbId}/credits`, {
        params: { api_key: TMDB_KEY },
      }),
    ]);

    const d = details.data;
    const c = credits.data;

    const director        = c.crew?.find((p) => p.job === 'Director')?.name || null;
    const leadActor       = c.cast?.[0]?.name || null;
    const supportingActor = c.cast?.[1]?.name || null;
    const genres          = (d.genres || []).slice(0, 2).map((g) => g.name);
    const imdbId          = d.external_ids?.imdb_id || d.imdb_id || null;

    return {
      tmdb_id:           d.id,
      title:             d.title,
      year:              d.release_date ? parseInt(d.release_date.split('-')[0]) : null,
      genres,
      director,
      primary_language:  d.original_language,
      lead_actor:        leadActor,
      supporting_actor:  supportingActor,
      popular_quote:     null,
      poster_path:       d.poster_path,
      imdb_id:           imdbId,
      popularity:        d.popularity,
    };
  } catch (err) {
    console.warn(`  Details fetch failed for tmdb:${tmdbId}: ${err.message}`);
    return null;
  }
}

// ---------------------------------------------------------------
// Upsert movie into DB
// ---------------------------------------------------------------
async function upsertMovie(movie, category) {
  const client = await pool.connect();
  try {
    await client.query(
      `INSERT INTO movies
         (tmdb_id, title, year, genres, director, primary_language,
          lead_actor, supporting_actor, popular_quote, poster_path, imdb_id,
          categories, popularity, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,NOW())
       ON CONFLICT (tmdb_id) DO UPDATE SET
         title             = EXCLUDED.title,
         year              = EXCLUDED.year,
         genres            = EXCLUDED.genres,
         director          = EXCLUDED.director,
         primary_language  = EXCLUDED.primary_language,
         lead_actor        = EXCLUDED.lead_actor,
         supporting_actor  = EXCLUDED.supporting_actor,
         poster_path       = EXCLUDED.poster_path,
         imdb_id           = EXCLUDED.imdb_id,
         categories        = (
           SELECT ARRAY(
             SELECT DISTINCT unnest(movies.categories || EXCLUDED.categories)
           )
         ),
         popularity        = EXCLUDED.popularity,
         updated_at        = NOW()`,
      [
        movie.tmdb_id, movie.title, movie.year, movie.genres, movie.director,
        movie.primary_language, movie.lead_actor, movie.supporting_actor,
        movie.popular_quote, movie.poster_path, movie.imdb_id,
        [category], movie.popularity,
      ]
    );
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------
// Clear existing movies from a category before reimporting
// ---------------------------------------------------------------
async function clearCategory(category) {
  const client = await pool.connect();
  try {
    // Remove category from movies that have it
    await client.query(
      `UPDATE movies
       SET categories = array_remove(categories, $1)
       WHERE $1 = ANY(categories)`,
      [category]
    );
    // Delete movies that now have no categories
    await client.query(
      `DELETE FROM movies WHERE categories = '{}'`
    );
    console.log(`  Cleared existing '${category}' movies from DB`);
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------
// Main
// ---------------------------------------------------------------
async function main() {
  const listUrl  = process.argv[2];
  const category = process.argv[3];
  const append   = process.argv.includes('--append'); // skip clearing category

  if (!listUrl || !category) {
    console.error('Usage: node importLetterboxd.js <letterboxd-url> <category> [--append]');
    console.error('Example: node importLetterboxd.js https://letterboxd.com/official/list/top-250-films-with-the-most-fans/ top250');
    console.error('Use --append to add to an existing category without clearing it first.');
    process.exit(1);
  }

  console.log(`\nCineGuess — Letterboxd Import`);
  console.log(`List:     ${listUrl}`);
  console.log(`Category: ${category}`);
  console.log(`Mode:     ${append ? 'append (keeping existing movies)' : 'replace (clearing existing movies)'}\n`);

  // Step 1: Scrape Letterboxd list
  console.log('Step 1: Scraping Letterboxd list...');
  const letterboxdMovies = await scrapeAll(listUrl);
  console.log(`\nTotal movies scraped: ${letterboxdMovies.length}\n`);

  if (!letterboxdMovies.length) {
    console.error('No movies found. Check the URL and try again.');
    process.exit(1);
  }

  // Step 2: Optionally clear old category data
  if (!append) {
    console.log('Step 2: Clearing old category data...');
    await clearCategory(category);
  } else {
    console.log('Step 2: Skipped (append mode)\n');
  }

  // Step 3: Look up each movie on TMDB and upsert
  console.log('Step 3: Fetching TMDB data and storing movies...\n');
  let stored  = 0;
  let skipped = 0;

  const skippedTitles = [];

  for (let i = 0; i < letterboxdMovies.length; i++) {
    const { title, year, slug } = letterboxdMovies[i];
    process.stdout.write(`\r  [${i + 1}/${letterboxdMovies.length}] "${title}" — stored: ${stored}, skipped: ${skipped}   `);

    // Search TMDB with multiple fallback strategies
    await sleep(DELAY_MS);
    const searchResult = await searchTMDB(title, year, slug);
    if (!searchResult) {
      skipped++;
      skippedTitles.push({ title, slug, reason: 'Not found on TMDB' });
      continue;
    }

    // Fetch full details
    await sleep(DELAY_MS);
    const details = await fetchDetails(searchResult.id);
    if (!details) {
      skipped++;
      skippedTitles.push({ title, slug, reason: 'Details fetch failed' });
      continue;
    }

    // Upsert
    await upsertMovie(details, category);
    stored++;
  }

  console.log(`\n\nDone!`);
  console.log(`  Stored:  ${stored}`);
  console.log(`  Skipped: ${skipped}`);

  if (skippedTitles.length) {
    console.log('\nSkipped movies (could not match on TMDB):');
    skippedTitles.forEach((s) => console.log(`  - "${s.title}" (slug: ${s.slug}) — ${s.reason}`));
    console.log('\nTip: You can manually add skipped movies by searching TMDB for the correct title');
    console.log('and running: node src/scripts/addMovie.js <tmdb_id> <category>');
  }

  console.log(`\nRun 'npm run daily-pick' to assign today's pick from the new pool.`);

  process.exit(0);
}

main().catch((err) => {
  console.error('\nFatal error:', err);
  process.exit(1);
});
