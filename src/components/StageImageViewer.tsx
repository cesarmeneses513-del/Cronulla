import React, { useEffect, useState } from 'react';
import { X, ZoomIn, ZoomOut, ExternalLink } from 'lucide-react';
import { useI18n } from '../i18n';

interface StageImageViewerProps {
  src: string;
  title: string;
  onClose: () => void;
}

// Full-screen view of a stage reference drawing; click the image to zoom in and scroll around.
export const StageImageViewer: React.FC<StageImageViewerProps> = ({ src, title, onClose }) => {
  const { t } = useI18n();
  const [zoomed, setZoomed] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col" onClick={onClose}>
      <div className="flex items-center justify-between px-4 py-3 text-white" onClick={e => e.stopPropagation()}>
        <span className="text-sm font-bold tracking-wide">FCRS · {title}</span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setZoomed(z => !z)}
            title={zoomed ? t('Alejar') : t('Acercar')}
            className="p-2 rounded-full hover:bg-white/15"
          >
            {zoomed ? <ZoomOut className="w-5 h-5" /> : <ZoomIn className="w-5 h-5" />}
          </button>
          <a href={src} target="_blank" rel="noreferrer" title={t('Ver en pantalla completa')} className="p-2 rounded-full hover:bg-white/15">
            <ExternalLink className="w-5 h-5" />
          </a>
          <button onClick={onClose} title={t('Cerrar')} className="p-2 rounded-full hover:bg-white/15">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
      <div className={`flex-1 overflow-auto ${zoomed ? '' : 'flex items-center justify-center'} p-4`}>
        <img
          src={src}
          alt={`FCRS ${title}`}
          onClick={e => {
            e.stopPropagation();
            setZoomed(z => !z);
          }}
          className={
            zoomed
              ? 'max-w-none w-[220%] sm:w-[160%] cursor-zoom-out rounded-lg'
              : 'max-w-full max-h-full object-contain cursor-zoom-in rounded-lg shadow-2xl'
          }
        />
      </div>
    </div>
  );
};
