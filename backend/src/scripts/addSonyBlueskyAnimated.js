/**
 * addSonyBlueskyAnimated.js
 *
 * Bulk-imports Sony Animation and Blue Sky Studios movies into the animated pool.
 * For each movie:
 *   1. Fetches full TMDB data (details + credits + images)
 *   2. Upserts into movies table with all core fields
 *   3. Sets animated metadata (style, studio, sequel, protagonist, musical)
 *   4. Sets hardcoded AI hint quote (badly explained logline)
 *   5. Uses top TMDB backdrop images as game frames (backdrop_paths)
 *   6. Backfills cast_profiles from TMDB credit profile paths
 *
 * Run: node src/scripts/addSonyBlueskyAnimated.js
 */

require('dotenv').config();
const axios = require('axios');
const pool  = require('../db/pool');

const TMDB_BASE = process.env.TMDB_BASE_URL || 'https://api.themoviedb.org/3';
const TMDB_KEY  = process.env.TMDB_API_KEY;
if (!TMDB_KEY) { console.error('TMDB_API_KEY missing'); process.exit(1); }

const sleep = ms => new Promise(r => setTimeout(r, ms));
const MAX_BACKDROPS = 10;

// ── Movie list ────────────────────────────────────────────────────────────────
// Fields: title, year, studio, style, sequel, protagonist, musical, hint
// hint = badly-explained logline (technically accurate, intentionally misleading)
const MOVIES = [
  // ── Sony Animation ──────────────────────────────────────────────────────────
  {
    title: 'Cloudy with a Chance of Meatballs', year: 2009,
    studio: 'Sony Animation', style: 'CGI/3D', sequel: true, protagonist: 'Human', musical: false,
    hint: 'A misunderstood inventor finally earns his town\'s approval by feeding them, until the food becomes the threat.',
  },
  {
    title: 'Cloudy with a Chance of Meatballs 2', year: 2013,
    studio: 'Sony Animation', style: 'CGI/3D', sequel: true, protagonist: 'Human', musical: false,
    hint: 'A young inventor returns to his abandoned island to discover his machine has been running this whole time, making walking food creatures.',
  },
  {
    title: 'The Mitchells vs. the Machines', year: 2021,
    studio: 'Sony Animation', style: 'CGI/3D', sequel: false, protagonist: 'Human', musical: false,
    hint: 'A dysfunctional family on a road trip accidentally becomes humanity\'s last line of defense against a global robot uprising.',
  },
  {
    title: 'Hotel Transylvania', year: 2012,
    studio: 'Sony Animation', style: 'CGI/3D', sequel: true, protagonist: 'Fantasy Creature', musical: false,
    hint: 'A single father\'s lifelong plan to keep his daughter sheltered from the world collapses the moment a backpacker wanders in.',
  },
  {
    title: 'Hotel Transylvania 2', year: 2015,
    studio: 'Sony Animation', style: 'CGI/3D', sequel: true, protagonist: 'Fantasy Creature', musical: false,
    hint: 'An overprotective grandfather refuses to accept that his mixed-heritage grandson might just be a perfectly ordinary child.',
  },
  {
    title: 'Hotel Transylvania 3: Summer Vacation', year: 2018,
    studio: 'Sony Animation', style: 'CGI/3D', sequel: true, protagonist: 'Fantasy Creature', musical: false,
    hint: 'A widowed father finally starts dating again, unaware that his new love interest was specifically hired to destroy him.',
  },
  {
    title: "Surf's Up", year: 2007,
    studio: 'Sony Animation', style: 'CGI/3D', sequel: false, protagonist: 'Animal', musical: false,
    hint: 'A flightless bird from Antarctica abandons everything to become a professional wave rider and eventually learns the point was never the trophy.',
  },
  {
    title: 'The Emoji Movie', year: 2017,
    studio: 'Sony Animation', style: 'CGI/3D', sequel: false, protagonist: 'Object', musical: false,
    hint: 'A face that cannot control its expressions escapes its digital prison and goes on the run to become something it was never designed to be.',
  },
  {
    title: 'The Smurfs', year: 2011,
    studio: 'Sony Animation', style: 'Mixed', sequel: true, protagonist: 'Fantasy Creature', musical: false,
    hint: 'After a botched escape attempt, a group of tiny blue creatures ends up stranded in New York and gets temporarily adopted by a stranger.',
  },
  {
    title: 'Open Season', year: 2006,
    studio: 'Sony Animation', style: 'CGI/3D', sequel: true, protagonist: 'Animal', musical: false,
    hint: 'A pampered bear raised by a park ranger gets forcibly released into the wild and immediately panics about survival.',
  },
  {
    title: 'G.O.A.T.', year: 2025,
    studio: 'Sony Animation', style: 'CGI/3D', sequel: false, protagonist: 'Animal', musical: false,
    hint: 'A farm animal who believes he is destined for greatness sets out to prove himself in a world that keeps telling him otherwise.',
  },

  // ── Blue Sky Studios ─────────────────────────────────────────────────────────
  {
    title: 'Rio', year: 2011,
    studio: 'Blue Sky Studios', style: 'CGI/3D', sequel: true, protagonist: 'Animal', musical: true,
    hint: 'The last known male of a rare bird species is transported from Minnesota to South America to save his kind, then immediately kidnapped.',
  },
  {
    title: 'Rio 2', year: 2014,
    studio: 'Blue Sky Studios', style: 'CGI/3D', sequel: true, protagonist: 'Animal', musical: true,
    hint: 'A bird who thought his species was nearly extinct discovers an entire colony of relatives deep in the jungle who want nothing to do with him.',
  },
  {
    title: 'Robots', year: 2005,
    studio: 'Blue Sky Studios', style: 'CGI/3D', sequel: false, protagonist: 'Robot/AI', musical: false,
    hint: 'A young inventor arrives in the big city to meet his hero, only to discover the dream factory has become a profit-driven replacement racket.',
  },
  {
    title: 'Horton Hears a Who!', year: 2008,
    studio: 'Blue Sky Studios', style: 'CGI/3D', sequel: false, protagonist: 'Animal', musical: false,
    hint: 'A large animal risks total social ostracism to protect an entire civilization living on a speck of dust that no one else believes exists.',
  },
  {
    title: 'Ice Age', year: 2002,
    studio: 'Blue Sky Studios', style: 'CGI/3D', sequel: true, protagonist: 'Animal', musical: false,
    hint: 'Three mismatched prehistoric animals end up accidentally babysitting a human infant across a frozen landscape during a global climate shift.',
  },
  {
    title: 'Ice Age: The Meltdown', year: 2006,
    studio: 'Blue Sky Studios', style: 'CGI/3D', sequel: true, protagonist: 'Animal', musical: false,
    hint: 'An overconfident woolly mammoth discovers he may not be the last of his kind, while his entire valley floods beneath him.',
  },
  {
    title: 'Ice Age: Dawn of the Dinosaurs', year: 2009,
    studio: 'Blue Sky Studios', style: 'CGI/3D', sequel: true, protagonist: 'Animal', musical: false,
    hint: 'A prehistoric sloth steals dinosaur eggs and gets dragged underground, forcing his friends to enter a hidden world where a supposedly extinct species never actually left.',
  },
  {
    title: 'Ice Age: Continental Drift', year: 2012,
    studio: 'Blue Sky Studios', style: 'CGI/3D', sequel: true, protagonist: 'Animal', musical: false,
    hint: 'A mammoth gets separated from his family when the ground literally breaks apart, and has to sail home on a floating rock.',
  },
  {
    title: 'The Peanuts Movie', year: 2015,
    studio: 'Blue Sky Studios', style: 'CGI/3D', sequel: false, protagonist: 'Human', musical: false,
    hint: 'A chronically unlucky and socially awkward child spends an entire school year trying to impress a new classmate and fails at virtually everything.',
  },
];

