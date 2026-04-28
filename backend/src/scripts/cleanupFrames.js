/**
 * cleanupFrames.js
 *
 * Removes frame image files from backend/public/frames/ that no longer
 * correspond to any movie in the database. Run after any movie purge
 * (Ghibli cleanup, Bollywood→Indian Cinema rename, etc.).
 *
 * Usage: node src/scripts/cleanupFrames.js
 */

const fs   = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const pool = require('../db/pool');

const FRAMES_DIR = path.join(__dirname, '../../public/frames');

async function main() {
  console.log('🎬 CineGuess — Frame Gallery Cleanup\n');

  const client = await pool.connect();
  let validIds;
  try {
    const { rows } = await client.query('SELECT DISTINCT tmdb_id FROM movies ORDER BY tmdb_id');
    validIds = new Set(rows.map((r) => String(r.tmdb_id)));
    console.log(`✓ ${validIds.size} movies currently in the database`);
  } finally {
    client.release();
  }

  if (!fs.existsSync(FRAMES_DIR)) {
    console.error(`✗ Frames directory not found: ${FRAMES_DIR}`);
    process.exit(1);
  }

  const allFiles = fs.readdirSync(FRAMES_DIR).filter((f) => f.endsWith('.jpg'));
  console.log(`✓ ${allFiles.length} frame files found in gallery\n`);

  const orphans = allFiles.filter((file) => {
    const tmdbId = file.split('_')[0];
    return !validIds.has(tmdbId);
  });

  if (!orphans.length) {
    console.log('✅ Gallery is already clean — no orphaned frames found.');
    process.exit(0);
  }

  // Group by tmdb_id for a cleaner log
  const byMovie = {};
  for (const f of orphans) {
    const id = f.split('_')[0];
    if (!byMovie[id]) byMovie[id] = [];
    byMovie[id].push(f);
  }

  console.log(`🗑  Found ${orphans.length} orphaned frames across ${Object.keys(byMovie).length} deleted movies:\n`);
  for (const [id, files] of Object.entries(byMovie)) {
    console.log(`   tmdb_id ${id.padEnd(10)} — ${files.length} frame(s)`);
  }
  console.log('');

  let deleted = 0;
  let failed  = 0;
  for (const file of orphans) {
    try {
      fs.unlinkSync(path.join(FRAMES_DIR, file));
      deleted++;
    } catch (err) {
      console.warn(`  ⚠ Could not delete ${file}: ${err.message}`);
      failed++;
    }
  }

  console.log(`\n✅ Done.`);
  console.log(`   Deleted : ${deleted} frame files`);
  if (failed) console.log(`   Failed  : ${failed} files (see warnings above)`);
  console.log(`   Kept    : ${allFiles.length - deleted} frames for ${validIds.size} valid movies`);

  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
