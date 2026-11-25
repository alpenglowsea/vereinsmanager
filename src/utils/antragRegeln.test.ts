import { describe, it, expect } from 'vitest';
import type { Member } from '../types';
import type { Unterschrift } from './unterschrift';
import {
  Antrag,
  STANDARD_SATZUNG,
  aufnahmeFehler,
  alter,
  antragDateiname,
  antragDokTitel,
  antragTexteZumSpeichern,
  beilageFehler,
  beilageTitel,
  dubletten,
  ersteFehlerSeite,
  fehler as fehlerAuf,
  kontoinhaberAbweichend,
  kontoinhaberMussUnterschreiben,
  kontoinhaberVorschlag,
  leseAntragEinstellungen,
  minderjaehrig,
  mitgliedAusAntrag,
  neuerAntrag,
  vorschlagArt
} from './antragRegeln';
import { antragSeiten, antragVerein, umbrechen } from '../services/antragPdf';
import { Befehl, textBreite } from '../services/finanzDiagramme';

// Gleiche Beispiele und Erwartungen wie Android AntragTest
const heute = '2026-11-12';
const sparten = ['Fußball', 'Tennis'];
const unterschrift: Unterschrift = { aspect: 2, strokes: [[[0.1, 0.5], [0.5, 0.2], [0.9, 0.6]]] };
const verein = antragVerein({
  clubName: 'TSV Test e.V.',
  address: { street: 'Sportweg', houseNumber: '1', zip: '12345', city: 'Testheim', country: 'Deutschland' },
  creditorId: 'DE98ZZZ09999999999'
});

const erwachsener = (sepa = true): Antrag =>
  neuerAntrag({
    vorname: 'Anna', nachname: 'Muster', geschlecht: 'w', geburtsdatum: '1990-05-01', strasse: 'Weg', hausnummer: '3', plz: '11111', ort: 'Ort',
    sparte: 'Fußball', mitgliedsart: 'full', eintritt: '2026-11-12',
    zahlungsart: sepa ? 'sepa' : 'transfer', iban: sepa ? 'DE89 3704 0044 0532 0130 00' : '', kontoinhaber: sepa ? 'Anna Muster' : '',
    datenschutz: true, satzung: true, unterschrift
  });
const mit = (a: Antrag, w: Partial<Antrag>): Antrag => ({ ...a, ...w });
const fehler = (seite: number, a: Antrag) => fehlerAuf(seite, a, heute, sparten);
const schluessel = (f: Record<string, string>) => Object.keys(f).sort();

