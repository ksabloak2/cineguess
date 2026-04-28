/**
 * importAnimated.js
 *
 * Rebuilds the entire 'animated' movie pool from 5 studio sources:
 *   1. Pixar       — hardcoded complete filmography (all 28 theatrical films)
 *   2. Illumination — Letterboxd list
 *   3. DreamWorks  — Letterboxd list
 *   4. Studio Ghibli — Letterboxd list
 *   5. Disney      — hardcoded list provided by user
 *
 * Run: node src/scripts/importAnimated.js
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
// Hardcoded lists
// ---------------------------------------------------------------
const PIXAR_MOVIES = [
  { title: 'Toy Story',             year: 1995 },
  { title: "A Bug's Life",          year: 1998 },
  { title: 'Toy Story 2',           year: 1999 },
  { title: 'Monsters, Inc.',        year: 2001 },
  { title: 'Finding Nemo',          year: 2003 },
  { title: 'The Incredibles',       year: 2004 },
  { title: 'Cars',                  year: 2006 },
  { title: 'Ratatouille',           year: 2007 },
  { title: 'WALL-E',                year: 2008 },
  { title: 'Up',                    year: 2009 },
  { title: 'Toy Story 3',           year: 2010 },
  { title: 'Cars 2',                year: 2011 },
  { title: 'Brave',                 year: 2012 },
  { title: 'Monsters University',   year: 2013 },
  { title: 'Inside Out',            year: 2015 },
  { title: 'The Good Dinosaur',     year: 2015 },
  { title: 'Finding Dory',          year: 2016 },
  { title: 'Cars 3',                year: 2017 },
  { title: 'Coco',                  year: 2017 },
  { title: 'Incredibles 2',         year: 2018 },
  { title: 'Toy Story 4',           year: 2019 },
  { title: 'Onward',                year: 2020 },
  { title: 'Soul',                  year: 2020 },
  { title: 'Luca',                  year: 2021 },
  { title: 'Turning Red',           year: 2022 },
  { title: 'Lightyear',             year: 2022 },
  { title: 'Elemental',             year: 2023 },
  { title: 'Inside Out 2',          year: 2024 },
];

const DISNEY_MOVIES = [
  { title: 'The Lion King',                    year: 1994 },
  { title: 'Frozen',                           year: 2013 },
  { title: 'Moana',                            year: 2016 },
  { title: 'Aladdin',                          year: 1992 },
  { title: 'Beauty and the Beast',             year: 1991 },
  { title: 'The Little Mermaid',               year: 1989 },
  { title: 'Zootopia',                         year: 2016 },
  { title: 'Tangled',                          year: 2010 },
  { title: 'Mulan',                            year: 1998 },
  { title: 'Encanto',                          year: 2021 },
  { title: 'Wreck-It Ralph',                   year: 2012 },
  { title: 'Ralph Breaks the Internet',        year: 2018 },
  { title: 'Moana 2',                          year: 2024 },
  { title: 'Frozen II',                        year: 2019 },
  { title: 'Lilo & Stitch',                    year: 2002 },
  { title: 'Tarzan',                           year: 1999 },
  { title: 'Hercules',                         year: 1997 },
  { title: 'The Hunchback of Notre Dame',      year: 1996 },
  { title: 'Pocahontas',                       year: 1995 },
  { title: 'Big Hero 6',                       year: 2014 },
  { title: 'Snow White and the Seven Dwarfs',  year: 1937 },
  { title: 'Cinderella',                       year: 1950 },
  { title: 'Sleeping Beauty',                  year: 1959 },
  { title: 'Pinocchio',                        year: 1940 },
  { title: 'Fantasia',                         year: 1940 },
  { title: 'Bambi',                            year: 1942 },
  { title: 'Dumbo',                            year: 1941 },
  { title: 'Alice in Wonderland',              year: 1951 },
  { title: 'Peter Pan',                        year: 1953 },
  { title: 'Lady and the Tramp',               year: 1955 },
  { title: 'The Jungle Book',                  year: 1967 },
  { title: 'Robin Hood',                       year: 1973 },
  { title: 'The Aristocats',                   year: 1970 },
  { title: 'One Hundred and One Dalmatians',   year: 1961 },
  { title: 'The Sword in the Stone',           year: 1963 },
  { title: 'The Rescuers',                     year: 1977 },
  { title: 'The Fox and the Hound',            year: 1981 },
  { title: 'The Emperor\'s New Groove',        year: 2000 },
  { title: 'Brother Bear',                     year: 2003 },
  { title: 'Home on the Range',                year: 2004 },
  { title: 'Bolt',                             year: 2008 },
  { title: 'The Princess and the Frog',        year: 2009 },
  { title: 'Raya and the Last Dragon',         year: 2021 },
  { title: 'Strange World',                    year: 2022 },
  { title: 'Wish',                             year: 2023 },
  { title: 'Zootopia 2',                       year: 2025 },
];

// Major Studio Ghibli hits only (hardcoded so we don't pull the full
// Letterboxd list which includes obscure / short-form titles)
const GHIBLI_MOVIES = [
  { title: 'Spirited Away',        year: 2001 },
  { title: 'My Neighbor Totoro',   year: 1988 },
  { title: 'Princess Mononoke',    year: 1997 },
  { title: "Howl's Moving Castle", year: 2004 },
  { title: 'Grave of the Fireflies', year: 1988 },
];

const LETTERBOXD_SOURCES = [
  {
    label: 'Illumination',
    url: 'https://letterboxd.com/mroreo1/list/illumination-movies-ranked/',
  },
  {
    label: 'DreamWorks',
    url: 'https://letterboxd.com/schaffrillas/list/every-dreamworks-movie-ranked/',
  },
];

// ---------------------------------------------------------------
// Letterboxd scraper
// ---------------------------------------------------------------
async function scrapePage(url) {
  const res = await axios.get(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    timeout: 15000,
  });

  const $ = cheerio.load(res.data);
  const movies = [];
  const seen = new Set();
  const html = res.data;
  const slugRegex = /\/film\/([a-z0-9][a-z0-9-]+[a-z0-9])\/(?!image|json|fans|likes|reviews|page)/g;
  let match;

  while ((match = slugRegex.exec(html)) !== null) {
    const slug = match[1];
    if (['members','lists','films','reviews','diary','tags'].includes(slug)) continue;
    if (seen.has(slug)) continue;
    seen.add(slug);

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

    const title = cleanSlug
      .split('-')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');

    movies.push({ title, year: extractedYear, slug: cleanSlug });
  }

  const nextLink = $('a.next').attr('href');
  return { movies, nextUrl: nextLink ? `https://letterboxd.com${nextLink}` : null };
}

async function scrapeLetterboxdList(startUrl) {
  const allMovies = [];
  let url = startUrl;
  let page = 1;
  while (url) {
    try {
      const { movies, nextUrl } = await scrapePage(url);
      allMovies.push(...movies);
      url = nextUrl;
      page++;
      await sleep(600);
    } catch (err) {
      console.warn(`  Page ${page} scrape failed: ${err.message}`);
      break;
    }
  }
  return allMovies;
}

// ---------------------------------------------------------------
// TMDB search + details
// ---------------------------------------------------------------
async function searchTMDB(title, year, slug) {
  const attempts = [title];
  if (slug) {
    const fromSlug = slug.replace(/-/g, ' ');
    if (fromSlug !== title.toLowerCase()) attempts.push(fromSlug);
  }
  const withoutArticle = title.replace(/^(The|A|An) /i, '');
  if (withoutArticle !== title) attempts.push(withoutArticle);

  for (const query of attempts) {
    try {
      if (year) {
        const res = await axios.get(`${TMDB_BASE}/search/movie`, {
          params: { api_key: TMDB_KEY, query, year, language: 'en-US' },
        });
        const results = res.data.results || [];
        if (results.length) {
          const exact = results.find(r => {
            const ry = r.release_date ? parseInt(r.release_date.split('-')[0]) : null;
            return ry === year;
          });
          if (exact) return exact;
          if (results[0]) return results[0];
        }
      }
      const res2 = await axios.get(`${TMDB_BASE}/search/movie`, {
        params: { api_key: TMDB_KEY, query, language: 'en-US' },
      });
      const results2 = res2.data.results || [];
      if (results2.length) return results2[0];
    } catch {}
    await sleep(150);
  }
  return null;
}

async function fetchDetails(tmdbId) {
  try {
    const [details, credits] = await Promise.all([
      axios.get(`${TMDB_BASE}/movie/${tmdbId}`, {
        params: { api_key: TMDB_KEY, append_to_response: 'keywords,external_ids' },
      }),
      axios.get(`${TMDB_BASE}/movie/${tmdbId}/credits`, { params: { api_key: TMDB_KEY } }),
    ]);
    const d = details.data;
    const c = credits.data;
    const director  = c.crew?.find(p => p.job === 'Director')?.name || null;
    const leadActor = c.cast?.[0]?.name || null;
    const genres    = (d.genres || []).slice(0, 2).map(g => g.name);
    const imdbId    = d.external_ids?.imdb_id || d.imdb_id || null;
    const keywords  = d.keywords?.keywords || [];
    const oscarKw   = ['academy award winner','academy award nominee','oscar winner','oscar nominated'];
    const oscarNom  = keywords.some(k => oscarKw.includes(k.name.toLowerCase()));
    return {
      tmdb_id: d.id, title: d.title,
      year: d.release_date ? parseInt(d.release_date.split('-')[0]) : null,
      genres, director, primary_language: d.original_language,
      oscar_nominated: oscarNom, lead_actor: leadActor, popular_quote: null,
      poster_path: d.poster_path, imdb_id: imdbId, popularity: d.popularity,
    };
  } catch { return null; }
}

async function upsertMovie(movie) {
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
         lead_actor       = EXCLUDED.lead_actor,
         poster_path      = EXCLUDED.poster_path,
         imdb_id          = EXCLUDED.imdb_id,
         categories       = (
           SELECT ARRAY(SELECT DISTINCT unnest(movies.categories || EXCLUDED.categories))
         ),
         popularity       = EXCLUDED.popularity,
         updated_at       = NOW()`,
      [
        movie.tmdb_id, movie.title, movie.year, movie.genres, movie.director,
        movie.primary_language, movie.oscar_nominated, movie.lead_actor,
        movie.popular_quote, movie.poster_path, movie.imdb_id,
        ['animated'], movie.popularity,
      ]
    );
  } finally { client.release(); }
}

// ---------------------------------------------------------------
// Process a batch of { title, year, slug? } movies
// ---------------------------------------------------------------
async function processBatch(movies, label) {
  console.log(`\n  Processing ${movies.length} movies from ${label}...`);
  let stored = 0, skipped = 0;
  const skippedList = [];

  for (let i = 0; i < movies.length; i++) {
    const { title, year, slug } = movies[i];
    process.stdout.write(`\r    [${i + 1}/${movies.length}] "${title}" — stored: ${stored} skipped: ${skipped}   `);

    await sleep(DELAY_MS);
    const searchResult = await searchTMDB(title, year, slug);
    if (!searchResult) {
      skipped++;
      skippedList.push(`"${title}" (${year || '?'})`);
      continue;
    }

    await sleep(DELAY_MS);
    const details = await fetchDetails(searchResult.id);
    if (!details) { skipped++; continue; }

    await upsertMovie(details);
    stored++;
  }

  console.log(`\n    Done — stored: ${stored}, skipped: ${skipped}`);
  if (skippedList.length) {
    console.log(`    Skipped: ${skippedList.join(', ')}`);
  }
  return stored;
}

// ---------------------------------------------------------------
// Clear animated category
// ---------------------------------------------------------------
async function clearAnimated() {
  const client = await pool.connect();
  try {
    await client.query(
      `UPDATE movies SET categories = array_remove(categories, 'animated')
       WHERE 'animated' = ANY(categories)`
    );
    await client.query(`DELETE FROM movies WHERE categories = '{}'`);
    console.log('  Cleared existing animated pool');
  } finally { client.release(); }
}

// ---------------------------------------------------------------
// Main
// ---------------------------------------------------------------
async function main() {
  console.log('\nCineGuess — Animated Pool Import');
  console.log('Studios: Pixar, Studio Ghibli (major hits), Illumination, DreamWorks, Disney\n');

  // Step 1: Clear old animated pool
  console.log('Step 1: Clearing old animated pool...');
  await clearAnimated();

  let totalStored = 0;

  // Step 2: Pixar (hardcoded)
  console.log('\nStep 2: Pixar (hardcoded filmography)');
  totalStored += await processBatch(PIXAR_MOVIES, 'Pixar');

  // Step 3: Disney (hardcoded)
  console.log('\nStep 3: Disney (hardcoded list)');
  totalStored += await processBatch(DISNEY_MOVIES, 'Disney');

  // Step 4: Studio Ghibli major hits (hardcoded)
  console.log('\nStep 4: Studio Ghibli (hardcoded major hits)');
  totalStored += await processBatch(GHIBLI_MOVIES, 'Studio Ghibli');

  // Step 5+: Letterboxd sources (Illumination, DreamWorks)
  for (let i = 0; i < LETTERBOXD_SOURCES.length; i++) {
    const { label, url } = LETTERBOXD_SOURCES[i];
    console.log(`\nStep ${i + 5}: ${label} (Letterboxd)`);
    console.log(`  Scraping ${url}...`);
    const movies = await scrapeLetterboxdList(url);
    console.log(`  Scraped ${movies.length} movies`);
    if (movies.length) {
      totalStored += await processBatch(movies, label);
    }
  }

  // Final count
  const client = await pool.connect();
  const { rows } = await client.query(
    `SELECT COUNT(*) as total FROM movies WHERE 'animated' = ANY(categories)`
  );
  client.release();

  console.log(`\n${'='.repeat(50)}`);
  console.log(`Animated pool complete!`);
  console.log(`Total movies stored: ${rows[0].total}`);
  console.log(`\nRun 'npm run daily-pick' to assign today's animated pick.`);
  process.exit(0);
}

main().catch(err => {
  console.error('\nFatal error:', err);
  process.exit(1);
});
