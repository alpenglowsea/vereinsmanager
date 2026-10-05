import { StorageService } from './storage';
import { CURRENT_APP_VERSION } from './updateService';

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
  data: string; // JSON String der Datensicherung
}

const SNAPSHOTS_DB_NAME = 'VereinsManager_SnapshotsDB_v1';
const SNAPSHOTS_STORE = 'snapshots';
const SNAPSHOTS_DB_VERSION = 1;
const MAX_SNAPSHOTS = 12;

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
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export class SnapshotService {
  private static lastSnapshotTime = 0;

  /**
   * Erstellt einen automatischen Sicherheits-Snapshot der aktuellen Datenbank.
   * Läuft in einer komplett isolierten IndexedDB-Instanz, sodass er auch bei Versionswechseln
   * oder Browser-Updates niemals versehentlich überschrieben wird.
   */
  public static async createSnapshot(
    reason: 'pre_update' | 'periodic' | 'manual' | 'startup',
    label?: string
  ): Promise<AutoSnapshot | null> {
    try {
      // Throttle automatic periodic snapshots to at most once every 5 minutes (except manual/pre_update)
      const now = Date.now();
      if (reason === 'periodic' && now - this.lastSnapshotTime < 5 * 60 * 1000) {
        return null;
      }

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

      // Only save if there is actually data in the database
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
            generatedLabel = `Automatischer Start-Snapshot`;
            break;
          case 'periodic':
            generatedLabel = `Laufende Datensicherung`;
            break;
          case 'manual':
          default:
            generatedLabel = `Manuell erstellter Snapshot`;
            break;
        }
      }

      const snapshot: AutoSnapshot = {
        id: `snap-${now}-${Math.random().toString(36).substring(2, 6)}`,
        timestamp: new Date().toISOString(),
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
        },
        data: jsonBackup
      };

      const db = await openSnapshotsDB();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(SNAPSHOTS_STORE, 'readwrite');
        const store = tx.objectStore(SNAPSHOTS_STORE);
        store.put(snapshot);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });

      this.lastSnapshotTime = now;

      // Prune old snapshots beyond limit
      await this.pruneSnapshots();

      // Mirror metadata in localStorage for fast UI inspection
      try {
        localStorage.setItem('vm_last_snapshot_meta', JSON.stringify({
          id: snapshot.id,
          timestamp: snapshot.timestamp,
          label: snapshot.label,
          records: totalRecords
        }));
      } catch (err) {
        console.warn('Kenndaten des letzten Snapshots konnten nicht vermerkt werden:', err);
      }

      return snapshot;
    } catch (err) {
      console.warn('[SnapshotService] Fehler beim Erstellen des Snapshots:', err);
      return null;
    }
  }

  /**
   * Ruft alle gespeicherten Snapshots chronologisch sortiert ab (neueste zuerst).
   */
  public static async getSnapshots(): Promise<AutoSnapshot[]> {
    try {
      const db = await openSnapshotsDB();
      return new Promise<AutoSnapshot[]>((resolve, reject) => {
        const tx = db.transaction(SNAPSHOTS_STORE, 'readonly');
        const store = tx.objectStore(SNAPSHOTS_STORE);
        const req = store.getAll();
        req.onsuccess = () => {
          const snaps = (req.result || []) as AutoSnapshot[];
          snaps.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
          resolve(snaps);
        };
        req.onerror = () => reject(req.error);
      });
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
      const snapshot = await new Promise<AutoSnapshot | null>((resolve, reject) => {
        const tx = db.transaction(SNAPSHOTS_STORE, 'readonly');
        const store = tx.objectStore(SNAPSHOTS_STORE);
        const req = store.get(snapshotId);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });

      if (!snapshot || !snapshot.data) {
        return { success: false, error: 'Snapshot nicht gefunden oder leer.' };
      }

      // Prior to restoring, take a pre-restore safety snapshot of the current state
      await this.createSnapshot('manual', 'Sicherheits-Backup vor Snapshot-Wiederherstellung');

      // Import the full backup
      const counts = await StorageService.importFullBackup(snapshot.data);

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
        const tx = db.transaction(SNAPSHOTS_STORE, 'readwrite');
        const store = tx.objectStore(SNAPSHOTS_STORE);
        store.delete(snapshotId);
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
   * blieben bis zu zwölf vollständige Kopien des Datenbestands zurück.
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
        const tx = db.transaction(SNAPSHOTS_STORE, 'readwrite');
        tx.objectStore(SNAPSHOTS_STORE).clear();
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
    } finally {
      db.close();
    }
  }

  /**
   * Begrenzt die Anzahl der Snapshots auf MAX_SNAPSHOTS
   */
  private static async pruneSnapshots(): Promise<void> {
    try {
      const snaps = await this.getSnapshots();
      if (snaps.length > MAX_SNAPSHOTS) {
        const toDelete = snaps.slice(MAX_SNAPSHOTS);
        const db = await openSnapshotsDB();
        const tx = db.transaction(SNAPSHOTS_STORE, 'readwrite');
        const store = tx.objectStore(SNAPSHOTS_STORE);
        toDelete.forEach(s => store.delete(s.id));
      }
    } catch (e) {
      console.warn('[SnapshotService] Fehler beim Aufräumen alter Snapshots:', e);
    }
  }
}
