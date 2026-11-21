/**
 * Einträge im Änderungsprotokoll eines Mitglieds, wenn sich seine
 * Material-Ausgaben ändern. Texte und Felder wie Android
 * `MemberMaterial` (protokoll beim Speichern, Umschalten und Entfernen),
 * damit beide Fassungen dieselbe Historie schreiben.
 */
import { MemberAuditChange, MemberInventoryAssignment } from '../types';

export interface MaterialEintrag {
  summary: string;
  changes: MemberAuditChange[];
}

const name = (a: MemberInventoryAssignment) => a.itemName || 'Gegenstand';
const menge = (a: MemberInventoryAssignment) => `${a.quantity} ${a.unit || ''}`.trim();
const deutsch = (iso: string | undefined) => {
  const d = (iso || '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d.split('-').reverse().join('.') : iso || '';
};
/** Eigenanteil als Betrag, sonst leer (wie Android `eigen`). */
const eigen = (a: MemberInventoryAssignment) =>
  a.hasContribution && typeof a.contributionAmount === 'number'
    ? a.contributionAmount.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })
    : '';

/**
 * Was beim Speichern einer Ausgabe ins Protokoll gehört; null, wenn sich
 * nichts Protokollwürdiges geändert hat.
 */
export function materialGespeichert(alt: MemberInventoryAssignment | null | undefined, neu: MemberInventoryAssignment): MaterialEintrag | null {
  if (!alt) return { summary: `Material ausgegeben: ${name(neu)} (${menge(neu)})`, changes: [] };
  const zurueck = (a: MemberInventoryAssignment) => a.status === 'returned';
  if (zurueck(alt) !== zurueck(neu)) {
    return {
      summary: zurueck(neu) ? `Material zurückgegeben: ${name(neu)} (${menge(neu)})` : `Material wieder ausgegeben: ${name(neu)} (${menge(neu)})`,
      changes: []
    };
  }
  const diff: [string, string, string][] = [];
  if (alt.inventoryItemId !== neu.inventoryItemId) diff.push(['Gegenstand', name(alt), name(neu)]);
  if (Number(alt.quantity) !== Number(neu.quantity)) diff.push(['Menge', String(alt.quantity), String(neu.quantity)]);
  if ((alt.issueDate || '') !== (neu.issueDate || '')) diff.push(['Ausgabedatum', deutsch(alt.issueDate), deutsch(neu.issueDate)]);
  if (eigen(alt) !== eigen(neu)) diff.push(['Eigenanteil', eigen(alt), eigen(neu)]);
  if ((alt.notes || '') !== (neu.notes || '')) diff.push(['Notiz', alt.notes || '', neu.notes || '']);
  if (!diff.length) return null;
  return {
    summary: `Material bearbeitet: ${name(neu)}`,
    changes: diff.map(([label, oldValue, newValue], i) => ({ field: `material${i}`, label, oldValue, newValue }))
  };
}

export const materialEntfernt = (a: MemberInventoryAssignment): MaterialEintrag => ({
  summary: `Material-Verknüpfung entfernt: ${name(a)} (${menge(a)})`,
  changes: []
});
