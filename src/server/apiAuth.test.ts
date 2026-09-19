import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import {
  schluesselStimmt,
  bearerToken,
  pruefeZugriff,
  erstelleCloudPruefer,
  leereTokenSpeicher
} from './apiAuth';

const SCHLUESSEL = 'a1b2c3d4e5f60718293a4b5c6d7e8f90';

describe('Zugriffsschutz: Schluesselvergleich', () => {
  it('erkennt den richtigen Schluessel', () => {
    expect(schluesselStimmt(SCHLUESSEL, SCHLUESSEL)).toBe(true);
  });

  it('weist einen falschen Schluessel ab', () => {
    expect(schluesselStimmt('a1b2c3d4e5f60718293a4b5c6d7e8f91', SCHLUESSEL)).toBe(false);
  });

  it('weist einen zu kurzen oder zu langen Schluessel ab', () => {
    expect(schluesselStimmt(SCHLUESSEL.slice(0, 10), SCHLUESSEL)).toBe(false);
    expect(schluesselStimmt(SCHLUESSEL + 'x', SCHLUESSEL)).toBe(false);
  });

  it('laesst ohne hinterlegten Schluessel niemanden durch', () => {
    // Sonst oeffnete ein leerer Wert versehentlich alle Tueren.
    expect(schluesselStimmt('', '')).toBe(false);
    expect(schluesselStimmt(undefined, SCHLUESSEL)).toBe(false);
    expect(schluesselStimmt(['array'], SCHLUESSEL)).toBe(false);
  });
});

describe('Zugriffsschutz: Anmeldetoken aus der Kopfzeile', () => {
  it('liest das Token hinter Bearer', () => {
    expect(bearerToken('Bearer abc.def.ghi')).toBe('abc.def.ghi');
    expect(bearerToken('bearer   abc')).toBe('abc');
  });

  it('gibt null zurueck, wenn nichts Brauchbares dasteht', () => {
    expect(bearerToken(undefined)).toBeNull();
    expect(bearerToken('')).toBeNull();
    expect(bearerToken('Basic abc')).toBeNull();
    expect(bearerToken('Bearer ')).toBeNull();
  });
});

describe('Zugriffsschutz: Entscheidung ueber einen Aufruf', () => {
  it('laesst den richtigen Zugriffsschluessel durch', async () => {
    const ergebnis = await pruefeZugriff({ zugriffsschluessel: SCHLUESSEL }, SCHLUESSEL, null);
    expect(ergebnis.erlaubt).toBe(true);
    expect(ergebnis.weg).toBe('schluessel');
  });

  it('lehnt einen Aufruf ohne jeden Ausweis ab und nennt den Grund', async () => {
    const ergebnis = await pruefeZugriff({}, SCHLUESSEL, null);
    expect(ergebnis.erlaubt).toBe(false);
    expect(ergebnis.grund).toContain('Zugriffsschlüssel');
  });

  it('laesst ein gueltiges Cloud-Anmeldetoken durch', async () => {
    const ergebnis = await pruefeZugriff(
      { authorization: 'Bearer gueltig' },
      SCHLUESSEL,
      async () => true
    );
    expect(ergebnis.erlaubt).toBe(true);
    expect(ergebnis.weg).toBe('cloud');
  });

  it('lehnt ein abgelaufenes Cloud-Anmeldetoken ab', async () => {
    const ergebnis = await pruefeZugriff(
      { authorization: 'Bearer abgelaufen' },
      SCHLUESSEL,
      async () => false
    );
    expect(ergebnis.erlaubt).toBe(false);
    expect(ergebnis.grund).toContain('Anmeldung');
  });

  it('nutzt kein Anmeldetoken, wenn der Server es gar nicht pruefen kann', async () => {
    // Ohne Supabase-Daten auf dem Server gibt es keine Pruefstelle. Ein Token
    // ungeprueft zu glauben waere schlimmer als es abzulehnen.
    const ergebnis = await pruefeZugriff({ authorization: 'Bearer irgendwas' }, SCHLUESSEL, null);
    expect(ergebnis.erlaubt).toBe(false);
  });

  it('zieht den Schluessel dem Token vor und fragt gar nicht erst nach', async () => {
    const pruefer = vi.fn(async () => true);
    const ergebnis = await pruefeZugriff(
      { zugriffsschluessel: SCHLUESSEL, authorization: 'Bearer egal' },
      SCHLUESSEL,
      pruefer
    );
    expect(ergebnis.weg).toBe('schluessel');
    expect(pruefer).not.toHaveBeenCalled();
  });
});

describe('Zugriffsschutz: Rueckfrage bei Supabase', () => {
  beforeEach(() => {
    leereTokenSpeicher();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('gibt es ohne Supabase-Daten gar nicht erst', () => {
    expect(erstelleCloudPruefer(undefined, undefined)).toBeNull();
    expect(erstelleCloudPruefer('https://projekt.supabase.co', '')).toBeNull();
    expect(erstelleCloudPruefer('', 'anon-schluessel')).toBeNull();
  });

  it('fragt bei Supabase nach und akzeptiert eine gueltige Antwort', async () => {
    // Die Attrappe bekommt dieselben Parameter wie das echte fetch. Ohne sie
    // waere fuer TypeScript eine Funktion ohne Argumente hinterlegt, und die
    // aufgezeichneten Aufrufe liessen sich nicht auswerten.
    const abruf = vi.fn(
      async (_adresse: string, _optionen?: RequestInit) => new Response('{}', { status: 200 })
    );
    vi.stubGlobal('fetch', abruf);

    const pruefer = erstelleCloudPruefer('https://projekt.supabase.co/', 'anon-schluessel')!;
    expect(await pruefer('token-1')).toBe(true);

    const [adresse, optionen] = abruf.mock.calls[0];
    expect(adresse).toBe('https://projekt.supabase.co/auth/v1/user');
    expect((optionen?.headers as Record<string, string>).Authorization).toBe('Bearer token-1');
  });

  it('lehnt ab, wenn Supabase das Token nicht anerkennt', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 401 })));

    const pruefer = erstelleCloudPruefer('https://projekt.supabase.co', 'anon-schluessel')!;
    expect(await pruefer('token-2')).toBe(false);
  });

  it('lehnt ab, wenn Supabase nicht erreichbar ist', async () => {
    // Im Zweifel lieber eine Fehlermeldung als ein ungeprueft durchgelassener
    // Aufruf, der das KI-Kontingent des Vereins belastet.
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new Error('Netzwerk weg');
    }));

    const pruefer = erstelleCloudPruefer('https://projekt.supabase.co', 'anon-schluessel')!;
    expect(await pruefer('token-3')).toBe(false);
  });

  it('fragt fuer dasselbe Token nicht bei jedem Aufruf erneut nach', async () => {
    const abruf = vi.fn(async () => new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', abruf);

    const pruefer = erstelleCloudPruefer('https://projekt.supabase.co', 'anon-schluessel')!;
    await pruefer('token-4');
    await pruefer('token-4');
    await pruefer('token-4');

    expect(abruf).toHaveBeenCalledTimes(1);
  });

  it('merkt sich einen abgelehnten Zugang nicht', async () => {
    const abruf = vi.fn(async () => new Response('{}', { status: 401 }));
    vi.stubGlobal('fetch', abruf);

    const pruefer = erstelleCloudPruefer('https://projekt.supabase.co', 'anon-schluessel')!;
    await pruefer('token-5');
    await pruefer('token-5');

    expect(abruf).toHaveBeenCalledTimes(2);
  });
});
