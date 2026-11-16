import { describe, it, expect } from 'vitest';
import { randomBytes } from 'node:crypto';
import { istPaket, istPaketVerschluesselt, lesePaket } from './backupPaket';
import { leseSicherung } from './backupContents';
import { ZipFehler } from '../utils/zipReader';
import { baueTestZip } from '../utils/zipTestHelper';

const utf8 = (s: string): Uint8Array => new Uint8Array(Buffer.from(s, 'utf8'));

function ausDataUrl(url: string): { mime: string; bytes: Buffer } {
  const m = /^data:([^;]+);base64,(.*)$/.exec(url);
  if (!m) throw new Error('keine Data-URL: ' + url.slice(0, 40));
  return { mime: m[1], bytes: Buffer.from(m[2], 'base64') };
}

const SATZUNG = Buffer.concat([Buffer.from('%PDF-1.4 Satzung\n'), randomBytes(30_000)]);
const BELEG = Buffer.concat([Buffer.from('%PDF-1.4 Beleg\n'), randomBytes(12_000)]);
const FOTO = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), randomBytes(5_000)]);
const GERAET = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47]), randomBytes(3_000)]);

const BELEG_PFAD = 'dokumente/Buchhaltungsbelege & Finanzen/Belege 2026/2026-03-01 Sportshop Franke BE-2026-010.pdf';

/** Eine Sicherung in der Form, wie Android sie ins Paket schreibt (BACKUP_FORMAT.md Abschnitt 8). */
function sicherungJson(): string {
  return JSON.stringify({
    app: 'VereinsManager Android',
    version: '1.3.0',
    exportedAt: '2026-11-16T10:00:00.000Z',
    data: {
      settings: { clubName: 'TSV Musterstadt' },
      members: [
        { id: 'm1', memberNumber: 'M-0012', lastName: 'Müller', firstName: 'Jörg', avatarFile: 'mitglieder-fotos/M-0012 Müller Jörg.jpg' },
        { id: 'm2', memberNumber: 'M-0013', lastName: 'Ohne', firstName: 'Foto' }
      ],
      transactions: [
        {
          id: 'tx1',
          date: '2026-03-01',
          partner: 'Sportshop Franke',
          documentNumber: 'BE-2026-010',
          receipt: { name: 'quittung.pdf', type: 'application/pdf', size: BELEG.length, file: BELEG_PFAD, uploadedAt: '2026-03-01T12:00:00Z' }
        },
        { id: 'tx2', date: '2026-03-02', partner: 'Ohne Beleg' }
      ],
      documents: [
        { id: 'doc-1', title: 'Satzung', fileName: 'Satzung.pdf', fileType: 'application/pdf', file: 'dokumente/Satzung & Ordnungen/Satzung.pdf', folderId: 'f1' },
        { id: 'doc-receipt-tx1', title: 'Beleg', fileName: 'quittung.pdf', fileType: 'application/pdf', isReceipt: true, transactionId: 'tx1', file: BELEG_PFAD },
        { id: 'doc-weg', title: 'Verschwunden', fileName: 'weg.pdf', fileType: 'application/pdf', file: 'dokumente/(ohne Ordner)/weg.pdf' }
      ],
      inventory: [{ id: 'inv1', name: 'Trikotsatz', photoFile: 'inventar-fotos/Trikotsatz.png' }],
      meetings: [{ id: 'meet1', title: 'Vorstandssitzung', signatures: [{ role: 'chair', dataUrl: 'data:image/png;base64,AAAA' }] }]
    }
  });
}

function paket(passwort?: string): Uint8Array {
  return baueTestZip(
    [
      { name: 'sicherung.json', data: utf8(sicherungJson()) },
      { name: 'dokumente/Satzung & Ordnungen/Satzung.pdf', data: SATZUNG },
      { name: BELEG_PFAD, data: BELEG },
      { name: 'mitglieder-fotos/M-0012 Müller Jörg.jpg', data: FOTO },
      { name: 'inventar-fotos/Trikotsatz.png', data: GERAET },
      { name: 'dokumente/unbenutzt.pdf', data: SATZUNG }
    ],
    passwort
  );
}

describe('Erkennen eines Sicherungspakets', () => {
  it('unterscheidet Paket und JSON-Sicherung', () => {
    expect(istPaket(paket())).toBe(true);
    expect(istPaket(utf8(sicherungJson()))).toBe(false);
  });

  it('erkennt den Passwortschutz am ersten Eintrag', () => {
    expect(istPaketVerschluesselt(paket())).toBe(false);
    expect(istPaketVerschluesselt(paket('geheim-12345'))).toBe(true);
    expect(istPaketVerschluesselt(utf8(sicherungJson()))).toBe(false);
  });
});

