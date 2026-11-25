import { describe, it, expect } from 'vitest';
import {
  STANDARD_ARTEN, leseArten, standardArt, artName, istBeitragsfrei, unter18Art, antragsArten, pruefeArten,
  neueArt, artLoeschen, artWiederherstellen, artVerschieben, anzahlMitglieder, artAusText, ohneEhrenStatus, artenZumSpeichern
} from './mitgliedsarten';

describe('Mitgliedsarten', () => {
  it('ohne gespeicherte Liste gelten die sechs bisherigen Arten mit ihren Regeln', () => {
    const a = leseArten(undefined);
    expect(a.map(x => x.id)).toEqual(['full', 'reduced', 'youth', 'family', 'supporting', 'honorary']);
    expect(standardArt(a)).toBe('full');
    expect(istBeitragsfrei(a, 'honorary')).toBe(true);
    expect(istBeitragsfrei(a, 'full')).toBe(false);
    expect(unter18Art(a)).toBe('youth');
    expect(antragsArten(a).map(x => x.id)).toEqual(['full', 'reduced', 'youth', 'family', 'supporting']);
    expect(leseArten('kaputt')).toEqual(STANDARD_ARTEN);
  });

  it('liest eine eigene Liste; Unbrauchbares und Austrittsvermerke fallen weg', () => {
    const a = leseArten([
      { id: 'erw', name: '  Erwachsene ', imAntrag: true },
      { id: 'erw', name: 'doppelt' },
      { id: 'ausgetreten', name: 'nein' },
      { id: '', name: 'ohne Kennung' },
      { id: 'kids', name: '', unter18: true, beitragsfrei: 'ja' },
      'quatsch'
    ]);
    expect(a).toEqual([{ id: 'erw', name: 'Erwachsene', imAntrag: true }, { id: 'kids', name: 'kids', unter18: true }]);
    // Nur gelöschte Arten: zurück zu den Standardarten
    expect(leseArten([{ id: 'x', name: 'X', geloescht: true }]).length).toBe(6);
  });

  it('Namen: gelöscht, unbekannt, Austritt', () => {
    const a = artLoeschen(leseArten(undefined), 'family');
    expect(artName(a, 'family')).toBe('Familie (gelöscht)');
    expect(artName(a, 'unbekannt')).toBe('unbekannt');
    expect(artName(a, 'ausgetreten')).toBe('Ausgetreten');
    expect(artName(a, undefined)).toBe('–');
    expect(artName(artWiederherstellen(a, 'family'), 'family')).toBe('Familie');
    // Gespeichert werden nur eingeschaltete Schalter (wie Android)
    expect(artenZumSpeichern(artLoeschen(a, 'youth')).find(x => x.id === 'youth')).toEqual({ id: 'youth', name: 'Jugend / Kinder', imAntrag: true, geloescht: true });
    // Gelöscht verliert den Vorschlag für unter 18
    expect(unter18Art(artLoeschen(a, 'youth'))).toBeNull();
    // Die erste nicht gelöschte ist die Vorgabe
    expect(standardArt(artLoeschen(a, 'full'))).toBe('reduced');
  });

  it('Prüfung: Name, doppelt, höchstens ein Vorschlag für unter 18, mindestens eine Art', () => {
    const a = leseArten(undefined);
    expect(pruefeArten(a)).toEqual({});
    const b = a.map(x => (x.id === 'reduced' ? { ...x, name: 'vollmitglied ' } : x.id === 'family' ? { ...x, name: ' ' } : x));
    expect(pruefeArten(b)).toEqual({ 'name.reduced': 'Diesen Namen gibt es schon.', 'name.family': 'Bitte einen Namen eingeben.' });
    expect(pruefeArten(a.map(x => ({ ...x, unter18: true }))).liste).toMatch(/Nur eine Art/);
    expect(pruefeArten(a.map(x => ({ ...x, geloescht: true }))).liste).toMatch(/Mindestens eine/);
    // Ein gelöschter Name darf wiederverwendet werden
    expect(pruefeArten([...artLoeschen(a, 'family'), { id: 'n', name: 'Familie' }])).toEqual({});
  });

  it('neue Art, Reihenfolge, Anzahl', () => {
    const a = leseArten(undefined);
    const n = neueArt(a, ' Senioren ', 1000);
    expect(n).toEqual({ id: 'art-rs', name: 'Senioren', imAntrag: true });
    expect(neueArt([...a, n], 'x', 1000).id).toBe('art-rs-2');
    expect(artVerschieben(a, 'reduced', -1).map(x => x.id).slice(0, 2)).toEqual(['reduced', 'full']);
    expect(artVerschieben(a, 'full', -1)).toEqual(a);
    const ms = [{ membershipType: 'youth', status: 'active' }, { membershipType: 'youth', status: 'terminated' }, { membershipType: 'full' }];
    expect(anzahlMitglieder(ms, 'youth')).toBe(2);
  });

  it('Import: genauer Name, Stichwort, Alter, Vorgabe', () => {
    const a = [...leseArten(undefined), { id: 'art-sen', name: 'Senioren 65+' }];
    expect(artAusText(a, 'senioren 65+')).toBe('art-sen');
    expect(artAusText(a, 'Jugendlicher')).toBe('youth');
    expect(artAusText(a, 'Ehrenmitglied')).toBe('honorary');
    expect(artAusText(a, 'irgendwas', 12)).toBe('youth');
    expect(artAusText(a, '', 40)).toBe('full');
    // Stichwort einer gelöschten Art greift nicht
    expect(artAusText(artLoeschen(a, 'youth'), 'Jugend', 12)).toBe('full');
  });

  it('Status „Ehrenmitglied“ wird zur Art; der Beitrag bleibt', () => {
    expect(ohneEhrenStatus({ status: 'honorary', membershipType: 'full', feeAmount: 20 })).toEqual({ status: 'active', membershipType: 'honorary', feeAmount: 20 });
    expect(ohneEhrenStatus({ status: 'active', membershipType: 'honorary' })).toBeNull();
  });
});
