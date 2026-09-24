import React, { useState, useEffect } from 'react';
import {
  X,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Download,
  ArrowRightLeft,
  Trash2,
  MapPin,
  Calendar,
  User,
  Ruler,
  AlertCircle,
  CheckCircle2,
  Clock,
  Tag
} from 'lucide-react';
import { DefectItem, DragPhotoPayload, PhotoPhase, DefectPhoto } from '../types/inspection';

interface PhotoLightboxProps {
  item: DefectItem;
  photoIndex: number;
  allItems: DefectItem[];
  onClose: () => void;
  onNavigatePhoto: (item: DefectItem, newPhotoIndex: number) => void;
  onMovePhoto: (payload: DragPhotoPayload, targetItemId: string) => void;
  onDeletePhoto: (itemId: string, photoIndex: number) => void;
  onUpdatePhotoPhase?: (itemId: string, photoIndex: number, phase: PhotoPhase) => void;
  readOnly?: boolean;
}

export const PhotoLightbox: React.FC<PhotoLightboxProps> = ({
  item,
  photoIndex,
  allItems,
  onClose,
  onNavigatePhoto,
  onMovePhoto,
  onDeletePhoto,
  onUpdatePhotoPhase,
  readOnly = false,
}) => {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [targetRowId, setTargetRowId] = useState<string>('');

  const currentPhoto = item.photos[photoIndex];
  const currentPhotoUrl = typeof currentPhoto === 'string' ? currentPhoto : currentPhoto?.url || '';
  const currentPhase: PhotoPhase =
    typeof currentPhoto === 'string'
      ? photoIndex >= 6
        ? 'COMPLETED'
        : photoIndex >= 3
        ? 'IN PROGRESS'
        : 'BEFORE'
      : currentPhoto?.phase || 'BEFORE';

  const hasPrev = photoIndex > 0;
  const hasNext = photoIndex < item.photos.length - 1;

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && hasPrev) onNavigatePhoto(item, photoIndex - 1);
      if (e.key === 'ArrowRight' && hasNext) onNavigatePhoto(item, photoIndex + 1);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hasPrev, hasNext, item, photoIndex, onClose, onNavigatePhoto]);

  // Reset zoom & rotation when photo changes
  useEffect(() => {
    setZoom(1);
    setRotation(0);
  }, [currentPhotoUrl]);

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.5, 3));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.5, 1));
  const handleRotate = () => setRotation(prev => (prev + 90) % 360);

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = currentPhotoUrl;
    a.download = `defecto-${item.rowNo}-${currentPhase}-foto-${photoIndex + 1}.jpg`;
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleMovePhotoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetRowId || targetRowId === item.id) return;
    const payload: DragPhotoPayload = {
      sourceItemId: item.id,
      photoUrl: currentPhotoUrl,
      photoIndex,
      phase: currentPhase,
    };
    onMovePhoto(payload, targetRowId);
    onClose();
  };

  const phaseBadgeStyles = {
    BEFORE: 'bg-slate-700 text-slate-100 border-slate-500',
    'IN PROGRESS': 'bg-amber-500 text-slate-950 border-amber-300 font-black',
    COMPLETED: 'bg-emerald-600 text-white border-emerald-400',
  }[currentPhase];

  return (
    <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex flex-col md:flex-row overflow-hidden animate-in fade-in duration-200">
      {/* Top Mobile Bar */}
      <div className="md:hidden flex items-center justify-between px-4 py-3 bg-black/70 border-b border-white/10 text-white z-20">
        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded border ${phaseBadgeStyles}`}>
            {currentPhase}
          </span>
          <span className="text-xs font-mono font-bold">
            #{item.rowNo} · Foto {photoIndex + 1}/{item.photos.length}
          </span>
        </div>
        <button onClick={onClose} className="p-1 rounded-full bg-white/10 text-white">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Main Image Viewport */}
      <div className="relative flex-1 flex flex-col items-center justify-center p-4 select-none overflow-hidden">
        {/* Close Button (Desktop) */}
        <button
          onClick={onClose}
          className="hidden md:flex absolute top-4 right-4 z-20 p-2 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-full transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Toolbar (Zoom, Rotate, Download) */}
        <div className="absolute top-4 left-4 z-20 flex items-center gap-1.5 p-1 bg-black/70 backdrop-blur-md rounded-lg border border-white/10 text-white">
          <button
            onClick={handleZoomOut}
            title="Alejar"
            className="p-1.5 hover:bg-white/20 rounded transition-colors"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-[11px] font-mono px-1 tabular-nums">{Math.round(zoom * 100)}%</span>
          <button
            onClick={handleZoomIn}
            title="Acercar"
            className="p-1.5 hover:bg-white/20 rounded transition-colors"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <div className="w-px h-4 bg-white/20 mx-0.5" />
          <button
            onClick={handleRotate}
            title="Rotar 90°"
            className="p-1.5 hover:bg-white/20 rounded transition-colors"
          >
            <RotateCw className="w-4 h-4" />
          </button>
          <button
            onClick={handleDownload}
            title="Descargar imagen"
            className="p-1.5 hover:bg-white/20 rounded transition-colors"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>

        {/* PROMINENT LABEL DIRECTLY ABOVE PHOTO */}
        <div className="z-20 mb-3 flex items-center gap-2 bg-black/80 backdrop-blur-md border border-white/20 px-3 py-1.5 rounded-full shadow-lg">
          <span className="text-xs text-white/70 font-medium">ETAPA:</span>
          <div className="flex items-center gap-1">
            {(['BEFORE', 'IN PROGRESS', 'COMPLETED'] as PhotoPhase[]).map(ph => (
              <button
                key={ph}
                onClick={() => onUpdatePhotoPhase && onUpdatePhotoPhase(item.id, photoIndex, ph)}
                className={`px-2.5 py-0.5 rounded-full text-xs font-black uppercase transition-all tracking-wider ${
                  currentPhase === ph
                    ? ph === 'COMPLETED'
                      ? 'bg-emerald-500 text-white shadow-sm ring-2 ring-emerald-400/50'
                      : ph === 'IN PROGRESS'
                      ? 'bg-amber-500 text-slate-950 shadow-sm ring-2 ring-amber-400/50'
                      : 'bg-slate-200 text-slate-900 shadow-sm ring-2 ring-white/50'
                    : 'text-white/60 hover:text-white hover:bg-white/10'
                }`}
              >
                {ph}
              </button>
            ))}
          </div>
        </div>

        {/* Navigation Arrows */}
        {hasPrev && (
          <button
            onClick={() => onNavigatePhoto(item, photoIndex - 1)}
            className="absolute left-4 top-1/2 -translate-y-1/2 p-3 text-white/80 hover:text-white bg-black/50 hover:bg-black/80 rounded-full transition-all z-20"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        )}

        {hasNext && (
          <button
            onClick={() => onNavigatePhoto(item, photoIndex + 1)}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-3 text-white/80 hover:text-white bg-black/50 hover:bg-black/80 rounded-full transition-all z-20"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        )}

        {/* The Image */}
        <div
          className="max-w-full max-h-[75vh] flex items-center justify-center transition-transform duration-150 ease-out"
          style={{
            transform: `scale(${zoom}) rotate(${rotation}deg)`,
          }}
        >
          <img
            src={currentPhotoUrl}
            alt={`Fotografía ${photoIndex + 1} (${currentPhase}) de defecto ${item.defect}`}
            referrerPolicy="no-referrer"
            className="max-h-[75vh] max-w-[85vw] object-contain rounded-lg shadow-2xl border border-white/10"
          />
        </div>

        {/* Footer info below image */}
        <div className="z-10 mt-3 text-center text-xs text-white/70 font-mono">
          Foto {photoIndex + 1} de {item.photos.length} · Fila #{item.rowNo} · {item.orientation}
        </div>
      </div>

      {/* Right Sidebar: Details & Reassigning */}
      <div className="w-full md:w-96 bg-slate-900 border-t md:border-t-0 md:border-l border-white/10 p-5 flex flex-col justify-between overflow-y-auto max-h-[45vh] md:max-h-none text-slate-200">
        <div className="space-y-4">
          {/* Header info */}
          <div>
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-mono font-bold text-amber-400">FILA #{item.rowNo}</span>
              <span className="font-semibold text-slate-300">{item.projectName}</span>
            </div>
            <h3 className="text-base font-bold text-white mt-1">{item.defect}</h3>
            <p className="text-xs text-slate-400 mt-0.5">{item.orientation}</p>
          </div>

          {/* Phase Badge in Sidebar */}
          <div className="p-3 bg-white/5 rounded-lg border border-white/10">
            <span className="text-slate-400 block text-[11px] mb-1">Etapa de esta fotografía:</span>
            <div className="flex items-center gap-1.5">
              <span className={`inline-block px-2.5 py-1 rounded text-xs font-black uppercase tracking-wider ${phaseBadgeStyles}`}>
                {currentPhase}
              </span>
              <span className="text-xs text-slate-400 font-mono">
                (Slot {currentPhoto && typeof currentPhoto === 'object' && currentPhoto.slot ? currentPhoto.slot : photoIndex + 1})
              </span>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2.5 bg-white/5 rounded-lg border border-white/10">
              <span className="text-slate-400 block text-[11px]">Ubicación</span>
              <span className="font-semibold text-white font-mono">
                Drop: {item.drop || '—'} · Piso: {item.level || '—'}
              </span>
            </div>

            <div className="p-2.5 bg-white/5 rounded-lg border border-white/10">
              <span className="text-slate-400 block text-[11px]">Estado & Urgencia</span>
              <span className="font-semibold text-white">
                {item.status} ({item.urgency})
              </span>
            </div>
          </div>

          {/* Dimensions */}
          {(item.linearMeters || item.baseM || item.heightM || item.quantity) && (
            <div className="p-2.5 bg-white/5 rounded-lg border border-white/10 text-xs space-y-1">
              <span className="text-slate-400 block text-[11px] font-semibold flex items-center gap-1">
                <Ruler className="w-3 h-3 text-slate-400" /> Dimensiones
              </span>
              <div className="text-white font-mono tabular-nums">
                {item.linearMeters && <div>Metros lineales: <strong>{item.linearMeters} m</strong></div>}
                {(item.baseM || item.heightM) && (
                  <div>Base × Altura: <strong>{item.baseM || '0'} × {item.heightM || '0'} m</strong></div>
                )}
                {item.quantity && <div>Cantidad: <strong>{item.quantity}</strong></div>}
              </div>
            </div>
          )}

          {/* Comment */}
          {item.comment && (
            <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs">
              <span className="text-amber-400 block text-[11px] font-semibold">Comentario / Nota</span>
              <p className="text-amber-100 font-medium mt-0.5">{item.comment}</p>
            </div>
          )}

          {/* Technicians */}
          <div className="text-xs text-slate-400 space-y-1 pt-1 border-t border-white/10">
            {item.technicianStart && (
              <div>Inicio: <strong className="text-white">{item.technicianStart}</strong> ({item.date1stPhoto || '—'})</div>
            )}
            {item.technicianCompleted && (
              <div>Finalizado: <strong className="text-emerald-400">{item.technicianCompleted}</strong> ({item.dateCompleted || '—'})</div>
            )}
          </div>

          {/* Thumbnail list of photos in this defect */}
          <div className="pt-2 border-t border-white/10">
            <span className="text-[11px] font-semibold text-slate-400 block mb-2">
              Fotos de esta fila ({item.photos.length})
            </span>
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {item.photos.map((p, idx) => {
                const url = typeof p === 'string' ? p : p.url;
                const ph = typeof p === 'string' ? (idx >= 6 ? 'COMPLETED' : idx >= 3 ? 'IN PROGRESS' : 'BEFORE') : p.phase;
                return (
                  <button
                    key={idx}
                    onClick={() => onNavigatePhoto(item, idx)}
                    className={`flex flex-col items-center shrink-0 transition-all ${
                      idx === photoIndex
                        ? 'ring-2 ring-amber-400 rounded-md p-0.5'
                        : 'opacity-60 hover:opacity-100'
                    }`}
                  >
                    <span className="text-[8px] font-bold text-slate-300 mb-0.5 uppercase">{ph}</span>
                    <div className="w-12 h-12 rounded overflow-hidden border border-white/20">
                      <img src={url} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Move Photo to Another Row Form */}
        {!readOnly && (
        <div className="pt-4 border-t border-white/10 space-y-3 mt-4">
          <form onSubmit={handleMovePhotoSubmit} className="space-y-2">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <ArrowRightLeft className="w-3.5 h-3.5 text-indigo-400" />
              <span>Mover foto a otra fila:</span>
            </label>
            <div className="flex gap-2">
              <select
                value={targetRowId}
                onChange={e => setTargetRowId(e.target.value)}
                className="flex-1 bg-white/10 border border-white/20 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-hidden"
              >
                <option value="" className="bg-slate-800 text-white">Seleccionar fila destino...</option>
                {allItems
                  .filter(i => i.id !== item.id)
                  .map(target => (
                    <option key={target.id} value={target.id} className="bg-slate-800 text-white">
                      #{target.rowNo} - {target.defect} ({target.drop || '—'}/{target.level || '—'})
                    </option>
                  ))}
              </select>

              <button
                type="submit"
                disabled={!targetRowId}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold rounded-lg transition-colors shadow-xs"
              >
                Mover
              </button>
            </div>
          </form>

          {/* Delete Photo Button */}
          <button
            onClick={() => {
              if (window.confirm('¿Seguro que deseas quitar esta fotografía de la fila?')) {
                onDeletePhoto(item.id, photoIndex);
                onClose();
              }
            }}
            className="w-full py-2 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Eliminar esta fotografía</span>
          </button>
        </div>
        )}
      </div>
    </div>
  );
};
