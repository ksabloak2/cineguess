/**
 * populateSuperheroMeta.js
 *
 * Populates superhero-specific tile columns:
 *   superhero_universe, superhero_publisher, hero_villain_focus,
 *   solo_or_team, superpower_type
 *
 * Run AFTER importSuperhero.js:
 *   node src/scripts/populateSuperheroMeta.js
 */

require('dotenv').config();
const pool = require('../db/pool');

// ---------------------------------------------------------------
// Metadata map  —  key: lowercase title  (or "title year" for duplicates)
// universe:  specific saga/verse name
// publisher: Marvel | DC | Independent  (used for yellow match)
// focus:     Hero | Anti-hero | Villain
// team:      Solo | Team
// power:     Tech-based | Cosmic | Mutation | Magic | Human Enhanced | Team/Mixed
// ---------------------------------------------------------------
const META = {
  // ── MCU — Infinity Saga ──────────────────────────────────────────────────
  'iron man':                                       { universe: 'Infinity Saga',          publisher: 'Marvel', focus: 'Hero',      team: 'Solo', power: 'Tech-based'     },
  'the incredible hulk':                            { universe: 'Infinity Saga',          publisher: 'Marvel', focus: 'Hero',      team: 'Solo', power: 'Human Enhanced' },
  'iron man 2':                                     { universe: 'Infinity Saga',          publisher: 'Marvel', focus: 'Hero',      team: 'Solo', power: 'Tech-based'     },
  'thor':                                           { universe: 'Infinity Saga',          publisher: 'Marvel', focus: 'Hero',      team: 'Solo', power: 'Cosmic'         },
  'captain america: the first avenger':             { universe: 'Infinity Saga',          publisher: 'Marvel', focus: 'Hero',      team: 'Solo', power: 'Human Enhanced' },
  'the avengers':                                   { universe: 'Infinity Saga',          publisher: 'Marvel', focus: 'Hero',      team: 'Team', power: 'Team/Mixed'     },
  'iron man 3':                                     { universe: 'Infinity Saga',          publisher: 'Marvel', focus: 'Hero',      team: 'Solo', power: 'Tech-based'     },
  'thor: the dark world':                           { universe: 'Infinity Saga',          publisher: 'Marvel', focus: 'Hero',      team: 'Solo', power: 'Cosmic'         },
  'captain america: the winter soldier':            { universe: 'Infinity Saga',          publisher: 'Marvel', focus: 'Hero',      team: 'Solo', power: 'Human Enhanced' },
  'guardians of the galaxy':                        { universe: 'Infinity Saga',          publisher: 'Marvel', focus: 'Hero',      team: 'Team', power: 'Team/Mixed'     },
  'avengers: age of ultron':                        { universe: 'Infinity Saga',          publisher: 'Marvel', focus: 'Hero',      team: 'Team', power: 'Team/Mixed'     },
  'ant-man':                                        { universe: 'Infinity Saga',          publisher: 'Marvel', focus: 'Hero',      team: 'Solo', power: 'Tech-based'     },
  'captain america: civil war':                     { universe: 'Infinity Saga',          publisher: 'Marvel', focus: 'Hero',      team: 'Team', power: 'Team/Mixed'     },
  'doctor strange':                                 { universe: 'Infinity Saga',          publisher: 'Marvel', focus: 'Hero',      team: 'Solo', power: 'Magic'          },
  'guardians of the galaxy vol. 2':                 { universe: 'Infinity Saga',          publisher: 'Marvel', focus: 'Hero',      team: 'Team', power: 'Team/Mixed'     },
  'spider-man: homecoming':                         { universe: 'Infinity Saga',          publisher: 'Marvel', focus: 'Hero',      team: 'Solo', power: 'Human Enhanced' },
  'thor: ragnarok':                                 { universe: 'Infinity Saga',          publisher: 'Marvel', focus: 'Hero',      team: 'Solo', power: 'Cosmic'         },
  'black panther':                                  { universe: 'Infinity Saga',          publisher: 'Marvel', focus: 'Hero',      team: 'Solo', power: 'Human Enhanced' },
  'avengers: infinity war':                         { universe: 'Infinity Saga',          publisher: 'Marvel', focus: 'Hero',      team: 'Team', power: 'Team/Mixed'     },
  'ant-man and the wasp':                           { universe: 'Infinity Saga',          publisher: 'Marvel', focus: 'Hero',      team: 'Solo', power: 'Tech-based'     },
  'captain marvel':                                 { universe: 'Infinity Saga',          publisher: 'Marvel', focus: 'Hero',      team: 'Solo', power: 'Cosmic'         },
  'avengers: endgame':                              { universe: 'Infinity Saga',          publisher: 'Marvel', focus: 'Hero',      team: 'Team', power: 'Team/Mixed'     },
  'spider-man: far from home':                      { universe: 'Infinity Saga',          publisher: 'Marvel', focus: 'Hero',      team: 'Solo', power: 'Human Enhanced' },

  // ── MCU — Multiverse Saga ────────────────────────────────────────────────
  'black widow':                                    { universe: 'Multiverse Saga',        publisher: 'Marvel', focus: 'Hero',      team: 'Solo', power: 'Human Enhanced' },
  'shang-chi and the legend of the ten rings':      { universe: 'Multiverse Saga',        publisher: 'Marvel', focus: 'Hero',      team: 'Solo', power: 'Magic'          },
  'eternals':                                       { universe: 'Multiverse Saga',        publisher: 'Marvel', focus: 'Hero',      team: 'Team', power: 'Cosmic'         },
  'spider-man: no way home':                        { universe: 'Multiverse Saga',        publisher: 'Marvel', focus: 'Hero',      team: 'Solo', power: 'Human Enhanced' },
  'doctor strange in the multiverse of madness':    { universe: 'Multiverse Saga',        publisher: 'Marvel', focus: 'Hero',      team: 'Solo', power: 'Magic'          },
  'thor: love and thunder':                         { universe: 'Multiverse Saga',        publisher: 'Marvel', focus: 'Hero',      team: 'Solo', power: 'Cosmic'         },
  'black panther: wakanda forever':                 { universe: 'Multiverse Saga',        publisher: 'Marvel', focus: 'Hero',      team: 'Team', power: 'Team/Mixed'     },
  'ant-man and the wasp: quantumania':              { universe: 'Multiverse Saga',        publisher: 'Marvel', focus: 'Hero',      team: 'Solo', power: 'Tech-based'     },
  'guardians of the galaxy vol. 3':                 { universe: 'Multiverse Saga',        publisher: 'Marvel', focus: 'Hero',      team: 'Team', power: 'Team/Mixed'     },
  'the marvels':                                    { universe: 'Multiverse Saga',        publisher: 'Marvel', focus: 'Hero',      team: 'Team', power: 'Team/Mixed'     },
  'deadpool & wolverine':                           { universe: 'Multiverse Saga',        publisher: 'Marvel', focus: 'Anti-hero', team: 'Team', power: 'Mutation'       },
  'captain america: brave new world':               { universe: 'Multiverse Saga',        publisher: 'Marvel', focus: 'Hero',      team: 'Solo', power: 'Human Enhanced' },
  'thunderbolts*':                                  { universe: 'Multiverse Saga',        publisher: 'Marvel', focus: 'Anti-hero', team: 'Team', power: 'Team/Mixed'     },
  'the fantastic four: first steps':                { universe: 'Multiverse Saga',        publisher: 'Marvel', focus: 'Hero',      team: 'Team', power: 'Team/Mixed'     },
  'the fantastic 4: first steps':                   { universe: 'Multiverse Saga',        publisher: 'Marvel', focus: 'Hero',      team: 'Team', power: 'Team/Mixed'     },

  // ── Fox X-Men Universe ───────────────────────────────────────────────────
  'x-men':                                          { universe: 'X-Men Universe',         publisher: 'Marvel', focus: 'Hero',      team: 'Team', power: 'Mutation'       },
  'x2':                                             { universe: 'X-Men Universe',         publisher: 'Marvel', focus: 'Hero',      team: 'Team', power: 'Mutation'       },
  'x-men: the last stand':                          { universe: 'X-Men Universe',         publisher: 'Marvel', focus: 'Hero',      team: 'Team', power: 'Mutation'       },
  'x-men origins: wolverine':                       { universe: 'X-Men Universe',         publisher: 'Marvel', focus: 'Hero',      team: 'Solo', power: 'Mutation'       },
  'x-men: first class':                             { universe: 'X-Men Universe',         publisher: 'Marvel', focus: 'Hero',      team: 'Team', power: 'Mutation'       },
  'the wolverine':                                  { universe: 'X-Men Universe',         publisher: 'Marvel', focus: 'Hero',      team: 'Solo', power: 'Mutation'       },
  'x-men: days of future past':                     { universe: 'X-Men Universe',         publisher: 'Marvel', focus: 'Hero',      team: 'Team', power: 'Mutation'       },
  'x-men: apocalypse':                              { universe: 'X-Men Universe',         publisher: 'Marvel', focus: 'Hero',      team: 'Team', power: 'Mutation'       },
  'deadpool':                                       { universe: 'X-Men Universe',         publisher: 'Marvel', focus: 'Anti-hero', team: 'Solo', power: 'Mutation'       },
  'logan':                                          { universe: 'X-Men Universe',         publisher: 'Marvel', focus: 'Hero',      team: 'Solo', power: 'Mutation'       },
  'deadpool 2':                                     { universe: 'X-Men Universe',         publisher: 'Marvel', focus: 'Anti-hero', team: 'Team', power: 'Mutation'       },
  'x-men: dark phoenix':                            { universe: 'X-Men Universe',         publisher: 'Marvel', focus: 'Hero',      team: 'Team', power: 'Mutation'       },
  'dark phoenix':                                   { universe: 'X-Men Universe',         publisher: 'Marvel', focus: 'Hero',      team: 'Team', power: 'Mutation'       },
  'the new mutants':                                { universe: 'X-Men Universe',         publisher: 'Marvel', focus: 'Hero',      team: 'Team', power: 'Mutation'       },
  'fantastic four 2005':                            { universe: 'X-Men Universe',         publisher: 'Marvel', focus: 'Hero',      team: 'Team', power: 'Human Enhanced' },
  'fantastic four: rise of the silver surfer':      { universe: 'X-Men Universe',         publisher: 'Marvel', focus: 'Hero',      team: 'Team', power: 'Human Enhanced' },
  'fantastic four 2015':                            { universe: 'X-Men Universe',         publisher: 'Marvel', focus: 'Hero',      team: 'Team', power: 'Human Enhanced' },

  // ── Sony — Raimi Spider-Man ──────────────────────────────────────────────
  'spider-man 2002':                                { universe: 'Raimi Spider-Man',       publisher: 'Marvel', focus: 'Hero',      team: 'Solo', power: 'Human Enhanced' },
  'spider-man 2':                                   { universe: 'Raimi Spider-Man',       publisher: 'Marvel', focus: 'Hero',      team: 'Solo', power: 'Human Enhanced' },
  'spider-man 3':                                   { universe: 'Raimi Spider-Man',       publisher: 'Marvel', focus: 'Hero',      team: 'Solo', power: 'Human Enhanced' },

  // ── Sony — Amazing Spider-Man ────────────────────────────────────────────
  'the amazing spider-man':                         { universe: 'Amazing Spider-Man',     publisher: 'Marvel', focus: 'Hero',      team: 'Solo', power: 'Human Enhanced' },
  'the amazing spider-man 2':                       { universe: 'Amazing Spider-Man',     publisher: 'Marvel', focus: 'Hero',      team: 'Solo', power: 'Human Enhanced' },

  // ── Sony — Spider-Verse ──────────────────────────────────────────────────
  'spider-man: into the spider-verse':              { universe: 'Sony Spider-Verse',      publisher: 'Marvel', focus: 'Hero',      team: 'Team', power: 'Human Enhanced' },
  'spider-man: across the spider-verse':            { universe: 'Sony Spider-Verse',      publisher: 'Marvel', focus: 'Hero',      team: 'Team', power: 'Human Enhanced' },

  // ── Sony — SSU ───────────────────────────────────────────────────────────
  'venom':                                          { universe: 'Sony Spider-Man Universe', publisher: 'Marvel', focus: 'Anti-hero', team: 'Solo', power: 'Cosmic'       },
  'venom: let there be carnage':                    { universe: 'Sony Spider-Man Universe', publisher: 'Marvel', focus: 'Anti-hero', team: 'Solo', power: 'Cosmic'       },
  'morbius':                                        { universe: 'Sony Spider-Man Universe', publisher: 'Marvel', focus: 'Anti-hero', team: 'Solo', power: 'Human Enhanced'},
  'venom: the last dance':                          { universe: 'Sony Spider-Man Universe', publisher: 'Marvel', focus: 'Anti-hero', team: 'Solo', power: 'Cosmic'       },
  'madame web':                                     { universe: 'Sony Spider-Man Universe', publisher: 'Marvel', focus: 'Hero',      team: 'Solo', power: 'Cosmic'       },
  'kraven the hunter':                              { universe: 'Sony Spider-Man Universe', publisher: 'Marvel', focus: 'Villain',   team: 'Solo', power: 'Human Enhanced'},
  'ghost rider':                                    { universe: 'Sony Spider-Man Universe', publisher: 'Marvel', focus: 'Anti-hero', team: 'Solo', power: 'Magic'        },
  'ghost rider: spirit of vengeance':               { universe: 'Sony Spider-Man Universe', publisher: 'Marvel', focus: 'Anti-hero', team: 'Solo', power: 'Magic'        },

  // ── DC — Reeveverse ──────────────────────────────────────────────────────
  'superman 1978':                                  { universe: 'Reeveverse',             publisher: 'DC',    focus: 'Hero',      team: 'Solo', power: 'Cosmic'         },
  'superman ii':                                    { universe: 'Reeveverse',             publisher: 'DC',    focus: 'Hero',      team: 'Solo', power: 'Cosmic'         },
  'superman iii':                                   { universe: 'Reeveverse',             publisher: 'DC',    focus: 'Hero',      team: 'Solo', power: 'Cosmic'         },
  'superman iv: the quest for peace':               { universe: 'Reeveverse',             publisher: 'DC',    focus: 'Hero',      team: 'Solo', power: 'Cosmic'         },
  'supergirl':                                      { universe: 'Reeveverse',             publisher: 'DC',    focus: 'Hero',      team: 'Solo', power: 'Cosmic'         },

  // ── DC — Burtonverse ─────────────────────────────────────────────────────
  'batman':                                         { universe: 'Burtonverse',            publisher: 'DC',    focus: 'Hero',      team: 'Solo', power: 'Tech-based'     },
  'batman returns':                                 { universe: 'Burtonverse',            publisher: 'DC',    focus: 'Hero',      team: 'Solo', power: 'Tech-based'     },

  // ── DC — Schumacherverse ─────────────────────────────────────────────────
  'batman forever':                                 { universe: 'Schumacherverse',        publisher: 'DC',    focus: 'Hero',      team: 'Solo', power: 'Tech-based'     },
  'batman & robin':                                 { universe: 'Schumacherverse',        publisher: 'DC',    focus: 'Hero',      team: 'Solo', power: 'Tech-based'     },

  // ── DC — Nolanverse ──────────────────────────────────────────────────────
  'batman begins':                                  { universe: 'Nolanverse',             publisher: 'DC',    focus: 'Hero',      team: 'Solo', power: 'Tech-based'     },
  'the dark knight':                                { universe: 'Nolanverse',             publisher: 'DC',    focus: 'Hero',      team: 'Solo', power: 'Tech-based'     },
  'the dark knight rises':                          { universe: 'Nolanverse',             publisher: 'DC',    focus: 'Hero',      team: 'Solo', power: 'Tech-based'     },

  // ── DC — DCEU ────────────────────────────────────────────────────────────
  'man of steel':                                   { universe: 'DCEU',                   publisher: 'DC',    focus: 'Hero',      team: 'Solo', power: 'Cosmic'         },
  'batman v superman: dawn of justice':             { universe: 'DCEU',                   publisher: 'DC',    focus: 'Hero',      team: 'Team', power: 'Team/Mixed'     },
  'suicide squad':                                  { universe: 'DCEU',                   publisher: 'DC',    focus: 'Villain',   team: 'Team', power: 'Team/Mixed'     },
  'wonder woman':                                   { universe: 'DCEU',                   publisher: 'DC',    focus: 'Hero',      team: 'Solo', power: 'Cosmic'         },
  'justice league':                                 { universe: 'DCEU',                   publisher: 'DC',    focus: 'Hero',      team: 'Team', power: 'Team/Mixed'     },
  'aquaman':                                        { universe: 'DCEU',                   publisher: 'DC',    focus: 'Hero',      team: 'Solo', power: 'Cosmic'         },
  'shazam!':                                        { universe: 'DCEU',                   publisher: 'DC',    focus: 'Hero',      team: 'Solo', power: 'Magic'          },
  'birds of prey':                                  { universe: 'DCEU',                   publisher: 'DC',    focus: 'Anti-hero', team: 'Team', power: 'Team/Mixed'     },
  'birds of prey (and the fantabulous emancipation of one harley quinn)': { universe: 'DCEU', publisher: 'DC', focus: 'Anti-hero', team: 'Team', power: 'Team/Mixed'   },
  'wonder woman 1984':                              { universe: 'DCEU',                   publisher: 'DC',    focus: 'Hero',      team: 'Solo', power: 'Cosmic'         },
  "zack snyder's justice league":                   { universe: 'DCEU',                   publisher: 'DC',    focus: 'Hero',      team: 'Team', power: 'Team/Mixed'     },
  'the suicide squad':                              { universe: 'DCEU',                   publisher: 'DC',    focus: 'Anti-hero', team: 'Team', power: 'Team/Mixed'     },
  'black adam':                                     { universe: 'DCEU',                   publisher: 'DC',    focus: 'Anti-hero', team: 'Solo', power: 'Magic'          },
  'shazam! fury of the gods':                       { universe: 'DCEU',                   publisher: 'DC',    focus: 'Hero',      team: 'Solo', power: 'Magic'          },
  'aquaman and the lost kingdom':                   { universe: 'DCEU',                   publisher: 'DC',    focus: 'Hero',      team: 'Solo', power: 'Cosmic'         },
  'the flash':                                      { universe: 'DCEU',                   publisher: 'DC',    focus: 'Hero',      team: 'Solo', power: 'Human Enhanced' },
  'blue beetle':                                    { universe: 'DCEU',                   publisher: 'DC',    focus: 'Hero',      team: 'Solo', power: 'Tech-based'     },

  // ── DC — Elseworlds ──────────────────────────────────────────────────────
  'joker 2019':                                     { universe: 'Elseworlds',             publisher: 'DC',    focus: 'Villain',   team: 'Solo', power: 'Human Enhanced' },
  'the batman':                                     { universe: 'Elseworlds',             publisher: 'DC',    focus: 'Hero',      team: 'Solo', power: 'Tech-based'     },
  'joker: folie à deux':                            { universe: 'Elseworlds',             publisher: 'DC',    focus: 'Villain',   team: 'Solo', power: 'Human Enhanced' },

  // ── DCU (James Gunn era) ─────────────────────────────────────────────────
  'superman 2025':                                  { universe: 'DCU',                    publisher: 'DC',    focus: 'Hero',      team: 'Solo', power: 'Cosmic'         },

  // ── Blade Trilogy (New Line Cinema / Marvel) ─────────────────────────────
  'blade':                                          { universe: 'Blade Trilogy',          publisher: 'Marvel', focus: 'Anti-hero', team: 'Solo', power: 'Human Enhanced' },
  'blade ii':                                       { universe: 'Blade Trilogy',          publisher: 'Marvel', focus: 'Anti-hero', team: 'Solo', power: 'Human Enhanced' },
  'blade: trinity':                                 { universe: 'Blade Trilogy',          publisher: 'Marvel', focus: 'Anti-hero', team: 'Team', power: 'Human Enhanced' },

  // ── DC — Standalone / Classic ────────────────────────────────────────────
  'batman: the movie':                              { universe: 'Standalone',             publisher: 'DC',          focus: 'Hero',      team: 'Solo', power: 'Tech-based'     },
  'batman: mask of the phantasm':                   { universe: 'Standalone',             publisher: 'DC',          focus: 'Hero',      team: 'Solo', power: 'Tech-based'     },
  'steel':                                          { universe: 'Standalone',             publisher: 'DC',          focus: 'Hero',      team: 'Solo', power: 'Tech-based'     },
  'catwoman':                                       { universe: 'Standalone',             publisher: 'DC',          focus: 'Anti-hero', team: 'Solo', power: 'Human Enhanced' },
  'constantine':                                    { universe: 'Standalone',             publisher: 'Independent', focus: 'Hero',      team: 'Solo', power: 'Magic'          },
  'v for vendetta':                                 { universe: 'Standalone',             publisher: 'Independent', focus: 'Anti-hero', team: 'Solo', power: 'Human Enhanced' },
  'superman returns':                               { universe: 'Standalone',             publisher: 'DC',          focus: 'Hero',      team: 'Solo', power: 'Cosmic'         },
  'watchmen':                                       { universe: 'Standalone',             publisher: 'Independent', focus: 'Anti-hero', team: 'Team', power: 'Team/Mixed'     },
  'green lantern':                                  { universe: 'Standalone',             publisher: 'DC',          focus: 'Hero',      team: 'Solo', power: 'Cosmic'         },
  'chronicle':                                      { universe: 'Standalone',             publisher: 'Independent', focus: 'Anti-hero', team: 'Team', power: 'Mutation'       },
  'the lego batman movie':                          { universe: 'Standalone',             publisher: 'DC',          focus: 'Hero',      team: 'Solo', power: 'Tech-based'     },
  'teen titans go! to the movies':                  { universe: 'Standalone',             publisher: 'DC',          focus: 'Hero',      team: 'Team', power: 'Team/Mixed'     },
};

