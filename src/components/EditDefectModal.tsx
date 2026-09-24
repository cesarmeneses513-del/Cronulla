import React, { useState, useRef } from 'react';
import { X, Plus, Trash2, ArrowUp, ArrowDown, Save, Camera, Ruler, User } from 'lucide-react';
import { DefectItem, UrgencyLevel, DefectStatus, PhotoPhase, DefectPhoto } from '../types/inspection';
import { uploadPhoto } from '../lib/supabase';
import { useI18n, PHASE_LABEL, STATUS_LABEL, URGENCY_LABEL } from '../i18n';

interface EditDefectModalProps {
  item: DefectItem | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedItem: DefectItem) => void;
}

const COMMON_DEFECTS = [
  'RENDER REPAIR',
  'RESEALING WORKS',
  'SKIM RENDERING',
  'SEAL WINDOW FRAME',
  'RENDER REPAIR TO SLAB EDGE',
  'RUST SPOT',
  'Rust Pipe',
  'BALUSTRADE',
  'NARROW',
  'CONTROL JOINT',
  'CONCRETE SPALLING',
  'DILAPITACION'
];

const COMMON_STAGES = [
  'STAGE 1',
  'STAGE 2',
  'STAGE 3',
  'STAGE 4',
  'STAGE 5',
  'STAGE 6',
  'STAGE 7',
  'STAGE 8'
];

