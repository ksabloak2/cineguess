# CineGuess

A daily movie guessing game. Guess the mystery film in 7 tries using colour-coded clue tiles. Play in Daily mode (everyone gets the same movie each day) or Unlimited mode (random pick, play as many rounds as you want).

## Stack

| Layer | Tech |
|---|---|
| Frontend | React 18 + Tailwind CSS + Vite |
| Backend | Node.js + Express |
| Database | PostgreSQL (Supabase) |
| Auth | Supabase Auth |
| Movie data | TMDB API |
| AI hints | Anthropic Claude (Haiku) |
| Hosting | Vercel (frontend) + Railway (backend) |

---

## Project Structure

```
cineguess/
├── frontend/                 React + Vite app
│   ├── src/
│   │   ├── components/       GameBoard, GuessRow, MovieSearch, HintModal,
│   │   │                     ResultModal, RulesModal, ReportIssueModal,
│   │   │                     Navbar, YearCalendar, StreakStats …
│   │   ├── pages/            GamePage, HomePage, AuthPage,
│   │   │                     ProfilePage, FriendsPage, ModeHub
│   │   ├── context/          AuthContext, SettingsContext
│   │   └── utils/            api.js, gameLogic.js, supabase.js
│   ├── .env.example
│   └── vite.config.js
│
└── backend/                  Node.js + Express API
    ├── server.js
    ├── Procfile              Railway start command
    ├── railway.json          Railway config
    └── src/
        ├── routes/           game.js, auth.js, friends.js, status.js
        ├── controllers/      gameController.js, authController.js, friendsController.js
        ├── middleware/       auth.js, validate.js
        ├── db/               schema.sql, pool.js, migration files
        ├── scripts/          fetchMovies.js, dailyPick.js, generateAiHints.js,
        │                     verifyAiHints.js, importLetterboxd.js …
        └── utils/            logger.js
```

---

## Game Categories

| Category | Description |
|---|---|
| **Most Popular** | Top non-animated, non-superhero films |
| **Superhero** | Marvel, DC, and beyond |
| **Animated** | Pixar, Disney, Studio Ghibli, and more |
| **Indian Cinema** | Bollywood and regional Indian films |

Each category runs its own Daily puzzle and separate Unlimited mode.

---

## Guess Tiles

Each guess reveals **6 tiles** comparing your film to the target:

| Tile | Green ✅ | Yellow 🟡 | Red ❌ |
|---|---|---|---|
| **Genre** | Both top-2 genres match | One genre matches | No match |
| **Director** | Same director | — | Different director |
| **Lead Actor/Actress** | Exact match | Actor appears in target in a different role | Not in target |
| **Supporting Actor/Actress** | Exact match | Actor appears anywhere in target | Not in target |
| **Year** | Exact year | Cyan ≤2 yrs · Amber ≤5 yrs (with ↑↓ arrow) | > 5 yrs off |
| **Language** | Same original language | — | Different language |

---

## Progressive Hints

Hints unlock automatically after wrong guesses:

| Hint | Most Popular | Indian Cinema | All other categories |
|---|---|---|---|
| 🎭 A cast member | After guess 4 | — | — |
| 💡 Logline | After guess 5 | After guess 4 | After guess 5 |
| 🖼️ A frame from the film | After guess 6 | After guess 5 | After guess 6 |
| 🎵 Musical hint | — | After guess 6 | — |

Loglines are written in a **"Movies Explained Badly"** style — technically accurate but intentionally misleading.

---

## Local Setup

### Prerequisites

- Node.js 20+
- A [Supabase](https://supabase.com) project (free tier works)
- A [TMDB API key](https://www.themoviedb.org/settings/api) (free)
- An [Anthropic API key](https://console.anthropic.com) (for AI hint generation)

### 1. Backend

```bash
cd backend
cp .env.example .env
# Fill in all values in .env

npm install

# Create all tables
npm run db:migrate

# Fetch the movie pool from TMDB (~15 min)
npm run fetch-movies

# Generate AI logline hints for all movies
npm run generate-hints

# Seed today's daily picks for all categories
npm run daily-pick

# Start dev server (port 3001)
npm run dev
```

### 2. Frontend

```bash
cd frontend
cp .env.example .env
# Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
# Leave VITE_API_URL blank — Vite proxies /api → localhost:3001 in dev

npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

---

## Deployment

### Railway (backend)

1. Create a new Railway project, connect your GitHub repo, set **Root Directory** to `backend`
2. Set all environment variables from `.env.example` (use your production values)
3. Railway auto-reads `railway.json` and starts with `node server.js`
4. Once deployed, run `npm run daily-pick` from Railway's shell to seed today's picks
5. Schedule `npm run daily-pick` to run at midnight UTC daily (Railway cron or external)

### Vercel (frontend)

1. Import the repo in Vercel, set **Root Directory** to `frontend`
2. Framework preset: **Vite** (auto-detected)
3. Set environment variables:
   - `VITE_SUPABASE_URL` — your Supabase project URL
   - `VITE_SUPABASE_ANON_KEY` — your Supabase anon key
   - `VITE_API_URL` — your Railway backend URL (e.g. `https://cineguess.up.railway.app`)
4. Deploy — Vercel handles the SPA rewrites via `vercel.json`

After both are deployed, set `FRONTEND_URL` in Railway to your Vercel URL so CORS passes.

---

## Useful Scripts (backend)

| Script | Description |
|---|---|
| `npm run fetch-movies` | Pull movie data from TMDB into the database |
| `npm run daily-pick` | Seed today's daily puzzle for all categories |
| `npm run generate-hints` | Generate AI logline hints for movies that don't have one |
| `npm run generate-hints:force` | Regenerate ALL logline hints |
| `npm run verify-hints` | Check all loglines for factual accuracy |
| `npm run verify-hints:fix` | Verify + auto-regenerate flagged loglines |
| `npm run verify-hints:fix-only` | Regenerate a pre-known list of flagged loglines (skips re-verify) |
| `npm run db:migrate` | Run the main schema migration |
