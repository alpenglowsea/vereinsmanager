/**
 * Sparten anlegen und umbenennen (D-146, Rest aus P05).
 *
 * Sparten stehen als Text an Mitgliedern, Buchungen (auch an einzelnen
 * Teilbuchungen), Inventar und Terminen. Beim Umbenennen muss der neue Name
 * überall nachgezogen werden, sonst bleibt der alte als verwaister Text
 * stehen. Verglichen wird wie beim Löschen (`spartenVerwendung`) ohne
 * Groß-/Kleinschreibung und ohne Leerzeichen am Rand.
 */
import type { Transaction } from '../types';

const norm = (s: string | undefined | null) => (s || '').trim().toLowerCase();

/**
 * Fehlertext für einen neuen Spartennamen oder null, wenn er passt.
 * `alt`: beim Umbenennen der bisherige Name; nur Groß-/Kleinschreibung zu
 * ändern ist dann erlaubt.
 */
export function spartenNameFehler(neu: string, vorhandene: string[], alt?: string): string | null {
  const n = norm(neu);
  if (!n) return 'Bitte einen Namen für die Sparte eingeben.';
  if (alt !== undefined && neu.trim() === alt.trim()) return 'Der Name ist unverändert.';
  const doppelt = vorhandene.some(v => norm(v) === n && !(alt !== undefined && norm(v) === norm(alt)));
  if (doppelt) return `Die Sparte „${neu.trim()}“ gibt es schon (Groß- und Kleinschreibung zählen dabei nicht).`;
  return null;
}

/** Gibt eine Kopie mit neuem Spartennamen zurück oder null, wenn der Eintrag die Sparte nicht nutzt. */
export function ersetzeSparte<T extends { department?: string }>(eintrag: T, alt: string, neu: string): T | null {
  return norm(eintrag.department) === norm(alt) ? { ...eintrag, department: neu.trim() } : null;
}

/** Wie `ersetzeSparte`, berücksichtigt aber auch die Teilbuchungen. */
export function ersetzeSparteInBuchung(b: Transaction, alt: string, neu: string): Transaction | null {
  let geaendert = false;
  const kopie: Transaction = { ...b };
  if (norm(b.department) === norm(alt)) {
    kopie.department = neu.trim();
    geaendert = true;
  }
  if (b.splits?.some(s => norm(s.department) === norm(alt))) {
    kopie.splits = b.splits.map(s => (norm(s.department) === norm(alt) ? { ...s, department: neu.trim() } : s));
    geaendert = true;
  }
  return geaendert ? kopie : null;
}

/** Name in der Spartenliste ersetzen, Reihenfolge bleibt. */
export function ersetzeInListe(liste: string[], alt: string, neu: string): string[] {
  return liste.map(d => (d === alt ? neu.trim() : d));
}
