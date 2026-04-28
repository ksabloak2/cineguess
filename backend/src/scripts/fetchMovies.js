/**
 * fetchMovies.js
 *
 * Fetches movie pools from TMDB and upserts them into the `movies` table.
 * Run manually: node src/scripts/fetchMovies.js
 *
 * Categories fetched:
 *   top250   — top 250 popular movies (non-superhero, non-animated)
 *   superhero — 75 most popular superhero movies
 *   animated — 100 most popular animated movies
 *   indiancinema — 150 most popular Indian-language films (superseded by seedBollywood.js)
 *
 * Oscar data is approximated via TMDB keywords (academy_award_winner / nominee).
 * A real integration would use an Oscar dataset or manual curation.
 */

require('dotenv').config();
const axios = require('axios');
const pool  = require('../db/pool');

const TMDB_BASE   = process.env.TMDB_BASE_URL || 'https://api.themoviedb.org/3';
const TMDB_KEY    = process.env.TMDB_API_KEY;
const DELAY_MS    = 250; // stay under TMDB rate limit (40 req/10 s)

if (!TMDB_KEY) {
  console.error('TMDB_API_KEY is not set. Aborting.');
  process.exit(1);
}

// Genre IDs from TMDB
const ANIMATION_GENRE_ID = 16;

// TMDB keyword IDs for superhero
const SUPERHERO_KEYWORD_ID = 9715;
const ANIMATED_GENRE_ID    = 16;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function tmdb(path, params = {}) {
  const res = await axios.get(`${TMDB_BASE}${path}`, {
    params: { api_key: TMDB_KEY, ...params },
  });
  return res.data;
}

// Fetch multiple pages of discover results
async function discoverPages(params, maxPages = 10) {
  const movies = [];
  for (let page = 1; page <= maxPages; page++) {
    try {
      const data = await tmdb('/discover/movie', { ...params, page });
      movies.push(...data.results);
      if (page >= data.total_pages) break;
      await sleep(DELAY_MS);
    } catch (err) {
      console.warn(`Page ${page} error:`, err.message);
      break;
    }
  }
  return movies;
}

async function getMovieDetails(tmdbId) {
  await sleep(DELAY_MS);
  try {
    const [details, credits] = await Promise.all([
      tmdb(`/movie/${tmdbId}`, { append_to_response: 'keywords,external_ids' }),
      tmdb(`/movie/${tmdbId}/credits`),
    ]);

    const director = credits.crew?.find((c) => c.job === 'Director')?.name || null;
    const leadActor = credits.cast?.[0]?.name || null;

    const genres = (details.genres || []).slice(0, 2).map((g) => g.name);
    const language = details.original_language || null;
    const imdbId = details.external_ids?.imdb_id || details.imdb_id || null;

    // Oscar approximation via keywords
    const keywords = details.keywords?.keywords || [];
    const oscarKw = ['academy award winner', 'academy award nominee', 'oscar winner', 'oscar nominated'];
    const oscarNominated = keywords.some((k) => oscarKw.includes(k.name.toLowerCase()));

    return {
      tmdb_id: tmdbId,
      title: details.title,
      year: details.release_date ? parseInt(details.release_date.split('-')[0]) : null,
      genres,
      director,
      primary_language: language,
      oscar_nominated: oscarNominated,
      lead_actor: leadActor,
      popular_quote: null, // populated via separate curation
      poster_path: details.poster_path,
      imdb_id: imdbId,
      popularity: details.popularity,
    };
  } catch (err) {
    console.warn(`Details fetch failed for ${tmdbId}:`, err.message);
    return null;
  }
}

