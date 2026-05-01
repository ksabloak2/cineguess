import { useEffect, useRef, useState } from 'react';
import { getLeaderboard, getFriends } from '../utils/api';
import { useAuth } from '../context/AuthContext';

const DAILY_TABS = [
  { id: null,           label: 'Global',        emoji: '🌍' },
  { id: 'top250',       label: 'Most Popular',   emoji: '🏆' },
  { id: 'superhero',    label: 'Superheroes',    emoji: '🦸' },
  { id: 'animated',     label: 'Animated',       emoji: '🎨' },
  { id: 'indiancinema', label: 'Indian Cinema',  emoji: '🎬' },
];

const UNLIMITED_TABS = [
  { id: 'unlimited_top250',       label: 'Most Popular',  emoji: '🏆' },
  { id: 'unlimited_superhero',    label: 'Superheroes',   emoji: '🦸' },
  { id: 'unlimited_animated',     label: 'Animated',      emoji: '🎨' },
  { id: 'unlimited_indiancinema', label: 'Indian Cinema', emoji: '🎬' },
];

// Returns the display name for a leaderboard entry.
// Own name → always full.  Friend's name → full.  Stranger → masked.
function resolveDisplayName(username, ownUsername, friendSet) {
  if (!username) return '';
  if (ownUsername && username === ownUsername) return username;
  if (friendSet && friendSet.has(username)) return username;
  // Mask: show first 4 chars + •••  (min 2 chars shown)
  const show = Math.min(4, Math.max(2, Math.floor(username.length * 0.5)));
  return username.slice(0, show) + '•••';
}

// ── Toast shown briefly at bottom of screen on mobile after tapping a name ──
function NameToast({ name, visible }) {
  if (!visible || !name) return null;
  return (
    <div
      className="fixed left-1/2 z-[60] px-5 py-2.5 rounded-full text-sm font-semibold
                 pointer-events-none sm:hidden animate-fade-in"
      style={{
        bottom:    'calc(env(safe-area-inset-bottom, 0px) + 80px)',
        transform: 'translateX(-50%)',
        background: 'rgba(10,10,20,0.95)',
        border:    '1px solid rgba(255,255,255,0.18)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.6)',
        color:     '#fff',
        whiteSpace: 'nowrap',
      }}
    >
      {name}
    </div>
  );
}

function StatusBadge({ status }) {
  if (status === 'cinephile') {
    return (
      <span
        title="Certified Cinephile"
        style={{
          display:       'inline-flex',
          alignItems:    'center',
          gap:           2,
          padding:       '1px 6px',
          borderRadius:  999,
          background:    'linear-gradient(135deg, rgba(168,85,247,0.22), rgba(243,206,19,0.14))',
          border:        '1px solid rgba(192,132,252,0.65)',
          fontSize:      '0.55rem',
          fontWeight:    900,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor:  'transparent',
          flexShrink:    0,
        }}
      >
        🎬
      </span>
    );
  }
  if (status === 'alist') {
    return (
      <span
        title="A-List"
        style={{
          display:       'inline-flex',
          alignItems:    'center',
          gap:           2,
          padding:       '1px 5px',
          borderRadius:  999,
          background:    'linear-gradient(135deg, rgba(243,206,19,0.18), rgba(255,255,255,0.08))',
          border:        '1px solid rgba(243,206,19,0.55)',
          fontSize:      '0.47rem',
          fontWeight:    900,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color:         '#F3CE13',
          flexShrink:    0,
        }}
      >
        ⭐ A-List
      </span>
    );
  }
  return null;
}

function RankBadge({ rank }) {
  if (rank === 1) return <span style={{ fontSize: '1.1rem' }}>🥇</span>;
  if (rank === 2) return <span style={{ fontSize: '1.1rem' }}>🥈</span>;
  if (rank === 3) return <span style={{ fontSize: '1.1rem' }}>🥉</span>;
  return (
    <span style={{
      fontSize:   '0.75rem',
      fontWeight: 700,
      color:      'rgba(156,163,175,0.9)',
      minWidth:   '1.5rem',
      textAlign:  'center',
    }}>
      {rank}
    </span>
  );
}

