import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Sparkles } from 'lucide-react';
import { useI18n } from '../i18n';

// "What's new" notice: shown once on each device after an update. For the next one, change
// RELEASE and the list (Spanish source text, translated in i18n.tsx).
const RELEASE = '2026-10-21';
const SEEN_KEY = 'cronulla_seen_release';

const CHANGES: { text: string; adminOnly?: boolean }[] = [
  { text: 'Nuevo perfil: toca tus iniciales arriba a la derecha para ver tus datos y cerrar sesión.' },
  { text: 'En el perfil verás cuántos defectos iniciaste, pasaste a During y completaste. Tócalos para ver solo esos defectos.' },
  { text: 'El idioma ahora se cambia dentro del perfil.' },
  { text: 'En el teléfono, desliza la lista hacia abajo desde arriba para actualizar los datos.' },
  { text: '¿Olvidaste tu contraseña? Ahora puedes restablecerla desde la pantalla de entrada.' },
  { text: 'Cerrar sesión funciona con un solo toque.' },
  { text: 'El cargo "Inspector" ahora se llama "Technician".' },
  { text: 'Si cambias la fase de una foto, el defecto conserva el nombre de quien la subió.', adminOnly: true },
];

const seen = () => {
  try {
    return localStorage.getItem(SEEN_KEY) === RELEASE;
  } catch {
    return true; // no storage: don't show it every time
  }
};

export const WhatsNew: React.FC<{ isAdmin: boolean }> = ({ isAdmin }) => {
  const { t } = useI18n();
  const [open, setOpen] = useState(() => !seen());
  if (!open) return null;

  const close = () => {
    try {
      localStorage.setItem(SEEN_KEY, RELEASE);
    } catch {}
    setOpen(false);
  };

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-xs" onClick={close}>
      <div
        className="w-full sm:max-w-md max-h-[92vh] overflow-y-auto bg-white rounded-t-2xl sm:rounded-2xl p-5 sm:p-6 shadow-2xl space-y-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">{t('Novedades de la app')}</h2>
            <p className="text-xs text-slate-500">{t('Esto cambió en la última actualización')}</p>
          </div>
        </div>

        <ul className="space-y-2.5">
          {CHANGES.filter(c => isAdmin || !c.adminOnly).map(c => (
            <li key={c.text} className="flex gap-2.5 text-sm text-slate-700 leading-snug">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
              <span>{t(c.text)}</span>
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={close}
          className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold"
        >
          {t('Entendido')}
        </button>
      </div>
    </div>,
    document.body
  );
};
