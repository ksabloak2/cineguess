import { useEffect, useState } from 'react';
import ReportIssueModal from './ReportIssueModal';

const PAGES = ['How to Play', 'Scoring', 'Rankings', 'Categories', 'Credits & Legal'];

// ── Rules modal ─────────────────────────────────────────────────────────────
export default function RulesModal({ open, onClose, initialPage = 0 }) {
  const [reportOpen, setReportOpen] = useState(false);
  const [page, setPage]             = useState(initialPage);

  // Reset to initialPage each time the modal opens
  useEffect(() => {
    if (open) setPage(initialPage);
  }, [open, initialPage]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 animate-fade-in"
      onClick={onClose}
      style={{ background: 'rgba(5,5,10,0.88)' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-lg sm:max-w-xl max-h-[88dvh] overflow-y-auto
                   rounded-2xl p-6 sm:p-8 animate-slide-up scrollbar-hide"
        style={{
          background: 'linear-gradient(180deg, rgba(22,22,28,0.92) 0%, rgba(15,15,20,0.96) 100%)',
          border:     '1px solid rgba(243,206,19,0.22)',
          boxShadow:  '0 20px 60px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.05), 0 0 60px rgba(243,206,19,0.08)',
        }}
      >
        {/* Close */}
        <button
          onClick={onClose}
          aria-label="Close rules"
          className="absolute top-4 right-4 w-9 h-9 rounded-xl flex items-center justify-center
                     text-gray-500 hover:text-white hover:bg-white/10 transition-all"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Header */}
        <div className="mb-5">
          <h2
            className="font-display text-2xl sm:text-3xl font-black text-white tracking-tight"
            style={{ textShadow: '0 0 28px rgba(243,206,19,0.35)' }}
          >
            Cine<span style={{ color: '#F3CE13' }}>GUESS</span> Rules
          </h2>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 mb-6 p-1 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
          {PAGES.map((label, i) => (
            <button
              key={label}
              onClick={() => setPage(i)}
              className="flex-1 py-1.5 px-0.5 rounded-lg text-[8.5px] sm:text-[10px] font-semibold transition-all text-center leading-tight"
              style={page === i ? {
                background: 'rgba(243,206,19,0.15)',
                color:      '#F3CE13',
                border:     '1px solid rgba(243,206,19,0.30)',
              } : {
                color:      'rgba(156,163,175,1)',
                border:     '1px solid transparent',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ── Page 0: How to Play ── */}
        {page === 0 && (
          <>
            {/* Rules list */}
            <ol className="space-y-3.5 mb-7">
              {RULES.map((rule, i) => (
                <li key={i} className="flex gap-3 sm:gap-4">
                  <span
                    className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center
                               text-[11px] font-bold text-accent"
                    style={{ background: 'rgba(243,206,19,0.10)', border: '1px solid rgba(243,206,19,0.25)' }}
                  >
                    {i + 1}
                  </span>
                  <p className="text-sm sm:text-[15px] text-gray-200 leading-relaxed">{rule}</p>
                </li>
              ))}
            </ol>

            {/* Tile columns section */}
            <div className="rounded-xl p-4 sm:p-5 mb-5" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <p className="text-[10px] uppercase tracking-[0.25em] font-semibold text-gray-500 mb-3">What Each Tile Compares</p>
              <div className="space-y-2">
                {TILE_COLUMNS.map(({ icon, label, detail }) => (
                  <div key={label} className="flex items-start gap-3">
                    <span className="text-base flex-shrink-0 w-5 text-center">{icon}</span>
                    <div className="min-w-0">
                      <span className="text-xs font-semibold text-white">{label}</span>
                      <span className="text-[11px] text-gray-400 ml-1.5">{detail}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Color legend */}
            <div className="rounded-xl p-4 sm:p-5" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <p className="text-[10px] uppercase tracking-[0.25em] font-semibold text-gray-500 mb-3">Color Legend</p>
              <div className="space-y-2.5">
                <LegendRow color="green"  label="Exact Match"   desc="Genre, director, actor, or studio is identical to the target." />
                <LegendRow color="cyan"   label="Very Close"    desc="Year only: your guess is within 2 years of the target. Arrow shows direction ↑↓." />
                <LegendRow color="amber"  label="Close"         desc="Year only: your guess is within 5 years of the target. Arrow shows direction ↑↓." />
                <LegendRow color="yellow" label="Partial Match" desc="Shared genre, actor in a different role, same parent studio (e.g. Warner Bros. & New Line Cinema), or in Superhero: same parent universe." />
                <LegendRow color="red"    label="No Match"      desc="Nothing in common for this attribute, or off by more than 5 years." />
              </div>
            </div>

            {/* Progressive hints */}
            <div className="rounded-xl p-4 sm:p-5 mt-5" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <p className="text-[10px] uppercase tracking-[0.25em] font-semibold text-gray-500 mb-3">Progressive Hints</p>
              <div className="space-y-2">
                {HINTS.map(({ icon, trigger, label, detail }) => (
                  <div key={label} className="flex items-start gap-3">
                    <span className="text-base flex-shrink-0 w-5 text-center">{icon}</span>
                    <div className="min-w-0">
                      <span className="text-[10px] font-bold text-accent/70 uppercase tracking-wide mr-1.5">{trigger}</span>
                      <span className="text-xs font-semibold text-white">{label}</span>
                      <p className="text-[11px] text-gray-400 mt-0.5">{detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </>
        )}

        {/* ── Page 1: Scoring ── */}
        {page === 1 && (
          <div className="space-y-5">
            <div className="rounded-xl p-4 sm:p-5" style={{ background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.20)' }}>
              <p className="text-[10px] uppercase tracking-[0.25em] font-semibold text-accent/80 mb-3">How Points Work</p>
              <p className="text-sm text-gray-200 leading-relaxed mb-1">
                Every daily game starts at <span className="text-accent font-bold">20 potential points</span>. Points are deducted as you guess and reveal hints. The final score is locked when the game ends.
              </p>
              <p className="text-[11px] text-gray-500 italic mb-3">
                Points only matter if you care about leaderboard rankings — feel free to play however you like!
              </p>
              <div className="space-y-2">
                <ScoreRow icon="❌" label="Incorrect guess" detail="−1 point per wrong guess" />
                <ScoreRow icon="💡" label="Actor hint revealed" detail="−1 point (Most Popular & Indian Cinema)" />
                <ScoreRow icon="💡" label="Logline hint revealed" detail="−3 points (Most Popular & Superhero/Animated); −2 points (Indian Cinema)" />
                <ScoreRow icon="💡" label="Frame hint revealed" detail="−4 points (Most Popular & Superhero/Animated); −3 points (Indian Cinema)" />
                <ScoreRow icon="🎵" label="Song hint revealed" detail="−4 points (Indian Cinema only)" />
                <ScoreRow icon="⭐" label="No-hint bonus" detail="+3 points if you revealed zero hints" />
              </div>
            </div>

            <div className="rounded-xl p-4 sm:p-5" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <p className="text-[10px] uppercase tracking-[0.25em] font-semibold text-gray-500 mb-3">Example Breakdown</p>
              <p className="text-[11px] text-gray-400 mb-2">Won in 3 guesses (2 wrong), no hints revealed:</p>
              <p className="text-sm font-mono text-gray-200">
                Base (20) − Misses (2) + Bonus (3) = <span className="text-accent font-bold">21pts</span>
              </p>
              <p className="text-[11px] text-gray-500 mt-3 mb-2">Won in 5 guesses (4 wrong), revealed Actor + Logline:</p>
              <p className="text-sm font-mono text-gray-200">
                Base (20) − Hints (4) − Misses (4) = <span className="text-accent font-bold">12pts</span>
              </p>
            </div>

            <div className="rounded-xl p-4 sm:p-5" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <p className="text-[10px] uppercase tracking-[0.25em] font-semibold text-gray-500 mb-2">Notes</p>
              <ul className="space-y-1.5">
                <li className="text-[11px] text-gray-400">• Score never goes below 0</li>
                <li className="text-[11px] text-gray-400">• Lost games always score 0 (excluded from avg)</li>
                <li className="text-[11px] text-gray-400">• Unlimited mode does not track scores</li>
                <li className="text-[11px] text-gray-400">• Hints unlock automatically but cost points only if you click to reveal</li>
              </ul>
            </div>
          </div>
        )}

        {/* ── Page 2: Rankings ── */}
        {page === 2 && (
          <div className="space-y-5">
            <div className="rounded-xl p-4 sm:p-5" style={{ background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.20)' }}>
              <p className="text-[10px] uppercase tracking-[0.25em] font-semibold mb-3" style={{ color: 'rgba(129,140,248,0.9)' }}>Global Rating Formula</p>
              <p className="text-sm text-gray-200 leading-relaxed mb-3">
                Your <span className="text-indigo-300 font-bold">Global Rating</span> determines your leaderboard position.
              </p>
              <div className="rounded-lg p-3 font-mono text-sm text-center text-gray-200" style={{ background: 'rgba(0,0,0,0.3)' }}>
                (Current Streak × 10) + Avg Score + No-Hint Bonus
              </div>
              <div className="mt-3 space-y-1.5">
                <ScoreRow icon="🔥" label="Streak bonus" detail="Current streak × 10 points" />
                <ScoreRow icon="⭐" label="Avg score" detail="Average score of all won daily games" />
                <ScoreRow icon="💡" label="No-hint bonus" detail="+5 per no-hint win within your current streak" />
              </div>
            </div>

            <div className="rounded-xl p-4 sm:p-5" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <p className="text-[10px] uppercase tracking-[0.25em] font-semibold text-gray-500 mb-3">Status Tiers</p>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <span className="text-xl flex-shrink-0">🌟</span>
                  <div>
                    <p className="text-sm font-bold text-yellow-300">A-List</p>
                    <p className="text-[11px] text-gray-400">Earn all 9 Cinema Awards.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-xl flex-shrink-0">🎬</span>
                  <div>
                    <p className="text-sm font-bold" style={{ background: 'linear-gradient(90deg, #c084fc, #F3CE13)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Certified Cinephile</p>
                    <p className="text-[11px] text-gray-400">Earn all 9 awards AND maintain an active streak in all 4 daily categories simultaneously.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-xl p-4 sm:p-5" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <p className="text-[10px] uppercase tracking-[0.25em] font-semibold text-gray-500 mb-2">Leaderboard</p>
              <p className="text-[11px] text-gray-400 leading-relaxed">
                The leaderboard shows the top 50 players sorted by Global Rating. Toggle between Global and per-category views. Access it via the trophy icon in the navigation bar.
              </p>
            </div>
          </div>
        )}

        {/* ── Page 3: Categories ── */}
        {page === 3 && (
          <div className="space-y-4">

            {/* ── Most Popular ── */}
            <div className="rounded-xl p-4 sm:p-5" style={{ background: 'rgba(243,206,19,0.04)', border: '1px solid rgba(243,206,19,0.20)' }}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-base">🎬</span>
                <p className="text-[10px] uppercase tracking-[0.25em] font-semibold text-accent/80">Most Popular</p>
              </div>
              <p className="text-[11px] text-gray-400 leading-relaxed mb-2">
                The widest-ranging category — blockbusters, cult classics, and award winners spanning all genres and eras. Any studio, any country.
              </p>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-gray-500">
                <span>🎯 7 guesses</span>
                <span>💡 Actor → Guess 4</span>
                <span>💡 Logline → Guess 5</span>
                <span>🖼️ Frame → Guess 6</span>
              </div>
            </div>

            {/* ── Superhero ── */}
            <div className="rounded-xl p-4 sm:p-5" style={{ background: 'rgba(220,20,60,0.04)', border: '1px solid rgba(220,20,60,0.18)' }}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-base">🦸</span>
                <p className="text-[10px] uppercase tracking-[0.25em] font-semibold" style={{ color: 'rgba(220,20,60,0.75)' }}>Superhero</p>
              </div>
              <p className="text-[11px] text-gray-400 leading-relaxed mb-2">
                Comic book adaptations, origin stories, and team-up films. Movies are grouped by studio/rights holder, not just brand.
              </p>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-gray-500 mb-3">
                <span>🎯 7 guesses</span>
                <span>💡 Logline → Guess 4</span>
                <span>🖼️ Frame → Guess 6</span>
                <span className="text-yellow-500/70">★ No actor hint</span>
              </div>
              <p className="text-[10px] text-gray-500 mb-2 leading-relaxed">
                <span className="text-yellow-400 font-semibold">Yellow franchise tile:</span> both films share a parent universe (Marvel or DC) but different sub-franchise. Green = exact same sub-franchise.
              </p>
              <div className="space-y-1.5 mt-3">
                {FRANCHISE_GROUPS.map(({ label, examples, color }) => (
                  <div key={label} className="flex items-start gap-2.5">
                    <span className="flex-shrink-0 mt-0.5 text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded whitespace-nowrap" style={{ background: `${color}22`, color, border: `1px solid ${color}40` }}>
                      {label}
                    </span>
                    <p className="text-[11px] text-gray-400 leading-snug">{examples}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Animated ── */}
            <div className="rounded-xl p-4 sm:p-5" style={{ background: 'rgba(168,85,247,0.04)', border: '1px solid rgba(168,85,247,0.20)' }}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-base">🎨</span>
                <p className="text-[10px] uppercase tracking-[0.25em] font-semibold" style={{ color: 'rgba(192,132,252,0.85)' }}>Animated</p>
              </div>
              <p className="text-[11px] text-gray-400 leading-relaxed mb-2">
                Animated feature films from all major studios — CGI, traditional hand-drawn, stop-motion, and anime. Studio tile shows yellow when both films share the same parent company.
              </p>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-gray-500 mb-3">
                <span>🎯 7 guesses</span>
                <span>💡 Logline → Guess 4</span>
                <span>🖼️ Frame → Guess 6</span>
                <span className="text-yellow-500/70">★ No actor hint</span>
              </div>
              <p className="text-[10px] uppercase tracking-[0.20em] font-semibold text-purple-400/60 mb-2">Studios in the Pool</p>
              <div className="space-y-1.5">
                {ANIMATED_STUDIOS.map(({ label, examples, color }) => (
                  <div key={label} className="flex items-start gap-2.5">
                    <span className="flex-shrink-0 mt-0.5 text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded whitespace-nowrap" style={{ background: `${color}22`, color, border: `1px solid ${color}40` }}>
                      {label}
                    </span>
                    <p className="text-[11px] text-gray-400 leading-snug">{examples}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Indian Cinema ── */}
            <div className="rounded-xl p-4 sm:p-5" style={{ background: 'rgba(249,115,22,0.04)', border: '1px solid rgba(249,115,22,0.20)' }}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-base">🎵</span>
                <p className="text-[10px] uppercase tracking-[0.25em] font-semibold" style={{ color: 'rgba(251,146,60,0.85)' }}>Indian Cinema</p>
              </div>
              <p className="text-[11px] text-gray-400 leading-relaxed mb-2">
                Bollywood and regional Indian films — Hindi, Tamil, Telugu, Malayalam, and beyond. Covers iconic classics, modern blockbusters, and critically acclaimed drama.
              </p>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-gray-500 mb-2">
                <span>🎯 8 guesses (not 7)</span>
                <span>💡 Actor → Guess 4</span>
                <span>💡 Logline → Guess 5</span>
                <span>🖼️ Frame → Guess 6</span>
                <span>🎵 Song → Guess 7</span>
              </div>
              <p className="text-[11px] text-gray-500 leading-relaxed">
                The <span className="text-orange-400/80 font-semibold">Musical Hint</span> (exclusive to this category) reveals the title and playback singers of an iconic song from the film. Indian Cinema also gets one extra guess to match the epic scale of its storytelling.
              </p>
            </div>

          </div>
        )}

        {/* ── Page 4: Credits & Legal ── */}
        {page === 4 && (
          <div className="space-y-5">

            {/* Data Sources */}
            <div className="rounded-xl p-4 sm:p-5" style={{ background: 'rgba(243,206,19,0.04)', border: '1px solid rgba(243,206,19,0.18)' }}>
              <p className="text-[10px] uppercase tracking-[0.25em] font-semibold text-accent/80 mb-3">Data Sources</p>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <span className="text-base flex-shrink-0">🎬</span>
                  <div>
                    <p className="text-xs font-semibold text-white">The Movie Database (TMDB)</p>
                    <p className="text-[11px] text-gray-400 leading-relaxed mt-0.5">
                      Movie metadata, posters, cast, crew, backdrops, trailers, and collection data are sourced via the TMDB API.
                      This product uses the TMDB API but is not endorsed or certified by TMDB.
                    </p>
                    <a href="https://www.themoviedb.org" target="_blank" rel="noopener noreferrer"
                      className="text-[11px] text-accent/70 hover:text-accent mt-1 inline-block transition-colors">
                      themoviedb.org →
                    </a>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-base flex-shrink-0">🏆</span>
                  <div>
                    <p className="text-xs font-semibold text-white">Wikidata</p>
                    <p className="text-[11px] text-gray-400 leading-relaxed mt-0.5">
                      Oscar nomination and win data is sourced from Wikidata, the free knowledge base maintained by the Wikimedia Foundation, licensed under CC0.
                    </p>
                    <a href="https://www.wikidata.org" target="_blank" rel="noopener noreferrer"
                      className="text-[11px] text-accent/70 hover:text-accent mt-1 inline-block transition-colors">
                      wikidata.org →
                    </a>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-base flex-shrink-0">🎞️</span>
                  <div>
                    <p className="text-xs font-semibold text-white">OMDb API</p>
                    <p className="text-[11px] text-gray-400 leading-relaxed mt-0.5">
                      Supplemental awards and ratings data sourced from the Open Movie Database (OMDb), which aggregates data from IMDb.
                    </p>
                    <a href="https://www.omdbapi.com" target="_blank" rel="noopener noreferrer"
                      className="text-[11px] text-accent/70 hover:text-accent mt-1 inline-block transition-colors">
                      omdbapi.com →
                    </a>
                  </div>
                </div>
              </div>
            </div>

            {/* Copyright */}
            <div className="rounded-xl p-4 sm:p-5" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <p className="text-[10px] uppercase tracking-[0.25em] font-semibold text-gray-500 mb-3">Copyright</p>
              <p className="text-xs font-semibold text-white mb-2">© {new Date().getFullYear()} CineGuess. All rights reserved.</p>
              <p className="text-[11px] text-gray-400 leading-relaxed">
                The CineGuess name, logo, game concept, scoring system, visual design, user interface, and all
                original written content are the exclusive intellectual property of CineGuess and its creators.
                Unauthorized reproduction, copying, modification, or distribution of any part of this product
                — in whole or in part — is strictly prohibited without prior written permission.
              </p>
            </div>

            {/* IP Protection */}
            <div className="rounded-xl p-4 sm:p-5" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <p className="text-[10px] uppercase tracking-[0.25em] font-semibold text-gray-500 mb-3">Intellectual Property</p>
              <ul className="space-y-2">
                {[
                  'The gameplay mechanics, hint system, scoring formula, and ranking algorithm are original works protected under applicable copyright and trade secret law.',
                  'The source code, architecture, and design of CineGuess are proprietary. Cloning, reverse-engineering, or repurposing any part of this codebase is prohibited.',
                  'All custom UI components, animations, and visual design elements are original works of CineGuess.',
                  'Movie posters, backdrops, and cast images are the property of their respective studios and rights holders, used via TMDB\'s API under their terms of service.',
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <span className="text-accent/50 flex-shrink-0 mt-0.5 text-xs font-bold">•</span>
                    <p className="text-[11px] text-gray-400 leading-relaxed">{item}</p>
                  </li>
                ))}
              </ul>
            </div>

            {/* Third-party notices */}
            <div className="rounded-xl p-4 sm:p-5" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <p className="text-[10px] uppercase tracking-[0.25em] font-semibold text-gray-500 mb-3">Third-Party Notices</p>
              <p className="text-[11px] text-gray-400 leading-relaxed">
                CineGuess is an independent fan project. All movie titles, characters, and related marks are
                trademarks of their respective studios and rights holders. CineGuess is not affiliated with,
                endorsed by, or sponsored by any film studio, streaming service, or media company.
                IMDb™ is a trademark of IMDb.com, Inc. Oscar® is a registered trademark of the Academy of
                Motion Picture Arts and Sciences.
              </p>
            </div>

          </div>
        )}

        {/* ── Report an Issue — always visible on every tab ── */}
        <div className="mt-6 pt-4 flex items-center justify-between gap-3" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          <p className="text-[11px] text-gray-600 tracking-wide">
            7 guesses · 4 categories · Daily &amp; Unlimited
          </p>
          <button
            onClick={() => setReportOpen(true)}
            className="flex items-center gap-1.5 flex-shrink-0 text-[11px] font-semibold text-orange-400/70 hover:text-orange-400 transition-colors"
          >
            <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            Report an Issue
          </button>
        </div>
      </div>

      <ReportIssueModal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
      />
    </div>
  );
}

// ── Rules content ──────────────────────────────────────────────────────────
const RULES = [
  'Guess the target movie in 7 tries or fewer. Each guess must be a real film from the chosen category.',
  'After every guess, 6 tiles light up showing how close you are: Genre, Director, Lead Actor/Actress, Supporting Actor/Actress, Year, and Studio. Superhero and Animated categories use different fields tailored to those films.',
  'Green = exact match. Cyan = year within 2. Amber = year within 5. Yellow = partial match (shared genre, actor in a different role, same parent studio, or in Superhero: same parent universe but different sub-franchise). Red = no match.',
  'In Daily mode, everyone plays the same movie each day. Your streak only resets if you get a movie wrong. Skipping a day keeps your streak alive.',
  'Unlimited mode lets you play as many rounds as you want with a random target each round. Separate streaks are tracked per category.',
  'Indian Cinema gets 8 guesses (instead of 7) to match the epic scale of its films.',
  'Progressive hints unlock as you guess. Most Popular: Cast Member (guess 4) → Logline (guess 5) → Frame (guess 6). Indian Cinema: Cast Member (guess 4) → Logline (guess 5) → Frame (guess 6) → Musical Hint (guess 7). Superhero & Animated: Logline (guess 5) → Frame (guess 6). The Logline explains the plot badly, technically accurate but intentionally misleading!',
  'Share your result grid with friends. Friends cannot see your current-day answers until they finish that category themselves.',
];

// ── Tile column descriptions ───────────────────────────────────────────────
const TILE_COLUMNS = [
  { icon: '🎭', label: 'Genre',                   detail: 'Top 2 genres. Green = both match, Yellow = one matches.' },
  { icon: '🎬', label: 'Director',                detail: 'Same director as the target = green. Otherwise red.' },
  { icon: '⭐', label: 'Lead Actor/Actress',       detail: 'Green = exact lead match. Yellow = your lead appears in the target cast (different role).' },
  { icon: '🌟', label: 'Supporting Actor/Actress', detail: 'Second-billed cast member. Green = exact match. Yellow = appears anywhere in target film.' },
  { icon: '📅', label: 'Year',                    detail: 'Green = exact. Cyan = ≤2 yrs off. Amber = ≤5 yrs off. Red = 5+ yrs. Arrow shows which direction.' },
  { icon: '🎥', label: 'Studio',                  detail: 'Primary production studio. Green = same studio. Yellow = same parent company (e.g. Warner Bros. & New Line Cinema both belong to WB). Red = different.' },
];

// ── Progressive hints ──────────────────────────────────────────────────────
const HINTS = [
  {
    icon: '🎭',
    trigger: 'Guess 4 (Most Popular & Indian Cinema)',
    label: 'A Cast Member',
    detail: 'A photo and name of the 3rd or 4th-credited cast member — not the lead or supporting actor already visible on the board.',
  },
  {
    icon: '💡',
    trigger: 'Guess 4 (Superhero/Animated) · Guess 5 (Most Popular & Indian Cinema)',
    label: 'The Logline',
    detail: 'A one-sentence explanation of the plot, badly. Technically accurate but intentionally misleading. Think outside the box!',
  },
  {
    icon: '🖼️',
    trigger: 'Guess 6',
    label: 'A Frame From The Movie',
    detail: 'A still image from the film, deterministically chosen so everyone gets the same frame for the same movie.',
  },
  {
    icon: '🎵',
    trigger: 'Guess 7 (Indian Cinema only)',
    label: 'Musical Hint',
    detail: 'Indian Cinema only: an iconic song title and playback singers from the film. Indian Cinema also gets 8 total guesses.',
  },
];

// ── Franchise groupings for Superhero category ────────────────────────────────
const FRANCHISE_GROUPS = [
  {
    label:    'MCU',
    color:    '#ef4444',
    examples: 'All Disney/Marvel Studios films: Iron Man, Avengers, Spider-Man (Holland), Black Panther, etc.',
  },
  {
    label:    'Fox Universe',
    color:    '#F3CE13',
    examples: 'Fox-era Marvel films: X-Men series, Deadpool (1 & 2), Fantastic Four (2005, 2015), Logan, and related spin-offs.',
  },
  {
    label:    'DC / WB',
    color:    '#60a5fa',
    examples: 'Warner Bros. DC films: Batman (Nolan/Keaton), Superman, Wonder Woman, Justice League, Aquaman, The Flash, etc.',
  },
  {
    label:    'Sony Spider-Verse',
    color:    '#a855f7',
    examples: 'Sony\'s Spider-Man universe: Venom, Morbius, Madame Web, and animated Spider-Verse films.',
  },
  {
    label:    'Other',
    color:    '#6b7280',
    examples: 'Independent superhero films, older adaptations (Blade, Punisher, Hellboy), and international titles.',
  },
];

// ── Animated studio groupings ─────────────────────────────────────────────
const ANIMATED_STUDIOS = [
  {
    label:    'Disney',
    color:    '#60a5fa',
    examples: 'Classics (Snow White → Tarzan) + modern Disney Animation: Tangled, Frozen, Wreck-It Ralph, Big Hero 6, Zootopia, Moana, Encanto, Wish, and sequels.',
  },
  {
    label:    'Pixar',
    color:    '#34d399',
    examples: 'Toy Story, A Bug\'s Life, Monsters Inc., Finding Nemo, The Incredibles, WALL-E, Up, Brave, Inside Out, Coco, Soul, and all sequels.',
  },
  {
    label:    'DreamWorks',
    color:    '#fbbf24',
    examples: 'Shrek, Kung Fu Panda, How to Train Your Dragon, Madagascar, Megamind, Puss in Boots, The Bad Guys, The Wild Robot, Dog Man, and more.',
  },
  {
    label:    'Illumination',
    color:    '#fb923c',
    examples: 'Despicable Me, Minions, Sing, The Lorax, The Grinch, The Secret Life of Pets, The Super Mario Bros. Movie.',
  },
  {
    label:    'Studio Ghibli',
    color:    '#4ade80',
    examples: 'Spirited Away, Princess Mononoke, My Neighbor Totoro, Howl\'s Moving Castle, Grave of the Fireflies, Ponyo, The Boy and the Heron.',
  },
  {
    label:    'Sony',
    color:    '#e879f9',
    examples: 'Spider-Man: Into & Across the Spider-Verse, Hotel Transylvania series, Cloudy with a Chance of Meatballs, The Mitchells vs. the Machines.',
  },
  {
    label:    'Blue Sky',
    color:    '#67e8f9',
    examples: 'Ice Age series, Rio, Rio 2, The Peanuts Movie, Robots, Horton Hears a Who!, Over the Hedge.',
  },
  {
    label:    'Warner Bros.',
    color:    '#f87171',
    examples: 'The Lego Movie series (Lego Batman, Ninjago), Batman: Mask of the Phantasm, Batman Beyond: Return of the Joker, The Iron Giant, Corpse Bride, Happy Feet, Scoob!, Smallfoot, Storks, Teen Titans Go! To the Movies, Scooby-Doo on Zombie Island.',
  },
];

// ── Score breakdown row ────────────────────────────────────────────────────
function ScoreRow({ icon, label, detail }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="text-base flex-shrink-0 w-5 text-center">{icon}</span>
      <div className="min-w-0">
        <span className="text-xs font-semibold text-white">{label}</span>
        <span className="text-[11px] text-gray-400 ml-1.5">{detail}</span>
      </div>
    </div>
  );
}

// ── Legend row: uses actual tile classes so colors match in-game ───────────
function LegendRow({ color, label, desc }) {
  const tileClass = {
    green:  'tile-green',
    cyan:   'tile-cyan',
    amber:  'tile-amber',
    yellow: 'tile-yellow',
    red:    'tile-red',
  }[color];

  return (
    <div className="flex items-center gap-3.5 sm:gap-4">
      <div
        className={`tile ${tileClass} flex-shrink-0 flex items-center justify-center
                    font-bold text-[10px]`}
        style={{ width: '52px', height: '40px' }}
      >
        {label.split(' ')[0].toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white leading-tight">{label}</p>
        <p className="text-[11px] sm:text-xs text-gray-400 leading-snug mt-0.5">{desc}</p>
      </div>
    </div>
  );
}
