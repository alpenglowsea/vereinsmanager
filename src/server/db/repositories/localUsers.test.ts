import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { closeLocalDbForTests } from '../localDb';
import {
  countUsers,
  createUser,
  getUserById,
  listUsers,
  setActive,
  setPassword,
  setPermissions,
  verifyCredentials,
  BenutzerAnlegenFehler,
} from './localUsers';
import { ALL_AREAS_EDIT, ALL_AREAS_NONE } from '../../../utils/permissions';
import { getSession, createSession } from './localSessions';

let verzeichnis: string;
let alterDataDir: string | undefined;

beforeEach(() => {
  alterDataDir = process.env.VM_DATA_DIR;
  verzeichnis = fs.mkdtempSync(path.join(os.tmpdir(), 'vm-localusers-test-'));
  process.env.VM_DATA_DIR = verzeichnis;
});

afterEach(() => {
  closeLocalDbForTests();
  fs.rmSync(verzeichnis, { recursive: true, force: true });
  if (alterDataDir === undefined) delete process.env.VM_DATA_DIR;
  else process.env.VM_DATA_DIR = alterDataDir;
});

describe('Benutzerkonten des eigenen Servers', () => {
  it('zählt korrekt, auch wenn noch niemand angelegt wurde', () => {
    expect(countUsers()).toBe(0);
  });

  it('legt ein Konto an und speichert die E-Mail-Adresse klein geschrieben', async () => {
    const benutzer = await createUser({
      email: 'Vorstand@Beispiel.DE',
      name: 'Erika Musterfrau',
      password: 'sicheresPasswort123',
    });
    expect(benutzer.email).toBe('vorstand@beispiel.de');
    expect(benutzer.id).toBeTruthy();
    expect(benutzer.isActive).toBe(true);
    // Der Prüfwert darf in keiner Form nach außen gelangen.
    expect(benutzer).not.toHaveProperty('password');
    expect(benutzer).not.toHaveProperty('passwordHash');
  });

  it('vergibt ohne Angabe standardmäßig keine Rechte (ALL_AREAS_NONE)', async () => {
    const benutzer = await createUser({ email: 'a@b.de', name: 'X', password: 'sicheresPasswort123' });
    expect(benutzer.permissions).toEqual(ALL_AREAS_NONE);
  });

  it('übernimmt mitgeschickte Rechte (z. B. Vollzugriff für das erste Konto)', async () => {
    const benutzer = await createUser({
      email: 'a@b.de',
      name: 'X',
      password: 'sicheresPasswort123',
      permissions: ALL_AREAS_EDIT,
    });
    expect(benutzer.permissions).toEqual(ALL_AREAS_EDIT);
  });

  it('lehnt eine ungültige E-Mail-Adresse ab', async () => {
    await expect(
      createUser({ email: 'keine-email-adresse', name: 'X', password: 'sicheresPasswort123' })
    ).rejects.toMatchObject({ code: 'E_MAIL_UNGUELTIG' });
  });

  it('lehnt einen fehlenden Namen ab', async () => {
    await expect(
      createUser({ email: 'a@b.de', name: '  ', password: 'sicheresPasswort123' })
    ).rejects.toMatchObject({ code: 'NAME_FEHLT' });
  });

  it('lehnt ein zu schwaches Passwort ab', async () => {
    await expect(createUser({ email: 'a@b.de', name: 'X', password: '123' })).rejects.toMatchObject({
      code: 'PASSWORT_ZU_SCHWACH',
    });
  });

  it('lehnt eine bereits vergebene E-Mail-Adresse ab, unabhängig von Groß-/Kleinschreibung', async () => {
    await createUser({ email: 'a@b.de', name: 'Erste', password: 'sicheresPasswort123' });
    await expect(
      createUser({ email: 'A@B.DE', name: 'Zweite', password: 'sicheresPasswort123' })
    ).rejects.toMatchObject({ code: 'E_MAIL_VERGEBEN' });
    expect(countUsers()).toBe(1);
  });

  it('lehnt bei der Anmeldung eine unbekannte Adresse ab', async () => {
    const ergebnis = await verifyCredentials('niemand@b.de', 'irgendeinPasswort');
    expect(ergebnis).toEqual({ ok: false, grund: 'NICHT_GEFUNDEN' });
  });

  it('lehnt bei der Anmeldung ein falsches Passwort ab', async () => {
    await createUser({ email: 'a@b.de', name: 'X', password: 'sicheresPasswort123' });
    const ergebnis = await verifyCredentials('a@b.de', 'falschesPasswort');
    expect(ergebnis).toEqual({ ok: false, grund: 'PASSWORT_FALSCH' });
  });

  it('meldet ein deaktiviertes Konto gesondert', async () => {
    await createUser({ email: 'a@b.de', name: 'X', password: 'sicheresPasswort123', isActive: false });
    const ergebnis = await verifyCredentials('a@b.de', 'sicheresPasswort123');
    expect(ergebnis).toEqual({ ok: false, grund: 'DEAKTIVIERT' });
  });

  it('meldet bei richtigen Zugangsdaten Erfolg und trägt die letzte Anmeldung ein', async () => {
    const angelegt = await createUser({ email: 'a@b.de', name: 'X', password: 'sicheresPasswort123' });
    expect(angelegt.lastLogin).toBeUndefined();

    const ergebnis = await verifyCredentials('A@B.DE', 'sicheresPasswort123');
    expect(ergebnis.ok).toBe(true);
    if (!ergebnis.ok) throw new Error('unreachable');
    expect(ergebnis.benutzer.lastLogin).toBeTruthy();

    const gelesen = getUserById(angelegt.id);
    expect(gelesen?.lastLogin).toBeTruthy();
  });

  it('ändert das Passwort und beendet dabei alle bestehenden Sitzungen des Kontos', async () => {
    const benutzer = await createUser({ email: 'a@b.de', name: 'X', password: 'altesPasswort123' });
    const sitzung = createSession(benutzer.id);
    expect(getSession(sitzung.token)).not.toBeNull();

    const geaendert = await setPassword(benutzer.id, 'neuesPasswort456');
    expect(geaendert?.id).toBe(benutzer.id);

    expect(getSession(sitzung.token)).toBeNull();
    expect((await verifyCredentials('a@b.de', 'altesPasswort123')).ok).toBe(false);
    expect((await verifyCredentials('a@b.de', 'neuesPasswort456')).ok).toBe(true);
  });

  it('lehnt ein zu schwaches neues Passwort ab', async () => {
    const benutzer = await createUser({ email: 'a@b.de', name: 'X', password: 'sicheresPasswort123' });
    await expect(setPassword(benutzer.id, '123')).rejects.toMatchObject({ code: 'PASSWORT_ZU_SCHWACH' });
  });

  it('gibt beim Ändern des Passworts einer unbekannten id null zurück statt eines Fehlers', async () => {
    expect(await setPassword('gibt-es-nicht', 'sicheresPasswort123')).toBeNull();
  });

  it('setzt die Berechtigungen eines Kontos vollständig neu', async () => {
    const benutzer = await createUser({ email: 'a@b.de', name: 'X', password: 'sicheresPasswort123' });
    expect(benutzer.permissions).toEqual(ALL_AREAS_NONE);

    const aktualisiert = setPermissions(benutzer.id, ALL_AREAS_EDIT);
    expect(aktualisiert?.permissions).toEqual(ALL_AREAS_EDIT);

    // Auch aus einer frischen Datenbank-Abfrage wieder lesbar, nicht nur im
    // direkt zurückgegebenen Objekt.
    const geladen = getUserById(benutzer.id);
    expect(geladen?.permissions).toEqual(ALL_AREAS_EDIT);
  });

  it('gibt beim Setzen von Berechtigungen für eine unbekannte id null zurück statt eines Fehlers', () => {
    expect(setPermissions('gibt-es-nicht', ALL_AREAS_EDIT)).toBeNull();
  });

  it('lehnt unvollständige oder ungültige Berechtigungen ab', async () => {
    const benutzer = await createUser({ email: 'a@b.de', name: 'X', password: 'sicheresPasswort123' });

    let fehler: any;
    try {
      setPermissions(benutzer.id, { members: 'edit' }); // nur ein Bereich von vielen
    } catch (e) {
      fehler = e;
    }
    expect(fehler).toBeInstanceOf(BenutzerAnlegenFehler);
    expect(fehler.code).toBe('RECHTE_UNGUELTIG');

    // Die ungültige Eingabe darf nichts verändert haben.
    expect(getUserById(benutzer.id)?.permissions).toEqual(ALL_AREAS_NONE);
  });

  it('beendet bestehende Sitzungen NICHT — anders als eine Passwortänderung', async () => {
    const benutzer = await createUser({ email: 'a@b.de', name: 'X', password: 'sicheresPasswort123' });
    const sitzung = createSession(benutzer.id);
    expect(getSession(sitzung.token)).not.toBeNull();

    setPermissions(benutzer.id, ALL_AREAS_EDIT);

    expect(getSession(sitzung.token)).not.toBeNull();
  });

  describe('Schutz vor dem letzten Verwalterkonto', () => {
    it('lehnt es ab, dem einzigen Konto mit "users"-Recht dieses Recht zu entziehen', async () => {
      const vorstand = await createUser({
        email: 'vorstand@b.de',
        name: 'Vorstand',
        password: 'sicheresPasswort123',
        permissions: ALL_AREAS_EDIT,
      });

      let fehler: any;
      try {
        setPermissions(vorstand.id, { ...ALL_AREAS_EDIT, users: 'none' });
      } catch (e) {
        fehler = e;
      }
      expect(fehler).toBeInstanceOf(BenutzerAnlegenFehler);
      expect(fehler.code).toBe('LETZTER_VERWALTER');

      // Die abgelehnte Änderung darf nichts verändert haben.
      expect(getUserById(vorstand.id)?.permissions).toEqual(ALL_AREAS_EDIT);
    });

    it('erlaubt es, einem von zwei Verwalterkonten das Recht zu entziehen', async () => {
      const erster = await createUser({
        email: 'a@b.de',
        name: 'Erster',
        password: 'sicheresPasswort123',
        permissions: ALL_AREAS_EDIT,
      });
      await createUser({
        email: 'b@b.de',
        name: 'Zweiter',
        password: 'sicheresPasswort123',
        permissions: ALL_AREAS_EDIT,
      });

      const aktualisiert = setPermissions(erster.id, { ...ALL_AREAS_EDIT, users: 'none' });
      expect(aktualisiert?.permissions.users).toBe('none');
    });

    it('lehnt es ab, danach auch dem letzten verbliebenen Verwalterkonto das Recht zu entziehen', async () => {
      const erster = await createUser({
        email: 'a@b.de',
        name: 'Erster',
        password: 'sicheresPasswort123',
        permissions: ALL_AREAS_EDIT,
      });
      const zweiter = await createUser({
        email: 'b@b.de',
        name: 'Zweiter',
        password: 'sicheresPasswort123',
        permissions: ALL_AREAS_EDIT,
      });

      setPermissions(erster.id, { ...ALL_AREAS_EDIT, users: 'none' });

      let fehler: any;
      try {
        setPermissions(zweiter.id, { ...ALL_AREAS_EDIT, users: 'none' });
      } catch (e) {
        fehler = e;
      }
      expect(fehler).toBeInstanceOf(BenutzerAnlegenFehler);
      expect(fehler.code).toBe('LETZTER_VERWALTER');
    });

    it('zählt ein deaktiviertes Konto nicht als verbliebenen Verwalter', async () => {
      const aktiv = await createUser({
        email: 'a@b.de',
        name: 'Aktiv',
        password: 'sicheresPasswort123',
        permissions: ALL_AREAS_EDIT,
      });
      await createUser({
        email: 'b@b.de',
        name: 'Deaktiviert',
        password: 'sicheresPasswort123',
        permissions: ALL_AREAS_EDIT,
        isActive: false,
      });

      let fehler: any;
      try {
        setPermissions(aktiv.id, { ...ALL_AREAS_EDIT, users: 'none' });
      } catch (e) {
        fehler = e;
      }
      expect(fehler).toBeInstanceOf(BenutzerAnlegenFehler);
      expect(fehler.code).toBe('LETZTER_VERWALTER');
    });

    it('greift nicht, wenn das Konto ohnehin schon kein "users"-Recht hatte', async () => {
      const mitglied = await createUser({ email: 'a@b.de', name: 'X', password: 'sicheresPasswort123' });
      expect(mitglied.permissions.users).toBe('none');

      // Setzt "users" erneut auf "none" — es geht nichts verloren, das
      // Konto hatte das Recht vorher schon nicht.
      const aktualisiert = setPermissions(mitglied.id, ALL_AREAS_NONE);
      expect(aktualisiert?.permissions).toEqual(ALL_AREAS_NONE);
    });

    it('greift nicht, wenn das betroffene Konto selbst schon deaktiviert ist', async () => {
      const vorstand = await createUser({
        email: 'vorstand@b.de',
        name: 'Vorstand',
        password: 'sicheresPasswort123',
        permissions: ALL_AREAS_EDIT,
        isActive: false,
      });

      // Ein deaktiviertes Konto kann sich ohnehin nicht anmelden — ihm das
      // "users"-Recht zu entziehen, sperrt niemanden zusätzlich aus.
      const aktualisiert = setPermissions(vorstand.id, { ...ALL_AREAS_EDIT, users: 'none' });
      expect(aktualisiert?.permissions.users).toBe('none');
    });
  });

  describe('setActive — Konten deaktivieren und wieder freigeben', () => {
    it('lehnt es immer ab, das eigene Konto zu deaktivieren', async () => {
      // Auch mit einem zweiten Verwalterkonto in petto: Diese Sperre gilt
      // unabhängig von den Rechten, nicht nur, wenn es sonst niemanden mehr
      // gäbe (anders als bei setPermissions oben).
      const eigenes = await createUser({
        email: 'a@b.de',
        name: 'Eigenes Konto',
        password: 'sicheresPasswort123',
        permissions: ALL_AREAS_EDIT,
      });
      await createUser({
        email: 'b@b.de',
        name: 'Zweiter Verwalter',
        password: 'sicheresPasswort123',
        permissions: ALL_AREAS_EDIT,
      });

      let fehler: any;
      try {
        setActive(eigenes.id, false, eigenes.id);
      } catch (e) {
        fehler = e;
      }
      expect(fehler).toBeInstanceOf(BenutzerAnlegenFehler);
      expect(fehler.code).toBe('SELBSTDEAKTIVIERUNG');
      expect(getUserById(eigenes.id)?.isActive).toBe(true);
    });

    it('deaktiviert ein anderes Konto, wenn der Ausführende nicht das Ziel ist', async () => {
      const verwalter = await createUser({
        email: 'a@b.de',
        name: 'Verwalter',
        password: 'sicheresPasswort123',
        permissions: ALL_AREAS_EDIT,
      });
      const mitglied = await createUser({ email: 'b@b.de', name: 'X', password: 'sicheresPasswort123' });

      const aktualisiert = setActive(mitglied.id, false, verwalter.id);
      expect(aktualisiert?.isActive).toBe(false);
    });

    it('lehnt es ab, das letzte aktive Verwalterkonto über einen anderen Ausführenden zu deaktivieren', async () => {
      // Konstruierter Fall (in der echten Route nicht erreichbar, weil der
      // Ausführende dort selbst "users"-Recht braucht und von der eigenen
      // Änderung nicht betroffen ist) — die Prüfung greift trotzdem, weil sie
      // unabhängig vom Aufrufer gilt (siehe Doku-Kommentar bei setActive).
      const verwalter = await createUser({
        email: 'a@b.de',
        name: 'Verwalter',
        password: 'sicheresPasswort123',
        permissions: ALL_AREAS_EDIT,
      });
      const irgendwer = await createUser({ email: 'b@b.de', name: 'X', password: 'sicheresPasswort123' });

      let fehler: any;
      try {
        setActive(verwalter.id, false, irgendwer.id);
      } catch (e) {
        fehler = e;
      }
      expect(fehler).toBeInstanceOf(BenutzerAnlegenFehler);
      expect(fehler.code).toBe('LETZTER_VERWALTER');
      expect(getUserById(verwalter.id)?.isActive).toBe(true);
    });

    it('erlaubt es, eines von zwei Verwalterkonten zu deaktivieren', async () => {
      const erster = await createUser({
        email: 'a@b.de',
        name: 'Erster',
        password: 'sicheresPasswort123',
        permissions: ALL_AREAS_EDIT,
      });
      const zweiter = await createUser({
        email: 'b@b.de',
        name: 'Zweiter',
        password: 'sicheresPasswort123',
        permissions: ALL_AREAS_EDIT,
      });

      const aktualisiert = setActive(zweiter.id, false, erster.id);
      expect(aktualisiert?.isActive).toBe(false);
    });

    it('zählt ein bereits deaktiviertes Konto nicht als verbliebenen Verwalter', async () => {
      const aktiv = await createUser({
        email: 'a@b.de',
        name: 'Aktiv',
        password: 'sicheresPasswort123',
        permissions: ALL_AREAS_EDIT,
      });
      const bereitsDeaktiviert = await createUser({
        email: 'b@b.de',
        name: 'Schon deaktiviert',
        password: 'sicheresPasswort123',
        permissions: ALL_AREAS_EDIT,
        isActive: false,
      });
      const irgendwer = await createUser({ email: 'c@b.de', name: 'X', password: 'sicheresPasswort123' });

      let fehler: any;
      try {
        setActive(aktiv.id, false, irgendwer.id);
      } catch (e) {
        fehler = e;
      }
      expect(fehler).toBeInstanceOf(BenutzerAnlegenFehler);
      expect(fehler.code).toBe('LETZTER_VERWALTER');
      // Das bereits deaktivierte Konto bleibt unberührt.
      expect(getUserById(bereitsDeaktiviert.id)?.isActive).toBe(false);
    });

    it('braucht für das Deaktivieren eines Kontos ohne "users"-Recht keinen zweiten Verwalter', async () => {
      const verwalter = await createUser({
        email: 'a@b.de',
        name: 'Verwalter',
        password: 'sicheresPasswort123',
        permissions: ALL_AREAS_EDIT,
      });
      const mitglied = await createUser({ email: 'b@b.de', name: 'X', password: 'sicheresPasswort123' });

      const aktualisiert = setActive(mitglied.id, false, verwalter.id);
      expect(aktualisiert?.isActive).toBe(false);
    });

    it('braucht für das AKTIVIEREN eines Kontos keine der beiden Prüfungen', async () => {
      const verwalter = await createUser({
        email: 'a@b.de',
        name: 'Verwalter',
        password: 'sicheresPasswort123',
        permissions: ALL_AREAS_EDIT,
        isActive: false,
      });

      // Reaktivierung durch sich selbst — ergibt zwar praktisch keinen Sinn
      // (ein deaktiviertes Konto kann sich nicht anmelden, um das
      // aufzurufen), ist aber auch nicht gefährlich und deshalb nicht
      // gesperrt.
      const aktualisiert = setActive(verwalter.id, true, verwalter.id);
      expect(aktualisiert?.isActive).toBe(true);
    });

    it('gibt beim Deaktivieren einer unbekannten id null zurück statt eines Fehlers', () => {
      expect(setActive('gibt-es-nicht', false, 'irgendwer')).toBeNull();
    });
  });

  it('listet Konten alphabetisch nach Namen sortiert', async () => {
    await createUser({ email: 'b@x.de', name: 'Zora', password: 'sicheresPasswort123' });
    await createUser({ email: 'a@x.de', name: 'Anton', password: 'sicheresPasswort123' });
    const namen = listUsers().map((b) => b.name);
    expect(namen).toEqual(['Anton', 'Zora']);
  });

  it('BenutzerAnlegenFehler transportiert den Code für die Route in server.ts', () => {
    const fehler = new BenutzerAnlegenFehler('PASSWORT_ZU_SCHWACH', 'Text für Menschen');
    expect(fehler).toBeInstanceOf(Error);
    expect(fehler.code).toBe('PASSWORT_ZU_SCHWACH');
    expect(fehler.message).toBe('Text für Menschen');
  });
});
