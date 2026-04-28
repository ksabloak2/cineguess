import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { getStreaks, getPercentiles, updateUsername, deleteAccount, clearPoolCache } from '../utils/api';
import { CATEGORIES } from '../utils/gameLogic';
import YearCalendar from '../components/YearCalendar';
import { FlameSVG, FLAME_TIERS } from '../components/FlameIndicator';
import SignOutModal from '../components/SignOutModal';
import ReportIssueModal from '../components/ReportIssueModal';

// ── Cone dust (28 particles — up from 15) ────────────────────────────────────
const CONE_DUST = Array.from({ length: 28 }, (_, i) => ({
  id:      i,
  left:    14 + (i * 41 + 7) % 72,
  delay:   (i * 0.47) % 6,
  dur:     4 + (i * 0.61) % 4,
  size:    1 + (i % 3),
  opacity: 0.15 + (i % 5) * 0.05,
  depth:   i % 3,
}));

// ── Ambient scatter (20 particles spread across full page) ────────────────────
const AMBIENT_DUST = Array.from({ length: 20 }, (_, i) => ({
  id:      i,
  left:    (i * 53 + 11) % 94 + 3,
  top:     (i * 67 + 23) % 82 + 8,
  delay:   (i * 0.71) % 8,
  dur:     9 + (i * 0.83) % 7,
  size:    1 + (i % 2),
  opacity: 0.06 + (i % 4) * 0.03,
}));

// ── Per-category film-grain textures (CSS backgroundImage + backgroundSize) ──
const CAT_TEXTURE = {
  top250: {
    // Classic cinema: diagonal scratch lines
    img:  'repeating-linear-gradient(38deg, transparent 0px, transparent 5px, rgba(255,255,255,0.010) 5px, rgba(255,255,255,0.010) 6px)',
    size: 'auto',
  },
  superhero: {
    // Comic halftone dots
    img:  'radial-gradient(circle 1.4px at 10px 10px, rgba(255,255,255,0.045) 100%, transparent 100%)',
    size: '18px 18px',
  },
  animated: {
    // Watercolour wash: soft cross-hatch
    img:  `repeating-linear-gradient(60deg, transparent 0px, transparent 9px, rgba(255,255,255,0.010) 9px, rgba(255,255,255,0.010) 10px),
           repeating-linear-gradient(120deg, transparent 0px, transparent 9px, rgba(255,255,255,0.010) 9px, rgba(255,255,255,0.010) 10px)`,
    size: 'auto',
  },
  indiancinema: {
    // Ornate grid cells — lattice pattern
    img:  `repeating-linear-gradient(90deg, rgba(255,255,255,0.009) 0px, rgba(255,255,255,0.009) 1px, transparent 1px, transparent 16px),
           repeating-linear-gradient(0deg,  rgba(255,255,255,0.009) 0px, rgba(255,255,255,0.009) 1px, transparent 1px, transparent 16px)`,
    size: '16px 16px',
  },
};

// ── Tab definitions ── Settings is NOT in the nav bar; it is only reachable
// via the Gear icon in the header (navigates with router state {tab:'settings'})
const TABS = [
  { id: 'streaks', label: 'Streaks', icon: '🔥' },
  { id: 'history', label: 'History', icon: '📅' },
  { id: 'awards',  label: 'Awards',  icon: '🏆' },
];

// ── A-List badge — gold (all Cinema Awards) ───────────────────────────────────
function AListBadge({ size = 'md' }) {
  const isSmall = size === 'sm';
  return (
    <span
      title="A-List: All Cinema Awards collected"
      style={{
        display:       'inline-flex',
        alignItems:    'center',
        gap:           isSmall ? 2 : 4,
        padding:       isSmall ? '1px 5px' : '2px 8px',
        borderRadius:  999,
        background:    'linear-gradient(135deg, rgba(243,206,19,0.18) 0%, rgba(255,255,255,0.08) 100%)',
        border:        '1px solid rgba(243,206,19,0.55)',
        boxShadow:     '0 0 10px rgba(243,206,19,0.30), inset 0 0 8px rgba(243,206,19,0.06)',
        flexShrink:    0,
        animation:     'badge-glow-gold 2.8s ease-in-out infinite',
      }}
    >
      <span style={{ fontSize: isSmall ? '0.6rem' : '0.7rem', lineHeight: 1 }}>⭐</span>
      <span style={{
        fontSize:      isSmall ? '0.47rem' : '0.55rem',
        fontWeight:    900,
        letterSpacing: '0.18em',
        textTransform: 'uppercase',
        color:         '#F3CE13',
      }}>
        A-List
      </span>
    </span>
  );
}

// ── Certified Cinephile badge — iridescent purple/gold (all awards + all flames) ──
function CertifiedCinephileBadge({ size = 'md' }) {
  const isSmall = size === 'sm';
  return (
    <span
      title="Certified Cinephile: All Cinema Awards + all flame tiers collected"
      style={{
        display:       'inline-flex',
        alignItems:    'center',
        gap:           isSmall ? 2 : 4,
        padding:       isSmall ? '1px 6px' : '2px 9px',
        borderRadius:  999,
        background:    'linear-gradient(135deg, rgba(168,85,247,0.22) 0%, rgba(243,206,19,0.14) 50%, rgba(168,85,247,0.14) 100%)',
        border:        '1px solid rgba(192,132,252,0.65)',
        boxShadow:     '0 0 14px rgba(168,85,247,0.40), 0 0 6px rgba(243,206,19,0.20), inset 0 0 10px rgba(168,85,247,0.08)',
        flexShrink:    0,
        animation:     'badge-glow-purple 2.8s ease-in-out infinite',
      }}
    >
      <span style={{ fontSize: isSmall ? '0.6rem' : '0.72rem', lineHeight: 1 }}>🎬</span>
      <span style={{
        fontSize:       isSmall ? '0.47rem' : '0.55rem',
        fontWeight:     900,
        letterSpacing:  '0.14em',
        textTransform:  'uppercase',
        background:     'linear-gradient(90deg, #c084fc, #F3CE13, #c084fc)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor:  'transparent',
        backgroundClip: 'text',
      }}>
        Certified Cinephile
      </span>
    </span>
  );
}

// ── A-List: all Cinema Awards earned ─────────────────────────────────────────
function computeIsAList(awards, allStreaks) {
  return awards.length > 0 && awards.every((a) => a.earned);
}

// ── Certified Cinephile: all Cinema Awards + all 7 flame tiers (streak ≥ 500) ──
function computeIsCertifiedCinephile(awards, allStreaks) {
  if (!computeIsAList(awards, allStreaks)) return false;
  const maxBest = Math.max(
    0,
    ...Object.values(allStreaks).map((s) => Number(s?.longest_streak || s?.best || 0))
  );
  return maxBest >= 500;
}

