import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import {
  getMoviePool, getDailyState, submitGuess, checkGuess, getResult,
  submitUnlimitedResult, getStreaks, tmdbImage, getUnlimitedSession, saveUnlimitedSession,
} from '../utils/api';
import {
  CATEGORIES, MAX_GUESSES, getMaxGuesses, evaluateTilesLocal, getHints,
  saveGuestState, loadGuestState, saveGuestStreak, loadGuestStreak,
  saveDailyState, loadDailyState, clearStaleDailyStates,
  saveUnlimitedState, loadUnlimitedState, clearUnlimitedState,
  slugToCategory,
} from '../utils/gameLogic';
import MovieSearch from '../components/MovieSearch';
import GameBoard from '../components/GameBoard';
import HintModal from '../components/HintModal';
import ResultModal from '../components/ResultModal';
import RulesModal from '../components/RulesModal';
import StarterInfoPanel from '../components/StarterInfoPanel';

const VALID_IDS   = new Set([
  ...CATEGORIES.map((c) => c.id),
  ...CATEGORIES.map((c) => c.urlSlug),
]);
const VALID_MODES = new Set(['daily', 'unlimited']);

export default function GamePage() {
  const { mode, category: rawCategory } = useParams();
  // Resolve URL slug → internal category id (e.g. 'mostpopular' → 'top250')
  const category = slugToCategory(rawCategory);
  const navigate = useNavigate();
  const { session } = useAuth();
  const { colorblind } = useSettings();

  useEffect(() => {
    if (!VALID_MODES.has(mode) || !VALID_IDS.has(rawCategory)) {
      navigate('/', { replace: true });
    }
  }, [mode, rawCategory, navigate]);


  const isUnlimited = mode === 'unlimited';
  const catMeta     = CATEGORIES.find((c) => c.id === category);
  const guestKey    = `${mode}_${category}`;
  const streakKey   = `${mode}_${category}`;

  // ── Type-specific hint costs (mirrors backend HINT_TYPE_COSTS) ──
  // actor = cast member, clue = logline, image = frame, music = song
  const HINT_TYPE_COSTS_FE = {
    top250:       { actor: 1, clue: 3, image: 4 },
    superhero:    { clue: 3, image: 4 },
    animated:     { clue: 3, image: 4 },
    indiancinema: { actor: 1, clue: 2, image: 3, music: 4 },
  };

  // ── State ──────────────────────────────────────────────────────
  const [movies, setMovies]               = useState([]);
  const [targetMovie, setTargetMovie]     = useState(null);
  // Starter info (top250 only) — Oscar nominations + franchise, shown before hints unlock
  const [starterInfo, setStarterInfo]     = useState(null);
  const [showStarterModal, setShowStarterModal] = useState(false);
  const [dailyDate, setDailyDate]         = useState(null); // Eastern date from server ("2026-04-29")
  const [guessResults, setGuessResults]   = useState([]);
  const [guessedIds, setGuessedIds]       = useState([]);
  const [gameOver, setGameOver]           = useState(false);
  const [won, setWon]                     = useState(null);
  const [result, setResult]               = useState(null);
  // hintsUnlocked: hints available to reveal (unlocked by guess threshold, not yet revealed)
  const [hintsUnlocked, setHintsUnlocked] = useState([]);
  // hintsRevealed: hints the user has actively clicked to reveal
  const [hintsRevealed, setHintsRevealed] = useState([]);
  const [hintsRevealedCount, setHintsRevealedCount] = useState(0);
  const [potentialScore, setPotentialScore] = useState(20);
  const [showHintModal, setShowHintModal] = useState(false);
  const [latestHintType, setLatestHintType] = useState(null);
  const [newHintAvailable, setNewHintAvailable] = useState(false);
  // Snapshot of hints the user manually revealed BEFORE the post-game auto-reveal.
  // Used for scoring so post-game hints never inflate the deduction.
  const [gameOverHintsRevealed, setGameOverHintsRevealed] = useState([]);
  const [showModal, setShowModal]         = useState(false);
  const [showRules, setShowRules]         = useState(false);
  const [loading, setLoading]             = useState(true);
  const [submitting, setSubmitting]       = useState(false);
  const [error, setError]                 = useState(null);
  const [latestIndex, setLatestIndex]     = useState(-1);
  const [unlimitedStreak, setUnlimitedStreak] = useState({ current: 0, best: 0 });
  // Daily streak — lifted here so handleGuess can update it immediately on win.
  const [dailyStreak, setDailyStreak] = useState({ current: 0, best: 0 });

  // ── Eastern date for new-day detection (tab kept open overnight) ──────────
  // When the date changes, we include it in combinedKey so the init effect
  // re-runs and loads the fresh daily pick even without a page refresh.
  const [currentDate, setCurrentDate] = useState(() =>
    new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
  );
  // Auto-retry counter for backend cold-starts (Railway free tier).
  // Each increment triggers a fresh init attempt without resetting other state.
  const [reloadTrigger, setReloadTrigger] = useState(0);
  const retryCountRef = useRef(0); // how many auto-retries have fired this session

  const boardRef       = useRef(null);
  // Tracks which mode+category+user combo has already been fully initialised.
  // Prevents re-init (and board-wipe) when React re-runs the effect due to
  // session token refreshes, StrictMode double-mount, or tab visibility changes.
  const hydratedKeyRef = useRef(null);

  // ── Load daily streak on mount / category change ───────────────
  useEffect(() => {
    if (isUnlimited || !session) return;
    getStreaks(category)
      .then((s) => setDailyStreak({ current: s.current_streak ?? 0, best: s.longest_streak ?? 0 }))
      .catch(() => {});
  }, [isUnlimited, category, session]);

  // ── Recalculate potentialScore whenever guesses or revealed hints change ──
  // Uses type-specific costs so cast member is always 1pt, logline 3pt, etc.
  // The no-hint bonus (+3) is NOT shown during play — it only applies on a win
  // and would cause the counter to go UP after wrong guesses, which is confusing.
  useEffect(() => {
    if (gameOver) return;
    const typeCosts = HINT_TYPE_COSTS_FE[category] || {};
    const hintCost  = hintsRevealed.reduce((sum, h) => sum + (typeCosts[h.type] || 0), 0);
    const misses    = guessResults.length;
    setPotentialScore(Math.max(0, 20 - hintCost - misses));
  }, [guessResults.length, hintsRevealed, category, gameOver]);

  // ── Load / refresh unlimited streak display ────────────────────
  const refreshStreak = useCallback(() => {
    if (!isUnlimited) return;
    if (session) {
      getStreaks(`unlimited_${category}`)
        .then((s) => setUnlimitedStreak({ current: s.current_streak ?? 0, best: s.longest_streak ?? 0 }))
        .catch(() => {});
    } else {
      const s = loadGuestStreak(streakKey);
      setUnlimitedStreak({ current: s.current ?? 0, best: s.longest ?? 0 });
    }
  }, [isUnlimited, session, category, streakKey]);

  // Fetch streak whenever category/mode/session changes
  useEffect(() => { refreshStreak(); }, [refreshStreak]);

  // ── Load movie pool + initial state ────────────────────────────
  useEffect(() => {
    // Build a stable key for this init pass. If the user re-enters the same
    // mode/category combo (e.g. tab regained focus, session refreshed), skip
    // the wipe-and-reload so the board isn't nuked.
    const userKey    = session?.user?.id || 'guest';
    const combinedKey = `${mode}_${category}_${userKey}_${currentDate}_${reloadTrigger}`;
    if (hydratedKeyRef.current === combinedKey) return;
    hydratedKeyRef.current = combinedKey;

    // One-time sweep of yesterday's (or older) Daily storage keys.
    clearStaleDailyStates();

    // ── Always reset per-round transient state when switching categories ──────
    // This must happen BEFORE local hydration so the previous category's hints,
    // result, and game-over flags never bleed into the next one.
    setHintsUnlocked([]);
    setHintsRevealed([]);
    setHintsRevealedCount(0);
    setGameOverHintsRevealed([]);
    setPotentialScore(20);
    setShowHintModal(false);
    setLatestHintType(null);
    setNewHintAvailable(false);
    setShowModal(false);
    setError(null);
    setLatestIndex(-1);
    setTargetMovie(null);
    setStarterInfo(null);
    setShowStarterModal(false);

    // Phase 1 — SYNCHRONOUS hydrate from localStorage so the board is visible
    // on first paint, even before the movie pool / server state resolves.
    let hadLocalHydration = false;
    if (!isUnlimited) {
      const saved = loadDailyState(guestKey);
      if (saved?.rows?.length) {
        setGuessResults(saved.rows);
        setGuessedIds(saved.rows.map((r) => r.movie.tmdb_id));
        if (saved.gameOver) {
          setGameOver(true);
          setWon(saved.won);
          if (saved.result) setResult(saved.result);
          else setResult(null);
          // Restore hints immediately so the button appears before the server round-trip.
          if (saved.hints?.length) mergeHints(saved.hints, true);
          // Restore hint count and potential score
          const savedHintCount = saved.hintsRevealedCount || 0;
          setHintsRevealedCount(savedHintCount);
        } else {
          setGameOver(false);
          setWon(null);
          setResult(null);
          // Restore hint count for in-progress game
          const savedHintCount = saved.hintsRevealedCount || 0;
          if (savedHintCount > 0) {
            setHintsRevealedCount(savedHintCount);
          }
        }
        hadLocalHydration = true;
      }
    }

    if (!hadLocalHydration) {
      setLoading(true);
      setGuessResults([]);
      setGuessedIds([]);
      setGameOver(false);
      setWon(null);
      setResult(null);
    } else {
      setLoading(false); // show hydrated board immediately
    }

    async function init() {
      try {
        const pool = await getMoviePool(category);
        setMovies(pool);

        if (isUnlimited) {
          let target;

          if (session) {
            // Authenticated: server is source of truth for cross-device sync.
            try {
              const serverSession = await getUnlimitedSession(category);
              if (serverSession && serverSession.target_tmdb_id) {
                target = pool.find((m) => m.tmdb_id === serverSession.target_tmdb_id);
                if (target) {
                  const adapted = {
                    targetId:             serverSession.target_tmdb_id,
                    guesses:              Array.isArray(serverSession.guesses) ? serverSession.guesses : [],
                    gameOver:             serverSession.game_over,
                    won:                  serverSession.won,
                    hintsRevealedCount:   serverSession.hints_revealed_count,
                    gameOverHintsRevealed: Array.isArray(serverSession.hints_revealed) ? serverSession.hints_revealed : [],
                  };
                  // Sync back to localStorage so offline fallback stays current
                  saveUnlimitedState(category, adapted);
                  setTargetMovie(target);
                  await restoreGuestSession(adapted, pool);
                }
              }
            } catch {
              // Server unreachable — fall through to localStorage below
            }
          }

          if (!target) {
            // Guest or server had no session: fall back to localStorage
            const saved = loadUnlimitedState(category);
            if (saved && saved.targetId) {
              target = pool.find((m) => m.tmdb_id === saved.targetId);
              setTargetMovie(target || null);
              await restoreGuestSession(saved, pool);
            } else {
              target = pool[Math.floor(Math.random() * pool.length)];
              setTargetMovie(target);
              const freshState = { targetId: target.tmdb_id, guesses: [], gameOver: false, won: null, hintsRevealedCount: 0, gameOverHintsRevealed: [] };
              saveUnlimitedState(category, freshState);
              if (session) {
                saveUnlimitedSession(category, {
                  target_tmdb_id: target.tmdb_id, guesses: [], game_over: false,
                  won: null, hints_revealed: [], hints_revealed_count: 0,
                }).catch(() => {});
              }
            }
          }

          if (category === 'top250' && target) {
            setStarterInfo({
              oscar_wins:                  target.oscar_wins,
              oscar_nomination_categories: target.oscar_nomination_categories,
              oscar_win_categories:        target.oscar_win_categories,
              franchise_name:              target.franchise_name,
            });
          }
          setLoading(false);
          return;
        }

        // Daily: reconcile with server (source of truth) but don't wipe the
        // already-hydrated board. Server state is used to fill in anything
        // local didn't have (e.g. first visit on a new device).
        const state = await getDailyState(category);
        if (state.date) setDailyDate(state.date);

        // Set starter info for top250 daily — always available from round start
        if (category === 'top250' && state.movie) {
          setStarterInfo({
            oscar_wins:                  state.movie.oscar_wins,
            oscar_nomination_categories: state.movie.oscar_nomination_categories,
            oscar_win_categories:        state.movie.oscar_win_categories,
            franchise_name:              state.movie.franchise_name,
          });
        }

        // ── Stale-state detection ─────────────────────────────────────────────
        // Two cases that make local state invalid:
        //
        // 1. DATE MISMATCH — server says today is a different Eastern date than
        //    what's stored locally.  This catches late-night UTC-rollover cases
        //    where todayKey() previously used UTC and saved the game under
        //    tomorrow's date, making it appear as "today's" game the next day.
        //
        // 2. PICK CHANGE — authenticated game-over: the server's tmdb_id differs
        //    from the locally-recorded winning movie (daily pick was re-run).
        if (hadLocalHydration) {
          const lsSaved = loadDailyState(guestKey);
          const dateMismatch = state.date && lsSaved?.date && lsSaved.date !== state.date;
          const winningRow   = lsSaved?.rows?.find((r) => r.correct);
          const pickChanged  = state.movie?.tmdb_id && winningRow &&
                               winningRow.movie.tmdb_id !== state.movie.tmdb_id;

          if (dateMismatch || pickChanged) {
            saveDailyState(guestKey, { rows: [], gameOver: false, won: null, result: null, hints: [], date: state.date });
            setGuessResults([]);
            setGuessedIds([]);
            setGameOver(false);
            setWon(null);
            setResult(null);
            setHintsUnlocked([]);
            setHintsRevealed([]);
            setHintsRevealedCount(0);
            setPotentialScore(20);
            hydratedKeyRef.current = null;
            return;
          }
        }

        if (state.guesses?.length) {
          const restored = await restoreServerGuesses(state.guesses, pool, state.won);
          setGuessResults(restored);
          setGuessedIds(state.guesses.map((g) => g.tmdb_id));
          let finalResult = null;
          if (state.won !== null) {
            setGameOver(true);
            setWon(state.won);
            try {
              finalResult = await getResult(category);
              setResult(finalResult);
              // Unlock all post-game hints on restore (silent — no ping)
              if (finalResult?.hint && Object.keys(finalResult.hint).length > 0) {
                mergeHints(hintsFromServer(finalResult.hint), true);
              }
            } catch {}
          }
          // Mirror the authoritative server state back to localStorage
          // (also persists hints so future refreshes don't need a server call).
          const hintSnapshot = finalResult?.hint && Object.keys(finalResult.hint).length > 0
            ? hintsFromServer(finalResult.hint)
            : [];
          saveDailyState(guestKey, {
            rows:               restored,
            gameOver:           state.won !== null,
            won:                state.won,
            result:             finalResult,
            hints:              hintSnapshot,
            hintsRevealedCount: 0, // server restoration can't know how many hints were revealed
            date:               state.date,
          });
        }

        // Guaranteed fallback: if localStorage says the game is over but hints
        // weren't saved (game played before this fix, or getDailyState returned
        // empty guesses), restore them now.
        // IMPORTANT: for WON games we build hints locally from the winning movie
        // stored in localStorage — never call getResult(), which returns the
        // *current* daily pick and would show the wrong movie's hints if the
        // pick was changed after the user finished.
        const lsSaved = loadDailyState(guestKey);
        if (lsSaved?.gameOver && !lsSaved?.hints?.length) {
          // Always use getResult so we get the full server-side hint data
          // (backdrop_paths, ai_hint_quote) — winningRow.movie from localStorage
          // doesn't carry those fields since they aren't in the guess response.
          try {
            const rev = await getResult(category);
            if (rev) {
              setResult(rev);
              const restoredHints = rev.hint && Object.keys(rev.hint).length > 0
                ? hintsFromServer(rev.hint)
                : [];
              if (restoredHints.length) mergeHints(restoredHints, true);
              saveDailyState(guestKey, { ...lsSaved, hints: restoredHints, result: rev });
            }
          } catch {}
        }
      } catch (err) {
        if (err?.response?.status === 404) {
          setError('No daily movie selected yet. Run the daily pick script to seed today\'s game.');
        } else {
          console.error(err);
          // If we have a hydrated board from localStorage, keep playing offline
          // without surfacing a scary error.
          if (!hadLocalHydration) {
            const MAX_AUTO_RETRIES = 2;
            if (retryCountRef.current < MAX_AUTO_RETRIES) {
              retryCountRef.current++;
              setError(`Connecting to server… (attempt ${retryCountRef.current + 1}/${MAX_AUTO_RETRIES + 1})`);
              // Schedule a retry — incrementing reloadTrigger changes combinedKey
              // so the guard lets the init run again.
              setTimeout(() => setReloadTrigger((n) => n + 1), 5000);
            } else {
              // All retries exhausted — show actionable error.
              retryCountRef.current = 0;
              setError('Could not reach the server. Check your connection and try again.');
            }
          }
        }
      } finally {
        setLoading(false);
      }
    }

    init();
  }, [mode, category, session, currentDate, reloadTrigger]);

  // ── Visibility change: detect new-day when tab regains focus ──────────────
  // If the user leaves the tab open overnight, the init effect won't re-run
  // (mode/category/session are unchanged). On visibility gain we check whether
  // the Eastern date has rolled over. When it has, updating currentDate changes
  // combinedKey → the guard passes → init re-runs → fresh daily pick loads.
  useEffect(() => {
    function onVisibility() {
      if (document.visibilityState !== 'visible') return;
      const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
      setCurrentDate((prev) => {
        if (prev === today) return prev; // no change — React bails out, no re-render
        // Date rolled over: reset retry counter so new-day errors retry cleanly.
        retryCountRef.current = 0;
        return today;
      });
    }
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  async function restoreServerGuesses(guesses, pool, wonStatus) {
    const rows = [];
    for (const g of guesses) {
      const id = g.tmdb_id;
      const movie = pool.find((m) => m.tmdb_id === id);
      if (!movie) continue;
      rows.push({ movie, tiles: g.tiles || null, correct: !!wonStatus && id === guesses[guesses.length - 1].tmdb_id });
    }
    return rows;
  }

  function startUnlimitedRound() {
    if (!movies.length) return;
    const target = movies[Math.floor(Math.random() * movies.length)];
    setTargetMovie(target);
    setGuessResults([]);
    setGuessedIds([]);
    setGameOver(false);
    setWon(null);
    setResult(null);
    setHintsUnlocked([]);
    setHintsRevealed([]);
    setHintsRevealedCount(0);
    setGameOverHintsRevealed([]);
    setPotentialScore(20);
    setShowHintModal(false);
    setLatestHintType(null);
    setNewHintAvailable(false);
    setShowModal(false);
    setError(null);
    setLatestIndex(-1);
    setShowStarterModal(false);
    if (category === 'top250') {
      setStarterInfo({
        oscar_wins:           target.oscar_wins,
        oscar_nomination_categories: target.oscar_nomination_categories,
        franchise_name:              target.franchise_name,
      });
    }
    saveUnlimitedState(category, { targetId: target.tmdb_id, guesses: [], gameOver: false, won: null, hintsRevealedCount: 0, gameOverHintsRevealed: [] });
    // Sync new round to server so other devices pick up the same movie.
    if (session) {
      saveUnlimitedSession(category, {
        target_tmdb_id: target.tmdb_id, guesses: [], game_over: false,
        won: null, hints_revealed: [], hints_revealed_count: 0,
      }).catch(() => {});
    }
  }

  async function restoreGuestSession(saved, pool) {
    if (!saved.guesses?.length) return;
    const target = pool.find((m) => m.tmdb_id === saved.targetId);
    const rows = saved.guesses.map((id) => {
      const movie = pool.find((m) => m.tmdb_id === id);
      if (!movie || !target) return null;
      const tiles = evaluateTilesLocal(movie, target);
      const correct = movie.tmdb_id === target.tmdb_id;
      return { movie, tiles, correct };
    }).filter(Boolean);

    setGuessResults(rows);
    setGuessedIds(saved.guesses);

    const lastCorrect = rows.some((r) => r.correct);
    if (lastCorrect || rows.length >= getMaxGuesses(category)) {
      setGameOver(true);
      setWon(lastCorrect);
      setResult(target);
      // Restore scoring snapshot — the hints the user manually revealed before game ended
      setGameOverHintsRevealed(saved.gameOverHintsRevealed || []);
      setHintsRevealedCount(saved.hintsRevealedCount || 0);
      // Fetch post-game hints from server so cast_actor_profile is fresh
      try {
        const pgRes = await checkGuess(target.tmdb_id, target.tmdb_id, 99, category);
        let restoredHints = hintsFromServer(pgRes.hint || {});
        // Augment actor hint with profile from local pool if server didn't include it
        restoredHints = restoredHints.map((h) => {
          if (h.type !== 'actor' || h.profile) return h;
          const castList = Array.isArray(target.cast_list) ? target.cast_list : [];
          const profiles = Array.isArray(target.cast_profiles) ? target.cast_profiles : [];
          const idx = castList.findIndex(
            (n) => (n || '').trim().toLowerCase() === (h.value || '').toLowerCase()
          );
          return idx >= 0 && profiles[idx] ? { ...h, profile: profiles[idx] } : h;
        });
        mergeHints(restoredHints, true);
      } catch {
        mergeHints(getHints(99, target, category), true);
      }
    } else {
      // Restore hint count for in-progress unlimited game
      if (saved.hintsRevealedCount) setHintsRevealedCount(saved.hintsRevealedCount);
      updateHints(rows.length, target);
    }
  }

  // ── Handle a guess ─────────────────────────────────────────────
  const handleGuess = useCallback(async (selectedMovie) => {
    if (gameOver || submitting) return;
    if (guessedIds.includes(selectedMovie.tmdb_id)) return;

    setSubmitting(true);
    setError(null);

    try {
      let tiles, correct, revealedResult, serverHint = null;
      let postGameHints = [];
      let postGameResult = null; // the full result object (for persisting to localStorage)
      let movieForRow = selectedMovie;

      if (isUnlimited) {
        tiles   = evaluateTilesLocal(selectedMovie, targetMovie);
        correct = selectedMovie.tmdb_id === targetMovie.tmdb_id;
      } else {
        // Compute type-specific total hint cost for accurate backend scoring
        const hintsCostFE = hintsRevealed.reduce(
          (sum, h) => sum + ((HINT_TYPE_COSTS_FE[category] || {})[h.type] || 0), 0
        );
        const res = await submitGuess(category, selectedMovie.tmdb_id, guessResults.length + 1, hintsRevealedCount, hintsCostFE);
        tiles        = res.tiles;
        correct      = res.correct;
        movieForRow  = res.guessed_movie || selectedMovie;
        if (res.movie_reveal) revealedResult = res.movie_reveal;
        serverHint   = res.hint || null;
      }

      const newRow = { movie: movieForRow, tiles, correct };
      const newGuesses = [...guessResults, newRow];
      const newIds     = [...guessedIds, selectedMovie.tmdb_id];

      setLatestIndex(newGuesses.length - 1);
      setGuessResults(newGuesses);
      setGuessedIds(newIds);

      // Scroll latest row into view
      setTimeout(() => {
        boardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }, 200);

      const isGameOver = correct || newGuesses.length >= getMaxGuesses(category);

      if (isGameOver) {
        setGameOver(true);
        setWon(correct);
        // Capture ONLY the hints the user manually revealed before game end.
        // mergeHints(suppress=true) later overwrites hintsRevealed with post-game
        // auto-revealed hints — we must snapshot here to keep scoring correct.
        setGameOverHintsRevealed([...hintsRevealed]);

        if (isUnlimited) {
          if (session) {
            // Optimistically update unlimited streak immediately, then server-confirm.
            if (correct) {
              setUnlimitedStreak((prev) => ({
                current: prev.current + 1,
                best: Math.max(prev.best, prev.current + 1),
              }));
            } else {
              setUnlimitedStreak((prev) => ({ current: 0, best: prev.best }));
            }
            // Fire-and-forget server write; server-confirm the streak after it lands.
            submitUnlimitedResult(category, correct)
              .then(() => refreshStreak())
              .catch(console.error);
          } else {
            const s = loadGuestStreak(streakKey);
            const next = correct
              ? { current: (s.current || 0) + 1, longest: Math.max(s.longest || 0, (s.current || 0) + 1) }
              : { current: 0, longest: s.longest || 0 };
            saveGuestStreak(streakKey, next);
            setUnlimitedStreak({ current: next.current, best: next.longest });
          }
        } else if (session && correct) {
          // Daily correct guess — optimistically bump the streak immediately,
          // then server-confirm after the backend has written the new streak row.
          setDailyStreak((prev) => ({
            current: prev.current + 1,
            best: Math.max(prev.best, prev.current + 1),
          }));
          // Server-confirm (submitGuess already wrote to DB; just re-read the streak).
          setTimeout(() => {
            getStreaks(category)
              .then((s) => setDailyStreak({ current: s.current_streak ?? 0, best: s.longest_streak ?? 0 }))
              .catch(() => {});
          }, 600);
        }

        if (isUnlimited) {
          setResult(targetMovie);
          postGameResult = targetMovie;
          // Build post-game hints: try server first (always has fresh cast_profiles
          // via SELECT *), then fall back to local pool data.
          try {
            const pgRes = await checkGuess(targetMovie.tmdb_id, targetMovie.tmdb_id, 99, category);
            postGameHints = hintsFromServer(pgRes.hint || {});
          } catch {
            postGameHints = getHints(99, targetMovie, category);
          }
          // Augment any actor hint that is missing a profile with data from the
          // local pool (pool query now includes cast_profiles — covers the case
          // where the backend hasn't yet returned cast_actor_profile).
          postGameHints = postGameHints.map((h) => {
            if (h.type !== 'actor' || h.profile) return h;
            const castList = Array.isArray(targetMovie.cast_list) ? targetMovie.cast_list : [];
            const profiles = Array.isArray(targetMovie.cast_profiles) ? targetMovie.cast_profiles : [];
            const idx = castList.findIndex(
              (n) => (n || '').trim().toLowerCase() === (h.value || '').toLowerCase()
            );
            return idx >= 0 && profiles[idx] ? { ...h, profile: profiles[idx] } : h;
          });
          mergeHints(postGameHints, true);
        } else if (revealedResult) {
          setResult(revealedResult);
          postGameResult = revealedResult;
          // serverHint is the top-level hint from the guess response — the backend
          // now returns guessNumber:99 hints when the game ends, so this always
          // contains the full set.
          if (serverHint && Object.keys(serverHint).length > 0) {
            postGameHints = hintsFromServer(serverHint);
            mergeHints(postGameHints, true);
          }
        } else {
          try {
            const rev = await getResult(category);
            setResult(rev);
            postGameResult = rev;
            // Silently unlock all post-game hints from server result
            if (rev.hint && Object.keys(rev.hint).length > 0) {
              postGameHints = hintsFromServer(rev.hint);
              mergeHints(postGameHints, true);
            }
          } catch {}
        }

        setTimeout(() => setShowModal(true), 800);
      }

      if (isUnlimited) {
        // Save full state so a page refresh or re-entry restores exactly where we left off.
        // For game-over: capture the snapshot of user-revealed hints (same as setGameOverHintsRevealed).
        saveUnlimitedState(category, {
          targetId: targetMovie.tmdb_id,
          guesses: newIds,
          gameOver: isGameOver,
          won: isGameOver ? correct : null,
          hintsRevealedCount: hintsRevealedCount,
          gameOverHintsRevealed: isGameOver ? [...hintsRevealed] : [],
        });
        // Authenticated: sync to server so other devices see the same state.
        if (session) {
          saveUnlimitedSession(category, {
            target_tmdb_id:     targetMovie.tmdb_id,
            guesses:            newIds,
            game_over:          isGameOver,
            won:                isGameOver ? correct : null,
            hints_revealed:     isGameOver ? [...hintsRevealed] : [],
            hints_revealed_count: hintsRevealedCount,
          }).catch(() => {});
        }
      } else {
        // Daily: snapshot the full board into localStorage so a refresh /
        // tab-switch / network blip doesn't wipe progress.
        saveDailyState(guestKey, {
          rows:               newGuesses,
          gameOver:           isGameOver,
          won:                isGameOver ? correct : null,
          result:             isGameOver ? (postGameResult || revealedResult || null) : null,
          hints:              isGameOver ? postGameHints : [],
          hintsRevealedCount: hintsRevealedCount,
          date:               dailyDate,
        });
      }

      // Only update progressive hints during active play — when the game is over
      // post-game hints are already set in full inside the isGameOver block above,
      // and re-running mergeHints with the in-progress count would overwrite them.
      if (!isGameOver) {
        // Always prefer the server hint — it has cast_actor_profile from SELECT *,
        // which the cached local pool may be missing.
        const nextHints = serverHint
          ? hintsFromServer(serverHint)
          : getHints(newGuesses.length, targetMovie || null, category);
        mergeHints(nextHints, false);
      }
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to submit guess. Try again.');
    } finally {
      setSubmitting(false);
    }
  }, [gameOver, submitting, guessedIds, guessResults, mode, category, targetMovie, isUnlimited, guestKey, streakKey, session, refreshStreak, hintsRevealed, hintsRevealedCount]);

  function updateHints(guessCount, target) {
    if (!target) return;
    mergeHints(getHints(guessCount, target, category));
  }

  // suppress=true when game is already decided (correct guess / max guesses hit).
  // When suppress=true (post-game): unlock AND reveal hints for free.
  // When suppress=false (during play): only unlock hints; user must click to reveal.
  function mergeHints(nextHints, suppress = false) {
    setHintsUnlocked((prev) => {
      const prevTypes = new Set(prev.map((h) => h.type));
      const added = nextHints.filter((h) => !prevTypes.has(h.type));
      if (added.length > 0 && !suppress) {
        setNewHintAvailable(true); // silent notification — pulsing button
      }
      return nextHints;
    });
    if (suppress) {
      // Post-game: reveal all hints for free (score already recorded)
      setHintsRevealed(() => nextHints);
    }
  }

  // Handle user clicking a specific "Reveal" button inside the HintModal.
  // `specificHint` is the hint object the user chose; when omitted it falls back
  // to the first unrevealed hint (legacy sequential behaviour).
  function handleRevealHint(specificHint) {
    if (gameOver) {
      // Post-game: just open the modal showing all unlocked hints
      setShowHintModal(true);
      setNewHintAvailable(false);
      return;
    }
    // Resolve which hint to reveal
    const revealedTypes = new Set(hintsRevealed.map((h) => h.type));
    const nextHint = specificHint && !revealedTypes.has(specificHint.type)
      ? specificHint
      : hintsUnlocked.find((h) => !revealedTypes.has(h.type));
    if (!nextHint) return;

    const newRevealed = [...hintsRevealed, nextHint];
    const newCount    = hintsRevealedCount + 1;
    setHintsRevealed(newRevealed);
    setHintsRevealedCount(newCount);
    setLatestHintType(nextHint.type);
    setNewHintAvailable(false);
    setShowHintModal(true);

    // Recalculate potential score using type-specific costs, no bonus shown live
    const typeCosts = HINT_TYPE_COSTS_FE[category] || {};
    const hintCost  = newRevealed.reduce((sum, h) => sum + (typeCosts[h.type] || 0), 0);
    const misses    = guessResults.length;
    setPotentialScore(Math.max(0, 20 - hintCost - misses));

    // Persist updated hint count to localStorage
    if (!isUnlimited) {
      const saved = loadDailyState(guestKey);
      if (saved) {
        saveDailyState(guestKey, { ...saved, hintsRevealedCount: newCount });
      }
    }
  }

  function hintsFromServer(serverHint) {
    const out = [];
    // top250 + indiancinema: actor first (guess 4), logline second (guess 5)
    // Default: logline (5), frame (6)
    if (category === 'indiancinema') {
      if (serverHint.cast_actor)    out.push({ type: 'actor', label: 'A Cast Member',           value: serverHint.cast_actor, profile: serverHint.cast_actor_profile || null });
      if (serverHint.ai_quote)      out.push({ type: 'clue',  label: 'The Logline',             value: serverHint.ai_quote });
      if (serverHint.backdrop_path) out.push({ type: 'image', label: 'A Frame From The Movie',  value: serverHint.backdrop_path });
      if (serverHint.music_song)    out.push({ type: 'music', label: 'Musical Hint',            value: serverHint.music_song, singers: serverHint.music_singers || '' });
    } else {
      if (serverHint.cast_actor)    out.push({ type: 'actor', label: 'A Cast Member',           value: serverHint.cast_actor, profile: serverHint.cast_actor_profile || null });
      if (serverHint.ai_quote)      out.push({ type: 'clue',  label: 'The Logline',             value: serverHint.ai_quote });
      if (serverHint.backdrop_path) out.push({ type: 'image', label: 'A Frame From The Movie',  value: serverHint.backdrop_path });
    }
    return out;
  }

  // ── Render ─────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50dvh] gap-4">
        <div className="w-10 h-10 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-500 text-sm font-medium">Loading {catMeta?.label} movies...</p>
      </div>
    );
  }

  const maxGuesses  = getMaxGuesses(category);
  const guessCount  = guessResults.length;
  const guessesLeft = maxGuesses - guessCount;

  return (
    <div className="space-y-4 sm:space-y-6 lg:space-y-3 animate-fade-in">
      {/* Category header + streak badge */}
      <div className="relative flex items-start justify-between gap-3">
        {/* Spacer so title stays centred */}
        <div className="w-24 sm:w-28 flex-shrink-0" />

        {/* Centre: title */}
        <div className="flex-1 text-center min-w-0 flex flex-col items-center gap-1.5">
          <h1 className="font-display text-xl sm:text-2xl font-bold text-white leading-tight">
            {catMeta?.emoji} {catMeta?.label}
          </h1>
          <span
            className={`inline-flex items-center gap-1 text-[10px] sm:text-xs font-semibold px-2.5 py-0.5 rounded-full align-middle border
                        ${isUnlimited
                          ? 'bg-purple-500/15 text-purple-400 border-purple-500/25'
                          : 'bg-accent/15 text-accent border-accent/25'}`}
          >
            {isUnlimited ? '∞ Unlimited' : '📅 Daily'}
          </span>
          <p className="text-gray-600 text-xs sm:text-sm">
            {isUnlimited
              ? 'Unlimited play — new random movie each round'
              : `Daily movie — ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}`}
          </p>
        </div>

        {/* Right: streak badge — state is owned by GamePage so it updates instantly on win */}
        {isUnlimited ? (
          <FlameStreakBadge current={unlimitedStreak.current} best={unlimitedStreak.best} />
        ) : (
          <FlameStreakBadge
            current={dailyStreak.current}
            best={dailyStreak.best}
            noSession={!session}
          />
        )}
      </div>

      {/* Error banner */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-400 flex items-center justify-between gap-3">
          <span>{error}</span>
          {/* Show manual retry button once all auto-retries are exhausted */}
          {!error.startsWith('Connecting') && (
            <button
              onClick={() => {
                retryCountRef.current = 0;
                setError(null);
                hydratedKeyRef.current = null;
                setReloadTrigger((n) => n + 1);
              }}
              className="flex-shrink-0 text-xs underline opacity-70 hover:opacity-100 transition-opacity"
            >
              Try again
            </button>
          )}
        </div>
      )}

      {/* Potential points counter — any mode, non-game-over */}
      {!gameOver && (
        <div className="flex justify-center">
          <button
            onClick={() => setShowRules(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold
                       transition-all hover:scale-[1.04] active:scale-95"
            style={{
              background: 'rgba(245,158,11,0.10)',
              border:     '1px solid rgba(245,158,11,0.25)',
              color:      '#F3CE13',
            }}
          >
            <span>⭐</span>
            <span>Potential: {potentialScore}pts</span>
            <span
              className="ml-0.5 w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] font-bold"
              style={{ background: 'rgba(245,158,11,0.22)', color: '#F3CE13', lineHeight: 1 }}
            >
              ℹ
            </span>
          </button>
        </div>
      )}

      {/* Guess counter — progress dots + hint countdown */}
      {!gameOver && (
        <div className="flex flex-col items-center gap-1">
          {/* Dots row */}
          <div className="flex items-center justify-center gap-1.5 sm:gap-2">
            {Array.from({ length: maxGuesses }).map((_, i) => (
              <div
                key={i}
                className={`w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full transition-all duration-300 ${
                  i < guessCount
                    ? 'bg-accent shadow-[0_0_8px_rgba(245,158,11,0.4)]'
                    : 'bg-surface-border'
                }`}
              />
            ))}
            <span className="text-[10px] sm:text-xs text-gray-600 ml-2 font-medium">
              {guessesLeft} guess{guessesLeft !== 1 ? 'es' : ''} left
            </span>
          </div>

          {/* Hint countdown — only shown before the first hint unlocks */}
          {(() => {
            // First hint unlocks: Indian Cinema = guess 4, Most Popular = guess 4, others = guess 5
            const firstHintAt = (category === 'indiancinema' || category === 'top250') ? 4 : 5;
            const remaining   = firstHintAt - guessCount;
            if (remaining <= 0) return null;
            return (
              <p className="text-[9px] sm:text-[10px] text-gray-700 font-medium tracking-wide">
                💡 hint in {remaining} guess{remaining !== 1 ? 'es' : ''}
              </p>
            );
          })()}
        </div>
      )}

      {/* Search input */}
      <MovieSearch
        movies={movies}
        onSelect={handleGuess}
        disabled={gameOver || submitting}
        alreadyGuessed={guessedIds}
      />

      {/* Loading spinner on submit */}
      {submitting && (
        <div className="flex justify-center">
          <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* ── Starter info button (top250 only, before hints unlock) ── */}
      {category === 'top250' && !gameOver && hintsUnlocked.length === 0 && starterInfo && (
        <div className="flex justify-center">
          <button
            onClick={() => setShowStarterModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl
                       bg-amber-500/10 hover:bg-amber-500/20
                       border border-amber-500/30 text-amber-300
                       text-xs sm:text-sm font-medium transition-all hover:scale-[1.02]"
          >
            <span>ℹ️</span>
            <span>Starter Info</span>
          </button>
        </div>
      )}

      {/* ── Starter info standalone modal (before hints unlock) ── */}
      {showStarterModal && hintsUnlocked.length === 0 && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 animate-fade-in"
          onClick={(e) => { if (e.target === e.currentTarget) setShowStarterModal(false); }}
        >
          <div className="card w-full sm:max-w-md p-5 sm:p-6 animate-curtain-rise sm:animate-bounce-in relative
                          rounded-t-3xl sm:rounded-2xl max-h-[85dvh] overflow-y-auto">
            <button
              onClick={() => setShowStarterModal(false)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-surface-input flex items-center justify-center
                         text-gray-500 hover:text-white hover:bg-surface-border transition-all"
              aria-label="Close"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <h2 className="font-display text-lg font-bold text-white mb-3">ℹ️ Starter Info</h2>
            <StarterInfoPanel starterInfo={starterInfo} />
            <button onClick={() => setShowStarterModal(false)} className="btn-primary w-full mt-5 text-sm">
              Got it
            </button>
          </div>
        </div>
      )}

      {/* ── Hints button (appears after hints unlock, replaces starter info button) ── */}
      {(hintsUnlocked.length > 0 || (gameOver && hintsUnlocked.length > 0)) && (
        <div className="flex justify-center">
          {(() => {
            const unrevealedCount = hintsUnlocked.filter(
              (h) => !hintsRevealed.some((r) => r.type === h.type)
            ).length;

            if (gameOver) {
              return (
                <button
                  onClick={() => { setShowHintModal(true); setNewHintAvailable(false); }}
                  className="relative inline-flex items-center gap-2 px-4 py-2 rounded-xl
                             bg-purple-500/10 hover:bg-purple-500/20
                             border border-purple-500/30 text-purple-300
                             text-xs sm:text-sm font-medium transition-all hover:scale-[1.02]"
                >
                  <span>💡</span>
                  <span>Post-game hints ({hintsUnlocked.length})</span>
                </button>
              );
            }

            return (
              <button
                onClick={() => { setShowHintModal(true); setNewHintAvailable(false); }}
                className="relative inline-flex items-center gap-2 px-4 py-2 rounded-xl
                           bg-purple-500/10 hover:bg-purple-500/20
                           border border-purple-500/30 text-purple-300
                           text-xs sm:text-sm font-medium transition-all hover:scale-[1.02]"
                style={newHintAvailable ? { boxShadow: '0 0 18px rgba(168,85,247,0.35)', borderColor: 'rgba(168,85,247,0.55)' } : {}}
              >
                <span>💡</span>
                <span>
                  {unrevealedCount > 0
                    ? `Hints Available (${unrevealedCount})`
                    : `View Hints (${hintsRevealed.length})`}
                </span>
                {newHintAvailable && (
                  <span className="absolute -top-1.5 -right-1.5 flex h-3.5 w-3.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-purple-500 ring-2 ring-surface-bg" />
                  </span>
                )}
              </button>
            );
          })()}
        </div>
      )}

      {/* Hint modal — starter info at top, then hints below */}
      <HintModal
        hints={gameOver ? hintsUnlocked : hintsRevealed}
        availableHints={gameOver ? [] : hintsUnlocked.filter(
          (h) => !hintsRevealed.some((r) => r.type === h.type)
        )}
        hintTypeCosts={HINT_TYPE_COSTS_FE[category] || {}}
        onRevealHint={handleRevealHint}
        open={showHintModal}
        latestType={latestHintType}
        onClose={() => setShowHintModal(false)}
        starterInfo={category === 'top250' ? starterInfo : null}
      />

      {/* Colorblind legend — only shown when colorblind mode is active */}
      {colorblind && (
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: '6px 12px',
          alignItems: 'center', justifyContent: 'center',
          padding: '7px 14px',
          borderRadius: 10,
          background: 'rgba(96,165,250,0.07)',
          border: '1px solid rgba(96,165,250,0.18)',
        }}>
          <span style={{ fontSize: '0.60rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(96,165,250,0.75)', marginRight: 2 }}>
            🎨 Legend:
          </span>
          {[
            { pattern: 'diagonal-stripes', color: '#22c55e', label: 'Match' },
            { pattern: 'vertical-lines',   color: '#00E5FF', label: '≤2 Yr' },
            { pattern: 'dots',             color: '#FFBF00', label: '≤5 Yr' },
            { pattern: 'h-bars',           color: '#ef4444', label: 'Wrong' },
          ].map(({ pattern, color, label }, i) => (
            <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <span style={{
                display: 'inline-block', width: 14, height: 14,
                borderRadius: 3,
                background: color,
                backgroundImage:
                  pattern === 'diagonal-stripes'
                    ? 'repeating-linear-gradient(-45deg,rgba(255,255,255,0.22) 0px,rgba(255,255,255,0.22) 2px,transparent 2px,transparent 8px)'
                  : pattern === 'vertical-lines'
                    ? 'repeating-linear-gradient(90deg,rgba(0,0,0,0.22) 0px,rgba(0,0,0,0.22) 2px,transparent 2px,transparent 7px)'
                  : pattern === 'dots'
                    ? 'radial-gradient(circle 1.5px at 4px 4px,rgba(255,255,255,0.35) 100%,transparent 100%)'
                  : 'repeating-linear-gradient(0deg,rgba(0,0,0,0.22) 0px,rgba(0,0,0,0.22) 2px,transparent 2px,transparent 6px)',
                backgroundSize:
                  pattern === 'dots' ? '7px 7px' : 'auto',
              }} />
              <span style={{ fontSize: '0.62rem', fontWeight: 600, color: 'rgba(255,255,255,0.65)' }}>{label}</span>
            </span>
          ))}
        </div>
      )}

      {/* Game board */}
      <div ref={boardRef}>
        <GameBoard
          guessResults={guessResults}
          category={category}
          latestIndex={latestIndex}
        />
      </div>

      {/* Game-over banner */}
      {gameOver && (
        <div className={`text-center py-3 sm:py-4 rounded-xl text-sm font-semibold animate-bounce-in ${
          won
            ? 'bg-green-500/10 border border-green-500/20 text-green-400'
            : 'bg-red-500/10 border border-red-500/20 text-red-400'
        }`}>
          {won ? `🎉 Got it in ${guessCount}/${maxGuesses}!` : `💀 Not this time — ${maxGuesses}/${maxGuesses} used`}
          {result && (
            <button
              onClick={() => setShowModal(true)}
              className="ml-3 underline text-xs opacity-70 hover:opacity-100 transition-opacity"
            >
              See results
            </button>
          )}
        </div>
      )}

      {/* Unlimited: play another round */}
      {gameOver && isUnlimited && (
        <div className="flex justify-center">
          <button onClick={startUnlimitedRound} className="btn-primary text-sm sm:text-base">
            ↻ New round
          </button>
        </div>
      )}

      {/* Result modal */}
      {showModal && result && (
        <ResultModal
          result={result}
          category={category}
          guessResults={guessResults}
          won={won}
          onClose={() => setShowModal(false)}
          isUnlimited={isUnlimited}
          onNewRound={startUnlimitedRound}
          hintsRevealedCount={hintsRevealedCount}
          hintsRevealed={gameOverHintsRevealed}
        />
      )}

      {/* Scoring rules — opened by tapping the potential score pill */}
      <RulesModal
        open={showRules}
        onClose={() => setShowRules(false)}
        initialPage={1}
      />

    </div>
  );
}

// ── Flame Streak System ───────────────────────────────────────────────────────

// Tier config — ordered highest → lowest
const FLAME_TIERS = [
  {
    min: 500, name: 'haze',
    colors: ['#f8fafc', '#e0e7ff', '#a5b4fc'],
    ds: 'drop-shadow(0 0 9px rgba(255,255,255,0.75)) drop-shadow(0 0 18px rgba(165,180,252,0.5))',
    aura: 'rgba(255,255,255,0.11)',
    numGlow: '#c7d2fe',
    speed: '2s', pilot: false, sparks: true, haze: true,
  },
  {
    min: 250, name: 'supernova',
    colors: ['#fefce8', '#fef3c7', '#fde68a'],
    ds: 'drop-shadow(0 0 8px rgba(254,243,199,0.7)) drop-shadow(0 0 16px rgba(253,230,138,0.4))',
    aura: 'rgba(254,243,199,0.09)',
    numGlow: '#fef3c7',
    speed: '2.6s', pilot: false, sparks: true, haze: false,
  },
  {
    min: 100, name: 'plasma',
    colors: ['#e879f9', '#a855f7', '#60a5fa'],
    ds: 'drop-shadow(0 0 7px rgba(168,85,247,0.7)) drop-shadow(0 0 14px rgba(96,165,250,0.35))',
    aura: 'rgba(168,85,247,0.12)',
    numGlow: '#c4b5fd',
    speed: '1.5s', pilot: false, sparks: true, haze: false,
  },
  {
    min: 50, name: 'inferno',
    colors: ['#fcd34d', '#ef4444', '#dc2626'],
    ds: 'drop-shadow(0 0 7px rgba(239,68,68,0.65)) drop-shadow(0 0 14px rgba(239,68,68,0.28))',
    aura: 'rgba(239,68,68,0.10)',
    numGlow: '#fca5a5',
    speed: '1.1s', pilot: false, sparks: true, haze: false,
  },
  {
    min: 25, name: 'blaze',
    colors: ['#fef08a', '#fb923c', '#f97316'],
    ds: 'drop-shadow(0 0 6px rgba(249,115,22,0.5)) drop-shadow(0 0 12px rgba(249,115,22,0.22))',
    aura: 'rgba(249,115,22,0.08)',
    numGlow: '#fed7aa',
    speed: '1.5s', pilot: false, sparks: false, haze: false,
  },
  {
    min: 10, name: 'flame',
    colors: ['#fef9c3', '#fbbf24', '#eab308'],
    ds: 'drop-shadow(0 0 5px rgba(234,179,8,0.45))',
    aura: 'rgba(234,179,8,0.06)',
    numGlow: '#fef08a',
    speed: '1.9s', pilot: false, sparks: false, haze: false,
  },
  {
    min: 0, name: 'pilot',
    colors: ['#e0f2fe', '#bfdbfe', '#93c5fd'],
    ds: 'drop-shadow(0 0 4px rgba(147,197,253,0.3))',
    aura: 'rgba(147,197,253,0.04)',
    numGlow: '#bfdbfe',
    speed: '3.2s', pilot: true, sparks: false, haze: false,
  },
];

function getFlameConfig(n) {
  return FLAME_TIERS.find((t) => n >= t.min) || FLAME_TIERS[FLAME_TIERS.length - 1];
}

function getMilestoneLevel(n) {
  if (n >= 500) return 500;
  if (n >= 250) return 250;
  if (n >= 100) return 100;
  if (n >= 50)  return 50;
  if (n >= 25)  return 25;
  if (n >= 10)  return 10;
  return 0;
}

// Floating spark particles (inferno tier and above)
function FlameParticles({ color }) {
  const sparks = [
    { left: '28%', delay: '0s',    dur: '1.1s', dx: '-5px'  },
    { left: '52%', delay: '0.35s', dur: '0.95s', dx: '7px'  },
    { left: '18%', delay: '0.65s', dur: '1.25s', dx: '-3px' },
    { left: '68%', delay: '0.15s', dur: '1.0s',  dx: '4px'  },
    { left: '42%', delay: '0.8s',  dur: '1.15s', dx: '-6px' },
    { left: '60%', delay: '0.5s',  dur: '0.9s',  dx: '3px'  },
  ];
  return (
    <>
      {sparks.map((s, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            width: '2.5px',
            height: '2.5px',
            borderRadius: '50%',
            background: color,
            boxShadow: `0 0 4px ${color}`,
            left: s.left,
            bottom: '58%',
            animation: `flame-spark-float ${s.dur} ease-out ${s.delay} infinite`,
            '--sx': s.dx,
          }}
        />
      ))}
    </>
  );
}

