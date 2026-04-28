import { useState } from 'react';
import { Link, useLocation, useNavigate, useMatch } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { MODES, CATEGORIES } from '../utils/gameLogic';
import RulesModal from './RulesModal';

// ── mode accent colors ────────────────────────────────────────────────────────
const MODE_ACCENT = {
  daily:     { color: '#F3CE13', glow: 'rgba(243,206,19,0.22)', border: 'rgba(243,206,19,0.40)' },
  unlimited: { color: '#a855f7', glow: 'rgba(168,85,247,0.22)', border: 'rgba(168,85,247,0.40)' },
};

// ── category signature colors (mirrors ModeHub exactly) ──────────────────────
const CAT_COLORS = {
  top250:       { color: '#F3CE13', rgb: '243,206,19'  },   // gold
  superhero:    { color: '#DC143C', rgb: '220,20,60'   },   // crimson
  animated:     { color: '#00D2FF', rgb: '0,210,255'   },   // cyan
  indiancinema: { color: '#FF9933', rgb: '255,153,51'  },   // saffron
};

export default function Navbar() {
  const { pathname }               = useLocation();
  const navigate                   = useNavigate();
  const { session, profile }       = useAuth();
  const [rulesOpen, setRulesOpen]  = useState(false);

  const gameMatch      = useMatch('/play/:mode/:category');
  const activeMode     = gameMatch?.params.mode
    || (pathname.startsWith('/unlimited') ? 'unlimited'
      : pathname.startsWith('/daily')     ? 'daily'
      : null);
  const activeCategory = gameMatch?.params.category || null;
  const inGame         = !!gameMatch;

  const toggleMode = activeMode;

  return (
    <>
      {/* ════════════════════════════════════════════════════
          TOP HEADER
      ════════════════════════════════════════════════════ */}
      <header
        className="sticky top-0 z-50 border-b"
        style={{
          background:           'rgba(10,10,15,0.82)',
          backdropFilter:       'blur(24px) saturate(1.4)',
          WebkitBackdropFilter: 'blur(24px) saturate(1.4)',
          borderColor:          'rgba(255,255,255,0.05)',
        }}
      >
        {/* ── Flex row: logo left | toggle abs-centred | icons right ── */}
        <div className="container-game h-16 sm:h-[72px] relative flex items-center justify-between">

          {/* ── Logo ── */}
          <Link to="/" className="flex items-center gap-2 sm:gap-2.5 group flex-none">
            <FilmIcon
              className="w-7 h-7 sm:w-9 sm:h-9 flex-shrink-0 group-hover:scale-110 transition-transform duration-200"
              style={{ color: '#F3CE13' }}
            />
            <span
              className="font-display font-black tracking-tight leading-none select-none text-2xl sm:text-[2.1rem]"
              style={{
                color:      '#fff',
                textShadow: '0 0 32px rgba(243,206,19,0.55), 0 0 12px rgba(243,206,19,0.35), 0 0 4px rgba(243,206,19,0.25)',
              }}
            >
              Cine<span style={{ color: '#F3CE13' }}>GUESS</span>
            </span>
          </Link>

          {/* ── Toggle (center, desktop only) ── */}
          <div className="hidden sm:flex absolute left-1/2 -translate-x-1/2">
            <ModeToggle
              toggleMode={toggleMode}
              activeMode={activeMode}
              inGame={inGame}
              activeCategory={activeCategory}
            />
          </div>

          {/* ── Icons (right) ── */}
          <div className="flex items-center gap-1.5 sm:gap-4 flex-none">
            {/* Rules */}
            <NavIconButton
              as="button"
              onClick={() => setRulesOpen(true)}
              active={rulesOpen}
              label="Rules"
              showLabel
            >
              <RulesIcon />
            </NavIconButton>

            {session ? (
              <>
                {/* Friends */}
                <NavIconButton
                  as={Link}
                  to="/friends"
                  active={pathname === '/friends'}
                  label="Friends"
                  showLabel
                >
                  <FriendsIcon />
                </NavIconButton>

                {/* Profile */}
                <NavIconButton
                  as={Link}
                  to="/profile"
                  active={pathname === '/profile' && !pathname.includes('settings')}
                  label={profile?.username || 'Profile'}
                  showLabel
                >
                  <UserIcon />
                </NavIconButton>

                {/* ── Settings / Director's Console ─────────────────── */}
                <Link
                  to="/profile"
                  state={{ tab: 'settings' }}
                  title="Settings"
                  className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center transition-all duration-200"
                  style={{ color: 'rgba(156,163,175,1)', background: 'transparent' }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color      = '#fff';
                    e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
                    e.currentTarget.style.transform  = 'rotate(30deg)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color      = 'rgba(156,163,175,1)';
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.transform  = 'rotate(0deg)';
                  }}
                >
                  <GearIcon className="w-4 h-4" />
                </Link>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  to="/auth"
                  className="btn-primary text-xs py-1.5 px-4"
                >
                  Sign in
                </Link>
                <Link
                  to="/auth"
                  state={{ mode: 'signup' }}
                  className="text-xs py-1.5 px-3 rounded-xl font-semibold transition-all duration-200"
                  style={{
                    border: '1px solid rgba(255,255,255,0.15)',
                    background: 'rgba(255,255,255,0.05)',
                    color: 'rgba(209,213,219,0.9)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.10)';
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.28)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)';
                  }}
                >
                  <span className="hidden sm:inline">Create account</span>
                  <span className="sm:hidden">Join</span>
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* ── Category strip (in-game only) ─────────────── */}
        {inGame && (
          <div
            className="border-t"
            style={{ borderColor: 'rgba(255,255,255,0.05)' }}
          >
            {/* Glassmorphism container */}
            <div
              style={{
                background:           'rgba(255,255,255,0.025)',
                backdropFilter:       'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
              }}
            >
              <nav className="container-game flex flex-wrap justify-center gap-2 py-2.5">
                {CATEGORIES.map((cat) => (
                  <CategoryPill
                    key={cat.id}
                    cat={cat}
                    isActive={cat.id === activeCategory}
                    to={`/play/${activeMode}/${cat.id}`}
                  />
                ))}
              </nav>
            </div>
          </div>
        )}
      </header>

      {/* ════════════════════════════════════════════════════
          MOBILE BOTTOM TOGGLE (sm and below only)
      ════════════════════════════════════════════════════ */}
      <div
        className="mob-mode-bar sm:hidden fixed bottom-0 left-0 right-0 z-50 px-4 pb-4 pt-2"
        style={{
          background:           'linear-gradient(to top, rgba(10,10,15,0.98) 60%, transparent)',
          backdropFilter:       'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
        }}
      >
        <ModeToggle
          toggleMode={toggleMode}
          activeMode={activeMode}
          inGame={inGame}
          activeCategory={activeCategory}
          fullWidth
        />
      </div>

      {/* ════════════════════════════════════════════════════
          RULES MODAL
      ════════════════════════════════════════════════════ */}
      <RulesModal open={rulesOpen} onClose={() => setRulesOpen(false)} />
    </>
  );
}

