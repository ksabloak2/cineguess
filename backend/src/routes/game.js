const router = require('express').Router();
const { optionalAuth, requireAuth } = require('../middleware/auth');
const { bodyValidator, schemas }    = require('../middleware/validate');
const ctrl = require('../controllers/gameController');

// Pull per-route limiters from the Express app instance (set in server.js).
function getLimiter(name) {
  return (req, res, next) => {
    const limiter = req.app.get(name);
    if (limiter) return limiter(req, res, next);
    next();
  };
}

// Wrap async handlers so unhandled rejections reach the global error handler
// instead of crashing the process.
function ah(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

// Public / optional-auth routes
router.get('/movies/:category',       getLimiter('poolLimiter'),  ah(ctrl.getMoviePool));
router.get('/daily/:category',        optionalAuth, ah(ctrl.getDailyState));
router.post('/guess',                 getLimiter('guessLimiter'), optionalAuth, bodyValidator(schemas.guess), ah(ctrl.submitGuess));
router.post('/guess/check',           getLimiter('guessLimiter'), bodyValidator(schemas.guess), ah(ctrl.checkGuess));
router.get('/result/:category',       ah(ctrl.getResult));
router.get('/ratings/:tmdb_id',       ah(ctrl.getRatings));

// Authenticated routes
router.get('/percentiles',            requireAuth, ah(ctrl.getPercentiles));
router.get('/streaks/:category',      requireAuth, ah(ctrl.getStreaks));
router.get('/calendar/:category',     requireAuth, ah(ctrl.getCalendar));
router.get('/calendar-year',          requireAuth, ah(ctrl.getYearCalendar));
router.post('/unlimited/result',      requireAuth, ah(ctrl.submitUnlimitedResult));

module.exports = router;
