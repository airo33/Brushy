import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { isConfigured, supabase } from './supabase';
import { startStatsPush } from './friends';
import { clearLocalAccountData, startSync, stopSync, syncNow } from './sync';

interface AuthCtx {
  /** False when Supabase isn't set up: the app then works without accounts. */
  configured: boolean;
  /** True until the saved session (if any) has been read. */
  loading: boolean;
  email: string | null;
  userId: string | null;
  signedIn: boolean;
  syncError: string | null;
  signUp: (email: string, password: string) => Promise<{ error?: string; needsConfirmation?: boolean }>;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  /** Backs up first. Without force, a failed backup cancels the sign-out so nothing is lost. */
  signOut: (force?: boolean) => Promise<{ error?: string }>;
  deleteAccount: () => Promise<{ error?: string }>;
  /** Emails a one-time code that proves the address belongs to the user. */
  requestPasswordReset: (email: string) => Promise<{ error?: string }>;
  /** Checks the emailed code. On success the user is signed in, ready to choose a new password. */
  verifyResetCode: (email: string, code: string) => Promise<{ error?: string }>;
  /** Sets a new password for the signed-in user. */
  setNewPassword: (password: string) => Promise<{ error?: string }>;
  /** Changes the password after checking the current one. */
  changePassword: (current: string, next: string) => Promise<{ error?: string }>;
  syncNow: () => Promise<void>;
}

const AuthContext = createContext<AuthCtx>({
  configured: false,
  loading: false,
  email: null,
  userId: null,
  signedIn: false,
  syncError: null,
  signUp: async () => ({ error: 'Accounts are not set up.' }),
  signIn: async () => ({ error: 'Accounts are not set up.' }),
  signOut: async () => ({}),
  deleteAccount: async () => ({ error: 'Accounts are not set up.' }),
  requestPasswordReset: async () => ({ error: 'Accounts are not set up.' }),
  verifyResetCode: async () => ({ error: 'Accounts are not set up.' }),
  setNewPassword: async () => ({ error: 'Accounts are not set up.' }),
  changePassword: async () => ({ error: 'Accounts are not set up.' }),
  syncNow: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(isConfigured);
  const [syncError, setSyncError] = useState<string | null>(null);
  const userId = session?.user.id ?? null;

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  // Signed in: sync once now, then keep pushing local edits. Signed out: stop.
  useEffect(() => {
    if (!userId) {
      stopSync();
      return;
    }
    setSyncError(null);
    startSync(userId);
    const stopStats = startStatsPush(userId);
    syncNow(userId).catch((e) => setSyncError(e?.message ?? 'Could not sync'));
    return () => {
      stopStats();
      stopSync();
    };
  }, [userId]);

  const signUp: AuthCtx['signUp'] = useCallback(async (email, password) => {
    if (!supabase) return { error: 'Accounts are not set up.' };
    const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
    if (error) return { error: error.message };
    // With email confirmation switched on there is no session until the link is tapped.
    return { needsConfirmation: !data.session };
  }, []);

  const signIn: AuthCtx['signIn'] = useCallback(async (email, password) => {
    if (!supabase) return { error: 'Accounts are not set up.' };
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    return error ? { error: error.message } : {};
  }, []);

  const requestPasswordReset: AuthCtx['requestPasswordReset'] = useCallback(async (email) => {
    if (!supabase) return { error: 'Accounts are not set up.' };
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
    return error ? { error: error.message } : {};
  }, []);

  const verifyResetCode: AuthCtx['verifyResetCode'] = useCallback(async (email, code) => {
    if (!supabase) return { error: 'Accounts are not set up.' };
    const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'recovery' });
    return error ? { error: error.message } : {};
  }, []);

  const setNewPassword: AuthCtx['setNewPassword'] = useCallback(async (password) => {
    if (!supabase) return { error: 'Accounts are not set up.' };
    const { error } = await supabase.auth.updateUser({ password });
    return error ? { error: error.message } : {};
  }, []);

  const changePassword: AuthCtx['changePassword'] = useCallback(
    async (current, next) => {
      if (!supabase) return { error: 'Accounts are not set up.' };
      const email = session?.user.email;
      if (!email) return { error: 'You are not signed in.' };
      // Re-check the current password so a borrowed unlocked phone can't change it.
      const check = await supabase.auth.signInWithPassword({ email, password: current });
      if (check.error) return { error: 'Your current password is not correct.' };
      const { error } = await supabase.auth.updateUser({ password: next });
      return error ? { error: error.message } : {};
    },
    [session],
  );

  const signOut: AuthCtx['signOut'] = useCallback(
    async (force = false) => {
      if (!supabase) return {};
      // Back up the latest changes first, because signing out clears them from the phone.
      // If that fails (for example offline), stop instead of silently losing them.
      if (userId && !force) {
        try {
          await syncNow(userId);
        } catch {
          return { error: 'Your latest changes could not be backed up. Check your connection and try again.' };
        }
      }
      stopSync();
      await supabase.auth.signOut();
      await clearLocalAccountData();
      return {};
    },
    [userId],
  );

  const deleteAccount: AuthCtx['deleteAccount'] = useCallback(async () => {
    if (!supabase) return { error: 'Accounts are not set up.' };
    const { error } = await supabase.rpc('delete_my_account');
    if (error) return { error: error.message };
    stopSync();
    await supabase.auth.signOut();
    // The data is gone from the account; the phone keeps its own copy.
    return {};
  }, []);

  const value = useMemo<AuthCtx>(
    () => ({
      configured: isConfigured,
      loading,
      email: session?.user.email ?? null,
      userId,
      signedIn: Boolean(session),
      syncError,
      signUp,
      signIn,
      signOut,
      deleteAccount,
      requestPasswordReset,
      verifyResetCode,
      setNewPassword,
      changePassword,
      syncNow: async () => {
        if (!userId) return;
        try {
          setSyncError(null);
          await syncNow(userId);
        } catch (e: any) {
          setSyncError(e?.message ?? 'Could not sync');
        }
      },
    }),
    [loading, session, syncError, signUp, signIn, signOut, deleteAccount, requestPasswordReset, verifyResetCode, setNewPassword, changePassword, userId],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
