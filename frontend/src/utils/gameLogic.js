/**
 * Client-side game logic utilities.
 * Mirrors the server-side evaluation for unlimited mode (fully local).
 */

// The 4 game categories. Each can be played in either daily mode (one pick
// per day, server-scored) or unlimited mode (random target each round,
// client-scored). "Unlimited" is no longer a category — it's a mode.
export const CATEGORIES = [
  { id: 'top250',       urlSlug: 'mostpopular', label: 'Most Popular',  emoji: '🏆' },
  { id: 'superhero',    urlSlug: 'superhero',   label: 'Superhero',     emoji: '🦸' },
  { id: 'animated',     urlSlug: 'animated',    label: 'Animated',      emoji: '🎨' },
  { id: 'indiancinema', urlSlug: 'indiancinema',label: 'Indian Cinema', emoji: '🎬' },
];

// Map a URL slug (e.g. 'mostpopular') → internal category id (e.g. 'top250')
export function slugToCategory(slug) {
  return CATEGORIES.find((c) => c.urlSlug === slug || c.id === slug)?.id ?? slug;
}

// Map an internal category id → URL slug for navigation
export function categoryToSlug(id) {
  return CATEGORIES.find((c) => c.id === id)?.urlSlug ?? id;
}

export const MODES = [
  { id: 'daily',     label: 'Daily',     emoji: '📅', description: 'One movie a day across all 4 categories' },
  { id: 'unlimited', label: 'Unlimited', emoji: '∞',  description: 'Random target, play as many rounds as you want' },
];

export const MAX_GUESSES = 7; // default; Indian Cinema uses 8

/** Returns the max guesses allowed for a given category. */
export function getMaxGuesses(category) {
  return category === 'indiancinema' ? 8 : 7;
}

export const TILE_LABELS = {
  genre:              'Genre',
  director:           'Director',
  lead_actor:         'Lead Actor/Actress',
  supporting_actor:   'Supporting Actor/Actress',
  year:               'Year',
  production_studio:  'Studio',
};

export const ANIMATED_TILE_LABELS = {
  animation_style:  'Style',
  animation_studio: 'Studio',
  has_sequel:       'Franchise?',
  protagonist_type: 'Protagonist',
  is_musical:       'Musical?',
  year:             'Year',
};

export const ANIMATED_TILE_TOOLTIPS = {
  animation_style:  'Animation technique used (Hand-drawn, CGI, Stop-motion, etc.)',
  animation_studio: 'Studio that produced the film. Yellow = same parent company.',
  has_sequel:       'Is this film part of a series or franchise?',
  protagonist_type: 'Type of main character. Yellow = same broad group.',
  is_musical:       'Does the film have original songs as part of the story?',
  year:             'Green: exact year. Cyan: within 2 years. Amber: within 5 years. Red: 5+ years off. ↑ = answer is later, ↓ = earlier.',
};

export const SUPERHERO_TILE_LABELS = {
  superhero_universe: 'Universe',
  hero_villain_focus: 'Hero/Villain',
  solo_or_team:       'Solo/Team',
  year:               'Year',
  superpower_type:    'Power Type',
};

export const INDIAN_CINEMA_TILE_LABELS = {
  genre:            'Genre',
  lead_actor:       'Lead Actor/Actress',
  supporting_actor: 'Supporting Actor/Actress',
  director:         'Director',
  year:             'Year',
  language:         'Language',
};

export const INDIAN_CINEMA_TILE_TOOLTIPS = {
  genre:            'Top 2 genres match the target movie',
  lead_actor:       'Exact lead match = green. Yellow = your lead actor also appears in the target movie (but not the lead).',
  supporting_actor: 'Exact supporting match = green. Yellow = your pick appears in the target movie in any role. Red = no match.',
  director:         'Same director as the target movie',
  year:             'Green: exact year. Cyan: within 2 years. Amber: within 5 years. Red: 5+ years off. ↑ = answer is later, ↓ = earlier.',
  language:         'Original language of the film (Hindi, Tamil, Telugu, etc.)',
};

