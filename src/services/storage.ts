import {
  Member,
  Transaction,
  FinancialAccount,
  MemberAuditLog,
  ClubSettings,
  InventoryItem,
  MemberBulkUpdates,
  TransactionBulkUpdates,
  InventoryBulkUpdates,
  SepaRunHistory,
  ClubDocument,
  DocumentCategory,
  DocumentFolder,
  DonationReceipt,
  CalendarEvent,
  CalendarEventCategory,
  ClubContact,
  ClubInvoice,
  InvoiceTemplateSettings,
  Meeting,
  MeetingTemplateSettings,
  MemberInventoryAssignment
} from '../types';
import { buchungOhneAltenVermerk, dokumentOhneAltenVermerk, gegenstandOhneAltenVermerk } from './jahresarchiv';
import { UserDashboardConfig } from '../types/dashboard';
import { DEFAULT_DASHBOARD_CONFIG, ergaenzeNeueWidgets } from '../data/defaultDashboard';
import { DEFAULT_DEPARTMENTS } from '../data/taxSpheres';
import { DEFAULT_INVOICE_TEMPLATE } from '../data/initialInvoices';
import { DEFAULT_MEETING_TEMPLATE } from '../data/initialMeetings';
import { getInitialFolders } from '../data/initialFolders';
import { DEFAULT_CALENDAR_CATEGORIES } from '../data/initialEvents';
import { getDonationPdfDataUrl } from './donationService';
import { spendenBuchung, gleicheBuchungAn } from './spendenBuchung';
import {
  BezahltAngaben,
  pruefeBezahlt,
  rechnungsBuchung,
  gleicheBuchungAn as gleicheRechnungsBuchungAn
} from './rechnungsRegeln';
import {
  Antrag,
  ANTRAG_DOK_NOTIZ,
  BEILAGEN,
  Beilage,
  ORDNER_ANTRAEGE,
  antragDateiname,
  antragDokTags,
  antragDokTitel,
  antragTexteZumSpeichern,
  aufnahmeFehler,
  beilageTitel,
  leseAntragEinstellungen,
  mitgliedAusAntrag
} from '../utils/antragRegeln';
import { customCategoryService } from './customCategoryService';
import { planeBelegOrdner, planeUnterordner, belegArtVon, sollEinsortiertWerden, BelegArt } from '../utils/belegOrdner';
import { wendeSammelAn } from '../utils/buchungSammel';
import { wendeSammelRegelnAn, lokalesHeute } from '../utils/mitgliedRegeln';
import { beitragsBuchungen } from './beitragsBuchung';
import { pruefeSammel, wendeSammelAn as wendeInventarSammelAn } from '../utils/inventarRegeln';
import { MaterialEintrag, materialEntfernt, materialGespeichert } from '../utils/materialProtokoll';
import { materialBeimLoeschen, MaterialWahl } from '../utils/mitgliedLoeschen';
import {
  belegDokumentId,
  inventarSperrText,
  offeneAusgaben,
  planeKontoLoeschen,
  teileInventarAuswahl
} from '../utils/loeschRegeln';
import {
  STORES,
  ENTFALLENE_STORES,
  SICHERUNGS_BEREICHE,
  SicherungsDaten,
  SicherungsKopf,
  BereichsVergleich,
  ImportArt,
  leseSicherung,
  vergleicheSicherung,
  ergaenzeListe,
  ergaenzeEinzelstueck,
  ergaenzeStammdaten
} from './backupContents';

/**
 * Wurde dieses Gerät schon mit einem Verein eingerichtet (neu angelegt oder
 * eine Sicherung importiert)? Entscheidet, ob beim Start
 * das Auswahl-Modal ("Neuen Verein anlegen" / "Daten importieren") erscheint.
 *
 * Bewusst ein eigenes, einfaches Merkmal statt an einer Datenmenge
 * (z. B. Mitgliederzahl) festgemacht: Ein frisch angelegter Verein hat
 * zu Recht noch null Mitglieder — das darf das Auswahl-Modal nicht erneut
 * auslösen.
 */
const EINGERICHTET_KEY = 'vm_verein_eingerichtet';

function markiereAlsEingerichtet(): void {
  try {
    localStorage.setItem(EINGERICHTET_KEY, 'true');
  } catch (err) {
    console.warn('[StorageService] Konnte "eingerichtet"-Merkmal nicht speichern:', err);
  }
}

/**
 * Bearbeiter im Änderungsprotokoll. Seit R2 überall „Admin“ (Entscheidung
 * Johannes, 22.11.2026), am Desktop wie am Handy; vorher stand hier
 * „Kassier / Administrator“. Bestehende Einträge bleiben, wie sie sind.
 */
export const BEARBEITER = 'Admin';

const LIVE_DB_NAME = 'VereinsManager_LiveDB_v1';
/**
 * Datenbank des früheren Demo-Modus (bis R2, 22.11.2026). Wird beim Start
 * einmal gelöscht, siehe `entferneAltlastenDemoUndAnmeldung`.
 */
const ALTE_DEMO_DB_NAME = 'VereinsManager_DemoDB_v1';
// 10: Bereiche der früheren Online-Anträge entfernt (D-04)
const DB_VERSION = 10;

let isImportingBackup = false;

/**
 * Entfernt die Bereiche der früheren Online-Anträge samt Inhalt (D-04,
 * Beschluss 25.10.2026): Anträge, Unterschriften und Formular-Einstellungen,
 * die seit dem Wegfall des Online-Formulars niemand mehr sieht. Geht nur
 * während eines Versions-Upgrades der Datenbank.
 */
function entferneEntfalleneStores(db: IDBDatabase): void {
  for (const name of ENTFALLENE_STORES) {
    if (db.objectStoreNames.contains(name)) db.deleteObjectStore(name);
  }
}

/**
 * Reclaims localStorage quota by removing bloated legacy dumps of entire tables.
 * localStorage has a strict 5MB limit across all keys; large data must reside in IndexedDB.
 */
export function purgeBloatedLocalStorage(): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const keysToRemove: string[] = [];
    const largeStores = [
      'members', 'transactions', 'accounts', 'audit_logs', 'inventory',
      'sepa_runs', 'documents', 'donations', 'contacts', 'invoices',
      'meetings', 'calendar_events', 'online_applications', 'folders'
    ];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;

      const isMirroredStore = largeStores.some(s => key === `vm_live_${s}` || key === `vm_demo_${s}`);
      if (isMirroredStore) {
        keysToRemove.push(key);
        continue;
      }

      // Remove any non-essential large blob > 80KB that might choke the quota
      try {
        const val = localStorage.getItem(key);
        if (val && val.length > 80000 && !key.startsWith('sb-') && key !== 'vm_auth_users') {
          keysToRemove.push(key);
        }
      } catch {
        // Einzelner Schluessel nicht lesbar: bei der Aufraeumsuche uebergehen.
      }
    }

    keysToRemove.forEach(k => {
      try {
        localStorage.removeItem(k);
      } catch {
        // Einzelner Schluessel nicht loeschbar: uebergehen.
      }
    });
  } catch (err) {
    console.warn('[Storage] Error during localStorage purge:', err);
  }
}

// Automatically run on startup to reclaim space
purgeBloatedLocalStorage();

function getActiveDBName(): string {
  return LIVE_DB_NAME;
}

function getStorePrefix(): string {
  return 'vm_live_';
}

/**
 * Räumt einmalig weg, was vom Demo-Modus und von der früheren Anmeldung
 * übrig ist (R2): die eigene Demo-Datenbank, deren Ausweichkopien im
 * localStorage und die Anmeldedaten (Prüfwert des Gerätepassworts, Sitzung,
 * automatische Sperre). Die echte Vereinsdatenbank bleibt unberührt.
 * Mehrfaches Aufrufen schadet nicht.
 */
export function entferneAltlastenDemoUndAnmeldung(): void {
  try {
    const weg: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('vm_demo_')) weg.push(k);
    }
    weg.push(
      'vm_device_account_v1',
      'vm_auth_session_v1',
      'vm_auto_lock_minutes_v1',
      'vm_last_activity',
      'vm_users_v2',
      'vm_security_settings_v2',
      'vm_auth_session_v2',
      'vereinsmanager_simulated_update_available'
    );
    for (const k of weg) localStorage.removeItem(k);
    sessionStorage.removeItem('vm_auth_session_v1');
  } catch {
    // ohne localStorage gibt es auch nichts aufzuräumen
  }
  try {
    if (typeof indexedDB !== 'undefined') indexedDB.deleteDatabase(ALTE_DEMO_DB_NAME);
  } catch {
    // nicht löschbar: stört nicht, wird nie mehr geöffnet
  }
}

// Die Liste der Datenbereiche steht seit Fassung 1.3 in backupContents.ts.
// Dort wacht der Compiler darüber, dass jeder Bereich auch in der
// Datensicherung landet — genau das war jahrelang nicht der Fall.

/**
 * Neutrale Vereinsstammdaten für einen neuen, leeren Verein. Bis R2 standen
 * hier die Beispieldaten des Demo-Modus („TSV Musterstadt 1890 e.V.“ mit
 * Vorstand, IBAN und Gläubiger-ID); die tauchten dann als Ersatzwert auf,
 * wenn noch keine Stammdaten gespeichert waren.
 */
function neutraleEinstellungen(): ClubSettings {
  return {
    clubName: 'Mein Sportverein e.V.',
    associationNumber: '',
    taxNumber: '',
    taxOffice: '',
    taxExemptionDate: '',
    taxAssessmentPeriod: '',
    promotedPurposes: 'Förderung des Sports',
    creditorId: '',
    creditorIban: '',
    creditorBic: '',
    creditorAccountId: 'acc-main',
    address: '',
    chairman: '',
    treasurer: '',
    email: '',
    departments: DEFAULT_DEPARTMENTS
  };
}

/**
 * Felder, die früher in den Vereinsstammdaten standen und dort nicht mehr
 * hingehören: das SMTP-Passwort zum Postfach des Vereins (im Klartext) und
 * der KI-Schlüssel. Beide Funktionen — E-Mail-Versand und KI — gibt es in
 * dieser Fassung nicht mehr; was hier aufgeräumt wird, sind Altbestände aus
 * einer älteren Fassung: eine Datenbank oder eine eingespielte
 * Datensicherung von damals.
 *
 * Diese Liste wird beim Lesen UND beim Schreiben angewandt. Beim Schreiben
 * deshalb, weil beim Einspielen einer alten Datensicherung sonst genau die
 * Klartext-Geheimnisse zurückkämen, die wir gerade entfernt haben.
 */
const VERALTETE_SMTP_FELDER = [
  'smtpHost',
  'smtpPort',
  'smtpSecure',
  'smtpUser',
  'smtpPassword',
  'smtpFromEmail',
  'smtpFromName',
  // Seit Fassung 0.9: der KI-Schluessel und was dazugehoert.
  'geminiApiKey',
  'aiApiKey',
  'aiProvider',
  'aiModel',
  'aiBaseUrl'
] as const;

function ohneVeralteteSmtpFelder<T extends Record<string, unknown>>(
  daten: T
): { bereinigt: T; warVeraltet: boolean } {
  const bereinigt = { ...daten };
  let warVeraltet = false;
  for (const feld of VERALTETE_SMTP_FELDER) {
    if (feld in bereinigt) {
      delete bereinigt[feld];
      warVeraltet = true;
    }
  }
  return { bereinigt, warVeraltet };
}


// IndexedDB Helper
function openDB(dbNameOverride?: string): Promise<IDBDatabase> {
  const currentDB = dbNameOverride || getActiveDBName();
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(currentDB, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      Object.values(STORES).forEach(storeName => {
        if (!db.objectStoreNames.contains(storeName)) {
          db.createObjectStore(storeName, { keyPath: 'id' });
        }
      });
      entferneEntfalleneStores(db);
    };
    request.onsuccess = () => {
      const db = request.result;
      // Defensive check in case DB was created earlier without newer stores
      const missingStores = Object.values(STORES).filter(s => !db.objectStoreNames.contains(s));
      const entfallene = ENTFALLENE_STORES.filter(s => db.objectStoreNames.contains(s));
      if (missingStores.length > 0 || entfallene.length > 0) {
        db.close();
        const nextVersion = Math.max(db.version + 1, DB_VERSION + 1);
        const upgradeReq = indexedDB.open(currentDB, nextVersion);
        upgradeReq.onupgradeneeded = (e) => {
          const upDb = (e.target as IDBOpenDBRequest).result;
          Object.values(STORES).forEach(storeName => {
            if (!upDb.objectStoreNames.contains(storeName)) {
              upDb.createObjectStore(storeName, { keyPath: 'id' });
            }
          });
          entferneEntfalleneStores(upDb);
        };
        upgradeReq.onsuccess = () => resolve(upgradeReq.result);
        upgradeReq.onerror = () => resolve(db);
        return;
      }
      resolve(db);
    };
    request.onerror = () => reject(request.error);
  });
}

let snapshotTimer: any = null;
function triggerAutoSnapshot() {
  if (isImportingBackup) return;
  if (snapshotTimer) clearTimeout(snapshotTimer);
  snapshotTimer = setTimeout(async () => {
    try {
      const { SnapshotService } = await import('./snapshotService');
      await SnapshotService.createSnapshot('periodic');
    } catch (err) {
      console.warn('Automatische Datensicherung fehlgeschlagen - es entsteht KEIN Snapshot:', err);
    }
  }, 4000);
}

async function getAllFromStore<T>(storeName: string, dbNameOverride?: string): Promise<T[]> {
  const prefix = getStorePrefix();
  try {
    const db = await openDB(dbNameOverride);
    if (!db.objectStoreNames.contains(storeName)) {
      const local = localStorage.getItem(`${prefix}${storeName}`);
      return local ? JSON.parse(local) : [];
    }
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    // Ausweichweg auf localStorage. Der ist auf 5 MB begrenzt, während die
    // IndexedDB praktisch unbegrenzt ist — wer nicht erfährt, dass hier
    // ausgewichen wurde, sucht einen späteren Datenverlust an der völlig
    // falschen Stelle.
    console.warn(`IndexedDB nicht verfügbar beim Lesen von "${storeName}" - weiche auf den begrenzten localStorage aus:`, err);
    const local = localStorage.getItem(`${prefix}${storeName}`);
    return local ? JSON.parse(local) : [];
  }
}

