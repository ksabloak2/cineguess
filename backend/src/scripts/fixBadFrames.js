/**
 * fixBadFrames.js
 *
 * One-off fix for a curated list of movies with bad trailer-extracted frames
 * (burned-in titles, wrong movie, etc). Does three things:
 *
 *   1. Special-cases Grave of the Fireflies: swaps the DB row from the 2005
 *      live-action remake (tmdb_id 76826) to the 1988 Studio Ghibli classic
 *      (tmdb_id 12477), refetching basic TMDB fields. Animated metadata on
 *      the row stays intact (it's a better fit for the Ghibli version anyway).
 *
 *   2. Deletes on-disk frame JPGs and clears backdrop_paths for every movie
 *      in the target list so the extractor will reprocess them on its next
 *      run (the default filter picks up movies without /frames/ entries).
 *
 *   3. Runs the extraction pipeline inline so you don't have to invoke
 *      extractTrailerFrames.js separately.
 *
 * Usage:
 *   node src/scripts/fixBadFrames.js
 */

require('dotenv').config({ override: true });
const fs   = require('fs');
const path = require('path');
const pool = require('../db/pool');

const TMDB_BASE = process.env.TMDB_BASE_URL || 'https://api.themoviedb.org/3';
const TMDB_KEY  = process.env.TMDB_API_KEY;
if (!TMDB_KEY) { console.error('TMDB_API_KEY missing'); process.exit(1); }

const FRAMES_DIR = path.join(__dirname, '..', '..', 'public', 'frames');

// Exact tmdb_ids to re-extract (confirmed with user).
const TARGET_TMDB_IDS = [
  19913,    // (500) Days of Summer (2009)
  950387,   // A Minecraft Movie (2025)
  496331,   // Brahmāstra Part One: Shiva (2022)
  19404,    // Dilwale Dulhania Le Jayenge (1995)
  466420,   // Killers of the Flower Moon (2023)
  718789,   // Lightyear (2022)
  1054867,  // One Battle After Another (2025)
  1233413,  // Sinners (2025)
  9820,     // The Parent Trap (1998)
  1022796,  // Wish (2023)
  185008,   // Yeh Jawaani Hai Deewani (2013)
  1061474,  // Superman (2025)
  138843,   // The Conjuring (2013)
  // Grave of the Fireflies is handled specially below — its current tmdb_id
  // is 76826, which will get swapped to 12477 first, then reprocessed.
  12477,    // Grave of the Fireflies (1988) — post-swap
];

async function tmdb(pathname, params = {}) {
  const qs = new URLSearchParams({ api_key: TMDB_KEY, ...params }).toString();
  const res = await fetch(`${TMDB_BASE}${pathname}?${qs}`);
  if (!res.ok) throw new Error(`TMDB ${res.status} for ${pathname}`);
  return res.json();
}

// Swap the Grave of the Fireflies row from the 2005 live-action to the 1988
// Ghibli film. We keep row id stable (no FK churn); just update tmdb_id +
// refetched fields.
async function swapGraveOfTheFireflies() {
  const { rows } = await pool.query(
    `SELECT id FROM movies WHERE tmdb_id = 76826`
  );
  if (!rows.length) {
    console.log('  · Grave of the Fireflies (2005) row not found — skipping swap');
    return;
  }
  const rowId = rows[0].id;

  const details = await tmdb('/movie/12477', { append_to_response: 'credits' });
  const genres = (details.genres || []).map((g) => g.name);
  const director = (details.credits?.crew || []).find((c) => c.job === 'Director')?.name || null;
  const lead = (details.credits?.cast || [])[0]?.name || null;
  const cast = (details.credits?.cast || []).slice(0, 10).map((c) => c.name);
  const year = details.release_date ? parseInt(details.release_date.slice(0, 4), 10) : null;

  await pool.query(
    `UPDATE movies SET
        tmdb_id = 12477,
        title = $2,
        year = $3,
        genres = $4,
        director = $5,
        lead_actor = $6,
        cast_list = $7,
        primary_language = $8,
        poster_path = $9,
        backdrop_paths = NULL,
        updated_at = NOW()
      WHERE id = $1`,
    [
      rowId,
      details.title || 'Grave of the Fireflies',
      year,
      genres,
      director,
      lead,
      cast,
      details.original_language || 'ja',
      details.poster_path || null,
    ]
  );
  console.log(`  ✓ Swapped row ${rowId} → tmdb_id 12477 "${details.title}" (${year}), director=${director}`);
}

// Delete on-disk JPGs + clear backdrop_paths for one tmdb_id so the extractor
// will pick the movie up on its next run.
async function resetMovie(tmdbId) {
  const { rows } = await pool.query(
    `SELECT id, title, year, backdrop_paths FROM movies WHERE tmdb_id = $1`,
    [tmdbId]
  );
  if (!rows.length) {
    console.log(`  · tmdb_id ${tmdbId} — not in DB, skipping`);
    return false;
  }
  const m = rows[0];

  // Delete any /frames/*.jpg files belonging to this tmdb_id.
  const frameFiles = (m.backdrop_paths || [])
    .filter((p) => p.startsWith('/frames/'))
    .map((p) => path.join(FRAMES_DIR, p.replace('/frames/', '')));
  let removed = 0;
  for (const f of frameFiles) {
    try { fs.unlinkSync(f); removed++; } catch {}
  }
  // Also sweep any stray files matching the pattern, in case DB is out of sync.
  try {
    for (const f of fs.readdirSync(FRAMES_DIR)) {
      if (new RegExp(`^${tmdbId}_\\d+\\.jpg$`).test(f)) {
        try { fs.unlinkSync(path.join(FRAMES_DIR, f)); removed++; } catch {}
      }
    }
  } catch {}

  await pool.query(
    `UPDATE movies SET backdrop_paths = NULL, updated_at = NOW() WHERE id = $1`,
    [m.id]
  );
  console.log(`  ✓ ${m.title} (${m.year}) — cleared DB + removed ${removed} file(s)`);
  return true;
}

async function main() {
  console.log('\n--- Step 1: Swap Grave of the Fireflies (2005 → 1988 Ghibli) ---');
  await swapGraveOfTheFireflies();

  console.log('\n--- Step 2: Clear frames for target movies ---');
  for (const id of TARGET_TMDB_IDS) {
    await resetMovie(id);
  }

  console.log('\nAll targeted movies are now queued for re-extraction.');
  console.log('Handing off to extractTrailerFrames.js — it will process only movies without /frames/ entries.\n');
  // Don't pool.end() — the extractor reuses the same singleton pool and will
  // close it when it's done.
}

main().then(() => {
  require('./extractTrailerFrames');
}).catch((err) => { console.error(err); process.exit(1); });
