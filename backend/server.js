require('dotenv').config();
const path       = require('path');
const express    = require('express');
const cors       = require('cors');
const helmet     = require('helmet');
const rateLimit  = require('express-rate-limit');
const cron       = require('node-cron');

const app = express();

// Trust Railway/Vercel/reverse-proxy's X-Forwarded-For header.
// Required for express-rate-limit v7+ to correctly identify client IPs
// when running behind a proxy. Without this it throws ERR_ERL_UNEXPECTED_X_FORWARDED_FOR
// on every request, causing them to hang with no response.
app.set('trust proxy', 1);

// ---------------------------------------------------------------
// Security / middleware
// ---------------------------------------------------------------
// Helmet — tighten everything, but allow img tags to load TMDB-hosted
// backdrops/posters (used by the dev frame gallery page).
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      'img-src': ["'self'", 'data:', 'https://image.tmdb.org'],
    },
  },
}));
// Explicit origin allowlist — FRONTEND_URL should be your production Vercel URL.
// localhost variants are always permitted for local development.
const ALLOWED_ORIGINS = [
  process.env.FRONTEND_URL,       // e.g. https://cineguessit.com
  process.env.FRONTEND_URL_WWW,   // e.g. https://www.cineguessit.com
  'http://localhost:5173',        // Vite dev server
  'http://localhost:4173',        // Vite preview
  'http://localhost:3001',        // Frame gallery (served by the backend itself)
].filter(Boolean);

// All Vercel preview/production deployments for this project follow the pattern
// cineguess-*.vercel.app (e.g. cineguess-woad.vercel.app, cineguess-abc123-user.vercel.app).
// Allowing these means every PR preview and the canonical Vercel domain works
// without having to manually add each URL.
const VERCEL_PREVIEW_RE = /^https:\/\/cineguess[a-z0-9-]*\.vercel\.app$/i;

app.use(cors({
  origin(origin, callback) {
    // Requests with no Origin (server-to-server, curl, health checks) pass through.
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    if (VERCEL_PREVIEW_RE.test(origin)) return callback(null, true);
    // Reject anything else with a proper CORS error (not a 500).
    callback(Object.assign(new Error(`CORS: origin not allowed — ${origin}`), { status: 403 }));
  },
  credentials: true,
}));
app.use(express.json());

