import { describe, it, expect } from 'vitest';
import { FinancialAccount, Transaction, TransactionSplit } from '../types';
import { berechne, csv, dateiname, mix, posten, verlauf } from './finanzAuswertung';
import { Befehl, Diagramm, mix as mixDiagramm, monatsSaeulen, pdfSeiten, sektorPunkte, skala, sparten, torte, verlauf as verlaufDiagramm, zeichnePdf, AUSGABEN, EINNAHMEN } from './finanzDiagramme';

// Gleiche Beispieldaten und Erwartungen wie Android FinanzauswertungTest
let n = 0;
const b = (
  date: string,
  amount: number,
  o: { type?: Transaction['type']; konto?: string; ziel?: string; sph?: string; sparte?: string; nk?: string; kontoName?: string; teile?: TransactionSplit[] } = {}
): Transaction =>
  ({
    id: `b${n++}`, date, amount, type: o.type ?? (amount < 0 ? 'expense' : 'income'), accountId: o.konto ?? 'k1', targetAccountId: o.ziel,
    documentNumber: '', bookingText: '', partner: '', sphere: (o.sph ?? 'ideell') as Transaction['sphere'], department: o.sparte ?? '',
    mainCategory: o.nk ?? '', subCategory: o.kontoName ?? '', category: '', vatRate: 0, isSplit: !!o.teile, splits: o.teile, createdAt: '', updatedAt: ''
  }) as Transaction;
const t = (amount: number, sph = '', nk = '', sparte = '', konto = ''): TransactionSplit =>
  ({ id: `t${n++}`, amount, sphere: sph as TransactionSplit['sphere'], mainCategory: nk, department: sparte, subCategory: konto, category: '', vatRate: 0 }) as TransactionSplit;
const k = (id: string, name: string, anfang: number): FinancialAccount => ({ id, name, accountType: 'bank', initialBalance: anfang, color: '', createdAt: '' }) as FinancialAccount;

const konten = [k('k1', 'Giro', 1000), k('k2', 'Kasse', 50)];
const heute = '2026-11-12';
const spendeNk = '40400 - Spenden';
const buchungen = () => [
  b('2026-01-10', 200, { kontoName: 'Beiträge', sparte: 'Fußball' }),
  b('2026-01-20', 100, { nk: spendeNk, kontoName: 'Geldspende' }),
  b('2026-01-25', -30, { nk: spendeNk, kontoName: 'Rückerstattung' }),
  b('2026-03-05', -80, { sparte: 'Fußball', kontoName: 'Material' }),
  b('2025-03-05', 500, { kontoName: 'Beiträge', sparte: 'Chor' }),
  b('2026-02-01', 300, { type: 'transfer', konto: 'k1', ziel: 'k2' })
];
const F = (o: Partial<{ jahr: string; sphaere: string; kontoId: string }> = {}) => ({ jahr: o.jahr ?? null, sphaere: o.sphaere ?? null, kontoId: o.kontoId ?? null });

