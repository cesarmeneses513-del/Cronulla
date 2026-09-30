import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { X, History, RefreshCw, Search, Loader2, User, AlertTriangle, Trash2, ChevronRight } from 'lucide-react';
import { useI18n } from '../i18n';
import { thumbUrl, fallbackTo } from '../lib/thumb';
import {
  HistoryRecord,
  fetchHistory,
  fetchHistoryPeople,
  matchesHistoryFilter,
  HistoryFilter,
  clearHistory,
  subscribeToHistory,
  describeHistory,
  isHistoryUnavailable,
} from '../lib/history';

const PAGE = 100;

const ACTION_COLOR: Record<string, string> = {
  photo_add: 'bg-blue-500',
  photo_remove: 'bg-rose-500',
  photo_move: 'bg-indigo-500',
  photo_phase: 'bg-amber-500',
  photo_reorder: 'bg-slate-400',
  edit: 'bg-amber-500',
  add: 'bg-emerald-500',
  sheet_add: 'bg-emerald-500',
  delete: 'bg-rose-600',
  undo: 'bg-slate-500',
  bulk: 'bg-violet-500',
  sheet_edit: 'bg-teal-500',
};

interface HistoryPanelProps {
  onClose: () => void;
  // Opens the defect of an entry (and its photo, for photo changes). False if it no longer exists.
  onOpenDefect?: (defectId: string, photoUrl?: string) => boolean;
  // Only administrators can clear the history.
  canClear?: boolean;
  // The defects as they are now: entries show each defect's current number, which changes
  // with "Sort and renumber" (the number saved with the entry is the one it had then).
  items?: { id: string; rowNo: string }[];
}

const KIND_TABS: { kind: HistoryFilter['kind']; label: string; dot?: string }[] = [
  { kind: '', label: 'Todo' },
  { kind: 'newDefects', label: 'Defectos nuevos', dot: 'bg-emerald-500' },
  { kind: 'newPhotos', label: 'Fotos nuevas', dot: 'bg-blue-500' },
  { kind: 'edits', label: 'Cambios', dot: 'bg-amber-500' },
  { kind: 'deleted', label: 'Borrados', dot: 'bg-rose-500' },
];

