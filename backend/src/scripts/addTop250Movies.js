/**
 * addTop250Movies.js
 *
 * Bulk-imports movies into the top250 (Most Popular) pool.
 * For each movie:
 *   1. Fetches full TMDB data (details + credits + images)
 *   2. Fetches Oscar win count from OMDb
 *   3. Fetches Oscar nomination + win categories from Wikidata (best-effort)
 *   4. Fetches franchise name from TMDB belongs_to_collection
 *   5. Upserts into movies table, merging 'top250' into categories array
 *
 * Run: node src/scripts/addTop250Movies.js
 */

require('dotenv').config();
const axios = require('axios');
const pool  = require('../db/pool');

const TMDB_KEY = process.env.TMDB_API_KEY;
const OMDB_KEY = process.env.OMDB_API_KEY;
if (!TMDB_KEY) { console.error('TMDB_API_KEY missing'); process.exit(1); }
if (!OMDB_KEY) { console.error('OMDB_API_KEY missing'); process.exit(1); }

const TMDB_BASE    = process.env.TMDB_BASE_URL || 'https://api.themoviedb.org/3';
const sleep        = ms => new Promise(r => setTimeout(r, ms));
// ── Movie list ────────────────────────────────────────────────────────────────
// hint = badly-explained logline (technically accurate, intentionally misleading)
const MOVIES = [
  {
    title: 'Babylon', year: 2022,
    hint: 'A group of ambitious outsiders chase fame inside the Hollywood machine of the 1920s as an entire industry transforms beneath them, and not everyone survives the transition.',
  },
  {
    title: 'We Live in Time', year: 2024,
    hint: 'A chance encounter between a recently divorced cereal executive and a chef is told out of order as they build a life together and face something they cannot plan around.',
  },
  {
    title: 'Asteroid City', year: 2023,
    hint: 'A junior stargazer competition in a remote desert town is indefinitely suspended after an extraterrestrial incident, all framed as a televised theatrical production of a play.',
  },
  {
    title: 'Sicario', year: 2015,
    hint: 'An idealistic FBI agent volunteers for a shadowy task force targeting drug cartels, and gradually realizes she was recruited for a very specific and uncomfortable reason.',
  },
  {
    title: 'The Edge of Seventeen', year: 2016,
    hint: "A socially isolated teenager's only friendship collapses when her best friend starts dating her older brother, leaving her to catastrophically navigate the rest of high school alone.",
  },
  {
    title: 'Moneyball', year: 2011,
    hint: "A cash-strapped baseball team's general manager ignores every traditional scout and rebuilds his roster using a computer model based on statistics almost nobody believes in.",
  },
  {
    title: 'Dazed and Confused', year: 1993,
    hint: 'On the last day of high school in 1976, seniors ritually haze incoming freshmen while everyone tries to figure out what to do with themselves for the rest of their lives.',
  },
  {
    title: '22 Jump Street', year: 2014,
    hint: 'Two mismatched cops go undercover at a college to stop a drug ring, and openly acknowledge the entire mission is identical to the last one, which is the joke.',
  },
  {
    title: 'Tick, Tick... Boom!', year: 2021,
    hint: 'A struggling musical theater composer approaches his 30th birthday convinced he is running out of time, writing the show that will eventually lead to the show that will define him.',
  },
  {
    title: 'Rear Window', year: 1954,
    hint: 'A bedridden photographer becomes convinced his neighbor murdered his wife, based entirely on fragments he can observe from his apartment window.',
  },
  {
    title: 'Almost Famous', year: 2000,
    hint: 'A 15-year-old lies his way onto a rock band\'s tour bus on assignment for a major music magazine, falls for a groupie who insists she is a Band-Aid, and writes the piece that could ruin everyone.',
  },
  {
    title: 'Vertigo', year: 1958,
    hint: 'A retired detective with a crippling fear of heights is hired to follow a friend\'s wife and becomes so obsessed with her that he tries to rebuild another woman in her exact image.',
  },
  {
    title: 'The Usual Suspects', year: 1995,
    hint: 'A barely coherent survivor tells police how five criminals were mysteriously assembled for a job that may have been orchestrated by a master criminal who may not exist at all.',
  },
  {
    title: 'Tropic Thunder', year: 2008,
    hint: 'A group of pampered method actors making a Vietnam War epic are accidentally dropped into real jungle danger, and the biggest star refuses to break character.',
  },
  {
    title: 'Happy Gilmore', year: 1996,
    hint: 'A violent, rage-fueled hockey washout accidentally discovers he can drive a golf ball 400 yards and joins the PGA Tour to save his grandmother\'s house from the IRS.',
  },
  {
    title: 'The 40-Year-Old Virgin', year: 2005,
    hint: "A kind, mild-mannered electronics store employee's work friends discover he has never slept with anyone and immediately make it their collective mission to fix that.",
  },
  {
    title: 'Game Night', year: 2018,
    hint: "A competitive couple's regular game night escalates into what they believe is an elaborate murder mystery experience, except one of the kidnappings is completely real.",
  },
  {
    title: 'Step Brothers', year: 2008,
    hint: 'Two fully grown unemployed men still living with their respective single parents are forced to share a bedroom when their parents fall in love and get married.',
  },
  {
    title: 'The Talented Mr. Ripley', year: 1999,
    hint: 'A low-class forger is hired by a wealthy family to retrieve their playboy son from Italy and gradually decides he would rather just become him.',
  },
  {
    title: 'Project X', year: 2012,
    hint: 'Three unpopular high school seniors throw a party intended to make them famous at school and succeed beyond any reasonable measure of disaster.',
  },
  {
    title: 'Bridesmaids', year: 2011,
    hint: "A broke, professionally struggling woman is asked to be maid of honor at her best friend's wedding and competes with a wealthy new friend for the bride's attention while everything in her own life falls apart.",
  },
  {
    title: 'Borat: Cultural Learnings of America for Make Benefit Glorious Nation of Kazakhstan', year: 2006,
    hint: 'A fictional Kazakhstani journalist travels across America to document its culture and inadvertently exposes the genuine beliefs of real people who do not realise he is a parody.',
  },
  {
    title: 'Napoleon Dynamite', year: 2004,
    hint: 'A socially clueless Idaho teenager with no discernible skills campaigns for his new friend\'s class presidency while his uncle relives past glories and his brother courts a woman online.',
  },
  {
    title: 'Manchester by the Sea', year: 2016,
    hint: 'A withdrawn handyman returns to his small Massachusetts hometown after his brother dies, is named guardian of his teenage nephew, and finds himself completely unable to escape what happened there before.',
  },
  {
    title: 'The Iron Claw', year: 2023,
    hint: 'A Texas wrestling dynasty blessed with physical gifts carries what seems like a literal family curse, as successive brothers keep dying and the father refuses to stop pushing.',
  },
  {
    title: 'Furiosa: A Mad Max Saga', year: 2024,
    hint: 'A young girl kidnapped from a paradise settlement grows up inside a warlord\'s camp plotting a decades-long escape and revenge, becoming the woman who will one day make a very different run.',
  },
  {
    title: 'All Quiet on the Western Front', year: 2022,
    hint: 'A German teenager eagerly enlists in World War I expecting glory and arrives to find industrialised slaughter with no meaning, no progress, and no end in sight.',
  },
  {
    title: 'Waves', year: 2019,
    hint: "A high-achieving Florida teen's suppressed pressures explode into an act that destroys his family, told in two halves — the fall and what remains after.",
  },
  // ── Mission: Impossible series ───────────────────────────────────────────────
  {
    title: 'Mission: Impossible', year: 1996,
    hint: 'A top IMF agent is framed for the deaths of his entire team and goes rogue to expose the real mole, breaking into the most secure server room in the world along the way.',
  },
  {
    title: 'Mission: Impossible 2', year: 2000,
    hint: 'An IMF agent on a climbing holiday is recruited to recover a dangerous engineered virus from a rogue former colleague, using a woman who used to love that colleague.',
  },
  {
    title: 'Mission: Impossible III', year: 2006,
    hint: 'A retired spy pulled back for one last job captures an arms dealer, who immediately responds by kidnapping his fiancée to negotiate his own release.',
  },
  {
    title: 'Mission: Impossible - Ghost Protocol', year: 2011,
    hint: 'The entire IMF agency is disavowed after a Kremlin bombing, leaving four agents to stop a nuclear launch entirely on their own with no official support and improvised equipment.',
  },
  {
    title: 'Mission: Impossible - Rogue Nation', year: 2015,
    hint: 'An IMF agent goes deep undercover inside a shadow organisation of disavowed spies that nobody in government will officially admit exists.',
  },
  {
    title: 'Mission: Impossible - Fallout', year: 2018,
    hint: 'An agent prioritises saving a teammate over recovering stolen plutonium cores, then has roughly six days to get them back before three nuclear devices detonate simultaneously.',
  },
  {
    title: 'Mission: Impossible – Dead Reckoning Part One', year: 2023,
    hint: 'Every intelligence agency on earth is hunting the same object, and the one man who refuses to weaponise it is the only one who knows what it actually does.',
  },
  // ── Others ───────────────────────────────────────────────────────────────────
  {
    title: 'Boogie Nights', year: 1997,
    hint: 'A well-endowed teenage busboy is discovered by a porn filmmaker in the 1970s and becomes a star, then rides the industry\'s decline into the crack-fuelled despair of the 1980s.',
  },
  {
    title: 'Magnolia', year: 1999,
    hint: 'On one rainy day in the San Fernando Valley, nine desperately unhappy strangers each have the worst day of their lives simultaneously, and it ends with frogs.',
  },
  {
    title: '12 Years a Slave', year: 2013,
    hint: 'A free Black man living in New York is drugged, kidnapped, and sold into slavery in 1841 Louisiana, and spends twelve years trying to survive without losing himself entirely.',
  },
  {
    title: 'Hamilton', year: 2020,
    hint: 'The American Founding Father who never became president is immortalised in a hip-hop musical showing how his compulsive ambition destroyed everything he built, told by the people he left behind.',
  },
  {
    title: 'Creed', year: 2015,
    hint: "The illegitimate son of a legendary boxer tracks down his father's old rival — now a dying ex-convict — to train him, because apparently that was the pitch.",
  },
  {
    title: 'Rush Hour', year: 1998,
    hint: 'A Hong Kong detective flies to Los Angeles to find a kidnapped girl and is immediately partnered with an LAPD detective nobody else wants to work with.',
  },
];

