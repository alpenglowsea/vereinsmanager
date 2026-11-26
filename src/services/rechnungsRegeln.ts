/**
 * Regeln für Ausgangsrechnungen (P11, P12), nach dem Vorbild der
 * Android-Fassung (`Rechnung.kt`, `Rechnungen.kt`, `RechnungsLayout.kt`).
 * Ohne Datenbank und ohne PDF, damit sie sich prüfen lassen.
 */
import type { ClubInvoice, ClubSettings, InvoiceItem, PaymentMethod, TaxSphere, Transaction, TransactionSplit } from '../types';
import { SKR42_STRUCTURE } from '../data/taxSpheres';
import { istAusgabe } from './buchungsBerichte';

/** Hinweistext für Kleinunternehmer, wenn die Vorlage keinen eigenen hat (wie Android). */
export const KLEINUNTERNEHMER_HINWEIS = 'Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.';

const rund2 = (n: number) => Math.round(n * 100) / 100;
const cent = (n: number) => Math.round(n * 100);

/**
 * Menge aus der Eingabe: deutsche oder englische Schreibweise, bis zu drei
 * Nachkommastellen (D-49; vorher rundete der Desktop auf eine, aus 0,75 wurde
 * 0,8). null bei ungültiger Eingabe.
 */
export function parseMenge(eingabe: string | number): number | null {
  if (typeof eingabe === 'number') return Number.isFinite(eingabe) && eingabe >= 0 ? Math.round(eingabe * 1000) / 1000 : null;
  let t = eingabe.trim().replace(/\s/g, '');
  if (!t) return null;
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(t)) return null;
  return Math.round(Number(t) * 1000) / 1000;
}

/** Menge für die Anzeige: „0,75“, „1“, „2,5“. */
export function mengeText(menge: number): string {
  return (Math.round(menge * 1000) / 1000).toLocaleString('de-DE', { maximumFractionDigits: 3 });
}

export interface Summen {
  positionen: InvoiceItem[];
  subtotalNet: number;
  vatAmounts: { [rate: number]: number };
  totalVat: number;
  totalAmount: number;
}

/**
 * Rechnet die Positionen: Summe je Position auf Cent gerundet, Umsatzsteuer je
 * Satz aus der Nettosumme dieses Satzes (nicht je Position, damit sich
 * Rundungen nicht aufsummieren). Kleinunternehmer: jeder Satz 0 (D-05).
 */
export function berechneSummen(items: InvoiceItem[], kleinunternehmer: boolean): Summen {
  const positionen = items.map((it, i) => {
    const menge = parseMenge(it.quantity as number | string) ?? 1;
    const preis = rund2(Number(it.unitPrice) || 0);
    const vatRate = kleinunternehmer ? 0 : Number(it.vatRate) || 0;
    return { ...it, position: i + 1, quantity: menge, unitPrice: preis, vatRate, totalPrice: rund2(menge * preis) };
  });
  const nettoCent = positionen.reduce((s, p) => s + cent(p.totalPrice), 0);
  const vatAmounts: { [rate: number]: number } = {};
  const saetze = Array.from(new Set(positionen.map(p => p.vatRate))).sort((a, b) => a - b);
  for (const satz of saetze) {
    const n = positionen.filter(p => p.vatRate === satz).reduce((s, p) => s + cent(p.totalPrice), 0);
    vatAmounts[satz] = Math.round((n * satz) / 100) / 100;
  }
  const ustCent = Object.values(vatAmounts).reduce((s, v) => s + cent(v), 0);
  return {
    positionen,
    subtotalNet: nettoCent / 100,
    vatAmounts,
    totalVat: ustCent / 100,
    totalAmount: (nettoCent + ustCent) / 100
  };
}

/**
 * Inhalt des GiroCodes (EPC-QR, EPC069-12) oder null ohne IBAN bzw. Betrag.
 * Zeile 10 (strukturierte Referenz) bleibt leer, der Verwendungszweck steht in
 * Zeile 11 (D-51). Vorher stand die Rechnungsnummer in der Referenzzeile, die
 * Banking-Apps nur für genormte Referenzen (RF…) erwarten.
 */
