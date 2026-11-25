import { describe, it, expect } from 'vitest';
import { einzelnAusSerie, einzelTermine, mitAusnahme, plusMonate, monatVerschieben, serienTage, normiereSerie, vorkommen, besondereTage, pruefeTermin, ohneDoppelteTeilnehmer, einladungsText, serieText, wochentag } from './kalenderRegeln';
import type { CalendarEvent, EventParticipant, Member } from '../types';

const termin = (o: Partial<CalendarEvent>): CalendarEvent =>
  ({ id: 'e1', title: 'Training', categoryId: 'cat-training', startDate: '2026-01-31', endDate: '2026-01-31', isAllDay: false, startTime: '18:00', participants: [], createdAt: '', updatedAt: '', ...o }) as CalendarEvent;

describe('Monate rechnen (D-107)', () => {
  it('31.01. + 1 Monat ist der 28.02., nicht der 03.03.', () => {
    expect(plusMonate('2026-01-31', 1)).toBe('2026-02-28');
    expect(plusMonate('2024-01-31', 1)).toBe('2024-02-29');
    const d = monatVerschieben(new Date(2026, 0, 31), 1);
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 1, 28]);
    const z = monatVerschieben(new Date(2026, 0, 15), -1);
    expect([z.getFullYear(), z.getMonth()]).toEqual([2025, 11]);
  });
  it('Wochentag', () => {
    expect(wochentag('2026-11-20')).toBe(5);
  });
});

describe('Serien (D-108, D-109)', () => {
  it('Monatsserie am 31. bleibt beim Monatsletzten', () => {
    const s = normiereSerie({ frequency: 'monthly', interval: 1, endType: 'never' })!;
    expect(serienTage('2026-01-31', s, '2026-05-31')).toEqual(['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30', '2026-05-31']);
  });
  it('Jahresserie am 29.02. fällt auf den 28.02.', () => {
    const s = normiereSerie({ frequency: 'yearly', interval: 1, endType: 'count', count: 3 })!;
    expect(serienTage('2024-02-29', s, '2030-12-31')).toEqual(['2024-02-29', '2025-02-28', '2026-02-28']);
  });
  it('alle 2 Wochen an zwei Wochentagen; „biweekly“ wird alle 2 Wochen', () => {
    const s = normiereSerie({ frequency: 'weekly', interval: 2, daysOfWeek: [1, 3], endType: 'never' })!;
    expect(serienTage('2026-11-02', s, '2026-11-30')).toEqual(['2026-11-02', '2026-11-04', '2026-11-16', '2026-11-18', '2026-11-30']);
    expect(normiereSerie({ frequency: 'biweekly', interval: 1, endType: 'never' })).toMatchObject({ frequenz: 'weekly', intervall: 2 });
  });
  it('Ende nach Datum', () => {
    const s = normiereSerie({ frequency: 'daily', interval: 3, endType: 'until_date', untilDate: '2026-01-07' })!;
    expect(serienTage('2026-01-01', s, '2026-12-31')).toEqual(['2026-01-01', '2026-01-04', '2026-01-07']);
  });
});

describe('Mehrtägige Termine (D-110)', () => {
  it('erscheinen auch, wenn sie vor dem Zeitraum beginnen', () => {
    const v = vorkommen([termin({ startDate: '2026-11-28', endDate: '2026-12-02', isAllDay: true })], '2026-12-01', '2026-12-31');
    expect(v).toHaveLength(1);
    expect(v[0].endDate).toBe('2026-12-02');
  });
});

describe('Geburtstage (D-111)', () => {
  const m = [
    { id: 'a', firstName: 'Lea', lastName: 'Schalt', birthDate: '2000-02-29', entryDate: '2020-01-02', status: 'active', department: 'Fußball' }
  ] as unknown as Member[];
  it('29.02. wird in anderen Jahren der 28.02.; Jahreswechsel; „Jahre im Verein“', () => {
    const b = besondereTage(m, '2026-12-28', '2027-03-05');
    expect(b.map(x => x.date)).toEqual(['2027-01-02', '2027-02-28']);
    expect(b[0].title).toBe('Lea Schalt (7 Jahre im Verein)');
    expect(b[1].title).toBe('Lea Schalt (27. Geburtstag)');
  });
});

