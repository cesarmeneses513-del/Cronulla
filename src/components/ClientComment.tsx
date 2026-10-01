import React, { useEffect, useState } from 'react';
import { MessageCircle, Pencil, Check, X } from 'lucide-react';
import { useI18n } from '../i18n';
import { DefectItem } from '../types/inspection';

// The client's comment on a defect: shown to everyone; editable by roles with the
// "Comentario del cliente" permission (`onSave` given). `dark` for the photo viewer.
export const ClientComment: React.FC<{
  item: DefectItem;
  onSave?: (itemId: string, text: string) => void;
  dark?: boolean;
  compact?: boolean;
}> = ({ item, onSave, dark = false, compact = false }) => {
  const { t } = useI18n();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(item.clientComment || '');
  useEffect(() => {
    if (!editing) setText(item.clientComment || '');
  }, [item.clientComment, editing]);

  const has = !!item.clientComment?.trim();
  if (!has && !onSave) return null;
  const save = () => {
    if (text.trim() !== (item.clientComment || '').trim()) onSave?.(item.id, text.trim());
    setEditing(false);
  };
  const box = dark ? 'bg-sky-500/10 border-sky-400/30 text-sky-100' : 'bg-sky-50 border-sky-200 text-sky-900';
  const sub = dark ? 'text-sky-300' : 'text-sky-700';

  if (editing)
    return (
      <div className={`p-2.5 rounded-lg border text-xs space-y-2 ${box}`}>
        <span className={`block text-[11px] font-semibold ${sub}`}>{t('Comentario del cliente')}</span>
        <textarea
          autoFocus
          rows={2}
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => e.key === 'Escape' && setEditing(false)}
          placeholder={t('Escribe tu comentario sobre este defecto…')}
          className={`w-full rounded-md px-2.5 py-1.5 text-sm resize-y focus:outline-hidden ${
            dark ? 'bg-white/10 border border-white/20 text-white placeholder:text-slate-500' : 'bg-white border border-sky-200 text-slate-900'
          }`}
        />
        <div className="flex justify-end gap-2">
          <button onClick={() => setEditing(false)} className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md ${dark ? 'text-slate-300 hover:text-white' : 'text-slate-600 hover:text-slate-900'}`}>
            <X className="w-3.5 h-3.5" />
            {t('Cancelar')}
          </button>
          <button onClick={save} className="inline-flex items-center gap-1 px-3 py-1 rounded-md bg-sky-600 hover:bg-sky-700 text-white font-semibold">
            <Check className="w-3.5 h-3.5" />
            {t('Guardar')}
          </button>
        </div>
      </div>
    );

  if (!has)
    return (
      <button
        onClick={() => setEditing(true)}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded border border-dashed text-xs font-medium ${
          dark ? 'border-sky-400/40 text-sky-300 hover:bg-sky-500/10' : 'border-sky-300 text-sky-700 hover:bg-sky-50'
        }`}
      >
        <MessageCircle className="w-3.5 h-3.5" />
        {t('Añadir comentario del cliente')}
      </button>
    );

  return (
    <div className={`rounded-lg border text-xs ${box} ${compact ? 'inline-flex items-center gap-1.5 px-2.5 py-1 max-w-md' : 'p-2.5'}`}>
      {compact ? (
        <>
          <MessageCircle className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate font-medium" title={item.clientComment}>{item.clientComment}</span>
        </>
      ) : (
        <>
          <span className={`flex items-center gap-1 text-[11px] font-semibold ${sub}`}>
            <MessageCircle className="w-3 h-3" />
            {t('Comentario del cliente')}
            {item.clientCommentBy && (
              <span className="font-normal opacity-80">
                · {item.clientCommentBy} {item.clientCommentDate && `(${item.clientCommentDate})`}
              </span>
            )}
          </span>
          <p className="mt-0.5 font-medium whitespace-pre-wrap">{item.clientComment}</p>
        </>
      )}
      {onSave && (
        <button onClick={() => setEditing(true)} title={t('Editar')} className={`shrink-0 p-0.5 rounded ${compact ? '' : 'float-end -mt-5'} ${dark ? 'hover:bg-white/10' : 'hover:bg-sky-100'}`}>
          <Pencil className="w-3 h-3" />
        </button>
      )}
    </div>
  );
};
