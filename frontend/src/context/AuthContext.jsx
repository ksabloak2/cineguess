import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../utils/supabase';
import { getProfile, lookupEmail, registerProfile } from '../utils/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession]   = useState(null);
  const [profile, setProfile]   = useState(null);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    // Load initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchProfile();
      else setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) fetchProfile();
      else { setProfile(null); setLoading(false); }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function fetchProfile() {
    try {
      const prof = await getProfile();
      setProfile(prof);
    } catch (err) {
      // Profile row doesn't exist yet — happens right after email verification
      // when registerProfile hasn't been called. Auto-register with the pending
      // username stored during signup so users never have to enter it twice.
      if (err?.response?.status === 404) {
        const pending = localStorage.getItem('pending_username');
        if (pending) {
          try {
            const prof = await registerProfile(pending);
            setProfile(prof);
            localStorage.removeItem('pending_username');
            localStorage.removeItem('pending_email');
            return;
          } catch {
            // Username taken or other error — fall through, profile stays null
          }
        }
      }
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }

  async function signUp(email, password) {
    const { data, error } = await supabase.auth.signUp({ email, password });
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

  async function signOut() {
    await supabase.auth.signOut();
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

  return (
    <AuthContext.Provider value={{ session, profile, setProfile, loading, signUp, signIn, signOut, resetPassword, updatePassword, resendVerification }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
