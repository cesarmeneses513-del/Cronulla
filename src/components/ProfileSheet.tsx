import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Briefcase, CheckCircle2, ChevronRight, Hammer, LogOut, Mail, Play, X } from 'lucide-react';
import { DefectItem, WorkStep, WORK_FIELD } from '../types/inspection';
import { useI18n } from '../i18n';
import { LanguageSwitcher } from './LanguageSwitcher';

interface ProfileSheetProps {
  name: string;
  roleLabel: string;
  email?: string;
  jobTitle?: string;
  // Still signed in with the temporary PIN (no account).
  viaPin?: boolean;
  readOnly: boolean;
  items: DefectItem[];
  onClose: () => void;
  onLogout: () => void;
  // Tapping a counter lists those defects.
  onShowMyWork?: (step: WorkStep) => void;
}

// Badge colours by level: clients see, the rest edit (same as the header badge used to be).
export const levelBadgeClass = (readOnly: boolean) =>
  readOnly ? 'bg-sky-100 text-sky-900 border-sky-300' : 'bg-amber-100 text-amber-900 border-amber-300';

export const initialsOf = (name: string) => (name.trim() || '?').slice(0, 2);

// The signed-in person's profile (same as in the other CPR apps): who they are, their work here, and sign out.
export const ProfileSheet: React.FC<ProfileSheetProps> = ({
  name,
  roleLabel,
  email,
  jobTitle,
  viaPin = false,
  readOnly,
  items,
  onClose,
  onLogout,
  onShowMyWork,
}) => {
  const { t } = useI18n();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const countOf = (step: WorkStep) => (name ? items.filter(i => i[WORK_FIELD[step]] === name).length : 0);
  const tiles: { step: WorkStep; label: string; Icon: typeof Play; box: string; head: string; value: string }[] = [
    { step: 'start', label: 'Iniciados por mí', Icon: Play, box: 'border-slate-200 bg-slate-50 hover:bg-slate-100', head: 'text-slate-500', value: 'text-slate-900' },
    { step: 'during', label: 'En progreso por mí', Icon: Hammer, box: 'border-amber-200 bg-amber-50 hover:bg-amber-100', head: 'text-amber-700', value: 'text-amber-950' },
    { step: 'completed', label: 'Completados por mí', Icon: CheckCircle2, box: 'border-emerald-200 bg-emerald-50 hover:bg-emerald-100', head: 'text-emerald-700', value: 'text-emerald-950' },
  ];

  // Portal: the sticky header would otherwise keep this fixed overlay inside it.
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md max-h-[92vh] overflow-y-auto bg-white rounded-t-2xl sm:rounded-2xl p-5 sm:p-6 shadow-2xl space-y-5"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-14 h-14 rounded-2xl bg-slate-900 text-white flex items-center justify-center text-lg font-black uppercase shrink-0">
              {initialsOf(name || roleLabel)}
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-slate-900 tracking-tight truncate">{name || roleLabel}</h2>
              <div className="mt-1 flex items-center gap-1.5">
                <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full border ${levelBadgeClass(readOnly)}`}>
                  {roleLabel.toUpperCase()}
                  {viaPin && ' · PIN'}
                </span>
                {/* Language: small, next to the level */}
                <LanguageSwitcher className="!px-2 !py-0.5 !text-[10px] !rounded-full border border-slate-200" />
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
            aria-label={t('Cerrar')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {(email || jobTitle) && (
          <div className="space-y-1.5">
            {email && (
              <div className="flex items-center gap-2 text-xs text-slate-700">
                <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                <span className="font-medium truncate">{email}</span>
              </div>
            )}
            {jobTitle && (
              <div className="flex items-center gap-2 text-xs text-slate-700">
                <Briefcase className="w-4 h-4 text-slate-400 shrink-0" />
                <span className="font-medium truncate">{jobTitle}</span>
              </div>
            )}
          </div>
        )}

        {!readOnly && name && (
          <div className="grid grid-cols-3 gap-2">
            {tiles.map(({ step, label, Icon, box, head, value }) => (
              <button
                key={step}
                type="button"
                disabled={!onShowMyWork}
                onClick={() => {
                  onShowMyWork?.(step);
                  onClose();
                }}
                className={`p-2.5 sm:p-3 rounded-xl border text-start transition-colors ${box}`}
              >
                <div className={`flex items-start gap-1 text-[10px] sm:text-[11px] font-semibold uppercase tracking-wide leading-tight ${head}`}>
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span>{t(label)}</span>
                </div>
                <div className={`mt-1 text-lg font-bold font-mono tabular-nums ${value}`}>{countOf(step)}</div>
                <div className={`flex items-center gap-0.5 text-[11px] ${head}`}>
                  {t('Ver')}
                  <ChevronRight className="w-3 h-3 rtl:rotate-180" />
                </div>
              </button>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={() => {
            onClose();
            onLogout();
          }}
          className="w-full py-2.5 rounded-xl bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 text-xs font-bold flex items-center justify-center gap-2 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          {t('Cerrar sesión')}
        </button>
      </div>
    </div>,
    document.body
  );
};
