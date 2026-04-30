import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../utils/supabase';
import { getProfile, lookupEmail, registerProfile } from '../utils/api';

const AuthContext = createContext(null);

// ── Profile cache helpers ────────────────────────────────────────────────────
// Persist the last-known profile in localStorage so that brief backend
// unavailability (e.g. Railway's midnight cron restart window) never causes
// the username to disappear and the user to be kicked to the login screen.
const PROFILE_CACHE_KEY = 'cineguess_profile_cache';

function loadCachedProfile() {
  try {
    const raw = localStorage.getItem(PROFILE_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveCachedProfile(prof) {
  try {
    if (prof) localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(prof));
    else localStorage.removeItem(PROFILE_CACHE_KEY);
  } catch {}
}

export function AuthProvider({ children }) {
  const [session, setSession]   = useState(null);
  // Seed from cache so the username shows immediately on page load / token refresh,
  // even before the async backend call completes.
  const [profile, setProfile]   = useState(() => loadCachedProfile());
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    // Load initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchProfile(session);
      else {
        // No session — clear any stale cache
        saveCachedProfile(null);
        setProfile(null);
        setLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) fetchProfile(session);
      else {
        saveCachedProfile(null);
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function fetchProfile(session) {
    try {
      const prof = await getProfile();
      setProfile(prof);
      saveCachedProfile(prof);  // Keep cache fresh on every successful fetch
    } catch (err) {
      // Profile row doesn't exist yet — happens right after email verification.
      // Try to auto-register using:
      //   1. user_metadata.username (set at signUp — works across devices)
      //   2. localStorage pending_username (fallback for same-device flow)
      if (err?.response?.status === 404) {
        // Profile definitively missing — clear the cache and try to auto-create.
        saveCachedProfile(null);
        const metaUsername = session?.user?.user_metadata?.username;
        const pending = metaUsername || localStorage.getItem('pending_username');
        if (pending) {
          try {
            const prof = await registerProfile(pending);
            setProfile(prof);
            saveCachedProfile(prof);
            localStorage.removeItem('pending_username');
            localStorage.removeItem('pending_email');
            return;
          } catch {
            // Username taken or other error — fall through, profile stays null
          }
        }
        setProfile(null);
      }
      // For any other error (network timeout, 5xx, etc.) — DO NOT clear the
      // profile.  Keep the cached value visible so the user isn't kicked to
      // the login screen just because the backend was momentarily unavailable
      // (e.g. during the midnight cron window).
    } finally {
      setLoading(false);
    }
  }

  async function signUp(email, password, username) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username } }, // stored in user_metadata — survives across devices
    });
    if (error) throw error;
    return data;
  }

  async function signIn(login, password) {
    // If login doesn't look like an email, resolve username → email.
    let email = login;
    if (!login.includes('@')) {
      try {
        const result = await lookupEmail(login);
        email = result.email;
      } catch {
        // Username not found in users table yet — can happen right after email
        // verification before registerProfile runs. Fall back to the email stored
        // during signup if the pending_username matches what they typed.
        const pendingEmail = localStorage.getItem('pending_email');
        const pendingUsername = localStorage.getItem('pending_username');
        if (pendingEmail && pendingUsername?.toLowerCase() === login.toLowerCase()) {
          email = pendingEmail;
        } else {
          throw new Error('No account found with that username.');
        }
      }
    }
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  }

  async function signInWithGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth` },
    });
    if (error) throw error;
  }

  async function signOut() {
    await supabase.auth.signOut();
    saveCachedProfile(null);
    setProfile(null);
  }

  // Send a password-reset email. The link redirects back to /auth where the
  // PASSWORD_RECOVERY event is handled to show the new-password form.
  async function resetPassword(email) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth`,
    });
    if (error) throw error;
  }

  // Called after the user clicks the reset link and fills in a new password.
  async function updatePassword(newPassword) {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
  }

  // Resend the sign-up confirmation email (for users who never got it).
  async function resendVerification(email) {
    const { error } = await supabase.auth.resend({ type: 'signup', email });
    if (error) throw error;
  }

  // Exposed so consumers (e.g. AuthPage) can update profile state AND cache
  // together without having to call saveCachedProfile manually.
  function setProfileAndCache(prof) {
    setProfile(prof);
    saveCachedProfile(prof);
  }

  return (
    <AuthContext.Provider value={{ session, profile, setProfile: setProfileAndCache, loading, signUp, signIn, signInWithGoogle, signOut, resetPassword, updatePassword, resendVerification }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
