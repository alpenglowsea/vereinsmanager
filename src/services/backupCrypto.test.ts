import { describe, it, expect } from 'vitest';
import {
  kannVerschluesseln,
  istVerschluesselt,
  verschluessleSicherung,
  entschluessleSicherung,
  VERSCHLUESSELT_FORMAT
} from './backupCrypto';
import { leseSicherung } from './backupContents';

const BEISPIEL = JSON.stringify({
  app: 'VereinsManager Lokal',
  version: '1.2.3',
  exportedAt: '2026-10-05T10:00:00.000Z',
  data: {
    members: [{ id: 'm1', firstName: 'Erika', lastName: 'Müßiggang', iban: 'DE89370501980000012345' }],
    settings: { clubName: 'SV Geheim e.V.', taxNumber: '123/456/78901' }
  }
});

describe('Verschlüsselte Datensicherung', () => {
  it('steht in der Testumgebung zur Verfügung', () => {
    expect(kannVerschluesseln()).toBe(true);
  });

  it('gibt nach dem Verschlüsseln und Entschlüsseln den Originaltext zurück', async () => {
    const huelle = await verschluessleSicherung(BEISPIEL, 'ein-gutes-passwort');
    expect(await entschluessleSicherung(huelle, 'ein-gutes-passwort')).toBe(BEISPIEL);
  });

  it('lässt im verschlüsselten Text nichts Lesbares zurück', async () => {
    const huelle = await verschluessleSicherung(BEISPIEL, 'ein-gutes-passwort');
    for (const geheim of ['Erika', 'Müßiggang', 'DE89370501980000012345', 'SV Geheim', '123/456/78901']) {
      expect(huelle).not.toContain(geheim);
    }
  });

  it('wird als verschlüsselt erkannt, die Klartextsicherung nicht', async () => {
    const huelle = await verschluessleSicherung(BEISPIEL, 'ein-gutes-passwort');
    expect(istVerschluesselt(huelle)).toBe(true);
    expect(JSON.parse(huelle).format).toBe(VERSCHLUESSELT_FORMAT);
    expect(istVerschluesselt(BEISPIEL)).toBe(false);
    expect(istVerschluesselt('kein json')).toBe(false);
    expect(istVerschluesselt('null')).toBe(false);
  });

  it('weist ein falsches Passwort ab', async () => {
    const huelle = await verschluessleSicherung(BEISPIEL, 'ein-gutes-passwort');
    await expect(entschluessleSicherung(huelle, 'ein-falsches-passwort')).rejects.toThrow(/Passwort/);
  });

  it('erkennt eine veränderte Datei', async () => {
    const huelle = JSON.parse(await verschluessleSicherung(BEISPIEL, 'ein-gutes-passwort'));
    // Ein Zeichen der verschlüsselten Daten austauschen
    const z = huelle.daten[10] === 'A' ? 'B' : 'A';
    huelle.daten = huelle.daten.slice(0, 10) + z + huelle.daten.slice(11);
    await expect(entschluessleSicherung(JSON.stringify(huelle), 'ein-gutes-passwort')).rejects.toThrow();
  });

  it('erzeugt bei gleicher Eingabe jedes Mal eine andere Datei', async () => {
    const a = await verschluessleSicherung(BEISPIEL, 'ein-gutes-passwort');
    const b = await verschluessleSicherung(BEISPIEL, 'ein-gutes-passwort');
    expect(a).not.toBe(b);
  });

  it('verlangt ein Passwort von mindestens acht Zeichen', async () => {
    await expect(verschluessleSicherung(BEISPIEL, 'kurz')).rejects.toThrow(/mindestens 8/);
  });

  it('lehnt unbrauchbare Werte aus einer fremden Datei ab', async () => {
    const huelle = JSON.parse(await verschluessleSicherung(BEISPIEL, 'ein-gutes-passwort'));
    huelle.iterations = 1; // würde das Passwort praktisch ungeschützt lassen
    await expect(entschluessleSicherung(JSON.stringify(huelle), 'ein-gutes-passwort')).rejects.toThrow(/beschädigt/);
    await expect(entschluessleSicherung(BEISPIEL, 'ein-gutes-passwort')).rejects.toThrow(/keine verschlüsselte/);
  });

  it('liefert nach dem Entschlüsseln eine Datei, die die App einlesen kann', async () => {
    const huelle = await verschluessleSicherung(BEISPIEL, 'ein-gutes-passwort');
    const klar = await entschluessleSicherung(huelle, 'ein-gutes-passwort');
    const { daten } = leseSicherung(klar);
    expect((daten as any).members).toHaveLength(1);
  });

  it('verarbeitet auch große Sicherungen (mehrere Megabyte)', async () => {
    const gross = JSON.stringify({ data: { documents: [{ id: 'd1', inhalt: 'x'.repeat(5_000_000) }] } });
    const huelle = await verschluessleSicherung(gross, 'ein-gutes-passwort');
    expect((await entschluessleSicherung(huelle, 'ein-gutes-passwort')).length).toBe(gross.length);
  });
});