export const EditDefectModal: React.FC<EditDefectModalProps> = ({
  item,
  isOpen,
  onClose,
  onSave,
}) => {
  const { t } = useI18n();
  if (!isOpen || !item) return null;

  const [formData, setFormData] = useState<DefectItem>({ ...item });
  const [newTagInput, setNewTagInput] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    onClose();
  };

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
      url,
      phase: newPhase,
      slot: typeof itemPhoto === 'object' ? itemPhoto.slot : index + 1,
    };
    setFormData({ ...formData, photos });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    const url = await uploadPhoto(file);
    setFormData(prev => {
      const newPhoto: DefectPhoto = {
        url,
        phase: 'BEFORE',
        slot: prev.photos.length + 1,
      };
      return { ...prev, photos: [...prev.photos, newPhoto] };
    });
  };

  const handleAddPhotoByUrl = () => {
    const url = window.prompt(t('Pegar enlace URL de la fotografía:'));
    if (url && url.trim()) {
      const newPhoto: DefectPhoto = {
        url: url.trim(),
        phase: 'BEFORE',
        slot: formData.photos.length + 1,
      };
      setFormData({
        ...formData,
        photos: [...formData.photos, newPhoto],
      });
    }
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
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-6 overflow-y-auto flex-1">
          {/* Main Attributes */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Row No & Project */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t('Número de Fila / ID')}
              </label>
              <input
                type="text"
                value={formData.rowNo}
                onChange={e => setFormData({ ...formData, rowNo: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs sm:text-sm font-mono focus:border-slate-400 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t('Proyecto')}
              </label>
              <input
                type="text"
                value={formData.projectName}
                onChange={e => setFormData({ ...formData, projectName: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs sm:text-sm focus:border-slate-400 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t('Etapa / Orientación')}
              </label>
              <input
                list="stages-list"
                value={formData.orientation}
                onChange={e => setFormData({ ...formData, orientation: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs sm:text-sm focus:border-slate-400 focus:outline-hidden"
              />
              <datalist id="stages-list">
                {COMMON_STAGES.map(s => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </div>
          </div>

          {/* Defect, Urgency, Status */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t('Tipo de Defecto')}
              </label>
              <input
                list="defects-list"
                value={formData.defect}
                onChange={e => setFormData({ ...formData, defect: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs sm:text-sm font-medium focus:border-slate-400 focus:outline-hidden"
              />
              <datalist id="defects-list">
                {COMMON_DEFECTS.map(d => (
                  <option key={d} value={d} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t('Urgencia')}
              </label>
              <select
                value={formData.urgency}
                onChange={e => setFormData({ ...formData, urgency: e.target.value as UrgencyLevel })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs sm:text-sm font-semibold focus:border-slate-400 focus:outline-hidden"
              >
                <option value="LOW">{t(URGENCY_LABEL.LOW)} (LOW)</option>
                <option value="MEDIUM">{t(URGENCY_LABEL.MEDIUM)} (MEDIUM)</option>
                <option value="HIGH">{t(URGENCY_LABEL.HIGH)} (HIGH)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t('Estado')}
              </label>
              <select
                value={formData.status}
                onChange={e => setFormData({ ...formData, status: e.target.value as DefectStatus })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs sm:text-sm font-semibold focus:border-slate-400 focus:outline-hidden"
              >
                <option value="BEFORE">{t(STATUS_LABEL.BEFORE)} (BEFORE)</option>
                <option value="IN PROGRESS">{t(STATUS_LABEL['IN PROGRESS'])} (IN PROGRESS)</option>
                <option value="COMPLETED">{t(STATUS_LABEL.COMPLETED)} (COMPLETED)</option>
              </select>
            </div>
          </div>

          {/* Location: Drop & Level */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t('Línea (Drop)')}
              </label>
              <input
                type="text"
                value={formData.drop}
                onChange={e => setFormData({ ...formData, drop: e.target.value })}
                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs sm:text-sm font-mono text-center font-bold focus:border-slate-400 focus:outline-hidden"
                placeholder={t('Ej. 1')}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t('Nivel / Piso')}
              </label>
              <input
                type="text"
                value={formData.level}
                onChange={e => setFormData({ ...formData, level: e.target.value })}
                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs sm:text-sm font-mono text-center font-bold focus:border-slate-400 focus:outline-hidden"
                placeholder={t('Ej. 4, G, R')}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t('Metros Lineales (m)')}
              </label>
              <input
                type="text"
                value={formData.linearMeters}
                onChange={e => setFormData({ ...formData, linearMeters: e.target.value })}
                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs sm:text-sm font-mono text-center focus:border-slate-400 focus:outline-hidden"
                placeholder="0.0"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t('Base × Altura (m)')}
              </label>
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  value={formData.baseM}
                  onChange={e => setFormData({ ...formData, baseM: e.target.value })}
                  className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono text-center focus:border-slate-400 focus:outline-hidden"
                  placeholder={t('Base')}
                />
                <span className="text-slate-400">×</span>
                <input
                  type="text"
                  value={formData.heightM}
                  onChange={e => setFormData({ ...formData, heightM: e.target.value })}
                  className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono text-center focus:border-slate-400 focus:outline-hidden"
                  placeholder={t('Alto')}
                />
              </div>
            </div>
          </div>

          {/* Comment & Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {t('Comentarios y Notas de Campo')}
            </label>
            <textarea
              rows={2}
              value={formData.comment}
              onChange={e => setFormData({ ...formData, comment: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs sm:text-sm focus:border-slate-400 focus:outline-hidden"
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

          {/* Photo Management */}
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700 block">
                {t('Gestión de Fotografías ({n})', { n: formData.photos.length })}
              </label>

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
                        src={photoUrl}
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
                        <button
                          type="button"
                          onClick={() => handleRemovePhoto(pIdx)}
                          title={t('Eliminar foto')}
                          className="p-1 text-rose-400 hover:bg-rose-500 hover:text-white rounded"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Technicians & Dates */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100 text-xs">
            <div className="space-y-2 bg-slate-50 p-3 rounded-lg border border-slate-200">
              <span className="font-semibold text-slate-800 block">{t('Técnico de Inicio')}</span>
              <input
                type="text"
                value={formData.technicianStart}
                onChange={e => setFormData({ ...formData, technicianStart: e.target.value })}
                placeholder={t('Nombre del técnico')}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded text-xs focus:outline-hidden"
              />
              <div className="flex gap-2">
                <input
                  type="text"
                  value={formData.date1stPhoto}
                  onChange={e => setFormData({ ...formData, date1stPhoto: e.target.value })}
                  placeholder={t('Fecha (dd/mm/aaaa)')}
                  className="w-1/2 px-2.5 py-1 bg-white border border-slate-200 rounded text-xs focus:outline-hidden"
                />
                <input
                  type="text"
                  value={formData.time1stPhoto}
                  onChange={e => setFormData({ ...formData, time1stPhoto: e.target.value })}
                  placeholder={t('Hora')}
                  className="w-1/2 px-2.5 py-1 bg-white border border-slate-200 rounded text-xs focus:outline-hidden"
                />
              </div>
            </div>

            <div className="space-y-2 bg-slate-50 p-3 rounded-lg border border-slate-200">
              <span className="font-semibold text-slate-800 block">{t('Técnico Finalizado')}</span>
              <input
                type="text"
                value={formData.technicianCompleted}
                onChange={e => setFormData({ ...formData, technicianCompleted: e.target.value })}
                placeholder={t('Nombre del técnico')}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded text-xs focus:outline-hidden"
              />
              <div className="flex gap-2">
                <input
                  type="text"
                  value={formData.dateCompleted}
                  onChange={e => setFormData({ ...formData, dateCompleted: e.target.value })}
                  placeholder={t('Fecha (dd/mm/aaaa)')}
                  className="w-1/2 px-2.5 py-1 bg-white border border-slate-200 rounded text-xs focus:outline-hidden"
                />
                <input
                  type="text"
                  value={formData.timeCompleted}
                  onChange={e => setFormData({ ...formData, timeCompleted: e.target.value })}
                  placeholder={t('Hora')}
                  className="w-1/2 px-2.5 py-1 bg-white border border-slate-200 rounded text-xs focus:outline-hidden"
                />
              </div>
            </div>
          </div>

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
