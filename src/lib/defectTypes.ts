import { createContext, useContext } from 'react';
import { supabase } from './supabase';

// The defect types offered in the forms, and the measurements each one needs:
// area = Width × Height (m), linear = Linear metres (m), quantity = Quantity.
// Kept in the `defect_types` table (supabase/defect-types.sql) and managed from the Edit defect
// form ("Manage types"); this list is used until that table exists.
export type MeasureKind = 'area' | 'linear' | 'quantity';

export interface DefectType {
  name: string;
  measures: MeasureKind[];
  hidden?: boolean;
}

export const DEFECT_TYPES: DefectType[] = [
  { name: 'RENDER REPAIR', measures: ['area'] },
  { name: 'RESEALING WORKS', measures: ['linear'] },
  { name: 'SKIM RENDERING', measures: ['area'] },
  { name: 'SEAL WINDOW FRAME', measures: ['linear'] },
  { name: 'RENDER REPAIR TO SLAB EDGE', measures: ['area'] },
  { name: 'RUST SPOT', measures: ['quantity'] },
  { name: 'RUST PIPE', measures: ['quantity'] },
  { name: 'CONCRETE SPALLING', measures: ['area'] },
  // Any of the three is enough.
  { name: 'DILAPIDATION', measures: ['area', 'linear', 'quantity'] },
];

export const STAGES = ['STAGE 1', 'STAGE 2', 'STAGE 3', 'STAGE 4', 'STAGE 5', 'STAGE 6', 'STAGE 7', 'STAGE 8'];

export const MEASURE_SHORT: Record<MeasureKind, string> = { area: 'm²', linear: 'Lm', quantity: 'Qty' };

const byName = (a: DefectType, b: DefectType) => a.name.localeCompare(b.name);

// Measurements of a defect type; types outside the list (older data) may use any of them.
export const measuresFor = (defect: string, types: DefectType[] = DEFECT_TYPES): MeasureKind[] =>
  types.find(d => d.name === defect.trim().toUpperCase())?.measures || ['area', 'linear', 'quantity'];

export async function fetchDefectTypes(): Promise<DefectType[]> {
  if (!supabase) return [...DEFECT_TYPES].sort(byName);
  const { data, error } = await supabase.from('defect_types').select('name, measures, hidden');
  if (error || !data || data.length === 0) return [...DEFECT_TYPES].sort(byName);
  return (data as DefectType[]).sort(byName);
}

export async function saveDefectType(type: DefectType): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('defect_types').upsert({ ...type, name: type.name.trim().toUpperCase() });
  if (error) throw error;
}

export async function deleteDefectType(name: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('defect_types').delete().eq('name', name);
  if (error) throw error;
}

// Renaming creates the new name and removes the old one (only for types no defect uses).
export async function renameDefectType(type: DefectType, newName: string): Promise<void> {
  await saveDefectType({ ...type, name: newName });
  await deleteDefectType(type.name);
}

// The catalogue, shared by the forms; `reload` after managing it.
export const DefectTypesContext = createContext<{ types: DefectType[]; reload: () => void }>({
  types: [...DEFECT_TYPES].sort(byName),
  reload: () => {},
});
export const useDefectTypes = () => useContext(DefectTypesContext);
