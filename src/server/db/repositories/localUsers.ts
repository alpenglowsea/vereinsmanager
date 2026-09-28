/**
 * Benutzerkonten des eigenen Servers (Betriebsart 3).
 * ---------------------------------------------------------------------------
 *
 * Im Cloud-Betrieb übernimmt Supabase Auth die Anmeldung komplett; im
 * Browser-Modus (Betriebsart 1) übernimmt das AuthService/passwordService im
 * Frontend, aber nur für den eigenen Rechner — nichts davon wird durchgesetzt,
 * weil dort niemand als Gegenspieler mitliest. Für den eigenen Server (Modus
 * 3) fehlte bislang beides: ein Konto, dem sich eine Anfrage zuordnen lässt.
 *
 * Die Form dieser Tabelle lehnt sich bewusst an AppUser (src/types.ts) an —
 * dieselben Feldnamen wie im Browser-Modus (name, customRoleName,
 * permissions, isActive, lastLogin), nur ohne das dortige "username": Diese
 * Installation verwendet ausschließlich die E-Mail-Adresse zur Anmeldung
 * (Entscheidung vom 27.09., siehe Projektnotizen). Das erleichtert eine
 * spätere Stufe 4, in der dieselbe Oberfläche gegen den eigenen Server statt
 * gegen den Browser-Speicher arbeiten soll.
 *
 * Das Passwort-Hashing kommt unverändert aus
 * src/services/passwordService.ts — demselben, bereits im Browser-Modus
 * geprüften Code. Er funktioniert hier unverändert, weil Node seit einigen
 * Jahren dieselbe Web-Crypto-Schnittstelle bereitstellt (globalThis.crypto.
 * subtle), auf die dieser Code ohnehin schon angewiesen war.
 */

import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

import type { AccessLevel, PermissionArea } from '../../../types';
import { ALL_AREAS_NONE, canEdit, parseUserPermissions } from '../../../utils/permissions';
import { checkPasswordStrength, hashPassword, verifyPassword } from '../../../services/passwordService';
import { getLocalDb } from '../localDb';
import { deleteAllSessionsForUser } from './localSessions';

type UserPermissions = Record<PermissionArea, AccessLevel>;

interface LocalUserRow {
  id: string;
  email: string;
  name: string;
  password_hash: string;
  custom_role_name: string | null;
  permissions: string;
  is_active: number;
  must_change_password: number;
  last_login: string | null;
  created_at: string;
  updated_at: string;
}

/** Das, was nach außen (an die API) herausgegeben wird — nie der Prüfwert. */
export interface LocalUser {
  id: string;
  email: string;
  name: string;
  customRoleName: string;
  permissions: UserPermissions;
  isActive: boolean;
  mustChangePassword: boolean;
  lastLogin?: string;
  createdAt: string;
  updatedAt: string;
}

function parsePermissions(text: string): UserPermissions {
  try {
    const geparst = JSON.parse(text);
    return geparst && typeof geparst === 'object' ? (geparst as UserPermissions) : ALL_AREAS_NONE;
  } catch {
    return ALL_AREAS_NONE;
  }
}

