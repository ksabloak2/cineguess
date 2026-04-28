/**
 * importSuperhero.js
 *
 * Rebuilds the 'superhero' movie pool from 4 hardcoded universes:
 *   MCU, DC, Sony Spider-Man, Fox X-Men & Fantastic Four
 *
 * Run: node src/scripts/importSuperhero.js
 */

require('dotenv').config();
const axios = require('axios');
const pool  = require('../db/pool');

const TMDB_BASE = process.env.TMDB_BASE_URL || 'https://api.themoviedb.org/3';
const TMDB_KEY  = process.env.TMDB_API_KEY;
const DELAY_MS  = 275;

if (!TMDB_KEY) { console.error('TMDB_API_KEY not set'); process.exit(1); }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------
// Full movie list
// ---------------------------------------------------------------
const SUPERHERO_MOVIES = [
  // --- MCU ---
  { title: 'Iron Man',                                        year: 2008 },
  { title: 'The Incredible Hulk',                            year: 2008 },
  { title: 'Iron Man 2',                                     year: 2010 },
  { title: 'Thor',                                           year: 2011 },
  { title: 'Captain America: The First Avenger',             year: 2011 },
  { title: 'The Avengers',                                   year: 2012 },
  { title: 'Iron Man 3',                                     year: 2013 },
  { title: 'Thor: The Dark World',                           year: 2013 },
  { title: 'Captain America: The Winter Soldier',            year: 2014 },
  { title: 'Guardians of the Galaxy',                        year: 2014 },
  { title: 'Avengers: Age of Ultron',                        year: 2015 },
  { title: 'Ant-Man',                                        year: 2015 },
  { title: 'Captain America: Civil War',                     year: 2016 },
  { title: 'Doctor Strange',                                 year: 2016 },
  { title: 'Guardians of the Galaxy Vol. 2',                 year: 2017 },
  { title: 'Spider-Man: Homecoming',                         year: 2017 },
  { title: 'Thor: Ragnarok',                                 year: 2017 },
  { title: 'Black Panther',                                  year: 2018 },
  { title: 'Avengers: Infinity War',                         year: 2018 },
  { title: 'Ant-Man and the Wasp',                           year: 2018 },
  { title: 'Captain Marvel',                                 year: 2019 },
  { title: 'Avengers: Endgame',                              year: 2019 },
  { title: 'Spider-Man: Far From Home',                      year: 2019 },
  { title: 'Black Widow',                                    year: 2021 },
  { title: 'Shang-Chi and the Legend of the Ten Rings',      year: 2021 },
  { title: 'Eternals',                                       year: 2021 },
  { title: 'Spider-Man: No Way Home',                        year: 2021 },
  { title: 'Doctor Strange in the Multiverse of Madness',    year: 2022 },
  { title: 'Thor: Love and Thunder',                         year: 2022 },
  { title: 'Black Panther: Wakanda Forever',                 year: 2022 },
  { title: 'Ant-Man and the Wasp: Quantumania',              year: 2023 },
  { title: 'Guardians of the Galaxy Vol. 3',                 year: 2023 },
  { title: 'The Marvels',                                    year: 2023 },
  { title: 'Deadpool & Wolverine',                           year: 2024 },
  { title: 'Captain America: Brave New World',               year: 2025 },
  { title: 'Thunderbolts*',                                  year: 2025 },
  { title: 'The Fantastic Four: First Steps',                year: 2025 },

  // --- DC ---
  { title: 'Batman: The Movie',                              year: 1966 },
  { title: 'Superman',                                       year: 1978 },
  { title: 'Superman II',                                    year: 1980 },
  { title: 'Superman III',                                   year: 1983 },
  { title: 'Supergirl',                                      year: 1984 },
  { title: 'Superman IV: The Quest for Peace',               year: 1987 },
  { title: 'Batman',                                         year: 1989 },
  { title: 'Batman Returns',                                 year: 1992 },
  { title: 'Batman: Mask of the Phantasm',                   year: 1993 },
  { title: 'Batman Forever',                                 year: 1995 },
  { title: 'Batman & Robin',                                 year: 1997 },
  { title: 'Steel',                                          year: 1997 },
  { title: 'Batman Begins',                                  year: 2005 },
  { title: 'Catwoman',                                       year: 2004 },
  { title: 'Constantine',                                    year: 2005 },
  { title: 'V for Vendetta',                                 year: 2005 },
  { title: 'Superman Returns',                               year: 2006 },
  { title: 'The Dark Knight',                                year: 2008 },
  { title: 'Watchmen',                                       year: 2009 },
  { title: 'Green Lantern',                                  year: 2011 },
  { title: 'The Dark Knight Rises',                          year: 2012 },
  { title: 'Man of Steel',                                   year: 2013 },
  { title: 'Batman v Superman: Dawn of Justice',             year: 2016 },
  { title: 'Suicide Squad',                                  year: 2016 },
  { title: 'Wonder Woman',                                   year: 2017 },
  { title: 'Justice League',                                 year: 2017 },
  { title: 'The Lego Batman Movie',                          year: 2017 },
  { title: 'Aquaman',                                        year: 2018 },
  { title: 'Shazam!',                                        year: 2019 },
  { title: 'Joker',                                          year: 2019 },
  { title: 'Birds of Prey',                                  year: 2020 },
  { title: 'Wonder Woman 1984',                              year: 2020 },
  { title: "Zack Snyder's Justice League",                   year: 2021 },
  { title: 'The Suicide Squad',                              year: 2021 },
  { title: 'Teen Titans Go! To the Movies',                  year: 2018 },
  { title: 'The Batman',                                     year: 2022 },
  { title: 'Black Adam',                                     year: 2022 },
  { title: 'The Flash',                                      year: 2023 },
  { title: 'Shazam! Fury of the Gods',                       year: 2023 },
  { title: 'Aquaman and the Lost Kingdom',                   year: 2023 },
  { title: 'Blue Beetle',                                    year: 2023 },
  { title: 'Joker: Folie à Deux',                            year: 2024 },
  { title: 'Superman',                                       year: 2025 },

  // --- Sony Spider-Man ---
  { title: 'Spider-Man',                                     year: 2002 },
  { title: 'Spider-Man 2',                                   year: 2004 },
  { title: 'Spider-Man 3',                                   year: 2007 },
  { title: 'Ghost Rider',                                    year: 2007 },
  { title: 'The Amazing Spider-Man',                         year: 2012 },
  { title: 'Ghost Rider: Spirit of Vengeance',               year: 2012 },
  { title: 'The Amazing Spider-Man 2',                       year: 2014 },
  { title: 'Spider-Man: Into the Spider-Verse',              year: 2018 },
  { title: 'Venom',                                          year: 2018 },
  { title: 'Venom: Let There Be Carnage',                    year: 2021 },
  { title: 'Morbius',                                        year: 2022 },
  { title: 'Spider-Man: Across the Spider-Verse',            year: 2023 },
  { title: 'Venom: The Last Dance',                          year: 2024 },
  { title: 'Madame Web',                                     year: 2024 },
  { title: 'Kraven the Hunter',                              year: 2024 },

  // --- Fox X-Men & Fantastic Four ---
  { title: 'X-Men',                                          year: 2000 },
  { title: 'X2',                                             year: 2003 },
  { title: 'Fantastic Four',                                 year: 2005 },
  { title: 'X-Men: The Last Stand',                          year: 2006 },
  { title: 'Fantastic Four: Rise of the Silver Surfer',      year: 2007 },
  { title: 'X-Men Origins: Wolverine',                       year: 2009 },
  { title: 'X-Men: First Class',                             year: 2011 },
  { title: 'The Wolverine',                                  year: 2013 },
  { title: 'X-Men: Days of Future Past',                     year: 2014 },
  { title: 'X-Men: Apocalypse',                              year: 2016 },
  { title: 'Deadpool',                                       year: 2016 },
  { title: 'Logan',                                          year: 2017 },
  { title: 'Deadpool 2',                                     year: 2018 },
  { title: 'X-Men: Dark Phoenix',                            year: 2019 },
  { title: 'The New Mutants',                                year: 2020 },
  { title: 'Fantastic Four',                                 year: 2015 },
];