describe('Aufnahmeantrag: Regeln wie Android', () => {
  it('vollständiger Antrag hat keine Fehler', () => {
    for (let s = 1; s <= 5; s++) expect(fehler(s, erwachsener())).toEqual({});
    expect(ersteFehlerSeite(erwachsener(), heute, sparten)).toBeNull();
  });

  it('leerer Antrag meldet Pflichtfelder, E-Mail und Telefon sind freiwillig', () => {
    expect(schluessel(fehler(1, neuerAntrag()))).toEqual(['geburtsdatum', 'hausnummer', 'nachname', 'ort', 'plz', 'strasse', 'vorname']);
    expect(fehler(1, mit(erwachsener(), { email: '', telefon: '' }))).toEqual({});
    expect(fehler(1, mit(erwachsener(), { email: 'keine-mail' }))).toHaveProperty('email');
    expect(fehler(1, mit(erwachsener(), { email: 'a@b.de' }))).toEqual({});
  });

  it('Alter und Minderjährigkeit', () => {
    expect(alter('1990-05-01', heute)).toBe(36);
    expect(alter('2009-11-12', heute)).toBe(17);
    expect(alter('2008-11-12', heute)).toBe(18);
    expect(alter('2030-01-01', heute)).toBeNull();
    expect(alter('kaputt', heute)).toBeNull();
    expect(minderjaehrig(mit(erwachsener(), { geburtsdatum: '2012-01-01' }), heute)).toBe(true);
    expect(minderjaehrig(mit(erwachsener(), { geburtsdatum: '2008-11-12' }), heute)).toBe(false);
    expect([vorschlagArt(12), vorschlagArt(30), vorschlagArt(null)]).toEqual(['youth', null, null]);
  });

  it('Minderjährige brauchen Vertreter und dessen Unterschrift', () => {
    const kind = mit(erwachsener(), { geburtsdatum: '2012-01-01', zahlungsart: 'transfer', iban: '', kontoinhaber: '' });
    expect(fehler(1, kind)).toHaveProperty('vertreterName');
    expect(fehler(4, mit(kind, { vertreterName: 'Eva Muster' }))).toHaveProperty('vertreterUnterschrift');
    const ok = mit(kind, { vertreterName: 'Eva Muster', vertreterUnterschrift: unterschrift });
    expect(fehler(1, ok)).toEqual({});
    expect(fehler(4, ok)).toEqual({});
    // Unter 18 unterschreibt allein der Vertreter, das Kind nicht (T-258)
    expect(fehler(4, mit(ok, { unterschrift: null }))).toEqual({});
    expect(fehler(4, mit(erwachsener(), { unterschrift: null }))).toHaveProperty('unterschrift');
  });

  it('Kontoinhaber-Vorschlag: bei unter 18 der Vertreter (T-258)', () => {
    expect(kontoinhaberVorschlag(erwachsener(), heute)).toBe('Anna Muster');
    expect(kontoinhaberVorschlag(mit(erwachsener(), { geburtsdatum: '2012-01-01', vertreterName: ' Eva Muster ' }), heute)).toBe('Eva Muster');
    expect(kontoinhaberVorschlag(mit(erwachsener(), { geburtsdatum: '2012-01-01' }), heute)).toBe('Anna Muster');
  });

  it('Lastschrift braucht gültige IBAN und Kontoinhaber', () => {
    expect(fehler(3, mit(erwachsener(), { iban: '' }))).toHaveProperty('iban');
    expect(fehler(3, mit(erwachsener(), { iban: 'DE89 3704 0044 0532 0130 01' }))).toHaveProperty('iban'); // falsche Prüfziffer
    expect(fehler(3, mit(erwachsener(), { kontoinhaber: ' ' }))).toHaveProperty('kontoinhaber');
    expect(fehler(3, mit(erwachsener(), { bic: 'XX' }))).toHaveProperty('bic');
    expect(fehler(3, erwachsener(false))).toEqual({});
  });

  it('Erklärungen und Unterschrift sind Pflicht', () => {
    expect(schluessel(fehler(4, mit(erwachsener(), { datenschutz: false, satzung: false, unterschrift: null })))).toEqual(['datenschutz', 'satzung', 'unterschrift']);
    expect(fehler(4, mit(erwachsener(), { unterschrift: { aspect: 2, strokes: [] } }))).toHaveProperty('unterschrift');
  });

  it('Sparte muss zur Liste gehören', () => {
    expect(fehler(2, mit(erwachsener(), { sparte: 'Golf' }))).toHaveProperty('sparte');
    expect(fehler(2, mit(erwachsener(), { eintritt: '' }))).toHaveProperty('eintritt');
    expect(fehler(2, mit(erwachsener(), { mitgliedsart: 'honorary' as never }))).toHaveProperty('mitgliedsart');
  });

  it('Kontoinhaber unterschreibt nur, wenn abweichend', () => {
    const a = erwachsener();
    expect(kontoinhaberAbweichend(a)).toBe(false);
    expect(kontoinhaberAbweichend(mit(a, { kontoinhaber: '  muster,  ANNA ' }))).toBe(false);
    expect(kontoinhaberMussUnterschreiben(a, heute)).toBe(false);
    const fremd = mit(a, { kontoinhaber: 'Peter Muster' });
    expect(kontoinhaberMussUnterschreiben(fremd, heute)).toBe(true);
    expect(fehler(4, fremd)).toHaveProperty('kontoinhaberUnterschrift');
    expect(fehler(4, mit(fremd, { kontoinhaberUnterschrift: unterschrift }))).toEqual({});
    // Elternteil als Kontoinhaber eines Kindes: dessen Vertreter-Unterschrift genügt
    const kind = mit(a, { geburtsdatum: '2012-01-01', vertreterName: 'Eva Muster', kontoinhaber: 'Eva Muster', vertreterUnterschrift: unterschrift });
    expect(kontoinhaberMussUnterschreiben(kind, heute)).toBe(false);
    expect(fehler(4, kind)).toEqual({});
    expect(kontoinhaberMussUnterschreiben(mit(fremd, { zahlungsart: 'transfer' }), heute)).toBe(false);
  });

  it('Dubletten nach Name oder E-Mail', () => {
    const liste = [
      { firstName: 'anna', lastName: ' MUSTER', email: '' },
      { firstName: 'Bert', lastName: 'Zahl', email: 'a@b.de' },
      { firstName: 'Cäcilie', lastName: 'Fremd', email: 'x@y.de' }
    ];
    expect(dubletten(erwachsener(), liste)).toHaveLength(1);
    expect(dubletten(mit(erwachsener(), { email: 'A@B.de' }), liste)).toHaveLength(2);
    expect(dubletten(mit(erwachsener(), { vorname: 'Zoe' }), liste)).toHaveLength(0);
  });
});