// ---------------------------------------------------------------
// Dynamic frame gallery — rendered from DB on every request so
// deletions are immediately reflected on refresh (no rebuild needed).
// ---------------------------------------------------------------
app.get('/frames/index.html', async (req, res) => {
  const pool = require('./src/db/pool');
  try {
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Content-Security-Policy',
      "default-src 'self'; img-src * data: blob:; script-src 'self'; style-src 'self' 'unsafe-inline';"
    );
    res.setHeader('Cache-Control', 'no-store');

    const { rows: movies } = await pool.query(`
      SELECT tmdb_id, title, year, categories, backdrop_paths
      FROM movies
      WHERE backdrop_paths IS NOT NULL AND cardinality(backdrop_paths) > 0
      ORDER BY title
    `);

    const TMDB_IMG = 'https://image.tmdb.org/t/p/w500';
    const totalImages = movies.reduce((s, m) => s + (m.backdrop_paths || []).length, 0);
    const trailerCount = movies.reduce((s, m) =>
      s + (m.backdrop_paths || []).filter(p => p.startsWith('/frames/')).length, 0);
    const supabaseCount = movies.reduce((s, m) =>
      s + (m.backdrop_paths || []).filter(p => p.includes('supabase')).length, 0);
    const tmdbCount = totalImages - trailerCount - supabaseCount;

    function thumbsHtml(movie) {
      return (movie.backdrop_paths || []).map((p, i) => {
        const isLocal    = p.startsWith('/frames/');
        const isSupabase = p.includes('supabase');
        const kind       = (isLocal || isSupabase) ? 'frame' : 'tmdb';
        const src        = isLocal ? p : isSupabase ? p : `${TMDB_IMG}${p}`;
        const filename   = isLocal ? p.replace('/frames/', '') : '';
        const dataAttrs  = kind === 'tmdb'
          ? `data-kind="tmdb" data-tmdb="${movie.tmdb_id}" data-path="${p}"`
          : `data-kind="frame" data-file="${filename}" data-tmdb="${movie.tmdb_id}" data-path="${p}"`;
        return `<div class="thumb" ${dataAttrs}><img src="${src}" alt="${i}" loading="lazy" /><button class="del" title="Remove from movie">&times;</button></div>`;
      }).join('\n');
    }

    function movieSection(movie) {
      const count      = (movie.backdrop_paths || []).length;
      const hasLocal   = (movie.backdrop_paths || []).some(p => p.startsWith('/frames/'));
      const hasSupabase = (movie.backdrop_paths || []).some(p => p.includes('supabase'));
      const kind = hasLocal ? 'trailer frames' : hasSupabase ? 'Supabase frames' : 'TMDB backdrops';
      const cats = (movie.categories || []).join(', ') || 'unknown';
      return `<section class="movie">
        <header>
          <h2>${movie.title} <span class="year">(${movie.year})</span></h2>
          <p class="meta">tmdb_id ${movie.tmdb_id} &middot; ${cats} &middot; <span class="frame-count">${count}</span> ${kind}</p>
          <div class="movie-actions">
            <button class="keep-selected" disabled>Keep selected, delete rest</button>
            <button class="clear-selection" disabled>Clear selection</button>
          </div>
        </header>
        <div class="thumbs">${thumbsHtml(movie)}</div>
      </section>`;
    }

    const css = `
  :root{color-scheme:dark}body{margin:0;font-family:-apple-system,BlinkMacSystemFont,system-ui,sans-serif;background:#0f1115;color:#e7e7e7}
  header.page{position:sticky;top:0;z-index:10;padding:16px 24px;background:#0f1115ee;backdrop-filter:blur(8px);border-bottom:1px solid #222}
  header.page h1{margin:0;font-size:18px}header.page p{margin:4px 0 0;font-size:12px;color:#888}
  input#filter{margin-top:8px;width:320px;padding:6px 10px;font-size:13px;background:#1a1d25;color:#fff;border:1px solid #333;border-radius:6px}
  main{padding:16px 24px 64px}section.movie{border-top:1px solid #222;padding:14px 0}
  section.movie h2{margin:0;font-size:15px}section.movie .year{color:#888;font-weight:normal}
  section.movie .meta{margin:2px 0 8px;font-size:11px;color:#666}
  .thumbs{display:grid;grid-template-columns:repeat(10,1fr);gap:4px}.thumb{position:relative}
  .thumb img{width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:3px;background:#222;cursor:pointer;display:block}
  .thumb img:hover{outline:2px solid #8ab4ff}.thumb.selected img{outline:3px solid #4ade80}
  .thumb.selected::after{content:'✓';position:absolute;top:4px;left:4px;width:20px;height:20px;border-radius:50%;background:#4ade80;color:#0f1115;font-size:13px;font-weight:bold;display:flex;align-items:center;justify-content:center;pointer-events:none}
  section.movie .movie-actions{display:flex;gap:8px;margin:6px 0 8px}
  section.movie .movie-actions button{font-size:11px;padding:4px 10px;background:#1a1d25;color:#fff;border:1px solid #333;border-radius:4px;cursor:pointer}
  section.movie .movie-actions button:disabled{opacity:.35;cursor:not-allowed}
  section.movie .movie-actions .keep-selected:not(:disabled):hover{background:#c0392b;border-color:#c0392b}
  section.movie .movie-actions .clear-selection:not(:disabled):hover{background:#333}
  .thumb .del{position:absolute;top:4px;right:4px;width:22px;height:22px;border-radius:50%;background:rgba(0,0,0,.7);color:#fff;font-size:16px;line-height:1;border:1px solid #555;cursor:pointer;opacity:0;transition:opacity .15s,background .15s;display:flex;align-items:center;justify-content:center;padding:0}
  .thumb:hover .del{opacity:1}.thumb .del:hover{background:#c0392b;border-color:#c0392b}
  .thumb.removing img{opacity:.2}@media(max-width:900px){.thumbs{grid-template-columns:repeat(5,1fr)}.thumb .del{opacity:1}}`;

    const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"/>
<title>CineGuess — Frame Gallery (${movies.length} movies)</title>
<style>${css}</style></head><body>
<header class="page">
  <h1>CineGuess — Frame Gallery</h1>
  <p>${movies.length} movies &middot; ${totalImages} images total (${trailerCount} trailer-sourced, ${tmdbCount} TMDB-sourced)</p>
  <input id="filter" placeholder="Filter by title..."/>
</header>
<main>${movies.map(movieSection).join('\n')}</main>
<script src="/frames/gallery.js"></script>
</body></html>`;

    res.send(html);
  } catch (err) {
    res.status(500).send('Gallery error: ' + err.message);
  }
});

// Serve extracted trailer frames (populated by scripts/extractTrailerFrames.js)
// — these are loaded from the frontend's HintModal as `/frames/{id}_n.jpg`.
// helmet's default crossOriginResourcePolicy blocks cross-origin <img> loads,
// so relax it for this static path (the Vite dev proxy also forwards /frames).
app.use(
  '/frames',
  (req, res, next) => {
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    // Gallery HTML needs to load TMDB images — relax img-src for this admin path only.
    res.setHeader('Content-Security-Policy',
      "default-src 'self'; img-src * data: blob:; script-src 'self'; style-src 'self' 'unsafe-inline';"
    );
    next();
  },
  express.static(path.join(__dirname, 'public/frames'), {
    maxAge: '7d',
    immutable: true,
  })
);

// Dev-only frame delete endpoint used by the gallery page.
// Deletes the JPG from disk and removes the path from the movie's
// backdrop_paths array in the DB. Guarded behind NODE_ENV !== 'production'.
if (process.env.NODE_ENV !== 'production') {
  const fs = require('fs');
  const pool = require('./src/db/pool');
  // Generic backdrop remover — works for both TMDB-hosted paths and /frames/
  // entries. Takes { tmdb_id, path } in the JSON body and runs array_remove.
  // Does not touch disk (caller handles local file deletion separately via
  // DELETE /frames/:filename for that case).
  app.delete('/dev/backdrop', express.json(), async (req, res) => {
    try {
      const { tmdb_id, path: backdropPath } = req.body || {};
      if (!tmdb_id || !backdropPath) {
        return res.status(400).json({ error: 'tmdb_id and path required' });
      }
      await pool.query(
        `UPDATE movies
            SET backdrop_paths = array_remove(backdrop_paths, $1),
                updated_at = NOW()
          WHERE tmdb_id = $2`,
        [backdropPath, tmdb_id]
      );
      res.json({ ok: true });
    } catch (err) {
      console.error('backdrop delete error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/frames/:filename', express.json(), async (req, res) => {
    try {
      const filename = req.params.filename;
      // Basic sanitization — only allow the expected `{tmdbId}_{n}.jpg` shape.
      if (!/^\d+_\d+\.jpg$/.test(filename)) {
        return res.status(400).json({ error: 'invalid filename' });
      }
      const tmdbId = parseInt(filename.split('_')[0], 10);
      const webPath = `/frames/${filename}`;
      const diskPath = path.join(__dirname, 'public/frames', filename);

      // Remove from DB first (idempotent)
      await pool.query(
        `UPDATE movies
            SET backdrop_paths = array_remove(backdrop_paths, $1),
                updated_at = NOW()
          WHERE tmdb_id = $2`,
        [webPath, tmdbId]
      );
      // Then from disk
      try { fs.unlinkSync(diskPath); } catch (e) { /* already gone, OK */ }

      res.json({ ok: true });
    } catch (err) {
      console.error('frame delete error:', err);
      res.status(500).json({ error: err.message });
    }
  });
}

// ---------------------------------------------------------------
// Rate limiting
// ---------------------------------------------------------------
// Global catch-all: 200 req / 15 min per IP
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
}));

// Tighter limiters applied per-route (imported into routes/game.js)
// Exported so the route file can import them without a circular dep.
const guessLimiter = rateLimit({
  windowMs: 60 * 1000,        // 1 minute window
  max: 15,                    // 15 guesses / min — generous for humans, blocks bots
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many guesses. Please slow down.' },
});

const poolLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,   // 5 minute window
  max: 10,                    // 10 pool fetches / 5 min — fetched once on page load
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again shortly.' },
});

// Report limiter: 2 reports per hour, keyed by user ID when authenticated
// so a user can't bypass the limit by switching IPs.
const reportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,  // 1-hour window
  max: 2,
  keyGenerator: (req) => req.user?.id || req.ip,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'You can submit at most 2 reports per hour. Thank you for the feedback!' },
});

app.set('guessLimiter',  guessLimiter);
app.set('poolLimiter',   poolLimiter);
app.set('reportLimiter', reportLimiter);

// ---------------------------------------------------------------
// Async route wrapper — any unhandled async throw is forwarded to
// the global error handler instead of crashing the process.
// Usage: router.get('/path', asyncHandler(myAsyncFn))
// ---------------------------------------------------------------
function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}
// Make it available to route files via app.get()
app.set('asyncHandler', asyncHandler);

// ---------------------------------------------------------------
// Routes
// ---------------------------------------------------------------
app.use('/api/game',    require('./src/routes/game'));
app.use('/api/auth',    require('./src/routes/auth'));
app.use('/api/friends', require('./src/routes/friends'));
app.use('/api',         require('./src/routes/status'));   // GET /api/status, POST /api/logs/error

app.get('/health', (_, res) => res.json({ status: 'ok' }));

// ---------------------------------------------------------------
// Global async error handler
// Catches any error thrown (or rejected promise) inside a route
// handler that wasn't caught locally.  Prevents unhandled rejection
// crashes that bring down the whole process.
//
// Also tracks 5xx error rate and emits an [ALARM] log when the rate
// exceeds FIVE_XX_THRESHOLD errors within FIVE_XX_WINDOW_MS.
// In production, route the ALARM log entries to Discord/Slack/PagerDuty
// by filtering log_events WHERE message LIKE '[ALARM]%'.
// ---------------------------------------------------------------
let _5xxCount       = 0;
let _5xxWindowStart = Date.now();
const FIVE_XX_THRESHOLD = 10;           // errors per window before alarm fires
const FIVE_XX_WINDOW_MS = 60 * 1000;   // 1-minute rolling window

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const logger     = require('./src/utils/logger');
  const statusCode = err.status || err.statusCode || 500;
  const is5xx      = statusCode >= 500;

  // Structured log — includes request context and user identity (never secrets).
  logger.error(err.message || 'Unhandled server error', {
    stack: err.stack,
    meta: {
      method:  req.method,
      path:    req.path,
      status:  statusCode,
      user_id: req.user?.id || null,   // safe: UUID, not email/token
    },
  });

  // 5xx rate alarm — rolling window counter.
  if (is5xx) {
    const now = Date.now();
    if (now - _5xxWindowStart > FIVE_XX_WINDOW_MS) {
      _5xxCount       = 0;
      _5xxWindowStart = now;
    }
    _5xxCount++;

    if (_5xxCount >= FIVE_XX_THRESHOLD) {
      logger.error(
        `[ALARM] High 5xx error rate: ${_5xxCount} errors in ${FIVE_XX_WINDOW_MS / 1000}s`,
        { meta: { count: _5xxCount, threshold: FIVE_XX_THRESHOLD, window_ms: FIVE_XX_WINDOW_MS } }
      );
      // Reset counter so we alarm once per burst, not on every subsequent error.
      _5xxCount = 0;
    }
  }

  if (!res.headersSent) {
    // Never leak internal error details to the client.
    const clientMsg = is5xx ? 'Internal server error' : (err.message || 'Request error');
    res.status(statusCode).json({ error: clientMsg });
  }
});

// ---------------------------------------------------------------
// Daily pick cron — midnight America/New_York (Eastern).
// The `{ timezone }` option on the schedule call is what makes '0 0 * * *'
// mean "midnight ET" instead of "midnight UTC". dailyPick.js and
// gameController both key off Eastern dates, so keep all three aligned.
// ---------------------------------------------------------------
cron.schedule('0 0 * * *', async () => {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
  console.log(`[cron] Running daily pick for ${today} (Eastern)`);
  try {
    const { runDailyPick } = require('./src/scripts/dailyPick');
    await runDailyPick(today);
  } catch (err) {
    console.error('[cron] Daily pick error:', err.message);
  }
}, { timezone: 'America/New_York' });

// ---------------------------------------------------------------
// Percentile snapshot cron — every 15 minutes.
// Precomputes streak distributions so /percentiles and
// /friends/:id/percentiles can answer in O(1) instead of running
// expensive CTE queries on every request.
// ---------------------------------------------------------------
cron.schedule('*/15 * * * *', async () => {
  try {
    const { buildPercentileSnapshot } = require('./src/scripts/buildPercentileSnapshot');
    await buildPercentileSnapshot();
  } catch (err) {
    console.error('[cron] Percentile snapshot error:', err.message);
  }
});

// Build one snapshot immediately on startup so the first request is never cold.
(async () => {
  try {
    const { buildPercentileSnapshot } = require('./src/scripts/buildPercentileSnapshot');
    await buildPercentileSnapshot();
  } catch (err) {
    console.error('[startup] Initial percentile snapshot failed:', err.message);
  }
})();

// ---------------------------------------------------------------
// Monthly leaderboard badge cron — runs at 00:05 ET on the 1st of each month.
// Awards badges for the previous month's final standings before any resets.
// ---------------------------------------------------------------
cron.schedule('5 0 1 * *', async () => {
  try {
    const { awardMonthlyBadges } = require('./src/scripts/awardMonthlyBadges');
    // prevMonthStr() is defined inside awardMonthlyBadges.js; pass explicit month here
    const now   = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
    const year  = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
    const month = now.getMonth() === 0 ? 12 : now.getMonth();
    const monthStr = `${year}-${String(month).padStart(2, '0')}`;
    console.log(`[cron] Awarding monthly badges for ${monthStr}`);
    await awardMonthlyBadges(monthStr);
  } catch (err) {
    console.error('[cron] Monthly badge award error:', err.message);
  }
}, { timezone: 'America/New_York' });

// ---------------------------------------------------------------
// Nightly log pruning cron — delete log_events older than 30 days.
// Runs at 02:00 America/New_York to avoid peak hours.
// ---------------------------------------------------------------
cron.schedule('0 2 * * *', async () => {
  try {
    const pool = require('./src/db/pool');
    const { rowCount } = await pool.query(
      `DELETE FROM log_events WHERE created_at < NOW() - INTERVAL '30 days'`
    );
    const logger = require('./src/utils/logger');
    logger.info(`Log pruning complete`, { meta: { deleted_rows: rowCount } });
  } catch (err) {
    console.error('[cron] Log pruning error:', err.message);
  }
}, { timezone: 'America/New_York' });

// ---------------------------------------------------------------
// Start
// ---------------------------------------------------------------
// Run any pending schema migrations before accepting traffic.
// Using IF NOT EXISTS means this is always safe to re-run.
// ---------------------------------------------------------------
async function runStartupMigrations() {
  const pool = require('./src/db/pool');
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS vip_crew (
        user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        friend_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (user_id, friend_id)
      );
      CREATE INDEX IF NOT EXISTS vip_crew_user_idx ON vip_crew(user_id);
    `);
    console.log('[migration] vip_crew table ready');
  } catch (err) {
    console.error('[migration] vip_crew migration failed:', err.message);
  }

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS leaderboard_badges (
        id         BIGSERIAL PRIMARY KEY,
        user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        category   TEXT        NOT NULL,
        rank       SMALLINT    NOT NULL CHECK (rank BETWEEN 1 AND 4),
        month      CHAR(7)     NOT NULL,
        awarded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (user_id, category, month)
      );
      CREATE INDEX IF NOT EXISTS lb_badges_user_idx     ON leaderboard_badges(user_id);
      CREATE INDEX IF NOT EXISTS lb_badges_category_idx ON leaderboard_badges(category, month);
    `);
    console.log('[migration] leaderboard_badges table ready');
  } catch (err) {
    console.error('[migration] leaderboard_badges migration failed:', err.message);
  }
}

// ---------------------------------------------------------------
const PORT = process.env.PORT || 3001;
const server = app.listen(PORT, () => {
  console.log(`CineGuess API listening on port ${PORT}`);
  runStartupMigrations();
});

// Handle port-in-use and other listen errors so nodemon doesn't
// spin in a crash loop when restarting during development.
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[server] Port ${PORT} is already in use — is another instance running?`);
  } else {
    console.error('[server] Listen error:', err.message);
  }
  process.exit(1);
});

// Graceful shutdown — ensures the port is released before nodemon
// spawns the next process, preventing EADDRINUSE on restart.
function shutdown(signal) {
  console.log(`\n[server] ${signal} received — shutting down gracefully`);
  server.close(() => {
    console.log('[server] HTTP server closed');
    process.exit(0);
  });
  // Force exit after 5 s in case of a hung connection
  setTimeout(() => { console.error('[server] Forced exit'); process.exit(1); }, 5000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
