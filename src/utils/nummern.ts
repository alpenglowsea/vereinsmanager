/**
 * Vergabe fortlaufender Nummern (Belege, Rechnungen, Kontakte, Inventar,
 * Mitglieder, Tagesordnungspunkte) – eine gemeinsame Stelle für alle Bereiche.
 *
 * Grundregel: Die nächste Nummer ist die HÖCHSTE vorhandene plus eins.
 *
 * Vorher wurde an vielen Stellen „Anzahl der Einträge plus eins“ gerechnet.
 * Das vergibt eine Nummer doppelt, sobald ein Eintrag gelöscht wurde: Bei
 * BE-001, BE-002, BE-003 und gelöschter BE-002 gibt es noch zwei Einträge,
 * die „nächste“ Nummer wäre wieder BE-003. Die Regeln hier entsprechen der
 * Android-Fassung.
 */

function alsText(wert: string | null | undefined): string {
  return typeof wert === 'string' ? wert.trim() : '';
}

function regexSicher(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Nummern der Form `<Präfix>-<Jahr>-<laufende Nummer>`, z. B. `BE-2026-014`,
 * `RE-2026-003`, `ZB-2026-001`, `BK-2026-120`.
 *
 * Gezählt wird je Jahr und je Präfix; Nummern in anderer Schreibweise (z. B.
 * von Hand vergebene) werden übergangen.
 */
export function naechsteJahresNummer(
  praefix: string,
  vorhandene: Iterable<string | null | undefined>,
  jahr: number = new Date().getFullYear(),
  stellen = 3
): string {
  const muster = new RegExp(`^${regexSicher(praefix)}-${jahr}-(\\d+)$`);
  let hoechste = 0;
  for (const nummer of vorhandene) {
    const treffer = muster.exec(alsText(nummer));
    if (!treffer) continue;
    const n = Number.parseInt(treffer[1], 10);
    if (Number.isFinite(n) && n > hoechste) hoechste = n;
  }
  return `${praefix}-${jahr}-${String(hoechste + 1).padStart(stellen, '0')}`;
}

/**
 * Kontaktnummer `K-1001`, `K-1002` …: höchste vorhandene Zahl plus eins,
 * mindestens K-1001. Es zählen nur die Ziffern der Nummer.
 */
export function naechsteKontaktNummer(vorhandene: Iterable<string | null | undefined>): string {
  let hoechste = 1000;
  for (const nummer of vorhandene) {
    const n = Number.parseInt(alsText(nummer).replace(/\D/g, ''), 10);
    if (Number.isFinite(n) && n > hoechste) hoechste = n;
  }
  return `K-${String(hoechste + 1).padStart(4, '0')}`;
}

/**
 * Nächste Nummer „im Schema des Bestands“: Aus den vorhandenen Nummern wird
 * die häufigste Vorsilbe genommen (z. B. `M-` oder `INV-FB-`), dazu die
 * höchste Zahl dahinter plus eins, mit derselben Stellenzahl.
 *
 *   M-0101, M-0102, M-0107        → M-0108
 *   INV-FB-001, INV-FB-002        → INV-FB-003
 *   (noch nichts vorhanden)       → `ersteNummer`
 *
 * Ist der so gebildete Vorschlag schon vergeben (Groß-/Kleinschreibung
 * egal), wird weitergezählt.
 */
export function naechsteNummerImSchema(vorhandene: Iterable<string | null | undefined>, ersteNummer: string): string {
  const alle = [...vorhandene].map(alsText).filter(n => n !== '');
  const teile: Array<{ vorsilbe: string; ziffern: string }> = [];
  for (const nummer of alle) {
    const treffer = /^(.*?)(\d+)$/.exec(nummer);
    if (treffer) teile.push({ vorsilbe: treffer[1], ziffern: treffer[2] });
  }
  if (teile.length === 0) return ersteNummer;

  const haeufigkeit = new Map<string, number>();
  for (const t of teile) haeufigkeit.set(t.vorsilbe, (haeufigkeit.get(t.vorsilbe) ?? 0) + 1);
  const vorsilbe = [...haeufigkeit.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))[0][0];

  const gruppe = teile.filter(t => t.vorsilbe === vorsilbe);
  const breite = Math.max(...gruppe.map(t => t.ziffern.length));
  let naechste = gruppe.reduce((max, t) => {
    const n = BigInt(t.ziffern);
    return n > max ? n : max;
  }, BigInt(0));

  const vergeben = new Set(alle.map(n => n.toLowerCase()));
  for (;;) {
    naechste += BigInt(1);
    const vorschlag = vorsilbe + naechste.toString().padStart(breite, '0');
    if (!vergeben.has(vorschlag.toLowerCase())) return vorschlag;
  }
}

/**
 * Ist die Nummer schon an einen ANDEREN Eintrag vergeben? Verglichen wird
 * ohne Rücksicht auf Groß-/Kleinschreibung und Leerzeichen am Rand. Der
 * Eintrag mit `eigeneId` (der gerade bearbeitete) zählt nicht mit.
 */
export function nummerVergeben(
  nummer: string | null | undefined,
  eintraege: Iterable<{ id: string; nummer: string | null | undefined }>,
  eigeneId?: string | null
): boolean {
  const gesucht = alsText(nummer).toLowerCase();
  if (gesucht === '') return false;
  for (const e of eintraege) {
    if (eigeneId && e.id === eigeneId) continue;
    if (alsText(e.nummer).toLowerCase() === gesucht) return true;
  }
  return false;
}

const TOP_MUSTER = /^TOP\s*(\d+)$/i;

/**
 * Nummer für einen neuen Tagesordnungspunkt: höchste vorhandene „TOP n“ plus
 * eins. Punkte mit eigener Bezeichnung (z. B. „TOP 3a“) zählen mit ihrer Zahl.
 */
export function naechsteTopNummer(nummern: Iterable<string | null | undefined>): string {
  let hoechste = 0;
  let anzahl = 0;
  for (const nummer of nummern) {
    anzahl++;
    const treffer = /^TOP\s*(\d+)/i.exec(alsText(nummer));
    if (!treffer) continue;
    const n = Number.parseInt(treffer[1], 10);
    if (Number.isFinite(n) && n > hoechste) hoechste = n;
  }
  return `TOP ${hoechste > 0 ? hoechste + 1 : anzahl + 1}`;
}

/**
 * Zählt die Tagesordnung nach dem Entfernen eines Punkts wieder lückenlos
 * durch (TOP 1, TOP 2, …) und führt die Angabe an den Beschlüssen des Punkts
 * mit. Das geschieht nur, wenn ALLE Punkte die übliche Form „TOP n“ haben;
 * hat jemand eigene Bezeichnungen vergeben (z. B. „TOP 3a“), bleibt alles,
 * wie es ist.
 */
export function nummeriereTopsNeu<
  T extends { number: string; resolutions?: Array<{ agendaItemNumber: string }> }
>(agenda: T[]): T[] {
  if (!agenda.every(top => TOP_MUSTER.test(alsText(top.number)))) return agenda;
  return agenda.map((top, i) => {
    const number = `TOP ${i + 1}`;
    if (top.number === number) return top;
    return {
      ...top,
      number,
      resolutions: top.resolutions?.map(r => ({ ...r, agendaItemNumber: number }))
    };
  });
}
