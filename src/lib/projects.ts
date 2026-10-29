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
