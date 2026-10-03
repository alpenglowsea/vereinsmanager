import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { readAccessKey } from './instanceConfig';

/**
 * Jeder Test bekommt ein eigenes Wegwerf-Verzeichnis. Die Modulfunktionen
 * lesen VM_DATA_DIR bei jedem Aufruf neu, deshalb genuegt das Setzen der
 * Umgebungsvariablen — es braucht keine Attrappen.
 */
let verzeichnis: string;
let alterDataDir: string | undefined;

beforeEach(() => {
  alterDataDir = process.env.VM_DATA_DIR;
  verzeichnis = fs.mkdtempSync(path.join(os.tmpdir(), 'vm-test-'));
  process.env.VM_DATA_DIR = verzeichnis;
});

afterEach(() => {
  fs.rmSync(verzeichnis, { recursive: true, force: true });
  if (alterDataDir === undefined) delete process.env.VM_DATA_DIR;
  else process.env.VM_DATA_DIR = alterDataDir;
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

  it('kommt mit einer beschaedigten Konfigurationsdatei zurecht', () => {
    // Lieber einen neuen Schluessel erzeugen als den Serverstart verhindern.
    fs.writeFileSync(path.join(verzeichnis, 'konfiguration.json'), '{ das ist kein JSON');

    const meldung = vi.spyOn(console, 'error').mockImplementation(() => {});
    const info = readAccessKey();
    expect(info.key).toMatch(/^[0-9a-f]{32}$/);
    expect(meldung).toHaveBeenCalled();
    meldung.mockRestore();
  });
});

