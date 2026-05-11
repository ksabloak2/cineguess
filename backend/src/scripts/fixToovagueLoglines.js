/**
 * Fix too-vague loglines flagged by the verification pass.
 * Regenerates each one with a prompt that requires at least ONE specific,
 * concrete anchor detail so players have a foothold.
 *
 * Usage:
 *   node src/scripts/fixToovagueLoglines.js
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
- NEVER use words that appear in the movie's title — not the words AND not the concept the title refers to (e.g. for "The Whale" don't mention whales or the ocean; for "Up" don't mention going upward or balloons; for "Frozen" don't mention ice/snow/freezing).
- NEVER describe the central premise so directly that the movie is immediately obvious within 3 words. Bury the lead.
- SUPERHERO MOVIES ONLY: NEVER mention the hero's powers, abilities, costume appearance, color, or any detail that identifies their superhero identity. Describe civilian drama, a side character's problem, the villain's mundane motivation, or a throwaway scene instead.
- NEVER use politically charged or insensitive terms (immigrant, illegal, refugee, alien in political context, etc.).
- NEVER trivialize historical atrocities with employment/job framing (e.g. don't describe slavery as a job offer).

REQUIRED — the logline MUST contain at least ONE specific, concrete detail that anchors it to THIS film:
- A distinctive physical setting (trench warfare, a Swedish commune, a cotton plantation, a blocky dimension, a hotel in the Rockies)
- An unusual circumstance that narrows it down significantly (waking up in chains, building everything from cubes, reliving the same day)
- A specific relationship dynamic or character combination that isn't generic (estranged father-son at a wrestling dynasty, two strangers bonded in a locked shipping container)
- A scenario or event that is recognizable to anyone who's seen the film
- Think "two men race through active trenches to deliver an urgent message" not "man has a bad day at work"
- Generic workplace/job/life descriptions with zero context are FAILURES

Techniques to use (pick whichever makes the movie hardest to identify while keeping ONE anchor):
1. MINOR DETAIL AS MAIN PLOT — fixate on a trivial side event as if it's the whole story
2. STRIP THE SCALE — describe epic/fantastical events as mundane problems
3. VILLAIN FRAMING — describe events entirely from the antagonist's perspective
4. ZOOM IN ON ONE SCENE — describe a single 30-second moment as if it explains everything
5. WRONG GENRE — describe the film as if it belongs to a completely different genre

Character descriptions: never use names. Use generic labels like "a grieving widower," "a teenager with authority issues," "an overly attached parent," etc.

The sentence must be punchy and dry. A cinephile who has seen the movie should need at least 5 seconds before the penny drops — but they SHOULD be able to confirm it eventually from the specific detail you included.`;

async function generateClue(title, year, categories = [], issue = '') {
  const isSuperhero = categories.includes('superhero');
  const categoryNote = isSuperhero
    ? '\nCategory: SUPERHERO — apply the superhero-specific rule (no powers, no costume, no identity clues).'
    : '';
  const issueNote = issue
    ? `\nPREVIOUS FAILURE REASON: ${issue}\nMake sure the new logline fixes this specific problem.`
    : '';

  const userPrompt = `Movie: ${title} (${year})${categoryNote}${issueNote}

Generate 3 different logline candidates. Each must have at least one specific concrete detail that anchors it to this particular film.
Then analyze which is least obvious while still having a real hook.
Output format:
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
    // Fallback: try to extract last non-empty line
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const last = lines[lines.length - 1];
    return last.replace(/^[0-9]+:\s*/, '').replace(/^[\"']|[\"']$/g, '').replace(/^Hint:\s*/i, '');
  }
  return finalMatch[1].trim().replace(/^[\"']|[\"']$/g, '').replace(/^Hint:\s*/i, '');
}

async function main() {
  // Load flagged list
  const flagged = JSON.parse(fs.readFileSync('/tmp/toovague_loglines.json', 'utf8'));

  // Skip movies with invalid/error loglines
  const SKIP_IDS = new Set([2654, 2655]); // Devil Wears Prada 2 (fake movie), The Drama (fragment)
  const toFix = flagged.filter((m) => !SKIP_IDS.has(m.id));

  console.log(`Regenerating ${toFix.length} flagged loglines...\n`);

  // Fetch categories for all movies
  const ids = toFix.map((m) => m.id);
  const { rows: dbMovies } = await pool.query(
    `SELECT id, categories FROM movies WHERE id = ANY($1)`,
    [ids]
  );
  const categoryMap = {};
  dbMovies.forEach((r) => { categoryMap[r.id] = r.categories || []; });

  let fixed = 0;
  let failed = 0;

  for (let i = 0; i < toFix.length; i++) {
    const m = toFix[i];
    const categories = categoryMap[m.id] || [];
    try {
      const clue = await generateClue(m.title, m.year, categories, m.issue || '');
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
    if ((i + 1) % 10 === 0) process.stdout.write(` ${i + 1}/${toFix.length}\n`);
    await new Promise((r) => setTimeout(r, 200));
  }

  console.log(`\n\nDone. fixed=${fixed} failed=${failed}\n`);

  // Show 10 random samples
  const samples = await pool.query(
    `SELECT title, year, ai_hint_quote FROM movies WHERE id = ANY($1) ORDER BY random() LIMIT 10`,
    [ids]
  );
  console.log('Sample fixes:');
  samples.rows.forEach((r) => console.log(`  ${r.title} (${r.year})\n    -> ${r.ai_hint_quote}\n`));

  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
