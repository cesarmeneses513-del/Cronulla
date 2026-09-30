import React, { useEffect, useState } from 'react';
import { X, Download, Check, SlidersHorizontal } from 'lucide-react';
import { useI18n, STATUS_LABEL, URGENCY_LABEL } from '../i18n';
import { DefectItem, FilterState } from '../types/inspection';
import { FilterPanel } from './FilterBar';
import { EXPORT_COLUMNS } from '../utils/csvParser';

const COLUMNS_KEY = 'cronulla_export_columns';

// The columns chosen last time on this device (all of them the first time).
const storedColumns = (): string[] => {
  try {
    const saved = JSON.parse(localStorage.getItem(COLUMNS_KEY) || 'null');
    if (Array.isArray(saved)) {
      const valid = saved.filter((k: unknown) => EXPORT_COLUMNS.some(c => c.key === k));
      if (valid.length > 0) return valid;
    }
  } catch {}
  return EXPORT_COLUMNS.map(c => c.key);
};

interface ExportCsvModalProps {
  totalCount: number;
  filteredCount: number;
  // The filters, editable right here (what "only the filtered ones" exports).
  items: DefectItem[];
  filters: FilterState;
  onFilterChange: (next: FilterState) => void;
  onClose: () => void;
  // `onlyFiltered`: just the defects the current filters show.
  onExport: (columns: string[], onlyFiltered: boolean) => void;
}

export const ExportCsvModal: React.FC<ExportCsvModalProps> = ({ totalCount, filteredCount, items, filters, onFilterChange, onClose, onExport }) => {
  const { t } = useI18n();
  const [showFilters, setShowFilters] = useState(false);
  // Active filters as "label: values" lines.
  const activeFilters: { label: string; values: string[] }[] = [
    { label: t('Buscar'), values: filters.searchQuery.trim() ? [`"${filters.searchQuery.trim()}"`] : [] },
    { label: t('Stage'), values: filters.orientations },
    { label: t('Tipo de Defecto'), values: filters.defects },
    { label: t('Drop'), values: filters.drops },
    { label: t('Nivel'), values: filters.levels },
    { label: t('Estado'), values: filters.statuses.map(s => t(STATUS_LABEL[s] || s)) },
    { label: t('Urgencia'), values: filters.urgencies.map(u => t(URGENCY_LABEL[u] || u)) },
    { label: t('Última modificación por'), values: filters.technicians },
    { label: t('Fotos'), values: [...(filters.hasPhotosOnly ? [t('Con fotos')] : []), ...(filters.noPhotosOnly ? [t('Sin fotos')] : [])] },
  ].filter(f => f.values.length > 0);
  const filterCount = activeFilters.reduce((n, f) => n + f.values.length, 0);
  const [chosen, setChosen] = useState<string[]>(storedColumns);
  const filtered = filteredCount < totalCount;
  const [onlyFiltered, setOnlyFiltered] = useState(filtered);
  // Filters changed here: export what they show.
  useEffect(() => setOnlyFiltered(filtered), [filtered]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const toggle = (key: string) => setChosen(c => (c.includes(key) ? c.filter(k => k !== key) : [...c, key]));
  const download = () => {
    // Kept in the dialog's order, whatever order they were ticked in.
    const columns = EXPORT_COLUMNS.map(c => c.key).filter(k => chosen.includes(k));
    try {
      localStorage.setItem(COLUMNS_KEY, JSON.stringify(columns));
    } catch {}
    onExport(columns, onlyFiltered);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-start sm:items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className={`w-full ${showFilters ? 'max-w-3xl' : 'max-w-xl'} bg-white rounded-xl shadow-2xl border border-slate-200`} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Download className="w-4 h-4 text-slate-500" />
            {t('Exportar')} CSV
          </h2>
          <button onClick={onClose} className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Which defects */}
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-slate-700">{t('Defectos')}</p>
            <div className="flex flex-wrap gap-2">
              {[
                { value: false, label: t('Todos ({n})', { n: totalCount }) },
                { value: true, label: t('Solo los filtrados ({n})', { n: filteredCount }), disabled: !filtered },
              ].map(o => (
                <button
                  key={String(o.value)}
                  disabled={o.disabled}
                  onClick={() => setOnlyFiltered(o.value)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors disabled:opacity-40 ${
                    onlyFiltered === o.value ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {o.label}
                </button>
              ))}
              <button
                onClick={() => setShowFilters(s => !s)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                  showFilters ? 'bg-slate-100 border-slate-300 text-slate-900' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                {t('Filtros')}
                {filterCount > 0 && (
                  <span className="px-1.5 rounded-full bg-amber-400 text-slate-950 text-[10px] font-bold">{filterCount}</span>
                )}
              </button>
            </div>
            {/* The same filter options as the filters panel: changing them updates the count above */}
            {showFilters && (
              <div className="mt-2 p-3 rounded-lg border border-slate-200 bg-slate-50 max-h-[50vh] overflow-y-auto">
                <FilterPanel items={items} filters={filters} onFilterChange={onFilterChange} compact />
              </div>
            )}
          </div>

          {/* Which columns */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-slate-700">{t('Columnas')}</p>
              <div className="flex gap-3 text-xs">
                <button onClick={() => setChosen(EXPORT_COLUMNS.map(c => c.key))} className="font-medium text-slate-700 hover:text-slate-900 hover:underline">
                  {t('Todas')}
                </button>
                <button onClick={() => setChosen([])} className="font-medium text-slate-700 hover:text-slate-900 hover:underline">
                  {t('Ninguna')}
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
              {EXPORT_COLUMNS.map(c => {
                const on = chosen.includes(c.key);
                return (
                  <button
                    key={c.key}
                    onClick={() => toggle(c.key)}
                    className={`flex items-center gap-2 px-2.5 py-1.5 text-xs text-start rounded-md border transition-colors ${
                      on ? 'bg-slate-50 border-slate-300 text-slate-900' : 'bg-white border-slate-100 text-slate-400'
                    }`}
                  >
                    <span className={`w-4 h-4 shrink-0 rounded border flex items-center justify-center ${on ? 'bg-slate-900 border-slate-900' : 'border-slate-300'}`}>
                      {on && <Check className="w-3 h-3 text-white" />}
                    </span>
                    {t(c.label)}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-slate-200">
          <button onClick={onClose} className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900">
            {t('Cancelar')}
          </button>
          <button
            onClick={download}
            disabled={chosen.length === 0}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-40 rounded-lg"
          >
            <Download className="w-3.5 h-3.5" />
            {t('Descargar')}
          </button>
        </div>
      </div>
    </div>
  );
};
