/**
 * Jahresarchiv (R4): mit dem Testverein als Bestand durchgespielt –
 * auswählen, schreiben, zurücklesen, prüfen, aus dem Bestand nehmen,
 * einzeln anzeigen, zurückholen.
 */
import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { erzeugeTestverein } from '../testdaten/testverein';
import {
  ARCHIV_CSV,
  ARCHIV_JSON,
  ArchivFehler,
  archivDateiname,
  archivJahre,
  archivKandidaten,
  aufbewahrenBis,
  dateiAusArchiv,
  erstelleArchiv,
  holeArchivZurueck,
  leseArchiv,
  planeArchiv,
  pruefeArchiv,
  wendeArchivAn,
  type ArchivAenderungen,
  type ArchivBestand,
  type ArchivKopf
} from './jahresarchiv';
import { paketInhalt } from './backupPaketSchreiben';
import { oeffneZip, ZipFehler } from '../utils/zipReader';
import { schreibeZip } from '../utils/zipSchreiben';
import { sha256HexBytes } from '../utils/sha256';

const HEUTE = '2026-11-22';
const JETZT = new Date('2026-11-22T10:00:00.000Z');

function bestand(): ArchivBestand {
  const d = erzeugeTestverein().data;
  return { transactions: d.transactions, documents: d.documents, invoices: d.invoices, donations: d.donations, inventory: d.inventory, folders: d.folders };
}

/** Änderungen in den Bestand übernehmen (wie es das Speichern täte). */
function uebernehmen(b: ArchivBestand, a: ArchivAenderungen): ArchivBestand {
  const ersetze = <T extends { id: string }>(liste: T[], neu: T[]) => {
    const m = new Map(neu.map(x => [x.id, x]));
    return liste.map(x => m.get(x.id) ?? x);
  };
  return { ...b, transactions: ersetze(b.transactions, a.transactions), documents: ersetze(b.documents, a.documents), inventory: ersetze(b.inventory, a.inventory) };
}

const erstelle = (b: ArchivBestand, jahr: number, passwort?: string) =>
  erstelleArchiv(b, jahr, { verein: 'TSV Testhausen 1921 e.V.', kennung: `test-${jahr}`, jetzt: JETZT, passwort });

describe('SHA-256 für Dateien', () => {
  it('gleich wie Node (sha256sum)', () => {
    for (const n of [0, 1, 55, 56, 64, 1000, 70000]) {
      const b = new Uint8Array(n).map((_, i) => (i * 31 + 7) & 0xff);
      expect(sha256HexBytes(b)).toBe(createHash('sha256').update(b).digest('hex'));
    }
  });
});

describe('Was ins Archiv gehört', () => {
  it('Jahre: erst ab dem Vorvorjahr erlaubt, beim Vorjahr mit Begründung', () => {
    const jahre = archivJahre(bestand(), HEUTE);
    expect(jahre.map(j => j.jahr)).toEqual([2026, 2025, 2024, 2023, 2022]);
    expect(jahre.filter(j => j.erlaubt).map(j => j.jahr)).toEqual([2024, 2023, 2022]);
    expect(jahre.find(j => j.jahr === 2025)!.grund).toMatch(/Jahresabschluss/);
    expect(jahre.find(j => j.jahr === 2026)!.grund).toMatch(/laufende Jahr/);
  });

  it('2024: Belege, Rechnungen, Spenden-PDFs und das Foto des 2024 ausgemusterten Trikotsatzes', () => {
    const b = bestand();
    const plan = planeArchiv(b, 2024);
    const arten = new Set(plan.kandidaten.map(k => k.art));
    expect([...arten].sort()).toEqual(['beleg', 'inventarfoto', 'rechnung', 'spende']);
    // Jeder Beleg zählt an der Buchung und als Dokument
    const belegBuchungen = b.transactions.filter(t => t.date.startsWith('2024') && t.receipt).length;
    expect(plan.kandidaten.filter(k => k.art === 'beleg' && k.bereich === 'transactions')).toHaveLength(belegBuchungen);
    expect(plan.kandidaten.filter(k => k.art === 'beleg' && k.bereich === 'documents')).toHaveLength(belegBuchungen);
    expect(plan.kandidaten.filter(k => k.art === 'inventarfoto').map(k => k.id)).toEqual([b.inventory.find(a => a.retiredAt === '2024-09-01')!.id]);
    // Nichts anderes: keine Satzung, keine Verträge, keine Fotos aus Gebrauch
    expect(plan.kandidaten.some(k => k.id === 'doc-satzung' || k.id === 'doc-freistellung')).toBe(false);
    expect(plan.kandidaten.every(k => k.jahr === 2024)).toBe(true);
    // Fristen
    const bis = Object.fromEntries(plan.aufbewahrung.map(a => [a.art, a.bis]));
    expect(bis).toEqual({ beleg: '2032-12-31', rechnung: '2032-12-31', spende: '2034-12-31', inventarfoto: null });
    expect(aufbewahrenBis(plan.aufbewahrung)).toBe('2034-12-31');
  });

  it('Rasenmäher (2023 ausgemustert) gehört ins Archiv 2023; ohne Datum zählt die letzte Änderung', () => {
    const b = bestand();
    expect(planeArchiv(b, 2023).kandidaten.some(k => k.art === 'inventarfoto')).toBe(true);
    const ohne = { ...b, inventory: b.inventory.map(a => (a.retiredAt === '2023-04-03' ? { ...a, retiredAt: undefined, updatedAt: '2022-06-01T10:00:00.000Z' } : a)) };
    expect(planeArchiv(ohne, 2022).kandidaten.some(k => k.art === 'inventarfoto')).toBe(true);
  });

  it('Dateiname', () => {
    expect(archivDateiname('TSV Testhausen 1921 e.V.', 2024)).toBe('VereinsManager_Archiv_TSV_Testhausen_1921_e.V._2024.zip');
  });
});

