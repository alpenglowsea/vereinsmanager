/**
 * Mitgliederverwaltung auf der lokalen SQLite-Datenbank (eigener Server).
 * ---------------------------------------------------------------------------
 *
 * Das Gegenstück zu den member-Funktionen in src/services/cloudStorage.ts,
 * nur dass hier keine fremde Datenbank über das Netz angesprochen wird,
 * sondern die eigene Datei aus localDb.ts.
 *
 * Die Umwandlung zwischen der Schreibweise der Oberfläche (camelCase, z. B.
 * `memberNumber`) und der Schreibweise der Datenbank (snake_case, z. B.
 * `member_number`) folgt bewusst demselben Muster wie mapMemberToDb() /
 * mapMemberFromDb() in cloudStorage.ts — nur mit einem zusätzlichen Schritt:
 * Adresse und Bankverbindung sind in Supabase eigene JSONB-Spalten und
 * kommen dort als fertiges Objekt an; SQLite kennt diesen Spaltentyp nicht
 * (siehe schema.ts), deshalb werden sie hier selbst in JSON-Text verwandelt
 * und wieder zurück.
 *
 * Diese erste Stufe ist bewusst noch ohne Prüfung, WER schreiben darf — das
 * ist eine eigene, sicherheitskritische Stufe für sich (siehe schema.ts).
 * Wer serverseitig auf diese Funktionen zugreifen kann, darf hier vorerst
 * alles.
 */

import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

import type { Address, BankDetails, Member } from '../../../types';
import { getLocalDb } from '../localDb';

/** Eine Zeile aus der Tabelle "members", so wie SQLite sie zurückgibt. */
interface MemberRow {
  id: string;
  member_number: string;
  first_name: string;
  last_name: string;
  gender: string;
  birth_date: string | null;
  avatar_url: string | null;
  address: string;
  phone: string | null;
  email: string | null;
  entry_date: string;
  exit_date: string | null;
  status: string;
  department: string;
  membership_type: string;
  fee_amount: number;
  fee_period: string | null;
  payment_method: string | null;
  bank_details: string | null;
  notes: string | null;
  data_privacy_consent: number;
  created_at: string;
  updated_at: string;
}

const LEERE_ADRESSE: Address = {
  street: '',
  houseNumber: '',
  zip: '',
  city: '',
  country: 'Deutschland',
};

const LEERE_BANKVERBINDUNG: BankDetails = {
  iban: '',
  bic: '',
  bankName: '',
  accountHolder: '',
  mandateDate: '',
  mandateReference: '',
};

/**
 * Wandelt JSON-Text aus der Datenbank in ein Objekt um. Kommt eine defekte
 * oder leere Zeichenkette vorbei, zählt das als "nichts hinterlegt" statt
 * eines Absturzes — dieselbe Großzügigkeit, mit der mapMemberFromDb() in
 * cloudStorage.ts ein fehlendes Objekt behandelt.
 */
function parseJsonSpalte<T>(text: string | null, vorgabe: T): T {
  if (!text) return vorgabe;
  try {
    const geparst = JSON.parse(text);
    return geparst && typeof geparst === 'object' ? (geparst as T) : vorgabe;
  } catch {
    return vorgabe;
  }
}

