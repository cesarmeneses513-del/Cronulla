import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X, Users, Loader2, RefreshCw, UserPlus, MoreHorizontal, MessageCircle, Mail, Copy, Check, ShieldCheck } from 'lucide-react';
import { useI18n } from '../i18n';
import {
  Invitation,
  Profile,
  deleteAccount,
  deleteInvitation,
  listInvitations,
  listProfiles,
  roleOf,
  saveInvitation,
  updateProfile,
} from '../lib/auth';
import {
  JOB_TITLES,
  PERMISSIONS,
  PermissionTable,
  ROLES,
  RoleKey,
  fetchPermissionTable,
  savePermission,
  Permission,
} from '../lib/permissions';

type Tab = 'users' | 'permissions';

const select =
  'w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 focus:outline-hidden focus:border-slate-400 disabled:opacity-60';

// Invitation text, ready for WhatsApp or email.
const inviteMessage = (inv: Invitation, roleLabel: string, t: ReturnType<typeof useI18n>['t']) =>
  t(
    'Hola {name}, te invito a Cronulla Inspection Gallery como {role}.\n\n1. Abre {link}\n2. Pulsa "Editor" → "Crear cuenta nueva"\n3. Usa este correo: {email}\n\nTu acceso queda listo al crear la cuenta.',
    { name: inv.name || inv.email, role: roleLabel, link: window.location.origin, email: inv.email }
  );