describe('Prüfungen (D-112)', () => {
  const basis = { titel: 'X', beginn: '2026-11-20', ende: '2026-11-20', ganztaegig: false, beginnZeit: '18:00', endeZeit: '19:00', serie: false, frequenz: 'weekly', intervall: 1, wochentage: [5], endeArt: 'never', bis: '', anzahl: 10 };
  it('Ende vor Beginn, Intervall, Uhrzeit', () => {
    expect(pruefeTermin(basis)).toEqual({});
    expect(pruefeTermin({ ...basis, ende: '2026-11-19' }).ende).toBeDefined();
    expect(pruefeTermin({ ...basis, endeZeit: '17:00' }).endeZeit).toBeDefined();
    expect(pruefeTermin({ ...basis, serie: true, intervall: 0 }).intervall).toBeDefined();
  });
  it('jeder Teilnehmer nur einmal', () => {
    const p = [{ memberId: 'a', memberName: 'A' }, { memberId: 'a', memberName: 'A' }, { memberId: 'b', memberName: 'B' }] as EventParticipant[];
    expect(ohneDoppelteTeilnehmer(p)).toHaveLength(2);
  });
});

describe('Einladung (D-114)', () => {
  it('ohne Namen, deutsches Datum, Verein aus den Einstellungen', () => {
    const t = termin({ startDate: '2026-11-20', endDate: '2026-11-20', endTime: '19:30', recurrence: { frequency: 'weekly', interval: 2, daysOfWeek: [5], endType: 'never' }, participants: [{ memberId: 'a', memberName: 'Erika Muster', role: 'participant', status: 'declined' }] });
    const text = einladungsText(t, 'SV Beispiel e.V.');
    expect(text).toContain('Wann: Fr, 20.11.2026, 18:00–19:30 Uhr');
    expect(text).toContain('Wiederholung: alle 2 Wochen (Fr)');
    expect(text).not.toContain('Erika');
    expect(text.endsWith('SV Beispiel e.V.')).toBe(true);
    expect(einladungsText(t, '')).not.toContain('Grüßen');
    expect(serieText(undefined)).toBe('Keine');
  });
});

describe('Ausgenommene Tage (EXDATE)', () => {
  it('ein Tag fällt aus, „Ende nach n Mal“ zählt ihn mit', () => {
    const t = termin({ startDate: '2026-11-02', endDate: '2026-11-02', recurrence: { frequency: 'weekly', interval: 1, daysOfWeek: [1], endType: 'count', count: 3 } });
    const mit = mitAusnahme(t, '2026-11-09');
    expect(vorkommen([mit], '2026-11-01', '2026-12-31').map(v => v.date)).toEqual(['2026-11-02', '2026-11-16']);
    expect(serieText(mit.recurrence)).toBe('wöchentlich (Mo), 3 Mal, ohne 09.11.2026');
  });
});

describe('Einzelnen Serientermin ändern', () => {
  it('Kopie ohne Wiederholung am gewählten Tag; mit Ausnahme in der Serie kein Doppel', () => {
    const t = termin({ id: 's1', startDate: '2026-11-02', endDate: '2026-11-03', recurrence: { frequency: 'weekly', interval: 1, daysOfWeek: [1], endType: 'count', count: 3 } });
    const e = einzelnAusSerie(t, '2026-11-09', 'neu', '2026-11-20T00:00:00Z');
    expect(e.recurrence).toBeUndefined();
    expect([e.id, e.startDate, e.endDate]).toEqual(['neu', '2026-11-09', '2026-11-10']);
    expect(e.seriesOrigin).toEqual({ eventId: 's1', date: '2026-11-09' });
    const v = vorkommen([mitAusnahme(t, '2026-11-09'), { ...e, location: 'Platz' }], '2026-11-01', '2026-11-30');
    expect(v.map(x => `${x.date} ${x.originalEvent.id}`)).toEqual(['2026-11-02 s1', '2026-11-09 neu', '2026-11-16 s1']);
    expect(einzelTermine([t, e], 's1').map(x => x.id)).toEqual(['neu']);
  });
});