// ── Awards list ───────────────────────────────────────────────────────────────
function computeAwards(allStreaks) {
  const allS        = Object.values(allStreaks);
  const maxBest     = Math.max(0, ...allS.map((s) => s.longest_streak  || 0));
  const maxCurrent  = Math.max(0, ...allS.map((s) => s.current_streak  || 0));
  const dailyOnly   = CATEGORIES.map((c) => allStreaks[c.id]).filter(Boolean);
  const allDailyHave3 = dailyOnly.filter((s) => (s.longest_streak || 0) >= 4).length >= 3;
  const totalPlayed = allS.filter((s) => (s.longest_streak || 0) > 0).length;

  return [
    { id: 'ignition',     icon: '🔥', name: 'Ignition',     desc: 'Start your first winning streak',            earned: maxCurrent >= 1  },
    { id: 'on-a-roll',    icon: '🎯', name: 'On a Roll',    desc: 'Win 3 in a row in any category',             earned: maxBest >= 3     },
    { id: 'cinephile',    icon: '🎬', name: 'Cinephile',    desc: 'Hit a 7-game winning streak',                earned: maxBest >= 7     },
    { id: 'genre-master', icon: '🏆', name: 'Genre Master', desc: 'Reach a 10-game winning streak',             earned: maxBest >= 10    },
    { id: 'completionist',icon: '🎭', name: 'Completionist',desc: 'Hit a 4+ streak in 3 daily categories',        earned: allDailyHave3    },
    { id: 'polymath',     icon: '🌐', name: 'Polymath',     desc: 'Play in 6 or more different categories',     earned: totalPlayed >= 6 },
    { id: 'legend',       icon: '⭐', name: 'Legend',       desc: 'Achieve a 20-game winning streak',           earned: maxBest >= 20    },
    { id: 'immortal',     icon: '👑', name: 'Immortal',     desc: 'Sustain a 50-game winning streak',           earned: maxBest >= 50    },
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
export default function ProfilePage() {
  const { session, profile, signOut } = useAuth();
  const navigate    = useNavigate();
  const location    = useLocation();
  const { colorblind } = useSettings();

  const [allStreaks, setAllStreaks]         = useState({});
  const [allPercentiles, setAllPercentiles] = useState({});
  const [streaksLoading, setStreaksLoading] = useState(true);
  // Initialize tab from router state (Gear icon navigates with {tab:'settings'}).
  // useEffect keeps it in sync when navigating to /profile while already on it.
  const [activeTab, setActiveTab] = useState(location.state?.tab || 'streaks');
  useEffect(() => {
    if (location.state?.tab) setActiveTab(location.state.tab);
  }, [location.state?.tab]);

  useEffect(() => {
    if (!session) return;
    setStreaksLoading(true);
    const keys = [
      ...CATEGORIES.map((c) => c.id),
      ...CATEGORIES.map((c) => `unlimited_${c.id}`),
    ];
    Promise.all([
      Promise.all(keys.map((k) => getStreaks(k).then((s) => ({ key: k, ...s })))),
      getPercentiles().catch(() => ({})),
    ])
      .then(([streakResults, percentiles]) => {
        const map = {};
        streakResults.forEach((r) => { map[r.key] = r; });
        setAllStreaks(map);
        setAllPercentiles(percentiles);
      })
      .catch(console.error)
      .finally(() => setStreaksLoading(false));
  }, [session]);

  async function handleRefresh() {
    clearPoolCache();
    setStreaksLoading(true);
    const keys = [
      ...CATEGORIES.map((c) => c.id),
      ...CATEGORIES.map((c) => `unlimited_${c.id}`),
    ];
    try {
      const [streakResults, percentiles] = await Promise.all([
        Promise.all(keys.map((k) => getStreaks(k).then((s) => ({ key: k, ...s })))),
        getPercentiles().catch(() => ({})),
      ]);
      const map = {};
      streakResults.forEach((r) => { map[r.key] = r; });
      setAllStreaks(map);
      setAllPercentiles(percentiles);
    } catch (e) {
      console.error(e);
    } finally {
      setStreaksLoading(false);
    }
  }

  if (!session) return <GuestPrompt navigate={navigate} icon="🎬" headline="Your Cinematic Record" detail="Sign in to track streaks, earn awards, and compare scores with friends." />;

  const awards               = computeAwards(allStreaks);
  const isAList              = computeIsAList(awards, allStreaks);
  const isCertifiedCinephile = computeIsCertifiedCinephile(awards, allStreaks);

  return (
    <div
      className="profile-outer animate-fade-in"
      style={{ position: 'relative', display: 'flex', flexDirection: 'column' }}
    >
      {/* ── Keyframes + CSS classes ───────────────────────────────── */}
      <style>{`
        /* Desktop: fixed viewport height so the IMAX layout fills the screen */
        .profile-outer {
          height: calc(100dvh - 4rem);
          overflow: hidden;
        }
        /* Mobile: let the page scroll naturally — no fixed height, no clipping */
        @media (max-width: 639px) {
          .profile-outer {
            height: auto !important;
            overflow: visible !important;
          }
          .profile-tab-content {
            overflow: visible !important;
            min-height: 0 !important;
            flex: none !important;
          }
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes gold-dust-rise {
          0%   { transform: translateY(0) translateX(0); opacity: 0; }
          15%  { opacity: 1; }
          85%  { opacity: 0.55; }
          100% { transform: translateY(calc(-1 * var(--gdp,70px))) translateX(var(--gdx,5px)); opacity: 0; }
        }
        @keyframes ambient-drift {
          0%,100% { transform: translateY(0px) translateX(0px); opacity: 0; }
          20%     { opacity: 1; }
          80%     { opacity: 0.5; }
          50%     { transform: translateY(-18px) translateX(6px); }
        }
        @keyframes gold-proj-flicker {
          0%,100% { opacity: 0.80; }
          44% { opacity: 1; }
          46% { opacity: 0.58; }
          48% { opacity: 1; }
        }
        @keyframes gold-header-pulse {
          0%,100% { box-shadow: 0 0 36px rgba(243,206,19,0.14), 0 0 70px rgba(243,206,19,0.06); }
          50%     { box-shadow: 0 0 55px rgba(243,206,19,0.26), 0 0 120px rgba(243,206,19,0.12); }
        }
        @keyframes badge-glow-gold {
          0%,100% { box-shadow: inset 0 0 0px rgba(243,206,19,0), 0 0 0px rgba(243,206,19,0); }
          50%     { box-shadow: inset 0 0 30px rgba(243,206,19,0.06), 0 0 18px rgba(243,206,19,0.18); }
        }
        @keyframes badge-glow-purple {
          0%,100% { box-shadow: inset 0 0 0px rgba(168,85,247,0), 0 0 0px rgba(168,85,247,0); }
          50%     { box-shadow: inset 0 0 30px rgba(168,85,247,0.06), 0 0 18px rgba(168,85,247,0.18); }
        }
        @keyframes tab-breathe {
          0%,100% { box-shadow: 0 0 28px rgba(243,206,19,0.20), 0 0 56px rgba(243,206,19,0.10); }
          50%     { box-shadow: 0 0 44px rgba(243,206,19,0.34), 0 0 90px rgba(243,206,19,0.18), inset 0 0 24px rgba(243,206,19,0.08); }
        }
        @keyframes progress-fill {
          from { width: 0%; }
        }

        /* Tab buttons */
        .prof-tab {
          transition: all 0.22s cubic-bezier(0.4,0,0.2,1);
        }
        .prof-tab:hover {
          color: rgba(255,255,255,0.85) !important;
          background: rgba(243,206,19,0.07) !important;
          border-color: rgba(243,206,19,0.22) !important;
          box-shadow: 0 0 28px rgba(243,206,19,0.18), 0 0 55px rgba(243,206,19,0.08) !important;
        }
        .prof-tab-active {
          color: #F3CE13 !important;
          background: rgba(243,206,19,0.13) !important;
          border-color: rgba(243,206,19,0.42) !important;
          animation: tab-breathe 3s ease-in-out infinite;
        }

        /* Streak card hover */
        .streak-card:hover {
          transform: translateY(-2px);
          transition: transform 0.18s ease;
        }

        /* Award tile hover */
        .award-tile-earned:hover {
          transform: translateY(-2px) scale(1.01);
          transition: transform 0.18s ease;
        }
      `}</style>

      {/* ── Obsidian grid ─────────────────────────────────────────── */}
      <div aria-hidden style={{
        position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none',
        backgroundImage: `
          linear-gradient(rgba(243,206,19,0.024) 1px, transparent 1px),
          linear-gradient(90deg, rgba(243,206,19,0.024) 1px, transparent 1px)
        `,
        backgroundSize: '44px 44px',
      }} />

      {/* ── Vignette (dark corners → focus centre) ────────────────── */}
      <div aria-hidden style={{
        position: 'absolute', inset: 0, zIndex: 2, pointerEvents: 'none',
        background: 'radial-gradient(ellipse 80% 75% at 50% 38%, transparent 0%, rgba(0,0,0,0.52) 100%)',
      }} />

      {/* ── Gold projector (top-center) ───────────────────────────── */}
      <div aria-hidden style={{
        position: 'absolute', top: '-55px', left: '50%',
        transform: 'translateX(-50%)',
        width: '760px', height: '460px',
        background: 'radial-gradient(ellipse 380px 230px at 50% 0%, rgba(243,206,19,0.17) 0%, transparent 70%)',
        animation: 'gold-proj-flicker 9s ease-in-out infinite',
        pointerEvents: 'none', zIndex: 0,
      }} />
      <div aria-hidden style={{
        position: 'absolute', top: '-30px', left: '50%',
        transform: 'translateX(-50%)',
        width: '280px', height: '300px',
        background: 'radial-gradient(ellipse 140px 150px at 50% 0%, rgba(255,220,60,0.12) 0%, transparent 65%)',
        pointerEvents: 'none', zIndex: 0,
      }} />

      {/* ── Cone dust (28 particles) ──────────────────────────────── */}
      <div aria-hidden style={{
        position: 'absolute', top: 0, left: '50%',
        transform: 'translateX(-50%)',
        width: '680px', height: '400px',
        clipPath: 'polygon(23% 100%, 77% 100%, 100% 0%, 0% 0%)',
        pointerEvents: 'none', zIndex: 1,
      }}>
        {CONE_DUST.map((d) => (
          <div key={d.id} style={{
            position: 'absolute', bottom: 0,
            left: `${d.left}%`,
            width: `${d.size}px`, height: `${d.size}px`,
            borderRadius: '50%',
            background: `rgba(243,${183 + d.depth * 14},${18 - d.depth * 6},${d.opacity})`,
            '--gdp': `${50 + d.depth * 30}px`,
            '--gdx': `${(d.id % 2 === 0 ? 1 : -1) * (3 + d.depth * 5)}px`,
            animation: `gold-dust-rise ${d.dur}s ${d.delay}s ease-in infinite`,
          }} />
        ))}
      </div>

      {/* ── Ambient scatter dust ──────────────────────────────────── */}
      {AMBIENT_DUST.map((d) => (
        <div key={d.id} aria-hidden style={{
          position: 'absolute',
          left: `${d.left}%`, top: `${d.top}%`,
          width: `${d.size}px`, height: `${d.size}px`,
          borderRadius: '50%',
          background: `rgba(243,200,30,${d.opacity})`,
          pointerEvents: 'none', zIndex: 1,
          animation: `ambient-drift ${d.dur}s ${d.delay}s ease-in-out infinite`,
        }} />
      ))}

      {/* ════════════════════════════════════════════════════════════
          CONTENT
      ════════════════════════════════════════════════════════════ */}
      <div style={{
        position: 'relative', zIndex: 10,
        display: 'flex', flexDirection: 'column',
        height: '100%',
        padding: 'clamp(10px,1.4vh,16px) clamp(14px,2vw,28px) clamp(8px,1.1vh,12px)',
        gap: 'clamp(7px,1vh,11px)',
      }}>

        {/* ── User Header ───────────────────────────────────────────── */}
        <div style={{
          flexShrink: 0,
          display: 'flex', alignItems: 'center',
          gap: 'clamp(10px,1.8vw,18px)',
          padding: 'clamp(9px,1.4vh,14px) clamp(14px,2vw,22px)',
          borderRadius: 16,
          background: 'rgba(8,8,16,0.82)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          border: '1px solid rgba(243,206,19,0.22)',
          animation: 'gold-header-pulse 5s ease-in-out infinite',
        }}>
          <div style={{
            width: 'clamp(40px,5.5vw,56px)', height: 'clamp(40px,5.5vw,56px)',
            borderRadius: '50%', flexShrink: 0,
            background: 'rgba(243,206,19,0.12)',
            border: '2px solid rgba(243,206,19,0.50)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 'clamp(1.0rem,2.2vw,1.45rem)',
          }}>
            🎬
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <h1 className="font-display font-black" style={{
                fontSize: 'clamp(0.95rem,2.1vw,1.4rem)', color: '#fff', lineHeight: 1,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                @{profile?.username || '…'}
              </h1>
              {isCertifiedCinephile ? (
                <CertifiedCinephileBadge />
              ) : isAList ? (
                <AListBadge />
              ) : (
                <span style={{
                  fontSize: '0.57rem', fontWeight: 700, textTransform: 'uppercase',
                  letterSpacing: '0.15em', color: 'rgba(243,206,19,0.62)', flexShrink: 0,
                }}>
                  ◆ MEMBER
                </span>
              )}
            </div>
            <p style={{
              fontSize: '0.64rem', color: 'rgba(255,255,255,0.26)', marginTop: 3,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {profile?.email}
            </p>
          </div>
          <button
            onClick={() => setActiveTab('settings')}
            title="Open Director's Console"
            className="btn-secondary"
            style={{ fontSize: '0.67rem', padding: '6px 12px', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5 }}
          >
            <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
            </svg>
            Settings
          </button>
        </div>

        {/* ── Navigation Reel ───────────────────────────────────────── */}
        <div style={{
          flexShrink: 0,
          display: 'flex',
          justifyContent: 'center',
        }}>
          <div style={{
            display: 'flex',
            gap: 8,
            padding: '4px',
            borderRadius: 16,
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            width: 'clamp(320px, 68vw, 860px)',
          }}>
            {TABS.map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`prof-tab ${active ? 'prof-tab-active' : ''}`}
                  style={{
                    flex: 1,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    gap: 8,
                    padding: 'clamp(10px,1.5vh,15px) 0',
                    borderRadius: 12, cursor: 'pointer',
                    fontSize: 'clamp(0.78rem,1.3vw,0.96rem)', fontWeight: 800,
                    letterSpacing: '0.03em',
                    background:  active ? 'rgba(243,206,19,0.13)' : 'transparent',
                    border:      active ? '1px solid rgba(243,206,19,0.42)' : '1px solid transparent',
                    color:       active ? '#F3CE13' : 'rgba(255,255,255,0.32)',
                  }}
                >
                  <span style={{ fontSize: 'clamp(0.95rem,1.5vw,1.15rem)' }}>{tab.icon}</span>
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Tab content ───────────────────────────────────────────── */}
        <div className="profile-tab-content" style={{ flex: 1, minHeight: 0, overflow: 'hidden', position: 'relative' }}>
          {activeTab === 'streaks'  && <StreaksTab allStreaks={allStreaks} allPercentiles={allPercentiles} loading={streaksLoading} />}
          {activeTab === 'history'  && <HistoryTab />}
          {activeTab === 'awards'   && <AwardsTab  awards={awards} allStreaks={allStreaks} loading={streaksLoading} />}
          {activeTab === 'settings' && <SettingsTab onRefresh={handleRefresh} />}
        </div>
      </div>
    </div>
  );
}

// ── STREAKS TAB — IMAX view ───────────────────────────────────────────────────
function StreaksTab({ allStreaks, allPercentiles, loading }) {
  return (
    <>
      {/* ── Responsive mobile overrides ── */}
      <style>{`
        /* ── Desktop: two stacked sections, each with a 2×2 grid ── */
        .imax-outer {
          display: flex;
          flex-direction: column;
          gap: clamp(16px,2vh,24px);
          height: 100%;
          overflow-y: auto;
          padding-right: 2px;
          padding-bottom: clamp(12px,2vh,20px);
        }
        .imax-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          grid-template-rows: auto auto;
          gap: clamp(6px,1vw,12px);
        }

        /* ── Mobile (≤ 639px): single-column strips, full scrollable list ── */
        @media (max-width: 639px) {
          .imax-outer {
            display: flex !important;
            flex-direction: column !important;
            height: 100% !important;
            overflow-y: auto !important;
            gap: 10px !important;
            padding-bottom: 4px !important;
          }
          .imax-section { flex-shrink: 0 !important; }

          /* 1-column, auto-height rows */
          .imax-grid {
            grid-template-columns: 1fr !important;
            grid-template-rows: auto !important;
          }

          /* Card becomes a compact horizontal strip */
          .imax-card-pad {
            flex-direction: row !important;
            align-items: center !important;
            padding: 10px 14px !important;
            gap: 12px !important;
            min-height: 68px !important;
          }

          /* Left column: emoji stacked above category name */
          .imax-label-row {
            flex-direction: column !important;
            align-items: flex-start !important;
            gap: 3px !important;
            width: 76px !important;
            min-width: 76px !important;
            flex-shrink: 0 !important;
          }
          .imax-label-emoji {
            flex: none !important;
            font-size: 1.35rem !important;
          }
          .imax-label-text {
            flex: none !important;
            font-size: 0.52rem !important;
            letter-spacing: 0.04em !important;
            white-space: normal !important;
            line-height: 1.2 !important;
            overflow: visible !important;
            text-overflow: unset !important;
            max-width: 76px !important;
          }

          /* Hide the ACTIVE badge on mobile — category name + flame conveys it */
          .imax-active-badge { display: none !important; }

          /* Numbers row fills remaining space */
          .imax-numbers-row {
            flex: 1 !important;
            align-items: center !important;
          }

          /* Current streak */
          .imax-current-num { font-size: 2.4rem !important; }

          /* Show flame next to current streak number */
          .imax-flame-wrap {
            display: flex !important;
            align-items: flex-end !important;
            padding-bottom: 4px !important;
          }

          /* Vertical divider */
          .imax-divider {
            height: 36px !important;
            align-self: center !important;
          }

          /* Best number */
          .imax-best-num { font-size: 1.6rem !important; }

          /* Avg + percentile — always visible, no clipping */
          .imax-avg {
            font-size: 0.58rem !important;
            white-space: nowrap !important;
          }
          .imax-percentile {
            font-size: 0.56rem !important;
            white-space: nowrap !important;
            overflow: visible !important;
            text-overflow: unset !important;
          }
        }
      `}</style>
      <div className="imax-outer scrollbar-hide">
        <IMAXSection
          label="📅 Daily"
          color="gold"
          categories={CATEGORIES}
          getStreak={(id) => allStreaks[id]}
          getPercentile={(id) => allPercentiles[id] ?? null}
          loading={loading}
        />
        <IMAXSection
          label="∞ Unlimited"
          color="purple"
          categories={CATEGORIES}
          getStreak={(id) => allStreaks[`unlimited_${id}`]}
          getPercentile={(id) => allPercentiles[`unlimited_${id}`] ?? null}
          loading={loading}
        />
      </div>
    </>
  );
}

function IMAXSection({ label, color, categories, getStreak, getPercentile, loading }) {
  const isGold = color === 'gold';
  const rgb    = isGold ? '243,206,19' : '168,85,247';

  return (
    <div className="imax-section">
      {/* Section label */}
      <div style={{
        fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase',
        letterSpacing: '0.12em', color: `rgba(${rgb},0.65)`,
        marginBottom: 'clamp(5px,0.8vh,8px)', paddingLeft: 2, flexShrink: 0,
      }}>
        {label}
      </div>

      {/* IMAX grid (2×2 desktop → 1×4 mobile via CSS) */}
      <div className="imax-grid">
        {categories.map((cat) => {
          const s = getStreak(cat.id);
          return (
            <IMAXCard
              key={cat.id}
              catId={cat.id}
              emoji={cat.emoji}
              label={cat.label}
              current={s?.current_streak ?? null}
              best={s?.longest_streak ?? null}
              avgGuesses={s?.avg_guesses ?? null}
              percentile={getPercentile(cat.id)}
              color={color}
              loading={loading}
            />
          );
        })}
      </div>
    </div>
  );
}

function IMAXCard({ catId, emoji, label, current, best, avgGuesses, percentile, color, loading }) {
  const isGold  = color === 'gold';
  const rgb     = isGold ? '243,206,19' : '168,85,247';
  const accent  = isGold ? '#F3CE13' : '#c084fc';
  const anim    = isGold ? 'badge-glow-gold' : 'badge-glow-purple';
  const tex     = CAT_TEXTURE[catId] || CAT_TEXTURE.top250;
  const hasStreak = (current ?? 0) > 0;

  return (
    <div
      className="streak-card imax-card-pad"
      style={{
        position: 'relative',
        background: `rgba(${rgb}, 0.07)`,
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        border: `1px solid rgba(${rgb}, ${hasStreak ? '0.32' : '0.16'})`,
        borderRadius: 14,
        overflow: 'hidden',
        animation: `${anim} 4s ease-in-out infinite`,
        display: 'flex', flexDirection: 'column',
        padding: 'clamp(12px,2vh,20px) clamp(14px,2vw,22px)',
        gap: 'clamp(6px,1vh,10px)',
      }}
    >
      {/* Film grain texture overlay */}
      <div aria-hidden style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        backgroundImage: tex.img,
        backgroundSize: tex.size,
        opacity: 1,
        zIndex: 0,
      }} />

      {/* Active streak corner glow */}
      {hasStreak && (
        <div aria-hidden style={{
          position: 'absolute', bottom: 0, right: 0,
          width: '60%', height: '60%',
          background: `radial-gradient(ellipse at 100% 100%, rgba(${rgb},0.18) 0%, transparent 70%)`,
          pointerEvents: 'none', zIndex: 0,
        }} />
      )}

      {/* Content (above texture) */}
      <div className="imax-label-row" style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span className="imax-label-emoji" style={{ fontSize: 'clamp(1.1rem,2.2vw,1.5rem)', lineHeight: 1 }}>{emoji}</span>
        <span className="imax-label-text" style={{
          fontSize: 'clamp(0.6rem,1vw,0.75rem)', fontWeight: 700,
          textTransform: 'uppercase', letterSpacing: '0.08em',
          color: accent, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {label}
        </span>
        {hasStreak && (
          <span className="imax-active-badge" style={{
            marginLeft: 'auto', flexShrink: 0,
            fontSize: '0.55rem', fontWeight: 700, color: `rgba(${rgb},0.60)`,
            letterSpacing: '0.08em', textTransform: 'uppercase',
          }}>
            ACTIVE
          </span>
        )}
      </div>

      {/* Numbers */}
      <div className="imax-numbers-row" style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flex: 1, gap: 8 }}>
        {/* Current streak */}
        <div>
          {loading ? (
            <div style={{ width: 44, height: 44, background: 'rgba(255,255,255,0.08)', borderRadius: 8 }} />
          ) : (
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 5 }}>
              <div
                className="imax-current-num"
                style={{
                  fontSize: 'clamp(2.2rem,5vw,3.8rem)', fontWeight: 900, lineHeight: 1,
                  color: accent, fontVariantNumeric: 'tabular-nums',
                  textShadow: hasStreak ? `0 0 30px rgba(${rgb},0.40)` : 'none',
                }}
              >
                {current ?? 0}
              </div>
              {hasStreak && (
                <div className="imax-flame-wrap">
                  <FlameSVG
                    streak={current ?? 0}
                    size={30}
                    idKey={`prof-${catId}-${color}`}
                  />
                </div>
              )}
            </div>
          )}
          <div style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.30)', marginTop: 3, fontWeight: 600, letterSpacing: '0.05em' }}>
            CURRENT
          </div>
        </div>

        {/* Divider */}
        <div className="imax-divider" style={{
          width: 1, height: 'clamp(40px,5vh,60px)', alignSelf: 'center', flexShrink: 0,
          background: `linear-gradient(180deg, transparent, rgba(${rgb},0.25), transparent)`,
        }} />

        {/* Best streak */}
        <div style={{ textAlign: 'right' }}>
          {loading ? (
            <div style={{ width: 30, height: 30, background: 'rgba(255,255,255,0.06)', borderRadius: 6, marginLeft: 'auto' }} />
          ) : (
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end', gap: 4 }}>
              <div
                className="imax-best-num"
                style={{
                  fontSize: 'clamp(1.3rem,2.8vw,2.1rem)', fontWeight: 800, lineHeight: 1,
                  color: 'rgba(255,255,255,0.45)', fontVariantNumeric: 'tabular-nums',
                }}
              >
                {best ?? 0}
              </div>
              {(best ?? 0) > 0 && (
                <FlameSVG
                  streak={best ?? 0}
                  size={18}
                  idKey={`prof-best-${catId}-${color}`}
                />
              )}
            </div>
          )}
          <div style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.22)', marginTop: 3, fontWeight: 600, letterSpacing: '0.05em' }}>
            BEST
          </div>
          {/* Avg guesses on won games */}
          {!loading && avgGuesses !== null && (
            <div
              className="imax-avg"
              style={{
                marginTop: 4,
                fontSize: '0.55rem', fontWeight: 700,
                color: `rgba(${rgb},0.55)`,
                letterSpacing: '0.05em',
                whiteSpace: 'nowrap',
              }}
            >
              {avgGuesses.toFixed(1)} avg tries
            </div>
          )}
          {/* Global Standing percentile — live from backend, imax-percentile class hooks mobile override */}
          {!loading && percentile && (
            <div
              className="imax-percentile"
              style={{
                marginTop: 5,
                fontSize: '0.48rem', fontWeight: 800,
                color: accent,
                textShadow: `0 0 8px rgba(${rgb},0.45)`,
                textTransform: 'uppercase',
                letterSpacing: '0.07em',
                opacity: 0.90,
                whiteSpace: 'nowrap',
              }}
            >
              {percentile}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── HISTORY TAB — Wall of Fame ────────────────────────────────────────────────
function HistoryTab() {
  return (
    <div style={{ height: '100%', display: 'flex', gap: 'clamp(10px,1.4vw,16px)', overflow: 'hidden' }}>

      {/* Main calendar pane — full natural scale */}
      <div style={{
        flex: 1, minWidth: 0,
        overflowY: 'auto',
        background: 'rgba(5,5,14,0.75)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 14,
        padding: 'clamp(12px,1.8vh,20px) clamp(14px,2vw,22px)',
      }} className="scrollbar-hide">
        {/* Accent bar */}
        <div style={{
          height: 1, marginBottom: 'clamp(8px,1.4vh,14px)',
          background: 'linear-gradient(90deg, transparent, rgba(243,206,19,0.40), transparent)',
        }} />
        <div style={{
          fontSize: '0.58rem', fontWeight: 700, textTransform: 'uppercase',
          letterSpacing: '0.16em', color: 'rgba(243,206,19,0.55)',
          marginBottom: 'clamp(10px,1.5vh,16px)',
        }}>
          ◆ SCREENING HISTORY
        </div>
        <YearCalendar />
      </div>

      {/* Legend sidebar */}
      <div style={{
        width: 'clamp(110px,12vw,148px)', flexShrink: 0,
        display: 'flex', flexDirection: 'column', gap: 10,
      }}>
        {/* Legend panel */}
        <div style={{
          background: 'rgba(5,5,14,0.75)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 14,
          padding: 'clamp(12px,1.6vh,18px) 14px',
          display: 'flex', flexDirection: 'column', gap: 14,
        }}>
          <div style={{
            fontSize: '0.58rem', fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.12em', color: 'rgba(243,206,19,0.55)',
            marginBottom: 2,
          }}>
            Legend
          </div>

          {[
            { color: '#3b82f6', label: 'Flawless', sub: 'All 4 won' },
            { color: '#22c55e', label: 'Win',      sub: '≥ 1 won' },
            { color: '#ef4444', label: 'Loss',     sub: 'Played, 0 won' },
            { color: 'rgba(255,255,255,0.12)', label: 'No play', sub: 'Day not played', border: true },
          ].map((item) => (
            <div key={item.label} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <div style={{
                width: 12, height: 12, borderRadius: 3, flexShrink: 0, marginTop: 2,
                background: item.color,
                border: item.border ? '1px solid rgba(255,255,255,0.18)' : 'none',
                boxShadow: !item.border ? `0 0 8px ${item.color}66` : 'none',
              }} />
              <div>
                <div style={{ fontSize: '0.7rem', fontWeight: 600, color: '#fff', lineHeight: 1.2 }}>
                  {item.label}
                </div>
                <div style={{ fontSize: '0.58rem', color: 'rgba(255,255,255,0.30)', marginTop: 2, lineHeight: 1.3 }}>
                  {item.sub}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Film tip card */}
        <div style={{
          background: 'rgba(243,206,19,0.04)',
          border: '1px solid rgba(243,206,19,0.12)',
          borderRadius: 14,
          padding: '12px 14px',
          display: 'flex', flexDirection: 'column', gap: 6,
        }}>
          <div style={{ fontSize: '1.1rem' }}>🎞️</div>
          <div style={{ fontSize: '0.64rem', fontWeight: 600, color: 'rgba(243,206,19,0.75)', lineHeight: 1.3 }}>
            Click any day to see what you played
          </div>
        </div>
      </div>
    </div>
  );
}

// ── AWARDS TAB — Trophy Case ──────────────────────────────────────────────────
// ── Flame collection tiles ────────────────────────────────────────────────────
// Tiers to display in the collection (lowest → highest so the grid reads naturally)
const COLLECTION_TIERS = [...FLAME_TIERS].reverse().map((t) => ({
  ...t,
  // Friendly display name + milestone label per tier
  label:     t.name.charAt(0).toUpperCase() + t.name.slice(1),
  milestone: t.min === 0 ? 1 : t.min,   // pilot unlocks at streak 1
}));

function FlameCollection({ allStreaks, loading }) {
  const maxBest = Math.max(
    0,
    ...Object.values(allStreaks).map((s) => Number(s?.longest_streak || s?.best || 0))
  );

  return (
    <div style={{
      borderRadius: 14,
      padding: 'clamp(14px,2vh,18px) clamp(14px,2vw,18px)',
      background: 'rgba(8,8,16,0.82)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      border: '1px solid rgba(243,206,19,0.16)',
    }}>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 'clamp(0.78rem,1.2vw,0.90rem)', fontWeight: 700, color: '#fff', marginBottom: 2 }}>
          🔥 Flame Collection
        </div>
        <div style={{ fontSize: '0.60rem', color: 'rgba(255,255,255,0.35)' }}>
          Hit streak milestones to ignite each flame
        </div>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(7, 1fr)',
        gap: 'clamp(4px,0.8vw,10px)',
      }}>
        {COLLECTION_TIERS.map((tier) => {
          const unlocked = !loading && maxBest >= tier.milestone;
          return (
            <div key={tier.name} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              {/* Flame — greyscale + dim when locked */}
              <div style={{
                filter: unlocked ? 'none' : 'grayscale(1) brightness(0.35)',
                transition: 'filter 0.4s ease',
                position: 'relative',
              }}>
                <FlameSVG streak={tier.milestone} size={36} idKey={`col-${tier.name}`} />
                {!unlocked && !loading && (
                  <div style={{
                    position: 'absolute', inset: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.7rem',
                  }}>🔒</div>
                )}
              </div>
              {/* Label */}
              <div style={{
                fontSize: '0.50rem', fontWeight: 700, textTransform: 'uppercase',
                letterSpacing: '0.05em', textAlign: 'center', lineHeight: 1.2,
                color: unlocked ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.22)',
                transition: 'color 0.4s ease',
              }}>
                {tier.label}
              </div>
              <div style={{
                fontSize: '0.46rem', fontWeight: 600, textAlign: 'center',
                color: unlocked ? 'rgba(243,206,19,0.7)' : 'rgba(255,255,255,0.18)',
                transition: 'color 0.4s ease',
              }}>
                {tier.milestone === 1 ? '1+' : `${tier.milestone}+`}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AwardsTab({ awards, allStreaks, loading }) {
  const earnedCount          = awards.filter((a) => a.earned).length;
  const pct                  = Math.round((earnedCount / awards.length) * 100);
  const isAList              = computeIsAList(awards, allStreaks);
  const isCertifiedCinephile = computeIsCertifiedCinephile(awards, allStreaks);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 'clamp(8px,1.2vh,12px)' }}>

      {/* Scrollable area */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }} className="scrollbar-hide">
        {/* Flame Collection — top of awards tab */}
        <div style={{ marginBottom: 'clamp(8px,1.2vh,14px)' }}>
          <FlameCollection allStreaks={allStreaks} loading={loading} />
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(min(220px,100%), 1fr))',
          gap: 'clamp(8px,1.2vh,14px)',
          paddingBottom: 4,
        }}>
          {awards.map((award) => (
            <AwardTile key={award.id} {...award} loading={loading} />
          ))}
        </div>
      </div>

      {/* Progress bar — pinned to bottom */}
      <div style={{
        flexShrink: 0,
        padding: 'clamp(12px,1.8vh,18px) clamp(16px,2vw,24px)',
        borderRadius: 14,
        background: 'rgba(8,8,16,0.82)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        border: '1px solid rgba(243,206,19,0.16)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: '1rem' }}>🏆</span>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#fff' }}>Total Progress</span>
                {isCertifiedCinephile && !loading ? (
                  <CertifiedCinephileBadge size="sm" />
                ) : isAList && !loading ? (
                  <AListBadge size="sm" />
                ) : null}
              </div>
              <div style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.30)', marginTop: 1 }}>
                {isCertifiedCinephile
                  ? 'Certified Cinephile achieved! 🎬'
                  : isAList
                  ? 'A-List reached — hit a 500 streak to become a Certified Cinephile'
                  : 'Collect all Cinema Awards to reach A-List'}
              </div>
            </div>
          </div>
          <div style={{
            fontSize: 'clamp(0.85rem,1.5vw,1.05rem)', fontWeight: 900,
            color: earnedCount > 0 ? '#F3CE13' : 'rgba(255,255,255,0.30)',
            fontVariantNumeric: 'tabular-nums',
          }}>
            {loading ? '…' : `${earnedCount} / ${awards.length}`}
          </div>
        </div>

        {/* Track */}
        <div style={{
          width: '100%', height: 10, borderRadius: 999,
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.08)',
          overflow: 'hidden',
          position: 'relative',
        }}>
          {/* Fill */}
          {!loading && (
            <div style={{
              height: '100%', borderRadius: 999,
              width: `${pct}%`,
              background: pct === 100
                ? 'linear-gradient(90deg, #F3CE13, #fff176, #F3CE13)'
                : 'linear-gradient(90deg, rgba(243,206,19,0.9), rgba(255,200,0,1))',
              boxShadow: '0 0 14px rgba(243,206,19,0.50)',
              animation: 'progress-fill 1.2s cubic-bezier(0.4,0,0.2,1) both',
              transition: 'width 0.8s ease',
            }} />
          )}
          {/* Shimmer overlay */}
          <div style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            background: 'linear-gradient(90deg, transparent 30%, rgba(255,255,255,0.12) 50%, transparent 70%)',
            backgroundSize: '200% 100%',
          }} />
        </div>

        {/* Percentage label */}
        {!loading && (
          <div style={{
            marginTop: 6, textAlign: 'right',
            fontSize: '0.58rem', fontWeight: 600,
            color: pct > 0 ? 'rgba(243,206,19,0.60)' : 'rgba(255,255,255,0.20)',
          }}>
            {pct}% collected
          </div>
        )}
      </div>
    </div>
  );
}

