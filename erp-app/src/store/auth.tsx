import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { ROLE_CAPABILITIES, type Capability, type Role } from '@/lib/capabilities';
import { supabase } from '@/lib/supabase';

export type StaffProfile = {
  id: string;
  full_name: string;
  phone: string | null;
  role: Role;
  status: 'active' | 'deactivated';
};

type AuthStatus = 'loading' | 'signedOut' | 'signedIn';

type AuthContextValue = {
  status: AuthStatus;
  session: Session | null;
  profile: StaffProfile | null;
  role: Role | null;
  capabilities: Capability[];
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<StaffProfile | null>(null);
  const [capabilities, setCapabilities] = useState<Capability[]>([]);
  const loadedProfileFor = useRef<string | null>(null);

  const loadProfile = useCallback(async (nextSession: Session | null) => {
    if (!nextSession) {
      loadedProfileFor.current = null;
      setProfile(null);
      setCapabilities([]);
      return;
    }
    if (loadedProfileFor.current === nextSession.user.id) return;

    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, phone, role, status')
      .eq('auth_user_id', nextSession.user.id)
      .maybeSingle();

    if (error || !data) {
      setProfile(null);
      setCapabilities([]);
      return;
    }

    loadedProfileFor.current = nextSession.user.id;
    setProfile(data);
    setCapabilities(ROLE_CAPABILITIES[data.role] ?? []);

    // The database table is the source of truth; the static map above is the
    // fallback for the moment before this returns or if it fails.
    const { data: rows } = await supabase
      .from('role_capabilities')
      .select('capability')
      .eq('role', data.role);

    if (rows && rows.length > 0) {
      setCapabilities(rows.map((row) => row.capability as Capability));
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    supabase.auth.getSession().then(async ({ data }) => {
      if (cancelled) return;
      setSession(data.session);
      await loadProfile(data.session);
      if (!cancelled) setStatus(data.session ? 'signedIn' : 'signedOut');
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (!nextSession) {
        loadProfile(null);
        setStatus('signedOut');
        return;
      }
      setStatus('signedIn');
      void loadProfile(nextSession);
    });

    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) throw new Error(error.message);
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    loadedProfileFor.current = null;
    setProfile(null);
    setCapabilities([]);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      session,
      profile,
      role: profile?.role ?? null,
      capabilities,
      signIn,
      signOut,
    }),
    [status, session, profile, capabilities, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}

export function useCapabilities() {
  const { capabilities } = useAuth();
  return {
    capabilities,
    can: (capability: Capability) => capabilities.includes(capability),
  };
}
