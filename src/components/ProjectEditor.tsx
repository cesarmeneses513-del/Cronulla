import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ImagePlus, Loader2, Trash2, X } from 'lucide-react';
import { useI18n } from '../i18n';
import { Project, fetchProjectStages, updateProject, updateSiteCover } from '../lib/projects';
import { uploadPhoto } from '../lib/supabase';
import { thumbUrl, fallbackTo } from '../lib/thumb';

// Administrators: a project's name, address, cover, its site's photo and the facade reference
// drawing (FCRS) of each stage. Pictures are uploaded like defect photos; saving is immediate.
export const ProjectEditor: React.FC<{ project: Project; onClose: () => void; onChanged: () => void }> = ({
  project,
  onClose,
  onChanged,
}) => {
  const { t } = useI18n();
  const [name, setName] = useState(project.name);
  const [address, setAddress] = useState(project.address);
  const [cover, setCover] = useState(project.cover_url);
  const [siteCover, setSiteCover] = useState(project.site_cover_url || '');
  const [images, setImages] = useState<Record<string, string>>(project.stage_images || {});
  const [stages, setStages] = useState<string[] | null>(null);
  const [newStage, setNewStage] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchProjectStages(project.id)
      .then(list => setStages([...new Set([...list, ...Object.keys(project.stage_images || {})])]))
      .catch(e => setError(String(e?.message || e)));
  }, [project]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const run = async (key: string, task: () => Promise<void>) => {
    setBusy(key);
    setError('');
    try {
      await task();
      onChanged();
    } catch (e) {
      const text = String((e as Error)?.message || e);
      setError(/stage_images|site_cover_url/.test(text) ? t('Primero hay que ejecutar supabase/projects-media.sql en Supabase.') : text);
    } finally {
      setBusy(null);
    }
  };

  const saveText = () =>
    run('text', async () => {
      await updateProject(project.id, { name: name.trim() || project.name, address: address.trim() });
    });
  const setCoverFile = (file: File) =>
    run('cover', async () => {
      const url = await uploadPhoto(file);
      await updateProject(project.id, { cover_url: url });
      setCover(url);
    });
  const setSiteFile = (file: File) =>
    run('site', async () => {
      const url = await uploadPhoto(file);
      await updateSiteCover(project.site!, url);
      setSiteCover(url);
    });
  const setStageFile = (stage: string, file: File) =>
    run(`stage:${stage}`, async () => {
      const url = await uploadPhoto(file);
      const next = { ...images, [stage]: url };
      await updateProject(project.id, { stage_images: next });
      setImages(next);
    });
  const removeStage = (stage: string) =>
    run(`stage:${stage}`, async () => {
      const next = { ...images };
      delete next[stage];
      await updateProject(project.id, { stage_images: next });
      setImages(next);
    });

  const field = 'w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-hidden focus:border-blue-700';
  const label = 'text-xs font-semibold text-slate-700';

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-xs" onClick={onClose}>
      <div
        className="w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto bg-white rounded-t-2xl sm:rounded-2xl p-5 sm:p-6 shadow-2xl space-y-5"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900">{t('Editar proyecto')}</h2>
            <p className="text-xs text-slate-500">{t('Los cambios se guardan al momento y los ve todo el que tenga acceso.')}</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100" aria-label={t('Cerrar')}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && <p className="text-xs text-rose-600">{error}</p>}

        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className={label}>{t('Nombre')}</label>
            <input value={name} onChange={e => setName(e.target.value)} onBlur={saveText} className={field} />
          </div>
          <div className="space-y-1">
            <label className={label}>{t('Dirección')}</label>
            <input value={address} onChange={e => setAddress(e.target.value)} onBlur={saveText} className={field} />
          </div>
        </div>

        <div className={`grid gap-3 ${project.site ? 'sm:grid-cols-2' : ''}`}>
          <Picture label={t('Foto de portada')} url={cover} busy={busy === 'cover'} onFile={setCoverFile} />
          {project.site && (
            <Picture label={t('Foto del sitio ({site})', { site: project.site })} url={siteCover} busy={busy === 'site'} onFile={setSiteFile} />
          )}
        </div>

        <div className="space-y-2">
          <div>
            <h3 className={label}>{t('FCRS: dibujo de referencia de cada cara')}</h3>
            <p className="text-[11px] text-slate-500">{t('Aparece como primera miniatura en los defectos de ese Stage. "Sin Stage" es para los defectos sin cara.')}</p>
          </div>
          {!stages ? (
            <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {stages.map(stage => (
                <div key={stage || '_none'} className="space-y-1">
                  <Picture
                    label={stage || t('Sin Stage')}
                    url={images[stage] || ''}
                    busy={busy === `stage:${stage}`}
                    onFile={file => setStageFile(stage, file)}
                    small
                  />
                  {images[stage] && (
                    <button onClick={() => removeStage(stage)} className="inline-flex items-center gap-1 text-[11px] text-rose-600 hover:text-rose-700">
                      <Trash2 className="w-3 h-3" />
                      {t('Quitar')}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <input
              value={newStage}
              onChange={e => setNewStage(e.target.value)}
              placeholder={t('Otro Stage (p. ej. NORTH)')}
              className={`${field} max-w-xs`}
            />
            <button
              type="button"
              onClick={() => {
                const s = newStage.toUpperCase().replace(/\s+/g, ' ').trim();
                if (s && stages && !stages.includes(s)) setStages([...stages, s]);
                setNewStage('');
              }}
              className="px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
            >
              {t('Añadir')}
            </button>
          </div>
        </div>

        <div className="flex justify-end">
          <button onClick={onClose} className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg">
            {t('Listo')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

// A picture with "upload / change" (one file, any image).
const Picture: React.FC<{ label: string; url: string; busy: boolean; onFile: (f: File) => void; small?: boolean }> = ({
  label,
  url,
  busy,
  onFile,
  small = false,
}) => {
  const { t } = useI18n();
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="space-y-1">
      <div className="text-xs font-semibold text-slate-700 truncate">{label}</div>
      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={busy}
        className={`relative w-full ${small ? 'aspect-[4/3]' : 'aspect-[16/9]'} rounded-xl border border-dashed border-slate-300 bg-slate-50 hover:bg-slate-100 overflow-hidden flex items-center justify-center`}
      >
        {url && <img src={thumbUrl(url, 480)} onError={fallbackTo(url)} alt="" referrerPolicy="no-referrer" className="absolute inset-0 w-full h-full object-cover" />}
        <span className={`relative inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${url ? 'bg-white/90 text-slate-800' : 'text-slate-500'}`}>
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImagePlus className="w-3.5 h-3.5" />}
          {url ? t('Cambiar') : t('Subir')}
        </span>
      </button>
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={e => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = '';
        }}
      />
    </div>
  );
};
