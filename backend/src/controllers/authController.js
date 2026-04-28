const pool = require('../db/pool');
const { supabase } = require('../middleware/auth');
const { createClient } = require('@supabase/supabase-js');

// Admin client needed to delete users from Supabase Auth
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// POST /api/auth/register  — create user profile after Supabase signup
async function registerProfile(req, res) {
  const { username } = req.body;
  if (!username || username.trim().length < 2) {
    return res.status(400).json({ error: 'Username must be at least 2 characters' });
  }
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    return res.status(400).json({ error: 'Username may only contain letters, numbers, and underscores' });
  }

  const client = await pool.connect();
  try {
    // Check uniqueness
    const { rows: existing } = await client.query(
      'SELECT id FROM users WHERE username = $1',
      [username.trim()]
    );
    if (existing.length) {
      return res.status(409).json({ error: 'Username already taken' });
    }

    await client.query(
      `INSERT INTO users (id, username, email) VALUES ($1, $2, $3)
       ON CONFLICT (id) DO UPDATE SET username = EXCLUDED.username`,
      [req.user.id, username.trim(), req.user.email]
    );

    res.json({ id: req.user.id, username: username.trim(), email: req.user.email });
  } finally {
    client.release();
  }
}

// GET /api/auth/profile
async function getProfile(req, res) {
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      'SELECT id, username, email, created_at FROM users WHERE id = $1',
      [req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Profile not found' });
    res.json(rows[0]);
  } finally {
    client.release();
  }
}

// GET /api/auth/search?q=username
async function searchUsers(req, res) {
  const q = req.query.q?.trim();
  if (!q || q.length < 2) return res.json([]);

  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `SELECT id, username FROM users
       WHERE username ILIKE $1 AND id != $2
       LIMIT 10`,
      [`${q}%`, req.user.id]
    );
    res.json(rows);
  } finally {
    client.release();
  }
}

// POST /api/auth/check-email  — unauthenticated; used by the forgot-password
// flow to verify an account exists before calling Supabase's reset function.
// Returns { exists: true } or { exists: false } — never throws 404 so the
// client can distinguish "not found" from a network failure.
async function checkEmail(req, res) {
  const { email } = req.body;
  if (!email || typeof email !== 'string') {
    return res.status(400).json({ error: 'email required' });
  }

  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      'SELECT 1 FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1',
      [email.trim()]
    );
    res.json({ exists: rows.length > 0 });
  } finally {
    client.release();
  }
}

// POST /api/auth/lookup  — unauthenticated; given an email OR username, returns
// the canonical email address so the client can call Supabase signInWithPassword.
// Returns { email } or 404 { error }.
async function lookupEmail(req, res) {
  const { login } = req.body;
  if (!login || typeof login !== 'string') {
    return res.status(400).json({ error: 'login required' });
  }

  const normalized = login.trim();
  const client = await pool.connect();
  try {
    let rows;
    if (normalized.includes('@')) {
      // Treat as email
      ({ rows } = await client.query(
        'SELECT email FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1',
        [normalized]
      ));
    } else {
      // Treat as username
      ({ rows } = await client.query(
        'SELECT email FROM users WHERE LOWER(username) = LOWER($1) LIMIT 1',
        [normalized]
      ));
    }
    if (!rows.length) return res.status(404).json({ error: 'No account found.' });
    res.json({ email: rows[0].email });
  } finally {
    client.release();
  }
}

// PATCH /api/auth/username — update the signed-in user's username
async function updateUsername(req, res) {
  const { username } = req.body;
  if (!username || username.trim().length < 2) {
    return res.status(400).json({ error: 'Username must be at least 2 characters' });
  }
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    return res.status(400).json({ error: 'Username may only contain letters, numbers, and underscores' });
  }
  if (username.trim().length > 30) {
    return res.status(400).json({ error: 'Username must be 30 characters or fewer' });
  }

  const client = await pool.connect();
  try {
    // Check uniqueness (exclude current user)
    const { rows: existing } = await client.query(
      'SELECT id FROM users WHERE username = $1 AND id != $2',
      [username.trim(), req.user.id]
    );
    if (existing.length) {
      return res.status(409).json({ error: 'Username already taken' });
    }

    // UPSERT — handles the case where the user confirmed their email but
    // closed the browser before completing the username step, leaving them
    // with a valid Supabase session but no row in the users table.
    const { rows } = await client.query(
      `INSERT INTO users (id, username, email)
       VALUES ($1, $2, $3)
       ON CONFLICT (id) DO UPDATE SET username = EXCLUDED.username
       RETURNING id, username, email`,
      [req.user.id, username.trim(), req.user.email]
    );
    res.json(rows[0]);
  } finally {
    client.release();
  }
}

// DELETE /api/auth/account — permanently delete account and all associated data
async function deleteAccount(req, res) {
  const userId = req.user.id;
  const client = await pool.connect();
  try {
    // Delete user row — FK cascades should handle streaks, guesses, friends, etc.
    await client.query('DELETE FROM users WHERE id = $1', [userId]);

    // Remove from Supabase Auth (requires service-role key)
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (error) {
      console.error('Supabase auth delete error:', error);
      // Don't surface internal details — the DB row is already gone
      return res.status(500).json({ error: 'Account data removed but auth cleanup failed. Contact support.' });
    }

    res.json({ message: 'Account deleted.' });
  } catch (err) {
    console.error('deleteAccount error:', err);
    res.status(500).json({ error: 'Could not delete account. Please try again.' });
  } finally {
    client.release();
  }
}

module.exports = { registerProfile, getProfile, searchUsers, checkEmail, lookupEmail, updateUsername, deleteAccount };
