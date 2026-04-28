import { useState } from 'react';
import { Link } from 'react-router-dom';

// ── Dust particles — 3 depth layers for parallax ──────────────────────────────
// Layer A: far/tiny (slow, dim)   Layer B: mid   Layer C: near/large (fast, bright)
const PARTICLES = [
  // ── Layer A — far, tiny, slow ─────────────────────────────────────────────
  { x: 12, dur: 22, delay:  0.0, size: 0.6, op: 0.10, drift:  4 },
  { x: 23, dur: 26, delay:  3.4, size: 0.5, op: 0.08, drift: -3 },
  { x: 34, dur: 20, delay:  7.1, size: 0.7, op: 0.11, drift:  5 },
  { x: 44, dur: 24, delay:  1.8, size: 0.6, op: 0.09, drift: -4 },
  { x: 54, dur: 28, delay:  5.2, size: 0.5, op: 0.10, drift:  3 },
  { x: 62, dur: 21, delay:  9.6, size: 0.7, op: 0.08, drift: -5 },
  { x: 71, dur: 25, delay:  2.3, size: 0.6, op: 0.11, drift:  4 },
  { x: 83, dur: 23, delay:  6.9, size: 0.5, op: 0.09, drift: -3 },
  { x: 91, dur: 27, delay:  4.0, size: 0.7, op: 0.10, drift:  6 },
  { x:  8, dur: 29, delay: 11.2, size: 0.6, op: 0.08, drift: -4 },
  { x: 18, dur: 22, delay:  8.7, size: 0.5, op: 0.10, drift:  3 },
  { x: 29, dur: 26, delay: 13.5, size: 0.7, op: 0.09, drift: -5 },
  { x: 40, dur: 20, delay:  0.5, size: 0.6, op: 0.08, drift:  4 },
  { x: 51, dur: 24, delay: 10.1, size: 0.5, op: 0.11, drift: -3 },
  { x: 66, dur: 28, delay:  3.8, size: 0.7, op: 0.09, drift:  5 },
  { x: 78, dur: 21, delay: 15.4, size: 0.6, op: 0.08, drift: -4 },
  { x: 87, dur: 25, delay:  7.3, size: 0.5, op: 0.10, drift:  3 },
  { x: 96, dur: 23, delay: 12.0, size: 0.7, op: 0.09, drift: -6 },
  { x: 38, dur: 27, delay:  2.9, size: 0.6, op: 0.08, drift:  4 },
  { x: 59, dur: 22, delay: 16.8, size: 0.5, op: 0.11, drift: -3 },
  // ── Layer B — mid ─────────────────────────────────────────────────────────
  { x:  7, dur: 15, delay:  1.2, size: 1.2, op: 0.15, drift:  6 },
  { x: 17, dur: 11, delay:  4.6, size: 1.0, op: 0.18, drift: -5 },
  { x: 27, dur: 17, delay:  0.4, size: 1.4, op: 0.14, drift:  7 },
  { x: 37, dur: 12, delay:  8.3, size: 1.2, op: 0.19, drift: -4 },
  { x: 47, dur: 16, delay:  2.7, size: 1.0, op: 0.16, drift:  5 },
  { x: 56, dur: 10, delay:  6.0, size: 1.4, op: 0.20, drift: -7 },
  { x: 64, dur: 18, delay:  3.5, size: 1.2, op: 0.15, drift:  4 },
  { x: 73, dur: 13, delay:  9.8, size: 1.0, op: 0.17, drift: -5 },
  { x: 82, dur: 15, delay:  1.6, size: 1.4, op: 0.14, drift:  6 },
  { x: 90, dur: 11, delay:  5.4, size: 1.2, op: 0.19, drift: -3 },
  { x: 20, dur: 14, delay: 11.0, size: 1.0, op: 0.16, drift:  7 },
  { x: 32, dur: 17, delay:  7.7, size: 1.4, op: 0.15, drift: -6 },
  { x: 48, dur: 12, delay: 14.2, size: 1.2, op: 0.18, drift:  4 },
  { x: 69, dur: 16, delay:  0.9, size: 1.0, op: 0.17, drift: -5 },
  { x: 85, dur: 10, delay:  4.3, size: 1.4, op: 0.20, drift:  5 },
  { x: 43, dur: 13, delay: 12.7, size: 1.2, op: 0.16, drift: -4 },
  { x: 76, dur: 18, delay:  6.5, size: 1.0, op: 0.14, drift:  6 },
  { x: 14, dur: 11, delay: 17.1, size: 1.4, op: 0.19, drift: -7 },
  // ── Layer C — near, large, fast, bright ───────────────────────────────────
  { x: 10, dur:  7, delay:  0.8, size: 2.2, op: 0.28, drift:  8 },
  { x: 22, dur:  9, delay:  3.1, size: 2.8, op: 0.24, drift: -6 },
  { x: 35, dur:  6, delay:  6.4, size: 2.0, op: 0.30, drift:  7 },
  { x: 46, dur:  8, delay:  1.5, size: 2.5, op: 0.26, drift: -5 },
  { x: 57, dur:  7, delay:  5.0, size: 2.2, op: 0.29, drift:  6 },
  { x: 68, dur:  9, delay:  2.2, size: 2.8, op: 0.25, drift: -8 },
  { x: 79, dur:  6, delay:  8.0, size: 2.0, op: 0.31, drift:  5 },
  { x: 88, dur:  8, delay:  4.7, size: 2.5, op: 0.27, drift: -4 },
  { x: 30, dur:  7, delay: 10.3, size: 2.2, op: 0.28, drift:  7 },
  { x: 53, dur:  9, delay:  0.2, size: 2.8, op: 0.24, drift: -6 },
  { x: 75, dur:  6, delay:  7.5, size: 2.0, op: 0.30, drift:  8 },
  { x: 41, dur:  8, delay: 13.9, size: 2.5, op: 0.26, drift: -5 },
  { x: 93, dur:  7, delay:  2.8, size: 2.2, op: 0.29, drift:  4 },
  { x: 16, dur:  9, delay:  9.2, size: 2.8, op: 0.25, drift: -7 },
  { x: 61, dur:  6, delay:  4.1, size: 2.0, op: 0.31, drift:  6 },
  { x: 84, dur:  8, delay: 16.3, size: 2.5, op: 0.27, drift: -3 },
];

