import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  readSmtpConfigPublic,
  readSmtpCredentials,
  writeSmtpConfig,
  deleteSmtpConfig,
  readAccessKey,
  readAiConfigPublic,
  readAiCredentials,
  writeAiConfig,
  deleteAiConfig,
} from './instanceConfig';

/**
 * Jeder Test bekommt ein eigenes Wegwerf-Verzeichnis. Die Modulfunktionen
 * lesen VM_DATA_DIR bei jedem Aufruf neu, deshalb genuegt das Setzen der
 * Umgebungsvariablen — es braucht keine Attrappen.
 */
let verzeichnis: string;
let alteWerte: { dataDir?: string; secretKey?: string };

/**
 * Die Schluessel der KI-Anbieter duerfen aus der Umgebung kommen. Waere auf dem
 * Rechner, der die Tests ausfuehrt, zufaellig einer gesetzt, faenden die Tests
 * ihn vor und schluegen fehl. Deshalb werden sie fuer die Dauer der Tests
 * beiseitegelegt und danach zurueckgestellt.
 */
const KI_UMGEBUNG = ['MISTRAL_API_KEY', 'GEMINI_API_KEY'] as const;
let alteKiUmgebung: Record<string, string | undefined> = {};

const BEISPIEL = {
  host: 'smtp.ionos.de',
  port: 587,
  secure: false,
  user: 'vorstand@tsv-musterstadt1890.de',
  fromEmail: 'vorstand@tsv-musterstadt1890.de',
  fromName: 'TSV Musterstadt 1890 e.V.',
};

beforeEach(() => {
  alteWerte = { dataDir: process.env.VM_DATA_DIR, secretKey: process.env.VM_SECRET_KEY };
  verzeichnis = fs.mkdtempSync(path.join(os.tmpdir(), 'vm-test-'));
  process.env.VM_DATA_DIR = verzeichnis;
  delete process.env.VM_SECRET_KEY;

  alteKiUmgebung = {};
  for (const name of KI_UMGEBUNG) {
    alteKiUmgebung[name] = process.env[name];
    delete process.env[name];
  }
});

afterEach(() => {
  fs.rmSync(verzeichnis, { recursive: true, force: true });
  for (const name of KI_UMGEBUNG) {
    if (alteKiUmgebung[name] === undefined) delete process.env[name];
    else process.env[name] = alteKiUmgebung[name];
  }
  if (alteWerte.dataDir === undefined) delete process.env.VM_DATA_DIR;
  else process.env.VM_DATA_DIR = alteWerte.dataDir;
  if (alteWerte.secretKey === undefined) delete process.env.VM_SECRET_KEY;
  else process.env.VM_SECRET_KEY = alteWerte.secretKey;
});

