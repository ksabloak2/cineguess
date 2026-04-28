/**
 * syncFramesToDb.js — Re-syncs backdrop_paths in the DB from the local
 * /frames/ gallery. After curating frames in the gallery UI (deleting
 * unwanted ones), run this to make the DB match exactly what's on disk.
 *
 * Usage: node src/scripts/syncFramesToDb.js
 */

const fs   = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config({ override: true });

const pool      = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const FRAMES_DIR = path.join(__dirname, '../../public/frames');

async function main() {
  // 1. Read all .jpg files from the frames directory
  const files = fs.readdirSync(FRAMES_DIR).filter((f) => /^\d+_\d+\.jpg$/.test(f));

  // 2. Group by tmdb_id → ['/frames/{id}_{n}.jpg', ...]
  const byMovie = new Map();
  for (const f of files) {
    const tmdbId = parseInt(f.split('_')[0], 10);
    if (!byMovie.has(tmdbId)) byMovie.set(tmdbId, []);
    byMovie.get(tmdbId).push(`/frames/${f}`);
  }

  // Sort each movie's frames by frame number for consistency
  for (const [id, paths] of byMovie) {
    paths.sort((a, b) => {
      const na = parseInt(a.match(/_(\d+)\.jpg$/)[1], 10);
      const nb = parseInt(b.match(/_(\d+)\.jpg$/)[1], 10);
      return na - nb;
    });
    byMovie.set(id, paths);
  }

  console.log(`\nFound ${files.length} frames across ${byMovie.size} movies. Syncing to DB...\n`);

  let updated = 0;
  let notFound = 0;

  for (const [tmdbId, paths] of byMovie) {
    const { rowCount } = await pool.query(
      `UPDATE movies SET backdrop_paths = $1, updated_at = NOW() WHERE tmdb_id = $2`,
      [paths, tmdbId]
    );
    if (rowCount > 0) {
      updated++;
      process.stdout.write('.');
    } else {
      notFound++;
      process.stdout.write('?'); // tmdb_id not in movies table
    }
    if ((updated + notFound) % 50 === 0) process.stdout.write(` ${updated + notFound}\n`);
  }

  process.stdout.write('\n');
  console.log(`\nDone. Updated: ${updated}  Not found in DB: ${notFound}\n`);
  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