describe('Archiv schreiben, lesen, prüfen', () => {
  it('ohne Passwort: archiv.json zuerst, Inhaltsverzeichnis, jede Datei einmal, alle Prüfsummen stimmen', async () => {
    const b = bestand();
    const { bytes, kopf, dateiname } = await erstelle(b, 2024);
    expect(dateiname).toMatch(/_2024\.zip$/);
    const namen = oeffneZip(bytes).eintraege.map(e => e.name);
    expect(namen.slice(0, 2)).toEqual([ARCHIV_JSON, ARCHIV_CSV]);
    expect(namen.length - 2).toBe(kopf.dateien.length);
    // Beleg an Buchung und als Dokument: dieselbe Datei
    const t = b.transactions.find(x => x.date.startsWith('2024') && x.receipt)!;
    const pfadT = kopf.eintraege.find(e => e.bereich === 'transactions' && e.id === t.id)!.pfad;
    const pfadD = kopf.eintraege.find(e => e.bereich === 'documents' && e.id === `doc-receipt-${t.id}`)!.pfad;
    expect(pfadT).toBe(pfadD);
    expect(pfadT.startsWith('dokumente/Buchhaltungsbelege & Finanzen/Belege 2024/')).toBe(true);

    const archiv = await leseArchiv(bytes);
    expect(archiv.kopf.kennung).toBe('test-2024');
    const p = await pruefeArchiv(archiv);
    expect(p).toEqual({ ok: true, geprueft: kopf.dateien.length, fehler: [] });

    const csv = new TextDecoder('utf-8', { ignoreBOM: true }).decode(await archiv.lies(ARCHIV_CSV));
    expect(csv.startsWith('\uFEFFArt;Datum;Belegnummer;Betrag (EUR);Bezeichnung;Datei im Archiv;SHA-256\r\n')).toBe(true);
    expect(csv).toContain(t.documentNumber);
  });

  it('mit Passwort: ohne oder mit falschem Passwort nicht lesbar', async () => {
    const { bytes } = await erstelle(bestand(), 2023, 'geheim-2023');
    await expect(leseArchiv(bytes)).rejects.toBeInstanceOf(ZipFehler);
    await expect(leseArchiv(bytes, 'falsch-falsch')).rejects.toBeInstanceOf(ZipFehler);
    const archiv = await leseArchiv(bytes, 'geheim-2023');
    expect((await pruefeArchiv(archiv)).ok).toBe(true);
  });

  it('erkennt eine veränderte Datei und lehnt fremde ZIP-Dateien ab', async () => {
    const { bytes, kopf } = await erstelle(bestand(), 2024);
    const archiv = await leseArchiv(bytes);
    // Gleiche Dateien, aber eine Prüfsumme in archiv.json verfälscht
    const falsch: ArchivKopf = { ...kopf, dateien: kopf.dateien.map((d, i) => (i === 0 ? { ...d, sha256: '0'.repeat(64) } : d)) };
    const dateien = await Promise.all(kopf.dateien.map(async d => ({ name: d.pfad, data: await archiv.lies(d.pfad) })));
    const neu = await schreibeZip([{ name: ARCHIV_JSON, data: new TextEncoder().encode(JSON.stringify(falsch)) }, ...dateien], null, JETZT);
    const p = await pruefeArchiv(await leseArchiv(neu));
    expect(p.ok).toBe(false);
    expect(p.fehler[0]).toMatch(/Prüfsumme/);

    const fremd = await schreibeZip([{ name: 'sicherung.json', data: new TextEncoder().encode('{}') }], null, JETZT);
    await expect(leseArchiv(fremd)).rejects.toBeInstanceOf(ArchivFehler);
  });

  it('ohne Dateien im Jahr gibt es kein Archiv', async () => {
    await expect(erstelle(bestand(), 2019)).rejects.toBeInstanceOf(ArchivFehler);
  });
});

