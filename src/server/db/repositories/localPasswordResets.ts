/**
 * "Passwort vergessen"-Verknüpfungen für Konten auf dem eigenen Server
 * (Betriebsart 3, "gehostet").
 * ---------------------------------------------------------------------------
 *
 * Gegenstück zu repositories/localSessions.ts, aber mit drei Unterschieden,
 * die alle aus demselben Grund folgen — dieser Code hier stellt einen Zugang
 * her, der per E-Mail das Haus verlässt, statt nur im angemeldeten Browser
 * zu leben:
 *
 *   1. Kurze Gültigkeit (1 Stunde statt 30 Tage) — ein Link, der wochenlang
 *      in einem Postfach funktionsfähig bleibt, ist ein wochenlang gültiger
 *      Zugang zu einem fremden Konto, falls das Postfach je mitgelesen wird.
 *   2. Nur der SHA-256-Streuwert des Tokens steht in der Datenbank, nie der
 *      Rohwert (siehe die ausführliche Begründung in schema.ts bei
 *      local_password_resets).
 *   3. Einmalige Nutzung (used_at) — ein zweiter Versuch mit demselben Link
 *      schlägt fehl, selbst innerhalb der Gültigkeit.
 *
 * Zusätzlich verwirft createPasswordReset() beim Anfordern eines neuen Links
 * automatisch alle noch nicht eingelösten Links desselben Kontos: Fordert
 * jemand mehrfach hintereinander an (etwa weil die erste E-Mail nicht
 * ankam), funktioniert nur noch der zuletzt verschickte Link.
 */

import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

import { getLocalDb } from '../localDb';

const GUELTIGKEIT_MS = 60 * 60 * 1000; // 1 Stunde

interface LocalPasswordResetRow {
  token_hash: string;
  user_id: string;
  created_at: string;
  expires_at: string;
  used_at: string | null;
}

function streuwert(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function neuesAblaufdatum(): string {
  return new Date(Date.now() + GUELTIGKEIT_MS).toISOString();
}

/** Räumt abgelaufene Verknüpfungen auf. Billig genug, um bei jedem Zugriff mitzulaufen. */
function entferneAbgelaufene(db: DatabaseSync): void {
  db.prepare('DELETE FROM local_password_resets WHERE expires_at < ?').run(new Date().toISOString());
}

/**
 * Erzeugt einen neuen Reset-Link für ein Konto. Der zurückgegebene Rohwert
 * ist der EINZIGE Moment, in dem er außerhalb der E-Mail existiert — er
 * steht nirgends gespeichert, nur sein Streuwert.
 */
export function createPasswordReset(
  userId: string,
  db: DatabaseSync = getLocalDb()
): { token: string; expiresAt: string } {
  entferneAbgelaufene(db);
  // Alte, noch nicht eingelöste Links desselben Kontos verwerfen — siehe
  // Dateikopf.
  db.prepare('DELETE FROM local_password_resets WHERE user_id = ? AND used_at IS NULL').run(userId);

  const token = crypto.randomBytes(32).toString('hex');
  const jetzt = new Date().toISOString();
  const expiresAt = neuesAblaufdatum();

  db.prepare(
    'INSERT INTO local_password_resets (token_hash, user_id, created_at, expires_at, used_at) VALUES (?,?,?,?,NULL)'
  ).run(streuwert(token), userId, jetzt, expiresAt);

  return { token, expiresAt };
}

/**
 * Prüft einen Reset-Token: gültig, noch nicht eingelöst, nicht abgelaufen?
 * Löst ihn dabei NOCH NICHT ein (siehe loesePasswortResetEin) — das
 * übernimmt erst server/localAuth.ts, und zwar erst, NACHDEM das neue
 * Passwort tatsächlich gesetzt werden konnte. Sonst würde ein Link schon
 * durch einen fehlgeschlagenen Versuch (z. B. zu schwaches Passwort)
 * verbraucht, obwohl er noch gültig wäre.
 */
export function pruefePasswortReset(
  token: string,
  db: DatabaseSync = getLocalDb()
): { userId: string } | null {
  entferneAbgelaufene(db);

  const zeile = db
    .prepare('SELECT * FROM local_password_resets WHERE token_hash = ?')
    .get(streuwert(token)) as unknown as LocalPasswordResetRow | undefined;

  if (!zeile || zeile.used_at || zeile.expires_at < new Date().toISOString()) {
    return null;
  }
  return { userId: zeile.user_id };
}

/** Markiert einen Reset-Token als eingelöst — ab jetzt funktioniert der Link nicht mehr. */
export function loesePasswortResetEin(token: string, db: DatabaseSync = getLocalDb()): void {
  db.prepare('UPDATE local_password_resets SET used_at = ? WHERE token_hash = ?').run(
    new Date().toISOString(),
    streuwert(token)
  );
}
