const pool   = require('../db/pool');
const logger = require('../utils/logger');

// "unlimited" used to be a category but is now a MODE (daily | unlimited) —
// unlimited is handled client-side so the server only validates the 4 real
// categories. The legacy value is still accepted so old clients / streaks
// don't explode mid-deploy; new code should not send it.
const VALID_CATEGORIES = ['top250', 'superhero', 'animated', 'indiancinema'];
const VALID_UNLIMITED_CATEGORIES = ['unlimited_top250', 'unlimited_superhero', 'unlimited_animated', 'unlimited_indiancinema'];
const LEGACY_UNLIMITED = 'unlimited';

// ── Hint costs: type-specific (canonical) + sequential (legacy fallback) ──────
// Type-specific: cost is fixed per hint type regardless of reveal order.
//   actor = cast member, clue = logline, image = frame, music = song
const HINT_TYPE_COSTS = {
  top250:       { actor: 1, clue: 3, image: 4 },
  superhero:    { clue: 3, image: 4 },
  animated:     { clue: 3, image: 4 },
  indiancinema: { actor: 1, clue: 2, image: 3, music: 4 },
};

// Sequential fallback (kept for backward compat — not used when hints_cost provided)
const HINT_COSTS = {
  top250:       [1, 3, 4],
  superhero:    [3, 4],
  animated:     [3, 4],
  indiancinema: [1, 2, 3, 4],
};

/**
 * Calculate the score for a completed daily game.
 * @param {string}      category
 * @param {number}      guessCount  total guesses submitted (last was correct if won)
 * @param {number}      hintsCount  number of hints revealed (used for no-hint bonus check)
 * @param {boolean}     won
 * @param {number|null} hintsCost   pre-computed type-specific hint cost from frontend
 */
function calculateScore(category, guessCount, hintsCount, won, hintsCost = null) {
  if (!won) return 0;
  // Prefer the frontend-calculated type-specific cost; fall back to sequential
  const hintCost = (hintsCost != null && Number.isFinite(Number(hintsCost)))
    ? Math.max(0, Number(hintsCost))
    : (HINT_COSTS[category] || [1, 3, 4]).slice(0, hintsCount).reduce((s, c) => s + c, 0);
  const misses = Math.max(0, guessCount - 1);
  const bonus  = hintsCount === 0 ? 3 : 0;
  return Math.max(0, 20 - hintCost - misses + bonus);
}