// ---------------------------------------------------------------
// Lookup — try "title year" first for disambiguation, then title only
// ---------------------------------------------------------------
function lookupMeta(title, year) {
  const base     = title.toLowerCase().replace(/\s+/g, ' ').trim();
  const withYear = `${base} ${year}`;

  if (META[withYear]) return META[withYear];
  if (META[base])     return META[base];

  // Partial: strip subtitle after colon
  const noSub = base.replace(/\s*:.*$/, '').trim();
  if (noSub !== base && META[noSub]) return META[noSub];

  return null;
}

// ---------------------------------------------------------------
// Main
// ---------------------------------------------------------------
async function main() {
  const client = await pool.connect();
  try {
    // Remove any behind-the-scenes documentaries that got imported by mistake
    const { rowCount: removed } = await client.query(
      `UPDATE movies SET categories = array_remove(categories, 'superhero')
       WHERE 'superhero' = ANY(categories) AND title ILIKE '%making%'`
    );
    if (removed > 0) console.log(`  Removed ${removed} documentary entry from pool`);

    const { rows } = await client.query(
      `SELECT id, title, year FROM movies WHERE 'superhero' = ANY(categories) ORDER BY year`
    );
    console.log(`\nPopulating superhero metadata for ${rows.length} movies...\n`);

    let matched = 0, defaulted = 0;
    const unmatched = [];

    for (const row of rows) {
      const meta = lookupMeta(row.title, row.year);

      if (meta) {
        await client.query(
          `UPDATE movies
           SET superhero_universe  = $1,
               superhero_publisher = $2,
               hero_villain_focus  = $3,
               solo_or_team        = $4,
               superpower_type     = $5
           WHERE id = $6`,
          [meta.universe, meta.publisher, meta.focus, meta.team, meta.power, row.id]
        );
        matched++;
      } else {
        await client.query(
          `UPDATE movies
           SET superhero_universe  = $1,
               superhero_publisher = $2,
               hero_villain_focus  = $3,
               solo_or_team        = $4,
               superpower_type     = $5
           WHERE id = $6`,
          ['Standalone', 'Independent', 'Hero', 'Solo', 'Human Enhanced', row.id]
        );
        defaulted++;
        unmatched.push(`"${row.title}" (${row.year})`);
      }
    }

    console.log(`  Matched:   ${matched}`);
    console.log(`  Defaulted: ${defaulted}`);

    if (unmatched.length) {
      console.log('\nUnmatched (used defaults):');
      unmatched.forEach((t) => console.log(`  - ${t}`));
    }

    console.log('\nDone. Run npm run daily-pick to update today\'s pick.\n');
  } finally {
    client.release();
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
