/**
 * populateAnimatedMeta.js
 *
 * Populates animation-specific metadata columns for all animated movies:
 *   animation_style, animation_studio, has_sequel, protagonist_type, is_musical
 *
 * Run: node src/scripts/populateAnimatedMeta.js
 */

require('dotenv').config();
const pool = require('../db/pool');

// ---------------------------------------------------------------
// Metadata map — key: lowercase title, value: animated metadata
// has_sequel = true if the movie is part of a franchise/series (as sequel OR has one)
// ---------------------------------------------------------------
const META = {
  // =========================================================
  // PIXAR — all CGI/3D, Studio: Pixar
  // =========================================================
  'toy story':                { style: 'CGI/3D', studio: 'Pixar', sequel: true,  protagonist: 'Object',           musical: false },
  "a bug's life":             { style: 'CGI/3D', studio: 'Pixar', sequel: false, protagonist: 'Animal',           musical: false },
  'toy story 2':              { style: 'CGI/3D', studio: 'Pixar', sequel: true,  protagonist: 'Object',           musical: false },
  'monsters, inc.':           { style: 'CGI/3D', studio: 'Pixar', sequel: true,  protagonist: 'Fantasy Creature', musical: false },
  'finding nemo':             { style: 'CGI/3D', studio: 'Pixar', sequel: true,  protagonist: 'Animal',           musical: false },
  'the incredibles':          { style: 'CGI/3D', studio: 'Pixar', sequel: true,  protagonist: 'Human',            musical: false },
  'cars':                     { style: 'CGI/3D', studio: 'Pixar', sequel: true,  protagonist: 'Object',           musical: false },
  'ratatouille':              { style: 'CGI/3D', studio: 'Pixar', sequel: false, protagonist: 'Animal',           musical: false },
  'wall-e':                   { style: 'CGI/3D', studio: 'Pixar', sequel: false, protagonist: 'Robot/AI',         musical: false },
  'up':                       { style: 'CGI/3D', studio: 'Pixar', sequel: false, protagonist: 'Human',            musical: false },
  'toy story 3':              { style: 'CGI/3D', studio: 'Pixar', sequel: true,  protagonist: 'Object',           musical: false },
  'cars 2':                   { style: 'CGI/3D', studio: 'Pixar', sequel: true,  protagonist: 'Object',           musical: false },
  'brave':                    { style: 'CGI/3D', studio: 'Pixar', sequel: false, protagonist: 'Human',            musical: false },
  'monsters university':      { style: 'CGI/3D', studio: 'Pixar', sequel: true,  protagonist: 'Fantasy Creature', musical: false },
  'inside out':               { style: 'CGI/3D', studio: 'Pixar', sequel: true,  protagonist: 'Fantasy Creature', musical: false },
  'the good dinosaur':        { style: 'CGI/3D', studio: 'Pixar', sequel: false, protagonist: 'Animal',           musical: false },
  'finding dory':             { style: 'CGI/3D', studio: 'Pixar', sequel: true,  protagonist: 'Animal',           musical: false },
  'cars 3':                   { style: 'CGI/3D', studio: 'Pixar', sequel: true,  protagonist: 'Object',           musical: false },
  'coco':                     { style: 'CGI/3D', studio: 'Pixar', sequel: false, protagonist: 'Human',            musical: true  },
  'incredibles 2':            { style: 'CGI/3D', studio: 'Pixar', sequel: true,  protagonist: 'Human',            musical: false },
  'toy story 4':              { style: 'CGI/3D', studio: 'Pixar', sequel: true,  protagonist: 'Object',           musical: false },
  'onward':                   { style: 'CGI/3D', studio: 'Pixar', sequel: false, protagonist: 'Fantasy Creature', musical: false },
  'soul':                     { style: 'CGI/3D', studio: 'Pixar', sequel: false, protagonist: 'Human',            musical: false },
  'luca':                     { style: 'CGI/3D', studio: 'Pixar', sequel: false, protagonist: 'Fantasy Creature', musical: false },
  'turning red':              { style: 'CGI/3D', studio: 'Pixar', sequel: false, protagonist: 'Human',            musical: true  },
  'lightyear':                { style: 'CGI/3D', studio: 'Pixar', sequel: true,  protagonist: 'Human',            musical: false },
  'elemental':                { style: 'CGI/3D', studio: 'Pixar', sequel: false, protagonist: 'Fantasy Creature', musical: false },
  'inside out 2':             { style: 'CGI/3D', studio: 'Pixar', sequel: true,  protagonist: 'Fantasy Creature', musical: false },

  // =========================================================
  // DISNEY — mix of Hand-drawn and CGI, Studio: Disney
  // =========================================================
  'snow white and the seven dwarfs': { style: 'Hand-drawn (2D)', studio: 'Disney', sequel: false, protagonist: 'Human',            musical: true  },
  'pinocchio':                { style: 'Hand-drawn (2D)', studio: 'Disney', sequel: false, protagonist: 'Object',           musical: true  },
  'fantasia':                 { style: 'Hand-drawn (2D)', studio: 'Disney', sequel: true,  protagonist: 'Fantasy Creature', musical: true  },
  'dumbo':                    { style: 'Hand-drawn (2D)', studio: 'Disney', sequel: false, protagonist: 'Animal',           musical: true  },
  'bambi':                    { style: 'Hand-drawn (2D)', studio: 'Disney', sequel: false, protagonist: 'Animal',           musical: false },
  'cinderella':               { style: 'Hand-drawn (2D)', studio: 'Disney', sequel: false, protagonist: 'Human',            musical: true  },
  'alice in wonderland':      { style: 'Hand-drawn (2D)', studio: 'Disney', sequel: false, protagonist: 'Human',            musical: true  },
  'peter pan':                { style: 'Hand-drawn (2D)', studio: 'Disney', sequel: true,  protagonist: 'Human',            musical: true  },
  'lady and the tramp':       { style: 'Hand-drawn (2D)', studio: 'Disney', sequel: true,  protagonist: 'Animal',           musical: true  },
  'sleeping beauty':          { style: 'Hand-drawn (2D)', studio: 'Disney', sequel: false, protagonist: 'Human',            musical: true  },
  'one hundred and one dalmatians': { style: 'Hand-drawn (2D)', studio: 'Disney', sequel: true, protagonist: 'Animal', musical: false },
  'the sword in the stone':   { style: 'Hand-drawn (2D)', studio: 'Disney', sequel: false, protagonist: 'Human',            musical: true  },
  'the jungle book':          { style: 'Hand-drawn (2D)', studio: 'Disney', sequel: true,  protagonist: 'Human',            musical: true  },
  'the aristocats':           { style: 'Hand-drawn (2D)', studio: 'Disney', sequel: false, protagonist: 'Animal',           musical: true  },
  'robin hood':               { style: 'Hand-drawn (2D)', studio: 'Disney', sequel: false, protagonist: 'Animal',           musical: true  },
  'the rescuers':             { style: 'Hand-drawn (2D)', studio: 'Disney', sequel: true,  protagonist: 'Animal',           musical: false },
  'the fox and the hound':    { style: 'Hand-drawn (2D)', studio: 'Disney', sequel: true,  protagonist: 'Animal',           musical: false },
  'the great mouse detective':{ style: 'Hand-drawn (2D)', studio: 'Disney', sequel: false, protagonist: 'Animal',           musical: false },
  'oliver & company':         { style: 'Hand-drawn (2D)', studio: 'Disney', sequel: false, protagonist: 'Animal',           musical: true  },
  'the little mermaid':       { style: 'Hand-drawn (2D)', studio: 'Disney', sequel: true,  protagonist: 'Fantasy Creature', musical: true  },
  'the rescuers down under':  { style: 'Hand-drawn (2D)', studio: 'Disney', sequel: true,  protagonist: 'Animal',           musical: false },
  'beauty and the beast':     { style: 'Hand-drawn (2D)', studio: 'Disney', sequel: false, protagonist: 'Human',            musical: true  },
  'aladdin':                  { style: 'Hand-drawn (2D)', studio: 'Disney', sequel: true,  protagonist: 'Human',            musical: true  },
  'the lion king':            { style: 'Hand-drawn (2D)', studio: 'Disney', sequel: true,  protagonist: 'Animal',           musical: true  },
  'pocahontas':               { style: 'Hand-drawn (2D)', studio: 'Disney', sequel: true,  protagonist: 'Human',            musical: true  },
  'the hunchback of notre dame': { style: 'Hand-drawn (2D)', studio: 'Disney', sequel: true, protagonist: 'Human', musical: true },
  'hercules':                 { style: 'Hand-drawn (2D)', studio: 'Disney', sequel: false, protagonist: 'Human',            musical: true  },
  'mulan':                    { style: 'Hand-drawn (2D)', studio: 'Disney', sequel: true,  protagonist: 'Human',            musical: true  },
  'tarzan':                   { style: 'Hand-drawn (2D)', studio: 'Disney', sequel: true,  protagonist: 'Human',            musical: true  },
  "the emperor's new groove": { style: 'Hand-drawn (2D)', studio: 'Disney', sequel: true,  protagonist: 'Human',            musical: false },
  'atlantis: the lost empire':{ style: 'Hand-drawn (2D)', studio: 'Disney', sequel: true,  protagonist: 'Human',            musical: false },
  'lilo & stitch':            { style: 'Hand-drawn (2D)', studio: 'Disney', sequel: true,  protagonist: 'Human',            musical: true  },
  'treasure planet':          { style: 'Hand-drawn (2D)', studio: 'Disney', sequel: false, protagonist: 'Human',            musical: false },
  'brother bear':             { style: 'Hand-drawn (2D)', studio: 'Disney', sequel: true,  protagonist: 'Animal',           musical: true  },
  'home on the range':        { style: 'Hand-drawn (2D)', studio: 'Disney', sequel: false, protagonist: 'Animal',           musical: true  },
  'bolt':                     { style: 'CGI/3D',          studio: 'Disney', sequel: false, protagonist: 'Animal',           musical: false },
  'the princess and the frog':{ style: 'Hand-drawn (2D)', studio: 'Disney', sequel: false, protagonist: 'Human',            musical: true  },
  'tangled':                  { style: 'CGI/3D',          studio: 'Disney', sequel: false, protagonist: 'Human',            musical: true  },
  'wreck-it ralph':           { style: 'CGI/3D',          studio: 'Disney', sequel: true,  protagonist: 'Human',            musical: false },
  'frozen':                   { style: 'CGI/3D',          studio: 'Disney', sequel: true,  protagonist: 'Human',            musical: true  },
  'big hero 6':               { style: 'CGI/3D',          studio: 'Disney', sequel: false, protagonist: 'Human',            musical: false },
  'zootopia':                 { style: 'CGI/3D',          studio: 'Disney', sequel: true,  protagonist: 'Animal',           musical: false },
  'zootopia 2':               { style: 'CGI/3D',          studio: 'Disney', sequel: true,  protagonist: 'Animal',           musical: false },
  'moana':                    { style: 'CGI/3D',          studio: 'Disney', sequel: true,  protagonist: 'Human',            musical: true  },
  'ralph breaks the internet':{ style: 'CGI/3D',          studio: 'Disney', sequel: true,  protagonist: 'Human',            musical: false },
  'frozen ii':                { style: 'CGI/3D',          studio: 'Disney', sequel: true,  protagonist: 'Human',            musical: true  },
  'raya and the last dragon': { style: 'CGI/3D',          studio: 'Disney', sequel: false, protagonist: 'Human',            musical: false },
  'encanto':                  { style: 'CGI/3D',          studio: 'Disney', sequel: false, protagonist: 'Human',            musical: true  },
  'strange world':            { style: 'CGI/3D',          studio: 'Disney', sequel: false, protagonist: 'Human',            musical: false },
  'wish':                     { style: 'CGI/3D',          studio: 'Disney', sequel: false, protagonist: 'Human',            musical: true  },
  'moana 2':                  { style: 'CGI/3D',          studio: 'Disney', sequel: true,  protagonist: 'Human',            musical: true  },

  // =========================================================
  // STUDIO GHIBLI — all Hand-drawn, Studio: Studio Ghibli
  // =========================================================
  'my neighbor totoro':           { style: 'Hand-drawn (2D)', studio: 'Studio Ghibli', sequel: false, protagonist: 'Fantasy Creature', musical: false },
  'spirited away':                { style: 'Hand-drawn (2D)', studio: 'Studio Ghibli', sequel: false, protagonist: 'Human',            musical: false },
  "howl's moving castle":         { style: 'Hand-drawn (2D)', studio: 'Studio Ghibli', sequel: false, protagonist: 'Human',            musical: false },
  'princess mononoke':            { style: 'Hand-drawn (2D)', studio: 'Studio Ghibli', sequel: false, protagonist: 'Human',            musical: false },
  'nausicaä of the valley of the wind': { style: 'Hand-drawn (2D)', studio: 'Studio Ghibli', sequel: false, protagonist: 'Human', musical: false },
  'castle in the sky':            { style: 'Hand-drawn (2D)', studio: 'Studio Ghibli', sequel: false, protagonist: 'Human',            musical: false },
  "kiki's delivery service":      { style: 'Hand-drawn (2D)', studio: 'Studio Ghibli', sequel: false, protagonist: 'Human',            musical: false },
  'porco rosso':                  { style: 'Hand-drawn (2D)', studio: 'Studio Ghibli', sequel: false, protagonist: 'Animal',           musical: false },
  'pom poko':                     { style: 'Hand-drawn (2D)', studio: 'Studio Ghibli', sequel: false, protagonist: 'Animal',           musical: false },
  'only yesterday':               { style: 'Hand-drawn (2D)', studio: 'Studio Ghibli', sequel: false, protagonist: 'Human',            musical: false },
  'whisper of the heart':         { style: 'Hand-drawn (2D)', studio: 'Studio Ghibli', sequel: false, protagonist: 'Human',            musical: false },
  'the cat returns':              { style: 'Hand-drawn (2D)', studio: 'Studio Ghibli', sequel: true,  protagonist: 'Human',            musical: false },
  "grave of the fireflies":       { style: 'Hand-drawn (2D)', studio: 'Studio Ghibli', sequel: false, protagonist: 'Human',            musical: false },
  'the tale of the princess kaguya': { style: 'Hand-drawn (2D)', studio: 'Studio Ghibli', sequel: false, protagonist: 'Human', musical: false },
  'the wind rises':               { style: 'Hand-drawn (2D)', studio: 'Studio Ghibli', sequel: false, protagonist: 'Human',            musical: false },
  'arrietty':                     { style: 'Hand-drawn (2D)', studio: 'Studio Ghibli', sequel: false, protagonist: 'Fantasy Creature', musical: false },
  'ponyo':                        { style: 'Hand-drawn (2D)', studio: 'Studio Ghibli', sequel: false, protagonist: 'Fantasy Creature', musical: false },
  'the secret world of arrietty': { style: 'Hand-drawn (2D)', studio: 'Studio Ghibli', sequel: false, protagonist: 'Fantasy Creature', musical: false },
  'from up on poppy hill':        { style: 'Hand-drawn (2D)', studio: 'Studio Ghibli', sequel: false, protagonist: 'Human',            musical: false },
  'when marnie was there':        { style: 'Hand-drawn (2D)', studio: 'Studio Ghibli', sequel: false, protagonist: 'Human',            musical: false },
  'the boy and the heron':        { style: 'Hand-drawn (2D)', studio: 'Studio Ghibli', sequel: false, protagonist: 'Human',            musical: false },

  // =========================================================
  // DREAMWORKS — mostly CGI, some Hand-drawn early films
  // =========================================================
  'shrek':                    { style: 'CGI/3D',          studio: 'DreamWorks', sequel: true,  protagonist: 'Fantasy Creature', musical: false },
  'shrek 2':                  { style: 'CGI/3D',          studio: 'DreamWorks', sequel: true,  protagonist: 'Fantasy Creature', musical: false },
  'shrek the third':          { style: 'CGI/3D',          studio: 'DreamWorks', sequel: true,  protagonist: 'Fantasy Creature', musical: false },
  'shrek forever after':      { style: 'CGI/3D',          studio: 'DreamWorks', sequel: true,  protagonist: 'Fantasy Creature', musical: false },
  'madagascar':               { style: 'CGI/3D',          studio: 'DreamWorks', sequel: true,  protagonist: 'Animal',           musical: false },
  'madagascar: escape 2 africa': { style: 'CGI/3D',       studio: 'DreamWorks', sequel: true,  protagonist: 'Animal',           musical: false },
  'madagascar 3: europe\'s most wanted': { style: 'CGI/3D', studio: 'DreamWorks', sequel: true, protagonist: 'Animal', musical: false },
  'how to train your dragon':  { style: 'CGI/3D',          studio: 'DreamWorks', sequel: true,  protagonist: 'Human',            musical: false },
  'how to train your dragon 2': { style: 'CGI/3D',         studio: 'DreamWorks', sequel: true,  protagonist: 'Human',            musical: false },
  'how to train your dragon: the hidden world': { style: 'CGI/3D', studio: 'DreamWorks', sequel: true, protagonist: 'Human', musical: false },
  'kung fu panda':             { style: 'CGI/3D',           studio: 'DreamWorks', sequel: true,  protagonist: 'Animal',           musical: false },
  'kung fu panda 2':           { style: 'CGI/3D',           studio: 'DreamWorks', sequel: true,  protagonist: 'Animal',           musical: false },
  'kung fu panda 3':           { style: 'CGI/3D',           studio: 'DreamWorks', sequel: true,  protagonist: 'Animal',           musical: false },
  'kung fu panda 4':           { style: 'CGI/3D',           studio: 'DreamWorks', sequel: true,  protagonist: 'Animal',           musical: false },
  'the prince of egypt':       { style: 'Hand-drawn (2D)',  studio: 'DreamWorks', sequel: false, protagonist: 'Human',            musical: true  },
  'antz':                      { style: 'CGI/3D',           studio: 'DreamWorks', sequel: false, protagonist: 'Animal',           musical: false },
  'chicken run':               { style: 'Stop-motion',      studio: 'DreamWorks', sequel: true,  protagonist: 'Animal',           musical: false },
  'chicken run: dawn of the nugget': { style: 'Stop-motion', studio: 'DreamWorks', sequel: true, protagonist: 'Animal', musical: false },
  'spirit: stallion of the cimarron': { style: 'Hand-drawn (2D)', studio: 'DreamWorks', sequel: false, protagonist: 'Animal', musical: false },
  'sinbad: legend of the seven seas': { style: 'Hand-drawn (2D)', studio: 'DreamWorks', sequel: false, protagonist: 'Human', musical: false },
  'shark tale':                { style: 'CGI/3D',            studio: 'DreamWorks', sequel: false, protagonist: 'Animal',           musical: false },
  'over the hedge':            { style: 'CGI/3D',            studio: 'DreamWorks', sequel: false, protagonist: 'Animal',           musical: false },
  'flushed away':              { style: 'CGI/3D',            studio: 'DreamWorks', sequel: false, protagonist: 'Animal',           musical: false },
  'bee movie':                 { style: 'CGI/3D',            studio: 'DreamWorks', sequel: false, protagonist: 'Animal',           musical: false },
  'kung fu panda: the dragon knight': { style: 'CGI/3D',    studio: 'DreamWorks', sequel: true,  protagonist: 'Animal',           musical: false },
  'megamind':                  { style: 'CGI/3D',            studio: 'DreamWorks', sequel: false, protagonist: 'Fantasy Creature', musical: false },
  'puss in boots':             { style: 'CGI/3D',            studio: 'DreamWorks', sequel: true,  protagonist: 'Animal',           musical: false },
  'puss in boots: the last wish': { style: 'CGI/3D',        studio: 'DreamWorks', sequel: true,  protagonist: 'Animal',           musical: false },
  'the croods':                { style: 'CGI/3D',            studio: 'DreamWorks', sequel: true,  protagonist: 'Human',            musical: false },
  'the croods: a new age':     { style: 'CGI/3D',            studio: 'DreamWorks', sequel: true,  protagonist: 'Human',            musical: false },
  'turbo':                     { style: 'CGI/3D',            studio: 'DreamWorks', sequel: false, protagonist: 'Animal',           musical: false },
  'mr. peabody & sherman':     { style: 'CGI/3D',            studio: 'DreamWorks', sequel: false, protagonist: 'Animal',           musical: false },
  'home':                      { style: 'CGI/3D',            studio: 'DreamWorks', sequel: false, protagonist: 'Fantasy Creature', musical: false },
  'trolls':                    { style: 'CGI/3D',            studio: 'DreamWorks', sequel: true,  protagonist: 'Fantasy Creature', musical: true  },
  'trolls world tour':         { style: 'CGI/3D',            studio: 'DreamWorks', sequel: true,  protagonist: 'Fantasy Creature', musical: true  },
  'trolls band together':      { style: 'CGI/3D',            studio: 'DreamWorks', sequel: true,  protagonist: 'Fantasy Creature', musical: true  },
  'the bad guys':              { style: 'CGI/3D',            studio: 'DreamWorks', sequel: false, protagonist: 'Animal',           musical: false },
  'the wild robot':            { style: 'CGI/3D',            studio: 'DreamWorks', sequel: false, protagonist: 'Robot/AI',         musical: false },
  'abominable':                { style: 'CGI/3D',            studio: 'DreamWorks', sequel: false, protagonist: 'Fantasy Creature', musical: false },
  'captain underpants: the first epic movie': { style: 'CGI/3D', studio: 'DreamWorks', sequel: false, protagonist: 'Human', musical: false },
  'joseph: king of dreams':    { style: 'Hand-drawn (2D)', studio: 'DreamWorks', sequel: false, protagonist: 'Human', musical: true },

  // =========================================================
  // ILLUMINATION — all CGI/3D, Studio: Illumination
  // =========================================================
  'despicable me':             { style: 'CGI/3D', studio: 'Illumination', sequel: true,  protagonist: 'Human',            musical: false },
  'despicable me 2':           { style: 'CGI/3D', studio: 'Illumination', sequel: true,  protagonist: 'Human',            musical: false },
  'despicable me 3':           { style: 'CGI/3D', studio: 'Illumination', sequel: true,  protagonist: 'Human',            musical: false },
  'despicable me 4':           { style: 'CGI/3D', studio: 'Illumination', sequel: true,  protagonist: 'Human',            musical: false },
  'minions':                   { style: 'CGI/3D', studio: 'Illumination', sequel: true,  protagonist: 'Fantasy Creature', musical: false },
  'minions: the rise of gru':  { style: 'CGI/3D', studio: 'Illumination', sequel: true,  protagonist: 'Fantasy Creature', musical: false },
  'the lorax':                 { style: 'CGI/3D', studio: 'Illumination', sequel: false, protagonist: 'Fantasy Creature', musical: true  },
  'the secret life of pets':   { style: 'CGI/3D', studio: 'Illumination', sequel: true,  protagonist: 'Animal',           musical: false },
  'the secret life of pets 2': { style: 'CGI/3D', studio: 'Illumination', sequel: true,  protagonist: 'Animal',           musical: false },
  'sing':                      { style: 'CGI/3D', studio: 'Illumination', sequel: true,  protagonist: 'Animal',           musical: true  },
  'sing 2':                    { style: 'CGI/3D', studio: 'Illumination', sequel: true,  protagonist: 'Animal',           musical: true  },
  'the grinch':                { style: 'CGI/3D', studio: 'Illumination', sequel: false, protagonist: 'Fantasy Creature', musical: false },
  'migration':                 { style: 'CGI/3D', studio: 'Illumination', sequel: false, protagonist: 'Animal',           musical: false },
  'hop':                       { style: 'Mixed',  studio: 'Illumination', sequel: false, protagonist: 'Animal',           musical: false },

  // =========================================================
  // DREAMWORKS — additional entries
  // =========================================================
  'monsters vs aliens':              { style: 'CGI/3D', studio: 'DreamWorks', sequel: false, protagonist: 'Human',            musical: false },
  'the boss baby':                   { style: 'CGI/3D', studio: 'DreamWorks', sequel: true,  protagonist: 'Human',            musical: false },
  'wallace & gromit: the curse of the were-rabbit': { style: 'Claymation', studio: 'DreamWorks', sequel: true, protagonist: 'Animal', musical: false },
  'rise of the guardians':           { style: 'CGI/3D', studio: 'DreamWorks', sequel: false, protagonist: 'Fantasy Creature', musical: false },
  'the road to el dorado':           { style: 'Hand-drawn (2D)', studio: 'DreamWorks', sequel: false, protagonist: 'Human',   musical: true  },
  'penguins of madagascar':          { style: 'CGI/3D', studio: 'DreamWorks', sequel: true,  protagonist: 'Animal',           musical: false },
  'ruby gillman, teenage kraken':    { style: 'CGI/3D', studio: 'DreamWorks', sequel: false, protagonist: 'Fantasy Creature', musical: false },

  // =========================================================
  // ILLUMINATION — additional entries
  // =========================================================
  'the super mario bros. movie':     { style: 'CGI/3D', studio: 'Illumination', sequel: true,  protagonist: 'Human',          musical: false },
  'the super mario galaxy movie':    { style: 'CGI/3D', studio: 'Illumination', sequel: true,  protagonist: 'Human',          musical: false },

  // =========================================================
  // STUDIO GHIBLI — additional entries
  // =========================================================
  'my neighbors the yamadas':        { style: 'Hand-drawn (2D)', studio: 'Studio Ghibli', sequel: false, protagonist: 'Human', musical: false },
  'ocean waves':                     { style: 'Hand-drawn (2D)', studio: 'Studio Ghibli', sequel: false, protagonist: 'Human', musical: false },
  'tales from earthsea':             { style: 'Hand-drawn (2D)', studio: 'Studio Ghibli', sequel: false, protagonist: 'Human', musical: false },
  'earwig and the witch':            { style: 'CGI/3D',           studio: 'Studio Ghibli', sequel: false, protagonist: 'Human', musical: false },

  // =========================================================
  // LAIKA — all Stop-motion
  // =========================================================
  'coraline':                  { style: 'Stop-motion', studio: 'Laika', sequel: false, protagonist: 'Human',            musical: false },
  'paranorman':                { style: 'Stop-motion', studio: 'Laika', sequel: false, protagonist: 'Human',            musical: false },
  'the boxtrolls':             { style: 'Stop-motion', studio: 'Laika', sequel: false, protagonist: 'Human',            musical: false },
  'kubo and the two strings':  { style: 'Stop-motion', studio: 'Laika', sequel: false, protagonist: 'Human',            musical: false },
  'missing link':              { style: 'Stop-motion', studio: 'Laika', sequel: false, protagonist: 'Fantasy Creature', musical: false },

  // =========================================================
  // SONY ANIMATION — mostly CGI
  // =========================================================
  'spider-man: into the spider-verse': { style: 'CGI/3D', studio: 'Sony Animation', sequel: true, protagonist: 'Human', musical: false },
  'spider-man: across the spider-verse': { style: 'CGI/3D', studio: 'Sony Animation', sequel: true, protagonist: 'Human', musical: false },
  'the mitchell vs the machines': { style: 'CGI/3D', studio: 'Sony Animation', sequel: false, protagonist: 'Human', musical: false },
  'the mitchells vs. the machines': { style: 'CGI/3D', studio: 'Sony Animation', sequel: false, protagonist: 'Human', musical: false },
  'cloudy with a chance of meatballs': { style: 'CGI/3D', studio: 'Sony Animation', sequel: true, protagonist: 'Human', musical: false },
  'cloudy with a chance of meatballs 2': { style: 'CGI/3D', studio: 'Sony Animation', sequel: true, protagonist: 'Human', musical: false },
  'the pirates! band of misfits': { style: 'Stop-motion', studio: 'Sony Animation', sequel: false, protagonist: 'Human', musical: false },
  'open season':               { style: 'CGI/3D', studio: 'Sony Animation', sequel: true,  protagonist: 'Animal', musical: false },
  'surf\'s up':                { style: 'CGI/3D', studio: 'Sony Animation', sequel: false, protagonist: 'Animal', musical: false },
  'hotel transylvania':        { style: 'CGI/3D', studio: 'Sony Animation', sequel: true,  protagonist: 'Fantasy Creature', musical: false },
  'hotel transylvania 2':      { style: 'CGI/3D', studio: 'Sony Animation', sequel: true,  protagonist: 'Fantasy Creature', musical: false },
  'hotel transylvania 3: summer vacation': { style: 'CGI/3D', studio: 'Sony Animation', sequel: true, protagonist: 'Fantasy Creature', musical: false },
  'the emoji movie':           { style: 'CGI/3D', studio: 'Sony Animation', sequel: false, protagonist: 'Object',    musical: false },
  'open season':               { style: 'CGI/3D', studio: 'Sony Animation', sequel: true,  protagonist: 'Animal',    musical: false },
};

