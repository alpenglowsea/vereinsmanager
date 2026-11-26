/**
 * Einnahmebuchung zu einer Zuwendungsbestätigung (D-10, D-38, D-39).
 *
 * Wie die Android-Fassung (`Spenden.kt`): Konto 40450 „Geldspenden (mit
 * Zuwendungsbestätigung)“ im Nummernkreis 40400, ideeller Bereich, ohne
 * Umsatzsteuer, Belegnummer `SP-<Jahr>-<letzte drei Ziffern der Bestätigung>`,
 * bei Kollision mit Zusatz -2, -3 … Vorher stand nur die Kategorie „Spenden /
 * Schenkungen“ an der Buchung, ohne Konto; die Finanz-Auswertung sucht aber
 * nach dem Nummernkreis 40400 und zählte solche Spenden als gewöhnliche
 * Einnahmen. Die Belegnummer nahm bei fehlenden Ziffern eine Zufallszahl.
 */
import type { DonationReceipt, Transaction } from '../types';
import { SKR42_STRUCTURE } from '../data/taxSpheres';
import { istAusgabe } from './buchungsBerichte';
import { kontoText, standardKonto } from '../utils/kontenrahmen';

/** Ursprüngliche Nummer; hat der Verein das Konto umnummeriert, wird auf die neue gebucht (`standardKonto`). */
export const SPENDEN_KONTO_CODE = '40450';

/** Nummernkreis, Konto und Kontonummer aus dem Kontenrahmen. */
export function spendenKonto(): { mainCategory: string; subCategory: string; skrAccount: string } {
  const k = standardKonto(SPENDEN_KONTO_CODE, SKR42_STRUCTURE);
  return {
    mainCategory: k ? kontoText(k.main.code, k.main.name) : '',
    subCategory: k?.sub.label || '',
    skrAccount: k?.sub.code ?? SPENDEN_KONTO_CODE
  };
}

export function spendenBuchungsText(r: Pick<DonationReceipt, 'donorName' | 'receiptNumber'>): string {
  return `Spende / Zuwendung: ${r.donorName.trim()} (${r.receiptNumber.trim()})`;
}

/** „SP-2026-004“; gibt es die schon, „SP-2026-004-2“ usw. */
export function spendenBelegNummer(datum: string, bestaetigungsNummer: string, vergeben: Iterable<string>): string {
  const jahr = /^\d{4}/.test(datum) ? datum.slice(0, 4) : String(new Date().getFullYear());
  const ziffern = bestaetigungsNummer.replace(/\D/g, '').slice(-3) || '000';
  const grund = `SP-${jahr}-${ziffern}`;
  const belegt = new Set(Array.from(vergeben, v => (v || '').trim()));
  let nr = grund;
  let n = 2;
  while (belegt.has(nr)) nr = `${grund}-${n++}`;
  return nr;
}

/** Die neue Einnahmebuchung zu einer Geldspende. */
export function spendenBuchung(
  r: DonationReceipt,
  kontoId: string,
  vorhandeneBelegNummern: Iterable<string>,
  jetzt: string,
  id: string
): Transaction {
  const k = spendenKonto();
  return {
    id,
    date: r.date,
    amount: Math.round(r.amount * 100) / 100,
    type: 'income',
    accountId: kontoId,
    documentNumber: spendenBelegNummer(r.date, r.receiptNumber, vorhandeneBelegNummern),
    bookingText: spendenBuchungsText(r),
    partner: r.donorName.trim(),
    sphere: 'ideell',
    mainCategory: k.mainCategory,
    subCategory: k.subCategory,
    skrAccount: k.skrAccount,
    category: k.subCategory,
    vatRate: 0,
    notes: `Zuwendungsbestätigung ${r.receiptNumber} nach amtl. BMF-Muster. ${r.notes || ''}`.trim(),
    createdAt: jetzt,
    updatedAt: jetzt
  };
}

/** Stehen in der Buchung andere Werte für Betrag, Datum oder Name als in der Bestätigung? */
export function buchungWeichtAb(r: Pick<DonationReceipt, 'amount' | 'date' | 'donorName'>, b: Transaction): boolean {
  return (
    Math.round(Math.abs(b.amount) * 100) !== Math.round(r.amount * 100) ||
    b.date !== r.date ||
    (b.partner || '').trim() !== r.donorName.trim()
  );
}

/** Die Buchung an Betrag, Datum und Name der Bestätigung angleichen; Vorzeichen und alles andere bleiben. */
export function gleicheBuchungAn(b: Transaction, r: DonationReceipt, jetzt: string): Transaction {
  const betrag = Math.round(r.amount * 100) / 100;
  return {
    ...b,
    date: r.date,
    amount: istAusgabe(b) ? -betrag : betrag,
    partner: r.donorName.trim(),
    bookingText: spendenBuchungsText(r),
    updatedAt: jetzt
  };
}
