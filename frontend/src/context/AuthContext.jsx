import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../utils/supabase';
import { getProfile, lookupEmail } from '../utils/api';

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
    } catch {
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
    // If login doesn't look like an email, resolve it to one via username lookup.
    let email = login;
    if (!login.includes('@')) {
      const result = await lookupEmail(login); // throws on 404
      email = result.email;
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
