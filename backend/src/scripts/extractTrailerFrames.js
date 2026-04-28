/**
 * extractTrailerFrames.js
 *
 * For every movie:
 *   1. Look up its official trailer via TMDB /movie/{id}/videos
 *   2. Download the trailer from YouTube (yt-dlp, 360p is plenty)
 *   3. Pick 10 random timestamps inside the trailer (trimming the first and
 *      last 5s so we skip title cards and end logos)
 *   4. Extract one JPG per timestamp with ffmpeg
 *   5. Overwrite movies.backdrop_paths with the new local paths so the
 *      frontend hint modal serves real in-movie frames instead of TMDB
 *      promotional backdrops
 *
 * Frames are saved to backend/public/frames/{tmdb_id}_{n}.jpg and served by
 * Express at `/frames/...`. The Vite dev proxy forwards `/frames` to the
 * backend so <img src="/frames/..."> works in development.
 *
 * Resumable: movies whose backdrop_paths already contain `/frames/` entries
 * are skipped unless --force is passed. Movies without a usable trailer keep
 * their existing TMDB backdrops as a fallback.
 *
 * Requirements: yt-dlp and ffmpeg on PATH.
 *   brew install yt-dlp ffmpeg
 *
 * Usage:
 *   node src/scripts/extractTrailerFrames.js                # all missing
 *   node src/scripts/extractTrailerFrames.js --force        # re-extract all
 *   node src/scripts/extractTrailerFrames.js --limit=20     # only first 20
 *   node src/scripts/extractTrailerFrames.js --concurrency=4
 */

require('dotenv').config({ override: true });
const fs      = require('fs');
const path    = require('path');
const os      = require('os');
const { execFile } = require('child_process');
const { promisify } = require('util');
const pool    = require('../db/pool');

const execFileP = promisify(execFile);

const TMDB_BASE = process.env.TMDB_BASE_URL || 'https://api.themoviedb.org/3';
const TMDB_KEY  = process.env.TMDB_API_KEY;
if (!TMDB_KEY) { console.error('TMDB_API_KEY missing'); process.exit(1); }

const FRAMES_DIR = path.join(__dirname, '..', '..', 'public', 'frames');
const FRAMES_PER_MOVIE = 10;
const TRIM_SECONDS = 5; // skip first/last N seconds of the trailer
const MIN_TRAILER_DURATION = 20;

// CLI flags
const args = process.argv.slice(2);
const FORCE = args.includes('--force');
const LIMIT = parseInt((args.find((a) => a.startsWith('--limit=')) || '').split('=')[1], 10) || null;
const CONCURRENCY = parseInt((args.find((a) => a.startsWith('--concurrency=')) || '').split('=')[1], 10) || 3;

fs.mkdirSync(FRAMES_DIR, { recursive: true });

async function tmdb(pathname, params = {}) {
  const qs = new URLSearchParams({ api_key: TMDB_KEY, ...params }).toString();
  const res = await fetch(`${TMDB_BASE}${pathname}?${qs}`);
  if (!res.ok) throw new Error(`TMDB ${res.status}`);
  return res.json();
}

// Pick the best trailer: prefer official + trailer-type + language matching
// the movie's primary language, then fall back.
function pickTrailer(videos, primaryLang) {
  const all = (videos || []).filter((v) => v.site === 'YouTube' && v.key);
  if (!all.length) return null;

  const score = (v) => {
    let s = 0;
    if (v.type === 'Trailer') s += 10;
    else if (v.type === 'Teaser') s += 6;
    else s -= 5;
    if (v.official) s += 5;
    if (primaryLang && v.iso_639_1 === primaryLang) s += 3;
    if (v.iso_639_1 === 'en') s += 1;
    if (v.size >= 720) s += 1;
    return s;
  };
  return [...all].sort((a, b) => score(b) - score(a))[0];
}

async function ytDlpDownload(source, outPath, { useCookies = false } = {}) {
  // 360p mp4 is plenty for extracting frames and keeps the download tiny.
  // --no-playlist guards against playlist IDs sneaking in.
  // `source` can be a YouTube video ID or a `ytsearch1:...` query.
  const target = source.startsWith('ytsearch')
    ? source
    : `https://www.youtube.com/watch?v=${source}`;
  const args = [
    '-f', 'best[height<=480][ext=mp4]/best[height<=480]/best',
    '--no-playlist',
    '--no-warnings',
    '--quiet',
    '-o', outPath,
  ];
  if (useCookies) args.push('--cookies-from-browser', 'chrome');
  args.push(target);
  await execFileP('yt-dlp', args, { maxBuffer: 20 * 1024 * 1024 });
}

