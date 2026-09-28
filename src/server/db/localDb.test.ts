import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { getLocalDb, closeLocalDbForTests } from './localDb';
import { SCHEMA_VERSION } from './schema';

/**
 * Dieselbe Vorgehensweise wie in instanceConfig.test.ts: ein eigenes
 * Wegwerf-Verzeichnis je Test über VM_DATA_DIR. Zusätzlich muss hier vor dem
 * Löschen des Verzeichnisses die offene SQLite-Verbindung geschlossen werden
 * (closeLocalDbForTests) — sonst hielte der Prozess noch eine Dateizugriffs-
 * handle auf eine gerade gelöschte Datei.
 */
let verzeichnis: string;
let alterDataDir: string | undefined;

beforeEach(() => {
  alterDataDir = process.env.VM_DATA_DIR;
  verzeichnis = fs.mkdtempSync(path.join(os.tmpdir(), 'vm-localdb-test-'));
  process.env.VM_DATA_DIR = verzeichnis;
});

afterEach(() => {
  closeLocalDbForTests();
  fs.rmSync(verzeichnis, { recursive: true, force: true });
  if (alterDataDir === undefined) delete process.env.VM_DATA_DIR;
  else process.env.VM_DATA_DIR = alterDataDir;
});

const ERWARTETE_TABELLEN = [
  'accounts',
  'application_settings',
  'audit_logs',
  'calendar_categories',
  'calendar_events',
  'contacts',
  'dashboard_config',
  'documents',
  'donations',
  'folders',
  'inventory',
  'invoice_templates',
  'invoices',
  'local_password_resets',
  'local_sessions',
  'local_users',
  'meeting_templates',
  'meetings',
  'members',
  'online_applications',
  'schema_meta',
  'sepa_runs',
  'settings',
  'transactions',
];

describe('Lokale SQLite-Datenbank: Schema', () => {
  it('legt die Datenbankdatei im VM_DATA_DIR an', () => {
    getLocalDb();
    expect(fs.existsSync(path.join(verzeichnis, 'vereinsdaten.sqlite'))).toBe(true);
  });

  it('legt alle erwarteten Tabellen an', () => {
    const db = getLocalDb();
    const zeilen = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
      .all() as unknown as { name: string }[];
    const namen = zeilen.map((z) => z.name).sort();
    expect(namen).toEqual([...ERWARTETE_TABELLEN].sort());
  });

  it('trägt die aktuelle Schema-Version in schema_meta ein', () => {
    const db = getLocalDb();
    const zeile = db.prepare('SELECT version FROM schema_meta WHERE id = 1').get() as unknown as {
      version: number;
    };
    expect(zeile.version).toBe(SCHEMA_VERSION);
  });

  it('lässt sich ein zweites Mal öffnen, ohne etwas zu verändern (IF NOT EXISTS)', () => {
    getLocalDb();
    closeLocalDbForTests();
    const db = getLocalDb();
    const zeile = db.prepare('SELECT version FROM schema_meta WHERE id = 1').get() as unknown as {
      version: number;
    };
    expect(zeile.version).toBe(SCHEMA_VERSION);
  });

  it('erzwingt Fremdschlüssel (PRAGMA foreign_keys)', () => {
    const db = getLocalDb();
    const zeile = db.prepare('PRAGMA foreign_keys').get() as unknown as { foreign_keys: number };
    expect(zeile.foreign_keys).toBe(1);
  });

  it('löscht abhängige Buchungen, wenn das zugehörige Konto gelöscht wird (ON DELETE CASCADE)', () => {
    const db = getLocalDb();
    const jetzt = new Date().toISOString();
    db.prepare(
      'INSERT INTO accounts (id, name, account_type, initial_balance, created_at) VALUES (?,?,?,?,?)'
    ).run('konto-1', 'Kasse', 'cash', 0, jetzt);
    db.prepare(
      `INSERT INTO transactions (
        id, date, amount, type, account_id, document_number, booking_text,
        partner, sphere, category, created_at, updated_at
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`
    ).run('buchung-1', '2025-03-01', 10, 'expense', 'konto-1', 'BE-2025-010', 'Text', 'Partner', 'ideell', 'Sportgeräte', jetzt, jetzt);

    expect((db.prepare('SELECT COUNT(*) as n FROM transactions').get() as unknown as { n: number }).n).toBe(1);

    db.prepare('DELETE FROM accounts WHERE id = ?').run('konto-1');

    expect((db.prepare('SELECT COUNT(*) as n FROM transactions').get() as unknown as { n: number }).n).toBe(0);
  });
});
