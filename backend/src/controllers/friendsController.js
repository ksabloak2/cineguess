const pool = require('../db/pool');

const VALID_CATEGORIES = ['top250', 'superhero', 'animated', 'indiancinema', 'unlimited'];

// POST /api/friends/request  body: { receiver_username }
async function sendRequest(req, res) {
  const { receiver_username } = req.body;
  if (!receiver_username) return res.status(400).json({ error: 'receiver_username required' });

  const client = await pool.connect();
  try {
    // Ensure the requester has a profile row — a valid Supabase session does
    // not guarantee one exists (user may not have completed username setup).
    const { rows: requesterRows } = await client.query(
      'SELECT id FROM users WHERE id = $1',
      [req.user.id]
    );
    if (!requesterRows.length) {
      return res.status(403).json({ error: 'Please set a username before adding friends.' });
    }

    const { rows } = await client.query(
      'SELECT id FROM users WHERE username = $1',
      [receiver_username]
    );
    if (!rows.length) return res.status(404).json({ error: 'User not found' });

    const receiverId = rows[0].id;
    if (receiverId === req.user.id) {
      return res.status(400).json({ error: 'Cannot friend yourself' });
    }

    await client.query(
      `INSERT INTO friends (requester_id, receiver_id, status)
       VALUES ($1, $2, 'pending')
       ON CONFLICT (requester_id, receiver_id) DO NOTHING`,
      [req.user.id, receiverId]
    );
    res.json({ message: 'Friend request sent' });
  } catch (err) {
    console.error('sendRequest error:', err);
    res.status(500).json({ error: 'Could not send friend request. Please try again.' });
  } finally {
    client.release();
  }
}

// POST /api/friends/accept  body: { requester_id }
async function acceptRequest(req, res) {
  const { requester_id } = req.body;
  if (!requester_id) return res.status(400).json({ error: 'requester_id required' });

  const client = await pool.connect();
  try {
    const { rowCount } = await client.query(
      `UPDATE friends SET status = 'accepted'
       WHERE requester_id = $1 AND receiver_id = $2 AND status = 'pending'`,
      [requester_id, req.user.id]
    );
    if (!rowCount) return res.status(404).json({ error: 'No pending request found' });
    res.json({ message: 'Friend request accepted' });
  } finally {
    client.release();
  }
}

// POST /api/friends/decline  body: { requester_id }
// Deletes a pending incoming request so the sender can try again later.
async function declineRequest(req, res) {
  const { requester_id } = req.body;
  if (!requester_id) return res.status(400).json({ error: 'requester_id required' });

  const client = await pool.connect();
  try {
    const { rowCount } = await client.query(
      `DELETE FROM friends
       WHERE requester_id = $1 AND receiver_id = $2 AND status = 'pending'`,
      [requester_id, req.user.id]
    );
    if (!rowCount) return res.status(404).json({ error: 'No pending request found' });
    res.json({ message: 'Friend request declined' });
  } finally {
    client.release();
  }
}

// DELETE /api/friends/:friend_id
// Removes an accepted friendship in either direction.
async function unfriend(req, res) {
  const { friend_id } = req.params;
  if (!friend_id) return res.status(400).json({ error: 'friend_id required' });
  if (friend_id === req.user.id) return res.status(400).json({ error: 'Cannot unfriend yourself' });

  const client = await pool.connect();
  try {
    const { rowCount } = await client.query(
      `DELETE FROM friends
       WHERE status = 'accepted'
         AND (
           (requester_id = $1 AND receiver_id = $2)
           OR
           (requester_id = $2 AND receiver_id = $1)
         )`,
      [req.user.id, friend_id]
    );
    if (!rowCount) return res.status(404).json({ error: 'Friendship not found' });
    res.json({ message: 'Friend removed' });
  } finally {
    client.release();
  }
}