export const SUPERHERO_TILE_TOOLTIPS = {
  superhero_universe: 'Specific saga or cinematic universe (e.g. Infinity Saga, Nolanverse, DCEU). Yellow = same publisher (Marvel / DC / Independent).',
  hero_villain_focus: 'Is the main protagonist a Hero, Anti-hero, or Villain?',
  solo_or_team:       'Is this a solo character film or an ensemble/team film?',
  year:               'Green: exact year. Cyan: within 2 years. Amber: within 5 years. Red: 5+ years off. ↑ = answer is later, ↓ = earlier.',
  superpower_type:    'Power category: Tech-based, Cosmic, Mutation, Magic, Human Enhanced, or Team/Mixed. Yellow = same broad group.',
};

export const TILE_TOOLTIPS = {
  genre:              'Top 2 genres match the target movie',
  director:           'Same director as the target movie',
  lead_actor:         'Exact lead match = green. Yellow = your lead actor also appears in the target movie (but not the lead).',
  supporting_actor:   'Exact supporting match = green. Yellow = your pick appears in the target movie in any role. Red = no match.',
  year:               'Green: exact year. Cyan: within 2 years. Amber: within 5 years. Red: 5+ years off. ↑ = answer is later, ↓ = earlier.',
  production_studio:  'Green = same studio. Yellow = different studio but same parent company (e.g. Warner Bros. & New Line Cinema). Red = different.',
};

export const TILE_FIELDS             = ['genre', 'director', 'lead_actor', 'supporting_actor', 'year', 'production_studio'];
export const ANIMATED_FIELDS         = ['animation_style', 'animation_studio', 'has_sequel', 'protagonist_type', 'is_musical', 'year'];
export const SUPERHERO_FIELDS        = ['superhero_universe', 'hero_villain_focus', 'solo_or_team', 'year', 'superpower_type'];
export const INDIAN_CINEMA_FIELDS    = ['genre', 'lead_actor', 'supporting_actor', 'director', 'year', 'language'];

export function getTileFields(category) {
  if (category === 'animated')     return ANIMATED_FIELDS;
  if (category === 'superhero')    return SUPERHERO_FIELDS;
  if (category === 'indiancinema') return INDIAN_CINEMA_FIELDS;
  return TILE_FIELDS;
}

export function getTileLabels(category) {
  if (category === 'animated')     return ANIMATED_TILE_LABELS;
  if (category === 'superhero')    return SUPERHERO_TILE_LABELS;
  if (category === 'indiancinema') return INDIAN_CINEMA_TILE_LABELS;
  return TILE_LABELS;
}

export function getTileTooltips(category) {
  if (category === 'animated')     return ANIMATED_TILE_TOOLTIPS;
  if (category === 'superhero')    return SUPERHERO_TILE_TOOLTIPS;
  if (category === 'indiancinema') return INDIAN_CINEMA_TILE_TOOLTIPS;
  return TILE_TOOLTIPS;
}

export const TILE_COLORS = {
  green:  '#538d4e',
  amber:  '#FFBF00',
  cyan:   '#00E5FF',
  yellow: '#b59f3b',
  red:    '#c0392b',
};

export const TILE_TEXT = {
  green:  'Exact match',
  amber:  'Within 5 years',
  cyan:   'Within 2 years',
  yellow: 'Partial match',
  red:    'No match',
};

/**
 * Evaluate tiles for a guessed vs. target movie (client-side).
 * Used for unlimited mode where both movie objects are known locally.
 */
