import { useEffect, useState } from 'react';
import { getLeaderboard } from '../utils/api';

const CATEGORY_TABS = [
  { id: null,           label: 'Global',        emoji: '🌍' },
  { id: 'top250',       label: 'Top 250',        emoji: '🏆' },
  { id: 'superhero',    label: 'Superheroes',    emoji: '🦸' },
  { id: 'animated',     label: 'Animated',       emoji: '🎨' },
  { id: 'indiancinema', label: 'Indian Cinema',  emoji: '🎬' },
];

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
          background:    'linear-gradient(90deg, #c084fc, #F3CE13, #c084fc)',
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
  const [activeTab, setActiveTab] = useState(null); // null = global
  const [rows, setRows]           = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    getLeaderboard(activeTab)
      .then((data) => {
        setRows(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch((err) => {
        setError('Could not load leaderboard. Please try again.');
        setLoading(false);
      });
  }, [activeTab]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page header */}
      <div className="text-center">
        <h1
          className="font-display text-2xl sm:text-3xl font-black text-white tracking-tight"
          style={{ textShadow: '0 0 28px rgba(243,206,19,0.35)' }}
        >
          🏆 Global Standings
        </h1>
        <p className="text-gray-500 text-xs sm:text-sm mt-1">
          Top 50 players ranked by Global Rating
        </p>
      </div>

      {/* Category tabs */}
      <div
        className="flex gap-1 p-1 rounded-xl overflow-x-auto scrollbar-hide"
        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
      >
        {CATEGORY_TABS.map((tab) => (
          <button
            key={String(tab.id)}
            onClick={() => setActiveTab(tab.id)}
            className="flex-shrink-0 flex items-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all"
            style={activeTab === tab.id ? {
              background: 'rgba(243,206,19,0.15)',
              color:      '#F3CE13',
              border:     '1px solid rgba(243,206,19,0.30)',
            } : {
              color:  'rgba(156,163,175,1)',
              border: '1px solid transparent',
            }}
          >
            <span>{tab.emoji}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Column headers */}
      {!loading && !error && rows.length > 0 && (
        <div
          className="grid text-[9px] sm:text-[10px] uppercase tracking-widest font-semibold text-gray-600 px-3 py-1"
          style={{ gridTemplateColumns: '2.5rem 1fr 5rem 5rem 6rem' }}
        >
          <span className="text-center">Rank</span>
          <span>Player</span>
          <span className="text-center">🔥 Streak</span>
          <span className="text-center">Avg Score</span>
          <span className="text-center">Global Rating</span>
        </div>
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
          No players ranked yet — play daily games to appear here!
        </div>
      ) : (
        <div className="space-y-1.5">
          {rows.map((row, idx) => {
            const rank = idx + 1;
            return (
              <div
                key={row.username}
                className="grid items-center gap-2 px-3 py-2.5 rounded-xl transition-all"
                style={{
                  gridTemplateColumns: '2.5rem 1fr 5rem 5rem 6rem',
                  background: rank <= 3
                    ? 'rgba(243,206,19,0.05)'
                    : 'rgba(255,255,255,0.03)',
                  border: rank <= 3
                    ? '1px solid rgba(243,206,19,0.15)'
                    : '1px solid rgba(255,255,255,0.06)',
                }}
              >
                {/* Rank */}
                <div className="flex justify-center">
                  <RankBadge rank={rank} />
                </div>

                {/* Username + badge */}
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="font-semibold text-white text-sm truncate"
                    style={rank === 1 ? { color: '#F3CE13' } : rank <= 3 ? { color: '#e5e7eb' } : {}}
                  >
                    {row.username}
                  </span>
                  {row.status && <StatusBadge status={row.status} />}
                </div>

                {/* Streak */}
                <div className="text-center">
                  <span className="text-sm font-bold text-orange-400">
                    🔥 {row.current_streak ?? 0}
                  </span>
                </div>

                {/* Avg score */}
                <div className="text-center">
                  <span className="text-sm text-gray-300">
                    {row.avg_score != null ? Number(row.avg_score).toFixed(1) : '—'}
                  </span>
                </div>

                {/* Global rating */}
                <div className="text-center">
                  <span
                    className="text-sm font-bold"
                    style={{ color: rank <= 3 ? '#F3CE13' : 'rgba(255,255,255,0.85)' }}
                  >
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
        <p className="text-[10px] text-gray-600 leading-relaxed">
          Global Rating = (Streak × 10) + Avg Score + (No-hint wins in streak × 5)
        </p>
      </div>
    </div>
  );
}
