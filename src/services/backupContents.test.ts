import { describe, it, expect } from 'vitest';
import {
  STORES,
  SICHERUNGS_BEREICHE,
  SicherungsSchluessel,
  vergleicheBereich,
  vergleicheSicherung,
  ergaenzeListe,
  ergaenzeBenutzer,
  ergaenzeEinzelstueck,
  leseSicherung
} from './backupContents';

describe('Datensicherung: Vollstaendigkeit der Bereiche', () => {
  it('sichert jeden Datenbereich der Anwendung', () => {
    // Denselben Sachverhalt prueft auch der Compiler
    // (pruefungAlleStoresGesichert). Hier steht er noch einmal als Test,
    // damit die Fehlermeldung im Klartext sagt, welcher Bereich fehlt.
    const gesichert = new Set(
      Object.values(SICHERUNGS_BEREICHE)
        .map(b => b.store)
        .filter(Boolean)
    );
    const fehlend = Object.values(STORES).filter(store => !gesichert.has(store));
    expect(fehlend).toEqual([]);
  });

  it('fuehrt die fuenf frueher vergessenen Bereiche', () => {
    // Diese fehlten bis Fassung 1.2 in der Sicherung. Wer umzog, verlor sie.
    for (const schluessel of [
      'folders',
      'surveys',
      'surveyResponses',
      'surveyTokens',
      'memberInventory'
    ] as SicherungsSchluessel[]) {
      expect(SICHERUNGS_BEREICHE[schluessel]).toBeDefined();
    }
  });
});

describe('Datensicherung: Abgleich mit dem vorhandenen Bestand', () => {
  it('zaehlt neue und vorhandene Eintraege getrennt', () => {
    const vergleich = vergleicheBereich(
      'members',
      [{ id: 'm1' }, { id: 'm2' }, { id: 'm3' }],
      [{ id: 'm2' }]
    );
    expect(vergleich.inDatei).toBe(3);
    expect(vergleich.vorhanden).toBe(1);
    expect(vergleich.neu).toBe(2);
    expect(vergleich.wirdUeberschrieben).toBe(1);
  });

  it('behandelt Eintraege ohne Kennung als neu', () => {
    const vergleich = vergleicheBereich('members', [{}, { id: 'm1' }], [{ id: 'm1' }]);
    expect(vergleich.neu).toBe(1);
    expect(vergleich.wirdUeberschrieben).toBe(1);
  });

  it('zaehlt Einzelstuecke als vorhanden oder nicht', () => {
    const mitBestand = vergleicheBereich('settings', { clubName: 'Neu' }, { clubName: 'Alt' });
    expect(mitBestand.inDatei).toBe(1);
    expect(mitBestand.vorhanden).toBe(1);
    expect(mitBestand.neu).toBe(0);
    expect(mitBestand.wirdUeberschrieben).toBe(1);

    const ohneBestand = vergleicheBereich('settings', { clubName: 'Neu' }, undefined);
    expect(ohneBestand.neu).toBe(1);
    expect(ohneBestand.wirdUeberschrieben).toBe(0);
  });

  it('kommt mit fehlenden Bereichen in der Datei zurecht', () => {
    // Alte Sicherungen kennen die neuen Bereiche nicht.
    const vergleich = vergleicheBereich('surveys', undefined, [{ id: 's1' }]);
    expect(vergleich.inDatei).toBe(0);
    expect(vergleich.neu).toBe(0);
    expect(vergleich.vorhanden).toBe(1);
  });

  it('vergleicht alle Bereiche auf einmal', () => {
    const alle = vergleicheSicherung({ members: [{ id: 'm1' }] }, { members: [] });
    expect(alle).toHaveLength(Object.keys(SICHERUNGS_BEREICHE).length);
    expect(alle.find(b => b.schluessel === 'members')?.neu).toBe(1);
  });
});

describe('Datensicherung: nur Fehlendes ergaenzen', () => {
  it('laesst vorhandene Eintraege unangetastet', () => {
    const ergebnis = ergaenzeListe(
      [
        { id: 'm1', name: 'aus der Datei' },
        { id: 'm2', name: 'neu' }
      ],
      [{ id: 'm1', name: 'hier vorhanden' }]
    );
    expect(ergebnis).toHaveLength(2);
    expect(ergebnis.find(e => e.id === 'm1')?.name).toBe('hier vorhanden');
    expect(ergebnis.find(e => e.id === 'm2')?.name).toBe('neu');
  });

  it('haelt Konten mit gleichem Anmeldenamen heraus', () => {
    // Zwei Konten mit demselben Anmeldenamen waeren nicht mehr unterscheidbar.
    const ergebnis = ergaenzeBenutzer(
      [
        { id: 'u9', username: 'Admin' },
        { id: 'u2', username: 'kassenwart' }
      ],
      [{ id: 'u1', username: 'admin' }]
    );
    expect(ergebnis.map(u => u.id)).toEqual(['u1', 'u2']);
  });

  it('nimmt ein Einzelstueck nur, wenn hier keines liegt', () => {
    expect(ergaenzeEinzelstueck({ a: 1 }, { a: 2 })).toEqual({ a: 2 });
    expect(ergaenzeEinzelstueck({ a: 1 }, undefined)).toEqual({ a: 1 });
    expect(ergaenzeEinzelstueck(undefined, undefined)).toBeNull();
  });
});

describe('Datensicherung: Datei einlesen', () => {
  const gueltig = JSON.stringify({
    app: 'VereinsManager Lokal',
    version: '1.2.3',
    exportedAt: '2026-09-19T10:00:00.000Z',
    data: { members: [{ id: 'm1' }], settings: { clubName: 'TSV Musterstadt 1890 e.V.' } }
  });

  it('liest Kopfdaten und Inhalt', () => {
    const { kopf, daten } = leseSicherung(gueltig);
    expect(kopf.clubName).toBe('TSV Musterstadt 1890 e.V.');
    expect(kopf.exportedAt).toBe('2026-09-19T10:00:00.000Z');
    expect((daten.members as unknown[]).length).toBe(1);
  });

  it('nimmt auch eine Datei ohne data-Huelle', () => {
    const { daten } = leseSicherung(JSON.stringify({ members: [{ id: 'm1' }] }));
    expect((daten.members as unknown[]).length).toBe(1);
  });

  it('weist eine kaputte Datei mit verstaendlicher Meldung ab', () => {
    expect(() => leseSicherung('{ kein json')).toThrow(/JSON/);
  });

  it('weist eine fremde Datei ab', () => {
    // Sonst liefe der Einspielvorgang an und leerte den Bestand.
    expect(() => leseSicherung(JSON.stringify({ irgendwas: 1 }))).toThrow(/Datensicherung/);
  });
});
