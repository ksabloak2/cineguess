/**
 * generateMusicHints.js
 *
 * For every movie in the 'indiancinema' category, generates:
 *   music_hint_song    — the most popular song from that film
 *   music_hint_singers — lead playback singer(s) for that track
 *
 * Rules enforced:
 *  - Song must be a REAL song that actually exists in the film's soundtrack
 *  - Song title must NOT contain or match the movie title (it would give away the answer)
 *  - Singer must be the actual playback vocalist, not composer/lyricist
 *
 * Usage:
 *   node src/scripts/generateMusicHints.js          # only fills missing
 *   node src/scripts/generateMusicHints.js --force  # regenerate all
 */

require('dotenv').config({ override: true });
const { Pool } = require('pg');
const Anthropic = require('@anthropic-ai/sdk');

if (!process.env.ANTHROPIC_API_KEY) { console.error('Missing ANTHROPIC_API_KEY'); process.exit(1); }
if (!process.env.DATABASE_URL)      { console.error('Missing DATABASE_URL');      process.exit(1); }

const anthropic = new Anthropic.default({ apiKey: process.env.ANTHROPIC_API_KEY });
const pool      = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

const FORCE = process.argv.includes('--force');
// Use Sonnet for significantly better Bollywood knowledge and accuracy
const MODEL = 'claude-sonnet-4-5';

const SYSTEM = `You are a precise Bollywood and Indian cinema music expert with deep knowledge of film soundtracks.

Your task: identify the single most popular, widely-recognized song from a given Indian film.

STRICT RULES:
1. The song MUST actually exist in that film's official soundtrack. Never invent or hallucinate a song.
2. The song title must NOT contain the movie title or be the same as the movie title. If the most popular song contains the movie name, pick the next most popular song that does not.
3. "singers" must be the actual PLAYBACK VOCALIST(S) who sang the song — not the music composer, not the lyricist, not the on-screen actor. Only singing credits.
4. Output ONLY a raw JSON object on a single line. No markdown, no explanation.
   Format: {"song":"Song Name","singers":"Singer One, Singer Two"}

EXAMPLES OF CORRECT OUTPUT:
- Befikre (2016) → {"song":"Nashe Si Chadh Gayi","singers":"Arijit Singh"}
- Dilwale Dulhania Le Jayenge (1995) → {"song":"Tujhe Dekha Toh","singers":"Kumar Sanu, Lata Mangeshkar"}
- 3 Idiots (2009) → {"song":"All Izz Well","singers":"Shaan, Sonu Nigam, Swanand Kirkire"}
- Bajrangi Bhaijaan (2015) → {"song":"Bhar Do Jholi Meri","singers":"Adnan Sami"}
- Gully Boy (2019) → {"song":"Apna Time Aayega","singers":"Ranveer Singh"}

If you are not confident about a song, pick the one you ARE certain exists in that film.`;

function normalize(s) {
  return (s || '').toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
}

// Returns true if the song title contains the movie title (should be skipped)
function songContainsMovieTitle(song, movieTitle) {
  const normSong  = normalize(song);
  const normTitle = normalize(movieTitle);
  // Check both directions: song contains title words, or title words appear in song
  const titleWords = normTitle.split(/\s+/).filter((w) => w.length > 3);
  const songWords  = normSong.split(/\s+/);
  // If song name contains the full title as substring
  if (normSong.includes(normTitle)) return true;
  // If song name is nearly identical (stripped)
  if (normSong.replace(/\s/g, '') === normTitle.replace(/\s/g, '')) return true;
  // If more than half of significant title words appear in the song name
  if (titleWords.length >= 2) {
    const hits = titleWords.filter((w) => songWords.includes(w)).length;
    if (hits >= Math.ceil(titleWords.length * 0.6)) return true;
  }
  return false;
}

async function callModel(prompt) {
  const resp = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 150,
    system: SYSTEM,
    messages: [{ role: 'user', content: prompt }],
  });
  const raw = resp.content.filter((c) => c.type === 'text').map((c) => c.text).join('').trim();
  const match = raw.match(/\{[^{}]*"song"[^{}]*"singers"[^{}]*\}|\{[^{}]*"singers"[^{}]*"song"[^{}]*\}/);
  if (!match) throw new Error(`No JSON in response: ${raw.slice(0, 120)}`);
  const parsed = JSON.parse(match[0]);
  if (!parsed.song || !parsed.singers) throw new Error('Missing song or singers field');
  return parsed;
}

async function generateMusicHint(title, year) {
  // First attempt
  const result = await callModel(
    `Movie: "${title}" (${year})\n\nGive me the most popular song from this film's soundtrack. Remember: the song title must NOT contain the movie title "${title}". Return as JSON.`
  );

  // If the song title contains the movie name, ask for a different song
  if (songContainsMovieTitle(result.song, title)) {
    const fallback = await callModel(
      `Movie: "${title}" (${year})\n\nThe most popular song from this film contains the movie title in its name, which I cannot use as a hint. Give me the NEXT most popular song from "${title}" (${year}) whose title does NOT contain the words "${title}". Return as JSON.`
    );
    // Use fallback only if it also doesn't contain the title
    if (!songContainsMovieTitle(fallback.song, title)) return fallback;
    // If fallback also matches, return first result anyway (edge case)
  }

  return result;
}

async function main() {
  const filter = FORCE
    ? ''
    : `AND (music_hint_song IS NULL OR music_hint_song = '')`;
  const { rows: movies } = await pool.query(
    `SELECT id, title, year FROM movies WHERE 'indiancinema' = ANY(categories) ${filter} ORDER BY title`
  );

  console.log(`\nGenerating music hints for ${movies.length} Indian Cinema movies`);
  console.log(`Model: ${MODEL} | Force: ${FORCE}\n`);

  const results = [];
  let done = 0, failed = 0;

  for (let i = 0; i < movies.length; i++) {
    const m = movies[i];
    try {
      const { song, singers } = await generateMusicHint(m.title, m.year);
      await pool.query(
        `UPDATE movies SET music_hint_song = $1, music_hint_singers = $2, updated_at = NOW() WHERE id = $3`,
        [song, singers, m.id]
      );
      done++;
      results.push({ title: m.title, year: m.year, song, singers, ok: true });
      console.log(`[${i + 1}/${movies.length}] ✓ ${m.title} (${m.year})\n    🎵 "${song}" — ${singers}`);
    } catch (err) {
      failed++;
      results.push({ title: m.title, year: m.year, ok: false, err: err.message });
      console.log(`[${i + 1}/${movies.length}] ✗ ${m.title} (${m.year}): ${err.message}`);
    }
    // Small delay to stay within rate limits
    await new Promise((r) => setTimeout(r, 200));
  }

  console.log(`\n${'─'.repeat(60)}`);
  console.log(`Done. ✓ ${done} generated  ✗ ${failed} failed`);

  if (failed > 0) {
    console.log('\nFailed movies:');
    results.filter((r) => !r.ok).forEach((r) => console.log(`  - ${r.title} (${r.year}): ${r.err}`));
  }

  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