export const HistoryPanel: React.FC<HistoryPanelProps> = ({ onClose, onOpenDefect, canClear = true, items = [] }) => {
  const { t, lang } = useI18n();
  const [records, setRecords] = useState<HistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [query, setQuery] = useState('');
  const [clearBlocked, setClearBlocked] = useState(false);
  const [filter, setFilter] = useState<HistoryFilter>({ kind: '', user: '', day: '', rowNo: '' });
  const [rowNoInput, setRowNoInput] = useState('');
  const [people, setPeople] = useState<string[]>([]);
  const [missing, setMissing] = useState<number | null>(null);
  const currentNo = useMemo(() => new Map(items.map(i => [i.id, i.rowNo])), [items]);
  const noOf = (r: HistoryRecord) => (r.defect_id && currentNo.get(r.defect_id)) || r.row_no || '';
  // A number typed in the filter means the defect that has it now.
  const idOfNo = useMemo(() => new Map(items.map(i => [i.rowNo, i.id])), [items]);
  const withDefect = (f: HistoryFilter): HistoryFilter => ({ ...f, defectId: f.rowNo ? idOfNo.get(f.rowNo.trim()) : undefined });
  const filterRef = useRef(filter);
  filterRef.current = withDefect(filter);

  // Defect number: applied a moment after typing stops.
  useEffect(() => {
    const id = window.setTimeout(() => setFilter(f => (f.rowNo === rowNoInput ? f : { ...f, rowNo: rowNoInput })), 350);
    return () => window.clearTimeout(id);
  }, [rowNoInput]);

  useEffect(() => {
    fetchHistoryPeople().then(setPeople);
  }, []);

  const hasFilter = !!(filter.kind || filter.user || filter.day || filter.rowNo);

  const handleClear = async () => {
    if (!window.confirm(t('¿Borrar todo el historial de cambios? Esto no se puede deshacer.'))) return;
    try {
      const deleted = await clearHistory();
      if (deleted === 0 && records.length > 0) {
        setClearBlocked(true);
        return;
      }
      setClearBlocked(false);
      setRecords([]);
      setHasMore(false);
    } catch (e) {
      console.warn('Failed to clear change history', e);
      setClearBlocked(true);
    }
  };

  const load = useCallback(async (olderThan?: string) => {
    setLoading(true);
    try {
      const page = await fetchHistory(PAGE, olderThan, filterRef.current);
      setRecords(prev => (olderThan ? [...prev, ...page] : page));
      setHasMore(page.length === PAGE);
      setUnavailable(false);
    } catch (e) {
      console.warn('Failed to load change history', e);
      setUnavailable(isHistoryUnavailable());
    } finally {
      setLoading(false);
    }
  }, []);

  // Reload whenever the filters change.
  useEffect(() => {
    load();
  }, [load, filter]);

  useEffect(
    () =>
      subscribeToHistory(record => {
        if (!matchesHistoryFilter(record, filterRef.current)) return;
        setRecords(prev => (prev.some(r => r.id === record.id) ? prev : [record, ...prev]));
      }),
    []
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const locale = lang === 'fa' ? 'fa-AF' : lang === 'es' ? 'es-ES' : 'en-AU';

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = records.map(r => ({ record: r, text: describeHistory(r, t) }));
    if (!q) return rows;
    return rows.filter(
      ({ record, text }) =>
        text.toLowerCase().includes(q) ||
        (record.user_name || '').toLowerCase().includes(q) ||
        noOf(record).toLowerCase().includes(q)
    );
  }, [records, query, t, currentNo]);

  const dayLabel = (iso: string) => {
    const d = new Date(iso);
    const today = new Date();
    const yesterday = new Date(today.getTime() - 86400000);
    if (d.toDateString() === today.toDateString()) return t('Hoy');
    if (d.toDateString() === yesterday.toDateString()) return t('Ayer');
    return d.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  };

  let lastDay = '';

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex justify-end" onClick={onClose}>
      <div
        className="h-full w-full max-w-xl bg-white shadow-2xl flex flex-col border-s border-slate-200"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-slate-700" />
            <h2 className="text-base font-bold text-slate-900">{t('Historial de cambios')}</h2>
          </div>
          <div className="flex items-center gap-1">
            {canClear && (
            <button
              onClick={handleClear}
              disabled={records.length === 0 || unavailable}
              title={t('Borrar historial')}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-40 disabled:hover:bg-transparent rounded-lg transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              {t('Borrar')}
            </button>
            )}
            <button
              onClick={() => load()}
              title={t('Actualizar')}
              className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-200 rounded-lg transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              title={t('Cerrar')}
              className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-200 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filters: kind of change, person, day, defect number */}
        <div className="px-3 pt-3 space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {KIND_TABS.map(tab => {
              const active = (filter.kind || '') === (tab.kind || '');
              return (
                <button
                  key={tab.label}
                  onClick={() => setFilter(f => ({ ...f, kind: tab.kind }))}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full border transition-colors ${
                    active ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {tab.dot && <span className={`w-2 h-2 rounded-full ${tab.dot}`} />}
                  {t(tab.label)}
                </button>
              );
            })}
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            <select
              value={filter.user}
              onChange={e => setFilter(f => ({ ...f, user: e.target.value }))}
              className="min-w-0 px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-hidden focus:border-slate-400"
            >
              <option value="">{t('Todas las personas')}</option>
              {people.map(n => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={filter.day}
              onChange={e => setFilter(f => ({ ...f, day: e.target.value }))}
              title={t('Día')}
              className="min-w-0 px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-hidden focus:border-slate-400"
            />
            <input
              type="text"
              inputMode="numeric"
              value={rowNoInput}
              onChange={e => setRowNoInput(e.target.value)}
              placeholder={t('Nº de defecto')}
              className="min-w-0 px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-hidden focus:border-slate-400"
            />
          </div>
          {hasFilter && (
            <button
              onClick={() => {
                setFilter({ kind: '', user: '', day: '', rowNo: '' });
                setRowNoInput('');
              }}
              className="text-xs text-rose-600 hover:text-rose-700 font-medium"
            >
              {t('Quitar filtros')}
            </button>
          )}
        </div>

        <div className="p-3 border-b border-slate-100">
          <div className="relative">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={t('Buscar por persona, fila o acción...')}
              className="w-full ps-9 pe-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-hidden focus:border-slate-400 focus:bg-white"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {clearBlocked && (
            <div className="m-4 p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg text-xs flex gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{t('Para poder borrar el historial ejecuta supabase/history-clear.sql en el SQL Editor de Supabase.')}</span>
            </div>
          )}
          {unavailable ? (
            <div className="m-4 p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg text-xs flex gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{t('El historial no está activado en la base de datos. Ejecuta supabase/history.sql en el SQL Editor de Supabase.')}</span>
            </div>
          ) : records.length === 0 && loading ? (
            <div className="p-8 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              {t('Cargando…')}
            </div>
          ) : visible.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              {hasFilter ? t('No hay cambios con estos filtros.') : t('Todavía no hay cambios registrados.')}
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {visible.map(({ record, text }) => {
                const day = record.created_at ? dayLabel(record.created_at) : '';
                const showDay = day !== lastDay;
                lastDay = day;
                const url: string | undefined = record.details?.url;
                return (
                  <React.Fragment key={record.id ?? `${record.created_at}-${text}`}>
                    {showDay && (
                      <li className="px-4 py-1.5 bg-slate-50 text-[11px] font-semibold text-slate-500 uppercase tracking-wider sticky top-0">
                        {day}
                      </li>
                    )}
                    <li
                      onClick={
                        record.defect_id && onOpenDefect
                          ? () => {
                              if (!onOpenDefect(record.defect_id!, url)) setMissing(record.id ?? null);
                            }
                          : undefined
                      }
                      className={`px-4 py-2.5 flex items-start gap-3 text-xs ${
                        record.defect_id && onOpenDefect ? 'cursor-pointer hover:bg-slate-50 active:bg-slate-100' : ''
                      }`}
                    >
                      <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${ACTION_COLOR[record.action] || 'bg-slate-400'}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                          <span className="inline-flex items-center gap-1 font-semibold text-slate-900">
                            <User className="w-3 h-3 text-slate-400" />
                            {record.user_name || t('Sin nombre')}
                          </span>
                          {noOf(record) && (
                            <span className="font-mono font-bold text-slate-700 bg-slate-100 px-1.5 rounded border border-slate-200">
                              #{noOf(record)}
                            </span>
                          )}
                          <span className="text-slate-400 font-mono tabular-nums ms-auto">
                            {record.created_at &&
                              new Date(record.created_at).toLocaleTimeString(locale, {
                                hour: '2-digit',
                                minute: '2-digit',
                                second: '2-digit',
                              })}
                          </span>
                        </div>
                        <p className="text-slate-600 mt-0.5 break-words">{text}</p>
                        {missing !== null && missing === record.id && (
                          <p className="mt-1 text-[11px] text-rose-600">{t('Este defecto ya no existe.')}</p>
                        )}
                      </div>
                      {url && (
                        <span className="shrink-0">
                          <img
                            src={thumbUrl(url, 160)}
                            onError={fallbackTo(url)}
                            alt=""
                            loading="lazy"
                            referrerPolicy="no-referrer"
                            className="w-10 h-10 rounded object-cover border border-slate-200"
                          />
                        </span>
                      )}
                      {record.defect_id && onOpenDefect && <ChevronRight className="w-4 h-4 text-slate-300 self-center shrink-0 rtl:rotate-180" />}
                    </li>
                  </React.Fragment>
                );
              })}
            </ul>
          )}
          {hasMore && !unavailable && (
            <div className="p-3 text-center">
              <button
                onClick={() => load(records[records.length - 1]?.created_at)}
                disabled={loading}
                className="px-4 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg disabled:opacity-50"
              >
                {t('Cargar más')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
