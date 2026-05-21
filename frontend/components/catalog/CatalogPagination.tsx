import { ChevronLeft, ChevronRight } from 'lucide-react';

type CatalogPaginationProps = {
  page: number;
  totalPages: number;
  total: number;
  perPage: number;
  loading?: boolean;
  onPageChange: (page: number) => void;
  /** Компактен ред над решетката */
  compact?: boolean;
  className?: string;
};

export function CatalogPagination({
  page,
  totalPages,
  total,
  perPage,
  loading = false,
  onPageChange,
  compact = false,
  className = '',
}: CatalogPaginationProps) {
  if (total <= 0) return null;

  const from = (page - 1) * perPage + 1;
  const to = Math.min(page * perPage, total);

  return (
    <div
      className={`flex flex-wrap items-center gap-2 ${compact ? 'justify-end' : 'justify-center'} ${className}`}
    >
      <span className={`text-gray-500 whitespace-nowrap ${compact ? 'text-[11px]' : 'text-sm'}`}>
        <strong className="text-gray-600">{from}–{to}</strong> от {total}
      </span>
      {totalPages > 1 && (
        <>
          <button
            type="button"
            disabled={page <= 1 || loading}
            onClick={() => onPageChange(Math.max(1, page - 1))}
            className={`inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white text-gray-700 font-semibold disabled:opacity-40 hover:border-[#00B4D8] hover:text-[#00B4D8] transition-colors ${
              compact ? 'px-2 py-1 text-[11px]' : 'px-4 py-2 text-sm rounded-xl'
            }`}
            aria-label="Предишна страница"
          >
            <ChevronLeft className={compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
            {!compact && 'Предишна'}
          </button>
          <span className={`text-gray-500 whitespace-nowrap ${compact ? 'text-[11px] px-0.5' : 'text-sm px-2'}`}>
            {page} / {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages || loading}
            onClick={() => onPageChange(Math.min(totalPages, page + 1))}
            className={`inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white text-gray-700 font-semibold disabled:opacity-40 hover:border-[#00B4D8] hover:text-[#00B4D8] transition-colors ${
              compact ? 'px-2 py-1 text-[11px]' : 'px-4 py-2 text-sm rounded-xl'
            }`}
            aria-label="Следваща страница"
          >
            {!compact && 'Следваща'}
            <ChevronRight className={compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
          </button>
        </>
      )}
    </div>
  );
}
