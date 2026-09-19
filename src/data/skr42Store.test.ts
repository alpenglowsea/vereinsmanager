import { describe, it, expect, beforeEach } from 'vitest';
import { SKR42_STRUCTURE } from './taxSpheres';
import {
  subscribeSkr42,
  getSkr42Snapshot,
  notifySkr42Changed,
  resetSkr42StoreForTests
} from './skr42Store';
import { Skr42MainCategory } from '../types';

const testKonto = (code: string): Skr42MainCategory => ({
  id: `custom-${code}`,
  code,
  name: `Testkonto ${code}`,
  sphere: 'ideell',
  type: 'income',
  isCustom: true,
  subCategories: []
});

describe('SKR-42-Speicher', () => {
  beforeEach(() => {
    resetSkr42StoreForTests();
    // Testkonten aus vorherigen Durchläufen entfernen.
    for (let i = SKR42_STRUCTURE.length - 1; i >= 0; i--) {
      if (SKR42_STRUCTURE[i].id.startsWith('custom-9')) SKR42_STRUCTURE.splice(i, 1);
    }
  });

  it('gibt zwischen zwei Aenderungen immer dasselbe Array zurueck', () => {
    // Das ist die wichtigste Eigenschaft ueberhaupt: React ruft diese
    // Funktion bei jedem Rendern auf und vergleicht das Ergebnis mit dem
    // vorherigen. Kaeme jedes Mal ein neues Array, zeichnete React endlos
    // neu und die Anwendung bliebe stehen.
    const a = getSkr42Snapshot();
    const b = getSkr42Snapshot();
    const c = getSkr42Snapshot();
    expect(a).toBe(b);
    expect(b).toBe(c);
  });

  it('gibt nach einer Aenderung ein anderes Array zurueck', () => {
    // Die Kehrseite: Bliebe es dasselbe, bemerkte React die Aenderung nicht
    // und ein neu angelegtes Konto tauchte in keiner Liste auf.
    const vorher = getSkr42Snapshot();
    SKR42_STRUCTURE.push(testKonto('90001'));
    notifySkr42Changed();
    const nachher = getSkr42Snapshot();
    expect(nachher).not.toBe(vorher);
    expect(nachher.some(m => m.code === '90001')).toBe(true);
  });

  it('enthaelt das neue Konto bereits beim ersten Abruf nach der Meldung', () => {
    // Sonst bekaeme der erste benachrichtigte Zuhoerer noch den alten Stand.
    let gesehen: readonly Skr42MainCategory[] = [];
    subscribeSkr42(() => {
      gesehen = getSkr42Snapshot();
    });
    SKR42_STRUCTURE.push(testKonto('90002'));
    notifySkr42Changed();
    expect(gesehen.some(m => m.code === '90002')).toBe(true);
  });

  it('benachrichtigt alle Zuhoerer', () => {
    // Buchungsmaske und Splitbuchungs-Maske koennen gleichzeitig offen sein.
    let a = 0;
    let b = 0;
    subscribeSkr42(() => a++);
    subscribeSkr42(() => b++);
    notifySkr42Changed();
    expect(a).toBe(1);
    expect(b).toBe(1);
  });

  it('benachrichtigt nicht mehr, wer sich abgemeldet hat', () => {
    // Ohne das sammelte jede geschlossene Maske einen Zuhoerer an, der
    // weiterlaeuft — ein Speicherleck, das mit der Zeit waechst.
    let zaehler = 0;
    const abmelden = subscribeSkr42(() => zaehler++);
    notifySkr42Changed();
    abmelden();
    notifySkr42Changed();
    expect(zaehler).toBe(1);
  });

  it('kommt damit zurecht, dass ein Zuhoerer sich waehrend der Meldung abmeldet', () => {
    // Genau das passiert, wenn eine Maske sich aufgrund der Aenderung
    // schliesst. Wird dabei ueber die Original-Liste gelaufen, ueberspringt
    // die Schleife den naechsten Eintrag oder bricht ab.
    let zweiterLief = false;
    const abmelden = subscribeSkr42(() => abmelden());
    subscribeSkr42(() => {
      zweiterLief = true;
    });
    notifySkr42Changed();
    expect(zweiterLief).toBe(true);
  });

  it('gibt den Kontenrahmen vollstaendig heraus', () => {
    const stand = getSkr42Snapshot();
    expect(stand.length).toBe(SKR42_STRUCTURE.length);
    expect(stand.length).toBeGreaterThan(0);
  });
});
