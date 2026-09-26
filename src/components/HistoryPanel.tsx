import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { X, History, RefreshCw, Search, Loader2, User, AlertTriangle, Trash2 } from 'lucide-react';
import { useI18n } from '../i18n';
import { thumbUrl, fallbackTo } from '../lib/thumb';
import {
  HistoryRecord,
  fetchHistory,
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
}

export const HistoryPanel: React.FC<HistoryPanelProps> = ({ onClose }) => {
  const { t, lang } = useI18n();
  const [records, setRecords] = useState<HistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [query, setQuery] = useState('');
  const [clearBlocked, setClearBlocked] = useState(false);

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
      const page = await fetchHistory(PAGE, olderThan);
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

  useEffect(() => {
    load();
    return subscribeToHistory(record => setRecords(prev => (prev.some(r => r.id === record.id) ? prev : [record, ...prev])));
  }, [load]);

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
        (record.row_no || '').toLowerCase().includes(q)
    );
  }, [records, query, t]);

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
            <button
              onClick={handleClear}
              disabled={records.length === 0 || unavailable}
              title={t('Borrar historial')}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-40 disabled:hover:bg-transparent rounded-lg transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              {t('Borrar')}
            </button>
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
            <div className="p-8 text-center text-xs text-slate-500">{t('Todavía no hay cambios registrados.')}</div>
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
                    <li className="px-4 py-2.5 flex items-start gap-3 text-xs">
                      <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${ACTION_COLOR[record.action] || 'bg-slate-400'}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                          <span className="inline-flex items-center gap-1 font-semibold text-slate-900">
                            <User className="w-3 h-3 text-slate-400" />
                            {record.user_name || t('Sin nombre')}
                          </span>
                          {record.row_no && (
                            <span className="font-mono font-bold text-slate-700 bg-slate-100 px-1.5 rounded border border-slate-200">
                              #{record.row_no}
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
                      </div>
                      {url && (
                        <a href={url} target="_blank" rel="noreferrer" className="shrink-0">
                          <img
                            src={thumbUrl(url, 160)}
                            onError={fallbackTo(url)}
                            alt=""
                            loading="lazy"
                            referrerPolicy="no-referrer"
                            className="w-10 h-10 rounded object-cover border border-slate-200"
                          />
                        </a>
                      )}
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
