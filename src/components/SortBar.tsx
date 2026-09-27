import React, { useEffect, useRef, useState } from 'react';
import { ArrowDownUp, ArrowDown01, ArrowUp10, Check, ChevronDown } from 'lucide-react';
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
  // Small inline version, for the pagination row.
  compact?: boolean;
}

export const SortBar: React.FC<SortBarProps> = ({ sort, onChange, actions, compact = false }) => {
  const { t } = useI18n();
  const { keys, direction } = sort;
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  // Clicking adds a key after the ones already chosen, or removes it.
  const toggle = (key: SortKey) =>
    onChange({ keys: keys.includes(key) ? keys.filter(k => k !== key) : [...keys, key], direction });

  // Close the menu when clicking anywhere else.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
    };
  }, [open]);

  const summary =
    keys.length === 0
      ? t('Original')
      : keys.map(k => t(SORT_OPTIONS.find(o => o.key === k)!.label)).join(' › ');
  const item = (active: boolean) =>
    `w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md text-start transition-colors ${
      active ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'
    }`;

  return (
    <div className={`flex flex-wrap items-center gap-2 ${actions === undefined && compact ? '' : 'mb-4'}`}>
      <div ref={boxRef} className="relative">
        <button
          onClick={() => setOpen(o => !o)}
          aria-expanded={open}
          className={`inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 text-xs font-medium border rounded-lg transition-colors ${
            open || keys.length > 0
              ? 'border-slate-900 bg-slate-900 text-white'
              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
          }`}
        >
          <ArrowDownUp className="w-3.5 h-3.5" />
          <span className={compact ? 'hidden md:inline' : ''}>{t('Ordenar por:')}</span>
          <span className="font-semibold max-w-[7rem] sm:max-w-[12rem] truncate">{summary}</span>
          {direction === 'asc' ? <ArrowDown01 className="w-3.5 h-3.5 opacity-80" /> : <ArrowUp10 className="w-3.5 h-3.5 opacity-80" />}
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>

        {open && (
          <div className="absolute start-0 top-full mt-1.5 z-30 w-64 p-1.5 bg-white border border-slate-200 rounded-xl shadow-xl">
            <p className="px-3 pt-1 pb-2 text-[11px] text-slate-400">
              {t('Puedes marcar varios: se ordena en el orden en que los marcas')}
            </p>
            <button onClick={() => onChange({ keys: [], direction })} className={item(keys.length === 0)}>
              {t('Original')}
            </button>
            {SORT_OPTIONS.map(opt => {
              const pos = keys.indexOf(opt.key);
              const active = pos >= 0;
              return (
                <button key={opt.key} onClick={() => toggle(opt.key)} className={item(active)}>
                  <span className="flex-1">{t(opt.label)}</span>
                  {active && keys.length > 1 && (
                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-400 text-slate-950 text-[11px] font-bold">
                      {pos + 1}
                    </span>
                  )}
                  {active && keys.length === 1 && <Check className="w-4 h-4" />}
                </button>
              );
            })}
            <div className="my-1.5 border-t border-slate-100" />
            <div className="grid grid-cols-2 gap-1">
              {(['asc', 'desc'] as SortDirection[]).map(d => (
                <button
                  key={d}
                  onClick={() => onChange({ keys, direction: d })}
                  className={`${item(direction === d)} justify-center text-xs`}
                >
                  {d === 'asc' ? <ArrowDown01 className="w-3.5 h-3.5" /> : <ArrowUp10 className="w-3.5 h-3.5" />}
                  {t(d === 'asc' ? 'Ascendente' : 'Descendente')}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      {actions && <div className="ms-auto flex items-center gap-2">{actions}</div>}
    </div>
  );
};
