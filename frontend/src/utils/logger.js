/**
 * logger.js — centralised client-side error reporting.
 *
 * In development: writes to the browser console so DevTools stays useful.
 * In production:  POSTs critical errors to /api/logs/error (fire-and-forget)
 *                 so stack traces land in the database instead of disappearing.
 *
 * Usage:
 *   import logger from '../utils/logger';
 *   logger.error(err, { context: 'GamePage handleGuess' });
 *   logger.warn('Slow fetch', { context: 'getMoviePool', duration_ms: 1400 });
 */

const IS_PROD = import.meta.env.PROD;
const ENDPOINT = '/api/logs/error';

// Deduplicate rapidly repeating errors (e.g. render-loop crashes) —
// don't flood the DB with the same stack trace every frame.
const _seen = new Set();
const DEDUP_TTL_MS = 30_000;

function _dedupKey(message) {
  // Use first 120 chars of the message as the dedup key.
  return String(message).slice(0, 120);
}

function _send(message, stack) {
  const key = _dedupKey(message);
  if (_seen.has(key)) return;
  _seen.add(key);
  setTimeout(() => _seen.delete(key), DEDUP_TTL_MS);

  try {
    navigator.sendBeacon(
      ENDPOINT,
      new Blob(
        [JSON.stringify({
          message: String(message).slice(0, 2000),
          stack:   stack ? String(stack).slice(0, 8000) : undefined,
          url:     window.location.href,
          browser: navigator.userAgent,
        })],
        { type: 'application/json' }
      )
    );
  } catch {
    // sendBeacon not available (very old browser) — fall back to fetch, best-effort.
    fetch(ENDPOINT, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        message: String(message).slice(0, 2000),
        stack:   stack ? String(stack).slice(0, 8000) : undefined,
        url:     window.location.href,
        browser: navigator.userAgent,
      }),
      // keepalive lets the request outlive the page if the user navigates away.
      keepalive: true,
    }).catch(() => {});
  }
}

/**
 * Log an Error object or message string.
 * Always captures and persists in production.
 */
function error(errOrMessage, context = {}) {
  const isError = errOrMessage instanceof Error;
  const message = isError ? errOrMessage.message : String(errOrMessage);
  const stack   = isError ? errOrMessage.stack   : context.stack;
  const label   = context.context ? `[${context.context}] ${message}` : message;

  if (!IS_PROD) {
    console.error('[Logger]', label, isError ? errOrMessage : '', context);
    return;
  }

  _send(label, stack);
}

/**
 * Log a non-fatal warning. Persisted in production but tagged 'warn'.
 * (Reuses the same /api/logs/error endpoint — the backend infers level from the prefix.)
 */
function warn(message, context = {}) {
  const label = `[WARN] ${context.context ? `[${context.context}] ` : ''}${message}`;

  if (!IS_PROD) {
    console.warn('[Logger]', label, context);
    return;
  }

  _send(label, context.stack);
}

export default { error, warn };
