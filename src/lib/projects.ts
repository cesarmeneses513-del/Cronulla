import { supabase } from './supabase';

// Buildings in the app (supabase/projects.sql). Cronulla is edited by the team; the others are
// for viewing.
export interface Project {
  id: string;
  name: string;
  address: string;
  cover_url: string;
  editable: boolean;
  position: number;
  // Buildings of one complex share it (supabase/projects-sites.sql); empty for a building on its own.
  site?: string;
  // The whole complex's photo, for the site's card (any of its buildings may carry it).
  site_cover_url?: string;
  // Facade reference drawing (FCRS) of each stage, uploaded from the web (supabase/projects-media.sql).
  stage_images?: Record<string, string>;
}

// ─────────────── Administrators: editing a project ───────────────

export async function updateProject(id: string, changes: Partial<Omit<Project, 'id'>>): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('projects').update(changes).eq('id', id);
  if (error) throw error;
}

// The site photo is kept on every building of the site (whichever shows first on the card).
export async function updateSiteCover(site: string, url: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('projects').update({ site_cover_url: url }).eq('site', site);
  if (error) throw error;
}

// The stages (faces) a project's defects use, for its drawings.
export async function fetchProjectStages(id: string): Promise<string[]> {
  if (!supabase) return [];
  const seen = new Set<string>();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('defects').select('stage:data->>orientation').eq('project_id', id).range(from, from + 999);
    if (error) throw error;
    (data as { stage: string | null }[]).forEach(r => seen.add((r.stage || '').toUpperCase().replace(/[.\s]+$/, '').replace(/\s+/g, ' ').trim()));
    if (data.length < 1000) break;
  }
  return [...seen].sort((a, b) => (a === '' ? 1 : b === '' ? -1 : a.localeCompare(b, undefined, { numeric: true })));
}

export { DEFAULT_PROJECT, CHOSEN_PROJECT, CURRENT_PROJECT, PICKING_PROJECT, openProject } from './currentProject';

// The projects this person can see, or null when the database has no projects yet (before
// projects.sql): then there is only Cronulla, as before.
export async function fetchProjects(): Promise<Project[] | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.from('projects').select('*').order('position').order('name');
  if (error) return null;
  return data as Project[];
}

export interface ProjectStats {
  total: number;
  completed: number;
}

// Defects and completed defects of each project, for the project cards.
export async function fetchProjectStats(ids: string[]): Promise<Record<string, ProjectStats>> {
  const out: Record<string, ProjectStats> = {};
  if (!supabase) return out;
  await Promise.all(
    ids.map(async id => {
      const [all, done] = await Promise.all([
        supabase!.from('defects').select('id', { count: 'exact', head: true }).eq('project_id', id),
        supabase!.from('defects').select('id', { count: 'exact', head: true }).eq('project_id', id).eq('data->>status', 'COMPLETED'),
      ]);
      out[id] = { total: all.count ?? 0, completed: done.count ?? 0 };
    })
  );
  return out;
}

// ─────────────── Administrators: which projects a client sees ───────────────

export interface ProjectAccess {
  all: boolean;
  ids: string[];
}

export async function fetchProjectAccess(userId: string): Promise<ProjectAccess> {
  if (!supabase) return { all: false, ids: [] };
  const [profile, rows] = await Promise.all([
    supabase.from('profiles').select('all_projects').eq('id', userId).maybeSingle(),
    supabase.from('project_access').select('project_id').eq('user_id', userId),
  ]);
  if (profile.error) throw profile.error;
  if (rows.error) throw rows.error;
  return {
    all: !!(profile.data as { all_projects?: boolean } | null)?.all_projects,
    ids: (rows.data as { project_id: string }[]).map(r => r.project_id),
  };
}

// Everyone's chosen projects, by account (administrators: the users list).
export async function fetchAllProjectAccess(): Promise<Record<string, string[]>> {
  const out: Record<string, string[]> = {};
  if (!supabase) return out;
  const { data, error } = await supabase.from('project_access').select('user_id, project_id');
  if (error) return out;
  (data as { user_id: string; project_id: string }[]).forEach(r => (out[r.user_id] ||= []).push(r.project_id));
  return out;
}

export async function saveProjectAccess(userId: string, access: ProjectAccess): Promise<void> {
  if (!supabase) return;
  const { error: e1 } = await supabase.from('profiles').update({ all_projects: access.all }).eq('id', userId);
  if (e1) throw e1;
  const { error: e2 } = await supabase.from('project_access').delete().eq('user_id', userId);
  if (e2) throw e2;
  if (access.ids.length > 0) {
    const { error: e3 } = await supabase
      .from('project_access')
      .insert(access.ids.map(project_id => ({ user_id: userId, project_id })));
    if (e3) throw e3;
  }
}
