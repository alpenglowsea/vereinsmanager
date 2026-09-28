import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

import { getLocalDb, closeLocalDbForTests } from '../localDb';
import { createPasswordReset, pruefePasswortReset, loesePasswortResetEin } from './localPasswordResets';

/**
 * Dieselbe Vorgehensweise wie bei localSessions.test.ts: ein eigenes
 * Wegwerf-Verzeichnis je Test über VM_DATA_DIR, Benutzer-Datensätze direkt
 * per SQL angelegt statt über localUsers.ts (hier geht es nur um
 * local_password_resets für sich).
 */
let verzeichnis: string;
let alterDataDir: string | undefined;

beforeEach(() => {
  alterDataDir = process.env.VM_DATA_DIR;
  verzeichnis = fs.mkdtempSync(path.join(os.tmpdir(), 'vm-localpwreset-test-'));
  process.env.VM_DATA_DIR = verzeichnis;
  getLocalDb(); // legt Schema samt local_users an, bevor wir referenzieren
});

afterEach(() => {
  closeLocalDbForTests();
  fs.rmSync(verzeichnis, { recursive: true, force: true });
  if (alterDataDir === undefined) delete process.env.VM_DATA_DIR;
  else process.env.VM_DATA_DIR = alterDataDir;
});

function legeBenutzerAn(id: string): void {
  const db = getLocalDb();
  const jetzt = new Date().toISOString();
  db.prepare(
    `INSERT INTO local_users (id, email, name, password_hash, permissions, is_active, must_change_password, created_at, updated_at)
     VALUES (?, ?, ?, 'x', '{}', 1, 0, ?, ?)`
  ).run(id, `${id}@beispiel.de`, id, jetzt, jetzt);
}

describe('"Passwort vergessen"-Verknüpfungen des eigenen Servers', () => {
  it('legt einen Reset-Link an und liefert einen langen, zufälligen Rohwert sowie ein Ablaufdatum', () => {
    legeBenutzerAn('u1');
    const reset = createPasswordReset('u1');
    expect(reset.token.length).toBe(64); // 32 Byte als Hex, wie bei den Sitzungen
    expect(reset.expiresAt).toBeTruthy();
  });

  it('speichert NICHT den Rohwert des Tokens, sondern nur seinen SHA-256-Streuwert', () => {
    legeBenutzerAn('u1');
    const reset = createPasswordReset('u1');
    const db = getLocalDb();

    // Der Rohwert darf in der Tabelle nirgends auftauchen.
    const mitRohwert = db
      .prepare('SELECT COUNT(*) AS anzahl FROM local_password_resets WHERE token_hash = ?')
      .get(reset.token) as unknown as { anzahl: number };
    expect(mitRohwert.anzahl).toBe(0);

    // Stattdessen genau der erwartete Streuwert.
    const erwarteterStreuwert = crypto.createHash('sha256').update(reset.token).digest('hex');
    const mitStreuwert = db
      .prepare('SELECT COUNT(*) AS anzahl FROM local_password_resets WHERE token_hash = ?')
      .get(erwarteterStreuwert) as unknown as { anzahl: number };
    expect(mitStreuwert.anzahl).toBe(1);
  });

  it('liefert zu einem gültigen Reset-Link die zugehörige Benutzer-id, ohne ihn dabei schon einzulösen', () => {
    legeBenutzerAn('u1');
    const reset = createPasswordReset('u1');

    expect(pruefePasswortReset(reset.token)).toEqual({ userId: 'u1' });
    // Erneutes Prüfen muss weiterhin denselben Befund liefern — pruefen
    // allein verbraucht den Link nicht.
    expect(pruefePasswortReset(reset.token)).toEqual({ userId: 'u1' });
  });

  it('liefert null für einen unbekannten oder erfundenen Reset-Link', () => {
    expect(pruefePasswortReset('gibt-es-nicht')).toBeNull();
  });

  it('erzeugt bei jedem Aufruf einen anderen Reset-Link', () => {
    legeBenutzerAn('u1');
    const a = createPasswordReset('u1');
    const b = createPasswordReset('u1');
    expect(a.token === b.token).toBe(false);
  });

  it('lehnt einen bereits eingelösten Reset-Link ab, selbst innerhalb der Gültigkeit', () => {
    legeBenutzerAn('u1');
    const reset = createPasswordReset('u1');
    loesePasswortResetEin(reset.token);
    expect(pruefePasswortReset(reset.token)).toBeNull();
  });

  it('meldet beim Einlösen eines unbekannten Reset-Links keinen Fehler', () => {
    expect(() => loesePasswortResetEin('gibt-es-nicht')).not.toThrow();
  });

  it('verwirft beim Anfordern eines neuen Links automatisch alle noch nicht eingelösten Links desselben Kontos', () => {
    legeBenutzerAn('u1');
    const erster = createPasswordReset('u1');
    const zweiter = createPasswordReset('u1');

    // Nur der zuletzt verschickte Link funktioniert noch.
    expect(pruefePasswortReset(erster.token)).toBeNull();
    expect(pruefePasswortReset(zweiter.token)).toEqual({ userId: 'u1' });
  });

  it('lässt Links anderer Konten unberührt, wenn ein Konto einen neuen Link anfordert', () => {
    legeBenutzerAn('u1');
    legeBenutzerAn('u2');
    const vonU1 = createPasswordReset('u1');
    const vonU2 = createPasswordReset('u2');

    createPasswordReset('u1'); // u1 fordert einen zweiten Link an

    expect(pruefePasswortReset(vonU1.token)).toBeNull();
    expect(pruefePasswortReset(vonU2.token)).toEqual({ userId: 'u2' });
  });

  it('lehnt einen abgelaufenen Reset-Link ab und räumt ihn beim nächsten Zugriff von selbst weg', () => {
    legeBenutzerAn('u1');
    const reset = createPasswordReset('u1');
    const db = getLocalDb();

    // Ablaufdatum von Hand in die Vergangenheit setzen, statt 1 Stunde zu
    // warten — createPasswordReset() selbst bietet dafür bewusst keinen
    // Parameter an.
    db.prepare('UPDATE local_password_resets SET expires_at = ? WHERE user_id = ?').run(
      new Date(Date.now() - 1000).toISOString(),
      'u1'
    );

    expect(pruefePasswortReset(reset.token)).toBeNull();
    const nochInDerTabelle = db
      .prepare('SELECT COUNT(*) AS anzahl FROM local_password_resets WHERE user_id = ?')
      .get('u1') as unknown as { anzahl: number };
    expect(nochInDerTabelle.anzahl).toBe(0);
  });

  it('entfernt Reset-Links automatisch, wenn das zugehörige Konto gelöscht wird (ON DELETE CASCADE)', () => {
    legeBenutzerAn('u1');
    const reset = createPasswordReset('u1');
    const db = getLocalDb();
    db.prepare('DELETE FROM local_users WHERE id = ?').run('u1');
    expect(pruefePasswortReset(reset.token)).toBeNull();
  });
});
