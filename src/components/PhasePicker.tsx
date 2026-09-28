import React, { useEffect } from 'react';
import { PhotoPhase } from '../types/inspection';
import { PHASE_LABEL, useI18n } from '../i18n';

interface PhasePickerProps {
  // Local preview of the chosen file, when there is one.
  preview?: string;
  onPick: (phase: PhotoPhase) => void;
  onCancel: () => void;
}

const OPTIONS: { phase: PhotoPhase; style: string }[] = [
  { phase: 'BEFORE', style: 'bg-slate-700 hover:bg-slate-800 text-white' },
  { phase: 'IN PROGRESS', style: 'bg-amber-500 hover:bg-amber-600 text-slate-950' },
  { phase: 'COMPLETED', style: 'bg-emerald-600 hover:bg-emerald-700 text-white' },
];

// Asked for every new photo, so it is saved with its phase (Before / During / After).
export const PhasePicker: React.FC<PhasePickerProps> = ({ preview, onPick, onCancel }) => {
  const { t } = useI18n();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCancel();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4" onClick={onCancel}>
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-5 space-y-4" onClick={e => e.stopPropagation()}>
        <h3 className="text-base font-bold text-slate-900 text-center">{t('¿A qué fase corresponde esta foto?')}</h3>
        {preview && (
          <img src={preview} alt="" className="w-full max-h-56 object-contain rounded-lg border border-slate-200 bg-slate-50" />
        )}
        <div className="grid grid-cols-3 gap-2">
          {OPTIONS.map(o => (
            <button
              key={o.phase}
              type="button"
              onClick={() => onPick(o.phase)}
              className={`py-3 rounded-xl text-sm font-bold transition-colors ${o.style}`}
            >
              {t(PHASE_LABEL[o.phase])}
            </button>
          ))}
        </div>
        <button type="button" onClick={onCancel} className="w-full py-2 text-xs font-medium text-slate-500 hover:text-slate-900">
          {t('Cancelar')}
        </button>
      </div>
    </div>
  );
};
