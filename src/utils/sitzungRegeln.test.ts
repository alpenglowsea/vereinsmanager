import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { Meeting, MeetingResolution } from '../types';
import { sha256Hex } from './sha256';
import {
  auszugFehlt,
  beschlussNummernAngleichen,
  einladungFehlt,
  ergebnisVorschlag,
  filtern,
  gesperrt,
  inhaltsstempel,
  istLeitung,
  istSchrift,
  istStandardTagesordnung,
  mailText,
  ortDesVereins,
  neuerBeschluss,
  pruefeSitzung,
  pruefeUnterschrift,
  ROLLE_LEITUNG,
  ROLLE_SCHRIFT,
  standardTagesordnung,
  standardTitel,
  statistik,
  stimmenUngeprueft,
  unterschreibe,
  unterschriftenEntfernen
} from './sitzungRegeln';

const beschluss = (o: Partial<MeetingResolution> = {}): MeetingResolution => ({
  id: 'b1',
  agendaItemNumber: 'TOP 2',
  title: 'Kassenprüfer',
  motionText: 'Der Verein wählt X zum Kassenprüfer.',
  votesFor: 7,
  votesAgainst: 1,
  votesAbstain: 0,
  result: 'accepted',
  isTaxRelevant: false,
  isRegisterRelevant: true,
  ...o
});

const sitzung = (o: Partial<Meeting> = {}): Meeting => ({
  id: 'm1',
  title: 'Vorstandssitzung November',
  type: 'board',
  status: 'scheduled',
  protocolType: 'results',
  date: '2026-11-13',
  startTime: '19:00',
  endTime: '21:00',
  location: 'Vereinsheim',
  chairperson: 'Anna Alt',
  minuteKeeper: 'Bernd Bau',
  invitationCompliant: true,
  quorumConfirmed: true,
  totalEligibleVoters: 10,
  agenda: [
    { id: 't1', number: 'TOP 1', title: 'Begrüßung' },
    { id: 't2', number: 'TOP 2', title: 'Wahlen', resolutions: [beschluss()] }
  ],
  attendees: [
    { id: 'a1', name: 'Anna Alt', role: '1. Vorsitzende', present: true, hasVotingRight: true, isSignatory: false },
    { id: 'a2', name: 'Bernd Bau', role: '', present: false, hasVotingRight: true, isSignatory: false }
  ],
  createdAt: '',
  updatedAt: '',
  ...o
});

const unterschrift = { dataUrl: 'data:image/png;base64,AA', aspect: 2, strokes: [[[0.1, 0.5], [0.9, 0.6]]], geraet: 'Test' };

describe('SHA-256', () => {
  it('stimmt mit dem Verfahren von Node überein (auch mit Umlauten und über 64 Byte)', () => {
    for (const t of ['', 'abc', 'Größe über mehrere Blöcke '.repeat(9), '\u001f\u001e']) {
      expect(sha256Hex(t)).toBe(createHash('sha256').update(t, 'utf8').digest('hex'));
    }
  });
});

describe('Fingerabdruck wie Android', () => {
  it('baut den Text Feld für Feld wie Sitzungen.inhaltsstempel', () => {
    const F = '\u001f';
    const R = '\u001e';
    const erwartet =
      ['Vorstandssitzung November', 'board', 'results', '2026-11-13', '19:00', '21:00', 'Vereinsheim', 'Anna Alt', 'Bernd Bau', '', '', 'true', 'true', '10', ''].join(F) + R +
      ['T', 'TOP 1', 'Begrüßung', '', ''].join(F) + R +
      ['T', 'TOP 2', 'Wahlen', '', ''].join(F) + R +
      ['B', 'TOP 2', 'Kassenprüfer', 'Der Verein wählt X zum Kassenprüfer.', '', '7', '1', '0', 'accepted', 'false', 'true', '', '', ''].join(F) + R +
      ['A', 'Anna Alt', '1. Vorsitzende', 'true', 'true', 'false'].join(F) + R +
      ['A', 'Bernd Bau', '', 'false', 'true', 'false'].join(F) + R;
    expect(inhaltsstempel(sitzung())).toBe(createHash('sha256').update(erwartet, 'utf8').digest('hex').slice(0, 32));
    // Gleicher Wert steht als Prüfwert in SitzungenTest.kt (Android); stimmt er dort, rechnen beide Fassungen gleich.
    expect(inhaltsstempel(sitzung())).toBe('e6d192515720ddd1386f5b84540e6cb0');
  });

  it('fehlende Felder wie Android: leere Stimmenzahl, Standardwerte', () => {
    const a = sitzung({ totalEligibleVoters: undefined, endTime: undefined });
    const b = { ...sitzung(), totalEligibleVoters: undefined, endTime: '' } as Meeting;
    expect(inhaltsstempel(a)).toBe(inhaltsstempel(b));
    expect(inhaltsstempel(a)).not.toBe(inhaltsstempel(sitzung()));
  });
});

