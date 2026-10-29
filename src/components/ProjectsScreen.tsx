import React, { useEffect, useState } from 'react';
import { Building2, ChevronRight, Eye, LogOut, PencilLine, Search } from 'lucide-react';
import { useI18n } from '../i18n';
import { Project, ProjectStats, fetchProjectStats } from '../lib/projects';
import { thumbUrl, fallbackTo } from '../lib/thumb';
import { LanguageSwitcher } from './LanguageSwitcher';

// The buildings this person can see: a card each with its photo, defects and progress.
export const ProjectsScreen: React.FC<{
  projects: Project[];
  onOpen: (id: string) => void;
  onLogout: () => void;
}> = ({ projects, onOpen, onLogout }) => {
  const { t } = useI18n();
  const [stats, setStats] = useState<Record<string, ProjectStats>>({});
  const [query, setQuery] = useState('');
  useEffect(() => {
    fetchProjectStats(projects.map(p => p.id)).then(setStats);
  }, [projects]);

  const q = query.trim().toLowerCase();
  const shown = q ? projects.filter(p => `${p.name} ${p.address}`.toLowerCase().includes(q)) : projects;

  return (
    <div className="min-h-screen bg-slate-100 font-sans antialiased">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
          <img src="/cpr-logo-circle.png" alt="CPR" className="w-10 h-10 shrink-0" />
          <div className="flex-1 min-w-0">
            <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight leading-tight">{t('Proyectos')}</h1>
            <p className="text-xs text-slate-500">{t('Elige un edificio para ver sus defectos y fotos')}</p>
          </div>
          <LanguageSwitcher />
          <button
            onClick={onLogout}
            title={t('Cerrar sesión')}
            className="inline-flex items-center justify-center gap-1.5 h-9 px-3 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t('Cerrar sesión')}</span>
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-4">
        {projects.length === 0 ? (
          <div className="max-w-md mx-auto mt-10 p-6 bg-white border border-slate-200 rounded-2xl text-center space-y-2">
            <Building2 className="w-8 h-8 text-slate-400 mx-auto" />
            <p className="text-sm font-semibold text-slate-900">{t('Todavía no tienes proyectos asignados')}</p>
            <p className="text-xs text-slate-500">{t('Pide a CPR que te dé acceso a tus edificios.')}</p>
          </div>
        ) : (
          <>
            {projects.length > 6 && (
              <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder={t('Buscar proyecto…')}
                  className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-hidden focus:border-slate-400"
                />
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {shown.map(p => {
                const s = stats[p.id];
                const pct = s && s.total > 0 ? Math.round((s.completed / s.total) * 100) : 0;
                return (
                  <button
                    key={p.id}
                    onClick={() => onOpen(p.id)}
                    className="group text-start bg-white border border-slate-200 hover:border-slate-900 rounded-2xl overflow-hidden shadow-xs hover:shadow-md transition-all"
                  >
                    <div className="relative aspect-[16/9] bg-gradient-to-br from-slate-200 to-slate-300">
                      {p.cover_url ? (
                        <img
                          src={thumbUrl(p.cover_url, 640)}
                          onError={fallbackTo(p.cover_url)}
                          alt=""
                          loading="lazy"
                          referrerPolicy="no-referrer"
                          className="absolute inset-0 w-full h-full object-cover"
                        />
                      ) : (
                        <Building2 className="absolute inset-0 m-auto w-10 h-10 text-slate-400" />
                      )}
                      <span
                        className={`absolute top-3 start-3 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          p.editable ? 'bg-amber-50 text-amber-800 border-amber-200' : 'bg-white/90 text-slate-700 border-slate-200'
                        }`}
                      >
                        {p.editable ? <PencilLine className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                        {p.editable ? t('En obra') : t('Solo lectura')}
                      </span>
                    </div>
                    <div className="p-4 space-y-3">
                      <div>
                        <h2 className="text-base font-bold text-slate-900 leading-tight">{p.name}</h2>
                        {p.address && <p className="text-xs text-slate-500 mt-0.5">{p.address}</p>}
                      </div>
                      <div className="flex items-end justify-between gap-3">
                        <div className="flex items-end gap-5">
                          <div>
                            <div className="text-lg font-bold font-mono tabular-nums text-slate-900">{s ? s.total : '…'}</div>
                            <div className="text-[11px] text-slate-500">{t('defectos')}</div>
                          </div>
                          <div>
                            <div className="text-lg font-bold font-mono tabular-nums text-emerald-700">{s ? `${pct}%` : '…'}</div>
                            <div className="text-[11px] text-slate-500">{t('completado')}</div>
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-slate-900 rtl:rotate-180" />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </main>
    </div>
  );
};
