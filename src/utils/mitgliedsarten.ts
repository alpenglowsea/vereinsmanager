/**
 * Mitgliedsarten, vom Verein in den Einstellungen bearbeitbar (Wunsch Johannes,
 * 25.11.2026). Gespeichert in den Vereinsdaten unter `membershipTypes`; fehlt
 * das Feld (ältere Sicherungen), gelten die sechs bisherigen Arten.
 *
 * Am Mitglied steht die **Kennung** (`membershipType`), nie der Name. So
 * bleiben bestehende Mitglieder und alte Sicherungen gültig, und ein
 * Umbenennen wirkt überall zugleich. Die bisherigen Arten behalten ihre
 * Kennungen (`full`, `reduced`, `youth`, `family`, `supporting`, `honorary`).
 *
 * Statt fester Sonderregeln je Kennung hat jede Art drei Eigenschaften:
 * - `beitragsfrei`: Wahl der Art setzt Beitrag 0, keine Zahlweise, Zahlart „beitragsfrei“ (bisher nur Ehrenmitglied);
 * - `unter18`: wird für unter 18-Jährige vorgeschlagen (Aufnahmeantrag, Import; bisher Jugend); höchstens eine Art;
 * - `imAntrag`: steht im Aufnahmeantrag zur Wahl (bisher alle außer Ehrenmitglied).
 * Die erste nicht gelöschte Art ist die Vorgabe für neue Mitglieder.
 *
 * Gelöschte Arten bleiben mit `geloescht: true` in der Liste, damit Mitglieder,
 * die noch so eingetragen sind, ihren Namen behalten („Jugend (gelöscht)“).
 *
 * `ausgetreten` und `terminated` sind keine Arten, sondern Austrittsvermerke;
 * sie stehen nie in der Liste.
 *
 * Gleiche Regeln am Handy: `core/members/Mitgliedsarten.kt`.
 */

export interface MitgliedsArt {
  id: string;
  name: string;
  beitragsfrei?: boolean;
  unter18?: boolean;
  imAntrag?: boolean;
  geloescht?: boolean;
}

export const STANDARD_ARTEN: readonly MitgliedsArt[] = [
  { id: 'full', name: 'Vollmitglied', imAntrag: true },
  { id: 'reduced', name: 'Ermäßigt', imAntrag: true },
  { id: 'youth', name: 'Jugend / Kinder', unter18: true, imAntrag: true },
  { id: 'family', name: 'Familie', imAntrag: true },
  { id: 'supporting', name: 'Fördermitglied', imAntrag: true },
  { id: 'honorary', name: 'Ehrenmitglied', beitragsfrei: true }
];

/** Austrittsvermerke im Feld `membershipType`: keine Arten. */
export const AUSTRITT_VERMERKE: readonly string[] = ['ausgetreten', 'terminated'];
export const istAustritt = (id: string | undefined) => !!id && AUSTRITT_VERMERKE.includes(id);

const MAX_NAME = 60;

/**
 * Liest die gespeicherte Liste. Unbrauchbare Einträge fallen weg, doppelte
 * Kennungen zählen einmal. Ist danach keine Art übrig, gelten die Standardarten.
 */
export function leseArten(roh: unknown): MitgliedsArt[] {
  if (!Array.isArray(roh)) return STANDARD_ARTEN.map(a => ({ ...a }));
  const gesehen = new Set<string>();
  const liste: MitgliedsArt[] = [];
  for (const e of roh) {
    if (typeof e !== 'object' || e === null) continue;
    const o = e as Record<string, unknown>;
    const id = typeof o.id === 'string' ? o.id.trim() : '';
    if (!id || gesehen.has(id) || istAustritt(id)) continue;
    gesehen.add(id);
    const name = typeof o.name === 'string' && o.name.trim() ? o.name.trim().slice(0, MAX_NAME) : id;
    const a: MitgliedsArt = { id, name };
    if (o.beitragsfrei === true) a.beitragsfrei = true;
    if (o.unter18 === true) a.unter18 = true;
    if (o.imAntrag === true) a.imAntrag = true;
    if (o.geloescht === true) a.geloescht = true;
    liste.push(a);
  }
  return liste.some(a => !a.geloescht) ? liste : STANDARD_ARTEN.map(a => ({ ...a }));
}

export const aktiveArten = (arten: readonly MitgliedsArt[]) => arten.filter(a => !a.geloescht);

/** Vorgabe für neue Mitglieder: die erste nicht gelöschte Art. */
export const standardArt = (arten: readonly MitgliedsArt[]): string => aktiveArten(arten)[0]?.id ?? 'full';

export const findeArt = (arten: readonly MitgliedsArt[], id: string | undefined) => arten.find(a => a.id === id);

/** Anzeigename einer Kennung; gelöschte mit „(gelöscht)“, unbekannte mit ihrer Kennung. */
export function artName(arten: readonly MitgliedsArt[], id: string | undefined): string {
  if (!id) return '–';
  if (istAustritt(id)) return 'Ausgetreten';
  const a = findeArt(arten, id);
  if (!a) return id;
  return a.geloescht ? `${a.name} (gelöscht)` : a.name;
}

export const istBeitragsfrei = (arten: readonly MitgliedsArt[], id: string | undefined) => !!findeArt(arten, id)?.beitragsfrei;

/** Die Art, die unter 18-Jährigen vorgeschlagen wird, oder null. */
export const unter18Art = (arten: readonly MitgliedsArt[]): string | null => aktiveArten(arten).find(a => a.unter18)?.id ?? null;

/** Arten, die im Aufnahmeantrag zur Wahl stehen. */
export const antragsArten = (arten: readonly MitgliedsArt[]) => aktiveArten(arten).filter(a => a.imAntrag);

