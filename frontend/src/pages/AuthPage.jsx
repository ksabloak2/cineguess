import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../utils/supabase';
import { registerProfile, getProfile, checkEmailExists } from '../utils/api';

const MODES = {
  signin:      'signin',
  signup:      'signup',
  username:    'username',
  confirm:     'confirm',    // waiting for email verification after sign-up
  forgot:      'forgot',     // enter email to request a password-reset link
  forgot_sent: 'forgot_sent',// reset link sent — "check your inbox"
  reset:       'reset',      // PASSWORD_RECOVERY event fired; enter new password
};

// Resend cooldown in seconds — prevents spam and communicates to the user
// that the email is on its way.
const RESEND_COOLDOWN = 60;

// Eye / eye-off icon — inline SVG so no extra dependency
function EyeIcon({ open }) {
  return open ? (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/>
      <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  );
}

function PasswordInput({ value, onChange, placeholder, show, onToggle, autoFocus, ...rest }) {
  return (
    <div style={{ position: 'relative' }}>
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoFocus={autoFocus}
        autoComplete="current-password"
        className="input-field"
        style={{ paddingRight: '2.75rem' }}
        {...rest}
      />
      <button
        type="button"
        onClick={onToggle}
        tabIndex={-1}
        aria-label={show ? 'Hide password' : 'Show password'}
        style={{
          position: 'absolute', right: '0.75rem', top: '50%',
          transform: 'translateY(-50%)',
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'rgba(156,163,175,0.7)',
          padding: '2px',
          lineHeight: 0,
          transition: 'color 0.15s',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.color = 'rgba(209,213,219,1)')}
        onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(156,163,175,0.7)')}
      >
        <EyeIcon open={show} />
      </button>
    </div>
  );
}

// Google "G" coloured logo — inline SVG, no dependency
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  );
}

