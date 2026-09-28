import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { closeLocalDbForTests } from '../localDb';
import { listMembers, getMember, createMember, updateMember, deleteMember } from './members';
import type { NeuesMitglied } from './members';

let verzeichnis: string;
let alterDataDir: string | undefined;

beforeEach(() => {
  alterDataDir = process.env.VM_DATA_DIR;
  verzeichnis = fs.mkdtempSync(path.join(os.tmpdir(), 'vm-members-test-'));
  process.env.VM_DATA_DIR = verzeichnis;
});

afterEach(() => {
  closeLocalDbForTests();
  fs.rmSync(verzeichnis, { recursive: true, force: true });
  if (alterDataDir === undefined) delete process.env.VM_DATA_DIR;
  else process.env.VM_DATA_DIR = alterDataDir;
});

const BEISPIEL: NeuesMitglied = {
  memberNumber: 'M-0001',
  firstName: 'Erika',
  lastName: 'Musterfrau',
  gender: 'w',
  address: { street: 'Teststraße', houseNumber: '1', zip: '12345', city: 'Musterstadt', country: 'Deutschland' },
  phone: '0123456789',
  email: 'erika@example.de',
  entryDate: '2024-01-01',
  status: 'active',
  department: 'Hauptabteilung',
  membershipType: 'full',
  feeAmount: 12.5,
  feePeriod: 'monthly',
  paymentMethod: 'sepa',
  bankDetails: {
    iban: 'DE02120300000000202051',
    bic: 'BYLADEM1001',
    bankName: 'Musterbank',
    accountHolder: 'Erika Musterfrau',
    mandateDate: '2024-01-01',
    mandateReference: 'M-0001-2024',
  },
  notes: '',
  dataPrivacyConsent: true,
};

describe('Mitgliederverwaltung auf der lokalen Datenbank', () => {
  it('liefert eine leere Liste, solange kein Mitglied angelegt wurde', () => {
    expect(listMembers()).toEqual([]);
  });

  it('legt ein Mitglied an und liest es unverändert zurück, inklusive verschachtelter Objekte', () => {
    const angelegt = createMember(BEISPIEL);

    expect(angelegt.id).toBeTruthy();
    expect(angelegt.createdAt).toBeTruthy();
    expect(angelegt.updatedAt).toBe(angelegt.createdAt);

    const gelesen = getMember(angelegt.id);
    expect(gelesen).toEqual(angelegt);
    // Die Adresse und die Bankverbindung sind in SQLite als JSON-Text
    // abgelegt (siehe schema.ts) — hier wird geprüft, dass beim Lesen
    // wieder ein echtes Objekt herauskommt und keine Zeichenkette.
    expect(gelesen?.address).toEqual(BEISPIEL.address);
    expect(gelesen?.bankDetails).toEqual(BEISPIEL.bankDetails);
    expect(gelesen?.dataPrivacyConsent).toBe(true);
  });

  it('übernimmt eine mitgeschickte id, statt eine eigene zu erzeugen', () => {
    const angelegt = createMember({ ...BEISPIEL, id: 'mem-fest-vergeben' });
    expect(angelegt.id).toBe('mem-fest-vergeben');
  });

  it('gibt beim Lesen einer unbekannten id null zurück statt eines Fehlers', () => {
    expect(getMember('gibt-es-nicht')).toBeNull();
  });

  it('ändert nur die mitgeschickten Felder, der Rest bleibt unverändert', async () => {
    const angelegt = createMember(BEISPIEL);
    // Kurze Pause, damit updatedAt sich von createdAt unterscheidet — sonst
    // ließe sich ein "wurde wirklich neu geschrieben" nicht von einem
    // "wurde gar nicht angefasst" unterscheiden.
    await new Promise((r) => setTimeout(r, 5));

    const geaendert = updateMember(angelegt.id, { feeAmount: 20 });

    expect(geaendert?.feeAmount).toBe(20);
    expect(geaendert?.firstName).toBe(BEISPIEL.firstName);
    expect(geaendert?.address).toEqual(BEISPIEL.address);
    expect(geaendert?.updatedAt).not.toBe(angelegt.updatedAt);
    expect(geaendert?.createdAt).toBe(angelegt.createdAt);
  });

  it('gibt beim Ändern einer unbekannten id null zurück statt eines Fehlers', () => {
    expect(updateMember('gibt-es-nicht', { feeAmount: 1 })).toBeNull();
  });

  it('löscht ein Mitglied und meldet danach, dass es weg ist', () => {
    const angelegt = createMember(BEISPIEL);
    expect(deleteMember(angelegt.id)).toBe(true);
    expect(getMember(angelegt.id)).toBeNull();
  });

  it('meldet beim Löschen einer unbekannten id false statt eines Fehlers', () => {
    expect(deleteMember('gibt-es-nicht')).toBe(false);
  });

  it('liefert die Liste alphabetisch nach Nachname, Vorname sortiert', () => {
    createMember({ ...BEISPIEL, id: 'a', firstName: 'Zora', lastName: 'Adler', memberNumber: 'M-0002' });
    createMember({ ...BEISPIEL, id: 'b', firstName: 'Anton', lastName: 'Zorn', memberNumber: 'M-0003' });
    const liste = listMembers();
    expect(liste.map((m) => m.lastName)).toEqual(['Adler', 'Zorn']);
  });
});