export function giroCodeInhalt(settings: Pick<ClubSettings, 'creditorIban' | 'creditorBic' | 'clubName'>, brutto: number, verwendungszweck: string): string | null {
  const iban = (settings.creditorIban || '').replace(/\s+/g, '').toUpperCase();
  if (!iban || !(brutto > 0)) return null;
  const bic = (settings.creditorBic || '').replace(/\s+/g, '').toUpperCase();
  return ['BCD', '002', '1', 'SCT', bic, (settings.clubName || '').slice(0, 70), iban, `EUR${brutto.toFixed(2)}`, '', '', verwendungszweck.slice(0, 140)].join('\n');
}

/** Kontaktzeile für den Briefkopf (E10): Telefon, E-Mail, Webseite – nur, was eingetragen ist. */
export function kontaktZeile(settings: Pick<ClubSettings, 'phone' | 'email' | 'website'>): string {
  return [
    settings.phone?.trim() ? `Tel.: ${settings.phone.trim()}` : '',
    settings.email?.trim() || '',
    settings.website?.trim() || ''
  ]
    .filter(Boolean)
    .join(' • ');
}

// ---------------------------------------------------------------------------
// Zahlung und Buchung (P12)
// ---------------------------------------------------------------------------

export interface EinnahmeKonto {
  mainCategory: string;
  subCategory: string;
  skrAccount: string;
  /** Im Kontenrahmen ausgeblendet: nicht zur Auswahl anbieten (außer es ist schon gewählt). */
  ausgeblendet?: boolean;
}

/** Alle Einnahmekonten des Kontenrahmens (mit eigenen Konten) zur Auswahl. */
export function einnahmeKonten(): EinnahmeKonto[] {
  return SKR42_STRUCTURE.filter(m => m.type === 'income').flatMap(m =>
    m.subCategories.map(s => ({
      mainCategory: `${m.code} - ${m.name}`,
      subCategory: s.label,
      skrAccount: s.code,
      ausgeblendet: !!(m.ausgeblendet || s.ausgeblendet)
    }))
  );
}

/** Vorschlag für das Einnahmekonto je Sphäre (wie Android; änderbar). */
export function kontoVorschlag(sphere: TaxSphere | undefined): EinnahmeKonto | null {
  const code =
    sphere === 'ideell' ? '40890' : sphere === 'vermoegen' ? '46900' : sphere === 'zweckbetrieb' ? '41000' : '44000';
  return einnahmeKonten().find(k => k.skrAccount === code) ?? null;
}

export function rechnungsBuchungsText(r: Pick<ClubInvoice, 'invoiceNumber' | 'subject'>): string {
  return `Rechnung ${r.invoiceNumber}` + (r.subject?.trim() ? `: ${r.subject.trim()}` : '');
}

/** Name für Buchung und Listen: Firma, sonst Name. */
export function anzeigeName(r: Pick<ClubInvoice, 'recipientCompany' | 'recipientName'>): string {
  return (r.recipientCompany || '').trim() || (r.recipientName || '').trim();
}

/** Belegnummer = Rechnungsnummer; gibt es die schon, mit Zusatz -2, -3 … */
export function eindeutigeBelegNummer(basis: string, vergeben: Iterable<string>): string {
  const belegt = new Set(Array.from(vergeben, v => (v || '').trim()));
  if (!belegt.has(basis)) return basis;
  let n = 2;
  while (belegt.has(`${basis}-${n}`)) n++;
  return `${basis}-${n}`;
}

export interface BezahltAngaben {
  datum: string;
  zahlart: PaymentMethod;
  buchungAnlegen: boolean;
  kontoId: string;
  konto: EinnahmeKonto | null;
}

