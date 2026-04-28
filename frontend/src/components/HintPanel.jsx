import { tmdbImage } from '../utils/api';

const TYPE_STYLES = {
  clue:  { border: 'border-purple-500', accent: 'text-purple-400', icon: '✨' },
  actor: { border: 'border-accent',     accent: 'text-accent',     icon: '🎭' },
  image: { border: 'border-blue-500',   accent: 'text-blue-400',   icon: '🎞️' },
};

export default function HintPanel({ hints }) {
  if (!hints || hints.length === 0) return null;

  return (
    <div className="mt-4 space-y-2 animate-slide-up">
      {hints.map((hint) => {
        const style = TYPE_STYLES[hint.type] || TYPE_STYLES.actor;
        return (
          <div key={hint.type} className={`card p-3 border-l-4 ${style.border}`}>
            <p className={`text-xs ${style.accent} font-semibold uppercase tracking-wide mb-1.5 flex items-center gap-1.5`}>
              <span>{style.icon}</span>
              <span>{hint.label}</span>
            </p>

            {hint.type === 'image' ? (
              <img
                src={tmdbImage(hint.value, 'w780')}
                alt="A frame from the movie"
                className="w-full max-w-md rounded-lg mx-auto"
                loading="lazy"
              />
            ) : hint.type === 'clue' ? (
              <p className="text-sm text-gray-200 italic leading-relaxed">{hint.value}</p>
            ) : hint.type === 'actor' ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                {hint.profile ? (
                  <img
                    src={tmdbImage(hint.profile, 'w185')}
                    alt={hint.value}
                    style={{
                      width: 64,
                      height: 80,
                      objectFit: 'cover',
                      borderRadius: 8,
                      flexShrink: 0,
                      background: 'rgba(255,255,255,0.06)',
                    }}
                    loading="lazy"
                  />
                ) : (
                  <div style={{
                    width: 64,
                    height: 80,
                    borderRadius: 8,
                    flexShrink: 0,
                    background: 'rgba(255,255,255,0.06)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 28,
                  }}>
                    🎭
                  </div>
                )}
                <p className="text-sm text-gray-200" style={{ fontWeight: 600, fontSize: '1rem' }}>
                  {hint.value}
                </p>
              </div>
            ) : (
              <p className="text-sm text-gray-200">{hint.value}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
