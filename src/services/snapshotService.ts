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
  private static isScanning = false;

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
      } catch {}

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

  /**
   * Notfall-Scan: Durchsucht alle denkbaren Speicherorte im Browser (Altdatenbanken,
   * frühere LocalStorage-Schlüssel, Snapshots), falls nach einem Update Daten fehlen.
   */
  public static async scanAndRecoverLegacyData(): Promise<{
    recovered: boolean;
    source: string;
    details: string;
    counts: {
      members: number;
      transactions: number;
      contacts: number;
      invoices: number;
      meetings: number;
      accounts: number;
      inventory: number;
      documents: number;
    };
  }> {
    if (this.isScanning) {
      return {
        recovered: false,
        source: 'none',
        details: 'Scan läuft bereits...',
        counts: { members: 0, transactions: 0, contacts: 0, invoices: 0, meetings: 0, accounts: 0, inventory: 0, documents: 0 }
      };
    }

    this.isScanning = true;
    try {
      let recoveredMembers: any[] = [];
      let recoveredTransactions: any[] = [];
      let recoveredContacts: any[] = [];
      let recoveredInvoices: any[] = [];
      let recoveredMeetings: any[] = [];
      let recoveredAccounts: any[] = [];
      let recoveredInventory: any[] = [];
      let recoveredDocuments: any[] = [];
      let recoveredSettings: any = null;
      let sourceName = 'Keine';

      // 1. Zuerst prüfen, ob in Snapshots Daten vorhanden sind
      const snapshots = await this.getSnapshots();
      if (snapshots.length > 0) {
        for (const snap of snapshots) {
          try {
            const parsed = JSON.parse(snap.data);
            const d = parsed.data || {};
            if ((d.members?.length > 0 || d.transactions?.length > 0) &&
                (d.members?.length > recoveredMembers.length || d.transactions?.length > recoveredTransactions.length)) {
              recoveredMembers = d.members || [];
              recoveredTransactions = d.transactions || [];
              recoveredContacts = d.contacts || [];
              recoveredInvoices = d.invoices || [];
              recoveredMeetings = d.meetings || [];
              recoveredAccounts = d.accounts || [];
              recoveredInventory = d.inventory || [];
              recoveredDocuments = d.documents || [];
              recoveredSettings = d.settings || null;
              sourceName = `Automatischer Snapshot (${snap.label || snap.timestamp})`;
            }
          } catch {}
        }
      }

      // 2. LocalStorage nach Legacy-Schlüsseln durchsuchen
      if (recoveredMembers.length === 0 && recoveredTransactions.length === 0) {
        const legacyMemberKeys = ['vm_members', 'members', 'vm_live_members', 'club_members', 'tsv_members'];
        for (const k of legacyMemberKeys) {
          const raw = localStorage.getItem(k);
          if (raw) {
            try {
              const arr = JSON.parse(raw);
              if (Array.isArray(arr) && arr.length > 0 && arr[0]?.firstName) {
                recoveredMembers = arr;
                sourceName = `LocalStorage-Schlüssel "${k}"`;
                break;
              }
            } catch {}
          }
        }

        const legacyTxKeys = ['vm_transactions', 'transactions', 'vm_live_transactions', 'club_transactions'];
        for (const k of legacyTxKeys) {
          const raw = localStorage.getItem(k);
          if (raw) {
            try {
              const arr = JSON.parse(raw);
              if (Array.isArray(arr) && arr.length > 0) {
                recoveredTransactions = arr;
                if (sourceName === 'Keine') sourceName = `LocalStorage-Schlüssel "${k}"`;
                break;
              }
            } catch {}
          }
        }

        const legacyContactKeys = ['vm_contacts', 'contacts', 'vm_live_contacts'];
        for (const k of legacyContactKeys) {
          const raw = localStorage.getItem(k);
          if (raw) {
            try {
              const arr = JSON.parse(raw);
              if (Array.isArray(arr) && arr.length > 0) recoveredContacts = arr;
            } catch {}
          }
        }

        const legacyInvoiceKeys = ['vm_invoices', 'invoices', 'vm_live_invoices'];
        for (const k of legacyInvoiceKeys) {
          const raw = localStorage.getItem(k);
          if (raw) {
            try {
              const arr = JSON.parse(raw);
              if (Array.isArray(arr) && arr.length > 0) recoveredInvoices = arr;
            } catch {}
          }
        }

        const legacyMeetingKeys = ['vm_meetings', 'meetings', 'vm_live_meetings'];
        for (const k of legacyMeetingKeys) {
          const raw = localStorage.getItem(k);
          if (raw) {
            try {
              const arr = JSON.parse(raw);
              if (Array.isArray(arr) && arr.length > 0) recoveredMeetings = arr;
            } catch {}
          }
        }

        const legacyAccKeys = ['vm_accounts', 'accounts', 'vm_live_accounts'];
        for (const k of legacyAccKeys) {
          const raw = localStorage.getItem(k);
          if (raw) {
            try {
              const arr = JSON.parse(raw);
              if (Array.isArray(arr) && arr.length > 0) recoveredAccounts = arr;
            } catch {}
          }
        }
      }

      // 3. Ältere IndexedDB Datenbanken durchsuchen
      if (recoveredMembers.length === 0 && recoveredTransactions.length === 0 && typeof indexedDB !== 'undefined') {
        const potentialDBNames = [
          'VereinsManagerDB',
          'VereinsManager_DB',
          'VereinsManager',
          'VereinsManager_LiveDB',
          'VereinsManager_v1',
          'VereinsManager_LiveDB_v1'
        ];

        for (const dbName of potentialDBNames) {
          try {
            const legacyData = await this.readAllFromLegacyDB(dbName);
            if (legacyData.members.length > 0 || legacyData.transactions.length > 0) {
              recoveredMembers = legacyData.members;
              recoveredTransactions = legacyData.transactions;
              if (legacyData.contacts.length > 0) recoveredContacts = legacyData.contacts;
              if (legacyData.invoices.length > 0) recoveredInvoices = legacyData.invoices;
              if (legacyData.meetings.length > 0) recoveredMeetings = legacyData.meetings;
              if (legacyData.accounts.length > 0) recoveredAccounts = legacyData.accounts;
              if (legacyData.inventory.length > 0) recoveredInventory = legacyData.inventory;
              if (legacyData.documents.length > 0) recoveredDocuments = legacyData.documents;
              if (legacyData.settings) recoveredSettings = legacyData.settings;
              sourceName = `IndexedDB "${dbName}"`;
              break;
            }
          } catch {}
        }
      }

      const totalFound = recoveredMembers.length + recoveredTransactions.length + recoveredContacts.length + recoveredInvoices.length + recoveredMeetings.length;
      if (totalFound === 0) {
        return {
          recovered: false,
          source: 'none',
          details: 'Keine Altdaten in früheren Speicherbereichen gefunden.',
          counts: { members: 0, transactions: 0, contacts: 0, invoices: 0, meetings: 0, accounts: 0, inventory: 0, documents: 0 }
        };
      }

      // Re-integrate found data safely into current live DB without destroying anything
      if (recoveredMembers.length > 0) {
        for (const m of recoveredMembers) {
          await StorageService.saveMember(m, 'Altdaten-Wiederherstellung');
        }
      }
      if (recoveredTransactions.length > 0) {
        for (const t of recoveredTransactions) {
          await StorageService.saveTransaction(t);
        }
      }
      if (recoveredContacts.length > 0) {
        await StorageService.saveContacts(recoveredContacts);
      }
      if (recoveredInvoices.length > 0) {
        await StorageService.saveInvoices(recoveredInvoices);
      }
      if (recoveredMeetings.length > 0) {
        await StorageService.saveMeetings(recoveredMeetings);
      }
      if (recoveredAccounts.length > 0) {
        for (const a of recoveredAccounts) {
          await StorageService.saveAccount(a);
        }
      }
      if (recoveredSettings) {
        await StorageService.saveSettings(recoveredSettings);
      }

      // Automatically create a safety snapshot of the recovered state
      await this.createSnapshot('startup', `Wiederhergestellt aus: ${sourceName}`);

      return {
        recovered: true,
        source: sourceName,
        details: `Erfolgreich ${recoveredMembers.length} Mitglieder, ${recoveredTransactions.length} Buchungen, ${recoveredContacts.length} Kontakte, ${recoveredInvoices.length} Rechnungen und ${recoveredMeetings.length} Sitzungen aus "${sourceName}" wiederhergestellt!`,
        counts: {
          members: recoveredMembers.length,
          transactions: recoveredTransactions.length,
          contacts: recoveredContacts.length,
          invoices: recoveredInvoices.length,
          meetings: recoveredMeetings.length,
          accounts: recoveredAccounts.length,
          inventory: recoveredInventory.length,
          documents: recoveredDocuments.length
        }
      };
    } finally {
      this.isScanning = false;
    }
  }

  private static readAllFromLegacyDB(dbName: string): Promise<{
    members: any[];
    transactions: any[];
    contacts: any[];
    invoices: any[];
    meetings: any[];
    accounts: any[];
    inventory: any[];
    documents: any[];
    settings?: any;
  }> {
    return new Promise((resolve) => {
      const result = {
        members: [] as any[],
        transactions: [] as any[],
        contacts: [] as any[],
        invoices: [] as any[],
        meetings: [] as any[],
        accounts: [] as any[],
        inventory: [] as any[],
        documents: [] as any[],
        settings: null as any
      };

      try {
        const req = indexedDB.open(dbName);
        req.onerror = () => resolve(result);
        req.onsuccess = () => {
          const db = req.result;
          const storeNames = Array.from(db.objectStoreNames);
          if (storeNames.length === 0) {
            db.close();
            return resolve(result);
          }

          const storesToRead = storeNames.filter(s =>
            ['members', 'transactions', 'contacts', 'invoices', 'meetings', 'accounts', 'inventory', 'documents', 'settings'].includes(s)
          );

          if (storesToRead.length === 0) {
            db.close();
            return resolve(result);
          }

          try {
            const tx = db.transaction(storesToRead, 'readonly');
            let pending = storesToRead.length;

            storesToRead.forEach(s => {
              const store = tx.objectStore(s);
              const getReq = store.getAll();
              getReq.onsuccess = () => {
                const data = getReq.result || [];
                if (s === 'members') result.members = data;
                else if (s === 'transactions') result.transactions = data;
                else if (s === 'contacts') result.contacts = data;
                else if (s === 'invoices') result.invoices = data;
                else if (s === 'meetings') result.meetings = data;
                else if (s === 'accounts') result.accounts = data;
                else if (s === 'inventory') result.inventory = data;
                else if (s === 'documents') result.documents = data;
                else if (s === 'settings') result.settings = data.find((x: any) => x.id === 'main') || data[0];

                pending--;
                if (pending <= 0) {
                  db.close();
                  resolve(result);
                }
              };
              getReq.onerror = () => {
                pending--;
                if (pending <= 0) {
                  db.close();
                  resolve(result);
                }
              };
            });
          } catch {
            db.close();
            resolve(result);
          }
        };
      } catch {
        resolve(result);
      }
    });
  }
}
