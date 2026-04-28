/**
 * FlameIndicator.jsx
 * Shared flame streak visualiser — used in ProfilePage (IMAX cards),
 * FriendsPage (mini-posters + rank badge) and imported by GamePage.
 *
 * Keyframe names are prefixed `fi-` to avoid collisions with the
 * `flame-*` keyframes defined inline in GamePage's FlameStreakBadge.
 */
import { useSettings } from '../context/SettingsContext';

// ── Colorblind shape map ──────────────────────────────────────────────────────
// Shapes evolve with streak level: circles→triangles→diamonds→crosses→stars
function getColorblindShape(streak) {
  if (streak >= 250) return 'star';
  if (streak >= 100) return 'cross';
  if (streak >= 50)  return 'diamond';
  if (streak >= 10)  return 'triangle';
  return 'circle';
}

const SHAPE_CLIP = {
  circle:   null, // border-radius: 50% handled separately
  triangle: 'polygon(50% 0%, 0% 100%, 100% 100%)',
  diamond:  'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
  cross:    'polygon(33% 0%,67% 0%,67% 33%,100% 33%,100% 67%,67% 67%,67% 100%,33% 100%,33% 67%,0% 67%,0% 33%,33% 33%)',
  star:     'polygon(50% 0%,61% 35%,98% 35%,68% 57%,79% 91%,50% 70%,21% 91%,32% 57%,2% 35%,39% 35%)',
};

// ── Tier config ────────────────────────────────────────────────────────────────
// Ordered highest → lowest so getFlameConfig() short-circuits correctly.
export const FLAME_TIERS = [
  {
    min: 500, name: 'haze',
    colors:  ['#f8fafc', '#e0e7ff', '#a5b4fc'],
    ds:      'drop-shadow(0 0 9px rgba(255,255,255,0.75)) drop-shadow(0 0 18px rgba(165,180,252,0.5))',
    aura:    'rgba(255,255,255,0.11)',
    numGlow: '#c7d2fe',
    speed:   '2s', pilot: false, sparks: true, haze: true,
  },
  {
    min: 250, name: 'supernova',
    colors:  ['#fefce8', '#fef3c7', '#fde68a'],
    ds:      'drop-shadow(0 0 8px rgba(254,243,199,0.7)) drop-shadow(0 0 16px rgba(253,230,138,0.4))',
    aura:    'rgba(254,243,199,0.09)',
    numGlow: '#fef3c7',
    speed:   '2.6s', pilot: false, sparks: true, haze: false,
  },
  {
    min: 100, name: 'plasma',
    colors:  ['#e879f9', '#a855f7', '#60a5fa'],
    ds:      'drop-shadow(0 0 7px rgba(168,85,247,0.7)) drop-shadow(0 0 14px rgba(96,165,250,0.35))',
    aura:    'rgba(168,85,247,0.12)',
    numGlow: '#c4b5fd',
    speed:   '1.5s', pilot: false, sparks: true, haze: false,
  },
  {
    min: 50, name: 'inferno',
    colors:  ['#fcd34d', '#ef4444', '#dc2626'],
    ds:      'drop-shadow(0 0 7px rgba(239,68,68,0.65)) drop-shadow(0 0 14px rgba(239,68,68,0.28))',
    aura:    'rgba(239,68,68,0.10)',
    numGlow: '#fca5a5',
    speed:   '1.1s', pilot: false, sparks: true, haze: false,
  },
  {
    min: 25, name: 'blaze',
    colors:  ['#fef08a', '#fb923c', '#f97316'],
    ds:      'drop-shadow(0 0 6px rgba(249,115,22,0.5)) drop-shadow(0 0 12px rgba(249,115,22,0.22))',
    aura:    'rgba(249,115,22,0.08)',
    numGlow: '#fed7aa',
    speed:   '1.5s', pilot: false, sparks: false, haze: false,
  },
  {
    min: 10, name: 'flame',
    colors:  ['#fef9c3', '#fbbf24', '#eab308'],
    ds:      'drop-shadow(0 0 5px rgba(234,179,8,0.45))',
    aura:    'rgba(234,179,8,0.06)',
    numGlow: '#fef08a',
    speed:   '1.9s', pilot: false, sparks: false, haze: false,
  },
  {
    min: 0, name: 'pilot',
    colors:  ['#e0f2fe', '#bfdbfe', '#93c5fd'],
    ds:      'drop-shadow(0 0 4px rgba(147,197,253,0.3))',
    aura:    'rgba(147,197,253,0.04)',
    numGlow: '#bfdbfe',
    speed:   '3.2s', pilot: true, sparks: false, haze: false,
  },
];

export function getFlameConfig(n) {
  return FLAME_TIERS.find((t) => n >= t.min) || FLAME_TIERS[FLAME_TIERS.length - 1];
}