describe('lesePaket', () => {
  it('setzt die Dateien wieder als Data-URL in die Einträge', async () => {
    const { jsonText, dateien, fehlend } = await lesePaket(paket());
    const d = JSON.parse(jsonText).data;

    const satzung = ausDataUrl(d.documents[0].dataUrl);
    expect(satzung.mime).toBe('application/pdf');
    expect(satzung.bytes.equals(SATZUNG)).toBe(true);
    expect('file' in d.documents[0]).toBe(false);

    const beleg = ausDataUrl(d.transactions[0].receipt.dataUrl);
    expect(beleg.mime).toBe('application/pdf');
    expect(beleg.bytes.equals(BELEG)).toBe(true);
    expect('file' in d.transactions[0].receipt).toBe(false);
    // übrige Angaben des Belegs bleiben
    expect(d.transactions[0].receipt.name).toBe('quittung.pdf');

    const foto = ausDataUrl(d.members[0].avatarUrl);
    expect(foto.mime).toBe('image/jpeg');
    expect(foto.bytes.equals(FOTO)).toBe(true);
    expect('avatarFile' in d.members[0]).toBe(false);

    const geraet = ausDataUrl(d.inventory[0].photoUrl);
    expect(geraet.mime).toBe('image/png');
    expect(geraet.bytes.equals(GERAET)).toBe(true);

    // vier verschiedene Dateien übernommen, eine fehlte
    expect(dateien).toBe(4);
    expect(fehlend).toEqual(['dokumente/(ohne Ordner)/weg.pdf']);
  });

  it('gibt derselben Datei an Buchung und Dokument denselben Inhalt', async () => {
    const d = JSON.parse((await lesePaket(paket())).jsonText).data;
    expect(d.documents[1].dataUrl).toBe(d.transactions[0].receipt.dataUrl);
  });

  it('lässt Einträge ohne Datei und alle anderen Bereiche unverändert', async () => {
    const d = JSON.parse((await lesePaket(paket())).jsonText).data;
    expect(d.members[1]).toEqual({ id: 'm2', memberNumber: 'M-0013', lastName: 'Ohne', firstName: 'Foto' });
    expect(d.transactions[1]).toEqual({ id: 'tx2', date: '2026-03-02', partner: 'Ohne Beleg' });
    // Unterschriften der Sitzungen stehen als Data-URL im Text und bleiben, wie sie sind
    expect(d.meetings[0].signatures[0].dataUrl).toBe('data:image/png;base64,AAAA');
    expect(d.settings.clubName).toBe('TSV Musterstadt');
  });

  it('behält einen Eintrag, dessen Datei im Paket fehlt, ohne Inhalt', async () => {
    const d = JSON.parse((await lesePaket(paket())).jsonText).data;
    expect(d.documents[2].id).toBe('doc-weg');
    expect(d.documents[2].dataUrl).toBe('');
    expect('file' in d.documents[2]).toBe(false);
  });

  it('liefert einen Text, den der vorhandene Einspielweg als Sicherung erkennt', async () => {
    const { kopf, daten } = leseSicherung((await lesePaket(paket())).jsonText);
    expect(kopf.version).toBe('1.3.0');
    expect(kopf.clubName).toBe('TSV Musterstadt');
    expect(Array.isArray(daten.members)).toBe(true);
  });

  it('liest ein Paket mit Passwort', async () => {
    const d = JSON.parse((await lesePaket(paket('Pässwort-ÄÖÜ-12345'), 'Pässwort-ÄÖÜ-12345')).jsonText).data;
    expect(ausDataUrl(d.documents[0].dataUrl).bytes.equals(SATZUNG)).toBe(true);
    expect(ausDataUrl(d.members[0].avatarUrl).bytes.equals(FOTO)).toBe(true);
  });

  it('meldet fehlendes und falsches Passwort unterscheidbar', async () => {
    const bytes = paket('Pässwort-ÄÖÜ-12345');
    const art = async (pw?: string): Promise<string> => {
      try {
        await lesePaket(bytes, pw);
        return 'kein Fehler';
      } catch (e) {
        return e instanceof ZipFehler ? e.art : 'anderer Fehler';
      }
    };
    expect(await art()).toBe('passwort-fehlt');
    expect(await art('falsch-12345')).toBe('passwort-falsch');
  });

  it('weist ein ZIP ohne sicherung.json zurück', async () => {
    const fremd = baueTestZip([{ name: 'urlaub.jpg', data: FOTO }]);
    let art = 'kein Fehler';
    try {
      await lesePaket(fremd);
    } catch (e) {
      art = e instanceof ZipFehler ? e.art : 'anderer Fehler';
    }
    expect(art).toBe('format');
  });

  it('bestimmt den Dateityp aus dem Inhalt, wenn der Eintrag keinen nennt', async () => {
    const json = JSON.stringify({
      version: '1.3.0',
      data: { documents: [{ id: 'd', title: 'Scan', fileType: 'pdf', file: 'dokumente/scan' }] }
    });
    const bytes = baueTestZip([
      { name: 'sicherung.json', data: utf8(json) },
      { name: 'dokumente/scan', data: SATZUNG }
    ]);
    const d = JSON.parse((await lesePaket(bytes)).jsonText).data;
    expect(ausDataUrl(d.documents[0].dataUrl).mime).toBe('application/pdf');
  });
});
