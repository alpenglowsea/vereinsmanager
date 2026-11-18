/**
 * Regeln der Sammelbearbeitung von Buchungen (D-30), wie in der
 * Android-Fassung (`BuchungSammelStore`).
 *
 *  - **Umbuchungen und aufgeteilte Buchungen** haben keine einheitliche
 *    Zuordnung: Bei einer Umbuchung gibt es keine Sphäre und kein
 *    Sachkonto, bei einer aufgeteilten Buchung hat jeder Teil seine eigene.
 *    Sphäre, Sparte, Konto des Kontenrahmens und Umsatzsteuer werden dort
 *    deshalb NICHT geändert. Vorher wurden sie überschrieben, und die Teile
 *    passten nicht mehr zur Buchung.
 *  - **Konto (Bank/Kasse) einer Umbuchung**: Wäre das neue Konto zugleich
 *    ihr Zielkonto, liefe die Umbuchung von einem Konto auf dasselbe. Dann
 *    bleibt ihr Konto, wie es ist.
 *  - Alles andere (Zahlungspartner, Datum, Notiz) gilt für alle Buchungen.
 *
 * Die Funktion verändert nichts, sie liefert die geänderte Kopie und sagt,
 * was übersprungen wurde.
 */
import type { Transaction, TransactionBulkUpdates } from '../types';

export interface SammelErgebnis {
  buchung: Transaction;
  geaendert: boolean;
  /** Sphäre/Sparte/Konto/USt gewünscht, aber übersprungen (Umbuchung oder aufgeteilt). */
  ohneZuordnung: boolean;
  /** Kontowechsel übersprungen, weil die Umbuchung sonst auf sich selbst liefe. */
  kontoUebersprungen: boolean;
}

export interface SammelBericht {
  geaendert: number;
  ohneZuordnung: number;
  kontoUebersprungen: number;
}

export function wendeSammelAn(tx: Transaction, u: TransactionBulkUpdates): SammelErgebnis {
  const neu: Transaction = { ...tx };
  let geaendert = false;
  const setze = <K extends keyof Transaction>(feld: K, wert: Transaction[K]) => {
    if (neu[feld] !== wert) {
      neu[feld] = wert;
      geaendert = true;
    }
  };

  const umbuchung = tx.type === 'transfer';
  const aufgeteilt = Boolean(tx.isSplit && tx.splits && tx.splits.length > 0);

  let kontoUebersprungen = false;
  if (u.accountId !== undefined) {
    if (umbuchung && tx.targetAccountId === u.accountId) kontoUebersprungen = true;
    else setze('accountId', u.accountId);
  }

  const zuordnungGewuenscht =
    u.sphere !== undefined ||
    u.department !== undefined ||
    u.mainCategory !== undefined ||
    u.subCategory !== undefined ||
    u.category !== undefined ||
    u.skrAccount !== undefined ||
    u.vatRate !== undefined;
  const ohneZuordnung = zuordnungGewuenscht && (umbuchung || aufgeteilt);

  if (zuordnungGewuenscht && !ohneZuordnung) {
    if (u.sphere !== undefined) setze('sphere', u.sphere);
    if (u.department !== undefined) setze('department', u.department === '' ? undefined : u.department);
    if (u.mainCategory !== undefined) setze('mainCategory', u.mainCategory);
    if (u.subCategory !== undefined) setze('subCategory', u.subCategory);
    if (u.category !== undefined) setze('category', u.category);
    if (u.skrAccount !== undefined) setze('skrAccount', u.skrAccount);
    if (u.vatRate !== undefined) setze('vatRate', u.vatRate);
  }

  if (u.partner !== undefined && u.partner.trim()) setze('partner', u.partner.trim());
  if (u.date !== undefined && u.date) setze('date', u.date);
  if (u.notesAction === 'replace') {
    setze('notes', u.notesValue || '');
  } else if (u.notesAction === 'append' && u.notesValue && u.notesValue.trim()) {
    const zusatz = u.notesValue.trim();
    setze('notes', tx.notes ? `${tx.notes}\n${zusatz}` : zusatz);
  }

  return { buchung: neu, geaendert, ohneZuordnung, kontoUebersprungen };
}

/** Meldung für die Oberfläche, wenn etwas übersprungen wurde; sonst null. */
export function sammelHinweis(b: SammelBericht): string | null {
  const teile: string[] = [];
  if (b.ohneZuordnung > 0) {
    teile.push(
      `Bei ${b.ohneZuordnung === 1 ? 'einer Buchung' : `${b.ohneZuordnung} Buchungen`} (Umbuchung oder aufgeteilte Buchung) wurden Sphäre, Sparte, Konto des Kontenrahmens und Umsatzsteuer nicht geändert, weil sie dort keine einheitliche Zuordnung haben. Diese Buchungen bitte einzeln bearbeiten.`
    );
  }
  if (b.kontoUebersprungen > 0) {
    teile.push(
      `Bei ${b.kontoUebersprungen === 1 ? 'einer Umbuchung' : `${b.kontoUebersprungen} Umbuchungen`} blieb das Konto unverändert, weil sie sonst von einem Konto auf dasselbe Konto liefe${b.kontoUebersprungen === 1 ? '' : 'n'}.`
    );
  }
  return teile.length > 0 ? teile.join(' ') : null;
}