describe('Aufnahmeantrag: Einstellungen', () => {
  it('Standard, eigene Texte und Beiträge aus den Vereinsdaten', () => {
    const std = leseAntragEinstellungen({});
    expect([std.beitraege.full.amount, std.beitraege.youth.period]).toEqual([18, 'monthly']);
    expect(std.datenschutz).toContain('{verein}');
    const eigen = leseAntragEinstellungen({
      membershipFeeDefaults: { full: { amount: '120,50', period: 'yearly' } },
      applicationStatuteText: 'Eigene Satzungsformel {verein}.',
      applicationStatuteDocId: 'doc-1'
    });
    expect([eigen.beitraege.full.amount, eigen.beitraege.full.period, eigen.satzung, eigen.satzungDokId]).toEqual([120.5, 'yearly', 'Eigene Satzungsformel {verein}.', 'doc-1']);
    // Standardtext wird nicht gespeichert
    expect(antragTexteZumSpeichern(std.datenschutz, STANDARD_SATZUNG)).toEqual({ applicationPrivacyText: undefined, applicationStatuteText: undefined });
    expect(antragTexteZumSpeichern('  ', 'Eigen ')).toEqual({ applicationPrivacyText: undefined, applicationStatuteText: 'Eigen' });
  });

  it('Satzung und Datenschutz: Titel je Fassung, nur PDF bis 10 MB', () => {
    const titel: string[] = [];
    for (let i = 0; i < 3; i++) titel.push(beilageTitel('satzung', heute, titel));
    expect(titel).toEqual(['Satzung vom 12.11.2026', 'Satzung vom 12.11.2026 (2)', 'Satzung vom 12.11.2026 (3)']);
    expect(beilageTitel('datenschutz', heute, titel)).toBe('Datenschutz-Vordruck vom 12.11.2026'); // die andere Beilage zählt für sich
    const pdf = new TextEncoder().encode('%PDF-1.4\nbeispiel\n%%EOF');
    expect(beilageFehler(pdf, pdf.length)).toBeNull();
    expect(beilageFehler(new TextEncoder().encode('kein pdf'), 8)).toContain('PDF');
    expect(beilageFehler(pdf, 11 * 1024 * 1024)).toContain('zu groß');
  });
});

