/**
 * Regeln für die Schnappschüsse am Desktop (seit 25.11.2026, Wunsch Johannes):
 * einmal am Tag automatisch und vor riskanten Schritten, höchstens 5 behalten.
 * Gleiche Zahlen wie am Handy (`Schnappschuesse.kt`).
 */

/** Behaltene tägliche (automatische) Schnappschüsse. */
export const MAX_TAEGLICH = 3;
/** Behaltene Schnappschüsse vor riskanten Schritten und von Hand angelegte. */
export const MAX_ANDERE = 2;
/** Ein neuer täglicher entsteht beim Start, wenn der letzte älter ist als so viele Stunden. */
export const ABSTAND_STUNDEN = 20;

export type SchnappGrund = 'pre_update' | 'periodic' | 'manual' | 'startup';

/** „periodic“ gibt es nur noch in älteren Schnappschüssen; er zählt wie der tägliche. */
export const schnappschussGruppe = (grund: SchnappGrund): 'taeglich' | 'andere' =>
  grund === 'startup' || grund === 'periodic' ? 'taeglich' : 'andere';

interface Kopf {
  id: string;
  timestamp: string;
  reason: SchnappGrund;
}

const zeit = (k: Kopf) => {
  const t = Date.parse(k.timestamp);
  return Number.isNaN(t) ? 0 : t;
};

/** Welche Schnappschüsse wegfallen: je Gruppe alle außer den neuesten. */
export function schnappschuesseZuLoeschen(liste: readonly Kopf[], maxTaeglich = MAX_TAEGLICH, maxAndere = MAX_ANDERE): string[] {
  const neueste = [...liste].sort((a, b) => zeit(b) - zeit(a));
  const taeglich = neueste.filter(k => schnappschussGruppe(k.reason) === 'taeglich');
  const andere = neueste.filter(k => schnappschussGruppe(k.reason) === 'andere');
  return [...taeglich.slice(maxTaeglich), ...andere.slice(maxAndere)].map(k => k.id);
}

/** Ist ein täglicher Schnappschuss fällig? Ja, wenn es keinen gibt oder der letzte älter als 20 Stunden ist. */
export function taeglicherFaellig(liste: readonly Kopf[], jetzt: Date): boolean {
  const letzte = liste.filter(k => schnappschussGruppe(k.reason) === 'taeglich').map(zeit);
  if (letzte.length === 0) return true;
  return jetzt.getTime() - Math.max(...letzte) >= ABSTAND_STUNDEN * 3600 * 1000;
}
