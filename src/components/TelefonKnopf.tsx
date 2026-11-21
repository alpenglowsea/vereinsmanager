/**
 * Telefonnummer, die sich mit einem Klick in die Zwischenablage kopieren lässt
 * (D-63, Entscheidung E9). Ein `tel:`-Link tut am Rechner je nach System
 * nichts oder öffnet irgendein Programm; kopiert kann man die Nummer ins
 * Telefon, in Teams oder WhatsApp Web übernehmen.
 */
import React, { useState } from 'react';

export const TelefonKnopf: React.FC<{ nummer: string; className?: string; children?: React.ReactNode }> = ({
  nummer,
  className,
  children
}) => {
  const [meldung, setMeldung] = useState<string | null>(null);
  return (
    <button
      type="button"
      title="Klicken: Nummer in die Zwischenablage kopieren"
      onClick={async e => {
        // In Listen öffnet ein Klick auf die Zeile sonst die Details
        e.stopPropagation();
        try {
          await navigator.clipboard.writeText(nummer);
          setMeldung('kopiert');
        } catch {
          setMeldung('nicht kopiert');
        }
        setTimeout(() => setMeldung(null), 2000);
      }}
      className={`${className || ''} cursor-pointer text-left`}
    >
      {children ?? nummer}
      {meldung && <span className="ml-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">({meldung})</span>}
    </button>
  );
};