describe('Bestand: auslagern, anzeigen, zurückholen', () => {
  it('nimmt genau die Dateien des Jahres heraus, setzt Vermerke und holt sie unverändert zurück', async () => {
    const b = bestand();
    const { bytes, kopf } = await erstelle(b, 2024);
    const archiv = await leseArchiv(bytes);
    expect((await pruefeArchiv(archiv)).ok).toBe(true);

    const vorher2023 = planeArchiv(b, 2023).kandidaten.length;
    const a = wendeArchivAn(b, kopf, JETZT.toISOString());
    expect(a.uebersprungen).toEqual([]);
    expect(a.transactions.length + a.documents.length + a.inventory.length).toBe(kopf.eintraege.length);
    const nachher = uebernehmen(b, a);
    expect(planeArchiv(nachher, 2024).kandidaten).toEqual([]);
    expect(planeArchiv(nachher, 2023).kandidaten).toHaveLength(vorher2023);

    const t = nachher.transactions.find(x => x.receipt?.archiv)!;
    expect(t.receipt!.dataUrl).toBe('');
    expect(t.receipt!.archiv).toMatchObject({ jahr: 2024, kennung: 'test-2024', datei: archivDateiname('TSV Testhausen 1921 e.V.', 2024) });
    const foto = nachher.inventory.find(x => x.photoArchiv)!;
    expect('photoUrl' in foto).toBe(false);

    // Einzeln ansehen: genau die ursprüngliche Datei
    const original = b.transactions.find(x => x.id === t.id)!.receipt!.dataUrl;
    expect(await dateiAusArchiv(archiv, t.receipt!.archiv!)).toBe(original);

    // Zurückholen: alles wie vorher (bis auf den Änderungszeitpunkt)
    const z = await holeArchivZurueck(nachher, archiv, JETZT.toISOString());
    expect(z.uebersprungen).toEqual([]);
    const wieder = uebernehmen(nachher, z);
    const ohneZeit = <T extends { updatedAt?: string }>(x: T) => ({ ...x, updatedAt: '' });
    for (const x of b.transactions) expect(ohneZeit(wieder.transactions.find(y => y.id === x.id)!)).toEqual(ohneZeit(x));
    for (const x of b.documents) expect(ohneZeit(wieder.documents.find(y => y.id === x.id)!)).toEqual(ohneZeit(x));
    for (const x of b.inventory) expect(ohneZeit(wieder.inventory.find(y => y.id === x.id)!)).toEqual(ohneZeit(x));
  });

  it('lässt eine inzwischen ersetzte Datei im Bestand und meldet sie', async () => {
    const b = bestand();
    const { kopf } = await erstelle(b, 2024);
    const t = b.transactions.find(x => x.date.startsWith('2024') && x.receipt)!;
    const geaendert = { ...b, transactions: b.transactions.map(x => (x.id === t.id ? { ...x, receipt: { ...x.receipt!, dataUrl: 'data:application/pdf;base64,JVBERi0xLjQK' } } : x)) };
    const a = wendeArchivAn(geaendert, kopf, JETZT.toISOString());
    expect(a.transactions.some(x => x.id === t.id)).toBe(false);
    expect(a.uebersprungen.some(s => /inzwischen geändert/.test(s))).toBe(true);
  });

  it('erkennt das falsche Archiv', async () => {
    const b = bestand();
    const a2024 = await erstelle(b, 2024);
    const a2023 = await leseArchiv((await erstelle(b, 2023)).bytes);
    const v = wendeArchivAn(b, a2024.kopf, JETZT.toISOString()).transactions[0].receipt!.archiv!;
    await expect(dateiAusArchiv(a2023, v)).rejects.toThrow(/nicht das passende Archiv/);
  });

  it('der Vermerk reist in der Sicherung mit (Sicherungspaket)', async () => {
    const b = bestand();
    const { kopf } = await erstelle(b, 2024);
    const nachher = uebernehmen(b, wendeArchivAn(b, kopf, JETZT.toISOString()));
    const { sicherung, dateien } = paketInhalt(JSON.stringify({ app: 'VereinsManager', data: { ...nachher, members: [] } }));
    const daten = sicherung.data as Record<string, Record<string, unknown>[]>;
    const t = daten.transactions.find(x => (x.receipt as Record<string, unknown> | undefined)?.archiv)!;
    const r = t.receipt as Record<string, unknown>;
    expect(r.file).toBeUndefined();
    expect((r.archiv as { jahr: number }).jahr).toBe(2024);
    // Archivierte Einträge nennen keine Datei im Paket; die Sicherung wird kleiner
    const archiviert = daten.documents.filter(x => x.archiv);
    expect(archiviert.length).toBeGreaterThan(0);
    expect(archiviert.every(x => x.file === undefined && x.dataUrl === '')).toBe(true);
    const vorher = paketInhalt(JSON.stringify({ app: 'VereinsManager', data: { ...b, members: [] } })).dateien;
    expect(dateien.length).toBeLessThan(vorher.length);
  });

  it('jede Datei im Bestand gehört höchstens in ein Jahr', () => {
    const k = archivKandidaten(bestand());
    const schluessel = k.map(x => `${x.bereich}|${x.id}`);
    expect(new Set(schluessel).size).toBe(schluessel.length);
  });
});
