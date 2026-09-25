import React from 'react';
import { ArrowDownUp, ArrowDown01, ArrowUp10 } from 'lucide-react';
import { DefectItem } from '../types/inspection';
import { useI18n } from '../i18n';

export type SortKey = 'number' | 'stage' | 'defect' | 'drop' | 'level';
export type SortDirection = 'asc' | 'desc';
// Sort keys in priority order; empty = original order.
export interface SortState {
  keys: SortKey[];
  direction: SortDirection;
}

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'number', label: 'Nº' },
  { key: 'stage', label: 'Stage' },
  { key: 'defect', label: 'Defecto (A-Z)' },
  { key: 'drop', label: 'Drop' },
  { key: 'level', label: 'Nivel' },
];

// Natural order so "STAGE 10" follows "STAGE 9" and "12" follows "2"; blanks go last.
const natural = (a: string, b: string) => {
  if (!a && b) return 1;
  if (a && !b) return -1;
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
};

// Floors bottom to top: G (ground), 1, 2, … then R (roof); blanks last.
const levelRank = (level: string) => {
  const v = level.trim().toUpperCase();
  if (!v) return Number.POSITIVE_INFINITY;
  if (v === 'G') return -1;
  if (v === 'R') return 100000;
  const n = parseFloat(v);
  return Number.isNaN(n) ? 50000 : n;
};

const COMPARE: Record<SortKey, (x: DefectItem, y: DefectItem) => number> = {
  number: (x, y) => natural(x.rowNo, y.rowNo),
  stage: (x, y) => natural(x.orientation, y.orientation),
  defect: (x, y) => natural(x.defect, y.defect),
  drop: (x, y) => natural(x.drop, y.drop),
  level: (x, y) => {
    const a = levelRank(x.level);
    const b = levelRank(y.level);
    if (a !== b) return a < b ? -1 : 1;
    return natural(x.level, y.level);
  },
};

export function sortDefects(items: DefectItem[], { keys, direction }: SortState): DefectItem[] {
  if (keys.length === 0) return direction === 'asc' ? items : [...items].reverse();
  const sign = direction === 'asc' ? 1 : -1;
  // Row number breaks remaining ties so the result is stable and predictable.
  const order: SortKey[] = keys.includes('number') ? keys : [...keys, 'number'];
  return [...items].sort((x, y) => {
    for (const key of order) {
      const c = COMPARE[key](x, y);
      if (c !== 0) return c * sign;
    }
    return 0;
  });
}

// Accepts the current shape and the older { mode } one kept in localStorage.
export function parseStoredSort(raw: unknown): SortState | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as { keys?: unknown; mode?: unknown; direction?: unknown };
  const direction: SortDirection = r.direction === 'desc' ? 'desc' : 'asc';
  const valid = (k: unknown): k is SortKey => SORT_OPTIONS.some(o => o.key === k);
  if (Array.isArray(r.keys)) return { keys: r.keys.filter(valid), direction };
  if (typeof r.mode === 'string') return { keys: valid(r.mode) ? [r.mode] : [], direction };
  return null;
}

interface SortBarProps {
  sort: SortState;
  onChange: (sort: SortState) => void;
  actions?: React.ReactNode;
}

export const SortBar: React.FC<SortBarProps> = ({ sort, onChange, actions }) => {
  const { t } = useI18n();
  const { keys, direction } = sort;
  // Clicking adds a key after the ones already chosen, or removes it.
  const toggle = (key: SortKey) =>
    onChange({ keys: keys.includes(key) ? keys.filter(k => k !== key) : [...keys, key], direction });

  return (
    <div className="flex flex-wrap items-center gap-2 mb-4">
      <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider me-1">
        <ArrowDownUp className="w-3.5 h-3.5" />
        {t('Ordenar por:')}
      </span>
      <div
        className="flex flex-wrap items-center gap-1 p-1 bg-white rounded-lg border border-slate-200"
        title={t('Puedes marcar varios: se ordena en el orden en que los marcas')}
      >
        <button
          onClick={() => onChange({ keys: [], direction })}
          className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
            keys.length === 0 ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          {t('Original')}
        </button>
        {SORT_OPTIONS.map(opt => {
          const pos = keys.indexOf(opt.key);
          const active = pos >= 0;
          return (
            <button
              key={opt.key}
              onClick={() => toggle(opt.key)}
              className={`inline-flex items-center gap-1 px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                active ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              {active && keys.length > 1 && (
                <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-amber-400 text-slate-950 text-[10px] font-bold">
                  {pos + 1}
                </span>
              )}
              {t(opt.label)}
            </button>
          );
        })}
      </div>
      <button
        onClick={() => onChange({ keys, direction: direction === 'asc' ? 'desc' : 'asc' })}
        title={t(direction === 'asc' ? 'Ascendente (clic para invertir)' : 'Descendente (clic para invertir)')}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors"
      >
        {direction === 'asc' ? <ArrowDown01 className="w-3.5 h-3.5" /> : <ArrowUp10 className="w-3.5 h-3.5" />}
        {t(direction === 'asc' ? 'Ascendente' : 'Descendente')}
      </button>
      {actions && <div className="ms-auto flex items-center gap-2">{actions}</div>}
    </div>
  );
};
