import React, { useEffect, useRef, useState } from 'react';
import { RefreshCw, Download, Upload, ListOrdered, Users, Plus, LogOut, Eye, PencilLine, Undo2, History, FileSpreadsheet, ChevronDown, Database } from 'lucide-react';
import { DefectItem } from '../types/inspection';
import { useI18n } from '../i18n';
import { LanguageSwitcher } from './LanguageSwitcher';

// The "Cronulla vs Code" spreadsheet kept in sync with the web (google-sheets/sync.gs).
const CVC_SHEET_URL = 'https://docs.google.com/spreadsheets/d/1T46fR5QS6E6vcc568Tc0JjjiIzc6kLebtvtsL2wam9s/edit';

interface HeaderProps {
  items: DefectItem[];
  filteredCount: number;
  totalPhotos: number;
  // Each action is passed only when the person's role allows it (missing = button hidden).
  onNewDefect?: () => void;
  onExportCsv?: () => void;
  onOpenImportModal?: () => void;
  onOpenHistoryAllowed?: boolean;
  // Shortcut to the synced sheet (people who manage users).
  showSheetLink?: boolean;
  // The person's role, shown in the badge (e.g. "Project Manager").
  roleLabel?: string;
  // Administrators: sort and renumber all defects.
  onRenumber?: () => void;
  // Administrators signed in with an account: manage the accounts.
  onOpenUsers?: () => void;
  // Who is signed in, shown above their level; `viaPin` while they still use the temporary PIN.
  userName?: string;
  viaPin?: boolean;
  readOnly: boolean;
  isAdmin?: boolean;
  onLogout: () => void;
  onUndo: () => void;
  undoLabel: string | null;
  onOpenHistory: () => void;
  onReload?: () => void;
  reloading?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  items,
  filteredCount,
  totalPhotos,
  onNewDefect,
  onExportCsv,
  onOpenImportModal,
  onOpenHistoryAllowed = false,
  showSheetLink = false,
  roleLabel,
  onRenumber,
  onOpenUsers,
  userName,
  viaPin = false,
  readOnly,
  isAdmin = false,
  onLogout,
  onUndo,
  undoLabel,
  onOpenHistory,
  onReload,
  reloading = false,
}) => {
  const { t } = useI18n();
  // Import CSV, Cronulla vs Code and Export CSV share one dropdown.
  const [dataOpen, setDataOpen] = useState(false);
  const dataRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!dataOpen) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (dataRef.current && !dataRef.current.contains(e.target as Node)) setDataOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
    };
  }, [dataOpen]);
  const menuItem =
    'w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 rounded-md hover:bg-slate-100 text-start whitespace-nowrap';
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
            {onReload && (
              <button
                onClick={onReload}
                disabled={reloading}
                title={t('Volver a cargar los datos')}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 disabled:opacity-60 transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${reloading ? 'animate-spin' : ''}`} />
                {t('Actualizar')}
              </button>
            )}
          </div>
        </div>

        {/* Zone 3: Primary Actions */}
        <div className="flex flex-wrap items-center justify-end gap-2">
          {/* Level, with the signed-in person's name inside (· PIN while using the temporary PIN) */}
          <span
            className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-semibold border ${
              readOnly ? 'bg-sky-50 text-sky-700 border-sky-200' : 'bg-amber-50 text-amber-800 border-amber-200'
            } ${!readOnly && userName ? '' : 'hidden sm:inline-flex'}`}
          >
            {readOnly ? <Eye className="w-3.5 h-3.5" /> : <PencilLine className="w-3.5 h-3.5" />}
            <span className="flex flex-col leading-tight">
              <span>{roleLabel ? t(roleLabel) : readOnly ? t('Cliente') : isAdmin ? t('Administrador') : t('Editor')}</span>
              {!readOnly && userName && (
                <span className="max-w-[9rem] truncate text-[9px] font-medium text-amber-700/80" title={userName}>
                  {userName}
                  {viaPin && ' · PIN'}
                </span>
              )}
            </span>
          </span>

          <LanguageSwitcher />

          {onOpenHistoryAllowed && (
          <button
            onClick={onOpenHistory}
            title={t('Historial de cambios')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap"
          >
            <History className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t('Historial')}</span>
          </button>
          )}

          {!readOnly && (
          <button
            onClick={onUndo}
            disabled={!undoLabel}
            title={undoLabel ? t('Deshacer: {label} (Ctrl/Cmd + Z)', { label: undoLabel }) : t('Nada que deshacer')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 disabled:hover:bg-slate-100 disabled:cursor-not-allowed rounded-lg transition-colors whitespace-nowrap"
          >
            <Undo2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t('Deshacer')}</span>
          </button>
          )}

          {(onOpenImportModal || onExportCsv || onRenumber || onOpenUsers || showSheetLink) && (
          <div ref={dataRef} className="relative">
            <button
              onClick={() => setDataOpen(o => !o)}
              aria-expanded={dataOpen}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap"
            >
              <Database className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t('Datos')}</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${dataOpen ? 'rotate-180' : ''}`} />
            </button>

            {dataOpen && (
              <div className="absolute end-0 top-full mt-1.5 z-40 min-w-48 p-1.5 bg-white border border-slate-200 rounded-xl shadow-xl">
                {onOpenImportModal && (
                  <button onClick={() => { setDataOpen(false); onOpenImportModal(); }} className={menuItem}>
                    <Upload className="w-3.5 h-3.5" />
                    {t('Importar')} CSV
                  </button>
                )}

                {/* Shortcut to the synced spreadsheet, on computers only */}
                {showSheetLink && (
                  <a
                    href={CVC_SHEET_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setDataOpen(false)}
                    title={t('Abrir la planilla Cronulla vs Code')}
                    className={`${menuItem} hidden md:flex text-emerald-800 hover:bg-emerald-50`}
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    Cronulla vs Code
                  </a>
                )}

                {onRenumber && (
                  <button onClick={() => { setDataOpen(false); onRenumber(); }} className={menuItem}>
                    <ListOrdered className="w-3.5 h-3.5" />
                    {t('Ordenar y renumerar')}
                  </button>
                )}

                {onOpenUsers && (
                  <button onClick={() => { setDataOpen(false); onOpenUsers(); }} className={menuItem}>
                    <Users className="w-3.5 h-3.5" />
                    {t('Usuarios')}
                  </button>
                )}

                {onExportCsv && (
                  <button onClick={() => { setDataOpen(false); onExportCsv(); }} className={menuItem}>
                    <Download className="w-3.5 h-3.5" />
                    {t('Exportar')} CSV
                  </button>
                )}
              </div>
            )}
          </div>
          )}

          {onNewDefect && (
          <button
            onClick={onNewDefect}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-xs transition-colors whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>{t('Nuevo Defecto')}</span>
          </button>
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
