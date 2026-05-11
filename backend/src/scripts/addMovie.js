/**
 * addMovie.js — One-command movie onboarding
 *
 * Fetches TMDB data, upserts the movie into the DB, generates an AI logline,
 * downloads trailer frames, uploads them to Supabase Storage, and updates
 * backdrop_paths — all in a single run.
 *
 * Usage:
 *   node src/scripts/addMovie.js --tmdb=<id> --category=<cat>
 *   node src/scripts/addMovie.js --title="Agneepath" --year=2012 --category=indiancinema
 *
 * Categories: top250 | superhero | animated | indiancinema
 *
 * Optional flags:
 *   --no-frames      Skip trailer frame extraction (still does AI hint)
 *   --no-hint        Skip AI logline generation
 *   --force-frames   Re-extract frames even if they already exist
 */

require('dotenv').config({ override: true });
const fs        = require('fs');
const path      = require('path');
const os        = require('os');
const axios     = require('axios');
const { execFile } = require('child_process');
const { promisify } = require('util');
const { createClient } = require('@supabase/supabase-js');
const Anthropic = require('@anthropic-ai/sdk');
const pool      = require('../db/pool');

const execFileP = promisify(execFile);

// ── Config ──────────────────────────────────────────────────────────────────
const TMDB_BASE = process.env.TMDB_BASE_URL || 'https://api.themoviedb.org/3';
const TMDB_KEY  = process.env.TMDB_API_KEY;
const FRAMES_DIR = path.join(__dirname, '..', '..', 'public', 'frames');
const FRAMES_PER_MOVIE = 10;
const TRIM_SECONDS = 5;
const BUCKET = 'frames';

const VALID_CATEGORIES = ['top250', 'superhero', 'animated', 'indiancinema'];

// ── CLI args ─────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const getArg = (name) => {
  const a = args.find((a) => a.startsWith(`--${name}=`));
  return a ? a.split('=').slice(1).join('=') : null;
};
const hasFlag = (name) => args.includes(`--${name}`);

const TMDB_ID    = getArg('tmdb') ? parseInt(getArg('tmdb'), 10) : null;
const TITLE_ARG  = getArg('title');
const YEAR_ARG   = getArg('year') ? parseInt(getArg('year'), 10) : null;
const CATEGORY   = getArg('category');
const NO_FRAMES  = hasFlag('no-frames');
const NO_HINT    = hasFlag('no-hint');
const FORCE_FRAMES = hasFlag('force-frames');

if (!CATEGORY || !VALID_CATEGORIES.includes(CATEGORY)) {
  console.error(`--category is required. Valid: ${VALID_CATEGORIES.join(', ')}`);
  process.exit(1);
}
if (!TMDB_ID && !TITLE_ARG) {
  console.error('Provide --tmdb=<id> or --title="Movie Title" [--year=YYYY]');
  process.exit(1);
}
if (!TMDB_KEY) { console.error('TMDB_API_KEY missing'); process.exit(1); }

fs.mkdirSync(FRAMES_DIR, { recursive: true });

// ── Supabase ─────────────────────────────────────────────────────────────────
const supabase = process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  : null;

function publicFrameUrl(filename) {
  return `${process.env.SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${filename}`;
}

// ── TMDB helpers ──────────────────────────────────────────────────────────────
async function tmdb(pathname, params = {}) {
  const url = `${TMDB_BASE}${pathname}`;
  const res = await axios.get(url, { params: { api_key: TMDB_KEY, ...params } });
  return res.data;
}

async function findTmdbId(title, year) {
  const data = await tmdb('/search/movie', { query: title, year: year || '', language: 'en-US' });
  if (!data.results?.length) throw new Error(`No TMDB results for "${title}" ${year || ''}`);
  // Prefer exact year match if given
  const match = year
    ? data.results.find((r) => r.release_date?.startsWith(String(year))) || data.results[0]
    : data.results[0];
  return match.id;
}

async function fetchMovieData(tmdbId) {
  const data = await tmdb(`/movie/${tmdbId}`, {
    append_to_response: 'credits,videos,images',
    language: 'en-US',
  });
  return data;
}

// ── Cast helpers ──────────────────────────────────────────────────────────────
function extractCast(data) {
  const cast = data.credits?.cast || [];
  const top = cast.slice(0, 10).map((c) => c.name);
  return {
    lead_actor:       top[0] || null,
    supporting_actor: top[1] || null,
    cast_list:        top,
  };
}