// ---------------------------------------------------------------
// TMDB search
// ---------------------------------------------------------------
async function searchTMDB(title, year) {
  const attempts = [title, title.replace(/[*!]/g, '').trim()];
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
      if (res2.data.results?.length) return res2.data.results[0];
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
    return {
      tmdb_id: d.id, title: d.title,
      year: d.release_date ? parseInt(d.release_date.split('-')[0]) : null,
      genres, director, primary_language: d.original_language,
      oscar_nominated: false, lead_actor: leadActor, popular_quote: null,
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
        ['superhero'], movie.popularity,
      ]
    );
  } finally { client.release(); }
}

async function clearSuperhero() {
  const client = await pool.connect();
  try {
    await client.query(
      `UPDATE movies SET categories = array_remove(categories, 'superhero')
       WHERE 'superhero' = ANY(categories)`
    );
    await client.query(`DELETE FROM movies WHERE categories = '{}'`);
    console.log('  Cleared existing superhero pool');
  } finally { client.release(); }
}

// ---------------------------------------------------------------
// Main
// ---------------------------------------------------------------
async function main() {
  console.log('\nCineGuess — Superhero Pool Import');
  console.log(`Total movies to import: ${SUPERHERO_MOVIES.length}\n`);

  console.log('Step 1: Clearing old superhero pool...');
  await clearSuperhero();

  console.log('\nStep 2: Fetching TMDB data...\n');
  let stored = 0, skipped = 0;
  const skippedList = [];

  for (let i = 0; i < SUPERHERO_MOVIES.length; i++) {
    const { title, year } = SUPERHERO_MOVIES[i];
    process.stdout.write(`\r  [${i + 1}/${SUPERHERO_MOVIES.length}] "${title}" — stored: ${stored} skipped: ${skipped}   `);

    await sleep(DELAY_MS);
    const searchResult = await searchTMDB(title, year);
    if (!searchResult) {
      skipped++;
      skippedList.push(`"${title}" (${year})`);
      continue;
    }

    await sleep(DELAY_MS);
    const details = await fetchDetails(searchResult.id);
    if (!details) {
      skipped++;
      skippedList.push(`"${title}" (${year}) — details failed`);
      continue;
    }

    await upsertMovie(details);
    stored++;
  }

  // Re-run Oscar update for newly imported movies
  console.log('\n\nStep 3: Applying Best Picture oscar flags...');
  const client = await pool.connect();
  try {
    // Oscar nominees already in DB will be correct; just ensure new ones default to false
    await client.query(
      `UPDATE movies SET oscar_nominated = false
       WHERE 'superhero' = ANY(categories) AND oscar_nominated IS NULL`
    );
  } finally { client.release(); }

  const client2 = await pool.connect();
  const { rows } = await client2.query(
    `SELECT COUNT(*) as total FROM movies WHERE 'superhero' = ANY(categories)`
  );
  client2.release();

  console.log(`\n${'='.repeat(50)}`);
  console.log(`Superhero pool complete!`);
  console.log(`  Stored:  ${stored}`);
  console.log(`  Skipped: ${skipped}`);
  console.log(`  Total in DB: ${rows[0].total}`);

  if (skippedList.length) {
    console.log('\nSkipped:');
    skippedList.forEach(s => console.log(`  - ${s}`));
  }

  console.log(`\nRun 'npm run daily-pick' to assign today's superhero pick.`);
  process.exit(0);
}

main().catch(err => {
  console.error('\nFatal error:', err);
  process.exit(1);
});
