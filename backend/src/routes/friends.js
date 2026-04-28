const router = require('express').Router();
const { requireAuth } = require('../middleware/auth');
const { bodyValidator, schemas } = require('../middleware/validate');
const ctrl = require('../controllers/friendsController');

function ah(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

// Static GET routes first (before /:friend_id wildcard)
router.get('/',               requireAuth, ah(ctrl.listFriends));
router.get('/requests',       requireAuth, ah(ctrl.listRequests));
router.get('/sent-requests',  requireAuth, ah(ctrl.getSentRequests));

// Static POST routes — validated before hitting controller logic
router.post('/request',  requireAuth, bodyValidator(schemas.friendRequest),  ah(ctrl.sendRequest));
router.post('/accept',   requireAuth, bodyValidator(schemas.friendRespond),  ah(ctrl.acceptRequest));
router.post('/decline',  requireAuth, bodyValidator(schemas.friendRespond),  ah(ctrl.declineRequest));

// Dynamic GET routes (must come after /requests and /sent-requests)
router.get('/:friend_id/calendar-year',  requireAuth, ah(ctrl.getFriendYearCalendar));
router.get('/:friend_id/percentiles',    requireAuth, ah(ctrl.getFriendPercentiles));

// DELETE — /cancel/:receiver_id before /:friend_id to avoid collision
router.delete('/cancel/:receiver_id', requireAuth, ah(ctrl.cancelSentRequest));
router.delete('/:friend_id',          requireAuth, ah(ctrl.unfriend));

module.exports = router;
