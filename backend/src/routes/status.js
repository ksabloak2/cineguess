/**
 * status.js — lightweight operational routes.
 *
 * GET  /api/status        — returns { maintenance: bool }, cached 30 s in memory.
 * POST /api/logs/error    — receives client-side error reports and writes them
 *                           to log_events.  No auth required (errors happen before login).
 *                           Rate-limited by the global limiter in server.js.
 */

const router = require('express').Router();
const pool   = require('../db/pool');
const logger = require('../utils/logger');
const { bodyValidator, schemas } = require('../middleware/validate');
const { optionalAuth } = require('../middleware/auth');

// Pulls a named rate-limiter that was registered on the app in server.js.
function getLimiter(name) {
  return (req, res, next) => req.app.get(name)(req, res, next);
}

// ---------------------------------------------------------------------------
// In-memory maintenance-mode cache (avoids a DB hit on every page load).
// Invalidated after 30 seconds so toggling maintenance_mode takes effect fast.
// ---------------------------------------------------------------------------
let _maintenanceCache = { value: false, expiresAt: 0 };

async function getMaintenanceMode() {
  const now = Date.now();
  if (now < _maintenanceCache.expiresAt) return _maintenanceCache.value;

  try {
    const { rows } = await pool.query(
      `SELECT value FROM app_settings WHERE key = 'maintenance_mode' LIMIT 1`
    );
    const value = rows[0]?.value === 'true';
    _maintenanceCache = { value, expiresAt: now + 30_000 };
    return value;
  } catch {
    // If the DB is unreachable, don't accidentally lock everyone out.
    return false;
  }
}

// Expose a manual bust so server.js can reset it on startup.
function bustMaintenanceCache() {
  _maintenanceCache = { value: false, expiresAt: 0 };
}

// ---------------------------------------------------------------------------
// GET /api/status
// Called once on app load (and again if the page stays open).
// Deliberately minimal — no auth, no DB logging, fast path only.
// ---------------------------------------------------------------------------
router.get('/status', async (req, res) => {
  const maintenance = await getMaintenanceMode();
  // Short cache header so CDN/browser don't hammer this endpoint.
  res.setHeader('Cache-Control', 'public, max-age=20');
  res.json({ maintenance, ok: !maintenance });
});

// ---------------------------------------------------------------------------
// POST /api/logs/error
// Body: { message, stack, url, browser }
// Accepts client-side errors from the Logger utility in the frontend.
// ---------------------------------------------------------------------------
router.post('/logs/error', bodyValidator(schemas.logError), async (req, res) => {
  const { message, stack, url, browser } = req.body || {};

  if (!message) return res.status(400).json({ error: 'message required' });

  // Fire-and-forget — client doesn't need to wait for the DB write.
  logger.error(message, {
    source:  'client',
    stack:   stack  || null,
    url:     url    || req.get('Referer') || null,
    browser: browser || req.get('User-Agent') || null,
  });

  // Always respond 204 — even if logging fails internally, don't error the client.
  res.status(204).end();
});

// ---------------------------------------------------------------------------
// POST /api/report-issue
// Accepts a user-submitted issue report and writes it to log_events with
// level = 'USER_REPORT'.  Rate-limited to 2 per hour per user (or IP).
// ---------------------------------------------------------------------------
const CATEGORY_LABELS = {
  movie_description: 'Movie Description is wrong/too obvious',
  movie_frame:       'Movie Frame is incorrect/low quality',
  actor_credit:      'Actor/Credit information is wrong',
  game_logic:        'Game Logic/Bug',
  other:             'Other',
};

router.post(
  '/report-issue',
  getLimiter('reportLimiter'),
  optionalAuth,
  bodyValidator(schemas.reportIssue),
  async (req, res) => {
    const { category, description, movie_id } = req.body;
    const user_id  = req.user?.id || null;
    const ua       = req.get('User-Agent')?.slice(0, 500) || null;
    const label    = CATEGORY_LABELS[category] || category;

    // Fire-and-forget — same pattern as logger.js
    pool.query(
      `INSERT INTO log_events (level, source, message, browser, meta)
       VALUES ('USER_REPORT', 'client', $1, $2, $3)`,
      [
        `User report: ${label}`,
        ua,
        JSON.stringify({
          category,
          label,
          description: description?.trim() || null,
          movie_id:    movie_id || null,
          user_id,
          reported_at: new Date().toISOString(),
        }),
      ]
    ).catch((err) => {
      console.error('[report-issue] DB write failed:', err.message);
    });

    res.status(204).end();
  }
);

module.exports = router;
module.exports.bustMaintenanceCache = bustMaintenanceCache;
module.exports.getMaintenanceMode   = getMaintenanceMode;
