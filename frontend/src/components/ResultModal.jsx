import { useEffect, useState } from 'react';
import { tmdbImage } from '../utils/api';
import { buildShareString, getMaxGuesses, getTileFields } from '../utils/gameLogic';
import { useAuth } from '../context/AuthContext';

// Type-specific hint costs — matches backend HINT_TYPE_COSTS
const HINT_TYPE_COSTS_FE = {
  top250:       { actor: 1, clue: 3, image: 4 },
  superhero:    { clue: 3, image: 4 },
  animated:     { clue: 3, image: 4 },
  indiancinema: { actor: 1, clue: 2, image: 3, music: 4 },
};

// Emoji map kept for clipboard/share text
const EMOJI_MAP = {
  green:           '🟩',
  cyan:            '🟦',
  amber:           '🟧',
  yellow:          '🟨',
  // legacy keys from old server responses
  'orange-yellow': '🟧',
  'light-yellow':  '🟨',
  red:             '🟥',
  empty:           '⬛',
};

// CSS colors for pill dashes
const DASH_COLOR = {
  green:           '#22c55e',
  cyan:            '#00E5FF',
  amber:           '#FFBF00',
  yellow:          '#eab308',
  // legacy keys from old server responses
  'orange-yellow': '#f59e0b',
  'light-yellow':  '#eab308',
  red:             '#ef4444',
  empty:           '#252538',
};

// Glass card style shared across panels
// Note: no backdropFilter — the card is 95% opaque so blur adds nothing visible
// but costs a full compositing layer on every frame. Use solid background instead.
const glassStyle = {
  background:  'rgba(12, 12, 22, 0.97)',
  border:      '1px solid rgba(255, 255, 255, 0.07)',
  boxShadow:   '0 24px 64px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.05)',
};

