import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';

/**
 * Route-Tests gegen die tatsächlichen /api/local-server/auth-Endpunkte in
 * server.ts (Betriebsart "gehostet") — anders als localAuth.test.ts, das
 * die einzelnen Bausteine (ersteEinrichtung(), anmelden(), …) direkt
 * aufruft, geht diese Datei hier über echte HTTP-Aufrufe (supertest) durch
 * dieselbe Kette, die auch ein Aufruf von außen durchläuft: Ratenbegrenzung
 * → Zugriffsschutz → Express-Body-Parsing → erst dann die Route selbst.
 *
 * Warum das eine eigene Datei braucht, obwohl es localAuth.test.ts schon
 * gibt: Ein früherer, teuer gelernter Fehler (upsert statt insert beim
 * öffentlichen Aufnahmeformular) blieb lange unentdeckt, weil der damalige
 * Test einen sauber nachgebauten Aufruf geschickt hat statt den echten Weg
 * zu nehmen, den die Anwendung tatsächlich geht. Diese Datei hier nimmt
 * bewusst den echten Weg — inklusive der Ratenbegrenzung und des
 * Zugriffsschutzes, die localAuth.test.ts naturgemäß gar nicht sieht, weil
 * beide ausschließlich in server.ts sitzen.
 *
 * server.ts startet normalerweise unbedingt einen echten Server
 * (startServer() am Dateiende, siehe der Kommentar dort) — hier wird das
 * über VM_TEST_NO_LISTEN unterdrückt. Jeder einzelne Test importiert
 * server.ts frisch (vi.resetModules()): Der Zugriffsschlüssel, die
 * Ratenbegrenzer und die Datenbankverbindung werden beim Laden der Datei
 * einmalig angelegt und blieben sonst über Testfälle hinweg bestehen — mit
 * der Folge, dass z. B. fünf Aufrufe von "Passwort vergessen" in einem
 * früheren Test die Ratenbegrenzung für einen späteren, eigentlich
 * unabhängigen Test schon verbraucht hätten.
 */

const TEST_ZUGRIFFSSCHLUESSEL = 'e2e-test-zugriffsschluessel-0123456789abcdef';

let verzeichnis: string;
let alterDataDir: string | undefined;
let alterAccessKey: string | undefined;
// "any": Der genaue Typ von "app" entsteht erst durch den dynamischen
// Import zur Laufzeit (siehe Dateikopf, warum server.ts hier nicht statisch
// importiert wird) — @typescript-eslint/no-explicit-any ist projektweit
// ohnehin abgeschaltet (eslint.config.js).
let app: any;
let schliesseDb: () => void;

beforeEach(async () => {
  alterDataDir = process.env.VM_DATA_DIR;
  alterAccessKey = process.env.VM_ACCESS_KEY;
  verzeichnis = fs.mkdtempSync(path.join(os.tmpdir(), 'vm-serverroutes-test-'));
  process.env.VM_DATA_DIR = verzeichnis;
  // Fester, bekannter Schlüssel statt eines gewürfelten — VM_ACCESS_KEY hat
  // Vorrang vor einem in der Konfigurationsdatei abgelegten (siehe
  // readAccessKey() in instanceConfig.ts), unabhängig vom frischen
  // VM_DATA_DIR oben.
  process.env.VM_ACCESS_KEY = TEST_ZUGRIFFSSCHLUESSEL;
  process.env.VM_TEST_NO_LISTEN = '1';

  vi.resetModules();
  const serverModul: any = await import('../../server');
  app = serverModul.app;
  const dbModul = await import('./db/localDb');
  schliesseDb = dbModul.closeLocalDbForTests;
});

afterEach(() => {
  schliesseDb();
  fs.rmSync(verzeichnis, { recursive: true, force: true });
  if (alterDataDir === undefined) delete process.env.VM_DATA_DIR;
  else process.env.VM_DATA_DIR = alterDataDir;
  if (alterAccessKey === undefined) delete process.env.VM_ACCESS_KEY;
  else process.env.VM_ACCESS_KEY = alterAccessKey;
  delete process.env.VM_TEST_NO_LISTEN;
});

/** Richtet über den echten Endpunkt das erste Konto ein und liefert dessen Sitzungstoken. */
async function richteEinrichtungEin(
  email = 'a@b.de',
  passwort = 'sicheresPasswort123'
): Promise<string> {
  const antwort = await request(app)
    .post('/api/local-server/auth/setup')
    .set('x-vm-zugriff', TEST_ZUGRIFFSSCHLUESSEL)
    .send({ email, name: 'Erika Musterfrau', password: passwort });
  expect(antwort.status).toBe(201);
  return antwort.body.sessionToken;
}

describe('Zugriffsschutz (gilt für alle /api-Routen)', () => {
  it('lehnt einen Aufruf ohne Zugriffsschlüssel mit 401 und dem erwarteten Fehlercode ab', async () => {
    const antwort = await request(app).get('/api/local-server/auth/status');
    expect(antwort.status).toBe(401);
    expect(antwort.body.code).toBe('ZUGRIFF_VERWEIGERT');
  });

  it('lehnt einen falschen Zugriffsschlüssel genauso ab wie einen fehlenden', async () => {
    const antwort = await request(app)
      .get('/api/local-server/auth/status')
      .set('x-vm-zugriff', 'ein-falscher-schluessel');
    expect(antwort.status).toBe(401);
    expect(antwort.body.code).toBe('ZUGRIFF_VERWEIGERT');
  });

  it('lässt einen Aufruf mit dem richtigen Zugriffsschlüssel durch', async () => {
    const antwort = await request(app)
      .get('/api/local-server/auth/status')
      .set('x-vm-zugriff', TEST_ZUGRIFFSSCHLUESSEL);
    expect(antwort.status).toBe(200);
    expect(antwort.body.setupPending).toBe(true);
  });

  it('lässt die Statusseite /api/health ohne Zugriffsschlüssel durch (Docker fragt sie ohne Ausweis ab)', async () => {
    const antwort = await request(app).get('/api/health');
    expect(antwort.status).toBe(200);
    expect(antwort.body.status).toBe('ok');
  });
});

