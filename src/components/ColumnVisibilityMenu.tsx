import React, { useEffect, useRef } from 'react';
import { Check } from 'lucide-react';

export interface ColumnMenuItem {
  key: string;
  label: string;
}

interface ColumnVisibilityMenuProps {
  /** Bildschirmposition (z.B. aus dem contextmenu-Event: e.clientX/clientY),
   *  an der das Menü erscheinen soll. */
  position: { x: number; y: number };
  /** Alle wählbaren Spalten dieser Tabelle, in Anzeige-Reihenfolge. */
  columns: ColumnMenuItem[];
  /** Schlüssel der aktuell ausgeblendeten Spalten. */
  hidden: Set<string>;
  /** Wird mit dem Schlüssel einer Spalte gerufen, wenn sie an-/abgehakt
   *  wird. */
  onToggle: (key: string) => void;
  onClose: () => void;
}

/**
 * Rechtsklick-Kontextmenü auf einem Spaltenkopf: Liste aller verfügbaren
 * Spalten dieser Tabelle mit Kontrollkästchen — angehakt = sichtbar,
 * abgehakt = ausgeblendet. Nichts wird dabei gelöscht, nur die Anzeige
 * geändert; die Reihenfolge (useColumnOrder) bleibt davon unberührt.
 *
 * Schließt sich beim Klick irgendwo außerhalb, bei Escape, oder wenn die
 * Seite wegscrollt (das Menü ist an Bildschirmkoordinaten fixiert, nicht an
 * die Tabelle gebunden — bei einem eigenen Scroll-Bereich pro Tabelle würde
 * es sonst an der falschen Stelle "kleben").
 *
 * Mindestens eine Spalte muss sichtbar bleiben — die letzte sichtbare
 * Spalte lässt sich nicht mehr abwählen (das Kästchen ist dann deaktiviert),
 * damit nie eine komplett leere Tabelle entsteht.
 */
export const ColumnVisibilityMenu: React.FC<ColumnVisibilityMenuProps> = ({
  position,
  columns,
  hidden,
  onToggle,
  onClose
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const visibleCount = columns.length - hidden.size;

  useEffect(() => {
    const handlePointerDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const handleScroll = (e: Event) => {
      // Das Menü hat bei vielen Spalten selbst eine Bildlaufleiste
      // (overflow-y-auto, s.u.) — scrollt der Nutzer INNERHALB dieser Liste,
      // ist das ein ganz normales Scroll-Ereignis auf dem Menü selbst, aber
      // es erreicht denselben, hier auf dem window sitzenden Erfassungs-
      // Listener (capture:true fängt es auf dem Weg nach unten ab, auch wenn
      // ein reines "scroll"-Ereignis anders als z.B. "click" gar nicht bis
      // zum window aufsteigen würde). Ohne diese Prüfung schloss genau das
      // Scrollen in der eigenen Liste das Menü sofort wieder. Nur ein
      // Scrollen AUSSERHALB des Menüs (die Seite oder eine Tabelle darunter)
      // soll es weiterhin schließen.
      if (ref.current && e.target instanceof Node && ref.current.contains(e.target)) {
        return;
      }
      onClose();
    };

    // Die Listener werden ABSICHTLICH nicht sofort, sondern erst einen Tick
    // später angemeldet (setTimeout 0), statt schon hier direkt in diesem
    // Effekt. Grund: Dieser Effekt läuft, weil das Menü gerade durch einen
    // Rechtsklick geöffnet wurde — React verarbeitet den dazugehörigen
    // Zustandswechsel dabei noch WÄHREND genau dieses einen Rechtsklick-
    // Ereignisses. Würde der 'contextmenu'-Listener hier sofort angemeldet,
    // hätte er die Chance, dasselbe, noch gar nicht fertig verarbeitete
    // Rechtsklick-Ereignis (das das Menü überhaupt erst geöffnet hat) selbst
    // abzufangen — sein Ziel liegt außerhalb des Menüs (es ist ja der
    // Spaltenkopf, auf den geklickt wurde), also würde `onClose()` sofort
    // wieder aufgerufen. Das Menü ging dadurch quasi im selben Augenblick
    // wieder zu, in dem es aufging — sichtbar war davon nichts, es wirkte
    // nur so, als würde der Rechtsklick gar nichts tun. Mit der Verzögerung
    // sind die Listener erst ab dem NÄCHSTEN Ereignis aktiv, nie für das
    // öffnende selbst.
    const timer = setTimeout(() => {
      // 'click' statt 'mousedown', damit ein Linksklick erst beim Loslassen
      // zählt (sonst würde z.B. ein Klick-und-Ziehen das Menü vorzeitig
      // schließen).
      document.addEventListener('click', handlePointerDown);
      document.addEventListener('contextmenu', handlePointerDown);
      document.addEventListener('keydown', handleKeyDown);
      // capture:true, damit auch das Scrollen INNERHALB einer Tabelle
      // (eigener Scroll-Bereich, kein Bubble bis zum window) erkannt wird.
      window.addEventListener('scroll', handleScroll, true);
    }, 0);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', handlePointerDown);
      document.removeEventListener('contextmenu', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [onClose]);

  // Nahe am rechten/unteren Bildschirmrand ins Sichtbare rücken, statt
  // abgeschnitten zu werden.
  const style: React.CSSProperties = {
    position: 'fixed',
    top: Math.min(position.y, window.innerHeight - Math.min(columns.length * 34 + 60, 420)),
    left: Math.min(position.x, window.innerWidth - 260)
  };

  return (
    <div
      ref={ref}
      style={style}
      className="z-50 w-64 max-h-[70vh] overflow-y-auto bg-white rounded-xl border border-slate-200 shadow-2xl py-1.5 dark:bg-slate-900 dark:border-slate-800"
    >
      <div className="px-3 py-1.5 text-3xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 mb-1 dark:border-slate-800">
        Spalten ein-/ausblenden
      </div>
      {columns.map(col => {
        const isHidden = hidden.has(col.key);
        const isLastVisible = !isHidden && visibleCount <= 1;
        return (
          <button
            key={col.key}
            type="button"
            disabled={isLastVisible}
            onClick={() => onToggle(col.key)}
            title={isLastVisible ? 'Mindestens eine Spalte muss sichtbar bleiben' : undefined}
            className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left transition-colors ${
              isLastVisible ? 'text-slate-300 cursor-not-allowed' : 'text-slate-700 hover:bg-slate-50 cursor-pointer dark:text-slate-200 dark:hover:bg-slate-800'
            }`}
          >
            <span
              className={`shrink-0 w-4 h-4 rounded border flex items-center justify-center ${
                isHidden ? 'border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-800' : 'border-blue-600 bg-blue-600'
              }`}
            >
              {!isHidden && <Check className="w-3 h-3 text-white" />}
            </span>
            <span className="truncate">{col.label}</span>
          </button>
        );
      })}
    </div>
  );
};