// ── TMDB helpers ──────────────────────────────────────────────────────────────
async function fetchTmdb(title, year) {
  const search = await axios.get(`${TMDB_BASE}/search/movie`, {
    params: { api_key: TMDB_KEY, query: title, year, language: 'en-US' },
    timeout: 8000,
  });
  let result = (search.data.results || []).find(r =>
    r.release_date && parseInt(r.release_date.slice(0, 4)) === year
  ) || search.data.results?.[0];

  if (!result) {
    const search2 = await axios.get(`${TMDB_BASE}/search/movie`, {
      params: { api_key: TMDB_KEY, query: title, language: 'en-US' },
      timeout: 8000,
    });
    result = search2.data.results?.[0];
  }
  if (!result) throw new Error(`Not found on TMDB: ${title} (${year})`);

  const details = await axios.get(`${TMDB_BASE}/movie/${result.id}`, {
    params: { api_key: TMDB_KEY, append_to_response: 'credits,images,external_ids', language: 'en-US' },
    timeout: 8000,
  });
  return details.data;
}

// ── OMDb: Oscar win count ─────────────────────────────────────────────────────
function parseOscars(awardsStr) {
  if (!awardsStr || awardsStr === 'N/A') return 0;
  const wonMatch = awardsStr.match(/Won (\d+) Oscar/i);
  if (wonMatch) return parseInt(wonMatch[1], 10);
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

// ── Wikidata: award categories (P1411 = nominated, P166 = won) ────────────────
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
    .map(label => label.replace(/^Academy Award for /i, '').trim())
    .sort();
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function run() {
  console.log(`\nAdding ${MOVIES.length} top250 movies...\n`);
  let ok = 0, failed = 0;

  for (const movie of MOVIES) {
    try {
      process.stdout.write(`  Fetching: ${movie.title} (${movie.year})... `);
      await sleep(300);
      const d = await fetchTmdb(movie.title, movie.year);

      const tmdbId       = d.id;
      const title        = d.title;
      const year         = d.release_date ? parseInt(d.release_date.slice(0, 4)) : movie.year;
      const genres       = (d.genres || []).slice(0, 2).map(g => g.name);
      const director     = d.credits?.crew?.find(c => c.job === 'Director')?.name || null;
      const cast         = d.credits?.cast || [];
      const top10        = cast.slice(0, 10);
      const leadActor    = top10[0]?.name || null;
      const supportActor = top10[1]?.name || null;
      const castList     = top10.map(c => c.name);
      const castProfiles = top10.map(c => c.profile_path || null);
      const imdbId       = d.external_ids?.imdb_id || null;
      const studio       = d.production_companies?.[0]?.name || null;
      const franchise    = d.belongs_to_collection?.name || null;

      // Oscar data
      let oscarWins = 0, nomCats = [], winCats = [];
      try {
        oscarWins = await fetchOmdb(imdbId);
        await sleep(300);
      } catch { /* skip */ }

      if (oscarWins > 0 && imdbId) {
        try {
          [nomCats, winCats] = await Promise.all([
            fetchWikidataAwardCategories(imdbId, 'P1411'),
            fetchWikidataAwardCategories(imdbId, 'P166'),
          ]);
          await sleep(600);
        } catch { /* skip */ }
      }

      await pool.query(
        `INSERT INTO movies (
           tmdb_id, title, year, genres, director, primary_language,
           lead_actor, supporting_actor, cast_list, cast_profiles,
           poster_path, imdb_id, categories, popularity,
           production_studio, franchise_name,
           oscar_wins, oscar_nomination_categories, oscar_win_categories,
           ai_hint_quote,
           oscar_nominated, created_at, updated_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,NOW(),NOW())
         ON CONFLICT (tmdb_id) DO UPDATE SET
           title                       = EXCLUDED.title,
           year                        = EXCLUDED.year,
           genres                      = EXCLUDED.genres,
           director                    = EXCLUDED.director,
           primary_language            = EXCLUDED.primary_language,
           lead_actor                  = EXCLUDED.lead_actor,
           supporting_actor            = EXCLUDED.supporting_actor,
           cast_list                   = EXCLUDED.cast_list,
           cast_profiles               = EXCLUDED.cast_profiles,
           poster_path                 = EXCLUDED.poster_path,
           imdb_id                     = EXCLUDED.imdb_id,
           categories                  = (
             SELECT ARRAY(SELECT DISTINCT unnest(movies.categories || EXCLUDED.categories))
           ),
           popularity                  = EXCLUDED.popularity,
           production_studio           = EXCLUDED.production_studio,
           franchise_name              = EXCLUDED.franchise_name,
           oscar_wins                  = EXCLUDED.oscar_wins,
           oscar_nomination_categories = EXCLUDED.oscar_nomination_categories,
           oscar_win_categories        = EXCLUDED.oscar_win_categories,
           ai_hint_quote               = EXCLUDED.ai_hint_quote,
           updated_at                  = NOW()`,
        [
          tmdbId, title, year, genres, director, d.original_language,
          leadActor, supportActor, castList, castProfiles,
          d.poster_path || null, imdbId, ['top250'], d.popularity || 0,
          studio, franchise,
          oscarWins, nomCats, winCats,
          movie.hint,
          oscarWins > 0,
        ]
      );

      const nomStr = nomCats.length > 0 ? ` noms=${nomCats.length}` : '';
      const winStr = winCats.length > 0 ? ` wins=${winCats.length}` : '';
      console.log(`✓  ${title} (${year})${nomStr}${winStr}`);
      ok++;
    } catch (err) {
      console.log(`✗`);
      console.error(`  Error: ${movie.title}: ${err.message}`);
      failed++;
    }

    await sleep(400);
  }

  console.log(`\nDone. ${ok} added/updated, ${failed} failed.`);
  await pool.end();
}

run().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