async function upsertMovie(movie, categories) {
  const client = await pool.connect();
  try {
    await client.query(
      `INSERT INTO movies
         (tmdb_id, title, year, genres, director, primary_language,
          oscar_nominated, lead_actor, popular_quote, poster_path, imdb_id,
          categories, popularity, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,NOW())
       ON CONFLICT (tmdb_id) DO UPDATE SET
         title            = EXCLUDED.title,
         year             = EXCLUDED.year,
         genres           = EXCLUDED.genres,
         director         = EXCLUDED.director,
         primary_language = EXCLUDED.primary_language,
         oscar_nominated  = EXCLUDED.oscar_nominated,
         lead_actor       = EXCLUDED.lead_actor,
         poster_path      = EXCLUDED.poster_path,
         imdb_id          = EXCLUDED.imdb_id,
         categories       = (
           SELECT ARRAY(
             SELECT DISTINCT unnest(movies.categories || EXCLUDED.categories)
           )
         ),
         popularity       = EXCLUDED.popularity,
         updated_at       = NOW()`,
      [
        movie.tmdb_id, movie.title, movie.year, movie.genres, movie.director,
        movie.primary_language, movie.oscar_nominated, movie.lead_actor,
        movie.popular_quote, movie.poster_path, movie.imdb_id,
        categories, movie.popularity,
      ]
    );
  } finally {
    client.release();
  }
}

async function fetchAndStore(label, discoverParams, category, limit) {
  console.log(`\n=== Fetching ${label} (limit ${limit}) ===`);
  const pages = Math.ceil(limit / 20);
  const raw = await discoverPages(discoverParams, pages);
  const slice = raw.slice(0, limit);

  console.log(`  Found ${slice.length} results from TMDB`);

  let stored = 0;
  for (const r of slice) {
    const details = await getMovieDetails(r.id);
    if (!details) continue;
    await upsertMovie(details, [category]);
    stored++;
    process.stdout.write(`\r  Stored ${stored}/${slice.length}`);
  }
  console.log(`\n  Done — ${stored} movies upserted for category '${category}'`);
}

async function main() {
  console.log('CineGuess — Movie pool fetch starting...');

  // 1. Superhero (keyword 9715)
  await fetchAndStore(
    'Superhero',
    {
      sort_by: 'popularity.desc',
      with_keywords: SUPERHERO_KEYWORD_ID,
      'vote_count.gte': 500,
    },
    'superhero',
    75
  );

  // 2. Animated (genre 16)
  await fetchAndStore(
    'Animated',
    {
      sort_by: 'popularity.desc',
      with_genres: ANIMATED_GENRE_ID,
      'vote_count.gte': 500,
    },
    'animated',
    100
  );

  // 3. Bollywood (Hindi-language)
  await fetchAndStore(
    'Bollywood',
    {
      sort_by: 'popularity.desc',
      with_original_language: 'hi',
      'vote_count.gte': 200,
    },
    'indiancinema',
    150
  );

  // 4. Top 250 — popular movies that are NOT in superhero or animated categories
  console.log('\n=== Fetching Top250 pool ===');
  const client = await pool.connect();
  const { rows: existingIds } = await client.query(
    `SELECT tmdb_id FROM movies
     WHERE categories && ARRAY['superhero','animated']::text[]`
  );
  client.release();
  const excludeSet = new Set(existingIds.map((r) => r.tmdb_id));

  const popularRaw = await discoverPages(
    { sort_by: 'popularity.desc', 'vote_count.gte': 1000 },
    15 // fetch extra pages to compensate for exclusions
  );

  const top250pool = popularRaw.filter((m) => !excludeSet.has(m.id));
  const top250slice = top250pool.slice(0, 250);
  console.log(`  Candidates after exclusion: ${top250slice.length}`);

  let stored = 0;
  for (const r of top250slice) {
    const details = await getMovieDetails(r.id);
    if (!details) continue;
    await upsertMovie(details, ['top250']);
    stored++;
    process.stdout.write(`\r  Stored ${stored}/${top250slice.length}`);
  }
  console.log(`\n  Done — ${stored} movies upserted for category 'top250'`);

  console.log('\nAll pools fetched. Run daily-pick script to assign today\'s picks.');
  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
