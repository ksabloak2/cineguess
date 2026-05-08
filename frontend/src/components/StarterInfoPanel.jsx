/**
 * StarterInfoPanel
 *
 * Displays Oscar info and franchise status for a movie.
 * - When Wikidata categories are available: shows nomination count + category pills
 * - When only OMDb data: falls back to showing win count
 * Used both as a standalone modal (before hints unlock) and as the
 * header section inside HintModal (after hints unlock).
 */
export default function StarterInfoPanel({ starterInfo }) {
  if (!starterInfo) return null;

  const { oscar_wins, oscar_nomination_categories, oscar_win_categories, franchise_name } = starterInfo;

  const hasOscarData = oscar_wins !== null && oscar_wins !== undefined;
  const wins         = oscar_wins ?? 0;
  const categories   = Array.isArray(oscar_nomination_categories)
    ? [...oscar_nomination_categories].sort()
    : [];
  const winCats      = Array.isArray(oscar_win_categories)
    ? [...oscar_win_categories].sort()
    : [];

  // If Wikidata gave us nomination categories, use that count as nominations.
  // If only win categories, show those. Otherwise fall back to OMDb win count.
  const hasNominations  = categories.length > 0;
  const nominationCount = categories.length;

  const cleanFranchise = franchise_name
    ? franchise_name.replace(/ Collection$/, ' series')
    : null;

  return (
    <div className="flex flex-col gap-2.5">
      {/* Oscar info */}
      <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 px-3.5 py-3">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-base">🏆</span>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-400/80">
            Oscar Nominations
          </span>
        </div>
        {!hasOscarData ? (
          <p className="text-xs text-gray-500 italic">Loading…</p>
        ) : hasNominations ? (
          <>
            <p className="text-sm font-semibold text-amber-300 mb-1.5">
              {nominationCount} nomination{nominationCount !== 1 ? 's' : ''}
            </p>
            <ul className="flex flex-wrap gap-1.5">
              {categories.map((cat, i) => (
                <li
                  key={i}
                  className="text-[10px] sm:text-xs px-2 py-0.5 rounded-full
                             bg-amber-500/15 border border-amber-500/25 text-amber-200/90"
                >
                  {cat}
                </li>
              ))}
            </ul>
          </>
        ) : winCats.length > 0 ? (
          <>
            <p className="text-sm font-semibold text-amber-300 mb-1.5">
              Won {winCats.length} Oscar{winCats.length !== 1 ? 's' : ''}
            </p>
            <ul className="flex flex-wrap gap-1.5">
              {winCats.map((cat, i) => (
                <li
                  key={i}
                  className="text-[10px] sm:text-xs px-2 py-0.5 rounded-full
                             bg-amber-500/15 border border-amber-500/25 text-amber-200/90"
                >
                  {cat}
                </li>
              ))}
            </ul>
          </>
        ) : wins > 0 ? (
          <p className="text-sm font-semibold text-amber-300">
            Won {wins} Oscar{wins !== 1 ? 's' : ''}
          </p>
        ) : (
          <p className="text-sm text-gray-400">No Oscar nominations</p>
        )}
      </div>

      {/* Franchise */}
      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-3.5 py-3">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-base">🎬</span>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-400/70">
            Franchise
          </span>
        </div>
        {cleanFranchise ? (
          <p className="text-sm text-amber-200 font-semibold">Part of a franchise</p>
        ) : (
          <p className="text-sm text-gray-400">Standalone film</p>
        )}
      </div>
    </div>
  );
}