export default function ResultModal({
  result, category, guessResults, won,
  onClose, isUnlimited = false, onNewRound,
  hintsRevealedCount = 0,
  hintsRevealed = [],        // array of revealed hint objects { type, ... }
}) {
  const [shareOpen, setShareOpen]         = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const { profile } = useAuth();

  useEffect(() => {
    function handler(e) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  if (!result) return null;

  const score = won ? `${guessResults.length}/${getMaxGuesses(category)}` : `X/${getMaxGuesses(category)}`;

  // Type-specific hint cost — cast member always 1pt, logline 3pt, etc.
  const typeCosts  = HINT_TYPE_COSTS_FE[category] || {};
  const hintCost   = hintsRevealed.length > 0
    ? hintsRevealed.reduce((sum, h) => sum + (typeCosts[h.type] || 0), 0)
    : (HINT_TYPE_COSTS_FE[category]
        ? Object.values(typeCosts).slice(0, hintsRevealedCount).reduce((s, c) => s + c, 0)
        : 0);
  const misses     = won ? Math.max(0, guessResults.length - 1) : guessResults.length;
  const bonus      = hintsRevealedCount === 0 ? 3 : 0;
  const finalScore = Math.max(0, 20 - hintCost - misses + bonus);

  const shareText = buildShareString(category, guessResults.map((g) => g.tiles), won, profile?.username, hintsRevealedCount, finalScore);
  const fields    = getTileFields(category);

  // Always include the year in the slug to avoid title conflicts (e.g. Smile 2022 vs 1975).
  // Letterboxd's canonical URL format for disambiguation is /film/title-year/.
  const _lbSlug = result.title?.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim().replace(/\s+/g, '-') || '';
  const letterboxdUrl = `https://letterboxd.com/film/${_lbSlug}${result.year ? `-${result.year}` : ''}/`;
  const imdbUrl = result.imdb_id ? `https://www.imdb.com/title/${result.imdb_id}/` : null;

  const accentColor = won ? '#22c55e' : '#ef4444';
  const accentGlow  = won
    ? '0 0 60px rgba(34,197,94,0.12)'
    : '0 0 60px rgba(239,68,68,0.10)';

  return (
    <>
    <style>{`
      @keyframes result-section-in {
        from { opacity: 0; transform: translateY(14px); }
        to   { opacity: 1; transform: translateY(0); }
      }
    `}</style>
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center
                 p-0 sm:p-4 bg-black/70 animate-fade-in"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="relative w-full sm:max-w-sm animate-curtain-rise sm:animate-bounce-in
                   rounded-t-3xl sm:rounded-2xl max-h-[92dvh] overflow-y-auto"
        style={{ ...glassStyle, boxShadow: `${glassStyle.boxShadow}, ${accentGlow}`, willChange: 'transform' }}
      >
        {/* ── Top accent line ─────────────────────────────── */}
        <div
          className="h-[2px] w-full rounded-t-3xl sm:rounded-t-2xl"
          style={{ background: `linear-gradient(90deg, transparent, ${accentColor}60, transparent)` }}
        />

        <div className="p-5 sm:p-6 space-y-5">

          {/* ── Close button ──────────────────────────────── */}
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center
                       text-gray-600 hover:text-white transition-all"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* ── Win / Loss header ─────────────────────────── */}
          <div className="text-center pt-1" style={{ animation: 'result-section-in 0.38s ease both', animationDelay: '0.12s' }}>
            <div
              className="w-14 h-14 sm:w-16 sm:h-16 rounded-full mx-auto mb-3 flex items-center justify-center text-3xl"
              style={{
                background: won ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.10)',
                border: `1px solid ${accentColor}30`,
                boxShadow: `0 0 24px ${accentColor}25`,
              }}
            >
              {won ? '🎉' : '😞'}
            </div>
            <div className="flex items-center justify-center gap-2">
              <h2
                className="font-display text-xl sm:text-2xl font-bold"
                style={{ color: accentColor }}
              >
                {won ? 'You got it!' : 'Better luck next time'}
              </h2>
              {/* Score breakdown toggle — won games in any mode */}
              {won && (
                <button
                  onClick={() => setShowBreakdown((o) => !o)}
                  title="Score breakdown"
                  className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold
                             text-gray-500 hover:text-white transition-colors"
                  style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}
                >
                  ℹ
                </button>
              )}
            </div>
            <p className="text-gray-600 text-xs mt-1 font-mono tracking-widest uppercase">
              {score} guesses
            </p>

            {/* Point breakdown — collapsible, both modes */}
            {won && showBreakdown && (
              <div
                className="mt-2 mx-auto max-w-xs rounded-xl px-3 py-2 text-xs text-center animate-fade-in"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
              >
                <p className="text-gray-400 leading-relaxed">
                  <span className="text-gray-300 font-semibold">Base (20)</span>
                  {hintCost > 0 && <span className="text-red-400"> − Hints ({hintCost})</span>}
                  {misses > 0   && <span className="text-red-400"> − Misses ({misses})</span>}
                  {bonus > 0    && <span className="text-green-400"> + Bonus ({bonus})</span>}
                  <span className="text-accent font-bold"> = {finalScore}pts</span>
                </p>
              </div>
            )}
          </div>

          {/* ── Movie card ────────────────────────────────── */}
          <div
            className="flex gap-3 items-stretch rounded-2xl p-3"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', animation: 'result-section-in 0.38s ease both', animationDelay: '0.22s' }}
          >
            {/* Poster */}
            {result.poster_path && (
              <div
                className="w-20 sm:w-24 rounded-xl flex-shrink-0 overflow-hidden self-stretch"
                style={{
                  boxShadow: '0 8px 28px rgba(0,0,0,0.55), 0 2px 8px rgba(0,0,0,0.4)',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}
              >
                <img
                  src={tmdbImage(result.poster_path, 'w342')}
                  alt={result.title}
                  className="block w-full h-full object-cover"
                />
              </div>
            )}

            {/* Right column — title/year + stacked rating buttons */}
            <div className="min-w-0 flex flex-col flex-1 gap-2 py-0.5">
              {/* Title + year */}
              <div>
                <h3 className="font-bold text-white text-sm sm:text-base leading-snug">
                  {result.title}
                </h3>
                <p className="text-gray-500 text-xs mt-0.5">{result.year}</p>
              </div>

              {/* Stacked IMDb / Letterboxd buttons — fill remaining height */}
              <div className="flex flex-col gap-1.5 flex-1">
                {/* IMDb */}
                {imdbUrl && (
                  <RatingLink
                    href={imdbUrl}
                    label="IMDb"
                    icon="⭐"
                    bg="rgba(245,197,24,0.07)"
                    border="rgba(245,197,24,0.22)"
                    hoverBg="rgba(245,197,24,0.13)"
                  />
                )}

                {/* Letterboxd */}
                <RatingLink
                  href={letterboxdUrl}
                  label="Letterboxd"
                  icon="🟢"
                  bg="rgba(0,192,48,0.07)"
                  border="rgba(0,192,48,0.20)"
                  hoverBg="rgba(0,192,48,0.13)"
                />
              </div>
            </div>
          </div>

          {/* ── Pill dash grid ────────────────────────────── */}
          <div
            className="rounded-2xl p-3 space-y-2"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', animation: 'result-section-in 0.38s ease both', animationDelay: '0.32s' }}
          >
            <p className="text-[9px] text-gray-700 uppercase tracking-widest text-center font-semibold mb-2.5">
              Your guesses
            </p>
            {guessResults.map((g, i) => {
              const tiles = g.tiles || {};
              return (
                <div key={i} className="flex gap-1.5">
                  {fields.map((f) => (
                    <div
                      key={f}
                      className="flex-1 h-2 rounded-full"
                      style={{
                        backgroundColor: DASH_COLOR[tiles[f]] || DASH_COLOR.empty,
                        boxShadow: tiles[f] && tiles[f] !== 'empty'
                          ? `0 0 6px ${DASH_COLOR[tiles[f]]}70`
                          : 'none',
                      }}
                    />
                  ))}
                </div>
              );
            })}
          </div>

          {/* ── Action button ─────────────────────────────── */}
          <div style={{ animation: 'result-section-in 0.38s ease both', animationDelay: '0.42s' }}>
          {isUnlimited ? (
            <div className="space-y-2">
              <button
                onClick={() => { onClose(); onNewRound?.(); }}
                className="w-full py-3 rounded-xl font-bold text-sm tracking-wide
                           flex items-center justify-center gap-2 transition-all duration-300
                           bg-purple-500/15 text-purple-300 hover:text-white
                           border border-purple-500/25 hover:border-purple-400/40
                           hover:bg-purple-500/25"
                style={{ boxShadow: '0 0 0 rgba(168,85,247,0)' }}
                onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 0 24px rgba(168,85,247,0.25)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.boxShadow = '0 0 0 rgba(168,85,247,0)'; }}
              >
                <span className="text-base leading-none">↻</span>
                Play again
              </button>
              <button
                onClick={() => setShareOpen((o) => !o)}
                className="w-full py-2.5 rounded-xl font-semibold text-sm tracking-wide
                           flex items-center justify-center gap-2 transition-all duration-300
                           text-gray-400 hover:text-white"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                    d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
                Share result
              </button>
              {shareOpen && <SharePanel shareText={shareText} />}
            </div>
          ) : (
            <div className="space-y-2">
              <button
                onClick={() => setShareOpen((o) => !o)}
                className="w-full py-3 rounded-xl font-bold text-sm tracking-wide
                           flex items-center justify-center gap-2 transition-all duration-300
                           text-black"
                style={{
                  background: 'linear-gradient(135deg, #f59e0b, #fbbf24)',
                  boxShadow: '0 4px 16px rgba(245,158,11,0.25)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = '0 4px 28px rgba(245,158,11,0.55)';
                  e.currentTarget.style.transform  = 'translateY(-1px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = '0 4px 16px rgba(245,158,11,0.25)';
                  e.currentTarget.style.transform  = 'translateY(0)';
                }}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                    d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
                Share result
              </button>

              {shareOpen && <SharePanel shareText={shareText} />}
            </div>
          )}
          </div>

          {/* ── Timecode countdown ────────────────────────── */}
          {!isUnlimited && <Countdown />}
        </div>
      </div>
    </div>
    </>
  );
}

