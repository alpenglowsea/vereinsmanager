import { describe, it, expect } from 'vitest';
import {
  MIN_PASSWORD_LENGTH,
  checkPasswordStrength,
  hashPassword,
  isHashed,
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
  it('erkennt Klartext und Prüfwert auseinander', async () => {
    expect(isHashed('admin')).toBe(false);
    expect(isHashed('')).toBe(false);
    expect(isHashed(undefined)).toBe(false);
    expect(isHashed(await hashPassword('Turnhalle-Schluessel'))).toBe(true);
  });

  it('bestätigt das richtige Passwort', async () => {
    const gespeichert = await hashPassword('Vereinskasse2026');
    const ergebnis = await verifyPassword('Vereinskasse2026', gespeichert);
    expect(ergebnis.ok).toBe(true);
    expect(ergebnis.needsUpgrade).toBe(false);
  });

  it('lehnt falsche Passwörter ab', async () => {
    const gespeichert = await hashPassword('Vereinskasse2026');
    expect((await verifyPassword('vereinskasse2026', gespeichert)).ok).toBe(false);
    expect((await verifyPassword('Vereinskasse202', gespeichert)).ok).toBe(false);
    expect((await verifyPassword('', gespeichert)).ok).toBe(false);
  });

  it('erzeugt für dasselbe Passwort zwei verschiedene Prüfwerte', async () => {
    // Eigenes Zufallssalz je Benutzer: Sonst verriete ein Blick in die Liste,
    // wer dasselbe Passwort benutzt.
    const a = await hashPassword('Turnhalle-Schluessel');
    const b = await hashPassword('Turnhalle-Schluessel');
    expect(a).not.toBe(b);
    expect((await verifyPassword('Turnhalle-Schluessel', a)).ok).toBe(true);
    expect((await verifyPassword('Turnhalle-Schluessel', b)).ok).toBe(true);
  });

  it('enthält das Passwort nicht im Klartext', async () => {
    const gespeichert = await hashPassword('Turnhalle-Schluessel');
    expect(gespeichert).not.toContain('Turnhalle');
    expect(gespeichert.startsWith('pbkdf2$sha256$')).toBe(true);
  });

  it('stimmt mit einer unabhängigen Umsetzung überein', async () => {
    for (const fall of REFERENZWERTE) {
      const gespeichert = `pbkdf2$sha256$${fall.runden}$${alsBase64(fall.salzText)}$${fall.erwartet}`;
      const ergebnis = await verifyPassword(fall.passwort, gespeichert);
      expect(ergebnis.ok).toBe(true);
    }
  });

  it('lehnt beschädigte Prüfwerte ab, statt sie durchzuwinken', async () => {
    expect((await verifyPassword('egal', 'pbkdf2$sha256$abc')).ok).toBe(false);
    expect((await verifyPassword('egal', 'pbkdf2$sha256$0$xx$yy')).ok).toBe(false);
    expect((await verifyPassword('egal', '')).ok).toBe(false);
  });
});

describe('Übernahme alter Konten', () => {
  it('lässt ein Klartext-Passwort weiterhin funktionieren', async () => {
    // Wer vor der Umstellung ein Konto hatte, soll sich nach dem Update
    // anmelden können — und dabei still auf den Prüfwert umgestellt werden.
    const ergebnis = await verifyPassword('admin', 'admin');
    expect(ergebnis.ok).toBe(true);
    expect(ergebnis.needsUpgrade).toBe(true);
  });

  it('lehnt ein falsches Passwort auch gegen Klartext ab', async () => {
    const ergebnis = await verifyPassword('falsch', 'admin');
    expect(ergebnis.ok).toBe(false);
    expect(ergebnis.needsUpgrade).toBe(false);
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
