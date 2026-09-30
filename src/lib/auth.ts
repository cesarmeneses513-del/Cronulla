import { supabase } from './supabase';

// Accounts (supabase/accounts.sql). Each person signs in with email and password; their level
// is kept in `profiles` and given by an administrator.
export type AccountRole = 'admin' | 'user' | 'pending' | 'disabled';

export interface Profile {
  id: string;
  email: string;
  name: string;
  role: AccountRole;
  created_at?: string;
}

const PROFILES = 'profiles';

// Levels that can edit (admin also deletes and manages users).
export const canEdit = (role?: AccountRole | null) => role === 'admin' || role === 'user';

export async function fetchMyProfile(): Promise<Profile | null> {
  if (!supabase) return null;
  const { data: session } = await supabase.auth.getSession();
  const uid = session.session?.user.id;
  if (!uid) return null;
  const { data, error } = await supabase.from(PROFILES).select('*').eq('id', uid).maybeSingle();
  if (error) throw error;
  return (data as Profile) || null;
}

export async function signIn(email: string, password: string): Promise<Profile | null> {
  if (!supabase) throw new Error('Supabase no configurado');
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw error;
  return fetchMyProfile();
}

// Returns the new profile, or null when the account must first be confirmed from the email.
export async function signUp(name: string, email: string, password: string): Promise<Profile | null> {
  if (!supabase) throw new Error('Supabase no configurado');
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: { data: { name: name.trim() } },
  });
  if (error) throw error;
  return data.session ? fetchMyProfile() : null;
}

export async function signOut(): Promise<void> {
  if (!supabase) return;
  await supabase.auth.signOut();
}

// Administrators: everyone's account.
export async function listProfiles(): Promise<Profile[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from(PROFILES).select('*').order('created_at');
  if (error) throw error;
  return data as Profile[];
}

export async function updateProfile(id: string, changes: Partial<Pick<Profile, 'name' | 'role'>>): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from(PROFILES).update(changes).eq('id', id);
  if (error) throw error;
}
