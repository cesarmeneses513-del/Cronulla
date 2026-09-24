import React, { useState, useRef } from 'react';
import { uploadPhoto } from '../lib/supabase';
import {
  GripVertical,
  Plus,
  Trash2,
  Edit2,
  Copy,
  Clock,
  User,
  Ruler,
  MessageSquare,
  AlertCircle,
  CheckCircle2,
  Timer,
  ChevronRight,
  ExternalLink
} from 'lucide-react';
import { DefectItem, DragPhotoPayload, DefectStatus, UrgencyLevel, PhotoPhase, DefectPhoto } from '../types/inspection';

interface DefectRowCardProps {
  item: DefectItem;
  index: number;
  onEdit: (item: DefectItem) => void;
  onDuplicate: (item: DefectItem) => void;
  onDelete: (id: string) => void;
  onOpenPhotoLightbox: (item: DefectItem, photoIndex: number) => void;
  onMovePhoto: (payload: DragPhotoPayload, targetItemId: string, targetPhotoIndex?: number) => void;
  onAddPhoto: (itemId: string, photoUrl: string, phase?: PhotoPhase) => void;
  onDeletePhoto: (itemId: string, photoIndex: number) => void;
  onUpdatePhotoPhase?: (itemId: string, photoIndex: number, phase: PhotoPhase) => void;
  onQuickUpdateStatus: (itemId: string, status: DefectStatus) => void;
  onQuickUpdateUrgency: (itemId: string, urgency: UrgencyLevel) => void;
  readOnly?: boolean;
}

