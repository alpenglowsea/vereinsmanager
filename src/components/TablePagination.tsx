import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

export type PageSizeOption = 25 | 50 | 100 | 'all';

interface TablePaginationProps {
  totalItems: number;
  currentPage: number;
  pageSize: PageSizeOption;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: PageSizeOption) => void;
  itemName?: string; // e.g. 'Mitgliedern', 'Buchungen', 'Gegenständen'
}

export const TablePagination: React.FC<TablePaginationProps> = ({
  totalItems,
  currentPage,
  pageSize,
  onPageChange,
  onPageSizeChange,
  itemName = 'Einträgen'
}) => {
  const isAll = pageSize === 'all';
  const numericPageSize = isAll ? totalItems : pageSize;
  const totalPages = isAll || totalItems === 0 ? 1 : Math.ceil(totalItems / numericPageSize);

  const startItem = totalItems === 0 ? 0 : isAll ? 1 : (currentPage - 1) * numericPageSize + 1;
  const endItem = isAll ? totalItems : Math.min(currentPage * numericPageSize, totalItems);

  // Generate page numbers with ellipses
  const getPageNumbers = () => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const pages: (number | '...')[] = [];
    if (currentPage <= 4) {
      pages.push(1, 2, 3, 4, 5, '...', totalPages);
    } else if (currentPage >= totalPages - 3) {
      pages.push(1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
    } else {
      pages.push(1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages);
    }
    return pages;
  };

  return (
    <div className="px-4 py-3 bg-slate-50/90 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
      {/* Left: Summary text */}
      <div className="flex items-center gap-2 font-medium">
        <span>
          {isAll ? (
            <>
              Zeige alle <strong className="font-bold text-slate-800">{totalItems}</strong> {itemName}
            </>
          ) : totalItems === 0 ? (
            <>Keine Einträge vorhanden</>
          ) : (
            <>
              Zeige <strong className="font-bold text-slate-800">{startItem}</strong> bis{' '}
              <strong className="font-bold text-slate-800">{endItem}</strong> von{' '}
              <strong className="font-bold text-slate-800">{totalItems}</strong> {itemName}
            </>
          )}
        </span>
      </div>

      {/* Right: Page Size Selector & Pagination Buttons */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Page Size Picker */}
        <div className="flex items-center gap-1.5">
          <span className="text-slate-500 text-3xs font-semibold uppercase tracking-wider">Pro Seite:</span>
          <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 shadow-2xs">
            {([25, 50, 100, 'all'] as const).map(size => {
              const active = pageSize === size;
              return (
                <button
                  key={String(size)}
                  type="button"
                  onClick={() => {
                    onPageSizeChange(size);
                    onPageChange(1);
                  }}
                  className={`px-2 py-0.5 rounded-md text-2xs font-semibold transition-colors cursor-pointer ${
                    active
                      ? 'bg-blue-600 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                  title={size === 'all' ? 'Alle Einträge auf einer Seite anzeigen' : `${size} Einträge pro Seite`}
                >
                  {size === 'all' ? 'Alle' : size}
                </button>
              );
            })}
          </div>
        </div>

        {/* Navigation Buttons (only shown if not 'all' and more than 1 page) */}
        {!isAll && totalPages > 1 && (
          <div className="flex items-center gap-1">
            {/* First Page */}
            <button
              type="button"
              onClick={() => onPageChange(1)}
              disabled={currentPage === 1}
              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 disabled:opacity-35 disabled:hover:bg-white transition-colors cursor-pointer"
              title="Erste Seite"
            >
              <ChevronsLeft className="w-3.5 h-3.5" />
            </button>

            {/* Prev Page */}
            <button
              type="button"
              onClick={() => onPageChange(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 disabled:opacity-35 disabled:hover:bg-white transition-colors cursor-pointer"
              title="Vorherige Seite"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>

            {/* Numeric page buttons */}
            <div className="hidden md:flex items-center gap-1">
              {getPageNumbers().map((page, idx) => {
                if (page === '...') {
                  return (
                    <span key={`ellipsis-${idx}`} className="px-1 text-slate-400">
                      …
                    </span>
                  );
                }
                const active = page === currentPage;
                return (
                  <button
                    key={page}
                    type="button"
                    onClick={() => onPageChange(page)}
                    className={`min-w-6 h-6 px-1.5 rounded-md text-2xs font-bold transition-colors cursor-pointer flex items-center justify-center ${
                      active
                        ? 'bg-blue-600 text-white shadow-2xs'
                        : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {page}
                  </button>
                );
              })}
            </div>

            {/* Current page indicator for small screens */}
            <div className="md:hidden text-2xs font-semibold px-2 text-slate-700">
              Seite {currentPage} von {totalPages}
            </div>

            {/* Next Page */}
            <button
              type="button"
              onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 disabled:opacity-35 disabled:hover:bg-white transition-colors cursor-pointer"
              title="Nächste Seite"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>

            {/* Last Page */}
            <button
              type="button"
              onClick={() => onPageChange(totalPages)}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 disabled:opacity-35 disabled:hover:bg-white transition-colors cursor-pointer"
              title="Letzte Seite"
            >
              <ChevronsRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
