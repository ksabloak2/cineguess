/**
 * dailyPick.js
 *
 * Selects one movie per category for the given date using a seeded shuffle.
 * Respects the 21-day repeat-prevention window.
 *
 * Called by node-cron at midnight America/New_York (Eastern) and can also be
 * run manually with an optional YYYY-MM-DD override:
 *   node src/scripts/dailyPick.js [YYYY-MM-DD]
 */

require('dotenv').config();
const pool = require('../db/pool');

const CATEGORIES = ['top250', 'superhero', 'animated', 'indiancinema'];
const REPEAT_WINDOW_DAYS = 21;

// Deterministic seeded LCG for reproducible daily picks
function seededRandom(seed) {
  let s = seed;
  return function () {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

// Convert date string to a numeric seed
function dateSeed(dateStr) {
  return dateStr.split('-').join('').replace(/-/g, '') | 0;
}

function shuffle(arr, rng) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function pickForCategory(client, category, dateStr) {
  // Movies in this category
  const { rows: allMovies } = await client.query(
    `SELECT id, tmdb_id FROM movies WHERE $1 = ANY(categories) ORDER BY id`,
    [category]
  );

  if (allMovies.length === 0) {
    console.warn(`  No movies found for category '${category}'. Skipping.`);
    return;
  }

  // Movies used within the last 21 days
  const cutoff = new Date(dateStr);
  cutoff.setDate(cutoff.getDate() - REPEAT_WINDOW_DAYS);
  const { rows: recentlyUsed } = await client.query(
    `SELECT movie_id FROM used_movies
     WHERE category = $1 AND last_used_date >= $2`,
    [category, cutoff.toISOString().split('T')[0]]
  );
  const usedSet = new Set(recentlyUsed.map((r) => r.movie_id));

  // Filter eligible movies
  let eligible = allMovies.filter((m) => !usedSet.has(m.id));

  // If all movies were used recently, reset and use the full pool
  if (eligible.length === 0) {
    console.warn(`  All ${category} movies used in last 21 days — resetting pool.`);
    eligible = allMovies;
  }

  // Seeded shuffle: seed = date + category for independence across categories
  const categorySuffix = CATEGORIES.indexOf(category);
  const seed = dateSeed(dateStr) + categorySuffix * 31337;
  const rng = seededRandom(seed);
  const shuffled = shuffle(eligible, rng);
  const picked = shuffled[0];

  // Insert into daily_picks
  await client.query(
    `INSERT INTO daily_picks (category, movie_id, pick_date)
     VALUES ($1, $2, $3)
     ON CONFLICT (category, pick_date) DO NOTHING`,
    [category, picked.id, dateStr]
  );

  // Update used_movies
  await client.query(
    `INSERT INTO used_movies (category, movie_id, last_used_date)
     VALUES ($1, $2, $3)
     ON CONFLICT (category, movie_id) DO UPDATE SET last_used_date = $3`,
    [category, picked.id, dateStr]
  );

  console.log(`  [${category}] Picked movie id=${picked.id} (tmdb=${picked.tmdb_id})`);
}

async function runDailyPick(dateStr) {
  console.log(`\nRunning daily pick for date: ${dateStr}`);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const category of CATEGORIES) {
      await pickForCategory(client, category, dateStr);
    }
    await client.query('COMMIT');
    console.log('Daily picks committed.\n');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { runDailyPick };

// Only auto-run when called directly (not when required by another script)
if (require.main === module) {
  const targetDate = process.argv[2] || new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
  runDailyPick(targetDate)
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Daily pick failed:', err);
      process.exit(1);
    });
}
