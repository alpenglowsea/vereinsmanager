import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { closeLocalDbForTests } from './db/localDb';
import {
  ersteEinrichtung,
  anmelden,
  abmelden,
  pruefeSitzung,
  istEinrichtungAusstehend,
  passwortVergessenAnfrage,
  passwortZuruecksetzen,
} from './localAuth';
import { createUser, setPassword } from './db/repositories/localUsers';
import { ALL_AREAS_EDIT, ALL_AREAS_NONE } from '../utils/permissions';

let verzeichnis: string;
let alterDataDir: string | undefined;

beforeEach(() => {
  alterDataDir = process.env.VM_DATA_DIR;
  verzeichnis = fs.mkdtempSync(path.join(os.tmpdir(), 'vm-localauth-test-'));
  process.env.VM_DATA_DIR = verzeichnis;
});

afterEach(() => {
  closeLocalDbForTests();
  fs.rmSync(verzeichnis, { recursive: true, force: true });
  if (alterDataDir === undefined) delete process.env.VM_DATA_DIR;
  else process.env.VM_DATA_DIR = alterDataDir;
});

describe('Anmeldung am eigenen Server', () => {
  it('richtet das allererste Konto ein, meldet es gleich an und gibt ihm Vollzugriff', async () => {
    const ergebnis = await ersteEinrichtung({
      email: 'Vorstand@Beispiel.de',
      name: 'Erika Musterfrau',
      password: 'sicheresPasswort123',
    });
    expect(ergebnis.erfolg).toBe(true);
    if (!ergebnis.erfolg) throw new Error('unreachable');
    expect(ergebnis.benutzer.email).toBe('vorstand@beispiel.de');
    expect(ergebnis.benutzer.customRoleName).toBe('1. Vorsitzende(r)');
    expect(ergebnis.benutzer.permissions).toEqual(ALL_AREAS_EDIT);
    expect(ergebnis.benutzer.mustChangePassword).toBe(false);
    expect(ergebnis.sitzungsToken).toBeTruthy();

    // Die Ersteinrichtung liefert nicht nur einen Token zurück, der Token
    // muss auch tatsächlich als angemeldete Sitzung gelten.
    const befund = pruefeSitzung(ergebnis.sitzungsToken);
    expect(befund.angemeldet).toBe(true);
  });

  it('lehnt eine zweite Ersteinrichtung ab, sobald bereits ein Konto besteht', async () => {
    await ersteEinrichtung({ email: 'a@b.de', name: 'X', password: 'sicheresPasswort123' });
    const zweite = await ersteEinrichtung({ email: 'c@d.de', name: 'Y', password: 'nochEinPasswort123' });
    expect(zweite.erfolg).toBe(false);
  });

  it('meldet mit richtigen Zugangsdaten an, unabhängig von Groß-/Kleinschreibung der Adresse', async () => {
    await createUser({ email: 'a@b.de', name: 'X', password: 'sicheresPasswort123' });
    const ergebnis = await anmelden('A@B.DE', 'sicheresPasswort123');
    expect(ergebnis.erfolg).toBe(true);
    if (!ergebnis.erfolg) throw new Error('unreachable');
    expect(ergebnis.sitzungsToken).toBeTruthy();
  });

  it('meldet bei unbekannter Adresse und bei falschem Passwort dieselbe Meldung — von außen nicht unterscheidbar', async () => {
    await createUser({ email: 'a@b.de', name: 'X', password: 'sicheresPasswort123' });
    const unbekannt = await anmelden('niemand@b.de', 'irgendeinPasswort');
    const falsch = await anmelden('a@b.de', 'falschesPasswort');
    expect(unbekannt.erfolg).toBe(false);
    expect(falsch.erfolg).toBe(false);
    if (unbekannt.erfolg || falsch.erfolg) throw new Error('unreachable');
    expect(unbekannt.grund).toBe(falsch.grund);
  });

  it('gibt bei einem deaktivierten Konto eine eigene, klare Meldung', async () => {
    await createUser({ email: 'a@b.de', name: 'X', password: 'sicheresPasswort123', isActive: false });
    const ergebnis = await anmelden('a@b.de', 'sicheresPasswort123');
    expect(ergebnis.erfolg).toBe(false);
    if (ergebnis.erfolg) throw new Error('unreachable');
    expect(ergebnis.grund.includes('deaktiviert')).toBe(true);
  });

  it('beendet mit abmelden() die Sitzung, danach gilt sie nicht mehr', async () => {
    const einrichtung = await ersteEinrichtung({ email: 'a@b.de', name: 'X', password: 'sicheresPasswort123' });
    if (!einrichtung.erfolg) throw new Error('unreachable');
    abmelden(einrichtung.sitzungsToken);
    const befund = pruefeSitzung(einrichtung.sitzungsToken);
    expect(befund.angemeldet).toBe(false);
  });

  it('lehnt einen leeren oder erfundenen Sitzungscode ab, ohne einen Fehler zu werfen', () => {
    expect(pruefeSitzung('').angemeldet).toBe(false);
    expect(pruefeSitzung('   ').angemeldet).toBe(false);
    expect(pruefeSitzung(undefined).angemeldet).toBe(false);
    expect(pruefeSitzung(42).angemeldet).toBe(false);
    expect(pruefeSitzung('gibt-es-nicht').angemeldet).toBe(false);
  });

  it('sperrt eine bestehende Sitzung sofort aus, wenn das Konto währenddessen deaktiviert wird', async () => {
    const benutzer = await createUser({ email: 'a@b.de', name: 'X', password: 'sicheresPasswort123' });
    const anmeldung = await anmelden('a@b.de', 'sicheresPasswort123');
    if (!anmeldung.erfolg) throw new Error('unreachable');
    expect(pruefeSitzung(anmeldung.sitzungsToken).angemeldet).toBe(true);

    // Konto deaktivieren, OHNE die Sitzung selbst anzufassen — die Sperre
    // muss trotzdem sofort wirken, nicht erst nach 30 Tagen Ablauf.
    const { getLocalDb } = await import('./db/localDb');
    getLocalDb()
      .prepare('UPDATE local_users SET is_active = 0 WHERE id = ?')
      .run(benutzer.id);

    const befundNachDeaktivierung = pruefeSitzung(anmeldung.sitzungsToken);
    expect(befundNachDeaktivierung.angemeldet).toBe(false);
  });

  it('beendet nach einer Passwortänderung die bestehende Sitzung — erneute Anmeldung braucht das neue Passwort', async () => {
    const benutzer = await createUser({ email: 'a@b.de', name: 'X', password: 'altesPasswort123' });
    const anmeldung = await anmelden('a@b.de', 'altesPasswort123');
    if (!anmeldung.erfolg) throw new Error('unreachable');
    expect(pruefeSitzung(anmeldung.sitzungsToken).angemeldet).toBe(true);

    await setPassword(benutzer.id, 'neuesPasswort456');
    expect(pruefeSitzung(anmeldung.sitzungsToken).angemeldet).toBe(false);

    const alteAnmeldung = await anmelden('a@b.de', 'altesPasswort123');
    expect(alteAnmeldung.erfolg).toBe(false);
    const neueAnmeldung = await anmelden('a@b.de', 'neuesPasswort456');
    expect(neueAnmeldung.erfolg).toBe(true);
  });

  it('legt ein zweites Konto ohne Rechte an, wenn der Vorstand eines für ein weiteres Vorstandsmitglied erstellt', async () => {
    await ersteEinrichtung({ email: 'vorstand@b.de', name: 'Erika', password: 'sicheresPasswort123' });
    const zweites = await createUser({
      email: 'kassenwart@b.de',
      name: 'Klaus',
      password: 'anfangsPasswort99',
      mustChangePassword: true,
    });
    expect(zweites.permissions).toEqual(ALL_AREAS_NONE);
    expect(zweites.mustChangePassword).toBe(true);
  });

  it('meldet ausstehende Ersteinrichtung, solange kein Konto besteht, und danach nicht mehr', async () => {
    expect(istEinrichtungAusstehend()).toBe(true);
    await ersteEinrichtung({ email: 'a@b.de', name: 'X', password: 'sicheresPasswort123' });
    expect(istEinrichtungAusstehend()).toBe(false);
  });
});

