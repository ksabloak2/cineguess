/**
 * StarterInfoPanel
 *
 * Displays Oscar nomination info and franchise status for a movie.
 * Used both as a standalone modal (before hints unlock) and as the
 * header section inside HintModal (after hints unlock).
 */
export default function StarterInfoPanel({ starterInfo }) {
  if (!starterInfo) return null;

  const { oscar_nominations, oscar_nomination_categories, franchise_name } = starterInfo;

  // While data is still being populated oscar_nominations may be null
  const hasOscarData = oscar_nominations !== null && oscar_nominations !== undefined;
  const nominations  = oscar_nominations ?? 0;
  const categories   = Array.isArray(oscar_nomination_categories)
    ? oscar_nomination_categories
    : [];
  const cleanFranchise = franchise_name
    ? franchise_name.replace(/ Collection$/, ' series')
    : null;

  return (
    <div className="flex flex-col gap-2.5">
      {/* Oscar nominations */}
      <div className="rounded-xl border border-yellow-500/25 bg-yellow-500/5 px-3.5 py-3">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-base">🏆</span>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-yellow-400/80">
            Oscar Nominations
          </span>
        </div>
        {!hasOscarData ? (
          <p className="text-xs text-gray-500 italic">Loading…</p>
        ) : nominations === 0 ? (
          <p className="text-sm text-gray-400">No Oscar nominations</p>
        ) : (
          <>
            <p className="text-sm font-semibold text-yellow-300 mb-1">
              {nominations} nomination{nominations !== 1 ? 's' : ''}
            </p>
            {categories.length > 0 && (
              <ul className="flex flex-wrap gap-1.5 mt-1">
                {categories.map((cat, i) => (
                  <li
                    key={i}
                    className="text-[10px] sm:text-xs px-2 py-0.5 rounded-full
                               bg-yellow-500/15 border border-yellow-500/25 text-yellow-200/90"
                  >
                    {cat}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>

      {/* Franchise */}
      <div className="rounded-xl border border-blue-500/25 bg-blue-500/5 px-3.5 py-3">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-base">🎬</span>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-blue-400/80">
            Franchise
          </span>
        </div>
        {cleanFranchise ? (
          <p className="text-sm text-blue-200">
            Part of the <span className="font-semibold">{cleanFranchise}</span>
          </p>
        ) : (
          <p className="text-sm text-gray-400">Standalone film</p>
        )}
      </div>
    </div>
  );
}