// ── Trailer frame extraction ──────────────────────────────────────────────────
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

async function ytDlp(source, outPath) {
  const target = source.startsWith('ytsearch')
    ? source
    : `https://www.youtube.com/watch?v=${source}`;
  await execFileP('yt-dlp', [
    '-f', 'best[height<=480][ext=mp4]/best[height<=480]/best',
    '--no-playlist', '--no-warnings', '--quiet',
    '-o', outPath, target,
  ], { maxBuffer: 20 * 1024 * 1024 });
}

async function ffprobeDuration(videoPath) {
  const { stdout } = await execFileP('ffprobe', [
    '-v', 'error', '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1', videoPath,
  ]);
  return parseFloat(stdout.trim());
}

async function extractFrame(videoPath, timestamp, outPath) {
  await execFileP('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-ss', String(timestamp), '-i', videoPath,
    '-frames:v', '1', '-q:v', '3', outPath,
  ]);
}

function pickTimestamps(duration, n) {
  const start = TRIM_SECONDS;
  const end = Math.max(start + 1, duration - TRIM_SECONDS);
  const span = end - start;
  return Array.from({ length: n }, (_, i) => {
    const bStart = start + (span * i) / n;
    const bEnd   = start + (span * (i + 1)) / n;
    return +(bStart + Math.random() * (bEnd - bStart)).toFixed(2);
  });
}

async function extractTrailerFrames(tmdbId, data) {
  const trailer = pickTrailer(data.videos?.results, data.original_language);
  const tmpDir  = fs.mkdtempSync(path.join(os.tmpdir(), `cg_${tmdbId}_`));
  const tmpVid  = path.join(tmpDir, 'trailer.mp4');

  try {
    let downloaded = false;

    if (trailer) {
      console.log(`  Downloading trailer: ${trailer.name} (${trailer.key})`);
      try {
        await ytDlp(trailer.key, tmpVid);
        downloaded = true;
      } catch (e) {
        console.log(`  Trailer download failed: ${e.message.slice(0, 120)}`);
      }
    }

    if (!downloaded) {
      const query = `ytsearch1:${data.title} ${data.release_date?.slice(0,4) || ''} official trailer`;
      console.log(`  Falling back to YouTube search: ${query}`);
      try {
        await ytDlp(query, tmpVid);
        downloaded = true;
      } catch (e) {
        console.log(`  YouTube search also failed: ${e.message.slice(0, 120)}`);
      }
    }

    if (!downloaded || !fs.existsSync(tmpVid)) {
      console.log('  Using TMDB backdrops as fallback (no trailer available)');
      return fallbackToTmdbBackdrops(tmdbId, data);
    }

    const duration = await ffprobeDuration(tmpVid);
    console.log(`  Trailer duration: ${duration.toFixed(1)}s`);
    if (!duration || duration < 20) {
      return fallbackToTmdbBackdrops(tmdbId, data, 'trailer too short');
    }

    const timestamps = pickTimestamps(duration, FRAMES_PER_MOVIE);
    const framePaths = [];
    for (let i = 0; i < timestamps.length; i++) {
      const outPath = path.join(FRAMES_DIR, `${tmdbId}_${i}.jpg`);
      try {
        await extractFrame(tmpVid, timestamps[i], outPath);
        if (fs.existsSync(outPath) && fs.statSync(outPath).size > 1000) {
          framePaths.push(`${tmdbId}_${i}.jpg`);
          process.stdout.write(`  Frame ${i + 1}/${FRAMES_PER_MOVIE} extracted\r`);
        }
      } catch {}
    }
    console.log(`\n  ${framePaths.length} frames extracted from trailer`);
    return framePaths;
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  }
}

async function fallbackToTmdbBackdrops(tmdbId, data, reason = '') {
  const backdrops = (data.images?.backdrops || [])
    .sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0))
    .slice(0, FRAMES_PER_MOVIE)
    .map((b) => b.file_path);
  console.log(`  Using ${backdrops.length} TMDB backdrops${reason ? ` (${reason})` : ''}`);
  return backdrops; // These are TMDB paths, not local files — handled separately below
}