// ---------------------------------------------------------------
// GET /api/game/daily/:category
// Returns the daily pick metadata (without revealing movie title yet)
// and the caller's current guess state for today.
// ---------------------------------------------------------------
async function getDailyState(req, res) {
  const { category } = req.params;
  if (!VALID_CATEGORIES.includes(category)) {
    return res.status(400).json({ error: 'Invalid category' });
  }

  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
  const client = await pool.connect();

  try {
    const { rows } = await client.query(
      `SELECT dp.id, m.id AS movie_id, m.tmdb_id, m.title, m.year,
              m.genres, m.director, m.primary_language,
              m.lead_actor, m.supporting_actor, m.popular_quote, m.poster_path, m.imdb_id,
              m.ai_hint_quote, m.backdrop_paths, m.music_hint_song, m.music_hint_singers,
              m.production_studio,
              m.oscar_wins, m.oscar_nomination_categories, m.franchise_name
       FROM daily_picks dp
       JOIN movies m ON m.id = dp.movie_id
       WHERE dp.category = $1 AND dp.pick_date::date = $2`,
      [category, today]
    );
    const pick = rows[0] || null;

    if (!pick) {
      return res.status(404).json({ error: 'No daily pick found for today. Run daily pick script.' });
    }

    // Fetch user's existing guesses for today (if authenticated)
    let existingGuesses = null;
    let gameOver = false;
    if (req.user) {
      const { rows: guessRows } = await client.query(
        `SELECT guess_list, guesses_taken, won
         FROM guesses
         WHERE user_id = $1 AND category = $2 AND guess_date = $3`,
        [req.user.id, category, today]
      );
      if (guessRows.length) {
        existingGuesses = guessRows[0];
        gameOver = guessRows[0].won !== null;
      }
    }

    // Build response — only reveal movie details if game is over.
    // Starter info (oscar/franchise) is always sent — it's intentionally visible
    // from round start and does not reveal the movie title.
    const safeMovie = pick
      ? {
          tmdb_id:    gameOver ? pick.tmdb_id    : undefined,
          title:      gameOver ? pick.title       : undefined,
          year:       gameOver ? pick.year        : undefined,
          poster_path:gameOver ? pick.poster_path : undefined,
          imdb_id:    gameOver ? pick.imdb_id     : undefined,
          // Starter info — always visible
          oscar_wins:                  pick.oscar_wins,
          oscar_nomination_categories: pick.oscar_nomination_categories,
          franchise_name:              pick.franchise_name,
        }
      : null;

    // Normalize guess_list: legacy rows stored bare tmdb_ids; new rows store {tmdb_id, tiles}.
    const rawGuesses = existingGuesses?.guess_list || [];
    const normalizedGuesses = rawGuesses.map((g) =>
      typeof g === 'number' ? { tmdb_id: g, tiles: null } : g
    );

    res.json({
      date: today,
      category,
      movie: safeMovie,
      guesses: normalizedGuesses,
      guesses_taken: existingGuesses?.guesses_taken || 0,
      won: existingGuesses?.won ?? null,
    });
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------
// GET /api/game/movies/:category
// Returns the full searchable movie pool for the dropdown.
// ---------------------------------------------------------------
async function getMoviePool(req, res) {
  const { category } = req.params;
  if (!VALID_CATEGORIES.includes(category)) {
    return res.status(400).json({ error: 'Invalid category' });
  }

  const done   = logger.startTimer(`movie_pool:${category}`);
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `SELECT tmdb_id, title, year, poster_path, imdb_id, genres, director,
              primary_language, lead_actor, supporting_actor, cast_list, cast_profiles, popular_quote,
              ai_hint_quote, backdrop_paths, music_hint_song, music_hint_singers,
              animation_style, animation_studio, has_sequel, protagonist_type, is_musical,
              superhero_universe, superhero_publisher, hero_villain_focus, solo_or_team, superpower_type,
              production_studio,
              oscar_wins, oscar_nomination_categories, franchise_name
       FROM movies
       WHERE $1 = ANY(categories)
       ORDER BY popularity DESC`,
      [category]
    );
    done({ category, row_count: rows.length });
    // Cache movie pools aggressively — they change at most once a day.
    // stale-while-revalidate lets CDN/browser serve stale data instantly
    // while refreshing in the background.
    res.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
    res.json(rows);
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------
// POST /api/game/guess
// Body: { category, tmdb_id }
// Evaluates a guess and returns comparison tiles.
// ---------------------------------------------------------------
async function submitGuess(req, res) {
  const {
    category,
    tmdb_id,
    guess_count:  clientGuessCount,
    hints_count:  clientHintsCount,
    hints_cost:   clientHintsCost,   // pre-computed type-specific total hint cost
  } = req.body;
  if (!VALID_CATEGORIES.includes(category) || !tmdb_id) {
    return res.status(400).json({ error: 'category and tmdb_id are required' });
  }

  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
  const client = await pool.connect();

  try {
    // Fetch the target movie for today
    let target = null;

    const { rows: pickRows } = await client.query(
      `SELECT m.* FROM daily_picks dp
       JOIN movies m ON m.id = dp.movie_id
       WHERE dp.category = $1 AND dp.pick_date::date = $2`,
      [category, today]
    );
    if (!pickRows.length) {
      return res.status(404).json({ error: 'No daily pick for today' });
    }
    target = pickRows[0];

    // Fetch the guessed movie
    const { rows: guessedRows } = await client.query(
      `SELECT * FROM movies WHERE tmdb_id = $1`,
      [tmdb_id]
    );
    if (!guessedRows.length) {
      return res.status(404).json({ error: 'Guessed movie not found in pool' });
    }
    const guessed = guessedRows[0];

    // Evaluate tiles (animated uses different fields)
    const tiles = evaluateTiles(guessed, target, category);
    const isCorrect = guessed.tmdb_id === target.tmdb_id;

    // Persist guess if user is authenticated
    let serverGameOver = false;
    let serverGuessCount = 0;
    if (req.user) {
      const { rows: existingRows } = await client.query(
        `SELECT id, guess_list, guesses_taken, won FROM guesses
         WHERE user_id = $1 AND category = $2 AND guess_date = $3`,
        [req.user.id, category, today]
      );

      if (existingRows.length && existingRows[0].won !== null) {
        return res.status(409).json({ error: 'Game already completed for today' });
      }

      const prev = existingRows[0];
      // Normalize legacy entries (bare tmdb_ids) to objects so we never mix types.
      const prevList = (prev?.guess_list || []).map((g) =>
        typeof g === 'number' ? { tmdb_id: g, tiles: null } : g
      );
      const newEntry = { tmdb_id, tiles };
      const guessList = [...prevList, newEntry];
      const guessCount = guessList.length;
      const maxGuesses = category === 'indiancinema' ? 8 : 7;
      const gameOver = isCorrect || guessCount >= maxGuesses;
      const won = gameOver ? isCorrect : null;
      serverGameOver = gameOver;
      serverGuessCount = guessCount;

      // Score + hints_count only recorded when the game ends
      const hintsCount = gameOver ? Math.max(0, Number(clientHintsCount) || 0) : null;
      const hintsCost  = clientHintsCost != null ? Number(clientHintsCost) : null;
      const score      = gameOver ? calculateScore(category, guessCount, hintsCount || 0, isCorrect, hintsCost) : null;

      if (!prev) {
        await client.query(
          `INSERT INTO guesses (user_id, category, guess_date, guess_list, guesses_taken, won, completed_at, score, hints_count)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [req.user.id, category, today, JSON.stringify(guessList),
           gameOver ? guessCount : null, won, gameOver ? new Date() : null,
           score, hintsCount]
        );
      } else {
        await client.query(
          `UPDATE guesses SET guess_list=$1, guesses_taken=$2, won=$3, completed_at=$4, score=$5, hints_count=$6
           WHERE id=$7`,
          [JSON.stringify(guessList), gameOver ? guessCount : null, won,
           gameOver ? new Date() : null, score, hintsCount, prev.id]
        );
      }

      // Update streak whenever the game ends — wins increment, losses reset to 0.
      // Skipping a day is not penalised (streak only resets on a wrong answer).
      if (gameOver) {
        await updateStreak(client, req.user.id, category, today, isCorrect);
      }
    }

    // Build progressive hints. For authed users we use the server-tracked count
    // (canonical, untrustable from client). For guests we trust the client-supplied
    // count since we have no server-side state to compare against.
    const guessNumber = req.user
      ? serverGuessCount
      : (Number(clientGuessCount) || 0);
    // When the game is over, reveal ALL hints regardless of guess count.
    const hint = buildHint(target, { guessNumber: serverGameOver ? 99 : guessNumber, category });

    // Reveal full movie on game over (correct guess OR authed user hit 7/7)
    const movieReveal = (isCorrect || serverGameOver)
      ? { title: target.title, poster_path: target.poster_path, imdb_id: target.imdb_id, year: target.year }
      : null;

    // Expose score in the response (only meaningful when gameOver)
    const responseScore = req.user && serverGameOver
      ? calculateScore(
          category, serverGuessCount,
          Math.max(0, Number(clientHintsCount) || 0),
          isCorrect,
          clientHintsCost != null ? Number(clientHintsCost) : null
        )
      : null;

    res.json({
      tiles,
      correct: isCorrect,
      score: responseScore,
      guessed_movie: {
        tmdb_id:             guessed.tmdb_id,
        title:               guessed.title,
        year:                guessed.year,
        poster_path:         guessed.poster_path,
        genres:              guessed.genres,
        director:            guessed.director,
        primary_language:    guessed.primary_language,
        lead_actor:          guessed.lead_actor,
        supporting_actor:    guessed.supporting_actor,
        production_studio:   guessed.production_studio,
        // animated fields
        animation_style:     guessed.animation_style,
        animation_studio:    guessed.animation_studio,
        has_sequel:          guessed.has_sequel,
        protagonist_type:    guessed.protagonist_type,
        is_musical:          guessed.is_musical,
        // superhero fields
        superhero_universe:  guessed.superhero_universe,
        superhero_publisher: guessed.superhero_publisher,
        hero_villain_focus:  guessed.hero_villain_focus,
        solo_or_team:        guessed.solo_or_team,
        superpower_type:     guessed.superpower_type,
      },
      hint,
      movie_reveal: movieReveal,
    });
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------
// POST /api/game/guess/check  (stateless version — for unlimited mode + guests)
// Body: { guessed_tmdb_id, target_tmdb_id, guess_number }
// ---------------------------------------------------------------
async function checkGuess(req, res) {
  const { guessed_tmdb_id, target_tmdb_id, guess_number, category } = req.body;
  if (!guessed_tmdb_id || !target_tmdb_id) {
    return res.status(400).json({ error: 'guessed_tmdb_id and target_tmdb_id are required' });
  }

  const client = await pool.connect();
  try {
    const [{ rows: gRows }, { rows: tRows }] = await Promise.all([
      client.query('SELECT * FROM movies WHERE tmdb_id = $1', [guessed_tmdb_id]),
      client.query('SELECT * FROM movies WHERE tmdb_id = $1', [target_tmdb_id]),
    ]);

    if (!gRows.length || !tRows.length) {
      return res.status(404).json({ error: 'Movie not found' });
    }

    const guessed = gRows[0];
    const target  = tRows[0];
    const tiles   = evaluateTiles(guessed, target);
    const isCorrect = guessed.tmdb_id === target.tmdb_id;
    const hint = buildHint(target, { guessNumber: guess_number || 1, category });

    res.json({ tiles, correct: isCorrect, hint });
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------
// GET /api/game/result/:category  — full movie reveal after game ends
// ---------------------------------------------------------------
async function getResult(req, res) {
  const { category } = req.params;
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
  const client = await pool.connect();

  try {
    const { rows } = await client.query(
      `SELECT m.tmdb_id, m.title, m.year, m.poster_path, m.imdb_id,
              m.lead_actor, m.supporting_actor, m.cast_list, m.cast_profiles,
              m.ai_hint_quote, m.backdrop_paths, m.music_hint_song, m.music_hint_singers
       FROM daily_picks dp
       JOIN movies m ON m.id = dp.movie_id
       WHERE dp.category = $1 AND dp.pick_date::date = $2`,
      [category, today]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });

    const m = rows[0];
    res.json({
      tmdb_id: m.tmdb_id,
      title: m.title,
      year: m.year,
      poster_path: m.poster_path,
      imdb_id: m.imdb_id,
      letterboxd_url: buildLetterboxdUrl(m.title),
      imdb_url: m.imdb_id ? `https://www.imdb.com/title/${m.imdb_id}/` : null,
      hint: buildHint(m, { guessNumber: 99, category }),
    });
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------
// GET /api/game/streaks/:category
// ---------------------------------------------------------------
async function getStreaks(req, res) {
  if (!req.user) return res.status(401).json({ error: 'Auth required' });
  const { category } = req.params;
  const client = await pool.connect();

  try {
    const { rows } = await client.query(
      `SELECT current_streak, longest_streak, last_win_date
       FROM streaks WHERE user_id=$1 AND category=$2`,
      [req.user.id, category]
    );
    const streak = rows[0] || { current_streak: 0, longest_streak: 0, last_win_date: null };

    // Average guesses on won games (daily only — unlimited rounds aren't stored in guesses)
    const { rows: avgRows } = await client.query(
      `SELECT ROUND(AVG(guesses_taken)::numeric, 1) AS avg_guesses
       FROM guesses WHERE user_id=$1 AND category=$2 AND won=true`,
      [req.user.id, category]
    );
    const raw = avgRows[0]?.avg_guesses;
    streak.avg_guesses = raw !== null && raw !== undefined ? parseFloat(raw) : null;

    // Average score on won games where score is recorded (post-launch games)
    const { rows: scoreRows } = await client.query(
      `SELECT ROUND(AVG(score)::numeric, 1) AS avg_score
       FROM guesses WHERE user_id=$1 AND category=$2 AND won=true AND score IS NOT NULL`,
      [req.user.id, category]
    );
    const rawScore = scoreRows[0]?.avg_score;
    streak.avg_score = rawScore !== null && rawScore !== undefined ? parseFloat(rawScore) : null;

    // Count first-guess wins (daily only)
    const { rows: fgRows } = await client.query(
      `SELECT COUNT(*)::int AS cnt
       FROM guesses WHERE user_id=$1 AND category=$2 AND won=true AND guesses_taken=1`,
      [req.user.id, category]
    );
    streak.first_guess_wins = fgRows[0]?.cnt ?? 0;

    // No-hint games within current active streak — count last N won games where hints_count=0
    // N = current_streak. Each no-hint game in the streak adds +5 to Global Rating.
    const currentStreakLen = streak.current_streak || 0;
    if (currentStreakLen > 0 && VALID_CATEGORIES.includes(category)) {
      const { rows: noHintRows } = await client.query(
        `SELECT COUNT(*)::int AS cnt FROM (
           SELECT hints_count FROM guesses
           WHERE user_id=$1 AND category=$2 AND won=true AND score IS NOT NULL
           ORDER BY guess_date DESC
           LIMIT $3
         ) sub WHERE sub.hints_count = 0`,
        [req.user.id, category, currentStreakLen]
      );
      streak.no_hint_in_streak = noHintRows[0]?.cnt ?? 0;
    } else {
      streak.no_hint_in_streak = 0;
    }

    // Global Rating for this category: (current_streak * 10) + avg_score + (no_hint_in_streak * 5)
    const avgScoreVal = streak.avg_score || 0;
    streak.global_rating = Math.round(
      (currentStreakLen * 10) + avgScoreVal + (streak.no_hint_in_streak * 5)
    );

    res.json(streak);
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------
// GET /api/game/calendar/:category
// Returns win/loss for the last 30 days
// ---------------------------------------------------------------
async function getCalendar(req, res) {
  if (!req.user) return res.status(401).json({ error: 'Auth required' });
  const { category } = req.params;
  const client = await pool.connect();

  try {
    const { rows } = await client.query(
      `SELECT guess_date, won, guesses_taken
       FROM guesses
       WHERE user_id=$1 AND category=$2
         AND guess_date >= CURRENT_DATE - INTERVAL '30 days'
       ORDER BY guess_date DESC`,
      [req.user.id, category]
    );
    res.json(rows);
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------
// POST /api/game/unlimited/result   body: { category, won: bool }
// Records an unlimited-mode round result and updates the per-user,
// per-category unlimited streak. Wins increment current_streak and bump
// longest; losses reset current_streak to 0.
//
// Streaks are stored in the same `streaks` table under a synthetic category
// value of `unlimited_{category}` so they don't collide with the daily
// streak rows for the same category.
// ---------------------------------------------------------------
async function submitUnlimitedResult(req, res) {
  if (!req.user) return res.status(401).json({ error: 'Auth required' });
  const { category, won } = req.body;
  if (!VALID_CATEGORIES.includes(category)) {
    return res.status(400).json({ error: 'Invalid category' });
  }
  if (typeof won !== 'boolean') {
    return res.status(400).json({ error: 'won must be a boolean' });
  }

  const streakKey = `unlimited_${category}`;
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `SELECT current_streak, longest_streak FROM streaks
       WHERE user_id = $1 AND category = $2`,
      [req.user.id, streakKey]
    );
    const prev = rows[0];
    const prevLongest = prev?.longest_streak || 0;
    const current = won ? (prev?.current_streak || 0) + 1 : 0;
    const longest = Math.max(current, prevLongest);

    if (!prev) {
      await client.query(
        `INSERT INTO streaks (user_id, category, current_streak, longest_streak)
         VALUES ($1, $2, $3, $4)`,
        [req.user.id, streakKey, current, longest]
      );
    } else {
      await client.query(
        `UPDATE streaks SET current_streak = $1, longest_streak = $2
         WHERE user_id = $3 AND category = $4`,
        [current, longest, req.user.id, streakKey]
      );
    }
    res.json({ category, current_streak: current, longest_streak: longest });
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------
// GET /api/game/calendar-year?year=YYYY
// Returns every guess for the user across all daily categories for a given
// year, so the frontend can render a year-view calendar.
// ---------------------------------------------------------------
async function getYearCalendar(req, res) {
  if (!req.user) return res.status(401).json({ error: 'Auth required' });

  const year = parseInt(req.query.year, 10) || new Date().getFullYear();
  if (year < 2000 || year > 2100) {
    return res.status(400).json({ error: 'Invalid year' });
  }

  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `SELECT g.guess_date, g.category, g.won, g.guesses_taken,
              m.title AS movie_title, m.year AS movie_year
       FROM guesses g
       LEFT JOIN daily_picks dp
         ON dp.category = g.category AND dp.pick_date = g.guess_date
       LEFT JOIN movies m ON m.id = dp.movie_id
       WHERE g.user_id = $1
         AND g.category != 'unlimited'
         AND g.guess_date >= $2::date
         AND g.guess_date <  $3::date
       ORDER BY g.guess_date ASC`,
      [req.user.id, `${year}-01-01`, `${year + 1}-01-01`]
    );
    res.json(rows);
  } finally {
    client.release();
  }
}

// ── Production studio parent-company map (for yellow "same conglomerate" logic) ─
// Green = exact studio name match. Yellow = same parent company. Red = different.
const PRODUCTION_STUDIO_PARENT = {
  // Disney / Buena Vista
  'Walt Disney Pictures':     'Disney',
  'Pixar Animation Studios':  'Disney',
  'Marvel Studios':           'Disney',
  'Lucasfilm':                'Disney',
  '20th Century Studios':     'Disney',
  'Searchlight Pictures':     'Disney',
  'Touchstone Pictures':      'Disney',
  'Blue Sky Studios':         'Disney',
  // Universal / Comcast
  'Universal Pictures':       'Universal',
  'Amblin Entertainment':     'Universal',
  'DreamWorks':               'Universal',
  'Working Title Films':      'Universal',
  'Focus Features':           'Universal',
  'Blumhouse Productions':    'Universal',
  'Illumination':             'Universal',
  // Warner Bros. / Discovery
  'Warner Bros.':             'Warner Bros.',
  'New Line Cinema':          'Warner Bros.',
  'Castle Rock Entertainment':'Warner Bros.',
  'Village Roadshow':         'Warner Bros.',
  'Legendary Entertainment':  'Warner Bros.',
  // Sony
  'Columbia Pictures':        'Sony',
  'TriStar Pictures':         'Sony',
  // Paramount
  'Paramount Pictures':       'Paramount',
  // Lionsgate
  'Lionsgate':                'Lionsgate',
  // MGM / Amazon
  'MGM':                      'MGM',
  // Standalone / Indie
  'A24':                      'A24',
  'Miramax':                  'Miramax',
  'Netflix':                  'Netflix',
  'Amazon Studios':           'Amazon',
  'Apple Original Films':     'Apple',
  'StudioCanal':              'StudioCanal',
};

// ---------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------
function evaluateTiles(guessed, target, category) {
  if (category === 'animated')  return evaluateAnimatedTiles(guessed, target);
  if (category === 'superhero') return evaluateSuperheroTiles(guessed, target);
  if (category === 'indiancinema') return evaluateIndianCinemaTiles(guessed, target);

  // Default (top250 / "Most Popular") — Genre, Director, Lead Actor, Supporting Actor, Year, Studio
  const tCast = Array.isArray(target.cast_list) ? target.cast_list : [];

  const gLead = guessed.lead_actor;
  const tLead = target.lead_actor;
  let leadColor = 'red';
  if (gLead && tLead) {
    if (gLead === tLead) leadColor = 'green';
    else if (tCast.includes(gLead)) leadColor = 'yellow';
  }

  const gSupport = guessed.supporting_actor;
  const tSupport = target.supporting_actor;
  let supportColor = 'red';
  if (gSupport && tSupport) {
    if (gSupport === tSupport) supportColor = 'green';
    // Yellow: guessed supporting actor appears anywhere in target movie
    // (as lead, supporting, or anywhere in cast_list)
    else if (
      gSupport === target.lead_actor ||
      tCast.includes(gSupport)
    ) supportColor = 'yellow';
  }

  // Studio: green = same studio, yellow = same parent conglomerate, red = different
  const gStudio = guessed.production_studio;
  const tStudio = target.production_studio;
  let studioColor = 'red';
  if (gStudio && tStudio) {
    if (gStudio === tStudio) studioColor = 'green';
    else if (
      PRODUCTION_STUDIO_PARENT[gStudio] &&
      PRODUCTION_STUDIO_PARENT[gStudio] === PRODUCTION_STUDIO_PARENT[tStudio]
    ) studioColor = 'yellow';
  }

  return {
    genre:              compareGenres(guessed.genres, target.genres),
    director:           guessed.director === target.director ? 'green' : 'red',
    lead_actor:         leadColor,
    supporting_actor:   supportColor,
    year:               compareYear(guessed.year, target.year),
    production_studio:  studioColor,
    _targetYear:        target.year,
  };
}

// Indian Cinema-specific tile evaluation
// Tiles: Genre, Lead Actor, Supporting Actor, Director, Year, Language
function evaluateIndianCinemaTiles(guessed, target) {
  const tCast = Array.isArray(target.cast_list) ? target.cast_list : [];

  const gLead = guessed.lead_actor;
  const tLead = target.lead_actor;
  let leadColor = 'red';
  if (gLead && tLead) {
    if (gLead === tLead) leadColor = 'green';
    else if (tCast.includes(gLead)) leadColor = 'yellow';
  }

  const gSupport = guessed.supporting_actor;
  const tSupport = target.supporting_actor;
  let supportColor = 'red';
  if (gSupport && tSupport) {
    if (gSupport === tSupport) supportColor = 'green';
    else if (
      gSupport === target.lead_actor ||
      tCast.includes(gSupport)
    ) supportColor = 'yellow';
  }

  return {
    genre:            compareGenres(guessed.genres, target.genres),
    lead_actor:       leadColor,
    supporting_actor: supportColor,
    director:         guessed.director === target.director ? 'green' : 'red',
    year:             compareYear(guessed.year, target.year),
    language:         guessed.primary_language === target.primary_language ? 'green' : 'red',
    _targetYear:      target.year,
  };
}

// Superhero-specific tile evaluation
const SUPERPOWER_BROAD = {
  'Tech-based':      'Human-origin',
  'Human Enhanced':  'Human-origin',
  'Cosmic':          'Supernatural',
  'Magic':           'Supernatural',
  'Mutation':        'Biological',
  'Team/Mixed':      'Team/Mixed',
};

function evaluateSuperheroTiles(guessed, target) {
  // Universe — yellow if same publisher (Marvel / DC / Independent)
  const gUni = guessed.superhero_universe;
  const tUni = target.superhero_universe;
  const gPub = guessed.superhero_publisher;
  const tPub = target.superhero_publisher;
  let universeColor = 'red';
  if (gUni && tUni) {
    if (gUni === tUni) universeColor = 'green';
    else if (gPub && tPub && gPub === tPub) universeColor = 'yellow';
  }

  // Superpower type
  const gPow = guessed.superpower_type;
  const tPow = target.superpower_type;
  let powerColor = 'red';
  if (gPow && tPow) {
    if (gPow === tPow) powerColor = 'green';
    else if (SUPERPOWER_BROAD[gPow] && SUPERPOWER_BROAD[gPow] === SUPERPOWER_BROAD[tPow]) powerColor = 'yellow';
  }

  return {
    superhero_universe: universeColor,
    hero_villain_focus: guessed.hero_villain_focus === target.hero_villain_focus ? 'green' : 'red',
    solo_or_team:       guessed.solo_or_team === target.solo_or_team ? 'green' : 'red',
    year:               compareYear(guessed.year, target.year),
    superpower_type:    powerColor,
    _targetYear:        target.year,
  };
}

// Animated-specific tile evaluation
const STUDIO_PARENT = {
  'Pixar':         'Disney',
  'Disney':        'Disney',
  'DreamWorks':    'DreamWorks/Universal',
  'Illumination':  'Universal',
  'Studio Ghibli': 'Studio Ghibli',
  'Laika':         'Laika',
  'Sony Animation':'Sony',
  'Independent':   'Independent',
};

const STYLE_BROAD = {
  'Hand-drawn (2D)': '2D',
  'CGI/3D':          '3D',
  'Stop-motion':     'Stop-motion',
  'Claymation':      'Stop-motion',
  'Mixed':           'Mixed',
};

const PROTAGONIST_BROAD = {
  'Human':            'Organic',
  'Animal':           'Organic',
  'Fantasy Creature': 'Organic',
  'Robot/AI':         'Non-organic',
  'Object':           'Non-organic',
};

function evaluateAnimatedTiles(guessed, target) {
  // Animation style
  const gStyle = guessed.animation_style;
  const tStyle = target.animation_style;
  let styleColor = 'red';
  if (gStyle && tStyle) {
    if (gStyle === tStyle) styleColor = 'green';
    else if (STYLE_BROAD[gStyle] && STYLE_BROAD[gStyle] === STYLE_BROAD[tStyle]) styleColor = 'yellow';
  }

  // Studio
  const gStudio = guessed.animation_studio;
  const tStudio = target.animation_studio;
  let studioColor = 'red';
  if (gStudio && tStudio) {
    if (gStudio === tStudio) studioColor = 'green';
    else if (STUDIO_PARENT[gStudio] && STUDIO_PARENT[gStudio] === STUDIO_PARENT[tStudio]) studioColor = 'yellow';
  }

  // Protagonist type
  const gProto = guessed.protagonist_type;
  const tProto = target.protagonist_type;
  let protagonistColor = 'red';
  if (gProto && tProto) {
    if (gProto === tProto) protagonistColor = 'green';
    else if (PROTAGONIST_BROAD[gProto] && PROTAGONIST_BROAD[gProto] === PROTAGONIST_BROAD[tProto]) protagonistColor = 'yellow';
  }

  return {
    animation_style:   styleColor,
    animation_studio:  studioColor,
    has_sequel:        guessed.has_sequel === target.has_sequel ? 'green' : 'red',
    protagonist_type:  protagonistColor,
    is_musical:        guessed.is_musical === target.is_musical ? 'green' : 'red',
    year:              compareYear(guessed.year, target.year),
    _targetYear:       target.year,
  };
}

function compareGenres(gGenres, tGenres) {
  const g = (gGenres || []).slice(0, 2);
  const t = (tGenres || []).slice(0, 2);
  const matches = g.filter((genre) => t.includes(genre)).length;
  if (matches === 0) return 'red';
  // Green only when both movies have the exact same genre set (same length, every genre matches)
  if (g.length === t.length && matches === g.length) return 'green';
  return 'yellow';
}

function compareYear(gYear, tYear) {
  if (!gYear || !tYear) return 'red';
  const diff = Math.abs(gYear - tYear);
  if (diff === 0) return 'green';
  if (diff <= 2) return 'cyan';
  if (diff <= 5) return 'amber';
  return 'red';
}

function buildHint(target, { guessNumber, category } = {}) {
  // guessNumber = number of guesses already submitted (1-indexed).
  //
  // Most Popular (top250) — 7 guesses:
  //   after guess 4 → A Cast Member (with TMDb photo)
  //   after guess 5 → The Logline (Movie Explained Badly)
  //   after guess 6 → A Frame From The Movie
  //
  // Default (Superhero / Animated) — 7 guesses:
  //   after guess 5 → The Logline
  //   after guess 6 → A Frame From The Movie
  //
  // Indian Cinema — 8 guesses:
  //   after guess 4 → A Cast Member (with TMDb photo)
  //   after guess 5 → The Logline (Movie Explained Badly)
  //   after guess 6 → A Frame From The Movie
  //   after guess 7 → Musical Hint (iconic song + playback singers)
  const hint = {};

  // Helper: pick 3rd/4th-billed actor that isn't lead or supporting, + their profile path
  function pickActor() {
    const cast     = Array.isArray(target.cast_list)     ? target.cast_list     : [];
    const profiles = Array.isArray(target.cast_profiles) ? target.cast_profiles : [];
    const lead = (target.lead_actor       || '').trim().toLowerCase();
    const supp = (target.supporting_actor || '').trim().toLowerCase();
    for (let i = 2; i <= 3; i++) {
      const name = (cast[i] || '').trim();
      if (!name) continue;
      const n = name.toLowerCase();
      if (n === lead || n === supp) continue;
      hint.cast_actor         = name;
      hint.cast_actor_profile = profiles[i] || null;
      return;
    }
  }

  if (category === 'indiancinema') {
    // Cast member after guess 4 (swapped — actor before logline)
    if (guessNumber >= 4) pickActor();
    // Logline after guess 5
    if (guessNumber >= 5 && target.ai_hint_quote) {
      hint.ai_quote = target.ai_hint_quote;
    }
    // Frame after guess 6
    if (guessNumber >= 6 && Array.isArray(target.backdrop_paths) && target.backdrop_paths.length) {
      hint.backdrop_path = pickBackdropPath(target);
    }
    // Music hint after guess 7
    if (guessNumber >= 7 && target.music_hint_song) {
      hint.music_song    = target.music_hint_song;
      hint.music_singers = target.music_hint_singers || '';
    }
  } else if (category === 'top250') {
    // Cast member after guess 4 (swapped — actor before logline)
    if (guessNumber >= 4) pickActor();
    // Logline after guess 5
    if (guessNumber >= 5 && target.ai_hint_quote) {
      hint.ai_quote = target.ai_hint_quote;
    }
    // Frame after guess 6
    if (guessNumber >= 6 && Array.isArray(target.backdrop_paths) && target.backdrop_paths.length) {
      hint.backdrop_path = pickBackdropPath(target);
    }
  } else {
    // Default: Superhero / Animated
    if (guessNumber >= 5 && target.ai_hint_quote) {
      hint.ai_quote = target.ai_hint_quote;
    }
    if (guessNumber >= 6 && Array.isArray(target.backdrop_paths) && target.backdrop_paths.length) {
      hint.backdrop_path = pickBackdropPath(target);
    }
  }
  return hint;
}

function pickBackdropPath(target) {
  const paths = target.backdrop_paths;
  const seed  = Number(target.tmdb_id) || 0;
  // Tiny deterministic int hash — same target always yields same frame.
  let x = (seed | 0) ^ 0x9e3779b9;
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  x = x ^ (x >>> 16);
  return paths[Math.abs(x) % paths.length];
}

function buildLetterboxdUrl(title) {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, '-');
  return `https://letterboxd.com/film/${slug}/`;
}

// Streaks only reset on a WRONG answer — skipping a day has no penalty.
// didWin=true  → increment current_streak (no date check needed)
// didWin=false → reset current_streak to 0
async function updateStreak(client, userId, category, dateStr, didWin) {
  const { rows } = await client.query(
    `SELECT current_streak, longest_streak, last_win_date
     FROM streaks WHERE user_id=$1 AND category=$2`,
    [userId, category]
  );

  const prev    = rows[0];
  const current = didWin ? (prev?.current_streak || 0) + 1 : 0;
  const longest = Math.max(current, prev?.longest_streak || 0);
  // Only update last_win_date when actually winning; preserve it on losses
  const lastWinDate = didWin ? dateStr : (prev?.last_win_date ?? null);

  if (!prev) {
    await client.query(
      `INSERT INTO streaks (user_id, category, current_streak, longest_streak, last_win_date)
       VALUES ($1,$2,$3,$4,$5)`,
      [userId, category, current, longest, lastWinDate]
    );
  } else {
    await client.query(
      `UPDATE streaks SET current_streak=$1, longest_streak=$2, last_win_date=$3
       WHERE user_id=$4 AND category=$5`,
      [current, longest, lastWinDate, userId, category]
    );
  }
}

// ---------------------------------------------------------------
// GET /api/game/percentiles
// Returns a per-category percentile string for the authenticated user.
// ---------------------------------------------------------------
const STREAK_CATEGORIES = [
  'top250', 'superhero', 'animated', 'indiancinema',
  'unlimited_top250', 'unlimited_superhero', 'unlimited_animated', 'unlimited_indiancinema',
];

const DAILY_PERCENTILE_CATS = ['top250', 'superhero', 'animated', 'indiancinema'];

async function getPercentiles(req, res) {
  if (!req.user) return res.status(401).json({ error: 'Auth required' });

  const client = await pool.connect();
  try {
    // Fetch the latest pre-computed snapshot (built every 15 min by cron).
    // Fall back to empty object so the response shape is always stable.
    const { rows: snapRows } = await client.query(
      `SELECT data FROM percentile_snapshots ORDER BY computed_at DESC LIMIT 1`
    );
    const snapshot = snapRows[0]?.data || {};

    // Fetch the user's own streaks + avg_score + avg_guesses for all categories.
    const { rows: streakRows } = await client.query(
      `SELECT category, current_streak
       FROM streaks
       WHERE user_id = $1 AND category = ANY($2::text[])`,
      [req.user.id, STREAK_CATEGORIES]
    );
    const userStreaks = {};
    for (const r of streakRows) {
      userStreaks[r.category] = Number(r.current_streak) || 0;
    }

    // avg_score for Global Rating, avg_guesses for tiebreaking (daily categories only)
    const { rows: avgRows } = await client.query(
      `SELECT
         category,
         ROUND(COALESCE(AVG(score) FILTER (WHERE won = true AND score IS NOT NULL), 0)::numeric, 1) AS avg_score,
         ROUND(COALESCE(AVG(guesses_taken) FILTER (WHERE won = true), 0)::numeric, 2) AS avg_guesses
       FROM guesses
       WHERE user_id = $1 AND category = ANY($2::text[])
       GROUP BY category`,
      [req.user.id, DAILY_PERCENTILE_CATS]
    );
    const userAvgScore   = {};
    const userAvgGuesses = {};
    for (const r of avgRows) {
      userAvgScore[r.category]   = Number(r.avg_score);
      userAvgGuesses[r.category] = Number(r.avg_guesses);
    }

    // Compute percentile from snapshot distribution.
    // Daily ranking: Global Rating = (streak × 10) + avg_score.
    // Tiebreaker: lower avg_guesses (fewer attempts = better rank).
    // Unlimited ranking: still streak-only (snapshot stores [streak, null, cnt]).
    const result = {};
    for (const cat of STREAK_CATEGORIES) {
      const userStreak = userStreaks[cat] || 0;
      if (userStreak === 0) { result[cat] = null; continue; }
      const catSnap = snapshot[cat];
      if (!catSnap || catSnap.total === 0) { result[cat] = null; continue; }

      const isUnlimitedCat = cat.startsWith('unlimited_');
      let higher = 0;

      if (isUnlimitedCat) {
        // Streak-only comparison for unlimited categories
        for (const [s,, cnt] of catSnap.dist) {
          if (s > userStreak) higher += cnt;
        }
      } else {
        // Global Rating comparison for daily categories
        const userRating   = userStreak * 10 + (userAvgScore[cat] || 0);
        const userGuesses  = userAvgGuesses[cat] ?? Infinity;
        for (const [rating, distAvgGuesses, cnt] of catSnap.dist) {
          if (rating > userRating) {
            // Strictly higher rating
            higher += cnt;
          } else if (rating === userRating && distAvgGuesses !== null && distAvgGuesses < userGuesses) {
            // Same rating, fewer average attempts = better
            higher += cnt;
          }
        }
      }

      const pct = Math.max(1, Math.ceil((higher / catSnap.total) * 100));
      result[cat] = `Top ${pct}% Globally`;
    }

    res.json(result);
  } catch (err) {
    logger.error('getPercentiles failed', { stack: err.stack });
    res.status(500).json({ error: 'Could not load percentile data.' });
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------
// GET /api/game/ratings/:tmdb_id
// Proxies TMDB vote_average so the client never exposes the API key.
// Returns { imdb_rating: "8.4", letterboxd_rating: "4.2", vote_count: 12345 }
// ---------------------------------------------------------------
async function getRatings(req, res) {
  const { tmdb_id } = req.params;
  if (!tmdb_id || !/^\d+$/.test(tmdb_id)) {
    return res.status(400).json({ error: 'Invalid tmdb_id' });
  }

  try {
    const url =
      `https://api.themoviedb.org/3/movie/${tmdb_id}` +
      `?api_key=${process.env.TMDB_API_KEY}&language=en-US`;

    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`TMDB ${resp.status}`);

    const data = await resp.json();
    const avg  = data.vote_average ?? null;

    res.json({
      imdb_rating:       avg !== null ? avg.toFixed(1)           : null,
      letterboxd_rating: avg !== null ? (avg / 2).toFixed(1)     : null,
      vote_count:        data.vote_count ?? null,
    });
  } catch (err) {
    console.error('getRatings:', err.message);
    // Soft fail — client will render links without ratings
    res.json({ imdb_rating: null, letterboxd_rating: null, vote_count: null });
  }
}

// ---------------------------------------------------------------
// GET /api/game/leaderboard?category=X
// Returns top 10 users sorted by Global Rating.
// Global Rating = (current_streak × 10) + avg_score + (no_hint_in_streak × 5)
// Tiebreaker: lower avg_guesses wins (fewer attempts = better)
// ---------------------------------------------------------------
async function getLeaderboard(req, res) {
  const category = req.query.category;
  const client   = await pool.connect();

  try {
    let rows;
    if (category && VALID_UNLIMITED_CATEGORIES.includes(category)) {
      // Unlimited per-category leaderboard — streak only (no scoring in unlimited)
      const result = await client.query(`
        SELECT
          u.username,
          s.current_streak,
          s.longest_streak
        FROM users u
        JOIN streaks s ON s.user_id = u.id AND s.category = $1
        WHERE s.current_streak > 0
        ORDER BY s.current_streak DESC, s.longest_streak DESC
        LIMIT 10
      `, [category]);
      rows = result.rows;
    } else if (category && VALID_CATEGORIES.includes(category)) {
      // Per-category leaderboard
      const result = await client.query(`
        SELECT
          u.username,
          s.current_streak,
          s.longest_streak,
          ROUND(COALESCE(
            AVG(g.score) FILTER (WHERE g.won = true AND g.score IS NOT NULL),
            0
          )::numeric, 1) AS avg_score,
          (
            SELECT COUNT(*)::int FROM (
              SELECT g2.hints_count
              FROM guesses g2
              WHERE g2.user_id = u.id AND g2.category = $1
                AND g2.won = true AND g2.score IS NOT NULL
              ORDER BY g2.guess_date DESC
              LIMIT s.current_streak
            ) sub
            WHERE sub.hints_count = 0
          ) AS no_hint_in_streak,
          ROUND(COALESCE(AVG(g.guesses_taken) FILTER (WHERE g.won = true), 0)::numeric, 2) AS avg_guesses,
          ROUND((
            s.current_streak * 10
            + COALESCE(AVG(g.score) FILTER (WHERE g.won = true AND g.score IS NOT NULL), 0)
            + (
              SELECT COUNT(*) * 5 FROM (
                SELECT g2.hints_count
                FROM guesses g2
                WHERE g2.user_id = u.id AND g2.category = $1
                  AND g2.won = true AND g2.score IS NOT NULL
                ORDER BY g2.guess_date DESC
                LIMIT s.current_streak
              ) sub
              WHERE sub.hints_count = 0
            )
          )::numeric, 1) AS global_rating
        FROM users u
        JOIN streaks s ON s.user_id = u.id AND s.category = $1
        LEFT JOIN guesses g ON g.user_id = u.id AND g.category = $1
        WHERE s.current_streak > 0
        GROUP BY u.id, u.username, s.current_streak, s.longest_streak
        ORDER BY global_rating DESC, avg_guesses ASC
        LIMIT 10
      `, [category]);
      rows = result.rows;
    } else {
      // Global leaderboard: best streak across all 4 daily categories
      const result = await client.query(`
        SELECT
          u.username,
          MAX(s.current_streak) AS current_streak,
          ROUND(COALESCE(
            AVG(g.score) FILTER (WHERE g.won = true AND g.score IS NOT NULL),
            0
          )::numeric, 1) AS avg_score,
          ROUND(COALESCE(AVG(g.guesses_taken) FILTER (WHERE g.won = true), 0)::numeric, 2) AS avg_guesses,
          ROUND((
            MAX(s.current_streak) * 10
            + COALESCE(AVG(g.score) FILTER (WHERE g.won = true AND g.score IS NOT NULL), 0)
          )::numeric, 1) AS global_rating
        FROM users u
        JOIN streaks s ON s.user_id = u.id
          AND s.category = ANY(ARRAY['top250','superhero','animated','indiancinema'])
        LEFT JOIN guesses g ON g.user_id = u.id
          AND g.category = ANY(ARRAY['top250','superhero','animated','indiancinema'])
        WHERE s.current_streak > 0
        GROUP BY u.id, u.username
        ORDER BY global_rating DESC, avg_guesses ASC
        LIMIT 10
      `);
      rows = result.rows;
    }

    res.json(rows);
  } catch (err) {
    logger.error('getLeaderboard failed', { stack: err.stack });
    res.status(500).json({ error: 'Could not load leaderboard data.' });
  } finally {
    client.release();
  }
}

module.exports = {
  getDailyState,
  getMoviePool,
  submitGuess,
  checkGuess,
  getResult,
  getStreaks,
  getCalendar,
  getYearCalendar,
  submitUnlimitedResult,
  getRatings,
  getPercentiles,
  getLeaderboard,
};
