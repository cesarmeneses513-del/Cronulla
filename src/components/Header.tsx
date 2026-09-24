import React from 'react';
import { Camera, Download, Upload, Plus, RotateCcw, LogOut, Eye, PencilLine } from 'lucide-react';
import { DefectItem } from '../types/inspection';

interface HeaderProps {
  items: DefectItem[];
  filteredCount: number;
  totalPhotos: number;
  onNewDefect: () => void;
  onExportCsv: () => void;
  onOpenImportModal: () => void;
  onResetData: () => void;
  readOnly: boolean;
  onLogout: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  items,
  filteredCount,
  totalPhotos,
  onNewDefect,
  onExportCsv,
  onOpenImportModal,
  onResetData,
  readOnly,
  onLogout,
}) => {
  const completedCount = items.filter(i => i.status === 'COMPLETED').length;
  const inProgressCount = items.filter(i => i.status === 'IN PROGRESS').length;
  const beforeCount = items.filter(i => i.status === 'BEFORE').length;
  const percentCompleted = items.length > 0 ? Math.round((completedCount / items.length) * 100) : 0;

  return (
    <header className="border-b border-slate-200 bg-white sticky top-0 z-30 shadow-xs">
      {/* Top Bar Contract: Brand - Info/Stats - Actions */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Zone 1: Wordmark Brand Title */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-10 h-10 rounded-lg bg-slate-900 text-white flex items-center justify-center shadow-xs">
            <Camera className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight leading-tight">
              Cronulla Inspection Gallery
            </h1>
            <p className="text-xs text-slate-500 font-medium">
              Control de Defectos & Galería Fotográfica
            </p>
          </div>
        </div>

        {/* Zone 2: Progress & Counts */}
        <div className="hidden md:flex items-center gap-6 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-900 tabular-nums">{items.length}</span>
            <span>defectos</span>
            <span className="text-slate-300">|</span>
            <span className="font-semibold text-slate-900 tabular-nums">{totalPhotos}</span>
            <span>fotografías</span>
          </div>

          <div className="flex items-center gap-2">
            <div className="w-24 bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200">
              <div
                className="bg-emerald-500 h-full transition-all duration-300"
                style={{ width: `${percentCompleted}%` }}
              />
            </div>
            <span className="font-semibold text-emerald-700 tabular-nums">{percentCompleted}%</span>
            <span className="text-slate-500">completado</span>
          </div>

          <div className="flex items-center gap-3 text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-slate-400" />
              <span className="tabular-nums font-medium">{beforeCount}</span> Antes
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span className="tabular-nums font-medium">{inProgressCount}</span> En curso
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="tabular-nums font-medium">{completedCount}</span> Listo
            </span>
          </div>
        </div>

        {/* Zone 3: Primary Actions */}
        <div className="flex items-center gap-2">
          <span
            className={`hidden sm:inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold border ${
              readOnly ? 'bg-sky-50 text-sky-700 border-sky-200' : 'bg-amber-50 text-amber-800 border-amber-200'
            }`}
          >
            {readOnly ? <Eye className="w-3.5 h-3.5" /> : <PencilLine className="w-3.5 h-3.5" />}
            {readOnly ? 'Cliente' : 'Editor'}
          </span>

          {!readOnly && (
          <>
          <button
            onClick={onResetData}
            title="Restaurar datos iniciales"
            className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <button
            onClick={onOpenImportModal}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap"
          >
            <Upload className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Importar</span> CSV
          </button>

          <button
            onClick={onExportCsv}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Exportar</span> CSV
          </button>

          <button
            onClick={onNewDefect}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-xs transition-colors whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>Nuevo Defecto</span>
          </button>
          </>
          )}

          <button
            onClick={onLogout}
            title="Cambiar de modo"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Salir</span>
          </button>
        </div>
      </div>
    </header>
  );
};