function zeileZuBenutzer(row: LocalUserRow): LocalUser {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    customRoleName: row.custom_role_name || '',
    permissions: parsePermissions(row.permissions),
    isActive: Boolean(row.is_active),
    mustChangePassword: Boolean(row.must_change_password),
    lastLogin: row.last_login || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalisiereEmail(email: string): string {
  return (email || '').trim().toLowerCase();
}

export function countUsers(db: DatabaseSync = getLocalDb()): number {
  const zeile = db.prepare('SELECT COUNT(*) as n FROM local_users').get() as unknown as {
    n: number;
  };
  return zeile.n;
}

export function listUsers(db: DatabaseSync = getLocalDb()): LocalUser[] {
  const zeilen = db
    .prepare('SELECT * FROM local_users ORDER BY name')
    .all() as unknown as LocalUserRow[];
  return zeilen.map(zeileZuBenutzer);
}

export function getUserById(id: string, db: DatabaseSync = getLocalDb()): LocalUser | null {
  const zeile = db.prepare('SELECT * FROM local_users WHERE id = ?').get(id) as unknown as
    | LocalUserRow
    | undefined;
  return zeile ? zeileZuBenutzer(zeile) : null;
}

/**
 * Nur für die Anmeldeprüfung — enthält den Passwort-Prüfwert und verlässt
 * dieses Modul deshalb nie in Richtung API-Antwort.
 */
function getUserRowByEmail(email: string, db: DatabaseSync = getLocalDb()): LocalUserRow | null {
  const zeile = db
    .prepare('SELECT * FROM local_users WHERE email = ?')
    .get(normalisiereEmail(email)) as unknown as LocalUserRow | undefined;
  return zeile || null;
}

/**
 * Öffentliche Fassung von getUserRowByEmail() oben — ohne den Passwort-
 * Prüfwert. Für "Passwort vergessen" (server/localAuth.ts): Dort steht noch
 * kein Passwort zur Bestätigung zur Verfügung, die Adresse allein muss zum
 * Nachschlagen genügen.
 */
export function getUserByEmail(email: string, db: DatabaseSync = getLocalDb()): LocalUser | null {
  const zeile = getUserRowByEmail(email, db);
  return zeile ? zeileZuBenutzer(zeile) : null;
}

export interface NeuerBenutzer {
  id?: string;
  email: string;
  name: string;
  password: string;
  customRoleName?: string;
  permissions?: UserPermissions;
  isActive?: boolean;
  mustChangePassword?: boolean;
}

export type BenutzerFehler =
  | 'E_MAIL_UNGUELTIG'
  | 'NAME_FEHLT'
  | 'PASSWORT_ZU_SCHWACH'
  | 'E_MAIL_VERGEBEN'
  | 'RECHTE_UNGUELTIG'
  | 'LETZTER_VERWALTER'
  | 'SELBSTDEAKTIVIERUNG';

export class BenutzerAnlegenFehler extends Error {
  constructor(
    public readonly code: BenutzerFehler,
    message: string
  ) {
    super(message);
  }
}

/**
 * Legt ein neues Benutzerkonto an.
 *
 * Wirft BenutzerAnlegenFehler bei jedem erwartbaren Eingabefehler (ungültige
 * E-Mail, zu schwaches Passwort, E-Mail schon vergeben) — die Route in
 * server.ts fängt das ab und antwortet mit dem passenden Text, statt eine
 * technische Fehlermeldung durchzureichen.
 */
export async function createUser(
  eingabe: NeuerBenutzer,
  db: DatabaseSync = getLocalDb()
): Promise<LocalUser> {
  const email = normalisiereEmail(eingabe.email);
  if (!email || !email.includes('@')) {
    throw new BenutzerAnlegenFehler('E_MAIL_UNGUELTIG', 'Bitte eine gültige E-Mail-Adresse angeben.');
  }
  const name = (eingabe.name || '').trim();
  if (!name) {
    throw new BenutzerAnlegenFehler('NAME_FEHLT', 'Bitte einen Namen angeben.');
  }
  const staerke = checkPasswordStrength(eingabe.password);
  if (!staerke.ok) {
    throw new BenutzerAnlegenFehler('PASSWORT_ZU_SCHWACH', staerke.message || 'Passwort zu schwach.');
  }
  if (getUserRowByEmail(email, db)) {
    throw new BenutzerAnlegenFehler(
      'E_MAIL_VERGEBEN',
      `Für "${email}" besteht bereits ein Konto auf diesem Server.`
    );
  }

  // hashPassword() ist asynchron (Web-Crypto-Schnittstelle) — deshalb liegt
  // zwischen der Prüfung oben und dem Einfügen unten eine kurze Wartezeit.
  // Träfen zwei Anfragen mit DERSELBEN E-Mail-Adresse exakt in dieser
  // Wartezeit ein, entschiede der eindeutige Index auf "email" (siehe
  // schema.ts), welche zuerst durchkommt — die zweite bekäme einen Fehler
  // statt zwei Konten mit gleicher Adresse.
  const passwordHash = await hashPassword(eingabe.password);

  const jetzt = new Date().toISOString();
  const id = eingabe.id || crypto.randomUUID();
  const permissions = eingabe.permissions || ALL_AREAS_NONE;

  try {
    db.prepare(
      `INSERT INTO local_users (
        id, email, name, password_hash, custom_role_name, permissions,
        is_active, must_change_password, created_at, updated_at
      ) VALUES (?,?,?,?,?,?,?,?,?,?)`
    ).run(
      id,
      email,
      name,
      passwordHash,
      eingabe.customRoleName || null,
      JSON.stringify(permissions),
      eingabe.isActive === false ? 0 : 1,
      eingabe.mustChangePassword ? 1 : 0,
      jetzt,
      jetzt
    );
  } catch (fehler: any) {
    // SQLITE_CONSTRAINT bei doppelter E-Mail — siehe Kommentar oben.
    if (String(fehler?.message || '').includes('UNIQUE')) {
      throw new BenutzerAnlegenFehler(
        'E_MAIL_VERGEBEN',
        `Für "${email}" besteht bereits ein Konto auf diesem Server.`
      );
    }
    throw fehler;
  }

  const angelegt = getUserById(id, db);
  if (!angelegt) {
    throw new Error(`Benutzer ${id} konnte nach dem Anlegen nicht wieder gelesen werden.`);
  }
  return angelegt;
}

/**
 * Bewusst KEIN "discriminated union" (zwei sich ausschließende Formen je nach
 * ok) mehr, sondern eine einzige Form mit optionalen Feldern — siehe die
 * ausführliche Begründung bei AnmeldeErgebnis in server/localAuth.ts, wo
 * genau dieselbe Umstellung aus demselben Grund vorgenommen wurde.
 */
export interface AnmeldeversuchErgebnis {
  ok: boolean;
  benutzer?: LocalUser;
  grund?: 'NICHT_GEFUNDEN' | 'DEAKTIVIERT' | 'PASSWORT_FALSCH';
}

/**
 * Prüft E-Mail-Adresse und Passwort gegeneinander.
 *
 * Antwortet bei unbekannter Adresse und bei falschem Passwort mit
 * unterschiedlichen `grund`-Werten, damit die Route in server.ts trotzdem
 * nach außen dieselbe, nicht unterscheidbare Meldung geben kann ("E-Mail-
 * Adresse oder Passwort falsch") — sonst ließe sich von außen abtasten,
 * welche Adressen überhaupt ein Konto haben.
 */
export async function verifyCredentials(
  email: string,
  password: string,
  db: DatabaseSync = getLocalDb()
): Promise<AnmeldeversuchErgebnis> {
  const zeile = getUserRowByEmail(email, db);
  if (!zeile) return { ok: false, grund: 'NICHT_GEFUNDEN' };
  if (!zeile.is_active) return { ok: false, grund: 'DEAKTIVIERT' };

  const pruefung = await verifyPassword(password, zeile.password_hash);
  if (!pruefung.ok) return { ok: false, grund: 'PASSWORT_FALSCH' };

  // Sehr alte, noch im Klartext gespeicherte Passwörter gibt es auf dieser
  // Tabelle nicht (sie existiert erst seit dieser Stufe) — needsUpgrade kann
  // hier also nicht vorkommen. Der Zweig bleibt trotzdem stehen, falls sich
  // das Prüfverfahren in passwordService.ts einmal ändert.
  if (pruefung.needsUpgrade) {
    db.prepare('UPDATE local_users SET password_hash = ? WHERE id = ?').run(
      await hashPassword(password),
      zeile.id
    );
  }

  db.prepare('UPDATE local_users SET last_login = ? WHERE id = ?').run(
    new Date().toISOString(),
    zeile.id
  );

  const aktualisiert = getUserById(zeile.id, db);
  return { ok: true, benutzer: aktualisiert! };
}

/**
 * Setzt ein neues Passwort. Beendet dabei alle bestehenden Sitzungen dieses
 * Kontos — sonst bliebe eine Sitzung, die vor der Änderung entstand, trotz
 * neuem Passwort gültig. Wer das Passwort ändert, wird also auf allen
 * Geräten abgemeldet und muss sich mit dem neuen erneut anmelden.
 */
export async function setPassword(
  id: string,
  neuesPasswort: string,
  optionen: { mustChangePassword?: boolean } = {},
  db: DatabaseSync = getLocalDb()
): Promise<LocalUser | null> {
  const vorhanden = getUserById(id, db);
  if (!vorhanden) return null;

  const staerke = checkPasswordStrength(neuesPasswort);
  if (!staerke.ok) {
    throw new BenutzerAnlegenFehler('PASSWORT_ZU_SCHWACH', staerke.message || 'Passwort zu schwach.');
  }

  const hash = await hashPassword(neuesPasswort);
  db.prepare(
    'UPDATE local_users SET password_hash = ?, must_change_password = ?, updated_at = ? WHERE id = ?'
  ).run(hash, optionen.mustChangePassword ? 1 : 0, new Date().toISOString(), id);

  deleteAllSessionsForUser(id, db);

  return getUserById(id, db);
}

/**
 * Gibt es außer dem Konto "ausgenommenId" noch mindestens ein AKTIVES Konto
 * mit "bearbeiten" im Bereich "users"? Ein deaktiviertes Konto zählt nicht
 * mit — es kann sich ohnehin nicht mehr anmelden, seine Rechte sind bis zur
 * Reaktivierung bedeutungslos.
 */
function gibtEsWeiterenVerwalter(ausgenommenId: string, db: DatabaseSync): boolean {
  return listUsers(db).some(
    (b) => b.id !== ausgenommenId && b.isActive && canEdit(b.permissions, 'users')
  );
}

/**
 * Setzt die Berechtigungen eines Kontos vollständig neu — immer alle
 * Bereiche auf einmal, nicht einzelne. Der übergebene Wert muss die von
 * parseUserPermissions() (utils/permissions.ts) verlangte vollständige Form
 * haben; fehlt auch nur ein Bereich oder steht dort ein ungültiger Wert,
 * wirft diese Funktion BenutzerAnlegenFehler('RECHTE_UNGUELTIG', ...) statt
 * etwas zu raten.
 *
 * Verweigert außerdem jede Änderung, die einem Konto, das gerade noch
 * "bearbeiten" auf "users" hat, dieses Recht entzieht, WENN es danach kein
 * anderes aktives Konto mit diesem Recht mehr gäbe — sonst könnte sich der
 * Verein komplett aus der eigenen Benutzerverwaltung aussperren, und niemand
 * käme ohne einen händischen Eingriff in der Datenbank wieder herein. Das
 * gilt unabhängig davon, wer die Änderung vornimmt (ein Konto kann sich
 * selbst genauso aussperren wie ein anderes), und ist bewusst die einzige
 * Sonderregel hier: Auf einem frisch eingerichteten Server mit nur einem
 * Vorstandskonto (der Normalfall laut Johannes) greift sie ohnehin nie, weil
 * dieses eine Konto niemals sein eigenes "users"-Recht verlieren würde,
 * ohne dass zuvor ein zweites Konto dieses Recht bekommen hätte.
 *
 * Was das NICHT abdeckt: Es gibt heute keine Route, die ein Konto
 * deaktiviert (isActive) — käme eine hinzu, müsste dieselbe Überlegung dort
 * greifen (das letzte aktive Verwalterkonto ließe sich sonst über den
 * Umweg "deaktivieren" statt "Rechte entziehen" trotzdem aussperren).
 *
 * Anders als setPassword() oben beendet das KEINE bestehenden Sitzungen:
 * pruefeSitzung() (server/localAuth.ts) liest die Berechtigungen bei jeder
 * einzelnen Anfrage frisch aus dieser Tabelle — in der Sitzung selbst steht
 * nichts davon, das veralten könnte.
 */
export function setPermissions(
  id: string,
  eingabe: unknown,
  db: DatabaseSync = getLocalDb()
): LocalUser | null {
  const vorhanden = getUserById(id, db);
  if (!vorhanden) return null;

  const berechtigungen = parseUserPermissions(eingabe);
  if (!berechtigungen) {
    throw new BenutzerAnlegenFehler(
      'RECHTE_UNGUELTIG',
      'Die Berechtigungen müssen für jeden Bereich genau einen der Werte "none", "view" oder "edit" angeben.'
    );
  }

  const verliertVerwaltung =
    vorhanden.isActive && canEdit(vorhanden.permissions, 'users') && !canEdit(berechtigungen, 'users');
  if (verliertVerwaltung && !gibtEsWeiterenVerwalter(id, db)) {
    throw new BenutzerAnlegenFehler(
      'LETZTER_VERWALTER',
      'Diesem Konto lässt sich das Recht "Benutzer & Rechte" nicht entziehen — es ist das letzte aktive Konto mit Zugriff auf die Benutzerverwaltung. Zuerst ein weiteres Konto mit diesem Recht ausstatten.'
    );
  }

  db.prepare('UPDATE local_users SET permissions = ?, updated_at = ? WHERE id = ?').run(
    JSON.stringify(berechtigungen),
    new Date().toISOString(),
    id
  );

  return getUserById(id, db);
}

/**
 * Aktiviert oder deaktiviert ein Konto — die zweite Stelle, an der sich ein
 * Verein aus der eigenen Benutzerverwaltung aussperren könnte, ohne dass
 * jemals ein Recht ausdrücklich entzogen wurde (siehe die Anmerkung dazu bei
 * setPermissions() oben, die genau diesen Fall als offenen Punkt benannt
 * hatte). Zwei Sperren, unabhängig voneinander:
 *
 * 1. SELBSTDEAKTIVIERUNG: Ein Konto darf sich NIE selbst deaktivieren — auch
 *    dann nicht, wenn es nicht das letzte mit "users"-Recht ist. Das ist
 *    strenger als bei setPermissions() (dort geht das Entziehen des eigenen
 *    Rechts durchaus, solange ein anderes Konto übrig bleibt), aber hier
 *    ausdrücklich so gewünscht: Wer sich selbst sperrt, kommt augenblicklich
 *    nicht mehr herein, ganz unabhängig von Rechten — ein Versehen an dieser
 *    Stelle lässt sich nicht einfach durch ein zweites Vorstandsmitglied
 *    rückgängig machen, wenn es gar keins gibt.
 *
 * 2. LETZTER_VERWALTER: Dieselbe Prüfung wie bei setPermissions() — verweigert
 *    das Deaktivieren, wenn danach kein anderes AKTIVES Konto mehr "edit" auf
 *    "users" hätte.
 *
 * In der einzigen Route, die diese Funktion heute aufruft (server.ts, PUT
 * .../users/:id/active), kann Sperre 2 praktisch nie greifen: Wer die Route
 * überhaupt erreicht, hat selbst schon "users"-Recht (erfordertRecht) und
 * bleibt von der eigenen Änderung unberührt, weil Sperre 1 eine
 * Selbstdeaktivierung ohnehin verhindert — es bliebe also immer mindestens
 * dieses eine Konto übrig. Die Prüfung steht trotzdem hier und nicht nur in
 * der Route: Diese Funktion soll ihre eigene Regel unabhängig davon
 * durchsetzen, WER sie aufruft — etwa aus einem künftigen Massenimport oder
 * einem Testskript, das nicht über die Route läuft.
 *
 * Nur das AKTIVIEREN eines Kontos braucht keine der beiden Prüfungen: Niemand
 * sperrt sich dadurch aus, dass ein Konto wieder freigeschaltet wird.
 */
export function setActive(
  id: string,
  aktiv: boolean,
  ausfuehrenderId: string,
  db: DatabaseSync = getLocalDb()
): LocalUser | null {
  const vorhanden = getUserById(id, db);
  if (!vorhanden) return null;

  if (!aktiv) {
    if (id === ausfuehrenderId) {
      throw new BenutzerAnlegenFehler(
        'SELBSTDEAKTIVIERUNG',
        'Sie können Ihr eigenes Konto nicht deaktivieren. Bitten Sie ein anderes Konto mit dem Recht "Benutzer & Rechte" darum.'
      );
    }
    if (
      vorhanden.isActive &&
      canEdit(vorhanden.permissions, 'users') &&
      !gibtEsWeiterenVerwalter(id, db)
    ) {
      throw new BenutzerAnlegenFehler(
        'LETZTER_VERWALTER',
        'Dieses Konto lässt sich nicht deaktivieren — es ist das letzte aktive Konto mit Zugriff auf die Benutzerverwaltung. Zuerst ein weiteres Konto mit diesem Recht ausstatten.'
      );
    }
  }

  db.prepare('UPDATE local_users SET is_active = ?, updated_at = ? WHERE id = ?').run(
    aktiv ? 1 : 0,
    new Date().toISOString(),
    id
  );

  return getUserById(id, db);
}