export default function AuthPage() {
  const { signIn, signUp, signInWithGoogle, setProfile, resetPassword, updatePassword, resendVerification, session, profile, loading: authLoading } = useAuth();
  const navigate  = useNavigate();
  const location  = useLocation();

  // Support navigating here with state: { mode: 'signup' } (e.g. from "Create Account" button)
  const [mode, setMode] = useState(() => {
    const requested = location.state?.mode;
    return MODES[requested] || MODES.signin;
  });
  const [email, setEmail]             = useState('');
  const [password, setPassword]       = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirm] = useState('');
  const [username, setUsername]       = useState(
    () => localStorage.getItem('pending_username') || ''
  );
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState('');
  const [info, setInfo]               = useState('');

  // Resend cooldown — shared between "resend verification" and "resend reset link"
  const [resendCooldown, setResendCooldown] = useState(0);
  const cooldownRef = useRef(null);

  // Show/hide password toggles — one per visible field
  const [showPw,      setShowPw]      = useState(false);
  const [showNewPw,   setShowNewPw]   = useState(false);
  const [showConfPw,  setShowConfPw]  = useState(false);

  function startCooldown() {
    setResendCooldown(RESEND_COOLDOWN);
    cooldownRef.current = setInterval(() => {
      setResendCooldown((s) => {
        if (s <= 1) { clearInterval(cooldownRef.current); return 0; }
        return s - 1;
      });
    }, 1000);
  }

  useEffect(() => () => clearInterval(cooldownRef.current), []);

  // ── Detect new Google / OAuth users who have no profile yet ───────────────
  // After the OAuth redirect, Supabase fires SIGNED_IN.  fetchProfile in
  // AuthContext tries to auto-register but Google accounts have no username in
  // user_metadata, so profile stays null.  We catch that here and send the
  // user to the username-picker step.
  useEffect(() => {
    if (
      session &&
      !authLoading &&
      !profile &&
      ![MODES.username, MODES.reset].includes(mode)
    ) {
      setMode(MODES.username);
      setInfo('Almost there — choose a username to complete your account.');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, authLoading, profile]);

  // ── Listen for Supabase PASSWORD_RECOVERY event ────────────────────────────
  // When the user clicks the reset link in their email, Supabase exchanges the
  // code and fires PASSWORD_RECOVERY before setting the session.  We switch to
  // the 'reset' mode so they can enter their new password.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setMode(MODES.reset);
        setError('');
        setInfo('');
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  // ── Helpers ────────────────────────────────────────────────────────────────
  function switchMode(next) {
    setMode(next);
    setError('');
    setInfo('');
    setShowPw(false);
    setShowNewPw(false);
    setShowConfPw(false);
  }

  // ── Form submit ────────────────────────────────────────────────────────────
  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setInfo('');
    setLoading(true);

    try {
      // ── Sign in ──────────────────────────────────────────────────────────
      if (mode === MODES.signin) {
        await signIn(email, password);
        try {
          const prof = await getProfile();
          setProfile(prof);
          navigate('/play/top250');
        } catch (err) {
          if (err?.response?.status === 404) {
            // No profile row yet — check if we saved a username during signup.
            const pending = localStorage.getItem('pending_username');
            if (pending) {
              // Auto-register silently — user entered the username at signup already.
              try {
                const prof = await registerProfile(pending);
                setProfile(prof);
                localStorage.removeItem('pending_username');
                navigate('/play/top250');
                return;
              } catch {
                // If auto-register fails (e.g. username taken), fall through to manual entry.
              }
            }
            setMode(MODES.username);
            setInfo('Almost there — pick a username to finish setting up your account.');
          } else {
            throw err;
          }
        }

      // ── Sign up ──────────────────────────────────────────────────────────
      } else if (mode === MODES.signup) {
        if (!username || username.trim().length < 2) {
          setError('Username must be at least 2 characters.');
          return;
        }
        if (!/^[a-zA-Z0-9_]+$/.test(username.trim())) {
          setError('Username may only contain letters, numbers, and underscores.');
          return;
        }
        const data = await signUp(email, password, username.trim());
        if (!data?.session) {
          // Email verification required — persist username in localStorage so it
          // survives tab changes and browser restarts, and auto-registers on sign-in.
          localStorage.setItem('pending_username', username.trim());
          localStorage.setItem('pending_email', email.trim());
          setMode(MODES.confirm);
          setInfo(`We sent a confirmation link to ${email}. Click it, then come back and sign in.`);
        } else {
          // Immediate session — register profile right now.
          const prof = await registerProfile(username);
          setProfile(prof);
          localStorage.removeItem('pending_username');
          localStorage.removeItem('pending_email');
          navigate('/play/top250');
        }

      // ── Choose username ──────────────────────────────────────────────────
      } else if (mode === MODES.username) {
        const prof = await registerProfile(username);
        setProfile(prof);
        localStorage.removeItem('pending_username');
        localStorage.removeItem('pending_email');
        navigate('/play/top250');

      // ── Forgot password — verify account exists, then send reset email ──
      } else if (mode === MODES.forgot) {
        const { exists } = await checkEmailExists(email);
        if (!exists) {
          setError('No account found with that email address. Double-check the spelling or create a new account.');
          return;
        }
        await resetPassword(email);
        setMode(MODES.forgot_sent);
        startCooldown();

      // ── Reset password — update with new password ────────────────────────
      } else if (mode === MODES.reset) {
        if (newPassword !== confirmPassword) {
          setError('Passwords do not match.');
          return;
        }
        if (newPassword.length < 6) {
          setError('Password must be at least 6 characters.');
          return;
        }
        await updatePassword(newPassword);
        setInfo('Password updated! Signing you in…');
        // Give the session a moment to settle, then navigate.
        setTimeout(() => navigate('/play/top250'), 1200);
      }
    } catch (err) {
      setError(err?.response?.data?.error || err.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  // ── Resend handlers ────────────────────────────────────────────────────────
  async function handleResendVerification() {
    if (resendCooldown > 0 || !email) return;
    setError('');
    try {
      await resendVerification(email);
      setInfo(`Verification email re-sent to ${email}.`);
      startCooldown();
    } catch (err) {
      setError(err.message || 'Could not resend. Try again shortly.');
    }
  }

  async function handleResendReset() {
    if (resendCooldown > 0 || !email) return;
    setError('');
    try {
      await resetPassword(email);
      setInfo('Reset link re-sent. Check your inbox (and spam folder).');
      startCooldown();
    } catch (err) {
      setError(err.message || 'Could not resend. Try again shortly.');
    }
  }

  // ── Derived UI labels ──────────────────────────────────────────────────────
  const subtitles = {
    [MODES.signin]:      'Sign in to track your streaks',
    [MODES.signup]:      'Create an account',
    [MODES.username]:    'Choose a username',
    [MODES.confirm]:     'Check your email',
    [MODES.forgot]:      'Reset your password',
    [MODES.forgot_sent]: 'Reset link sent',
    [MODES.reset]:       'Choose a new password',
  };

  const isEmailPasswordMode = [MODES.signin, MODES.signup, MODES.forgot].includes(mode);

  return (
    <div className="flex items-center justify-center min-h-[calc(100dvh-8rem)]">
      <div className="w-full max-w-sm">
        <div className="card p-6 sm:p-8 animate-fade-in">

          {/* ── Header ── */}
          <div className="text-center mb-6">
            <span className="text-3xl sm:text-4xl block mb-2">
              {mode === MODES.reset ? '🔑' : mode === MODES.forgot || mode === MODES.forgot_sent ? '📧' : '🎬'}
            </span>
            <h1 className="font-display text-xl sm:text-2xl font-bold">
              Cine<span className="text-accent">Guess</span>
            </h1>
            <p className="text-gray-600 text-xs sm:text-sm mt-1">{subtitles[mode]}</p>
          </div>

          {/* ── Error / info banners ── */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2 text-sm text-red-400 mb-4">
              {error}
            </div>
          )}
          {info && (
            <div className="bg-accent/10 border border-accent/20 rounded-xl px-3 py-2 text-sm text-accent mb-4">
              {info}
            </div>
          )}

          {/* ════════════════════════════════════════════════════════
              CONFIRM — waiting for email verification
          ════════════════════════════════════════════════════════ */}
          {mode === MODES.confirm && (
            <div className="space-y-3">
              <p className="text-sm text-gray-400 text-center leading-relaxed">
                We sent a link to <span className="text-white font-medium">{email}</span>.
                Click it to verify your account, then sign in here.
              </p>
              <div style={{
                display: 'flex', alignItems: 'flex-start', gap: 8,
                background: 'rgba(243,206,19,0.07)',
                border: '1px solid rgba(243,206,19,0.22)',
                borderRadius: 10, padding: '9px 12px',
              }}>
                <span style={{ fontSize: '0.9rem', flexShrink: 0 }}>📬</span>
                <p style={{ fontSize: '0.75rem', color: 'rgba(243,206,19,0.80)', margin: 0, lineHeight: 1.5 }}>
                  <strong>Don't see it?</strong> Check your <strong>spam or junk folder</strong> — verification emails sometimes land there.
                </p>
              </div>

              {/* Resend verification */}
              <button
                onClick={handleResendVerification}
                disabled={resendCooldown > 0}
                className="w-full py-2 px-4 rounded-xl text-sm font-medium transition-all border"
                style={{
                  background:   resendCooldown > 0 ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.06)',
                  borderColor:  resendCooldown > 0 ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.15)',
                  color:        resendCooldown > 0 ? 'rgba(156,163,175,0.5)'  : 'rgba(209,213,219,1)',
                  cursor:       resendCooldown > 0 ? 'default' : 'pointer',
                }}
              >
                {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend verification email'}
              </button>

              <button
                onClick={() => switchMode(MODES.signin)}
                className="btn-primary w-full"
              >
                Back to sign in
              </button>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════
              FORGOT_SENT — reset link sent
          ════════════════════════════════════════════════════════ */}
          {mode === MODES.forgot_sent && (
            <div className="space-y-3">
              <p className="text-sm text-gray-400 text-center leading-relaxed">
                We sent a password reset link to{' '}
                <span className="text-white font-medium">{email}</span>.
                Click it in your email to choose a new password.
              </p>
              <p className="text-xs text-gray-600 text-center">
                Didn't receive it? Check your spam folder, or resend below.
              </p>

              {/* Resend reset link */}
              <button
                onClick={handleResendReset}
                disabled={resendCooldown > 0}
                className="w-full py-2 px-4 rounded-xl text-sm font-medium transition-all border"
                style={{
                  background:   resendCooldown > 0 ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.06)',
                  borderColor:  resendCooldown > 0 ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.15)',
                  color:        resendCooldown > 0 ? 'rgba(156,163,175,0.5)'  : 'rgba(209,213,219,1)',
                  cursor:       resendCooldown > 0 ? 'default' : 'pointer',
                }}
              >
                {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend reset link'}
              </button>

              <button
                onClick={() => switchMode(MODES.signin)}
                className="btn-primary w-full"
              >
                Back to sign in
              </button>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════
              RESET — choose a new password
          ════════════════════════════════════════════════════════ */}
          {mode === MODES.reset && (
            <form onSubmit={handleSubmit} className="space-y-3">
              <PasswordInput
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="New password"
                required
                minLength={6}
                show={showNewPw}
                onToggle={() => setShowNewPw((v) => !v)}
                autoFocus
              />
              <PasswordInput
                value={confirmPassword}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Confirm new password"
                required
                minLength={6}
                show={showConfPw}
                onToggle={() => setShowConfPw((v) => !v)}
              />
              <button type="submit" disabled={loading} className="btn-primary w-full">
                {loading ? 'Updating…' : 'Set new password'}
              </button>
            </form>
          )}

          {/* ════════════════════════════════════════════════════════
              MAIN FORMS — signin / signup / forgot / username
          ════════════════════════════════════════════════════════ */}
          {[MODES.signin, MODES.signup, MODES.forgot, MODES.username].includes(mode) && (
            <form onSubmit={handleSubmit} className="space-y-3">

              {/* Email / username + password */}
              {isEmailPasswordMode && (
                <input
                  type={mode === MODES.signin ? 'text' : 'email'}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={mode === MODES.signin ? 'Email or username' : 'Email'}
                  required
                  autoComplete={mode === MODES.signin ? 'username' : 'email'}
                  className="input-field"
                  autoFocus={mode === MODES.forgot}
                />
              )}

              {/* Password only on signin / signup */}
              {(mode === MODES.signin || mode === MODES.signup) && (
                <PasswordInput
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  required
                  minLength={6}
                  show={showPw}
                  onToggle={() => setShowPw((v) => !v)}
                />
              )}

              {/* Username — on signup form AND on the standalone username step */}
              {(mode === MODES.signup || mode === MODES.username) && (
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Username (letters, numbers, _)"
                  required
                  pattern="[a-zA-Z0-9_]+"
                  minLength={2}
                  maxLength={30}
                  className="input-field"
                  autoFocus={mode === MODES.username}
                />
              )}

              {/* Forgot password link — only on signin */}
              {mode === MODES.signin && (
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => switchMode(MODES.forgot)}
                    className="text-xs text-gray-600 hover:text-gray-300 transition-colors"
                  >
                    Forgot password?
                  </button>
                </div>
              )}

              <button type="submit" disabled={loading} className="btn-primary w-full">
                {loading ? 'Loading…' : (
                  mode === MODES.signin   ? 'Sign in' :
                  mode === MODES.signup   ? 'Create account' :
                  mode === MODES.forgot   ? 'Send reset link' :
                  'Set username'
                )}
              </button>
            </form>
          )}

          {/* ── Google sign-in — only on signin / signup screens ── */}
          {(mode === MODES.signin || mode === MODES.signup) && (
            <div style={{ marginTop: 12 }}>
              {/* Divider */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
                <span style={{ fontSize: '0.7rem', color: 'rgba(156,163,175,0.6)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>or</span>
                <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
              </div>

              <button
                type="button"
                onClick={async () => {
                  setError('');
                  try { await signInWithGoogle(); }
                  catch (err) { setError(err.message || 'Could not start Google sign-in.'); }
                }}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  gap: 10, width: '100%',
                  padding: '10px 16px',
                  borderRadius: 12,
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.13)',
                  color: 'rgba(229,231,235,1)',
                  fontSize: '0.875rem', fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'background 0.15s, border-color 0.15s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.10)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.22)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.13)'; }}
              >
                <GoogleIcon />
                Continue with Google
              </button>
            </div>
          )}

          {/* ── Switch between signin / signup ── */}
          {(mode === MODES.signin || mode === MODES.signup) && (
            <p className="text-center text-xs sm:text-sm text-gray-600 mt-4">
              {mode === MODES.signin ? "Don't have an account?" : 'Already have an account?'}
              {' '}
              <button
                onClick={() => switchMode(mode === MODES.signin ? MODES.signup : MODES.signin)}
                className="text-accent hover:text-accent-hover transition-colors font-medium"
              >
                {mode === MODES.signin ? 'Sign up' : 'Sign in'}
              </button>
            </p>
          )}

          {/* ── Back to sign in (forgot form) ── */}
          {mode === MODES.forgot && (
            <p className="text-center text-xs sm:text-sm text-gray-600 mt-4">
              <button
                onClick={() => switchMode(MODES.signin)}
                className="text-accent hover:text-accent-hover transition-colors font-medium"
              >
                ← Back to sign in
              </button>
            </p>
          )}

          {/* ── Guest link ── */}
          {[MODES.signin, MODES.signup, MODES.forgot].includes(mode) && (
            <p className="text-center text-[10px] sm:text-xs text-gray-700 mt-4">
              <button onClick={() => navigate('/')} className="hover:text-gray-400 transition-colors">
                Continue as guest →
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