// ── Category nav pill ─────────────────────────────────────────────────────────
function CategoryPill({ cat, isActive, to }) {
  const [hovered, setHovered] = useState(false);
  const cfg = CAT_COLORS[cat.id] || { color: '#ffffff', rgb: '255,255,255' };

  // Active pill styles — solid tint bg + full glow border
  const activeBase = {
    background:  `rgba(${cfg.rgb}, 0.12)`,
    border:      `1px solid rgba(${cfg.rgb}, 0.55)`,
    boxShadow:   `0 0 14px rgba(${cfg.rgb}, 0.30), inset 0 0 8px rgba(${cfg.rgb}, 0.08)`,
    color:       '#ffffff',
    fontWeight:  700,
  };

  // Default pill styles — dark, near-invisible border
  const defaultBase = {
    background:  'rgba(255,255,255,0.04)',
    border:      '1px solid rgba(255,255,255,0.10)',
    boxShadow:   'none',
    color:       'rgba(156,163,175,1)',
    fontWeight:  500,
  };

  return (
    <Link
      to={to}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position:       'relative',
        display:        'inline-flex',
        alignItems:     'center',
        gap:            '6px',
        padding:        '5px 13px',
        borderRadius:   '999px',
        fontSize:       '0.75rem',
        whiteSpace:     'nowrap',
        textDecoration: 'none',
        overflow:       'hidden',
        // GPU compositing hint — keeps transforms on their own layer
        willChange:     'transform',
        transform:      (!isActive && hovered) ? 'scale(1.05)' : 'scale(1)',
        transition:     'transform 0.2s ease-in-out, color 0.2s ease-in-out',
        ...(isActive ? activeBase : defaultBase),
      }}
    >
      {/* Hover glow overlay — opacity-only transition, zero repaint */}
      {!isActive && (
        <div
          aria-hidden="true"
          style={{
            position:     'absolute',
            inset:        0,
            borderRadius: '999px',
            background:   `rgba(${cfg.rgb}, 0.08)`,
            border:       `1px solid rgba(${cfg.rgb}, 0.45)`,
            boxShadow:    `0 0 12px rgba(${cfg.rgb}, 0.22), inset 0 0 6px rgba(${cfg.rgb}, 0.06)`,
            opacity:      hovered ? 1 : 0,
            transition:   'opacity 0.2s ease-in-out',
            pointerEvents:'none',
          }}
        />
      )}

      {/* Icon + label — sit above the overlay */}
      <span style={{ position: 'relative', zIndex: 1, fontSize: '0.85rem', lineHeight: 1 }}>
        {cat.emoji}
      </span>
      <span style={{ position: 'relative', zIndex: 1 }}>
        {cat.label}
      </span>
    </Link>
  );
}

