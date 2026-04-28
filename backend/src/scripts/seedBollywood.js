/**
 * seedBollywood.js  (now seeds the 'indiancinema' category)
 *
 * Rebuilds the Indian Cinema movie pool from a curated list covering
 * Bollywood (Hindi), Tollywood (Telugu), Kollywood (Tamil), and more.
 *
 * Steps:
 *   1. Untags every existing movie from 'indiancinema' (keeps other categories).
 *   2. Clears indiancinema entries from used_movies and future daily_picks.
 *   3. For each title in INDIAN_CINEMA_LIST: searches TMDB by title+year,
 *      fetches details + credits, and upserts with categories=['indiancinema'].
 *   4. Populates cast_list (top 10 billed cast) so the lead-actor tile can
 *      return yellow when a guess's lead actor appears in the target's cast.
 *
 * Run: node src/scripts/seedBollywood.js
 */

require('dotenv').config({ override: true });
const axios = require('axios');
const pool  = require('../db/pool');

const TMDB_BASE = process.env.TMDB_BASE_URL || 'https://api.themoviedb.org/3';
const TMDB_KEY  = process.env.TMDB_API_KEY;
const DELAY_MS  = 250;

if (!TMDB_KEY) {
  console.error('TMDB_API_KEY is not set. Aborting.');
  process.exit(1);
}

