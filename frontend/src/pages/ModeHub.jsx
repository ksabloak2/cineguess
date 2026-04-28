import { useState } from 'react';
import { Link, useLocation, Navigate, useNavigate } from 'react-router-dom';
import { MODES, categoryToSlug } from '../utils/gameLogic';

// ── Signature accent colors per category ────────────────────────────────────
const CAT_CONFIG = {
  top250: {
    color:       '#F3CE13',
    glow:        'rgba(243,206,19,0.50)',
    glowDim:     'rgba(243,206,19,0.15)',
    bg:          'rgba(243,206,19,0.05)',
    border:      'rgba(243,206,19,0.18)',
    hoverBorder: 'rgba(243,206,19,0.70)',
    stubBg:      'rgba(243,206,19,0.06)',
    label:       'Most Popular',
    stub:        'POPULAR',
    desc:        'Top-rated films loved worldwide',
    icon:        <TrophyIcon />,
  },
  superhero: {
    color:       '#DC143C',
    glow:        'rgba(220,20,60,0.50)',
    glowDim:     'rgba(220,20,60,0.15)',
    bg:          'rgba(220,20,60,0.05)',
    border:      'rgba(220,20,60,0.18)',
    hoverBorder: 'rgba(220,20,60,0.70)',
    stubBg:      'rgba(220,20,60,0.06)',
    label:       'Superhero',
    stub:        'HERO',
    desc:        'Marvel, DC & beyond',
    icon:        <ShieldIcon />,
  },
  animated: {
    color:       '#00D2FF',
    glow:        'rgba(0,210,255,0.45)',
    glowDim:     'rgba(0,210,255,0.12)',
    bg:          'rgba(0,210,255,0.05)',
    border:      'rgba(0,210,255,0.18)',
    hoverBorder: 'rgba(0,210,255,0.65)',
    stubBg:      'rgba(0,210,255,0.06)',
    label:       'Animated',
    stub:        'ANIM.',
    desc:        'Pixar, Ghibli & classics',
    icon:        <SparkleIcon />,
  },
  indiancinema: {
    color:       '#FF9933',
    glow:        'rgba(255,153,51,0.50)',
    glowDim:     'rgba(255,153,51,0.15)',
    bg:          'rgba(255,153,51,0.05)',
    border:      'rgba(255,153,51,0.18)',
    hoverBorder: 'rgba(255,153,51,0.70)',
    stubBg:      'rgba(255,153,51,0.06)',
    label:       'Indian Cinema',
    stub:        'INDIA',
    desc:        'Bollywood, Tollywood & more',
    icon:        <LotusIcon />,
  },
};

const CAT_ORDER = ['top250', 'superhero', 'animated', 'indiancinema'];
const NOTCH_R   = 26;

// Horizontal ticket: notches bite from left-center and right-center
function horizontalTicketMask() {
  const val = [
    `radial-gradient(circle ${NOTCH_R}px at 0px 50%,   transparent ${NOTCH_R}px, white ${NOTCH_R + 0.5}px)`,
    `radial-gradient(circle ${NOTCH_R}px at 100% 50%,  transparent ${NOTCH_R}px, white ${NOTCH_R + 0.5}px)`,
  ].join(', ');
  return {
    maskImage:           val,
    maskComposite:       'intersect',
    WebkitMaskImage:     val,
    WebkitMaskComposite: 'destination-in',
  };
}

// ── True-hover detection ─────────────────────────────────────────────────────
// On touch-only devices the browser fires synthetic mouseenter/mouseleave after
// a tap, causing the just-navigated-to card to light up immediately.
// (hover: hover) is false on phones/tablets, so we skip mouse handlers there.
const CAN_HOVER = typeof window !== 'undefined'
  && window.matchMedia('(hover: hover) and (pointer: fine)').matches;

// ── Dust particles — 6 near-layer only (reduced from 10 to lower GPU load) ──
const PARTICLES = [
  { x: 18, dur: 7, delay:  0.5, size: 2.2, op: 0.26, drift:  8 },
  { x: 40, dur: 9, delay:  3.8, size: 2.6, op: 0.23, drift: -6 },
  { x: 60, dur: 8, delay:  1.0, size: 2.4, op: 0.25, drift: -5 },
  { x: 75, dur: 7, delay:  5.5, size: 2.2, op: 0.28, drift:  6 },
  { x: 28, dur: 6, delay:  4.6, size: 2.0, op: 0.30, drift:  5 },
  { x: 88, dur: 8, delay:  6.1, size: 2.4, op: 0.25, drift: -6 },
];

