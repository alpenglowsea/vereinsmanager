/**
 * Regeln rund um Mitglieder und Beitragseinzug (P13 bis P15), nach dem
 * Vorbild der Android-Fassung. Ohne Datenbank, damit sie sich prüfen lassen.
 */
import type { FeePeriod, Member, MemberBulkUpdates, MembershipStatus, PaymentMethod } from '../types';
import { MitgliedsArt, STANDARD_ARTEN, artName, istAustritt, istBeitragsfrei, standardArt } from './mitgliedsarten';

// ---------------------------------------------------------------------------
// Deutsche Begriffe (D-29: das Stammblatt zeigte ACTIVE, FULL, SEPA …)
// ---------------------------------------------------------------------------

export const STATUS_TEXT: Record<MembershipStatus, string> = {
  active: 'Aktiv',
  passive: 'Passiv',
  terminated: 'Gekündigt / ausgetreten',
  suspended: 'Ruhend'
};

export const ZAHLWEISE_TEXT: Record<FeePeriod, string> = {
  monthly: 'Monatlich',
  quarterly: 'Vierteljährlich',
  half_yearly: 'Halbjährlich',
  yearly: 'Jährlich',
  none: 'Beitragsfrei'
};

export const ZAHLART_TEXT: Record<PaymentMethod, string> = {
  sepa: 'SEPA-Lastschrift',
  transfer: 'Überweisung',
  cash: 'Bar',
  standing_order: 'Dauerauftrag',
  exempt: 'Beitragsfrei'
};

export const MANDATSFOLGE_TEXT: Record<'FRST' | 'RCUR', string> = {
  FRST: 'Erstlastschrift',
  RCUR: 'Folgelastschrift'
};

const text = <K extends string>(tabelle: Record<K, string>, wert: string | undefined): string =>
  wert && wert in tabelle ? tabelle[wert as K] : wert || '–';

export const statusText = (s: string | undefined) => text(STATUS_TEXT, s);
/** Name der Mitgliedsart aus den Einstellungen (seit 25.11.2026 bearbeitbar). */
export const typText = (s: string | undefined, arten: readonly MitgliedsArt[] = STANDARD_ARTEN) => artName(arten, s);
export const zahlweiseText = (s: string | undefined) => text(ZAHLWEISE_TEXT, s);
export const zahlartText = (s: string | undefined) => text(ZAHLART_TEXT, s);

// ---------------------------------------------------------------------------
// Kontoinhaber folgt dem Namen (D-25)
// ---------------------------------------------------------------------------

/**
 * Neuer Kontoinhaber, wenn sich der Name ändert, oder null (nichts ändern).
 * Das Feld folgt dem Namen, solange es leer ist oder noch den zuletzt
 * automatisch gesetzten Namen enthält. Eine eigene Eingabe (z. B. das Konto
 * der Eltern) bleibt stehen. Vorher wurde nur beim allerersten Buchstaben
 * eingetragen, aus „Max Müller“ wurde „M“.
 */
export function kontoinhaberNachName(aktuell: string, zuletztAutomatisch: string, name: string): string | null {
  const folgt = aktuell === '' || aktuell === zuletztAutomatisch;
  if (!folgt || aktuell === name) return null;
  return name;
}

// ---------------------------------------------------------------------------
// Sammelbearbeitung mit den Regeln des Formulars (D-27)
// ---------------------------------------------------------------------------

const beitragGesperrt = (m: Pick<Member, 'status' | 'membershipType' | 'feePeriod'>) =>
  m.status === 'terminated' || m.membershipType === 'ausgetreten' || m.membershipType === 'terminated' || m.feePeriod === 'none';
const zahlweiseGesperrt = (m: Pick<Member, 'status' | 'membershipType'>) =>
  m.status === 'terminated' || m.membershipType === 'ausgetreten' || m.membershipType === 'terminated';

function austreten(m: Member, heute: string): Member {
  return { ...m, status: 'terminated', membershipType: 'ausgetreten', feeAmount: 0, feePeriod: 'none', paymentMethod: 'exempt', exitDate: m.exitDate || heute };
}

/**
 * Wendet eine Sammeländerung so an, wie es das Mitgliedsformular täte
 * (wie Android): erst Mitgliedsart und Status, dann Zahlweise und Zahlungsart,
 * zuletzt der Beitrag. Ist der Beitrag gesperrt (ausgetreten, beitragsfrei),
 * wird er nicht gesetzt. `uebersprungen` nennt, was deshalb nicht übernommen wurde.
 * Vorher setzte die Sammelbearbeitung z. B. „gekündigt“, ließ aber Beitrag
 * und Lastschrift stehen.
 */