// 204 curated titles — Bollywood, Telugu, Tamil, Malayalam blockbusters + indie gems
// (47 low-visibility titles removed April 2026; 67 new titles added April 2026)
const INDIAN_CINEMA_LIST = [
  // ── Blockbusters & Franchises ──────────────────────────────
  ['Dangal',                           2016],
  ['Dhurandhar',                       2025],
  ['Pathaan',                          2023],
  ['Jawan',                            2023],
  ['Bajrangi Bhaijaan',                2015],
  ['Secret Superstar',                 2017],
  ['PK',                               2014],
  ['Sultan',                           2016],
  ['Sanju',                            2018],
  ['Padmaavat',                        2018],
  ['Dhoom 3',                          2013],
  ['War',                              2019],
  ['Stree 2',                          2024],
  ['Tiger Zinda Hai',                  2017],
  ['Simmba',                           2018],
  ['Brahmastra: Part One - Shiva',     2022],
  ['Sooryavanshi',                     2021],
  ['Kabir Singh',                      2019],
  ['Tanhaji',                          2020],
  ['Bhool Bhulaiyaa 2',                2022],
  ['The Kashmir Files',                2022],
  ['Gadar 2',                          2023],
  ['Animal',                           2023],
  ['Fighter',                          2024],
  ['Singham Again',                    2024],
  // ── SRK Classics ──────────────────────────────────────────
  ['Dilwale Dulhania Le Jayenge',      1995],
  ['Kuch Kuch Hota Hai',               1998],
  ['Kabhi Khushi Kabhie Gham...',      2001],
  ['Kal Ho Naa Ho',                    2003],
  ['Veer-Zaara',                       2004],
  ['My Name Is Khan',                  2010],
  ['Chennai Express',                  2013],
  ['Happy New Year',                   2014],
  ['Dilwale',                          2015],
  ['Raees',                            2017],
  ['Swades',                           2004],
  ['Dil Se..',                         1998],
  ['Devdas',                           2002],
  ['Don',                              2006],
  ['Don 2',                            2011],
  ['Om Shanti Om',                     2007],
  // ── Aamir Khan Classics ────────────────────────────────────
  ['Chak De! India',                   2007],
  ['Rab Ne Bana Di Jodi',              2008],
  ['3 Idiots',                         2009],
  ['Lagaan',                           2001],
  ['Taare Zameen Par',                 2007],
  ['Ghajini',                          2008],
  ['Dil Chahta Hai',                   2001],
  ['Rang De Basanti',                  2006],
  ['Fanaa',                            2006],
  // ── Dhoom Franchise ────────────────────────────────────────
  ['Dhoom',                            2004],
  ['Dhoom 2',                          2006],
  ['Talaash',                          2012],
  // ── Retro & Golden Era ─────────────────────────────────────
  ['Sarfarosh',                        1999],
  ['Andaz Apna Apna',                  1994],
  ['Jo Jeeta Wohi Sikandar',           1992],
  ['Qayamat Se Qayamat Tak',           1988],
  ['Sholay',                           1975],
  ['Deewaar',                          1975],
  ['Agneepath',                        1990],
  // ── Salman Khan Hits ───────────────────────────────────────
  ['Dabangg',                          2010],
  ['Dabangg 2',                        2012],
  ['Ek Tha Tiger',                     2012],
  ['Bodyguard',                        2011],
  ['Kick',                             2014],
  ['Prem Ratan Dhan Payo',             2015],
  ['Bharat',                           2019],
  // ── Amitabh Bachchan ───────────────────────────────────────
  ['Mohabbatein',                      2000],
  ['Baghban',                          2003],
  ['Black',                            2005],
  ['Paa',                              2009],
  ['Badla',                            2019],
  // ── Hrithik Roshan ─────────────────────────────────────────
  ['Kaho Naa... Pyaar Hai',            2000],
  ['Koi... Mil Gaya',                  2003],
  ['Krrish',                           2006],
  ['Krrish 3',                         2013],
  ['Jodhaa Akbar',                     2008],
  ['Bang Bang!',                       2014],
  ['Super 30',                         2019],
  ['Vikram Vedha',                     2022],
  // ── Ranveer / Deepika Era ──────────────────────────────────
  ['Bajirao Mastani',                  2015],
  ['Gully Boy',                        2019],
  ['83',                               2021],
  ['Rocky Aur Rani Kii Prem Kahaani', 2023],
  // ── Ranbir / Alia Era ──────────────────────────────────────
  ['Rockstar',                         2011],
  ['Barfi!',                           2012],
  ['Yeh Jawaani Hai Deewani',          2013],
  ['Tamasha',                          2015],
  ['Ae Dil Hai Mushkil',               2016],
  // ── Female-led / Drama ─────────────────────────────────────
  ['Piku',                             2015],
  ['Cocktail',                         2012],
  ['Queen',                            2013],
  ['Kahaani',                          2012],
  ['English Vinglish',                 2012],
  ['Thappad',                          2020],
  ['Gangubai Kathiawadi',              2022],
  // ── Munna Bhai / Comedy ────────────────────────────────────
  ['Munna Bhai M.B.B.S.',              2003],
  ['Lage Raho Munna Bhai',             2006],
  ['Dunki',                            2023],
  ['Kabhi Alvida Naa Kehna',           2006],
  // ── Thriller & Crime ───────────────────────────────────────
  ['Raazi',                            2018],
  ['Good Newwz',                       2019],
  ['Shershaah',                        2021],
  ['Gangs of Wasseypur',               2012],
  ['Gangs of Wasseypur - Part 2',      2012],
  ['Andhadhun',                        2018],
  ['Drishyam',                         2015],
  ['Drishyam 2',                       2022],
  ['A Wednesday!',                     2008],
  ['Special 26',                       2013],
  // ── Nostalgia Classics ─────────────────────────────────────
  ['Hum Aapke Hain Koun..!',           1994],
  ['Maine Pyar Kiya',                  1989],
  ['Karan Arjun',                      1995],
  ['Baazigar',                         1993],
  ['Darr',                             1993],
  // ── Zoya / Imtiaz / Arthouse ───────────────────────────────
  ['Zindagi Na Milegi Dobara',         2011],
  ['Band Baaja Baaraat',               2010],
  ['Dil Dhadakne Do',                  2015],
  ['Udta Punjab',                      2016],
  ['Ludo',                             2020],
  // ── Horror / Genre ─────────────────────────────────────────
  ['Stree',                            2018],
  // ── Coming of Age / Romance ────────────────────────────────
  ['Wake Up Sid',                      2009],
  ['Ishaqzaade',                       2012],
  ['Jab We Met',                       2007],
  ['Love Aaj Kal',                     2009],
  ['Kai Po Che!',                      2013],
  // ── Biopics ────────────────────────────────────────────────
  ['Bhaag Milkha Bhaag',               2013],
  ['Mary Kom',                         2014],
  ['Neerja',                           2016],
  ['Toilet: Ek Prem Katha',            2017],
  ['Pad Man',                          2018],
  ['Manikarnika: The Queen of Jhansi', 2019],
  ['Shakuntala Devi',                  2020],
  // ── Recent Releases ────────────────────────────────────────
  ['Gehraiyaan',                       2022],
  ['Laal Singh Chaddha',               2022],
  ['Crew',                             2024],
  ['Kesari',                           2019],
  ['OMG 2',                            2023],
  // ── Romance / Young India ──────────────────────────────────
  ['Aashiqui 2',                       2013],
  ['Jab Harry Met Sejal',              2017],
  ['Jab Tak Hai Jaan',                 2012],
  ['Dear Zindagi',                     2016],
  ['Humpty Sharma Ki Dulhania',        2014],
  ['Badrinath Ki Dulhania',            2017],
  ['Half Girlfriend',                  2017],
  ['Hamari Adhuri Kahani',             2015],
  ['Hasee Toh Phasee',                 2014],
  ['Kapoor & Sons',                    2016],
  ['Befikre',                          2016],
  ['Baar Baar Dekho',                  2016],
  ['Raabta',                           2017],
  ['Anjaana Anjaani',                  2010],
  ['Hum Tum',                          2004],
  ['Heyy Babyy',                       2007],
  ['Bachna Ae Haseeno',                2008],
  ['Dostana',                          2008],
  ['I Hate Luv Storys',                2010],
  ['Salaam Namaste',                   2005],
  ['2 States',                         2014],
  ['Teri Meri Kahaani',                2012],
  ['Student of the Year',              2012],
  ['Jagga Jasoos',                     2017],
  // ── Action / Masala ────────────────────────────────────────
  ['Baaghi',                           2016],
  ['Race',                             2008],
  ['Race 2',                           2013],
  ['Ek Villain',                       2014],
  ['Malang',                           2020],
  ['Kaabil',                           2017],
  ['Kalank',                           2019],
  ['Singh Is Kinng',                   2008],
  ['Gabbar Is Back',                   2015],
  ['New York',                         2009],
  ['Kurbaan',                          2009],
  ['Lakshya',                          2004],
  ['Airlift',                          2016],
  // ── Indie / Thriller / Art-house ──────────────────────────
  ['Badlapur',                         2015],
  ['Kaminey',                          2009],
  ['Iqbal',                            2005],
  ['Tumbbad',                          2018],
  ['Vicky Donor',                      2012],
  ['Rocket Singh: Salesman of the Year', 2009],
  ['Badhaai Ho',                       2018],
  ['Bombay',                           1995],
  ['Satya',                            1998],
  ['Kumbalangi Nights',                2019],
  ['Super Deluxe',                     2019],
  // ── Comedy / Feel-good ─────────────────────────────────────
  ['ABCD 2',                           2015],
  ['Sonu Ke Titu Ki Sweety',           2018],
  ['Love Breakups Zindagi',            2011],
  ['Desi Boyz',                        2011],
  ['Dum Maaro Dum',                    2011],
  ['Ladies vs Ricky Bahl',             2011],
  ['Phata Poster Nikhla Hero',         2013],
  ['Shaandaar',                        2015],
  // ── South India / Pan-Indian Blockbusters ─────────────────
  ['Baahubali: The Beginning',         2015],
  ['Baahubali 2: The Conclusion',      2017],
  ['RRR',                              2022],
  ['KGF: Chapter 1',                   2018],
  ['KGF: Chapter 2',                   2022],
  ['Pushpa: The Rise',                 2021],
  ['Pushpa 2: The Rule',               2024],
  ['Kalki 2898 AD',                    2024],
  ['Kantara',                          2022],
  ['Vikram',                           2022],
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function tmdb(path, params = {}) {
  const res = await axios.get(`${TMDB_BASE}${path}`, {
    params: { api_key: TMDB_KEY, ...params },
  });
  return res.data;
}

async function searchMovie(title, year) {
  // Try with year first, fall back without year
  const tryQuery = async (params) => {
    const data = await tmdb('/search/movie', params);
    return data.results || [];
  };

  let results = await tryQuery({ query: title, year, include_adult: false });
  if (!results.length) {
    results = await tryQuery({ query: title, primary_release_year: year, include_adult: false });
  }
  if (!results.length) {
    results = await tryQuery({ query: title, include_adult: false });
  }
  if (!results.length) return null;

  // Prefer Indian-language results closest to target year
  const INDIAN_LANGS = new Set(['hi', 'te', 'ta', 'ml', 'mr', 'kn', 'bn', 'pa']);
  const scored = results.map((r) => {
    const rYear = r.release_date ? parseInt(r.release_date.split('-')[0], 10) : null;
    const yearDiff = rYear && year ? Math.abs(rYear - year) : 99;
    const langBoost = INDIAN_LANGS.has(r.original_language) ? 0 : 5;
    return { r, score: yearDiff + langBoost };
  });
  scored.sort((a, b) => a.score - b.score);
  return scored[0].r;
}

async function getMovieDetails(tmdbId) {
  await sleep(DELAY_MS);
  const [details, credits] = await Promise.all([
    tmdb(`/movie/${tmdbId}`, { append_to_response: 'keywords,external_ids' }),
    tmdb(`/movie/${tmdbId}/credits`),
  ]);

  const director        = credits.crew?.find((c) => c.job === 'Director')?.name || null;
  const castList        = (credits.cast || []).slice(0, 10).map((c) => c.name);
  const leadActor       = castList[0] || null;
  const supportingActor = castList[1] || null;

  const genres   = (details.genres || []).slice(0, 2).map((g) => g.name);
  const language = details.original_language || null;
  const imdbId   = details.external_ids?.imdb_id || details.imdb_id || null;

  return {
    tmdb_id:          tmdbId,
    title:            details.title,
    year:             details.release_date ? parseInt(details.release_date.split('-')[0], 10) : null,
    genres,
    director,
    primary_language:  language,
    lead_actor:        leadActor,
    supporting_actor:  supportingActor,
    cast_list:         castList,
    poster_path:       details.poster_path,
    imdb_id:           imdbId,
    popularity:        details.popularity,
  };
}

async function upsertBollywood(client, movie) {
  // Upsert with 'indiancinema' appended to existing categories (dedup via DISTINCT).
  // cast_list always overwrites.
  await client.query(
    `INSERT INTO movies
       (tmdb_id, title, year, genres, director, primary_language,
        lead_actor, supporting_actor, cast_list, poster_path, imdb_id,
        categories, popularity, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11, ARRAY['indiancinema']::text[], $12, NOW())
     ON CONFLICT (tmdb_id) DO UPDATE SET
       title             = EXCLUDED.title,
       year              = EXCLUDED.year,
       genres            = EXCLUDED.genres,
       director          = EXCLUDED.director,
       primary_language  = EXCLUDED.primary_language,
       lead_actor        = EXCLUDED.lead_actor,
       supporting_actor  = EXCLUDED.supporting_actor,
       cast_list         = EXCLUDED.cast_list,
       poster_path       = EXCLUDED.poster_path,
       imdb_id           = EXCLUDED.imdb_id,
       categories        = (
         SELECT ARRAY(
           SELECT DISTINCT unnest(movies.categories || ARRAY['indiancinema']::text[])
         )
       ),
       popularity        = EXCLUDED.popularity,
       updated_at        = NOW()`,
    [
      movie.tmdb_id, movie.title, movie.year, movie.genres, movie.director,
      movie.primary_language, movie.lead_actor, movie.supporting_actor,
      movie.cast_list, movie.poster_path, movie.imdb_id,
      movie.popularity,
    ]
  );
}

async function main() {
  console.log(`\n=== Seeding Indian Cinema (${INDIAN_CINEMA_LIST.length} titles) ===\n`);

  const client = await pool.connect();
  try {
    // 1. Remove 'indiancinema' from every existing movie so only the new list carries it.
    console.log('Clearing existing indiancinema assignments...');
    await client.query(
      `UPDATE movies SET categories = array_remove(categories, 'indiancinema')`
    );
    // Delete movies that were ONLY in indiancinema (now have empty categories)
    const { rowCount: orphaned } = await client.query(
      `DELETE FROM movies WHERE categories = '{}' OR categories IS NULL`
    );
    console.log(`  Removed ${orphaned} orphaned movie rows`);

    // 2. Clear repeat-window tracking and future daily picks
    await client.query(`DELETE FROM used_movies WHERE category = 'indiancinema'`);
    await client.query(`DELETE FROM daily_picks WHERE category = 'indiancinema'`);

    // 3. Seed the new list
    let stored = 0, missed = 0;
    const misses = [];
    for (const [title, year] of INDIAN_CINEMA_LIST) {
      try {
        const hit = await searchMovie(title, year);
        if (!hit) {
          misses.push(`${title} (${year})`);
          missed++;
          process.stdout.write(`\r  Progress: ${stored + missed}/${INDIAN_CINEMA_LIST.length} — MISS: ${title}\n`);
          continue;
        }
        const details = await getMovieDetails(hit.id);
        await upsertBollywood(client, details);
        stored++;
        process.stdout.write(`\r  Progress: ${stored + missed}/${INDIAN_CINEMA_LIST.length} — ${details.title}            `);
      } catch (err) {
        misses.push(`${title} (${year}) — ${err.message}`);
        missed++;
      }
      await sleep(DELAY_MS);
    }

    console.log(`\n\nDone. Stored: ${stored}, missed: ${missed}`);
    if (misses.length) {
      console.log('\nMisses:');
      misses.forEach((m) => console.log(`  - ${m}`));
    }
  } finally {
    client.release();
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  });