export function getMilestoneLevel(n) {
  if (n >= 500) return 500;
  if (n >= 250) return 250;
  if (n >= 100) return 100;
  if (n >= 50)  return 50;
  if (n >= 25)  return 25;
  if (n >= 10)  return 10;
  return 0;
}

// ── Percentile estimate (client-side approximation) ────────────────────────────
export function getPercentile(streak) {
  if (!streak || streak <= 0) return null;
  if (streak >= 50)  return 'Top 1% Globally';
  if (streak >= 25)  return 'Top 5% Globally';
  if (streak >= 10)  return 'Top 15% Globally';
  if (streak >= 5)   return 'Top 30% Globally';
  return 'Top 60% Globally';
}

// ── Rank badge for friend profile headers ─────────────────────────────────────
// friend.streaks is a {catId: number} map of current streaks
export function getRankBadge(friend) {
  if (!friend?.streaks) return null;
  const maxStreak = Math.max(0, ...Object.values(friend.streaks).map((s) => Number(s) || 0));
  if (maxStreak >= 250) return { label: 'LEGEND',     minStreak: 250 };
  if (maxStreak >= 100) return { label: 'MASTER',     minStreak: 100 };
  if (maxStreak >= 50)  return { label: 'EXPERT',     minStreak: 50  };
  if (maxStreak >= 25)  return { label: 'VETERAN',    minStreak: 25  };
  if (maxStreak >= 10)  return { label: 'APPRENTICE', minStreak: 10  };
  return null;
}

// ── Micro spark particles ──────────────────────────────────────────────────────
function MicroSparks({ color, size, streak }) {
  const { colorblind } = useSettings();

  const count  = Math.max(3, Math.min(6, Math.round(size / 7)));
  const sparks = Array.from({ length: count }, (_, i) => ({
    left:  `${18 + (i * 64 / count)}%`,
    delay: `${(i * 0.26).toFixed(2)}s`,
    dur:   `${(0.72 + i * 0.17).toFixed(2)}s`,
    dx:    `${(i % 2 === 0 ? -1 : 1) * (2 + i * 1.5)}px`,
    rise:  `-${Math.round(size * 0.68)}px`,
  }));

  // Colorblind mode: evolving shapes & star drift
  const shape    = colorblind ? getColorblindShape(streak) : 'circle';
  const isStar   = shape === 'star';
  const animName = isStar ? 'fi-star-drift' : 'fi-spark-float';
  const pSize    = colorblind
    ? Math.max(isStar ? 4 : 3, size * (isStar ? 0.08 : 0.065))
    : Math.max(1.5, size * 0.044);

  // Star glow — glowing halo in obsidian dark mode (always dark)
  const starGlow = isStar && colorblind
    ? `0 0 6px ${color}, 0 0 12px ${color}`
    : `0 0 3px ${color}`;

  return (
    <>
      {sparks.map((s, i) => (
        <div
          key={i}
          style={{
            position:     'absolute',
            width:        pSize,
            height:       pSize,
            borderRadius: shape === 'circle' ? '50%' : 0,
            clipPath:     SHAPE_CLIP[shape] ?? undefined,
            background:   color,
            boxShadow:    starGlow,
            left:         s.left,
            bottom:       '55%',
            animation:    `${animName} ${isStar ? (parseFloat(s.dur) * 2.2).toFixed(2) + 's' : s.dur} ease-out ${s.delay} infinite`,
            '--sx':       isStar ? `${parseFloat(s.dx) * 0.35}px` : s.dx,
            '--fi-rise':  isStar ? `-${Math.round(size * 1.2)}px` : s.rise,
          }}
        />
      ))}
    </>
  );
}

// ── FlameSVG ──────────────────────────────────────────────────────────────────
/**
 * Core flame visual — embeds into any layout.
 *
 * Props:
 *   streak     {number}  — the streak value that determines the tier
 *   size       {number}  — width in px; height is automatically 1.42×
 *   idKey      {string}  — unique key to namespace SVG gradient IDs
 *                          (must be unique per page if >1 flame renders)
 *   showNumber {boolean} — overlay the streak number at the flame base
 */