// Production studio parent map — mirrors backend PRODUCTION_STUDIO_PARENT.
// Used by evaluateTilesLocal for offline/guest tile evaluation.
const PRODUCTION_STUDIO_PARENT_FE = {
  'Walt Disney Pictures': 'Disney', 'Pixar Animation Studios': 'Disney',
  'Marvel Studios': 'Disney', 'Lucasfilm': 'Disney',
  '20th Century Studios': 'Disney', 'Searchlight Pictures': 'Disney',
  'Touchstone Pictures': 'Disney', 'Blue Sky Studios': 'Disney',
  'Universal Pictures': 'Universal', 'Amblin Entertainment': 'Universal',
  'DreamWorks': 'Universal', 'Working Title Films': 'Universal',
  'Focus Features': 'Universal', 'Blumhouse Productions': 'Universal',
  'Illumination': 'Universal',
  'Warner Bros.': 'Warner Bros.', 'New Line Cinema': 'Warner Bros.',
  'Castle Rock Entertainment': 'Warner Bros.', 'Village Roadshow': 'Warner Bros.',
  'Legendary Entertainment': 'Warner Bros.',
  'Columbia Pictures': 'Sony', 'TriStar Pictures': 'Sony',
  'Paramount Pictures': 'Paramount',
  'Lionsgate': 'Lionsgate',
  'MGM': 'MGM',
  'A24': 'A24', 'Miramax': 'Miramax',
  'Netflix': 'Netflix', 'Amazon Studios': 'Amazon', 'Apple Original Films': 'Apple',
  'StudioCanal': 'StudioCanal',
};

