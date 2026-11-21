/**
 * Zeigt die Rückfragen und Mitteilungen aus `src/utils/dialoge.ts` an, jeweils
 * die erste offene. Steht einmal in `main.tsx`, damit es in allen Ansichten gilt.
 */
import React, { useEffect, useState } from 'react';
import { BestaetigungsDialog } from './BestaetigungsDialog';
import { abonniere, beantworte, ersteAnfrage } from '../utils/dialoge';

export const DialogHost: React.FC = () => {
  const [, neuZeichnen] = useState(0);
  useEffect(() => abonniere(() => neuZeichnen(n => n + 1)), []);
  const a = ersteAnfrage();
  if (!a) return null;
  const o = a.optionen;
  return (
    <div className="relative z-[70]">
      <BestaetigungsDialog
        key={a.nr}
        titel={o.titel || (a.nurHinweis ? 'Hinweis' : 'Bitte bestätigen')}
        text={o.text}
        bestaetigenText={o.bestaetigenText || (a.nurHinweis ? 'OK' : 'Ja')}
        abbrechenText={a.nurHinweis ? null : o.abbrechenText || 'Abbrechen'}
        gefahr={o.gefahr}
        alternativText={o.alternativText}
        onAlternative={o.alternativText ? () => beantworte(a, 'alternative') : undefined}
        onBestaetigen={() => beantworte(a, true)}
        onAbbrechen={() => beantworte(a, false)}
      />
    </div>
  );
};
