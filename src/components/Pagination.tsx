import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useI18n } from '../i18n';

interface PaginationProps {
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
  onChange: (page: number) => void;
}

// Page numbers to show: first, last, and a window around the current one, with gaps as null.
function pageList(page: number, count: number): (number | null)[] {
  const out: (number | null)[] = [];
  for (let p = 1; p <= count; p++) {
    if (p === 1 || p === count || Math.abs(p - page) <= 1) out.push(p);
    else if (out[out.length - 1] !== null) out.push(null);
  }
  return out;
}

export const Pagination: React.FC<PaginationProps> = ({ page, pageCount, total, pageSize, onChange }) => {
  const { t } = useI18n();
  if (pageCount <= 1) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const btn = 'min-w-8 h-8 px-2 inline-flex items-center justify-center rounded-md text-xs font-medium transition-colors';

  return (
    <nav className="flex flex-wrap items-center justify-between gap-2 py-3" aria-label={t('Páginas')}>
      <span className="text-xs text-slate-500 tabular-nums">
        {t('{from}–{to} de {total}', { from, to, total })}
      </span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onChange(page - 1)}
          disabled={page === 1}
          title={t('Anterior')}
          className={`${btn} border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40`}
        >
          <ChevronLeft className="w-4 h-4 rtl:rotate-180" />
        </button>
        {pageList(page, pageCount).map((p, i) =>
          p === null ? (
            <span key={`gap-${i}`} className="px-1 text-slate-400 text-xs">…</span>
          ) : (
            <button
              key={p}
              onClick={() => onChange(p)}
              className={`${btn} ${
                p === page ? 'bg-slate-900 text-white' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              {p}
            </button>
          )
        )}
        <button
          onClick={() => onChange(page + 1)}
          disabled={page === pageCount}
          title={t('Siguiente')}
          className={`${btn} border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40`}
        >
          <ChevronRight className="w-4 h-4 rtl:rotate-180" />
        </button>
      </div>
    </nav>
  );
};