describe('Serverkonfiguration: SMTP-Zugangsdaten', () => {
  it('meldet eine frische Installation als nicht eingerichtet', () => {
    const konfiguration = readSmtpConfigPublic();
    expect(konfiguration.configured).toBe(false);
    expect(konfiguration.hasPassword).toBe(false);
    expect(readSmtpCredentials()).toBeNull();
  });

  it('gibt gespeicherte Zugangsdaten unveraendert zurueck', () => {
    writeSmtpConfig({ ...BEISPIEL, password: 'geheim123' });

    const zugangsdaten = readSmtpCredentials();
    expect(zugangsdaten).not.toBeNull();
    expect(zugangsdaten!.host).toBe('smtp.ionos.de');
    expect(zugangsdaten!.port).toBe(587);
    expect(zugangsdaten!.password).toBe('geheim123');
  });

  it('legt das Passwort nicht im Klartext auf die Platte', () => {
    // Der eigentliche Zweck der ganzen Uebung. Faellt dieser Test, ist das
    // Passwort wieder lesbar — dann ist nichts gewonnen.
    writeSmtpConfig({ ...BEISPIEL, password: 'streng-geheim-42' });

    const roh = fs.readFileSync(path.join(verzeichnis, 'konfiguration.json'), 'utf8');
    expect(roh).not.toContain('streng-geheim-42');
    expect(roh).toContain('smtp.ionos.de'); // Hostname darf lesbar bleiben
  });

  it('haelt das Passwort nicht in der oeffentlichen Auskunft', () => {
    // Diese Antwort geht an den Browser. Steht das Passwort darin, war die
    // ganze Verlagerung umsonst.
    writeSmtpConfig({ ...BEISPIEL, password: 'streng-geheim-42' });

    const oeffentlich = readSmtpConfigPublic();
    expect(JSON.stringify(oeffentlich)).not.toContain('streng-geheim-42');
    expect(oeffentlich.hasPassword).toBe(true);
    expect(oeffentlich.configured).toBe(true);
  });

  it('behaelt das Passwort, wenn nur andere Felder geaendert werden', () => {
    // Der Alltagsfall: Jemand aendert den Absendernamen. Die Oberflaeche kennt
    // das Passwort nicht und kann es deshalb nicht mitschicken.
    writeSmtpConfig({ ...BEISPIEL, password: 'geheim123' });
    writeSmtpConfig({ ...BEISPIEL, fromName: 'Neuer Name' });

    const zugangsdaten = readSmtpCredentials();
    expect(zugangsdaten!.password).toBe('geheim123');
    expect(zugangsdaten!.fromName).toBe('Neuer Name');
  });

  it('entfernt das Passwort bei leerer Angabe', () => {
    writeSmtpConfig({ ...BEISPIEL, password: 'geheim123' });
    const danach = writeSmtpConfig({ ...BEISPIEL, password: '' });

    expect(danach.hasPassword).toBe(false);
    expect(readSmtpCredentials()!.password).toBe('');
    expect(readSmtpCredentials()!.host).toBe('smtp.ionos.de');
  });

  it('loescht auf Wunsch die gesamten Zugangsdaten', () => {
    writeSmtpConfig({ ...BEISPIEL, password: 'geheim123' });
    const danach = deleteSmtpConfig();

    expect(danach.configured).toBe(false);
    expect(readSmtpCredentials()).toBeNull();
    const roh = fs.readFileSync(path.join(verzeichnis, 'konfiguration.json'), 'utf8');
    expect(roh).not.toContain('smtp.ionos.de');
  });

  it('meldet ein unlesbares Passwort als nicht vorhanden', () => {
    // Fall aus der Praxis: Der Ordner wurde umgezogen, die Schluesseldatei
    // blieb zurueck. Dann muss die App "kein Passwort hinterlegt" melden und
    // zur Neueingabe auffordern — und nicht mit einem Fehler stehenbleiben.
    writeSmtpConfig({ ...BEISPIEL, password: 'geheim123' });
    fs.writeFileSync(path.join(verzeichnis, 'schluessel.key'), 'a'.repeat(64));

    // Die Warnung des Moduls ist hier erwuenscht und wird nur stummgeschaltet,
    // damit sie beim Testlauf nicht wie ein echter Fehler aussieht.
    const warnung = vi.spyOn(console, 'warn').mockImplementation(() => {});

    expect(readSmtpConfigPublic().hasPassword).toBe(false);
    expect(readSmtpConfigPublic().configured).toBe(true);
    expect(readSmtpCredentials()!.password).toBe('');

    expect(warnung).toHaveBeenCalled();
    warnung.mockRestore();
  });

  it('verweigert einen unbrauchbaren Schluessel, statt einen neuen zu erfinden', () => {
    // Ein stillschweigend neu erzeugter Schluessel wuerde ein vielleicht noch
    // rettbares Passwort endgueltig unlesbar machen.
    writeSmtpConfig({ ...BEISPIEL, password: 'geheim123' });
    fs.writeFileSync(path.join(verzeichnis, 'schluessel.key'), 'kein gueltiger schluessel');

    expect(() => writeSmtpConfig({ ...BEISPIEL, password: 'neu' })).toThrow(/Schl/);
  });

  it('nimmt den Schluessel aus der Umgebung, wenn einer gesetzt ist', () => {
    process.env.VM_SECRET_KEY = 'b'.repeat(64);
    writeSmtpConfig({ ...BEISPIEL, password: 'geheim123' });

    expect(fs.existsSync(path.join(verzeichnis, 'schluessel.key'))).toBe(false);
    expect(readSmtpCredentials()!.password).toBe('geheim123');
  });

  it('weist einen falsch geformten Schluessel aus der Umgebung ab', () => {
    process.env.VM_SECRET_KEY = 'zu-kurz';
    expect(() => writeSmtpConfig({ ...BEISPIEL, password: 'geheim123' })).toThrow(/VM_SECRET_KEY/);
  });

  it('erzeugt fuer jeden Vorgang einen neuen Zufallswert', () => {
    // Zweimal dasselbe Passwort darf auf der Platte nicht gleich aussehen —
    // sonst liesse sich allein am Vergleich zweier Installationen ablesen,
    // dass dasselbe Passwort verwendet wird.
    writeSmtpConfig({ ...BEISPIEL, password: 'immergleich' });
    const ersterStand = fs.readFileSync(path.join(verzeichnis, 'konfiguration.json'), 'utf8');
    writeSmtpConfig({ ...BEISPIEL, password: 'immergleich' });
    const zweiterStand = fs.readFileSync(path.join(verzeichnis, 'konfiguration.json'), 'utf8');

    expect(ersterStand).not.toBe(zweiterStand);
  });

  it('legt Dateien an, die nur der Besitzer lesen darf', () => {
    if (process.platform === 'win32') return; // Windows kennt diese Rechte nicht
    writeSmtpConfig({ ...BEISPIEL, password: 'geheim123' });

    const rechte = (datei: string) =>
      (fs.statSync(path.join(verzeichnis, datei)).mode & 0o777).toString(8);
    expect(rechte('konfiguration.json')).toBe('600');
    expect(rechte('schluessel.key')).toBe('600');
  });

  it('kommt mit einer beschaedigten Konfigurationsdatei zurecht', () => {
    // Lieber "nicht eingerichtet" melden als den Serverstart verhindern.
    fs.writeFileSync(path.join(verzeichnis, 'konfiguration.json'), '{ das ist kein JSON');

    // Auch hier gehoert die Meldung zum erwarteten Verhalten.
    const meldung = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(readSmtpConfigPublic().configured).toBe(false);
    expect(readSmtpCredentials()).toBeNull();

    expect(meldung).toHaveBeenCalled();
    meldung.mockRestore();
  });
});

