import { useState } from 'react';
import GuessRow from './GuessRow';
import { getTileFields, getTileLabels, getTileTooltips } from '../utils/gameLogic';

export default function GameBoard({ guessResults, category = 'top250', latestIndex = -1 }) {
  if (!guessResults.length) return null;

  const tileFields = getTileFields(category);
  const labels     = getTileLabels(category);
  const tooltips   = getTileTooltips(category);

  return (
    <div className="w-full">
      {/* ── Desktop density compression — strictly ≥ 1024px only ── */}
      <style>{`
        @media (min-width: 1024px) {
          .game-board-rows > * + * { margin-top: 6px !important; }
          .game-row-outer           { gap: 8px !important; }
          .game-poster              { width: 44px !important; }
          .game-row-content         { gap: 2px !important; }
          .game-row-title           { font-size: 0.875rem !important; line-height: 1.3 !important; }
          .game-tile-row            { gap: 3px !important; }
          .game-tile-box            { height: 36px !important; font-size: clamp(0.52rem, 1.1vw, 0.67rem) !important; padding: 2px 1px !important; }
        }
      `}</style>
      <div className="w-full">

        {/* ── Sticky column-label header (mobile only) ───────────── */}
        <StickyHeader tileFields={tileFields} labels={labels} tooltips={tooltips} />

        {/* ── Guess rows ─────────────────────────────────────────── */}
        <div className="game-board-rows space-y-2.5 sm:space-y-3">
          {guessResults.map((guess, i) => (
            <GuessRow
              key={i}
              index={i}
              movie={guess.movie}
              tiles={guess.tiles}
              isNew={i === latestIndex}
              category={category}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Sticky header aligned with GuessRow columns ────────────────────────────
function StickyHeader({ tileFields, labels, tooltips }) {
  return (
    <div className="flex gap-2 items-end mb-2 sm:hidden">
      {/* Spacer matches poster column width on mobile (w-11 = 44px) */}
      <div className="w-11 flex-shrink-0" aria-hidden />

      {/* Column labels — one per tile, equal flex so they line up with boxes */}
      <div className="flex-1 flex gap-1 min-w-0">
        {tileFields.map((field, idx) => (
          <HeaderLabel
            key={field}
            field={field}
            labels={labels}
            tooltips={tooltips}
            isFirst={idx === 0}
            isLast={idx === tileFields.length - 1}
          />
        ))}
      </div>
    </div>
  );
}

function HeaderLabel({ field, labels, tooltips, isFirst, isLast }) {
  const [visible, setVisible] = useState(false);
  // Mirror the 15% width boost used for the Universe tile so the label
  // still sits exactly above its column.
  const isUniverse = field === 'superhero_universe';

  // Position tooltip so it never clips off either screen edge:
  // first column → anchor to left, last column → anchor to right, middle → center.
  const tooltipStyle = isLast
    ? { right: 0 }
    : isFirst
    ? { left: 0 }
    : { left: '50%', transform: 'translateX(-50%)' };

  return (
    <div
      className="relative min-w-0 flex items-center justify-center"
      style={{ flex: isUniverse ? '1.15 1 0%' : '1 1 0%' }}
    >
      <button
        onClick={() => setVisible((v) => !v)}
        onBlur={() => setVisible(false)}
        className="w-full text-[8px] font-semibold uppercase tracking-tight text-gray-500
                   leading-tight text-center whitespace-nowrap overflow-hidden text-ellipsis
                   focus:outline-none px-0.5"
      >
        {labels[field]}
      </button>
      {visible && (
        <div
          className="absolute top-full mt-1.5 z-50 bg-gray-900 border border-gray-700 text-white
                     text-[11px] rounded-lg px-2.5 py-1.5 shadow-xl pointer-events-none
                     whitespace-normal w-44 text-center leading-snug"
          style={tooltipStyle}
        >
          {tooltips[field]}
        </div>
      )}
    </div>
  );
}
