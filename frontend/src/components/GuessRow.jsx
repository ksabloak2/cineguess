import { useState } from 'react';
import { getTileFields, getTileLabels, getTileTooltips, getTileDisplayValue } from '../utils/gameLogic';
import { tmdbImage } from '../utils/api';

// ── Soft-hyphen helper ─────────────────────────────────────────────────────
// CSS `hyphens: auto` relies on a locale dictionary that doesn't know
// invented words ("MULTIVERSE", "NOLANVERSE"). So for every word ≥ 4 chars we
// sprinkle a soft hyphen (U+00AD) at EVERY interior position. Soft hyphens
// are invisible unless the browser actually uses one as a line break, at
// which point it renders a real hyphen there — so short words on lines that
// fit show nothing extra, but any word that has to wrap gets a hyphen at
// whichever split point the browser picks. First/last 2 chars are skipped
// to avoid ugly breaks like "M-ULTIVERSE" or "MULTIVERS-E".
function softHyphenate(text) {
  if (!text) return text;
  return String(text).replace(/\S+/g, (word) => {
    if (word.length < 4) return word;
    const keepHead = 2;
    const keepTail = 2;
    if (word.length <= keepHead + keepTail) return word;
    const head   = word.slice(0, keepHead);
    const middle = word.slice(keepHead, word.length - keepTail).split('').join('\u00AD');
    const tail   = word.slice(word.length - keepTail);
    return `${head}\u00AD${middle}\u00AD${tail}`;
  });
}

const COLOR_CLASS = {
  green:  'tile-green',
  amber:  'tile-amber',
  cyan:   'tile-cyan',
  yellow: 'tile-yellow',
  // legacy keys kept for rows hydrated from old server responses
  'orange-yellow': 'tile-amber',
  'light-yellow':  'tile-amber',
  red:             'tile-red',
  empty:           'tile-empty',
};

function TileLabel({ field, labels, tooltips, isFirst, isLast }) {
  const [visible, setVisible] = useState(false);
  const isLong = field === 'lead_actor' || field === 'supporting_actor'
             || field === 'animation_studio' || field === 'protagonist_type'
             || field === 'superhero_universe' || field === 'superpower_type' || field === 'hero_villain_focus';

  // Anchor tooltip to the edge it's nearest to so it never clips off-screen.
  const tooltipStyle = isLast
    ? { right: 0 }
    : isFirst
    ? { left: 0 }
    : { left: '50%', transform: 'translateX(-50%)' };

  // Caret should track the same anchor so it always points at the ℹ button.
  const caretClass = isLast
    ? 'absolute top-full right-2 border-4 border-transparent border-t-gray-700'
    : isFirst
    ? 'absolute top-full left-2 border-4 border-transparent border-t-gray-700'
    : 'absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-700';

  return (
    <div className="relative flex items-center justify-center gap-0.5">
      <span className="text-[9px] sm:text-[10px] text-gray-600 font-medium uppercase tracking-wide text-center leading-tight">
        {labels[field]}
      </span>
      <button
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
        onFocus={() => setVisible(true)}
        onBlur={() => setVisible(false)}
        className="text-gray-700 hover:text-gray-400 transition-colors leading-none focus:outline-none flex-shrink-0"
        aria-label={`Info about ${labels[field]}`}
      >
        <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd"
            d="M18 10A8 8 0 1 1 2 10a8 8 0 0 1 16 0zm-8-3a1 1 0 1 0 0 2 1 1 0 0 0 0-2zm-1 4a1 1 0 0 1 2 0v3a1 1 0 1 1-2 0v-3z"
            clipRule="evenodd" />
        </svg>
      </button>
      {visible && (
        <div className={`
          absolute bottom-full mb-1.5 z-50
          bg-gray-900 border border-gray-700 text-white text-[11px]
          rounded-lg px-2.5 py-1.5 shadow-xl pointer-events-none
          text-center leading-snug
          ${isLong ? 'whitespace-normal w-44' : 'whitespace-nowrap'}
        `}
          style={tooltipStyle}
        >
          {tooltips[field]}
          <div className={caretClass} />
        </div>
      )}
    </div>
  );
}