// Try a download with progressive fallbacks:
//   1. bare attempt (TMDB key or ytsearch query)
//   2. if age-gate error, retry with Chrome cookies
// Returns true on success, false otherwise. `errorSink` collects the last error message.
async function tryDownload(source, outPath, errorSink) {
  try {
    await ytDlpDownload(source, outPath);
    return true;
  } catch (err) {
    const msg = (err.stderr?.toString() || err.message || '').slice(0, 400);
    errorSink.msg = msg;
    if (/Sign in to confirm your age|cookies-from-browser/i.test(msg)) {
      try {
        await ytDlpDownload(source, outPath, { useCookies: true });
        return true;
      } catch (err2) {
        errorSink.msg = (err2.stderr?.toString() || err2.message || '').slice(0, 400);
        return false;
      }
    }
    return false;
  }
}

async function ffprobeDuration(videoPath) {
  const { stdout } = await execFileP('ffprobe', [
    '-v', 'error',
    '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1',
    videoPath,
  ]);
  return parseFloat(stdout.trim());
}

async function extractFrame(videoPath, timestamp, outPath) {
  // -ss before -i = fast seek; -frames:v 1 = one frame; -q:v 3 ≈ high quality JPG
  await execFileP('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-ss', String(timestamp),
    '-i', videoPath,
    '-frames:v', '1',
    '-q:v', '3',
    outPath,
  ]);
}

function pickTimestamps(duration, n) {
  const start = TRIM_SECONDS;
  const end = Math.max(start + 1, duration - TRIM_SECONDS);
  const span = end - start;
  const out = [];
  // Evenly slice the trailer into N buckets, then jitter within each bucket
  // for non-predictable but well-spread frame choices.
  for (let i = 0; i < n; i++) {
    const bucketStart = start + (span * i) / n;
    const bucketEnd   = start + (span * (i + 1)) / n;
    const t = bucketStart + Math.random() * (bucketEnd - bucketStart);
    out.push(+t.toFixed(2));
  }
  return out;
}

async function processMovie(movie) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), `cineguess_${movie.tmdb_id}_`));
  const tmpVideo = path.join(tmpDir, 'trailer.mp4');

  try {
    const videosRes = await tmdb(`/movie/${movie.tmdb_id}/videos`);
    const trailer = pickTrailer(videosRes.results, movie.primary_language);

    const errSink = { msg: '' };
    let downloadedVia = null;

    if (trailer) {
      if (await tryDownload(trailer.key, tmpVideo, errSink)) {
        downloadedVia = 'tmdb';
      }
    }

    // Fallback: search YouTube directly by title+year. Rescues movies TMDB
    // doesn't have a trailer for, plus region-blocked / private-video cases.
    if (!downloadedVia) {
      const query = `ytsearch1:${movie.title} ${movie.year || ''} official trailer`;
      if (await tryDownload(query, tmpVideo, errSink)) {
        downloadedVia = 'ytsearch';
      }
    }

    // ── TMDB backdrop fallback ─────────────────────────────────────────────────
    // If video download fails OR the clip is too short, pull up to 10 TMDB
    // backdrop images and store them as the movie's hint frames. Not as good as
    // real in-movie frames, but far better than nothing.
    async function useTmdbBackdrops(reason) {
      try {
        const imgRes = await tmdb(`/movie/${movie.tmdb_id}/images`, { include_image_language: 'null,en' });
        const backdrops = (imgRes.backdrops || [])
          .sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0))
          .slice(0, FRAMES_PER_MOVIE)
          .map((b) => b.file_path);
        if (!backdrops.length) return { status: 'no-tmdb-backdrops', detail: reason };
        await pool.query(
          `UPDATE movies SET backdrop_paths = $1, updated_at = NOW() WHERE id = $2`,
          [backdrops, movie.id]
        );
        return { status: 'tmdb-backdrops', count: backdrops.length, detail: reason };
      } catch (e) {
        return { status: 'no-tmdb-backdrops', detail: `${reason} + backdrop fetch failed: ${e.message}` };
      }
    }

    if (!downloadedVia) {
      return useTmdbBackdrops(
        (trailer ? 'download-failed' : 'no-trailer') +
        (errSink.msg ? `: ${errSink.msg.replace(/\s+/g, ' ').slice(0, 160)}` : '')
      );
    }

    if (!fs.existsSync(tmpVideo)) {
      return useTmdbBackdrops('download-failed: no output file');
    }

    const duration = await ffprobeDuration(tmpVideo);
    if (!duration || duration < MIN_TRAILER_DURATION) {
      return useTmdbBackdrops(`trailer-too-short: ${duration}s`);
    }

    const timestamps = pickTimestamps(duration, FRAMES_PER_MOVIE);
    const framePaths = [];
    for (let i = 0; i < timestamps.length; i++) {
      const outPath = path.join(FRAMES_DIR, `${movie.tmdb_id}_${i}.jpg`);
      try {
        await extractFrame(tmpVideo, timestamps[i], outPath);
        if (fs.existsSync(outPath) && fs.statSync(outPath).size > 1000) {
          framePaths.push(`/frames/${movie.tmdb_id}_${i}.jpg`);
        }
      } catch (err) {
        // individual frame failures are OK, just skip
      }
    }

    if (framePaths.length === 0) {
      return useTmdbBackdrops('no-frames-extracted');
    }

    await pool.query(
      `UPDATE movies SET backdrop_paths = $1, updated_at = NOW() WHERE id = $2`,
      [framePaths, movie.id]
    );
    return { status: 'ok', count: framePaths.length };
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  }
}

