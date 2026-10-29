// The project this page shows (no imports here: the database layer and the app both use it).
// It is chosen before the app loads its defects; switching reloads the page, so every query
// and live update is scoped to it.
export const DEFAULT_PROJECT = 'cronulla';
const KEY = 'cronulla_project';

const stored = (): string | null => {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
};

// Chosen on this device, or Cronulla (the team's project) when none was chosen yet.
export const CHOSEN_PROJECT = stored();
export const CURRENT_PROJECT = CHOSEN_PROJECT || DEFAULT_PROJECT;

// The list of projects was asked for (header → Projects): shown instead of the open project.
const PICK_KEY = 'cronulla_pick_project';
export const PICKING_PROJECT = (() => {
  try {
    return sessionStorage.getItem(PICK_KEY) === '1';
  } catch {
    return false;
  }
})();

// Opens a project, or with null the list of projects: the app reloads for it.
export function openProject(id: string | null) {
  try {
    if (id) {
      localStorage.setItem(KEY, id);
      sessionStorage.removeItem(PICK_KEY);
    } else sessionStorage.setItem(PICK_KEY, '1');
  } catch {}
  window.location.reload();
}
