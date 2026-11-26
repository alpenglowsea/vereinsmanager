/**
 * Regeln für Kontakte (P16), wie die Android-Fassung (`kontakte-1`).
 */
import type { ClubContact, ContactType, Skr42MainCategory, Skr42SubCategory, TaxSphere, Transaction } from '../types';
import { SKR42_STRUCTURE } from '../data/taxSpheres';
import { istAusgabe, istUmbuchung } from '../services/buchungsBerichte';
import { standardKonto } from './kontenrahmen';

const klein = (s: string | undefined | null) => (s || '').toLowerCase().trim();
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Gehört die Buchung zum Kontakt? Nur bei genau gleichem Namen (Anzeigename
 * oder Firma, ohne Rücksicht auf Groß-/Kleinschreibung) oder über die
 * Kontaktnummer (als Zahlungspartner oder als ganzes Wort in Buchungstext
 * oder Notiz). Vorher genügte ein Teiltreffer: „Müller“ fand auch „Müller
 * Bau GmbH“ und „Frau Müller“ (D-55).
 */
export function gehoertZuKontakt(t: Pick<Transaction, 'partner' | 'bookingText' | 'notes'>, k: Pick<ClubContact, 'displayName' | 'companyName' | 'contactNumber'>): boolean {
  const p = klein(t.partner);
  const namen = [klein(k.displayName), klein(k.companyName)].filter(Boolean);
  if (p && namen.includes(p)) return true;
  const nr = klein(k.contactNumber);
  if (!nr) return false;
  if (p === nr) return true;
  const wort = new RegExp(`(^|[^\\p{L}\\p{N}-])${escape(nr)}($|[^\\p{L}\\p{N}-])`, 'u');
  return wort.test(klein(t.bookingText)) || wort.test(klein(t.notes));
}

/**
 * Buchungen eines Kontakts: Summen über alle (vorher nur über die ersten
 * zehn, D-54), die Liste mit den neuesten zehn. Umbuchungen zählen weder als
 * Einnahme noch als Ausgabe.
 */
export function kontaktBuchungen(k: Pick<ClubContact, 'displayName' | 'companyName' | 'contactNumber'>, alle: Transaction[]) {
  const passend = alle.filter(t => gehoertZuKontakt(t, k));
  let einnahmenCent = 0;
  let ausgabenCent = 0;
  for (const t of passend) {
    if (istUmbuchung(t)) continue;
    const c = Math.round(Math.abs(t.amount || 0) * 100);
    if (istAusgabe(t)) ausgabenCent += c;
    else einnahmenCent += c;
  }
  const neueste = [...passend].sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 10);
  return { anzahl: passend.length, neueste, einnahmen: einnahmenCent / 100, ausgaben: ausgabenCent / 100 };
}

/** IBAN nach ISO 13616 (Prüfziffer Modulo 97); null = gültig oder leer. */
export function ibanFehler(eingabe: string): string | null {
  const iban = (eingabe || '').replace(/\s+/g, '').toUpperCase();
  if (!iban) return null;
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)) return 'Die IBAN hat nicht die richtige Form (z. B. DE89 3704 0044 0532 0130 00).';
  if (iban.startsWith('DE') && iban.length !== 22) return 'Eine deutsche IBAN hat 22 Zeichen.';
  const umgestellt = iban.slice(4) + iban.slice(0, 4);
  let rest = 0;
  for (const z of umgestellt) {
    const wert = /\d/.test(z) ? z : String(z.charCodeAt(0) - 55);
    for (const ziffer of wert) rest = (rest * 10 + Number(ziffer)) % 97;
  }
  return rest === 1 ? null : 'Die Prüfziffer der IBAN stimmt nicht (Tippfehler?).';
}

/** BIC mit 8 oder 11 Zeichen; null = gültig oder leer. */
export function bicFehler(eingabe: string): string | null {
  const bic = (eingabe || '').replace(/\s+/g, '').toUpperCase();
  if (!bic) return null;
  return /^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(bic) ? null : 'Die BIC hat 8 oder 11 Zeichen (z. B. COBADEFFXXX).';
}

/** E-Mail in Grundform; null = gültig oder leer. */
export function emailFehler(eingabe: string): string | null {
  const e = (eingabe || '').trim();
  if (!e) return null;
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e) ? null : 'Die E-Mail-Adresse sieht nicht richtig aus.';
}

/** Was beim Wählen eines Kontakts in einer Einnahme vorbelegt wird (C5, wie Android `BuchungRegeln.vorbelegung`). */
export interface KontaktVorbelegung {
  sphere: TaxSphere;
  mainId: string;
  mainCategory: string;
  subCategory: string;
  skrAccount: string;
  vatRate: Skr42SubCategory['vatRateDefault'];
}

/**
 * Spender → ideeller Bereich, Konto 40400 „Spenden & Zuwendungen allgemein“;
 * Sponsor → wirtschaftlicher Geschäftsbetrieb, Konto 44000 „Sponsoring &
 * Werbung allgemein“. Ist der Kontakt beides, gilt Spender. Nur bei
 * Einnahmen; sonst null. Vorher trug das Formular Namen ein, die es im
 * Kontenrahmen nicht gibt („Spenden und Zuwendungen“); die Finanz-Auswertung
 * zählte solche Spenden deshalb nicht als Spenden.
 */
export function kontaktVorbelegung(
  types: ContactType[] | undefined,
  art: Transaction['type'],
  skr: readonly Skr42MainCategory[] = SKR42_STRUCTURE
): KontaktVorbelegung | null {
  if (art !== 'income') return null;
  const t = types || [];
  const ziel: [TaxSphere, string] | null = t.includes('donor') ? ['ideell', '40400'] : t.includes('sponsor') ? ['wirtschaftlich', '44000'] : null;
  if (!ziel) return null;
  // über die ursprüngliche Nummer: auch wenn der Verein das Konto umnummeriert hat
  const k = standardKonto(ziel[1], skr);
  const main = k?.main;
  const sub = k?.sub;
  if (!main || !sub || main.type !== 'income' || main.isCustom) return null;
  return {
    sphere: ziel[0],
    mainId: main.id,
    mainCategory: `${main.code} - ${main.name}`,
    subCategory: sub.label,
    skrAccount: sub.code,
    vatRate: sub.vatRateDefault
  };
}
