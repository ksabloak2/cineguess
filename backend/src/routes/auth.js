const router = require('express').Router();
const { requireAuth } = require('../middleware/auth');
const { bodyValidator, schemas } = require('../middleware/validate');
const ctrl = require('../controllers/authController');

function ah(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

router.post('/check-email', ah(ctrl.checkEmail));           // public — no auth required
router.post('/lookup',      ah(ctrl.lookupEmail));           // public — resolve username → email
router.post('/register',    requireAuth, ah(ctrl.registerProfile));
router.get('/profile',      requireAuth, ah(ctrl.getProfile));
router.get('/search',       requireAuth, ah(ctrl.searchUsers));
router.patch('/username',   requireAuth, bodyValidator(schemas.updateUsername), ah(ctrl.updateUsername));

module.exports = router;
