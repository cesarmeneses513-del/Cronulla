import React, { useEffect, useState } from 'react';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useI18n } from '../i18n';
import { canonicalPerson } from '../lib/people';
import { LanguageSwitcher } from './LanguageSwitcher';
import { supabase } from '../lib/supabase';
import {
  Profile,
  isUsable,
  roleOf,
  fetchMyProfile,
  signIn,
  signUp,
  signOut,
  requestPasswordReset,
  setNewPassword,
  openedFromRecoveryLink,
  recoveryLinkFailed,
} from '../lib/auth';

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
  // `account`: signed in with an account (not a PIN). `fresh`: signed in just now (not a
  // session already open on this device).
  onSelect: (role: AppRole, access?: AccessLevel, account?: Profile, fresh?: boolean) => void;
}

// forgot: asks for the email to send a reset link to; reset: opened from that link, choose a new password.
type Step = 'signin' | 'signup' | 'forgot' | 'reset';

export const RoleSelectScreen: React.FC<RoleSelectScreenProps> = ({ onSelect }) => {
  const [step, setStep] = useState<Step>(openedFromRecoveryLink ? 'reset' : recoveryLinkFailed ? 'forgot' : 'signin');
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'error' | 'info'; text: string } | null>(() =>
    recoveryLinkFailed ? { kind: 'error', text: '' } : null
  );
  // Already signed in on this device: straight in.
  const [checking, setChecking] = useState(!!supabase);
  const [name, setName] = useState(getStoredUserName);
  const { t } = useI18n();

  // An active account enters with its role (clients see the gallery); otherwise say why not.
  const enterWith = (profile: Profile | null, fresh = false) => {
    if (profile && isUsable(profile)) {
      storeUserName(profile.name);
      const role = roleOf(profile);
      onSelect(role === 'client' ? 'client' : 'editor', role === 'admin' ? 'admin' : 'user', profile, fresh);
      return true;
    }
    if (profile && (profile.active === false || (profile.role as string) === 'disabled'))
      setMessage({ kind: 'error', text: t('Esta cuenta está desactivada.') });
    else if (profile) setMessage({ kind: 'info', text: t('Tu cuenta está creada. Un administrador debe darte acceso; mientras tanto puedes ver la galería como cliente.') });
    return false;
  };

  // An expired reset link: say so (translated once `t` is available).
  useEffect(() => {
    if (recoveryLinkFailed) setMessage({ kind: 'error', text: t('El enlace ya no sirve (caducó o ya se usó). Pide otro.') });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Opened from the reset link: Supabase may report it a moment later.
  useEffect(() => {
    if (!supabase) return;
    const { data } = supabase.auth.onAuthStateChange(event => {
      if (event === 'PASSWORD_RECOVERY') setStep('reset');
    });
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!supabase) return;
    // From the reset link the person is signed in, but must first choose the new password.
    if (openedFromRecoveryLink) {
      setChecking(false);
      return;
    }
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
    if ((step === 'signup' || step === 'reset') && password !== password2) {
      setMessage({ kind: 'error', text: t('Las contraseñas no coinciden.') });
      return;
    }
    setBusy(true);
    try {
      if (step === 'forgot') {
        await requestPasswordReset(email);
        setMessage({ kind: 'info', text: t('Te enviamos un correo a {email} con un enlace para crear una contraseña nueva.', { email: email.trim() }) });
      } else if (step === 'reset') {
        const profile = await setNewPassword(password);
        // Clean the address so a reload doesn't show this step again.
        window.history.replaceState(null, '', window.location.pathname);
        if (!enterWith(profile, true)) setStep('signin');
      } else if (step === 'signup') {
        const profile = await signUp(name, email, password);
        if (!profile) setMessage({ kind: 'info', text: t('Revisa tu correo y confirma la cuenta; después entra con tu correo y contraseña.') });
        else enterWith(profile, true);
      } else {
        enterWith(await signIn(email, password), true);
      }
    } catch (err) {
      const text = String((err as Error)?.message || err);
      setMessage({
        kind: 'error',
        text: /invalid login/i.test(text)
          ? t('Correo o contraseña incorrectos.')
          : /rate limit|security purposes/i.test(text)
          ? t('Demasiados intentos. Espera unos minutos y vuelve a intentarlo.')
          : /different from the old/i.test(text)
          ? t('La contraseña nueva debe ser distinta de la anterior.')
          : /session|jwt|expired/i.test(text) && step === 'reset'
          ? t('El enlace ya no sirve (caducó o ya se usó). Pide otro.')
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


  const input =
    'w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:border-blue-700 focus:ring-2 focus:ring-blue-100';
  const label = 'text-sm font-medium text-slate-700';
  const backToSignIn = () => {
    // From the reset link: the address is cleaned so a reload doesn't show that step again.
    if (step === 'reset') window.history.replaceState(null, '', window.location.pathname);
    if (step === 'reset') signOut();
    setStep('signin');
    setMessage(null);
  };

  // One way in for everyone (team and clients), like AIMMS: the brand on one side, signing in on the other.
  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-white font-sans antialiased">
      <aside
        className="relative overflow-hidden bg-slate-950 text-white lg:w-1/2 lg:min-h-screen px-6 py-6 lg:p-12 flex flex-col justify-between gap-6"
        style={{
          backgroundImage:
            'radial-gradient(circle at 25% 30%, rgba(37,99,235,0.45), transparent 55%), linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)',
          backgroundSize: '100% 100%, 64px 64px, 64px 64px',
        }}
      >
        <div className="bg-white rounded-xl px-3 py-2 self-start">
          <img src="/cpr-logo-full.png" alt="CPR Facade Upgrade Specialists" className="h-8 lg:h-10 w-auto" />
        </div>
        <div className="space-y-3 max-w-md">
          <p className="text-xs font-semibold tracking-[0.2em] text-blue-200 uppercase">CPR · Inspection Gallery</p>
          <h1 className="text-2xl lg:text-4xl font-bold leading-tight">{t('Cada fachada, cada defecto, cada foto, en un solo lugar.')}</h1>
          <p className="hidden sm:block text-sm text-slate-300 leading-relaxed">
            {t('Inspecciones, reparaciones y su avance, edificio por edificio, para el equipo y los clientes.')}
          </p>
        </div>
      </aside>

      <main className="relative flex-1 flex flex-col items-center justify-center px-6 py-10 lg:py-12">
        <div className="absolute top-4 end-4">
          <LanguageSwitcher className="bg-white border border-slate-200" />
        </div>
        {checking ? (
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        ) : (
          <form onSubmit={submitAccount} className="w-full max-w-sm space-y-5">
            <div className="space-y-1.5">
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
                {step === 'signup'
                  ? t('Crear cuenta')
                  : step === 'forgot'
                  ? t('Restablecer contraseña')
                  : step === 'reset'
                  ? t('Nueva contraseña')
                  : t('Iniciar sesión')}
              </h2>
              <p className="text-sm text-slate-500">
                {step === 'signin'
                  ? t('Bienvenido. Usa el correo al que llegó tu invitación.')
                  : step === 'signup'
                  ? t('Usa el correo al que llegó tu invitación.')
                  : step === 'forgot'
                  ? t('Escribe tu correo y te enviaremos un enlace para crear una contraseña nueva.')
                  : t('Elige tu contraseña nueva.')}
              </p>
            </div>

            {step === 'signup' && (
              <div className="space-y-1.5">
                <label htmlFor="acc-name" className={label}>{t('Nombre y apellido')}</label>
                <input id="acc-name" type="text" autoComplete="name" required value={name} onChange={e => setName(e.target.value)} className={input} />
                <p className="text-[11px] text-slate-400">{t('Aparece en el historial de cambios')}</p>
              </div>
            )}

            {step !== 'reset' && (
              <div className="space-y-1.5">
                <label htmlFor="acc-email" className={label}>{t('Correo')}</label>
                <input
                  id="acc-email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="you@example.com.au"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className={input}
                />
              </div>
            )}

            {step !== 'forgot' && (
              <div className="space-y-1.5">
                <label htmlFor="acc-password" className={label}>{step === 'reset' ? t('Contraseña nueva') : t('Contraseña')}</label>
                <div className="relative">
                  <input
                    id="acc-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete={step === 'signin' ? 'current-password' : 'new-password'}
                    required
                    minLength={6}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className={`${input} pe-20`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute end-2 top-1/2 -translate-y-1/2 px-2 py-1 text-xs font-medium text-slate-600 hover:text-slate-900"
                  >
                    {showPassword ? t('Ocultar') : t('Mostrar')}
                  </button>
                </div>
                {step === 'signin' && (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        setStep('forgot');
                        setMessage(null);
                      }}
                      className="text-sm text-slate-600 hover:text-slate-900 hover:underline"
                    >
                      {t('¿Olvidaste tu contraseña?')}
                    </button>
                  </div>
                )}
              </div>
            )}

            {(step === 'signup' || step === 'reset') && (
              <div className="space-y-1.5">
                <label htmlFor="acc-password2" className={label}>{t('Repite la contraseña')}</label>
                <input
                  id="acc-password2"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  minLength={6}
                  value={password2}
                  onChange={e => setPassword2(e.target.value)}
                  className={input}
                />
              </div>
            )}

            {message && message.text && (
              <p className={`text-sm ${message.kind === 'error' ? 'text-rose-600' : 'text-sky-700'}`}>{message.text}</p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 disabled:opacity-50 rounded-lg transition-colors"
            >
              {busy && <Loader2 className="w-4 h-4 animate-spin" />}
              {step === 'signup'
                ? t('Crear cuenta')
                : step === 'forgot'
                ? t('Enviar enlace')
                : step === 'reset'
                ? t('Guardar contraseña')
                : t('Entrar')}
            </button>

            <div className="text-center text-sm text-slate-600">
              {step === 'signin' ? (
                <>
                  {t('¿No tienes cuenta?')}{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setStep('signup');
                      setMessage(null);
                    }}
                    className="font-semibold text-slate-900 hover:underline"
                  >
                    {t('Crear cuenta nueva')}
                  </button>
                </>
              ) : step === 'signup' ? (
                <button
                  type="button"
                  onClick={() => {
                    setStep('signin');
                    setMessage(null);
                  }}
                  className="font-semibold text-slate-900 hover:underline"
                >
                  {t('Ya tengo cuenta')}
                </button>
              ) : (
                <button type="button" onClick={backToSignIn} className="inline-flex items-center gap-1 font-semibold text-slate-900 hover:underline">
                  <ArrowLeft className="w-3.5 h-3.5 rtl:rotate-180" />
                  {t('Volver a iniciar sesión')}
                </button>
              )}
            </div>
          </form>
        )}
        <p className="mt-10 text-center text-[11px] text-slate-400">
          {t('Creado por')} <span className="font-semibold text-slate-600">CIMA &amp; Daniel Vidal</span> · CPR 2026
        </p>
      </main>
    </div>
  );
};
