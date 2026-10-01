import { supabase } from './supabase';
import type { RoleKey } from './permissions';

// Accounts (supabase/accounts.sql + roles.sql). Each person signs in with email and password;
// their role, job title and whether they're active are kept in `profiles`.
export type AccountRole = RoleKey | 'pending';

export interface Profile {
  id: string;
  email: string;
  name: string;
  role: AccountRole;
  job_title?: string;
  active?: boolean;
  created_at?: string;
  last_seen_at?: string | null;
}

export interface Invitation {
  email: string;
  name: string;
  role: RoleKey;
  job_title: string;
  invited_by?: string;
  created_at?: string;
}

const PROFILES = 'profiles';

// Accounts that can use the app with their role (not pending, not inactive). Before roles.sql
// the old levels "user" / "disabled" may still come back.
export const isUsable = (p?: Profile | null) =>
  !!p && p.active !== false && p.role !== 'pending' && (p.role as string) !== 'disabled';
// Old "user" level = Facade Technician.
export const roleOf = (p: Profile): RoleKey => ((p.role as string) === 'user' ? 'technician' : (p.role as RoleKey));

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

// ─────────────── Administrators ───────────────

export async function listProfiles(): Promise<Profile[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from(PROFILES).select('*').order('created_at');
  if (error) throw error;
  return data as Profile[];
}

// Roles with "Ver técnicos conectados": the Facade Technicians (the database only returns those).
export async function listTechnicians(): Promise<Profile[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from(PROFILES).select('*').eq('role', 'technician').order('name');
  if (error) return [];
  return data as Profile[];
}

export async function updateProfile(
  id: string,
  changes: Partial<Pick<Profile, 'name' | 'role' | 'job_title' | 'active'>>
): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from(PROFILES).update(changes).eq('id', id);
  if (error) throw error;
}

export async function deleteAccount(id: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.rpc('delete_account', { target: id });
  if (error) throw error;
}

export async function listInvitations(): Promise<Invitation[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from('invitations').select('*').order('created_at');
  if (error) return []; // before roles.sql
  return data as Invitation[];
}

export async function saveInvitation(inv: Invitation): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('invitations').upsert({ ...inv, email: inv.email.trim().toLowerCase() });
  if (error) throw error;
}

export async function deleteInvitation(email: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('invitations').delete().eq('email', email);
  if (error) throw error;
}