// GET /api/friends  — list accepted friends with today's game stats
async function listFriends(req, res) {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
  const client = await pool.connect();

  try {
    // Get accepted friends (in either direction)
    const { rows: friendRows } = await client.query(
      `SELECT
         CASE WHEN f.requester_id = $1 THEN f.receiver_id ELSE f.requester_id END AS friend_id
       FROM friends f
       WHERE (f.requester_id = $1 OR f.receiver_id = $1) AND f.status = 'accepted'`,
      [req.user.id]
    );

    if (!friendRows.length) return res.json([]);

    const friendIds = friendRows.map((r) => r.friend_id);

    // Fetch friend profiles
    const { rows: profiles } = await client.query(
      `SELECT id, username FROM users WHERE id = ANY($1::uuid[])`,
      [friendIds]
    );

    // Fetch today's guesses for all friends across all categories
    const { rows: guessRows } = await client.query(
      `SELECT user_id, category, guesses_taken, won
       FROM guesses
       WHERE user_id = ANY($1::uuid[]) AND guess_date = $2`,
      [friendIds, today]
    );

    // Fetch streaks for all friends (include longest_streak for flame-collection display)
    const { rows: streakRows } = await client.query(
      `SELECT user_id, category, current_streak, longest_streak
       FROM streaks
       WHERE user_id = ANY($1::uuid[])`,
      [friendIds]
    );

    // Fetch avg guesses (won daily games only) for all friends
    const { rows: avgRows } = await client.query(
      `SELECT user_id, category,
              ROUND(AVG(guesses_taken)::numeric, 1) AS avg_guesses
       FROM guesses
       WHERE user_id = ANY($1::uuid[]) AND won = true
       GROUP BY user_id, category`,
      [friendIds]
    );

    // Which categories has the requesting user already finished today?
    const { rows: myTodayRows } = await client.query(
      `SELECT category FROM guesses
       WHERE user_id = $1 AND guess_date = $2 AND won IS NOT NULL`,
      [req.user.id, today]
    );
    const myCompletedToday = new Set(myTodayRows.map((r) => r.category));

    const guessByUser  = {};
    const streakByUser = {};
    const avgByUser    = {};

    for (const g of guessRows) {
      if (!guessByUser[g.user_id]) guessByUser[g.user_id] = {};
      // Only expose a friend's today result if the viewer has finished that category
      if (myCompletedToday.has(g.category)) {
        guessByUser[g.user_id][g.category] = { guesses_taken: g.guesses_taken, won: g.won };
      }
    }

    const bestByUser = {};
    for (const s of streakRows) {
      if (!streakByUser[s.user_id]) streakByUser[s.user_id] = {};
      if (!bestByUser[s.user_id])   bestByUser[s.user_id]   = {};
      streakByUser[s.user_id][s.category] = s.current_streak;
      bestByUser[s.user_id][s.category]   = s.longest_streak || s.current_streak || 0;
    }

    for (const a of avgRows) {
      if (!avgByUser[a.user_id]) avgByUser[a.user_id] = {};
      avgByUser[a.user_id][a.category] = a.avg_guesses !== null ? parseFloat(a.avg_guesses) : null;
    }

    // Fetch the requesting user's VIP crew
    const { rows: vipRows } = await client.query(
      `SELECT friend_id FROM vip_crew WHERE user_id = $1`,
      [req.user.id]
    );
    const vipSet = new Set(vipRows.map((r) => r.friend_id));

    const result = profiles.map((p) => ({
      id: p.id,
      username: p.username,
      today: guessByUser[p.id] || {},
      streaks: streakByUser[p.id] || {},
      bestStreaks: bestByUser[p.id] || {},
      avgGuesses: avgByUser[p.id] || {},
      is_vip: vipSet.has(p.id),
    }));

    res.json(result);
  } finally {
    client.release();
  }
}

