require('dotenv').config();
const path       = require('path');
const express    = require('express');
const cors       = require('cors');
const helmet     = require('helmet');
const rateLimit  = require('express-rate-limit');
const cron       = require('node-cron');

const app = express();

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
  process.env.FRONTEND_URL,       // e.g. https://cineguess.vercel.app
  'http://localhost:5173',        // Vite dev server
  'http://localhost:4173',        // Vite preview
].filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    // Requests with no Origin (server-to-server, curl, health checks) pass through.
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    // Reject anything else with a proper CORS error (not a 500).
    callback(Object.assign(new Error(`CORS: origin not allowed — ${origin}`), { status: 403 }));
  },
  credentials: true,
}));
app.use(express.json());

// Serve extracted trailer frames (populated by scripts/extractTrailerFrames.js)
// — these are loaded from the frontend's HintModal as `/frames/{id}_n.jpg`.
// helmet's default crossOriginResourcePolicy blocks cross-origin <img> loads,
// so relax it for this static path (the Vite dev proxy also forwards /frames).
app.use(
  '/frames',
  (req, res, next) => {
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
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
const PORT = process.env.PORT || 3001;
const server = app.listen(PORT, () => {
  console.log(`CineGuess API listening on port ${PORT}`);
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