export default function GuessRow({ movie, tiles, isNew = false, category = 'top250' }) {
  const isEmpty    = !movie;
  const tileFields = getTileFields(category);
  const labels     = getTileLabels(category);
  const tooltips   = getTileTooltips(category);
  const [openTile, setOpenTile] = useState(null);

  if (isEmpty) return null;

  return (
    <div className={`game-row-outer flex gap-2 sm:gap-4 items-start w-full ${isNew ? 'animate-slide-in-r' : ''}`}>
      {/* Poster — compact on mobile, locked 2:3 aspect ratio so it never distorts */}
      <div className="game-poster w-11 sm:w-16 lg:w-20 aspect-[2/3] rounded-lg sm:rounded-xl overflow-hidden flex-shrink-0 bg-surface-border ring-1 ring-white/5">
        {movie.poster_path ? (
          <img
            src={tmdbImage(movie.poster_path, 'w185')}
            alt={movie.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-700 text-xl">🎬</div>
        )}
      </div>

      {/* Content */}
      <div className="game-row-content flex-1 min-w-0 flex flex-col justify-center gap-1.5 sm:gap-2">
        {/* Title */}
        <p className="game-row-title text-sm sm:text-base lg:text-lg font-bold text-white truncate leading-tight">
          {movie.title}
          <span className="text-gray-500 font-normal text-[11px] sm:text-sm ml-1.5 sm:ml-2">({movie.year})</span>
        </p>

        {/* Tiles — equal columns, fit available width. Sticky header handles labels on mobile */}
        <div className="game-tile-row flex gap-1 sm:gap-1.5 w-full min-w-0" lang="en">
          {tileFields.map((field, i) => {
            const color      = tiles?.[field] || 'empty';
            const displayVal = getTileDisplayValue(field, movie);
            const delay      = isNew ? i * 80 : 0;
            // The Universe column carries the longest strings in the game
            // (e.g. "Multiverse Saga", "Nolanverse") — give it 15% more width
            // than its siblings so text breaks more gracefully.
            const isUniverse = field === 'superhero_universe';
            const flexBasis  = isUniverse ? '1.15 1 0%' : '1 1 0%';
            const isFirst    = i === 0;
            const isLast     = i === tileFields.length - 1;

            const isOpen = openTile === field;
            return (
              <div
                key={field}
                className="relative flex flex-col items-center gap-1 min-w-0"
                style={{
                  flex: flexBasis,
                  ...(isNew ? { animation: `flipIn 0.45s ease ${delay}ms both` } : null),
                }}
              >
                {/* Per-row label — desktop only; mobile uses the sticky header */}
                <div className="hidden sm:flex w-full justify-center">
                  <TileLabel field={field} labels={labels} tooltips={tooltips} isFirst={isFirst} isLast={isLast} />
                </div>
                <button
                  type="button"
                  onClick={() => setOpenTile(isOpen ? null : field)}
                  onBlur={() => setOpenTile((v) => (v === field ? null : v))}
                  className={`game-tile-box tile ${COLOR_CLASS[color]} w-full text-center
                              flex items-center justify-center font-semibold
                              focus:outline-none active:scale-[0.97] transition-transform`}
                  style={{
                    height:       '44px',
                    // Shrinks below the floor only if the word is exceptionally
                    // long; normal values sit at 0.75rem on wider mobile.
                    fontSize:     'clamp(0.6rem, 2vw, 0.75rem)',
                    lineHeight:   1.1,
                    padding:      '2px 2px',
                    overflow:     'hidden',
                    wordBreak:    'break-word',
                    overflowWrap: 'anywhere',
                    hyphens:      'manual',
                    WebkitHyphens: 'manual',
                  }}
                  title={displayVal}
                  aria-label={`${labels[field]}: ${displayVal}`}
                >
                  {field === 'year' && color !== 'green' && color !== 'empty' && tiles?._targetYear ? (
                    (() => {
                      const isHighlight = color === 'cyan' || color === 'amber';
                      return (
                        <span className="whitespace-nowrap" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1px' }}>
                          <span>{displayVal}</span>
                          <span style={{
                            fontWeight: 900,
                            fontSize: isHighlight ? '1em' : undefined,
                            color: isHighlight ? 'rgba(0,0,0,0.75)' : 'rgba(255,255,255,0.80)',
                          }}>
                            {movie.year < tiles._targetYear ? '↑' : '↓'}
                          </span>
                        </span>
                      );
                    })()
                  ) : (
                    <span
                      className="block w-full"
                      style={{
                        display:          '-webkit-box',
                        WebkitLineClamp:  2,
                        WebkitBoxOrient:  'vertical',
                        overflow:         'hidden',
                        textAlign:        'center',
                        lineHeight:       1.1,
                        wordBreak:        'break-word',
                        overflowWrap:     'anywhere',
                        hyphens:          'manual',
                        WebkitHyphens:    'manual',
                      }}
                    >
                      {softHyphenate(displayVal)}
                    </span>
                  )}
                </button>

                {/* Popover — full value on tap (for truncated mobile tiles) */}
                {isOpen && (
                  <div
                    className="absolute bottom-full mb-2 z-40 pointer-events-none"
                    style={{ left: '50%', transform: 'translateX(-50%)' }}
                  >
                    <div className="bg-gray-900 border border-gray-700 rounded-lg px-2.5 py-1.5
                                    shadow-xl text-center leading-snug whitespace-normal
                                    w-max max-w-[180px]">
                      <p className="text-[9px] uppercase tracking-wider text-gray-500 font-semibold mb-0.5">
                        {labels[field]}
                      </p>
                      <p className="text-[11px] text-white font-medium">
                        {displayVal}
                      </p>
                      <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-700" />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
