import React, { useEffect, useState } from 'react';
import { ArrowLeft, Building2, ChevronRight, Eye, Layers, LogOut, PencilLine, Search } from 'lucide-react';
import { useI18n } from '../i18n';
import { Project, ProjectStats, fetchProjectStats } from '../lib/projects';
import { thumbUrl, fallbackTo } from '../lib/thumb';
import { LanguageSwitcher } from './LanguageSwitcher';

// The buildings this person can see: a card each with its photo, defects and progress. Buildings
// of one site (same `site`) show as one card; opening it lists them.
export const ProjectsScreen: React.FC<{
  projects: Project[];
  onOpen: (id: string) => void;
  onLogout: () => void;
}> = ({ projects, onOpen, onLogout }) => {
  const { t } = useI18n();
  const [stats, setStats] = useState<Record<string, ProjectStats>>({});
  const [query, setQuery] = useState('');
  const [openSite, setOpenSite] = useState<string | null>(null);
  useEffect(() => {
    fetchProjectStats(projects.map(p => p.id)).then(setStats);
  }, [projects]);

  // Sites with two or more visible buildings become one card.
  const bySite = new Map<string, Project[]>();
  projects.forEach(p => p.site && bySite.set(p.site, [...(bySite.get(p.site) || []), p]));
  type Entry = { kind: 'project'; project: Project } | { kind: 'site'; name: string; blocks: Project[] };
  const entries: Entry[] = [];
  const seen = new Set<string>();
  projects.forEach(p => {
    const blocks = p.site ? bySite.get(p.site)! : [];
    if (blocks.length >= 2) {
      if (!seen.has(p.site!)) entries.push({ kind: 'site', name: p.site!, blocks });
      seen.add(p.site!);
    } else entries.push({ kind: 'project', project: p });
  });
  const siteBlocks = openSite ? bySite.get(openSite) || [] : null;

  const q = query.trim().toLowerCase();
  const matches = (text: string) => !q || text.toLowerCase().includes(q);
  const shown = siteBlocks
    ? siteBlocks.filter(p => matches(`${p.name} ${p.address}`)).map(p => ({ kind: 'project', project: p }) as Entry)
    : entries.filter(e =>
        e.kind === 'project' ? matches(`${e.project.name} ${e.project.address}`) : matches(`${e.name} ${e.blocks.map(b => `${b.name} ${b.address}`).join(' ')}`)
      );

  const card = (key: string, o: { title: string; address: string; cover: string; badge: React.ReactNode; total?: number; completed?: number; extra?: string; onClick: () => void }) => {
    const pct = o.total ? Math.round(((o.completed || 0) / o.total) * 100) : 0;
    return (
      <button
        key={key}
        onClick={o.onClick}
        className="group text-start bg-white border border-slate-200 hover:border-slate-900 rounded-2xl overflow-hidden shadow-xs hover:shadow-md transition-all"
      >
        <div className="relative aspect-[16/9] bg-gradient-to-br from-slate-200 to-slate-300">
          {o.cover ? (
            <img src={thumbUrl(o.cover, 640)} onError={fallbackTo(o.cover)} alt="" loading="lazy" referrerPolicy="no-referrer" className="absolute inset-0 w-full h-full object-cover" />
          ) : (
            <Building2 className="absolute inset-0 m-auto w-10 h-10 text-slate-400" />
          )}
          <span className="absolute top-3 start-3">{o.badge}</span>
        </div>
        <div className="p-4 space-y-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 leading-tight">{o.title}</h2>
            {o.address && <p className="text-xs text-slate-500 mt-0.5">{o.address}</p>}
            {o.extra && <p className="text-xs text-slate-400 mt-1">{o.extra}</p>}
          </div>
          <div className="flex items-end justify-between gap-3">
            <div className="flex items-end gap-5">
              <div>
                <div className="text-lg font-bold font-mono tabular-nums text-slate-900">{o.total ?? '…'}</div>
                <div className="text-[11px] text-slate-500">{t('defectos')}</div>
              </div>
              <div>
                <div className="text-lg font-bold font-mono tabular-nums text-emerald-700">{o.total === undefined ? '…' : `${pct}%`}</div>
                <div className="text-[11px] text-slate-500">{t('completado')}</div>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-slate-900 rtl:rotate-180" />
          </div>
        </div>
      </button>
    );
  };
  const pill = 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border';
  const projectBadge = (p: Project) => (
    <span className={`${pill} ${p.editable ? 'bg-amber-50 text-amber-800 border-amber-200' : 'bg-white/90 text-slate-700 border-slate-200'}`}>
      {p.editable ? <PencilLine className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
      {p.editable ? t('En obra') : t('Solo lectura')}
    </span>
  );
  const sum = (blocks: Project[], key: 'total' | 'completed') =>
    blocks.every(b => stats[b.id]) ? blocks.reduce((n, b) => n + stats[b.id][key], 0) : undefined;

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
            {siteBlocks && (
              <div className="space-y-1">
                <button onClick={() => setOpenSite(null)} className="inline-flex items-center gap-1 text-xs font-bold tracking-wider uppercase text-blue-700 hover:text-blue-900">
                  <ArrowLeft className="w-3.5 h-3.5 rtl:rotate-180" />
                  {t('Todos los proyectos')}
                </button>
                <h2 className="text-2xl font-bold text-slate-900">{openSite}</h2>
                <p className="text-xs text-slate-500">{t('Elige el edificio')}</p>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {shown.map(e =>
                e.kind === 'project'
                  ? card(e.project.id, {
                      title: e.project.name,
                      address: e.project.address,
                      cover: e.project.cover_url,
                      badge: projectBadge(e.project),
                      total: stats[e.project.id]?.total,
                      completed: stats[e.project.id]?.completed,
                      onClick: () => onOpen(e.project.id),
                    })
                  : card(`site:${e.name}`, {
                      title: e.name,
                      address: e.blocks[0].address,
                      cover: e.blocks.find(b => b.cover_url)?.cover_url || '',
                      badge: (
                        <span className={`${pill} bg-slate-900/80 text-white border-slate-700`}>
                          <Layers className="w-3 h-3" />
                          {t('Sitio · {n} edificios', { n: e.blocks.length })}
                        </span>
                      ),
                      extra: e.blocks.map(b => b.name).join(' · '),
                      total: sum(e.blocks, 'total'),
                      completed: sum(e.blocks, 'completed'),
                      onClick: () => {
                        setOpenSite(e.name);
                        setQuery('');
                      },
                    })
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
};