async function main() {
  // Pick movies that either have no frames or (with --force) all of them.
  // "Already done" means backdrop_paths contains at least one /frames/ entry.
  let query = `SELECT id, tmdb_id, title, year, primary_language, backdrop_paths
               FROM movies`;
  if (!FORCE) {
    query += ` WHERE backdrop_paths IS NULL
               OR cardinality(backdrop_paths) = 0
               OR NOT EXISTS (
                 SELECT 1 FROM unnest(backdrop_paths) p WHERE p LIKE '/frames/%'
               )`;
  }
  query += ` ORDER BY popularity DESC NULLS LAST`;
  if (LIMIT) query += ` LIMIT ${LIMIT}`;

  const { rows: movies } = await pool.query(query);
  console.log(`\nProcessing ${movies.length} movies (force=${FORCE}, concurrency=${CONCURRENCY})\n`);

  const counters = { ok: 0, 'tmdb-backdrops': 0, 'no-trailer': 0, 'download-failed': 0, 'trailer-too-short': 0, 'no-frames-extracted': 0, 'no-tmdb-backdrops': 0, error: 0 };
  const problems = [];

  let idx = 0;
  async function worker(workerId) {
    while (idx < movies.length) {
      const myIdx = idx++;
      const m = movies[myIdx];
      try {
        const res = await processMovie(m);
        counters[res.status] = (counters[res.status] || 0) + 1;
        const tag = res.status === 'ok' ? '✓' : res.status === 'tmdb-backdrops' ? '◈' : '·';
        const suffix = res.status === 'ok'
          ? `${res.count} frames`
          : res.status === 'tmdb-backdrops'
            ? `TMDB backdrops ×${res.count} (${res.detail})`
            : `${res.status}${res.detail ? ` (${res.detail})` : ''}`;
        console.log(`[${myIdx + 1}/${movies.length}] ${tag} ${m.title} (${m.year}) — ${suffix}`);
        if (res.status !== 'ok' && res.status !== 'tmdb-backdrops') problems.push(`${m.title} (${m.year}) — ${suffix}`);
      } catch (err) {
        counters.error++;
        console.log(`[${myIdx + 1}/${movies.length}] ✗ ${m.title} — ${err.message}`);
        problems.push(`${m.title} — ${err.message}`);
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, (_, i) => worker(i)));

  console.log('\n=== Summary ===');
  Object.entries(counters).forEach(([k, v]) => console.log(`  ${k}: ${v}`));
  if (problems.length && problems.length <= 40) {
    console.log('\nProblems:');
    problems.forEach((p) => console.log(`  - ${p}`));
  } else if (problems.length) {
    console.log(`\n${problems.length} problems (too many to list).`);
  }

  await pool.end();
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
