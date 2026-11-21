import { describe, it, expect } from 'vitest';
import { inflateRawSync } from 'node:zlib';
import { createHmac, pbkdf2Sync } from 'node:crypto';
import { bereinigen, eindeutig, paketInhalt, schreibePaket } from './backupPaketSchreiben';
import { lesePaket, istPaketVerschluesselt } from './backupPaket';
import { deflateOhneKompression } from '../utils/zipSchreiben';
import { referenzCtr } from '../utils/zipTestHelper';
import { ZipFehler } from '../utils/zipReader';

const b64 = (s: string | Uint8Array) => Buffer.from(typeof s === 'string' ? Buffer.from(s, 'latin1') : s).toString('base64');
const PDF = `data:application/pdf;base64,${b64('%PDF-1.4 Beleg Sportshop')}`;
const PDF2 = `data:application/pdf;base64,${b64('%PDF-1.4 Satzung')}`;
const JPG = `data:image/jpeg;base64,${b64(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]))}`;
const PNG = `data:image/png;base64,${b64(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 9, 9]))}`;
const PNG2 = `data:image/png;base64,${b64(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 7, 7, 7]))}`;

/** Eine kleine Desktop-Sicherung wie `exportFullBackup` sie schreibt. */
function sicherung() {
  return {
    app: 'VereinsManager Lokal',
    version: '1.2.3',
    exportedAt: '2026-11-21T20:00:00.000Z',
    data: {
      folders: [
        { id: 'f1', name: 'Satzung & Ordnungen', parentId: null },
        { id: 'f2', name: 'Alt: <2020>', parentId: 'f1' },
        { id: 'f3', name: 'satzung & ordnungen', parentId: null } // gleicher Name, andere Schreibung
      ],
      documents: [
        { id: 'd1', title: 'Satzung', fileName: 'Satzung.pdf', fileType: 'application/pdf', folderId: 'f2', dataUrl: PDF2 },
        { id: 'd2', title: 'Satzung', fileName: 'Satzung.pdf', fileType: 'application/pdf', folderId: 'f2', dataUrl: PDF2 }, // gleicher Inhalt
        { id: 'd3', title: 'Notiz ohne Datei', fileName: '', fileType: '', folderId: 'f3', dataUrl: '' },
        { id: 'd4', title: 'Beleg BE-1', fileName: 'scan', fileType: 'application/pdf', folderId: 'unbekannt', dataUrl: PDF }
      ],
      transactions: [
        { id: 't1', date: '2026-03-01', partner: 'Sportshop Franke', documentNumber: 'BE-2026-010', receipt: { name: 'scan.pdf', type: 'application/pdf', dataUrl: PDF } },
        { id: 't2', date: '', partner: '', documentNumber: '', receipt: { name: 'foto', type: 'image/png', dataUrl: PNG } },
        { id: 't3', date: '2026-01-02', partner: 'Ohne Beleg' }
      ],
      members: [
        { id: 'm1', memberNumber: 'M-0012', lastName: 'Müller', firstName: 'Jörg', avatarUrl: JPG },
        { id: 'm2', memberNumber: 'M-0013', lastName: 'Müller', firstName: 'Jörg', avatarUrl: 'https://example.org/bild.jpg' }
      ],
      inventory: [{ id: 'i1', name: 'Trikotsatz', photoUrl: PNG2 }],
      settings: { clubName: 'TSV', logoUrl: JPG }
    }
  };
}

