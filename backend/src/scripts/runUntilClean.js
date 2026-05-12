/**
 * Verify → fix → verify loop.
 * Only regenerates loglines that fail verification each round.
 * Stops when zero failures remain (or no progress after a round).
 *
 * Usage:
 *   node src/scripts/runUntilClean.js
 */

const { Pool } = require('pg');
require('dotenv').config({ override: true });
const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic.default({ apiKey: process.env.ANTHROPIC_API_KEY });
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const MODEL = 'claude-sonnet-4-5';
const BATCH_SIZE = 20;

// ─── Verifier ────────────────────────────────────────────────────────────────

const CHECKER_PROMPT = `You are a quality auditor for a movie guessing game that uses "Movies Explained Badly" loglines.

For each logline, check ALL THREE of these criteria:

A) TOO OBVIOUS: Does the logline directly describe the movie's title concept, central premise, or a detail that makes it immediately recognizable in under 3 words?
   - e.g. for "Frozen": mentions ice, snow, or freezing → FAIL
   - e.g. for a superhero movie: mentions powers, costume, or hero identity → FAIL
   - e.g. central premise stated so bluntly anyone who's heard of the film knows it instantly → FAIL

B) TOO VAGUE: Could this logline apply to 50+ different movies with zero foothold for someone who's seen the film?
   - Generic "man has bad day at work," "family experiences crisis," "two people fall in love" with no specifics → FAIL
   - Must have at least ONE concrete anchor: a distinctive setting, unusual circumstance, specific scenario, or recognizable moment

C) BAD FORMULA VIOLATION: Does it violate the "Movies Explained Badly" style?
   - Describes events too literally/straightforwardly (no misdirection, no reductive framing)
   - Uses character names, movie title, actor names, director name
   - More than 35 words
   - Incomplete sentence

Format (one per line, no extra text):
[ID] PASS
[ID] FAIL_A: [brief reason]
[ID] FAIL_B: [brief reason]
[ID] FAIL_C: [brief reason]
[ID] FAIL_AB: [brief reason]
etc.`;

async function verifyBatch(movies) {
  const list = movies
    .map((m) => `[${m.id}] ${m.title} (${m.year}): "${m.ai_hint_quote}"`)
    .join('\n');

  const resp = await client.messages.create({
    model: MODEL,
    max_tokens: 1200,
    system: CHECKER_PROMPT,
    messages: [{ role: 'user', content: `Check these loglines:\n\n${list}` }],
  });

  const text = resp.content.filter((c) => c.type === 'text').map((c) => c.text).join('').trim();
  const results = [];
  for (const line of text.split('\n').filter((l) => l.trim())) {
    const match = line.match(/\[(\d+)\]\s+(PASS|FAIL[_A-Z]*)(:\s*(.+))?/);
    if (match) {
      results.push({ id: parseInt(match[1]), status: match[2], reason: match[4] || '' });
    }
  }
  return results;
}

