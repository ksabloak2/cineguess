const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * requireAuth — verify Supabase JWT from Authorization header.
 * Sets req.user = { id, email } on success.
 */
async function requireAuth(req, res, next) {
  const token = req.headers.authorization?.split('Bearer ')[1];
  if (!token) return res.status(401).json({ error: 'Missing auth token' });

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  req.user = { id: data.user.id, email: data.user.email };
  next();
}

/**
 * optionalAuth — same as requireAuth but continues as guest if no token.
 */
async function optionalAuth(req, res, next) {
  const token = req.headers.authorization?.split('Bearer ')[1];
  if (!token) {
    req.user = null;
    return next();
  }

  const { data } = await supabase.auth.getUser(token);
  req.user = data?.user ? { id: data.user.id, email: data.user.email } : null;
  next();
}

module.exports = { requireAuth, optionalAuth, supabase };
