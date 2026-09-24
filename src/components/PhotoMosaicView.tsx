import React, { useState } from 'react';
import { ExternalLink, ArrowRightLeft, Trash2, MapPin, Tag } from 'lucide-react';
import { DefectItem, PhotoPhase } from '../types/inspection';

interface PhotoMosaicViewProps {
  items: DefectItem[];
  onOpenPhotoLightbox: (item: DefectItem, photoIndex: number) => void;
  onDeletePhoto: (itemId: string, photoIndex: number) => void;
  onMovePhotoPrompt: (sourceItem: DefectItem, photoIndex: number) => void;
  onUpdatePhotoPhase?: (itemId: string, photoIndex: number, phase: PhotoPhase) => void;
  readOnly?: boolean;
}

export const PhotoMosaicView: React.FC<PhotoMosaicViewProps> = ({
  items,
  onOpenPhotoLightbox,
  onDeletePhoto,
  onMovePhotoPrompt,
  onUpdatePhotoPhase,
  readOnly = false,
}) => {
  const [phaseFilter, setPhaseFilter] = useState<'ALL' | PhotoPhase>('ALL');

  // Flatten all photos with their parent item reference & resolved phase
  const allPhotos = items.flatMap(item =>
    item.photos.map((photo, pIdx) => {
      const url = typeof photo === 'string' ? photo : photo.url;
      const phase: PhotoPhase =
        typeof photo === 'string'
          ? pIdx >= 6
            ? 'COMPLETED'
            : pIdx >= 3
            ? 'IN PROGRESS'
            : 'BEFORE'
          : photo.phase;

      return {
        url,
        phase,
        pIdx,
        item,
      };
    })
  );

  const displayedPhotos =
    phaseFilter === 'ALL'
      ? allPhotos
      : allPhotos.filter(p => p.phase === phaseFilter);

  const countBefore = allPhotos.filter(p => p.phase === 'BEFORE').length;
  const countInProgress = allPhotos.filter(p => p.phase === 'IN PROGRESS').length;
  const countCompleted = allPhotos.filter(p => p.phase === 'COMPLETED').length;

  return (
    <div className="space-y-4">
      {/* Phase Filter Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-semibold text-slate-500 mr-1">Filtrar por etapa:</span>
          
          <button
            onClick={() => setPhaseFilter('ALL')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
              phaseFilter === 'ALL'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            TODAS ({allPhotos.length})
          </button>

          <button
            onClick={() => setPhaseFilter('BEFORE')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 ${
              phaseFilter === 'BEFORE'
                ? 'bg-slate-700 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-slate-400" />
            BEFORE ({countBefore})
          </button>

          <button
            onClick={() => setPhaseFilter('IN PROGRESS')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 ${
              phaseFilter === 'IN PROGRESS'
                ? 'bg-amber-500 text-slate-950 shadow-xs'
                : 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            IN PROGRESS ({countInProgress})
          </button>

          <button
            onClick={() => setPhaseFilter('COMPLETED')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 ${
              phaseFilter === 'COMPLETED'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            COMPLETED ({countCompleted})
          </button>
        </div>

        <div className="text-xs text-slate-500 font-medium">
          Mostrando <span className="font-bold text-slate-900">{displayedPhotos.length}</span> fotos
        </div>
      </div>

      {displayedPhotos.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <p className="text-slate-500 text-sm">No se encontraron fotografías con los filtros seleccionados.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
          {displayedPhotos.map(({ url, phase, pIdx, item }, idx) => {
            const phaseStyle = {
              BEFORE: {
                header: 'bg-slate-100 text-slate-800 border-slate-200',
                dot: 'bg-slate-400',
              },
              'IN PROGRESS': {
                header: 'bg-amber-50 text-amber-900 border-amber-200',
                dot: 'bg-amber-500',
              },
              COMPLETED: {
                header: 'bg-emerald-50 text-emerald-900 border-emerald-200',
                dot: 'bg-emerald-500',
              },
            }[phase] || {
              header: 'bg-slate-100 text-slate-800 border-slate-200',
              dot: 'bg-slate-400',
            };

            return (
              <div
                key={`${item.id}-${pIdx}-${idx}`}
                className="group relative bg-white rounded-xl overflow-hidden border border-slate-200 shadow-xs hover:shadow-md transition-all flex flex-col"
              >
                {/* PROMINENT LABEL ABOVE PHOTO */}
                <button
                  type="button"
                  onClick={() => {
                    if (onUpdatePhotoPhase) {
                      const cycle: PhotoPhase[] = ['BEFORE', 'IN PROGRESS', 'COMPLETED'];
                      const next = cycle[(cycle.indexOf(phase) + 1) % cycle.length];
                      onUpdatePhotoPhase(item.id, pIdx, next);
                    }
                  }}
                  title="Clic para cambiar: BEFORE, IN PROGRESS o COMPLETED"
                  className={`px-2.5 py-1 text-[11px] font-black uppercase tracking-wider flex items-center justify-between border-b transition-colors cursor-pointer ${phaseStyle.header}`}
                >
                  <span className="flex items-center gap-1.5 truncate">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${phaseStyle.dot}`} />
                    <span className="truncate">{phase}</span>
                  </span>
                  <span className="text-[10px] font-mono opacity-60 shrink-0">F{pIdx + 1}</span>
                </button>

                {/* Image Box */}
                <div className="relative aspect-4/3 w-full bg-slate-950 overflow-hidden cursor-pointer">
                  <img
                    src={url}
                    alt={`${item.defect} - Drop ${item.drop} Lvl ${item.level}`}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    onClick={() => onOpenPhotoLightbox(item, pIdx)}
                  />

                  {/* Quick Actions overlay on hover */}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 p-2">
                    <button
                      onClick={() => onOpenPhotoLightbox(item, pIdx)}
                      title="Ampliar fotografía"
                      className="p-2 bg-white text-slate-900 rounded-full hover:bg-slate-100 shadow-sm"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </button>

                    {!readOnly && (
                    <>
                    <button
                      onClick={() => onMovePhotoPrompt(item, pIdx)}
                      title="Reasignar a otra fila de defecto"
                      className="p-2 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 shadow-sm"
                    >
                      <ArrowRightLeft className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => onDeletePhoto(item.id, pIdx)}
                      title="Eliminar foto"
                      className="p-2 bg-rose-600 text-white rounded-full hover:bg-rose-700 shadow-sm"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    </>
                    )}
                  </div>
                </div>

                {/* Photo Card Caption / Tags */}
                <div className="p-2.5 bg-white flex-1 flex flex-col justify-between text-xs space-y-1.5">
                  <div>
                    <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium">
                      <span className="font-mono text-slate-900 font-bold">#{item.rowNo}</span>
                      <span className="truncate ml-1">{item.orientation}</span>
                    </div>

                    <h4 className="font-bold text-slate-900 truncate mt-0.5" title={item.defect}>
                      {item.defect}
                    </h4>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-slate-400" />
                      <span>D:{item.drop || '—'} / P:{item.level || '—'}</span>
                    </span>

                    <span className="font-medium text-slate-700">
                      {item.urgency}
                    </span>
                  </div>

                  {item.customTags && item.customTags.length > 0 && (
                    <div className="flex items-center gap-1 flex-wrap pt-0.5">
                      {item.customTags.slice(0, 2).map((t, idx) => (
                        <span key={idx} className="text-[9px] bg-slate-100 text-slate-600 px-1 py-0.2 rounded">
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
