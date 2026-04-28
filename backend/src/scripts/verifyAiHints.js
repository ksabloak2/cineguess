/**
 * verifyAiHints.js — Cross-check every ai_hint_quote for factual accuracy.
 *
 * For each movie, asks Claude whether the logline contains any factually
 * wrong details (wrong characters, wrong plot points, wrong setting, etc.).
 * Loglines are *allowed* to be misleading/reductive, but must be technically
 * true. Flags anything that isn't.
 *
 * Usage:
 *   node src/scripts/verifyAiHints.js              # verify all
 *   node src/scripts/verifyAiHints.js --fix        # verify + auto-regenerate bad ones
 *   node src/scripts/verifyAiHints.js --limit 50   # sample first 50 (for testing)
 *
 * Output:
 *   Prints a report of flagged movies and (with --fix) regenerates them.
 */

const { Pool } = require('pg');
require('dotenv').config({ override: true });
const Anthropic = require('@anthropic-ai/sdk');

if (!process.env.ANTHROPIC_API_KEY) { console.error('Missing ANTHROPIC_API_KEY'); process.exit(1); }
if (!process.env.DATABASE_URL)      { console.error('Missing DATABASE_URL');      process.exit(1); }

const client = new Anthropic.default({ apiKey: process.env.ANTHROPIC_API_KEY });
const pool   = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

const FIX       = process.argv.includes('--fix');
const FIX_ONLY  = process.argv.includes('--fix-only'); // skip verify, regenerate flagged titles directly
const LIMIT = (() => { const i = process.argv.indexOf('--limit'); return i !== -1 ? parseInt(process.argv[i + 1], 10) : null; })();
const MODEL = 'claude-haiku-4-5';
// Rate limit: 50 req/min → 1 req per 1.25 s max.
// Sequential + 1.3 s gap keeps us safely under that ceiling.
const CONCURRENCY = 1;
const DELAY_MS    = 1300;
const MAX_RETRIES = 3;

// ── Verify prompt ──────────────────────────────────────────────────────────
const VERIFY_SYSTEM = `You are a lenient fact-checker for a "Movies Explained Badly" trivia game. You will be given a movie title, year, and a one-sentence logline written in a reductive, joke style.

These loglines are INTENTIONALLY misleading, reductive, and focus on minor details. That is fine and expected.

Only mark a logline as INACCURATE if it contains a HARD FACTUAL ERROR — meaning something that is completely impossible or fabricated about that specific film:
- A physical trait assigned to the wrong character (e.g. "metal arm" for a character who has no metal arm)
- A cause of death or injury that is factually wrong (e.g. "car accident" when it was actually a fire)
- A character described with completely wrong gender or role (e.g. calling the female lead "a man")
- A location or object that simply does not exist in the film
- The film being confused with a completely different film

DO NOT flag:
- Focusing on a minor subplot instead of the main plot (this is the whole point)
- Describing epic events as mundane (also the whole point)
- Reductive or uncharitable descriptions of real events (fine)
- Omitting important context (fine)
- A detail that is technically true even if it makes the film seem trivial

When in doubt, mark it as accurate. Only flag genuine fabrications that a viewer of the film would immediately call impossible.

Reply in exactly this JSON format (no markdown, no explanation outside the JSON):
{"accurate": true}
or
{"accurate": false, "reason": "one concise sentence explaining what specific fact is wrong"}`;

async function verify(title, year, logline, attempt = 0) {
  try {
    const resp = await client.messages.create({
      model: MODEL,
      max_tokens: 120,
      system: VERIFY_SYSTEM,
      messages: [{
        role: 'user',
        content: `Movie: ${title} (${year})\nLogline: ${logline}\n\nIs this factually accurate?`,
      }],
    });
    const raw = resp.content.filter((c) => c.type === 'text').map((c) => c.text).join('').trim();
    try {
      return JSON.parse(raw);
    } catch {
      return { accurate: null, reason: `unparseable response: ${raw.slice(0, 80)}` };
    }
  } catch (err) {
    const is429 = err?.status === 429 || String(err?.message).includes('rate_limit');
    if (is429 && attempt < MAX_RETRIES) {
      const backoff = (attempt + 1) * 5000; // 5s, 10s, 15s
      await new Promise((r) => setTimeout(r, backoff));
      return verify(title, year, logline, attempt + 1);
    }
    throw err;
  }
}