// POST /api/friends/vip/:friend_id — add a friend to VIP crew
async function addVip(req, res) {
  const { friend_id } = req.params;
  try {
    await pool.query(
      `INSERT INTO vip_crew (user_id, friend_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [req.user.id, friend_id]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('[addVip error]', err.message);
    res.status(500).json({ error: err.message });
  }
}

// DELETE /api/friends/vip/:friend_id — remove a friend from VIP crew
async function removeVip(req, res) {
  try {
    await pool.query(
      `DELETE FROM vip_crew WHERE user_id = $1 AND friend_id = $2`,
      [req.user.id, req.params.friend_id]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('[removeVip error]', err.message);
    res.status(500).json({ error: err.message });
  }
}

// GET /api/friends/requests  — pending incoming requests
async function listRequests(req, res) {
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `SELECT f.requester_id, u.username, f.created_at
       FROM friends f
       JOIN users u ON u.id = f.requester_id
       WHERE f.receiver_id = $1 AND f.status = 'pending'
       ORDER BY f.created_at DESC`,
      [req.user.id]
    );
    res.json(rows);
  } finally {
    client.release();
  }
}

// GET /api/friends/:friend_id/calendar-year?year=YYYY
async function getFriendYearCalendar(req, res) {
  const { friend_id } = req.params;
  const year = parseInt(req.query.year, 10) || new Date().getFullYear();
  if (year < 2000 || year > 2100) {
    return res.status(400).json({ error: 'Invalid year' });
  }

  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });

  const client = await pool.connect();
  try {
    // Verify friendship
    const { rows: friendshipRows } = await client.query(
      `SELECT 1 FROM friends
       WHERE status = 'accepted'
         AND (
           (requester_id = $1 AND receiver_id = $2)
           OR
           (requester_id = $2 AND receiver_id = $1)
         )`,
      [req.user.id, friend_id]
    );
    if (!friendshipRows.length) {
      return res.status(403).json({ error: 'Not friends with this user' });
    }

    // Which categories has the requesting user already completed today?
    const { rows: myTodayRows } = await client.query(
      `SELECT category FROM guesses
       WHERE user_id = $1 AND guess_date = $2 AND won IS NOT NULL`,
      [req.user.id, today]
    );
    const myCompletedToday = new Set(myTodayRows.map((r) => r.category));

    const { rows } = await client.query(
      `SELECT g.guess_date, g.category, g.won, g.guesses_taken,
              m.title AS movie_title, m.year AS movie_year
       FROM guesses g
       LEFT JOIN daily_picks dp
         ON dp.category = g.category AND dp.pick_date = g.guess_date
       LEFT JOIN movies m ON m.id = dp.movie_id
       WHERE g.user_id = $1
         AND g.category != 'unlimited'
         AND g.guess_date >= $2::date
         AND g.guess_date <  $3::date
       ORDER BY g.guess_date ASC`,
      [friend_id, `${year}-01-01`, `${year + 1}-01-01`]
    );

    // Hide today's results for categories the viewer hasn't finished yet
    const filtered = rows.filter((row) => {
      const rowDate = typeof row.guess_date === 'string'
        ? row.guess_date.slice(0, 10)
        : new Date(row.guess_date).toLocaleDateString('en-CA', { timeZone: 'America/New_York' });

      if (rowDate === today) {
        return myCompletedToday.has(row.category);
      }
      return true; // past dates are always visible
    });

    res.json(filtered);
  } finally {
    client.release();
  }
}

// GET /api/friends/sent-requests
// Pending requests sent by the current user that haven't been accepted yet.
async function getSentRequests(req, res) {
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `SELECT f.receiver_id, u.username, f.created_at
       FROM friends f
       JOIN users u ON u.id = f.receiver_id
       WHERE f.requester_id = $1 AND f.status = 'pending'
       ORDER BY f.created_at DESC`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    console.error('getSentRequests:', err.message);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
}

// GET /api/friends/:friend_id/percentiles
// Returns per-category percentile strings for a friend (same snapshot as getPercentiles
// but targets the friend's user_id instead of req.user.id).
const FRIEND_STREAK_CATEGORIES = [
  'top250', 'superhero', 'animated', 'indiancinema',
  'unlimited_top250', 'unlimited_superhero', 'unlimited_animated', 'unlimited_indiancinema',
];
const FRIEND_DAILY_CATS = ['top250', 'superhero', 'animated', 'indiancinema'];

async function getFriendPercentiles(req, res) {
  const { friend_id } = req.params;

  const client = await pool.connect();
  try {
    // Verify they are actually friends
    const { rows: friendship } = await client.query(
      `SELECT 1 FROM friends
       WHERE status = 'accepted'
         AND (
           (requester_id = $1 AND receiver_id = $2)
           OR (requester_id = $2 AND receiver_id = $1)
         )`,
      [req.user.id, friend_id]
    );
    if (!friendship.length) {
      return res.status(403).json({ error: 'Not friends with this user' });
    }

    // Fetch the latest pre-computed snapshot (same one used by getPercentiles).
    const { rows: snapRows } = await client.query(
      `SELECT data FROM percentile_snapshots ORDER BY computed_at DESC LIMIT 1`
    );
    const snapshot = snapRows[0]?.data || {};

    // Fetch the friend's streaks for all categories in one query.
    const { rows: streakRows } = await client.query(
      `SELECT category, current_streak
       FROM streaks
       WHERE user_id = $1 AND category = ANY($2::text[])`,
      [friend_id, FRIEND_STREAK_CATEGORIES]
    );
    const friendStreaks = {};
    for (const r of streakRows) {
      friendStreaks[r.category] = Number(r.current_streak) || 0;
    }

    // Fetch the friend's per-category avg_guesses (daily categories only) for tiebreaking.
    const { rows: avgRows } = await client.query(
      `SELECT category, ROUND(AVG(guesses_taken)::numeric, 1) AS avg_guesses
       FROM guesses
       WHERE user_id = $1 AND won = true AND category = ANY($2::text[])
       GROUP BY category`,
      [friend_id, FRIEND_DAILY_CATS]
    );
    const friendAvg = {};
    for (const r of avgRows) {
      friendAvg[r.category] = Number(r.avg_guesses);
    }

    // Compute percentile from snapshot distribution.
    // Ranking rule: higher streak wins; ties broken by lower avg_guesses (better).
    const result = {};
    for (const cat of FRIEND_STREAK_CATEGORIES) {
      const userStreak = friendStreaks[cat] || 0;
      if (userStreak === 0) {
        result[cat] = null;
        continue;
      }
      const catSnap = snapshot[cat];
      if (!catSnap || catSnap.total === 0) {
        result[cat] = null;
        continue;
      }
      let higher = 0;
      for (const [s, distAvg, cnt] of catSnap.dist) {
        if (s > userStreak) {
          higher += cnt;
        } else if (
          s === userStreak &&
          distAvg !== null &&
          friendAvg[cat] !== undefined &&
          distAvg < friendAvg[cat]
        ) {
          higher += cnt;
        }
      }
      const pct = Math.max(1, Math.ceil((higher / catSnap.total) * 100));
      result[cat] = { label: `Top ${pct}% Globally`, pct };
    }

    res.json(result);
  } finally {
    client.release();
  }
}

// DELETE /api/friends/cancel/:receiver_id
// Cancel a pending sent request.
async function cancelSentRequest(req, res) {
  const { receiver_id } = req.params;
  const client = await pool.connect();
  try {
    const { rowCount } = await client.query(
      `DELETE FROM friends
       WHERE requester_id = $1 AND receiver_id = $2 AND status = 'pending'`,
      [req.user.id, receiver_id]
    );
    if (!rowCount) return res.status(404).json({ error: 'Pending request not found' });
    res.json({ ok: true });
  } catch (err) {
    console.error('cancelSentRequest:', err.message);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
}

// GET /api/friends/:friend_id/friends
// Returns the public friend list of any user (authenticated access only).
async function getFriendFriends(req, res) {
  const { friend_id } = req.params;
  const client = await pool.connect();
  try {

    const { rows } = await client.query(
      `SELECT u.id, u.username
       FROM friends f
       JOIN users u ON u.id = CASE
         WHEN f.requester_id = $1 THEN f.receiver_id
         ELSE f.requester_id
       END
       WHERE f.status = 'accepted'
         AND (f.requester_id = $1 OR f.receiver_id = $1)`,
      [friend_id]
    );
    res.json(rows);
  } catch (err) {
    console.error('getFriendFriends:', err.message);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
}

module.exports = {
  sendRequest, acceptRequest, declineRequest, unfriend,
  listFriends, listRequests, getFriendYearCalendar,
  getSentRequests, cancelSentRequest, getFriendPercentiles, getFriendFriends,
  addVip, removeVip,
};
