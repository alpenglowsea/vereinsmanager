/**
 * Rechenregeln für Fenster, deren Größe der Anwender durch Ziehen an den
 * Kanten ändern kann (Runde 2, R3). Ohne React, damit sie direkt testbar sind;
 * benutzt von `components/VeraenderbaresFenster.tsx`.
 *
 * Grundsatz (Bedingung von Johannes, 22.11.2026): Die gemerkte Größe ist nur
 * ein Wunsch. Angezeigt wird sie immer begrenzt auf den Platz, den das
 * Programmfenster gerade hat. Ist es kleiner als beim letzten Mal, wird das
 * Fenster kleiner gezeichnet, Kopfzeile und Knöpfe bleiben im Bild, der
 * Inhalt rollt. Der Wunsch selbst bleibt gespeichert; wird das
 * Programmfenster wieder groß, kommt die gemerkte Größe zurück.
 */

/** Gewünschte Größe in Bildpunkten. Fehlt ein Maß, gilt die Standardgröße des Fensters. */
export interface Groesse {
  breite?: number;
  hoehe?: number;
}

/** Platz, den das Fenster höchstens einnehmen darf. */
export interface Platz {
  breite: number;
  hoehe: number;
}

export type Kante = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';
export const ALLE_KANTEN: Kante[] = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];

export const MIN_BREITE = 360;
export const MIN_HOEHE = 240;
/** Größer speichert niemand ein Fenster; alles darüber ist ein kaputter Wert. */
const MAX_WERT = 20000;

/** Speicherort im Browser (nur dieses Gerät, nicht in der Datensicherung). */
export const SPEICHER_SCHLUESSEL = 'vm_fenstergroessen_v1';

const istMass = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0 && v <= MAX_WERT;

/**
 * Begrenzt den Wunsch auf den Platz und auf die Mindestgröße. Ist der Platz
 * selbst kleiner als die Mindestgröße, gewinnt der Platz: Lieber ein enges
 * Fenster als eines, das über den Rand ragt. Fenster mit viel festem Inhalt
 * (mehrere Leisten über und unter dem rollenden Bereich) geben eine größere
 * Mindestgröße mit.
 */
export function begrenze(wunsch: Groesse, platz: Platz, min: Platz = { breite: MIN_BREITE, hoehe: MIN_HOEHE }): Groesse {
  const ergebnis: Groesse = {};
  const maxB = Math.max(1, Math.floor(platz.breite));
  const maxH = Math.max(1, Math.floor(platz.hoehe));
  if (istMass(wunsch.breite)) ergebnis.breite = Math.min(maxB, Math.max(Math.min(min.breite, maxB), Math.round(wunsch.breite)));
  if (istMass(wunsch.hoehe)) ergebnis.hoehe = Math.min(maxH, Math.max(Math.min(min.hoehe, maxH), Math.round(wunsch.hoehe)));
  return ergebnis;
}

/**
 * Neue Größe beim Ziehen. `start` ist die Größe beim Anfassen, `dx`/`dy` die
 * Mausbewegung seitdem. `faktor` ist 2, wenn das Fenster in dieser Richtung
 * mittig steht (dann wächst es nach beiden Seiten, und die gezogene Kante
 * bleibt trotzdem unter dem Mauszeiger), sonst 1. Gezogen an einer
 * senkrechten Kante ändert sich nur die Breite, an einer waagrechten nur die
 * Höhe, an einer Ecke beides.
 */
export function neueGroesse(start: Platz, kante: Kante, dx: number, dy: number, faktor: { x: number; y: number }): Groesse {
  const g: Groesse = {};
  if (kante.includes('e')) g.breite = start.breite + dx * faktor.x;
  if (kante.includes('w')) g.breite = start.breite - dx * faktor.x;
  if (kante.includes('s')) g.hoehe = start.hoehe + dy * faktor.y;
  if (kante.includes('n')) g.hoehe = start.hoehe - dy * faktor.y;
  return g;
}

/** Liest alle gemerkten Größen. Kaputtes oder Unsinniges wird übergangen. */
export function leseGespeichert(roh: string | null | undefined): Record<string, Groesse> {
  if (!roh) return {};
  let daten: unknown;
  try {
    daten = JSON.parse(roh);
  } catch {
    return {};
  }
  if (!daten || typeof daten !== 'object' || Array.isArray(daten)) return {};
  const aus: Record<string, Groesse> = {};
  for (const [kennung, wert] of Object.entries(daten as Record<string, unknown>)) {
    if (!wert || typeof wert !== 'object') continue;
    const w = wert as Record<string, unknown>;
    const g: Groesse = {};
    if (istMass(w.breite)) g.breite = Math.round(w.breite);
    if (istMass(w.hoehe)) g.hoehe = Math.round(w.hoehe);
    if (g.breite !== undefined || g.hoehe !== undefined) aus[kennung] = g;
  }
  return aus;
}

/** Trägt die Größe eines Fensters ein (oder entfernt sie bei `null`) und gibt den neuen Speicherinhalt zurück. */
export function schreibeGespeichert(roh: string | null | undefined, kennung: string, groesse: Groesse | null): string {
  const alle = leseGespeichert(roh);
  if (groesse && (istMass(groesse.breite) || istMass(groesse.hoehe))) {
    const g: Groesse = {};
    if (istMass(groesse.breite)) g.breite = Math.round(groesse.breite);
    if (istMass(groesse.hoehe)) g.hoehe = Math.round(groesse.hoehe);
    alle[kennung] = g;
  } else {
    delete alle[kennung];
  }
  return JSON.stringify(alle);
}

/** Mausform für eine Kante. */
export function mauszeiger(kante: Kante): string {
  switch (kante) {
    case 'n':
    case 's':
      return 'ns-resize';
    case 'e':
    case 'w':
      return 'ew-resize';
    case 'ne':
    case 'sw':
      return 'nesw-resize';
    default:
      return 'nwse-resize';
  }
}
