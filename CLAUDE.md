# CineGuess — CLAUDE.md

Daily movie guessing game (Wordle-style). Players guess a target movie; tiles reveal how close each guess is (genre, director, actors, year, studio, etc.). Live at cineguessit.com.

## Architecture

- **frontend/** — React + Vite + Tailwind, deployed on Vercel. Routes: `/` (home), `/daily`, `/unlimited` (mode hubs), `/play/:mode/:category` (game), `/leaderboard`, `/friends`, `/profile`, `/auth`.
- **backend/** — Node/Express API on port 3001 (`npm start` → `server.js`). Deployed separately; frontend calls `/api/*`.
- **Database** — Supabase/PostgreSQL. Key tables: `movies` (all movie data incl. `ai_hint_quote` logline, `backdrop_paths` frames, `production_studio`), `daily_picks`, `used_movies`, plus auth/social tables (`vip_crew`, `leaderboard_badges`, etc.).
- **Categories**: `top250` (shown as "Most Popular"), `superhero`, `animated`, `indiancinema`. Indian Cinema gets 8 guesses; others get 7.

## Key concepts & decisions

### Loglines ("Movies Explained Badly")
Each movie has an AI logline in `movies.ai_hint_quote`: technically accurate but intentionally misleading, max 35 words, complete sentence, no character/actor/title-concept words, must contain ONE specific anchor detail (prop/setting/event). Failure modes used by the QA pipeline: **A** too obvious, **B** too vague, **C** formula violation.

- All non-Indian-cinema loglines (692) went through a verify→fix loop until clean (0 flagged).
- Scripts in `backend/src/scripts/`: `verifyLoglineQuality.js` (batch-verifies via Claude Sonnet, saves flags to `/tmp/quality_flagged.json`), `fixQualityFlagged.js` (regenerates only flagged ones, passing the failure reason to the model), `runUntilClean.js` (loops fix→re-verify **only over the flagged subset**, never re-scans everything — this was an explicit user requirement).
- Models: `claude-sonnet-4-5` for verification/fixing, `claude-haiku-4-5` for generation.
- **2026 / post-cutoff films**: `addMovie.js`'s logline step fails ("I don't have information about this film"). Fix: pull the TMDB overview and call Claude Haiku directly with the plot in the prompt, then `UPDATE movies SET ai_hint_quote = ... WHERE tmdb_id = ...`. Done this way for Obsession (2026), The Odyssey (2026), Backrooms (2026), Toy Story 5, Minions & Monsters.

### Adding movies
`node src/scripts/addMovie.js --tmdb=<id> --category=<cat>` (from `backend/`): TMDB fetch → DB upsert → AI logline → trailer frame extraction (10 frames) → Supabase upload. Works end-to-end except the logline for post-cutoff films (see above).

### Daily picks
- `dailyPick.js`: seeded LCG RNG, 50-day repeat-prevention window, one movie per category per day.
- `resetAndSchedule.js [--days=100]`: clears `daily_picks` + `used_movies` and pre-generates N days from today (EST). Last run: 2026-07-18 → 2026-10-25, 100 days × 4 categories, completed successfully.
- Picks refresh at 12:00 AM EST (documented in the rulebook).

### Studio tiles (green/yellow/red)
- Green = exact same production studio; yellow = same parent company; red = different.
- Parent maps live in **two places that must stay in sync**: `PRODUCTION_STUDIO_PARENT_FE` in `frontend/src/utils/gameLogic.js` and `PRODUCTION_STUDIO_PARENT` in `backend/src/controllers/gameController.js`. Parents: Disney, Universal, Warner Bros., Sony, Paramount, etc.
- DB `production_studio` values were consolidated to canonical names, **except Touchstone Pictures**, which the user explicitly wanted kept as its own studio (yellow vs. other Disney studios, not merged into Walt Disney Pictures). Its 6 movies were reverted to `Touchstone Pictures` in the DB; the map already contains `'Touchstone Pictures': 'Disney'`.

### Rulebook (`frontend/src/components/RulesModal.jsx`)
- How to Play is 5 short steps; mentions 12:00 AM EST refresh.
- Leaderboard text says **Top 10** players (was 50).
- Studio tile description explains parent-company yellow matches.

## Frontend redesign (2026-09, UNCOMMITTED — see below)

Full flat/"less AI-generated" restyle, frontend-only, no layout dimension changes:
- **Fonts**: Bebas Neue (logo/headings/tab names, via `font-display`, letter-spacing 0.04em), DM Sans 400/500 (body/UI), Playfair Display 400 italic (movie title in result popup only, via `font-serif italic`). Inter/Space Grotesk removed from `index.html` and Tailwind config.
- **No glows/shadows/gradients**: all `box-shadow`, `text-shadow`, `drop-shadow`/decorative `blur`, and gradient card/tile backgrounds removed sitewide (incl. flame auras, projector/spotlight/grid page overlays, shimmer strips). Colorblind tile patterns kept (flat base colors underneath). Ticket notch radial-gradient *masks* in ModeHub/HomePage kept — they're structural.
- **Colors**: red tile `#7A2828`; cards/tiles flat `#1a1a1a` + `1px solid #2a2a2a`; amber restricted to the CineGUESS logo (`#F3CE13`), the streak flame, and active-tab underlines (`#F0A500`). Tailwind `accent`/`cinema.gold` tokens neutralized to `#e5e5e5`.
- **Shape**: tiles/buttons 4px radius (`rounded`); modals/popup 6px (`rounded-md`). Daily/Unlimited toggle and category tabs are flat underline tabs (active: `2px solid #F0A500` bottom border; inactive: `#666` text, no bg) — in Navbar, mobile footer, and LeaderboardPage.
- **Navbar**: flat `#0d0d0d`, `1px solid #1f1f1f` bottom border, no backdrop blur.
- Verified in browser (desktop + mobile) with a live guess; production build passes.
- Known pre-existing quirk (not from redesign): at mid-width desktop viewports the centered mode toggle can overlap the Rules nav icon.

## Current state / unfinished

- **DO NOT COMMIT OR PUSH the redesign without explicit user approval** — user said "don't push change till I tell you." The entire flat redesign is uncommitted working-tree changes in `frontend/`. Last commit is `4a16316` (studio parent map expansion).
- Recently added movies (all complete with frames + manual loglines): Obsession 2026, Backrooms 2026, The Odyssey 2026 (top250); Toy Story 5 (id=2682), Minions & Monsters (id=2683) (animated).
- Daily picks are pre-generated through 2026-10-25; regenerate with `resetAndSchedule.js` before then.
- A dev launch config exists at `../.claude/launch.json` (`frontend` → `npm run dev --prefix cineguess/frontend`, port 5173).

## Conventions / gotchas

- The logline column is `ai_hint_quote` (NOT `ai_hint`).
- Indian cinema category id is `indiancinema` (not `indian`) — filter with `NOT (categories @> ARRAY['indiancinema']::text[])`.
- Backend scripts run from `backend/` with `require('dotenv').config()`; DB via `src/db/pool`.
- Once a logline passes verification, don't re-verify it — only work the flagged subset.
- When touching studio logic, update BOTH the frontend and backend parent maps.
