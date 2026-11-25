import { StorageService } from './storage';
import { CURRENT_APP_VERSION } from './updateService';
import { schnappschussGruppe, schnappschuesseZuLoeschen, taeglicherFaellig } from '../utils/schnappschussRegeln';

/**
 * Kopfdaten eines Schnappschusses: das, was die Liste in den Einstellungen
 * zeigt. Der eigentliche Inhalt (die vollständige Sicherung samt Dateien)
 * liegt seit dem 25.11.2026 in einem eigenen Speicher und wird nur beim
 * Wiederherstellen geladen. Vorher stand er im selben Datensatz, und Liste wie
 * Aufräumen luden bei jedem Aufruf alle Kopien vollständig in den Speicher.
 */
export interface AutoSnapshot {
  id: string;
  timestamp: string;
  version: string;
  reason: 'pre_update' | 'periodic' | 'manual' | 'startup';
  label: string;
  summary: {
    membersCount: number;
    transactionsCount: number;
    accountsCount: number;
    contactsCount: number;
    invoicesCount: number;
    meetingsCount: number;
    inventoryCount: number;
    documentsCount: number;
    donationsCount: number;
  };
}

const SNAPSHOTS_DB_NAME = 'VereinsManager_SnapshotsDB_v1';
const SNAPSHOTS_STORE = 'snapshots';
/** Inhalt je Schnappschuss: { id, data } mit der Sicherung als Text. */
const DATEN_STORE = 'snapshot_daten';
const SNAPSHOTS_DB_VERSION = 2;

function openSnapshotsDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      return reject(new Error('IndexedDB nicht verfügbar.'));
    }
    const req = indexedDB.open(SNAPSHOTS_DB_NAME, SNAPSHOTS_DB_VERSION);
    req.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(SNAPSHOTS_STORE)) {
        db.createObjectStore(SNAPSHOTS_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(DATEN_STORE)) {
        db.createObjectStore(DATEN_STORE, { keyPath: 'id' });
        // Umzug aus Version 1: Inhalt aus den Kopfdaten in den eigenen Speicher.
        // Der Cursor liest die alten Schnappschüsse einzeln, nie alle zugleich.
        const tx = req.transaction;
        if (tx && (event.oldVersion || 0) >= 1) {
          const daten = tx.objectStore(DATEN_STORE);
          const cur = tx.objectStore(SNAPSHOTS_STORE).openCursor();
          cur.onsuccess = () => {
            const c = cur.result;
            if (!c) return;
            const alt = c.value as AutoSnapshot & { data?: string };
            if (typeof alt.data === 'string') {
              daten.put({ id: alt.id, data: alt.data });
              const { data: _weg, ...kopf } = alt;
              c.update(kopf);
            }
            c.continue();
          };
        }
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Liest nur die Kopfdaten aller Schnappschüsse (klein), neueste zuerst. */
async function leseKopfdaten(db: IDBDatabase): Promise<AutoSnapshot[]> {
  return new Promise<AutoSnapshot[]>((resolve, reject) => {
    const req = db.transaction(SNAPSHOTS_STORE, 'readonly').objectStore(SNAPSHOTS_STORE).getAll();
    req.onsuccess = () => {
      const snaps = (req.result || []) as AutoSnapshot[];
      snaps.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      resolve(snaps);
    };
    req.onerror = () => reject(req.error);
  });
}

export class SnapshotService {
  /**
   * Legt einen Schnappschuss an: eine vollständige Kopie des Bestands in einer
   * eigenen Datenbank. Seit 25.11.2026 nur noch einmal am Tag beim Start
   * (`startup`, siehe `taeglichAnlegen`) und vor riskanten Schritten
   * (`manual`: Einspielen, Wiederherstellen, Auslagern, „Jetzt anlegen“).
   * Behalten werden die 3 letzten täglichen und die 2 letzten anderen.
   */
  public static async createSnapshot(
    reason: 'pre_update' | 'periodic' | 'manual' | 'startup',
    label?: string
  ): Promise<AutoSnapshot | null> {
    try {
      const now = Date.now();
      const jsonBackup = await StorageService.exportFullBackup();
      const parsed = JSON.parse(jsonBackup);
      const data = parsed.data || {};

      const membersCount = data.members?.length || 0;
      const transactionsCount = data.transactions?.length || 0;
      const accountsCount = data.accounts?.length || 0;
      const contactsCount = data.contacts?.length || 0;
      const invoicesCount = data.invoices?.length || 0;
      const meetingsCount = data.meetings?.length || 0;
      const inventoryCount = data.inventory?.length || 0;
      const documentsCount = data.documents?.length || 0;
      const donationsCount = data.donations?.length || 0;

      // Nur speichern, wenn es überhaupt Daten gibt
      const totalRecords = membersCount + transactionsCount + contactsCount + invoicesCount + meetingsCount;
      if (totalRecords === 0 && reason !== 'manual') {
        return null;
      }

      let generatedLabel = label;
      if (!generatedLabel) {
        switch (reason) {
          case 'pre_update':
            generatedLabel = `Sicherheits-Snapshot vor Update (${CURRENT_APP_VERSION})`;
            break;
          case 'startup':
          case 'periodic':
            generatedLabel = `Täglicher Snapshot`;
            break;
          case 'manual':
          default:
            generatedLabel = `Manuell erstellter Snapshot`;
            break;
        }
      }

      const snapshot: AutoSnapshot = {
        id: `snap-${now}-${Math.random().toString(36).substring(2, 6)}`,
        timestamp: new Date(now).toISOString(),
        version: CURRENT_APP_VERSION,
        reason,
        label: generatedLabel,
        summary: {
          membersCount,
          transactionsCount,
          accountsCount,
          contactsCount,
          invoicesCount,
          meetingsCount,
          inventoryCount,
          documentsCount,
          donationsCount
        }
      };

      const db = await openSnapshotsDB();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction([SNAPSHOTS_STORE, DATEN_STORE], 'readwrite');
        tx.objectStore(DATEN_STORE).put({ id: snapshot.id, data: jsonBackup });
        tx.objectStore(SNAPSHOTS_STORE).put(snapshot);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });

      await this.pruneSnapshots();
      return snapshot;
    } catch (err) {
      console.warn('[SnapshotService] Fehler beim Erstellen des Snapshots:', err);
      return null;
    }
  }

  /**
   * Beim Start: legt den täglichen Schnappschuss an, wenn der letzte tägliche
   * älter als 20 Stunden ist (wie am Handy). Liest dafür nur Kopfdaten.
   */
  public static async taeglichAnlegen(jetzt: Date = new Date()): Promise<AutoSnapshot | null> {
    try {
      const db = await openSnapshotsDB();
      const liste = await leseKopfdaten(db);
      if (!taeglicherFaellig(liste, jetzt)) return null;
      return await this.createSnapshot('startup');
    } catch (err) {
      console.warn('[SnapshotService] Täglicher Snapshot nicht möglich:', err);
      return null;
    }
  }

  /**
   * Ruft alle gespeicherten Snapshots chronologisch sortiert ab (neueste zuerst).
   */
  public static async getSnapshots(): Promise<AutoSnapshot[]> {
    try {
      return await leseKopfdaten(await openSnapshotsDB());
    } catch (err) {
      console.warn('[SnapshotService] Fehler beim Lesen der Snapshots:', err);
      return [];
    }
  }

  /**
   * Stellt einen Snapshot mit einem Klick vollständig wieder her.
   */
  public static async restoreSnapshot(snapshotId: string): Promise<{
    success: boolean;
    snapshot?: AutoSnapshot;
    counts?: {
      membersCount: number;
      transactionsCount: number;
      contactsCount: number;
      invoicesCount: number;
      meetingsCount: number;
    };
    error?: string;
  }> {
    try {
      const db = await openSnapshotsDB();
      const [snapshot, inhalt] = await new Promise<[AutoSnapshot | null, string | null]>((resolve, reject) => {
        const tx = db.transaction([SNAPSHOTS_STORE, DATEN_STORE], 'readonly');
        const kopf = tx.objectStore(SNAPSHOTS_STORE).get(snapshotId);
        const daten = tx.objectStore(DATEN_STORE).get(snapshotId);
        tx.oncomplete = () => resolve([kopf.result || null, (daten.result && daten.result.data) || null]);
        tx.onerror = () => reject(tx.error);
      });

      if (!snapshot || !inhalt) {
        return { success: false, error: 'Snapshot nicht gefunden oder leer.' };
      }

      // Die Sicherheitskopie des jetzigen Stands legt importFullBackup selbst an
      // („Sicherheitskopie vor dem Einspielen …“). Eine zweite hier verdrängte
      // bei nur 2 behaltenen Kopien „vor Änderungen“ alle anderen.
      const counts = await StorageService.importFullBackup(inhalt);

      return {
        success: true,
        snapshot,
        counts: {
          membersCount: counts.membersCount,
          transactionsCount: counts.transactionsCount,
          contactsCount: counts.contactsCount,
          invoicesCount: counts.invoicesCount,
          meetingsCount: counts.meetingsCount
        }
      };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Wiederherstellung fehlgeschlagen.' };
    }
  }

  /**
   * Löscht einen bestimmten Snapshot
   */
  public static async deleteSnapshot(snapshotId: string): Promise<void> {
    try {
      const db = await openSnapshotsDB();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction([SNAPSHOTS_STORE, DATEN_STORE], 'readwrite');
        tx.objectStore(SNAPSHOTS_STORE).delete(snapshotId);
        tx.objectStore(DATEN_STORE).delete(snapshotId);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (err) {
      console.warn('[SnapshotService] Fehler beim Löschen des Snapshots:', err);
    }
  }

  /**
   * Löscht ALLE Snapshots.
   *
   * Wird von "Alle lokalen Daten löschen" aufgerufen. Ohne diesen Schritt
   * blieben bis zu fünf vollständige Kopien des Datenbestands zurück.
   *
   * Anders als `deleteSnapshot` schluckt diese Funktion Fehler bewusst NICHT:
   * Wer "alles löschen" wählt, muss erfahren, wenn etwas stehen geblieben ist.
   * Ist die Snapshot-Datenbank gar nicht erst verfügbar, gibt es auch nichts
   * zu löschen.
   */
  public static async deleteAllSnapshots(): Promise<void> {
    if (typeof indexedDB === 'undefined') return;
    const db = await openSnapshotsDB();
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction([SNAPSHOTS_STORE, DATEN_STORE], 'readwrite');
        tx.objectStore(SNAPSHOTS_STORE).clear();
        tx.objectStore(DATEN_STORE).clear();
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
    } finally {
      db.close();
    }
  }

  /**
   * Behält die 3 letzten täglichen und die 2 letzten anderen Schnappschüsse
   * (Regel in `schnappschussRegeln.ts`). Liest nur Kopfdaten.
   */
  private static async pruneSnapshots(): Promise<void> {
    try {
      const db = await openSnapshotsDB();
      const weg = schnappschuesseZuLoeschen(await leseKopfdaten(db));
      if (weg.length === 0) return;
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction([SNAPSHOTS_STORE, DATEN_STORE], 'readwrite');
        weg.forEach(id => {
          tx.objectStore(SNAPSHOTS_STORE).delete(id);
          tx.objectStore(DATEN_STORE).delete(id);
        });
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (e) {
      console.warn('[SnapshotService] Fehler beim Aufräumen alter Snapshots:', e);
    }
  }
}

/** Für die Anzeige: „täglich“ oder „vor einer Änderung“. */
export const snapshotArt = (s: Pick<AutoSnapshot, 'reason'>) => (schnappschussGruppe(s.reason) === 'taeglich' ? 'täglich' : 'vor einer Änderung');
