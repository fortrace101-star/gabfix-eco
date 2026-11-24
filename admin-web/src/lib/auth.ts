import type { PageId } from '../types';
import { supabase } from './supabase';

/** The desk roles the web console serves. Technicians and customers use the mobile apps. */
export type AdminRole = 'admin' | 'operations' | 'support';

export type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
  initials: string;
};

/** Database `app_role` → console role. Anything else is refused at sign-in. */
const ROLE_MAP: Record<string, AdminRole> = {
  admin: 'admin',
  manager: 'operations',
  customer_relations: 'support',
};

export const roleLabel = (role: AdminRole): string =>
  role === 'admin'
    ? 'Owner · full access'
    : role === 'operations'
      ? 'Operations · no settings'
      : 'Customer support · bookings & customers';

const initialsFor = (name: string): string => {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const first = parts[0]?.[0] ?? 'G';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return `${first}${last}`.toUpperCase();
};

const SESSION_KEY = 'gabfix.admin.session.v1';

export type SignInResult = { user: AdminUser } | { error: string };

/**
 * Signs in against Supabase Auth, then reads the profile so the console role comes
 * from the database (`app_role`) rather than a local list.
 */
export async function signIn(email: string, password: string): Promise<SignInResult> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });
  if (error || !data.user) {
    return { error: error?.message ?? 'That email and password did not sign in.' };
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, full_name, role, status')
    .eq('auth_user_id', data.user.id)
    .maybeSingle();

  if (profileError || !profile) {
    await supabase.auth.signOut();
    return { error: 'No staff profile is linked to this account.' };
  }
  if (profile.status !== 'active') {
    await supabase.auth.signOut();
    return { error: 'This account is deactivated. Ask an owner to reactivate it.' };
  }
  const role = ROLE_MAP[profile.role];
  if (!role) {
    await supabase.auth.signOut();
    return { error: 'This console is for admin, manager and customer-support accounts.' };
  }

  const user: AdminUser = {
    id: profile.id,
    name: profile.full_name,
    email: data.user.email ?? email,
    role,
    initials: initialsFor(profile.full_name),
  };
  try {
    window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
  } catch {
    // A blocked storage API only costs a re-fetch on the next load.
  }
  return { user };
}

/**
 * Restores the session on load. Supabase persists the auth token; the profile read
 * re-derives the role so a role change in the database takes effect on refresh.
 */
export async function restoreSession(): Promise<AdminUser | null> {
  const { data } = await supabase.auth.getSession();
  if (!data.session) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, role, status')
    .eq('auth_user_id', data.session.user.id)
    .maybeSingle();

  const role = profile ? ROLE_MAP[profile.role] : undefined;
  if (!profile || !role || profile.status !== 'active') {
    await supabase.auth.signOut();
    return null;
  }

  return {
    id: profile.id,
    name: profile.full_name,
    email: data.session.user.email ?? '',
    role,
    initials: initialsFor(profile.full_name),
  };
}

export async function signOut(): Promise<void> {
  try {
    window.sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // Ignore storage failures; App clears the in-memory user either way.
  }
  await supabase.auth.signOut();
}

/** Settings is owner-only; support sees the customer-facing modules only. */
export const canViewPage = (page: PageId, role: AdminRole): boolean => {
  if (role === 'admin') return true;
  if (role === 'operations') return page !== 'settings';
  return (
    page === 'overview' ||
    page === 'bookings' ||
    page === 'customers' ||
    page === 'payments'
  );
};
