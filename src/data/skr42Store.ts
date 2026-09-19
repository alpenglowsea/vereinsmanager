import { Skr42MainCategory } from '../types';
import { SKR42_STRUCTURE } from './taxSpheres';

/**
 * Anbindung des SKR-42-Kontenrahmens an React.
 *
 * Das Problem, das hier gelöst wird: SKR42_STRUCTURE ist ein ganz normales
 * Array in einem Modul. Legt der Kassenwart ein eigenes Konto an, ändert
 * customCategoryService dieses Array direkt — an React vorbei. React merkt
 * davon nichts und zeichnet die Auswahllisten nicht neu.
 *
 * Bisher half sich die Buchungsmaske mit einem Kunstgriff: Sie horchte auf
 * ein Fenster-Ereignis und zählte dann eine Zahl hoch, die sie in die
 * Abhängigkeitslisten ihrer useMemo-Aufrufe schrieb. Das funktionierte, war
 * aber für jeden Außenstehenden — auch für ESLint — nicht erkennbar: In der
 * Abhängigkeitsliste stand eine Zahl, die im Rechenteil nirgends vorkam.
 * ESLint meldete sie fünfmal als überflüssig. Wer der Meldung gefolgt wäre
 * und sie entfernt hätte, hätte die Maske stillschweigend kaputtgemacht:
 * Ein neu angelegtes Konto wäre in keiner Liste mehr aufgetaucht.
 *
 * Hier steht stattdessen der Weg, den React dafür vorsieht
 * (useSyncExternalStore): Der Speicher meldet Änderungen an, und wer ihn
 * benutzt, bekommt die Kontenliste als ganz gewöhnlichen Wert. Damit steht
 * die Abhängigkeit sichtbar im Code, und es gibt nichts mehr zu warnen.
 *
 * Bewusst ohne Zugriff auf "window": So lässt sich der Speicher in Tests
 * prüfen, ohne einen Browser nachzubauen.
 */

type Listener = () => void;

const listeners = new Set<Listener>();

/**
 * Der zuletzt ausgegebene Stand.
 *
 * Wichtig, und der Grund für die Zwischenspeicherung: React ruft
 * getSkr42Snapshot() bei jedem Rendern auf und vergleicht das Ergebnis mit
 * dem vorherigen. Käme bei jedem Aufruf ein frisch erzeugtes Array zurück,
 * wäre es nie dasselbe — React würde erneut zeichnen, wieder fragen, wieder
 * ein neues Array bekommen, und die Anwendung bliebe in einer Endlosschleife
 * hängen. Deshalb bleibt die Antwort zwischen zwei Änderungen identisch.
 *
 * null bedeutet: noch nicht berechnet. Die späte Berechnung erspart es uns,
 * auf die Reihenfolge der Modul-Importe zu achten — beim ersten Abruf hat
 * customCategoryService seine gespeicherten Konten längst eingemischt.
 */
let snapshot: readonly Skr42MainCategory[] | null = null;

/** Wird von React aufgerufen, um über Änderungen benachrichtigt zu werden. */
export function subscribeSkr42(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Der aktuelle Kontenrahmen. Zwischen zwei Änderungen immer dasselbe Array. */
export function getSkr42Snapshot(): readonly Skr42MainCategory[] {
  if (snapshot === null) {
    snapshot = SKR42_STRUCTURE.slice();
  }
  return snapshot;
}

/**
 * Meldet, dass sich der Kontenrahmen geändert hat.
 *
 * Aufgerufen von customCategoryService, nachdem dieser ein eigenes Konto in
 * SKR42_STRUCTURE eingemischt hat.
 */
export function notifySkr42Changed(): void {
  // Erst verwerfen, dann melden: Sonst holte sich der erste benachrichtigte
  // Zuhörer noch den alten Stand ab.
  snapshot = null;
  for (const listener of [...listeners]) {
    listener();
  }
}

/** Nur für Tests: setzt den Speicher in den Ausgangszustand zurück. */
export function resetSkr42StoreForTests(): void {
  listeners.clear();
  snapshot = null;
}