describe('Finanz-Auswertung: Zahlen wie Android (D-75 bis D-78)', () => {
  it('Kennzahlen eines Jahres ohne Umbuchungen; Ausgabe auf dem Spendenkonto ist keine Spende', () => {
    const a = berechne(buchungen(), konten, F({ jahr: '2026' }), ['Fußball'], heute);
    expect(a.kennzahlen).toEqual({ einnahmen: 200, spenden: 100, ausgaben: 110, saldo: 190 });
    const rueck = posten(buchungen(), F({ jahr: '2026' })).find(p => p.konto === 'Rückerstattung')!;
    expect([rueck.ausgabe, rueck.spende]).toEqual([true, false]);
  });

  it('alle Jahre fassen gleiche Monate zusammen; Kontofilter ohne Treffer ist leer', () => {
    const a = berechne(buchungen(), konten, F(), [], heute);
    expect([a.monate[2].ausgaben, a.monate[2].einnahmen, a.monate[0].einnahmen]).toEqual([80, 500, 200]);
    expect(berechne(buchungen(), konten, F({ jahr: '2026', kontoId: 'k2' }), [], heute).keineBuchungen).toBe(true);
  });

  it('Bereichsfilter je Teilbetrag, unbekannter Bereich zählt als ideell, ohne Konto beschriftet', () => {
    const x = b('2026-04-01', 100, { sph: 'ideell', teile: [t(60, 'zweckbetrieb'), t(40, '')] });
    expect(posten([x], F({ sphaere: 'zweckbetrieb' })).map(p => p.cent)).toEqual([6000]);
    expect(posten([x], F({ sphaere: 'ideell' })).map(p => p.cent)).toEqual([4000]);
    expect(posten([b('2026-04-01', 10, { sph: 'komisch' })], F({ sphaere: 'ideell' }))).toHaveLength(1);
    expect(posten([b('2026-04-01', 10)], F())[0].konto).toBe('Ohne Konto');
  });

  it('Verlauf ist ein echter Kontostand mit Anfangsbestand; Umbuchung wirkt je Konto', () => {
    const v = verlauf(buchungen(), konten, F({ jahr: '2026' }), heute);
    expect(v).toHaveLength(11);
    expect([v[0].stand, v[1].stand, v[2].stand, v[10].stand]).toEqual([1820, 1820, 1740, 1740]);
    const k2 = verlauf(buchungen(), konten, F({ jahr: '2026', kontoId: 'k2' }), heute);
    expect([k2[0].stand, k2[1].stand]).toEqual([50, 350]);
    const alle = verlauf(buchungen(), konten, F(), heute);
    expect(alle.map(p => [p.name, p.stand])).toEqual([['Anfang', 1050], ['2025', 1550], ['2026', 1740]]);
    expect(verlauf(buchungen(), konten, F({ jahr: '2025' }), heute)).toHaveLength(12);
    expect(verlauf(buchungen(), konten, F({ jahr: '2030' }), heute)).toHaveLength(0);
  });

  it('Mix nach Konto und Sparten', () => {
    const a = berechne(buchungen(), konten, F({ jahr: '2026' }), ['Fußball', 'Chor'], heute);
    expect(mix(a.posten, true).map(x => x.name)).toEqual(['Beiträge']);
    expect(mix(a.posten, true, 'Fußball')[0].wert).toBe(200);
    expect(mix(a.posten, true, 'Chor')).toHaveLength(0);
    expect(mix(a.posten, false, 'Fußball')[0].wert).toBe(80);
    expect([a.sparten[0].name, a.sparten[0].einnahmen, a.sparten[0].ausgaben, a.sparten[1].summe]).toEqual(['Gesamtverein', 300, 110, 120]);
  });

  it('CSV mit allen Abschnitten und Dateiname wie am Handy (D-80)', () => {
    const a = berechne(buchungen(), konten, F({ jahr: '2026' }), ['Fußball'], heute);
    const c = csv(a, konten, mix(a.posten, true), mix(a.posten, false));
    expect(c).toContain('Abschnitt;Bezeichnung;Einnahmen;Spenden;Ausgaben;Wert');
    expect(c).toContain('Kennzahlen;Gesamt;200,00;100,00;110,00;190,00');
    expect(c).toContain('Kontostand (Ende);Nov;;;;1740,00');
    expect(dateiname(a, 'TSV Musterstadt e.V.', 'csv')).toBe('Finanzauswertung_2026_TSV_Musterstadt_e_V.csv');
    expect(dateiname({ ...a, filter: F() }, 'TSV', 'pdf')).toBe('Finanzauswertung_alle-Jahre_TSV.pdf');
  });
});

