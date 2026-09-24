import React from 'react';
import { Camera, AlertCircle, CheckCircle2, ChevronRight } from 'lucide-react';
import { DefectItem } from '../types/inspection';

interface ElevationMatrixViewProps {
  items: DefectItem[];
  onSelectCell: (drop: string, level: string) => void;
  onOpenPhotoLightbox: (item: DefectItem, photoIndex: number) => void;
}

export const ElevationMatrixView: React.FC<ElevationMatrixViewProps> = ({
  items,
  onSelectCell,
  onOpenPhotoLightbox,
}) => {
  // Extract all drops and levels present in the dataset
  const drops = Array.from(new Set(items.map(i => i.drop).filter(Boolean))).sort(
    (a, b) => Number(a) - Number(b)
  );

  // Standard architectural levels: R (Roof) down to 1, then G (Ground)
  const levels = Array.from(new Set(items.map(i => i.level).filter(Boolean))).sort((a, b) => {
    if (a === 'R') return -1;
    if (b === 'R') return 1;
    if (a === 'G') return 1;
    if (b === 'G') return -1;
    return Number(b) - Number(a); // High floor at top
  });

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
      <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Matriz de Elevación Fachada (Drop vs Piso)</h3>
          <p className="text-xs text-slate-500">
            Vista espacial de cuerda/drop y niveles. Haz clic en una celda para ver o filtrar los defectos de esa posición.
          </p>
        </div>
      </div>

      <div className="overflow-x-auto p-4">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              <th className="p-2 border border-slate-200 bg-slate-100 font-bold text-slate-700 text-center sticky left-0 z-10">
                Piso / Drop
              </th>
              {drops.map(d => (
                <th
                  key={d}
                  className="p-2 border border-slate-200 bg-slate-100 font-bold text-slate-900 text-center min-w-[100px]"
                >
                  Drop {d}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {levels.map(lvl => (
              <tr key={lvl}>
                <td className="p-2 border border-slate-200 bg-slate-100 font-bold text-slate-900 text-center sticky left-0 z-10 font-mono">
                  {lvl === 'R' ? 'R (Azotea)' : lvl === 'G' ? 'G (PB)' : `Nivel ${lvl}`}
                </td>
                {drops.map(drp => {
                  const cellItems = items.filter(i => i.drop === drp && i.level === lvl);
                  const totalPhotos = cellItems.reduce((acc, cur) => acc + cur.photos.length, 0);
                  const hasHigh = cellItems.some(i => i.urgency === 'HIGH');
                  const allCompleted = cellItems.length > 0 && cellItems.every(i => i.status === 'COMPLETED');

                  return (
                    <td
                      key={`${drp}-${lvl}`}
                      onClick={() => cellItems.length > 0 && onSelectCell(drp, lvl)}
                      className={`p-2 border border-slate-200 align-top transition-colors ${
                        cellItems.length === 0
                          ? 'bg-slate-50/40 text-slate-300 text-center'
                          : allCompleted
                          ? 'bg-emerald-50/70 hover:bg-emerald-100/70 cursor-pointer'
                          : hasHigh
                          ? 'bg-rose-50/70 hover:bg-rose-100/70 cursor-pointer'
                          : 'bg-white hover:bg-slate-50 cursor-pointer'
                      }`}
                    >
                      {cellItems.length > 0 ? (
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[11px] font-bold">
                            <span className={hasHigh ? 'text-rose-700' : 'text-slate-800'}>
                              {cellItems.length} {cellItems.length === 1 ? 'defecto' : 'defectos'}
                            </span>
                            {allCompleted ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            ) : hasHigh ? (
                              <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                            ) : null}
                          </div>

                          {/* Thumbnails preview */}
                          {totalPhotos > 0 && (
                            <div className="flex items-center gap-1 overflow-hidden">
                              {cellItems
                                .flatMap(i => i.photos)
                                .slice(0, 3)
                                .map((p, pIdx) => {
                                  const photoUrl = typeof p === 'string' ? p : p.url;
                                  return (
                                    <img
                                      key={pIdx}
                                      src={photoUrl}
                                      alt="Foto"
                                      referrerPolicy="no-referrer"
                                      className="w-7 h-7 object-cover rounded border border-slate-200"
                                    />
                                  );
                                })}
                              {totalPhotos > 3 && (
                                <span className="text-[10px] text-slate-500 font-mono font-bold">
                                  +{totalPhotos - 3}
                                </span>
                              )}
                            </div>
                          )}

                          {/* Brief defect tags */}
                          <div className="text-[10px] text-slate-600 truncate">
                            {cellItems.map(i => i.defect).slice(0, 2).join(', ')}
                            {cellItems.length > 2 && '...'}
                          </div>
                        </div>
                      ) : (
                        <span className="text-[10px] select-none">—</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
