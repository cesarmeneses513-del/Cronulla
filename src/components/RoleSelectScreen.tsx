import React, { useState } from 'react';
import { Camera, PencilLine, Eye, Lock, ArrowRight, ArrowLeft } from 'lucide-react';
import { useI18n } from '../i18n';
import { LanguageSwitcher } from './LanguageSwitcher';

export type AppRole = 'editor' | 'client';

// Client-side gate only: it hides editing UI, it does not secure the database.
const EDITOR_PIN = '1111';
const USER_KEY = 'cronulla_user';

export const getStoredUserName = (): string => {
  try {
    return localStorage.getItem(USER_KEY) || '';
  } catch {
    return '';
  }
};

interface RoleSelectScreenProps {
  onSelect: (role: AppRole) => void;
}

export const RoleSelectScreen: React.FC<RoleSelectScreenProps> = ({ onSelect }) => {
  const [askingPin, setAskingPin] = useState(false);
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [name, setName] = useState(getStoredUserName);
  const { t } = useI18n();

  const submitPin = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin === EDITOR_PIN) {
      try {
        localStorage.setItem(USER_KEY, name.trim());
      } catch {}
      onSelect('editor');
    } else {
      setError(true);
      setPin('');
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center px-4 py-10 font-sans antialiased">
      <div className="w-full max-w-2xl space-y-8">
        <div className="flex justify-end">
          <LanguageSwitcher className="bg-white border border-slate-200" />
        </div>
        <div className="flex flex-col items-center text-center gap-3">
          <div className="w-14 h-14 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-sm">
            <Camera className="w-7 h-7 text-amber-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Cronulla Inspection Gallery</h1>
            <p className="text-sm text-slate-500 mt-1">{t('Control de Defectos & Galería Fotográfica')}</p>
          </div>
        </div>

        {!askingPin ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              onClick={() => setAskingPin(true)}
              className="group text-left bg-white border border-slate-200 hover:border-slate-900 rounded-xl p-6 shadow-xs hover:shadow-md transition-all"
            >
              <div className="w-10 h-10 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center mb-4">
                <PencilLine className="w-5 h-5" />
              </div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                {t('Editor')}
                <Lock className="w-3.5 h-3.5 text-slate-400" />
              </h2>
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                {t('Crear, editar y eliminar defectos, subir y mover fotografías, importar y exportar CSV.')}
              </p>
              <span className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-slate-900">
                {t('Entrar con contraseña')}
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform rtl:rotate-180" />
              </span>
            </button>

            <button
              onClick={() => onSelect('client')}
              className="group text-left bg-white border border-slate-200 hover:border-slate-900 rounded-xl p-6 shadow-xs hover:shadow-md transition-all"
            >
              <div className="w-10 h-10 rounded-lg bg-sky-50 border border-sky-200 text-sky-700 flex items-center justify-center mb-4">
                <Eye className="w-5 h-5" />
              </div>
              <h2 className="text-base font-bold text-slate-900">{t('Cliente')}</h2>
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                {t('Ver las fotografías y filtrar los defectos por stage, estado, urgencia, drop y nivel. Solo lectura.')}
              </p>
              <span className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-slate-900">
                {t('Ver galería')}
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform rtl:rotate-180" />
              </span>
            </button>
          </div>
        ) : (
          <form
            onSubmit={submitPin}
            className="max-w-sm mx-auto bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4"
          >
            <div className="flex items-center gap-2">
              <PencilLine className="w-4 h-4 text-amber-700" />
              <h2 className="text-sm font-bold text-slate-900">{t('Acceso Editor')}</h2>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="editor-name" className="text-xs font-semibold text-slate-700">
                {t('Tu nombre')}
              </label>
              <input
                id="editor-name"
                type="text"
                autoComplete="name"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:border-slate-400 rounded-lg text-sm focus:outline-hidden focus:bg-white transition-colors"
              />
              <p className="text-[11px] text-slate-400">{t('Aparece en el historial de cambios')}</p>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="editor-pin" className="text-xs font-semibold text-slate-700">
                {t('Contraseña')}
              </label>
              <input
                id="editor-pin"
                type="password"
                inputMode="numeric"
                autoFocus={!!name}
                value={pin}
                onChange={e => {
                  setPin(e.target.value);
                  setError(false);
                }}
                className={`w-full px-3 py-2 bg-slate-50 border rounded-lg text-sm tracking-widest focus:outline-hidden focus:bg-white transition-colors ${
                  error ? 'border-rose-400 focus:border-rose-500' : 'border-slate-200 focus:border-slate-400'
                }`}
              />
              {error && <p className="text-xs text-rose-600">{t('Contraseña incorrecta')}</p>}
            </div>
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => {
                  setAskingPin(false);
                  setPin('');
                  setError(false);
                }}
                className="inline-flex items-center gap-1 px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-900"
              >
                <ArrowLeft className="w-3.5 h-3.5 rtl:rotate-180" />
                {t('Volver')}
              </button>
              <button
                type="submit"
                disabled={!pin || !name.trim()}
                className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-40 rounded-lg transition-colors"
              >
                {t('Entrar')}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