export function wendeSammelRegelnAn(
  alt: Member,
  u: Pick<MemberBulkUpdates, 'membershipType' | 'status' | 'feePeriod' | 'paymentMethod' | 'feeAmount' | 'exitDate'>,
  heute: string,
  arten: readonly MitgliedsArt[] = STANDARD_ARTEN
): { mitglied: Member; uebersprungen: string[] } {
  let m: Member = { ...alt };
  const uebersprungen: string[] = [];

  if (u.membershipType !== undefined && u.membershipType !== m.membershipType) {
    if (istAustritt(u.membershipType)) m = { ...austreten(m, heute), membershipType: u.membershipType };
    // Beitragsfreie Art (z. B. Ehrenmitglied): Beitrag 0, keine Zahlweise, beitragsfrei
    else if (istBeitragsfrei(arten, u.membershipType)) m = { ...m, membershipType: u.membershipType, feeAmount: 0, feePeriod: 'none', paymentMethod: 'exempt' };
    else m = { ...m, membershipType: u.membershipType, status: m.status === 'terminated' ? 'active' : m.status };
  }
  if (u.status !== undefined && u.status !== m.status) {
    if (u.status === 'terminated') m = austreten(m, heute);
    else m = { ...m, status: u.status, membershipType: istAustritt(m.membershipType) ? standardArt(arten) : m.membershipType };
  }
  if (u.feePeriod !== undefined && u.feePeriod !== m.feePeriod) {
    if (zahlweiseGesperrt(m)) uebersprungen.push('Zahlweise');
    else if (u.feePeriod === 'none') m = { ...m, feePeriod: 'none', feeAmount: 0, paymentMethod: 'exempt' };
    else m = { ...m, feePeriod: u.feePeriod, paymentMethod: m.paymentMethod === 'exempt' ? 'sepa' : m.paymentMethod };
  }
  if (u.paymentMethod !== undefined && u.paymentMethod !== m.paymentMethod) {
    if (beitragGesperrt(m) && u.paymentMethod !== 'exempt') uebersprungen.push('Zahlungsart');
    else m = { ...m, paymentMethod: u.paymentMethod };
  }
  if (u.feeAmount !== undefined && u.feeAmount !== m.feeAmount) {
    if (beitragGesperrt(m)) uebersprungen.push('Beitrag');
    else m = { ...m, feeAmount: u.feeAmount };
  }
  if (u.exitDate !== undefined) m = { ...m, exitDate: u.exitDate || undefined };
  return { mitglied: m, uebersprungen };
}

// ---------------------------------------------------------------------------
// Beitragseinzug (D-23, D-24)
// ---------------------------------------------------------------------------

/**
 * Wird das Mitglied am Tag `heute` (JJJJ-MM-TT) eingezogen? Nicht bei
 * gekündigter oder ruhender Mitgliedschaft, nicht bei einem Austritt vor
 * heute und nicht bei einem Eintritt nach heute; Ein- oder Austritt heute
 * wird noch eingezogen (wie Android). Vorher zählte nur der Status.
 */
export function wirdEingezogen(m: Pick<Member, 'status' | 'entryDate' | 'exitDate'>, heute: string): boolean {
  if (m.status === 'terminated' || m.status === 'suspended') return false;
  const austritt = (m.exitDate || '').slice(0, 10);
  if (austritt && austritt < heute) return false;
  const eintritt = (m.entryDate || '').slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(eintritt) && eintritt > heute) return false;
  return true;
}

const namensTeile = (s: string) =>
  s
    .toLowerCase()
    .replace(/[,.]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .sort()
    .join(' ');

/**
 * Weicht der Kontoinhaber vom Mitglied ab? (Stern im Prüfprotokoll, D-24.)
 * „Max Müller“ und „Müller, Max“ sind derselbe Name. Vorher bekam jeder
 * Kontoinhaber einen Stern, weil die Schreibweisen verglichen wurden.
 */
export function kontoinhaberWeichtAb(kontoinhaber: string, vorname: string, nachname: string): boolean {
  return namensTeile(kontoinhaber) !== namensTeile(`${vorname} ${nachname}`);
}

/** Heutiges Datum in Ortszeit als JJJJ-MM-TT (nicht UTC, vgl. D-138). */
export function lokalesHeute(d: Date = new Date()): string {
  const z = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
}

// ---------------------------------------------------------------------------
// Prozente, die zusammen 100 ergeben (T-131)
// ---------------------------------------------------------------------------

/**
 * Ganze Prozente zu `anzahlen` bezogen auf `gesamt`. Ergeben die Anzahlen
 * zusammen `gesamt`, werden die Reste so verteilt, dass die Prozente genau
 * 100 ergeben (größte Reste zuerst); einzeln gerundet kamen z. B. 101 % heraus.
 * Sonst (Teilmengen, Überschneidungen) wird einzeln gerundet.
 */
export function prozente(anzahlen: number[], gesamt: number): number[] {
  if (!(gesamt > 0)) return anzahlen.map(() => 0);
  const roh = anzahlen.map(a => (a / gesamt) * 100);
  const summe = anzahlen.reduce((s, a) => s + a, 0);
  if (summe !== gesamt) return roh.map(p => Math.round(p));
  const ganz = roh.map(p => Math.floor(p));
  let rest = 100 - ganz.reduce((s, p) => s + p, 0);
  const reihenfolge = roh.map((p, i) => ({ i, r: p - Math.floor(p) })).sort((a, b) => b.r - a.r || a.i - b.i);
  for (const { i } of reihenfolge) {
    if (rest <= 0) break;
    ganz[i] += 1;
    rest--;
  }
  return ganz;
}
