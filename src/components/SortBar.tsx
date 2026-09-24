import React from 'react';
import { ArrowDownUp, ArrowDown01, ArrowUp10 } from 'lucide-react';
import { DefectItem } from '../types/inspection';

export type SortMode = 'original' | 'number' | 'stage' | 'defect';
export type SortDirection = 'asc' | 'desc';

const SORT_OPTIONS: { mode: SortMode; label: string }[] = [
  { mode: 'original', label: 'Original' },
  { mode: 'number', label: 'Nº' },
  { mode: 'stage', label: 'Stage' },
  { mode: 'defect', label: 'Defecto (A-Z)' },
];

// Natural order so "STAGE 10" follows "STAGE 9" and "12" follows "2"; blanks go last.
const natural = (a: string, b: string) => {
  if (!a && b) return 1;
  if (a && !b) return -1;
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
};

export function sortDefects(items: DefectItem[], mode: SortMode, direction: SortDirection): DefectItem[] {
  if (mode === 'original') return direction === 'asc' ? items : [...items].reverse();

  const keys: Record<Exclude<SortMode, 'original'>, (i: DefectItem) => string[]> = {
    number: i => [i.rowNo, i.orientation],
    stage: i => [i.orientation, i.rowNo],
    defect: i => [i.defect, i.orientation, i.rowNo],
  };
  const getKeys = keys[mode];
  const sign = direction === 'asc' ? 1 : -1;

  return [...items].sort((x, y) => {
    const kx = getKeys(x);
    const ky = getKeys(y);
    for (let n = 0; n < kx.length; n++) {
      const c = natural(kx[n] || '', ky[n] || '');
      if (c !== 0) return c * sign;
    }
    return 0;
  });
}

interface SortBarProps {
  mode: SortMode;
  direction: SortDirection;
  onChange: (mode: SortMode, direction: SortDirection) => void;
  actions?: React.ReactNode;
}

export const SortBar: React.FC<SortBarProps> = ({ mode, direction, onChange, actions }) => (
  <div className="flex flex-wrap items-center gap-2 mb-4">
    <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider mr-1">
      <ArrowDownUp className="w-3.5 h-3.5" />
      Ordenar por:
    </span>
    <div className="flex flex-wrap items-center gap-1 p-1 bg-white rounded-lg border border-slate-200">
      {SORT_OPTIONS.map(opt => (
        <button
          key={opt.mode}
          onClick={() => onChange(opt.mode, direction)}
          className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
            mode === opt.mode ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
    <button
      onClick={() => onChange(mode, direction === 'asc' ? 'desc' : 'asc')}
      title={direction === 'asc' ? 'Ascendente (clic para invertir)' : 'Descendente (clic para invertir)'}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors"
    >
      {direction === 'asc' ? <ArrowDown01 className="w-3.5 h-3.5" /> : <ArrowUp10 className="w-3.5 h-3.5" />}
      {direction === 'asc' ? 'Ascendente' : 'Descendente'}
    </button>
    {actions && <div className="ml-auto flex items-center gap-2">{actions}</div>}
  </div>
);
