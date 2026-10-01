import React, { useEffect, useState } from 'react';
import { PencilLine, Eye, Lock, ArrowRight, ArrowLeft, Loader2 } from 'lucide-react';
import { useI18n } from '../i18n';
import { canonicalPerson } from '../lib/people';
import { LanguageSwitcher } from './LanguageSwitcher';
import { supabase } from '../lib/supabase';
import { Profile, isUsable, roleOf, fetchMyProfile, signIn, signUp, signOut } from '../lib/auth';

export type AppRole = 'editor' | 'client';

// Client-side gate only: it hides editing UI, it does not secure the database.
// Editors sign in with their account; AccessLevel says whether that role is an administrator.
export type AccessLevel = 'admin' | 'user';
const USER_KEY = 'cronulla_user';

export const storeUserName = (name: string) => {
  try {
    localStorage.setItem(USER_KEY, name.trim());
  } catch {}
};

// Always the person's full name, whatever short form they typed ("Cesar" → "César Meneses").
export const getStoredUserName = (): string => {
  try {
    return canonicalPerson(localStorage.getItem(USER_KEY) || '');
  } catch {
    return '';
  }
};

interface RoleSelectScreenProps {
  // `account`: signed in with an account (not a PIN).
  onSelect: (role: AppRole, access?: AccessLevel, account?: Profile) => void;
}

type Step = 'choose' | 'signin' | 'signup';

export const RoleSelectScreen: React.FC<RoleSelectScreenProps> = ({ onSelect }) => {
  const [step, setStep] = useState<Step>('choose');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'error' | 'info'; text: string } | null>(null);
  // Already signed in on this device: straight in.
  const [checking, setChecking] = useState(!!supabase);
  const [name, setName] = useState(getStoredUserName);
  const { t } = useI18n();

  // An active account enters with its role (clients see the gallery); otherwise say why not.
  const enterWith = (profile: Profile | null) => {
    if (profile && isUsable(profile)) {
      storeUserName(profile.name);
      const role = roleOf(profile);
      onSelect(role === 'client' ? 'client' : 'editor', role === 'admin' ? 'admin' : 'user', profile);
      return true;
    }
    if (profile && (profile.active === false || (profile.role as string) === 'disabled'))
      setMessage({ kind: 'error', text: t('Esta cuenta está desactivada.') });
    else if (profile) setMessage({ kind: 'info', text: t('Tu cuenta está creada. Un administrador debe darte acceso; mientras tanto puedes ver la galería como cliente.') });
    return false;
  };

  useEffect(() => {
    if (!supabase) return;
    fetchMyProfile()
      .then(profile => {
        if (profile && !enterWith(profile)) setStep('signin');
      })
      .catch(() => {})
      .finally(() => setChecking(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submitAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    if (step === 'signup' && password !== password2) {
      setMessage({ kind: 'error', text: t('Las contraseñas no coinciden.') });
      return;
    }
    setBusy(true);
    try {
      if (step === 'signup') {
        const profile = await signUp(name, email, password);
        if (!profile) setMessage({ kind: 'info', text: t('Revisa tu correo y confirma la cuenta; después entra con tu correo y contraseña.') });
        else enterWith(profile);
      } else {
        enterWith(await signIn(email, password));
      }
    } catch (err) {
      const text = String((err as Error)?.message || err);
      setMessage({
        kind: 'error',
        text: /invalid login/i.test(text)
          ? t('Correo o contraseña incorrectos.')
          : /already registered/i.test(text)
          ? t('Ya existe una cuenta con ese correo. Entra con tu contraseña.')
          : /password/i.test(text)
          ? t('La contraseña debe tener al menos 6 caracteres.')
          : text,
      });
    } finally {
      setBusy(false);
    }
  };


  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center px-4 py-10 font-sans antialiased">
      <div className="w-full max-w-2xl space-y-8">
        <div className="flex justify-end">
          <LanguageSwitcher className="bg-white border border-slate-200" />
        </div>
        <div className="flex flex-col items-center text-center gap-3">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs px-6 py-4">
            <img src="/cpr-logo-full.png" alt="CPR Facade Upgrade Specialists" className="h-20 sm:h-24 w-auto" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Cronulla Inspection Gallery</h1>
            <p className="text-sm text-slate-500 mt-1">{t('Control de Defectos & Galería Fotográfica')}</p>
          </div>
        </div>

        {checking ? (
          <div className="flex justify-center py-8 text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : step === 'signin' || step === 'signup' ? (
          <form
            onSubmit={submitAccount}
            className="max-w-sm mx-auto bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4"
          >
            <div className="flex items-center gap-2">
              <PencilLine className="w-4 h-4 text-amber-700" />
              <h2 className="text-sm font-bold text-slate-900">{step === 'signup' ? t('Crear cuenta') : t('Acceso Editor')}</h2>
            </div>
            {step === 'signup' && (
              <div className="space-y-1.5">
                <label htmlFor="acc-name" className="text-xs font-semibold text-slate-700">{t('Nombre y apellido')}</label>
                <input
                  id="acc-name"
                  type="text"
                  autoComplete="name"
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:border-slate-400 rounded-lg text-sm focus:outline-hidden focus:bg-white"
                />
                <p className="text-[11px] text-slate-400">{t('Aparece en el historial de cambios')}</p>
              </div>
            )}
            <div className="space-y-1.5">
              <label htmlFor="acc-email" className="text-xs font-semibold text-slate-700">{t('Correo')}</label>
              <input
                id="acc-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:border-slate-400 rounded-lg text-sm focus:outline-hidden focus:bg-white"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="acc-password" className="text-xs font-semibold text-slate-700">{t('Contraseña')}</label>
              <input
                id="acc-password"
                type="password"
                autoComplete={step === 'signup' ? 'new-password' : 'current-password'}
                required
                minLength={6}
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:border-slate-400 rounded-lg text-sm focus:outline-hidden focus:bg-white"
              />
            </div>
            {step === 'signup' && (
              <div className="space-y-1.5">
                <label htmlFor="acc-password2" className="text-xs font-semibold text-slate-700">{t('Repite la contraseña')}</label>
                <input
                  id="acc-password2"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={6}
                  value={password2}
                  onChange={e => setPassword2(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:border-slate-400 rounded-lg text-sm focus:outline-hidden focus:bg-white"
                />
              </div>
            )}
            {message && (
              <p className={`text-xs ${message.kind === 'error' ? 'text-rose-600' : 'text-sky-700'}`}>{message.text}</p>
            )}
            <button
              type="submit"
              disabled={busy}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-40 rounded-lg"
            >
              {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {step === 'signup' ? t('Crear cuenta') : t('Entrar')}
            </button>
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <button
                type="button"
                onClick={() => {
                  setStep('choose');
                  setMessage(null);
                  signOut();
                }}
                className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-900"
              >
                <ArrowLeft className="w-3.5 h-3.5 rtl:rotate-180" />
                {t('Volver')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setStep(step === 'signup' ? 'signin' : 'signup');
                  setMessage(null);
                }}
                className="font-semibold text-slate-900 hover:underline"
              >
                {step === 'signup' ? t('Ya tengo cuenta') : t('Crear cuenta nueva')}
              </button>
            </div>
          </form>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              onClick={() => setStep('signin')}
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
        )}

        <p className="text-center text-[11px] text-slate-400">
          {t('Creado por')} <span className="font-semibold text-slate-600">CIMA &amp; Daniel Vidal</span> · CPR 2026
        </p>
      </div>
    </div>
  );
};
