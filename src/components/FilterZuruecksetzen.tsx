import React from 'react';
import { RotateCcw } from 'lucide-react';
import { filterZuruecksetzen, useFilterAktiv } from '../utils/gemerkteFilter';

/**
 * Knopf „Filter zurücksetzen“ (Paket U, T-334). Erscheint nur, solange in der
 * Liste [liste] eine Suche oder ein Filter gesetzt ist.
 */
export const FilterZuruecksetzen: React.FC<{ liste: string; className?: string }> = ({ liste, className = '' }) => {
  const aktiv = useFilterAktiv(liste);
  if (!aktiv) return null;
  return (
    <button
      type="button"
      onClick={() => filterZuruecksetzen(liste)}
      title="Suche und alle Filter dieser Liste zurücksetzen"
      className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-200 dark:hover:bg-amber-900/40 transition-colors cursor-pointer shrink-0 whitespace-nowrap ${className}`}
    >
      <RotateCcw className="w-3.5 h-3.5" />
      Filter zurücksetzen
    </button>
  );
};
