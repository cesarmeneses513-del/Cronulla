import React from 'react';
import { Check } from 'lucide-react';
import { DefectItem, PhotoPhase } from '../types/inspection';
import { PHASE_LABEL, useI18n } from '../i18n';

const PHASES: PhotoPhase[] = ['BEFORE', 'IN PROGRESS', 'COMPLETED'];

const photoPhase = (photo: DefectItem['photos'][number], idx: number): PhotoPhase =>
  typeof photo === 'string' ? (idx >= 6 ? 'COMPLETED' : idx >= 3 ? 'IN PROGRESS' : 'BEFORE') : photo.phase;

// Before / During / After: blue when the defect has a photo of that phase, gray when it is missing.
export const PhaseChips: React.FC<{ item: DefectItem; size?: 'sm' | 'xs' }> = ({ item, size = 'sm' }) => {
  const { t } = useI18n();
  const present = new Set(item.photos.map(photoPhase));
  return (
    <div className="inline-flex items-center gap-1">
      {PHASES.map(phase => {
        const has = present.has(phase);
        const label = t(PHASE_LABEL[phase]);
        return (
          <span
            key={phase}
            title={t(has ? 'Tiene foto de {phase}' : 'Falta foto de {phase}', { phase: label })}
            className={`inline-flex items-center gap-0.5 rounded-full border font-semibold whitespace-nowrap ${
              size === 'xs' ? 'px-1.5 py-0 text-[10px]' : 'px-2.5 py-0.5 text-[11px]'
            } ${
              has
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-slate-100 text-slate-400 border-slate-200'
            }`}
          >
            {has && <Check className="w-3 h-3" />}
            {label}
          </span>
        );
      })}
    </div>
  );
};