function AwardTile({ icon, name, desc, earned, loading }) {
  return (
    <div
      className={earned ? 'award-tile-earned' : ''}
      style={{
        display: 'flex', flexDirection: 'column',
        padding: 'clamp(14px,2vh,20px) clamp(14px,1.8vw,18px)',
        borderRadius: 14,
        // Earned: gold gradient. Locked: HIGH-CONTRAST frosted glass
        background: earned
          ? 'linear-gradient(135deg, rgba(243,206,19,0.12) 0%, rgba(5,5,14,0.88) 100%)'
          : 'linear-gradient(135deg, rgba(180,200,255,0.06) 0%, rgba(80,100,160,0.04) 60%, rgba(20,20,40,0.85) 100%)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: earned
          ? '1px solid rgba(243,206,19,0.32)'
          : '1px solid rgba(140,160,220,0.22)',
        boxShadow: earned
          ? '0 0 24px rgba(243,206,19,0.10), inset 0 1px 0 rgba(243,206,19,0.10)'
          : '0 4px 20px rgba(0,0,0,0.30), inset 0 1px 0 rgba(255,255,255,0.06)',
        opacity: loading ? 0.5 : 1,
        transition: 'all 0.22s ease',
        gap: 12,
      }}
    >
      {/* Icon + status */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{
          width: 46, height: 46, borderRadius: 12,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '1.35rem',
          background: earned
            ? 'rgba(243,206,19,0.12)'
            : 'rgba(140,160,220,0.10)',
          border: earned
            ? '1px solid rgba(243,206,19,0.28)'
            : '1px solid rgba(140,160,220,0.20)',
          boxShadow: earned ? '0 0 16px rgba(243,206,19,0.20)' : 'inset 0 1px 0 rgba(255,255,255,0.07)',
          filter: earned ? 'none' : 'grayscale(0.6) blur(0.5px)',
        }}>
          {earned ? icon : '🔒'}
        </div>

        {earned && !loading && (
          <div style={{
            width: 24, height: 24, borderRadius: '50%',
            background: 'rgba(243,206,19,0.16)',
            border: '1px solid rgba(243,206,19,0.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#F3CE13', fontSize: '0.65rem', fontWeight: 700,
            boxShadow: '0 0 10px rgba(243,206,19,0.30)',
          }}>
            ✓
          </div>
        )}

        {!earned && !loading && (
          <div style={{
            fontSize: '0.55rem', fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '0.1em',
            color: 'rgba(140,160,220,0.55)',
            padding: '3px 7px', borderRadius: 999,
            background: 'rgba(140,160,220,0.08)',
            border: '1px solid rgba(140,160,220,0.15)',
          }}>
            LOCKED
          </div>
        )}
      </div>

      {/* Text */}
      <div>
        <div style={{
          fontSize: 'clamp(0.78rem,1.2vw,0.90rem)', fontWeight: 800, lineHeight: 1.2,
          color: earned ? '#F3CE13' : 'rgba(180,200,255,0.60)',
          marginBottom: 5,
        }}>
          {name}
        </div>
        <div style={{
          fontSize: 'clamp(0.60rem,0.95vw,0.70rem)', lineHeight: 1.45,
          color: earned ? 'rgba(255,255,255,0.40)' : 'rgba(140,160,220,0.38)',
        }}>
          {desc}
        </div>
      </div>

      {/* Locked mystery bar */}
      {!earned && (
        <div style={{
          height: 3, borderRadius: 999,
          background: 'linear-gradient(90deg, rgba(140,160,220,0.08), rgba(140,160,220,0.22), rgba(140,160,220,0.08))',
        }} />
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// GUEST PROMPT — shown on Profile and anywhere session is required
// ══════════════════════════════════════════════════════════════════════════════
function GuestPrompt({ navigate, icon = '🎬', headline, detail }) {
  return (
    <div
      className="animate-fade-in"
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        minHeight: 'calc(100dvh - 8rem)', gap: 24, padding: '2rem 1.5rem',
      }}
    >
      <span style={{ fontSize: '3.5rem', lineHeight: 1 }}>{icon}</span>
      <div style={{ textAlign: 'center' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#fff', marginBottom: 8 }}>{headline}</h2>
        <p style={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.45)', maxWidth: 300 }}>{detail}</p>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', maxWidth: 260 }}>
        <button
          onClick={() => navigate('/auth')}
          className="btn-primary"
        >
          Sign in
        </button>
        <button
          onClick={() => navigate('/auth', { state: { mode: 'signup' } })}
          style={{
            width: '100%', padding: '11px 0', borderRadius: 14,
            border: '1px solid rgba(255,255,255,0.12)',
            background: 'rgba(255,255,255,0.04)',
            color: 'rgba(255,255,255,0.65)', fontSize: '0.85rem', fontWeight: 600,
            cursor: 'pointer', transition: 'border-color 0.2s, background 0.2s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.22)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'; }}
        >
          Create account
        </button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SETTINGS TAB — Director's Console (Dark Mode only)
// ══════════════════════════════════════════════════════════════════════════════
function SettingsTab({ onRefresh }) {
  const { colorblind, setColorblind } = useSettings();
  const { profile, setProfile, signOut, updatePassword } = useAuth();
  const navigate    = useNavigate();
  const [signOutOpen, setSignOutOpen] = useState(false);
  const [refreshing, setRefreshing]   = useState(false);
  const [refreshDone, setRefreshDone] = useState(false);

  async function handleRefreshClick() {
    setRefreshing(true);
    setRefreshDone(false);
    try { await onRefresh?.(); } catch { /* handled upstream */ }
    setRefreshing(false);
    setRefreshDone(true);
    setTimeout(() => setRefreshDone(false), 2500);
  }

  // ── Account: Change Password ─────────────────────────────────────────────
  const [pwOpen,    setPwOpen]    = useState(false);
  const [newPw,     setNewPw]     = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwLoading, setPwLoading] = useState(false);
  const [pwMsg,     setPwMsg]     = useState('');  // '' | 'success' | error string

  async function handleChangePassword() {
    if (newPw.length < 6)         { setPwMsg('Password must be at least 6 characters.'); return; }
    if (newPw !== confirmPw)       { setPwMsg('Passwords do not match.'); return; }
    setPwLoading(true); setPwMsg('');
    try {
      await updatePassword(newPw);
      setPwMsg('success');
      setNewPw(''); setConfirmPw('');
      setTimeout(() => { setPwOpen(false); setPwMsg(''); }, 1800);
    } catch (err) {
      setPwMsg(err.message || 'Could not update password.');
    } finally {
      setPwLoading(false);
    }
  }

  // ── Report Issue ─────────────────────────────────────────────────────────
  const [reportOpen, setReportOpen] = useState(false);

  // ── Delete Account (2-step) ──────────────────────────────────────────────
  const [deleteStep,    setDeleteStep]    = useState(0); // 0=hidden 1=confirm 2=deleting
  const [deleteMsg,     setDeleteMsg]     = useState('');

  async function handleDeleteAccount() {
    setDeleteStep(2);
    setDeleteMsg('');
    try {
      await deleteAccount();
      await signOut();
      navigate('/');
    } catch (err) {
      setDeleteMsg(err?.response?.data?.error || err.message || 'Could not delete account.');
      setDeleteStep(1);
    }
  }

  // ── Account: Change Username ─────────────────────────────────────────────
  const [unOpen,    setUnOpen]    = useState(false);
  const [newUn,     setNewUn]     = useState('');
  const [unLoading, setUnLoading] = useState(false);
  const [unMsg,     setUnMsg]     = useState('');  // '' | 'success' | error string

  async function handleChangeUsername() {
    if (newUn.trim().length < 2) { setUnMsg('Username must be at least 2 characters.'); return; }
    setUnLoading(true); setUnMsg('');
    try {
      const updated = await updateUsername(newUn.trim());
      setProfile(updated);
      setUnMsg('success');
      setNewUn('');
      setTimeout(() => { setUnOpen(false); setUnMsg(''); }, 1800);
    } catch (err) {
      setUnMsg(err?.response?.data?.error || err.message || 'Could not update username.');
    } finally {
      setUnLoading(false);
    }
  }

  return (
    <div
      className="scrollbar-hide"
      style={{ height: '100%', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 'clamp(10px,1.4vh,16px)', paddingBottom: 12 }}
    >
      {/* ── Account ──────────────────────────────────────────────────── */}
      <div style={{
        borderRadius: 14, padding: 'clamp(14px,2vh,20px) clamp(14px,2vw,20px)',
        background: 'rgba(8,8,16,0.82)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: '1px solid rgba(243,206,19,0.18)',
        display: 'flex', flexDirection: 'column', gap: 14,
      }}>
        <div>
          <div style={{ fontSize: 'clamp(0.78rem,1.2vw,0.90rem)', fontWeight: 700, color: '#fff', marginBottom: 3 }}>
            👤 Account
          </div>
          <div style={{ fontSize: '0.60rem', color: 'rgba(255,255,255,0.35)' }}>
            Manage your email, password, and username
          </div>
        </div>

        {/* Email (read-only) */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <div>
            <div style={{ fontSize: '0.68rem', fontWeight: 600, color: 'rgba(255,255,255,0.45)', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Email</div>
            <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#fff' }}>{profile?.email || '—'}</div>
          </div>
        </div>

        {/* Username */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: unOpen ? 10 : 0 }}>
            <div>
              <div style={{ fontSize: '0.68rem', fontWeight: 600, color: 'rgba(255,255,255,0.45)', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Username</div>
              <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#fff' }}>@{profile?.username || '—'}</div>
            </div>
            <button
              onClick={() => { setUnOpen((v) => !v); setUnMsg(''); setNewUn(''); }}
              style={{
                padding: '5px 12px', borderRadius: 8, fontSize: '0.70rem', fontWeight: 700,
                border: '1px solid rgba(243,206,19,0.30)',
                background: 'rgba(243,206,19,0.07)',
                color: 'rgba(243,206,19,0.9)', cursor: 'pointer',
                transition: 'background 0.2s',
              }}
            >
              {unOpen ? 'Cancel' : 'Change'}
            </button>
          </div>
          {unOpen && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <input
                type="text"
                value={newUn}
                onChange={(e) => setNewUn(e.target.value)}
                placeholder={`New username (current: @${profile?.username})`}
                pattern="[a-zA-Z0-9_]+"
                minLength={2}
                maxLength={30}
                className="input-field"
                style={{ fontSize: '0.82rem' }}
                autoFocus
              />
              {unMsg === 'success' ? (
                <div style={{ fontSize: '0.76rem', color: '#4ade80', fontWeight: 700 }}>✓ Username updated!</div>
              ) : unMsg ? (
                <div style={{
                  fontSize: '0.76rem', color: '#f87171', fontWeight: 600,
                  background: 'rgba(248,113,113,0.08)',
                  border: '1px solid rgba(248,113,113,0.20)',
                  borderRadius: 8, padding: '6px 10px',
                }}>
                  ⚠ {unMsg}
                </div>
              ) : null}
              <button
                onClick={handleChangeUsername}
                disabled={unLoading || !newUn.trim()}
                className="btn-primary"
                style={{ fontSize: '0.82rem', padding: '9px 0' }}
              >
                {unLoading ? 'Saving…' : 'Save username'}
              </button>
            </div>
          )}
        </div>

        {/* Password */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: pwOpen ? 10 : 0 }}>
            <div>
              <div style={{ fontSize: '0.68rem', fontWeight: 600, color: 'rgba(255,255,255,0.45)', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Password</div>
              <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'rgba(255,255,255,0.4)' }}>••••••••</div>
            </div>
            <button
              onClick={() => { setPwOpen((v) => !v); setPwMsg(''); setNewPw(''); setConfirmPw(''); }}
              style={{
                padding: '5px 12px', borderRadius: 8, fontSize: '0.70rem', fontWeight: 700,
                border: '1px solid rgba(96,165,250,0.30)',
                background: 'rgba(96,165,250,0.07)',
                color: 'rgba(96,165,250,0.9)', cursor: 'pointer',
                transition: 'background 0.2s',
              }}
            >
              {pwOpen ? 'Cancel' : 'Change'}
            </button>
          </div>
          {pwOpen && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <input
                type="password"
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                placeholder="New password"
                minLength={6}
                className="input-field"
                style={{ fontSize: '0.82rem' }}
                autoFocus
              />
              <input
                type="password"
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
                placeholder="Confirm new password"
                minLength={6}
                className="input-field"
                style={{ fontSize: '0.82rem' }}
              />
              {pwMsg === 'success' ? (
                <div style={{ fontSize: '0.72rem', color: '#4ade80', fontWeight: 600 }}>✓ Password updated!</div>
              ) : pwMsg ? (
                <div style={{ fontSize: '0.72rem', color: '#f87171' }}>{pwMsg}</div>
              ) : null}
              <button
                onClick={handleChangePassword}
                disabled={pwLoading || !newPw || !confirmPw}
                className="btn-primary"
                style={{ fontSize: '0.82rem', padding: '9px 0' }}
              >
                {pwLoading ? 'Updating…' : 'Save password'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Refresh Data ─────────────────────────────────────────────── */}
      <button
        onClick={handleRefreshClick}
        disabled={refreshing}
        style={{
          width: '100%', padding: '11px 0',
          borderRadius: 14, cursor: refreshing ? 'default' : 'pointer',
          border: refreshDone
            ? '1px solid rgba(74,222,128,0.35)'
            : '1px solid rgba(255,255,255,0.10)',
          background: refreshDone
            ? 'rgba(74,222,128,0.07)'
            : 'rgba(255,255,255,0.04)',
          color: refreshDone ? '#4ade80' : 'rgba(209,213,219,0.75)',
          fontSize: '0.82rem', fontWeight: 700,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          transition: 'all 0.2s',
        }}
        onMouseEnter={(e) => { if (!refreshing && !refreshDone) { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.20)'; } }}
        onMouseLeave={(e) => { if (!refreshDone) { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.10)'; } }}
      >
        {refreshing ? (
          <>
            <svg style={{ animation: 'spin 0.8s linear infinite' }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
            Refreshing…
          </>
        ) : refreshDone ? (
          <>✓ Data refreshed</>
        ) : (
          <>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="1 4 1 10 7 10"/><polyline points="23 20 23 14 17 14"/>
              <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4-4.64 4.36A9 9 0 0 1 3.51 15"/>
            </svg>
            Refresh Data
          </>
        )}
      </button>

      {/* ── Report an Issue ──────────────────────────────────────────── */}
      <button
        onClick={() => setReportOpen(true)}
        style={{
          width: '100%', padding: '11px 0',
          borderRadius: 14, cursor: 'pointer',
          border: '1px solid rgba(251,146,60,0.25)',
          background: 'rgba(251,146,60,0.05)',
          color: 'rgba(251,146,60,0.85)',
          fontSize: '0.82rem', fontWeight: 700,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          transition: 'background 0.2s, border-color 0.2s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background  = 'rgba(251,146,60,0.10)';
          e.currentTarget.style.borderColor = 'rgba(251,146,60,0.45)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background  = 'rgba(251,146,60,0.05)';
          e.currentTarget.style.borderColor = 'rgba(251,146,60,0.25)';
        }}
      >
        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        Report an Issue
      </button>

      {/* ── Live Preview Theater ─────────────────────────────────────── */}
      <LivePreviewTheater colorblind={colorblind} />

      {/* ── Colorblind Mode ──────────────────────────────────────────── */}
      <div style={{
        borderRadius: 14, padding: 'clamp(14px,2vh,20px) clamp(14px,2vw,20px)',
        background: 'rgba(8,8,16,0.82)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: '1px solid rgba(96,165,250,0.20)',
        display: 'flex', flexDirection: 'column', gap: 12,
      }}>
        <div>
          <div style={{ fontSize: 'clamp(0.78rem,1.2vw,0.90rem)', fontWeight: 700, color: '#fff', marginBottom: 3 }}>
            🎨 Accessibility
          </div>
          <div style={{ fontSize: '0.60rem', color: 'rgba(255,255,255,0.35)' }}>
            Pattern overlays and shape-coded particles for all viewers
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#fff', marginBottom: 4 }}>
              Colorblind Mode
            </div>
            <div style={{ fontSize: '0.58rem', color: 'rgba(255,255,255,0.35)', lineHeight: 1.5 }}>
              Diagonal stripes (Correct) · Dots (Partial) · Bars (Incorrect)<br />
              Particles: ◯ (0–9) · △ (10+) · ◇ (50+) · + (100+) · ★ (250+)
            </div>
          </div>
          <ToggleSwitch value={colorblind} onChange={setColorblind} />
        </div>
      </div>

      {/* ── Sign Out ─────────────────────────────────────────────────── */}
      <div style={{ marginTop: 'auto', paddingTop: 4 }}>
        <button
          onClick={() => setSignOutOpen(true)}
          style={{
            width: '100%', padding: '13px 0',
            borderRadius: 14, cursor: 'pointer',
            border: '1px solid rgba(239,68,68,0.30)',
            background: 'rgba(239,68,68,0.07)',
            color: '#f87171',
            fontSize: '0.82rem', fontWeight: 700, letterSpacing: '0.04em',
            backdropFilter: 'blur(10px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            transition: 'background 0.2s, border-color 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background  = 'rgba(239,68,68,0.13)';
            e.currentTarget.style.borderColor = 'rgba(239,68,68,0.50)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background  = 'rgba(239,68,68,0.07)';
            e.currentTarget.style.borderColor = 'rgba(239,68,68,0.30)';
          }}
        >
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          Sign Out
        </button>
      </div>

      {/* ── Delete Account (2-step) ──────────────────────────────── */}
      {deleteStep === 0 && (
        <button
          onClick={() => setDeleteStep(1)}
          style={{
            width: '100%', padding: '10px 0',
            borderRadius: 14, cursor: 'pointer',
            border: '1px solid rgba(239,68,68,0.15)',
            background: 'transparent',
            color: 'rgba(239,68,68,0.45)',
            fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.03em',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'rgba(239,68,68,0.35)';
            e.currentTarget.style.color = 'rgba(239,68,68,0.75)';
            e.currentTarget.style.background = 'rgba(239,68,68,0.04)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'rgba(239,68,68,0.15)';
            e.currentTarget.style.color = 'rgba(239,68,68,0.45)';
            e.currentTarget.style.background = 'transparent';
          }}
        >
          Delete Account
        </button>
      )}

      {deleteStep >= 1 && (
        <div style={{
          borderRadius: 14, padding: '16px',
          border: '1px solid rgba(239,68,68,0.35)',
          background: 'rgba(239,68,68,0.06)',
          display: 'flex', flexDirection: 'column', gap: 10,
        }}>
          <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#f87171' }}>
            ⚠ Delete your account?
          </div>
          <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.55)', lineHeight: 1.6 }}>
            This permanently removes your account, all streaks, guesses, and friends. <strong style={{ color: '#f87171' }}>This cannot be undone.</strong>
          </div>
          {deleteMsg && (
            <div style={{ fontSize: '0.72rem', color: '#f87171', background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.20)', borderRadius: 8, padding: '6px 10px' }}>
              {deleteMsg}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => { setDeleteStep(0); setDeleteMsg(''); }}
              disabled={deleteStep === 2}
              style={{
                flex: 1, padding: '9px 0', borderRadius: 10, cursor: 'pointer',
                border: '1px solid rgba(255,255,255,0.12)',
                background: 'rgba(255,255,255,0.05)',
                color: 'rgba(209,213,219,0.8)',
                fontSize: '0.78rem', fontWeight: 600,
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleDeleteAccount}
              disabled={deleteStep === 2}
              style={{
                flex: 1, padding: '9px 0', borderRadius: 10,
                cursor: deleteStep === 2 ? 'default' : 'pointer',
                border: '1px solid rgba(239,68,68,0.50)',
                background: 'rgba(239,68,68,0.18)',
                color: '#f87171',
                fontSize: '0.78rem', fontWeight: 700,
                opacity: deleteStep === 2 ? 0.6 : 1,
              }}
            >
              {deleteStep === 2 ? 'Deleting…' : 'Yes, delete everything'}
            </button>
          </div>
        </div>
      )}

      <SignOutModal
        open={signOutOpen}
        onCancel={() => setSignOutOpen(false)}
        onConfirm={() => { setSignOutOpen(false); signOut().then(() => navigate('/')); }}
      />

      <ReportIssueModal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
      />
    </div>
  );
}

// ── Live Preview Theater ───────────────────────────────────────────────────────
function LivePreviewTheater({ colorblind }) {
  const PREVIEW_TILES = [
    { cls: 'tile tile-green', label: 'MATCH'  },
    { cls: 'tile tile-cyan',  label: '≤2 YR'  },
    { cls: 'tile tile-amber', label: '≤5 YR'  },
    { cls: 'tile tile-red',   label: 'WRONG'  },
  ];

  return (
    <div style={{
      borderRadius: 16, overflow: 'hidden',
      border: '1px solid rgba(243,206,19,0.28)',
      background: 'rgba(6,6,14,0.90)',
      backdropFilter: 'blur(14px)',
    }}>
      {/* Header */}
      <div style={{
        padding: '9px 16px',
        background: 'rgba(243,206,19,0.08)',
        borderBottom: '1px solid rgba(243,206,19,0.13)',
        display: 'flex', alignItems: 'center',
      }}>
        <span style={{
          fontSize: '0.55rem', fontWeight: 700, letterSpacing: '0.15em',
          textTransform: 'uppercase', color: 'rgba(243,206,19,0.72)',
        }}>
          🎬 Live Preview Theater
        </span>
        <span style={{ marginLeft: 'auto', fontSize: '0.50rem', color: 'rgba(128,128,160,0.7)', fontWeight: 500 }}>
          Updates instantly
        </span>
      </div>

      {/* Stage */}
      <div style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 18 }}>
        {/* Sample guess tiles */}
        <div style={{ display: 'flex', gap: 6, flex: 1 }}>
          {PREVIEW_TILES.map(({ cls, label }) => (
            <div key={label} className={cls} style={{ height: 40, flex: 1, fontSize: '0.48rem', borderRadius: 8 }}>
              {label}
            </div>
          ))}
        </div>

        {/* Streak flame preview */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, flexShrink: 0 }}>
          <FlameSVG streak={25} size={38} idKey="settings-prev" showNumber />
          <span style={{ fontSize: '0.46rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.09em', color: 'rgba(255,255,255,0.38)' }}>
            Blaze · 25
          </span>
        </div>
      </div>

      {/* Active indicators row */}
      <div style={{
        padding: '7px 18px 10px',
        display: 'flex', gap: 8, alignItems: 'center',
        borderTop: '1px solid rgba(255,255,255,0.04)',
      }}>
        <div style={{ fontSize: '0.50rem', color: 'rgba(255,255,255,0.28)', fontWeight: 600, marginRight: 4 }}>
          ACTIVE:
        </div>
        <Tag active label="Dark Mode"  color="rgba(100,100,180,0.8)" />
        <Tag active={colorblind} label="Colorblind" color="#60a5fa" />
      </div>
    </div>
  );
}

function Tag({ active, label, color }) {
  return (
    <span style={{
      fontSize: '0.46rem', fontWeight: 700, letterSpacing: '0.09em',
      textTransform: 'uppercase',
      padding: '2px 7px', borderRadius: 999,
      background: active ? `${color}26` : 'rgba(128,128,128,0.07)',
      border: `1px solid ${active ? color : 'rgba(128,128,128,0.14)'}`,
      color: active ? color : 'rgba(128,128,128,0.50)',
    }}>
      {label}
    </span>
  );
}

// ── Toggle switch ──────────────────────────────────────────────────────────────
function ToggleSwitch({ value, onChange }) {
  return (
    <button
      onClick={() => onChange(!value)}
      aria-checked={value}
      role="switch"
      style={{
        width: 48, height: 26, borderRadius: 999, flexShrink: 0,
        background: value ? '#60a5fa' : 'rgba(255,255,255,0.12)',
        border: 'none', cursor: 'pointer', padding: '3px',
        display: 'flex', alignItems: 'center',
        boxShadow: value ? '0 0 14px rgba(96,165,250,0.45)' : 'none',
        transition: 'background 0.25s cubic-bezier(0.16,1,0.3,1), box-shadow 0.25s ease',
      }}
    >
      <div style={{
        width: 20, height: 20, borderRadius: '50%',
        background: '#fff',
        boxShadow: '0 1px 4px rgba(0,0,0,0.30)',
        transform: value ? 'translateX(22px)' : 'translateX(0)',
        transition: 'transform 0.25s cubic-bezier(0.16,1,0.3,1)',
      }} />
    </button>
  );
}
