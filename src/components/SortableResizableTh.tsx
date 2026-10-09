import React from 'react';
import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';

interface SortableResizableThProps {
  /** Beschriftung der Spalte. */
  label: React.ReactNode;
  /** Textausrichtung; wirkt sich auch auf die Position des Pfeils aus. */
  align?: 'left' | 'right' | 'center';
  /** Ist diese Spalte gerade die, nach der sortiert wird? */
  active: boolean;
  direction: 'asc' | 'desc';
  onSort: () => void;
  /** Tooltip-Text auf dem Spaltenkopf, z.B. "Nach Name sortieren". */
  sortTitle: string;
  /** false für eine Spalte, die zwar in der Breite anpassbar, aber (noch)
   *  nicht sinnvoll sortierbar ist, z.B. weil alle Zeilen denselben Wert
   *  zeigen. Blendet Klick-Handler und Sortierpfeil aus, der Ziehgriff
   *  bleibt. Standard: sortierbar. */
  sortable?: boolean;
  /** Schlüssel dieser Spalte — verknüpft Kopf und Zellen für die
   *  automatische Breitenanpassung (data-col-content). */
  colKey: string;
  /** Aktuelle Breite in Pixel. */
  width: number;
  onResizeStart: (e: React.PointerEvent) => void;
  onAutoFit: () => void;
  /** Zusätzliche Klassen, z.B. für eine Mindestbreite bei kurzen Spalten. */
  className?: string;
  /** Hintergrundfarbe des Tabellenkopfs — muss zur restlichen <thead>
   *  passen (Standard wie bei Mitgliedern/Buchungsjournal/Kontakte/
   *  Spenden/Inventar; Rechnungen benutzt einen helleren Grauton). Eine
   *  eigene Prop statt über className, weil sich zwei Tailwind-
   *  Hintergrundklassen im selben class-Attribut nicht zuverlässig
   *  gegenseitig überschreiben. */
  headerBg?: string;
  /** false, um diese Spalte von der Drag&Drop-Umsortierung auszunehmen
   *  (nicht benutzt — alle Datenspalten sind umsortierbar; die feste
   *  Auswahl-Kästchen- und Aktionen-Spalte sind ohnehin kein
   *  SortableResizableTh). Standard: umsortierbar. */
  draggable?: boolean;
  /** Wird gerade diese Spalte gezogen? Blendet sie leicht aus. */
  isDragging?: boolean;
  /** Ist diese Spalte gerade das Ziel, über dem eine andere gezogen wird?
   *  Zeigt eine blaue Einfüge-Markierung am linken Rand. */
  isDragOver?: boolean;
  onColDragStart?: (e: React.DragEvent<HTMLTableCellElement>) => void;
  onColDragOver?: (e: React.DragEvent<HTMLTableCellElement>) => void;
  onColDrop?: (e: React.DragEvent<HTMLTableCellElement>) => void;
  onColDragEnd?: () => void;
  /** Rechtsklick auf den Spaltenkopf — öffnet das Menü zum Ein-/Ausblenden
   *  von Spalten. Ruft e.preventDefault() selbst nicht auf; das macht der
   *  Aufrufer, um zugleich die Klick-Koordinaten für die Menüposition zu
   *  lesen. */
  onContextMenu?: (e: React.MouseEvent<HTMLTableCellElement>) => void;
}

/**
 * Sortierbarer, in der Breite ziehbarer Tabellenkopf mit mitscrollendem
 * (sticky) Verhalten. Gemeinsam benutzt von allen Tabellen (Mitglieder,
 * Buchungsjournal, Kontakte, Rechnungen, Spenden, Inventar), damit sich
 * Aussehen und Bedienung nicht von Tabelle zu Tabelle unterscheiden.
 *
 * Die eigentliche Sortier- und Breiten-Logik steckt bewusst NICHT hier,
 * sondern in den Hooks useSortableColumns / useResizableColumns bzw. — bei
 * Mitgliedern und dem Buchungsjournal — in deren eigener, schon vorhandener
 * Sortierlogik. Diese Komponente ist nur für Aussehen und Bedienung
 * zuständig.
 *
 * Der schmale Ziehgriff am rechten Rand ist bewusst vom Rest des
 * Spaltenkopfs getrennt (eigenes Element, eigener Klick-Handler, der die
 * Weitergabe an den Sortier-Klick stoppt) — sonst würde ein Ziehen am Rand
 * gelegentlich auch als Klick auf den Spaltenkopf gewertet und die
 * Sortierung ungewollt umschalten.
 *
 * Für das Umsortieren der Spalten ist der GESAMTE Kopf (außer dem
 * Ziehgriff) per natives HTML5-Drag&Drop ziehbar. Das kollidiert nicht mit
 * dem Sortier-Klick: Ein einfacher Klick ohne Bewegung löst beim Browser
 * kein "dragstart" aus, sondern weiterhin ganz normal den Klick — erst ein
 * Drücken-Halten-Ziehen wird als Spalten-Verschieben erkannt. Der
 * Ziehgriff selbst bekommt `draggable={false}`, damit das Ziehen dort
 * weiterhin ausschließlich die Breite ändert.
 */
