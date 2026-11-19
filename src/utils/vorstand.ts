/**
 * Vorsitz und Kassenwart aus der Vorstandsliste ableiten (D-143).
 *
 * Briefkopf, Lastschriftprotokoll und Zuwendungsbestätigung lesen die beiden
 * Felder `chairman` und `treasurer`. Sie entstehen aus der frei beschrifteten
 * Vorstandsliste. Vorher nahm die Anwendung den ersten Eintrag mit „vorsitz“
 * ODER „vorstand“ bzw. mit „kasse“, „schatz“ oder „finanz“ und sonst einfach
 * den ersten oder zweiten Eintrag. So wurde aus einem Kassenprüfer oder einem
 * Schriftführer an Platz 2 ein Kassenwart, und aus einem stellvertretenden
 * Vorsitzenden an Platz 1 der Vorsitzende.
 *
 * Jetzt zählt nur der Wortlaut der Funktion, mit derselben Wortliste wie die
 * Android-Fassung (`Vorstand.kt`). Gibt es keinen Treffer, bleibt das Feld
 * leer und die Einstellungen zeigen einen Hinweis.
 */
import type { BoardMember } from '../types';

/** Vorschläge für die Funktion; frei überschreibbar. */
export const VORSTAND_FUNKTIONEN = [
  '1. Vorsitzende/r',
  '2. Vorsitzende/r',
  'Kassenwart / Schatzmeister',
  'Schriftführer/in',
  'Kassenprüfer/in',
  'Beisitzer/in',
  'Sportwart',
  'Jugendleiter/in'
];

const NICHT_ERSTER = ['stellv', 'stv', 'vize', '2.', '3.', 'zweit', 'dritt', 'jugend', 'ausschuss', 'abteilung', 'beirat', 'sparten'];
const NICHT_KASSE = ['prüf', 'pruef', 'revis', 'stellv', 'stv', 'vize', '2.'];
const KASSE = ['kassenwart', 'kassier', 'kassenführ', 'kassenfuehr', 'schatzmeister', 'finanzwart', 'finanzvorstand'];

export function istVorsitz(funktion: string | undefined | null): boolean {
  const f = (funktion || '').toLowerCase().trim();
  return (f.includes('vorsitz') || f.includes('präsident') || f.includes('praesident')) && !NICHT_ERSTER.some(w => f.includes(w));
}

export function istKasse(funktion: string | undefined | null): boolean {
  const f = (funktion || '').toLowerCase().trim();
  return KASSE.some(w => f.includes(w)) && !NICHT_KASSE.some(w => f.includes(w));
}

type Person = Pick<BoardMember, 'role' | 'name'>;

/** Name der ersten Person mit der Funktion Vorsitz; leer, wenn es keine gibt. Personen ohne Namen zählen nicht. */
export function vorsitzAus(liste: Person[]): string {
  return liste.find(p => (p.name || '').trim() && istVorsitz(p.role))?.name.trim() ?? '';
}

/** Name der ersten Person mit der Funktion Kassenwart; leer, wenn es keine gibt. */
export function kasseAus(liste: Person[]): string {
  return liste.find(p => (p.name || '').trim() && istKasse(p.role))?.name.trim() ?? '';
}

/** Hinweise, die nicht am Speichern hindern. */
export function vorstandHinweise(liste: Person[]): string[] {
  const h: string[] = [];
  if (!vorsitzAus(liste)) {
    h.push('Niemand hat die Funktion „Vorsitzende/r“. Im Briefkopf der Rechnungen und auf den Zuwendungsbestätigungen fehlt dann der Name.');
  }
  if (!kasseAus(liste)) {
    h.push('Niemand hat die Funktion „Kassenwart / Schatzmeister“. Im Lastschriftprotokoll und auf den Zuwendungsbestätigungen fehlt dann der Name.');
  }
  return h;
}

/**
 * Fehler je Eintrag (Schlüssel: id), wie bei Android. Ganz leere Zeilen sind
 * erlaubt und werden beim Speichern weggelassen.
 */
export function vorstandFehler(liste: BoardMember[]): Record<string, string> {
  const e: Record<string, string> = {};
  for (const m of liste) {
    const leer = !m.role?.trim() && !m.name?.trim() && !m.email?.trim() && !m.phone?.trim();
    if (leer) continue;
    if (!m.name?.trim()) e[m.id] = 'Bitte einen Namen eingeben.';
    else if (!m.role?.trim()) e[m.id] = 'Bitte die Funktion eingeben.';
    else if (m.email?.trim() && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(m.email.trim())) {
      e[m.id] = 'Die E-Mail-Adresse sieht nicht richtig aus.';
    }
  }
  // Dieselbe Person mit derselben Funktion zweimal: doppelt angelegt. Dieselbe
  // Person mit zwei verschiedenen Funktionen bleibt erlaubt (kleine Vereine).
  const gesehen = new Set<string>();
  for (const m of liste) {
    if (e[m.id] || !m.name?.trim() || !m.role?.trim()) continue;
    const schluessel = `${m.name.trim().toLowerCase()}|${m.role.trim().toLowerCase()}`;
    if (gesehen.has(schluessel)) e[m.id] = 'Diese Person steht mit dieser Funktion schon in der Liste.';
    gesehen.add(schluessel);
  }
  return e;
}

/** Ohne ganz leere Zeilen, Angaben ohne Leerzeichen am Rand. */
export function vorstandBereinigt(liste: BoardMember[]): BoardMember[] {
  return liste
    .filter(m => m.role?.trim() || m.name?.trim() || m.email?.trim() || m.phone?.trim())
    .map(m => ({ ...m, role: m.role.trim(), name: m.name.trim(), email: m.email?.trim() || '', phone: m.phone?.trim() || '' }));
}
