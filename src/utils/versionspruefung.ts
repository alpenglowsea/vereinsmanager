/**
 * Versionsprüfung: Fragt GitHub nach der zuletzt veröffentlichten Version und vergleicht sie mit der installierten.
 *
 * Grundsatz (Johannes, 25.11.2026): Nichts geht nach draußen, ohne dass der Anwender es angeklickt hat. Diese Datei
 * enthält nur die Regeln; die Abfrage selbst löst allein der Knopf „Jetzt prüfen“ aus (`AppVersionBadge`).
 *
 * Gleiche Regeln und Texte wie am Handy: `android/core/.../settings/Versionspruefung.kt`, mit denselben Prüffällen.
 *
 * Gefragt wird nur nach der neuesten *veröffentlichten* Version (`/releases/latest`; Entwürfe und Vorabversionen zählen
 * dort nicht). Bis 25.11. fiel die Prüfung ersatzweise auf Git-Markierungen und die `package.json` im Hauptzweig zurück;
 * die meldeten dann eine „neue Version“, die es zum Herunterladen gar nicht gab.
 */

export const REPOSITORY = 'alpenglowsea/vereinsmanager';
export const ABFRAGE_ADRESSE = `https://api.github.com/repos/${REPOSITORY}/releases/latest`;
export const VERSIONEN_SEITE = `https://github.com/${REPOSITORY}/releases`;

export type Pruefergebnis =
  | { art: 'neuer'; version: string; seite: string; datei?: string; datum?: string }
  | { art: 'aktuell'; version: string }
  | { art: 'keineVeroeffentlicht' }
  | { art: 'fehler'; status: number };

/** Zerlegt „v1.2.0“ oder „1.2.0-beta“ in Zahlen; Zusätze nach „-“ oder „+“ zählen nicht. */
function teile(v: string): number[] {
  return v.trim().replace(/^v/i, '').split(/[-+]/)[0].split('.').map(n => parseInt(n, 10) || 0);
}

/** > 0, wenn a neuer ist als b; „1.0“ und „1.0.0“ sind gleich. */
export function vergleicheVersionen(a: string, b: string): number {
  const x = teile(a);
  const y = teile(b);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (x[i] || 0) - (y[i] || 0);
    if (d !== 0) return d > 0 ? 1 : -1;
  }
  return 0;
}

/**
 * Wertet die Antwort von GitHub aus.
 * @param status HTTP-Status; -1 heißt: keine Verbindung.
 * @param endungen Dateiendungen der Installationsdatei dieser Fassung, in Vorzugsreihenfolge (Desktop: .exe, .msi).
 */
export function werteAntwortAus(status: number, text: string | null, installiert: string, endungen: string[]): Pruefergebnis {
  if (status === 404) return { art: 'keineVeroeffentlicht' };
  if (status !== 200 || !text) return { art: 'fehler', status };
  let daten: any;
  try {
    daten = JSON.parse(text);
  } catch {
    return { art: 'fehler', status: 0 };
  }
  const version = String(daten?.tag_name ?? '').trim().replace(/^v/i, '');
  if (!version) return { art: 'fehler', status: 0 };
  if (vergleicheVersionen(version, installiert) <= 0) return { art: 'aktuell', version };
  const namen: string[] = Array.isArray(daten.assets) ? daten.assets.map((a: any) => String(a?.name ?? '')) : [];
  let datei: string | undefined;
  for (const e of endungen) {
    datei = namen.find(n => n.toLowerCase().endsWith(e));
    if (datei) break;
  }
  const seite = typeof daten.html_url === 'string' && daten.html_url.startsWith('https://github.com/') ? daten.html_url : VERSIONEN_SEITE;
  const datum = typeof daten.published_at === 'string' ? daten.published_at.slice(0, 10) : undefined;
  return { art: 'neuer', version, seite, datei, datum };
}

/**
 * Dateiendungen der Installationsdatei für das System, auf dem die Desktop-Fassung läuft (aus der Kennung des
 * Programmfensters). Der Bauablauf erzeugt je System genau eine: Windows .exe, macOS .dmg, Linux .AppImage.
 */
export function installationsEndungen(userAgent: string): string[] {
  if (/Windows/i.test(userAgent)) return ['.exe', '.msi'];
  if (/Macintosh|Mac OS X/i.test(userAgent)) return ['.dmg'];
  if (/Linux|X11/i.test(userAgent)) return ['.appimage'];
  return ['.exe', '.msi', '.dmg', '.appimage'];
}

/** Datum „2026-11-25“ als „25.11.2026“. */
function deutschesDatum(iso: string): string {
  const [j, m, t] = iso.split('-');
  return t && m && j ? `${t}.${m}.${j}` : iso;
}

/** Die Meldung für den Anwender. Am Handy wortgleich. */
export function ergebnisText(e: Pruefergebnis, installiert: string): string {
  switch (e.art) {
    case 'neuer':
      return (
        `Version ${e.version} ist erschienen` + (e.datum ? ` (${deutschesDatum(e.datum)})` : '') + `. Installiert ist ${installiert}.` +
        (e.datei ? ` Installationsdatei: ${e.datei}.` : ' Für diese Fassung liegt der neuen Version keine Installationsdatei bei.')
      );
    case 'aktuell': {
      const d = vergleicheVersionen(installiert, e.version);
      return d === 0
        ? `Sie haben die neueste Version (${installiert}).`
        : `Installiert ist ${installiert}, die neueste veröffentlichte Version ist ${e.version}. Ihre Fassung ist neuer.`;
    }
    case 'keineVeroeffentlicht':
      return 'Auf GitHub ist noch keine Version veröffentlicht.';
    case 'fehler':
      if (e.status === -1) return 'Keine Verbindung zu GitHub. Ist das Gerät mit dem Internet verbunden?';
      if (e.status === 403 || e.status === 429) return 'GitHub nimmt gerade keine Abfragen an (zu viele in kurzer Zeit). Bitte später noch einmal versuchen.';
      if (e.status === 0) return 'Die Antwort von GitHub ließ sich nicht lesen.';
      return `GitHub hat unerwartet geantwortet (Fehler ${e.status}).`;
  }
}
