import React from 'react';
import { Camera, CheckCircle2, ChevronRight } from 'lucide-react';
import { DefectItem } from '../types/inspection';
import { useI18n } from '../i18n';
import { thumbUrl, fallbackTo } from '../lib/thumb';

interface ElevationMatrixViewProps {
  items: DefectItem[];
  stages: { name: string; count: number }[];
  selectedStages: string[];
  onSelectStage: (stage: string | null) => void;
  onSelectCell: (drop: string, level: string) => void;
  onOpenPhotoLightbox: (item: DefectItem, photoIndex: number) => void;
  selectedLevels?: string[];
  selectedDrops?: string[];
  onSelectLevel?: (level: string | null) => void;
}

// A defect counts as done in the grid when it has at least one AFTER photo.
const hasAfterPhoto = (item: DefectItem) =>
  item.photos.some((p, i) => (typeof p === 'string' ? i >= 6 : p.phase === 'COMPLETED'));

// "STAGE 3" → "S3" for the compact per-cell breakdown.
const shortStage = (stage: string) => stage.replace(/^STAGE\s*/i, 'S');

export const ElevationMatrixView: React.FC<ElevationMatrixViewProps> = ({
  items,
  stages,
  selectedStages,
  onSelectStage,
  onSelectCell,
  onOpenPhotoLightbox,
  selectedLevels = [],
  selectedDrops = [],
  onSelectLevel,
}) => {
  const { t } = useI18n();
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
          <h3 className="text-sm font-bold text-slate-900">
            {t('Matriz de Elevación Fachada (Drop vs Piso)')}
            {selectedStages.length > 0 && <span className="text-slate-500 font-semibold"> · {selectedStages.join(', ')}</span>}
          </h3>
          <p className="text-xs text-slate-500">
            {t('Vista espacial de cuerda/drop y niveles. Haz clic en una celda para ver o filtrar los defectos de esa posición.')}
            <span className="ms-2 inline-flex items-center gap-1 text-emerald-700">
              <span className="w-2.5 h-2.5 rounded-sm bg-emerald-100 border border-emerald-300" />
              {t('Verde: todos los defectos tienen foto After')}
            </span>
          </p>
        </div>
      </div>

      {/* Stage / Orientation tabs */}
      {stages.length > 0 && (
        <div className="px-4 pt-3 flex flex-wrap items-center gap-1.5 border-b border-slate-100 pb-3">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider me-1">{t('Stage:')}</span>
          <button
            onClick={() => onSelectStage(null)}
            className={`px-2.5 py-1 text-xs font-medium rounded-md border transition-colors ${
              selectedStages.length === 0
                ? 'border-slate-900 bg-slate-900 text-white'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            {t('Todos')}
          </button>
          {stages.map(st => {
            const active = selectedStages.length === 1 && selectedStages[0] === st.name;
            return (
              <button
                key={st.name}
                onClick={() => onSelectStage(active ? null : st.name)}
                className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md border transition-colors ${
                  active
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                {st.name}
                <span className={`text-[10px] tabular-nums ${active ? 'text-slate-300' : 'text-slate-400'}`}>
                  ({st.count})
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Levels: pick one to highlight it (and filter the list); "All" goes back to the whole facade */}
      {onSelectLevel && levels.length > 0 && (
        <div className="px-4 py-3 flex flex-wrap items-center gap-1.5 border-b border-slate-100">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider me-1">{t('Nivel')}:</span>
          <button
            onClick={() => onSelectLevel(null)}
            className={`px-2.5 py-1 text-xs font-medium rounded-md border transition-colors ${
              selectedLevels.length === 0 && selectedDrops.length === 0
                ? 'border-slate-900 bg-slate-900 text-white'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            {t('Todos')}
          </button>
          {levels.map(lvl => {
            const active = selectedLevels.includes(lvl);
            return (
              <button
                key={lvl}
                onClick={() => onSelectLevel(active ? null : lvl)}
                className={`min-w-8 px-2 py-1 text-xs font-mono font-semibold rounded-md border transition-colors ${
                  active ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                {lvl}
              </button>
            );
          })}
        </div>
      )}

      <div className="overflow-x-auto p-4">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              <th className="p-2 border border-slate-200 bg-slate-100 font-bold text-slate-700 text-center sticky left-0 z-10">
                {t('Piso / Drop')}
              </th>
              {drops.map(d => (
                <th
                  key={d}
                  className="p-2 border border-slate-200 bg-slate-100 font-bold text-slate-900 text-center min-w-[100px]"
                >
                  {t('Drop {d}', { d })}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {levels.map(lvl => (
              <tr key={lvl}>
                <td className="p-2 border border-slate-200 bg-slate-100 font-bold text-slate-900 text-center sticky left-0 z-10 font-mono">
                  {lvl === 'R' ? t('R (Azotea)') : lvl === 'G' ? t('G (PB)') : t('Nivel {n}', { n: lvl })}
                </td>
                {drops.map(drp => {
                  const cellItems = items.filter(i => i.drop === drp && i.level === lvl);
                  const totalPhotos = cellItems.reduce((acc, cur) => acc + cur.photos.length, 0);
                  const allCompleted = cellItems.length > 0 && cellItems.every(hasAfterPhoto);
                  const isSelected = selectedLevels.includes(lvl) && (selectedDrops.length === 0 || selectedDrops.includes(drp));
                  const stageCounts = Object.entries(
                    cellItems.reduce<Record<string, number>>((acc, i) => {
                      const key = i.orientation || '—';
                      acc[key] = (acc[key] || 0) + 1;
                      return acc;
                    }, {})
                  ).sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }));

                  return (
                    <td
                      key={`${drp}-${lvl}`}
                      onClick={() => cellItems.length > 0 && onSelectCell(drp, lvl)}
                      className={`p-2 border border-slate-200 align-top transition-colors ${
                        cellItems.length === 0
                          ? 'bg-slate-50/40 text-slate-300 text-center'
                          : allCompleted
                          ? 'bg-emerald-50/70 hover:bg-emerald-100/70 cursor-pointer'
                          : 'bg-white hover:bg-slate-50 cursor-pointer'
                      } ${isSelected ? 'ring-2 ring-inset ring-slate-900' : ''}`}
                    >
                      {cellItems.length > 0 ? (
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[11px] font-bold">
                            <span className={allCompleted ? 'text-emerald-800' : 'text-slate-800'}>
                              {cellItems.length === 1 ? t('1 defecto') : t('{n} defectos', { n: cellItems.length })}
                            </span>
                            {allCompleted && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                          </div>

                          {/* Stage breakdown (hidden when the matrix is already showing a single stage) */}
                          {selectedStages.length !== 1 && stageCounts.length > 0 && (
                            <div className="flex flex-wrap gap-0.5">
                              {stageCounts.map(([stage, n]) => (
                                <span
                                  key={stage}
                                  title={`${stage}: ${n}`}
                                  className="px-1 rounded bg-slate-100 border border-slate-200 text-[9px] font-mono font-semibold text-slate-600"
                                >
                                  {shortStage(stage)}·{n}
                                </span>
                              ))}
                            </div>
                          )}

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
                                      loading="lazy"
                                      decoding="async"
                                      key={pIdx}
                                      src={thumbUrl(photoUrl, 160)}
                                      onError={fallbackTo(photoUrl)}
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
