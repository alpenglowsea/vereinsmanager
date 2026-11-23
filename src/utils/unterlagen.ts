import type { ClubDocument, DocumentFolder, FuehrungszeugnisVermerk, Member, UnterlagenArt } from '../types';

/**
 * Unterlagen am Mitglied und Führungszeugnis-Vermerk (Paket U).
 * ---------------------------------------------------------------------------
 * Eine Unterlage ist ein gewöhnliches Dokument im Dokumentenarchiv mit
 * `memberId`, dazu `memberDocType`, `issuedAt` und `validUntil`. So laufen
 * Sicherung, Anzeige und der Austausch mit dem Handy über den vorhandenen Weg.
 *
 * Die Regeln hier gibt es am Handy gleich noch einmal
 * (android/core/.../members/Unterlagen.kt); beide haben dieselben Tests.
 */

export const UNTERLAGEN_ARTEN: { wert: UnterlagenArt; text: string }[] = [
  { wert: 'trainerlizenz', text: 'Trainer-/Übungsleiterlizenz' },
  { wert: 'erste_hilfe', text: 'Erste-Hilfe-Nachweis' },
  { wert: 'schiedsrichter', text: 'Schiedsrichterausweis' },
  { wert: 'aufnahmeantrag', text: 'Aufnahmeantrag' },
  { wert: 'einverstaendnis', text: 'Einverständnis (z. B. Fotos)' },
  { wert: 'sonstiges', text: 'Sonstiges' }
];

export const istUnterlagenArt = (w: unknown): w is UnterlagenArt => UNTERLAGEN_ARTEN.some(a => a.wert === w);

/** Anzeigetext einer Art; unbekannt oder leer = „Sonstiges“. */
export const artText = (w?: string): string => UNTERLAGEN_ARTEN.find(a => a.wert === w)?.text ?? 'Sonstiges';

/**
 * Art eines Dokuments am Mitglied. Ohne Angabe (ältere Dokumente) gilt ein
 * Aufnahmeantrag (Kennung `doc-antrag-…` oder Stichwort „Aufnahmeantrag“) als
 * solcher, alles andere als „Sonstiges“.
 */
export function artVon(d: Pick<ClubDocument, 'id' | 'memberDocType' | 'tags'>): UnterlagenArt {
  if (istUnterlagenArt(d.memberDocType)) return d.memberDocType;
  if (d.id.startsWith('doc-antrag-') || (d.tags || []).includes('Aufnahmeantrag')) return 'aufnahmeantrag';
  return 'sonstiges';
}

/** So viele Tage vor Ablauf erscheint eine Unterlage im Dashboard. */
export const WARN_TAGE = 90;
/** Nach so vielen Jahren ist ein neues Führungszeugnis fällig (übliche Vereinbarung mit dem Jugendamt). */
export const FZ_JAHRE = 5;

/** Ordner für Unterlagen; wird beim ersten Speichern angelegt (gleiche Kennung am Handy). */
export const ORDNER_UNTERLAGEN = {
  id: 'folder-mitgliederunterlagen',
  name: 'Mitgliederunterlagen',
  parentId: 'folder-mitglieder',
  category: 'mitglieder' as const,
  color: '#0ea5e9',
  description: 'Lizenzen, Nachweise und Einverständnisse einzelner Mitglieder'
};

/** Der Ordner als Datensatz; ohne Elternordner im Bestand liegt er oben. */
export function unterlagenOrdner(vorhanden: DocumentFolder[], jetzt: string): DocumentFolder {
  const eltern = vorhanden.some(f => f.id === ORDNER_UNTERLAGEN.parentId) ? ORDNER_UNTERLAGEN.parentId : null;
  return { ...ORDNER_UNTERLAGEN, parentId: eltern, createdAt: jetzt, updatedAt: jetzt };
}

const DATUM = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Gültiges Datum JJJJ-MM-TT? */
export function istDatum(d?: string): boolean {
  const m = DATUM.exec(d ?? '');
  if (!m) return false;
  const j = Number(m[1]), mo = Number(m[2]), t = Number(m[3]);
  if (mo < 1 || mo > 12 || t < 1) return false;
  return t <= new Date(Date.UTC(j, mo, 0)).getUTCDate();
}

/** Tage von a bis b (beide JJJJ-MM-TT). */
export function tageZwischen(a: string, b: string): number {
  const [ja, ma, ta] = a.split('-').map(Number);
  const [jb, mb, tb] = b.split('-').map(Number);
  return Math.round((Date.UTC(jb, mb - 1, tb) - Date.UTC(ja, ma - 1, ta)) / 86_400_000);
}

/** Datum plus Jahre; der 29. Februar wird in Nicht-Schaltjahren zum 28. (wie Javas LocalDate.plusYears). */
export function plusJahre(d: string, jahre: number): string {
  const [j, m, t] = d.split('-').map(Number);
  const zj = j + jahre;
  const letzter = new Date(Date.UTC(zj, m, 0)).getUTCDate();
  return `${String(zj).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(Math.min(t, letzter)).padStart(2, '0')}`;
}

export type AblaufStatus = 'ohne' | 'gueltig' | 'bald' | 'abgelaufen';

/**
 * Stand einer Frist: „ohne“ (kein Datum), „abgelaufen“ (vor heute), „bald“
 * (heute bis in [tage] Tagen) oder „gültig“. Der Tag selbst gilt noch.
 */