export const DefectRowCard: React.FC<DefectRowCardProps> = ({
  item,
  index,
  onEdit,
  onDuplicate,
  onDelete,
  onOpenPhotoLightbox,
  onMovePhoto,
  onAddPhoto,
  onDeletePhoto,
  onUpdatePhotoPhase,
  onQuickUpdateStatus,
  onQuickUpdateUrgency,
  readOnly = false,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Status visual styling
  const statusConfig = {
    BEFORE: {
      label: 'Antes',
      color: 'text-slate-700 bg-slate-100 hover:bg-slate-200 border-slate-300',
      dot: 'bg-slate-400',
      icon: Clock,
    },
    'IN PROGRESS': {
      label: 'En Progreso',
      color: 'text-amber-800 bg-amber-50 hover:bg-amber-100 border-amber-300',
      dot: 'bg-amber-500',
      icon: Timer,
    },
    COMPLETED: {
      label: 'Completado',
      color: 'text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border-emerald-300',
      dot: 'bg-emerald-500',
      icon: CheckCircle2,
    },
  }[item.status] || {
    label: item.status,
    color: 'text-slate-700 bg-slate-100 border-slate-300',
    dot: 'bg-slate-400',
    icon: Clock,
  };

  // Urgency styling
  const urgencyConfig = {
    HIGH: { label: 'Alta', color: 'text-rose-700 bg-rose-50 hover:bg-rose-100 border-rose-200' },
    MEDIUM: { label: 'Media', color: 'text-amber-700 bg-amber-50 hover:bg-amber-100 border-amber-200' },
    LOW: { label: 'Baja', color: 'text-slate-700 bg-slate-100 hover:bg-slate-200 border-slate-200' },
  }[item.urgency] || { label: item.urgency, color: 'text-slate-700 bg-slate-100 border-slate-200' };

  // Cycle status on click
  const cycleStatus = (e: React.MouseEvent) => {
    e.stopPropagation();
    const cycle: DefectStatus[] = ['BEFORE', 'IN PROGRESS', 'COMPLETED'];
    const curIdx = cycle.indexOf(item.status);
    const next = cycle[(curIdx + 1) % cycle.length];
    onQuickUpdateStatus(item.id, next);
  };

  // Cycle urgency on click
  const cycleUrgency = (e: React.MouseEvent) => {
    e.stopPropagation();
    const cycle: UrgencyLevel[] = ['LOW', 'MEDIUM', 'HIGH'];
    const curIdx = cycle.indexOf(item.urgency);
    const next = cycle[(curIdx + 1) % cycle.length];
    onQuickUpdateUrgency(item.id, next);
  };

  // Handle Drag Start of a photo
  const handlePhotoDragStart = (e: React.DragEvent, photo: DefectPhoto | string, pIdx: number) => {
    const photoUrl = typeof photo === 'string' ? photo : photo.url;
    const phase = typeof photo === 'string' ? undefined : photo.phase;
    const payload: DragPhotoPayload = {
      sourceItemId: item.id,
      photoUrl,
      photoIndex: pIdx,
      phase,
    };
    e.dataTransfer.setData('application/json', JSON.stringify(payload));
    e.dataTransfer.effectAllowed = 'move';
  };

  // Handle Drag Over row
  const handleRowDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (!isDragOver) setIsDragOver(true);
  };

  const handleRowDragLeave = (e: React.DragEvent) => {
    // Only reset if left the row completely
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
      setDragOverIndex(null);
    }
  };

  // Handle Drop onto row or specific photo slot
  const handleRowDrop = (e: React.DragEvent, targetSlotIndex?: number) => {
    e.preventDefault();
    setIsDragOver(false);
    setDragOverIndex(null);

    const rawData = e.dataTransfer.getData('application/json');
    if (!rawData) return;

    try {
      const payload: DragPhotoPayload = JSON.parse(rawData);
      onMovePhoto(payload, item.id, targetSlotIndex);
    } catch (err) {
      console.error('Failed to parse drag payload', err);
    }
  };

  // File upload handler
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    onAddPhoto(item.id, await uploadPhoto(file));
  };

  const handlePromptAddPhoto = () => {
    const url = window.prompt('Ingrese la URL de la fotografía o use el selector de archivos:');
    if (url && url.trim().length > 0) {
      onAddPhoto(item.id, url.trim());
    }
  };

  return (
    <div
      onDragOver={readOnly ? undefined : handleRowDragOver}
      onDragLeave={readOnly ? undefined : handleRowDragLeave}
      onDrop={readOnly ? undefined : e => handleRowDrop(e)}
      className={`relative bg-white border rounded-xl transition-all duration-200 shadow-xs ${
        isDragOver
          ? 'border-emerald-500 bg-emerald-50/40 ring-2 ring-emerald-400/30'
          : 'border-slate-200 hover:border-slate-300'
      }`}
    >
      {/* Drop Zone Banner when Dragging Over */}
      {isDragOver && (
        <div className="absolute inset-0 bg-emerald-500/10 backdrop-blur-[1px] border-2 border-dashed border-emerald-500 rounded-xl z-20 flex items-center justify-center pointer-events-none">
          <div className="bg-emerald-700 text-white font-semibold text-xs px-3 py-1.5 rounded-lg shadow-md flex items-center gap-2">
            <Plus className="w-4 h-4" />
            <span>Mover fotografía a la fila #{item.rowNo} ({item.defect})</span>
          </div>
        </div>
      )}

      {/* Row Header & Metadata Bar */}
      <div className="p-3 sm:p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
        {/* Left: Index, Row No, Orientation, Defect Name */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-1.5">
            {!readOnly && <GripVertical className="w-4 h-4 text-slate-300" />}
            <span className="text-xs font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
              #{item.rowNo}
            </span>
          </div>

          <span className="text-xs font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
            {item.orientation}
          </span>

          <h3 className="text-sm font-bold text-slate-900 tracking-tight">
            {item.defect}
          </h3>

          {/* Location details: Drop & Level */}
          <div className="flex items-center gap-1.5 text-xs text-slate-600 bg-slate-50 px-2.5 py-0.5 rounded border border-slate-200 font-medium">
            <span>Drop: <strong className="text-slate-900 font-mono">{item.drop || '—'}</strong></span>
            <span className="text-slate-300">/</span>
            <span>Nivel: <strong className="text-slate-900 font-mono">{item.level || '—'}</strong></span>
          </div>
        </div>

        {/* Right: Status & Urgency interactive triggers + Actions */}
        <div className="flex items-center gap-2 ml-auto">
          {/* Status badge button */}
          <button
            onClick={readOnly ? undefined : cycleStatus}
            disabled={readOnly}
            title={readOnly ? undefined : 'Click para cambiar estado'}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-md border transition-all disabled:cursor-default ${statusConfig.color}`}
          >
            <span className={`w-2 h-2 rounded-full ${statusConfig.dot}`} />
            <span>{statusConfig.label}</span>
          </button>

          {/* Urgency badge button */}
          <button
            onClick={readOnly ? undefined : cycleUrgency}
            disabled={readOnly}
            title={readOnly ? undefined : 'Click para alternar urgencia'}
            className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-md border transition-all disabled:cursor-default ${urgencyConfig.color}`}
          >
            <AlertCircle className="w-3 h-3" />
            <span>{urgencyConfig.label}</span>
          </button>

          {/* Action buttons */}
          {!readOnly && (
          <div className="flex items-center border-l border-slate-200 pl-2 gap-1">
            <button
              onClick={() => onEdit(item)}
              title="Editar todos los datos del defecto"
              className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => onDuplicate(item)}
              title="Duplicar este registro"
              className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => onDelete(item.id)}
              title="Eliminar registro"
              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
          )}
        </div>
      </div>

      {/* Row Body: Photo Gallery Reel & Secondary Metadata */}
      <div className="p-3 sm:p-4 space-y-3">
        {/* Photo Gallery Track */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="font-semibold text-slate-700 flex items-center gap-1.5">
              <span>Fotografías ({item.photos.length})</span>
              {!readOnly && (
                <span className="text-[11px] font-normal text-slate-400">
                  Arrastra para ordenar o mover a otra fila
                </span>
              )}
            </span>

            {!readOnly && (
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="text-xs text-slate-600 hover:text-slate-900 hover:underline inline-flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> Subir archivo
              </button>
              <span className="text-slate-300">·</span>
              <button
                onClick={handlePromptAddPhoto}
                className="text-xs text-slate-600 hover:text-slate-900 hover:underline"
              >
                + Pegar URL
              </button>
            </div>
            )}
          </div>

          {/* Photo slots container */}
          <div className="flex flex-wrap items-start gap-3 min-h-[110px] bg-slate-50/60 p-3 rounded-lg border border-slate-200/80">
            {item.photos.length === 0 ? (
              <div className="w-full py-5 text-center text-xs text-slate-400 border border-dashed border-slate-300 rounded-md bg-white">
                {readOnly
                  ? 'No hay fotografías registradas en esta fila.'
                  : 'No hay fotografías registradas en esta fila. Arrastra una foto aquí o haz clic en Subir.'}
              </div>
            ) : (
              item.photos.map((photo, pIdx) => {
                const photoUrl = typeof photo === 'string' ? photo : photo.url;
                const phase: PhotoPhase = typeof photo === 'string'
                  ? (pIdx >= 6 ? 'COMPLETED' : pIdx >= 3 ? 'IN PROGRESS' : 'BEFORE')
                  : photo.phase;

                const phaseStyles = {
                  BEFORE: {
                    badge: 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200 hover:border-slate-400',
                    dot: 'bg-slate-400',
                    label: 'BEFORE',
                  },
                  'IN PROGRESS': {
                    badge: 'bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-200 hover:border-amber-400',
                    dot: 'bg-amber-500',
                    label: 'IN PROGRESS',
                  },
                  COMPLETED: {
                    badge: 'bg-emerald-100 text-emerald-800 border-emerald-300 hover:bg-emerald-200 hover:border-emerald-400',
                    dot: 'bg-emerald-500',
                    label: 'COMPLETED',
                  },
                }[phase] || {
                  badge: 'bg-slate-100 text-slate-700 border-slate-300',
                  dot: 'bg-slate-400',
                  label: phase,
                };

                return (
                  <div key={`${item.id}-p-${pIdx}`} className="flex flex-col items-center">
                    {/* LABEL DIRECTLY ABOVE PHOTO */}
                    <button
                      type="button"
                      disabled={readOnly}
                      onClick={() => {
                        if (onUpdatePhotoPhase && !readOnly) {
                          const cycle: PhotoPhase[] = ['BEFORE', 'IN PROGRESS', 'COMPLETED'];
                          const next = cycle[(cycle.indexOf(phase) + 1) % cycle.length];
                          onUpdatePhotoPhase(item.id, pIdx, next);
                        }
                      }}
                      title={readOnly ? undefined : 'Clic para cambiar: BEFORE, IN PROGRESS o COMPLETED'}
                      className={`w-24 sm:w-28 mb-1.5 py-0.5 px-1.5 rounded text-[10px] font-black uppercase tracking-wider flex items-center justify-between border shadow-2xs transition-all cursor-pointer disabled:cursor-default ${phaseStyles.badge}`}
                    >
                      <span className="flex items-center gap-1 truncate">
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${phaseStyles.dot}`} />
                        <span className="truncate">{phaseStyles.label}</span>
                      </span>
                      <span className="text-[9px] font-mono opacity-60 shrink-0">F{pIdx + 1}</span>
                    </button>

                    {/* Photo thumbnail */}
                    <div
                      draggable={!readOnly}
                      onDragStart={readOnly ? undefined : e => handlePhotoDragStart(e, photo, pIdx)}
                      onDragOver={
                        readOnly
                          ? undefined
                          : e => {
                              e.preventDefault();
                              e.stopPropagation();
                              setDragOverIndex(pIdx);
                            }
                      }
                      onDrop={
                        readOnly
                          ? undefined
                          : e => {
                              e.stopPropagation();
                              handleRowDrop(e, pIdx);
                            }
                      }
                      className={`group relative w-24 h-24 sm:w-28 sm:h-28 rounded-lg overflow-hidden border bg-slate-900 transition-all shadow-xs ${
                        readOnly ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing'
                      } ${
                        dragOverIndex === pIdx
                          ? 'border-emerald-500 ring-2 ring-emerald-400'
                          : 'border-slate-200 hover:border-slate-400 hover:shadow-sm'
                      }`}
                    >
                      <img
                        src={photoUrl}
                        alt={`Foto ${pIdx + 1} - ${item.defect}`}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                        onClick={() => onOpenPhotoLightbox(item, pIdx)}
                      />

                      {/* Actions overlay on hover */}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 p-1">
                        <button
                          onClick={() => onOpenPhotoLightbox(item, pIdx)}
                          title="Ver en pantalla completa"
                          className="p-1.5 bg-white text-slate-900 rounded-full hover:bg-slate-100 shadow-xs"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </button>
                        {!readOnly && (
                          <button
                            onClick={() => onDeletePhoto(item.id, pIdx)}
                            title="Quitar foto"
                            className="p-1.5 bg-rose-600 text-white rounded-full hover:bg-rose-700 shadow-xs"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}

            {/* Quick Add Button */}
            {!readOnly && (
            <div className="flex flex-col items-center">
              <span className="w-24 sm:w-28 mb-1.5 py-0.5 text-[10px] font-bold text-center text-slate-400 uppercase tracking-wider">
                + NUEVA
              </span>
              <button
                onClick={() => fileInputRef.current?.click()}
                title="Añadir fotografía a esta fila"
                className="w-24 h-24 sm:w-28 sm:h-28 border border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center text-slate-400 hover:text-slate-700 hover:border-slate-400 hover:bg-white transition-all gap-1 text-xs"
              >
                <Plus className="w-5 h-5" />
                <span className="text-[11px] font-medium">Añadir</span>
              </button>
            </div>
            )}
          </div>
        </div>

        {/* Technical Inspection Metadata & Dimensions Bar */}
        <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between text-xs text-slate-600 gap-y-2 gap-x-4">
          {/* Dimensions */}
          <div className="flex flex-wrap items-center gap-3">
            {(item.linearMeters || item.baseM || item.heightM || item.quantity) ? (
              <div className="flex items-center gap-2 bg-slate-50 px-2.5 py-1 rounded border border-slate-200">
                <Ruler className="w-3.5 h-3.5 text-slate-500" />
                {item.linearMeters && (
                  <span>
                    Metros lineales: <strong className="text-slate-900 font-mono tabular-nums">{item.linearMeters} m</strong>
                  </span>
                )}
                {(item.baseM || item.heightM) && (
                  <span>
                    Dimensión: <strong className="text-slate-900 font-mono tabular-nums">{item.baseM || '0'} × {item.heightM || '0'} m</strong>
                  </span>
                )}
                {item.quantity && (
                  <span>
                    Cantidad: <strong className="text-slate-900 font-mono tabular-nums">{item.quantity}</strong>
                  </span>
                )}
              </div>
            ) : (
              <span className="text-slate-400 text-xs italic">Sin medidas especificadas</span>
            )}

            {/* Comment */}
            {item.comment && (
              <div className="flex items-center gap-1.5 text-amber-900 bg-amber-50/80 px-2.5 py-1 rounded border border-amber-200 max-w-md truncate">
                <MessageSquare className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span className="truncate font-medium">{item.comment}</span>
              </div>
            )}

            {/* Custom tags */}
            {item.customTags && item.customTags.length > 0 && (
              <div className="flex items-center gap-1">
                {item.customTags.map((tag, tIdx) => (
                  <span
                    key={tIdx}
                    className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[11px] border border-slate-200"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Technicians & Dates */}
          <div className="flex items-center gap-3 text-slate-500 text-[11px]">
            {item.technicianStart && (
              <span className="flex items-center gap-1">
                <User className="w-3 h-3 text-slate-400" />
                <span>Inicio: <strong>{item.technicianStart}</strong> {item.date1stPhoto && `(${item.date1stPhoto})`}</span>
              </span>
            )}
            {item.technicianCompleted && (
              <span className="flex items-center gap-1 text-emerald-700">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                <span>Listo: <strong>{item.technicianCompleted}</strong> {item.dateCompleted && `(${item.dateCompleted})`}</span>
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
