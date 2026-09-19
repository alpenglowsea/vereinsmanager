import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingStateProps {
  /** Was gerade geladen wird. Konkret formulieren, nicht nur "Lädt …". */
  label?: string;
  /** Zusätzliche Klassen, etwa für die Höhe des Bereichs. */
  className?: string;
}

/**
 * Anzeige für "wird gerade geladen".
 *
 * Hintergrund: An sechs Stellen wurde ein Ladezustand gesetzt, aber nirgends
 * angezeigt — die Maske stand während des Ladens einfach still. Auf einem
 * flotten Rechner mit lokalen Daten fällt das nicht auf; auf einem älteren
 * Vereinsrechner oder über eine wacklige Verbindung sieht es aus, als sei
 * die Anwendung abgestürzt. Die übliche Reaktion darauf ist, mehrfach zu
 * klicken — und genau das löst dann die Probleme aus, die es vorher nicht
 * gab.
 *
 * "role=status" mit "aria-live=polite" sorgt dafür, dass auch ein
 * Vorleseprogramm die Meldung ausgibt, statt den Anwender im Ungewissen zu
 * lassen.
 *
 * "motion-safe:" schaltet die Drehung ab, wenn im Betriebssystem
 * "Bewegung reduzieren" eingestellt ist. Für Menschen, die auf Bewegung
 * empfindlich reagieren, ist ein dauerhaft drehendes Element unangenehm;
 * der Text allein sagt dasselbe.
 */
export const LoadingState: React.FC<LoadingStateProps> = ({
  label = 'Wird geladen …',
  className = ''
}) => (
  <div
    role="status"
    aria-live="polite"
    className={`flex flex-col items-center justify-center gap-3 py-12 text-slate-500 dark:text-slate-400 ${className}`}
  >
    <Loader2 className="w-6 h-6 motion-safe:animate-spin" aria-hidden="true" />
    <span className="text-sm font-medium">{label}</span>
  </div>
);