describe('Passwort vergessen', () => {
  it('liefert zu einer bekannten, aktiven Adresse einen Reset-Token samt Namen und E-Mail', async () => {
    await createUser({ email: 'a@b.de', name: 'Erika', password: 'sicheresPasswort123' });
    const anfrage = passwortVergessenAnfrage('a@b.de');
    expect(anfrage).not.toBeNull();
    expect(anfrage?.name).toBe('Erika');
    expect(anfrage?.email).toBe('a@b.de');
    expect(anfrage?.token).toBeTruthy();
  });

  it('findet die Adresse unabhängig von Groß-/Kleinschreibung, wie bei der Anmeldung', async () => {
    await createUser({ email: 'a@b.de', name: 'Erika', password: 'sicheresPasswort123' });
    expect(passwortVergessenAnfrage('A@B.DE')).not.toBeNull();
  });

  it('liefert null für eine unbekannte Adresse — von außen nicht von einer bekannten unterscheidbar, da server.ts in beiden Fällen dieselbe Meldung zurückgibt', async () => {
    expect(passwortVergessenAnfrage('niemand@b.de')).toBeNull();
  });

  it('liefert null für ein deaktiviertes Konto, statt einen Reset-Token für ein gesperrtes Konto auszustellen', async () => {
    await createUser({ email: 'a@b.de', name: 'Erika', password: 'sicheresPasswort123', isActive: false });
    expect(passwortVergessenAnfrage('a@b.de')).toBeNull();
  });

  it('setzt mit einem gültigen Token ein neues Passwort, mit dem sich danach anmelden lässt — das alte Passwort funktioniert nicht mehr', async () => {
    await createUser({ email: 'a@b.de', name: 'Erika', password: 'altesPasswort123' });
    const anfrage = passwortVergessenAnfrage('a@b.de');
    if (!anfrage) throw new Error('unreachable');

    const ergebnis = await passwortZuruecksetzen(anfrage.token, 'neuesPasswort456');
    expect(ergebnis.erfolg).toBe(true);

    const alteAnmeldung = await anmelden('a@b.de', 'altesPasswort123');
    expect(alteAnmeldung.erfolg).toBe(false);
    const neueAnmeldung = await anmelden('a@b.de', 'neuesPasswort456');
    expect(neueAnmeldung.erfolg).toBe(true);
  });

  it('lehnt einen unbekannten oder erfundenen Token mit einer verständlichen Meldung ab', async () => {
    const ergebnis = await passwortZuruecksetzen('gibt-es-nicht', 'neuesPasswort456');
    expect(ergebnis.erfolg).toBe(false);
    expect(ergebnis.grund).toBeTruthy();
  });

  it('lässt einen Token nach erfolgreichem Zurücksetzen kein zweites Mal zu — ein zweiter Versuch mit demselben Link schlägt fehl', async () => {
    await createUser({ email: 'a@b.de', name: 'Erika', password: 'altesPasswort123' });
    const anfrage = passwortVergessenAnfrage('a@b.de');
    if (!anfrage) throw new Error('unreachable');

    const erster = await passwortZuruecksetzen(anfrage.token, 'neuesPasswort456');
    expect(erster.erfolg).toBe(true);

    const zweiter = await passwortZuruecksetzen(anfrage.token, 'nochEinPasswort789');
    expect(zweiter.erfolg).toBe(false);
  });

  it('verbraucht den Token NICHT, wenn das neue Passwort abgelehnt wird — der Link bleibt für einen weiteren Versuch gültig', async () => {
    await createUser({ email: 'a@b.de', name: 'Erika', password: 'altesPasswort123' });
    const anfrage = passwortVergessenAnfrage('a@b.de');
    if (!anfrage) throw new Error('unreachable');

    // Ein zu kurzes/schwaches Passwort lässt setPassword() intern
    // fehlschlagen (BenutzerAnlegenFehler) — das darf den Link nicht
    // verbrauchen, siehe der Kommentar dazu in localPasswordResets.ts.
    const fehlgeschlagen = await passwortZuruecksetzen(anfrage.token, 'x');
    expect(fehlgeschlagen.erfolg).toBe(false);

    const zweiterVersuch = await passwortZuruecksetzen(anfrage.token, 'diesmalSicheres123');
    expect(zweiterVersuch.erfolg).toBe(true);
  });

  it('meldet ein neues Zurücksetzen an, während ein älterer noch nicht eingelöster Link desselben Kontos dadurch entwertet wird', async () => {
    await createUser({ email: 'a@b.de', name: 'Erika', password: 'altesPasswort123' });
    const ersteAnfrage = passwortVergessenAnfrage('a@b.de');
    const zweiteAnfrage = passwortVergessenAnfrage('a@b.de');
    if (!ersteAnfrage || !zweiteAnfrage) throw new Error('unreachable');

    const mitAltemLink = await passwortZuruecksetzen(ersteAnfrage.token, 'neuesPasswort456');
    expect(mitAltemLink.erfolg).toBe(false);

    const mitNeuemLink = await passwortZuruecksetzen(zweiteAnfrage.token, 'neuesPasswort456');
    expect(mitNeuemLink.erfolg).toBe(true);
  });
});