/** Liest ein ZIP unabhängig vom eigenen Leser (Node zlib), mit Prüfung der lokalen Köpfe wie ein Datenstrom-Leser. */
function liesUnabhaengig(zip: Uint8Array, passwort?: string): { name: string; data: Buffer }[] {
  const v = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  const out: { name: string; data: Buffer }[] = [];
  let pos = 0;
  // Von vorn nach hinten, nur über die lokalen Köpfe – so liest Android (zip4j ZipInputStream)
  while (v.getUint32(pos, true) === 0x04034b50) {
    const flags = v.getUint16(pos + 6, true);
    expect(flags & 0x0008).toBe(0); // Größen stehen vor den Daten
    expect(flags & 0x0800).toBe(0x0800); // UTF-8-Namen
    const methode = v.getUint16(pos + 8, true);
    const crc = v.getUint32(pos + 14, true);
    const gepackt = v.getUint32(pos + 18, true);
    const groesse = v.getUint32(pos + 22, true);
    const nl = v.getUint16(pos + 26, true);
    const el = v.getUint16(pos + 28, true);
    const name = Buffer.from(zip.subarray(pos + 30, pos + 30 + nl)).toString('utf8');
    const extra = zip.subarray(pos + 30 + nl, pos + 30 + nl + el);
    let daten = Buffer.from(zip.subarray(pos + 30 + nl + el, pos + 30 + nl + el + gepackt));
    if (passwort !== undefined) {
      expect(methode).toBe(99);
      expect(flags & 1).toBe(1);
      expect(crc).toBe(0);
      expect(Array.from(extra)).toEqual([0x01, 0x99, 7, 0, 2, 0, 0x41, 0x45, 3, 8, 0]);
      const salz = daten.subarray(0, 16);
      const abgeleitet = pbkdf2Sync(Buffer.from(passwort, 'utf8'), salz, 1000, 66, 'sha1');
      expect(Array.from(daten.subarray(16, 18))).toEqual(Array.from(abgeleitet.subarray(64, 66)));
      const chiffre = daten.subarray(18, daten.length - 10);
      const mac = createHmac('sha1', abgeleitet.subarray(32, 64)).update(chiffre).digest().subarray(0, 10);
      expect(Array.from(daten.subarray(daten.length - 10))).toEqual(Array.from(mac));
      daten = Buffer.from(referenzCtr(abgeleitet.subarray(0, 32), chiffre));
    } else {
      expect(methode).toBe(8);
    }
    const inhalt = inflateRawSync(daten);
    expect(inhalt.length).toBe(groesse);
    out.push({ name, data: inhalt });
    pos += 30 + nl + el + gepackt;
  }
  expect(v.getUint32(pos, true)).toBe(0x02014b50); // danach das Zentralverzeichnis
  return out;
}

