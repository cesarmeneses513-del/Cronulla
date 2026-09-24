import React from 'react';
import { Globe } from 'lucide-react';
import { LANGUAGES, Lang, useI18n } from '../i18n';

export const LanguageSwitcher: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { lang, setLang, t } = useI18n();
  return (
    <label
      title={t('Idioma')}
      className={`relative inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer whitespace-nowrap ${className}`}
    >
      <Globe className="w-3.5 h-3.5" />
      <span>{LANGUAGES.find(l => l.code === lang)?.short}</span>
      {/* Native select stretched over the button: keyboard and mobile friendly. */}
      <select
        value={lang}
        onChange={e => setLang(e.target.value as Lang)}
        aria-label={t('Idioma')}
        className="absolute inset-0 opacity-0 cursor-pointer"
      >
        {LANGUAGES.map(l => (
          <option key={l.code} value={l.code}>
            {l.label}
          </option>
        ))}
      </select>
    </label>
  );
};