const MODES = [
  {
    id:       'daily',
    label:    'Daily',
    sub:      'One new movie per day · 4 categories',
    stubText: 'DAILY',
    color:    '#F3CE13',
    glow:     'rgba(243,206,19,0.45)',
    bg:       'linear-gradient(135deg, rgba(243,206,19,0.13) 0%, rgba(243,206,19,0.06) 55%, rgba(18,14,0,0.68) 100%)',
    border:   'rgba(243,206,19,0.24)',
    hoverBorder: 'rgba(243,206,19,0.72)',
    stubBg:   'rgba(243,206,19,0.07)',
    icon:     <CalendarIcon />,
  },
  {
    id:       'unlimited',
    label:    'Unlimited',
    sub:      'Endless rounds · play any time',
    stubText: 'UNLIM.',
    color:    '#a855f7',
    glow:     'rgba(168,85,247,0.45)',
    bg:       'linear-gradient(135deg, rgba(168,85,247,0.13) 0%, rgba(168,85,247,0.06) 55%, rgba(8,0,20,0.68) 100%)',
    border:   'rgba(168,85,247,0.24)',
    hoverBorder: 'rgba(168,85,247,0.72)',
    stubBg:   'rgba(168,85,247,0.07)',
    icon:     <InfinityIcon />,
  },
];

const NOTCH_R = 22;

function ticketMask() {
  const val = `radial-gradient(circle ${NOTCH_R}px at 0px 50%, transparent ${NOTCH_R}px, white ${NOTCH_R + 0.5}px), radial-gradient(circle ${NOTCH_R}px at 100% 50%, transparent ${NOTCH_R}px, white ${NOTCH_R + 0.5}px)`;
  return {
    maskImage:           val,
    maskComposite:       'intersect',
    WebkitMaskImage:     val,
    WebkitMaskComposite: 'destination-in',
  };
}

