import React, { useMemo, useState } from 'react';
import { X, Plus, Loader2, Check } from 'lucide-react';
import { useI18n } from '../i18n';
import { DefectItem } from '../types/inspection';
import {
  DefectType,
  MEASURE_SHORT,
  MeasureKind,
  deleteDefectType,
  renameDefectType,
  saveDefectType,
  useDefectTypes,
} from '../lib/defectTypes';

const MEASURES: { kind: MeasureKind; label: string }[] = [
  { kind: 'area', label: 'Base × Altura (m)' },
  { kind: 'linear', label: 'Metros Lineales (m)' },
  { kind: 'quantity', label: 'Cantidad' },
];

// The defect types catalogue: add, hide, and rename or delete the ones no defect uses.
export const ManageTypesModal: React.FC<{ items: DefectItem[]; onClose: () => void }> = ({ items, onClose }) => {
  const { t } = useI18n();
  const { types, reload } = useDefectTypes();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [adding, setAdding] = useState<DefectType | null>(null);

  const usage = useMemo(() => {
    const n = new Map<string, number>();
    items.forEach(i => i.defect && n.set(i.defect, (n.get(i.defect) || 0) + 1));
    return n;
  }, [items]);

  const run = async (key: string, action: () => Promise<void>) => {
    setBusy(key);
    setError('');
    try {
      await action();
      reload();
    } catch (e) {
      setError(String((e as Error)?.message || e));
    } finally {
      setBusy(null);
    }
  };

  const measureText = (m: MeasureKind[]) => m.map(k => MEASURE_SHORT[k]).join(' / ');

  return (
    <div className="fixed inset-0 z-[70] bg-slate-900/40 flex items-start justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="w-full max-w-lg my-auto bg-white rounded-2xl shadow-2xl border border-slate-200" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 px-5 pt-5">
          <div>
            <h2 className="text-lg font-bold text-slate-900">{t('Gestionar tipos de defecto')}</h2>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              {t('Ocultar un tipo lo quita de las listas; los defectos que ya lo tienen lo conservan. Un tipo que ningún defecto usa se puede renombrar o borrar.')}
            </p>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md">
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && <p className="mx-5 mt-3 text-xs text-rose-600">{error}</p>}

        <ul className="mx-5 mt-3 divide-y divide-slate-100 border-y border-slate-100">
          {types.map(type => {
            const used = usage.get(type.name) || 0;
            return (
              <li key={type.name} className="flex items-center gap-3 py-2.5">
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 min-w-0">
                    <span className={`text-sm font-semibold truncate ${type.hidden ? 'text-slate-400' : 'text-slate-900'}`}>{type.name}</span>
                    <span className="text-[11px] text-slate-400 shrink-0">{measureText(type.measures)}</span>
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {used > 0 ? t('Usado en {n} defectos', { n: used }) : <span className="italic text-slate-400">{t('Sin uso')}</span>}
                  </div>
                </div>
                {busy === type.name && <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />}
                {used === 0 && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        const name = window.prompt(t('Nuevo nombre'), type.name)?.trim().toUpperCase();
                        if (!name || name === type.name) return;
                        if (types.some(x => x.name === name)) return setError(t('Ya existe un tipo con ese nombre.'));
                        run(type.name, () => renameDefectType(type, name));
                      }}
                      className="text-xs text-slate-500 hover:text-slate-900"
                    >
                      {t('Renombrar')}
                    </button>
                    <button
                      type="button"
                      onClick={() => window.confirm(t('¿Borrar el tipo {name}?', { name: type.name })) && run(type.name, () => deleteDefectType(type.name))}
                      className="text-xs text-rose-500 hover:text-rose-700"
                    >
                      {t('Borrar tipo')}
                    </button>
                  </>
                )}
                <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={!!type.hidden}
                    onChange={e => run(type.name, () => saveDefectType({ ...type, hidden: e.target.checked }))}
                    className="w-4 h-4 accent-blue-700"
                  />
                  {t('Oculto')}
                </label>
              </li>
            );
          })}
        </ul>

        {adding && (
          <form
            onSubmit={e => {
              e.preventDefault();
              e.stopPropagation();
              const name = adding.name.trim().toUpperCase();
              if (!name || adding.measures.length === 0) return;
              if (types.some(x => x.name === name)) return setError(t('Ya existe un tipo con ese nombre.'));
              run('add', async () => {
                await saveDefectType({ ...adding, name });
                setAdding(null);
              });
            }}
            className="mx-5 mt-3 p-3 rounded-lg border border-slate-200 bg-slate-50 space-y-2"
          >
            <input
              autoFocus
              required
              placeholder={t('Nombre del tipo, ej. CRACK STITCHING')}
              value={adding.name}
              onChange={e => setAdding({ ...adding, name: e.target.value })}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg uppercase focus:outline-hidden focus:border-slate-400"
            />
            <p className="text-[11px] text-slate-500">{t('Medida que necesita (con varias, basta una):')}</p>
            <div className="flex flex-wrap gap-2">
              {MEASURES.map(m => {
                const on = adding.measures.includes(m.kind);
                return (
                  <button
                    type="button"
                    key={m.kind}
                    onClick={() =>
                      setAdding({ ...adding, measures: on ? adding.measures.filter(k => k !== m.kind) : [...adding.measures, m.kind] })
                    }
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg border ${
                      on ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-200'
                    }`}
                  >
                    {on && <Check className="w-3 h-3" />}
                    {t(m.label)}
                  </button>
                );
              })}
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setAdding(null)} className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900">
                {t('Cancelar')}
              </button>
              <button
                type="submit"
                disabled={!adding.name.trim() || adding.measures.length === 0 || busy === 'add'}
                className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 disabled:opacity-40 rounded-lg"
              >
                {t('Agregar')}
              </button>
            </div>
          </form>
        )}

        <div className="flex items-center justify-between px-5 py-4">
          <button
            type="button"
            onClick={() => setAdding({ name: '', measures: ['area'] })}
            disabled={!!adding}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-800 border border-slate-300 hover:bg-slate-50 disabled:opacity-40 rounded-lg"
          >
            <Plus className="w-4 h-4" />
            {t('Agregar tipo')}
          </button>
          <button type="button" onClick={onClose} className="px-4 py-2 text-xs font-semibold text-slate-800 border border-slate-300 hover:bg-slate-50 rounded-lg">
            {t('Listo')}
          </button>
        </div>
      </div>
    </div>
  );
};