export function ablaufStatus(bis: string | undefined, heute: string, tage = WARN_TAGE): AblaufStatus {
  if (!istDatum(bis)) return 'ohne';
  const rest = tageZwischen(heute, bis!);
  if (rest < 0) return 'abgelaufen';
  return rest <= tage ? 'bald' : 'gueltig';
}

/** Wann ist das nächste Führungszeugnis fällig? Ausstellungsdatum + 5 Jahre. */
export function fuehrungszeugnisFaellig(v?: FuehrungszeugnisVermerk | null): string | null {
  return v && istDatum(v.certificateDate) ? plusJahre(v.certificateDate, FZ_JAHRE) : null;
}

/** Unterlagen eines Mitglieds (alle Dokumente mit seiner Kennung), neueste zuerst. */
export function unterlagenVon(memberId: string, documents: ClubDocument[]): ClubDocument[] {
  return documents
    .filter(d => d.memberId === memberId)
    .sort((a, b) => (b.issuedAt || b.date || '').localeCompare(a.issuedAt || a.date || '') || a.title.localeCompare(b.title));
}

export interface UnterlagenEingabe {
  art: string;
  titel: string;
  ausgestelltAm: string;
  gueltigBis: string;
}

/** Prüft die Angaben zu einer Unterlage; null = in Ordnung. */
export function pruefeUnterlage(f: UnterlagenEingabe): string | null {
  if (!istUnterlagenArt(f.art)) return 'Bitte eine Art wählen.';
  if (!f.titel.trim()) return 'Bitte eine Bezeichnung eingeben.';
  if (f.ausgestelltAm && !istDatum(f.ausgestelltAm)) return '„Ausgestellt am“ ist kein gültiges Datum.';
  if (f.gueltigBis && !istDatum(f.gueltigBis)) return '„Gültig bis“ ist kein gültiges Datum.';
  if (f.ausgestelltAm && f.gueltigBis && f.gueltigBis < f.ausgestelltAm) return '„Gültig bis“ liegt vor „Ausgestellt am“.';
  return null;
}

/** Prüft einen Führungszeugnis-Vermerk; null = in Ordnung. */
export function pruefeFuehrungszeugnis(v: FuehrungszeugnisVermerk, heute: string): string | null {
  if (!istDatum(v.certificateDate)) return 'Bitte das Datum des Führungszeugnisses eingeben.';
  if (!istDatum(v.inspectedAt)) return 'Bitte das Datum der Einsichtnahme eingeben.';
  if (v.certificateDate > heute) return 'Das Datum des Führungszeugnisses liegt in der Zukunft.';
  if (v.inspectedAt > heute) return 'Die Einsichtnahme liegt in der Zukunft.';
  if (v.inspectedAt < v.certificateDate) return 'Die Einsichtnahme liegt vor dem Datum des Führungszeugnisses.';
  return null;
}

export interface Erinnerung {
  memberId: string;
  memberName: string;
  /** „unterlage“ oder „fuehrungszeugnis“ */
  art: 'unterlage' | 'fuehrungszeugnis';
  /** z. B. „Trainer-/Übungsleiterlizenz: C-Lizenz Fußball“ oder „Erweitertes Führungszeugnis“ */
  text: string;
  /** Gültig bis bzw. fällig am (JJJJ-MM-TT) */
  datum: string;
  abgelaufen: boolean;
  documentId?: string;
}

/**
 * Was im Dashboard unter „Unterlagen laufen ab“ steht: Unterlagen mit
 * „gültig bis“ in den nächsten [tage] Tagen oder schon vorbei, dazu fällige
 * Führungszeugnisse. Nur Mitglieder, die nicht ausgetreten sind. Sortiert nach
 * Datum (Abgelaufenes zuerst).
 */
export function erinnerungen(members: Member[], documents: ClubDocument[], heute: string, tage = WARN_TAGE): Erinnerung[] {
  const aktiv = new Map(members.filter(m => m.status !== 'terminated').map(m => [m.id, m]));
  const name = (m: Member) => `${m.firstName} ${m.lastName}`.trim();
  const aus: Erinnerung[] = [];
  for (const d of documents) {
    const m = d.memberId ? aktiv.get(d.memberId) : undefined;
    if (!m) continue;
    const s = ablaufStatus(d.validUntil, heute, tage);
    if (s !== 'bald' && s !== 'abgelaufen') continue;
    aus.push({
      memberId: m.id, memberName: name(m), art: 'unterlage', text: `${artText(artVon(d))}: ${d.title}`,
      datum: d.validUntil!, abgelaufen: s === 'abgelaufen', documentId: d.id
    });
  }
  for (const m of aktiv.values()) {
    const f = fuehrungszeugnisFaellig(m.policeCertificate);
    const s = ablaufStatus(f ?? undefined, heute, tage);
    if (f && (s === 'bald' || s === 'abgelaufen')) {
      aus.push({ memberId: m.id, memberName: name(m), art: 'fuehrungszeugnis', text: 'Erweitertes Führungszeugnis', datum: f, abgelaufen: s === 'abgelaufen' });
    }
  }
  return aus.sort((a, b) => a.datum.localeCompare(b.datum) || a.memberName.localeCompare(b.memberName) || a.text.localeCompare(b.text));
}

/** Zahl der Unterlagen (Dokumente) eines oder mehrerer Mitglieder, z. B. für die Rückfrage beim Löschen. */
export const anzahlUnterlagen = (ids: string[], documents: ClubDocument[]): number => {
  const s = new Set(ids);
  return documents.filter(d => d.memberId && s.has(d.memberId)).length;
};