// ── Rating link button ────────────────────────────────────────────────────────
function RatingLink({ href, label, icon, bg, border, hoverBg }) {
  const [hovered, setHovered] = useState(false);
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        flex:           '1 1 0',
        minHeight:      '36px',
        gap:            '6px',
        padding:        '6px 10px',
        borderRadius:   '10px',
        background:     hovered ? hoverBg : bg,
        border:         `1px solid ${border}`,
        textDecoration: 'none',
        transition:     'background 0.15s',
      }}
    >
      <span style={{ fontSize: '0.8rem', lineHeight: 1 }}>{icon}</span>
      <span style={{
        fontSize:      '0.7rem',
        fontWeight:    600,
        color:         'rgba(255,255,255,0.75)',
        letterSpacing: '0.02em',
      }}>
        {label}
      </span>
    </a>
  );
}

// ── Share panel ──────────────────────────────────────────────────────────────
function SharePanel({ shareText }) {
  const [copied, setCopied] = useState(false);
  const [hint, setHint]     = useState('');

  const hasNativeShare = typeof navigator !== 'undefined' && !!navigator.share;

  async function copyText() {
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  }

  async function nativeShare() {
    try { await navigator.share({ text: shareText, title: 'CineGuess' }); }
    catch { /* user cancelled */ }
  }

  function shareTwitter() {
    window.open(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`,
      '_blank', 'noopener,noreferrer'
    );
  }

  async function shareWithCopy(appName, appUrl) {
    await copyText();
    setHint(`Copied! Open ${appName} and paste`);
    setTimeout(() => setHint(''), 3000);
    if (appUrl) setTimeout(() => window.open(appUrl, '_blank', 'noopener,noreferrer'), 300);
  }

  function shareSMS() {
    window.location.href = `sms:?&body=${encodeURIComponent(shareText)}`;
  }

  return (
    <div
      className="rounded-2xl p-4 space-y-3 animate-fade-in"
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
    >
      {hint && (
        <p className="text-center text-xs text-accent font-medium animate-fade-in">{hint}</p>
      )}

      {hasNativeShare && (
        <button
          onClick={nativeShare}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl
                     text-accent text-sm font-semibold transition-all"
          style={{
            background: 'rgba(245,158,11,0.10)',
            border: '1px solid rgba(245,158,11,0.22)',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(245,158,11,0.18)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(245,158,11,0.10)'; }}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          Share via…
        </button>
      )}

      <div className="grid grid-cols-2 gap-2">
        <PlatformButton onClick={shareTwitter}
          bg="rgba(255,255,255,0.04)" border="rgba(255,255,255,0.10)"
          hoverBg="rgba(255,255,255,0.09)" label="Twitter / X"
          icon={<svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.747l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
          </svg>}
        />
        <PlatformButton onClick={shareSMS}
          bg="rgba(34,197,94,0.08)" border="rgba(34,197,94,0.20)"
          hoverBg="rgba(34,197,94,0.15)" label="Messages" textColor="#86efac"
          icon={<svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/>
          </svg>}
        />
        <PlatformButton onClick={() => shareWithCopy('Discord', 'https://discord.com/channels/@me')}
          bg="rgba(88,101,242,0.08)" border="rgba(88,101,242,0.25)"
          hoverBg="rgba(88,101,242,0.18)" label="Discord" textColor="#a5b4fc"
          icon={<svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
          </svg>}
        />
        <PlatformButton onClick={() => shareWithCopy('Instagram', 'https://www.instagram.com')}
          bg="rgba(236,72,153,0.08)" border="rgba(236,72,153,0.20)"
          hoverBg="rgba(236,72,153,0.15)" label="Instagram" textColor="#f9a8d4"
          icon={<svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
          </svg>}
        />
        <PlatformButton onClick={() => shareWithCopy('Snapchat', 'https://www.snapchat.com')}
          bg="rgba(250,204,21,0.08)" border="rgba(250,204,21,0.20)"
          hoverBg="rgba(250,204,21,0.15)" label="Snapchat" textColor="#fde68a"
          icon={<svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12.166.006c.93-.017 3.98.252 5.45 3.44.498 1.1.378 2.953.3 4.303l-.013.247c-.001.014.01.033.033.049.158.1.696.287 1.664-.024.127-.04.255-.06.379-.06.284 0 .543.09.727.253.252.22.375.533.354.88-.035.586-.52 1.01-1.265 1.197-.053.013-.11.025-.17.037-.42.086-1.054.217-1.33.73-.152.285-.137.64.044 1.052.009.02.882 2.017 2.9 2.38.185.034.317.199.303.386a.362.362 0 01-.066.194c-.439.62-1.576.936-3.38 1.144a.15.15 0 00-.125.096c-.048.122-.084.26-.123.414-.095.381-.214.854-.538 1.139-.16.14-.37.21-.603.21-.158 0-.34-.03-.54-.09a7.624 7.624 0 00-2.208-.381c-.17 0-.34.01-.505.031a6.26 6.26 0 00-1.628.498c-.474.217-.87.396-1.313.396-.069 0-.14-.005-.21-.016-.434-.064-.69-.38-.812-.659-.173-.4-.29-.871-.38-1.254-.039-.16-.075-.302-.12-.42a.157.157 0 00-.131-.101c-1.806-.21-2.94-.526-3.38-1.144a.36.36 0 01-.066-.195.383.383 0 01.303-.386c2.017-.363 2.891-2.359 2.9-2.38.18-.411.194-.765.044-1.05-.274-.515-.906-.646-1.33-.732l-.168-.037c-.748-.187-1.232-.61-1.266-1.197-.021-.347.102-.66.354-.88a1.09 1.09 0 01.727-.253c.124 0 .252.02.375.059.908.29 1.455.133 1.657.027.03-.015.047-.038.043-.058l-.012-.222c-.079-1.35-.2-3.204.296-4.31C8.088.26 11.042-.014 12 .006h.166z"/>
          </svg>}
        />
        <button
          onClick={copyText}
          onMouseEnter={(e) => {
            if (!copied) e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = copied ? 'rgba(34,197,94,0.10)' : 'rgba(255,255,255,0.04)';
          }}
          className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl
                     text-xs sm:text-sm font-medium transition-all"
          style={{
            background: copied ? 'rgba(34,197,94,0.10)' : 'rgba(255,255,255,0.04)',
            border: copied ? '1px solid rgba(34,197,94,0.30)' : '1px solid rgba(255,255,255,0.12)',
            color: copied ? '#86efac' : 'rgba(255,255,255,0.75)',
          }}
        >
          {copied ? (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
              <span>Copied!</span>
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// ── Platform button ──────────────────────────────────────────────────────────
function PlatformButton({ onClick, bg, border, hoverBg, label, icon, textColor = 'rgba(255,255,255,0.75)' }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl
                 text-xs sm:text-sm font-medium transition-all"
      style={{
        background: hovered ? hoverBg : bg,
        border: `1px solid ${border}`,
        color: textColor,
      }}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

// ── Camera timecode countdown ────────────────────────────────────────────────
// Computes ms until the next midnight in America/New_York (ET), regardless of
// the user's local timezone or whether DST is currently active.
function msUntilETMidnight() {
  const now = new Date();
  const etParts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric', minute: 'numeric', second: 'numeric',
    hour12: false,
  }).formatToParts(now);
  const etH = +etParts.find((p) => p.type === 'hour').value;
  const etM = +etParts.find((p) => p.type === 'minute').value;
  const etS = +etParts.find((p) => p.type === 'second').value;
  // ms elapsed since ET midnight today
  const elapsed = (etH * 3_600 + etM * 60 + etS) * 1_000;
  return Math.max(0, 86_400_000 - elapsed);
}

function Countdown() {
  const [, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const diff = msUntilETMidnight();

  const h = String(Math.floor(diff / 3_600_000)).padStart(2, '0');
  const m = String(Math.floor((diff % 3_600_000) / 60_000)).padStart(2, '0');
  const s = String(Math.floor((diff % 60_000) / 1_000)).padStart(2, '0');

  return (
    <div className="flex flex-col items-center gap-1.5 pt-1">
      <p className="text-[9px] text-gray-700 uppercase tracking-[0.2em] font-semibold">
        Next film in
      </p>
      <div
        className="flex items-center gap-0 font-mono text-sm tracking-widest rounded-lg px-3 py-1.5"
        style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          color: 'rgba(255,255,255,0.55)',
          letterSpacing: '0.12em',
        }}
      >
        <span className="text-[10px] text-gray-600 mr-2 font-sans tracking-normal uppercase">TC</span>
        <span>{h}</span>
        <span className="opacity-40 mx-0.5">:</span>
        <span>{m}</span>
        <span className="opacity-40 mx-0.5">:</span>
        <span>{s}</span>
      </div>
    </div>
  );
}