// ── Regenerate prompt (same style as generateAiHints.js) ──────────────────
const REGEN_SYSTEM = `You write "Movies Explained Badly" loglines for a movie guessing game.

The goal is to describe the movie in a way that is technically 100% accurate but intentionally misleading, reductive, or absurdly narrow. Think: a Reddit comment from someone who completely missed the point.

Style rules:
- Output exactly ONE sentence. Max 30 words. No quotation marks. No emoji. No prefix like "Hint:" — just the sentence.
- NEVER name the movie, the director, any actor, any character name, any franchise, or any sequel number.
- NEVER use words that appear in the movie's title.

Techniques to use (pick the best fit for the film):
1. MINOR DETAIL AS MAIN PLOT — fixate on a trivial side event and present it as the whole story.
2. STRIP THE SCALE — describe epic or fantastical events as mundane everyday problems.
3. VILLAIN FRAMING — describe the hero's actions as if they are the antagonist.
4. ABSURDLY LITERAL — describe exactly what physically happens, ignoring all subtext and meaning.

Character descriptions: never use names. Use generic labels like "a farm boy," "a noseless guy," "a high-maintenance foodie," etc.

The sentence must be punchy and dry — technically not lying, but completely unhelpful as a plot summary.`;

async function regenerate(title, year) {
  const resp = await client.messages.create({
    model: MODEL,
    max_tokens: 80,
    system: REGEN_SYSTEM,
    messages: [{ role: 'user', content: `Movie: ${title} (${year})\n\nWrite the logline.` }],
  });
  return resp.content.filter((c) => c.type === 'text').map((c) => c.text).join('').trim()
    .replace(/^["']|["']$/g, '').replace(/^Hint:\s*/i, '').replace(/^Logline:\s*/i, '');
}

// ── Sequential runner with fixed delay between requests ───────────────────
// Keeps us under the 50 req/min Haiku rate limit.
async function runSequentially(tasks, fn) {
  const results = [];
  for (let i = 0; i < tasks.length; i++) {
    results.push(await fn(tasks[i], i));
    if (i < tasks.length - 1) await new Promise((r) => setTimeout(r, DELAY_MS));
  }
  return results;
}

// ── Main ───────────────────────────────────────────────────────────────────
async function main() {
  // --fix-only: skip re-verification, regenerate a pre-known list of flagged titles
  if (FIX_ONLY) {
    const FLAGGED_TITLES = [
      '50 First Dates',
      '83',
      'A Minecraft Movie',
      'Alice in Wonderland',
      'Anatomy of a Fall',
      'Animal',
      'Baaghi',
      'Baar Baar Dekho',
      'Badrinath Ki Dulhania',
      'Bāhubali 2: The Conclusion',
      'Barfi!',
      'Bugonia',
      'Cocktail',
      'Companion',
      'Coraline',
      'Despicable Me 4',
      'Ek Villain',
      'Flushed Away',
      'Frankenstein',
      'Inside Out',
      'Iqbal',
      'Jawan',
      'Jennifer\'s Body',
      'Justice League',
      'Kabhi Khushi Kabhie Gham',
      'KPop Demon Hunters',
      'Krrish',
      'Lilo & Stitch',
      'Malang',
      'Me Before You',
      'Mission: Impossible - Rogue Nation',
      'Moana 2',
      'Mufasa: The Lion King',
      'Nope',
      'Parasite',
      'Pushpa: The Rise - Part 1',
      'RRR',
      'Shang-Chi and the Legend of the Ten Rings',
      'Shershaah',
      'Sooryavanshi',
      'Spider-Man: No Way Home',
      'The Amazing Spider-Man 2',
      'The Batman',
      'The Dark Knight Rises',
      'The Mask',
      'The Menu',
      'The Whale',
      'Thor: Love and Thunder',
      'Tuck Everlasting',
      'Wakanda Forever',
      'War',
      'Where the Crawdads Sing',
      'Wonka',
      'Yes Man',
      'Zootopia',
    ];

    const placeholders = FLAGGED_TITLES.map((_, i) => `$${i + 1}`).join(',');
    const { rows: movies } = await pool.query(
      `SELECT id, title, year, ai_hint_quote FROM movies WHERE title = ANY(ARRAY[${placeholders}]) ORDER BY title`,
      FLAGGED_TITLES
    );

    console.log(`\n🔧  Regenerating ${movies.length} previously-flagged loglines (skipping re-verify)...\n`);
    let fixed = 0;
    for (const m of movies) {
      try {
        const newLogline = await regenerate(m.title, m.year);
        if (!newLogline) throw new Error('empty response');
        await pool.query(
          `UPDATE movies SET ai_hint_quote = $1, updated_at = NOW() WHERE id = $2`,
          [newLogline, m.id]
        );
        console.log(`  ✓  ${m.title} (${m.year})\n     → ${newLogline}\n`);
        fixed++;
      } catch (err) {
        console.log(`  ✗  ${m.title} (${m.year}): ${err.message}\n`);
      }
      await new Promise((r) => setTimeout(r, 100));
    }
    console.log(`Fixed ${fixed}/${movies.length} loglines.\n`);
    await pool.end();
    return;
  }

  let { rows: movies } = await pool.query(
    `SELECT id, title, year, ai_hint_quote
       FROM movies
      WHERE ai_hint_quote IS NOT NULL AND ai_hint_quote != ''
      ORDER BY title`
  );

  if (LIMIT) movies = movies.slice(0, LIMIT);

  const estMins = Math.ceil((movies.length * DELAY_MS) / 60000);
  console.log(`\nVerifying ${movies.length} loglines (model=${MODEL}, ~${estMins} min estimated)...\n`);

  const flagged   = [];
  const unknown   = [];
  let   checked   = 0;

  const results = await runSequentially(movies, async (m, i) => {
    try {
      const result = await verify(m.title, m.year, m.ai_hint_quote);
      checked++;
      if (i > 0 && i % 50 === 0) process.stdout.write(` ${i}\n`);
      else process.stdout.write(result.accurate === false ? 'X' : result.accurate === null ? '?' : '.');
      return { m, result };
    } catch (err) {
      process.stdout.write('E');
      return { m, result: { accurate: null, reason: err.message } };
    }
  });

  process.stdout.write('\n');

  for (const { m, result } of results) {
    if (result.accurate === false) flagged.push({ m, reason: result.reason });
    else if (result.accurate === null) unknown.push({ m, reason: result.reason });
  }

  // ── Report ──────────────────────────────────────────────────────────────
  console.log(`\n${'─'.repeat(72)}`);
  console.log(`Checked: ${checked}  |  Flagged (inaccurate): ${flagged.length}  |  Unknown: ${unknown.length}`);
  console.log('─'.repeat(72));

  if (flagged.length === 0) {
    console.log('\n✅  All loglines appear factually accurate.\n');
  } else {
    console.log(`\n❌  FLAGGED (${flagged.length}):\n`);
    for (const { m, reason } of flagged) {
      console.log(`  ${m.title} (${m.year})`);
      console.log(`    Current:  "${m.ai_hint_quote}"`);
      console.log(`    Problem:  ${reason}\n`);
    }
  }

  if (unknown.length > 0) {
    console.log(`\n⚠️  UNKNOWN / parse error (${unknown.length}):\n`);
    for (const { m, reason } of unknown) {
      console.log(`  ${m.title} (${m.year}): ${reason}`);
    }
    console.log('');
  }

  // ── Auto-fix ─────────────────────────────────────────────────────────────
  if (FIX && flagged.length > 0) {
    console.log(`\n🔧  Regenerating ${flagged.length} flagged loglines...\n`);
    let fixed = 0;
    for (const { m } of flagged) {
      try {
        const newLogline = await regenerate(m.title, m.year);
        if (!newLogline) throw new Error('empty response');
        await pool.query(
          `UPDATE movies SET ai_hint_quote = $1, updated_at = NOW() WHERE id = $2`,
          [newLogline, m.id]
        );
        console.log(`  ✓  ${m.title} (${m.year})\n     → ${newLogline}\n`);
        fixed++;
      } catch (err) {
        console.log(`  ✗  ${m.title} (${m.year}): ${err.message}\n`);
      }
      await new Promise((r) => setTimeout(r, 100));
    }
    console.log(`Fixed ${fixed}/${flagged.length} flagged loglines.\n`);
    console.log('Run the script again (without --fix) to verify the new loglines.\n');
  } else if (FIX && flagged.length === 0) {
    console.log('Nothing to fix.\n');
  } else if (!FIX && flagged.length > 0) {
    console.log('Run with --fix to automatically regenerate flagged loglines:\n');
    console.log('  node src/scripts/verifyAiHints.js --fix\n');
  }

  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