export default function HomePage() {
  return (
    <div
      className="homepage-outer relative flex flex-col items-center justify-center animate-fade-in"
      style={{ overflow: 'hidden' }}
    >
      {/* ── Keyframe definitions ───────────────────────────────────────────── */}
      <style>{`
        /* Desktop: subtract only the sticky top nav (4rem = 64px) */
        .homepage-outer {
          height: calc(100dvh - 4rem);
        }
        /* Mobile: also subtract the fixed bottom mode-bar (~68px) so nothing
           is hidden under it, then shrink hero elements to fit */
        @media (max-width: 639px) {
          .homepage-outer {
            height: calc(100dvh - 4rem - 68px);
          }
        }
        .hero-film-icon {
          width:  clamp(80px, 12vh, 120px);
          height: clamp(80px, 12vh, 120px);
        }
        @media (max-width: 640px) {
          .hero-film-icon {
            width:  clamp(44px, 7vh, 68px);
            height: clamp(44px, 7vh, 68px);
          }
        }
        @keyframes dust-rise {
          0%   { transform: translateY(0) translateX(0px);            opacity: 0; }
          6%   { opacity: 1; }
          94%  { opacity: 1; }
          100% { transform: translateY(-100vh) translateX(var(--dp)); opacity: 0; }
        }
        @keyframes spotlight-flicker {
          0%,  100% { opacity: 0.82; }
          15%        { opacity: 0.97; }
          30%        { opacity: 0.85; }
          48%        { opacity: 1.00; }
          63%        { opacity: 0.80; }
          79%        { opacity: 0.95; }
        }
        @keyframes spotlight-inner {
          0%,  100% { opacity: 0.70; }
          25%        { opacity: 1.00; }
          52%        { opacity: 0.75; }
          77%        { opacity: 0.95; }
        }
      `}</style>

      {/* ── Spotlight — outer wide ambient glow ──────────────────────────────── */}
      <div
        aria-hidden="true"
        style={{
          position:      'fixed',
          bottom:        '-8%',
          left:          '50%',
          width:         '1400px',
          height:        '1100px',
          transform:     'translateX(-50%)',
          background: `
            radial-gradient(
              ellipse 55% 70% at 50% 100%,
              rgba(80, 130, 255, 0.12) 0%,
              rgba(55, 100, 230, 0.06) 30%,
              rgba(30,  65, 190, 0.02) 55%,
              transparent 72%
            )
          `,
          animation:     'spotlight-flicker 11s ease-in-out infinite',
          pointerEvents: 'none',
          zIndex:        0,
        }}
      />

      {/* ── Spotlight — inner bright core (pale blue-white) ──────────────────── */}
      <div
        aria-hidden="true"
        style={{
          position:      'fixed',
          bottom:        '-4%',
          left:          '50%',
          width:         '700px',
          height:        '850px',
          transform:     'translateX(-50%)',
          background: `
            radial-gradient(
              ellipse 40% 60% at 50% 100%,
              rgba(200, 220, 255, 0.20) 0%,
              rgba(140, 180, 255, 0.12) 18%,
              rgba( 90, 140, 255, 0.06) 38%,
              rgba( 50, 100, 220, 0.02) 58%,
              transparent 72%
            )
          `,
          animation:     'spotlight-inner 7s ease-in-out infinite',
          pointerEvents: 'none',
          zIndex:        0,
        }}
      />

      {/* ── Dust particles — clipped to beam cone ────────────────────────────── */}
      {/* The trapezoid clip-path mirrors the projector cone: narrow at bottom,
          wide at top. Particles outside the cone are clipped off. */}
      <div
        aria-hidden="true"
        style={{
          position:   'fixed',
          inset:      0,
          pointerEvents: 'none',
          zIndex:     1,
          overflow:   'hidden',
          clipPath:   'polygon(22% 100%, 78% 100%, 100% 0%, 0% 0%)',
        }}
      >
        {PARTICLES.map((p, i) => (
          <span
            key={i}
            style={{
              position:     'absolute',
              bottom:       '-4px',
              left:         `${p.x}%`,
              width:        `${p.size}px`,
              height:       `${p.size}px`,
              borderRadius: '50%',
              background:   `rgba(210,225,255,${p.op})`,
              '--dp':       `${p.drift}px`,
              animation:    `dust-rise ${p.dur}s ${p.delay}s linear infinite`,
            }}
          />
        ))}
      </div>

      {/* ── Hero section ──────────────────────────────────────────────────────── */}
      <div className="relative text-center z-10 px-4" style={{ marginBottom: 'clamp(10px, 2.5vh, 36px)' }}>
        <div className="animate-float" style={{ marginBottom: 'clamp(6px, 1.5vh, 22px)' }}>
          <FilmIcon className="mx-auto text-accent hero-film-icon" />
        </div>
        <h1
          className="font-display font-black text-white tracking-tight"
          style={{
            fontSize: 'clamp(1.75rem, 6.5vw, 4rem)',
            lineHeight: 1,
            textShadow: '0 0 48px rgba(243,206,19,0.50), 0 0 16px rgba(243,206,19,0.30)',
            marginBottom: 'clamp(4px, 0.8vh, 12px)',
          }}
        >
          Cine<span style={{ color: '#F3CE13' }}>GUESS</span>
        </h1>
        <p style={{ fontSize: 'clamp(0.72rem, 1.6vw, 0.9rem)', color: 'rgba(255,255,255,0.38)', lineHeight: 1.5 }}>
          Guess the movie in 7 tries. Match genre, director, year and more.
        </p>
      </div>

      {/* ── Ticket stubs ──────────────────────────────────────────────────────── */}
      <div
        className="relative flex flex-col z-10"
        style={{
          width:    '90%',
          maxWidth: '660px',
          gap:      'clamp(8px, 1.4vh, 20px)',
        }}
      >
        {MODES.map((m, i) => (
          <TicketCard key={m.id} mode={m} delay={i * 90} />
        ))}
      </div>

      {/* ── Footer hint ────────────────────────────────────────────────────────── */}
      <p
        className="relative z-10 text-gray-700 uppercase tracking-[0.22em]"
        style={{ fontSize: '0.58rem', marginTop: 'clamp(6px, 1.2vh, 24px)' }}
      >
        4 categories &bull; daily &amp; unlimited
      </p>
    </div>
  );
}

