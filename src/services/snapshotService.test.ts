import { describe, it, expect, afterEach, vi } from 'vitest';
import { SnapshotService } from './snapshotService';

// Der Snapshot-Dienst importiert den Speicher-Dienst und die Versionsangabe,
// die ihrerseits halbe Anwendung nachladen. Für diese Tests werden sie durch
// leere Attrappen ersetzt — geprüft wird nur das Löschen.
vi.mock('./storage', () => ({ StorageService: {} }));
vi.mock('./updateService', () => ({ CURRENT_APP_VERSION: 'test' }));

/**
 * Prüft `deleteAllSnapshots` gegen eine kleine, selbstgebaute Attrappe von
 * IndexedDB. Das belegt die Verdrahtung (richtige Datenbank, richtiger
 * Speicher, wird geleert, Fehler werden NICHT verschluckt, Verbindung wird
 * geschlossen) — nicht das Verhalten einer echten Browser-Datenbank.
 */

function baueAttrappe(optionen: { schreibFehler?: boolean } = {}) {
  const protokoll = {
    geoeffnet: [] as string[],
    geleert: [] as string[],
    geschlossen: false
  };
  const db = {
    objectStoreNames: { contains: () => true },
    close: () => {
      protokoll.geschlossen = true;
    },
    transaction: (_speicher: string, _modus: string) => {
      const tx: any = {
        objectStore: (name: string) => ({
          clear: () => {
            protokoll.geleert.push(name);
            queueMicrotask(() => {
              if (optionen.schreibFehler) {
                tx.error = new Error('Schreibfehler der Attrappe');
                tx.onerror?.();
              } else {
                tx.oncomplete?.();
              }
            });
          }
        })
      };
      return tx;
    }
  };
  const indexedDBAttrappe = {
    open: (name: string) => {
      protokoll.geoeffnet.push(name);
      const anfrage: any = {};
      queueMicrotask(() => {
        anfrage.result = db;
        anfrage.onsuccess?.();
      });
      return anfrage;
    }
  };
  return { protokoll, indexedDBAttrappe };
}

const urspruenglich = (globalThis as any).indexedDB;

afterEach(() => {
  (globalThis as any).indexedDB = urspruenglich;
});

describe('Snapshots: alle löschen', () => {
  it('leert den Snapshot-Speicher und schließt die Verbindung', async () => {
    const { protokoll, indexedDBAttrappe } = baueAttrappe();
    (globalThis as any).indexedDB = indexedDBAttrappe;

    await SnapshotService.deleteAllSnapshots();

    expect(protokoll.geoeffnet).toEqual(['VereinsManager_SnapshotsDB_v1']);
    expect(protokoll.geleert).toEqual(['snapshots']);
    expect(protokoll.geschlossen).toBe(true);
  });

  it('meldet einen Fehler, statt ihn zu verschlucken', async () => {
    const { protokoll, indexedDBAttrappe } = baueAttrappe({ schreibFehler: true });
    (globalThis as any).indexedDB = indexedDBAttrappe;

    await expect(SnapshotService.deleteAllSnapshots()).rejects.toThrow(/Schreibfehler/);
    expect(protokoll.geschlossen).toBe(true);
  });

  it('tut nichts, wenn es keine IndexedDB gibt', async () => {
    (globalThis as any).indexedDB = undefined;
    await expect(SnapshotService.deleteAllSnapshots()).resolves.toBeUndefined();
  });
});
