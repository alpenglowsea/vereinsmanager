import { describe, it, expect } from 'vitest';
import { vergleicheVersionen, werteAntwortAus, ergebnisText, installationsEndungen, VERSIONEN_SEITE } from './versionspruefung';

// Dieselben Fälle prüft android/core/src/test/.../settings/VersionspruefungTest.kt.
const EXE = ['.exe', '.msi'];
const antwort = (tag: string, dateien: string[] = [], extra: Record<string, unknown> = {}) =>
  JSON.stringify({
    tag_name: tag,
    html_url: `https://github.com/alpenglowsea/vereinsmanager/releases/tag/${tag}`,
    published_at: '2026-12-01T10:00:00Z',
    assets: dateien.map(name => ({ name })),
    ...extra,
  });

describe('Versionsprüfung', () => {
  it('vergleicht Versionen nach Zahlen, nicht nach Text', () => {
    expect(vergleicheVersionen('1.10.0', '1.9.0')).toBe(1);
    expect(vergleicheVersionen('v1.1.0', '1.1')).toBe(0);
    expect(vergleicheVersionen('1.0', '1.0.1')).toBe(-1);
    expect(vergleicheVersionen('1.2.0-beta', '1.2.0')).toBe(0);
  });

  it('neuere Version mit passender Datei', () => {
    const e = werteAntwortAus(200, antwort('v1.2.0', ['VereinsManager.apk', 'VereinsManager_1.2.0_x64-setup.exe', 'VereinsManager_1.2.0_x64.msi']), '1.1.0', EXE);
    expect(e).toEqual({
      art: 'neuer', version: '1.2.0', seite: 'https://github.com/alpenglowsea/vereinsmanager/releases/tag/v1.2.0',
      datei: 'VereinsManager_1.2.0_x64-setup.exe', datum: '2026-12-01',
    });
    expect(ergebnisText(e, '1.1.0')).toBe(
      'Version 1.2.0 ist erschienen (01.12.2026). Installiert ist 1.1.0. Installationsdatei: VereinsManager_1.2.0_x64-setup.exe.',
    );
  });

  it('neuere Version ohne Datei für diese Fassung', () => {
    const e = werteAntwortAus(200, antwort('v1.2.0', ['VereinsManager.apk']), '1.1.0', EXE);
    expect(e.art === 'neuer' && e.datei).toBe(undefined);
    expect(ergebnisText(e, '1.1.0')).toBe(
      'Version 1.2.0 ist erschienen (01.12.2026). Installiert ist 1.1.0. Für diese Fassung liegt der neuen Version keine Installationsdatei bei.',
    );
  });

  it('gleiche oder ältere Version', () => {
    const gleich = werteAntwortAus(200, antwort('v1.1.0'), '1.1.0', EXE);
    expect(gleich).toEqual({ art: 'aktuell', version: '1.1.0' });
    expect(ergebnisText(gleich, '1.1.0')).toBe('Sie haben die neueste Version (1.1.0).');
    expect(ergebnisText(werteAntwortAus(200, antwort('v1.0.0'), '1.0', EXE), '1.0')).toBe('Sie haben die neueste Version (1.0).');
    const aelter = werteAntwortAus(200, antwort('v1.0.0'), '1.1.0', EXE);
    expect(ergebnisText(aelter, '1.1.0')).toBe('Installiert ist 1.1.0, die neueste veröffentlichte Version ist 1.0.0. Ihre Fassung ist neuer.');
  });

  it('fremde Adresse wird durch die Versionsseite ersetzt', () => {
    const e = werteAntwortAus(200, antwort('v2.0.0', [], { html_url: 'https://example.com/x' }), '1.1.0', EXE);
    expect(e.art === 'neuer' && e.seite).toBe(VERSIONEN_SEITE);
  });

  it('nichts veröffentlicht, Fehler, keine Verbindung', () => {
    expect(ergebnisText(werteAntwortAus(404, '{}', '1.1.0', EXE), '1.1.0')).toBe('Auf GitHub ist noch keine Version veröffentlicht.');
    expect(ergebnisText(werteAntwortAus(-1, null, '1.1.0', EXE), '1.1.0')).toBe('Keine Verbindung zu GitHub. Ist das Gerät mit dem Internet verbunden?');
    expect(ergebnisText(werteAntwortAus(403, '{}', '1.1.0', EXE), '1.1.0')).toBe(
      'GitHub nimmt gerade keine Abfragen an (zu viele in kurzer Zeit). Bitte später noch einmal versuchen.',
    );
    expect(ergebnisText(werteAntwortAus(200, 'kein json', '1.1.0', EXE), '1.1.0')).toBe('Die Antwort von GitHub ließ sich nicht lesen.');
    expect(ergebnisText(werteAntwortAus(200, '{"name":"ohne Tag"}', '1.1.0', EXE), '1.1.0')).toBe('Die Antwort von GitHub ließ sich nicht lesen.');
    expect(ergebnisText(werteAntwortAus(500, 'x', '1.1.0', EXE), '1.1.0')).toBe('GitHub hat unerwartet geantwortet (Fehler 500).');
  });

  it('wählt die Installationsdatei nach System (Desktop)', () => {
    const dateien = ['VereinsManager_2.1.0_x64-setup.exe', 'VereinsManager_2.1.0_aarch64.dmg', 'VereinsManager_2.1.0_amd64.AppImage', 'VereinsManager_2.1.0_android.apk'];
    const datei = (ua: string) => {
      const e = werteAntwortAus(200, antwort('v2.1.0', dateien), '2.0.0', installationsEndungen(ua));
      return e.art === 'neuer' ? e.datei : null;
    };
    expect(datei('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Edg/131.0')).toBe('VereinsManager_2.1.0_x64-setup.exe');
    expect(datei('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15')).toBe('VereinsManager_2.1.0_aarch64.dmg');
    expect(datei('Mozilla/5.0 (X11; Ubuntu; Linux x86_64) AppleWebKit/605.1.15')).toBe('VereinsManager_2.1.0_amd64.AppImage');
  });
});
