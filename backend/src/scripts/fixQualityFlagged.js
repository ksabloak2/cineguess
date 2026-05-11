/**
 * Fix loglines flagged by verifyLoglineQuality.js.
 * Uses the specific failure reason to guide the regeneration.
 *
 * Usage:
 *   node src/scripts/fixQualityFlagged.js
 */

const { Pool } = require('pg');
require('dotenv').config({ override: true });
const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');

const client = new Anthropic.default({ apiKey: process.env.ANTHROPIC_API_KEY });
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const MODEL = 'claude-sonnet-4-5';

const SYSTEM_PROMPT = `You write "Movies Explained Badly" loglines for a movie guessing game.

The goal is to describe the movie in a way that is technically 100% accurate but intentionally misleading, reductive, or absurdly narrow. Think: a Reddit comment from someone who completely missed the point.

HARD RULES — violating any of these is a failure:
- Output exactly ONE sentence. Max 35 words. No quotation marks. No emoji. No prefix like "Hint:" — just the sentence.
- NEVER name the movie, the director, any actor, any character name, any franchise, or any sequel number.
- NEVER use words that appear in the movie's title — not the words AND not the concept the title refers to.
  Examples: "Frozen" → no ice/snow/freezing; "The Whale" → no whales/ocean; "Up" → no rising/floating/balloons; "Alien" → no aliens/space creatures; "Back to the Future" → no time travel/time machines/going back.
- NEVER describe the central premise so directly that the movie is immediately obvious within 3 words. Bury the lead.
- SUPERHERO MOVIES ONLY: NEVER mention the hero's powers, abilities, costume appearance, color, or any detail that identifies their superhero identity.
- NEVER use politically charged or insensitive terms (immigrant, illegal, refugee, alien in political context).
- NEVER trivialize historical atrocities (e.g. framing slavery as a job offer).

REQUIRED — the logline MUST contain at least ONE specific, concrete anchor detail:
- A distinctive physical setting, unusual circumstance, or recognizable scenario
- Something that lets a player who has seen the film eventually confirm their guess
- Generic life/work descriptions with zero context are failures

Techniques (pick whichever makes it hardest to identify):
1. MINOR DETAIL AS MAIN PLOT — fixate on a trivial side event as if it's the whole story
2. STRIP THE SCALE — describe epic events as mundane problems
3. VILLAIN FRAMING — describe events from the antagonist's perspective
4. ZOOM IN ON ONE SCENE — describe a single 30-second moment
5. WRONG GENRE — describe the film as if it's a completely different genre

The sentence must be punchy and dry. A player who knows the film should need 5+ seconds before the penny drops.`;

async function generateClue(title, year, categories = [], failReason = '') {
  const isSuperhero = categories.includes('superhero');
  const categoryNote = isSuperhero
    ? '\nCategory: SUPERHERO — absolutely no powers, costume, or hero identity clues.'
    : '';

  const avoidNote = failReason
    ? `\nPREVIOUS FAILURE: "${failReason}"\nThe new logline must specifically avoid this problem.`
    : '';

  const userPrompt = `Movie: ${title} (${year})${categoryNote}${avoidNote}

Write 3 logline candidates. Each must:
- Avoid whatever made the previous version fail (see above)
- Have at least one specific anchor detail so it's solvable
- Use misdirection — zoom in on a side detail, strip the scale, use wrong-genre framing, etc.

Then pick the one that is hardest to identify immediately but still solvable by someone who's seen the film.

Format:
1: [candidate]
2: [candidate]
3: [candidate]
BEST: [number]
FINAL: [chosen logline]`;

  const resp = await client.messages.create({
    model: MODEL,
    max_tokens: 400,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const text = resp.content
    .filter((c) => c.type === 'text')
    .map((c) => c.text)
    .join('')
    .trim();

  const finalMatch = text.match(/FINAL:\s*(.+)/);
  if (!finalMatch) {
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
    const last = lines[lines.length - 1];
    return last.replace(/^[0-9]+:\s*/, '').replace(/^["']|["']$/g, '').replace(/^Hint:\s*/i, '');
  }
  return finalMatch[1].trim().replace(/^["']|["']$/g, '').replace(/^Hint:\s*/i, '');
}

async function main() {
  const flagged = JSON.parse(fs.readFileSync('/tmp/quality_flagged.json', 'utf8'));

  console.log(`Fixing ${flagged.length} flagged loglines...\n`);

  let fixed = 0;
  let failed = 0;

  for (let i = 0; i < flagged.length; i++) {
    const m = flagged[i];
    try {
      const clue = await generateClue(m.title, m.year, m.categories || [], m.issue || '');
      if (!clue || clue.length < 10) throw new Error('empty or too-short clue');
      await pool.query(
        `UPDATE movies SET ai_hint_quote = $1, updated_at = NOW() WHERE id = $2`,
        [clue, m.id]
      );
      fixed++;
      process.stdout.write('.');
    } catch (err) {
      failed++;
      console.log(`\n  ✗ ${m.title} (${m.year}): ${err.message}`);
    }

    if ((i + 1) % 10 === 0) process.stdout.write(` ${i + 1}/${flagged.length}\n`);
    await new Promise((r) => setTimeout(r, 200));
  }

  console.log(`\n\nDone. fixed=${fixed} failed=${failed}\n`);

  // Show sample fixes
  const ids = flagged.slice(0, 15).map((m) => m.id);
  const samples = await pool.query(
    `SELECT title, year, ai_hint_quote FROM movies WHERE id = ANY($1) ORDER BY title`,
    [ids]
  );
  console.log('Sample fixes:');
  samples.rows.forEach((r) =>
    console.log(`  ${r.title} (${r.year})\n    -> ${r.ai_hint_quote}\n`)
  );

  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
