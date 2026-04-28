/**
 * logger.js — centralised server-side logging utility.
 *
 * Writes structured log rows to the `log_events` table in a fire-and-forget
 * fashion so logging never adds latency to the request path.  Falls back to
 * console output if the DB write fails so diagnostics are never silently lost.
 *
 * Usage:
 *   const logger = require('../utils/logger');
 *   logger.error('Something broke', { stack: err.stack, meta: { category } });
 *   logger.warn('Slow query', { meta: { duration_ms: 1240, query: 'snapshot' } });
 *   logger.info('Daily pick ran', { meta: { date: today } });
 */

const pool = require('../db/pool');

const IS_PROD = process.env.NODE_ENV === 'production';

// ---------------------------------------------------------------------------
// Internal write — non-blocking (no await at call site)
// ---------------------------------------------------------------------------
async function _write({ level, source = 'server', message, stack, url, browser, meta }) {
  try {
    await pool.query(
      `INSERT INTO log_events (level, source, message, stack, url, browser, meta)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        level,
        source,
        String(message).slice(0, 2000),          // cap message at 2 KB
        stack   ? String(stack).slice(0, 8000) : null,  // cap stack at 8 KB
        url     || null,
        browser || null,
        meta    ? JSON.stringify(meta) : null,
      ]
    );
  } catch (dbErr) {
    // Last-resort fallback: write to console so nothing is silently swallowed.
    console.error('[logger] DB write failed:', dbErr.message);
    console.error('[logger] original event:', { level, message, stack });
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
function error(message, opts = {}) {
  if (!IS_PROD) console.error(`[ERROR] ${message}`, opts.meta || '');
  _write({ level: 'error', message, ...opts });
}

function warn(message, opts = {}) {
  if (!IS_PROD) console.warn(`[WARN]  ${message}`, opts.meta || '');
  _write({ level: 'warn', message, ...opts });
}

function info(message, opts = {}) {
  if (!IS_PROD) console.log(`[INFO]  ${message}`, opts.meta || '');
  _write({ level: 'info', message, ...opts });
}

// ---------------------------------------------------------------------------
// Slow-query timer helper
//
// Usage:
//   const done = logger.startTimer('snapshot');
//   await buildPercentileSnapshot();
//   done();   // logs a warning automatically if > SLOW_THRESHOLD_MS
// ---------------------------------------------------------------------------
const SLOW_THRESHOLD_MS = 1000;

function startTimer(label) {
  const t0 = Date.now();
  return function done(extraMeta = {}) {
    const duration_ms = Date.now() - t0;
    if (duration_ms > SLOW_THRESHOLD_MS) {
      warn(`Slow operation detected: ${label}`, {
        meta: { label, duration_ms, threshold_ms: SLOW_THRESHOLD_MS, ...extraMeta },
      });
    }
    return duration_ms;
  };
}

module.exports = { error, warn, info, startTimer };
