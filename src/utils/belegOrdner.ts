/**
 * Ordner für Buchungsbelege in der Dokumentenverwaltung.
 *
 * Belege einer Buchung gehören nach „Buchhaltungsbelege & Finanzen /
 * Belege <Jahr der Buchung>“. So legt sie auch die Android-Fassung ab
 * (`Belege.zielOrdner`), mit denselben Kennungen, damit eine Sicherung auf
 * beiden Geräten dieselbe Ordnerstruktur zeigt. Vorher landete der Beleg am
 * Desktop ohne Ordner (D-16).
 *
 * Diese Datei entscheidet nur (ohne Datenbank), damit sie sich prüfen lässt;
 * angelegt wird in `storage.ts`.
 */
import type { DocumentFolder } from '../types';

export const BELEG_HAUPTORDNER_ID = 'folder-belege';
export const BELEG_HAUPTORDNER_NAME = 'Buchhaltungsbelege & Finanzen';

const FARBE = '#10b981';

function elternVon(o: DocumentFolder): string | null {
  return o.parentId ? o.parentId : null;
}

function jahrAus(datum: string | null | undefined): string | null {
  const j = (datum ?? '').trim().slice(0, 4);
  return /^\d{4}$/.test(j) ? j : null;
}

/**
 * Bestimmt den Zielordner für einen Beleg mit dem Datum `datum`.
 *
 * Gibt die Kennung des Zielordners zurück und die Ordner, die dafür neu
 * angelegt werden müssen (leer, wenn alles schon da ist). Vorhandene Ordner
 * werden an Kennung oder Name erkannt; ein umbenannter Hauptordner bleibt
 * über seine Kennung gültig.
 */
export function planeBelegOrdner(
  vorhandene: DocumentFolder[],
  datum: string | null | undefined,
  jetzt: string = new Date().toISOString(),
  neueKennung: () => string = () => `folder-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`
): { zielId: string; neu: DocumentFolder[] } {
  const neu: DocumentFolder[] = [];
  const belegt = new Set(vorhandene.map(o => o.id));

  let haupt =
    vorhandene.find(o => o.id === BELEG_HAUPTORDNER_ID) ??
    vorhandene.find(o => o.name === BELEG_HAUPTORDNER_NAME && elternVon(o) === null);
  if (!haupt) {
    haupt = {
      id: belegt.has(BELEG_HAUPTORDNER_ID) ? neueKennung() : BELEG_HAUPTORDNER_ID,
      name: BELEG_HAUPTORDNER_NAME,
      parentId: null,
      category: 'belege',
      color: FARBE,
      description: 'Ein- und Ausgangsrechnungen, Quittungen und Spendenbelege',
      createdAt: jetzt,
      updatedAt: jetzt
    };
    neu.push(haupt);
    belegt.add(haupt.id);
  }

  const jahr = jahrAus(datum);
  if (!jahr) return { zielId: haupt.id, neu };

  const name = `Belege ${jahr}`;
  const vorhanden = vorhandene.find(o => elternVon(o) === haupt!.id && o.name === name);
  if (vorhanden) return { zielId: vorhanden.id, neu };

  const wunsch = `folder-belege-${jahr}`;
  const unter: DocumentFolder = {
    id: belegt.has(wunsch) ? neueKennung() : wunsch,
    name,
    parentId: haupt.id,
    category: 'belege',
    color: FARBE,
    description: `Rechnungen und Zahlungsnachweise des Geschäftsjahres ${jahr}`,
    createdAt: jetzt,
    updatedAt: jetzt
  };
  neu.push(unter);
  return { zielId: unter.id, neu };
}

/**
 * Unterordner unter „Belege <Jahr>“ für Spendenbescheinigungen und
 * Ausgangsrechnungen (D-40, D-47), wie Android (`Belege.unterordner`):
 * gefunden wird ein vorhandener Unterordner am Namen.
 */
export type BelegArt = 'spenden' | 'rechnungen';

const UNTERORDNER: Record<BelegArt, { name: string; schluessel: string; beschreibung: string }> = {
  spenden: {
    name: 'Spendenbescheinigungen',
    schluessel: 'spendenbescheinigungen',
    beschreibung: 'Zuwendungsbestätigungen (Spendenquittungen) dieses Geschäftsjahres'
  },
  rechnungen: {
    name: 'Ausgangsrechnungen',
    schluessel: 'ausgangsrechnungen',
    beschreibung: 'Ausgangsrechnungen des Geschäftsjahres'
  }
};

export function planeUnterordner(
  vorhandene: DocumentFolder[],
  datum: string | null | undefined,
  art: BelegArt,
  jetzt: string = new Date().toISOString(),
  neueKennung: () => string = () => `folder-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`
): { zielId: string; neu: DocumentFolder[] } {
  const jahr = planeBelegOrdner(vorhandene, datum, jetzt, neueKennung);
  // Ohne gültiges Datum gibt es keinen Jahresordner; dann bleibt es beim Hauptordner.
  if (!jahrAus(datum)) return jahr;
  const alle = [...vorhandene, ...jahr.neu];
  const u = UNTERORDNER[art];
  const vorhanden = alle.find(o => elternVon(o) === jahr.zielId && o.name === u.name);
  if (vorhanden) return { zielId: vorhanden.id, neu: jahr.neu };
  const belegt = new Set(alle.map(o => o.id));
  const wunsch = `${jahr.zielId}-${u.schluessel}`;
  const ordner: DocumentFolder = {
    id: belegt.has(wunsch) ? neueKennung() : wunsch,
    name: u.name,
    parentId: jahr.zielId,
    category: 'belege',
    color: FARBE,
    description: u.beschreibung,
    createdAt: jetzt,
    updatedAt: jetzt
  };
  return { zielId: ordner.id, neu: [...jahr.neu, ordner] };
}

/** Welcher Art ist ein automatisch abgelegtes PDF? (an der Kennung erkannt) */
export function belegArtVon(dokumentId: string): BelegArt | null {
  if (dokumentId.startsWith('doc-don-')) return 'spenden';
  if (dokumentId.startsWith('doc-inv-')) return 'rechnungen';
  return null;
}

/**
 * Soll ein automatisch abgelegtes PDF (neu) einsortiert werden? Ja, wenn es
 * noch in keinem Ordner liegt oder nur im Hauptordner bzw. im Jahresordner
 * „Belege <Jahr>“ (dorthin hat sie die Nacharbeit aus D-16 gelegt). Was
 * jemand in einen anderen Ordner verschoben hat, bleibt dort.
 */
export function sollEinsortiertWerden(folderId: string | null | undefined, vorhandene: DocumentFolder[]): boolean {
  if (!folderId) return true;
  const o = vorhandene.find(f => f.id === folderId);
  if (!o) return true; // Ordner gibt es nicht mehr
  const haupt = vorhandene.find(f => f.id === BELEG_HAUPTORDNER_ID) ??
    vorhandene.find(f => f.name === BELEG_HAUPTORDNER_NAME && elternVon(f) === null);
  if (!haupt) return false;
  if (o.id === haupt.id) return true;
  return elternVon(o) === haupt.id && /^Belege \d{4}$/.test(o.name);
}
