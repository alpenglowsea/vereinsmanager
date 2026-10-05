import { describe, it, expect, afterEach } from 'vitest';
import {
  MIN_PASSWORD_LENGTH,
  checkPasswordStrength,
  hashPassword,
  verifyPassword
} from './passwordService';

/**
 * Prüfwerte, die mit einer unabhängigen Umsetzung (Node crypto.pbkdf2Sync)
 * erzeugt wurden. Sie sichern ab, dass unsere Rechnung dem Standard folgt und
 * nicht nur mit sich selbst übereinstimmt — ein Fehler, der sonst erst
 * auffiele, wenn niemand sich mehr anmelden kann.
 */
const REFERENZWERTE: { passwort: string; salzText: string; runden: number; erwartet: string }[] = [
  {
    passwort: 'passwort123',
    salzText: 'salzsalzsalzsalz',
    runden: 1,
    erwartet: 'Hzu56qhmAsEebf2jBH6Ly0db+JIr1PTzLyYoGwgMw0Y='
  },
  {
    passwort: 'passwort123',
    salzText: 'salzsalzsalzsalz',
    runden: 1000,
    erwartet: 'DXMYhBnrgQloS8G6x/tM12T7v+I1HFBRCf0sMMAEMp0='
  }
];

const alsBase64 = (text: string): string =>
  btoa(String.fromCharCode(...new TextEncoder().encode(text)));

describe('Passwortprüfwerte', () => {
  it('bestätigt das richtige Passwort', async () => {
    const gespeichert = await hashPassword('Vereinskasse2026');
    expect(await verifyPassword('Vereinskasse2026', gespeichert)).toBe(true);
  });

  it('lehnt falsche Passwörter ab', async () => {
    const gespeichert = await hashPassword('Vereinskasse2026');
    expect(await verifyPassword('vereinskasse2026', gespeichert)).toBe(false);
    expect(await verifyPassword('Vereinskasse202', gespeichert)).toBe(false);
    expect(await verifyPassword('', gespeichert)).toBe(false);
  });

  it('erzeugt für dasselbe Passwort zwei verschiedene Prüfwerte', async () => {
    // Eigenes Zufallssalz je Benutzer: Sonst verriete ein Blick in die Liste,
    // wer dasselbe Passwort benutzt.
    const a = await hashPassword('Turnhalle-Schluessel');
    const b = await hashPassword('Turnhalle-Schluessel');
    expect(a).not.toBe(b);
    expect(await verifyPassword('Turnhalle-Schluessel', a)).toBe(true);
    expect(await verifyPassword('Turnhalle-Schluessel', b)).toBe(true);
  });

  it('enthält das Passwort nicht im Klartext', async () => {
    const gespeichert = await hashPassword('Turnhalle-Schluessel');
    expect(gespeichert).not.toContain('Turnhalle');
    expect(gespeichert.startsWith('pbkdf2$sha256$')).toBe(true);
  });

  it('stimmt mit einer unabhängigen Umsetzung überein', async () => {
    for (const fall of REFERENZWERTE) {
      const gespeichert = `pbkdf2$sha256$${fall.runden}$${alsBase64(fall.salzText)}$${fall.erwartet}`;
      expect(await verifyPassword(fall.passwort, gespeichert)).toBe(true);
    }
  });

  it('lehnt beschädigte Prüfwerte ab, statt sie durchzuwinken', async () => {
    expect(await verifyPassword('egal', 'pbkdf2$sha256$abc')).toBe(false);
    expect(await verifyPassword('egal', 'pbkdf2$sha256$0$xx$yy')).toBe(false);
    expect(await verifyPassword('egal', '')).toBe(false);
  });
});

describe('Klartext und fehlende Kryptographie', () => {
  const urspruenglich = Object.getOwnPropertyDescriptor(globalThis, 'crypto');

  afterEach(() => {
    if (urspruenglich) Object.defineProperty(globalThis, 'crypto', urspruenglich);
  });

  it('lässt ein Klartext-Passwort nie als Prüfwert gelten', async () => {
    // Früher wurden Klartext-Konten aus der Mehrbenutzerzeit erkannt und
    // umgestellt. Seit es nur noch das Gerätekonto gibt, gibt es sie nicht mehr.
    expect(await verifyPassword('admin', 'admin')).toBe(false);
  });

  it('meldet fehlende Kryptographie, statt ein falsches Passwort vorzutäuschen', async () => {
    const gespeichert = await hashPassword('Turnhalle-Schluessel');
    Object.defineProperty(globalThis, 'crypto', { value: undefined, configurable: true });
    await expect(verifyPassword('Turnhalle-Schluessel', gespeichert)).rejects.toThrow(/Kryptographie/);
    await expect(hashPassword('Turnhalle-Schluessel')).rejects.toThrow(/Kryptographie/);
  });
});

describe('Mindestanforderungen an neue Passwörter', () => {
  it('verlangt eine Mindestlänge', () => {
    expect(checkPasswordStrength('kurz').ok).toBe(false);
    expect(checkPasswordStrength('x'.repeat(MIN_PASSWORD_LENGTH - 1)).ok).toBe(false);
    expect(checkPasswordStrength('x'.repeat(MIN_PASSWORD_LENGTH)).ok).toBe(true);
  });

  it('weist die naheliegenden Passwörter zurück', () => {
    expect(checkPasswordStrength('passwort').ok).toBe(false);
    expect(checkPasswordStrength('12345678').ok).toBe(false);
    expect(checkPasswordStrength('Vorstand').ok).toBe(false);
  });

  it('nimmt eine ausreichend lange Wortfolge an', () => {
    expect(checkPasswordStrength('Turnhalle-Schluessel').ok).toBe(true);
    expect(checkPasswordStrength('kassenbuch 2026 rot').ok).toBe(true);
  });
});