export function evaluateTilesLocal(guessed, target) {
  const eq = (a, b) => (a != null && b != null && a === b) ? 'green' : 'red';

  // Actor comparison helper
  const tCast = Array.isArray(target.cast_list) ? target.cast_list : [];

  function actorColor(guessedActor, targetActor) {
    if (!guessedActor || !targetActor) return 'red';
    if (guessedActor === targetActor) return 'green';
    if (tCast.includes(guessedActor)) return 'yellow';
    return 'red';
  }

  // Supporting actor: also yellow if guessed supporting actor is target's lead
  function supportActorColor(guessedActor, targetActor) {
    if (!guessedActor || !targetActor) return 'red';
    if (guessedActor === targetActor) return 'green';
    if (guessedActor === target.lead_actor || tCast.includes(guessedActor)) return 'yellow';
    return 'red';
  }

  const leadColor    = actorColor(guessed.lead_actor, target.lead_actor);
  const supportColor = supportActorColor(guessed.supporting_actor, target.supporting_actor);

  // Superhero universe: green = same; yellow = same publisher; red = different
  const universeColor = (() => {
    const gu = guessed.superhero_universe;
    const tu = target.superhero_universe;
    if (!gu || !tu) return 'red';
    if (gu === tu) return 'green';
    if (guessed.superhero_publisher && target.superhero_publisher &&
        guessed.superhero_publisher === target.superhero_publisher) return 'yellow';
    return 'red';
  })();

  // Production studio: green = exact match; yellow = same parent; red = different
  const studioColor = (() => {
    const gs = guessed.production_studio;
    const ts = target.production_studio;
    if (!gs || !ts) return 'red';
    if (gs === ts) return 'green';
    if (PRODUCTION_STUDIO_PARENT_FE[gs] && PRODUCTION_STUDIO_PARENT_FE[gs] === PRODUCTION_STUDIO_PARENT_FE[ts]) return 'yellow';
    return 'red';
  })();

  const tiles = {
    // ── Most Popular (top250) ─────────────────────────────────────
    genre:              compareGenres(guessed.genres, target.genres),
    director:           eq(guessed.director, target.director),
    lead_actor:         leadColor,
    supporting_actor:   supportColor,
    production_studio:  studioColor,
    // ── Indian Cinema ─────────────────────────────────────────────
    language:           eq(guessed.primary_language, target.primary_language),
    // ── Animated ─────────────────────────────────────────────────
    animation_style:    eq(guessed.animation_style,  target.animation_style),
    animation_studio:   eq(guessed.animation_studio, target.animation_studio),
    has_sequel:         eq(guessed.has_sequel,        target.has_sequel),
    protagonist_type:   eq(guessed.protagonist_type,  target.protagonist_type),
    is_musical:         eq(guessed.is_musical,        target.is_musical),
    // ── Superhero ────────────────────────────────────────────────
    superhero_universe: universeColor,
    hero_villain_focus: eq(guessed.hero_villain_focus, target.hero_villain_focus),
    solo_or_team:       eq(guessed.solo_or_team,       target.solo_or_team),
    superpower_type:    eq(guessed.superpower_type,    target.superpower_type),
    // ── Shared ───────────────────────────────────────────────────
    year:               compareYear(guessed.year, target.year),
    _targetYear:        target.year,
  };
  return tiles;
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

/**
 * Display value shown inside each tile.
 */
export function getTileDisplayValue(field, guessed) {
  switch (field) {
    // Standard fields
    case 'genre':             return (guessed.genres || []).slice(0, 2).join(' / ') || '?';
    case 'director':          return guessed.director || '?';
    case 'year':              return guessed.year ? String(guessed.year) : '?';
    case 'language': {
      const LANG_NAMES = {
        hi: 'Hindi', te: 'Telugu', ta: 'Tamil', ml: 'Malayalam',
        mr: 'Marathi', kn: 'Kannada', bn: 'Bengali', pa: 'Punjabi',
        en: 'English', ja: 'Japanese', ko: 'Korean', fr: 'French',
        es: 'Spanish', de: 'German', it: 'Italian', zh: 'Chinese',
      };
      return LANG_NAMES[guessed.primary_language] || guessed.primary_language?.toUpperCase() || '?';
    }
    // Actor fields
    case 'lead_actor':       return guessed.lead_actor       || '?';
    case 'supporting_actor': return guessed.supporting_actor || '?';
    // Animated fields
    case 'animation_style':  return guessed.animation_style || '?';
    case 'animation_studio': return guessed.animation_studio || '?';
    case 'has_sequel':       return guessed.has_sequel ? 'Yes' : 'No';
    case 'protagonist_type': return guessed.protagonist_type || '?';
    case 'is_musical':       return guessed.is_musical ? 'Yes' : 'No';
    // Superhero fields
    case 'superhero_universe':  return guessed.superhero_universe || '?';
    case 'superhero_publisher': return guessed.superhero_publisher || '?';
    case 'hero_villain_focus':  return guessed.hero_villain_focus || '?';
    case 'solo_or_team':        return guessed.solo_or_team || '?';
    case 'superpower_type':     return guessed.superpower_type || '?';
    default:                   return '?';
  }
}

/**
 * Determine which hints should be visible based on guess count (1-indexed = number of guesses submitted).
 *
 * Most Popular (top250) — 7 guesses:
 *   after guess 4 → A Cast Member (3rd/4th billed, with TMDb photo)
 *   after guess 5 → The Logline (Movie Explained Badly)
 *   after guess 6 → A Frame From The Movie
 *
 * Default (Superhero / Animated) — 7 guesses:
 *   after guess 5 → The Logline
 *   after guess 6 → A Frame From The Movie
 *
 * Indian Cinema — 8 guesses:
 *   after guess 4 → A Cast Member (3rd/4th billed, with TMDb photo)
 *   after guess 5 → The Logline (Movie Explained Badly)
 *   after guess 6 → A Frame From The Movie
 *   after guess 7 → Musical Hint (iconic song + playback singers)
 */
/**
 * Pick the actor candidate from cast_list (3rd/4th billed, excluding lead/supp)
 * and return { name, profile } — profile is the TMDb profile_path or null.
 */
function pickActorHint(target) {
  if (!Array.isArray(target.cast_list)) return null;
  const lead = (target.lead_actor       || '').trim().toLowerCase();
  const supp = (target.supporting_actor || '').trim().toLowerCase();
  const profiles = Array.isArray(target.cast_profiles) ? target.cast_profiles : [];
  for (let i = 2; i <= 3; i++) {
    const name = (target.cast_list[i] || '').trim();
    if (!name) continue;
    const n = name.toLowerCase();
    if (n === lead || n === supp) continue;
    return { name, profile: profiles[i] || null };
  }
  return null;
}

export function getHints(guessCount, target, category) {
  const hints = [];
  if (!target) return hints;

  if (category === 'indiancinema') {
    // ── Indian Cinema (8 guesses) ─────────────────────────────────────────
    // after guess 4 → A Cast Member (with photo)
    // after guess 5 → The Logline
    // after guess 6 → A Frame From The Movie
    // after guess 7 → Musical Hint
    if (guessCount >= 4) {
      const actor = pickActorHint(target);
      if (actor) hints.push({ type: 'actor', label: 'A Cast Member', value: actor.name, profile: actor.profile });
    }
    if (guessCount >= 5 && target.ai_hint_quote) {
      hints.push({ type: 'clue', label: 'The Logline', value: target.ai_hint_quote });
    }
    if (guessCount >= 6 && Array.isArray(target.backdrop_paths) && target.backdrop_paths.length) {
      const idx = Math.abs(hashInt(target.tmdb_id || 0)) % target.backdrop_paths.length;
      hints.push({ type: 'image', label: 'A Frame From The Movie', value: target.backdrop_paths[idx] });
    }
    if (guessCount >= 7 && target.music_hint_song) {
      hints.push({
        type:    'music',
        label:   'Musical Hint',
        value:   target.music_hint_song,
        singers: target.music_hint_singers || '',
      });
    }
  } else if (category === 'top250') {
    // ── Most Popular (7 guesses) ─────────────────────────────────────────
    // after guess 4 → A Cast Member (with photo)
    // after guess 5 → The Logline
    // after guess 6 → A Frame From The Movie
    if (guessCount >= 4) {
      const actor = pickActorHint(target);
      if (actor) hints.push({ type: 'actor', label: 'A Cast Member', value: actor.name, profile: actor.profile });
    }
    if (guessCount >= 5 && target.ai_hint_quote) {
      hints.push({ type: 'clue', label: 'The Logline', value: target.ai_hint_quote });
    }
    if (guessCount >= 6 && Array.isArray(target.backdrop_paths) && target.backdrop_paths.length) {
      const idx = Math.abs(hashInt(target.tmdb_id || 0)) % target.backdrop_paths.length;
      hints.push({ type: 'image', label: 'A Frame From The Movie', value: target.backdrop_paths[idx] });
    }
  } else {
    // ── Default: Superhero / Animated (7 guesses) ─────────────────────────
    if (guessCount >= 5 && target.ai_hint_quote) {
      hints.push({ type: 'clue', label: 'The Logline', value: target.ai_hint_quote });
    }
    if (guessCount >= 6 && Array.isArray(target.backdrop_paths) && target.backdrop_paths.length) {
      const idx = Math.abs(hashInt(target.tmdb_id || 0)) % target.backdrop_paths.length;
      hints.push({ type: 'image', label: 'A Frame From The Movie', value: target.backdrop_paths[idx] });
    }
  }
  return hints;
}

// Tiny deterministic int hash so the same target always yields the same backdrop.
function hashInt(n) {
  let x = (n | 0) ^ 0x9e3779b9;
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  return x ^ (x >>> 16);
}

/**
 * Build the emoji share string (like Wordle).
 */
// Hint costs (mirrors backend + ResultModal)
const SHARE_HINT_COSTS = {
  top250:       [1, 3, 4],
  superhero:    [3, 4],
  animated:     [3, 4],
  indiancinema: [1, 2, 3, 4],
};

// Accept a pre-computed finalScore so share text always matches ResultModal display
export function buildShareString(category, guessResults, won, username, hintsRevealedCount = 0, finalScore = null) {
  const catLabel  = CATEGORIES.find((c) => c.id === category)?.label || category;
  const maxG      = getMaxGuesses(category);
  const score     = won ? `${guessResults.length}/${maxG}` : `X/${maxG}`;
  const today     = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  // Use pre-computed score if provided; otherwise fall back to sequential estimate
  let pts;
  if (finalScore != null) {
    pts = won ? finalScore : 0;
  } else {
    const costs    = SHARE_HINT_COSTS[category] || [1, 3, 4];
    const hintCost = costs.slice(0, hintsRevealedCount).reduce((s, c) => s + c, 0);
    const misses   = won ? Math.max(0, guessResults.length - 1) : guessResults.length;
    const bonus    = hintsRevealedCount === 0 && won ? 3 : 0;
    pts            = won ? Math.max(0, 20 - hintCost - misses + bonus) : 0;
  }

  const emojiMap = {
    green:  '🟩',
    cyan:   '🟦',
    amber:  '🟧',
    yellow: '🟨',
    // legacy keys from old server responses
    'orange-yellow': '🟧',
    'light-yellow':  '🟧',
    red:   '🟥',
    empty: '⬛',
  };

  const fields = getTileFields(category);
  const rows = (guessResults || []).map((tiles) => {
    if (!tiles) return fields.map(() => '⬛').join('');
    return fields.map((f) => emojiMap[tiles[f]] || '⬛').join('');
  });

  const scoreLine = username ? `@${username} · ${score}` : score;
  return [
    `🎬 CineGuess — ${catLabel} (${today})`,
    scoreLine,
    '',
    ...rows,
    '',
    won ? `⭐ ${pts}pts earned` : `💀 0pts`,
    '',
    'cineguessit.com',
  ].join('\n');
}

// ---------------------------------------------------------------
// LocalStorage helpers for guest state
// ---------------------------------------------------------------
const LS_PREFIX = 'cineguess_';

export function saveGuestState(category, state) {
  const today = new Date().toISOString().split('T')[0];
  const key = `${LS_PREFIX}${category}_${today}`;
  localStorage.setItem(key, JSON.stringify(state));
}

export function loadGuestState(category) {
  const today = new Date().toISOString().split('T')[0];
  const key = `${LS_PREFIX}${category}_${today}`;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveGuestStreak(category, streak) {
  localStorage.setItem(`${LS_PREFIX}streak_${category}`, JSON.stringify(streak));
}

// ---------------------------------------------------------------
// Daily-mode localStorage persistence (also reused for unlimited snapshot)
// Keyed by `${LS_PREFIX}daily_${mode}_${category}_${YYYY-MM-DD}`. The date
// suffix means yesterday's entries are auto-invalid (wrong key) and swept
// by clearStaleDailyStates() on app load.
// ---------------------------------------------------------------
function todayKey() {
  // Use Eastern time to match the backend daily-pick schedule.
  // UTC would cause a ~4–5 hour window after 8 PM ET where the UTC date
  // has already rolled over but the backend is still on the previous day,
  // causing late-night players to have their game saved under tomorrow's key.
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}

export function saveDailyState(key, state) {
  const today = todayKey();
  try {
    localStorage.setItem(`${LS_PREFIX}daily_${key}_${today}`, JSON.stringify(state));
  } catch {}
}

export function loadDailyState(key) {
  const today = todayKey();
  try {
    const raw = localStorage.getItem(`${LS_PREFIX}daily_${key}_${today}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Remove any `cineguess_` entries whose key ends in a YYYY-MM-DD that is not
 * today. Called once when the app boots so Daily storage stays tidy as the
 * date rolls over.
 */
export function clearStaleDailyStates() {
  const today = todayKey();
  try {
    const toRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith(LS_PREFIX)) continue;
      const m = k.match(/_(\d{4}-\d{2}-\d{2})$/);
      if (m && m[1] !== today) toRemove.push(k);
    }
    toRemove.forEach((k) => localStorage.removeItem(k));
  } catch {}
}

export function loadGuestStreak(category) {
  try {
    const raw = localStorage.getItem(`${LS_PREFIX}streak_${category}`);
    return raw ? JSON.parse(raw) : { current: 0, longest: 0 };
  } catch {
    return { current: 0, longest: 0 };
  }
}

// ---------------------------------------------------------------
// Unlimited-mode persistent state — permanent key (no date suffix)
// so the completed round survives page refreshes and re-entries
// until the user explicitly starts a new round.
// ---------------------------------------------------------------
const UNLIMITED_PREFIX = 'cineguess_unlimited_';

export function saveUnlimitedState(category, state) {
  try {
    localStorage.setItem(`${UNLIMITED_PREFIX}${category}`, JSON.stringify(state));
  } catch {}
}

export function loadUnlimitedState(category) {
  try {
    const raw = localStorage.getItem(`${UNLIMITED_PREFIX}${category}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearUnlimitedState(category) {
  try {
    localStorage.removeItem(`${UNLIMITED_PREFIX}${category}`);
  } catch {}
}
