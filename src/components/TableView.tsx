import React from 'react';
import { Edit2, Trash2, Camera, ExternalLink } from 'lucide-react';
import { DefectItem, DefectStatus, DefectPhoto, PhotoPhase } from '../types/inspection';
import { useI18n, PHASE_LABEL, STATUS_LABEL, URGENCY_LABEL } from '../i18n';
import { PhaseChips } from './PhaseChips';
import { thumbUrl, fallbackTo } from '../lib/thumb';

// One photo per phase in the Photos column, in this order, with the phase's dot color.
const PHASES: { phase: PhotoPhase; dot: string }[] = [
  { phase: 'BEFORE', dot: 'bg-slate-400' },
  { phase: 'IN PROGRESS', dot: 'bg-amber-500' },
  { phase: 'COMPLETED', dot: 'bg-emerald-500' },
];
const phaseOf = (p: DefectPhoto | string, i: number): PhotoPhase =>
  typeof p === 'string' ? (i >= 6 ? 'COMPLETED' : i >= 3 ? 'IN PROGRESS' : 'BEFORE') : p.phase;

interface TableViewProps {
  items: DefectItem[];
  onEdit: (item: DefectItem) => void;
  onDelete: (id: string) => void;
  onOpenPhotoLightbox: (item: DefectItem, photoIndex: number) => void;
  onQuickUpdateStatus: (itemId: string, status: DefectStatus) => void;
  readOnly?: boolean;
  selectable?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string, shiftKey: boolean) => void;
  canDelete?: boolean;
}

export const TableView: React.FC<TableViewProps> = ({
  items,
  onEdit,
  onDelete,
  onOpenPhotoLightbox,
  onQuickUpdateStatus,
  readOnly = false,
  selectable = false,
  selectedIds,
  onToggleSelect,
  canDelete = true,
}) => {
  const { t } = useI18n();
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[11px]">
              {selectable && <th className="p-3 w-8" />}
              <th className="p-3 w-12 text-center">#</th>
              <th className="p-3 w-28">{t('Fotos')}</th>
              <th className="p-3">{t('Etapa / Proyecto')}</th>
              <th className="p-3">{t('Defecto')}</th>
              <th className="p-3 text-center">{t('Urgencia')}</th>
              <th className="p-3 text-center">{t('Drop')}</th>
              <th className="p-3 text-center">{t('Nivel')}</th>
              <th className="p-3">{t('Estado')}</th>
              <th className="p-3">{t('Medidas')}</th>
              <th className="p-3">{t('Técnico / Fecha')}</th>
              <th className="p-3">{t('Notas')}</th>
              {!readOnly && <th className="p-3 text-end">{t('Acciones')}</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((item, idx) => (
              <tr
                key={item.id}
                className={`transition-colors ${
                  selectable && selectedIds?.has(item.id) ? 'bg-rose-50/70' : 'hover:bg-slate-50/80'
                }`}
              >
                {selectable && (
                  <td className="p-3 text-center">
                    <input
                      type="checkbox"
                      checked={!!selectedIds?.has(item.id)}
                      onChange={() => {}}
                      onClick={e => onToggleSelect?.(item.id, e.shiftKey)}
                      className="w-4 h-4 accent-rose-600 cursor-pointer"
                    />
                  </td>
                )}
                <td className="p-3 font-mono font-bold text-slate-800 text-center">
                  {item.rowNo}
                </td>

                {/* Photos: the first Before, During and After photo. The dot shows the phase;
                    an empty box means that phase has no photo yet. */}
                <td className="p-3">
                  <div className="flex items-center gap-1.5">
                    {PHASES.map(({ phase, dot }) => {
                      const pIdx = item.photos.findIndex((p, i) => phaseOf(p, i) === phase);
                      const p = pIdx >= 0 ? item.photos[pIdx] : null;
                      const pUrl = p ? (typeof p === 'string' ? p : p.url) : '';
                      return (
                        <div key={phase} className="flex flex-col items-center">
                          <span className={`w-1.5 h-1.5 rounded-full mb-0.5 ${dot} ${p ? '' : 'opacity-40'}`} title={t(PHASE_LABEL[phase])} />
                          {p ? (
                            <button
                              onClick={() => onOpenPhotoLightbox(item, pIdx)}
                              className="relative w-8 h-8 rounded overflow-hidden border border-slate-200 hover:border-slate-400 group"
                              title={`${t(PHASE_LABEL[phase])} - ${t('Ver foto')}`}
                            >
                              <img
                                loading="lazy"
                                decoding="async"
                                src={thumbUrl(pUrl, 160)} onError={fallbackTo(pUrl)} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                            </button>
                          ) : (
                            <span className="w-8 h-8 rounded border border-dashed border-slate-300 bg-slate-50" title={t(PHASE_LABEL[phase])} />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </td>

                <td className="p-3">
                  <div className="font-semibold text-slate-900">{item.orientation}</div>
                  <div className="text-[10px] text-slate-500">{item.projectName}</div>
                </td>

                <td className="p-3 font-medium text-slate-900">
                  {item.defect}
                </td>

                <td className="p-3 text-center">
                  <span
                    className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                      item.urgency === 'HIGH'
                        ? 'bg-rose-100 text-rose-800'
                        : item.urgency === 'MEDIUM'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {t(URGENCY_LABEL[item.urgency] || item.urgency)}
                  </span>
                </td>

                <td className="p-3 text-center font-mono font-semibold">
                  {item.drop || '—'}
                </td>

                <td className="p-3 text-center font-mono font-semibold">
                  {item.level || '—'}
                </td>

                <td className="p-3">
                  <PhaseChips item={item} size="xs" />
                </td>

                <td className="p-3 text-[11px] font-mono">
                  {item.linearMeters && `${item.linearMeters}m `}
                  {(item.baseM || item.heightM) && `${item.baseM || '0'}x${item.heightM || '0'}m `}
                  {item.quantity && `${t('cant:')} ${item.quantity}`}
                  {!item.linearMeters && !item.baseM && !item.heightM && !item.quantity && '—'}
                </td>

                <td className="p-3 text-[11px]">
                  <div className="font-medium text-slate-800">
                    {item.technicianCompleted || item.technicianStart || '—'}
                  </div>
                  <div className="text-slate-400 text-[10px]">
                    {item.dateCompleted || item.date1stPhoto || ''}
                  </div>
                </td>

                <td className="p-3 max-w-xs lg:max-w-[12rem] truncate text-[11px] text-slate-600" title={item.comment}>
                  {item.comment || '—'}
                </td>

                {!readOnly && (
                <td className="p-3 text-end">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => onEdit(item)}
                      className="p-1 text-slate-500 hover:text-slate-900 rounded hover:bg-slate-100"
                      title={t('Editar')}
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    {canDelete && (
                    <button
                      onClick={() => onDelete(item.id)}
                      className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50"
                      title={t('Eliminar')}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    )}
                  </div>
                </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
