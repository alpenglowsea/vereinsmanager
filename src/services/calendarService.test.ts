import { describe, it, expect } from 'vitest';
import { CalendarService, zuBerlin } from './calendarService';
import type { CalendarEvent } from '../types';

const t = (o: Partial<CalendarEvent>): CalendarEvent =>
  ({ id: 'evt-1', title: 'Sommerfest; Grill, Musik', categoryId: 'cat-celebration', startDate: '2026-07-04', endDate: '2026-07-05', isAllDay: true, participants: [{ memberId: 'a', memberName: 'Erika', role: 'participant', status: 'invited' }], createdAt: '', updatedAt: '', ...o }) as CalendarEvent;

describe('ICS-Export (D-113)', () => {
  it('gültige Regeln, keine erfundenen Teilnehmer', () => {
    const ics = CalendarService.exportToIcs([t({ isAllDay: false, startTime: '18:00', endTime: '20:00', endDate: '2026-07-04', recurrence: { frequency: 'biweekly', interval: 1, daysOfWeek: [5], endType: 'count', count: 4 } })], [], 'Kalender');
    expect(ics).toContain('RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=FR;COUNT=4');
    expect(ics).not.toContain('BIWEEKLY');
    expect(ics).not.toContain('ATTENDEE');
    expect(ics).not.toContain('verein.local');
  });
});

describe('ICS hin und zurück (D-125)', () => {
  it('ganztägig bleibt gleich lang, Kennung bleibt, Sonderzeichen bleiben', () => {
    const original = t({ description: 'Pfad C:\\neu\nzweite Zeile' });
    const ics = CalendarService.exportToIcs([original], [], 'K');
    expect(ics).toContain('DTEND;VALUE=DATE:20260706');
    const { events } = CalendarService.parseIcs(ics, []);
    expect(events[0].id).toBe('evt-1');
    expect(events[0].endDate).toBe('2026-07-05');
    expect(events[0].title).toBe('Sommerfest; Grill, Musik');
    expect(events[0].description).toBe('Pfad C:\\neu\nzweite Zeile');
    const zweimal = CalendarService.parseIcs(CalendarService.exportToIcs(events, [], 'K'), []).events;
    expect(zweimal[0].endDate).toBe('2026-07-05');
  });
  it('zweiter Import erkennt vorhandene Termine', () => {
    const { neu, vorhanden } = CalendarService.trenneNeueTermine([t({}), t({ id: 'x', title: 'Neu' })], [t({ id: 'anders' })]);
    expect(vorhanden).toHaveLength(1);
    expect(neu.map(e => e.title)).toEqual(['Neu']);
  });
  it('UTC-Zeiten werden in Berliner Ortszeit umgerechnet', () => {
    expect(zuBerlin('2026-07-04', 16, 0, 'UTC')).toEqual({ datum: '2026-07-04', zeit: '18:00' });
    expect(zuBerlin('2026-12-31', 23, 30, 'UTC')).toEqual({ datum: '2027-01-01', zeit: '00:30' });
    expect(zuBerlin('2026-07-04', 12, 0, 'America/New_York')).toEqual({ datum: '2026-07-04', zeit: '18:00' });
  });
});

describe('Einladungs-Mail (D-114)', () => {
  it('Empfänger nur in der Blindkopie', () => {
    const link = CalendarService.generateMailtoLink(t({ participants: [{ memberId: 'a', memberName: 'Erika', memberEmail: 'e@x.de', role: 'participant', status: 'invited' }] }), 'SV');
    expect(link.startsWith('mailto:?bcc=e@x.de&subject=')).toBe(true);
    expect(decodeURIComponent(link)).not.toContain('Erika');
  });
});

describe('Ausgenommene Tage im iCal (EXDATE)', () => {
  it('werden geschrieben und wieder gelesen', () => {
    const serie = t({ isAllDay: false, startTime: '18:00', endTime: '19:00', endDate: '2026-07-04', recurrence: { frequency: 'weekly', interval: 1, daysOfWeek: [6], endType: 'never', exceptionDates: ['2026-07-11'] } });
    const ics = CalendarService.exportToIcs([serie], [], 'K');
    expect(ics).toContain('EXDATE:20260711T180000');
    const { events, errors } = CalendarService.parseIcs(ics, []);
    expect(events[0].recurrence!.exceptionDates).toEqual(['2026-07-11']);
    expect(errors).toEqual([]);
  });
});
