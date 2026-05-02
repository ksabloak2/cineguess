/**
 * prefillDailyPicks.js
 *
 * Pre-populates daily_picks for the next N days (default 90) so the game
 * never hits a "no pick for today" error at midnight, even if the server is
 * cold or the cron job misses a run.
 *
 * Picks are selected with the same seeded-random + 21-day repeat-prevention
 * logic as dailyPick.js — just run ahead of time.
 *
 * ON CONFLICT DO NOTHING means already-scheduled days are skipped safely,
 * so this script is safe to re-run at any time.
 *
 * Usage:
 *   node src/scripts/prefillDailyPicks.js           # fills next 90 days
 *   node src/scripts/prefillDailyPicks.js --days 30  # fills next 30 days
 *   node src/scripts/prefillDailyPicks.js --days 180 # fills next 6 months
 */

require('dotenv').config();
const pool = require('../db/pool');
const { runDailyPick } = require('./dailyPick');

const args  = process.argv.slice(2);
const dIdx  = args.indexOf('--days');
const DAYS  = dIdx !== -1 && args[dIdx + 1] ? parseInt(args[dIdx + 1], 10) : 90;

function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T12:00:00Z'); // noon UTC avoids DST edge cases
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().split('T')[0];
}

async function run() {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });

  console.log(`\nPre-filling daily picks for the next ${DAYS} days starting ${today}...\n`);

  let filled = 0;
  let skipped = 0;

  for (let i = 0; i < DAYS; i++) {
    const dateStr = addDays(today, i);
    try {
      // runDailyPick uses ON CONFLICT DO NOTHING — logs if pick already exists
      await runDailyPick(dateStr);
      filled++;
    } catch (err) {
      console.error(`  ✗ Failed for ${dateStr}:`, err.message);
      skipped++;
    }
  }

  console.log(`\nDone. ${filled} days filled, ${skipped} failed.`);
  await pool.end();
}

run().catch((err) => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