// ── Sliding mode toggle ───────────────────────────────────────────────────────
function ModeToggle({ toggleMode, activeMode, inGame, activeCategory, fullWidth = false }) {
  const hasActiveMode = toggleMode === 'daily' || toggleMode === 'unlimited';
  const isUnlimited   = toggleMode === 'unlimited';
  const accent        = MODE_ACCENT[toggleMode] || MODE_ACCENT.daily;

  function toFor(modeId) {
    if (inGame) return `/play/${modeId}/${activeCategory}`;
    return `/${modeId}`;
  }

  const dailyColor     = hasActiveMode && !isUnlimited ? accent.color : 'rgba(255,255,255,0.38)';
  const unlimitedColor = hasActiveMode && isUnlimited  ? MODE_ACCENT.unlimited.color : 'rgba(255,255,255,0.38)';

  return (
    <div
      className={`relative flex rounded-full ${fullWidth ? 'w-full' : 'w-56 sm:w-64'}`}
      style={{
        background: 'rgba(255,255,255,0.05)',
        border:     '1px solid rgba(255,255,255,0.09)',
        padding:    '3px',
      }}
    >
      {/* Sliding pill */}
      {hasActiveMode && (
        <div
          className="absolute inset-[3px] w-1/2 rounded-full"
          style={{
            transform:  isUnlimited ? 'translateX(100%)' : 'translateX(0)',
            transition: 'transform 0.22s cubic-bezier(0.16,1,0.3,1), background 0.22s ease, box-shadow 0.22s ease',
            background: accent.glow,
            border:     `1px solid ${accent.border}`,
            boxShadow:  `0 0 16px ${accent.glow}`,
          }}
        />
      )}

      <Link
        to={toFor('daily')}
        className="relative z-10 flex-1 flex items-center justify-center gap-1.5 py-2 sm:py-2 rounded-full text-xs sm:text-sm font-semibold transition-colors duration-200 select-none hover:opacity-80"
        style={{ color: dailyColor }}
      >
        <CalendarIcon className="w-3.5 h-3.5 flex-shrink-0" />
        <span>Daily</span>
      </Link>

      <Link
        to={toFor('unlimited')}
        className="relative z-10 flex-1 flex items-center justify-center gap-1.5 py-2 sm:py-2 rounded-full text-xs sm:text-sm font-semibold transition-colors duration-200 select-none hover:opacity-80"
        style={{ color: unlimitedColor }}
      >
        <InfinityIcon className="w-3.5 h-3.5 flex-shrink-0" />
        <span>Unlimited</span>
      </Link>
    </div>
  );
}

// ── Nav icon button ───────────────────────────────────────────────────────────
function NavIconButton({ as: Tag = 'button', to, state, active, label, showLabel, onClick, children }) {
  const activeStyle  = { background: 'rgba(255,255,255,0.10)', color: '#fff' };
  const defaultStyle = { background: 'transparent', color: 'rgba(107,114,128,1)' };
  const props        = to ? { to, ...(state ? { state } : {}) } : {};

  return (
    <Tag
      {...props}
      onClick={onClick}
      title={label}
      className="flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 sm:py-2 rounded-xl text-xs font-medium transition-all duration-200"
      style={active ? activeStyle : defaultStyle}
      onMouseEnter={(e) => {
        if (!active) {
          e.currentTarget.style.color      = '#fff';
          e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          e.currentTarget.style.color      = 'rgba(107,114,128,1)';
          e.currentTarget.style.background = 'transparent';
        }
      }}
    >
      <span className="w-4 h-4 flex-shrink-0">{children}</span>
      {showLabel && (
        <span className="hidden md:inline truncate max-w-[80px]">{label}</span>
      )}
    </Tag>
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

function CalendarIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24"
         stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2"/>
      <path d="M16 2v4M8 2v4M3 10h18"/>
    </svg>
  );
}

function InfinityIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24"
         stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 12c-2-2.5-4-4-6-4a4 4 0 000 8c2 0 4-1.5 6-4z"/>
      <path d="M12 12c2 2.5 4 4 6 4a4 4 0 000-8c-2 0-4 1.5-6 4z"/>
    </svg>
  );
}

function FriendsIcon() {
  return (
    <svg fill="none" viewBox="0 0 24 24"
         stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"
         className="w-full h-full">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
    </svg>
  );
}

function UserIcon() {
  return (
    <svg fill="none" viewBox="0 0 24 24"
         stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"
         className="w-full h-full">
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
  );
}

function RulesIcon() {
  return (
    <svg fill="none" viewBox="0 0 24 24"
         stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"
         className="w-full h-full">
      <path d="M4 4.5A2.5 2.5 0 016.5 2H20v18H6.5A2.5 2.5 0 014 17.5v-13z"/>
      <path d="M4 17.5A2.5 2.5 0 016.5 15H20"/>
      <path d="M8 7h8M8 11h5"/>
    </svg>
  );
}

export function GearIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24"
         stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 15a3 3 0 100-6 3 3 0 000 6z"/>
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
    </svg>
  );
}
