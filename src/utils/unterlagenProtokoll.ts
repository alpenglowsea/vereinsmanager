/**
 * Einträge im Änderungsprotokoll eines Mitglieds, wenn sich seine Unterlagen
 * ändern (Paket U, Rückmeldung T-346). Texte und Felder wie Android
 * `Unterlagen.textHinzugefuegt` usw., damit beide Fassungen dieselbe
 * Historie schreiben.
 *
 * Der Führungszeugnis-Vermerk kommt bewusst nicht ins Protokoll: Nach § 72a
 * Abs. 5 SGB VIII sind die Angaben spätestens drei Monate nach Ende der
 * Tätigkeit zu löschen. Ein Protokolleintrag bliebe stehen.
 */
import type { ClubDocument } from '../types';
import type { MaterialEintrag } from './materialProtokoll';
import { artText, artVon } from './unterlagen';

/** 2026-01-31 → 31.01.2026; leer → „–“. */
const datum = (iso?: string): string => {
  if (!iso) return '–';
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso.split('-').reverse().join('.') : iso;
};
const text = (v?: string): string => v || '–';
const art = (d: ClubDocument) => artText(artVon(d));

export const unterlageHinzugefuegt = (d: ClubDocument): MaterialEintrag => ({
  summary: `Unterlage hinzugefügt: ${art(d)}: ${d.title || ''}`,
  changes: []
});

export const unterlageGeloescht = (d: ClubDocument): MaterialEintrag => ({
  summary: `Unterlage gelöscht: ${art(d)}: ${d.title || ''}`,
  changes: []
});

/** Was beim Bearbeiten ins Protokoll gehört; null, wenn sich nichts davon geändert hat. */
export function unterlageGeaendert(alt: ClubDocument, neu: ClubDocument): MaterialEintrag | null {
  const diff: [string, string, string][] = [];
  if (art(alt) !== art(neu)) diff.push(['Art', art(alt), art(neu)]);
  if ((alt.title || '') !== (neu.title || '')) diff.push(['Bezeichnung', text(alt.title), text(neu.title)]);
  if ((alt.issuedAt || '') !== (neu.issuedAt || '')) diff.push(['Ausgestellt am', datum(alt.issuedAt), datum(neu.issuedAt)]);
  if ((alt.validUntil || '') !== (neu.validUntil || '')) diff.push(['Gültig bis', datum(alt.validUntil), datum(neu.validUntil)]);
  if ((alt.fileName || '') !== (neu.fileName || '')) diff.push(['Datei', text(alt.fileName), text(neu.fileName)]);
  if (!diff.length) return null;
  return {
    summary: `Unterlage bearbeitet: ${neu.title || ''}`,
    changes: diff.map(([label, oldValue, newValue], i) => ({ field: `unterlage${i}`, label, oldValue, newValue }))
  };
}