// Administrators: accounts, invitations and what each role may do.
export const UsersPanel: React.FC<{ me: Profile; onClose: () => void }> = ({ me, onClose }) => {
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>('users');
  const [profiles, setProfiles] = useState<Profile[] | null>(null);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [inviting, setInviting] = useState<Invitation | null>(null);
  const [sharing, setSharing] = useState<Invitation | null>(null);
  const [menu, setMenu] = useState<string | null>(null);

  const roleLabel = (role: string) => t(ROLES.find(r => r.role === role)?.label || 'Pendiente');

  const load = () => {
    setError('');
    Promise.all([listProfiles(), listInvitations()])
      .then(([p, i]) => {
        setProfiles(p);
        setInvitations(i);
      })
      .catch(e => setError(String(e?.message || e)));
  };
  useEffect(load, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (sharing || inviting) {
        setSharing(null);
        setInviting(null);
      } else onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, sharing, inviting]);

  const run = async (key: string, action: () => Promise<void>) => {
    setBusy(key);
    setError('');
    try {
      await action();
    } catch (e) {
      setError(String((e as Error)?.message || e));
    } finally {
      setBusy(null);
    }
  };

  const change = (p: Profile, changes: Partial<Pick<Profile, 'name' | 'role' | 'job_title' | 'active'>>) =>
    run(p.id, async () => {
      await updateProfile(p.id, changes);
      setProfiles(list => (list || []).map(x => (x.id === p.id ? { ...x, ...changes } : x)));
    });

  const changeInvitation = (inv: Invitation, changes: Partial<Invitation>) =>
    run(inv.email, async () => {
      const next = { ...inv, ...changes };
      await saveInvitation(next);
      setInvitations(list => list.map(x => (x.email === inv.email ? next : x)));
    });

  const counts = useMemo(() => {
    const list = profiles || [];
    return {
      total: list.length + invitations.length,
      active: list.filter(p => p.active !== false && p.role !== 'pending').length,
      pending: list.filter(p => p.role === 'pending').length,
      invited: invitations.length,
    };
  }, [profiles, invitations]);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-start justify-center p-3 sm:p-6 overflow-y-auto" onClick={onClose}>
      <div className="w-full max-w-5xl my-auto bg-white rounded-2xl shadow-2xl border border-slate-200" onClick={e => e.stopPropagation()}>
        {/* Title + tabs */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 sm:px-6 pt-5">
          <div>
            <p className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">{t('Oficina')}</p>
            <h2 className="text-xl font-bold text-slate-900">{t('Usuarios y permisos')}</h2>
          </div>
          <div className="flex items-center gap-2">
            {tab === 'users' && (
              <button
                onClick={() => setInviting({ email: '', name: '', role: 'technician', job_title: 'Inspector' })}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg"
              >
                <UserPlus className="w-4 h-4" />
                {t('Invitar usuario')}
              </button>
            )}
            <button onClick={load} title={t('Actualizar')} className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg">
              <RefreshCw className="w-4 h-4" />
            </button>
            <button onClick={onClose} className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="flex gap-1 px-5 sm:px-6 mt-4 border-b border-slate-200">
          {([
            ['users', t('Usuarios'), Users],
            ['permissions', t('Permisos'), ShieldCheck],
          ] as const).map(([key, label, Icon]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 -mb-px text-xs font-semibold border-b-2 ${
                tab === key ? 'border-blue-700 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>

        {error && <p className="mx-5 sm:mx-6 mt-3 text-xs text-rose-600">{error}</p>}

        {tab === 'users' ? (
          <div className="px-3 sm:px-6 py-4">
            <p className="px-2 sm:px-0 text-xs text-slate-500 mb-3">
              {t('{total} usuarios · {active} activos · {invited} invitados · {pending} pendientes', counts)}
            </p>
            {!profiles ? (
              <div className="flex justify-center py-10 text-slate-400">
                <Loader2 className="w-5 h-5 animate-spin" />
              </div>
            ) : (
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="hidden md:grid grid-cols-[1.6fr_1.3fr_1.1fr_0.7fr_40px] gap-3 px-4 py-2.5 bg-slate-50 text-[11px] font-bold tracking-wider text-slate-500 uppercase">
                  <span>{t('Nombre')}</span>
                  <span>{t('Rol de acceso')}</span>
                  <span>{t('Cargo')}</span>
                  <span>{t('Estado')}</span>
                  <span />
                </div>
                <ul className="divide-y divide-slate-100">
                  {profiles.map(p => {
                    const isMe = p.id === me.id;
                    const active = p.active !== false;
                    const pending = p.role === 'pending';
                    return (
                      <li key={p.id} className="grid grid-cols-1 md:grid-cols-[1.6fr_1.3fr_1.1fr_0.7fr_40px] gap-2 md:gap-3 items-center px-4 py-3">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-slate-900 truncate">
                            {p.name}
                            {isMe && <span className="ms-1.5 text-[11px] font-medium text-slate-400">({t('tú')})</span>}
                          </div>
                          <div className="text-xs text-slate-500 truncate">{p.email}</div>
                        </div>
                        <select
                          value={pending ? 'pending' : roleOf(p)}
                          disabled={isMe || busy === p.id}
                          onChange={e => change(p, { role: e.target.value as RoleKey })}
                          className={select}
                        >
                          {pending && <option value="pending">{t('Pendiente — elegir rol')}</option>}
                          {ROLES.map(r => (
                            <option key={r.role} value={r.role}>
                              {t(r.label)}
                            </option>
                          ))}
                        </select>
                        <select
                          value={p.job_title || ''}
                          disabled={busy === p.id}
                          onChange={e => change(p, { job_title: e.target.value })}
                          className={select}
                        >
                          <option value="">—</option>
                          {JOB_TITLES.map(j => (
                            <option key={j} value={j}>
                              {j}
                            </option>
                          ))}
                        </select>
                        <div className="flex items-center gap-2">
                          <StatusPill kind={pending ? 'pending' : active ? 'active' : 'inactive'} />
                          {busy === p.id && <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />}
                        </div>
                        <RowMenu
                          open={menu === p.id}
                          onToggle={() => setMenu(m => (m === p.id ? null : p.id))}
                          items={[
                            {
                              label: t('Cambiar nombre'),
                              onClick: () => {
                                const name = window.prompt(t('Nombre (aparece en el historial)'), p.name);
                                if (name && name.trim() && name.trim() !== p.name) change(p, { name: name.trim() });
                              },
                            },
                            ...(isMe
                              ? []
                              : [
                                  {
                                    label: active ? t('Desactivar') : t('Activar'),
                                    onClick: () => change(p, { active: !active }),
                                  },
                                  {
                                    label: t('Borrar definitivamente'),
                                    danger: true,
                                    onClick: () => {
                                      if (!window.confirm(t('¿Borrar definitivamente la cuenta de {name}? No se puede deshacer.', { name: p.name }))) return;
                                      run(p.id, async () => {
                                        await deleteAccount(p.id);
                                        setProfiles(list => (list || []).filter(x => x.id !== p.id));
                                      });
                                    },
                                  },
                                ]),
                          ]}
                          onPicked={() => setMenu(null)}
                        />
                      </li>
                    );
                  })}

                  {invitations.map(inv => (
                    <li key={inv.email} className="grid grid-cols-1 md:grid-cols-[1.6fr_1.3fr_1.1fr_0.7fr_40px] gap-2 md:gap-3 items-center px-4 py-3 bg-sky-50/40">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-900 truncate">{inv.name || '—'}</div>
                        <div className="text-xs text-slate-500 truncate">{inv.email}</div>
                      </div>
                      <select value={inv.role} disabled={busy === inv.email} onChange={e => changeInvitation(inv, { role: e.target.value as RoleKey })} className={select}>
                        {ROLES.map(r => (
                          <option key={r.role} value={r.role}>
                            {t(r.label)}
                          </option>
                        ))}
                      </select>
                      <select value={inv.job_title} disabled={busy === inv.email} onChange={e => changeInvitation(inv, { job_title: e.target.value })} className={select}>
                        <option value="">—</option>
                        {JOB_TITLES.map(j => (
                          <option key={j} value={j}>
                            {j}
                          </option>
                        ))}
                      </select>
                      <StatusPill kind="invited" />
                      <RowMenu
                        open={menu === inv.email}
                        onToggle={() => setMenu(m => (m === inv.email ? null : inv.email))}
                        items={[
                          { label: t('Enviar invitación'), onClick: () => setSharing(inv) },
                          {
                            label: t('Cancelar invitación'),
                            danger: true,
                            onClick: () =>
                              run(inv.email, async () => {
                                await deleteInvitation(inv.email);
                                setInvitations(list => list.filter(x => x.email !== inv.email));
                              }),
                          },
                        ]}
                        onPicked={() => setMenu(null)}
                      />
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <PermissionsTab />
        )}
      </div>

      {/* Invite: who, role and job title */}
      {inviting && (
        <Dialog onClose={() => setInviting(null)} title={t('Invitar usuario')}>
          <form
            onSubmit={e => {
              e.preventDefault();
              const inv = { ...inviting, email: inviting.email.trim().toLowerCase(), name: inviting.name.trim(), invited_by: me.name };
              run('invite', async () => {
                await saveInvitation(inv);
                setInvitations(list => [...list.filter(x => x.email !== inv.email), inv]);
                setInviting(null);
                setSharing(inv);
              });
            }}
            className="space-y-4"
          >
            <Field label={t('Correo')}>
              <input
                type="email"
                required
                autoFocus
                placeholder="nombre@ejemplo.com"
                value={inviting.email}
                onChange={e => setInviting({ ...inviting, email: e.target.value })}
                className={select}
              />
            </Field>
            <Field label={t('Nombre')}>
              <input required value={inviting.name} onChange={e => setInviting({ ...inviting, name: e.target.value })} className={select} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t('Rol de acceso')}>
                <select value={inviting.role} onChange={e => setInviting({ ...inviting, role: e.target.value as RoleKey })} className={select}>
                  {ROLES.map(r => (
                    <option key={r.role} value={r.role}>
                      {t(r.label)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={t('Cargo')}>
                <select value={inviting.job_title} onChange={e => setInviting({ ...inviting, job_title: e.target.value })} className={select}>
                  <option value="">—</option>
                  {JOB_TITLES.map(j => (
                    <option key={j} value={j}>
                      {j}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <p className="text-[11px] text-slate-500">
              {t('Cuando cree su cuenta con este correo, tendrá este rol y cargo automáticamente.')}
            </p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setInviting(null)} className="px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-900">
                {t('Cancelar')}
              </button>
              <button type="submit" disabled={busy === 'invite'} className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 disabled:opacity-50 rounded-lg">
                {busy === 'invite' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {t('Crear invitación')}
              </button>
            </div>
          </form>
        </Dialog>
      )}

      {/* Send the invitation: WhatsApp or email (the person's own apps, free) */}
      {sharing && <ShareInvite inv={sharing} message={inviteMessage(sharing, roleLabel(sharing.role), t)} onClose={() => setSharing(null)} />}
    </div>
  );
};

// ───────────────────────── Pieces ─────────────────────────

const StatusPill: React.FC<{ kind: 'active' | 'inactive' | 'invited' | 'pending' }> = ({ kind }) => {
  const { t } = useI18n();
  const style = {
    active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    inactive: 'bg-slate-100 text-slate-500 border-slate-200',
    invited: 'bg-sky-50 text-sky-700 border-sky-200',
    pending: 'bg-amber-50 text-amber-800 border-amber-200',
  }[kind];
  const label = { active: 'Activo', inactive: 'Inactivo', invited: 'Invitado', pending: 'Pendiente' }[kind];
  return <span className={`inline-flex px-2.5 py-1 rounded-full text-[11px] font-semibold border ${style}`}>{t(label)}</span>;
};

const RowMenu: React.FC<{
  open: boolean;
  onToggle: () => void;
  onPicked: () => void;
  items: { label: string; onClick: () => void; danger?: boolean }[];
}> = ({ open, onToggle, onPicked, items }) => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => ref.current && !ref.current.contains(e.target as Node) && onPicked();
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
    };
  }, [open, onPicked]);
  return (
    <div ref={ref} className="relative justify-self-end">
      <button onClick={onToggle} className="p-1.5 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-md">
        <MoreHorizontal className="w-4 h-4" />
      </button>
      {open && (
        <div className="absolute end-0 top-full mt-1 z-20 min-w-44 p-1 bg-white border border-slate-200 rounded-lg shadow-xl">
          {items.map(i => (
            <button
              key={i.label}
              onClick={() => {
                onPicked();
                i.onClick();
              }}
              className={`w-full text-start px-3 py-2 text-xs font-medium rounded-md ${i.danger ? 'text-rose-600 hover:bg-rose-50' : 'text-slate-700 hover:bg-slate-100'}`}
            >
              {i.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const Dialog: React.FC<{ title: string; onClose: () => void; children: React.ReactNode }> = ({ title, onClose, children }) => (
  <div className="fixed inset-0 z-[60] bg-slate-900/40 flex items-start justify-center p-4 overflow-y-auto" onClick={onClose}>
    <div className="w-full max-w-md my-auto bg-white rounded-xl shadow-2xl border border-slate-200" onClick={e => e.stopPropagation()}>
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
        <h3 className="text-sm font-bold text-slate-900">{title}</h3>
        <button onClick={onClose} className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  </div>
);

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <label className="block space-y-1.5">
    <span className="text-xs font-semibold text-slate-700">{label}</span>
    {children}
  </label>
);

const ShareInvite: React.FC<{ inv: Invitation; message: string; onClose: () => void }> = ({ inv, message, onClose }) => {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const subject = t('Invitación a Cronulla Inspection Gallery');
  return (
    <Dialog title={t('Enviar invitación')} onClose={onClose}>
      <div className="space-y-4">
        <p className="text-xs text-slate-600">
          {t('Invitación creada para {email}. Envíasela por WhatsApp o correo:', { email: inv.email })}
        </p>
        <pre className="whitespace-pre-wrap text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-lg p-3 font-sans">{message}</pre>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <a
            href={`https://wa.me/?text=${encodeURIComponent(message)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg"
          >
            <MessageCircle className="w-4 h-4" />
            WhatsApp
          </a>
          <a
            href={`mailto:${encodeURIComponent(inv.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg"
          >
            <Mail className="w-4 h-4" />
            {t('Correo')}
          </a>
          <button
            onClick={() => {
              navigator.clipboard?.writeText(message).then(() => setCopied(true));
            }}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            {copied ? t('Copiado') : t('Copiar texto')}
          </button>
        </div>
      </div>
    </Dialog>
  );
};

const PermissionsTab: React.FC = () => {
  const { t } = useI18n();
  const [table, setTable] = useState<PermissionTable | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    fetchPermissionTable().then(setTable);
  }, []);

  const toggle = async (role: RoleKey, perm: Permission) => {
    if (!table || role === 'admin') return;
    const allowed = !table[role].has(perm);
    const next = { ...table, [role]: new Set(table[role]) };
    if (allowed) next[role].add(perm);
    else next[role].delete(perm);
    setTable(next);
    setError('');
    try {
      await savePermission(role, perm, allowed);
    } catch (e) {
      setTable(table);
      setError(String((e as Error)?.message || e));
    }
  };

  if (!table)
    return (
      <div className="flex justify-center py-10 text-slate-400">
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
    );
  return (
    <div className="px-3 sm:px-6 py-4">
      <p className="px-2 sm:px-0 text-xs text-slate-500 mb-3">
        {t('Marca qué puede hacer cada rol. Se aplica la próxima vez que cada persona abra la app. El Administrador siempre puede todo.')}
      </p>
      {error && <p className="mb-3 text-xs text-rose-600">{error}</p>}
      <div className="border border-slate-200 rounded-xl overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-50 text-[11px] font-bold tracking-wider text-slate-500 uppercase">
              <th className="text-start px-4 py-2.5">{t('Permiso')}</th>
              {ROLES.map(r => (
                <th key={r.role} className="px-2 py-2.5 text-center min-w-24">
                  {t(r.label)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            <tr>
              <td className="px-4 py-2.5 font-medium text-slate-800">{t('Ver defectos y fotos')}</td>
              {ROLES.map(r => (
                <td key={r.role} className="text-center">
                  <Tick on disabled />
                </td>
              ))}
            </tr>
            {PERMISSIONS.map(p => (
              <tr key={p.key}>
                <td className="px-4 py-2.5 font-medium text-slate-800">{t(p.label)}</td>
                {ROLES.map(r => (
                  <td key={r.role} className="text-center">
                    <Tick on={table[r.role].has(p.key)} disabled={r.role === 'admin'} onClick={() => toggle(r.role, p.key)} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const Tick: React.FC<{ on: boolean; disabled?: boolean; onClick?: () => void }> = ({ on, disabled, onClick }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`inline-flex w-5 h-5 items-center justify-center rounded border transition-colors ${
      on ? 'bg-blue-700 border-blue-700 text-white' : 'bg-white border-slate-300 hover:border-slate-500'
    } disabled:cursor-default ${disabled && on ? 'opacity-60' : ''}`}
  >
    {on && <Check className="w-3.5 h-3.5" />}
  </button>
);
