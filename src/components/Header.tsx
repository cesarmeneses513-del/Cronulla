import React from 'react';
import { Download, Upload, Plus, LogOut, Eye, PencilLine, Undo2, History } from 'lucide-react';
import { DefectItem } from '../types/inspection';
import { useI18n } from '../i18n';
import { LanguageSwitcher } from './LanguageSwitcher';

interface HeaderProps {
  items: DefectItem[];
  filteredCount: number;
  totalPhotos: number;
  onNewDefect: () => void;
  onExportCsv: () => void;
  onOpenImportModal: () => void;
  readOnly: boolean;
  onLogout: () => void;
  onUndo: () => void;
  undoLabel: string | null;
  onOpenHistory: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  items,
  filteredCount,
  totalPhotos,
  onNewDefect,
  onExportCsv,
  onOpenImportModal,
  readOnly,
  onLogout,
  onUndo,
  undoLabel,
  onOpenHistory,
}) => {
  const { t } = useI18n();
  const completedCount = items.filter(i => i.status === 'COMPLETED').length;
  const inProgressCount = items.filter(i => i.status === 'IN PROGRESS').length;
  const beforeCount = items.filter(i => i.status === 'BEFORE').length;
  const percentCompleted = items.length > 0 ? Math.round((completedCount / items.length) * 100) : 0;

  return (
    <header className="border-b border-slate-200 bg-white sticky top-0 z-30 shadow-xs">
      {/* Top Bar Contract: Brand - Info/Stats - Actions */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        {/* Zone 1: Wordmark Brand Title */}
        <div className="flex items-center gap-3 shrink-0">
          <img src="/cpr-logo-circle.png" alt="CPR" className="w-11 h-11 shrink-0" />
          <div>
            <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight leading-tight">
              Cronulla Inspection Gallery
            </h1>
            <p className="text-xs text-slate-500 font-medium">
              {t('Control de Defectos & Galería Fotográfica')}
            </p>
          </div>
        </div>

        {/* Zone 2: Progress & Counts — own line below brand + actions so the header never overflows */}
        <div className="hidden md:flex order-last basis-full flex-wrap items-center gap-x-6 gap-y-1 pt-2 border-t border-slate-100 text-xs text-slate-600 whitespace-nowrap">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-900 tabular-nums">{items.length}</span>
            <span>{t('defectos')}</span>
            <span className="text-slate-300">|</span>
            <span className="font-semibold text-slate-900 tabular-nums">{totalPhotos}</span>
            <span>{t('fotografías')}</span>
          </div>

          <div className="flex items-center gap-2">
            <div className="w-24 bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200">
              <div
                className="bg-emerald-500 h-full transition-all duration-300"
                style={{ width: `${percentCompleted}%` }}
              />
            </div>
            <span className="font-semibold text-emerald-700 tabular-nums">{percentCompleted}%</span>
            <span className="text-slate-500">{t('completado')}</span>
          </div>

          <div className="flex items-center gap-3 text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-slate-400" />
              <span className="tabular-nums font-medium">{beforeCount}</span> {t('Antes')}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span className="tabular-nums font-medium">{inProgressCount}</span> {t('En Progreso')}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="tabular-nums font-medium">{completedCount}</span> {t('Completado')}
            </span>
          </div>
        </div>

        {/* Zone 3: Primary Actions */}
        <div className="flex flex-wrap items-center justify-end gap-2">
          <span
            className={`hidden sm:inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold border ${
              readOnly ? 'bg-sky-50 text-sky-700 border-sky-200' : 'bg-amber-50 text-amber-800 border-amber-200'
            }`}
          >
            {readOnly ? <Eye className="w-3.5 h-3.5" /> : <PencilLine className="w-3.5 h-3.5" />}
            {readOnly ? t('Cliente') : t('Editor')}
          </span>

          <LanguageSwitcher />

          {!readOnly && (
          <>
          <button
            onClick={onOpenHistory}
            title={t('Historial de cambios')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap"
          >
            <History className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t('Historial')}</span>
          </button>

          <button
            onClick={onUndo}
            disabled={!undoLabel}
            title={undoLabel ? t('Deshacer: {label} (Ctrl/Cmd + Z)', { label: undoLabel }) : t('Nada que deshacer')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 disabled:hover:bg-slate-100 disabled:cursor-not-allowed rounded-lg transition-colors whitespace-nowrap"
          >
            <Undo2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t('Deshacer')}</span>
          </button>

          <button
            onClick={onOpenImportModal}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap"
          >
            <Upload className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t('Importar')}</span> CSV
          </button>

          <button
            onClick={onExportCsv}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t('Exportar')}</span> CSV
          </button>

          <button
            onClick={onNewDefect}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-xs transition-colors whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>{t('Nuevo Defecto')}</span>
          </button>
          </>
          )}

          <button
            onClick={onLogout}
            title={t('Cambiar de modo')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t('Salir')}</span>
          </button>
        </div>
      </div>
    </header>
  );
};