// ── Supabase upload ───────────────────────────────────────────────────────────
async function uploadFramesToSupabase(localFilenames) {
  if (!supabase) {
    console.log('  Supabase not configured — frames stored locally only');
    return localFilenames.map((f) => `/frames/${f}`);
  }

  const publicUrls = [];
  for (const filename of localFilenames) {
    const filePath = path.join(FRAMES_DIR, filename);
    if (!fs.existsSync(filePath)) continue;
    try {
      const buffer = fs.readFileSync(filePath);
      const { error } = await supabase.storage.from(BUCKET).upload(filename, buffer, {
        contentType: 'image/jpeg',
        upsert: true,
      });
      if (error) throw new Error(error.message);
      publicUrls.push(publicFrameUrl(filename));
      process.stdout.write(`  Uploaded ${filename}\r`);
    } catch (e) {
      console.error(`  Failed to upload ${filename}: ${e.message}`);
      publicUrls.push(`/frames/${filename}`); // fallback to local path
    }
  }
  console.log(`\n  ${publicUrls.length} frames uploaded to Supabase`);
  return publicUrls;
}

// ── AI hint generation ────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You write "Movies Explained Badly" loglines for a movie guessing game.

The goal is to describe the movie in a way that is technically 100% accurate but intentionally misleading, reductive, or absurdly narrow. Think: a Reddit comment from someone who completely missed the point.

HARD RULES — violating any of these is a failure:
- Output exactly ONE sentence. Max 30 words. No quotation marks. No emoji. No prefix like "Hint:" — just the sentence.
- NEVER name the movie, the director, any actor, any character name, any franchise, or any sequel number.
- NEVER use words that appear in the movie's title — not the words AND not the concept the title refers to (e.g. for a movie called "The Whale" do not describe a whale or the ocean; for "Up" do not describe anything going upward or balloons).
- NEVER describe the central premise so directly that the movie is immediately obvious. If someone who knows the film would recognize it within 3 words, rewrite it. Bury the lead.
- SUPERHERO MOVIES ONLY: NEVER mention the hero's powers, abilities, costume appearance, color, or any detail that identifies their superhero identity. Do NOT say "a man who sticks to walls," "a billionaire in armor," "a green rage monster," etc. Instead, describe the civilian drama, a side character's problem, the villain's mundane motivation, or a single throwaway scene.

Techniques to use (pick whichever makes the movie hardest to identify):
1. MINOR DETAIL AS MAIN PLOT — fixate on a trivial side event as if it's the whole story. e.g. Lord of the Rings → "A group of friends have a very long argument about who should carry a piece of jewelry."
2. STRIP THE SCALE — describe epic or fantastical events as mundane problems. e.g. The Shining → "A family's first winter in a hotel goes poorly due to a lack of indoor activities."
3. VILLAIN FRAMING — describe events entirely from the antagonist's perspective as if they are the hero.
4. ZOOM IN ON ONE SCENE — describe a single 30-second moment from the film as if it explains everything.
5. WRONG GENRE — describe the film as if it belongs to a completely different genre (a horror film as a workplace comedy, an action film as a romance, etc.).

Character descriptions: never use names. Use generic labels like "a grieving widower," "a teenager with authority issues," "an overly attached parent," "a middle manager having a bad week," etc. — deliberately generic so they could apply to dozens of films.

