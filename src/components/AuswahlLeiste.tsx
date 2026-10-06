import React from 'react';

interface AuswahlLeisteProps {
  /** Wie viele Einträge insgesamt ausgewählt sind (über alle Seiten). */
  anzahlAusgewaehlt: number;
  /** Zeilen auf der aktuellen Seite. */
  anzahlAufSeite: number;
  /** Alle Einträge, die zur aktuellen Suche/Filterung passen. */
  anzahlGefiltert: number;
  seiteKomplett: boolean;
  allesKomplett: boolean;
  /** z. B. „Mitglied" / „Mitglieder" */
  einzahl: string;
  mehrzahl: string;
  onAlleAuswaehlen: () => void;
  onAuswahlAufheben: () => void;
}

/**
 * Leiste über der Tabelle, sobald etwas ausgewählt ist. Zeigt, wie viele
 * Einträge ausgewählt sind, und bietet — wenn die Tabelle mehr Einträge hat,
 * als auf eine Seite passen — den Knopf zum Auswählen ALLER Einträge an.
 */
export const AuswahlLeiste: React.FC<AuswahlLeisteProps> = ({
  anzahlAusgewaehlt,
  anzahlAufSeite,
  anzahlGefiltert,
  seiteKomplett,
  allesKomplett,
  einzahl,
  mehrzahl,
  onAlleAuswaehlen,
  onAuswahlAufheben,
}) => {
  if (anzahlAusgewaehlt === 0) return null;

  const mehrereSeiten = anzahlGefiltert > anzahlAufSeite;
  const nomen = anzahlAusgewaehlt === 1 ? einzahl : mehrzahl;

  let text: React.ReactNode = (
    <>
      {anzahlAusgewaehlt} {nomen} ausgewählt
    </>
  );
  let angebot: React.ReactNode = null;

  if (mehrereSeiten && allesKomplett) {
    text = <>Alle {anzahlGefiltert} {mehrzahl} der Tabelle sind ausgewählt.</>;
  } else if (mehrereSeiten && seiteKomplett) {
    text = (
      <>
        {anzahlAusgewaehlt} {nomen} ausgewählt — alle {anzahlAufSeite} Einträge dieser Seite sind dabei.
      </>
    );
    angebot = (
      <button
        type="button"
        onClick={onAlleAuswaehlen}
        className="text-blue-700 hover:text-blue-900 underline font-semibold cursor-pointer text-xs"
      >
        Alle {anzahlGefiltert} {mehrzahl} der Tabelle auswählen
      </button>
    );
  }

  return (
    <div
      className="px-6 py-2 bg-blue-50/70 border-b border-blue-100 text-xs text-blue-800 flex flex-wrap items-center justify-between gap-x-4 gap-y-1"
      role="status"
    >
      <span className="font-semibold">
        {text} {angebot}
      </span>
      <button
        type="button"
        onClick={onAuswahlAufheben}
        className="text-blue-600 hover:text-blue-800 hover:underline font-semibold cursor-pointer text-xs"
      >
        Auswahl aufheben
      </button>
    </div>
  );
};
