/**
 * generateMusicHints.js
 *
 * For every movie in the 'indiancinema' category, generates:
 *   music_hint_song    — the most iconic/recognizable song from that film
 *   music_hint_singers — lead playback singer(s) for that track
 *
 * Fallback rule: if the top song's name matches the movie title (e.g.
 * "Ae Dil Hai Mushkil"), the SECOND most popular song is used instead.
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

const client = new Anthropic.default({ apiKey: process.env.ANTHROPIC_API_KEY });
const pool   = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

const FORCE = process.argv.includes('--force');
const MODEL = 'claude-haiku-4-5';

const SYSTEM = `You are a Bollywood and Indian cinema music expert. Your task is to identify the single most iconic, widely-recognized song from a given Indian film.

Rules:
1. Output ONLY a JSON object on one line with exactly two keys: "song" and "singers".
   Example: {"song":"Naatu Naatu","singers":"Rahul Sipligunj, Kaala Bhairava"}
2. "song" — the most popular/recognizable song from the film. The one a general audience would associate with the movie.
3. "singers" — the lead playback vocalist(s) for that specific song, comma-separated. No composers, no lyricists.
4. FALLBACK: If the most popular song title is the same as (or nearly identical to) the movie title, use the SECOND most popular song instead.
5. Accuracy is critical. Do not invent songs. If genuinely unsure, use the title track but verify the singer.
6. No markdown, no explanation — just the raw JSON object.`;

function normalize(s) {
  return (s || '').toLowerCase().replace(/[^a-z0-9]/g, '').trim();
}

async function generateMusicHint(title, year) {
  const prompt = `Movie: ${title} (${year})\n\nReturn the most iconic song and its lead playback singer(s) as JSON.`;
  const resp = await client.messages.create({
    model: MODEL,
    max_tokens: 120,
    system: SYSTEM,
    messages: [{ role: 'user', content: prompt }],
  });
  const raw = resp.content.filter((c) => c.type === 'text').map((c) => c.text).join('').trim();
  // Extract the first {...} block from the response, ignoring surrounding text/markdown
  const match = raw.match(/\{[^{}]*"song"[^{}]*"singers"[^{}]*\}|\{[^{}]*"singers"[^{}]*"song"[^{}]*\}/);
  if (!match) throw new Error(`No JSON object found in response: ${raw.slice(0, 120)}`);
  const parsed = JSON.parse(match[0]);
  if (!parsed.song || !parsed.singers) throw new Error('Missing song or singers in response');

  // Apply fallback: if song name ≈ movie title, regenerate asking for the second song
  if (normalize(parsed.song) === normalize(title)) {
    const fallbackPrompt = `Movie: ${title} (${year})\n\nThe most popular song shares the same name as the movie title. Please identify the SECOND most popular/iconic song from this film and its lead playback singer(s). Return as JSON.`;
    const resp2 = await client.messages.create({
      model: MODEL,
      max_tokens: 120,
      system: SYSTEM,
      messages: [{ role: 'user', content: fallbackPrompt }],
    });
    const raw2    = resp2.content.filter((c) => c.type === 'text').map((c) => c.text).join('').trim();
    const match2  = raw2.match(/\{[^{}]*"song"[^{}]*"singers"[^{}]*\}|\{[^{}]*"singers"[^{}]*"song"[^{}]*\}/);
    if (!match2) throw new Error(`No JSON in fallback response: ${raw2.slice(0, 120)}`);
    const parsed2  = JSON.parse(match2[0]);
    if (parsed2.song && parsed2.singers) return parsed2;
  }

  return parsed;
}

async function main() {
  const filter = FORCE
    ? ''
    : `AND (music_hint_song IS NULL OR music_hint_song = '')`;
  const { rows: movies } = await pool.query(
    `SELECT id, title, year FROM movies WHERE 'indiancinema' = ANY(categories) ${filter} ORDER BY title`
  );

  console.log(`Generating music hints for ${movies.length} Indian Cinema movies (force=${FORCE}, model=${MODEL})...\n`);

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
      process.stdout.write('.');
    } catch (err) {
      failed++;
      console.log(`\n  ✗ ${m.title} (${m.year}): ${err.message}`);
    }
    if ((i + 1) % 50 === 0) process.stdout.write(` ${i + 1}\n`);
    await new Promise((r) => setTimeout(r, 80));
  }

  console.log(`\n\nDone. generated=${done} failed=${failed}\n`);

  // Sample output
  const { rows: samples } = await pool.query(
    `SELECT title, year, music_hint_song, music_hint_singers
     FROM movies WHERE 'indiancinema' = ANY(categories) AND music_hint_song IS NOT NULL
     ORDER BY random() LIMIT 8`
  );
  console.log('Sample music hints:');
  samples.forEach((r) =>
    console.log(`  ${r.title} (${r.year})\n    🎵 "${r.music_hint_song}" — ${r.music_hint_singers}\n`)
  );

  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
