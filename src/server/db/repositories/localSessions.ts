/**
 * Angemeldete Sitzungen auf dem eigenen Server.
 * ---------------------------------------------------------------------------
 *
 * Bewusst KEIN signiertes Token-Verfahren (etwa ein JWT): Eine Sitzung ist
 * hier schlicht eine Zeile in dieser Tabelle mit einem sehr langen,
 * zufälligen Code. Vorteile gegenüber einem signierten Token:
 *
 *   - Beenden heißt: Zeile löschen. Kein Ablaufdatum abwarten, kein
 *     Sperrlisten-Verfahren für Token, die eigentlich schon ungültig sein
 *     sollten.
 *   - Ein Blick in die Tabelle zeigt jederzeit, wer gerade angemeldet ist.
 *   - Kein zusätzlicher Signierschlüssel, der selbst wieder sicher verwahrt
 *     werden müsste.
 *
 * Der Code hat 256 Bit Zufall (32 Byte, als Hex geschrieben) — das ist so
 * viel, dass ihn niemand durch Ausprobieren erraten wird; anders als beim
 * Zugriffsschlüssel der Installation (instanceConfig.ts, 16 Byte, weil der
 * gelegentlich von Hand abgetippt wird) tippt hier niemand etwas ab, also
 * darf der Code beliebig lang sein.
 *
 * Gültigkeit: 30 Tage, verlängert sich aber bei jeder Nutzung wieder um
 * 30 Tage (siehe getSession). Wer den Server regelmäßig nutzt, wird nie
 * abgemeldet; wer 30 Tage nicht vorbeischaut, muss sich neu anmelden.
 */

import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

import { getLocalDb } from '../localDb';

const GUELTIGKEIT_MS = 30 * 24 * 60 * 60 * 1000; // 30 Tage

interface LocalSessionRow {
  token: string;
  user_id: string;
  created_at: string;
  expires_at: string;
  last_used_at: string;
}

function neuesAblaufdatum(): string {
  return new Date(Date.now() + GUELTIGKEIT_MS).toISOString();
}

/** Räumt abgelaufene Sitzungen auf. Billig genug, um bei jedem Zugriff mitzulaufen. */
function entferneAbgelaufene(db: DatabaseSync): void {
  db.prepare('DELETE FROM local_sessions WHERE expires_at < ?').run(new Date().toISOString());
}

export function createSession(
  userId: string,
  db: DatabaseSync = getLocalDb()
): { token: string; expiresAt: string } {
  entferneAbgelaufene(db);

  const token = crypto.randomBytes(32).toString('hex');
  const jetzt = new Date().toISOString();
  const expiresAt = neuesAblaufdatum();

  db.prepare(
    'INSERT INTO local_sessions (token, user_id, created_at, expires_at, last_used_at) VALUES (?,?,?,?,?)'
  ).run(token, userId, jetzt, expiresAt, jetzt);

  return { token, expiresAt };
}

/**
 * Liefert die Benutzer-id zu einem Sitzungscode, oder null, wenn er nicht
 * (mehr) existiert. Verlängert die Gültigkeit bei jedem erfolgreichen
 * Aufruf um weitere 30 Tage (siehe Dateikopf).
 */
export function getSession(
  token: string,
  db: DatabaseSync = getLocalDb()
): { userId: string } | null {
  entferneAbgelaufene(db);

  const zeile = db.prepare('SELECT * FROM local_sessions WHERE token = ?').get(token) as
    | unknown
    | undefined;
  const reihe = zeile as LocalSessionRow | undefined;
  if (!reihe) return null;

  const jetzt = new Date().toISOString();
  db.prepare('UPDATE local_sessions SET expires_at = ?, last_used_at = ? WHERE token = ?').run(
    neuesAblaufdatum(),
    jetzt,
    token
  );

  return { userId: reihe.user_id };
}

export function deleteSession(token: string, db: DatabaseSync = getLocalDb()): boolean {
  const ergebnis = db.prepare('DELETE FROM local_sessions WHERE token = ?').run(token);
  return ergebnis.changes > 0;
}

/** Beendet alle Sitzungen eines Kontos — z. B. nach einer Passwortänderung. */
export function deleteAllSessionsForUser(userId: string, db: DatabaseSync = getLocalDb()): void {
  db.prepare('DELETE FROM local_sessions WHERE user_id = ?').run(userId);
}
