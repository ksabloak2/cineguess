import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  getFriends, getFriendRequests, getSentRequests,
  sendFriendRequest, acceptFriendRequest, declineFriendRequest,
  unfriend, cancelSentRequest, searchUsers, getFriendYearCalendar,
  getFriendPercentiles,
} from '../utils/api';
import { CATEGORIES } from '../utils/gameLogic';
import YearCalendar from '../components/YearCalendar';
import { FlameSVG, getRankBadge, getFlameConfig, FLAME_TIERS } from '../components/FlameIndicator';

const DAILY_CATS = CATEGORIES.filter((c) => c.id !== 'unlimited');
const HAS_NATIVE_SHARE = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

// ── Per-category signature colors ─────────────────────────────────────────────
const CAT_RGB = {
  top250:       '243,206,19',   // gold
  superhero:    '99,102,241',   // indigo
  animated:     '249,115,22',   // orange
  indiancinema: '236,72,153',   // pink
};
const DEFAULT_RGB = '168,85,247'; // purple fallback

// Pick the friend's "favorite" category color (highest streak wins)
function getFavRgb(friend) {
  if (!friend) return DEFAULT_RGB;
  let max = -1, favId = null;
  for (const cat of DAILY_CATS) {
    const s = friend.streaks?.[cat.id] ?? 0;
    if (s > max) { max = s; favId = cat.id; }
  }
  // If no streaks, check who won today
  if (!favId || max === 0) {
    for (const cat of DAILY_CATS) {
      if (friend.today?.[cat.id]?.won) { favId = cat.id; break; }
    }
  }
  return CAT_RGB[favId] || DEFAULT_RGB;
}

function buildInviteUrl(username) {
  const base = typeof window !== 'undefined' ? window.location.origin : 'https://cineguessit.com';
  return username ? `${base}/join?ref=${encodeURIComponent(username)}` : base;
}

// VIP pass left/right notch mask
function vipPassMask() {
  const v = [
    'radial-gradient(circle 9px at 0% 50%, transparent 9px, white 9.5px)',
    'radial-gradient(circle 9px at 100% 50%, transparent 9px, white 9.5px)',
  ].join(', ');
  return {
    maskImage: v,
    maskComposite: 'intersect',
    WebkitMaskImage: v,
    WebkitMaskComposite: 'destination-in',
  };
}

// Generate stable dust particles
function makeDust(count = 20) {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    left:  20 + (i * 37 + 13) % 60,   // 20–80% horizontally (cone spread)
    delay: (i * 0.47) % 5,
    dur:   4 + (i * 0.73) % 4,
    size:  1 + (i % 3),
    opacity: 0.18 + (i % 5) * 0.06,
    depth: i % 3,                       // 0=far, 1=mid, 2=near
  }));
}
const DUST = makeDust(20);

