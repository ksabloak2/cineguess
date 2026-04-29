import { useEffect } from 'react';
import { tmdbImage } from '../utils/api';

const TYPE_STYLES = {
  clue:  { border: 'border-purple-500/50', bg: 'bg-purple-500/5',  accent: 'text-purple-400', icon: '✨' },
  actor: { border: 'border-accent/50',     bg: 'bg-accent/5',      accent: 'text-accent',     icon: '🎭' },
  image: { border: 'border-blue-500/50',   bg: 'bg-blue-500/5',    accent: 'text-blue-400',   icon: '🎞️' },
  music: { border: 'border-orange-500/50', bg: 'bg-orange-500/5',  accent: 'text-orange-400', icon: '🎵' },
};

export default function HintModal({ hints, open, onClose, latestType }) {
  useEffect(() => {
    function handler(e) { if (e.key === 'Escape') onClose(); }
    if (open) window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open || !hints || hints.length === 0) return null;

  return (
    <>
    <style>{`
      @keyframes hint-card-in {
        from { opacity: 0; transform: translateY(10px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      @keyframes hint-text-materialize {
        from { opacity: 0; filter: blur(6px); letter-spacing: 0.04em; }
        to   { opacity: 1; filter: blur(0px); letter-spacing: normal; }
      }
    `}</style>
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-sm animate-fade-in"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="card w-full sm:max-w-md p-5 sm:p-6 animate-curtain-rise sm:animate-bounce-in relative
                      rounded-t-3xl sm:rounded-2xl max-h-[85dvh] overflow-y-auto" style={{ willChange: 'transform' }}>
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-surface-input flex items-center justify-center
                     text-gray-500 hover:text-white hover:bg-surface-border transition-all"
          aria-label="Close hints"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <h2 className="font-display text-lg font-bold text-white mb-1">🎬 Hints</h2>
        <p className="text-xs text-gray-500 mb-4">
          Loglines are technically accurate but intentionally misleading — think outside the box!
        </p>

        <div className="space-y-3">
          {hints.map((hint, i) => {
            const style = TYPE_STYLES[hint.type] || TYPE_STYLES.actor;
            const isNew = hint.type === latestType;
            const cardDelay = `${0.08 + i * 0.1}s`;
            const textDelay = `${0.18 + i * 0.1}s`;
            return (
              <div
                key={hint.type}
                className={`card p-3 border-l-4 ${style.border} ${style.bg}
                  ${isNew ? 'ring-1 ring-white/10' : ''}`}
                style={{ animation: 'hint-card-in 0.35s ease both', animationDelay: cardDelay }}
              >
                <p className={`text-xs ${style.accent} font-semibold uppercase tracking-wide mb-1.5 flex items-center gap-1.5`}>
                  <span>{style.icon}</span>
                  <span>{hint.label}</span>
                  {isNew && (
                    <span className="ml-auto text-[10px] bg-accent/20 text-accent px-1.5 py-0.5 rounded-full font-bold">
                      NEW
                    </span>
                  )}
                </p>

                {hint.type === 'image' ? (
                  <img
                    src={tmdbImage(hint.value, 'w780')}
                    alt="A frame from the movie"
                    className="w-full rounded-xl ring-1 ring-white/5"
                    loading="lazy"
                    style={{ animation: 'hint-card-in 0.5s ease both', animationDelay: textDelay }}
                  />
                ) : hint.type === 'clue' ? (
                  <p
                    className="text-sm text-gray-300 italic leading-relaxed"
                    style={{ animation: 'hint-text-materialize 0.9s ease both', animationDelay: textDelay }}
                  >
                    {hint.value}
                  </p>
                ) : hint.type === 'music' ? (
                  <div
                    className="space-y-1"
                    style={{ animation: 'hint-text-materialize 0.9s ease both', animationDelay: textDelay }}
                  >
                    <p className="text-sm text-gray-100 font-semibold leading-snug">
                      🎵 Popular Track: <span className="text-orange-300">{hint.value}</span>
                    </p>
                    {hint.singers && (
                      <p className="text-xs text-gray-400">
                        Sung by: <span className="text-gray-300">{hint.singers}</span>
                      </p>
                    )}
                  </div>
                ) : hint.type === 'actor' ? (
                  <div
                    className="flex items-center gap-3"
                    style={{ animation: 'hint-text-materialize 0.9s ease both', animationDelay: textDelay }}
                  >
                    {hint.profile ? (
                      <img
                        src={tmdbImage(hint.profile, 'w185')}
                        alt={hint.value}
                        className="flex-shrink-0 ring-1 ring-white/10"
                        style={{
                          width: 36,
                          height: 36,
                          objectFit: 'cover',
                          objectPosition: 'center top',
                          borderRadius: '50%',
                          background: 'rgba(255,255,255,0.06)',
                        }}
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0
                                      bg-accent/10 border border-accent/25 text-lg">
                        🎭
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-semibold text-white leading-tight">{hint.value}</p>
                      <p className="text-xs text-gray-500 mt-0.5">appears in this film</p>
                    </div>
                  </div>
                ) : (
                  <p
                    className="text-sm text-gray-300"
                    style={{ animation: 'hint-text-materialize 0.9s ease both', animationDelay: textDelay }}
                  >
                    {hint.value}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        <button onClick={onClose} className="btn-primary w-full mt-5 text-sm">
          Got it
        </button>
      </div>
    </div>
    </>
  );
}