// ---------------------------------------------------------------
// Parent company map (for yellow match logic — stored as comment,
// used on the frontend)
// ---------------------------------------------------------------
// Pixar  ↔ Disney  = yellow (both owned by Disney)
// All others must be exact for green

// ---------------------------------------------------------------
// Studio defaults for unknown movies (fallback by studio name guess)
// ---------------------------------------------------------------
const STUDIO_DEFAULTS = {
  'Pixar':         { style: 'CGI/3D',          studio: 'Pixar'         },
  'Disney':        { style: 'CGI/3D',          studio: 'Disney'        },
  'DreamWorks':    { style: 'CGI/3D',          studio: 'DreamWorks'    },
  'Studio Ghibli': { style: 'Hand-drawn (2D)', studio: 'Studio Ghibli' },
  'Illumination':  { style: 'CGI/3D',          studio: 'Illumination'  },
  'Laika':         { style: 'Stop-motion',     studio: 'Laika'         },
  'Sony Animation':   { style: 'CGI/3D', studio: 'Sony Animation'   },
  'Blue Sky Studios': { style: 'CGI/3D', studio: 'Blue Sky Studios' },
};

// ---------------------------------------------------------------
// Main
// ---------------------------------------------------------------
async function main() {
  console.log('CineGuess — Populating animated metadata\n');

  const client = await pool.connect();
  try {
    // Fetch all animated movies from DB
    const { rows: movies } = await client.query(
      `SELECT id, title, year FROM movies WHERE 'animated' = ANY(categories)`
    );

    console.log(`Found ${movies.length} animated movies in DB\n`);

    let matched = 0, unmatched = 0;
    const unmatchedList = [];

    for (const movie of movies) {
      const key = movie.title.toLowerCase().trim();
      const meta = META[key];

      if (meta) {
        await client.query(
          `UPDATE movies SET
             animation_style  = $1,
             animation_studio = $2,
             has_sequel       = $3,
             protagonist_type = $4,
             is_musical       = $5
           WHERE id = $6`,
          [meta.style, meta.studio, meta.sequel, meta.protagonist, meta.musical, movie.id]
        );
        matched++;
      } else {
        // Try partial match (strip subtitle after colon)
        const shortKey = key.split(':')[0].trim();
        const partialMeta = META[shortKey];
        if (partialMeta) {
          await client.query(
            `UPDATE movies SET
               animation_style  = $1,
               animation_studio = $2,
               has_sequel       = $3,
               protagonist_type = $4,
               is_musical       = $5
             WHERE id = $6`,
            [partialMeta.style, partialMeta.studio, partialMeta.sequel, partialMeta.protagonist, partialMeta.musical, movie.id]
          );
          matched++;
        } else {
          unmatched++;
          unmatchedList.push(`"${movie.title}" (${movie.year})`);
          // Set reasonable defaults so the game still works
          await client.query(
            `UPDATE movies SET
               animation_style  = 'CGI/3D',
               has_sequel       = false,
               protagonist_type = 'Human',
               is_musical       = false
             WHERE id = $1 AND animation_style IS NULL`,
            [movie.id]
          );
        }
      }
    }

    console.log(`Matched:   ${matched}`);
    console.log(`Unmatched: ${unmatched} (set to defaults)`);

    if (unmatchedList.length) {
      console.log('\nMovies using defaults (add to META map if needed):');
      unmatchedList.forEach(m => console.log(`  - ${m}`));
    }

    // Summary
    const { rows: stats } = await client.query(`
      SELECT animation_studio, COUNT(*) as count
      FROM movies WHERE 'animated' = ANY(categories)
      GROUP BY animation_studio ORDER BY count DESC
    `);
    console.log('\nMovies per studio:');
    stats.forEach(s => console.log(`  ${s.animation_studio || 'Unknown'}: ${s.count}`));

    console.log('\nDone! Animated metadata populated.');
  } finally {
    client.release();
  }

  process.exit(0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