function FlameStreakBadge({ current, best, noSession = false }) {
  const cfg = getFlameConfig(current);
  const prevLevelRef = useRef(null);
  const [bursting, setBursting] = useState(false);

  useEffect(() => {
    const lvl = getMilestoneLevel(current);
    if (prevLevelRef.current !== null && current > 0 && lvl > prevLevelRef.current) {
      setBursting(true);
      const t = setTimeout(() => setBursting(false), 750);
      prevLevelRef.current = lvl;
      return () => clearTimeout(t);
    }
    prevLevelRef.current = lvl;
  }, [current]);

  const flameAnim = cfg.pilot
    ? `flame-pilot-flicker ${cfg.speed} ease-in-out infinite`
    : cfg.name === 'supernova' || cfg.name === 'haze'
      ? `flame-supernova-pulse ${cfg.speed} ease-in-out infinite`
      : `flame-flicker ${cfg.speed} ease-in-out infinite`;

  const numStr  = noSession ? '—'       : String(current);
  const subStr  = noSession ? 'sign in' : `/ ${best} best`;
  const numSize = current >= 1000 ? '0.72rem' : current >= 100 ? '0.82rem' : '1rem';

  return (
    <div
      className="w-24 sm:w-28 flex-shrink-0 flex flex-col items-center gap-0.5"
      style={cfg.haze ? { animation: 'flame-heat-haze 2.8s ease-in-out infinite' } : {}}
    >
      {/* ── Shared keyframes (injected once into DOM) ── */}
      <style>{`
        @keyframes flame-flicker {
          0%,100% { transform: scale(1) skewX(0deg); }
          20%     { transform: scale(1.03) skewX(-1.8deg); }
          45%     { transform: scale(0.97) skewX(1.4deg); }
          70%     { transform: scale(1.02) skewX(-0.7deg); }
        }
        @keyframes flame-pilot-flicker {
          0%,100% { opacity: 0.6; transform: scale(1); }
          50%     { opacity: 0.82; transform: scale(1.025); }
        }
        @keyframes flame-supernova-pulse {
          0%,100% { transform: scale(1); filter: brightness(1); }
          50%     { transform: scale(1.06); filter: brightness(1.22); }
        }
        @keyframes flame-burst {
          0%   { transform: scale(1); }
          28%  { transform: scale(1.55); }
          62%  { transform: scale(0.92); }
          100% { transform: scale(1); }
        }
        @keyframes flame-spark-float {
          0%   { transform: translateY(0) translateX(0) scale(1); opacity: 0.95; }
          100% { transform: translateY(-26px) translateX(var(--sx,0px)) scale(0); opacity: 0; }
        }
        @keyframes flame-heat-haze {
          0%,100% { transform: skewX(0deg) scaleY(1); }
          33%     { transform: skewX(0.55deg) scaleY(1.003); }
          66%     { transform: skewX(-0.45deg) scaleY(0.998); }
        }
      `}</style>

      {/* ── Flame container ── */}
      <div
        style={{
          position: 'relative',
          width: '56px',
          height: '78px',
          opacity: noSession ? 0.42 : 1,
          animation: bursting ? 'flame-burst 0.72s cubic-bezier(0.34,1.56,0.64,1) forwards' : undefined,
        }}
      >
        {/* Ambient aura */}
        <div style={{
          position: 'absolute',
          inset: '-10px',
          borderRadius: '50%',
          background: `radial-gradient(ellipse 65% 80% at 50% 58%, ${cfg.aura}, transparent)`,
          pointerEvents: 'none',
        }} />

        {/* Flame SVG */}
        <svg
          viewBox="0 0 48 70"
          style={{
            position: 'absolute',
            top: 0,
            left: '50%',
            transform: 'translateX(-50%)',
            width: '48px',
            height: '70px',
            filter: cfg.ds,
            animation: flameAnim,
            transformOrigin: 'center bottom',
            overflow: 'visible',
          }}
        >
          <defs>
            <linearGradient id="fg-flame-outer" x1="0.5" y1="0" x2="0.5" y2="1">
              <stop offset="0%"   stopColor={cfg.colors[0]} />
              <stop offset="52%"  stopColor={cfg.colors[1]} />
              <stop offset="100%" stopColor={cfg.colors[2]} />
            </linearGradient>
            <linearGradient id="fg-flame-inner" x1="0.5" y1="0" x2="0.5" y2="1">
              <stop offset="0%"   stopColor={cfg.colors[0]} stopOpacity="0.85" />
              <stop offset="100%" stopColor={cfg.colors[1]} stopOpacity="0.25" />
            </linearGradient>
          </defs>

          {/* Outer flame body */}
          <path
            d="M24,67
               C9,61 2,49 4,35
               C6,23 13,14 21,6
               C19,17 16,24 18,33
               C18,37 22,35 22,28
               C22,36 28,33 28,40
               C30,32 35,21 33,12
               C41,21 47,35 45,48
               C43,59 35,66 24,67 Z"
            fill="url(#fg-flame-outer)"
          />

          {/* Inner highlight core */}
          <path
            d="M24,58
               C15,54 11,44 13,36
               C15,28 19,22 22,18
               C21,26 19,32 21,38
               C22,41 24,39 24,33
               C25,40 28,37 28,44
               C30,38 33,30 31,24
               C37,31 40,41 38,49
               C36,55 31,60 24,58 Z"
            fill="url(#fg-flame-inner)"
            opacity="0.48"
          />
        </svg>

        {/* Sparks — inferno, plasma, supernova, haze */}
        {cfg.sparks && !noSession && <FlameParticles color={cfg.colors[0]} />}

        {/* Streak number centered at flame base */}
        <div style={{
          position: 'absolute',
          bottom: '7px',
          left: '50%',
          transform: 'translateX(-50%)',
          whiteSpace: 'nowrap',
          lineHeight: 1,
        }}>
          <span style={{
            fontSize: numSize,
            fontWeight: 800,
            color: '#ffffff',
            fontFamily: '"Space Grotesk", Inter, system-ui, sans-serif',
            textShadow: `0 0 8px ${cfg.numGlow}, 0 0 22px ${cfg.numGlow}`,
            letterSpacing: '-0.02em',
          }}>
            {numStr}
          </span>
        </div>
      </div>

      {/* Best streak / sign-in subtitle */}
      <p style={{
        fontSize: '9px',
        color: 'rgba(255,255,255,0.28)',
        fontWeight: 500,
        whiteSpace: 'nowrap',
        marginTop: '-1px',
      }}>
        {subStr}
      </p>
    </div>
  );
}