describe('Serverkonfiguration: Zugriffsschluessel', () => {
  const alterZugriff = process.env.VM_ACCESS_KEY;

  beforeEach(() => {
    delete process.env.VM_ACCESS_KEY;
  });

  afterEach(() => {
    if (alterZugriff === undefined) delete process.env.VM_ACCESS_KEY;
    else process.env.VM_ACCESS_KEY = alterZugriff;
  });

  it('erzeugt beim ersten Aufruf einen und merkt ihn sich', () => {
    const erster = readAccessKey();
    expect(erster.neuErzeugt).toBe(true);
    expect(erster.quelle).toBe('datei');
    expect(erster.key).toMatch(/^[0-9a-f]{32}$/);

    const zweiter = readAccessKey();
    expect(zweiter.key).toBe(erster.key);
    expect(zweiter.neuErzeugt).toBe(false);
  });

  it('nimmt einen vorgegebenen Schluessel aus der Umgebung', () => {
    process.env.VM_ACCESS_KEY = 'mein-eigener-schluessel-mit-laenge';
    const info = readAccessKey();
    expect(info.key).toBe('mein-eigener-schluessel-mit-laenge');
    expect(info.quelle).toBe('umgebung');
    // Aus der Umgebung heisst: nichts wird gespeichert.
    expect(fs.existsSync(path.join(verzeichnis, 'konfiguration.json'))).toBe(false);
  });

  it('warnt bei einem sehr kurzen Schluessel aus der Umgebung', () => {
    process.env.VM_ACCESS_KEY = 'kurz';
    const warnung = vi.spyOn(console, 'warn').mockImplementation(() => {});
    readAccessKey();
    expect(warnung).toHaveBeenCalled();
    warnung.mockRestore();
  });

  it('ueberlebt das Speichern und Loeschen der SMTP-Zugangsdaten', () => {
    // Beides schreibt dieselbe Datei. Ginge der Schluessel dabei verloren,
    // sperrte sich der Verein beim naechsten Neustart selbst aus.
    const vorher = readAccessKey().key;
    writeSmtpConfig({ ...BEISPIEL, password: 'geheim123' });
    expect(readAccessKey().key).toBe(vorher);
    deleteSmtpConfig();
    expect(readAccessKey().key).toBe(vorher);
  });
});