/**
 * Prüft die Liste vor dem Speichern. Schlüssel `name.<id>` für Feldfehler,
 * `liste` für Fehler der ganzen Liste. Leer, wenn alles passt.
 */
export function pruefeArten(arten: readonly MitgliedsArt[]): Record<string, string> {
  const f: Record<string, string> = {};
  const aktiv = aktiveArten(arten);
  if (aktiv.length === 0) f.liste = 'Mindestens eine Mitgliedsart muss bleiben.';
  const namen = new Map<string, string>();
  for (const a of aktiv) {
    const n = a.name.trim();
    if (!n) f[`name.${a.id}`] = 'Bitte einen Namen eingeben.';
    else if (n.length > MAX_NAME) f[`name.${a.id}`] = `Höchstens ${MAX_NAME} Zeichen.`;
    else {
      const k = n.toLocaleLowerCase('de-DE');
      if (namen.has(k)) f[`name.${a.id}`] = 'Diesen Namen gibt es schon.';
      else namen.set(k, a.id);
    }
  }
  if (aktiv.filter(a => a.unter18).length > 1) f.liste = 'Nur eine Art kann für unter 18-Jährige vorgeschlagen werden.';
  return f;
}

/** Legt eine neue Art an (am Ende der Liste) mit einer eigenen, festen Kennung. */
export function neueArt(arten: readonly MitgliedsArt[], name: string, jetzt: number = Date.now()): MitgliedsArt {
  let id = `art-${jetzt.toString(36)}`;
  let i = 2;
  while (arten.some(a => a.id === id)) id = `art-${jetzt.toString(36)}-${i++}`;
  return { id, name: name.trim(), imAntrag: true };
}

/** Liste zum Speichern: Namen ohne Leerzeichen am Rand, nur eingeschaltete Schalter (wie Android `Mitgliedsarten.json`). */
export const artenZumSpeichern = (arten: readonly MitgliedsArt[]): MitgliedsArt[] =>
  arten.map(a => {
    const x: MitgliedsArt = { id: a.id, name: a.name.trim() };
    if (a.beitragsfrei) x.beitragsfrei = true;
    if (a.unter18) x.unter18 = true;
    if (a.imAntrag) x.imAntrag = true;
    if (a.geloescht) x.geloescht = true;
    return x;
  });

/** Markiert eine Art als gelöscht; sie bleibt für den Namen in der Liste. */
export const artLoeschen = (arten: readonly MitgliedsArt[], id: string): MitgliedsArt[] =>
  arten.map(a => (a.id === id ? { ...a, geloescht: true, unter18: false } : a));

export const artWiederherstellen = (arten: readonly MitgliedsArt[], id: string): MitgliedsArt[] =>
  arten.map(a => (a.id === id ? (({ geloescht: _weg, ...rest }) => rest)(a) : a));

/** Verschiebt eine Art in der Liste um einen Platz (−1 nach oben, +1 nach unten). */
export function artVerschieben(arten: readonly MitgliedsArt[], id: string, richtung: -1 | 1): MitgliedsArt[] {
  const liste = [...arten];
  const i = liste.findIndex(a => a.id === id);
  const j = i + richtung;
  if (i < 0 || j < 0 || j >= liste.length) return liste;
  [liste[i], liste[j]] = [liste[j], liste[i]];
  return liste;
}

/** Wie viele Mitglieder mit dieser Art eingetragen sind, auch gekündigte (so viele verschiebt das Löschen). */
export const anzahlMitglieder = (members: readonly { membershipType?: string }[], id: string) =>
  members.filter(m => m.membershipType === id).length;

/**
 * Art aus einem Import-Text: zuerst der genaue Name einer Art (ohne
 * Groß-/Kleinschreibung), dann die bisherigen Stichwörter (solange es die Art
 * gibt), sonst bei unter 18 die vorgeschlagene, sonst die Vorgabe.
 */
export function artAusText(arten: readonly MitgliedsArt[], text: string | undefined, alter?: number): string {
  const aktiv = aktiveArten(arten);
  const l = (text || '').toLocaleLowerCase('de-DE').trim();
  if (l) {
    const genau = aktiv.find(a => a.name.toLocaleLowerCase('de-DE') === l || a.id === l);
    if (genau) return genau.id;
    const stichwort: [string[], string][] = [
      [['jugend', 'kind', 'schüler', 'youth'], 'youth'],
      [['ermäßigt', 'student', 'senior', 'azubi'], 'reduced'],
      [['familie'], 'family'],
      [['förder', 'sponsor'], 'supporting'],
      [['ehren'], 'honorary']
    ];
    for (const [woerter, id] of stichwort) {
      if (woerter.some(w => l.includes(w)) && aktiv.some(a => a.id === id)) return id;
    }
  }
  const jung = alter !== undefined && alter < 18 ? unter18Art(arten) : null;
  return jung ?? standardArt(arten);
}

/**
 * „Ehrenmitglied“ war bis 25.11.2026 auch ein Status. Jetzt ist es nur noch
 * eine Art: Status wird „Aktiv“, Art „Ehrenmitglied“. Der Beitrag bleibt, wie
 * er ist, damit niemandem still eine Lastschrift wegfällt. Gibt null zurück,
 * wenn nichts zu tun ist.
 */
export function ohneEhrenStatus<T extends { status?: string; membershipType?: string }>(m: T): T | null {
  if (m.status !== 'honorary') return null;
  return { ...m, status: 'active', membershipType: istAustritt(m.membershipType) ? m.membershipType : 'honorary' };
}