async function saveAllToStore<T extends { id: string }>(storeName: string, items: T[], dbNameOverride?: string): Promise<void> {
  const prefix = getStorePrefix();
  try {
    const db = await openDB(dbNameOverride);
    if (!db.objectStoreNames.contains(storeName)) {
      // Store not present in DB: only store in localStorage if it is tiny (prevent QuotaExceededError)
      try {
        if (items.length <= 25 && JSON.stringify(items).length < 40000) {
          localStorage.setItem(`${prefix}${storeName}`, JSON.stringify(items));
        }
      } catch (err) {
        console.warn('Ausweichspeicherung in localStorage fehlgeschlagen - diese Daten sind nicht gesichert:', err);
      }
      return;
    }
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      store.clear();
      items.forEach(item => store.put(item));
      tx.oncomplete = () => {
        // Do NOT mirror large collections into localStorage. localStorage has a strict 5MB quota.
        if (items.length > 0 && !isImportingBackup) triggerAutoSnapshot();
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn(`[saveAllToStore] Fallback for ${storeName}:`, err);
    try {
      if (items.length <= 25 && JSON.stringify(items).length < 40000) {
        localStorage.setItem(`${prefix}${storeName}`, JSON.stringify(items));
      }
    } catch (err) {
      console.warn('Ausweichspeicherung in localStorage fehlgeschlagen - diese Daten sind nicht gesichert:', err);
    }
    if (items.length > 0 && !isImportingBackup) triggerAutoSnapshot();
  }
}

/**
 * Schreibt eine ganze Liste in einen Datenbereich — und sagt es laut, wenn das
 * nicht klappt.
 *
 * Anders als `saveAllToStore` gibt es hier KEINEN stillen Ausweg in den
 * localStorage. Der fasst nur 5 MB und nimmt in `saveAllToStore` ohnehin nur
 * Listen bis 25 Einträge: Kleine Bereiche (Kontakte) erschienen nach einem
 * missglückten Einspielen deshalb scheinbar korrekt, große (Mitglieder,
 * Buchungen, Dokumente) verschwanden spurlos. Für das Einspielen einer
 * Datensicherung ist das nicht hinnehmbar.
 *
 * Nach dem Schreiben wird nachgezählt: Es muss genau so viele Einträge geben,
 * wie die Liste verschiedene Kennungen hat.
 */
async function schreibeListeStreng(
  storeName: string,
  items: { id: string }[],
  dbNameOverride?: string
): Promise<void> {
  const ohneKennung = items.filter(
    i => !i || typeof i !== 'object' || i.id === undefined || i.id === null || i.id === ''
  ).length;
  if (ohneKennung > 0) {
    throw new Error(`${ohneKennung} Einträge ohne Kennung (id)`);
  }

  const db = await openDB(dbNameOverride);
  if (!db.objectStoreNames.contains(storeName)) {
    throw new Error('der Datenbereich fehlt in der Browser-Datenbank');
  }

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('Schreibfehler der Browser-Datenbank'));
    tx.onabort = () => reject(tx.error || new Error('Schreibvorgang abgebrochen (vermutlich zu wenig Speicherplatz)'));
    try {
      const store = tx.objectStore(storeName);
      store.clear();
      items.forEach(item => store.put(item));
    } catch (err) {
      try {
        tx.abort();
      } catch {
        // schon abgebrochen
      }
      reject(err);
    }
  });

  const erwartet = new Set(items.map(i => i.id)).size;
  const gespeichert = await new Promise<number>((resolve, reject) => {
    const req = db.transaction(storeName, 'readonly').objectStore(storeName).count();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Nachzählen fehlgeschlagen'));
  });
  if (gespeichert !== erwartet) {
    throw new Error(`nur ${gespeichert} von ${erwartet} Einträgen gespeichert`);
  }
}

function beschreibeFehler(err: unknown): string {
  if (err && typeof err === 'object') {
    const e = err as { name?: string; message?: string };
    const teile = [e.name, e.message].filter(Boolean);
    if (teile.length > 0) return teile.join(': ');
  }
  return String(err ?? 'unbekannter Fehler');
}

function bezeichnungDesBereichs(storeName: string): string {
  const treffer = Object.values(SICHERUNGS_BEREICHE).find(b => b.store === storeName);
  return treffer ? treffer.bezeichnung : storeName;
}

async function getItemFromStore<T>(storeName: string, id: string, dbNameOverride?: string): Promise<T | null> {
  try {
    const db = await openDB(dbNameOverride);
    if (!db.objectStoreNames.contains(storeName)) {
      const items = await getAllFromStore<T & { id: string }>(storeName, dbNameOverride);
      return items.find(i => i.id === id) || null;
    }
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn(`IndexedDB nicht verfügbar beim Lesen eines Eintrags aus "${storeName}" - weiche auf den begrenzten localStorage aus:`, err);
    const items = await getAllFromStore<T & { id: string }>(storeName, dbNameOverride);
    return items.find(i => i.id === id) || null;
  }
}

