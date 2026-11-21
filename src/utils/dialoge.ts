/**
 * Rückfragen und Mitteilungen im Stil der App statt `window.confirm()` und
 * `window.alert()` (D-147, auf alle Stellen der App ausgeweitet).
 *
 * Die Browser-Fenster sehen in jedem Browser anders aus, blockieren die ganze
 * Anwendung und lassen sich in manchen Umgebungen unterdrücken. `frage()` und
 * `melde()` lassen sich auch aus Code aufrufen, der selbst nichts zeichnet
 * (z. B. `fileExportHelper`). Angezeigt werden sie von `<DialogHost />`
 * (src/components/DialogHost.tsx), das einmal in `main.tsx` steht.
 */
import type { ReactNode } from 'react';

export interface FrageOptionen {
  titel?: string;
  text: ReactNode;
  bestaetigenText?: string;
  abbrechenText?: string;
  /** Roter Knopf für Löschen und Ähnliches. */
  gefahr?: boolean;
  /** Dritter Knopf (nur über `frageDreifach`). */
  alternativText?: string;
}

export type Antwort = boolean | 'alternative';

export interface Anfrage {
  nr: number;
  optionen: FrageOptionen;
  nurHinweis: boolean;
  erledigt: (a: Antwort) => void;
}

let schlange: Anfrage[] = [];
let zaehler = 0;
const zuhoerer = new Set<() => void>();
const benachrichtigen = () => zuhoerer.forEach(z => z());

function stelle(optionen: FrageOptionen, nurHinweis: boolean): Promise<Antwort> {
  return new Promise(resolve => {
    schlange = [...schlange, { nr: ++zaehler, optionen, nurHinweis, erledigt: resolve }];
    benachrichtigen();
  });
}

/** Rückfrage; `true` bei Bestätigen, `false` bei Abbrechen. */
export async function frage(optionen: FrageOptionen): Promise<boolean> {
  return (await stelle(optionen, false)) === true;
}

/** Rückfrage mit drittem Knopf. */
export async function frageDreifach(optionen: FrageOptionen & { alternativText: string }): Promise<'ja' | 'alternative' | 'nein'> {
  const a = await stelle(optionen, false);
  return a === 'alternative' ? 'alternative' : a ? 'ja' : 'nein';
}

/** Mitteilung mit einem Knopf „OK“. */
export async function melde(text: ReactNode, titel = 'Hinweis'): Promise<void> {
  await stelle({ titel, text, bestaetigenText: 'OK' }, true);
}

// ---- für DialogHost ----

export const ersteAnfrage = (): Anfrage | undefined => schlange[0];

export function beantworte(a: Anfrage, antwort: Antwort) {
  schlange = schlange.filter(x => x !== a);
  benachrichtigen();
  a.erledigt(antwort);
}

export function abonniere(z: () => void): () => void {
  zuhoerer.add(z);
  return () => {
    zuhoerer.delete(z);
  };
}

/**
 * Kurzform für die bisherigen `confirm()`-Rückfragen: roter Knopf, dessen
 * Aufschrift sich nach dem Text richtet („Löschen“, „Entfernen“ …).
 */
export function bestaetige(text: string, titel = 'Bitte bestätigen'): Promise<boolean> {
  const t = text.toLowerCase();
  const knopf = t.includes('lösch') ? 'Löschen' : t.includes('entfern') ? 'Entfernen' : t.includes('zurücksetz') ? 'Zurücksetzen' : 'Ja';
  return frage({ titel, text, bestaetigenText: knopf, gefahr: knopf !== 'Ja' });
}