export default function ModeHub() {
  const { pathname }      = useLocation();
  const mode              = pathname.replace('/', '');
  const meta              = MODES.find((m) => m.id === mode);
  const [hoveredId, setHoveredId] = useState(null);
  const navigate = useNavigate();

  if (!meta) return <Navigate to="/" replace />;

  const isUnlimited = mode === 'unlimited';
  const modeColor   = isUnlimited ? '#a855f7' : '#F3CE13';

  return (
    <div
      className="relative flex flex-col animate-fade-in"
      style={{ height: 'calc(100dvh - 4rem)', overflow: 'hidden' }}
    >
      {/* ── Keyframes ───────────────────────────────────────────────────────── */}
      <style>{`
        @keyframes dust-rise {
          0%   { transform: translateY(0) translateX(0px);            opacity: 0; }
          6%   { opacity: 1; }
          94%  { opacity: 1; }
          100% { transform: translateY(-100vh) translateX(var(--dp)); opacity: 0; }
        }
        @keyframes hub-flicker {
          0%,100%{ opacity: 0.80; } 18%{ opacity: 0.96; } 45%{ opacity: 0.84; }
          62%    { opacity: 1.00; } 80%{ opacity: 0.78; }
        }
        @keyframes hub-inner {
          0%,100%{ opacity: 0.65; } 28%{ opacity: 1.00; } 55%{ opacity: 0.72; }
        }
        @keyframes ticket-float {
          0%,100% { transform: translateY(0px);  }
          50%      { transform: translateY(-9px); }
        }

        /* ── Rip animation keyframes ──────────────────────────────────── */

        /* Top/body half: stamp up toward the user */
        @keyframes ticket-rip-body {
          0%   { transform: translateY(0px) scale(1);    }
          30%  { transform: translateY(-6px) scale(1.04); }
          100% { transform: translateY(-6px) scale(1.04); }
        }

        /* Mobile bottom stub: tilt and fall off downward */
        @keyframes ticket-rip-stub-fall {
          0%   { transform: translateY(0)    rotate(0deg);   opacity: 1; }
          20%  { transform: translateY(4px)  rotate(3deg);   opacity: 1; }
          100% { transform: translateY(120%) rotate(14deg);  opacity: 0; }
        }

        /* Desktop left stub: pivots from top-right corner, falls down + left */
        @keyframes ticket-rip-stub-left {
          0%   { transform: translate(0,    0)    rotate(0deg);   opacity: 1; }
          18%  { transform: translate(-5px, 14px) rotate(-6deg);  opacity: 1; }
          100% { transform: translate(-16px,180%) rotate(-26deg); opacity: 0; }
        }

        /* Jagged tear edge flash */
        @keyframes ticket-rip-edge {
          0%   { opacity: 0;   }
          15%  { opacity: 1;   }
          70%  { opacity: 0.7; }
          100% { opacity: 0;   }
        }

        /* ── Ticket notch mask — desktop: left & right bites at mid-height ── */
        .ticket-card {
          -webkit-mask-image:
            radial-gradient(circle 26px at 0%   50%, transparent 26px, white 26.5px),
            radial-gradient(circle 26px at 100% 50%, transparent 26px, white 26.5px);
          -webkit-mask-composite: destination-in;
          mask-image:
            radial-gradient(circle 26px at 0%   50%, transparent 26px, white 26.5px),
            radial-gradient(circle 26px at 100% 50%, transparent 26px, white 26.5px);
          mask-composite: intersect;
        }

        /* Perforation + stub label: desktop hidden, mobile shown */
        .ticket-perf       { display: none; }
        .ticket-admit      { display: none; }

        /* ── Mobile overrides (< 768px) ─────────────────────── */
        @media (max-width: 767px) {

          /* Page content: slim horizontal padding so grid uses ~15px margins each side */
          .hub-content {
            padding-left:  12px !important;
            padding-right: 12px !important;
            padding-top:   8px  !important;
            padding-bottom:14px !important;
          }

          /* Grid: fill remaining flex-1 space */
          .ticket-grid-inner {
            height:     calc(100dvh - 4rem - 68px - 130px) !important;
            width:      100% !important;
            column-gap: 10px !important;
            row-gap:    10px !important;
          }

          /* Each ticket fills its grid cell entirely */
          .ticket-card {
            height:        100% !important;
            border-radius: 14px !important;
          }

          /* ── Ticket punch effect:
             Left & right semi-circle notches at 72% from the top,
             exactly where the perforation line sits.
             The page background shows through — real physical bites. ── */
          .ticket-card {
            -webkit-mask-image:
              radial-gradient(circle 13px at 0%   72%, transparent 13px, white 13.5px),
              radial-gradient(circle 13px at 100% 72%, transparent 13px, white 13.5px) !important;
            -webkit-mask-composite: destination-in !important;
            mask-image:
              radial-gradient(circle 13px at 0%   72%, transparent 13px, white 13.5px),
              radial-gradient(circle 13px at 100% 72%, transparent 13px, white 13.5px) !important;
            mask-composite: intersect !important;
          }

          /* Show perforation line + stub text on mobile */
          .ticket-perf  { display: block !important; }
          .ticket-admit { display: flex  !important; }

          /* Hide desktop left stub strip and description */
          .ticket-stub { display: none !important; }
          .ticket-desc { display: none !important; }

          /* ── Ticket body: icon+title at top, PLAY pushed to stub below perf ── */
          .ticket-body {
            flex-direction:  column        !important;
            align-items:     center        !important;
            justify-content: space-between !important;
            gap:             0             !important;
            padding:         18px 10px 14px !important;
          }

          /* Left cluster: icon + title stack vertically & centre */
          .ticket-left {
            flex-direction:  column !important;
            align-items:     center !important;
            justify-content: center !important;
            gap:             clamp(7px, 1.6vh, 11px) !important;
            min-width:       0      !important;
            width:           100%   !important;
          }

          /* Icon box */
          .ticket-main-icon {
            width:         clamp(46px, 13vw, 58px) !important;
            height:        clamp(46px, 13vw, 58px) !important;
            border-radius: 12px !important;
          }

          /* Title */
          .ticket-title {
            font-size:     clamp(1.05rem, 5.2vw, 1.28rem) !important;
            text-align:    center  !important;
            margin-bottom: 0       !important;
            white-space:   normal  !important;
            line-height:   1.15    !important;
          }

          /* Text wrapper */
          .ticket-text {
            text-align: center !important;
            min-width:  0      !important;
            width:      100%   !important;
          }

          /* Play CTA — sits in stub section below perforation */
          .ticket-play {
            font-size:       0.68rem  !important;
            justify-content: center   !important;
            width:           100%     !important;
            gap:             5px      !important;
            flex-shrink:     0        !important;
            padding-bottom:  2px      !important;
          }
          .ticket-play svg {
            width:  11px !important;
            height: 11px !important;
          }

          /* "ADMIT ONE" stub label */
          .ticket-admit {
            align-items:     center !important;
            justify-content: center !important;
            gap:             5px    !important;
            margin-bottom:   2px    !important;
          }

          /* Compact header text */
          .hub-mode-label {
            font-size:     0.62rem !important;
            margin-bottom: 2px    !important;
          }
          .hub-title { font-size: 1rem !important; }

          /* Back link */
          .hub-back {
            display:   block  !important;
            padding:   10px 0 !important;
            font-size: 11px   !important;
          }

          /* Rip animation: mobile only shows the bottom stub tearing off —
             hide the desktop left-stub overlay and its tear edge */
          .ticket-rip-desktop-stub  { display: none !important; }
          .ticket-rip-edge-desktop  { display: none !important; }
        }

        /* Mobile ripping: clip away the bottom stub so the card body looks torn.
           Perforation sits at 72%, so bottom 28% is clipped off.
           Rounded top corners stay; bottom edge is sharp (fresh tear). */
        @media (max-width: 767px) {
          .ticket-ripping {
            clip-path: inset(0 0 28% 0 round 14px 14px 0 0) !important;
          }
        }

        /* Desktop ripping: clip away the left stub area so the card looks
           like it no longer has that section (bottom-left is "gone").
           Sharp left edge = fresh tear; rounded right = original corners.
           Also hide the mobile-only rip overlays (horizontal stub + edge). */
        @media (min-width: 768px) {
          .ticket-ripping {
            clip-path: inset(0 0 0 12% round 0 16px 16px 0) !important;
          }
          .ticket-rip-mobile-stub { display: none !important; }
          .ticket-rip-edge-mobile { display: none !important; }
        }
      `}</style>

      {/* ── Obsidian grid overlay ────────────────────────────────────────────── */}
      <div
        aria-hidden="true"
        style={{
          position:        'fixed',
          inset:           0,
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)
          `,
          backgroundSize:  '44px 44px',
          pointerEvents:   'none',
          zIndex:          0,
        }}
      />

      {/* ── Projector — outer ambient ────────────────────────────────────────── */}
      <div aria-hidden="true" style={{
        position:'fixed', bottom:'-8%', left:'50%',
        width:'860px', height:'680px', transform:'translateX(-50%)',
        background:`radial-gradient(ellipse 55% 70% at 50% 100%,
          rgba(80,130,255,0.11) 0%, rgba(55,100,230,0.055) 30%,
          rgba(30,65,190,0.018) 55%, transparent 72%)`,
        animation:'hub-flicker 11s ease-in-out infinite',
        willChange:'opacity',
        pointerEvents:'none', zIndex:0,
      }}/>

      {/* ── Projector — inner bright core ───────────────────────────────────── */}
      <div aria-hidden="true" style={{
        position:'fixed', bottom:'-4%', left:'50%',
        width:'420px', height:'500px', transform:'translateX(-50%)',
        background:`radial-gradient(ellipse 38% 58% at 50% 100%,
          rgba(200,220,255,0.18) 0%, rgba(140,180,255,0.10) 18%,
          rgba(90,140,255,0.05) 38%, transparent 68%)`,
        animation:'hub-inner 7s ease-in-out infinite',
        willChange:'opacity',
        pointerEvents:'none', zIndex:0,
      }}/>

      {/* ── Dust particles — beam cone ──────────────────────────────────────── */}
      <div aria-hidden="true" style={{
        position:'fixed', inset:0, pointerEvents:'none', zIndex:1,
        overflow:'hidden',
        clipPath:'polygon(22% 100%, 78% 100%, 100% 0%, 0% 0%)',
        // contain limits repaint scope to this element only
        contain:'layout paint style',
      }}>
        {PARTICLES.map((p, i) => (
          <span key={i} style={{
            position:'absolute', bottom:'-4px', left:`${p.x}%`,
            width:`${p.size}px`, height:`${p.size}px`,
            borderRadius:'50%', background:`rgba(210,225,255,${p.op})`,
            '--dp':`${p.drift}px`,
            animation:`dust-rise ${p.dur}s ${p.delay}s linear infinite`,
            willChange:'transform, opacity',
          }}/>
        ))}
      </div>

      {/* ── Page content ────────────────────────────────────────────────────── */}
      <div
        className="hub-content relative flex flex-col items-center z-10"
        style={{
          height:  '100%',
          padding: 'clamp(8px,1.4vh,18px) clamp(10px,4vw,32px) clamp(14px,2vh,24px)',
        }}
      >
        {/* Header — ultra-compact so tickets dominate */}
        <div className="text-center flex-shrink-0" style={{ marginBottom: 'clamp(16px,2.6vh,32px)' }}>
          <p
            className="hub-mode-label uppercase tracking-[0.28em] font-semibold"
            style={{ color: modeColor, opacity: 0.75, fontSize: '0.72rem', marginBottom: '4px' }}
          >
            {isUnlimited ? 'Unlimited Mode' : 'Daily Mode'}
          </p>
          <h1
            className="hub-title font-display font-black text-white"
            style={{ fontSize: 'clamp(1.1rem, 2.4vw, 1.55rem)', lineHeight: 1.1 }}
          >
            Choose a Category
          </h1>
        </div>

        {/* ── 2×2 Ticket grid — widescreen, height-capped to stay in viewport ── */}
        {/* overflow:visible so hover translateY(-12px) isn't clipped at the top */}
        <div
          className="flex-1 flex items-center justify-center w-full"
          style={{ minHeight: 0, overflow: 'visible', paddingTop: '14px' }}
        >
          <div
            className="ticket-grid-inner"
            style={{
              display:             'grid',
              gridTemplateColumns: '1fr 1fr',
              gridTemplateRows:    'minmax(0, 1fr) minmax(0, 1fr)',
              columnGap:           'clamp(8px, 1.2vw, 16px)',
              rowGap:              'clamp(7px, 1.0vh, 12px)',
              width:               'min(92vw, 1600px)',
              height:              'calc(100dvh - 4rem - 144px)',
            }}
          >
            {CAT_ORDER.map((id, i) => {
              const cfg = CAT_CONFIG[id];
              const floatDelays = ['0s', '0.75s', '0.38s', '1.12s'];
              return (
                <TicketCard
                  key={id}
                  cfg={cfg}
                  catId={id}
                  to={`/play/${mode}/${categoryToSlug(id)}`}
                  floatDelay={floatDelays[i]}
                  hoveredId={hoveredId}
                  setHoveredId={setHoveredId}
                  navigate={navigate}
                />
              );
            })}
          </div>
        </div>

        {/* Back link */}
        <div className="flex-shrink-0 text-center" style={{ marginTop: 'clamp(4px,0.7vh,8px)' }}>
          <Link
            to="/"
            className="hub-back text-[10px] text-gray-700 hover:text-gray-400 transition-colors uppercase tracking-widest"
          >
            ← Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}

// ── Horizontal ticket card ────────────────────────────────────────────────────
// Performance rules:
//   • Only `transform` and `opacity` are transitioned on the root element
//     (both GPU-composited — zero repaint).
//   • All hover colour/glow changes live in an absolutely-positioned overlay
//     whose `opacity` goes 0→1 (also compositor-only, zero repaint).
//   • `backdropFilter`, `background`, `boxShadow`, and `border` on the root
//     are STATIC — they never change, so the browser never repaints them.
function TicketCard({ cfg, catId, to, floatDelay, hoveredId, setHoveredId, navigate }) {
  const isHovered = hoveredId === catId;
  const isDimmed  = hoveredId !== null && !isHovered;
  const [ripping, setRipping] = useState(false);

  function handleClick(e) {
    e.preventDefault();
    if (ripping) return;
    // Haptic feedback on mobile
    if (navigator.vibrate) navigator.vibrate(45);
    setHoveredId(null);
    setRipping(true);
    setTimeout(() => navigate(to), 420);
  }

  return (
    <div
      onClick={handleClick}
      onMouseEnter={CAN_HOVER ? () => !ripping && setHoveredId(catId) : undefined}
      onMouseLeave={CAN_HOVER ? () => setHoveredId(null) : undefined}
      className={`ticket-card group relative flex${ripping ? ' ticket-ripping' : ''}`}
      style={{
        cursor:   ripping ? 'default' : 'pointer',
        width:    '100%',
        height:   '100%',
        // Raise above sibling cards so the falling stub isn't obscured
        zIndex:   ripping ? 50 : undefined,
        // Let the torn stub exit past the card edge
        overflow: ripping ? 'visible' : 'hidden',
        // ── Static base — never changes, no repaint budget ──
        // backdrop-filter removed: blurring near-black is invisible but very GPU-expensive.
        background:           `linear-gradient(135deg, ${cfg.bg} 0%, rgba(5,5,12,0.88) 100%)`,
        borderRadius:         '16px',
        border:               `1px solid ${cfg.border}`,
        boxShadow:            `0 0 22px ${cfg.glowDim}, inset 0 1px 0 rgba(255,255,255,0.04)`,
        // ── GPU-composited only — no paint ──
        transform: ripping ? undefined
          : isHovered ? 'translateY(-12px) scale(1.02)'
          : isDimmed  ? 'scale(0.97)' : 'translateY(0px) scale(1)',
        opacity:    isDimmed && !ripping ? 0.38 : 1,
        transition: ripping ? 'none' : 'transform 0.20s cubic-bezier(0.34,1.4,0.64,1), opacity 0.18s ease',
        willChange: 'transform',
        // Card body stays still on both mobile and desktop —
        // only the stub tears away at the perforation line.
        animation:  ripping ? 'none'
          : isHovered || isDimmed ? 'none'
          : `ticket-float 3s ${floatDelay} ease-in-out infinite`,
      }}
    >
      {/* ── Hover glow overlay — opacity 0→1 only, compositor-only, zero repaint ── */}
      <div
        aria-hidden="true"
        style={{
          position:     'absolute',
          inset:        0,
          borderRadius: '16px',
          // The expensive visuals live here but only render at full opacity on hover.
          // Because only `opacity` changes, the browser composites this on the GPU —
          // the gradient and shadow are rasterised once and cached.
          background:  `linear-gradient(135deg, ${cfg.bg.replace('0.05','0.14')} 0%, ${cfg.bg.replace('0.05','0.07')} 55%, rgba(5,5,12,0.72) 100%)`,
          boxShadow:   `0 0 150px ${cfg.glow}, 0 0 280px ${cfg.glowDim}, 0 0 60px ${cfg.glow}, 0 20px 64px rgba(0,0,0,0.65), inset 0 1px 0 rgba(255,255,255,0.12)`,
          border:      `1px solid ${cfg.hoverBorder}`,
          opacity:     isHovered ? 1 : 0,
          transition:  'opacity 0.18s ease',
          pointerEvents: 'none',
          zIndex:      0,
        }}
      />

      {/* ── Left stub strip ── */}
      <div
        className="ticket-stub flex-shrink-0 flex flex-col items-center justify-between"
        style={{
          position:    'relative',
          zIndex:      1,
          width:       'clamp(56px,12%,84px)',
          background:  cfg.stubBg,
          borderRight: `2px dashed ${cfg.color}28`,
          padding:     'clamp(14px,2.2vh,22px) 0',
        }}
      >
        <PerfDot color={cfg.color} />
        <span style={{
          writingMode:'vertical-rl', textOrientation:'mixed',
          transform:'rotate(180deg)',
          fontSize:'0.55rem', fontWeight:800, letterSpacing:'0.30em',
          color:cfg.color, opacity: isHovered ? 0.75 : 0.35,
          textTransform:'uppercase', userSelect:'none',
          transition:'opacity 0.18s ease',
        }}>
          {cfg.stub}
        </span>
        <div style={{
          width:'34px', height:'34px', borderRadius:'50%',
          border:`2px solid ${cfg.color}${isHovered?'45':'25'}`,
          background:`${cfg.color}${isHovered?'18':'0a'}`,
          display:'flex', alignItems:'center', justifyContent:'center',
          transition:'opacity 0.18s ease',
          opacity: isHovered ? 1 : 0.7,
        }}>
          <div style={{ color:cfg.color, width:16, height:16 }}>
            {cfg.icon}
          </div>
        </div>
        <PerfDot color={cfg.color} />
      </div>

      {/* ── Main body ── */}
      <div
        className="ticket-body flex flex-1 items-center justify-between"
        style={{
          position:      'relative',
          zIndex:        1,
          paddingTop:    'clamp(14px,2.4vh,26px)',
          paddingBottom: 'clamp(14px,2.4vh,26px)',
          paddingLeft:   'clamp(16px,3.5%,32px)',
          paddingRight:  'clamp(20px,4%,40px)',
        }}
      >
        {/* Left cluster: icon + text */}
        <div className="ticket-left flex items-center" style={{ gap: 'clamp(12px,2%,26px)', minWidth: 0 }}>
          {/* Icon box */}
          <div
            className="ticket-main-icon flex-shrink-0"
            style={{
              width:        'clamp(60px,9vw,84px)',
              height:       'clamp(60px,9vw,84px)',
              borderRadius: '16px',
              background:   `${cfg.color}${isHovered ? '20' : '0e'}`,
              border:       `2px solid ${cfg.color}${isHovered ? '55' : '25'}`,
              // Static shadow — no value flip on hover avoids a repaint.
              // The card's hover overlay already provides the glow effect.
              boxShadow:    `0 0 18px ${cfg.color}20, inset 0 0 10px ${cfg.color}0c`,
              display:      'flex', alignItems:'center', justifyContent:'center',
              willChange:   'transform',
              transform:    isHovered ? 'scale(1.10)' : 'scale(1)',
              transition:   'transform 0.18s ease',
            }}
          >
            <div style={{ color:cfg.color, width:'46%', height:'46%', minWidth:20 }}>
              {cfg.icon}
            </div>
          </div>

          {/* Text */}
          <div className="ticket-text min-w-0">
            <h2
              className="ticket-title font-display font-black leading-none"
              style={{
                fontSize:     'clamp(1.4rem, 3.2vw, 2.3rem)',
                color:        cfg.color,
                marginBottom: '0.38em',
                textShadow:   `0 0 30px ${cfg.color}55`,
              }}
            >
              {cfg.label}
            </h2>
            <p
              className="ticket-desc"
              style={{
                fontSize:'clamp(0.70rem,1.4vw,0.86rem)',
                color:'rgba(255,255,255,0.40)', lineHeight:1.5,
                whiteSpace:'nowrap',
              }}
            >
              {cfg.desc}
            </p>
          </div>
        </div>

        {/* Right / bottom: Play CTA */}
        <div
          className="ticket-play flex-shrink-0 flex items-center font-black uppercase tracking-widest"
          style={{
            gap:       'clamp(10px,1.2vw,16px)',
            fontSize:  'clamp(0.72rem,1.3vw,0.85rem)',
            color:     cfg.color,
            opacity:   isHovered ? 1 : 0.38,
            transition:'opacity 0.18s ease',
          }}
        >
          {/* "ADMIT ONE" label — mobile stub decoration, hidden on desktop */}
          <div
            className="ticket-admit"
            aria-hidden="true"
            style={{ display: 'none', pointerEvents: 'none' }}
          >
            <span style={{
              fontSize: '0.42rem', fontWeight: 900, letterSpacing: '0.28em',
              textTransform: 'uppercase', color: `${cfg.color}55`,
            }}>
              ADMIT
            </span>
            <span style={{
              width: '18px', height: '1px',
              background: `${cfg.color}30`,
              display: 'inline-block', flexShrink: 0,
            }}/>
            <span style={{
              fontSize: '0.42rem', fontWeight: 900, letterSpacing: '0.28em',
              textTransform: 'uppercase', color: `${cfg.color}55`,
            }}>
              ONE
            </span>
          </div>
          <span>Play</span>
          <svg
            style={{
              width:'clamp(13px,1.5vw,19px)', height:'clamp(13px,1.5vw,19px)',
              flexShrink: 0,
              transform: isHovered ? 'translateX(4px)' : 'translateX(0)',
              transition: 'transform 0.18s ease',
            }}
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7"/>
          </svg>
        </div>
      </div>

      {/* ── Perforation line — mobile only, sits at 72% from top ── */}
      <div
        className="ticket-perf"
        aria-hidden="true"
        style={{
          position:     'absolute',
          top:          '72%',
          left:         '13px',   /* clears the notch radius */
          right:        '13px',
          height:       '0',
          /* Dashed via repeating-gradient: dash 6px, gap 5px */
          borderTop:    'none',
          background:   'none',
          backgroundImage: `repeating-linear-gradient(
            90deg,
            ${cfg.color}55 0px,
            ${cfg.color}55 5px,
            transparent   5px,
            transparent   10px
          )`,
          backgroundSize:     '10px 1px',
          backgroundRepeat:   'repeat-x',
          backgroundPosition: '0 0',
          height:       '1px',
          pointerEvents:'none',
          zIndex:       3,
        }}
      />

      {/* ── Cardstock inner border — subtle double-border texture ── */}
      <div
        aria-hidden="true"
        style={{
          position:     'absolute',
          inset:        '3px',
          borderRadius: '12px',
          border:       `1px solid ${cfg.color}10`,
          pointerEvents:'none',
          zIndex:       1,
          /* Desktop: invisible; mobile CSS makes it slightly more visible */
        }}
      />

      {/* Top shimmer — static, no transition */}
      <div aria-hidden="true" style={{
        position:'absolute', zIndex:1,
        top:0, left:0, right:0, height:'1px', pointerEvents:'none',
        background:`linear-gradient(90deg, transparent 8%, ${cfg.color}1a 40%, transparent 85%)`,
      }}/>
      {/* Bottom shimmer — static */}
      <div aria-hidden="true" style={{
        position:'absolute', zIndex:1,
        bottom:0, left:0, right:0, height:'1px', pointerEvents:'none',
        background:`linear-gradient(90deg, transparent 8%, ${cfg.color}0a 50%, transparent 85%)`,
      }}/>

      {/* ── Rip animation overlays (only rendered when ripping) ── */}
      {ripping && <>
        {/* Mobile: bottom stub falls down */}
        <div
          aria-hidden="true"
          className="ticket-rip-mobile-stub"
          style={{
            position:   'absolute',
            top:        '72%',
            left:       0,
            right:      0,
            bottom:     0,
            zIndex:     20,
            background: `linear-gradient(180deg, ${cfg.bg.replace('0.05','0.22')} 0%, rgba(5,5,12,0.95) 100%)`,
            borderBottomLeftRadius:  '14px',
            borderBottomRightRadius: '14px',
            animation:  'ticket-rip-stub-fall 0.40s cubic-bezier(0.55,0,1,0.45) forwards',
            transformOrigin: 'top center',
          }}
        />
        {/* Desktop: left stub slides away */}
        <div
          aria-hidden="true"
          className="ticket-rip-desktop-stub"
          style={{
            position:   'absolute',
            top:        0,
            left:       0,
            bottom:     0,
            width:      'clamp(56px,12%,84px)',
            zIndex:     20,
            background: cfg.stubBg,
            borderTopLeftRadius:    '14px',
            borderBottomLeftRadius: '14px',
            animation:  'ticket-rip-stub-left 0.42s cubic-bezier(0.55,0,1,0.45) forwards',
            transformOrigin: 'top right',
          }}
        />
        {/* Mobile jagged tear edge at perforation */}
        <svg
          aria-hidden="true"
          className="ticket-rip-edge-mobile"
          style={{
            position:   'absolute',
            top:        'calc(72% - 4px)',
            left:       '13px',
            right:      '13px',
            height:     '8px',
            width:      'calc(100% - 26px)',
            zIndex:     21,
            animation:  'ticket-rip-edge 0.42s ease forwards',
            pointerEvents: 'none',
          }}
          viewBox="0 0 200 8" preserveAspectRatio="none"
        >
          <polyline
            points="0,4 10,1 20,7 30,1 40,7 50,1 60,7 70,1 80,7 90,1 100,7 110,1 120,7 130,1 140,7 150,1 160,7 170,1 180,7 190,1 200,4"
            fill="none"
            stroke="rgba(255,255,255,0.75)"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {/* Desktop jagged tear edge at vertical perforation */}
        <svg
          aria-hidden="true"
          className="ticket-rip-edge-desktop"
          style={{
            position:   'absolute',
            top:        '13px',
            bottom:     '13px',
            left:       'calc(clamp(56px,12%,84px) - 4px)',
            width:      '8px',
            height:     'calc(100% - 26px)',
            zIndex:     21,
            animation:  'ticket-rip-edge 0.42s ease forwards',
            pointerEvents: 'none',
          }}
          viewBox="0 0 8 200" preserveAspectRatio="none"
        >
          <polyline
            points="4,0 1,10 7,20 1,30 7,40 1,50 7,60 1,70 7,80 1,90 7,100 1,110 7,120 1,130 7,140 1,150 7,160 1,170 7,180 1,190 4,200"
            fill="none"
            stroke="rgba(255,255,255,0.75)"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </>}
    </div>
  );
}

// ── Tiny perforation dot ──────────────────────────────────────────────────────
function PerfDot({ color, style = {} }) {
  return (
    <div style={{
      width:'7px', height:'7px', borderRadius:'50%',
      border:`1.5px solid ${color}35`, background:`${color}14`,
      flexShrink:0, ...style,
    }}/>
  );
}

// ── SVG icons ─────────────────────────────────────────────────────────────────
function TrophyIcon() {
  return (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}
         strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
      <path d="M8 21h8M12 17v4"/>
      <path d="M6 3h12v7a6 6 0 01-12 0V3z"/>
      <path d="M6 5H3.5A1.5 1.5 0 002 6.5C2 9 4 11 6 12"/>
      <path d="M18 5h2.5A1.5 1.5 0 0122 6.5C22 9 20 11 18 12"/>
    </svg>
  );
}
function ShieldIcon() {
  return (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}
         strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      <path d="M9 12l2 2 4-4"/>
    </svg>
  );
}
function SparkleIcon() {
  return (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}
         strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
      <path d="M9.937 15.5A2 2 0 008.5 14.063l-6.135-1.582a.5.5 0 010-.962L8.5 9.937A2 2 0 009.937 8.5l1.582-6.135a.5.5 0 01.963 0L14.063 8.5A2 2 0 0015.5 9.937l6.135 1.582a.5.5 0 010 .962L15.5 14.063a2 2 0 00-1.437 1.437l-1.582 6.135a.5.5 0 01-.963 0z"/>
      <path d="M20 3v4M22 5h-4M4 17v2M5 18H3"/>
    </svg>
  );
}
function LotusIcon() {
  return (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}
         strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
      <path d="M12 22V12"/>
      <path d="M12 12C12 7 15.5 3.5 20 3c0 4.5-3.5 8-8 9z"/>
      <path d="M12 12C12 7 8.5 3.5 4 3c0 4.5 3.5 8 8 9z"/>
      <path d="M12 12c-5 0-8.5-3-9-7 4.5 0 8 3 9 7z"/>
      <path d="M12 12c5 0 8.5-3 9-7-4.5 0-8 3-9 7z"/>
      <path d="M12 12c0 4.5-2.5 8.5-6 10 0-4.5 2-8.5 6-10z"/>
      <path d="M12 12c0 4.5 2.5 8.5 6 10 0-4.5-2-8.5-6-10z"/>
    </svg>
  );
}
