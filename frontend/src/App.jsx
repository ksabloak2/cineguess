import { lazy, Suspense, useEffect, useState } from 'react';
import { Routes, Route, Navigate, useParams } from 'react-router-dom';
import Navbar from './components/Navbar';
import ErrorBoundary from './components/ErrorBoundary';
import { useAuth } from './context/AuthContext';

// Critical path — always bundled (used on every page load)
import HomePage from './pages/HomePage';
import ModeHub  from './pages/ModeHub';
import GamePage from './pages/GamePage';

// Non-critical — code-split into separate chunks loaded on demand.
// This keeps the initial JS bundle lean for users who just want to play.
const AuthPage    = lazy(() => import('./pages/AuthPage'));
const FriendsPage = lazy(() => import('./pages/FriendsPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));

// Old URLs like /play/top250 or /play/unlimited get rewritten.
function LegacyPlayRedirect() {
  const { category } = useParams();
  if (category === 'unlimited') return <Navigate to="/play/unlimited/mostpopular" replace />;
  return <Navigate to={`/play/daily/${category}`} replace />;
}

// Redirect /play/:mode/top250 → /play/:mode/mostpopular (cleaner URL)
function Top250Redirect() {
  const { mode } = useParams();
  return <Navigate to={`/play/${mode}/mostpopular`} replace />;
}

// Minimal spinner shown while a lazy chunk is downloading.
function PageSpinner() {
  return (
    <div className="min-h-[40vh] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Maintenance / Intermission screen
// Shown to all users when app_settings.maintenance_mode = 'true'.
// ---------------------------------------------------------------------------
function IntermissionScreen() {
  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0a0a0f',
        color: '#ffffff',
        padding: '2rem',
        textAlign: 'center',
      }}
    >
      {/* Animated film reel */}
      <div style={{ marginBottom: '2rem', position: 'relative' }}>
        <div
          style={{
            fontSize: '5rem',
            lineHeight: 1,
            animation: 'spin 8s linear infinite',
          }}
        >
          🎬
        </div>
        {/* Gentle pulse ring */}
        <div
          style={{
            position: 'absolute',
            inset: '-12px',
            borderRadius: '50%',
            border: '2px solid rgba(243,206,19,0.25)',
            animation: 'pulse-ring 2.5s ease-out infinite',
          }}
        />
      </div>

      <h1
        style={{
          fontFamily: 'var(--font-display, Georgia, serif)',
          fontSize: 'clamp(1.6rem, 5vw, 2.8rem)',
          fontWeight: 900,
          letterSpacing: '-0.02em',
          marginBottom: '0.75rem',
          background: 'linear-gradient(135deg, #F3CE13 0%, #fff 60%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}
      >
        Brief Intermission
      </h1>

      <p
        style={{
          fontSize: '1.05rem',
          color: 'rgba(255,255,255,0.55)',
          maxWidth: '26rem',
          lineHeight: 1.7,
          marginBottom: '2.5rem',
        }}
      >
        <span style={{ color: '#F3CE13', fontWeight: 700 }}>CineGUESS</span> is
        undergoing a brief intermission while we roll out improvements.
        We'll be back shortly — your streaks are safe. 🍿
      </p>

      {/* Divider */}
      <div
        style={{
          width: '120px',
          height: '1px',
          background: 'linear-gradient(90deg, transparent, rgba(243,206,19,0.4), transparent)',
          marginBottom: '2rem',
        }}
      />

      {/* Auto-refresh note */}
      <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.25)', letterSpacing: '0.05em' }}>
        This page will check again automatically every 30 seconds.
      </p>

      {/* Keyframes injected inline to avoid a separate CSS file */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg);   }
          to   { transform: rotate(360deg); }
        }
        @keyframes pulse-ring {
          0%   { transform: scale(0.9); opacity: 0.6; }
          60%  { transform: scale(1.1); opacity: 0; }
          100% { transform: scale(1.1); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Root App
// ---------------------------------------------------------------------------
export default function App() {
  const { loading } = useAuth();
  const [maintenance, setMaintenance] = useState(false);
  const [statusChecked, setStatusChecked] = useState(false);

  // Check maintenance mode on mount, then re-check every 30 s while the tab
  // is open (mirrors the server-side cache TTL).
  useEffect(() => {
    async function checkStatus() {
      try {
        const res  = await fetch('/api/status');
        const data = await res.json();
        setMaintenance(!!data.maintenance);
      } catch {
        // If /api/status is unreachable, don't block the app — assume fine.
        setMaintenance(false);
      } finally {
        setStatusChecked(true);
      }
    }

    checkStatus();
    const interval = setInterval(checkStatus, 30_000);
    return () => clearInterval(interval);
  }, []);

  // Wait for both auth and initial status check before rendering anything.
  if (loading || !statusChecked) {
    return (
      <div className="min-h-dvh flex items-center justify-center" style={{ background: '#0a0a0f' }}>
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-500 text-sm font-medium animate-pulse">Loading CineGuess...</p>
        </div>
      </div>
    );
  }

  // Full-screen maintenance screen — no Navbar, no routes.
  if (maintenance) return <IntermissionScreen />;

  return (
    <div className="min-h-dvh flex flex-col" style={{ background: '#0a0a0f', color: '#ffffff' }}>
      <Navbar />
      <main className="flex-1 container-game py-4 sm:py-6 lg:py-8 pb-24 sm:pb-8 lg:pb-10">
        {/* ErrorBoundary ensures a broken page never kills the whole app */}
        <ErrorBoundary>
          <Suspense fallback={<PageSpinner />}>
            <Routes>
              <Route path="/"                        element={<HomePage />} />
              <Route path="/daily"                   element={<ModeHub />} />
              <Route path="/unlimited"               element={<ModeHub />} />
              <Route path="/play/:mode/:category"    element={<GamePage />} />
              <Route path="/play/:mode/top250"       element={<Top250Redirect />} />
              <Route path="/play/:category"          element={<LegacyPlayRedirect />} />
              <Route path="/auth"                    element={<AuthPage />} />
              <Route path="/friends"                 element={<FriendsPage />} />
              <Route path="/profile"                 element={<ProfilePage />} />
              <Route path="*"                        element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </main>
    </div>
  );
}
