/**
 * Generate an AI-written "Movies Explained Badly" logline for every movie
 * across all categories and store it in movies.ai_hint_quote.
 *
 * Style: technically true, intentionally misleading. Focus on minor details,
 * strip out the magic/epic scale, occasionally frame the hero as the villain.
 * Feels like a Reddit comment, not a film synopsis.
 *
 * Usage:
 *   node src/scripts/generateAiHints.js          # only fills missing
 *   node src/scripts/generateAiHints.js --force  # regenerate everything
 */

const { Pool } = require('pg');
// override:true so an empty shell-env ANTHROPIC_API_KEY can't shadow .env
require('dotenv').config({ override: true });
const Anthropic = require('@anthropic-ai/sdk');

if (!process.env.ANTHROPIC_API_KEY) {
  console.error('Missing ANTHROPIC_API_KEY in .env');
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error('Missing DATABASE_URL in .env');
  process.exit(1);
}

const client = new Anthropic.default({ apiKey: process.env.ANTHROPIC_API_KEY });
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const FORCE = process.argv.includes('--force');
const MODEL = 'claude-haiku-4-5';

const SYSTEM_PROMPT = `You write "Movies Explained Badly" loglines for a movie guessing game.

The goal is to describe the movie in a way that is technically 100% accurate but intentionally misleading, reductive, or absurdly narrow. Think: a Reddit comment from someone who completely missed the point.

Style rules:
- Output exactly ONE sentence. Max 30 words. No quotation marks. No emoji. No prefix like "Hint:" — just the sentence.
- NEVER name the movie, the director, any actor, any character name, any franchise, or any sequel number.
- NEVER use words that appear in the movie's title.

Techniques to use (pick the best fit for the film):
1. MINOR DETAIL AS MAIN PLOT — fixate on a trivial side event and present it as the whole story. e.g. Lord of the Rings → "A group of people spend 9 hours returning some jewelry."
2. STRIP THE SCALE — describe epic or fantastical events as mundane everyday problems. e.g. Up → "An elderly man abducts an overweight boy to replace his dead wife."
3. VILLAIN FRAMING — describe the hero's actions as if they are the antagonist. e.g. Batman → "A billionaire beats up the mentally ill while dressed as a giant bat."
4. ABSURDLY LITERAL — describe exactly what physically happens, ignoring all subtext and meaning. e.g. The Shining → "A family's first winter in a hotel goes poorly due to a lack of indoor activities."

Character descriptions: never use names. Use generic labels like "a farm boy," "a noseless guy," "a high-maintenance foodie," "an angry Scottish dad," "a billionaire in a metal suit," etc.

The sentence must be punchy and dry — technically not lying, but completely unhelpful as a plot summary.`;

// Reference examples (for prompt calibration):
// The Wizard of Oz → "American girl invades a foreign land, kills the first person she meets, and teams up with strangers to kill again."
// Finding Nemo    → "An overprotective father tracks down the kidnapper who took his disabled son."
// Harry Potter    → "A noseless guy has an unhealthy obsession with a teenage boy."

async function generateClue(title, year) {
  const userPrompt = `Movie: ${title} (${year})\n\nWrite the logline.`;
  const resp = await client.messages.create({
    model: MODEL,
    max_tokens: 80,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userPrompt }],
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

async function main() {
  const filter = FORCE
    ? ``
    : `WHERE (ai_hint_quote IS NULL OR ai_hint_quote = '')`;

  const { rows: movies } = await pool.query(
    `SELECT id, title, year FROM movies ${filter} ORDER BY title`
  );

  console.log(`Generating clues for ${movies.length} movies (force=${FORCE}, model=${MODEL})...\n`);

  let done = 0;
  let failed = 0;

  for (let i = 0; i < movies.length; i++) {
    const m = movies[i];
    try {
      const clue = await generateClue(m.title, m.year);
      if (!clue) throw new Error('empty clue from model');
      await pool.query(`UPDATE movies SET ai_hint_quote = $1, updated_at = NOW() WHERE id = $2`, [clue, m.id]);
      done++;
      process.stdout.write('.');
    } catch (err) {
      failed++;
      console.log(`\n  ✗ ${m.title} (${m.year}): ${err.message}`);
    }
    if ((i + 1) % 50 === 0) process.stdout.write(` ${i + 1}\n`);
    // be polite to the API; Claude Haiku rate limits are very generous but no need to hammer
    await new Promise((r) => setTimeout(r, 50));
  }

  console.log(`\n\nDone. generated=${done} failed=${failed}\n`);

  // Quick sanity: show 5 random samples
  const samples = await pool.query(
    `SELECT title, year, ai_hint_quote FROM movies WHERE ai_hint_quote IS NOT NULL ORDER BY random() LIMIT 5`
  );
  console.log('Sample clues:');
  samples.rows.forEach((r) => console.log(`  ${r.title} (${r.year})\n    → ${r.ai_hint_quote}\n`));

  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