describe('Sicherungspaket schreiben (P30 Teil 2, wie Android BackupPaket)', () => {
  it('Dateinamen wie am Handy: verbotene Zeichen, Windows-Namen, Länge, gleiche Namen', () => {
    expect(bereinigen('a/b:c*?.pdf')).toBe('a-b-c--.pdf');
    expect(bereinigen('  Satzung v1.2. ', 100, false)).toBe('Satzung v1.2');
    expect(bereinigen('CON.pdf')).toBe('_CON.pdf');
    expect(bereinigen('')).toBe('Datei');
    expect(bereinigen('x'.repeat(120) + '.pdf')).toBe('x'.repeat(96) + '.pdf');
    expect(eindeutig('A.pdf', new Set(['a.pdf', 'a (2).pdf']))).toBe('A (3).pdf');
  });

  it('legt Dateien in Ordnern wie Android ab, gleicher Inhalt nur einmal, sicherung.json mit Pfaden', () => {
    const { sicherung: s, dateien } = paketInhalt(JSON.stringify(sicherung()));
    expect(s.version).toBe('1.3.0');
    expect(dateien.map(d => d.name)).toEqual([
      'dokumente/Satzung & Ordnungen/Alt- -2020-/Satzung.pdf',
      'dokumente/(ohne Ordner)/scan.pdf',
      'dokumente/Buchhaltungsbelege & Finanzen/Belege (ohne Datum)/foto.png',
      'mitglieder-fotos/M-0012 Müller Jörg.jpg',
      'inventar-fotos/Trikotsatz.png'
    ]);
    const d = s.data as Record<string, Record<string, unknown>[]>;
    expect(d.documents[0]).toMatchObject({ file: 'dokumente/Satzung & Ordnungen/Alt- -2020-/Satzung.pdf' });
    expect(d.documents[0]).not.toHaveProperty('dataUrl');
    expect(d.documents[1].file).toBe(d.documents[0].file);
    expect(d.documents[2]).toMatchObject({ dataUrl: '' }); // ohne Datei: bleibt, wie er ist
    // Der Beleg der Buchung hat denselben Inhalt wie Dokument d4 und zeigt auf dieselbe Datei
    expect((d.transactions[0].receipt as Record<string, unknown>).file).toBe('dokumente/(ohne Ordner)/scan.pdf');
    expect(d.transactions[2]).not.toHaveProperty('receipt');
    expect(d.members[1]).toMatchObject({ avatarUrl: 'https://example.org/bild.jpg' }); // keine Data-URL: bleibt
    expect(d.inventory[0]).toMatchObject({ photoFile: 'inventar-fotos/Trikotsatz.png' });
    // Logo und andere kleine Data-URLs bleiben im Text (wie am Handy)
    expect((s.data as Record<string, Record<string, unknown>>).settings.logoUrl).toBe(JPG);
  });

  it('Beleg ohne Dokument: Name aus Datum, Partner und Belegnummer, Endung aus dem Original', () => {
    const roh = sicherung();
    roh.data.documents = [];
    const { dateien } = paketInhalt(JSON.stringify(roh));
    expect(dateien[0].name).toBe('dokumente/Buchhaltungsbelege & Finanzen/Belege 2026/2026-03-01 Sportshop Franke BE-2026-010.pdf');
  });

  it('ohne Passwort: unabhängig lesbar von vorn (wie Android), sicherung.json zuerst; zurück am Desktop wie vorher', async () => {
    const text = JSON.stringify(sicherung());
    const { bytes, dateien } = await schreibePaket(text, null, new Date(2026, 10, 21, 20, 15, 4));
    expect(dateien).toBe(5);
    expect(istPaketVerschluesselt(bytes)).toBe(false);
    const eintraege = liesUnabhaengig(bytes);
    expect(eintraege[0].name).toBe('sicherung.json');
    expect(eintraege).toHaveLength(6);
    expect(Array.from(eintraege[4].data)).toEqual([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
    expect(JSON.parse(eintraege[0].data.toString('utf8')).version).toBe('1.3.0');

    // Rundlauf über den Desktop-Leser: alle Data-URLs wieder da
    const zurueck = JSON.parse((await lesePaket(bytes)).jsonText);
    const vorher = sicherung();
    expect(zurueck.data.documents).toEqual(vorher.data.documents);
    expect(zurueck.data.transactions).toEqual(vorher.data.transactions);
    expect(zurueck.data.members).toEqual(vorher.data.members);
    expect(zurueck.data.inventory).toEqual(vorher.data.inventory);
  });

  it('mit Passwort: AE-2 mit AES-256, unabhängig entschlüsselbar; falsches Passwort wird erkannt', async () => {
    const text = JSON.stringify(sicherung());
    const { bytes } = await schreibePaket(text, 'geheim-123');
    expect(istPaketVerschluesselt(bytes)).toBe(true);
    const eintraege = liesUnabhaengig(bytes, 'geheim-123');
    expect(eintraege[0].name).toBe('sicherung.json');
    expect(eintraege[1].data.toString('latin1')).toBe('%PDF-1.4 Satzung');
    // Der Inhalt steht nirgends im Klartext
    expect(Buffer.from(bytes).toString('latin1')).not.toContain('Sportshop Franke');

    const zurueck = JSON.parse((await lesePaket(bytes, 'geheim-123')).jsonText);
    expect(zurueck.data.members).toEqual(sicherung().data.members);
    await expect(lesePaket(bytes, 'falsch-456')).rejects.toBeInstanceOf(ZipFehler);
  });

  it('Deflate ohne Kompression ist gültig, auch über mehrere Blöcke', () => {
    const gross = new Uint8Array(150000).map((_, i) => i % 251);
    expect(Array.from(inflateRawSync(deflateOhneKompression(gross)).subarray(140000, 140010))).toEqual(Array.from(gross.subarray(140000, 140010)));
    expect(inflateRawSync(deflateOhneKompression(gross)).length).toBe(150000);
    expect(inflateRawSync(deflateOhneKompression(new Uint8Array(0))).length).toBe(0);
  });
});
