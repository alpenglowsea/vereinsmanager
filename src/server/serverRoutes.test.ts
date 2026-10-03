import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';

/**
 * Route-Tests gegen die echten /api-Routen in server.ts — anders als
 * apiAuth.test.ts, das die einzelnen Bausteine (schluesselStimmt(),
 * pruefeZugriff(), …) direkt aufruft, geht diese Datei hier über echte
 * HTTP-Aufrufe (supertest) durch dieselbe Kette, die auch ein Aufruf von
 * außen durchläuft: Ratenbegrenzung → Zugriffsschutz → Express-Body-Parsing
 * → erst dann die Route selbst.
 *
 * Warum das eine eigene Datei braucht, obwohl es apiAuth.test.ts schon gibt:
 * Ein früherer, teuer gelernter Fehler (upsert statt insert beim
 * öffentlichen Aufnahmeformular) blieb lange unentdeckt, weil der damalige
 * Test einen sauber nachgebauten Aufruf geschickt hat statt den echten Weg
 * zu nehmen, den die Anwendung tatsächlich geht. Diese Datei hier nimmt
 * bewusst den echten Weg — inklusive der Ratenbegrenzung, die
 * apiAuth.test.ts naturgemäß gar nicht sieht, weil die ausschließlich in
 * server.ts sitzt.
 *
 * Bis einschliesslich Schritt 3 der Vereinfachung testete diese Datei
 * zusätzlich die Routen des eigenen Server-Betriebs (Betriebsart 3:
 * Ersteinrichtung, Anmeldung, Passwort-Zurücksetzen über eine eigene
 * SQLite-Datenbank). Mit der Entfernung dieser Betriebsart ist davon nichts
 * mehr übrig — die Zugriffsschutz-Tests unten zielen seither auf
 * /api/access-check, eine genauso generische, geschützte Route.
 *
 * server.ts startet normalerweise unbedingt einen echten Server
 * (startServer() am Dateiende, siehe der Kommentar dort) — hier wird das
 * über VM_TEST_NO_LISTEN unterdrückt. Jeder einzelne Test importiert
 * server.ts frisch (vi.resetModules()): Der Zugriffsschlüssel und die
 * Ratenbegrenzer werden beim Laden der Datei einmalig angelegt und blieben
 * sonst über Testfälle hinweg bestehen.
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
});

afterEach(() => {
  fs.rmSync(verzeichnis, { recursive: true, force: true });
  if (alterDataDir === undefined) delete process.env.VM_DATA_DIR;
  else process.env.VM_DATA_DIR = alterDataDir;
  if (alterAccessKey === undefined) delete process.env.VM_ACCESS_KEY;
  else process.env.VM_ACCESS_KEY = alterAccessKey;
  delete process.env.VM_TEST_NO_LISTEN;
});

describe('Zugriffsschutz (gilt für alle /api-Routen)', () => {
  it('lehnt einen Aufruf ohne Zugriffsschlüssel mit 401 und dem erwarteten Fehlercode ab', async () => {
    const antwort = await request(app).get('/api/access-check');
    expect(antwort.status).toBe(401);
    expect(antwort.body.code).toBe('ZUGRIFF_VERWEIGERT');
  });

  it('lehnt einen falschen Zugriffsschlüssel genauso ab wie einen fehlenden', async () => {
    const antwort = await request(app)
      .get('/api/access-check')
      .set('x-vm-zugriff', 'ein-falscher-schluessel');
    expect(antwort.status).toBe(401);
    expect(antwort.body.code).toBe('ZUGRIFF_VERWEIGERT');
  });

  it('lässt einen Aufruf mit dem richtigen Zugriffsschlüssel durch', async () => {
    const antwort = await request(app)
      .get('/api/access-check')
      .set('x-vm-zugriff', TEST_ZUGRIFFSSCHLUESSEL);
    expect(antwort.status).toBe(200);
    expect(antwort.body.success).toBe(true);
  });

});
