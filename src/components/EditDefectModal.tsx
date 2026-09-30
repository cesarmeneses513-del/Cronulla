import React, { useState, useRef } from 'react';
import { X, Plus, Trash2, ArrowUp, ArrowDown, Save, Camera, Ruler, User, AlertTriangle } from 'lucide-react';
import { DefectItem, UrgencyLevel, DefectStatus, PhotoPhase, DefectPhoto } from '../types/inspection';
import { uploadPhoto } from '../lib/supabase';
import { useI18n, PHASE_LABEL, STATUS_LABEL, URGENCY_LABEL } from '../i18n';
import { useCan } from '../lib/permissions';
import { STAGES, measuresFor, useDefectTypes } from '../lib/defectTypes';
import { ManageTypesModal } from './ManageTypesModal';
import { thumbUrl, fallbackTo } from '../lib/thumb';
import { stageImageFor } from '../data/stageImages';
import { StageImageViewer } from './StageImageViewer';
import { PhasePicker } from './PhasePicker';
import { sortPhotosByPhase } from '../lib/photoOrder';

interface EditDefectModalProps {
  item: DefectItem | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedItem: DefectItem) => void;
  canDelete?: boolean;
  // For "Manage types": all defects (how many use each type) and whether this person may manage them.
  allItems?: DefectItem[];
  canManageTypes?: boolean;
}