export function FlameSVG({ streak = 0, size = 36, idKey = 'fi', showNumber = false }) {
  const n   = Math.max(0, streak ?? 0);
  const cfg = getFlameConfig(n);
  const h   = Math.round(size * 1.42);

  const outerId = `fi-out-${idKey}`;
  const innerId = `fi-inn-${idKey}`;

  const flameAnim = cfg.pilot
    ? `fi-pilot-flicker ${cfg.speed} ease-in-out infinite`
    : (cfg.name === 'supernova' || cfg.name === 'haze')
      ? `fi-supernova-pulse ${cfg.speed} ease-in-out infinite`
      : `fi-flicker ${cfg.speed} ease-in-out infinite`;

  const numPx = n >= 100
    ? `${Math.max(8, Math.round(size * 0.21))}px`
    : `${Math.max(9, Math.round(size * 0.27))}px`;

  return (
    <div style={{ position: 'relative', width: size, height: h, flexShrink: 0 }}>

      {/* ── Shared keyframes (idempotent; fi- prefix avoids GamePage clash) ── */}
      <style>{`
        @keyframes fi-flicker {
          0%,100% { transform: scale(1) skewX(0deg); }
          20%     { transform: scale(1.03) skewX(-1.8deg); }
          45%     { transform: scale(0.97) skewX(1.4deg); }
          70%     { transform: scale(1.02) skewX(-0.7deg); }
        }
        @keyframes fi-pilot-flicker {
          0%,100% { opacity: 0.58; transform: scale(1); }
          50%     { opacity: 0.82; transform: scale(1.025); }
        }
        @keyframes fi-supernova-pulse {
          0%,100% { transform: scale(1); filter: brightness(1); }
          50%     { transform: scale(1.06); filter: brightness(1.22); }
        }
        @keyframes fi-spark-float {
          0%   { transform: translateY(0) translateX(0) scale(1); opacity: 0.95; }
          100% { transform: translateY(var(--fi-rise,-24px)) translateX(var(--sx,0px)) scale(0); opacity: 0; }
        }
        /* Colorblind star drift — slow, graceful vertical rise */
        @keyframes fi-star-drift {
          0%   { transform: translateY(0) translateX(0) scale(1.1); opacity: 0.90; }
          55%  { opacity: 0.55; }
          100% { transform: translateY(var(--fi-rise,-28px)) translateX(var(--sx,0px)) scale(0.15); opacity: 0; }
        }
      `}</style>

      {/* Ambient aura glow bleeding onto the card behind */}
      <div style={{
        position:     'absolute',
        inset:        `-${Math.round(size * 0.24)}px`,
        borderRadius: '50%',
        background:   `radial-gradient(ellipse 62% 78% at 50% 58%, ${cfg.aura}, transparent)`,
        pointerEvents:'none',
      }} />

      {/* Flame SVG */}
      <svg
        viewBox="0 0 48 70"
        style={{
          position:        'absolute',
          top:             0,
          left:            0,
          width:           size,
          height:          h,
          filter:          cfg.ds,
          animation:       flameAnim,
          transformOrigin: 'center bottom',
          overflow:        'visible',
        }}
      >
        <defs>
          <linearGradient id={outerId} x1="0.5" y1="0" x2="0.5" y2="1">
            <stop offset="0%"   stopColor={cfg.colors[0]} />
            <stop offset="52%"  stopColor={cfg.colors[1]} />
            <stop offset="100%" stopColor={cfg.colors[2]} />
          </linearGradient>
          <linearGradient id={innerId} x1="0.5" y1="0" x2="0.5" y2="1">
            <stop offset="0%"   stopColor={cfg.colors[0]} stopOpacity="0.85" />
            <stop offset="100%" stopColor={cfg.colors[1]} stopOpacity="0.25" />
          </linearGradient>
        </defs>

        {/* Outer flame body */}
        <path
          d="M24,67 C9,61 2,49 4,35 C6,23 13,14 21,6 C19,17 16,24 18,33
             C18,37 22,35 22,28 C22,36 28,33 28,40 C30,32 35,21 33,12
             C41,21 47,35 45,48 C43,59 35,66 24,67 Z"
          fill={`url(#${outerId})`}
        />

        {/* Inner highlight core */}
        <path
          d="M24,58 C15,54 11,44 13,36 C15,28 19,22 22,18 C21,26 19,32 21,38
             C22,41 24,39 24,33 C25,40 28,37 28,44 C30,38 33,30 31,24
             C37,31 40,41 38,49 C36,55 31,60 24,58 Z"
          fill={`url(#${innerId})`}
          opacity="0.48"
        />
      </svg>

      {/* Spark particles — inferno (50+), plasma, supernova, haze */}
      {cfg.sparks && size >= 18 && <MicroSparks color={cfg.colors[0]} size={size} streak={n} />}

      {/* Optional streak number at flame base */}
      {showNumber && n > 0 && (
        <div style={{
          position:  'absolute',
          bottom:    Math.round(h * 0.07),
          left:      '50%',
          transform: 'translateX(-50%)',
          lineHeight: 1,
          whiteSpace: 'nowrap',
        }}>
          <span style={{
            fontSize:      numPx,
            fontWeight:    800,
            color:         '#fff',
            fontFamily:    '"Space Grotesk", Inter, system-ui, sans-serif',
            textShadow:    `0 0 6px ${cfg.numGlow}, 0 0 14px ${cfg.numGlow}`,
            letterSpacing: '-0.02em',
          }}>
            {n}
          </span>
        </div>
      )}
    </div>
  );
}
