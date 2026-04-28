/**
 * validate.js — lightweight request validation + XSS sanitization middleware.
 *
 * No external schema library is required. Each schema is a plain object map of
 * field → rules. The `bodyValidator(schema)` factory returns an Express
 * middleware that:
 *   1. Rejects non-object bodies immediately (400).
 *   2. Sanitizes every string value in req.body (strips tags / event handlers).
 *   3. Validates each field against its rules; short-circuits on first failure.
 *
 * Usage:
 *   const { bodyValidator, schemas } = require('../middleware/validate');
 *   router.post('/guess', bodyValidator(schemas.guess), ah(ctrl.submitGuess));
 */

'use strict';

// ---------------------------------------------------------------------------
// XSS sanitizer
// Strips HTML tags, javascript: URIs, and inline event handler attributes so
// that user-supplied strings are safe to store and later render.
// ---------------------------------------------------------------------------
function sanitizeString(str) {
  if (typeof str !== 'string') return str;
  return str
    .replace(/<[^>]*>/g, '')           // strip ALL HTML/XML tags
    .replace(/javascript\s*:/gi, '')   // strip javascript: URIs
    .replace(/on\w+\s*=\s*["']?[^"'>]*/gi, '') // strip onerror=, onclick=, etc.
    .trim()
    .slice(0, 4000);                   // hard length cap — never store unbounded input
}

// ---------------------------------------------------------------------------
// Core field validator
// Returns { valid: true } or { valid: false, error: '<human message>' }
// ---------------------------------------------------------------------------
function validateField(field, value, rules) {
  const missing = value === undefined || value === null || value === '';

  if (rules.required && missing) {
    return { valid: false, error: `${field} is required` };
  }
  if (missing) return { valid: true }; // optional field, nothing more to check

  if (rules.type && typeof value !== rules.type) {
    return { valid: false, error: `${field} must be a ${rules.type}` };
  }
  if (rules.enum && !rules.enum.includes(value)) {
    return { valid: false, error: `${field} must be one of: ${rules.enum.join(', ')}` };
  }
  if (rules.min !== undefined && value < rules.min) {
    return { valid: false, error: `${field} must be ≥ ${rules.min}` };
  }
  if (rules.max !== undefined && value > rules.max) {
    return { valid: false, error: `${field} must be ≤ ${rules.max}` };
  }
  if (rules.minLength !== undefined && String(value).length < rules.minLength) {
    return { valid: false, error: `${field} must be at least ${rules.minLength} characters` };
  }
  if (rules.maxLength !== undefined && String(value).length > rules.maxLength) {
    return { valid: false, error: `${field} must be at most ${rules.maxLength} characters` };
  }
  if (rules.pattern && !rules.pattern.test(String(value))) {
    return { valid: false, error: `${field} has an invalid format` };
  }
  return { valid: true };
}

// ---------------------------------------------------------------------------
// Middleware factory
// ---------------------------------------------------------------------------
function bodyValidator(schema) {
  return function validateBody(req, res, next) {
    // Guard: body must be a plain object (express.json() guarantees this if
    // Content-Type is application/json, but be explicit for belt-and-suspenders).
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
      return res.status(400).json({ error: 'Request body must be a JSON object' });
    }

    // 1. Sanitize all string values in the body (in-place, before validation).
    for (const key of Object.keys(req.body)) {
      if (typeof req.body[key] === 'string') {
        req.body[key] = sanitizeString(req.body[key]);
      }
    }

    // 2. Validate each declared field.
    for (const [field, rules] of Object.entries(schema)) {
      const result = validateField(field, req.body[field], rules);
      if (!result.valid) {
        return res.status(400).json({ error: result.error });
      }
    }

    next();
  };
}

// ---------------------------------------------------------------------------
// Schemas — one entry per validated endpoint
// ---------------------------------------------------------------------------
const VALID_DAILY_CATEGORIES    = ['top250', 'superhero', 'animated', 'indiancinema'];
const VALID_ALL_CATEGORIES      = [...VALID_DAILY_CATEGORIES, 'unlimited'];
const UUID_PATTERN              = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const USERNAME_PATTERN          = /^[a-zA-Z0-9_.-]+$/;

const schemas = {
  // POST /api/game/guess
  guess: {
    category:     { required: true,  type: 'string', enum: VALID_ALL_CATEGORIES },
    tmdb_id:      { required: true,  type: 'number', min: 1, max: 9_999_999 },
    guess_number: { required: false, type: 'number', min: 1, max: 7 },
  },

  // POST /api/friends/request
  friendRequest: {
    receiver_username: {
      required: true,
      type: 'string',
      minLength: 2,
      maxLength: 30,
      pattern: USERNAME_PATTERN,
    },
  },

  // POST /api/friends/accept  |  POST /api/friends/decline
  friendRespond: {
    requester_id: {
      required: true,
      type: 'string',
      pattern: UUID_PATTERN,
    },
  },

  // POST /api/logs/error  (client-side error reports)
  logError: {
    message: { required: true,  type: 'string', maxLength: 2000 },
    stack:   { required: false, type: 'string', maxLength: 8000 },
    url:     { required: false, type: 'string', maxLength: 500  },
    browser: { required: false, type: 'string', maxLength: 500  },
  },

  // PATCH /api/auth/username
  updateUsername: {
    username: {
      required: true,
      type: 'string',
      minLength: 2,
      maxLength: 30,
      pattern: USERNAME_PATTERN,
    },
  },

  // POST /api/report-issue
  reportIssue: {
    category: {
      required: true,
      type: 'string',
      enum: [
        'movie_description',
        'movie_frame',
        'actor_credit',
        'game_logic',
        'other',
      ],
    },
    description: { required: false, type: 'string', maxLength: 200 },
    movie_id:    { required: false, type: 'number', min: 1, max: 9_999_999 },
  },
};

module.exports = { bodyValidator, schemas, sanitizeString };
