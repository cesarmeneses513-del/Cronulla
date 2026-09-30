import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  X,
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Download,
  Trash2,
  MapPin,
  Calendar,
  User,
  Ruler,
  AlertCircle,
  CheckCircle2,
  Clock,
  Tag,
  MoveRight,
  Check
} from 'lucide-react';
import { DefectItem, PhotoPhase } from '../types/inspection';
import { useI18n, PHASE_LABEL, STATUS_LABEL, URGENCY_LABEL } from '../i18n';
import { useDefectTypes } from '../lib/defectTypes';
import { thumbUrl, fallbackTo } from '../lib/thumb';
import { PhaseChips } from './PhaseChips';
import { SuggestInput } from './SuggestInput';

interface PhotoLightboxProps {
  item: DefectItem;
  photoIndex: number;
  allItems: DefectItem[];
  onClose: () => void;
  onNavigatePhoto: (item: DefectItem, newPhotoIndex: number) => void;
  onSaveItem?: (item: DefectItem) => void;
  // Previous / next defect in the list being viewed (to edit rows one after another).
  defectNav?: { index: number; total: number; onPrev?: () => void; onNext?: () => void };
  onDeletePhoto: (itemId: string, photoIndex: number) => void;
  onUpdatePhotoPhase?: (itemId: string, photoIndex: number, phase: PhotoPhase) => void;
  // Moves some photos of this defect to another one (e.g. uploaded to the wrong defect).
  onMovePhotos?: (sourceId: string, photoUrls: string[], targetId: string) => void;
  readOnly?: boolean;
  canDelete?: boolean;
}

