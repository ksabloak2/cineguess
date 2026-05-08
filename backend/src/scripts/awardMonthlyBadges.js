/**
 * awardMonthlyBadges.js
 *
 * Runs at the start of each month (00:05 ET on the 1st) and awards
 * leaderboard badges for the PREVIOUS month based on final standings.
 *
 * Badge ranks:
 *   1  → Gold   (🥇 1st place)
 *   2  → Silver (🥈 2nd place)
 *   3  → Bronze (🥉 3rd place)
 *   4+ → Top 10 (positions 4–10)
 *
 * Awards badges for all 8 categories:
 *   top250, superhero, animated, indiancinema  (daily — ranked by global_rating)
 *   unlimited_top250/superhero/animated/indiancinema  (unlimited — ranked by streak)
 *
 * Idempotent: uses ON CONFLICT DO NOTHING so re-running won't duplicate badges.
 *
 * Usage:
 *   node src/scripts/awardMonthlyBadges.js           # previous month
 *   node src/scripts/awardMonthlyBadges.js 2025-04   # specific month (YYYY-MM)
 */

require('dotenv').config();
const pool = require('../db/pool');

const DAILY_CATS    = ['top250', 'superhero', 'animated', 'indiancinema'];
const UNLIMITED_CATS = [
  'unlimited_top250', 'unlimited_superhero',
  'unlimited_animated', 'unlimited_indiancinema',
];

// Returns YYYY-MM of the previous month relative to now (ET)
function prevMonthStr() {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const year  = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
  const month = now.getMonth() === 0 ? 12 : now.getMonth();
  return `${year}-${String(month).padStart(2, '0')}`;
}

async function awardForCategory(client, category, monthStr, isUnlimited) {
  let rows;
  if (isUnlimited) {
    const res = await client.query(`
      SELECT u.id AS user_id, s.current_streak
      FROM users u
      JOIN streaks s ON s.user_id = u.id AND s.category = $1
      WHERE s.current_streak > 0
      ORDER BY s.current_streak DESC, s.longest_streak DESC
      LIMIT 10
    `, [category]);
    rows = res.rows;
  } else {
    const res = await client.query(`
      SELECT
        u.id AS user_id,
        ROUND((
          s.current_streak * 10
          + COALESCE(AVG(g.score) FILTER (WHERE g.won = true AND g.score IS NOT NULL), 0)
          + (
            SELECT COUNT(*) * 5 FROM (
              SELECT g2.hints_count
              FROM guesses g2
              WHERE g2.user_id = u.id AND g2.category = $1
                AND g2.won = true AND g2.score IS NOT NULL
              ORDER BY g2.guess_date DESC
              LIMIT s.current_streak
            ) sub
            WHERE sub.hints_count = 0
          )
        )::numeric, 1) AS global_rating,
        ROUND(COALESCE(AVG(g.guesses_taken) FILTER (WHERE g.won = true), 0)::numeric, 2) AS avg_guesses
      FROM users u
      JOIN streaks s ON s.user_id = u.id AND s.category = $1
      LEFT JOIN guesses g ON g.user_id = u.id AND g.category = $1
      WHERE s.current_streak > 0
      GROUP BY u.id, u.username, s.current_streak, s.longest_streak
      ORDER BY global_rating DESC, avg_guesses ASC
      LIMIT 10
    `, [category]);
    rows = res.rows;
  }

  let awarded = 0;
  for (let i = 0; i < rows.length; i++) {
    const rank  = i + 1;            // 1-based rank
    const tier  = rank <= 3 ? rank : 4;   // 1, 2, 3, or 4 (top10)
    const { user_id } = rows[i];

    await client.query(`
      INSERT INTO leaderboard_badges (user_id, category, rank, month)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (user_id, category, month) DO NOTHING
    `, [user_id, category, tier, monthStr]);
    awarded++;
  }
  return awarded;
}

async function awardMonthlyBadges(monthStr) {
  console.log(`\nAwarding monthly badges for: ${monthStr}`);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    let total = 0;
    for (const cat of DAILY_CATS) {
      const n = await awardForCategory(client, cat, monthStr, false);
      console.log(`  [${cat}] awarded ${n}`);
      total += n;
    }
    for (const cat of UNLIMITED_CATS) {
      const n = await awardForCategory(client, cat, monthStr, true);
      console.log(`  [${cat}] awarded ${n}`);
      total += n;
    }
    await client.query('COMMIT');
    console.log(`\nDone — ${total} badge records inserted for ${monthStr}\n`);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { awardMonthlyBadges };

if (require.main === module) {
  const arg = process.argv[2];
  const month = arg || prevMonthStr();
  awardMonthlyBadges(month)
    .then(() => process.exit(0))
    .catch((err) => { console.error('Fatal:', err); process.exit(1); });
}
