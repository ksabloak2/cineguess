import { useEffect, useState } from 'react';
import ReportIssueModal from './ReportIssueModal';

const PAGES = ['How to Play', 'Scoring', 'Rankings'];

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
              className="flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold transition-all"
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

            {/* Franchise groupings — Superhero category */}
            <div className="rounded-xl p-4 sm:p-5 mt-5" style={{ background: 'rgba(220,20,60,0.04)', border: '1px solid rgba(220,20,60,0.18)' }}>
              <p className="text-[10px] uppercase tracking-[0.25em] font-semibold mb-3" style={{ color: 'rgba(220,20,60,0.7)' }}>
                🦸 Superhero: Franchise Guide
              </p>
              <p className="text-[11px] text-gray-400 mb-3 leading-relaxed">
                Movies are grouped by studio/rights holder, not just brand name, so some franchises may surprise you.
              </p>
              <p className="text-[11px] text-gray-400 mb-3 leading-relaxed">
                <span className="text-yellow-400 font-semibold">Yellow tile tip:</span> if your guess and the target share a parent universe (both Marvel, or both DC) but belong to different sub-franchises (e.g. MCU vs Fox Universe, or DCEU vs Nolan Batman), the franchise tile shows yellow. Green only lights up when both films are in the exact same sub-franchise.
              </p>
              <div className="space-y-2">
                {FRANCHISE_GROUPS.map(({ label, examples, color }) => (
                  <div key={label} className="flex items-start gap-2.5">
                    <span className="flex-shrink-0 mt-0.5 text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded" style={{ background: `${color}22`, color, border: `1px solid ${color}40` }}>
                      {label}
                    </span>
                    <p className="text-[11px] text-gray-400 leading-snug">{examples}</p>
                  </div>
                ))}
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

            {/* Report an Issue */}
            <div className="mt-5 flex items-center justify-between gap-3">
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