async function putItemToStore<T extends { id: string }>(storeName: string, item: T, dbNameOverride?: string): Promise<void> {
  try {
    const db = await openDB(dbNameOverride);
    if (!db.objectStoreNames.contains(storeName)) {
      const items = await getAllFromStore<T>(storeName, dbNameOverride);
      const idx = items.findIndex(i => i.id === item.id);
      if (idx >= 0) items[idx] = item;
      else items.push(item);
      await saveAllToStore(storeName, items, dbNameOverride);
      if (!isImportingBackup) triggerAutoSnapshot();
      return;
    }
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      store.put(item);
      tx.oncomplete = () => {
        if (!isImportingBackup) triggerAutoSnapshot();
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn(`IndexedDB nicht verfügbar beim Speichern in "${storeName}" - weiche auf den begrenzten localStorage aus:`, err);
    const items = await getAllFromStore<T>(storeName, dbNameOverride);
    const idx = items.findIndex(i => i.id === item.id);
    if (idx >= 0) items[idx] = item;
    else items.push(item);
    await saveAllToStore(storeName, items, dbNameOverride);
    if (!isImportingBackup) triggerAutoSnapshot();
  }
}

async function deleteItemFromStore(storeName: string, id: string): Promise<void> {
  try {
    const db = await openDB();
    if (!db.objectStoreNames.contains(storeName)) {
      const items = await getAllFromStore<{ id: string }>(storeName);
      const filtered = items.filter(i => i.id !== id);
      await saveAllToStore(storeName, filtered);
      triggerAutoSnapshot();
      return;
    }
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      store.delete(id);
      tx.oncomplete = () => {
        triggerAutoSnapshot();
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn(`IndexedDB nicht verfügbar beim Löschen aus "${storeName}" - weiche auf den begrenzten localStorage aus:`, err);
    const items = await getAllFromStore<{ id: string }>(storeName);
    const filtered = items.filter(i => i.id !== id);
    await saveAllToStore(storeName, filtered);
    triggerAutoSnapshot();
  }
}

export const StorageService = {
  /**
   * Liefert Statistiken über die aktuell lokal auf dem Gerät gespeicherten Datensätze
   */
  async getLocalDataStats(): Promise<{
    members: number;
    transactions: number;
    accounts: number;
    inventory: number;
    sepaRuns: number;
    documents: number;
    donations: number;
    calendarEvents: number;
    auditLogs: number;
  }> {
    const [
      members,
      transactions,
      accounts,
      inventory,
      sepaRuns,
      documents,
      donations,
      calendarEvents,
      auditLogs
    ] = await Promise.all([
      getAllFromStore<Member>(STORES.MEMBERS),
      getAllFromStore<Transaction>(STORES.TRANSACTIONS),
      getAllFromStore<FinancialAccount>(STORES.ACCOUNTS),
      getAllFromStore<InventoryItem>(STORES.INVENTORY),
      getAllFromStore<SepaRunHistory>(STORES.SEPA_RUNS),
      getAllFromStore<ClubDocument>(STORES.DOCUMENTS),
      getAllFromStore<DonationReceipt>(STORES.DONATIONS),
      getAllFromStore<CalendarEvent>(STORES.CALENDAR_EVENTS),
      getAllFromStore<MemberAuditLog>(STORES.AUDIT_LOGS)
    ]);

    return {
      members: members.length,
      transactions: transactions.length,
      accounts: accounts.length,
      inventory: inventory.length,
      sepaRuns: sepaRuns.length,
      documents: documents.length,
      donations: donations.length,
      calendarEvents: calendarEvents.length,
      auditLogs: auditLogs.length
    };
  },

  async init(): Promise<void> {
    const initKey = 'vm_live_initialized';
    // Reste von Demo-Modus und Anmeldung (bis R2) einmal wegräumen
    entferneAltlastenDemoUndAnmeldung();

    // LIVE Mode Initialization with STRICT ZERO-DATA-LOSS GUARANTEE
    try {
      // Grundausstattung (Konten, Ordner, Kategorien, Stammdaten) nur dort
      // anlegen, wo noch nichts vorhanden ist
      await this.legeGrundausstattungAn();

      // SICHERHEIT: Bestehende Daten in STORES.MEMBERS, TRANSACTIONS, CONTACTS, INVOICES,
      // MEETINGS, INVENTORY, DOCUMENTS, DONATIONS usw. werden NIEMALS mit [] überschrieben!
      localStorage.setItem(initKey, 'true');

      // 6. Automatischen Sicherheits-Snapshot im Hintergrund anstoßen
      try {
        const { SnapshotService } = await import('./snapshotService');
        await SnapshotService.createSnapshot('startup');
      } catch (err) {
        console.warn('Start-Snapshot konnte nicht angelegt werden:', err);
      }
    } catch (err) {
      console.warn('Initialisierung Live-DB:', err);
    }
  },

  /**
   * Legt die leere Grundausstattung eines Vereins an: zwei Starter-Konten,
   * die Dokumentenordner, die Kalender-Kategorien und neutrale Stammdaten.
   * Jeder Bereich wird nur angelegt, wenn er noch leer ist — Vorhandenes
   * bleibt unangetastet. Wird beim Start und nach "Alle lokalen Daten
   * löschen" aufgerufen.
   */
  async legeGrundausstattungAn(): Promise<void> {
    // 2. Nur initialisieren, wenn Konten wirklich leer sind
    const existingAccounts = await getAllFromStore<FinancialAccount>(STORES.ACCOUNTS);
    if (existingAccounts.length === 0) {
      const starterAccounts: FinancialAccount[] = [
        {
          id: 'acc-main',
          name: 'Girokonto (Hauptkonto)',
          accountType: 'bank',
          iban: '',
          bic: '',
          initialBalance: 0.00,
          color: 'emerald',
          description: 'Hauptkonto für Beitrags- und Rechnungswesen',
          createdAt: new Date().toISOString()
        },
        {
          id: 'acc-cash',
          name: 'Vereinskasse (Bargeld)',
          accountType: 'cash',
          initialBalance: 0.00,
          color: 'amber',
          description: 'Handkasse für Veranstaltungen und Barbelege',
          createdAt: new Date().toISOString()
        }
      ];
      await saveAllToStore(STORES.ACCOUNTS, starterAccounts);
    }

    // 3. Ordner-Struktur für Dokumente nur bei Bedarf anlegen
    const existingFolders = await getAllFromStore<DocumentFolder>(STORES.FOLDERS);
    if (existingFolders.length === 0) {
      await saveAllToStore(STORES.FOLDERS, getInitialFolders());
    }

    // 4. Kalender-Kategorien nur anlegen falls leer
    const existingCategories = await getAllFromStore<CalendarEventCategory>(STORES.CALENDAR_CATEGORIES);
    if (existingCategories.length === 0) {
      await saveAllToStore(STORES.CALENDAR_CATEGORIES, DEFAULT_CALENDAR_CATEGORIES);
    }

    // 5. Vereinsstammdaten nur initialisieren, falls keine vorhanden sind
    const currentSettings = await getItemFromStore<ClubSettings>(STORES.SETTINGS, 'main');
    if (!currentSettings) {
      await putItemToStore(STORES.SETTINGS, { id: 'main', ...neutraleEinstellungen() });
    }
  },

  /**
   * Legt den Verein im Einrichtungsfenster neu an (Name, Vorsitz, E-Mail).
   */
  async initLiveClub(clubName: string, chairmanName: string, email: string): Promise<void> {
    const current = await this.getSettings();
    const updated: ClubSettings = {
      ...current,
      id: 'main',
      clubName: clubName.trim(),
      chairman: chairmanName.trim(),
      email: email.trim(),
      departments: current?.departments?.length ? current.departments : DEFAULT_DEPARTMENTS
    };
    await this.saveSettings(updated);
    markiereAlsEingerichtet();
  },

  /**
   * Braucht dieses Gerät noch die Ersteinrichtung (neuer Verein oder Import)?
   *
   * Rückwärts-kompatibel: Eine Installation von vor diesem Merkmal hat das
   * `EINGERICHTET_KEY`-Merkmal noch nicht gesetzt, obwohl längst echte Daten
   * vorliegen. Darum zählt hilfsweise auch, ob schon Mitglieder oder
   * Buchungen vorhanden sind — und holt das Merkmal in dem Fall gleich nach,
   * damit die nächste Prüfung wieder den schnellen, klaren Weg nimmt.
   */
  async brauchtEinrichtung(): Promise<boolean> {
    try {
      if (localStorage.getItem(EINGERICHTET_KEY) === 'true') return false;
    } catch {
      // ohne localStorage im Zweifel weiter unten über die Daten prüfen
    }

    const [members, transactions] = await Promise.all([
      getAllFromStore<Member>(STORES.MEMBERS),
      getAllFromStore<Transaction>(STORES.TRANSACTIONS)
    ]);

    if (members.length > 0 || transactions.length > 0) {
      markiereAlsEingerichtet();
      return false;
    }
    return true;
  },

  // Members
  async getMembers(): Promise<Member[]> {
    return getAllFromStore<Member>(STORES.MEMBERS);
  },

  async getMember(id: string): Promise<Member | null> {
    return getItemFromStore<Member>(STORES.MEMBERS, id);
  },

  async saveMember(member: Member, author = BEARBEITER): Promise<void> {
    const existing = await getItemFromStore<Member>(STORES.MEMBERS, member.id);
    const now = new Date().toISOString();
    
    if (existing) {
      // Record audit log
      const changes: MemberAuditLog['changes'] = [];
      const keys: (keyof Member)[] = [
        'firstName', 'lastName', 'gender', 'birthDate', 'phone', 'email',
        'entryDate', 'exitDate', 'status', 'department', 'membershipType',
        'feeAmount', 'feePeriod', 'paymentMethod', 'notes'
      ];
      
      const labels: Record<string, string> = {
        firstName: 'Vorname',
        lastName: 'Nachname',
        gender: 'Geschlecht',
        birthDate: 'Geburtsdatum',
        phone: 'Telefon',
        email: 'E-Mail',
        entryDate: 'Eintrittsdatum',
        exitDate: 'Austrittsdatum',
        status: 'Mitgliedsstatus',
        department: 'Abteilung',
        membershipType: 'Mitgliedschaftstyp',
        feeAmount: 'Beitragshöhe',
        feePeriod: 'Zahlungsweise',
        paymentMethod: 'Zahlungsmethode',
        notes: 'Notizen'
      };

      for (const key of keys) {
        if (existing[key] !== member[key]) {
          changes.push({
            field: key,
            label: labels[key] || key,
            oldValue: existing[key] || '–',
            newValue: member[key] || '–'
          });
        }
      }

      if (JSON.stringify(existing.address) !== JSON.stringify(member.address)) {
        changes.push({
          field: 'address',
          label: 'Adresse',
          oldValue: `${existing.address.street} ${existing.address.houseNumber}, ${existing.address.zip} ${existing.address.city}`,
          newValue: `${member.address.street} ${member.address.houseNumber}, ${member.address.zip} ${member.address.city}`
        });
      }

      if (JSON.stringify(existing.bankDetails) !== JSON.stringify(member.bankDetails)) {
        changes.push({
          field: 'bankDetails',
          label: 'Bankverbindung / SEPA',
          oldValue: existing.bankDetails.iban ? `IBAN: ${existing.bankDetails.iban}` : 'Keine Bankdaten',
          newValue: member.bankDetails.iban ? `IBAN: ${member.bankDetails.iban}` : 'Keine Bankdaten'
        });
      }

      if (changes.length > 0) {
        const auditLog: MemberAuditLog = {
          id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          memberId: member.id,
          memberNumber: member.memberNumber,
          memberName: `${member.firstName} ${member.lastName}`,
          timestamp: now,
          author,
          action: 'update',
          summary: `${changes.length} Feld(er) aktualisiert (${changes.map(c => c.label).join(', ')})`,
          changes
        };
        await putItemToStore(STORES.AUDIT_LOGS, auditLog);
      }

      member.updatedAt = now;
      await putItemToStore(STORES.MEMBERS, member);
    } else {
      // New member
      member.createdAt = now;
      member.updatedAt = now;
      await putItemToStore(STORES.MEMBERS, member);

      const auditLog: MemberAuditLog = {
        id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        memberId: member.id,
        memberNumber: member.memberNumber,
        memberName: `${member.firstName} ${member.lastName}`,
        timestamp: now,
        author,
        action: 'create',
        summary: `Neues Mitglied (${member.memberNumber}) angelegt`,
        changes: []
      };
      await putItemToStore(STORES.AUDIT_LOGS, auditLog);
    }
  },

  async deleteMember(id: string, author = BEARBEITER): Promise<void> {
    const existing = await getItemFromStore<Member>(STORES.MEMBERS, id);
    if (existing) {
      const auditLog: MemberAuditLog = {
        id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        memberId: existing.id,
        memberNumber: existing.memberNumber,
        memberName: `${existing.firstName} ${existing.lastName}`,
        timestamp: new Date().toISOString(),
        author,
        action: 'delete',
        summary: `Mitglied (${existing.memberNumber} - ${existing.firstName} ${existing.lastName}) gelöscht`,
        changes: []
      };
      await putItemToStore(STORES.AUDIT_LOGS, auditLog);
    }
    await deleteItemFromStore(STORES.MEMBERS, id);
  },

  async deleteMultipleMembers(ids: string[], author = BEARBEITER): Promise<number> {
    const allMembers = await this.getMembers();
    const idSet = new Set(ids);
    const toDelete = allMembers.filter(m => idSet.has(m.id));
    const now = new Date().toISOString();

    for (const mem of toDelete) {
      const auditLog: MemberAuditLog = {
        id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        memberId: mem.id,
        memberNumber: mem.memberNumber,
        memberName: `${mem.firstName} ${mem.lastName}`,
        timestamp: now,
        author,
        action: 'delete',
        summary: `Sammellöschung: Mitglied (${mem.memberNumber} - ${mem.firstName} ${mem.lastName}) gelöscht`,
        changes: []
      };
      await putItemToStore(STORES.AUDIT_LOGS, auditLog);
      await deleteItemFromStore(STORES.MEMBERS, mem.id);
    }

    return toDelete.length;
  },

  async bulkUpdateMembers(
    ids: string[],
    updates: MemberBulkUpdates,
    author = BEARBEITER
  ): Promise<{ updatedCount: number; updatedMembers: Member[]; gesperrt: { name: string; felder: string[] }[] }> {
    const allMembers = await this.getMembers();
    const idSet = new Set(ids);
    const now = new Date().toISOString();
    const updatedMembersList: Member[] = [];
    // Mitglieder, bei denen Felder gesperrt waren (ausgetreten, beitragsfrei), für den Hinweis (T-133)
    const gesperrt: { name: string; felder: string[] }[] = [];

    const fieldLabels: Record<string, string> = {
      paymentMethod: 'Zahlungsmethode',
      feePeriod: 'Zahlungsweise',
      status: 'Mitgliedsstatus',
      membershipType: 'Mitgliedschaftstyp',
      department: 'Abteilung / Sparte',
      feeAmount: 'Beitragshöhe (€)',
      entryDate: 'Eintrittsdatum',
      exitDate: 'Austrittsdatum',
      dataPrivacyConsent: 'Datenschutz-Einwilligung',
      notes: 'Notizen'
    };

    const statusTranslations: Record<string, string> = {
      active: 'Aktiv',
      passive: 'Passiv',
      honorary: 'Ehrenmitglied',
      suspended: 'Ruhend',
      terminated: 'Gekündigt'
    };

    const paymentTranslations: Record<string, string> = {
      sepa: 'SEPA-Lastschrift',
      transfer: 'Überweisung',
      cash: 'Bargeld',
      standing_order: 'Dauerauftrag',
      exempt: 'Beitragsfrei'
    };

    const periodTranslations: Record<string, string> = {
      monthly: 'monatlich',
      quarterly: 'vierteljährlich',
      half_yearly: 'halbjährlich',
      yearly: 'jährlich',
      none: 'beitragsfrei'
    };

    const typeTranslations: Record<string, string> = {
      full: 'Vollmitglied',
      youth: 'Jugend / Kinder',
      reduced: 'Ermäßigt',
      family: 'Familie',
      supporting: 'Förderer / Sponsor',
      honorary: 'Ehrenmitglied',
      ausgetreten: 'Ausgetreten'
    };

    const formatVal = (field: string, val: any) => {
      if (val === undefined || val === null || val === '') return '–';
      if (field === 'status') return statusTranslations[val] || val;
      if (field === 'paymentMethod') return paymentTranslations[val] || val;
      if (field === 'feePeriod') return periodTranslations[val] || val;
      if (field === 'membershipType') return typeTranslations[val] || val;
      if (field === 'feeAmount') return `${Number(val).toFixed(2)} €`;
      if (field === 'dataPrivacyConsent') return val ? 'Zugestimmt' : 'Nicht erteilt';
      return String(val);
    };

    for (const mem of allMembers) {
      if (!idSet.has(mem.id)) continue;

      const memberCopy = { ...mem };
      const changes: MemberAuditLog['changes'] = [];

      // Art, Status, Zahlweise, Zahlungsart, Beitrag und Austritt nach den
      // Regeln des Formulars (D-27, wie Android). Vorher setzte die
      // Sammelbearbeitung z. B. „gekündigt“, ließ aber Beitrag und Lastschrift stehen.
      const regel = wendeSammelRegelnAn(memberCopy, updates, lokalesHeute());
      const geregelt = regel.mitglied;
      if (regel.uebersprungen.length > 0) {
        gesperrt.push({ name: `${memberCopy.firstName} ${memberCopy.lastName}`.trim(), felder: regel.uebersprungen });
      }
      const regelFelder = ['membershipType', 'status', 'feePeriod', 'paymentMethod', 'feeAmount', 'exitDate'] as const;
      for (const feld of regelFelder) {
        const vorher = memberCopy[feld];
        const nachher = geregelt[feld];
        if ((vorher ?? '') === (nachher ?? '')) continue;
        changes.push({
          field: feld,
          label: fieldLabels[feld],
          oldValue: feld === 'exitDate' ? (vorher as string) || '–' : formatVal(feld, vorher),
          newValue: feld === 'exitDate' ? (nachher as string) || '–' : formatVal(feld, nachher)
        });
      }
      Object.assign(memberCopy, {
        membershipType: geregelt.membershipType,
        status: geregelt.status,
        feePeriod: geregelt.feePeriod,
        paymentMethod: geregelt.paymentMethod,
        feeAmount: geregelt.feeAmount,
        exitDate: geregelt.exitDate
      });

      // Department
      if (updates.department !== undefined && memberCopy.department !== updates.department) {
        changes.push({
          field: 'department',
          label: fieldLabels.department,
          oldValue: memberCopy.department || '–',
          newValue: updates.department
        });
        memberCopy.department = updates.department;
      }

      // Entry Date
      if (updates.entryDate !== undefined && updates.entryDate !== '' && memberCopy.entryDate !== updates.entryDate) {
        changes.push({
          field: 'entryDate',
          label: fieldLabels.entryDate,
          oldValue: memberCopy.entryDate || '–',
          newValue: updates.entryDate
        });
        memberCopy.entryDate = updates.entryDate;
      }

      // Monthly Due Day
      if (updates.monthlyDueDay !== undefined && memberCopy.bankDetails?.monthlyDueDay !== updates.monthlyDueDay) {
        changes.push({
          field: 'monthlyDueDay',
          label: 'Fälligkeitstag (monatlicher Einzug)',
          oldValue: memberCopy.bankDetails?.monthlyDueDay ? `${memberCopy.bankDetails.monthlyDueDay}. des Monats` : '–',
          newValue: `${updates.monthlyDueDay}. des Monats`
        });
        memberCopy.bankDetails = {
          ...memberCopy.bankDetails,
          monthlyDueDay: updates.monthlyDueDay
        };
      }

      // Data Privacy Consent
      if (updates.dataPrivacyConsent !== undefined && memberCopy.dataPrivacyConsent !== updates.dataPrivacyConsent) {
        changes.push({
          field: 'dataPrivacyConsent',
          label: fieldLabels.dataPrivacyConsent,
          oldValue: memberCopy.dataPrivacyConsent ? 'Zugestimmt' : 'Nicht erteilt',
          newValue: updates.dataPrivacyConsent ? 'Zugestimmt' : 'Nicht erteilt'
        });
        memberCopy.dataPrivacyConsent = updates.dataPrivacyConsent;
      }

      // Notes
      if (updates.notesAction === 'replace' && updates.notesValue !== undefined) {
        if (memberCopy.notes !== updates.notesValue) {
          changes.push({
            field: 'notes',
            label: fieldLabels.notes,
            oldValue: memberCopy.notes || '–',
            newValue: updates.notesValue || '–'
          });
          memberCopy.notes = updates.notesValue;
        }
      } else if (updates.notesAction === 'append' && updates.notesValue && updates.notesValue.trim()) {
        const newNotes = memberCopy.notes ? `${memberCopy.notes}\n${updates.notesValue.trim()}` : updates.notesValue.trim();
        changes.push({
          field: 'notes',
          label: 'Notiz angehängt',
          oldValue: memberCopy.notes || '–',
          newValue: newNotes
        });
        memberCopy.notes = newNotes;
      }

      if (changes.length > 0) {
        memberCopy.updatedAt = now;
        await putItemToStore(STORES.MEMBERS, memberCopy);

        const auditLog: MemberAuditLog = {
          id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          memberId: memberCopy.id,
          memberNumber: memberCopy.memberNumber,
          memberName: `${memberCopy.firstName} ${memberCopy.lastName}`,
          timestamp: now,
          author,
          action: 'update',
          summary: `Sammeländerung Stammdaten: ${changes.length} Feld(er) angepasst (${changes.map(c => c.label).join(', ')})`,
          changes
        };
        await putItemToStore(STORES.AUDIT_LOGS, auditLog);
        updatedMembersList.push(memberCopy);
      }
    }

    return {
      updatedCount: updatedMembersList.length,
      updatedMembers: updatedMembersList,
      gesperrt
    };
  },

  async batchSaveMembers(members: Member[], author = BEARBEITER): Promise<{ added: number; updated: number }> {
    const current = await this.getMembers();
    const map = new Map<string, Member>(current.map(m => [m.id, m]));
    let added = 0;
    let updated = 0;
    const now = new Date().toISOString();

    for (const mem of members) {
      if (map.has(mem.id)) {
        updated++;
        mem.updatedAt = now;
      } else {
        added++;
        mem.createdAt = mem.createdAt || now;
        mem.updatedAt = now;
      }
      map.set(mem.id, mem);
    }

    await saveAllToStore(STORES.MEMBERS, Array.from(map.values()));

    const auditLog: MemberAuditLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      memberId: 'batch-import',
      memberNumber: 'CSV-IMPORT',
      memberName: `${members.length} Mitglieder`,
      timestamp: now,
      author,
      action: 'create',
      summary: `Batch-CSV-Import: ${added} Mitglied(er) neu hinzugefügt, ${updated} aktualisiert.`,
      changes: []
    };
    await putItemToStore(STORES.AUDIT_LOGS, auditLog);

    return { added, updated };
  },

  // Audit Logs
  async getAuditLogs(memberId?: string): Promise<MemberAuditLog[]> {
    const logs = await getAllFromStore<MemberAuditLog>(STORES.AUDIT_LOGS);
    logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    if (memberId) {
      return logs.filter(l => l.memberId === memberId);
    }
    return logs;
  },

  // Accounts
  async getAccounts(): Promise<FinancialAccount[]> {
    const accounts = await getAllFromStore<FinancialAccount>(STORES.ACCOUNTS);
    const hatPlatz = (a: FinancialAccount): boolean => typeof a.order === 'number';

    // Die Reihenfolge steht im Feld `order` jedes Kontos und damit in der
    // Datenbank und in jeder Sicherung.
    //
    // Bis November 2026 galt stattdessen eine Liste im Browserspeicher
    // (`vm_accounts_order`). Sie fehlte in der Sicherung, und nach dem
    // Einspielen einer Sicherung von einem anderen Gerät galt weiter die
    // alte Liste dieses Geräts (D-31). Sie wird nur noch gelesen, um einen
    // Altbestand einmalig zu übernehmen: solange es Konten ohne `order` gibt.
    if (accounts.length > 0 && !accounts.every(hatPlatz)) {
      let alteListe: string[] = [];
      try {
        const roh = JSON.parse(localStorage.getItem('vm_accounts_order') || '[]');
        if (Array.isArray(roh)) alteListe = roh.filter(x => typeof x === 'string');
      } catch {
        // localStorage fehlt oder ist unlesbar: dann ohne alte Liste
      }
      const platz = (a: FinancialAccount): number => {
        const i = alteListe.indexOf(a.id);
        if (i !== -1) return i;
        // nicht in der alten Liste: dahinter, nach `order`, sonst ans Ende
        return alteListe.length + (hatPlatz(a) ? (a.order as number) : 100000);
      };
      accounts.sort((a, b) => platz(a) - platz(b) || (a.createdAt || '').localeCompare(b.createdAt || ''));
      accounts.forEach((a, i) => {
        a.order = i;
      });
      try {
        for (const a of accounts) await putItemToStore(STORES.ACCOUNTS, a);
      } catch (err) {
        console.warn('Kontenreihenfolge konnte nicht übernommen werden:', err);
      }
      return accounts;
    }

    accounts.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    return accounts;
  },

  async saveAccount(account: FinancialAccount): Promise<void> {
    if (!account.id) {
      account.id = `acc-${Date.now()}`;
      account.createdAt = new Date().toISOString();
    }
    // Ohne eigenen Platz: ein vorhandenes Konto behält seinen, ein neues
    // kommt ans Ende. Vorher fiel ein bearbeitetes Konto aus der Reihenfolge.
    if (typeof account.order !== 'number') {
      const vorhandene = await getAllFromStore<FinancialAccount>(STORES.ACCOUNTS);
      const altes = vorhandene.find(a => a.id === account.id);
      account.order =
        typeof altes?.order === 'number'
          ? altes.order
          : vorhandene.reduce((max, a) => (typeof a.order === 'number' && a.order > max ? a.order : max), -1) + 1;
    }
    await putItemToStore(STORES.ACCOUNTS, account);
  },

  async saveAccounts(accounts: FinancialAccount[]): Promise<void> {
    const withOrder = accounts.map((acc, index) => ({
      ...acc,
      order: index
    }));
    await saveAllToStore(STORES.ACCOUNTS, withOrder);
  },

  /**
   * Löscht ein Konto. Hängen Buchungen daran, müssen sie auf ein anderes
   * Konto übertragen werden (`uebertragenAuf`); ohne das wirft die Funktion
   * mit einer verständlichen Meldung und ändert nichts. Vorher blieben die
   * Buchungen ohne Konto zurück (D-31). Regeln: `planeKontoLoeschen`.
   */
  async deleteAccount(id: string, uebertragenAuf?: string | null): Promise<{ uebertragen: number }> {
    const [konten, buchungen] = await Promise.all([
      getAllFromStore<FinancialAccount>(STORES.ACCOUNTS),
      getAllFromStore<Transaction>(STORES.TRANSACTIONS)
    ]);
    const plan = planeKontoLoeschen(id, konten, buchungen, uebertragenAuf);
    if (!plan.ok) throw new Error(plan.fehler || 'Das Konto kann nicht gelöscht werden.');
    const now = new Date().toISOString();
    for (const b of plan.geaendert) {
      await putItemToStore(STORES.TRANSACTIONS, { ...b, updatedAt: now });
    }
    await deleteItemFromStore(STORES.ACCOUNTS, id);
    return { uebertragen: plan.geaendert.length };
  },

  // Transactions
  async getTransactions(): Promise<Transaction[]> {
    const txs = await getAllFromStore<Transaction>(STORES.TRANSACTIONS);
    return txs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  },

  async saveTransaction(transaction: Transaction): Promise<void> {
    // Neuer Beleg an einer archivierten Buchung: Archivvermerk entfällt (R4b).
    // Das Objekt wird wie bisher an Ort und Stelle ergänzt (id, updatedAt).
    if (buchungOhneAltenVermerk(transaction) !== transaction) delete transaction.receipt?.archiv;
    const now = new Date().toISOString();
    if (!transaction.id) {
      transaction.id = `tx-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      transaction.createdAt = now;
    }
    transaction.updatedAt = now;
    await putItemToStore(STORES.TRANSACTIONS, transaction);
    
    // Automatische Synchronisation des Belegs in die Dokumentenverwaltung
    if (transaction.receipt && transaction.receipt.dataUrl) {
      const docId = `doc-receipt-${transaction.id}`;
      // Ablage im Ordner „Buchhaltungsbelege & Finanzen / Belege <Jahr>“ wie
      // bei Android (D-16). Hat jemand den Beleg schon in einen anderen
      // Ordner verschoben, bleibt er dort.
      const bisher = await getItemFromStore<ClubDocument>(STORES.DOCUMENTS, docId);
      const folderId = bisher?.folderId || (await this.belegOrdnerFuer(transaction.date));
      const doc: ClubDocument = {
        ...(bisher ?? {}),
        id: docId,
        title: `Beleg: ${transaction.documentNumber} - ${transaction.bookingText || transaction.partner}`,
        fileName: transaction.receipt.name || `Beleg_${transaction.documentNumber}.pdf`,
        fileType: transaction.receipt.type || 'application/pdf',
        fileSize: transaction.receipt.size || 0,
        dataUrl: transaction.receipt.dataUrl,
        category: 'belege',
        date: transaction.date,
        uploadDate: transaction.receipt.uploadedAt || transaction.createdAt || now,
        tags: ['Beleg', transaction.sphere, transaction.category, transaction.documentNumber].filter(Boolean),
        notes: transaction.notes || `Buchungsbeleg für ${transaction.partner} (${transaction.bookingText})`,
        transactionId: transaction.id,
        transactionDocNumber: transaction.documentNumber,
        isReceipt: true,
        folderId,
        createdAt: bisher?.createdAt || transaction.createdAt || now,
        updatedAt: now
      };
      await putItemToStore(STORES.DOCUMENTS, dokumentOhneAltenVermerk(doc));
    }
    
  },

  async saveBatchTransactions(transactions: Transaction[]): Promise<void> {
    const current = await this.getTransactions();
    const map = new Map<string, Transaction>(current.map(t => [t.id, t]));
    transactions.forEach(t => map.set(t.id, buchungOhneAltenVermerk(t)));
    await saveAllToStore(STORES.TRANSACTIONS, Array.from(map.values()));
  },

  async batchSaveTransactions(transactions: Transaction[]): Promise<void> {
    return this.saveBatchTransactions(transactions);
  },

  /**
   * Entfernt das Beleg-Dokument, das `saveTransaction` zu einer Buchung in
   * der Dokumentenverwaltung angelegt hat. Vorher blieb es nach dem Löschen
   * der Buchung als Waise stehen (D-08). Gelöscht wird nur, was wirklich ein
   * solcher Beleg ist; ein Dokument, das jemand von Hand abgelegt hat, bleibt.
   */
  async entferneBelegDokument(buchungsId: string): Promise<void> {
    const docId = belegDokumentId(buchungsId);
    const doc = await getItemFromStore<ClubDocument>(STORES.DOCUMENTS, docId);
    if (doc && (doc.isReceipt || doc.transactionId === buchungsId)) {
      await deleteItemFromStore(STORES.DOCUMENTS, docId);
    }
  },

  async deleteTransaction(id: string): Promise<void> {
    await deleteItemFromStore(STORES.TRANSACTIONS, id);
    await this.entferneBelegDokument(id).catch(err =>
      console.warn('Beleg-Dokument konnte nicht entfernt werden:', err)
    );
  },

  async deleteMultipleTransactions(ids: string[]): Promise<number> {
    const idSet = new Set(ids);
    const allTxs = await this.getTransactions();
    const remaining = allTxs.filter(t => !idSet.has(t.id));
    await saveAllToStore(STORES.TRANSACTIONS, remaining);
    // Auch beim Sammellöschen die Beleg-Dokumente mitnehmen (D-30).
    for (const id of ids) {
      await this.entferneBelegDokument(id).catch(err =>
        console.warn('Beleg-Dokument konnte nicht entfernt werden:', err)
      );
    }
    return ids.length;
  },

  /**
   * Sammelbearbeitung. Regeln in `wendeSammelAn` (D-30): Bei Umbuchungen und
   * aufgeteilten Buchungen bleiben Sphäre, Sparte, Konto des Kontenrahmens
   * und Umsatzsteuer unverändert; eine Umbuchung wird nicht auf ihr eigenes
   * Zielkonto umgestellt. Die Rückgabe sagt, wie oft das geschah.
   */
  async bulkUpdateTransactions(
    ids: string[],
    updates: TransactionBulkUpdates
  ): Promise<{
    updatedCount: number;
    updatedTransactions: Transaction[];
    geaendert: number;
    ohneZuordnung: number;
    kontoUebersprungen: number;
  }> {
    const allTxs = await this.getTransactions();
    const idSet = new Set(ids);
    const now = new Date().toISOString();
    const updatedList: Transaction[] = [];
    let ohneZuordnung = 0;
    let kontoUebersprungen = 0;

    for (const tx of allTxs) {
      if (!idSet.has(tx.id)) continue;
      const r = wendeSammelAn(tx, updates);
      if (r.ohneZuordnung) ohneZuordnung++;
      if (r.kontoUebersprungen) kontoUebersprungen++;
      if (r.geaendert) {
        const copy = { ...r.buchung, updatedAt: now };
        await putItemToStore(STORES.TRANSACTIONS, copy);
        updatedList.push(copy);
      }
    }

    return {
      updatedCount: updatedList.length,
      updatedTransactions: updatedList,
      geaendert: updatedList.length,
      ohneZuordnung,
      kontoUebersprungen
    };
  },

  // Inventory
  async getInventory(): Promise<InventoryItem[]> {
    return getAllFromStore<InventoryItem>(STORES.INVENTORY);
  },

  async getInventoryItem(id: string): Promise<InventoryItem | null> {
    return getItemFromStore<InventoryItem>(STORES.INVENTORY, id);
  },

  async saveInventoryItem(item: InventoryItem): Promise<void> {
    const existing = await getItemFromStore<InventoryItem>(STORES.INVENTORY, item.id);
    const now = new Date().toISOString();

    const toSave: InventoryItem = gegenstandOhneAltenVermerk({
      ...item,
      createdAt: existing?.createdAt || item.createdAt || now,
      updatedAt: now
    });

    await putItemToStore(STORES.INVENTORY, toSave);
  },

  async batchSaveInventory(items: InventoryItem[]): Promise<void> {
    for (const item of items) {
      await this.saveInventoryItem(item);
    }
  },

  /**
   * Löscht einen Gegenstand. Ist er noch an Mitglieder ausgegeben, wirft die
   * Funktion mit einer Meldung und löscht nichts; sonst blieben Ausgaben von
   * Material zurück, das es nicht mehr gibt (D-104).
   */
  async deleteInventoryItem(id: string): Promise<void> {
    const ausgaben = await getAllFromStore<MemberInventoryAssignment>(STORES.MEMBER_INVENTORY);
    const offen = offeneAusgaben(id, ausgaben);
    if (offen.ausgaben > 0) {
      const item = await getItemFromStore<InventoryItem>(STORES.INVENTORY, id);
      throw new Error(inventarSperrText(item?.name || 'Der Gegenstand', offen));
    }
    await deleteItemFromStore(STORES.INVENTORY, id);
  },

  /**
   * Sammellöschen: Gegenstände, die noch ausgegeben sind, werden übersprungen.
   * Die Rückgabe ist die Zahl der tatsächlich gelöschten; wer wissen will,
   * was übersprungen wurde, nutzt `deleteMultipleInventoryItemsMitBericht`.
   */
  async deleteMultipleInventoryItems(ids: string[]): Promise<number> {
    return (await this.deleteMultipleInventoryItemsMitBericht(ids)).geloescht;
  },

  async deleteMultipleInventoryItemsMitBericht(
    ids: string[]
  ): Promise<{ geloescht: number; uebersprungen: string[] }> {
    const [allItems, ausgaben] = await Promise.all([
      this.getInventory(),
      getAllFromStore<MemberInventoryAssignment>(STORES.MEMBER_INVENTORY)
    ]);
    const { loeschbar, gesperrt } = teileInventarAuswahl(ids, ausgaben);
    const idSet = new Set(loeschbar);
    const remaining = allItems.filter(i => !idSet.has(i.id));
    if (loeschbar.length > 0) await saveAllToStore(STORES.INVENTORY, remaining);
    const namen = new Map<string, string>(allItems.map(i => [i.id, i.name] as [string, string]));
    return { geloescht: loeschbar.length, uebersprungen: gesperrt.map(id => namen.get(id) || id) };
  },

  async bulkUpdateInventoryItems(
    ids: string[],
    updates: InventoryBulkUpdates
  ): Promise<{ updatedCount: number; updatedItems: InventoryItem[] }> {
    const allItems = await this.getInventory();
    const idSet = new Set(ids);
    const now = new Date().toISOString();
    const updatedList: InventoryItem[] = [];

    // Regeln an einer Stelle (D-103): angehakt + leer leert freiwillige Felder;
    // gezählt wird nur, was sich wirklich ändert
    const problem = pruefeSammel(updates);
    if (problem) throw new Error(problem);
    for (const item of allItems) {
      if (!idSet.has(item.id)) continue;
      const copy = wendeInventarSammelAn(item, updates, now, lokalesHeute());
      if (copy) {
        await putItemToStore(STORES.INVENTORY, copy);
        updatedList.push(copy);
      }
    }

    return {
      updatedCount: updatedList.length,
      updatedItems: updatedList
    };
  },

  // ----------------------------------------------------
  // MITGLIEDER-MATERIAL & INVENTARVERKNÜPFUNG
  // ----------------------------------------------------
  async getMemberInventoryAssignments(): Promise<MemberInventoryAssignment[]> {
    const list = await getAllFromStore<MemberInventoryAssignment>(STORES.MEMBER_INVENTORY);
    return list.sort((a, b) => new Date(b.issueDate || b.createdAt || 0).getTime() - new Date(a.issueDate || a.createdAt || 0).getTime());
  },

  async getMemberInventoryAssignmentsByMember(memberId: string): Promise<MemberInventoryAssignment[]> {
    const all = await this.getMemberInventoryAssignments();
    return all.filter(a => a.memberId === memberId);
  },

  async saveMemberInventoryAssignment(assignment: MemberInventoryAssignment, author = BEARBEITER): Promise<MemberInventoryAssignment> {
    const now = new Date().toISOString();
    const existing = await getItemFromStore<MemberInventoryAssignment>(STORES.MEMBER_INVENTORY, assignment.id);
    const toSave: MemberInventoryAssignment = {
      ...assignment,
      createdAt: existing?.createdAt || assignment.createdAt || now,
      updatedAt: now
    };
    await putItemToStore(STORES.MEMBER_INVENTORY, toSave);
    // Änderungsprotokoll des Mitglieds wie Android (ausgegeben, bearbeitet, zurückgegeben …)
    const eintrag = materialGespeichert(existing, toSave);
    if (eintrag) await this.protokolliereAmMitglied(toSave.memberId, eintrag, now, author);
    return toSave;
  },

  async deleteMemberInventoryAssignment(id: string, author = BEARBEITER): Promise<void> {
    const existing = await getItemFromStore<MemberInventoryAssignment>(STORES.MEMBER_INVENTORY, id);
    await deleteItemFromStore(STORES.MEMBER_INVENTORY, id);
    if (existing) await this.protokolliereAmMitglied(existing.memberId, materialEntfernt(existing), new Date().toISOString(), author);
  },

  /**
   * Noch ausgegebenes Material von Mitgliedern, die gleich gelöscht werden:
   * zurück ins Inventar oder auf ein anderes Mitglied übertragen (T-352, wie
   * Android). Vor dem Löschen aufrufen, damit der Empfänger seinen Eintrag
   * „Material übernommen von …“ bekommt.
   */
  async materialVonMitgliedernAufloesen(ids: string[], wahl: MaterialWahl, author = BEARBEITER): Promise<{ zurueckgegeben: number; uebertragen: number }> {
    const [alle, mitglieder] = await Promise.all([
      getAllFromStore<MemberInventoryAssignment>(STORES.MEMBER_INVENTORY),
      this.getMembers()
    ]);
    const s = new Set(ids);
    const jetzt = new Date().toISOString();
    const r = materialBeimLoeschen(alle, mitglieder.filter(m => s.has(m.id)), wahl, mitglieder, lokalesHeute(), jetzt);
    for (const a of r.geaendert) await putItemToStore(STORES.MEMBER_INVENTORY, a);
    for (const p of r.protokoll) await this.protokolliereAmMitglied(p.memberId, { summary: p.summary, changes: [] }, jetzt, author);
    return { zurueckgegeben: r.zurueckgegeben, uebertragen: r.uebertragen };
  },

  /**
   * Schreibt einen Eintrag (Material, Unterlagen) in das Änderungsprotokoll des
   * Mitglieds; gibt es das Mitglied nicht mehr, entfällt er.
   */
  async protokolliereAmMitglied(memberId: string, eintrag: MaterialEintrag, now: string, author: string): Promise<void> {
    const member = await getItemFromStore<Member>(STORES.MEMBERS, memberId);
    if (!member) return;
    const auditLog: MemberAuditLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      memberId: member.id,
      memberNumber: member.memberNumber,
      memberName: `${member.firstName} ${member.lastName}`,
      timestamp: now,
      author,
      action: 'update',
      summary: eintrag.summary,
      changes: eintrag.changes
    };
    await putItemToStore(STORES.AUDIT_LOGS, auditLog);
  },

  // Settings
  async getSettings(): Promise<ClubSettings> {
    const res = await getItemFromStore<ClubSettings & { id: string }>(STORES.SETTINGS, 'main');
    if (res) {
      const { id, ...rest } = res;
      const { bereinigt, warVeraltet } = ohneVeralteteSmtpFelder(rest as Record<string, unknown>);

      // Einmalige Bereinigung: Stammt der Datenbestand noch aus einer
      // älteren Fassung, steht hier ein SMTP-Passwort im Klartext (oder ein
      // KI-Schlüssel). Beide Funktionen gibt es nicht mehr — die Felder
      // werden hier nur noch aus dem Speicher entfernt, nicht ersetzt.
      if (warVeraltet) {
        putItemToStore(STORES.SETTINGS, { id: 'main', ...bereinigt }).catch(() => {});
        console.info(
          'Veraltete Zugangsdaten (SMTP/KI aus einer älteren Fassung) wurden aus ' +
            'den Vereinsstammdaten entfernt. Diese Funktionen gibt es in dieser ' +
            'Fassung nicht mehr.'
        );
      }

      return bereinigt as unknown as ClubSettings;
    }
    return neutraleEinstellungen();
  },

  async saveSettings(settings: ClubSettings): Promise<void> {
    // Auch beim Schreiben bereinigen: Eine alte Datensicherung oder ein
    // veralteter Aufrufer brächte die Felder sonst zurück.
    const { bereinigt } = ohneVeralteteSmtpFelder(settings as unknown as Record<string, unknown>);
    const sauber = bereinigt as unknown as ClubSettings;
    await putItemToStore(STORES.SETTINGS, { id: 'main', ...sauber });
  },

  // SEPA Run History & Financial Booking
  async getSepaRuns(): Promise<SepaRunHistory[]> {
    const runs = await getAllFromStore<SepaRunHistory>(STORES.SEPA_RUNS);
    return runs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  async saveSepaRun(run: SepaRunHistory): Promise<void> {
    await putItemToStore(STORES.SEPA_RUNS, run);
  },

  async deleteSepaRun(id: string): Promise<void> {
    await deleteItemFromStore(STORES.SEPA_RUNS, id);
  },

  /**
   * Automatically books all debit items of a SEPA run into the financial accounting ledger
   */
  async bookSepaRunTransactions(run: SepaRunHistory, targetAccountId: string): Promise<Transaction[]> {
    // Ein Lauf wird nur einmal verbucht
    const gespeichert = await getItemFromStore<SepaRunHistory>(STORES.SEPA_RUNS, run.id);
    if (gespeichert?.isBooked) throw new Error('Dieser Beitragslauf ist bereits verbucht.');
    const now = new Date().toISOString();
    // Konto 40000, eindeutige Belegnummern (D-02, wie Android)
    const vorhandene = (await this.getTransactions()).map(t => t.documentNumber);
    const createdTransactions = beitragsBuchungen(
      run,
      targetAccountId,
      vorhandene,
      now,
      nr => `tx-sepa-${run.id}-${nr}-${Math.random().toString(36).substring(2, 6)}`
    );

    // Save batch transactions
    if (createdTransactions.length > 0) {
      await this.saveBatchTransactions(createdTransactions);
    }

    // Mark SEPA run as booked
    const updatedRun: SepaRunHistory = {
      ...run,
      isBooked: true,
      bookedToAccountId: targetAccountId
    };
    await this.saveSepaRun(updatedRun);

    return createdTransactions;
  },

  /**
   * Mitglieder nach dem ersten Einzug auf Folgelastschrift umstellen (D-22).
   * Nur auf Ja des Anwenders; gibt die Zahl der umgestellten zurück.
   */
  async stelleAufFolgelastschriftUm(memberIds: string[]): Promise<number> {
    let n = 0;
    for (const id of memberIds) {
      const m = await getItemFromStore<Member>(STORES.MEMBERS, id);
      if (!m || m.bankDetails?.mandateSequenceType !== 'FRST') continue;
      await putItemToStore(STORES.MEMBERS, {
        ...m,
        bankDetails: { ...m.bankDetails, mandateSequenceType: 'RCUR' },
        updatedAt: new Date().toISOString()
      });
      n++;
    }
    return n;
  },

  // Documents Management
  /**
   * Kennung des Ordners „Buchhaltungsbelege & Finanzen / Belege <Jahr>“ für
   * einen Beleg mit diesem Datum; fehlende Ordner werden angelegt
   * (Regeln: `planeBelegOrdner`).
   */
  async belegOrdnerFuer(datum: string | undefined): Promise<string> {
    const vorhandene = await this.getFolders();
    const { zielId, neu } = planeBelegOrdner(vorhandene, datum);
    for (const ordner of neu) await putItemToStore(STORES.FOLDERS, ordner);
    return zielId;
  },

  /**
   * Ordner „Belege <Jahr> / Spendenbescheinigungen“ bzw. „… / Ausgangsrechnungen“
   * (D-40, D-47, wie Android); fehlende Ordner werden angelegt.
   */
  async belegUnterordnerFuer(datum: string | undefined, art: BelegArt): Promise<string> {
    const vorhandene = await this.getFolders();
    const { zielId, neu } = planeUnterordner(vorhandene, datum, art);
    for (const ordner of neu) await putItemToStore(STORES.FOLDERS, ordner);
    return zielId;
  },

  /**
   * Legt das PDF einer Rechnung ab. Es gibt je Rechnung genau ein Dokument:
   * ein erneutes Ablegen ersetzt es (D-47). Vorher entstand bei jedem
   * Speichern mit „PDF ablegen“ ein weiteres Dokument. Liegt es schon in
   * einem selbst gewählten Ordner, bleibt es dort.
   */
  async saveInvoicePdfDocument(invoice: ClubInvoice, doc: ClubDocument): Promise<ClubDocument> {
    const vorhandeneId = invoice.documentId
      ? (await getItemFromStore<ClubDocument>(STORES.DOCUMENTS, invoice.documentId))?.id
      : undefined;
    const id = vorhandeneId || `doc-inv-${invoice.id}`;
    const bisher = await getItemFromStore<ClubDocument>(STORES.DOCUMENTS, id);
    const ordner = await this.getFolders();
    const folderId =
      bisher?.folderId && !sollEinsortiertWerden(bisher.folderId, ordner)
        ? bisher.folderId
        : await this.belegUnterordnerFuer(invoice.date, 'rechnungen');
    const now = new Date().toISOString();
    const neu: ClubDocument = {
      ...(bisher ?? {}),
      ...doc,
      id,
      folderId,
      createdAt: bisher?.createdAt || doc.createdAt || now,
      updatedAt: now
    };
    // Neu erzeugtes PDF: ein alter Archivvermerk gilt nicht mehr (R4b)
    const gespeichert = dokumentOhneAltenVermerk(neu);
    await putItemToStore(STORES.DOCUMENTS, gespeichert);
    return gespeichert;
  },

  async getDocuments(): Promise<ClubDocument[]> {
    const docs = await getAllFromStore<ClubDocument>(STORES.DOCUMENTS);
    // Einmalige Nacharbeit: Belege, die der Desktop früher ohne Ordner
    // abgelegt hat (D-16), kommen in „Belege <Jahr>“. Betroffen sind nur
    // Belege OHNE Ordner; was jemand selbst einsortiert hat, bleibt.
    const ohneOrdner = docs.filter(d => d.isReceipt && d.transactionId && !d.folderId && !belegArtVon(d.id));
    if (ohneOrdner.length > 0) {
      try {
        for (const d of ohneOrdner) {
          d.folderId = await this.belegOrdnerFuer(d.date);
          await putItemToStore(STORES.DOCUMENTS, d);
        }
      } catch (err) {
        console.warn('Belege konnten nicht in ihre Ordner einsortiert werden:', err);
      }
    }
    // Ebenso einmalig: Zuwendungsbestätigungen und Rechnungs-PDFs in ihre
    // Unterordner (D-40, D-47). Betroffen sind nur solche ohne Ordner oder im
    // Haupt- bzw. Jahresordner; selbst verschobene bleiben, wo sie sind.
    try {
      const ordner = await this.getFolders();
      for (const d of docs) {
        const art = belegArtVon(d.id);
        if (!art || !sollEinsortiertWerden(d.folderId, ordner)) continue;
        const ziel = await this.belegUnterordnerFuer(d.date, art);
        if (d.folderId === ziel) continue;
        d.folderId = ziel;
        await putItemToStore(STORES.DOCUMENTS, d);
      }
    } catch (err) {
      console.warn('Spenden- und Rechnungs-PDFs konnten nicht einsortiert werden:', err);
    }
    return docs.sort((a, b) => new Date(b.date || b.createdAt).getTime() - new Date(a.date || a.createdAt).getTime());
  },

  async getDocument(id: string): Promise<ClubDocument | null> {
    return getItemFromStore<ClubDocument>(STORES.DOCUMENTS, id);
  },

  async saveDocument(document: ClubDocument): Promise<void> {
    const now = new Date().toISOString();
    if (!document.id) {
      document.id = `doc-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      document.createdAt = now;
    }
    document.updatedAt = now;
    await putItemToStore(STORES.DOCUMENTS, dokumentOhneAltenVermerk(document));
  },

  async saveBatchDocuments(documents: ClubDocument[]): Promise<void> {
    const current = await this.getDocuments();
    const map = new Map<string, ClubDocument>(current.map(d => [d.id, d]));
    documents.forEach(d => map.set(d.id, dokumentOhneAltenVermerk(d)));
    await saveAllToStore(STORES.DOCUMENTS, Array.from(map.values()));
  },

  async deleteDocument(id: string): Promise<void> {
    await deleteItemFromStore(STORES.DOCUMENTS, id);
  },

  async deleteMultipleDocuments(ids: string[]): Promise<number> {
    const current = await this.getDocuments();
    const idSet = new Set(ids);
    const remaining = current.filter(d => !idSet.has(d.id));
    await saveAllToStore(STORES.DOCUMENTS, remaining);
    return ids.length;
  },

  async moveDocumentsToCategory(ids: string[], targetCategory: DocumentCategory): Promise<number> {
    const current = await this.getDocuments();
    const idSet = new Set(ids);
    const now = new Date().toISOString();
    let count = 0;
    const updated = current.map(d => {
      if (idSet.has(d.id)) {
        count++;
        return {
          ...d,
          category: targetCategory,
          updatedAt: now
        };
      }
      return d;
    });
    await saveAllToStore(STORES.DOCUMENTS, updated);
    return count;
  },

  // Folder Management
  async getFolders(): Promise<DocumentFolder[]> {
    const folders = await getAllFromStore<DocumentFolder>(STORES.FOLDERS);
    if (!folders || folders.length === 0) {
      const initial = getInitialFolders();
      await saveAllToStore(STORES.FOLDERS, initial);
      return initial;
    }
    return folders.sort((a, b) => a.name.localeCompare(b.name, 'de'));
  },

  async getFolder(id: string): Promise<DocumentFolder | null> {
    return getItemFromStore<DocumentFolder>(STORES.FOLDERS, id);
  },

  async saveFolder(folder: DocumentFolder): Promise<void> {
    const now = new Date().toISOString();
    if (!folder.id) {
      folder.id = `folder-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      folder.createdAt = now;
    }
    folder.updatedAt = now;
    await putItemToStore(STORES.FOLDERS, folder);
  },

  async deleteFolder(folderId: string): Promise<void> {
    // Retrieve all folders to find descendant subfolders recursively
    const allFolders = await this.getFolders();
    const toDeleteIds = new Set<string>([folderId]);

    let added = true;
    while (added) {
      added = false;
      for (const f of allFolders) {
        if (f.parentId && toDeleteIds.has(f.parentId) && !toDeleteIds.has(f.id)) {
          toDeleteIds.add(f.id);
          added = true;
        }
      }
    }

    // Unassign documents inside deleted folders (or keep them at root / unassigned)
    const docs = await this.getDocuments();
    let docsChanged = false;
    const updatedDocs = docs.map(d => {
      if (d.folderId && toDeleteIds.has(d.folderId)) {
        docsChanged = true;
        return {
          ...d,
          folderId: undefined,
          updatedAt: new Date().toISOString()
        };
      }
      return d;
    });

    if (docsChanged) {
      await saveAllToStore(STORES.DOCUMENTS, updatedDocs);
    }

    // Remove deleted folders
    const remainingFolders = allFolders.filter(f => !toDeleteIds.has(f.id));
    await saveAllToStore(STORES.FOLDERS, remainingFolders);
  },

  async moveDocumentToFolder(docId: string, folderId: string | null, newCategory?: DocumentCategory): Promise<void> {
    const doc = await this.getDocument(docId);
    if (!doc) return;
    doc.folderId = folderId || undefined;
    if (newCategory) {
      doc.category = newCategory;
    }
    doc.updatedAt = new Date().toISOString();
    await this.saveDocument(doc);
  },

  async batchMoveDocumentsToFolder(docIds: string[], folderId: string | null, targetCategory?: DocumentCategory): Promise<number> {
    const current = await this.getDocuments();
    const idSet = new Set(docIds);
    const now = new Date().toISOString();
    let count = 0;
    const updated = current.map(d => {
      if (idSet.has(d.id)) {
        count++;
        return {
          ...d,
          folderId: folderId || undefined,
          ...(targetCategory ? { category: targetCategory } : {}),
          updatedAt: now
        };
      }
      return d;
    });
    await saveAllToStore(STORES.DOCUMENTS, updated);
    return count;
  },

  // Spenden & Zuwendungsbestätigungen (BMF Muster)
  async getDonations(): Promise<DonationReceipt[]> {
    const donations = await getAllFromStore<DonationReceipt>(STORES.DONATIONS);
    return donations.sort((a, b) => new Date(b.date || b.createdAt).getTime() - new Date(a.date || a.createdAt).getTime());
  },

  async getDonation(id: string): Promise<DonationReceipt | null> {
    return getItemFromStore<DonationReceipt>(STORES.DONATIONS, id);
  },

  async saveDonationReceipt(
    receipt: DonationReceipt,
    options?: {
      autoArchiveDoc?: boolean;
      autoCreateTx?: boolean;
      targetAccountId?: string;
      /** Die schon verknüpfte Buchung an Betrag, Datum und Name angleichen (D-39). */
      buchungAnpassen?: boolean;
    }
  ): Promise<{ receipt: DonationReceipt; document?: ClubDocument; transaction?: Transaction }> {
    const now = new Date().toISOString();
    const existing = await getItemFromStore<DonationReceipt>(STORES.DONATIONS, receipt.id);
    const settings = await this.getSettings();

    const toSave: DonationReceipt = {
      ...receipt,
      createdAt: existing?.createdAt || receipt.createdAt || now,
      updatedAt: now
    };

    let createdTx: Transaction | undefined;
    let createdDoc: ClubDocument | undefined;

    // Verknüpfung nur behalten, wenn es die Buchung noch gibt
    const verknuepft = toSave.transactionId
      ? await getItemFromStore<Transaction>(STORES.TRANSACTIONS, toSave.transactionId)
      : null;
    if (!verknuepft) delete toSave.transactionId;

    // 1. Einnahmebuchung zur Geldspende: Konto 40450, eindeutige SP-Nummer
    //    (D-10, D-38; wie Android). Nur, solange noch keine verknüpft ist.
    if (options?.autoCreateTx && options.targetAccountId && toSave.type === 'money' && !toSave.transactionId) {
      const vorhandene = (await this.getTransactions()).map(t => t.documentNumber);
      const tx = spendenBuchung(toSave, options.targetAccountId, vorhandene, now, `tx-don-${toSave.id}-${Date.now()}`);
      await this.saveTransaction(tx);
      createdTx = tx;
      toSave.transactionId = tx.id;
    } else if (options?.buchungAnpassen && verknuepft) {
      // Verknüpfte Buchung nachführen, wenn der Anwender das gewählt hat (D-39)
      await this.saveTransaction(gleicheBuchungAn(verknuepft, toSave, now));
    }

    // 2. Auto-generate PDF & archive in document storage
    if (options?.autoArchiveDoc !== false) {
      try {
        const pdfDataUrl = getDonationPdfDataUrl(toSave, settings);
        const docId = toSave.documentId || `doc-don-${toSave.id}`;
        const isGoods = toSave.type === 'goods';
        // Ablage unter „Belege <Jahr> / Spendenbescheinigungen“ (D-40, wie
        // Android); ein selbst gewählter Ordner bleibt.
        const bisher = await getItemFromStore<ClubDocument>(STORES.DOCUMENTS, docId);
        const folderId =
          bisher?.folderId && !sollEinsortiertWerden(bisher.folderId, await this.getFolders())
            ? bisher.folderId
            : await this.belegUnterordnerFuer(toSave.date, 'spenden');
        const doc: ClubDocument = {
          ...(bisher ?? {}),
          id: docId,
          folderId,
          title: `Zuwendungsbestätigung: ${toSave.receiptNumber} - ${toSave.donorName}`,
          fileName: `Zuwendungsbestaetigung_${toSave.receiptNumber}_${toSave.donorName.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`,
          fileType: 'application/pdf',
          fileSize: Math.round(pdfDataUrl.length * 0.75),
          dataUrl: pdfDataUrl,
          category: 'belege',
          date: toSave.date,
          uploadDate: now,
          tags: ['Spendenbescheinigung', 'Zuwendungsbestätigung', isGoods ? 'Sachzuwendung' : 'Geldzuwendung', toSave.receiptNumber, 'BMF-Muster'],
          notes: `${isGoods ? 'Sachspende' : 'Geldspende'} über ${toSave.amount.toFixed(2)} € von ${toSave.donorName}. BMF-konformes amtliches Formular.`,
          transactionId: toSave.transactionId,
          memberId: toSave.memberId,
          memberName: toSave.donorName,
          isReceipt: true,
          createdAt: bisher?.createdAt || now,
          updatedAt: now
        };
        await this.saveDocument(doc);
        createdDoc = doc;
        toSave.documentId = doc.id;
      } catch (err) {
        console.warn('Could not auto-generate PDF for document archive:', err);
      }
    }

    await putItemToStore(STORES.DONATIONS, toSave);

    return { receipt: toSave, document: createdDoc, transaction: createdTx };
  },

  /**
   * Löscht eine Bestätigung samt abgelegtem PDF. Die verknüpfte Buchung wird
   * nur mitgelöscht, wenn der Anwender das gewählt hat (D-39, wie Android);
   * vorher blieb sie immer stehen, ohne dass es jemand erfuhr.
   */
  async deleteDonationReceipt(id: string, buchungMitLoeschen = false): Promise<void> {
    const existing = await getItemFromStore<DonationReceipt>(STORES.DONATIONS, id);
    if (existing?.documentId) {
      await this.deleteDocument(existing.documentId).catch(() => {});
    }
    await deleteItemFromStore(STORES.DONATIONS, id);
    if (buchungMitLoeschen && existing?.transactionId) {
      const tx = await getItemFromStore<Transaction>(STORES.TRANSACTIONS, existing.transactionId);
      if (tx) await this.deleteTransaction(tx.id);
    }
  },

  // ----------------------------------------------------
  // KONTAKTVERWALTUNG (KONTRAHENTEN, SPONSOREN, LIEFERANTEN)
  // ----------------------------------------------------
  async getContacts(): Promise<ClubContact[]> {
    const contacts = await getAllFromStore<ClubContact>(STORES.CONTACTS);
    return contacts.sort((a, b) => (a.displayName || '').localeCompare(b.displayName || '', 'de'));
  },

  async getContact(id: string): Promise<ClubContact | null> {
    return getItemFromStore<ClubContact>(STORES.CONTACTS, id);
  },

  async saveContact(contact: ClubContact): Promise<ClubContact> {
    const now = new Date().toISOString();
    const existing = await getItemFromStore<ClubContact>(STORES.CONTACTS, contact.id);
    const toSave: ClubContact = {
      ...contact,
      createdAt: existing?.createdAt || contact.createdAt || now,
      updatedAt: now
    };
    await putItemToStore(STORES.CONTACTS, toSave);
    return toSave;
  },

  async saveContacts(contacts: ClubContact[]): Promise<void> {
    await saveAllToStore(STORES.CONTACTS, contacts);
  },

  async deleteContact(id: string): Promise<void> {
    await deleteItemFromStore(STORES.CONTACTS, id);
  },

  // ----------------------------------------------------
  // RECHNUNGSVERWALTUNG & VORLAGEN
  // ----------------------------------------------------
  async getInvoices(): Promise<ClubInvoice[]> {
    const invoices = await getAllFromStore<ClubInvoice>(STORES.INVOICES);
    return invoices.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
  },

  async getInvoice(id: string): Promise<ClubInvoice | null> {
    return getItemFromStore<ClubInvoice>(STORES.INVOICES, id);
  },

  async saveInvoice(invoice: ClubInvoice): Promise<ClubInvoice> {
    const now = new Date().toISOString();
    const existing = await getItemFromStore<ClubInvoice>(STORES.INVOICES, invoice.id);
    const toSave: ClubInvoice = {
      ...invoice,
      createdAt: existing?.createdAt || invoice.createdAt || now,
      updatedAt: now
    };
    await putItemToStore(STORES.INVOICES, toSave);
    return toSave;
  },

  async saveInvoices(invoices: ClubInvoice[]): Promise<void> {
    await saveAllToStore(STORES.INVOICES, invoices);
  },

  /**
   * Die verknüpfte Buchung an Betrag und Empfänger der Rechnung angleichen,
   * wenn der Anwender das beim Bearbeiten gewählt hat (wie Android).
   */
  async angleichenRechnungsBuchung(invoice: ClubInvoice): Promise<void> {
    if (!invoice.linkedTransactionId) return;
    const tx = await getItemFromStore<Transaction>(STORES.TRANSACTIONS, invoice.linkedTransactionId);
    if (tx) await this.saveTransaction(gleicheRechnungsBuchungAn(tx, invoice, new Date().toISOString()));
  },

  /**
   * Rechnung als bezahlt markieren (D-01, D-46, wie Android): Zahldatum und
   * Zahlart festhalten und auf Wunsch die Einnahmebuchung anlegen. Vorher
   * entstand nie eine Buchung, und die Knöpfe in den Details hatten keine
   * Wirkung.
   */
  async markInvoicePaid(id: string, a: BezahltAngaben): Promise<{ invoice: ClubInvoice; transaction?: Transaction }> {
    const inv = await getItemFromStore<ClubInvoice>(STORES.INVOICES, id);
    if (!inv) throw new Error('Die Rechnung gibt es nicht mehr.');
    const fehler = pruefeBezahlt(inv, a);
    if (fehler) throw new Error(fehler);
    const now = new Date().toISOString();
    const vorhanden = inv.linkedTransactionId
      ? await getItemFromStore<Transaction>(STORES.TRANSACTIONS, inv.linkedTransactionId)
      : null;
    let tx: Transaction | undefined;
    if (a.buchungAnlegen && !vorhanden) {
      const belegNummern = (await this.getTransactions()).map(t => t.documentNumber);
      tx = rechnungsBuchung(inv, a, belegNummern, now, `tx-inv-${id}-${Math.random().toString(36).substring(2, 6)}`);
      await this.saveTransaction(tx);
    }
    const neu: ClubInvoice = {
      ...inv,
      status: 'paid',
      paidAt: a.datum,
      paymentMethod: a.zahlart,
      linkedTransactionId: tx?.id ?? (vorhanden ? inv.linkedTransactionId : undefined),
      updatedAt: now
    };
    if (!neu.linkedTransactionId) delete neu.linkedTransactionId;
    await putItemToStore(STORES.INVOICES, neu);
    // Das abgelegte PDF kennt jetzt die Buchung
    if (tx && inv.documentId) {
      const doc = await getItemFromStore<ClubDocument>(STORES.DOCUMENTS, inv.documentId);
      if (doc) await putItemToStore(STORES.DOCUMENTS, { ...doc, transactionId: tx.id, updatedAt: now });
    }
    return { invoice: neu, transaction: tx };
  },

  /** Bezahlte oder stornierte Rechnung zurück auf „offen“; die Buchung wird gelöscht oder nur gelöst. */
  async resetInvoiceToOpen(id: string, buchungMitLoeschen: boolean): Promise<void> {
    const inv = await getItemFromStore<ClubInvoice>(STORES.INVOICES, id);
    if (!inv) return;
    const neu: ClubInvoice = { ...inv, status: 'open', updatedAt: new Date().toISOString() };
    delete neu.paidAt;
    delete neu.paymentMethod;
    delete neu.linkedTransactionId;
    await putItemToStore(STORES.INVOICES, neu);
    if (buchungMitLoeschen && inv.linkedTransactionId) {
      const tx = await getItemFromStore<Transaction>(STORES.TRANSACTIONS, inv.linkedTransactionId);
      if (tx) await this.deleteTransaction(tx.id);
    }
  },

  /** Rechnung stornieren; eine bezahlte erst nach dem Zurücksetzen (wie Android). */
  async cancelInvoice(id: string): Promise<void> {
    const inv = await getItemFromStore<ClubInvoice>(STORES.INVOICES, id);
    if (!inv) return;
    if (inv.status === 'paid') {
      throw new Error('Eine bezahlte Rechnung kann erst nach dem Zurücksetzen auf „offen“ storniert werden.');
    }
    await putItemToStore(STORES.INVOICES, { ...inv, status: 'cancelled', updatedAt: new Date().toISOString() });
  },

  /** Löscht die Rechnung samt abgelegtem PDF; die verknüpfte Buchung nur auf Wunsch. */
  async deleteInvoice(id: string, buchungMitLoeschen = false): Promise<void> {
    const existing = await getItemFromStore<ClubInvoice>(STORES.INVOICES, id);
    if (existing?.documentId) {
      await this.deleteDocument(existing.documentId).catch(() => {});
    }
    await deleteItemFromStore(STORES.INVOICES, id);
    if (buchungMitLoeschen && existing?.linkedTransactionId) {
      const tx = await getItemFromStore<Transaction>(STORES.TRANSACTIONS, existing.linkedTransactionId);
      if (tx) await this.deleteTransaction(tx.id);
    }
  },

  async getInvoiceTemplate(): Promise<InvoiceTemplateSettings> {
    const stored = await getItemFromStore<InvoiceTemplateSettings & { id: string }>(
      STORES.INVOICE_TEMPLATES,
      'main_template'
    );
    if (!stored) {
      return DEFAULT_INVOICE_TEMPLATE;
    }
    return stored;
  },

  async saveInvoiceTemplate(template: InvoiceTemplateSettings): Promise<InvoiceTemplateSettings> {
    const toSave = { id: 'main_template', ...template };
    await putItemToStore(STORES.INVOICE_TEMPLATES, toSave);
    return toSave;
  },

  // ----------------------------------------------------
  // SITZUNGS- & PROTOKOLLVERWALTUNG
  // ----------------------------------------------------
  async getMeetings(): Promise<Meeting[]> {
    const meetings = await getAllFromStore<Meeting>(STORES.MEETINGS);
    return meetings.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
  },

  async getMeeting(id: string): Promise<Meeting | null> {
    return getItemFromStore<Meeting>(STORES.MEETINGS, id);
  },

  async saveMeeting(meeting: Meeting): Promise<Meeting> {
    const now = new Date().toISOString();
    const existing = await getItemFromStore<Meeting>(STORES.MEETINGS, meeting.id);
    const toSave: Meeting = {
      ...meeting,
      createdAt: existing?.createdAt || meeting.createdAt || now,
      updatedAt: now
    };
    await putItemToStore(STORES.MEETINGS, toSave);
    return toSave;
  },

  async saveMeetings(meetings: Meeting[]): Promise<void> {
    await saveAllToStore(STORES.MEETINGS, meetings);
  },

  /**
   * Löscht eine Sitzung. Ein archiviertes Protokoll (`documentId`, ein PDF in
   * der Dokumentenverwaltung) bleibt dabei bewusst stehen, wie in der
   * Android-Fassung: Das abgelegte, unterschriebene Protokoll ist ein eigenes
   * Dokument des Vereins und soll nicht still mit verschwinden. Vorher wurde
   * es ohne Rückfrage mitgelöscht (D-124). Wer es nicht mehr braucht, löscht
   * es in der Dokumentenverwaltung.
   */
  async deleteMeeting(id: string): Promise<void> {
    await deleteItemFromStore(STORES.MEETINGS, id);
  },

  async getMeetingTemplate(): Promise<MeetingTemplateSettings> {
    const stored = await getItemFromStore<MeetingTemplateSettings & { id: string }>(
      STORES.MEETING_TEMPLATES,
      'main_meeting_template'
    );
    if (!stored) {
      return DEFAULT_MEETING_TEMPLATE;
    }
    return stored;
  },

  async saveMeetingTemplate(template: MeetingTemplateSettings): Promise<MeetingTemplateSettings> {
    const toSave = { id: 'main_meeting_template', ...template };
    await putItemToStore(STORES.MEETING_TEMPLATES, toSave);
    return toSave;
  },


  // =========================================================================
  // TERMIN- & VERANSTALTUNGSKALENDER
  // =========================================================================

  async getCalendarEvents(): Promise<CalendarEvent[]> {
    const events = await getAllFromStore<CalendarEvent>(STORES.CALENDAR_EVENTS);
    return events;
  },

  async saveCalendarEvent(event: CalendarEvent): Promise<CalendarEvent> {
    const now = new Date().toISOString();
    const toSave: CalendarEvent = {
      ...event,
      updatedAt: now,
      createdAt: event.createdAt || now
    };
    await putItemToStore(STORES.CALENDAR_EVENTS, toSave);
    return toSave;
  },

  async deleteCalendarEvent(id: string): Promise<void> {
    await deleteItemFromStore(STORES.CALENDAR_EVENTS, id);
  },

  async batchSaveCalendarEvents(events: CalendarEvent[]): Promise<void> {
    for (const evt of events) {
      await putItemToStore(STORES.CALENDAR_EVENTS, evt);
    }
  },

  async getCalendarCategories(): Promise<CalendarEventCategory[]> {
    const categories = await getAllFromStore<CalendarEventCategory>(STORES.CALENDAR_CATEGORIES);
    if (categories.length === 0) {
      await saveAllToStore(STORES.CALENDAR_CATEGORIES, DEFAULT_CALENDAR_CATEGORIES);
      return DEFAULT_CALENDAR_CATEGORIES;
    }
    return categories;
  },

  async saveCalendarCategory(category: CalendarEventCategory): Promise<CalendarEventCategory> {
    await putItemToStore(STORES.CALENDAR_CATEGORIES, category);
    return category;
  },

  async deleteCalendarCategory(id: string): Promise<void> {
    await deleteItemFromStore(STORES.CALENDAR_CATEGORIES, id);
  },

  // =========================================================================
  // AUFNAHMEANTRAG AM GERÄT (P29, wie Android)
  // =========================================================================

  /**
   * Kennung eines Standardordners (z. B. „Digitale Aufnahmeanträge“). Fehlt er
   * (gelöscht), wird erst nach dem Namen gesucht, dann wird er mit seinen
   * übergeordneten Ordnern aus den Standardordnern neu angelegt. Leer, wenn es
   * keinen solchen Standardordner gibt.
   */
  async standardOrdner(id: string): Promise<string> {
    const ordner = await this.getFolders();
    if (ordner.some(o => o.id === id)) return id;
    const vorlagen = getInitialFolders();
    const vorlage = vorlagen.find(o => o.id === id);
    if (!vorlage) return '';
    const gleichNamig = ordner.find(o => o.name === vorlage.name);
    if (gleichNamig) return gleichNamig.id;
    const kette: DocumentFolder[] = [];
    for (let o: DocumentFolder | undefined = vorlage; o; o = vorlagen.find(v => v.id === o!.parentId)) {
      if (!ordner.some(x => x.id === o!.id)) kette.unshift(o);
    }
    for (const o of kette) await putItemToStore(STORES.FOLDERS, o);
    return id;
  },

  /**
   * Nimmt einen geprüften, unterschriebenen Antrag als Mitglied auf: erst die
   * Prüfung, dann das PDF im Dokumentenarchiv („Digitale Aufnahmeanträge“),
   * dann das Mitglied. Schlägt das Speichern des Mitglieds fehl, wird das PDF
   * wieder entfernt (alles oder nichts, wie Android).
   */
  async antragAufnehmen(a: Antrag, nummer: string, pdfDataUrl: string, pdfGroesse: number): Promise<{ member: Member; documentId: string }> {
    const settings = await this.getSettings();
    const members = await getAllFromStore<Member>(STORES.MEMBERS);
    const heute = lokalesHeute();
    const sparten = (settings.departments || []).length ? settings.departments : ['Hauptverein'];
    const problem = aufnahmeFehler(a, nummer, heute, sparten, members);
    if (problem) throw new Error(problem);

    const jetzt = new Date().toISOString();
    const vorgabe = leseAntragEinstellungen(settings).beitraege[a.mitgliedsart];
    const member = mitgliedAusAntrag(a, nummer, vorgabe, heute, `mem-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`, jetzt);
    const ordner = await this.standardOrdner(ORDNER_ANTRAEGE);
    const dok: ClubDocument = {
      id: `doc-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      title: antragDokTitel(a, nummer),
      fileName: antragDateiname(a, nummer),
      fileType: 'application/pdf',
      fileSize: pdfGroesse,
      dataUrl: pdfDataUrl,
      category: 'mitglieder',
      folderId: ordner || null,
      date: heute,
      uploadDate: jetzt,
      tags: antragDokTags(a, nummer),
      notes: ANTRAG_DOK_NOTIZ,
      memberId: member.id,
      memberName: `${member.firstName} ${member.lastName}`,
      isReceipt: false,
      createdAt: jetzt,
      updatedAt: jetzt
    };
    await putItemToStore(STORES.DOCUMENTS, dok);
    try {
      await this.saveMember(member);
    } catch (err) {
      await deleteItemFromStore(STORES.DOCUMENTS, dok.id).catch(() => {});
      throw err;
    }
    return { member, documentId: dok.id };
  },

  /** Eigene Texte des Antrags speichern (Standardtexte werden nicht gespeichert). */
  async antragTexteSpeichern(datenschutz: string, satzung: string): Promise<ClubSettings> {
    const s = { ...(await this.getSettings()) } as ClubSettings & Record<string, unknown>;
    const neu = antragTexteZumSpeichern(datenschutz, satzung);
    for (const [k, v] of Object.entries(neu)) {
      if (v === undefined) delete s[k];
      else s[k] = v;
    }
    await this.saveSettings(s);
    return s;
  },

  /**
   * Satzung oder Datenschutz-Vordruck hinterlegen (nur PDF). Jede Fassung wird
   * als neues Dokument mit Datum im Titel abgelegt; frühere Fassungen bleiben
   * im Archiv, nur die neue wird im Antrag angeboten (wie Android).
   */
  async antragBeilageSetzen(b: Beilage, dataUrl: string, dateiName: string, groesse: number): Promise<{ settings: ClubSettings; dokument: ClubDocument }> {
    const info = BEILAGEN[b];
    const heute = lokalesHeute();
    const jetzt = new Date().toISOString();
    const vorhandene = await getAllFromStore<ClubDocument>(STORES.DOCUMENTS);
    const ordner = await this.standardOrdner(info.ordner);
    const dokument: ClubDocument = {
      id: `doc-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      title: beilageTitel(b, heute, vorhandene.map(d => d.title)),
      fileName: dateiName.trim() || info.dateiName,
      fileType: 'application/pdf',
      fileSize: groesse,
      dataUrl,
      category: info.kategorie,
      folderId: ordner || null,
      date: heute,
      uploadDate: jetzt,
      tags: info.tags,
      notes: 'Wird im Aufnahmeantrag dem neuen Mitglied zum Ansehen angeboten, solange es die aktuelle Fassung ist.',
      isReceipt: false,
      createdAt: jetzt,
      updatedAt: jetzt
    };
    await putItemToStore(STORES.DOCUMENTS, dokument);
    const settings = { ...(await this.getSettings()), [info.feld]: dokument.id };
    await this.saveSettings(settings);
    return { settings, dokument };
  },

  /** Der Antrag bietet die Beilage nicht mehr an; das Dokument bleibt im Archiv. */
  async antragBeilageEntfernen(b: Beilage): Promise<ClubSettings> {
    const s = { ...(await this.getSettings()) } as ClubSettings & Record<string, unknown>;
    delete s[BEILAGEN[b].feld];
    await this.saveSettings(s);
    return s;
  },

  // Full Database Backup & Restore
  async exportFullBackup(): Promise<string> {
    const [
      members,
      transactions,
      accounts,
      auditLogs,
      inventory,
      sepaRuns,
      documents,
      donations,
      contacts,
      invoices,
      invoiceTemplate,
      meetings,
      meetingTemplate,
      dashboardConfig,
      calendarEvents,
      calendarCategories,
      settings
    ] = await Promise.all([
      this.getMembers(),
      this.getTransactions(),
      this.getAccounts(),
      this.getAuditLogs(),
      this.getInventory(),
      this.getSepaRuns(),
      this.getDocuments(),
      this.getDonations(),
      this.getContacts(),
      this.getInvoices(),
      this.getInvoiceTemplate(),
      this.getMeetings(),
      this.getMeetingTemplate(),
      this.getDashboardConfig(),
      this.getCalendarEvents(),
      this.getCalendarCategories(),
      this.getSettings()
    ]);

    // Bis Fassung 1.2 fehlten die folgenden zwei Bereiche in der Sicherung.
    // Wer seinen Bestand auf einen anderen Rechner mitnahm, verlor die
    // Ordnerstruktur des Archivs sowie die Ausgabe von Inventar an Mitglieder.
    const [folders, memberInventory] = await Promise.all([
      this.getFolders(),
      getAllFromStore<MemberInventoryAssignment>(STORES.MEMBER_INVENTORY)
    ]);

    // Der Typ SicherungsDaten verlangt jeden Bereich aus SICHERUNGS_BEREICHE.
    // Wer künftig einen Datenbereich hinzufügt und ihn hier vergisst, bekommt
    // beim `npm run check` einen Fehler — statt eine unvollständige Sicherung.
    const daten: SicherungsDaten = {
      members,
      transactions,
      accounts,
      auditLogs,
      inventory,
      memberInventory,
      sepaRuns,
      documents,
      folders,
      donations,
      contacts,
      invoices,
      invoiceTemplate,
      meetings,
      meetingTemplate,
      dashboardConfig,
      calendarEvents,
      calendarCategories,
      // Die eigenen SKR-42-Konten liegen im Browserspeicher, nicht in der
      // Datenbank, und fehlten deshalb bis November 2026 in der Sicherung
      // (D-12). Sie reisen im Bereich `settings` mit: Die Android-Fassung
      // kennt das Feld nicht, behält unbekannte Felder der Einstellungen
      // aber bei.
      settings: { ...settings, customSkr42Accounts: customCategoryService.getCustomAccounts() }
    };

    const backup = {
      app: 'VereinsManager Lokal',
      version: '1.2.3',
      exportedAt: new Date().toISOString(),
      data: daten
    };

    return JSON.stringify(backup, null, 2);
  },

  /**
   * Liest den eigenen Bestand in derselben Form wie eine Sicherungsdatei.
   * Grundlage für den Abgleich vor dem Einspielen.
   */
  async sammleBestandFuerAbgleich(): Promise<Partial<SicherungsDaten>> {
    const roh = await this.exportFullBackup();
    return (JSON.parse(roh).data || {}) as Partial<SicherungsDaten>;
  },

  /**
   * Prüft eine Sicherungsdatei und vergleicht sie mit dem vorhandenen Bestand,
   * OHNE etwas zu verändern. Damit kann die Oberfläche vor dem Einspielen
   * zeigen, was passieren würde.
   */
  async analysiereSicherung(jsonString: string): Promise<{
    kopf: SicherungsKopf;
    vergleich: BereichsVergleich[];
  }> {
    const { kopf, daten } = leseSicherung(jsonString);
    const bestand = await this.sammleBestandFuerAbgleich();
    return { kopf, vergleich: vergleicheSicherung(daten, bestand) };
  },

  /**
   * Spielt eine Datensicherung ein.
   *
   * `art` entscheidet, was mit dem vorhandenen Bestand geschieht:
   *
   *   ersetzen  — der bisherige Bestand wird durch die Datei ersetzt
   *   ergaenzen — Vorhandenes bleibt unangetastet, aus der Datei kommt nur
   *               hinzu, was es hier noch nicht gibt
   *
   * Vor dem ersten Schreibvorgang wird eine Sicherheitskopie des jetzigen
   * Bestands angelegt. Sie liegt in einer eigenen Datenbank und lässt sich
   * unter Einstellungen → Datensicherung zurückholen. Ohne sie wäre jeder
   * Import eine Einbahnstraße — ein falsch gewählter Dateiname genügte, und
   * die Mitgliederdaten des Vereins wären weg.
   */
  async importFullBackup(
    jsonString: string,
    targetEnv: 'auto' | 'live' = 'live',
    art: ImportArt = 'ersetzen'
  ): Promise<{
    membersCount: number;
    transactionsCount: number;
    inventoryCount: number;
    documentsCount: number;
    donationsCount: number;
    calendarEventsCount: number;
    meetingsCount: number;
    invoicesCount: number;
    contactsCount: number;
    clubName?: string;
    /** Wurde die Sicherheitskopie angelegt? */
    sicherheitskopie: boolean;
    art: ImportArt;
  }> {
    // Erst prüfen, dann anfassen: leseSicherung wirft bei einer Datei, die
    // keine Sicherung ist — vor dem ersten Schreibvorgang.
    const { daten } = leseSicherung(jsonString);
    // Der Inhalt einer fremden Datei ist per Definition ungeprüft. Die
    // Bereiche werden unten einzeln mit Vorgabewerten entpackt; deshalb hier
    // bewusst eine offene Form statt eines vorgetäuschten Typs.
    const data = daten as Record<string, any>;
    // Sicherheitskopie des jetzigen Bestands, bevor irgendetwas überschrieben
    // wird. Schlägt sie fehl, läuft der Import trotzdem weiter — das Ergebnis
    // sagt es aber, damit die Oberfläche darauf hinweisen kann.
    let sicherheitskopie = false;
    try {
      const { SnapshotService } = await import('./snapshotService');
      const kopie = await SnapshotService.createSnapshot(
        'manual',
        `Sicherheitskopie vor dem Einspielen einer Datensicherung (${
          art === 'ersetzen' ? 'alles ersetzen' : 'nur ergänzen'
        })`
      );
      sicherheitskopie = Boolean(kopie);
    } catch (err) {
      console.warn('Sicherheitskopie vor dem Import fehlgeschlagen:', err);
    }

    // Free up any bloated localStorage entries before importing
    purgeBloatedLocalStorage();
    isImportingBackup = true;

    try {
      const {
        members = [],
        transactions = [],
        accounts = [],
        auditLogs = [],
        inventory = [],
        memberInventory = [],
        sepaRuns = [],
        documents = [],
        folders = [],
        donations = [],
        contacts = [],
        invoices = [],
        invoiceTemplate,
        meetings = [],
        meetingTemplate,
        dashboardConfig,
        calendarEvents = [],
        calendarCategories = [],
        // onlineApplications und applicationSettings älterer Sicherungen
        // werden überlesen (D-04, wie Android).
        settings
      } = data;

      // By default target the Live DB so that restored data is available for real usage
      const dbTarget = targetEnv === 'live' ? LIVE_DB_NAME : undefined;

      /**
       * Übernimmt eine Liste aus der Datei.
       *
       * Bereiche, die in der Datei gar nicht vorkommen, werden übersprungen —
       * eine ältere Sicherung, die einen inzwischen hinzugekommenen Bereich
       * noch nicht kennt, darf die hier vorhandenen Daten nicht löschen. Eine
       * ausdrücklich leere Liste ist dagegen eine Aussage und wird beim
       * Ersetzen auch übernommen.
       */
      const uebernehmeListeOhneFangnetz = async (
        store: string,
        ausDatei: unknown,
        vorhandenErmitteln?: () => Promise<{ id: string }[]>
      ): Promise<void> => {
        if (ausDatei === undefined || ausDatei === null) return;
        const liste = (Array.isArray(ausDatei) ? ausDatei : []) as { id: string }[];

        if (art === 'ergaenzen') {
          if (liste.length === 0) return;
          const vorhanden = vorhandenErmitteln
            ? await vorhandenErmitteln()
            : await getAllFromStore<{ id: string }>(store, dbTarget);
          await schreibeListeStreng(store, ergaenzeListe(liste, vorhanden), dbTarget);
          return;
        }

        await schreibeListeStreng(store, liste, dbTarget);
      };

      // Fehler werden gesammelt statt sofort geworfen: Ein Bereich, der sich
      // nicht schreiben lässt, soll die übrigen nicht mitreißen — und am Ende
      // muss die Meldung ALLE betroffenen Bereiche nennen.
      const fehlgeschlagen: string[] = [];
      const uebernehmeListe = async (
        store: string,
        ausDatei: unknown,
        vorhandenErmitteln?: () => Promise<{ id: string }[]>
      ): Promise<void> => {
        try {
          await uebernehmeListeOhneFangnetz(store, ausDatei, vorhandenErmitteln);
        } catch (err) {
          console.error(`[importFullBackup] Bereich "${store}" konnte nicht gespeichert werden:`, err);
          fehlgeschlagen.push(`${bezeichnungDesBereichs(store)} (${beschreibeFehler(err)})`);
        }
      };

      /**
       * Übernimmt einen Einzeldatensatz (Vorlagen, Stammdaten, Startseite).
       * Beim Ergänzen behält ein hier vorhandener Datensatz den Vorrang.
       */
      const uebernehmeEinzelstueck = async (
        store: string,
        id: string,
        ausDatei: unknown
      ): Promise<void> => {
        if (!ausDatei) return;
        if (art === 'ergaenzen') {
          const vorhanden = await getItemFromStore<Record<string, unknown>>(store, id, dbTarget);
          const gewaehlt = ergaenzeEinzelstueck(ausDatei as Record<string, unknown>, vorhanden);
          if (!gewaehlt || vorhanden) return; // Vorhandenes bleibt unangetastet
          await putItemToStore(store, { id, ...gewaehlt }, dbTarget);
          return;
        }
        await putItemToStore(store, { id, ...(ausDatei as Record<string, unknown>) }, dbTarget);
      };

      await uebernehmeListe(STORES.MEMBERS, members);
      await uebernehmeListe(STORES.TRANSACTIONS, transactions);
      await uebernehmeListe(STORES.ACCOUNTS, accounts);
      await uebernehmeListe(STORES.AUDIT_LOGS, auditLogs);
      await uebernehmeListe(STORES.INVENTORY, inventory);
      await uebernehmeListe(STORES.MEMBER_INVENTORY, memberInventory);
      await uebernehmeListe(STORES.SEPA_RUNS, sepaRuns);
      await uebernehmeListe(STORES.DOCUMENTS, documents);
      await uebernehmeListe(STORES.FOLDERS, folders);
      await uebernehmeListe(STORES.DONATIONS, donations);
      await uebernehmeListe(STORES.CONTACTS, contacts);
      await uebernehmeListe(STORES.INVOICES, invoices);
      await uebernehmeListe(STORES.MEETINGS, meetings);
      await uebernehmeListe(STORES.CALENDAR_CATEGORIES, calendarCategories);
      await uebernehmeListe(STORES.CALENDAR_EVENTS, calendarEvents);

      await uebernehmeEinzelstueck(STORES.INVOICE_TEMPLATES, 'main_template', invoiceTemplate);
      await uebernehmeEinzelstueck(STORES.MEETING_TEMPLATES, 'main_template', meetingTemplate);
      await uebernehmeEinzelstueck(STORES.DASHBOARD_CONFIG, 'main_dashboard', dashboardConfig);

      if (settings) {
        // Alte Sicherungen führen die SMTP-Zugangsdaten im Klartext mit.
        // Sie werden hier verworfen, statt sie wieder einzuspielen.
        const { bereinigt: settingsMitKonten } = ohneVeralteteSmtpFelder(
          settings as Record<string, unknown>
        );
        // Eigene SKR-42-Konten (D-12) gehören nicht in die Vereinsstammdaten
        // der Datenbank, sondern in den Browserspeicher; siehe
        // customCategoryService. Fehlt das Feld (ältere Sicherung oder eine
        // Sicherung vom Handy, die nie am Desktop war), bleiben die
        // vorhandenen eigenen Konten unangetastet.
        const { customSkr42Accounts: eigeneKonten, ...settingsBereinigt } = settingsMitKonten as Record<
          string,
          unknown
        >;
        if (eigeneKonten !== undefined) {
          try {
            if (art === 'ergaenzen') customCategoryService.ergaenzeAusSicherung(eigeneKonten);
            else customCategoryService.ersetzeAusSicherung(eigeneKonten);
          } catch (err) {
            console.warn('Eigene SKR-42-Konten konnten nicht übernommen werden:', err);
          }
        }
        if (art === 'ergaenzen') {
          // Feldweise: Muster-Stammdaten eines frischen Geräts dürfen die
          // echten Angaben aus der Datei nicht verdrängen.
          const vorhandene = await getItemFromStore<Record<string, unknown>>(
            STORES.SETTINGS,
            'main',
            dbTarget
          );
          const zusammen = ergaenzeStammdaten(
            settingsBereinigt as Record<string, unknown>,
            vorhandene,
            neutraleEinstellungen() as unknown as Record<string, unknown>
          );
          if (zusammen) await putItemToStore(STORES.SETTINGS, { ...zusammen, id: 'main' }, dbTarget);
        } else {
          await uebernehmeEinzelstueck(STORES.SETTINGS, 'main', settingsBereinigt);
        }
      }

      // Eine alte Sicherung kann noch `users`/`securitySettings`-Felder aus
      // der Zeit der Anmeldung (bis R2) enthalten; die werden hier schlicht
      // nicht gelesen.
      if (fehlgeschlagen.length > 0) {
        throw new Error(
          'Nicht alles konnte gespeichert werden: ' +
            fehlgeschlagen.join('; ') +
            '. Die übrigen Bereiche wurden eingespielt. Die Sicherheitskopie vor dem Einspielen ' +
            'liegt unter Einstellungen → Datensicherung.'
        );
      }

      if (targetEnv === 'live') {
        markiereAlsEingerichtet();
      }

      return {
        membersCount: members.length,
        transactionsCount: transactions.length,
        inventoryCount: inventory.length,
        documentsCount: documents.length,
        donationsCount: donations.length,
        calendarEventsCount: calendarEvents.length,
        meetingsCount: meetings.length,
        invoicesCount: invoices.length,
        contactsCount: contacts.length,
        clubName: settings?.clubName,
        sicherheitskopie,
        art
      };
    } finally {
      isImportingBackup = false;
      triggerAutoSnapshot();
    }
  },

  async getDashboardConfig(): Promise<UserDashboardConfig> {
    const stored = await getItemFromStore<UserDashboardConfig & { id: string }>(
      STORES.DASHBOARD_CONFIG,
      'main_dashboard'
    );
    if (!stored || !stored.widgets || stored.widgets.length === 0) {
      return DEFAULT_DASHBOARD_CONFIG;
    }
    // Neue Widgets (z. B. „Unterlagen laufen ab“) in älteren Anordnungen ergänzen
    return ergaenzeNeueWidgets(stored);
  },

  async saveDashboardConfig(config: UserDashboardConfig): Promise<UserDashboardConfig> {
    await putItemToStore(STORES.DASHBOARD_CONFIG, { id: 'main_dashboard', ...config });
    return config;
  },

  async clearAllData(): Promise<void> {
    // Beim Leeren darf kein neuer Snapshot entstehen: Jeder Schreibvorgang
    // unten würde sonst die 4-Sekunden-Uhr der automatischen Snapshots
    // anstoßen, und der Snapshot käme erst NACH dem Löschen der alten. Eine
    // schon laufende Uhr wird deshalb verworfen. (Dieselbe Sperre nutzt der
    // Import einer Sicherung.)
    if (snapshotTimer) {
      clearTimeout(snapshotTimer);
      snapshotTimer = null;
    }
    const sperreVorher = isImportingBackup;
    isImportingBackup = true;
    try {
      await this.leereAlleBereiche();
      // Auch die automatischen Sicherheitskopien (Snapshots) gehören zu "alle
      // Daten": Sie enthalten den vollständigen Bestand.
      const { SnapshotService } = await import('./snapshotService');
      await SnapshotService.deleteAllSnapshots();
    } finally {
      isImportingBackup = sperreVorher;
      if (snapshotTimer) {
        clearTimeout(snapshotTimer);
        snapshotTimer = null;
      }
    }
  },

  /**
   * Leert ALLE Datenbereiche und die zugehörigen Reste im localStorage
   * (Teil von `clearAllData`) und legt danach die leere Grundausstattung an.
   *
   * Die Schleife läuft über `STORES` statt über eine handgeschriebene Liste:
   * Die alte Liste hatte Ordner, Vorlagen, Inventar-Ausgaben und die
   * Vereinsstammdaten vergessen — "Alle lokalen Daten löschen" ließ sie
   * stehen. Ein neu hinzukommender Datenbereich wird so automatisch mit
   * geleert.
   *
   * Nicht gelöscht wird, was zum Gerät und nicht zum Verein gehört, etwa
   * die Farbwahl.
   */
  async leereAlleBereiche(): Promise<void> {
    const bereiche = Object.values(STORES);
    for (const bereich of bereiche) {
      await saveAllToStore(bereich, []);
    }

    try {
      const prefix = getStorePrefix();
      for (const bereich of bereiche) {
        localStorage.removeItem(`${prefix}${bereich}`);
      }
      // Reste, die zum Verein gehören und außerhalb der Datenbank liegen.
      // EINGERICHTET_KEY: Ohne das Zurücksetzen würde das Gerät nach dem
      // Löschen weiterhin als "eingerichtet" gelten — die nächste Anmeldung
      // zeigte dann ein leeres Dashboard statt der Wahl zwischen "Neuen
      // Verein anlegen" und "Daten importieren".
      for (const schluessel of [
        EINGERICHTET_KEY,
        'vm_accounts_order',
        'vm_custom_skr42_accounts',
        'vm_last_snapshot_meta'
      ]) {
        localStorage.removeItem(schluessel);
      }
    } catch (err) {
      console.warn('[StorageService] Konnte Reste im localStorage nicht entfernen:', err);
    }

    await this.legeGrundausstattungAn();
  }
};