export default function LeaderboardPage() {
  const { profile, session } = useAuth();
  const ownUsername = profile?.username || null;

  const [leaderMode, setLeaderMode]     = useState('daily');
  const [activeTab, setActiveTab]       = useState(null);
  const [unlimitedTab, setUnlimitedTab] = useState('unlimited_top250');
  const [rows, setRows]                 = useState([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState(null);

  // Friends set — usernames of accepted friends (revealed on the leaderboard)
  const [friendSet, setFriendSet]       = useState(new Set());

  // Mobile toast state
  const [toastName, setToastName]       = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const toastTimer                      = useRef(null);

  // Fetch accepted friends once when the user is logged in
  useEffect(() => {
    if (!session) return;
    getFriends()
      .then((friends) => {
        const names = new Set((friends || []).map((f) => f.username).filter(Boolean));
        setFriendSet(names);
      })
      .catch(() => {}); // silently ignore — leaderboard still works without it
  }, [session]);

  const fetchCategory = leaderMode === 'unlimited' ? unlimitedTab : activeTab;

  useEffect(() => {
    setLoading(true);
    setError(null);
    getLeaderboard(fetchCategory)
      .then((data) => { setRows(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => { setError('Could not load leaderboard. Please try again.'); setLoading(false); });
  }, [fetchCategory]);

  // Show a brief toast with the tapped name (mobile only)
  function showToast(name) {
    clearTimeout(toastTimer.current);
    setToastName(name);
    setToastVisible(true);
    toastTimer.current = setTimeout(() => setToastVisible(false), 2500);
  }

  const isUnlimitedMode = leaderMode === 'unlimited';
  const tabs = isUnlimitedMode ? UNLIMITED_TABS : DAILY_TABS;

  return (
    <div className="space-y-4 animate-fade-in pb-4">
      {/* Page header */}
      <div className="text-center">
        <h1
          className="font-display text-2xl sm:text-3xl font-black text-white tracking-tight"
          style={{ textShadow: '0 0 28px rgba(243,206,19,0.35)' }}
        >
          🏆 Global Standings
        </h1>
        <p className="text-gray-500 text-xs sm:text-sm mt-1">
          Top 10 players ranked by Global Rating
        </p>
      </div>

      {/* Daily / Unlimited leaderboard toggle — top, controls which board you're viewing */}
      <div className="flex justify-center">
        <div
          className="relative flex rounded-full w-56 sm:w-64"
          style={{
            background: 'rgba(255,255,255,0.05)',
            border:     '1px solid rgba(255,255,255,0.09)',
            padding:    '3px',
          }}
        >
          <div
            className="absolute inset-[3px] w-1/2 rounded-full transition-all duration-200"
            style={{
              transform:  leaderMode === 'unlimited' ? 'translateX(100%)' : 'translateX(0)',
              background: leaderMode === 'unlimited' ? 'rgba(168,85,247,0.20)' : 'rgba(243,206,19,0.14)',
              border:     `1px solid ${leaderMode === 'unlimited' ? 'rgba(168,85,247,0.40)' : 'rgba(243,206,19,0.35)'}`,
              boxShadow:  leaderMode === 'unlimited' ? '0 0 16px rgba(168,85,247,0.20)' : '0 0 16px rgba(243,206,19,0.14)',
            }}
          />
          <button
            onClick={() => { setLeaderMode('daily'); setActiveTab(null); }}
            className="relative z-10 flex-1 flex items-center justify-center gap-1.5 py-2 rounded-full text-xs sm:text-sm font-semibold transition-colors duration-200 select-none"
            style={{ color: leaderMode === 'daily' ? '#F3CE13' : 'rgba(255,255,255,0.38)' }}
          >
            <span>📅</span>
            <span>Daily</span>
          </button>
          <button
            onClick={() => setLeaderMode('unlimited')}
            className="relative z-10 flex-1 flex items-center justify-center gap-1.5 py-2 rounded-full text-xs sm:text-sm font-semibold transition-colors duration-200 select-none"
            style={{ color: leaderMode === 'unlimited' ? '#c084fc' : 'rgba(255,255,255,0.38)' }}
          >
            <span>∞</span>
            <span>Unlimited</span>
          </button>
        </div>
      </div>

      {/* Category tabs */}
      <div
        className="flex gap-1 p-1 rounded-xl overflow-x-auto scrollbar-hide"
        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
      >
        {tabs.map((tab) => {
          const isActive = isUnlimitedMode ? unlimitedTab === tab.id : activeTab === tab.id;
          return (
            <button
              key={String(tab.id)}
              onClick={() => isUnlimitedMode ? setUnlimitedTab(tab.id) : setActiveTab(tab.id)}
              className="flex-shrink-0 flex items-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all"
              style={isActive ? {
                background: isUnlimitedMode ? 'rgba(168,85,247,0.15)' : 'rgba(243,206,19,0.15)',
                color:      isUnlimitedMode ? '#c084fc' : '#F3CE13',
                border:     `1px solid ${isUnlimitedMode ? 'rgba(168,85,247,0.30)' : 'rgba(243,206,19,0.30)'}`,
              } : {
                color:  'rgba(156,163,175,1)',
                border: '1px solid transparent',
              }}
            >
              <span>{tab.emoji}</span>
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Column headers */}
      {!loading && !error && rows.length > 0 && (
        isUnlimitedMode ? (
          <div
            className="grid text-[9px] sm:text-[10px] uppercase tracking-widest font-semibold text-gray-600 px-3 py-1"
            style={{ gridTemplateColumns: '2rem 1fr 4.5rem 4.5rem' }}
          >
            <span className="text-center">#</span>
            <span>Player</span>
            <span className="text-center">🔥 Streak</span>
            <span className="text-center">Best</span>
          </div>
        ) : (
          <div
            className="grid text-[9px] sm:text-[10px] uppercase tracking-widest font-semibold text-gray-600 px-3 py-1"
            style={{ gridTemplateColumns: '2rem 1fr 4.5rem 4.5rem 5.5rem' }}
          >
            <span className="text-center">#</span>
            <span>Player</span>
            <span className="text-center">🔥</span>
            <span className="text-center">Avg</span>
            <span className="text-center">Rating</span>
          </div>
        )
      )}

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div className="text-center py-8 text-red-400 text-sm">{error}</div>
      ) : rows.length === 0 ? (
        <div className="text-center py-12 text-gray-500 text-sm">
          No players ranked yet — play {isUnlimitedMode ? 'unlimited' : 'daily'} games to appear here!
        </div>
      ) : (
        <div className="space-y-1.5">
          {rows.map((row, idx) => {
            const rank        = idx + 1;
            const isOwn       = ownUsername && row.username === ownUsername;
            const isFriend    = friendSet.has(row.username);
            const displayName = resolveDisplayName(row.username, ownUsername, friendSet);
            // Full name for toast (own = full, friend = full, stranger = masked — same as display)
            const tapName     = displayName;

            const accentColor = isUnlimitedMode ? '#c084fc' : '#F3CE13';
            const nameColor   = isOwn       ? accentColor
                              : rank === 1  ? accentColor
                              : rank <= 3   ? '#e5e7eb'
                              : 'white';

            return isUnlimitedMode ? (
              <div
                key={row.username}
                className="grid items-center gap-2 px-3 py-2.5 rounded-xl"
                style={{
                  gridTemplateColumns: '2rem 1fr 4.5rem 4.5rem',
                  background: rank <= 3 ? 'rgba(168,85,247,0.06)' : 'rgba(255,255,255,0.03)',
                  border:     rank <= 3 ? '1px solid rgba(168,85,247,0.18)' : '1px solid rgba(255,255,255,0.06)',
                }}
              >
                <div className="flex justify-center">
                  <RankBadge rank={rank} />
                </div>

                {/* Tappable name cell */}
                <button
                  onClick={() => showToast(tapName)}
                  className="flex items-center gap-1.5 min-w-0 text-left"
                  title={displayName}
                >
                  <span
                    className="font-semibold text-sm truncate"
                    style={{ color: nameColor, maxWidth: '100%' }}
                  >
                    {displayName}
                  </span>
                  {isOwn && <span className="text-[9px] opacity-60 flex-shrink-0" style={{ color: accentColor }}>you</span>}
                  {isFriend && !isOwn && <span className="text-[9px] opacity-50 flex-shrink-0 text-green-400">friend</span>}
                  {row.status && <StatusBadge status={row.status} />}
                </button>

                <div className="text-center">
                  <span className="text-sm font-bold text-purple-400">{row.current_streak ?? 0}</span>
                </div>
                <div className="text-center">
                  <span className="text-sm text-gray-400">{row.longest_streak ?? 0}</span>
                </div>
              </div>
            ) : (
              <div
                key={row.username}
                className="grid items-center gap-2 px-3 py-2.5 rounded-xl"
                style={{
                  gridTemplateColumns: '2rem 1fr 4.5rem 4.5rem 5.5rem',
                  background: rank <= 3 ? 'rgba(243,206,19,0.05)' : 'rgba(255,255,255,0.03)',
                  border:     rank <= 3 ? '1px solid rgba(243,206,19,0.15)' : '1px solid rgba(255,255,255,0.06)',
                }}
              >
                <div className="flex justify-center">
                  <RankBadge rank={rank} />
                </div>

                {/* Tappable name cell */}
                <button
                  onClick={() => showToast(tapName)}
                  className="flex items-center gap-1.5 min-w-0 text-left"
                  title={displayName}
                >
                  <span
                    className="font-semibold text-sm truncate"
                    style={{ color: nameColor, maxWidth: '100%' }}
                  >
                    {displayName}
                  </span>
                  {isOwn && <span className="text-[9px] opacity-60 flex-shrink-0" style={{ color: accentColor }}>you</span>}
                  {isFriend && !isOwn && <span className="text-[9px] opacity-50 flex-shrink-0 text-green-400">friend</span>}
                  {row.status && <StatusBadge status={row.status} />}
                </button>

                <div className="text-center">
                  <span className="text-sm font-bold text-orange-400">🔥 {row.current_streak ?? 0}</span>
                </div>
                <div className="text-center">
                  <span className="text-sm text-gray-300">
                    {row.avg_score != null ? Number(row.avg_score).toFixed(1) : '—'}
                  </span>
                </div>
                <div className="text-center">
                  <span className="text-sm font-bold" style={{ color: rank <= 3 ? '#F3CE13' : 'rgba(255,255,255,0.85)' }}>
                    {row.global_rating != null ? Number(row.global_rating).toFixed(0) : '—'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Formula explanation */}
      <div
        className="rounded-xl p-3 text-center"
        style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}
      >
        {isUnlimitedMode ? (
          <p className="text-[10px] text-gray-600 leading-relaxed">
            Unlimited ranking = Current Streak → Best Streak (tiebreaker)
          </p>
        ) : (
          <p className="text-[10px] text-gray-600 leading-relaxed">
            Global Rating = (Streak × 10) + Avg Score + (No-hint wins in streak × 5)
          </p>
        )}
        <p className="text-[9px] text-gray-700 mt-1">
          🔒 Tap a name to reveal · Add friends to see full usernames
        </p>
      </div>

      {/* Mobile name toast */}
      <NameToast name={toastName} visible={toastVisible} />
    </div>
  );
}