function zeileZuMitglied(row: MemberRow): Member {
  return {
    id: row.id,
    memberNumber: row.member_number,
    firstName: row.first_name,
    lastName: row.last_name,
    gender: (row.gender as Member['gender']) || 'none',
    birthDate: row.birth_date || undefined,
    avatarUrl: row.avatar_url || undefined,
    address: parseJsonSpalte(row.address, LEERE_ADRESSE),
    phone: row.phone || '',
    email: row.email || '',
    entryDate: row.entry_date,
    exitDate: row.exit_date || undefined,
    status: (row.status as Member['status']) || 'active',
    department: row.department,
    membershipType: (row.membership_type as Member['membershipType']) || 'full',
    feeAmount: Number(row.fee_amount) || 0,
    feePeriod: (row.fee_period as Member['feePeriod']) || 'monthly',
    paymentMethod: (row.payment_method as Member['paymentMethod']) || 'sepa',
    bankDetails: parseJsonSpalte(row.bank_details, LEERE_BANKVERBINDUNG),
    notes: row.notes || '',
    dataPrivacyConsent: Boolean(row.data_privacy_consent),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Eingabe beim Anlegen. Ohne `id` wird eine erzeugt (siehe createMember). */
export type NeuesMitglied = Omit<Member, 'id' | 'createdAt' | 'updatedAt'> & {
  id?: string;
};

/** Eingabe beim Ändern: jedes Feld außer der id ist optional. */
export type MitgliedAenderung = Partial<Omit<Member, 'id' | 'createdAt' | 'updatedAt'>>;

export function listMembers(db: DatabaseSync = getLocalDb()): Member[] {
  // node:sqlite gibt hier ein Record<string, SQLOutputValue>[] zurück — eine
  // generische, aber nicht "unknown" gehaltene Zeilenform. TypeScript lässt
  // deshalb keinen direkten Sprung zu MemberRow zu (die beiden Typen
  // "überlappen nicht ausreichend"); der Umweg über "unknown" sagt bewusst:
  // Ich weiß, was in dieser Spalte steht, das kann der Compiler aber allein
  // aus dem SQL-Text nicht ableiten.
  const zeilen = db
    .prepare('SELECT * FROM members ORDER BY last_name, first_name')
    .all() as unknown as MemberRow[];
  return zeilen.map(zeileZuMitglied);
}

export function getMember(id: string, db: DatabaseSync = getLocalDb()): Member | null {
  const zeile = db.prepare('SELECT * FROM members WHERE id = ?').get(id) as unknown as
    | MemberRow
    | undefined;
  return zeile ? zeileZuMitglied(zeile) : null;
}

export function createMember(eingabe: NeuesMitglied, db: DatabaseSync = getLocalDb()): Member {
  const jetzt = new Date().toISOString();
  const id = eingabe.id || crypto.randomUUID();

  db.prepare(
    `INSERT INTO members (
      id, member_number, first_name, last_name, gender, birth_date, avatar_url,
      address, phone, email, entry_date, exit_date, status, department,
      membership_type, fee_amount, fee_period, payment_method, bank_details,
      notes, data_privacy_consent, created_at, updated_at
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).run(
    id,
    eingabe.memberNumber,
    eingabe.firstName,
    eingabe.lastName,
    eingabe.gender || 'none',
    eingabe.birthDate || null,
    eingabe.avatarUrl || null,
    JSON.stringify(eingabe.address || LEERE_ADRESSE),
    eingabe.phone || '',
    eingabe.email || '',
    eingabe.entryDate,
    eingabe.exitDate || null,
    eingabe.status || 'active',
    eingabe.department,
    eingabe.membershipType || 'full',
    Number(eingabe.feeAmount) || 0,
    eingabe.feePeriod || 'monthly',
    eingabe.paymentMethod || 'sepa',
    JSON.stringify(eingabe.bankDetails || LEERE_BANKVERBINDUNG),
    eingabe.notes || '',
    eingabe.dataPrivacyConsent ? 1 : 0,
    jetzt,
    jetzt
  );

  // Nicht das Eingabeobjekt zurückgeben, sondern die soeben geschriebene
  // Zeile neu lesen: So bekommt der Aufrufer garantiert das, was in der
  // Datenbank steht, inklusive aller Vorgabewerte, die SQLite selbst gesetzt
  // haben könnte.
  const angelegt = getMember(id, db);
  if (!angelegt) {
    // Kann nur bei einem internen Fehler passieren — die Zeile wurde gerade
    // erst eingefügt.
    throw new Error(`Mitglied ${id} konnte nach dem Anlegen nicht wieder gelesen werden.`);
  }
  return angelegt;
}

/**
 * Ändert ein bestehendes Mitglied. Nur die mitgeschickten Felder werden
 * angefasst — wie bei writeSmtpConfig() in instanceConfig.ts gilt:
 * weggelassen heißt unverändert.
 *
 * Gibt null zurück, wenn es kein Mitglied mit dieser id gibt.
 */
export function updateMember(
  id: string,
  aenderung: MitgliedAenderung,
  db: DatabaseSync = getLocalDb()
): Member | null {
  const vorhanden = getMember(id, db);
  if (!vorhanden) return null;

  const neu: Member = { ...vorhanden, ...aenderung, id, updatedAt: new Date().toISOString() };

  db.prepare(
    `UPDATE members SET
      member_number = ?, first_name = ?, last_name = ?, gender = ?, birth_date = ?,
      avatar_url = ?, address = ?, phone = ?, email = ?, entry_date = ?, exit_date = ?,
      status = ?, department = ?, membership_type = ?, fee_amount = ?, fee_period = ?,
      payment_method = ?, bank_details = ?, notes = ?, data_privacy_consent = ?,
      updated_at = ?
    WHERE id = ?`
  ).run(
    neu.memberNumber,
    neu.firstName,
    neu.lastName,
    neu.gender || 'none',
    neu.birthDate || null,
    neu.avatarUrl || null,
    JSON.stringify(neu.address || LEERE_ADRESSE),
    neu.phone || '',
    neu.email || '',
    neu.entryDate,
    neu.exitDate || null,
    neu.status || 'active',
    neu.department,
    neu.membershipType || 'full',
    Number(neu.feeAmount) || 0,
    neu.feePeriod || 'monthly',
    neu.paymentMethod || 'sepa',
    JSON.stringify(neu.bankDetails || LEERE_BANKVERBINDUNG),
    neu.notes || '',
    neu.dataPrivacyConsent ? 1 : 0,
    neu.updatedAt,
    id
  );

  return getMember(id, db);
}

/** Löscht ein Mitglied. Gibt zurück, ob überhaupt eines gelöscht wurde. */
export function deleteMember(id: string, db: DatabaseSync = getLocalDb()): boolean {
  const ergebnis = db.prepare('DELETE FROM members WHERE id = ?').run(id);
  return ergebnis.changes > 0;
}
