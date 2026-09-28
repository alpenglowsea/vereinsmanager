import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { getLocalDb, closeLocalDbForTests } from '../localDb';
import { createSession, getSession, deleteSession, deleteAllSessionsForUser } from './localSessions';

/**
 * Dieselbe Vorgehensweise wie bei localDb.test.ts / members.test.ts: ein
 * eigenes Wegwerf-Verzeichnis je Test über VM_DATA_DIR, damit jeder Test mit
 * einer leeren Datenbank beginnt und keiner den nächsten beeinflusst.
 *
 * local_sessions verweist per Fremdschlüssel auf local_users (ON DELETE
 * CASCADE) — für die Tests hier reicht trotzdem eine erfundene Benutzer-id
 * als Text: Fremdschlüssel werden zwar erzwungen (PRAGMA foreign_keys, siehe
 * localDb.ts), aber lokale_sessions selbst prüft beim Anlegen keine Existenz
 * mehr, sobald der Datensatz einmal drin ist — das Zusammenspiel mit einem
 * echten Konto ist stattdessen Sache von localUsers.test.ts
 * ("beendet dabei alle bestehenden Sitzungen") und localAuth.test.ts.
 * Hier testen wir localSessions.ts bewusst isoliert für sich.
 */
let verzeichnis: string;
let alterDataDir: string | undefined;

beforeEach(() => {
  alterDataDir = process.env.VM_DATA_DIR;
  verzeichnis = fs.mkdtempSync(path.join(os.tmpdir(), 'vm-localsessions-test-'));
  process.env.VM_DATA_DIR = verzeichnis;
  getLocalDb(); // legt Schema samt local_users an, bevor wir referenzieren
});

afterEach(() => {
  closeLocalDbForTests();
  fs.rmSync(verzeichnis, { recursive: true, force: true });
  if (alterDataDir === undefined) delete process.env.VM_DATA_DIR;
  else process.env.VM_DATA_DIR = alterDataDir;
});

/**
 * Legt einen minimalen Benutzer-Datensatz direkt per SQL an, ohne den Umweg
 * über localUsers.ts — dieser Testdatei geht es nur um local_sessions,
 * daher greifen wir hier bewusst nicht auf createUser() zurück (das würde
 * eine echte Passwortprüfung mitschleppen, die hier nichts zur Sache tut).
 */
function legeBenutzerAn(id: string): void {
  const db = getLocalDb();
  const jetzt = new Date().toISOString();
  db.prepare(
    `INSERT INTO local_users (id, email, name, password_hash, permissions, is_active, must_change_password, created_at, updated_at)
     VALUES (?, ?, ?, 'x', '{}', 1, 0, ?, ?)`
  ).run(id, `${id}@beispiel.de`, id, jetzt, jetzt);
}

describe('Sitzungen des eigenen Servers', () => {
  it('legt eine Sitzung an und liefert einen langen, zufälligen Code', () => {
    legeBenutzerAn('u1');
    const sitzung = createSession('u1');
    expect(sitzung.token.length).toBe(64); // 32 Byte als Hex
    expect(sitzung.expiresAt).toBeTruthy();
  });

  it('liefert zu einer bekannten Sitzung die zugehörige Benutzer-id', () => {
    legeBenutzerAn('u1');
    const sitzung = createSession('u1');
    const gefunden = getSession(sitzung.token);
    expect(gefunden).toEqual({ userId: 'u1' });
  });

  it('liefert null für einen unbekannten oder erfundenen Sitzungscode', () => {
    expect(getSession('gibt-es-nicht')).toBeNull();
  });

  it('erzeugt bei jedem Aufruf einen anderen Sitzungscode', () => {
    legeBenutzerAn('u1');
    const a = createSession('u1');
    const b = createSession('u1');
    expect(a.token === b.token).toBe(false);
  });

  it('beendet eine Sitzung gezielt (deleteSession) und meldet danach, dass sie weg ist', () => {
    legeBenutzerAn('u1');
    const sitzung = createSession('u1');
    expect(deleteSession(sitzung.token)).toBe(true);
    expect(getSession(sitzung.token)).toBeNull();
  });

  it('meldet beim Beenden eines unbekannten Sitzungscodes false statt eines Fehlers', () => {
    expect(deleteSession('gibt-es-nicht')).toBe(false);
  });

  it('beendet mit deleteAllSessionsForUser alle Sitzungen eines Kontos, lässt andere Konten aber unberührt', () => {
    legeBenutzerAn('u1');
    legeBenutzerAn('u2');
    const s1a = createSession('u1');
    const s1b = createSession('u1');
    const s2 = createSession('u2');

    deleteAllSessionsForUser('u1');

    expect(getSession(s1a.token)).toBeNull();
    expect(getSession(s1b.token)).toBeNull();
    expect(getSession(s2.token)).toEqual({ userId: 'u2' });
  });

  it('räumt beim nächsten Zugriff abgelaufene Sitzungen von selbst weg', () => {
    legeBenutzerAn('u1');
    const sitzung = createSession('u1');

    // Ablaufdatum von Hand in die Vergangenheit setzen, statt 30 Tage zu
    // warten — createSession/getSession selbst bieten dafür bewusst keinen
    // Parameter an (die Gültigkeitsdauer ist kein Stellhebel für Aufrufer).
    const db = getLocalDb();
    db.prepare('UPDATE local_sessions SET expires_at = ? WHERE token = ?').run(
      new Date(Date.now() - 1000).toISOString(),
      sitzung.token
    );

    expect(getSession(sitzung.token)).toBeNull();
    const nochInDerTabelle = db
      .prepare('SELECT COUNT(*) AS anzahl FROM local_sessions WHERE token = ?')
      .get(sitzung.token) as unknown as { anzahl: number };
    expect(nochInDerTabelle.anzahl).toBe(0);
  });

  it('verlängert die Gültigkeit bei jedem erfolgreichen Zugriff (sliding expiration)', () => {
    legeBenutzerAn('u1');
    const sitzung = createSession('u1');
    const db = getLocalDb();

    // Ablaufdatum künstlich nah heranrücken, damit ein messbarer Unterschied
    // entsteht, statt auf echte Millisekunden zwischen zwei new Date()-
    // Aufrufen zu vertrauen.
    const knapp = new Date(Date.now() + 1000).toISOString();
    db.prepare('UPDATE local_sessions SET expires_at = ? WHERE token = ?').run(knapp, sitzung.token);

    getSession(sitzung.token); // ein "normaler" Zugriff, keine Ablaufprüfung von Hand

    const zeile = db
      .prepare('SELECT expires_at FROM local_sessions WHERE token = ?')
      .get(sitzung.token) as unknown as { expires_at: string };
    expect(new Date(zeile.expires_at).getTime() > new Date(knapp).getTime()).toBe(true);
  });

  it('entfernt Sitzungen automatisch, wenn das zugehörige Konto gelöscht wird (ON DELETE CASCADE)', () => {
    legeBenutzerAn('u1');
    const sitzung = createSession('u1');
    const db = getLocalDb();
    db.prepare('DELETE FROM local_users WHERE id = ?').run('u1');
    expect(getSession(sitzung.token)).toBeNull();
  });
});