export default function FriendsPage() {
  const { session, profile } = useAuth();
  const navigate = useNavigate();

  const [friends, setFriends]           = useState([]);
  const [requests, setRequests]         = useState([]);
  const [sentRequests, setSentRequests] = useState([]);
  const [searchQ, setSearchQ]           = useState('');
  const [searchRes, setSearchRes]       = useState([]);
  const [addMsg, setAddMsg]             = useState('');
  const [loading, setLoading]           = useState(true);
  const [viewingFriend, setViewingFriend] = useState(null);
  const [linkCopied, setLinkCopied]     = useState(false);
  const [showQR, setShowQR]             = useState(false);
  const [mobileTab, setMobileTab]       = useState('crew'); // 'crew' | 'screen'

  const inviteUrl = buildInviteUrl(profile?.username);

  // Favorite color for the cinema screen — recomputed whenever the viewed friend changes
  const viewedFriendData  = viewingFriend ? friends.find((f) => f.id === viewingFriend.id) : null;
  const favRgb            = getFavRgb(viewedFriendData);

  useEffect(() => {
    if (!session) { setLoading(false); return; }
    Promise.all([getFriends(), getFriendRequests(), getSentRequests()])
      .then(([f, r, s]) => { setFriends(f); setRequests(r); setSentRequests(s); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [session]);

  function handleSearch(e) {
    const q = e.target.value;
    setSearchQ(q);
    // Clear results when the user edits the input — only search on Enter
    setSearchRes([]);
  }

  async function handleSearchSubmit(e) {
    if (e) e.preventDefault();
    const q = searchQ.trim();
    if (q.length < 2) return;
    try { setSearchRes(await searchUsers(q)); } catch {}
  }

  async function handleSendRequest(username) {
    try {
      await sendFriendRequest(username);
      setAddMsg(`Friend request sent to @${username}!`);
      setSearchQ(''); setSearchRes([]);
      getSentRequests().then(setSentRequests).catch(() => {});
    } catch (err) {
      setAddMsg(err?.response?.data?.error || 'Failed to send request');
    }
  }

  async function handleAccept(requesterId) {
    try {
      await acceptFriendRequest(requesterId);
      setRequests((r) => r.filter((req) => req.requester_id !== requesterId));
      setFriends(await getFriends());
    } catch {}
  }

  async function handleDecline(requesterId) {
    try {
      await declineFriendRequest(requesterId);
      setRequests((r) => r.filter((req) => req.requester_id !== requesterId));
    } catch {}
  }

  async function handleCancelSent(receiverId) {
    try {
      await cancelSentRequest(receiverId);
      setSentRequests((s) => s.filter((r) => r.receiver_id !== receiverId));
    } catch {}
  }

  async function handleUnfriend(friendId, username) {
    try {
      await unfriend(friendId);
      setFriends((f) => f.filter((fr) => fr.id !== friendId));
      if (viewingFriend?.id === friendId) setViewingFriend(null);
    } catch {}
  }

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2400);
    } catch {}
  }

  async function handleNativeShare() {
    if (HAS_NATIVE_SHARE) {
      try {
        await navigator.share({ title: 'CineGuess', text: `Join my film crew on CineGuess — the movie guessing game! 🎬`, url: inviteUrl });
        return;
      } catch {}
    }
    handleCopyLink();
  }

  if (!session && !loading) {
    return (
      <div
        className="animate-fade-in"
        style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          minHeight: 'calc(100dvh - 8rem)', gap: 24, padding: '2rem 1.5rem',
        }}
      >
        <span style={{ fontSize: '3.5rem', lineHeight: 1 }}>🎟️</span>
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#fff', marginBottom: 8 }}>Your Film Crew</h2>
          <p style={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.45)', maxWidth: 300 }}>
            Sign in to add friends, compare streaks, and challenge your crew.
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', maxWidth: 260 }}>
          <button onClick={() => navigate('/auth')} className="btn-primary">
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

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div
      className="friends-page-wrap"
      style={{
        height: 'calc(100dvh - 4rem)',
        overflow: 'hidden',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* ── Keyframes ─────────────────────────────────────────────── */}
      <style>{`
        @keyframes dust-rise {
          0%   { transform: translateY(0px) translateX(0px); opacity: 0; }
          15%  { opacity: 1; }
          85%  { opacity: 0.7; }
          100% { transform: translateY(calc(-1 * var(--dp, 80px))) translateX(var(--dx, 8px)); opacity: 0; }
        }
        @keyframes proj-flicker {
          0%,100% { opacity: 0.85; }
          48%     { opacity: 1; }
          50%     { opacity: 0.72; }
          52%     { opacity: 1; }
          80%     { opacity: 0.90; }
        }
        @keyframes proj-inner {
          0%,100% { opacity: 0.55; transform: scaleX(1); }
          50%     { opacity: 0.80; transform: scaleX(1.04); }
        }
        @keyframes reel-spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes reel-pulse {
          0%,100% { opacity: 0.40; filter: drop-shadow(0 0 0px rgba(168,85,247,0)); }
          50%     { opacity: 0.80; filter: drop-shadow(0 0 18px rgba(168,85,247,0.70)); }
        }
        @keyframes screen-glow {
          0%,100% { box-shadow: 0 0 40px rgba(168,85,247,0.06), inset 0 0 60px rgba(0,0,0,0.4); }
          50%     { box-shadow: 0 0 60px rgba(168,85,247,0.10), inset 0 0 60px rgba(0,0,0,0.4); }
        }
        .friends-page-outer { animation: screen-glow 6s ease-in-out infinite; }

        /* Scan-line sweep */
        @keyframes scan-line {
          0%   { top: -3px; opacity: 0; }
          4%   { opacity: 1; }
          96%  { opacity: 0.7; }
          100% { top: 100%; opacity: 0; }
        }
        /* Bottom projector beam pulse */
        @keyframes beam-pulse {
          0%,100% { opacity: 0.55; }
          50%     { opacity: 0.80; }
        }
        /* VIP badge shimmer */
        @keyframes vip-shimmer {
          0%   { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        /* Stamp pop-in */
        @keyframes stamp-in {
          0%   { transform: translateX(-50%) rotate(-22deg) scale(1.6); opacity: 0; }
          60%  { transform: translateX(-50%) rotate(-22deg) scale(0.92); opacity: 1; }
          100% { transform: translateX(-50%) rotate(-22deg) scale(1); opacity: 1; }
        }
        /* Poster shimmer for "Coming Soon" */
        @keyframes coming-soon-pulse {
          0%,100% { opacity: 0.35; }
          50%     { opacity: 0.60; }
        }

        /* ── Mobile tab system (≤ 767px) ─────────────────────────── */
        .friends-mob-tabs { display: none; }

        @media (max-width: 767px) {
          /* Shrink page height to clear the fixed bottom mode-toggle */
          .friends-page-wrap { height: calc(100dvh - 4rem - 68px) !important; }

          /* Show the mobile tab bar */
          .friends-mob-tabs {
            display: flex;
            flex-shrink: 0;
            gap: 6px;
            padding: 4px;
            border-radius: 14px;
            background: rgba(168,85,247,0.05);
            border: 1px solid rgba(168,85,247,0.14);
          }

          /* Tab buttons */
          .mob-tab {
            flex: 1;
            display: flex; align-items: center; justify-content: center;
            gap: 7px;
            padding: 11px 0;
            border-radius: 10px;
            background: transparent;
            border: 1px solid transparent;
            font-size: 0.82rem; font-weight: 700;
            color: rgba(255,255,255,0.30);
            cursor: pointer;
            position: relative;
            transition: all 0.22s cubic-bezier(0.4,0,0.2,1);
          }
          .mob-tab-active {
            color: #c084fc !important;
            background: rgba(168,85,247,0.14) !important;
            border-color: rgba(168,85,247,0.38) !important;
            box-shadow: 0 0 22px rgba(168,85,247,0.22), 0 0 50px rgba(168,85,247,0.08) !important;
          }
          .mob-tab-badge {
            position: absolute; top: 6px; right: 14px;
            min-width: 16px; height: 16px;
            background: #F3CE13; color: #000;
            font-size: 0.55rem; font-weight: 800;
            border-radius: 999px; padding: 0 4px;
            display: flex; align-items: center; justify-content: center;
          }
          .mob-tab-dot {
            position: absolute; top: 8px; right: 16px;
            width: 7px; height: 7px; border-radius: 50%;
            background: #c084fc;
            box-shadow: 0 0 8px rgba(168,85,247,0.80);
          }

          /* Two-col → no gap on mobile */
          .friends-two-col { gap: 0 !important; }

          /* Sidebar: hidden unless crew tab is active */
          .friends-sidebar {
            display: none !important;
          }
          .friends-sidebar.mob-show {
            display: flex !important;
            width: 100% !important;
            min-width: 0 !important;
            flex-shrink: 1 !important;
          }

          /* Cinema screen: hidden unless screen tab is active */
          .friends-screen {
            display: none !important;
          }
          .friends-screen.mob-show {
            display: flex !important;
            width: 100% !important;
            flex: 1 !important;
            min-width: 0 !important;
          }

          /* Bigger avatar + name in FriendDetail on mobile */
          .friend-detail-username {
            font-size: clamp(1.3rem, 6vw, 1.7rem) !important;
          }
          /* Mini-posters: 2×2 on mobile instead of 4×1 */
          .friend-mini-poster-grid {
            grid-template-columns: repeat(2, 1fr) !important;
          }
        }
      `}</style>

      {/* ── Obsidian grid background ──────────────────────────────── */}
      <div
        aria-hidden
        style={{
          position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none',
          backgroundImage: `
            linear-gradient(rgba(168,85,247,0.035) 1px, transparent 1px),
            linear-gradient(90deg, rgba(168,85,247,0.035) 1px, transparent 1px)
          `,
          backgroundSize: '44px 44px',
        }}
      />

      {/* ── Purple projector spotlight ─────────────────────────── */}
      <div
        aria-hidden
        style={{
          position: 'absolute', top: '-40px', left: '50%',
          transform: 'translateX(-50%)',
          width: '680px', height: '520px',
          background: 'radial-gradient(ellipse 340px 260px at 50% 0%, rgba(120,60,220,0.12) 0%, transparent 70%)',
          animation: 'proj-flicker 8s ease-in-out infinite',
          pointerEvents: 'none', zIndex: 0,
        }}
      />
      <div
        aria-hidden
        style={{
          position: 'absolute', top: '-30px', left: '50%',
          transform: 'translateX(-50%)',
          width: '320px', height: '400px',
          background: 'radial-gradient(ellipse 160px 200px at 50% 0%, rgba(180,100,255,0.16) 0%, transparent 65%)',
          animation: 'proj-inner 5s ease-in-out infinite',
          pointerEvents: 'none', zIndex: 0,
        }}
      />

      {/* ── Dust particles ────────────────────────────────────────── */}
      <div
        aria-hidden
        style={{
          position: 'absolute', top: '0', left: '50%', transform: 'translateX(-50%)',
          width: '680px', height: '440px',
          clipPath: 'polygon(22% 100%, 78% 100%, 100% 0%, 0% 0%)',
          pointerEvents: 'none', zIndex: 1,
        }}
      >
        {DUST.map((d) => (
          <div
            key={d.id}
            style={{
              position: 'absolute',
              bottom: 0,
              left: `${d.left}%`,
              width: `${d.size}px`,
              height: `${d.size}px`,
              borderRadius: '50%',
              background: `rgba(${200 - d.depth * 20}, ${170 - d.depth * 10}, 255, ${d.opacity})`,
              '--dp': `${60 + d.depth * 30}px`,
              '--dx': `${(d.id % 2 === 0 ? 1 : -1) * (4 + d.depth * 6)}px`,
              animation: `dust-rise ${d.dur}s ${d.delay}s ease-in infinite`,
            }}
          />
        ))}
      </div>

      {/* ════════════════════════════════════════════════════════════
          PAGE CONTENT
      ════════════════════════════════════════════════════════════ */}
      <div
        style={{
          position: 'relative', zIndex: 10,
          display: 'flex', flexDirection: 'column',
          height: '100%',
          padding: 'clamp(10px,1.4vh,18px) clamp(12px,2vw,24px)',
          gap: 'clamp(8px,1.2vh,14px)',
        }}
      >
        {/* ── Page header ─────────────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
          <div
            style={{
              width: 36, height: 36, borderRadius: 10, flexShrink: 0,
              background: 'rgba(168,85,247,0.14)',
              border: '1px solid rgba(168,85,247,0.28)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <FilmCrewIcon />
          </div>
          <div>
            <h1
              className="font-display font-black leading-none"
              style={{ fontSize: 'clamp(1.1rem,2.2vw,1.5rem)', color: '#fff' }}
            >
              Film Crew
            </h1>
            <p style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.35)', marginTop: 1 }}>
              Your cinema companions
            </p>
          </div>
        </div>

        {/* ── Mobile tab bar (hidden on sm+) ──────────────────────── */}
        <div className="friends-mob-tabs">
          <button
            className={`mob-tab${mobileTab === 'crew' ? ' mob-tab-active' : ''}`}
            onClick={() => setMobileTab('crew')}
          >
            <FilmCrewIcon />
            <span>Film Crew</span>
            {(requests.length + sentRequests.length) > 0 && (
              <span className="mob-tab-badge">{requests.length + sentRequests.length}</span>
            )}
          </button>
          <button
            className={`mob-tab${mobileTab === 'screen' ? ' mob-tab-active' : ''}`}
            onClick={() => setMobileTab('screen')}
          >
            <span style={{ fontSize: '0.9rem' }}>📽</span>
            <span>On Screen</span>
            {viewingFriend && <span className="mob-tab-dot" />}
          </button>
        </div>

        {/* ── Two-column layout ────────────────────────────────────── */}
        <div
          className="friends-two-col"
          style={{
            flex: 1, minHeight: 0,
            display: 'flex',
            gap: 'clamp(10px,1.4vw,18px)',
            alignItems: 'stretch',
          }}
        >
          {/* ── LEFT SIDEBAR ─────────────────────────────────────── */}
          <div
            className={`friends-sidebar scrollbar-hide${mobileTab === 'crew' ? ' mob-show' : ''}`}
            style={{
              width: 'clamp(220px,24vw,290px)',
              flexShrink: 0,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              paddingBottom: 8,
            }}
          >
            {/* Add a friend pane */}
            <GlassPane borderColor="rgba(168,85,247,0.18)">
              <PaneLabel>Add a friend</PaneLabel>
              <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: 6 }}>
                <input
                  type="text"
                  value={searchQ}
                  onChange={handleSearch}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearchSubmit()}
                  placeholder="Enter exact username…"
                  className="input-field"
                  style={{ fontSize: '0.75rem', flex: 1 }}
                />
                <button
                  type="submit"
                  style={{
                    padding: '0 14px', borderRadius: 10, flexShrink: 0,
                    background: 'rgba(168,85,247,0.15)',
                    border: '1px solid rgba(168,85,247,0.35)',
                    color: 'rgba(168,85,247,0.9)',
                    fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer',
                    transition: 'background 0.18s',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(168,85,247,0.28)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(168,85,247,0.15)'}
                >
                  Search
                </button>
              </form>
              {addMsg && (
                <p
                  style={{
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    color: addMsg.includes('sent') ? '#4ade80' : '#f87171',
                  }}
                >
                  {addMsg}
                </p>
              )}
              {searchRes.length > 0 && (
                <ul style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {searchRes.map((u) => {
                    const alreadySent = sentRequests.some((r) => r.username === u.username);
                    const alreadyFriend = friends.some((f) => f.username === u.username);
                    return (
                      <li
                        key={u.id}
                        onClick={() => !alreadySent && !alreadyFriend && handleSendRequest(u.username)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => e.key === 'Enter' && !alreadySent && !alreadyFriend && handleSendRequest(u.username)}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '8px 10px', borderRadius: 10,
                          background: 'rgba(168,85,247,0.05)',
                          border: '1px solid rgba(168,85,247,0.14)',
                          cursor: alreadySent || alreadyFriend ? 'default' : 'pointer',
                          transition: 'background 0.18s, border-color 0.18s',
                        }}
                        onMouseEnter={(e) => { if (!alreadySent && !alreadyFriend) e.currentTarget.style.background = 'rgba(168,85,247,0.12)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(168,85,247,0.05)'; }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <AvatarCircle letter={u.username[0]} size={28} />
                          <div>
                            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#fff' }}>@{u.username}</div>
                            {alreadyFriend && <div style={{ fontSize: '0.58rem', color: 'rgba(74,222,128,0.8)' }}>Already friends</div>}
                            {alreadySent  && <div style={{ fontSize: '0.58rem', color: 'rgba(243,206,19,0.8)' }}>Request sent</div>}
                          </div>
                        </div>
                        {!alreadyFriend && !alreadySent && (
                          <div style={{
                            fontSize: '0.62rem', fontWeight: 700,
                            color: 'rgba(168,85,247,0.9)',
                            padding: '3px 8px', borderRadius: 6,
                            border: '1px solid rgba(168,85,247,0.35)',
                            background: 'rgba(168,85,247,0.10)',
                          }}>
                            + Add
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </GlassPane>

            {/* Invite card */}
            <InviteCard
              inviteUrl={inviteUrl}
              linkCopied={linkCopied}
              onCopy={handleCopyLink}
              onShare={handleNativeShare}
              showQR={showQR}
              onToggleQR={() => setShowQR((v) => !v)}
            />

            {/* Pending sent */}
            {sentRequests.length > 0 && (
              <GlassPane borderColor="rgba(168,85,247,0.14)">
                <PaneLabel icon={<PendingSendIcon />} badge={sentRequests.length}>
                  Pending invites
                </PaneLabel>
                <ul style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  {sentRequests.map((req) => (
                    <li key={req.receiver_id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <AvatarCircle letter={req.username[0]} size={26} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '0.75rem', color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          @{req.username}
                        </div>
                        <div style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.25)' }}>Awaiting response</div>
                      </div>
                      <button
                        onClick={() => handleCancelSent(req.receiver_id)}
                        title="Cancel"
                        style={{
                          width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: 'transparent', border: '1px solid rgba(255,255,255,0.08)',
                          color: 'rgba(255,255,255,0.35)', fontSize: '0.65rem', cursor: 'pointer',
                          transition: 'all 0.18s',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.color = '#f87171'; e.currentTarget.style.borderColor = 'rgba(248,113,113,0.3)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.35)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; }}
                      >
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>
              </GlassPane>
            )}

            {/* Incoming requests */}
            {requests.length > 0 && (
              <GlassPane borderColor="rgba(243,206,19,0.22)">
                <PaneLabel badgeGold badge={requests.length}>
                  Requests
                </PaneLabel>
                <ul style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  {requests.map((req) => (
                    <li key={req.requester_id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <AvatarCircle letter={req.username[0]} size={26} />
                      <span style={{ flex: 1, minWidth: 0, fontSize: '0.75rem', color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        @{req.username}
                      </span>
                      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                        <button onClick={() => handleAccept(req.requester_id)} className="btn-primary" style={{ fontSize: '0.62rem', padding: '3px 7px' }}>✓</button>
                        <button onClick={() => handleDecline(req.requester_id)} className="btn-secondary" style={{ fontSize: '0.62rem', padding: '3px 7px' }}>✕</button>
                      </div>
                    </li>
                  ))}
                </ul>
              </GlassPane>
            )}

            {/* VIP friend list — scrolls independently, top sections stay pinned */}
            <div style={{
              flex: 1, minHeight: 0,
              display: 'flex', flexDirection: 'column', gap: 8,
            }}>
              <div style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.28)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700, padding: '2px 2px 0', flexShrink: 0 }}>
                Film Crew · {friends.length}
              </div>

            {friends.length === 0 ? (
              <GlassPane>
                <div style={{ textAlign: 'center', padding: '10px 0' }}>
                  <div style={{ fontSize: '1.6rem', marginBottom: 6 }}>🎬</div>
                  <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.35)' }}>No friends yet</div>
                  <div style={{ fontSize: '0.66rem', color: 'rgba(255,255,255,0.2)', marginTop: 3 }}>Search above and send a request!</div>
                </div>
              </GlassPane>
            ) : (
              <div className="scrollbar-hide" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[...friends].sort((a, b) => a.username.localeCompare(b.username)).map((friend) => {
                  const isSelected = viewingFriend?.id === friend.id;
                  return (
                    <button
                      key={friend.id}
                      onClick={() => {
                        if (isSelected) {
                          setViewingFriend(null);
                        } else {
                          setViewingFriend({ id: friend.id, username: friend.username });
                          setMobileTab('screen'); // auto-switch on mobile
                        }
                      }}
                      style={{
                        width: '100%', cursor: 'pointer', textAlign: 'left',
                        background: isSelected
                          ? 'linear-gradient(135deg, rgba(243,206,19,0.10) 0%, rgba(5,5,15,0.85) 100%)'
                          : 'rgba(255,255,255,0.04)',
                        border: isSelected
                          ? '1px solid rgba(243,206,19,0.50)'
                          : '1px solid rgba(255,255,255,0.07)',
                        boxShadow: isSelected
                          ? '0 0 20px rgba(243,206,19,0.20), 0 0 40px rgba(243,206,19,0.08)'
                          : 'none',
                        borderRadius: 10,
                        padding: '9px 14px',
                        transition: 'all 0.22s ease',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        ...vipPassMask(),
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.borderColor = 'rgba(243,206,19,0.20)';
                          e.currentTarget.style.background = 'rgba(255,255,255,0.07)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)';
                          e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                        }
                      }}
                    >
                      <AvatarCircle
                        letter={friend.username[0]}
                        size={32}
                        gold={isSelected}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: '0.78rem', fontWeight: 600,
                            color: isSelected ? '#F3CE13' : '#fff',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}
                        >
                          @{friend.username}
                        </div>
                        <TodayDots today={friend.today} />
                      </div>
                      <span style={{ fontSize: '0.62rem', color: isSelected ? 'rgba(243,206,19,0.50)' : 'rgba(255,255,255,0.20)', flexShrink: 0 }}>
                        {isSelected ? '◆' : '›'}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
            </div>{/* end Film Crew scroll container */}
          </div>

          {/* ── RIGHT: Cinema Screen ─────────────────────────────── */}
          <div
            className={`friends-screen${mobileTab === 'screen' ? ' mob-show' : ''}`}
            style={{
              flex: 1, minWidth: 0,
              background: 'rgba(4,4,12,0.88)',
              backdropFilter: 'blur(20px) brightness(0.72)',
              WebkitBackdropFilter: 'blur(20px) brightness(0.72)',
              border: viewingFriend
                ? `1px solid rgba(${favRgb},0.38)`
                : '1px solid rgba(168,85,247,0.15)',
              borderRadius: 18,
              position: 'relative',
              overflow: 'hidden',
              transition: 'border-color 0.5s ease, box-shadow 0.5s ease',
              display: 'flex',
              flexDirection: 'column',
              // Thick outer glow that uses the friend's favorite color
              boxShadow: viewingFriend
                ? `0 0 0 1px rgba(${favRgb},0.10),
                   0 0 40px rgba(${favRgb},0.14),
                   0 0 90px rgba(${favRgb},0.07),
                   inset 0 0 80px rgba(0,0,0,0.55),
                   inset 0 0 24px rgba(0,0,0,0.35)`
                : `0 0 40px rgba(168,85,247,0.06),
                   inset 0 0 60px rgba(0,0,0,0.40)`,
            }}
          >
            {/* ── Top accent bar (dynamic color) */}
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0, height: 2, zIndex: 6,
              background: viewingFriend
                ? `linear-gradient(90deg, transparent, rgba(${favRgb},0.70) 35%, rgba(${favRgb},0.70) 65%, transparent)`
                : 'linear-gradient(90deg, transparent, rgba(168,85,247,0.40) 40%, rgba(168,85,247,0.40) 60%, transparent)',
              transition: 'background 0.5s ease',
            }} />

            {/* ── Screen bezel — darkens edges to simulate concave curve */}
            <div aria-hidden style={{
              position: 'absolute', inset: 0, zIndex: 5, pointerEvents: 'none',
              borderRadius: 18,
              boxShadow: 'inset 0 0 55px rgba(0,0,0,0.60), inset 0 0 18px rgba(0,0,0,0.40)',
            }} />

            {/* ── Bottom-up projector beam (visible when friend is selected) */}
            {viewingFriend && (
              <div aria-hidden style={{
                position: 'absolute', bottom: 0, left: '50%',
                transform: 'translateX(-50%)',
                width: '75%', height: '65%',
                background: `radial-gradient(ellipse 50% 100% at 50% 100%, rgba(${favRgb},0.13) 0%, rgba(${favRgb},0.05) 40%, transparent 70%)`,
                pointerEvents: 'none', zIndex: 1,
                animation: 'beam-pulse 5s ease-in-out infinite',
              }} />
            )}

            {/* ── Corner brackets */}
            <CornerBracket pos="tl" rgb={viewingFriend ? favRgb : '168,85,247'} />
            <CornerBracket pos="tr" rgb={viewingFriend ? favRgb : '168,85,247'} />
            <CornerBracket pos="bl" rgb={viewingFriend ? favRgb : '168,85,247'} />
            <CornerBracket pos="br" rgb={viewingFriend ? favRgb : '168,85,247'} />

            {/* ── Scan line (active projection effect) */}
            {viewingFriend && (
              <div aria-hidden style={{
                position: 'absolute', left: 0, right: 0, height: 2, zIndex: 5,
                background: `linear-gradient(90deg, transparent 0%, rgba(${favRgb},0.06) 20%, rgba(255,255,255,0.12) 50%, rgba(${favRgb},0.06) 80%, transparent 100%)`,
                animation: 'scan-line 9s linear infinite',
                pointerEvents: 'none',
              }} />
            )}

            {/* ── Scrollable interior */}
            <div
              style={{
                flex: 1, minHeight: 0,
                overflowY: 'auto',
                padding: 'clamp(14px,2vh,24px) clamp(14px,2.2vw,28px)',
                position: 'relative', zIndex: 6,
              }}
              className="scrollbar-hide"
            >
              {viewingFriend ? (
                <FriendDetail
                  friend={viewedFriendData}
                  viewingFriend={viewingFriend}
                  favRgb={favRgb}
                  onUnfriend={handleUnfriend}
                  onClose={() => { setViewingFriend(null); setMobileTab('crew'); }}
                />
              ) : (
                <EmptyDetail />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── "Link Copied!" toast ────────────────────────────────── */}
      {linkCopied && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 pointer-events-none animate-slide-up">
          <div
            className="flex items-center gap-2 rounded-full py-2.5 px-5 text-sm font-medium text-white"
            style={{
              background:           'rgba(12,12,20,0.95)',
              backdropFilter:       'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border:               '1px solid rgba(34,197,94,0.35)',
              boxShadow:            '0 8px 32px rgba(0,0,0,0.5), 0 0 16px rgba(34,197,94,0.15)',
            }}
          >
            <svg className="w-4 h-4 text-green-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
            Link Copied!
          </div>
        </div>
      )}

      {/* ── QR modal ────────────────────────────────────────────── */}
      {showQR && <QRModal inviteUrl={inviteUrl} onClose={() => setShowQR(false)} />}
    </div>
  );
}

/* ── Helper UI ─────────────────────────────────────────────────────────────── */

function GlassPane({ children, borderColor = 'rgba(255,255,255,0.07)' }) {
  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.035)',
        backdropFilter: 'blur(15px)',
        WebkitBackdropFilter: 'blur(15px)',
        border: `1px solid ${borderColor}`,
        borderRadius: 12,
        padding: '12px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      {children}
    </div>
  );
}

function PaneLabel({ children, icon, badge, badgeGold }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      {icon && <span style={{ color: 'rgba(255,255,255,0.28)', display: 'flex' }}>{icon}</span>}
      <span style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.09em', color: 'rgba(255,255,255,0.35)' }}>
        {children}
      </span>
      {badge !== undefined && (
        <span
          style={{
            marginLeft: 'auto',
            background: badgeGold ? '#F3CE13' : 'rgba(255,255,255,0.12)',
            color: badgeGold ? '#000' : 'rgba(255,255,255,0.6)',
            fontSize: '0.6rem', fontWeight: 700,
            padding: '1px 6px', borderRadius: 999,
          }}
        >
          {badge}
        </span>
      )}
    </div>
  );
}

function AvatarCircle({ letter, size = 32, gold = false }) {
  return (
    <div
      style={{
        width: size, height: size, borderRadius: '50%', flexShrink: 0,
        background: gold ? 'rgba(243,206,19,0.14)' : 'rgba(255,255,255,0.07)',
        border: gold ? '1px solid rgba(243,206,19,0.40)' : '1px solid rgba(255,255,255,0.10)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: size * 0.38, fontWeight: 700,
        color: gold ? '#F3CE13' : 'rgba(255,255,255,0.55)',
      }}
    >
      {letter.toUpperCase()}
    </div>
  );
}

function CornerBracket({ pos, rgb }) {
  const color = `rgba(${rgb},0.45)`;
  const size = 16, thickness = 2, offset = 9;
  const style = {
    position: 'absolute', zIndex: 3, width: size, height: size,
    transition: 'border-color 0.45s ease',
    ...(pos === 'tl' && { top: offset, left: offset, borderTop: `${thickness}px solid ${color}`, borderLeft: `${thickness}px solid ${color}` }),
    ...(pos === 'tr' && { top: offset, right: offset, borderTop: `${thickness}px solid ${color}`, borderRight: `${thickness}px solid ${color}` }),
    ...(pos === 'bl' && { bottom: offset, left: offset, borderBottom: `${thickness}px solid ${color}`, borderLeft: `${thickness}px solid ${color}` }),
    ...(pos === 'br' && { bottom: offset, right: offset, borderBottom: `${thickness}px solid ${color}`, borderRight: `${thickness}px solid ${color}` }),
  };
  return <div style={style} />;
}

/* ── EmptyDetail ────────────────────────────────────────────────────────────── */
function EmptyDetail() {
  return (
    <div
      style={{
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        minHeight: 280, textAlign: 'center', gap: 14,
      }}
    >
      <div style={{ animation: 'reel-pulse 2.8s ease-in-out infinite' }}>
        <FilmReelIcon size={72} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center' }}>
        <span
          style={{
            fontSize: '0.6rem', fontWeight: 700,
            letterSpacing: '0.18em', textTransform: 'uppercase',
            color: 'rgba(168,85,247,0.65)',
          }}
        >
          NOW SHOWING
        </span>
        <p style={{ fontSize: '0.9rem', fontWeight: 600, color: 'rgba(255,255,255,0.50)' }}>
          Select a crew member
        </p>
        <p style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.22)' }}>
          Their stats will appear on the big screen
        </p>
      </div>
    </div>
  );
}

// ── Category display metadata for the standings section ─────────────────────
const CAT_META = {
  top250:                 { emoji: '🏆', label: 'Most Popular' },
  superhero:              { emoji: '🦸', label: 'Superhero' },
  animated:               { emoji: '✨', label: 'Animated' },
  indiancinema:           { emoji: '🎭', label: 'Indian Cinema' },
  unlimited_top250:       { emoji: '♾️', label: 'Unlimited Most Popular' },
  unlimited_superhero:    { emoji: '♾️', label: 'Unlimited Superhero' },
  unlimited_animated:     { emoji: '♾️', label: 'Unlimited Animated' },
  unlimited_indiancinema: { emoji: '♾️', label: 'Unlimited Indian' },
};

/* ── FriendFlameCollection ───────────────────────────────────────────────────── */
const FRIEND_COLLECTION_TIERS = [...FLAME_TIERS].reverse().map((t) => ({
  ...t,
  label:     t.name.charAt(0).toUpperCase() + t.name.slice(1),
  milestone: t.min === 0 ? 1 : t.min,
}));

function FriendFlameCollection({ friend, rgb }) {
  const bestStreaks = friend?.bestStreaks || {};
  const maxBest = Math.max(0, ...Object.values(bestStreaks).map((v) => Number(v) || 0));

  return (
    <div style={{
      marginTop: 10,
      display: 'grid',
      gridTemplateColumns: 'repeat(7, 1fr)',
      gap: 6,
    }}>
      {FRIEND_COLLECTION_TIERS.map((tier) => {
        const unlocked = maxBest >= tier.milestone;
        return (
          <div key={tier.name} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
            <div style={{
              filter: unlocked ? 'none' : 'grayscale(1) brightness(0.30)',
              transition: 'filter 0.3s',
              position: 'relative',
            }}>
              <FlameSVG streak={tier.milestone} size={32} idKey={`fr-${tier.name}`} />
              {!unlocked && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem' }}>🔒</div>
              )}
            </div>
            <div style={{ fontSize: '0.46rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'center', color: unlocked ? `rgba(${rgb},0.85)` : 'rgba(255,255,255,0.20)' }}>
              {tier.label}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── FriendDetail — cinematic "Now Showing" screen ─────────────────────────── */
function FriendDetail({ friend, viewingFriend, favRgb, onUnfriend, onClose }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [percentiles, setPercentiles]     = useState(null);

  useEffect(() => {
    if (!friend?.id) return;
    setPercentiles(null);
    getFriendPercentiles(friend.id)
      .then(setPercentiles)
      .catch(() => setPercentiles({}));
  }, [friend?.id]);

  if (!friend) return null;

  // Find the best (lowest-number) percentile across all categories
  const activePercentiles = percentiles
    ? Object.entries(percentiles)
        .filter(([, v]) => v !== null)
        .map(([cat, v]) => ({ cat, label: v.label, pct: v.pct }))
        .sort((a, b) => a.pct - b.pct)
    : [];

  const accentHex = rgbToApproxHex(favRgb);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(12px,2vh,20px)', position: 'relative' }}>

      {/* ════ FEATURED GUEST HEADER ════ */}
      <div style={{ position: 'relative' }}>
        {/* Subtle bottom-of-header spotlight hitting the name */}
        <div aria-hidden style={{
          position: 'absolute', bottom: -20, left: '50%',
          transform: 'translateX(-50%)',
          width: '80%', height: 60,
          background: `radial-gradient(ellipse 55% 100% at 50% 100%, rgba(${favRgb},0.18) 0%, transparent 80%)`,
          pointerEvents: 'none',
        }} />

        {/* ── Action buttons — absolutely anchored top-right so they never scroll off ── */}
        <div style={{
          position: 'absolute', top: 0, right: 0,
          display: 'flex', alignItems: 'center', gap: 6, zIndex: 2,
        }}>
          {confirmDelete ? (
            /* ── Step 2: confirm strip ── */
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'rgba(10,4,4,0.92)',
              border: '1px solid rgba(248,113,113,0.35)',
              borderRadius: 10, padding: '5px 8px',
              backdropFilter: 'blur(12px)',
            }}>
              <span style={{ fontSize: '0.65rem', color: 'rgba(248,113,113,0.85)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                Remove?
              </span>
              <button
                onClick={() => { setConfirmDelete(false); onUnfriend(friend.id, friend.username); }}
                style={{
                  padding: '3px 9px', borderRadius: 6, fontSize: '0.62rem', fontWeight: 700,
                  background: 'rgba(248,113,113,0.18)', border: '1px solid rgba(248,113,113,0.45)',
                  color: '#f87171', cursor: 'pointer', whiteSpace: 'nowrap',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(248,113,113,0.30)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(248,113,113,0.18)'; }}
              >
                Yes
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                style={{
                  padding: '3px 7px', borderRadius: 6, fontSize: '0.62rem', fontWeight: 600,
                  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)',
                  color: 'rgba(255,255,255,0.45)', cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; e.currentTarget.style.color = '#fff'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = 'rgba(255,255,255,0.45)'; }}
              >
                Cancel
              </button>
            </div>
          ) : (
            /* ── Step 1: trash icon ── */
            <button
              onClick={() => setConfirmDelete(true)}
              title={`Remove @${friend.username}`}
              style={{
                width: 30, height: 30, borderRadius: 8, cursor: 'pointer',
                background: 'rgba(248,113,113,0.06)',
                border: '1px solid rgba(248,113,113,0.16)',
                color: 'rgba(248,113,113,0.50)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.18s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#f87171'; e.currentTarget.style.background = 'rgba(248,113,113,0.14)'; e.currentTarget.style.borderColor = 'rgba(248,113,113,0.35)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(248,113,113,0.50)'; e.currentTarget.style.background = 'rgba(248,113,113,0.06)'; e.currentTarget.style.borderColor = 'rgba(248,113,113,0.16)'; }}
            >
              <TrashIcon />
            </button>
          )}

          {/* Close × — always visible */}
          <button
            onClick={onClose}
            title="Close"
            style={{
              width: 30, height: 30, borderRadius: 8, cursor: 'pointer',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.10)',
              color: 'rgba(255,255,255,0.40)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1rem', transition: 'all 0.18s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.40)'; e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
          >
            ×
          </button>
        </div>

        {/* Name/badge block — padded right so it never underlaps buttons */}
        <div style={{ paddingRight: 76 }}>
          {/* Eyebrow */}
          <div style={{
            fontSize: '0.58rem', fontWeight: 700, letterSpacing: '0.20em',
            textTransform: 'uppercase', marginBottom: 8,
            color: `rgba(${favRgb},0.70)`,
          }}>
            ◆ NOW SHOWING
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            {/* Avatar — large, glowing ring in fav color */}
            <div style={{
              width: 56, height: 56, borderRadius: '50%', flexShrink: 0,
              background: `rgba(${favRgb},0.12)`,
              border: `2px solid rgba(${favRgb},0.55)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.5rem', fontWeight: 900, color: accentHex,
              boxShadow: `0 0 22px rgba(${favRgb},0.30), 0 0 50px rgba(${favRgb},0.12)`,
            }}>
              {friend.username[0].toUpperCase()}
            </div>

            {/* Name + badge row */}
            <div style={{ minWidth: 0 }}>
              <h2 className="font-display font-black friend-detail-username" style={{
                fontSize: 'clamp(1.15rem,2.6vw,1.65rem)',
                color: '#fff', lineHeight: 1,
                textShadow: `0 0 30px rgba(${favRgb},0.45), 0 0 60px rgba(${favRgb},0.20)`,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                @{friend.username}
              </h2>
              {/* VIP badge */}
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                marginTop: 6, padding: '3px 9px',
                borderRadius: 999,
                background: `linear-gradient(90deg, rgba(${favRgb},0.18), rgba(${favRgb},0.08), rgba(${favRgb},0.18))`,
                backgroundSize: '200% auto',
                border: `1px solid rgba(${favRgb},0.40)`,
                animation: 'vip-shimmer 3s linear infinite',
                boxShadow: `0 0 12px rgba(${favRgb},0.20)`,
              }}>
                <span style={{ fontSize: '0.6rem' }}>★</span>
                <span style={{
                  fontSize: '0.58rem', fontWeight: 800, letterSpacing: '0.12em',
                  textTransform: 'uppercase', color: accentHex,
                }}>
                  VIP Crew Member
                </span>
              </div>

              {/* Rank badge — APPRENTICE → LEGEND based on best streak */}
              {(() => {
                const maxBestStreak = Math.max(
                  0,
                  ...Object.values(friend?.bestStreaks || {}).map((v) => Number(v) || 0)
                );
                // Certified Cinephile badge supersedes rank badge when max longest streak ≥ 500
                if (maxBestStreak >= 500) {
                  return (
                    <div style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      marginTop: 5, padding: '2px 8px',
                      borderRadius: 999,
                      background: 'linear-gradient(135deg, rgba(168,85,247,0.22) 0%, rgba(243,206,19,0.12) 100%)',
                      border: '1px solid rgba(168,85,247,0.55)',
                      boxShadow: '0 0 10px rgba(168,85,247,0.30)',
                    }}>
                      <span style={{ fontSize: '0.65rem', lineHeight: 1 }}>🎬</span>
                      <span style={{
                        fontSize: '0.42rem', fontWeight: 900, letterSpacing: '0.15em',
                        textTransform: 'uppercase',
                        background: 'linear-gradient(90deg, #c084fc, #F3CE13)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                      }}>Certified Cinephile</span>
                    </div>
                  );
                }
                const rank = getRankBadge(friend);
                if (!rank) return null;
                const flameColor = getFlameConfig(rank.minStreak).colors[1];
                return (
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    marginTop: 5, padding: '2px 8px',
                    borderRadius: 999,
                    background: `rgba(${hexToRgbStr(flameColor)},0.12)`,
                    border: `1px solid rgba(${hexToRgbStr(flameColor)},0.38)`,
                    boxShadow: `0 0 10px rgba(${hexToRgbStr(flameColor)},0.18)`,
                  }}>
                    <FlameSVG streak={rank.minStreak} size={11} idKey={`rank-${friend.id}`} />
                    <span style={{
                      fontSize: '0.52rem', fontWeight: 900, letterSpacing: '0.14em',
                      textTransform: 'uppercase', color: flameColor,
                    }}>
                      {rank.label}
                    </span>
                  </div>
                );
              })()}

              {/* Best global percentile chip */}
              {activePercentiles.length > 0 && (
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  marginTop: 5, marginLeft: 4, padding: '2px 8px',
                  borderRadius: 999,
                  background: 'rgba(0,229,255,0.08)',
                  border: '1px solid rgba(0,229,255,0.28)',
                  boxShadow: '0 0 10px rgba(0,229,255,0.14)',
                }}>
                  <span style={{ fontSize: '0.62rem' }}>🌐</span>
                  <span style={{
                    fontSize: '0.52rem', fontWeight: 900, letterSpacing: '0.12em',
                    textTransform: 'uppercase', color: '#00E5FF',
                  }}>
                    {activePercentiles[0].label}
                  </span>
                </div>
              )}
              {/* Loading state for percentile */}
              {percentiles === null && (
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  marginTop: 5, marginLeft: 4, padding: '2px 8px',
                  borderRadius: 999,
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.10)',
                }}>
                  <span style={{ fontSize: '0.52rem', color: 'rgba(255,255,255,0.25)', letterSpacing: '0.10em' }}>
                    🌐 LOADING…
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Separator — fav color */}
      <div style={{
        height: 1, flexShrink: 0,
        background: `linear-gradient(90deg, transparent, rgba(${favRgb},0.45) 30%, rgba(${favRgb},0.45) 70%, transparent)`,
      }} />

      {/* ════ ON-SCREEN TODAY — Mini Posters ════ */}
      <div>
        <SectionLabel rgb={favRgb}>On Screen Today</SectionLabel>
        <div className="friend-mini-poster-grid" style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 'clamp(7px,1.2vw,12px)',
          marginTop: 10,
        }}>
          {DAILY_CATS.map((cat) => {
            const g          = friend.today?.[cat.id];
            const streak     = friend.streaks?.[cat.id];
            const won        = g?.won === true;
            const lost       = g?.won === false;
            const catRgb     = CAT_RGB[cat.id] || DEFAULT_RGB;
            const avgGuesses = friend.avgGuesses?.[cat.id] ?? null;
            return (
              <MiniPoster
                key={cat.id}
                cat={cat}
                catRgb={catRgb}
                g={g}
                streak={streak}
                won={won}
                lost={lost}
                avgGuesses={avgGuesses}
              />
            );
          })}
        </div>
      </div>

      {/* Separator */}
      <div style={{
        height: 1, flexShrink: 0,
        background: `linear-gradient(90deg, transparent, rgba(${favRgb},0.20) 30%, rgba(${favRgb},0.20) 70%, transparent)`,
      }} />

      {/* ════ GLOBAL STANDINGS ════ */}
      {percentiles !== null && (
        <div>
          <SectionLabel rgb={favRgb}>Global Standings</SectionLabel>
          {activePercentiles.length === 0 ? (
            <p style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.22)', marginTop: 8 }}>
              No active streaks — play some games to appear on the global leaderboard!
            </p>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: 'clamp(5px,0.9vw,8px)',
              marginTop: 10,
            }}>
              {activePercentiles.map(({ cat, label, pct }) => {
                const meta = CAT_META[cat] || { emoji: '🎬', label: cat };
                // Color tiers: top 1-5% cyan, 6-15% purple, 16-30% gold, 31-50% gray
                const chipColor = pct <= 5 ? '0,229,255' : pct <= 15 ? '168,85,247' : pct <= 30 ? '243,206,19' : '160,160,160';
                // avg guesses: daily cats use cat name directly; unlimited_ cats have no guesses data
                const baseCat = cat.startsWith('unlimited_') ? null : cat;
                const avg = baseCat ? (friend.avgGuesses?.[baseCat] ?? null) : null;
                return (
                  <div
                    key={cat}
                    style={{
                      borderRadius: 9,
                      padding: '7px 10px',
                      background: `rgba(${chipColor},0.06)`,
                      border: `1px solid rgba(${chipColor},0.22)`,
                      display: 'flex', alignItems: 'center', gap: 7,
                    }}
                  >
                    <span style={{ fontSize: '0.9rem', flexShrink: 0 }}>{meta.emoji}</span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{
                        fontSize: '0.58rem', fontWeight: 700, letterSpacing: '0.08em',
                        textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {meta.label}
                      </div>
                      <div style={{
                        fontSize: '0.66rem', fontWeight: 900, letterSpacing: '0.06em',
                        color: `rgba(${chipColor},0.90)`, marginTop: 1,
                      }}>
                        {label}
                      </div>
                      {avg !== null && (
                        <div style={{
                          fontSize: '0.54rem', fontWeight: 600,
                          color: `rgba(${chipColor},0.55)`, marginTop: 2,
                        }}>
                          {Number(avg).toFixed(1)} avg tries
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Separator before calendar */}
      <div style={{
        height: 1, flexShrink: 0,
        background: `linear-gradient(90deg, transparent, rgba(${favRgb},0.20) 30%, rgba(${favRgb},0.20) 70%, transparent)`,
      }} />

      {/* ════ FLAME COLLECTION — friend's unlocked tiers ════ */}
      <div>
        <SectionLabel rgb={favRgb}>Flame Collection</SectionLabel>
        <FriendFlameCollection friend={friend} rgb={favRgb} />
      </div>

      {/* ════ PLAY HISTORY — Projected Calendar ════ */}
      <div>
        <SectionLabel rgb={favRgb}>Projection History</SectionLabel>
        {/* Scale wrapper — 88% to keep calendar compact in the panel */}
        <div style={{
          marginTop: 10,
          transform: 'scale(0.88)',
          transformOrigin: 'top center',
          // Pull up the dead whitespace at bottom
          marginBottom: 'calc((1 - 0.88) * -340px)',
        }}>
          <YearCalendar fetcher={(year) => getFriendYearCalendar(viewingFriend.id, year)} />
        </div>
      </div>
    </div>
  );
}

/* ── Mini Poster card (daily stat) ─────────────────────────────────────────── */
function MiniPoster({ cat, catRgb, g, streak, won, lost, avgGuesses }) {
  const notPlayed = !g;

  return (
    <div style={{
      borderRadius: 11,
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      minHeight: 'clamp(130px,18vh,175px)',
      position: 'relative',
      background: won
        ? 'rgba(4,20,10,0.90)'
        : lost
        ? 'rgba(20,4,4,0.90)'
        : 'rgba(8,8,20,0.90)',
      border: won
        ? `1px solid rgba(74,222,128,0.30)`
        : lost
        ? `1px solid rgba(248,113,113,0.28)`
        : `1px solid rgba(${catRgb},0.14)`,
      boxShadow: won
        ? '0 0 18px rgba(74,222,128,0.10)'
        : lost
        ? '0 0 18px rgba(248,113,113,0.10)'
        : 'none',
      transition: 'all 0.22s ease',
    }}>
      {/* Top screen area */}
      <div style={{
        flex: 1,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '14px 8px 10px',
        gap: 6,
        position: 'relative',
        background: notPlayed
          ? `linear-gradient(180deg, rgba(${catRgb},0.04) 0%, rgba(0,0,0,0.0) 100%)`
          : 'transparent',
      }}>
        {/* Category emoji — large */}
        <span style={{
          fontSize: 'clamp(1.4rem,2.8vw,1.9rem)',
          lineHeight: 1,
          filter: notPlayed ? 'grayscale(0.6) opacity(0.55)' : 'none',
        }}>
          {cat.emoji}
        </span>

        {/* Category label */}
        <span style={{
          fontSize: 'clamp(0.52rem,0.85vw,0.62rem)',
          fontWeight: 700, textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: notPlayed ? 'rgba(255,255,255,0.22)' : `rgba(${catRgb},0.80)`,
          textAlign: 'center', lineHeight: 1.2,
        }}>
          {cat.label}
        </span>

        {/* COMING SOON for unplayed */}
        {notPlayed && (
          <div style={{
            fontSize: '0.52rem', fontWeight: 800, letterSpacing: '0.15em',
            textTransform: 'uppercase', color: `rgba(${catRgb},0.40)`,
            animation: 'coming-soon-pulse 2.5s ease-in-out infinite',
            marginTop: 4,
          }}>
            COMING SOON
          </div>
        )}

        {/* CLEARED / SCREENED stamp overlay */}
        {(won || lost) && (
          <div style={{
            position: 'absolute', top: '30%', left: '50%',
            padding: '2px 7px',
            border: `2px solid ${won ? 'rgba(74,222,128,0.75)' : 'rgba(248,113,113,0.70)'}`,
            borderRadius: 3,
            fontSize: '0.55rem', fontWeight: 900, letterSpacing: '0.15em',
            textTransform: 'uppercase',
            color: won ? 'rgba(74,222,128,0.85)' : 'rgba(248,113,113,0.85)',
            whiteSpace: 'nowrap',
            transform: 'translateX(-50%) rotate(-22deg)',
            transformOrigin: 'center',
            animation: 'stamp-in 0.4s cubic-bezier(0.2,1.4,0.4,1) both',
            pointerEvents: 'none',
          }}>
            {won ? 'CLEARED' : 'SCREENED'}
          </div>
        )}
      </div>

      {/* Bottom status strip */}
      <div style={{
        padding: '7px 10px 9px',
        background: won
          ? 'rgba(74,222,128,0.10)'
          : lost
          ? 'rgba(248,113,113,0.10)'
          : `rgba(${catRgb},0.05)`,
        borderTop: won
          ? '1px solid rgba(74,222,128,0.18)'
          : lost
          ? '1px solid rgba(248,113,113,0.18)'
          : `1px solid rgba(${catRgb},0.08)`,
      }}>
        {won && (
          <>
            <div style={{ fontSize: 'clamp(0.60rem,1vw,0.70rem)', fontWeight: 900, color: '#4ade80', lineHeight: 1 }}>
              ✓ Won
            </div>
            <div style={{ fontSize: '0.54rem', color: 'rgba(255,255,255,0.30)', marginTop: 2 }}>
              {g.guesses_taken}/7 guesses
            </div>
            {avgGuesses !== null && avgGuesses !== undefined && (
              <div style={{ fontSize: '0.52rem', color: `rgba(${catRgb},0.60)`, marginTop: 2, fontWeight: 700 }}>
                {Number(avgGuesses).toFixed(1)} avg tries
              </div>
            )}
          </>
        )}
        {lost && (
          <div style={{ fontSize: 'clamp(0.60rem,1vw,0.70rem)', fontWeight: 900, color: '#f87171', lineHeight: 1 }}>
            ✕ Lost
          </div>
        )}
        {notPlayed && (
          <div style={{ fontSize: 'clamp(0.54rem,0.9vw,0.62rem)', color: 'rgba(255,255,255,0.20)', lineHeight: 1.2 }}>
            Dark screen
          </div>
        )}
        {streak !== undefined && streak > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginTop: 3 }}>
            <FlameSVG streak={streak} size={14} idKey={`mini-${cat.id}`} />
            <span style={{ fontSize: '0.54rem', fontWeight: 700, color: `rgba(${catRgb},0.75)` }}>
              {streak}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Utility: rough rgb → hex for text-shadow ───────────────────────────────── */
function rgbToApproxHex(rgb) {
  // rgb is a string like "243,206,19" — convert to CSS hex
  try {
    const [r, g, b] = rgb.split(',').map(Number);
    return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
  } catch { return '#F3CE13'; }
}

/* ── Utility: hex color → "r,g,b" string for rgba() ────────────────────────── */
function hexToRgbStr(hex) {
  try {
    const h = hex.replace('#', '');
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return `${r},${g},${b}`;
  } catch { return '168,85,247'; }
}

function SectionLabel({ children, rgb }) {
  return (
    <span style={{
      fontSize: '0.60rem', fontWeight: 700, textTransform: 'uppercase',
      letterSpacing: '0.12em',
      color: rgb ? `rgba(${rgb},0.65)` : 'rgba(255,255,255,0.30)',
    }}>
      {children}
    </span>
  );
}

function TrashIcon() {
  return (
    <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6"/>
      <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
      <path d="M10 11v6M14 11v6"/>
      <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
    </svg>
  );
}

/* ── TodayDots ──────────────────────────────────────────────────────────────── */
function TodayDots({ today }) {
  if (!today) return <p style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.22)', marginTop: 2 }}>No games today</p>;
  return (
    <div style={{ display: 'flex', gap: 4, marginTop: 3 }}>
      {DAILY_CATS.map((cat) => {
        const g = today[cat.id];
        const bg = g?.won === true ? '#4ade80' : g?.won === false ? 'rgba(248,113,113,0.7)' : 'rgba(255,255,255,0.14)';
        return (
          <div
            key={cat.id}
            title={`${cat.label}: ${g ? (g.won ? 'Won' : 'Lost') : 'Not played'}`}
            style={{ width: 7, height: 7, borderRadius: '50%', background: bg }}
          />
        );
      })}
    </div>
  );
}

/* ── InviteCard ─────────────────────────────────────────────────────────────── */
function InviteCard({ inviteUrl, linkCopied, onCopy, onShare, showQR, onToggleQR }) {
  return (
    <div
      style={{
        background: 'rgba(245,158,11,0.04)',
        backdropFilter: 'blur(15px)',
        WebkitBackdropFilter: 'blur(15px)',
        border: '1px solid rgba(243,206,19,0.16)',
        borderRadius: 12,
        padding: '12px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div
          style={{
            width: 30, height: 30, borderRadius: 8, flexShrink: 0,
            background: 'rgba(245,158,11,0.12)',
            border: '1px solid rgba(245,158,11,0.22)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <LinkIcon />
        </div>
        <div>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#fff', lineHeight: 1.2 }}>Invite your film crew</div>
          <div style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.28)', marginTop: 1 }}>Bring friends to the big screen</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6 }}>
        {HAS_NATIVE_SHARE && (
          <button
            onClick={onShare}
            style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
              padding: '7px 0', borderRadius: 9, fontSize: '0.72rem', fontWeight: 500,
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)',
              color: 'rgba(255,255,255,0.65)', cursor: 'pointer', transition: 'all 0.18s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.10)'; e.currentTarget.style.color = '#fff'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = 'rgba(255,255,255,0.65)'; }}
          >
            <ShareIcon /> Share
          </button>
        )}
        <button
          onClick={onCopy}
          style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
            padding: '7px 0', borderRadius: 9, fontSize: '0.72rem', fontWeight: 500, cursor: 'pointer',
            background: linkCopied ? 'rgba(34,197,94,0.10)' : 'rgba(255,255,255,0.06)',
            border: linkCopied ? '1px solid rgba(34,197,94,0.35)' : '1px solid rgba(255,255,255,0.10)',
            color: linkCopied ? '#4ade80' : 'rgba(255,255,255,0.65)',
            transition: 'all 0.18s',
          }}
        >
          {linkCopied ? (
            <><svg style={{ width: 11, height: 11 }} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>Copied!</>
          ) : (
            <><CopyIcon />Copy Link</>
          )}
        </button>
      </div>

      <button
        onClick={onToggleQR}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
          fontSize: '0.62rem', color: 'rgba(255,255,255,0.28)', cursor: 'pointer',
          background: 'none', border: 'none', padding: '2px 0', transition: 'color 0.18s',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.55)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.28)'; }}
      >
        <QRSmallIcon />
        {showQR ? 'Hide QR code' : 'Show QR code'}
        <span style={{ marginLeft: 2, fontSize: '0.55rem' }}>{showQR ? '▲' : '▼'}</span>
      </button>
    </div>
  );
}

/* ── QRModal ────────────────────────────────────────────────────────────────── */
function QRModal({ inviteUrl, onClose }) {
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(inviteUrl)}&color=ffffff&bgcolor=0a0a0f&qzone=2&format=png`;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-md"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="relative flex flex-col items-center gap-5 rounded-2xl p-6 w-full max-w-xs animate-bounce-in"
        style={{
          background: 'rgba(12,12,20,0.96)',
          backdropFilter: 'blur(32px) saturate(1.3)',
          WebkitBackdropFilter: 'blur(32px) saturate(1.3)',
          border: '1px solid rgba(255,255,255,0.09)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.05)',
        }}
      >
        <div
          className="absolute top-0 left-0 right-0 h-px rounded-t-2xl"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(245,158,11,0.5), transparent)' }}
        />
        <button
          onClick={onClose}
          className="absolute top-3.5 right-3.5 w-7 h-7 rounded-full flex items-center justify-center text-gray-500 hover:text-white transition-colors text-sm"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          ×
        </button>
        <div className="text-center space-y-0.5 pt-1">
          <h3 className="text-sm font-bold text-white">Scan to join</h3>
          <p className="text-[10px] text-gray-600">Let a friend scan your screen</p>
        </div>
        <div
          className="rounded-xl overflow-hidden"
          style={{ padding: 10, background: '#0a0a0f', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 4px 24px rgba(0,0,0,0.5)' }}
        >
          <img src={qrSrc} alt="Invite QR code" width={200} height={200} className="block rounded-lg" style={{ imageRendering: 'pixelated' }} />
        </div>
        <p className="text-[10px] text-gray-600 text-center font-mono break-all px-2 leading-relaxed" style={{ maxWidth: 200 }}>
          {inviteUrl}
        </p>
      </div>
    </div>
  );
}

/* ── SVG Icons ──────────────────────────────────────────────────────────────── */

function FilmCrewIcon() {
  return (
    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="rgba(168,85,247,0.9)" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
    </svg>
  );
}

function FilmReelIcon({ size = 48 }) {
  return (
    <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="rgba(168,85,247,0.65)" strokeWidth={1.2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <circle cx="12" cy="12" r="3"/>
      <circle cx="6.5" cy="7.5" r="1.4" fill="rgba(168,85,247,0.25)" stroke="rgba(168,85,247,0.50)" strokeWidth={1}/>
      <circle cx="17.5" cy="7.5" r="1.4" fill="rgba(168,85,247,0.25)" stroke="rgba(168,85,247,0.50)" strokeWidth={1}/>
      <circle cx="6.5" cy="16.5" r="1.4" fill="rgba(168,85,247,0.25)" stroke="rgba(168,85,247,0.50)" strokeWidth={1}/>
      <circle cx="17.5" cy="16.5" r="1.4" fill="rgba(168,85,247,0.25)" stroke="rgba(168,85,247,0.50)" strokeWidth={1}/>
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg className="w-3.5 h-3.5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg style={{ width: 11, height: 11 }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg style={{ width: 11, height: 11 }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
    </svg>
  );
}

function QRSmallIcon() {
  return (
    <svg style={{ width: 11, height: 11 }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
        d="M12 4H4v8h8V4zm0 8v8H4v-8h8zm8-8h-8v8h8V4zm0 8h-8v8h8v-8z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
        d="M6 6h4v4H6V6zm8 0h4v4h-4V6zm-8 8h4v4H6v-4z" />
    </svg>
  );
}

function PendingSendIcon() {
  return (
    <svg style={{ width: 11, height: 11 }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
    </svg>
  );
}