export const EditDefectModal: React.FC<EditDefectModalProps> = ({
  item,
  isOpen,
  onClose,
  onSave,
  canDelete = true,
  allItems = [],
  canManageTypes = false,
}) => {
  const { t } = useI18n();
  const can = useCan();
  const { types } = useDefectTypes();
  const [managingTypes, setManagingTypes] = useState(false);
  if (!isOpen || !item) return null;

  const [formData, setFormData] = useState<DefectItem>({ ...item });
  const [newTagInput, setNewTagInput] = useState('');
  const [showStageImage, setShowStageImage] = useState(false);
  const [pending, setPending] = useState<{ file?: File; url?: string; preview: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Everything must be filled in before saving, including the measurements the defect type needs.
  const [missing, setMissing] = useState<string[]>([]);
  const measures = measuresFor(formData.defect, types);
  const filled = (v?: string) => !!String(v ?? '').trim();
  const measureOk = {
    area: filled(formData.baseM) && filled(formData.heightM),
    linear: filled(formData.linearMeters),
    quantity: filled(formData.quantity),
  };
  const measureLabel = { area: t('Base × Altura (m)'), linear: t('Metros Lineales (m)'), quantity: t('Cantidad') };
  const validate = (): string[] => {
    const list: string[] = [];
    if (!filled(formData.orientation)) list.push(t('Etapa / Orientación'));
    if (!filled(formData.defect)) list.push(t('Tipo de Defecto'));
    if (!filled(formData.drop)) list.push(t('Línea (Drop)'));
    if (!filled(formData.level)) list.push(t('Nivel / Piso'));
    if (filled(formData.defect) && !measures.some(m => measureOk[m])) {
      list.push(measures.length > 1 ? t('una medida: {list}', { list: measures.map(m => measureLabel[m]).join(' / ') }) : measureLabel[measures[0]]);
    }
    return list;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const list = validate();
    setMissing(list);
    if (list.length > 0) {
      e.currentTarget.closest('.overflow-y-auto')?.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    onSave(formData);
    onClose();
  };
  const bad = (ok: boolean) => (missing.length > 0 && !ok ? 'border-rose-400 bg-rose-50/40' : '');
  // With several measurement options (e.g. DILAPIDATION) one filled is enough: none turn red.
  const anyMeasure = measures.length > 1 && measures.some(m => measureOk[m]);
  // One look for every box of the form.
  const boxCls =
    'block w-full h-10 px-3 border border-slate-200 rounded-lg text-sm placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-100 focus:outline-hidden';
  const fieldCls = `${boxCls} bg-white text-slate-900`;
  const readOnlyField = `${boxCls} bg-slate-100 text-slate-500 cursor-not-allowed focus:ring-0 focus:border-slate-200`;
  const labelCls = 'block mb-1.5 text-xs font-semibold text-slate-700 truncate';
  const panelCls = 'p-4 bg-slate-50 border border-slate-200 rounded-xl';
  const panelTitleCls = 'mb-3 text-[11px] font-bold tracking-wider text-slate-500 uppercase';

  const handleAddTag = () => {
    if (!newTagInput.trim()) return;
    const current = formData.customTags || [];
    if (!current.includes(newTagInput.trim())) {
      setFormData({
        ...formData,
        customTags: [...current, newTagInput.trim()],
      });
    }
    setNewTagInput('');
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setFormData({
      ...formData,
      customTags: (formData.customTags || []).filter(t => t !== tagToRemove),
    });
  };

  const handleMovePhotoOrder = (index: number, direction: 'up' | 'down') => {
    const photos = [...formData.photos];
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= photos.length) return;
    const temp = photos[index];
    photos[index] = photos[targetIdx];
    photos[targetIdx] = temp;
    setFormData({ ...formData, photos });
  };

  const handleRemovePhoto = (index: number) => {
    const photos = formData.photos.filter((_, i) => i !== index);
    setFormData({ ...formData, photos });
  };

  const handleChangePhotoPhase = (index: number, newPhase: PhotoPhase) => {
    const photos = [...formData.photos];
    const itemPhoto = photos[index];
    const url = typeof itemPhoto === 'string' ? itemPhoto : itemPhoto.url;
    photos[index] = {
      ...(typeof itemPhoto === 'object' ? itemPhoto : {}),
      url,
      phase: newPhase,
      slot: typeof itemPhoto === 'object' ? itemPhoto.slot : index + 1,
    };
    setFormData({ ...formData, photos: sortPhotosByPhase(photos) });
  };

  // A new photo (file or URL) waits here until its phase is chosen.
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setPending({ file, preview: URL.createObjectURL(file) });
  };

  const handleAddPhotoByUrl = () => {
    const url = window.prompt(t('Pegar enlace URL de la fotografía:'));
    if (url && url.trim()) setPending({ url: url.trim(), preview: url.trim() });
  };

  const closePending = () => {
    if (pending?.file) URL.revokeObjectURL(pending.preview);
    setPending(null);
  };

  const addPendingPhoto = async (phase: PhotoPhase) => {
    const p = pending;
    closePending();
    if (!p) return;
    const url = p.file ? await uploadPhoto(p.file) : p.url!;
    setFormData(prev => {
      const newPhoto: DefectPhoto = { url, phase, slot: prev.photos.length + 1 };
      return { ...prev, photos: sortPhotosByPhase([...prev.photos, newPhoto]) };
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div>
            <span className="text-xs font-mono font-bold text-slate-500">
              {t('Registro #{row}', { row: formData.rowNo })}
            </span>
            <h2 className="text-base font-bold text-slate-900">
              {t('Editar Datos del Defecto')}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} noValidate className="p-5 sm:p-6 space-y-6 overflow-y-auto flex-1">
          {missing.length > 0 && (
            <div className="flex items-start gap-2 p-3 rounded-lg border border-rose-200 bg-rose-50 text-xs text-rose-800">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">{t('Completa todos los datos antes de guardar:')}</p>
                <p className="mt-0.5">{missing.join(' · ')}</p>
              </div>
            </div>
          )}
          {/* Main Attributes: every box the same height, border and text size */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-4 gap-y-4">
            <div>
              <label className={labelCls}>{t('Número de Fila / ID')}</label>
              <input
                type="text"
                value={formData.rowNo}
                readOnly
                title={t('Lo asigna la app (Ordenar y renumerar)')}
                className={`${readOnlyField} font-mono`}
              />
            </div>
            <div>
              <label className={labelCls}>{t('Proyecto')}</label>
              <input type="text" value={formData.projectName} readOnly className={readOnlyField} />
            </div>
            <div>
              <label className={labelCls}>{t('Etapa / Orientación')}</label>
              <select
                value={formData.orientation}
                onChange={e => setFormData({ ...formData, orientation: e.target.value })}
                className={`${fieldCls} ${bad(filled(formData.orientation))}`}
              >
                <option value="">{t('Elegir…')}</option>
                {(STAGES.includes(formData.orientation) || !formData.orientation ? STAGES : [formData.orientation, ...STAGES]).map(s => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="flex items-baseline justify-between gap-2">
                <label className={labelCls}>{t('Tipo de Defecto')}</label>
                {canManageTypes && (
                  <button type="button" onClick={() => setManagingTypes(true)} className="mb-1.5 text-[11px] text-slate-500 underline hover:text-slate-900 whitespace-nowrap">
                    {t('Gestionar tipos')}
                  </button>
                )}
              </div>
              <select
                value={formData.defect}
                onChange={e => setFormData({ ...formData, defect: e.target.value })}
                className={`${fieldCls} ${bad(filled(formData.defect))}`}
              >
                <option value="">{t('Elegir…')}</option>
                {/* A type outside the list (older data) stays selectable so it isn't lost */}
                {formData.defect && !types.some(d => d.name === formData.defect && !d.hidden) && (
                  <option value={formData.defect}>{formData.defect}</option>
                )}
                {types.filter(d => !d.hidden).map(d => (
                  <option key={d.name} value={d.name}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>{t('Urgencia')}</label>
              <select
                value={formData.urgency}
                onChange={e => setFormData({ ...formData, urgency: e.target.value as UrgencyLevel })}
                className={fieldCls}
              >
                <option value="LOW">{t(URGENCY_LABEL.LOW)}</option>
                <option value="MEDIUM">{t(URGENCY_LABEL.MEDIUM)}</option>
                <option value="HIGH">{t(URGENCY_LABEL.HIGH)}</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>{t('Estado')}</label>
              <select
                value={formData.status}
                onChange={e => setFormData({ ...formData, status: e.target.value as DefectStatus })}
                className={fieldCls}
              >
                <option value="BEFORE">{t(STATUS_LABEL.BEFORE)}</option>
                <option value="IN PROGRESS">{t(STATUS_LABEL['IN PROGRESS'])}</option>
                <option value="COMPLETED">{t(STATUS_LABEL.COMPLETED)}</option>
              </select>
            </div>
          </div>

          {/* Location and measurements: two panels on the same line (stacked on phones) */}
          <div className="grid grid-cols-1 md:grid-cols-[2fr_3fr] gap-4">
            <div className={panelCls}>
              <p className={panelTitleCls}>{t('Ubicación')}</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>{t('Línea (Drop)')}</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={formData.drop}
                    onChange={e => setFormData({ ...formData, drop: e.target.value })}
                    placeholder={t('Ej. 1')}
                    className={`${fieldCls} text-center font-mono ${bad(filled(formData.drop))}`}
                  />
                </div>
                <div>
                  <label className={labelCls}>{t('Nivel / Piso')}</label>
                  <input
                    type="text"
                    value={formData.level}
                    onChange={e => setFormData({ ...formData, level: e.target.value.toUpperCase() })}
                    placeholder="G, 1… R"
                    className={`${fieldCls} text-center font-mono ${bad(filled(formData.level))}`}
                  />
                </div>
              </div>
            </div>

            {/* Only the measurements this defect type needs */}
            <div className={panelCls}>
              <p className={panelTitleCls}>{t('Medidas')}</p>
              <div
                className={`grid gap-3 ${
                  measures.length === 1 ? 'grid-cols-1' : measures.length === 2 ? 'grid-cols-2' : 'grid-cols-1 sm:grid-cols-[1.8fr_1fr_1fr]'
                }`}
              >
                {measures.includes('area') && (
                  <div>
                    <label className={labelCls}>{t('Base × Altura (m)')}</label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={formData.baseM}
                        onChange={e => setFormData({ ...formData, baseM: e.target.value })}
                        placeholder="0.0"
                        aria-label={t('Base')}
                        className={`${fieldCls} text-center font-mono ${bad(filled(formData.baseM) || anyMeasure)}`}
                      />
                      <span className="text-slate-400 text-sm">×</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={formData.heightM}
                        onChange={e => setFormData({ ...formData, heightM: e.target.value })}
                        placeholder="0.0"
                        aria-label={t('Alto')}
                        className={`${fieldCls} text-center font-mono ${bad(filled(formData.heightM) || anyMeasure)}`}
                      />
                    </div>
                  </div>
                )}
                {measures.includes('linear') && (
                  <div>
                    <label className={labelCls}>{t('Metros Lineales (m)')}</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={formData.linearMeters}
                      onChange={e => setFormData({ ...formData, linearMeters: e.target.value })}
                      placeholder="0.0"
                      className={`${fieldCls} text-center font-mono ${bad(measureOk.linear || anyMeasure)}`}
                    />
                  </div>
                )}
                {measures.includes('quantity') && (
                  <div>
                    <label className={labelCls}>{t('Cantidad')}</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={formData.quantity}
                      onChange={e => setFormData({ ...formData, quantity: e.target.value })}
                      placeholder="0"
                      className={`${fieldCls} text-center font-mono ${bad(measureOk.quantity || anyMeasure)}`}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Comment & Notes */}
          <div>
            <label className={labelCls}>{t('Comentarios y Notas de Campo')}</label>
            <textarea
              rows={2}
              value={formData.comment}
              onChange={e => setFormData({ ...formData, comment: e.target.value })}
              className={`${fieldCls} h-auto min-h-20 py-2 resize-y`}
              placeholder={t('Ej. INTRODUCE NEW JOINT, fisuras observadas, requiere andamio...')}
            />
          </div>

          {/* Custom Tags */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-700">
              {t('Etiquetas Personalizadas')}
            </label>
            <div className="flex flex-wrap items-center gap-1.5">
              {(formData.customTags || []).map((tag, tIdx) => (
                <span
                  key={tIdx}
                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 text-slate-800 rounded-md text-xs border border-slate-200 font-medium"
                >
                  <span>{tag}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(tag)}
                    className="text-slate-400 hover:text-rose-600 ml-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}

              <div className="flex items-center gap-1">
                <input
                  type="text"
                  value={newTagInput}
                  onChange={e => setNewTagInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddTag();
                    }
                  }}
                  placeholder={t('+ Añadir etiqueta...')}
                  className="px-2.5 py-1 border border-slate-200 rounded-md text-xs focus:outline-hidden focus:border-slate-400 w-36"
                />
                <button
                  type="button"
                  onClick={handleAddTag}
                  className="px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded-md text-xs font-medium text-slate-700"
                >
                  {t('Añadir')}
                </button>
              </div>
            </div>
          </div>

          {/* Stage reference drawing (FCRS) for the chosen stage / orientation */}
          {(() => {
            const stageImage = stageImageFor(formData.orientation || '');
            if (!stageImage) return null;
            return (
              <div className="pt-2 border-t border-slate-100">
                <span className="block text-xs font-semibold text-slate-700 mb-1.5">FCRS · {formData.orientation}</span>
                <button
                  type="button"
                  onClick={() => setShowStageImage(true)}
                  title={t('Ver en pantalla completa')}
                  className="w-40 h-28 rounded-lg overflow-hidden border border-indigo-200 bg-white hover:border-indigo-400 hover:shadow-sm transition-all"
                >
                  <img src={stageImage.thumb} alt={`FCRS ${formData.orientation}`} className="w-full h-full object-cover" />
                </button>
                {showStageImage && (
                  <StageImageViewer src={stageImage.full} title={formData.orientation} onClose={() => setShowStageImage(false)} />
                )}
              </div>
            );
          })()}

          {/* Photo Management */}
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700 block">
                {t('Gestión de Fotografías ({n})', { n: formData.photos.length })}
              </label>

              {can('photos.add') && (
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-xs text-indigo-600 hover:underline font-medium inline-flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> {t('Subir archivo')}
                </button>
                <span className="text-slate-300">·</span>
                <button
                  type="button"
                  onClick={handleAddPhotoByUrl}
                  className="text-xs text-indigo-600 hover:underline font-medium"
                >
                  {t('+ Pegar URL')}
                </button>
              </div>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {formData.photos.map((photoItem, pIdx) => {
                const photoUrl = typeof photoItem === 'string' ? photoItem : photoItem.url;
                const photoPhase: PhotoPhase =
                  typeof photoItem === 'string'
                    ? pIdx >= 6
                      ? 'COMPLETED'
                      : pIdx >= 3
                      ? 'IN PROGRESS'
                      : 'BEFORE'
                    : photoItem.phase || 'BEFORE';

                const phaseSelectStyle = {
                  BEFORE: 'bg-slate-100 text-slate-700 border-slate-300',
                  'IN PROGRESS': 'bg-amber-100 text-amber-800 border-amber-300 font-bold',
                  COMPLETED: 'bg-emerald-100 text-emerald-800 border-emerald-300 font-bold',
                }[photoPhase];

                return (
                  <div key={pIdx} className="flex flex-col">
                    {/* PHASE SELECTOR DIRECTLY ABOVE PHOTO */}
                    <select
                      value={photoPhase}
                      onChange={e => handleChangePhotoPhase(pIdx, e.target.value as PhotoPhase)}
                      className={`w-full mb-1 text-[10px] font-black uppercase tracking-wider py-1 px-1.5 rounded-md border focus:outline-hidden ${phaseSelectStyle}`}
                    >
                      <option value="BEFORE">{t(PHASE_LABEL.BEFORE)}</option>
                      <option value="IN PROGRESS">{t(PHASE_LABEL['IN PROGRESS'])}</option>
                      <option value="COMPLETED">{t(PHASE_LABEL.COMPLETED)}</option>
                    </select>

                    {/* Photo thumbnail */}
                    <div className="relative group border border-slate-200 rounded-lg overflow-hidden bg-slate-900">
                      <img
                        src={thumbUrl(photoUrl, 320)}
                        onError={fallbackTo(photoUrl)}
                        alt={`Foto ${pIdx + 1}`}
                        referrerPolicy="no-referrer"
                        className="w-full h-24 object-cover"
                      />

                      <div className="absolute top-1 right-1 flex items-center gap-1 bg-black/60 rounded p-0.5">
                        <button
                          type="button"
                          disabled={pIdx === 0}
                          onClick={() => handleMovePhotoOrder(pIdx, 'up')}
                          title={t('Mover antes')}
                          className="p-1 text-white hover:bg-white/20 rounded disabled:opacity-30"
                        >
                          <ArrowUp className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          disabled={pIdx === formData.photos.length - 1}
                          onClick={() => handleMovePhotoOrder(pIdx, 'down')}
                          title={t('Mover después')}
                          className="p-1 text-white hover:bg-white/20 rounded disabled:opacity-30"
                        >
                          <ArrowDown className="w-3 h-3" />
                        </button>
                        {canDelete && (
                        <button
                          type="button"
                          onClick={() => handleRemovePhoto(pIdx)}
                          title={t('Eliminar foto')}
                          className="p-1 text-rose-400 hover:bg-rose-500 hover:text-white rounded"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Technicians and dates are filled in automatically from who adds each photo */}
          {pending && <PhasePicker preview={pending.preview} onPick={addPendingPhoto} onCancel={closePending} />}
          {managingTypes && <ManageTypesModal items={allItems} onClose={() => setManagingTypes(false)} />}

          {/* Modal Footer */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            >
              {t('Cancelar')}
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-sm transition-colors"
            >
              <Save className="w-4 h-4" />
              {t('Guardar Cambios')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