// ── Ticket card ───────────────────────────────────────────────────────────────
function TicketCard({ mode, delay }) {
  const [hovered, setHovered] = useState(false);

  return (
    <Link
      to={`/${mode.id}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="relative flex group animate-slide-up"
      style={{
        animationDelay:       `${delay}ms`,
        background:           mode.bg,
        backdropFilter:       'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderRadius:         '18px',
        border:               `1px solid ${hovered ? mode.hoverBorder : mode.border}`,
        boxShadow: hovered
          ? `0 0 72px ${mode.glow}, 0 0 28px ${mode.glow.replace('0.45','0.22')}, inset 0 1px 0 rgba(255,255,255,0.10)`
          : `0 0 28px ${mode.glow.replace('0.45','0.07')}, inset 0 1px 0 rgba(255,255,255,0.05)`,
        transform:  hovered ? 'translateY(-3px) scale(1.004)' : 'translateY(0) scale(1)',
        transition: 'box-shadow 0.35s ease, border-color 0.35s ease, transform 0.35s ease',
        overflow:   'hidden',
        ...ticketMask(),
      }}
    >
      {/* ── Tear-off stub (left strip) ─────────────────────────────────────── */}
      <div
        className="flex-shrink-0 flex flex-col items-center justify-center gap-3"
        style={{
          width:       'clamp(58px, 12%, 86px)',
          background:  mode.stubBg,
          borderRight: `1.5px dashed ${mode.color}28`,
          padding:     'clamp(12px, 2.2vh, 28px) 0',
          position:    'relative',
        }}
      >
        <PerfDot color={mode.color} />
        <span
          style={{
            writingMode:   'vertical-rl',
            textOrientation:'mixed',
            transform:     'rotate(180deg)',
            fontSize:      '0.48rem',
            fontWeight:    800,
            letterSpacing: '0.3em',
            color:         mode.color,
            opacity:       hovered ? 0.70 : 0.40,
            textTransform: 'uppercase',
            userSelect:    'none',
            transition:    'opacity 0.3s ease',
          }}
        >
          {mode.stubText}
        </span>
        <div
          style={{
            width:         '24px',
            height:        '24px',
            borderRadius:  '50%',
            border:        `1.5px solid ${mode.color}${hovered ? '45' : '28'}`,
            display:       'flex',
            alignItems:    'center',
            justifyContent:'center',
            background:    `${mode.color}${hovered ? '18' : '0a'}`,
            transition:    'border-color 0.3s, background 0.3s',
          }}
        >
          <div style={{ color: mode.color, width: 11, height: 11, opacity: hovered ? 0.9 : 0.55 }}>
            {mode.icon}
          </div>
        </div>
        <PerfDot color={mode.color} />
      </div>

      {/* ── Main body ───────────────────────────────────────────────────────── */}
      <div
        className="flex flex-1 items-center"
        style={{
          padding: 'clamp(10px, 2.2vh, 36px) clamp(16px, 4%, 36px) clamp(10px, 2.2vh, 36px) clamp(14px, 3%, 28px)',
          gap:     'clamp(12px, 2.5%, 24px)',
        }}
      >
        {/* Large icon box */}
        <div
          className="flex-shrink-0 transition-transform duration-300 group-hover:scale-110"
          style={{
            width:         'clamp(44px, 8%, 64px)',
            height:        'clamp(44px, 8%, 64px)',
            borderRadius:  '14px',
            background:    hovered ? `${mode.color}1e` : `${mode.color}0e`,
            border:        `1.5px solid ${hovered ? mode.color + '55' : mode.color + '28'}`,
            boxShadow:     hovered ? `0 0 36px ${mode.color}45, inset 0 0 20px ${mode.color}18` : 'none',
            display:       'flex',
            alignItems:    'center',
            justifyContent:'center',
            transition:    'all 0.35s ease',
          }}
        >
          <div style={{ color: mode.color, width: '42%', height: '42%', minWidth: 20 }}>
            {mode.icon}
          </div>
        </div>

        {/* Text block */}
        <div className="flex-1 min-w-0">
          <p
            className="font-display font-black leading-none"
            style={{
              fontSize:     'clamp(1.4rem, 4.5vw, 2.2rem)',
              color:        mode.color,
              marginBottom: '0.4em',
              textShadow:   hovered ? `0 0 32px ${mode.color}80` : 'none',
              transition:   'text-shadow 0.35s ease',
            }}
          >
            {mode.label}
          </p>
          <p
            style={{
              fontSize:   'clamp(0.68rem, 1.6vw, 0.84rem)',
              color:      'rgba(255,255,255,0.40)',
              lineHeight: 1.5,
            }}
          >
            {mode.sub}
          </p>
        </div>

        {/* Chevron */}
        <svg
          className="flex-shrink-0 transition-transform duration-250 group-hover:translate-x-2"
          style={{
            color:      mode.color,
            opacity:    hovered ? 1 : 0.35,
            width:      'clamp(16px, 2.5vw, 24px)',
            height:     'clamp(16px, 2.5vw, 24px)',
            transition: 'opacity 0.3s ease',
          }}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
        </svg>
      </div>

      {/* Top shimmer */}
      <div
        aria-hidden="true"
        className="absolute top-0 left-0 right-0 h-px pointer-events-none"
        style={{
          background: `linear-gradient(90deg, transparent 10%, ${mode.color}${hovered ? '55' : '22'} 35%, transparent 80%)`,
          transition: 'background 0.35s ease',
        }}
      />
      {/* Bottom shimmer */}
      <div
        aria-hidden="true"
        className="absolute bottom-0 left-0 right-0 h-px pointer-events-none"
        style={{
          background: `linear-gradient(90deg, transparent 10%, ${mode.color}${hovered ? '28' : '0e'} 50%, transparent 80%)`,
          transition: 'background 0.35s ease',
        }}
      />
    </Link>
  );
}

function PerfDot({ color }) {
  return (
    <div
      style={{
        width:        '5px',
        height:       '5px',
        borderRadius: '50%',
        border:       `1px solid ${color}30`,
        background:   `${color}12`,
        flexShrink:   0,
      }}
    />
  );
}

// ── SVG icons ────────────────────────────────────────────────────────────────
function FilmIcon({ className, style }) {
  return (
    <svg className={className} style={style} fill="none" viewBox="0 0 24 24"
         stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="18" rx="2"/>
      <path d="M7 3v18M17 3v18M2 8h5M2 13h5M17 8h5M17 13h5"/>
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"
         strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
      <rect x="3" y="4" width="18" height="18" rx="2"/>
      <path d="M16 2v4M8 2v4M3 10h18"/>
      <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/>
    </svg>
  );
}

function InfinityIcon() {
  return (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"
         strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
      <path d="M12 12c-2-2.5-4-4-6-4a4 4 0 000 8c2 0 4-1.5 6-4z"/>
      <path d="M12 12c2 2.5 4 4 6 4a4 4 0 000-8c-2 0-4 1.5-6 4z"/>
    </svg>
  );
}
