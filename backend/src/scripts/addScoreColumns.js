/**
 * Migration: add score and hints_count columns to the guesses table.
 * Run once: node src/scripts/addScoreColumns.js
 */
const pool = require('../db/pool');

async function main() {
  const client = await pool.connect();
  try {
    console.log('Running migration: adding score and hints_count columns to guesses...');
    await client.query(`
      ALTER TABLE guesses ADD COLUMN IF NOT EXISTS score INTEGER;
      ALTER TABLE guesses ADD COLUMN IF NOT EXISTS hints_count INTEGER;
    `);
    console.log('Migration complete.');
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
