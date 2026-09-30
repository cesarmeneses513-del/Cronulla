import React, { useEffect, useState } from 'react';
import { X, Users, Loader2, RefreshCw } from 'lucide-react';
import { useI18n } from '../i18n';
import { AccountRole, Profile, listProfiles, updateProfile } from '../lib/auth';

const ROLE_OPTIONS: { role: AccountRole; label: string }[] = [
  { role: 'admin', label: 'Administrador' },
  { role: 'user', label: 'Editor (sin borrar)' },
  { role: 'pending', label: 'Pendiente' },
  { role: 'disabled', label: 'Desactivado' },
];

const ROLE_STYLE: Record<AccountRole, string> = {
  admin: 'bg-amber-50 text-amber-800 border-amber-200',
  user: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  pending: 'bg-sky-50 text-sky-800 border-sky-200',
  disabled: 'bg-slate-100 text-slate-500 border-slate-200',
};

// Administrators: every account, its name and its level. Changes apply the next time that
// person opens the app.
export const UsersPanel: React.FC<{ me: Profile; onClose: () => void }> = ({ me, onClose }) => {
  const { t } = useI18n();
  const [profiles, setProfiles] = useState<Profile[] | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState<string | null>(null);

  const load = () => {
    setError('');
    listProfiles()
      .then(setProfiles)
      .catch(e => setError(String(e?.message || e)));
  };
  useEffect(load, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const save = async (p: Profile, changes: Partial<Pick<Profile, 'name' | 'role'>>) => {
    setSaving(p.id);
    setError('');
    try {
      await updateProfile(p.id, changes);
      setProfiles(list => (list || []).map(x => (x.id === p.id ? { ...x, ...changes } : x)));
    } catch (e) {
      setError(String((e as Error)?.message || e));
    } finally {
      setSaving(null);
    }
  };

  const pending = (profiles || []).filter(p => p.role === 'pending').length;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-start sm:items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="w-full max-w-2xl bg-white rounded-xl shadow-2xl border border-slate-200" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-slate-500" />
            <h2 className="text-sm font-bold text-slate-900">{t('Usuarios')}</h2>
            {pending > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-sky-100 text-sky-800">
                {t('{n} pendiente(s)', { n: pending })}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button onClick={load} title={t('Actualizar')} className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md">
              <RefreshCw className="w-4 h-4" />
            </button>
            <button onClick={onClose} className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <p className="px-5 pt-3 text-xs text-slate-500">
          {t('Cada persona crea su cuenta en la pantalla de inicio. Aquí le das su nivel; el cambio se aplica la próxima vez que abra la app.')}
        </p>
        {error && <p className="px-5 pt-2 text-xs text-rose-600">{error}</p>}

        {!profiles ? (
          <div className="flex justify-center py-10 text-slate-400">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : (
          <ul className="divide-y divide-slate-100 px-2 py-2">
            {profiles.map(p => (
              <li key={p.id} className="flex flex-col sm:flex-row sm:items-center gap-2 px-3 py-2.5">
                <div className="flex-1 min-w-0">
                  <input
                    defaultValue={p.name}
                    onBlur={e => e.target.value.trim() && e.target.value.trim() !== p.name && save(p, { name: e.target.value.trim() })}
                    className="w-full text-sm font-semibold text-slate-900 bg-transparent border border-transparent hover:border-slate-200 focus:border-slate-400 rounded px-1.5 py-0.5 focus:outline-hidden"
                    title={t('Nombre (aparece en el historial)')}
                  />
                  <div className="text-[11px] text-slate-500 px-1.5 truncate">
                    {p.email}
                    {p.id === me.id && <span className="ms-1 font-semibold text-slate-700">· {t('tú')}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {saving === p.id && <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />}
                  <select
                    value={p.role}
                    // Your own level can't be changed here, so there is always an administrator.
                    disabled={p.id === me.id}
                    onChange={e => save(p, { role: e.target.value as AccountRole })}
                    className={`text-xs font-semibold border rounded-lg px-2 py-1.5 focus:outline-hidden disabled:opacity-70 ${ROLE_STYLE[p.role]}`}
                  >
                    {ROLE_OPTIONS.map(o => (
                      <option key={o.role} value={o.role}>
                        {t(o.label)}
                      </option>
                    ))}
                  </select>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};