export const PhotoLightbox: React.FC<PhotoLightboxProps> = ({
  item,
  photoIndex,
  allItems,
  onClose,
  onNavigatePhoto,
  onSaveItem,
  defectNav,
  onDeletePhoto,
  onUpdatePhotoPhase,
  onMovePhotos,
  readOnly = false,
  canDelete = true,
}) => {
  const { t } = useI18n();
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

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

  const hasPhoto = item.photos.length > 0;
  // Saves pending edits before moving to another defect, so nothing typed is lost.
  const flushRef = useRef<(() => void) | null>(null);
  const goDefect = (go?: () => void) => {
    if (!go) return;
    flushRef.current?.();
    go();
  };

  // Technicians
  const technicians = (
    <div className="text-xs text-slate-400 space-y-1 pt-1 border-t border-white/10">
      {item.technicianStart && (
        <div>{t('Inicio:')} <strong className="text-white">{item.technicianStart}</strong> ({item.date1stPhoto || '—'})</div>
      )}
      {item.technicianCompleted && (
        <div>{t('Finalizado:')} <strong className="text-emerald-400">{item.technicianCompleted}</strong> ({item.dateCompleted || '—'})</div>
      )}
    </div>
  );

  const hasPrev = photoIndex > 0;
  const hasNext = photoIndex < item.photos.length - 1;

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Typing in the edit fields must not close the viewer or change photo.
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT')) return;
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && hasPrev) onNavigatePhoto(item, photoIndex - 1);
      if (e.key === 'ArrowRight' && hasNext) onNavigatePhoto(item, photoIndex + 1);
      if (e.key === 'ArrowUp' && defectNav?.onPrev) {
        e.preventDefault();
        defectNav.onPrev();
      }
      if (e.key === 'ArrowDown' && defectNav?.onNext) {
        e.preventDefault();
        defectNav.onNext();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hasPrev, hasNext, item, photoIndex, onClose, onNavigatePhoto, defectNav]);

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
          {/* Phone: this badge is where the photo's phase is changed */}
          {hasPhoto && onUpdatePhotoPhase ? (
            <label className={`relative inline-flex items-center gap-1 text-[11px] font-black uppercase px-2.5 py-1 rounded border ${phaseBadgeStyles}`}>
              {t(PHASE_LABEL[currentPhase])}
              <ChevronDown className="w-3.5 h-3.5" />
              <select
                value={currentPhase}
                onChange={e => onUpdatePhotoPhase(item.id, photoIndex, e.target.value as PhotoPhase)}
                aria-label={t('Fase:')}
                className="absolute inset-0 opacity-0"
              >
                {(['BEFORE', 'IN PROGRESS', 'COMPLETED'] as PhotoPhase[]).map(ph => (
                  <option key={ph} value={ph}>
                    {t(PHASE_LABEL[ph])}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            hasPhoto && (
              <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded border ${phaseBadgeStyles}`}>
                {t(PHASE_LABEL[currentPhase])}
              </span>
            )
          )}
          <span className="text-xs font-mono font-bold">
            #{item.rowNo}{hasPhoto && <> · {t('Foto {i}/{n}', { i: photoIndex + 1, n: item.photos.length })}</>}
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
        <div className="absolute bottom-3 left-3 md:bottom-auto md:top-4 md:left-4 z-20 flex items-center gap-1.5 p-1 bg-black/70 backdrop-blur-md rounded-lg border border-white/10 text-white">
          <button
            onClick={handleZoomOut}
            title={t('Alejar')}
            className="p-1.5 hover:bg-white/20 rounded transition-colors"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-[11px] font-mono px-1 tabular-nums">{Math.round(zoom * 100)}%</span>
          <button
            onClick={handleZoomIn}
            title={t('Acercar')}
            className="p-1.5 hover:bg-white/20 rounded transition-colors"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <div className="w-px h-4 bg-white/20 mx-0.5" />
          <button
            onClick={handleRotate}
            title={t('Rotar 90°')}
            className="p-1.5 hover:bg-white/20 rounded transition-colors"
          >
            <RotateCw className="w-4 h-4" />
          </button>
          <button
            onClick={handleDownload}
            title={t('Descargar imagen')}
            className="p-1.5 hover:bg-white/20 rounded transition-colors"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>

        {/* Phone: which phases this row has photos for (blue) and which are missing (gray) */}
        <div className="md:hidden z-20 mb-3">
          <PhaseChips item={item} />
        </div>

        {/* PROMINENT LABEL DIRECTLY ABOVE PHOTO (desktop) */}
        {hasPhoto && (
        <div className="hidden md:flex z-20 mb-3 items-center gap-2 bg-black/80 backdrop-blur-md border border-white/20 px-3 py-1.5 rounded-full shadow-lg">
          <span className="hidden md:inline text-xs text-white/70 font-medium">{t('Fase:')}</span>
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
                {t(PHASE_LABEL[ph])}
              </button>
            ))}
          </div>
        </div>
        )}

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
        {!hasPhoto ? (
          <div className="z-10 px-6 py-10 rounded-xl border border-dashed border-white/20 text-center text-sm text-white/60 max-w-sm">
            {t('No hay fotografías registradas en esta fila.')}
          </div>
        ) : (
        <div
          className="max-w-full max-h-[40vh] md:max-h-[75vh] flex items-center justify-center transition-transform duration-150 ease-out"
          style={{
            transform: `scale(${zoom}) rotate(${rotation}deg)`,
          }}
        >
          <img
            src={currentPhotoUrl}
            alt={`Fotografía ${photoIndex + 1} (${currentPhase}) de defecto ${item.defect}`}
            referrerPolicy="no-referrer"
            className="max-h-[40vh] md:max-h-[75vh] max-w-[85vw] object-contain rounded-lg shadow-2xl border border-white/10"
          />
        </div>
        )}

        {/* Footer info below image */}
        <div className="hidden md:block z-10 mt-3 text-center text-xs text-white/70 font-mono">
          {hasPhoto ? t('Foto {i} de {n} · Fila #{row}', { i: photoIndex + 1, n: item.photos.length, row: item.rowNo }) : t('Fila #{row}', { row: item.rowNo })} · {item.orientation}
        </div>
      </div>

      {/* Right Sidebar: Details & Reassigning */}
      <div className="w-full md:w-96 bg-slate-900 border-t md:border-t-0 md:border-l border-white/10 p-4 md:p-5 flex flex-col md:justify-between overflow-y-auto overflow-x-hidden max-h-[45vh] md:max-h-none text-slate-200">
        <div className="space-y-4">
          {/* Previous / next defect */}
          {defectNav && (
            <div className="sticky -top-4 z-10 -mx-4 px-4 py-2 bg-slate-900 border-b border-white/10 md:static md:mx-0 md:px-0 md:py-0 md:border-0 flex items-center gap-2">
              <button
                onClick={() => goDefect(defectNav.onPrev)}
                disabled={!defectNav.onPrev}
                title={t('Defecto anterior') + ' (↑)'}
                className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-2 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:hover:bg-white/10 text-xs font-semibold text-white transition-colors"
              >
                <ChevronLeft className="w-4 h-4 rtl:rotate-180" />
                {t('Anterior')}
              </button>
              <span className="text-[11px] font-mono text-slate-400 tabular-nums whitespace-nowrap">
                {defectNav.index + 1} / {defectNav.total}
              </span>
              <button
                onClick={() => goDefect(defectNav.onNext)}
                disabled={!defectNav.onNext}
                title={t('Siguiente defecto') + ' (↓)'}
                className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-2 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:hover:bg-white/10 text-xs font-semibold text-white transition-colors"
              >
                {t('Siguiente')}
                <ChevronRight className="w-4 h-4 rtl:rotate-180" />
              </button>
            </div>
          )}

          {/* Header info */}
          <div>
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-mono font-bold text-amber-400">{t('Fila #{row}', { row: item.rowNo })}</span>
              <span className="font-semibold text-slate-300">{item.projectName}</span>
            </div>
            {!onSaveItem && <h3 className="text-base font-bold text-white mt-1">{item.defect}</h3>}
            <p className="text-xs text-slate-400 mt-0.5">{item.orientation}</p>
          </div>

          {/* Which phases have photos (blue) and which are missing (gray) */}
          <div className="hidden md:block">
            <PhaseChips item={item} />
          </div>

          {/* Editable details (editor only) */}
          {onSaveItem && (
            <LightboxEditForm item={item} allItems={allItems} onSave={onSaveItem} flushRef={flushRef} afterDetails={technicians} />
          )}

          {/* Quick Metrics */}
          {!onSaveItem && (
          <div className="grid grid-cols-2 gap-2 text-xs">
            {!onSaveItem && (
            <div className="p-2.5 bg-white/5 rounded-lg border border-white/10">
              <span className="text-slate-400 block text-[11px]">{t('Ubicación')}</span>
              <span className="font-semibold text-white font-mono">
                {t('Drop:')} {item.drop || '—'} · {t('Piso:')} {item.level || '—'}
              </span>
            </div>
            )}
          </div>
          )}

          {/* Dimensions */}
          {!onSaveItem && (item.linearMeters || item.baseM || item.heightM || item.quantity) && (
            <div className="p-2.5 bg-white/5 rounded-lg border border-white/10 text-xs space-y-1">
              <span className="text-slate-400 block text-[11px] font-semibold flex items-center gap-1">
                <Ruler className="w-3 h-3 text-slate-400" /> {t('Dimensiones')}
              </span>
              <div className="text-white font-mono tabular-nums">
                {item.linearMeters && <div>{t('Metros lineales:')} <strong>{item.linearMeters} m</strong></div>}
                {(item.baseM || item.heightM) && (
                  <div>{t('Base × Altura:')} <strong>{item.baseM || '0'} × {item.heightM || '0'} m</strong></div>
                )}
                {item.quantity && <div>{t('Cantidad:')} <strong>{item.quantity}</strong></div>}
              </div>
            </div>
          )}

          {/* Comment (editors edit it in the form, under the technicians) */}
          {!onSaveItem && item.comment && (
            <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs">
              <span className="text-amber-400 block text-[11px] font-semibold">{t('Comentario / Nota')}</span>
              <p className="text-amber-100 font-medium mt-0.5">{item.comment}</p>
            </div>
          )}

          {!onSaveItem && technicians}

          {/* Thumbnail list of photos in this defect */}
          <div className="pt-2 border-t border-white/10">
            <span className="text-[11px] font-semibold text-slate-400 block mb-2">
              {t('Fotos de esta fila ({n})', { n: item.photos.length })}
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
                    <span className="text-[8px] font-bold text-slate-300 mb-0.5 uppercase">{t(PHASE_LABEL[ph])}</span>
                    <div className="w-12 h-12 rounded overflow-hidden border border-white/20">
                      <img src={thumbUrl(url, 160)} onError={fallbackTo(url)} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {!readOnly && hasPhoto && (onMovePhotos || canDelete) && (
        <div className="pt-4 border-t border-white/10 space-y-3 mt-4">
          {onMovePhotos && (
            <MovePhotosPanel
              key={item.id}
              item={item}
              currentUrl={currentPhotoUrl}
              allItems={allItems}
              onMove={(urls, targetId) => onMovePhotos(item.id, urls, targetId)}
            />
          )}
          {/* Delete Photo Button */}
          {canDelete && (
          <button
            onClick={() => {
              if (window.confirm(t('¿Seguro que deseas quitar esta fotografía de la fila?'))) {
                onDeletePhoto(item.id, photoIndex);
                onClose();
              }
            }}
            className="w-full py-2 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{t('Eliminar esta fotografía')}</span>
          </button>
          )}
        </div>
        )}
      </div>
    </div>
  );
};

// Moves chosen photos of this defect to another one, found by its number: the shortcut for
// photos uploaded to the wrong defect (instead of downloading and uploading them again).
const MovePhotosPanel: React.FC<{
  item: DefectItem;
  currentUrl: string;
  allItems: DefectItem[];
  onMove: (photoUrls: string[], targetId: string) => void;
}> = ({ item, currentUrl, allItems, onMove }) => {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [rowNo, setRowNo] = useState('');
  const [chosen, setChosen] = useState<string[]>([]);

  const urlOf = (p: DefectItem['photos'][number]) => (typeof p === 'string' ? p : p.url);
  const wanted = rowNo.trim().replace(/^#/, '');
  const target = wanted ? allItems.find(i => i.rowNo.trim() === wanted) : undefined;
  const sameRow = target?.id === item.id;
  const canMove = !!target && !sameRow && chosen.length > 0;

  const toggle = (url: string) => setChosen(c => (c.includes(url) ? c.filter(u => u !== url) : [...c, url]));

  if (!open) {
    return (
      <button
        onClick={() => {
          setChosen(currentUrl ? [currentUrl] : []);
          setOpen(true);
        }}
        className="w-full py-2 bg-sky-600/20 hover:bg-sky-600/30 text-sky-200 border border-sky-500/30 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
      >
        <MoveRight className="w-3.5 h-3.5" />
        <span>{t('Mover fotos a otro defecto')}</span>
      </button>
    );
  }

  return (
    <div className="p-3 bg-sky-500/10 border border-sky-500/30 rounded-lg space-y-2.5 text-xs">
      <div className="flex items-center justify-between">
        <span className="font-semibold text-sky-200">{t('Mover fotos a otro defecto')}</span>
        <button onClick={() => setOpen(false)} className="p-1 text-slate-400 hover:text-white" aria-label={t('Cancelar')}>
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div>
        <span className="block text-[11px] text-slate-400 mb-1">{t('1. Marca las fotos que quieres mover')}</span>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {item.photos.map((p, idx) => {
            const url = urlOf(p);
            const ph = typeof p === 'string' ? 'BEFORE' : p.phase;
            const on = chosen.includes(url);
            return (
              <button
                key={url + idx}
                type="button"
                onClick={() => toggle(url)}
                className={`relative shrink-0 flex flex-col items-center rounded-md p-0.5 ${on ? 'ring-2 ring-sky-400' : 'opacity-50 hover:opacity-90'}`}
              >
                <span className="text-[8px] font-bold text-slate-300 mb-0.5 uppercase">{t(PHASE_LABEL[ph])}</span>
                <div className="w-12 h-12 rounded overflow-hidden border border-white/20">
                  <img src={thumbUrl(url, 160)} onError={fallbackTo(url)} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                </div>
                {on && (
                  <span className="absolute top-3 end-0 w-4 h-4 rounded-full bg-sky-500 text-white flex items-center justify-center">
                    <Check className="w-3 h-3" />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <span className="block text-[11px] text-slate-400 mb-1">{t('2. Número del defecto correcto')}</span>
        <input
          value={rowNo}
          onChange={e => setRowNo(e.target.value)}
          inputMode="numeric"
          placeholder={t('Ej: 465')}
          className="w-full bg-white/10 border border-white/20 rounded-md px-2.5 py-1.5 text-sm text-white placeholder:text-slate-500 focus:outline-hidden focus:border-sky-400"
        />
        {wanted && (
          <p className={`mt-1 text-[11px] ${target && !sameRow ? 'text-emerald-300' : 'text-rose-300'}`}>
            {!target
              ? t('No existe el defecto #{n}', { n: wanted })
              : sameRow
                ? t('Es este mismo defecto')
                : `#${target.rowNo} · ${target.orientation} · ${target.defect} · Drop ${target.drop || '—'} / ${t('Nivel')} ${target.level || '—'}`}
          </p>
        )}
      </div>

      <button
        disabled={!canMove}
        onClick={() => {
          if (!target) return;
          onMove(chosen, target.id);
          setOpen(false);
        }}
        className="w-full py-2 bg-sky-600 hover:bg-sky-500 disabled:opacity-40 disabled:hover:bg-sky-600 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5"
      >
        <MoveRight className="w-3.5 h-3.5" />
        {target && !sameRow
          ? t('Mover {n} foto(s) al defecto #{row}', { n: chosen.length, row: target.rowNo })
          : t('Mover {n} foto(s)', { n: chosen.length })}
      </button>
    </div>
  );
};

// Inline editing of the row's main details from the photo viewer.
const EDIT_FIELDS = ['defect', 'drop', 'level', 'baseM', 'heightM', 'linearMeters', 'quantity', 'comment'] as const;
type EditField = (typeof EDIT_FIELDS)[number];
type Draft = Record<EditField, string>;
const draftOf = (item: DefectItem): Draft =>
  Object.fromEntries(EDIT_FIELDS.map(f => [f, String(item[f] ?? '')])) as Draft;

const LightboxEditForm: React.FC<{
  item: DefectItem;
  allItems: DefectItem[];
  onSave: (item: DefectItem) => void;
  flushRef?: React.MutableRefObject<(() => void) | null>;
  // Shown between the details and the comment (the technicians).
  afterDetails?: React.ReactNode;
}> = ({ item, allItems, onSave, flushRef, afterDetails }) => {
  const { t } = useI18n();
  const [draft, setDraft] = useState<Draft>(() => draftOf(item));
  // Start over whenever the row itself changes (saved, or edited elsewhere).
  useEffect(() => setDraft(draftOf(item)), [item]);

  const { types } = useDefectTypes();
  const defectNames = useMemo(() => types.filter(d => !d.hidden).map(d => d.name), [types]);
  const dirty = EDIT_FIELDS.some(f => draft[f] !== String(item[f] ?? ''));
  const set = (f: EditField) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const value = e.target.value;
    setDraft(d => ({ ...d, [f]: value }));
  };

  const save = () => {
    if (!dirty) return;
    const clean = Object.fromEntries(EDIT_FIELDS.map(f => [f, draft[f].trim()])) as Draft;
    onSave({ ...item, ...clean, defect: clean.defect.toUpperCase(), level: clean.level.toUpperCase() });
  };
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    save();
  };
  // Lets the viewer save pending edits when moving to another defect.
  useEffect(() => {
    if (!flushRef) return;
    flushRef.current = save;
    return () => {
      flushRef.current = null;
    };
  });

  const input =
    'w-full min-w-0 bg-white/10 border border-white/20 rounded-md px-2 md:px-2.5 py-1 md:py-1.5 text-sm text-white placeholder:text-slate-500 focus:outline-hidden focus:border-amber-400';
  const label = 'block text-[11px] text-slate-400 mb-0.5 md:mb-1 truncate';

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="p-2.5 md:p-3 bg-white/5 rounded-lg border border-white/10 space-y-2 md:space-y-2.5">
      <div>
        <label className={label}>{t('Defecto')}</label>
        <SuggestInput
          value={draft.defect}
          onChange={v => setDraft(d => ({ ...d, defect: v }))}
          options={defectNames}
          className={`${input} font-bold uppercase`}
          dark
        />
      </div>
      <div className="grid grid-cols-3 md:grid-cols-2 gap-x-2 gap-y-1.5 md:gap-2">
        <div className="md:order-1">
          <label className={label}>{t('Drop')}</label>
          <input value={draft.drop} onChange={set('drop')} inputMode="numeric" className={`${input} font-mono`} />
        </div>
        <div className="md:order-2">
          <label className={label}>{t('Nivel')}</label>
          <input value={draft.level} onChange={set('level')} placeholder="G, 1, 2… R" className={`${input} font-mono uppercase`} />
        </div>
        <div className="md:order-5">
          <label className={label}>{t('Metros Lineales (m)')}</label>
          <input value={draft.linearMeters} onChange={set('linearMeters')} inputMode="decimal" className={`${input} font-mono`} />
        </div>
        <div className="md:order-3">
          <label className={label}>{t('Ancho (m)')}</label>
          <input value={draft.baseM} onChange={set('baseM')} inputMode="decimal" className={`${input} font-mono`} />
        </div>
        <div className="md:order-4">
          <label className={label}>{t('Alto (m)')}</label>
          <input value={draft.heightM} onChange={set('heightM')} inputMode="decimal" className={`${input} font-mono`} />
        </div>
        <div className="md:order-6">
          <label className={label}>{t('Cantidad')}</label>
          <input value={draft.quantity} onChange={set('quantity')} inputMode="decimal" className={`${input} font-mono`} />
        </div>
      </div>
      </div>

      {afterDetails}

      <div>
        <label className={label}>{t('Comentario / Nota')}</label>
        <textarea
          value={draft.comment}
          onChange={set('comment')}
          rows={2}
          placeholder={t('Añadir comentario o nota…')}
          className={`${input} resize-y`}
        />
      </div>
      {dirty && (
        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={() => setDraft(draftOf(item))}
            className="px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white rounded-md"
          >
            {t('Cancelar')}
          </button>
          <button type="submit" className="px-3.5 py-1.5 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-md">
            {t('Guardar Cambios')}
          </button>
        </div>
      )}
    </form>
  );
};