The sentence must be punchy and dry. A cinephile who has seen the movie should need at least 5 seconds before the penny drops.`;

async function generateAiHint(title, year, category = '') {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log('  ANTHROPIC_API_KEY not set — skipping AI hint');
    return null;
  }
  const client = new Anthropic.default({ apiKey: process.env.ANTHROPIC_API_KEY });
  const categoryNote = category === 'superhero'
    ? '\nCategory: SUPERHERO — apply the superhero-specific rule (no powers, no costume, no identity clues).'
    : '';
  const resp = await client.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 80,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: `Movie: ${title} (${year})${categoryNote}\n\nWrite the logline.` }],
  });
  const text = resp.content
    .filter((c) => c.type === 'text')
    .map((c) => c.text)
    .join('')
    .trim()
    .replace(/^["']|["']$/g, '')
    .replace(/^Hint:\s*/i, '');
  return text;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  // 1. Resolve TMDB ID
  let tmdbId = TMDB_ID;
  if (!tmdbId) {
    console.log(`Searching TMDB for "${TITLE_ARG}" ${YEAR_ARG || ''}...`);
    tmdbId = await findTmdbId(TITLE_ARG, YEAR_ARG);
    console.log(`  Found TMDB ID: ${tmdbId}`);
  }

  // 2. Fetch full data
  console.log(`\nFetching TMDB data for ID ${tmdbId}...`);
  const data = await fetchMovieData(tmdbId);
  const year = parseInt(data.release_date?.slice(0, 4), 10) || null;
  const genres = data.genres?.map((g) => g.name) || [];
  const { lead_actor, supporting_actor, cast_list } = extractCast(data);

  console.log(`  Title:    ${data.title} (${year})`);
  console.log(`  Genres:   ${genres.join(', ')}`);
  console.log(`  Director: ${data.credits?.crew?.find((c) => c.job === 'Director')?.name || 'Unknown'}`);
  console.log(`  Lead:     ${lead_actor}`);
  console.log(`  Support:  ${supporting_actor}`);
  console.log(`  Language: ${data.original_language}`);

  const director = data.credits?.crew?.find((c) => c.job === 'Director')?.name || null;

  // 3. Check if already in DB
  const { rows: existing } = await pool.query(
    'SELECT id, categories FROM movies WHERE tmdb_id = $1',
    [tmdbId]
  );

  let movieId;
  if (existing.length) {
    // Movie exists — add category if missing
    const cats = existing[0].categories || [];
    const updatedCats = cats.includes(CATEGORY) ? cats : [...cats, CATEGORY];
    await pool.query(
      `UPDATE movies SET categories = $1, updated_at = NOW() WHERE tmdb_id = $2`,
      [updatedCats, tmdbId]
    );
    movieId = existing[0].id;
    console.log(`\nMovie already in DB (id=${movieId}). ${cats.includes(CATEGORY) ? 'Category already set.' : `Added to ${CATEGORY}.`}`);
  } else {
    // Insert new movie
    const { rows: ins } = await pool.query(
      `INSERT INTO movies (
        tmdb_id, title, year, genres, director, primary_language,
        lead_actor, supporting_actor, cast_list,
        poster_path, imdb_id, categories, popularity,
        oscar_nominated, created_at, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,NOW(),NOW())
      RETURNING id`,
      [
        tmdbId,
        data.title,
        year,
        genres,
        director,
        data.original_language,
        lead_actor,
        supporting_actor,
        cast_list,
        data.poster_path || null,
        data.imdb_id || null,
        [CATEGORY],
        data.popularity || 0,
        false,
      ]
    );
    movieId = ins[0].id;
    console.log(`\nInserted new movie (id=${movieId}) into ${CATEGORY}.`);
  }

  // 4. AI hint
  if (!NO_HINT) {
    console.log('\nGenerating AI logline...');
    const hint = await generateAiHint(data.title, year, CATEGORY);
    if (hint) {
      await pool.query(
        `UPDATE movies SET ai_hint_quote = $1, updated_at = NOW() WHERE id = $2`,
        [hint, movieId]
      );
      console.log(`  Logline: "${hint}"`);
    }
  }

  // 5. Trailer frames
  if (!NO_FRAMES) {
    // Check if frames already exist and skip unless --force-frames
    if (!FORCE_FRAMES) {
      const { rows: cur } = await pool.query(
        `SELECT backdrop_paths FROM movies WHERE id = $1`,
        [movieId]
      );
      const bp = cur[0]?.backdrop_paths || [];
      const hasFrames = bp.some((p) => p.includes('/frames/') || p.includes('supabase'));
      if (hasFrames) {
        console.log(`\nFrames already exist (${bp.length}). Use --force-frames to re-extract.`);
        await pool.end();
        console.log('\nDone.');
        return;
      }
    }

    console.log('\nExtracting trailer frames...');
    const result = await extractTrailerFrames(tmdbId, data);

    // result is either local filenames (strings like "84858_0.jpg")
    // or TMDB backdrop paths (strings like "/abc123.jpg")
    const isTmdbPaths = result.length > 0 && result[0].startsWith('/');

    let finalPaths;
    if (isTmdbPaths) {
      // TMDB backdrops — store directly, no local file upload needed
      finalPaths = result;
    } else {
      // Local frames — upload to Supabase
      console.log('\nUploading frames to Supabase...');
      finalPaths = await uploadFramesToSupabase(result);
    }

    await pool.query(
      `UPDATE movies SET backdrop_paths = $1, updated_at = NOW() WHERE id = $2`,
      [finalPaths, movieId]
    );
    console.log(`  backdrop_paths updated (${finalPaths.length} entries)`);
  }

  await pool.end();
  console.log('\nAll done! Movie is ready to play.');
  console.log(`  Title:    ${data.title} (${year})`);
  console.log(`  TMDB ID:  ${tmdbId}`);
  console.log(`  Category: ${CATEGORY}`);
}

main().catch((err) => {
  console.error('Fatal:', err);
  pool.end();
  process.exit(1);
});