export const SortableResizableTh: React.FC<SortableResizableThProps> = ({
  label,
  align = 'left',
  active,
  direction,
  onSort,
  sortTitle,
  sortable = true,
  colKey,
  width,
  onResizeStart,
  onAutoFit,
  className = '',
  headerBg = 'bg-slate-50 dark:bg-slate-800',
  draggable = true,
  isDragging = false,
  isDragOver = false,
  onColDragStart,
  onColDragOver,
  onColDrop,
  onColDragEnd,
  onContextMenu
}) => {
  const justify = align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : '';
  const textAlign = align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : '';

  return (
    <th
      style={{ width, minWidth: width }}
      draggable={draggable}
      onDragStart={draggable ? onColDragStart : undefined}
      onDragOver={draggable ? onColDragOver : undefined}
      onDrop={draggable ? onColDrop : undefined}
      onDragEnd={draggable ? onColDragEnd : undefined}
      onContextMenu={onContextMenu}
      title={draggable ? 'Ziehen: Spalte verschieben · Rechtsklick: Spalten ein-/ausblenden' : 'Rechtsklick: Spalten ein-/ausblenden'}
      className={`relative px-4 py-3 select-none sticky top-0 z-10 ${headerBg} border-b border-slate-200 dark:border-slate-800 ${textAlign} ${
        draggable ? 'cursor-grab active:cursor-grabbing' : ''
      } ${isDragging ? 'opacity-40' : ''} ${
        isDragOver ? 'outline outline-2 -outline-offset-2 outline-blue-500' : ''
      } ${className}`}
    >
      <div
        onClick={sortable ? onSort : undefined}
        title={sortable ? sortTitle : undefined}
        className={`inline-flex items-center gap-1 ${sortable ? 'cursor-pointer group/th hover:text-slate-900 dark:hover:text-white' : ''} transition-colors w-[calc(100%-10px)] ${justify}`}
      >
        {/* min-w-0 ist hier bewusst und nicht nur Kosmetik: Ohne diese Angabe
            verlässt sich das Abschneiden (truncate) auf eine Regel, nach der
            ein Flex-Kind mit overflow:hidden automatisch auf Mindestbreite 0
            gesetzt wird. Chrome macht das zuverlässig, Firefox berechnet diese
            Mindestbreite bei einer reinen Style-Änderung (wie beim Ziehen des
            Spaltenkopfs) nicht immer neu — der Text blieb dann abgeschnitten,
            selbst wenn die Spalte längst breit genug war. min-w-0 macht die
            Mindestbreite explizit, statt sich auf diese Automatik zu
            verlassen. */}
        <span data-col-content={colKey} className="truncate min-w-0">
          {label}
        </span>
        {sortable && (
          <span
            className={`inline-flex items-center shrink-0 transition-colors ${
              active ? 'text-blue-600 font-bold dark:text-blue-400' : 'text-slate-300 opacity-60 group-hover/th:opacity-100'
            }`}
          >
            {active ? (
              direction === 'asc' ? <ArrowUp className="w-3.5 h-3.5" /> : <ArrowDown className="w-3.5 h-3.5" />
            ) : (
              <ArrowUpDown className="w-3 h-3" />
            )}
          </span>
        )}
      </div>

      {/* Ziehgriff zur Breitenanpassung — bewusst NICHT ziehbar für die
          Spalten-Umsortierung (draggable={false}), sonst würde ein Ziehen
          am Rand manchmal als Spalten-Verschieben statt als
          Breitenänderung gewertet. */}
      <div
        draggable={false}
        onPointerDown={onResizeStart}
        onClick={e => e.stopPropagation()}
        onDoubleClick={e => {
          e.stopPropagation();
          onAutoFit();
        }}
        title="Ziehen: Breite ändern · Doppelklick: automatisch an Inhalt anpassen"
        className="absolute top-0 right-0 h-full w-2.5 cursor-col-resize touch-none hover:bg-blue-400/40 active:bg-blue-500/50"
      />
    </th>
  );
};