describe('Serverkonfiguration: KI-Zugangsdaten', () => {
  it('meldet eine frische Installation als nicht eingerichtet', () => {
    const konfiguration = readAiConfigPublic();
    expect(konfiguration.configured).toBe(false);
    expect(konfiguration.hasApiKey).toBe(false);
    expect(konfiguration.provider).toBe('mistral');
    expect(konfiguration.schluesselQuelle).toBe('keine');
    expect(readAiCredentials()).toBeNull();
  });

  it('legt den Schluessel verschluesselt ab — kein Klartext in der Datei', () => {
    // Der eigentliche Zweck der ganzen Uebung. Schluege dieser Test fehl,
    // waere alles Uebrige wertlos.
    writeAiConfig({ provider: 'mistral', apiKey: 'streng-geheim-123', model: 'mistral-small-latest' });

    const roh = fs.readFileSync(path.join(verzeichnis, 'konfiguration.json'), 'utf8');
    expect(roh).not.toContain('streng-geheim-123');
    expect(roh).toContain('apiKeyEncrypted');
  });

  it('gibt gespeicherte Zugangsdaten serverintern unveraendert zurueck', () => {
    writeAiConfig({ provider: 'mistral', apiKey: 'streng-geheim-123', model: 'mistral-small-latest' });

    const zugang = readAiCredentials();
    expect(zugang).not.toBeNull();
    expect(zugang!.apiKey).toBe('streng-geheim-123');
    expect(zugang!.provider).toBe('mistral');
    expect(zugang!.model).toBe('mistral-small-latest');
    expect(zugang!.quelle).toBe('konfiguration');
  });

  it('gibt den Schluessel nie an die Oberflaeche heraus', () => {
    const oeffentlich = writeAiConfig({ provider: 'gemini', apiKey: 'AIza-geheim' });
    expect(oeffentlich.hasApiKey).toBe(true);
    expect(oeffentlich.configured).toBe(true);
    expect(JSON.stringify(oeffentlich)).not.toContain('AIza-geheim');
    expect(JSON.stringify(readAiConfigPublic())).not.toContain('AIza-geheim');
  });

  it('laesst den Schluessel stehen, wenn nur das Modell gewechselt wird', () => {
    writeAiConfig({ provider: 'gemini', apiKey: 'bleibt-erhalten' });
    writeAiConfig({ provider: 'gemini', model: 'gemini-2.0-flash' });

    expect(readAiCredentials()!.apiKey).toBe('bleibt-erhalten');
    expect(readAiCredentials()!.model).toBe('gemini-2.0-flash');
  });

  it('entfernt den Schluessel bei leerer Eingabe', () => {
    writeAiConfig({ provider: 'gemini', apiKey: 'weg-damit' });
    writeAiConfig({ provider: 'gemini', apiKey: '' });

    expect(readAiConfigPublic().hasApiKey).toBe(false);
    expect(readAiCredentials()).toBeNull();
  });

  it('nimmt den Schluessel aus der Umgebung, wenn keiner hinterlegt ist', () => {
    // Der Weg fuer den Docker-Betrieb: Der Schluessel steht dann in der
    // Compose-Datei und landet ebenfalls in keiner Datensicherung.
    process.env.MISTRAL_API_KEY = 'aus-der-umgebung';

    const zugang = readAiCredentials();
    expect(zugang!.apiKey).toBe('aus-der-umgebung');
    expect(zugang!.quelle).toBe('umgebung');
    expect(readAiConfigPublic().schluesselQuelle).toBe('umgebung');
  });

  it('gibt dem hinterlegten Schluessel den Vorrang vor der Umgebung', () => {
    process.env.MISTRAL_API_KEY = 'aus-der-umgebung';
    writeAiConfig({ provider: 'mistral', apiKey: 'aus-der-datei' });

    expect(readAiCredentials()!.apiKey).toBe('aus-der-datei');
    expect(readAiConfigPublic().schluesselQuelle).toBe('konfiguration');
  });

  it('behaelt beim Loeschen einen Schluessel aus der Umgebung', () => {
    writeAiConfig({ provider: 'mistral', apiKey: 'weg-damit' });
    process.env.MISTRAL_API_KEY = 'umgebung-bleibt';

    const danach = deleteAiConfig();
    expect(danach.hasApiKey).toBe(true);
    expect(danach.schluesselQuelle).toBe('umgebung');

    const roh = fs.readFileSync(path.join(verzeichnis, 'konfiguration.json'), 'utf8');
    expect(roh).not.toContain('weg-damit');
  });

  it('ueberlebt das Speichern der SMTP-Zugangsdaten und umgekehrt', () => {
    // Beide Abschnitte liegen in derselben Datei. Wird beim Einlesen ein Feld
    // vergessen, faellt es beim naechsten Schreiben still unter den Tisch —
    // genau dieser Fehler ist uns bei accessKey schon einmal unterlaufen.
    writeAiConfig({ provider: 'mistral', apiKey: 'ki-schluessel' });
    writeSmtpConfig({ ...BEISPIEL, password: 'mail-passwort' });

    expect(readAiCredentials()!.apiKey).toBe('ki-schluessel');
    expect(readSmtpCredentials()!.password).toBe('mail-passwort');

    const zugriff = readAccessKey().key;
    writeAiConfig({ provider: 'mistral', model: 'mistral-large-latest' });
    expect(readAccessKey().key).toBe(zugriff);
    expect(readSmtpCredentials()!.password).toBe('mail-passwort');
  });

  it('gilt als nicht hinterlegt, wenn die Schluesseldatei ausgetauscht wurde', () => {
    writeAiConfig({ provider: 'gemini', apiKey: 'unlesbar-machen' });
    fs.writeFileSync(path.join(verzeichnis, 'schluessel.key'), 'a'.repeat(64));

    const warnung = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(readAiConfigPublic().hasApiKey).toBe(false);
    expect(readAiCredentials()).toBeNull();
    warnung.mockRestore();
  });
});
