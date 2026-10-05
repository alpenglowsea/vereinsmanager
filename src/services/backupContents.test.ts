import { describe, it, expect } from 'vitest';
import {
  STORES,
  SICHERUNGS_BEREICHE,
  SicherungsSchluessel,
  vergleicheBereich,
  vergleicheSicherung,
  ergaenzeListe,
  ergaenzeEinzelstueck,
  ergaenzeStammdaten,
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

  it('fuehrt die zwei frueher vergessenen Bereiche', () => {
    // Diese fehlten bis Fassung 1.2 in der Sicherung. Wer umzog, verlor sie.
    for (const schluessel of ['folders', 'memberInventory'] as SicherungsSchluessel[]) {
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
    const vergleich = vergleicheBereich('memberInventory', undefined, [{ id: 'z1' }]);
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

describe('Datensicherung: Vereinsstammdaten beim Ergaenzen', () => {
  const platzhalter = {
    clubName: 'TSV Muster',
    associationNumber: 'VR 1',
    taxNumber: '111',
    boardMembers: [{ id: 'bm-1', role: 'Vors', name: 'Muster' }]
  };

  it('ersetzt unberuehrte Mustertexte durch die Angaben aus der Datei', () => {
    const datei = {
      clubName: 'SV Echt',
      associationNumber: 'VR 99',
      taxNumber: '222',
      boardMembers: [{ id: 'x', role: '1. Vorsitzender', name: 'Erika Echt' }]
    };
    const r = ergaenzeStammdaten(datei, { id: 'main', ...platzhalter }, platzhalter)!;
    expect(r.clubName).toBe('SV Echt');
    expect(r.associationNumber).toBe('VR 99');
    expect(r.taxNumber).toBe('222');
    expect(r.boardMembers).toEqual(datei.boardMembers);
  });

  it('behaelt Angaben, die hier selbst eingetragen wurden', () => {
    const vorhanden = { id: 'main', ...platzhalter, taxNumber: '333' };
    const r = ergaenzeStammdaten({ taxNumber: '222', associationNumber: 'VR 99' }, vorhanden, platzhalter)!;
    expect(r.taxNumber).toBe('333');
    expect(r.associationNumber).toBe('VR 99');
  });

  it('fuellt leere Felder und ueberschreibt nie mit leeren Werten', () => {
    const vorhanden = { id: 'main', ...platzhalter, taxNumber: '', clubName: 'Eigener Name' };
    const r = ergaenzeStammdaten({ taxNumber: '222', clubName: '' }, vorhanden, platzhalter)!;
    expect(r.taxNumber).toBe('222');
    expect(r.clubName).toBe('Eigener Name');
  });

  it('verwirft die Muster-Vorstandsliste, wenn die Datei nur aeltere Felder kennt', () => {
    const r = ergaenzeStammdaten({ chairman: 'Erika Echt' }, { id: 'main', ...platzhalter }, platzhalter)!;
    expect(r.boardMembers).toBeUndefined();
    expect(r.chairman).toBe('Erika Echt');
  });

  it('liefert den Bestand, wenn die Datei keine Stammdaten hat', () => {
    const vorhanden = { id: 'main', ...platzhalter };
    expect(ergaenzeStammdaten(undefined, vorhanden, platzhalter)).toBe(vorhanden);
  });
});
