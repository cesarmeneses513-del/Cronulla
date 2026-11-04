import React, { useEffect, useState } from 'react';
import { ArrowLeft, Building2, Camera, Eye, EyeOff, Grid3X3, Loader2, Lock, Mail, User } from 'lucide-react';
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


  // Fields with their icon inside; CPR's blue.
  const input =
    'w-full ps-10 pe-3.5 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:bg-white focus:border-sky-600 focus:ring-4 focus:ring-sky-100 transition';
  const label = 'text-xs font-semibold uppercase tracking-wider text-slate-500';
  const icon = 'absolute start-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none';
  const backToSignIn = () => {
    // From the reset link: the address is cleaned so a reload doesn't show that step again.
    if (step === 'reset') window.history.replaceState(null, '', window.location.pathname);
    if (step === 'reset') signOut();
    setStep('signin');
    setMessage(null);
  };

  // One way in for everyone (team and clients, of every building): a façade drawn in lines with its
  // numbered drops behind (no real building), CPR's brand on the left and the sign-in card on the
  // right (on phones, the brand above the card).
  const features: { Icon: typeof Camera; text: string }[] = [
    { Icon: Camera, text: t('Fotos de antes, durante y después de cada defecto') },
    { Icon: Grid3X3, text: t('La fachada por drop y nivel, de un vistazo') },
    { Icon: Building2, text: t('Todos tus edificios en una sola app') },
  ];
  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-900 font-sans antialiased">
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-sky-950" />
      <FacadeDrawing className="absolute top-[3%] start-[-30%] sm:start-[5%] lg:start-[30%] h-[112%] w-auto opacity-[0.16]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_25%,rgba(14,165,233,0.25),transparent_55%)]" />

      <div className="relative min-h-screen max-w-6xl mx-auto px-5 py-6 lg:py-10 flex flex-col lg:flex-row lg:items-center gap-8 lg:gap-16">
        <section className="text-white lg:flex-1 space-y-6 lg:space-y-10">
          <img src="/cpr-logo-full.png" alt="CPR Facade Upgrade Specialists" className="h-10 lg:h-12 w-auto bg-white rounded-xl px-3 py-2" />
          <div className="space-y-3">
            <h1 className="text-3xl lg:text-5xl font-extrabold tracking-tight">Inspection Gallery</h1>
            <p className="text-base lg:text-lg text-sky-100/90 max-w-md">{t('Defectos, fotos y avance de cada fachada que trabajamos.')}</p>
          </div>
          <ul className="hidden sm:grid gap-3 max-w-md">
            {features.map(({ Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-sm text-slate-100">
                <span className="w-9 h-9 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4 text-sky-300" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </section>

      <main className="relative w-full max-w-md mx-auto lg:mx-0 lg:shrink-0 bg-white rounded-3xl shadow-2xl p-6 sm:p-8">
        <div className="absolute top-4 end-4">
          <LanguageSwitcher className="bg-slate-50 border border-slate-200" />
        </div>
        {checking ? (
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        ) : (
          <form onSubmit={submitAccount} className="w-full space-y-5 pt-6">
            <div className="space-y-1.5">
              <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
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
                <div className="relative">
                  <User className={icon} />
                  <input id="acc-name" type="text" autoComplete="name" required value={name} onChange={e => setName(e.target.value)} className={input} />
                </div>
                <p className="text-[11px] text-slate-400">{t('Aparece en el historial de cambios')}</p>
              </div>
            )}

            {step !== 'reset' && (
              <div className="space-y-1.5">
                <label htmlFor="acc-email" className={label}>{t('Correo')}</label>
                <div className="relative">
                  <Mail className={icon} />
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
              </div>
            )}

            {step !== 'forgot' && (
              <div className="space-y-1.5">
                <label htmlFor="acc-password" className={label}>{step === 'reset' ? t('Contraseña nueva') : t('Contraseña')}</label>
                <div className="relative">
                  <Lock className={icon} />
                  <input
                    id="acc-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete={step === 'signin' ? 'current-password' : 'new-password'}
                    required
                    minLength={6}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className={`${input} pe-11`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    title={showPassword ? t('Ocultar') : t('Mostrar')}
                    aria-label={showPassword ? t('Ocultar') : t('Mostrar')}
                    className="absolute end-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
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
                      className="text-sm font-medium text-sky-700 hover:text-sky-900"
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
                <div className="relative">
                  <Lock className={icon} />
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
              </div>
            )}

            {message && message.text && (
              <p className={`text-sm ${message.kind === 'error' ? 'text-rose-600' : 'text-sky-700'}`}>{message.text}</p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-3.5 text-sm font-bold text-white bg-gradient-to-r from-sky-600 to-sky-800 hover:from-sky-700 hover:to-sky-900 disabled:opacity-50 rounded-xl shadow-lg shadow-sky-900/20 transition"
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
        <p className="mt-8 text-center text-[11px] text-slate-400">
          {t('Creado por')} <span className="font-semibold text-slate-600">CIMA &amp; Daniel Vidal</span> · CPR 2026
        </p>
      </main>
      </div>
    </div>
  );
};

// A façade in thin lines with its rope drops numbered along the top, like the FCRS drawings.
const FacadeDrawing: React.FC<{ className?: string }> = ({ className = '' }) => {
  const cols = 7;
  const rows = 14;
  const x0 = 60;
  const y0 = 120;
  const w = 480;
  const h = 860;
  const cw = w / cols;
  const rh = h / rows;
  return (
    <svg viewBox="0 0 620 1000" className={className} fill="none" aria-hidden="true">
      {/* Building and roof */}
      <rect x={x0} y={y0} width={w} height={h} stroke="#bae6fd" strokeWidth="2" />
      <rect x={x0 + 120} y={y0 - 50} width={w - 240} height="50" stroke="#bae6fd" strokeWidth="1.5" />
      {/* Floors */}
      {Array.from({ length: rows - 1 }, (_, r) => (
        <line key={`f${r}`} x1={x0} x2={x0 + w} y1={y0 + rh * (r + 1)} y2={y0 + rh * (r + 1)} stroke="#bae6fd" strokeOpacity="0.35" />
      ))}
      {/* Windows */}
      {Array.from({ length: rows }, (_, r) =>
        Array.from({ length: cols }, (_, c) => (
          <rect
            key={`w${r}-${c}`}
            x={x0 + c * cw + cw * 0.22}
            y={y0 + r * rh + rh * 0.25}
            width={cw * 0.56}
            height={rh * 0.5}
            stroke="#bae6fd"
            strokeOpacity="0.55"
          />
        ))
      )}
      {/* Rope drops, numbered */}
      {Array.from({ length: cols }, (_, c) => {
        const x = x0 + c * cw + cw / 2;
        return (
          <g key={`d${c}`}>
            <line x1={x} x2={x} y1={y0 - 70} y2={y0 + h} stroke="#38bdf8" strokeWidth="2.5" strokeDasharray="10 8" />
            <circle cx={x} cy={y0 - 92} r="17" fill="#0c4a6e" stroke="#38bdf8" strokeWidth="2" />
            <text x={x} y={y0 - 86} textAnchor="middle" fontSize="17" fontWeight="700" fill="#e0f2fe" fontFamily="system-ui, sans-serif">
              {c + 1}
            </text>
          </g>
        );
      })}
    </svg>
  );
};
