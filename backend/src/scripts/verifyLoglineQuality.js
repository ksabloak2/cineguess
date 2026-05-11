/**
 * Final quality check on all loglines.
 * Flags any that:
 *   A) Are too obvious — title concept mentioned, or immediately recognizable in <3 words
 *   B) Are still too vague — no specific anchor, could apply to 50+ movies
 *   C) Don't follow the "Movies Explained Badly" formula
 *
 * Usage:
 *   node src/scripts/verifyLoglineQuality.js
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
const BATCH_SIZE = 20;

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

For each movie, respond with:
- PASS if all three criteria are met
- FAIL_A if too obvious
- FAIL_B if too vague
- FAIL_C if formula violation
- FAIL_AB, FAIL_AC, FAIL_BC if multiple issues

Format (one per line, no extra text):
[ID] PASS
[ID] FAIL_A: [brief reason]
[ID] FAIL_B: [brief reason]
etc.`;

async function checkBatch(movies) {
  const list = movies
    .map((m) => `[${m.id}] ${m.title} (${m.year}): "${m.ai_hint_quote}"`)
    .join('\n');

  const resp = await client.messages.create({
    model: MODEL,
    max_tokens: 1200,
    system: CHECKER_PROMPT,
    messages: [{ role: 'user', content: `Check these loglines:\n\n${list}` }],
  });

  const text = resp.content
    .filter((c) => c.type === 'text')
    .map((c) => c.text)
    .join('')
    .trim();

  const results = [];
  const lines = text.split('\n').filter((l) => l.trim());
  for (const line of lines) {
    const match = line.match(/\[(\d+)\]\s+(PASS|FAIL[_A-Z]*)(:\s*(.+))?/);
    if (match) {
      results.push({
        id: parseInt(match[1]),
        status: match[2],
        reason: match[4] || '',
      });
    }
  }
  return results;
}

async function main() {
  const { rows: movies } = await pool.query(
    `SELECT id, title, year, ai_hint_quote, categories
     FROM movies
     WHERE ai_hint_quote IS NOT NULL AND ai_hint_quote != ''
       AND NOT (categories @> ARRAY['indiancinema']::text[])
     ORDER BY title`
  );

  console.log(`Checking ${movies.length} loglines for quality...\n`);

  const flagged = [];
  let passed = 0;
  let checked = 0;

  for (let i = 0; i < movies.length; i += BATCH_SIZE) {
    const batch = movies.slice(i, i + BATCH_SIZE);
    try {
      const results = await checkBatch(batch);
      for (const r of results) {
        checked++;
        if (r.status === 'PASS') {
          passed++;
          process.stdout.write('.');
        } else {
          const movie = batch.find((m) => m.id === r.id);
          if (movie) {
            flagged.push({
              id: r.id,
              title: movie.title,
              year: movie.year,
              categories: movie.categories,
              logline: movie.ai_hint_quote,
              status: r.status,
              issue: r.reason,
            });
            process.stdout.write('X');
          }
        }
      }
    } catch (err) {
      console.log(`\n  Batch error (${i}-${i + BATCH_SIZE}): ${err.message}`);
      process.stdout.write('?'.repeat(batch.length));
    }

    const total = i + batch.length;
    if (total % 100 === 0 || total >= movies.length) {
      process.stdout.write(` ${total}/${movies.length}\n`);
    }

    await new Promise((r) => setTimeout(r, 300));
  }

  console.log(`\nDone. passed=${passed} flagged=${flagged.length} total_checked=${checked}\n`);

  if (flagged.length > 0) {
    fs.writeFileSync('/tmp/quality_flagged.json', JSON.stringify(flagged, null, 2));
    console.log(`Flagged list saved to /tmp/quality_flagged.json\n`);

    const tooObvious = flagged.filter((f) => f.status.includes('A'));
    const tooVague   = flagged.filter((f) => f.status.includes('B'));
    const badFormula = flagged.filter((f) => f.status.includes('C'));
    console.log(`  Too obvious (A): ${tooObvious.length}`);
    console.log(`  Too vague   (B): ${tooVague.length}`);
    console.log(`  Bad formula (C): ${badFormula.length}\n`);

    console.log('Sample flagged:');
    flagged.slice(0, 15).forEach((f) =>
      console.log(`  [${f.status}] ${f.title} (${f.year})\n    "${f.logline}"\n    -> ${f.issue}\n`)
    );
  } else {
    console.log('All loglines passed! 🎉');
  }

  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