describe('Aufnahmeantrag: Aufnahme', () => {
  const vorgabe = { amount: 18, period: 'monthly' as const };

  it('das Mitglied erfindet nichts', () => {
    const m = mitgliedAusAntrag(mit(erwachsener(), { vorverein: 'SV Alt', notiz: 'Torwart' }), 'M-0007', vorgabe, heute, 'mem-1', 'jetzt');
    expect([m.paymentMethod, m.bankDetails.iban, m.bankDetails.bic, m.bankDetails.bankName]).toEqual(['sepa', 'DE89370400440532013000', '', '']);
    expect([m.bankDetails.mandateSequenceType, m.bankDetails.mandateReference, m.bankDetails.mandateDate]).toEqual(['FRST', 'MANDAT-M-0007-2026', '2026-11-12']);
    expect([m.feeAmount, m.feePeriod, m.notes, m.isMinor, m.guardianName]).toEqual([18, 'monthly', 'Vorverein: SV Alt | Torwart', false, '']);
    const kind = mitgliedAusAntrag(mit(erwachsener(false), { geburtsdatum: '2012-01-01', vertreterName: 'Eva', vertreterTelefon: '' }), 'M-0008', vorgabe, heute, 'mem-2', 'jetzt');
    expect([kind.isMinor, kind.guardianName, kind.guardianPhone]).toEqual([true, 'Eva', '']); // nichts stillschweigend übernommen
    expect([kind.paymentMethod, kind.bankDetails.mandateReference]).toEqual(['transfer', '']);
  });

  it('unvollständiger Antrag oder vergebene Nummer wird abgelehnt', () => {
    const vorhanden = [{ id: 'x', memberNumber: 'M-0001' }] as Pick<Member, 'id' | 'memberNumber'>[];
    expect(aufnahmeFehler(mit(erwachsener(), { unterschrift: null }), 'M-0002', heute, sparten, vorhanden)).toBe('Bitte unterschreiben.');
    expect(aufnahmeFehler(erwachsener(), 'm-0001', heute, sparten, vorhanden)).toContain('vergeben');
    expect(aufnahmeFehler(erwachsener(), ' ', heute, sparten, vorhanden)).toContain('Mitgliedsnummer');
    expect(aufnahmeFehler(erwachsener(), 'M-0002', heute, sparten, vorhanden)).toBeNull();
    expect(antragDokTitel(erwachsener(), 'M-0001')).toBe('Aufnahmeantrag: Muster, Anna (M-0001)');
    expect(antragDateiname(erwachsener(), 'M-0001')).toBe('Aufnahmeantrag_Muster_Anna_M-0001.pdf');
  });
});

