import React, { useState } from 'react';
import { Search, X, SlidersHorizontal, LayoutGrid, Rows3, Grid3X3, Table2, Check } from 'lucide-react';
import { DefectItem, FilterState } from '../types/inspection';

export type ViewMode = 'rows' | 'photos' | 'matrix' | 'table';

interface FilterBarProps {
  items: DefectItem[];
  filters: FilterState;
  onFilterChange: (newFilters: FilterState) => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  filteredCount: number;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  items,
  filters,
  onFilterChange,
  viewMode,
  onViewModeChange,
  filteredCount,
}) => {
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Extract unique values
  const uniqueStages = Array.from(new Set(items.map(i => i.orientation).filter(Boolean))).sort();
  const uniqueDefects = Array.from(new Set(items.map(i => i.defect).filter(Boolean))).sort();
  const uniqueDrops = Array.from(new Set(items.map(i => i.drop).filter(Boolean))).sort((a, b) => Number(a) - Number(b));
  const uniqueLevels = Array.from(new Set(items.map(i => i.level).filter(Boolean))).sort((a, b) => {
    if (a === 'G') return -1;
    if (b === 'G') return 1;
    if (a === 'R') return 1;
    if (b === 'R') return -1;
    return Number(a) - Number(b);
  });
  const uniqueTechnicians = Array.from(
    new Set(
      items
        .flatMap(i => [i.technicianStart, i.technicianCompleted])
        .filter(Boolean)
        .map(t => t.trim())
    )
  ).sort();

  const activeFilterCount =
    (filters.searchQuery ? 1 : 0) +
    filters.orientations.length +
    filters.defects.length +
    filters.urgencies.length +
    filters.statuses.length +
    filters.drops.length +
    filters.levels.length +
    filters.technicians.length +
    (filters.hasPhotosOnly ? 1 : 0);

  const clearAllFilters = () => {
    onFilterChange({
      searchQuery: '',
      orientations: [],
      defects: [],
      urgencies: [],
      statuses: [],
      drops: [],
      levels: [],
      technicians: [],
      hasPhotosOnly: false,
    });
  };

  const toggleFilterItem = (category: keyof FilterState, value: string) => {
    const list = (filters[category] as string[]) || [];
    const next = list.includes(value) ? list.filter(v => v !== value) : [...list, value];
    onFilterChange({
      ...filters,
      [category]: next,
    });
  };

  return (
    <div className="bg-white border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 space-y-3">
        {/* Main Row: Search + Quick Category Chips + View Mode Switcher */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por defecto, drop, piso, técnico, nota..."
              value={filters.searchQuery}
              onChange={e => onFilterChange({ ...filters, searchQuery: e.target.value })}
              className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:border-slate-400 focus:bg-white transition-colors"
            />
            {filters.searchQuery && (
              <button
                onClick={() => onFilterChange({ ...filters, searchQuery: '' })}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600 rounded"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* View Mode Switcher */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg border border-slate-200">
            <button
              onClick={() => onViewModeChange('rows')}
              title="Vista de Filas & Inspección"
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                viewMode === 'rows'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Rows3 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Filas</span>
            </button>

            <button
              onClick={() => onViewModeChange('photos')}
              title="Mosaico de Todas las Fotografías"
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                viewMode === 'photos'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Mosaico</span>
            </button>

            <button
              onClick={() => onViewModeChange('matrix')}
              title="Elevación Fachada (Drop vs Piso)"
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                viewMode === 'matrix'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Grid3X3 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Elevación</span>
            </button>

            <button
              onClick={() => onViewModeChange('table')}
              title="Vista Tabla"
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                viewMode === 'table'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Table2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Tabla</span>
            </button>
          </div>

          {/* Toggle Advanced Filters & Reset */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border rounded-lg transition-colors ${
                showAdvanced || activeFilterCount > 0
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Filtros</span>
              {activeFilterCount > 0 && (
                <span className="ml-1 px-1.5 py-0.2 bg-amber-400 text-slate-950 font-bold rounded-full text-[10px]">
                  {activeFilterCount}
                </span>
              )}
            </button>

            {activeFilterCount > 0 && (
              <button
                onClick={clearAllFilters}
                className="text-xs text-rose-600 hover:text-rose-700 font-medium px-2 py-1 transition-colors"
              >
                Limpiar todo
              </button>
            )}
          </div>
        </div>

        {/* Quick Filter Bar: Status & Urgency */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider mr-1">
            Estado:
          </span>
          {(['BEFORE', 'IN PROGRESS', 'COMPLETED'] as const).map(st => {
            const isSelected = filters.statuses.includes(st);
            const label = st === 'BEFORE' ? 'Antes' : st === 'IN PROGRESS' ? 'En Progreso' : 'Completado';
            const count = items.filter(i => i.status === st).length;
            return (
              <button
                key={st}
                onClick={() => toggleFilterItem('statuses', st)}
                className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md border transition-all ${
                  isSelected
                    ? 'border-slate-900 bg-slate-900 text-white shadow-xs'
                    : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                }`}
              >
                {isSelected && <Check className="w-3 h-3" />}
                <span>{label}</span>
                <span className={`text-[10px] tabular-nums ${isSelected ? 'text-slate-300' : 'text-slate-500'}`}>
                  ({count})
                </span>
              </button>
            );
          })}

          <div className="h-4 w-px bg-slate-200 mx-1 hidden sm:block" />

          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider mr-1">
            Urgencia:
          </span>
          {(['HIGH', 'MEDIUM', 'LOW'] as const).map(ug => {
            const isSelected = filters.urgencies.includes(ug);
            const label = ug === 'HIGH' ? 'Alta' : ug === 'MEDIUM' ? 'Media' : 'Baja';
            const count = items.filter(i => i.urgency === ug).length;
            return (
              <button
                key={ug}
                onClick={() => toggleFilterItem('urgencies', ug)}
                className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md border transition-all ${
                  isSelected
                    ? 'border-slate-900 bg-slate-900 text-white shadow-xs'
                    : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                }`}
              >
                {isSelected && <Check className="w-3 h-3" />}
                <span>{label}</span>
                <span className={`text-[10px] tabular-nums ${isSelected ? 'text-slate-300' : 'text-slate-500'}`}>
                  ({count})
                </span>
              </button>
            );
          })}

          <div className="h-4 w-px bg-slate-200 mx-1 hidden sm:block" />

          <button
            onClick={() => onFilterChange({ ...filters, hasPhotosOnly: !filters.hasPhotosOnly })}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md border transition-all ${
              filters.hasPhotosOnly
                ? 'border-indigo-600 bg-indigo-50 text-indigo-700 font-semibold'
                : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
            }`}
          >
            {filters.hasPhotosOnly && <Check className="w-3 h-3 text-indigo-600" />}
            <span>Solo con fotografías</span>
          </button>
        </div>

        {/* Advanced Filters Panel */}
        {showAdvanced && (
          <div className="pt-3 border-t border-slate-100 grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
            {/* Stage / Orientation */}
            <div className="space-y-1.5">
              <label className="font-semibold text-slate-700 block">Etapa / Orientación</label>
              <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto pr-1">
                {uniqueStages.map(stg => {
                  const isSelected = filters.orientations.includes(stg);
                  const count = items.filter(i => i.orientation === stg).length;
                  return (
                    <button
                      key={stg}
                      onClick={() => toggleFilterItem('orientations', stg)}
                      className={`px-2 py-0.5 rounded text-[11px] border transition-colors ${
                        isSelected
                          ? 'bg-slate-800 text-white border-slate-800 font-medium'
                          : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      {stg} ({count})
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Defect Type */}
            <div className="space-y-1.5">
              <label className="font-semibold text-slate-700 block">Tipo de Defecto</label>
              <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto pr-1">
                {uniqueDefects.slice(0, 12).map(df => {
                  const isSelected = filters.defects.includes(df);
                  const count = items.filter(i => i.defect === df).length;
                  return (
                    <button
                      key={df}
                      onClick={() => toggleFilterItem('defects', df)}
                      className={`px-2 py-0.5 rounded text-[11px] border transition-colors truncate max-w-[160px] ${
                        isSelected
                          ? 'bg-slate-800 text-white border-slate-800 font-medium'
                          : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                      }`}
                      title={df}
                    >
                      {df} ({count})
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Drop & Level */}
            <div className="space-y-1.5">
              <label className="font-semibold text-slate-700 block">Línea (Drop) & Nivel</label>
              <div className="space-y-2">
                <div className="flex flex-wrap gap-1 items-center max-h-16 overflow-y-auto pr-1">
                  <span className="text-[10px] text-slate-400 font-bold mr-1">Drop:</span>
                  {uniqueDrops.map(dr => {
                    const isSelected = filters.drops.includes(dr);
                    return (
                      <button
                        key={dr}
                        onClick={() => toggleFilterItem('drops', dr)}
                        className={`w-6 h-6 flex items-center justify-center rounded text-[10px] border transition-colors ${
                          isSelected
                            ? 'bg-slate-900 text-white border-slate-900 font-bold'
                            : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        {dr}
                      </button>
                    );
                  })}
                </div>

                <div className="flex flex-wrap gap-1 items-center max-h-16 overflow-y-auto pr-1">
                  <span className="text-[10px] text-slate-400 font-bold mr-1">Piso:</span>
                  {uniqueLevels.map(lv => {
                    const isSelected = filters.levels.includes(lv);
                    return (
                      <button
                        key={lv}
                        onClick={() => toggleFilterItem('levels', lv)}
                        className={`min-w-6 h-6 px-1 flex items-center justify-center rounded text-[10px] border transition-colors ${
                          isSelected
                            ? 'bg-slate-900 text-white border-slate-900 font-bold'
                            : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        {lv}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Technicians */}
            <div className="space-y-1.5">
              <label className="font-semibold text-slate-700 block">Técnico Asignado</label>
              <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto pr-1">
                {uniqueTechnicians.map(tc => {
                  const isSelected = filters.technicians.includes(tc);
                  return (
                    <button
                      key={tc}
                      onClick={() => toggleFilterItem('technicians', tc)}
                      className={`px-2 py-0.5 rounded text-[11px] border transition-colors ${
                        isSelected
                          ? 'bg-slate-800 text-white border-slate-800 font-medium'
                          : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      {tc}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Count Indicator */}
        <div className="flex items-center justify-between text-xs text-slate-500 pt-0.5">
          <div>
            Mostrando <span className="font-semibold text-slate-800 tabular-nums">{filteredCount}</span> de{' '}
            <span className="tabular-nums font-semibold text-slate-800">{items.length}</span> registros de inspección
          </div>
          <div className="text-[11px] text-slate-400">
            Arrastra las fotos entre filas o casillas para reordenar o cambiar de defecto
          </div>
        </div>
      </div>
    </div>
  );
};