describe('Unterschriften (D-117)', () => {
  it('Rolle entscheidet, auch alte Desktop-Rollen; die zweite Unterschrift genehmigt; danach gesperrt', () => {
    expect(istLeitung('Versammlungsleitung gem. Satzung')).toBe(true);
    expect(istSchrift('Protokollführung gem. Satzung')).toBe(true);
    expect(istSchrift('Versammlungsleiter')).toBe(false);
    const jetzt = new Date(2026, 10, 14, 10, 0);
    const eins = unterschreibe(sitzung({ status: 'review' }), ROLLE_LEITUNG, unterschrift, jetzt);
    expect(eins.status).toBe('review');
    expect(gesperrt(eins)).toBe(true);
    expect(eins.signatures![0]).toMatchObject({ name: 'Anna Alt', role: ROLLE_LEITUNG, aspect: 2 });
    const zwei = unterschreibe(eins, ROLLE_SCHRIFT, unterschrift, jetzt);
    expect([zwei.status, zwei.signedAt, zwei.signatures!.length]).toEqual(['approved', '2026-11-14', 2]);
    // Neu unterschreiben ersetzt nur die eigene Rolle
    expect(unterschreibe(zwei, ROLLE_LEITUNG, unterschrift, jetzt).signatures!.length).toBe(2);
    const frei = unterschriftenEntfernen({ ...zwei, documentId: 'd1' });
    expect([frei.status, frei.signatures, frei.signedAt, frei.documentId]).toEqual(['review', undefined, undefined, undefined]);
  });

  it('Änderung nach der Unterschrift wird erkannt; alte Unterschriften ohne Fingerabdruck sind „unbekannt“', () => {
    const g = unterschreibe(sitzung(), ROLLE_LEITUNG, unterschrift);
    expect(pruefeUnterschrift(g, g.signatures![0])).toBe('gueltig');
    const geaendert = { ...g, location: 'Turnhalle' };
    expect(pruefeUnterschrift(geaendert, g.signatures![0])).toBe('geaendert');
    expect(pruefeUnterschrift(g, { ...g.signatures![0], contentHash: undefined })).toBe('unbekannt');
  });

  it('ohne Namen oder bei abgesagter Sitzung keine Unterschrift', () => {
    expect(() => unterschreibe(sitzung({ minuteKeeper: ' ' }), ROLLE_SCHRIFT, unterschrift)).toThrow(/Protokollführung/);
    expect(() => unterschreibe(sitzung({ status: 'cancelled' }), ROLLE_LEITUNG, unterschrift)).toThrow(/abgesagte/);
  });
});

describe('Pflichtangaben und Stimmen (D-118, D-122)', () => {
  it('Titel, Datum, Zeiten, Einladungsdatum, Status', () => {
    const e = pruefeSitzung(sitzung({ title: ' ', date: '13.11.2026', startTime: '25:00' }));
    expect(['titel', 'datum', 'beginn'].every(k => k in e)).toBe(true);
    expect(pruefeSitzung(sitzung({ startTime: '20:00', endTime: '19:00' })).ende).toBe('Das Ende muss nach dem Beginn liegen.');
    expect(pruefeSitzung(sitzung({ invitationDate: '2026-11-20' })).einladungsDatum).toMatch(/nach der Sitzung/);
    expect(pruefeSitzung(sitzung({ status: 'approved' })).status).toMatch(/Unterschriften/);
    expect(pruefeSitzung(sitzung({ startTime: '', endTime: '', location: '', chairperson: '', totalEligibleVoters: undefined, attendees: [] }))).toEqual({});
  });

  it('neuer Beschluss ist leer und braucht Stimmen; Summe höchstens Anwesende; angenommen nur mit Mehrheit', () => {
    const fehler = (b: MeetingResolution, grenze: number | null = 10) =>
      pruefeSitzung(sitzung({ totalEligibleVoters: grenze ?? undefined, agenda: [{ id: 't', number: 'TOP 1', title: 'X', resolutions: [b] }] }))['beschluss0.0'];
    const leer = neuerBeschluss('TOP 1');
    expect([leer.title, leer.votesFor]).toEqual(['', 0]);
    expect(fehler(leer)).toBe('Bitte einen Kurztitel eingeben.');
    expect(fehler(beschluss({ votesFor: 0, votesAgainst: 0 }))).toBe('Bitte die Stimmen eintragen.');
    expect(fehler(beschluss({ votesFor: 0, votesAgainst: 0, result: 'deferred' }))).toBeUndefined();
    expect(fehler(beschluss({ votesFor: 9, votesAgainst: 2 }), 10)).toMatch(/11 Stimmen/);
    expect(fehler(beschluss({ votesFor: 3, votesAgainst: 3 }))).toMatch(/nicht angenommen/);
    expect(fehler(beschluss({ votesFor: 1.5 }))).toMatch(/ganze Zahlen/);
    // ohne Eingabe zählt die Teilnehmerliste (1 Anwesende mit Stimmrecht)
    expect(fehler(beschluss({ votesFor: 2, votesAgainst: 0 }), null)).toMatch(/nur 1 stimmberechtigte/);
    expect([ergebnisVorschlag(5, 5), ergebnisVorschlag(6, 5)]).toEqual(['rejected', 'accepted']);
  });

  it('Beschlussnummern folgen ihrem TOP', () => {
    const a = beschlussNummernAngleichen([{ id: 't', number: 'TOP 3', title: 'X', resolutions: [beschluss({ agendaItemNumber: 'TOP 7' })] }]);
    expect(a[0].resolutions![0].agendaItemNumber).toBe('TOP 3');
  });
});