async function verifyAll(movies) {
  const flagged = [];
  let passed = 0;
  process.stdout.write('  Verifying: ');
  for (let i = 0; i < movies.length; i += BATCH_SIZE) {
    const batch = movies.slice(i, i + BATCH_SIZE);
    try {
      const results = await verifyBatch(batch);
      for (const r of results) {
        if (r.status === 'PASS') {
          passed++;
          process.stdout.write('.');
        } else {
          const movie = batch.find((m) => m.id === r.id);
          if (movie) {
            flagged.push({ ...movie, status: r.status, issue: r.reason });
            process.stdout.write('X');
          }
        }
      }
    } catch (err) {
      process.stdout.write('?'.repeat(batch.length));
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  process.stdout.write(`\n  passed=${passed} flagged=${flagged.length}\n`);
  return flagged;
}

// ─── Fixer ───────────────────────────────────────────────────────────────────

const FIX_PROMPT = `You write "Movies Explained Badly" loglines for a movie guessing game.

The goal is to describe the movie in a way that is technically 100% accurate but intentionally misleading, reductive, or absurdly narrow. Think: a Reddit comment from someone who completely missed the point.

HARD RULES — violating any of these is a failure:
- Output exactly ONE complete sentence. Max 35 words. No quotation marks. No emoji. No prefix like "Hint:" — just the sentence.
- NEVER name the movie, the director, any actor, any character name, any franchise, or any sequel number.
- NEVER use words that appear in the movie's title — not the words AND not the concept the title refers to.
  Examples: "Frozen" → no ice/snow/freezing; "The Whale" → no whales/ocean; "Up" → no rising/floating/balloons; "Alien" → no aliens/space creatures; "Back to the Future" → no time travel/time machines.
- NEVER describe the central premise so directly that the movie is immediately obvious within 3 words. Bury the lead.
- SUPERHERO MOVIES ONLY: NEVER mention the hero's powers, abilities, costume appearance, color, or any detail that identifies their superhero identity.
- NEVER use politically charged or insensitive terms (immigrant, illegal, refugee, alien in political context).
- NEVER trivialize historical atrocities.

REQUIRED — the logline MUST contain at least ONE specific, concrete anchor:
- A distinctive physical setting, unusual circumstance, or recognizable scenario
- Something that lets a player who has seen the film eventually confirm their guess
- Generic descriptions with zero context are failures

Techniques (pick whichever makes it hardest to identify while keeping ONE anchor):
1. MINOR DETAIL AS MAIN PLOT — fixate on a trivial side event
2. STRIP THE SCALE — describe epic events as mundane problems
3. VILLAIN FRAMING — from the antagonist's perspective
4. ZOOM IN ON ONE SCENE — a single 30-second moment
5. WRONG GENRE — describe the film as a completely different genre

The sentence must be punchy and dry. Player should need 5+ seconds before the penny drops.`;

async function fixOne(m) {
  const isSuperhero = (m.categories || []).includes('superhero');
  const categoryNote = isSuperhero
    ? '\nCategory: SUPERHERO — absolutely no powers, costume, or hero identity clues.'
    : '';
  const avoidNote = m.issue
    ? `\nPREVIOUS FAILURE: "${m.issue}"\nThe new logline must specifically avoid this problem.`
    : '';

  const userPrompt = `Movie: ${m.title} (${m.year})${categoryNote}${avoidNote}

Write 3 logline candidates. Each must avoid the previous failure and have at least one specific anchor.
Then pick the one hardest to identify immediately but still solvable.

Format:
1: [candidate]
2: [candidate]
3: [candidate]
BEST: [number]
FINAL: [chosen logline]`;

  const resp = await client.messages.create({
    model: MODEL,
    max_tokens: 400,
    system: FIX_PROMPT,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const text = resp.content.filter((c) => c.type === 'text').map((c) => c.text).join('').trim();
  const match = text.match(/FINAL:\s*(.+)/);
  if (!match) {
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
    const last = lines[lines.length - 1];
    return last.replace(/^[0-9]+:\s*/, '').replace(/^["']|["']$/g, '').replace(/^Hint:\s*/i, '');
  }
  return match[1].trim().replace(/^["']|["']$/g, '').replace(/^Hint:\s*/i, '');
}

async function fixAll(flagged) {
  let fixed = 0;
  let failed = 0;
  process.stdout.write('  Fixing:    ');
  for (let i = 0; i < flagged.length; i++) {
    const m = flagged[i];
    try {
      const clue = await fixOne(m);
      if (!clue || clue.length < 10) throw new Error('empty clue');
      await pool.query(
        `UPDATE movies SET ai_hint_quote = $1, updated_at = NOW() WHERE id = $2`,
        [clue, m.id]
      );
      fixed++;
      process.stdout.write('.');
    } catch (err) {
      failed++;
      if (err.message.includes('credit balance')) {
        console.log(`\n  ✗ Out of credits — stopping at ${i}/${flagged.length}`);
        break;
      }
      process.stdout.write('!');
    }
    if ((i + 1) % 50 === 0) process.stdout.write(` ${i + 1}/${flagged.length}\n  Fixing:    `);
    await new Promise((r) => setTimeout(r, 200));
  }
  process.stdout.write(`\n  fixed=${fixed} failed=${failed}\n`);
  return { fixed, failed };
}

// ─── Main loop ───────────────────────────────────────────────────────────────

const fs = require('fs');

async function fetchByIds(ids) {
  const { rows } = await pool.query(
    `SELECT id, title, year, ai_hint_quote, categories
     FROM movies WHERE id = ANY($1) ORDER BY title`,
    [ids]
  );
  return rows;
}

async function main() {
  // Load the already-known flagged list — never re-scan movies that passed
  let flagged = JSON.parse(fs.readFileSync('/tmp/quality_flagged.json', 'utf8'));
  console.log(`Starting from saved flagged list: ${flagged.length} movies\n`);

  let round = 1;

  while (flagged.length > 0) {
    console.log(`── Round ${round} — fixing ${flagged.length} flagged ──────────────────────`);

    const { fixed, failed } = await fixAll(flagged);

    if (fixed === 0) {
      console.log('\nNo fixes succeeded (likely out of credits). Stopping.\n');
      break;
    }

    // Re-verify ONLY the ones we just fixed
    const ids = flagged.map(f => f.id);
    console.log(`\n  Re-verifying ${ids.length} just-fixed loglines...`);
    const recheckMovies = await fetchByIds(ids);
    flagged = await verifyAll(recheckMovies);

    if (flagged.length === 0) {
      console.log('\n✅ All previously flagged loglines now pass!\n');
      break;
    }

    console.log(`  Still failing: ${flagged.length}`);
    console.log(`    Too obvious (A): ${flagged.filter(f => f.status.includes('A')).length}`);
    console.log(`    Too vague   (B): ${flagged.filter(f => f.status.includes('B')).length}`);
    console.log(`    Bad formula (C): ${flagged.filter(f => f.status.includes('C')).length}\n`);

    round++;
    await new Promise((r) => setTimeout(r, 300));
  }

  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
