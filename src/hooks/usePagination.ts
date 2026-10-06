import { useEffect, useMemo, useState } from 'react';
import type { PageSizeOption } from '../components/TablePagination';

/**
 * Seitenweise Darstellung einer Liste (25 / 50 / 100 / alle).
 *
 * `resetKey` ist ein Text, der sich ändert, sobald Suche, Filter oder
 * Sortierung wechseln — dann springt die Ansicht zurück auf Seite 1. Man
 * übergibt ihn als zusammengesetzten Text, z. B.
 * `[suche, filter, sortierung].join('|')`.
 *
 * Wird die Liste kürzer (z. B. nach dem Löschen), landet die Ansicht auf der
 * letzten vorhandenen Seite statt auf einer leeren.
 */
export function usePagination<T>(items: readonly T[], resetKey: string) {
  const [requestedPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<PageSizeOption>(25);

  useEffect(() => {
    setCurrentPage(1);
  }, [resetKey]);

  const totalPages =
    pageSize === 'all' || items.length === 0 ? 1 : Math.ceil(items.length / pageSize);
  const currentPage = Math.min(Math.max(requestedPage, 1), totalPages);

  const pageItems = useMemo(() => {
    if (pageSize === 'all') return items;
    const start = (currentPage - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, currentPage, pageSize]);

  return { pageItems, currentPage, setCurrentPage, pageSize, setPageSize };
}