describe('Aufnahmeantrag: PDF-Aufbau wie Android', () => {
  const e = leseAntragEinstellungen({});
  const texte = (seiten: Befehl[][]) => seiten.flat().filter((b): b is Extract<Befehl, { art: 'text' }> => b.art === 'text').map(b => b.text);
  const zuege = (seiten: Befehl[][]) => seiten.flat().filter(b => b.art === 'linienzug').length;

  function imRahmen(seiten: Befehl[][]) {
    for (const b of seiten.flat()) {
      if (b.art === 'text') {
        expect(b.x >= 0 && b.x <= 210 && b.y >= 0 && b.y <= 297).toBe(true);
        if (b.aus === 'links') expect(b.x + textBreite(b.text, b.pt, b.fett)).toBeLessThanOrEqual(196);
      } else if (b.art === 'rechteck') expect(b.x >= 0 && b.y >= 0 && b.x + b.b <= 210.01 && b.y + b.h <= 297.01).toBe(true);
      else if (b.art === 'linie') expect(b.x1 >= 0 && b.x2 <= 210 && b.y1 >= 0 && b.y1 <= 297).toBe(true);
      else if (b.art === 'linienzug') b.punkte.forEach(([x, y]) => expect(x >= 0 && x <= 210 && y >= 0 && y <= 297).toBe(true));
    }
  }

  it('ausgefüllter Antrag enthält Daten und Unterschriften', () => {
    const kind = mit(erwachsener(), { geburtsdatum: '2012-01-01', vertreterName: 'Peter Muster', kontoinhaber: 'Peter Muster', vertreterUnterschrift: unterschrift, unterschrift: null, vorverein: 'SV Alt', notiz: 'Torwart' });
    const seiten = antragSeiten(kind, verein, e, 'M-0007', heute);
    imRahmen(seiten);
    const t = texte(seiten);
    for (const w of ['TSV Test e.V.', 'Muster', 'Anna', '12.11.2026', 'DE89 3704 0044 0532 0130 00', 'MANDAT-M-0007-2026', 'DE98ZZZ09999999999', '18,00 € monatlich']) expect(t).toContain(w);
    expect(t.some(x => x.startsWith('2. Gesetzlicher Vertreter'))).toBe(true);
    expect(zuege(seiten)).toBe(1); // nur der Vertreter; Kontoinhaber = Vertreter, keine weitere (T-258)
    expect(t).toContain('Unterschrift gesetzlicher Vertreter');
    expect(t).not.toContain('Unterschrift Antragsteller/in');
    expect(t.some(x => x.startsWith('Seite '))).toBe(false); // keine Seitenzahl (T-255)
    expect(t.some(x => x.includes('{verein}'))).toBe(false);
  });

  it('Volljährige ohne Vertreter-Abschnitt, fremdes Konto mit dritter Unterschrift', () => {
    const ohne = antragSeiten(erwachsener(), verein, e, 'M-1', heute);
    expect(texte(ohne).some(x => x.startsWith('2. Gesetzlicher Vertreter'))).toBe(false);
    expect(zuege(ohne)).toBe(1);
    const fremd = antragSeiten(mit(erwachsener(), { kontoinhaber: 'Peter Muster', kontoinhaberUnterschrift: unterschrift }), verein, e, 'M-1', heute);
    expect(zuege(fremd)).toBe(2);
    imRahmen(fremd);
    expect(texte(fremd).some(x => x.startsWith('Unterschrift Kontoinhaber'))).toBe(true);
  });

  it('mit Briefpapier kein eigener Kopf, Text unter dem Rand', () => {
    for (const a of [erwachsener(), null]) {
      const s = antragSeiten(a, verein, e, 'M-1', heute, true, 50);
      expect(s.flat().some(b => b.art === 'rechteck' && !!b.fuellung && b.y < 50 && b.h > 15)).toBe(false);
      expect(texte(s)).not.toContain(verein.name);
      s.forEach(seite => seite.forEach(b => { if (b.art === 'text' && !b.text.startsWith('Seite ')) expect(b.y).toBeGreaterThanOrEqual(50); }));
      imRahmen(s);
    }
    expect(texte(antragSeiten(erwachsener(), verein, e, 'M-1', heute))).toContain(verein.name);
    expect(antragSeiten(erwachsener(), verein, e, 'M-1', heute, true, 900).length).toBeLessThan(10);
  });

  it('fehlende Gläubiger-ID wird nicht erfunden, Überweisung ohne SEPA-Angaben', () => {
    const t = texte(antragSeiten(erwachsener(), { ...verein, glaeubigerId: '' }, e, 'M-1', heute));
    expect(t).toContain('nicht hinterlegt');
    expect(t.some(x => x.includes('ZZZ0999'))).toBe(false);
    const ue = texte(antragSeiten(erwachsener(false), verein, e, 'M-1', heute));
    expect(ue).toContain('Überweisung (Selbstzahler)');
    expect(ue.some(x => x.startsWith('Mandatsreferenz'))).toBe(false);
  });

  it('leeres Formular zeigt alle Mitgliedsarten mit Beiträgen', () => {
    const eigen = leseAntragEinstellungen({ membershipFeeDefaults: { youth: { amount: '7,5', period: 'quarterly' } } });
    const seiten = antragSeiten(null, verein, eigen, '', heute);
    imRahmen(seiten);
    const t = texte(seiten);
    // Seit 25.11.2026 steht hier der Name der Art aus den Einstellungen
    expect(t.some(x => x.startsWith('Jugend / Kinder') && x.endsWith('7,50 € vierteljährlich'))).toBe(true);
    // Ehrenmitglied ist nicht im Antrag wählbar
    expect(t.some(x => x.startsWith('Ehrenmitglied'))).toBe(false);
    expect(t.some(x => x.startsWith('Vollmitglied') && x.endsWith('18,00 € monatlich'))).toBe(true);
    expect(t.some(x => x.startsWith('2. Gesetzlicher Vertreter (nur bei Minderjährigen'))).toBe(true);
    expect(t).toContain('Bitte in Druckbuchstaben ausfüllen und unterschreiben.');
    expect(zuege(seiten)).toBe(0);
    expect(t.some(x => x.startsWith('Unterschrift Kontoinhaber'))).toBe(true);
    expect(t).toContain('Unterschrift Antragsteller/in (ab 18 Jahren)');
    expect(t).toContain('Unterschrift gesetzlicher Vertreter (bei unter 18)');
    expect(t.some(x => x.startsWith('Seite '))).toBe(false);
    expect(t).not.toContain('Anna');
    expect(t).not.toContain('Deutsch'); // nichts vorausgefüllt
  });

  it('lange Texte brechen um und bleiben auf der Seite', () => {
    const lang = { ...e, datenschutz: 'Sehr langer Text. '.repeat(80) };
    const seiten = antragSeiten(mit(erwachsener(), { notiz: 'x'.repeat(300) }), verein, lang, 'M-1', heute);
    imRahmen(seiten);
    expect(seiten.length).toBeGreaterThanOrEqual(2);
    expect(umbrechen('a '.repeat(10) + 'x'.repeat(400), 50, 8).every(z => textBreite(z, 8) <= 50)).toBe(true);
  });
});