/** Fehlertext zu den Angaben beim Bezahlen, oder null. */
export function pruefeBezahlt(r: ClubInvoice, a: BezahltAngaben): string | null {
  if (r.status === 'cancelled') return 'Eine stornierte Rechnung kann nicht bezahlt werden.';
  if (!a.datum) return 'Bitte das Zahldatum eingeben.';
  if (a.buchungAnlegen && !a.kontoId) return 'Bitte das Konto wählen, auf dem das Geld eingegangen ist.';
  if (a.buchungAnlegen && !a.konto) return 'Bitte das Einnahmekonto (Kontenrahmen) wählen.';
  return null;
}

/**
 * Die Einnahmebuchung zur bezahlten Rechnung (D-01): Bruttobetrag; bei
 * mehreren Steuersätzen aufgeteilt je Satz (wie Android).
 */
export function rechnungsBuchung(
  r: ClubInvoice,
  a: BezahltAngaben,
  vorhandeneBelegNummern: Iterable<string>,
  jetzt: string,
  id: string
): Transaction {
  const k = a.konto!;
  const sphere: TaxSphere = r.taxSphere || 'wirtschaftlich';
  const text = rechnungsBuchungsText(r);
  const saetze = Array.from(new Set(r.items.map(p => (Number(p.vatRate) || 0) as 0 | 7 | 19))).sort((x, y) => x - y);
  const splits: TransactionSplit[] =
    saetze.length > 1
      ? saetze.map((satz, i) => {
          const nettoCent = r.items.filter(p => (Number(p.vatRate) || 0) === satz).reduce((s, p) => s + cent(p.totalPrice), 0);
          const bruttoCent = nettoCent + Math.round((nettoCent * satz) / 100);
          return {
            id: `split-${id}-${i + 1}`,
            amount: bruttoCent / 100,
            bookingText: `${text} (${satz} % USt)`,
            sphere,
            mainCategory: k.mainCategory,
            subCategory: k.subCategory,
            skrAccount: k.skrAccount,
            category: k.subCategory,
            vatRate: satz
          };
        })
      : [];
  return {
    id,
    date: a.datum,
    amount: rund2(r.totalAmount),
    type: 'income',
    accountId: a.kontoId,
    documentNumber: eindeutigeBelegNummer(r.invoiceNumber, vorhandeneBelegNummern),
    bookingText: text,
    partner: anzeigeName(r),
    sphere,
    mainCategory: k.mainCategory,
    subCategory: k.subCategory,
    skrAccount: k.skrAccount,
    category: k.subCategory,
    vatRate: saetze.length === 1 ? saetze[0] : 0,
    ...(splits.length > 0 ? { isSplit: true, splits } : {}),
    notes: `Zahlung der Rechnung ${r.invoiceNumber}`,
    createdAt: jetzt,
    updatedAt: jetzt
  };
}

/** Weicht der Betrag der Buchung vom Rechnungsbetrag ab? */
export function buchungWeichtAb(r: Pick<ClubInvoice, 'totalAmount'>, b: Pick<Transaction, 'amount'>): boolean {
  return cent(Math.abs(b.amount)) !== cent(r.totalAmount);
}

/**
 * Buchung an Betrag und Empfänger der Rechnung angleichen. Eine Aufteilung
 * passt danach nicht mehr zum Betrag und wird aufgehoben (wie Android).
 */
export function gleicheBuchungAn(b: Transaction, r: ClubInvoice, jetzt: string): Transaction {
  const saetze = Array.from(new Set(r.items.map(p => (Number(p.vatRate) || 0) as 0 | 7 | 19)));
  const neu: Transaction = {
    ...b,
    amount: istAusgabe(b) ? -rund2(r.totalAmount) : rund2(r.totalAmount),
    partner: anzeigeName(r),
    bookingText: rechnungsBuchungsText(r),
    vatRate: saetze.length === 1 ? saetze[0] : 0,
    isSplit: false,
    updatedAt: jetzt
  };
  delete neu.splits;
  return neu;
}

/** Ist die Rechnung offen und das Fälligkeitsdatum vorbei? (`heute` als JJJJ-MM-TT, Ortszeit) */
export function istUeberfaellig(r: Pick<ClubInvoice, 'status' | 'dueDate'>, heute: string): boolean {
  return r.status === 'open' && Boolean(r.dueDate) && r.dueDate < heute;
}