const pruefe = (d: Diagramm) => {
  for (const z of d.befehle) {
    if (z.art === 'rechteck') expect(z.x >= -0.01 && z.y >= -0.01 && z.x + z.b <= d.breite + 0.01 && z.y + z.h <= d.hoehe + 0.01).toBe(true);
    if (z.art === 'text') expect(Number.isFinite(z.x) && z.y >= 0 && z.y <= d.hoehe).toBe(true);
    if (z.art === 'linienzug') z.punkte.forEach(([x, y]) => expect(x >= 0 && x <= d.breite && y >= 0 && y <= d.hoehe).toBe(true));
    if (z.art === 'sektor') expect(z.cx + z.aussen <= d.breite && z.cy + z.aussen <= d.hoehe && z.winkel <= 360).toBe(true);
  }
};

describe('Diagramme für das PDF wie Android (D-80)', () => {
  it('liegen im Rahmen; leere Auswahl gibt Hinweis; einzige Scheibe knapp unter 360°; Übrige zusammengefasst', () => {
    const a = berechne(buchungen(), konten, F({ jahr: '2026' }), ['Fußball', 'Chor'], heute);
    [monatsSaeulen(a.monate, false), torte(a.kennzahlen), verlaufDiagramm(a.verlauf, false), mixDiagramm('x', '', mix(a.posten, true), EINNAHMEN), sparten(a.sparten)].forEach(d => {
      pruefe(d);
      expect(d.leer).toBeUndefined();
    });
    const leer = berechne([], konten, F(), [], heute);
    [monatsSaeulen(leer.monate, true), torte(leer.kennzahlen), verlaufDiagramm(leer.verlauf, true), sparten(leer.sparten)].forEach(d => expect(d.leer).toBeTruthy());
    const s = torte({ einnahmen: 100, spenden: 0, ausgaben: 0, saldo: 100 }).befehle.filter(x => x.art === 'sektor');
    expect(s).toHaveLength(1);
    pruefe(verlaufDiagramm([{ name: 'Jan', stand: -500 }, { name: 'Feb', stand: 200 }], false));
    const viele = Array.from({ length: 20 }, (_, i) => ({ name: `K${i + 1}`, wert: 99 - i }));
    const m = mixDiagramm('t', '', viele, AUSGABEN);
    expect(m.befehle.some(x => x.art === 'text' && x.text.startsWith('Übrige (9 Konten)'))).toBe(true);
    const [lo, hi, st] = skala(-30, 740);
    expect(lo <= -30 && hi >= 740 && st > 0 && Math.abs(lo % st) < 1e-9).toBe(true);
  });

  it('zwei A4-Seiten ganz auf dem Blatt, nur druckbare Zeichen; Ausgabe über jsPDF-Befehle', () => {
    const a = berechne(buchungen(), konten, F({ jahr: '2026' }), ['Fußball', 'Chor'], heute);
    const seiten = pdfSeiten(a, 'Testverein e.V.', 'Jahr 2026 · Alle Bereiche · Alle Konten', '12.11.2026');
    expect(seiten).toHaveLength(2);
    for (const s of seiten)
      for (const z of s as Befehl[]) {
        if (z.art === 'rechteck') expect(z.x >= 0 && z.y >= 0 && z.x + z.b <= 210.01 && z.y + z.h <= 297.01).toBe(true);
        if (z.art === 'text') {
          expect(z.x >= 0 && z.x <= 210 && z.y >= 0 && z.y <= 297).toBe(true);
          // Standardschrift im PDF: nur Zeichen aus Windows-1252 (sonst Zeichensalat wie in T-66)
          expect(/^[\x20-\x7e\xa0-\xff€…·„“–]*$/.test(z.text)).toBe(true);
        }
      }
    expect(seiten[1].some(z => z.art === 'text' && z.text === 'Seite 2 von 2')).toBe(true);
    const aufrufe: string[] = [];
    const ziel = new Proxy({}, { get: (_, name) => (..._args: unknown[]) => aufrufe.push(String(name)) });
    zeichnePdf(ziel as never, seiten);
    expect(aufrufe.filter(x => x === 'addPage')).toHaveLength(1);
    expect(aufrufe).toContain('lines');
    const p = sektorPunkte(10, 10, 5, 3, -90, 90);
    expect(p.every(([x, y]) => Number.isFinite(x) && Number.isFinite(y))).toBe(true);
  });
});
