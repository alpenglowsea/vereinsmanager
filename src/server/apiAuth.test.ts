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
    expect(ergebnis.code).toBe('ZUGRIFF_VERWEIGERT');
  });

  it('laesst ein Vereinsmitglied mit gueltiger Anmeldung durch', async () => {
    const ergebnis = await pruefeZugriff(
      { authorization: 'Bearer gueltig' },
      SCHLUESSEL,
      async () => 'mitglied'
    );
    expect(ergebnis.erlaubt).toBe(true);
    expect(ergebnis.weg).toBe('cloud');
  });

  it('lehnt ein abgelaufenes Cloud-Anmeldetoken ab', async () => {
    const ergebnis = await pruefeZugriff(
      { authorization: 'Bearer abgelaufen' },
      SCHLUESSEL,
      async () => 'token-ungueltig'
    );
    expect(ergebnis.erlaubt).toBe(false);
    expect(ergebnis.grund).toContain('Anmeldung');
    expect(ergebnis.code).toBe('ANMELDUNG_ABGELAUFEN');
  });

  it('lehnt eine echte Anmeldung ab, die nicht zum Verein gehoert', async () => {
    // Der Kern dieser Stufe: Ein gueltiges Supabase-Konto ist noch keine
    // Vereinszugehoerigkeit. Wer sich selbst registriert hat, kommt nicht an
    // das Postfach und das KI-Kontingent des Vereins.
    const ergebnis = await pruefeZugriff(
      { authorization: 'Bearer fremder' },
      SCHLUESSEL,
      async () => 'kein-mitglied'
    );
    expect(ergebnis.erlaubt).toBe(false);
    expect(ergebnis.code).toBe('NICHT_FREIGESCHALTET');
    expect(ergebnis.grund).toContain('freigeschaltet');
  });

  it('nennt die fehlenden Schutzregeln beim Namen, statt "kein Mitglied" zu behaupten', async () => {
    // Sonst suchte der Betreiber den Fehler bei seinen Benutzern, obwohl in
    // der Datenbank nur supabase_rls.sql fehlt.
    const ergebnis = await pruefeZugriff(
      { authorization: 'Bearer egal' },
      SCHLUESSEL,
      async () => 'regeln-fehlen'
    );
    expect(ergebnis.erlaubt).toBe(false);
    expect(ergebnis.code).toBe('SCHUTZREGELN_FEHLEN');
    expect(ergebnis.grund).toContain('supabase_rls.sql');
  });

  it('unterscheidet "nicht geprueft" von "geprueft und abgelehnt"', async () => {
    const ergebnis = await pruefeZugriff(
      { authorization: 'Bearer egal' },
      SCHLUESSEL,
      async () => 'nicht-pruefbar'
    );
    expect(ergebnis.erlaubt).toBe(false);
    expect(ergebnis.code).toBe('PRUEFUNG_FEHLGESCHLAGEN');
  });

  it('nutzt kein Anmeldetoken, wenn der Server es gar nicht pruefen kann', async () => {
    // Ohne Supabase-Daten auf dem Server gibt es keine Pruefstelle. Ein Token
    // ungeprueft zu glauben waere schlimmer als es abzulehnen.
    const ergebnis = await pruefeZugriff({ authorization: 'Bearer irgendwas' }, SCHLUESSEL, null);
    expect(ergebnis.erlaubt).toBe(false);
  });

  it('zieht den Schluessel dem Token vor und fragt gar nicht erst nach', async () => {
    const pruefer = vi.fn(async () => 'mitglied' as const);
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
  /**
   * Stellt beide Supabase-Stellen nach: die Tokenpruefung und die Rueckfrage
   * nach der Vereinszugehoerigkeit. Die Attrappe bekommt dieselben Parameter
   * wie das echte fetch — ohne sie waere fuer TypeScript eine Funktion ohne
   * Argumente hinterlegt, und die aufgezeichneten Aufrufe liessen sich nicht
   * auswerten.
   */
  function stelleSupabaseNach(vorgabe: {
    anmeldung?: number;
    mitglied?: { status: number; koerper: string };
  }) {
    const abruf = vi.fn(async (adresse: string, _optionen?: RequestInit) => {
      if (String(adresse).includes('/auth/v1/user')) {
        return new Response('{}', { status: vorgabe.anmeldung ?? 200 });
      }
      const antwort = vorgabe.mitglied ?? { status: 200, koerper: 'true' };
      return new Response(antwort.koerper, { status: antwort.status });
    });
    vi.stubGlobal('fetch', abruf);
    return abruf;
  }

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

  it('fragt beide Stellen und laesst ein Vereinsmitglied durch', async () => {
    const abruf = stelleSupabaseNach({});

    const pruefer = erstelleCloudPruefer('https://projekt.supabase.co/', 'anon-schluessel')!;
    expect(await pruefer('token-1')).toBe('mitglied');

    expect(abruf).toHaveBeenCalledTimes(2);

    const [adresse1, optionen1] = abruf.mock.calls[0];
    expect(adresse1).toBe('https://projekt.supabase.co/auth/v1/user');
    expect((optionen1?.headers as Record<string, string>).Authorization).toBe('Bearer token-1');

    const [adresse2, optionen2] = abruf.mock.calls[1];
    expect(adresse2).toBe('https://projekt.supabase.co/rest/v1/rpc/vm_is_member');
    expect(optionen2?.method).toBe('POST');
    expect((optionen2?.headers as Record<string, string>).apikey).toBe('anon-schluessel');
  });

  it('fragt nach der Mitgliedschaft gar nicht erst, wenn das Token nicht taugt', async () => {
    const abruf = stelleSupabaseNach({ anmeldung: 401 });

    const pruefer = erstelleCloudPruefer('https://projekt.supabase.co', 'anon-schluessel')!;
    expect(await pruefer('token-2')).toBe('token-ungueltig');
    expect(abruf).toHaveBeenCalledTimes(1);
  });

  it('weist ein gueltiges Konto ab, das nicht zum Verein gehoert', async () => {
    stelleSupabaseNach({ mitglied: { status: 200, koerper: 'false' } });

    const pruefer = erstelleCloudPruefer('https://projekt.supabase.co', 'anon-schluessel')!;
    expect(await pruefer('token-3')).toBe('kein-mitglied');
  });

  it('erkennt eine Datenbank ohne die Schutzregeln', async () => {
    // PostgREST antwortet auf eine unbekannte Funktion mit 404.
    stelleSupabaseNach({
      mitglied: { status: 404, koerper: '{"code":"PGRST202"}' }
    });

    const pruefer = erstelleCloudPruefer('https://projekt.supabase.co', 'anon-schluessel')!;
    expect(await pruefer('token-4')).toBe('regeln-fehlen');
  });

  it('behauptet bei einer unerwarteten Antwort nichts', async () => {
    stelleSupabaseNach({ mitglied: { status: 403, koerper: '{}' } });

    const pruefer = erstelleCloudPruefer('https://projekt.supabase.co', 'anon-schluessel')!;
    expect(await pruefer('token-5')).toBe('nicht-pruefbar');
  });

  it('haelt auch einen unverstaendlichen Koerper fuer keine Erlaubnis', async () => {
    stelleSupabaseNach({ mitglied: { status: 200, koerper: '[{"vm_is_member":true}]' } });

    const pruefer = erstelleCloudPruefer('https://projekt.supabase.co', 'anon-schluessel')!;
    expect(await pruefer('token-6')).toBe('nicht-pruefbar');
  });

  it('lehnt ab, wenn Supabase nicht erreichbar ist', async () => {
    // Im Zweifel lieber eine Fehlermeldung als ein ungeprueft durchgelassener
    // Aufruf, der das KI-Kontingent des Vereins belastet.
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('Netzwerk weg');
      })
    );

    const pruefer = erstelleCloudPruefer('https://projekt.supabase.co', 'anon-schluessel')!;
    expect(await pruefer('token-7')).toBe('nicht-pruefbar');
  });

  it('fragt fuer dasselbe Token nicht bei jedem Aufruf erneut nach', async () => {
    const abruf = stelleSupabaseNach({});

    const pruefer = erstelleCloudPruefer('https://projekt.supabase.co', 'anon-schluessel')!;
    await pruefer('token-8');
    await pruefer('token-8');
    await pruefer('token-8');

    // Zwei Rueckfragen beim ersten Mal, danach keine mehr.
    expect(abruf).toHaveBeenCalledTimes(2);
  });

  it('merkt sich einen abgelehnten Zugang nicht', async () => {
    // Sonst bliebe ein gerade freigeschaltetes Mitglied eine Minute lang
    // ausgesperrt, ohne zu verstehen, warum.
    const abruf = stelleSupabaseNach({ mitglied: { status: 200, koerper: 'false' } });

    const pruefer = erstelleCloudPruefer('https://projekt.supabase.co', 'anon-schluessel')!;
    await pruefer('token-9');
    await pruefer('token-9');

    expect(abruf).toHaveBeenCalledTimes(4);
  });
});
