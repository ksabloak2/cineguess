/**
 * uploadFramesToSupabase.js — Uploads all local /frames/ JPGs to Supabase
 * Storage and updates backdrop_paths in the DB to use the public Supabase URLs.
 *
 * Prerequisites:
 *   1. Create a PUBLIC bucket called "frames" in Supabase Storage.
 *   2. SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be in .env
 *
 * Usage: node src/scripts/uploadFramesToSupabase.js
 *   --dry-run   Print what would be uploaded without actually doing it
 *   --skip-upload  Skip uploading (just update DB paths, useful if already uploaded)
 */

const fs   = require('fs');
const path = require('path');
const { Pool } = require('pg');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ override: true });

const DRY_RUN      = process.argv.includes('--dry-run');
const SKIP_UPLOAD  = process.argv.includes('--skip-upload');
const BUCKET       = 'frames';
const FRAMES_DIR   = path.join(__dirname, '../../public/frames');
const CONCURRENCY  = 5; // parallel uploads
const DELAY_MS     = 50; // small delay between batches

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error('Missing DATABASE_URL');
  process.exit(1);
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

// Public URL format for Supabase Storage
function publicUrl(filename) {
  return `${process.env.SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${filename}`;
}

async function uploadFile(filename) {
  const filePath = path.join(FRAMES_DIR, filename);
  const fileBuffer = fs.readFileSync(filePath);
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(filename, fileBuffer, {
      contentType: 'image/jpeg',
      upsert: true, // overwrite if already exists
    });
  if (error) throw new Error(error.message);
  return publicUrl(filename);
}

async function processBatch(batch) {
  return Promise.all(batch.map(async (filename) => {
    try {
      if (!SKIP_UPLOAD) await uploadFile(filename);
      return { filename, ok: true };
    } catch (err) {
      return { filename, ok: false, error: err.message };
    }
  }));
}

async function main() {
  // Read all jpg files
  const files = fs.readdirSync(FRAMES_DIR)
    .filter((f) => /^\d+_\d+\.jpg$/.test(f))
    .sort();

  console.log(`\n${DRY_RUN ? '[DRY RUN] ' : ''}Found ${files.length} frames to upload to Supabase Storage bucket "${BUCKET}".\n`);

  if (DRY_RUN) {
    console.log('Sample URLs that would be created:');
    files.slice(0, 5).forEach((f) => console.log(' ', publicUrl(f)));
    console.log('...\nRun without --dry-run to upload.\n');
    await pool.end();
    return;
  }

  // Upload in batches
  let uploaded = 0;
  let failed = 0;
  const failures = [];

  for (let i = 0; i < files.length; i += CONCURRENCY) {
    const batch = files.slice(i, i + CONCURRENCY);
    const results = await processBatch(batch);
    for (const r of results) {
      if (r.ok) { uploaded++; process.stdout.write('.'); }
      else       { failed++;  process.stdout.write('X'); failures.push(r); }
    }
    if ((i / CONCURRENCY + 1) % 10 === 0) process.stdout.write(` ${uploaded + failed}\n`);
    if (i + CONCURRENCY < files.length) await new Promise((r) => setTimeout(r, DELAY_MS));
  }
  process.stdout.write('\n');

  console.log(`\nUpload complete. Uploaded: ${uploaded}  Failed: ${failed}`);
  if (failures.length) {
    console.log('\nFailed files:');
    failures.slice(0, 20).forEach((f) => console.log(`  ${f.filename}: ${f.error}`));
  }

  // Now update backdrop_paths in DB to use Supabase URLs
  console.log('\nUpdating backdrop_paths in DB...\n');

  // Group files by tmdb_id
  const byMovie = new Map();
  for (const f of files) {
    const tmdbId = parseInt(f.split('_')[0], 10);
    if (!byMovie.has(tmdbId)) byMovie.set(tmdbId, []);
    byMovie.get(tmdbId).push(publicUrl(f));
  }

  // Sort each movie's paths by frame number
  for (const [id, paths] of byMovie) {
    paths.sort((a, b) => {
      const na = parseInt(a.match(/_(\d+)\.jpg$/)[1], 10);
      const nb = parseInt(b.match(/_(\d+)\.jpg$/)[1], 10);
      return na - nb;
    });
  }

  let dbUpdated = 0;
  for (const [tmdbId, paths] of byMovie) {
    const { rowCount } = await pool.query(
      `UPDATE movies SET backdrop_paths = $1, updated_at = NOW() WHERE tmdb_id = $2`,
      [paths, tmdbId]
    );
    if (rowCount > 0) { dbUpdated++; process.stdout.write('.'); }
    else process.stdout.write('?');
    if (dbUpdated % 50 === 0) process.stdout.write(` ${dbUpdated}\n`);
  }
  process.stdout.write('\n');

  console.log(`\nDB updated: ${dbUpdated} movies now point to Supabase Storage URLs.\n`);
  console.log('Sample URL:', publicUrl(files[0]));
  console.log('\nDone! Frames are now served from Supabase Storage in production.\n');

  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
