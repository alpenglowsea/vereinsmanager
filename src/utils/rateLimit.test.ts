import { describe, it, expect } from 'vitest';
import { RateLimiter } from './rateLimit';

const MINUTE = 60_000;

describe('Ratenbegrenzung', () => {
  it('laesst die erlaubte Anzahl durch und bremst danach', () => {
    const b = new RateLimiter({ limit: 3, windowMs: MINUTE });
    expect(b.check('1.2.3.4', 0).allowed).toBe(true);
    expect(b.check('1.2.3.4', 1).allowed).toBe(true);
    expect(b.check('1.2.3.4', 2).allowed).toBe(true);
    expect(b.check('1.2.3.4', 3).allowed).toBe(false);
  });

  it('zaehlt jeden Absender fuer sich', () => {
    // Sonst sperrte der erste Vielnutzer den ganzen Verein aus.
    const b = new RateLimiter({ limit: 2, windowMs: MINUTE });
    b.check('1.1.1.1', 0);
    b.check('1.1.1.1', 0);
    expect(b.check('1.1.1.1', 0).allowed).toBe(false);
    expect(b.check('2.2.2.2', 0).allowed).toBe(true);
  });

  it('gibt nach Ablauf des Zeitfensters wieder frei', () => {
    const b = new RateLimiter({ limit: 2, windowMs: MINUTE });
    b.check('ip', 0);
    b.check('ip', 0);
    expect(b.check('ip', MINUTE - 1).allowed).toBe(false);
    expect(b.check('ip', MINUTE + 1).allowed).toBe(true);
  });

  it('nutzt ein gleitendes Fenster, kein festes Raster', () => {
    // Die Schwaeche eines festen Rasters: Wer seine Aufrufe um den
    // Rasterwechsel herum legt, kaeme auf das Doppelte durch. Hier nicht.
    const b = new RateLimiter({ limit: 2, windowMs: MINUTE });
    b.check('ip', MINUTE - 2);
    b.check('ip', MINUTE - 1);
    expect(b.check('ip', MINUTE + 1).allowed).toBe(false);
    // Erst wenn der erste Aufruf wirklich aus dem Fenster gerutscht ist:
    expect(b.check('ip', 2 * MINUTE - 1).allowed).toBe(true);
  });

  it('sagt, wie lange zu warten ist', () => {
    const b = new RateLimiter({ limit: 1, windowMs: MINUTE });
    b.check('ip', 0);
    const gesperrt = b.check('ip', 20_000);
    expect(gesperrt.allowed).toBe(false);
    expect(gesperrt.retryAfterSeconds).toBe(40);
  });

  it('nennt nie eine Wartezeit von null, wenn gesperrt wurde', () => {
    // Sonst versuchte es der Browser sofort wieder und liefe in dieselbe Wand.
    const b = new RateLimiter({ limit: 1, windowMs: 1000 });
    b.check('ip', 0);
    const gesperrt = b.check('ip', 999.9);
    expect(gesperrt.allowed).toBe(false);
    expect(gesperrt.retryAfterSeconds).toBeGreaterThanOrEqual(1);
  });

  it('zaehlt abgewiesene Versuche nicht als neue Aufrufe', () => {
    // Sonst verlaengerte jeder Fehlversuch die eigene Sperre — ein
    // hartnaeckiges Skript sperrte damit den Absender endlos aus.
    const b = new RateLimiter({ limit: 1, windowMs: MINUTE });
    b.check('ip', 0);
    for (let t = 1; t < 50_000; t += 1000) b.check('ip', t);
    expect(b.check('ip', MINUTE + 1).allowed).toBe(true);
  });

  it('laeuft dem Speicher nicht davon, wenn viele Adressen anklopfen', () => {
    // Ohne Obergrenze waere die Bremse selbst das Leck: Ein Angreifer mit
    // wechselnden Adressen liesse den Server volllaufen.
    const b = new RateLimiter({ limit: 5, windowMs: MINUTE, maxTrackedKeys: 100 });
    for (let i = 0; i < 5000; i++) b.check(`10.0.${i >> 8}.${i & 255}`, i);
    expect(b.size()).toBeLessThanOrEqual(100);
  });

  it('bremst einen Dauerabsender auch ueber lange Zeit zuverlaessig', () => {
    const b = new RateLimiter({ limit: 10, windowMs: 60 * MINUTE });
    let durch = 0;
    // Eine Stunde lang jede Sekunde ein Versuch.
    for (let t = 0; t < 60 * MINUTE; t += 1000) {
      if (b.check('angreifer', t).allowed) durch++;
    }
    expect(durch).toBe(10);
  });

  it('bremst einen normalen Benutzer nicht aus', () => {
    // Ein Kassenwart, der zwanzig Belege hintereinander einscannt: alle 20
    // Sekunden ein Aufruf, eine Viertelstunde lang.
    const b = new RateLimiter({ limit: 30, windowMs: 60 * MINUTE });
    let abgewiesen = 0;
    for (let i = 0; i < 20; i++) {
      if (!b.check('kassenwart', i * 20_000).allowed) abgewiesen++;
    }
    expect(abgewiesen).toBe(0);
  });
});
