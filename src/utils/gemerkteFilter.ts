import { useCallback, useSyncExternalStore } from 'react';

/**
 * Gemerkte Filter (Paket U, T-334).
 * ---------------------------------------------------------------------------
 * Suche und Filter einer Liste bleiben stehen, wenn man die Ansicht verlässt
 * (Beleg ansehen, anderer Menüpunkt) und zurückkommt – solange die App läuft.
 * Nicht über einen Neustart, nicht in der Sicherung.
 *
 * Jede Ansicht nimmt statt `useState` für ihre Filter
 * `useGemerkt('mitglieder', 'statusFilter', 'all')`. Der erste Wert ist der
 * Ausgangswert; `FilterZuruecksetzen` (Knopf) setzt alle Filter einer Liste
 * darauf zurück und erscheint nur, wenn einer davon abweicht.
 */

interface Eintrag {
  wert: unknown;
  start: unknown;
  /** zählt für „Filter aktiv“ und wird zurückgesetzt (Sortierung z. B. nicht) */
  filter: boolean;
}

const speicher = new Map<string, Map<string, Eintrag>>();
const hoerer = new Set<() => void>();
let version = 0;

function melde() {
  version++;
  hoerer.forEach(h => h());
}

function abonnieren(h: () => void) {
  hoerer.add(h);
  return () => {
    hoerer.delete(h);
  };
}

function eintrag(liste: string, feld: string, start: unknown, filter: boolean): Eintrag {
  let l = speicher.get(liste);
  if (!l) {
    l = new Map();
    speicher.set(liste, l);
  }
  let e = l.get(feld);
  if (!e) {
    e = { wert: start, start, filter };
    l.set(feld, e);
  }
  return e;
}

/** Wie `useState`, aber für die Dauer der Sitzung gemerkt. [filter] = false für z. B. Sortierung. */
export function useGemerkt<T>(liste: string, feld: string, start: T, filter = true): [T, (v: T | ((alt: T) => T)) => void] {
  const e = eintrag(liste, feld, start, filter);
  const wert = useSyncExternalStore(abonnieren, () => e.wert as T);
  const setze = useCallback(
    (v: T | ((alt: T) => T)) => {
      const x = eintrag(liste, feld, start, filter);
      const neu = typeof v === 'function' ? (v as (alt: T) => T)(x.wert as T) : v;
      if (Object.is(neu, x.wert)) return;
      x.wert = neu;
      melde();
    },
    // start und filter gelten nur beim ersten Anlegen
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [liste, feld]
  );
  return [wert, setze];
}

/** Weicht ein Filter der Liste vom Ausgangswert ab? (ohne React, für Tests) */
export function filterAktiv(liste: string): boolean {
  const l = speicher.get(liste);
  if (!l) return false;
  for (const e of l.values()) if (e.filter && !Object.is(e.wert, e.start)) return true;
  return false;
}

/** Setzt alle Filter einer Liste auf den Ausgangswert zurück. */
export function filterZuruecksetzen(liste: string): void {
  const l = speicher.get(liste);
  if (!l) return;
  let geaendert = false;
  for (const e of l.values()) {
    if (e.filter && !Object.is(e.wert, e.start)) {
      e.wert = e.start;
      geaendert = true;
    }
  }
  if (geaendert) melde();
}

/** Hook: ist ein Filter der Liste aktiv? */
export function useFilterAktiv(liste: string): boolean {
  useSyncExternalStore(abonnieren, () => version);
  return filterAktiv(liste);
}

/** Ohne React (Tests): Wert anlegen bzw. lesen und setzen. */
export function liesGemerkt<T>(liste: string, feld: string, start: T, filter = true): T {
  return eintrag(liste, feld, start, filter).wert as T;
}
export function setzeGemerkt<T>(liste: string, feld: string, wert: T): void {
  const e = speicher.get(liste)?.get(feld);
  if (!e || Object.is(e.wert, wert)) return;
  e.wert = wert;
  melde();
}

/** Nur für Tests: alles vergessen. */
export function vergissAlleFilter(): void {
  speicher.clear();
  melde();
}
