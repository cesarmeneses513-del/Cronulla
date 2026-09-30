import { createContext, useContext } from 'react';
import { supabase } from './supabase';

// What each role may do (supabase/roles.sql keeps the same list and defaults).
export type Permission =
  | 'defects.create'
  | 'defects.edit'
  | 'photos.add'
  | 'photos.move'
  | 'photos.delete'
  | 'defects.delete'
  | 'history.view'
  | 'csv.import'
  | 'csv.export'
  | 'renumber'
  | 'users.manage';

export type RoleKey = 'admin' | 'project_manager' | 'team_leader' | 'technician' | 'client';

export const ROLES: { role: RoleKey; label: string }[] = [
  { role: 'admin', label: 'Administrador' },
  { role: 'project_manager', label: 'Project Manager' },
  { role: 'team_leader', label: 'Team Leader / Supervisor' },
  { role: 'technician', label: 'Facade Technician (Editor)' },
  { role: 'client', label: 'Cliente' },
];

export const JOB_TITLES = ['Inspector', 'Senior Inspector', 'Team Leader', 'Tradesperson', 'Supervisor', 'Manager'];

// Labels are Spanish source text, translated where shown.
export const PERMISSIONS: { key: Permission; label: string }[] = [
  { key: 'defects.create', label: 'Crear defectos' },
  { key: 'defects.edit', label: 'Editar defectos y medidas' },
  { key: 'photos.add', label: 'Subir fotos' },
  { key: 'photos.move', label: 'Mover fotos' },
  { key: 'photos.delete', label: 'Borrar fotos' },
  { key: 'defects.delete', label: 'Borrar defectos' },
  { key: 'history.view', label: 'Ver Historial' },
  { key: 'csv.import', label: 'Importar CSV' },
  { key: 'csv.export', label: 'Exportar CSV' },
  { key: 'renumber', label: 'Ordenar y renumerar' },
  { key: 'users.manage', label: 'Gestionar usuarios y permisos' },
];

const ALL = PERMISSIONS.map(p => p.key);
export const DEFAULT_PERMISSIONS: Record<RoleKey, Permission[]> = {
  admin: ALL,
  project_manager: ALL.filter(p => p !== 'csv.import' && p !== 'users.manage'),
  team_leader: ['defects.create', 'defects.edit', 'photos.add', 'photos.move', 'photos.delete', 'history.view', 'csv.export'],
  technician: ['defects.create', 'defects.edit', 'photos.add', 'history.view'],
  client: ['csv.export'],
};

export type PermissionTable = Record<RoleKey, Set<Permission>>;

export const defaultTable = (): PermissionTable =>
  Object.fromEntries(ROLES.map(r => [r.role, new Set(DEFAULT_PERMISSIONS[r.role])])) as PermissionTable;

// The table as saved by the administrators; defaults for anything not saved yet.
export async function fetchPermissionTable(): Promise<PermissionTable> {
  const table = defaultTable();
  if (!supabase) return table;
  const { data, error } = await supabase.from('role_permissions').select('role, permission, allowed');
  if (error || !data) return table;
  (data as { role: RoleKey; permission: Permission; allowed: boolean }[]).forEach(r => {
    if (!table[r.role]) return;
    if (r.allowed) table[r.role].add(r.permission);
    else table[r.role].delete(r.permission);
  });
  table.admin = new Set(ALL); // administrators can always do everything
  return table;
}

export async function savePermission(role: RoleKey, permission: Permission, allowed: boolean): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('role_permissions').upsert({ role, permission, allowed });
  if (error) throw error;
}

// `can('photos.delete')` anywhere in the app.
export const PermissionsContext = createContext<(p: Permission) => boolean>(() => false);
export const useCan = () => useContext(PermissionsContext);