describe('Vorgaben ohne Musterdaten (D-119, D-131)', () => {
  it('Tagesordnung und Titel je Art; Erkennung der unveränderten Vorgabe', () => {
    expect(standardTagesordnung('general_assembly').length).toBe(6);
    expect(standardTagesordnung('board').length).toBe(4);
    expect(standardTagesordnung('other')).toEqual([]);
    expect(standardTitel('general_assembly', 2027)).toBe('Mitgliederversammlung 2027');
    expect(standardTitel('board', 2027)).toBe('Vorstandssitzung');
    expect(istStandardTagesordnung(standardTagesordnung('board'), 'board')).toBe(true);
    const geaendert = standardTagesordnung('board');
    geaendert[1] = { ...geaendert[1], title: 'Kassenbericht' };
    expect(istStandardTagesordnung(geaendert, 'board')).toBe(false);
  });
});

describe('Kennzahlen, Filter, Auszug, Einladung, Mail (D-121, D-127, D-128, D-130)', () => {
  const liste = [
    sitzung(),
    sitzung({
      id: 'm2',
      type: 'department',
      title: 'Abteilung Turnen',
      agenda: [
        { id: 'x', number: 'TOP 1', title: 'Y', resolutions: [beschluss({ result: 'rejected', votesFor: 1, votesAgainst: 5, isTaxRelevant: true }), beschluss({ result: 'deferred' })] }
      ]
    })
  ];

  it('nur angenommene Beschlüsse zählen für Finanzamt und Register', () => {
    expect(statistik(liste)).toEqual({ gesamt: 2, versammlungen: 0, vorstand: 1, angenommen: 1, abgelehnt: 1, vertagt: 1, steuer: 0, register: 1 });
  });

  it('Filter nach Art findet auch Abteilungs- und sonstige Sitzungen', () => {
    expect(filtern(liste, '', 'department', null).map(m => m.id)).toEqual(['m2']);
    expect(filtern(liste, 'turnen', null, null).map(m => m.id)).toEqual(['m2']);
  });

  it('Auszug nur mit festgestellter Beschlussfähigkeit und angenommenem Registerbeschluss', () => {
    expect(auszugFehlt(sitzung())).toBeNull();
    expect(auszugFehlt(sitzung({ quorumConfirmed: false }))).toMatch(/Beschlussfähigkeit/);
    expect(auszugFehlt(liste[1])).toMatch(/Kein angenommener/);
  });

  it('Einladung braucht Datum, Uhrzeit, Ort und Tagesordnung', () => {
    expect(einladungFehlt(sitzung())).toEqual([]);
    expect(einladungFehlt(sitzung({ startTime: '', location: ' ', agenda: [] }))).toEqual(['Uhrzeit', 'Ort', 'Tagesordnung']);
  });

  it('Mailtext ohne „sportliche Grüße“ und ohne erfundenen Vereinsnamen', () => {
    const t = mailText(sitzung({ chairperson: '' }), 'einladung', '');
    expect(t).not.toMatch(/sportlich|Unser Verein|Grüßen/);
    expect(t).toContain('Wann: 13.11.2026, 19:00 Uhr bis ca. 21:00 Uhr');
    const p = mailText(sitzung(), 'protokoll', 'TSV Beispiel e.V.');
    expect(p).toContain('Gefasste Beschlüsse: 1');
    expect(p).toContain('Hinweis: Das Protokoll ist noch nicht genehmigt.');
    expect(p.endsWith('Mit freundlichen Grüßen\nAnna Alt\nTSV Beispiel e.V.')).toBe(true);
  });
});

describe('Ort für die Unterschriftszeile', () => {
  it('Stadt ohne Postleitzahl, sonst leer statt „Musterstadt“', () => {
    expect(ortDesVereins('Hauptstr. 1, 12345 Beispielstadt')).toBe('Beispielstadt');
    expect(ortDesVereins({ city: 'Beispielstadt' })).toBe('Beispielstadt');
    expect(ortDesVereins('Hauptstr. 1')).toBe('');
    expect(ortDesVereins(undefined)).toBe('');
  });
});

describe('Hinweis: Stimmen ohne Teilnehmer (T-192)', () => {
  it('nur wenn weder Anzahl noch Teilnehmer mit Stimmrecht da sind und Stimmen eingetragen wurden', () => {
    expect(stimmenUngeprueft(sitzung({ totalEligibleVoters: undefined, attendees: [] }))).toBe(true);
    expect(stimmenUngeprueft(sitzung({ attendees: [] }))).toBe(false);
    expect(stimmenUngeprueft(sitzung({ totalEligibleVoters: undefined }))).toBe(false);
    expect(stimmenUngeprueft(sitzung({ totalEligibleVoters: undefined, attendees: [], agenda: [] }))).toBe(false);
  });
});