describe('Ersteinrichtung und Anmeldung über die echten Routen', () => {
  it('richtet über POST .../auth/setup das erste Konto ein, meldet es gleich an, und die Sitzung trägt tatsächlich', async () => {
    const sessionToken = await richteEinrichtungEin();
    expect(sessionToken).toBeTruthy();

    const me = await request(app)
      .get('/api/local-server/auth/me')
      .set('x-vm-zugriff', TEST_ZUGRIFFSSCHLUESSEL)
      .set('x-vm-sitzung', sessionToken);
    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe('a@b.de');
  });

  it('lehnt eine zweite Ersteinrichtung ab, sobald bereits ein Konto besteht', async () => {
    await richteEinrichtungEin();
    const zweite = await request(app)
      .post('/api/local-server/auth/setup')
      .set('x-vm-zugriff', TEST_ZUGRIFFSSCHLUESSEL)
      .send({ email: 'c@d.de', name: 'Y', password: 'nochEinPasswort123' });
    expect(zweite.status).toBe(400);
  });

  it('meldet mit richtigen Zugangsdaten an', async () => {
    await richteEinrichtungEin('a@b.de', 'sicheresPasswort123');
    const login = await request(app)
      .post('/api/local-server/auth/login')
      .set('x-vm-zugriff', TEST_ZUGRIFFSSCHLUESSEL)
      .send({ email: 'a@b.de', password: 'sicheresPasswort123' });
    expect(login.status).toBe(200);
    expect(login.body.sessionToken).toBeTruthy();
  });

  it('lehnt ein falsches Passwort mit 401 ab', async () => {
    await richteEinrichtungEin('a@b.de', 'sicheresPasswort123');
    const login = await request(app)
      .post('/api/local-server/auth/login')
      .set('x-vm-zugriff', TEST_ZUGRIFFSSCHLUESSEL)
      .send({ email: 'a@b.de', password: 'falsch' });
    expect(login.status).toBe(401);
  });

  it('lehnt eine Anmeldung ohne Angaben mit 400 statt einem Serverfehler ab', async () => {
    const login = await request(app)
      .post('/api/local-server/auth/login')
      .set('x-vm-zugriff', TEST_ZUGRIFFSSCHLUESSEL)
      .send({ email: 'a@b.de' });
    expect(login.status).toBe(400);
  });

  it('lehnt GET .../auth/me ohne Sitzungstoken ab', async () => {
    const me = await request(app)
      .get('/api/local-server/auth/me')
      .set('x-vm-zugriff', TEST_ZUGRIFFSSCHLUESSEL);
    expect(me.status).toBe(401);
    expect(me.body.code).toBe('ANMELDUNG_ERFORDERLICH');
  });
});

describe('"Passwort vergessen" über die echten Routen', () => {
  it('meldet KEIN_EMAIL_VERSAND für jede Adresse — dieser Server kann keine E-Mails mehr verschicken', async () => {
    await richteEinrichtungEin();
    const antwort = await request(app)
      .post('/api/local-server/auth/request-password-reset')
      .set('x-vm-zugriff', TEST_ZUGRIFFSSCHLUESSEL)
      .send({ email: 'a@b.de' });
    expect(antwort.status).toBe(400);
    expect(antwort.body.code).toBe('KEIN_EMAIL_VERSAND');
  });

  it('antwortet für eine unbekannte Adresse genauso wie für eine bekannte', async () => {
    await richteEinrichtungEin('a@b.de', 'sicheresPasswort123');

    const bekannt = await request(app)
      .post('/api/local-server/auth/request-password-reset')
      .set('x-vm-zugriff', TEST_ZUGRIFFSSCHLUESSEL)
      .send({ email: 'a@b.de' });
    const unbekannt = await request(app)
      .post('/api/local-server/auth/request-password-reset')
      .set('x-vm-zugriff', TEST_ZUGRIFFSSCHLUESSEL)
      .send({ email: 'niemand@b.de' });

    expect(bekannt.status).toBe(unbekannt.status);
    expect(bekannt.body.code).toBe(unbekannt.body.code);
  });

  it('lehnt einen unbekannten Reset-Token über die echte Route mit 400 ab', async () => {
    const antwort = await request(app)
      .post('/api/local-server/auth/reset-password')
      .set('x-vm-zugriff', TEST_ZUGRIFFSSCHLUESSEL)
      .send({ token: 'gibt-es-nicht', newPassword: 'neuesPasswort456' });
    expect(antwort.status).toBe(400);
  });

  it('bremst nach fünf Aufrufen je Stunde — bremsePasswortReset gilt gemeinsam für beide Reset-Routen', async () => {
    for (let i = 0; i < 5; i++) {
      const antwort = await request(app)
        .post('/api/local-server/auth/request-password-reset')
        .set('x-vm-zugriff', TEST_ZUGRIFFSSCHLUESSEL)
        .send({ email: 'niemand@b.de' });
      expect(antwort.status).toBe(400);
    }
    const sechster = await request(app)
      .post('/api/local-server/auth/request-password-reset')
      .set('x-vm-zugriff', TEST_ZUGRIFFSSCHLUESSEL)
      .send({ email: 'niemand@b.de' });
    expect(sechster.status).toBe(429);
  });
});