// ── TMDB helpers ──────────────────────────────────────────────────────────────
async function fetchTmdb(title, year) {
  // Search
  const search = await axios.get(`${TMDB_BASE}/search/movie`, {
    params: { api_key: TMDB_KEY, query: title, year, language: 'en-US' },
    timeout: 8000,
  });
  let result = (search.data.results || []).find(r =>
    r.release_date && parseInt(r.release_date.slice(0, 4)) === year
  ) || search.data.results?.[0];

  if (!result) {
    // Try without year
    const search2 = await axios.get(`${TMDB_BASE}/search/movie`, {
      params: { api_key: TMDB_KEY, query: title, language: 'en-US' },
      timeout: 8000,
    });
    result = search2.data.results?.[0];
  }
  if (!result) throw new Error(`Not found on TMDB: ${title} (${year})`);

  // Full details
  const details = await axios.get(`${TMDB_BASE}/movie/${result.id}`, {
    params: { api_key: TMDB_KEY, append_to_response: 'credits,images,external_ids', language: 'en-US' },
    timeout: 8000,
  });
  return details.data;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function run() {
  console.log(`\nAdding ${MOVIES.length} Sony + Blue Sky animated movies...\n`);

  let ok = 0, failed = 0;

  for (const movie of MOVIES) {
    try {
      process.stdout.write(`  Fetching: ${movie.title} (${movie.year})... `);
      await sleep(300);
      const d = await fetchTmdb(movie.title, movie.year);

      // Core fields
      const tmdbId   = d.id;
      const title    = d.title;
      const year     = d.release_date ? parseInt(d.release_date.slice(0, 4)) : movie.year;
      const genres   = (d.genres || []).slice(0, 2).map(g => g.name);
      const director = d.credits?.crew?.find(c => c.job === 'Director')?.name || null;
      const cast     = d.credits?.cast || [];
      const top10    = cast.slice(0, 10);
      const leadActor      = top10[0]?.name || null;
      const supportActor   = top10[1]?.name || null;
      const castList       = top10.map(c => c.name);
      const castProfiles   = top10.map(c => c.profile_path || null);
      const imdbId   = d.external_ids?.imdb_id || d.imdb_id || null;

      // Backdrops: top-rated TMDB backdrops
      const backdrops = (d.images?.backdrops || [])
        .sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0))
        .slice(0, MAX_BACKDROPS)
        .map(b => b.file_path);

      // Upsert movie
      await pool.query(
        `INSERT INTO movies (
           tmdb_id, title, year, genres, director, primary_language,
           lead_actor, supporting_actor, cast_list, cast_profiles,
           poster_path, imdb_id, categories, popularity,
           animation_style, animation_studio, has_sequel, protagonist_type, is_musical,
           ai_hint_quote, backdrop_paths,
           oscar_nominated, created_at, updated_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,NOW(),NOW())
         ON CONFLICT (tmdb_id) DO UPDATE SET
           title             = EXCLUDED.title,
           year              = EXCLUDED.year,
           genres            = EXCLUDED.genres,
           director          = EXCLUDED.director,
           primary_language  = EXCLUDED.primary_language,
           lead_actor        = EXCLUDED.lead_actor,
           supporting_actor  = EXCLUDED.supporting_actor,
           cast_list         = EXCLUDED.cast_list,
           cast_profiles     = EXCLUDED.cast_profiles,
           poster_path       = EXCLUDED.poster_path,
           imdb_id           = EXCLUDED.imdb_id,
           categories        = (
             SELECT ARRAY(SELECT DISTINCT unnest(movies.categories || EXCLUDED.categories))
           ),
           popularity        = EXCLUDED.popularity,
           animation_style   = EXCLUDED.animation_style,
           animation_studio  = EXCLUDED.animation_studio,
           has_sequel        = EXCLUDED.has_sequel,
           protagonist_type  = EXCLUDED.protagonist_type,
           is_musical        = EXCLUDED.is_musical,
           ai_hint_quote     = EXCLUDED.ai_hint_quote,
           backdrop_paths    = EXCLUDED.backdrop_paths,
           updated_at        = NOW()`,
        [
          tmdbId, title, year, genres, director, d.original_language,
          leadActor, supportActor, castList, castProfiles,
          d.poster_path || null, imdbId, ['animated'], d.popularity || 0,
          movie.style, movie.studio, movie.sequel, movie.protagonist, movie.musical,
          movie.hint, backdrops,
          false,
        ]
      );

      console.log(`✓  ${title} (${year}) — ${backdrops.length} backdrops`);
      ok++;
    } catch (err) {
      console.log(`✗`);
      console.error(`  Error: ${movie.title}: ${err.message}`);
      failed++;
    }
  }

  console.log(`\nDone. ${ok} added/updated, ${failed} failed.`);
  await pool.end();
}

run().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
