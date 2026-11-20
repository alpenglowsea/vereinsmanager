import {
  CalendarEvent,
  CalendarEventCategory,
  EventRecurrence,
  Member,
  SpecialCalendarItem
} from '../types';
import Papa from 'papaparse';
import {
  vorkommen,
  besondereTage,
  normiereSerie,
  plusTage,
  istDatum,
  wochentag,
  serieText,
  einladungsText,
  einladungsBetreff,
  empfaenger
} from '../utils/kalenderRegeln';
import { leseDatum } from '../utils/importRegeln';

const UID_ENDUNG = '@vereinsmanager.lokal';
const BERLIN = 'Europe/Berlin';

/** Uhrzeit einer Zeitzone zu einem Zeitpunkt (Millisekunden seit 1970). */
function wandzeit(ms: number, zone: string) {
  const teile = new Intl.DateTimeFormat('en-CA', {
    timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(new Date(ms));
  const w = (t: string) => Number(teile.find(p => p.type === t)?.value);
  return { j: w('year'), m: w('month'), t: w('day'), h: w('hour'), mi: w('minute') };
}

/** Rechnet eine Uhrzeit aus `zone` (z. B. UTC) in Berliner Ortszeit um; null bei unbekannter Zone. */
export function zuBerlin(datum: string, h: number, mi: number, zone: string): { datum: string; zeit: string } | null {
  try {
    const [j, m, t] = datum.split('-').map(Number);
    const soll = Date.UTC(j, m - 1, t, h, mi);
    let zeitpunkt = soll;
    if (zone !== 'UTC') {
      for (let i = 0; i < 2; i++) {
        const w = wandzeit(zeitpunkt, zone);
        zeitpunkt = soll - (Date.UTC(w.j, w.m - 1, w.t, w.h, w.mi) - zeitpunkt);
      }
    }
    const b = wandzeit(zeitpunkt, BERLIN);
    const p = (n: number) => String(n).padStart(2, '0');
    return { datum: `${b.j}-${p(b.m)}-${p(b.t)}`, zeit: `${p(b.h)}:${p(b.mi)}` };
  } catch {
    return null;
  }
}

export interface ExpandedEventInstance {
  instanceId: string; // e.g. "evt-1_2026-09-18"
  originalEvent: CalendarEvent;
  date: string; // YYYY-MM-DD for this specific instance
  endDate: string; // YYYY-MM-DD
  startTime?: string;
  endTime?: string;
  isAllDay: boolean;
  isRecurrenceInstance: boolean;
}

export class CalendarService {
  /**
   * Helper: Format Date to YYYY-MM-DD
   */
  static formatDate(d: Date): string {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Helper: Parse YYYY-MM-DD to Date object in local time
   */
  static parseLocalDate(dateStr: string): Date {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, (m || 1) - 1, d || 1);
  }

  /**
   * Expand a list of CalendarEvents into all instances falling within [rangeStart, rangeEnd] (inclusive)
   */
  static expandEventsForRange(
    events: CalendarEvent[],
    rangeStart: string,
    rangeEnd: string
  ): ExpandedEventInstance[] {
    // Seit P19 in src/utils/kalenderRegeln.ts: Serien ohne Abdriften am
    // Monatsende, Intervall für alle Arten, mehrtägige Termine an allen Tagen
    return vorkommen(events, rangeStart, rangeEnd);
  }

  /**
   * Compute member birthdays and club anniversaries for a given year / range
   */
  static getSpecialItems(members: Member[], year: number): SpecialCalendarItem[] {
    return besondereTage(members, `${year}-01-01`, `${year}-12-31`);
  }

  /** Geburtstage und Jubiläen im Zeitraum, auch über den Jahreswechsel (D-111). */
  static getSpecialItemsRange(members: Member[], von: string, bis: string): SpecialCalendarItem[] {
    return besondereTage(members, von, bis);
  }

  // =========================================================================
  // iCalendar / ICS EXPORT & IMPORT (P20, wie Android `Austausch.kt`)
  // =========================================================================

  private static icsMaskieren(str: string): string {
    if (!str) return '';
    return str
      .replace(/\\/g, '\\\\')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,')
      .replace(/\r/g, '')
      .replace(/\n/g, '\\n');
  }

  /**
   * Hebt die Maskierung in einem Durchgang auf. Vorher wurde zuerst „\\n“
   * ersetzt und zuletzt „\\\\“: Ein maskierter Rückstrich vor einem „n“
   * (z. B. „C:\\neu“) wurde so zum Zeilenumbruch (D-125).
   */
  static icsEntmaskieren(s: string): string {
    return s.replace(/\\([nN,;\\])/g, (_, c: string) => (c === 'n' || c === 'N' ? '\n' : c));
  }

  /** Zeilen länger als 75 Byte werden gefaltet (Fortsetzung mit einem Leerzeichen), wie RFC 5545 verlangt. */
  private static icsFalten(zeile: string): string {
    const enc = new TextEncoder();
    if (enc.encode(zeile).length <= 75) return zeile;
    let out = '';
    let bytes = 0;
    for (const zeichen of zeile) {
      const n = enc.encode(zeichen).length;
      if (bytes + n > 75) {
        out += '\r\n ';
        bytes = 1;
      }
      out += zeichen;
      bytes += n;
    }
    return out;
  }

  private static icsTag(iso: string) {
    return iso.replace(/-/g, '');
  }

  private static icsZeit(iso: string, zeit: string) {
    return `${this.icsTag(iso)}T${zeit.replace(/:/g, '').padEnd(4, '0').slice(0, 4)}00`;
  }

  /**
   * Termine als gültige iCal-Datei (D-113). Zeiten stehen ohne Zeitzone und
   * gelten dort, wo der Kalender sie öffnet. Wiederholungen nur mit gültigen
   * Regeln (vorher „FREQ=BIWEEKLY“, das kein Kalender kennt). Teilnehmer nur
   * auf Wunsch und nur mit echter E-Mail-Adresse (vorher wurden Adressen wie
   * „mitglied-…@verein.local“ erfunden).
   */
  static exportToIcs(
    events: CalendarEvent[],
    categories: CalendarEventCategory[] = [],
    calendarName = 'Terminkalender',
    mitTeilnehmern = false,
    jetzt: Date = new Date()
  ): string {
    const namen = new Map(categories.map(c => [c.id, c.name]));
    const stempel = jetzt.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const z: string[] = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//VereinsManager//Terminkalender//DE',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      `X-WR-CALNAME:${this.icsMaskieren(calendarName)}`
    ];
    const TAGCODES = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

    for (const t of events) {
      z.push('BEGIN:VEVENT');
      z.push(`UID:${t.id.includes('@') ? t.id : t.id + UID_ENDUNG}`);
      z.push(`DTSTAMP:${stempel}`);
      const ende = t.endDate || t.startDate;
      const ganztaegig = t.isAllDay || !t.startTime;
      if (ganztaegig) {
        z.push(`DTSTART;VALUE=DATE:${this.icsTag(t.startDate)}`);
        // Bei ganztägigen Terminen ist das Ende nicht eingeschlossen: Folgetag
        z.push(`DTEND;VALUE=DATE:${this.icsTag(plusTage(ende, 1))}`);
      } else {
        z.push(`DTSTART:${this.icsZeit(t.startDate, t.startTime as string)}`);
        z.push(`DTEND:${this.icsZeit(ende, t.endTime || (t.startTime as string))}`);
      }
      z.push(`SUMMARY:${this.icsMaskieren(t.title)}`);
      if (t.description?.trim()) z.push(`DESCRIPTION:${this.icsMaskieren(t.description)}`);
      if (t.location?.trim()) z.push(`LOCATION:${this.icsMaskieren(t.location)}`);
      if (typeof t.locationLat === 'number' && typeof t.locationLng === 'number') {
        z.push(`GEO:${t.locationLat.toFixed(6)};${t.locationLng.toFixed(6)}`);
      }
      z.push(`CATEGORIES:${this.icsMaskieren(namen.get(t.categoryId) || 'Allgemein')}`);
      const s = normiereSerie(t.recurrence);
      if (s) {
        let r = `RRULE:FREQ=${s.frequenz.toUpperCase()}`;
        if (s.intervall > 1) r += `;INTERVAL=${s.intervall}`;
        if (s.frequenz === 'weekly' && s.wochentage.length) {
          r += `;BYDAY=${[...s.wochentage].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).map(d => TAGCODES[d]).join(',')}`;
        }
        if (s.endeArt === 'until_date' && s.bis) {
          // UNTIL hat dieselbe Form wie DTSTART: Datum bei ganztägigen, sonst Datum mit Uhrzeit
          r += ganztaegig ? `;UNTIL=${this.icsTag(s.bis)}` : `;UNTIL=${this.icsTag(s.bis)}T235959`;
        } else if (s.endeArt === 'count' && s.anzahl > 0) r += `;COUNT=${s.anzahl}`;
        z.push(r);
        // Ausgenommene Tage in derselben Form wie DTSTART
        if (s.ausnahmen.length) {
          z.push(ganztaegig
            ? `EXDATE;VALUE=DATE:${s.ausnahmen.map(d => this.icsTag(d)).join(',')}`
            : `EXDATE:${s.ausnahmen.map(d => this.icsZeit(d, t.startTime as string)).join(',')}`);
        }
      }
      if (mitTeilnehmern) {
        for (const p of t.participants || []) {
          const mail = (p.memberEmail || '').trim();
          if (!mail.includes('@')) continue;
          const stat = p.status === 'confirmed' || p.status === 'attended' ? 'ACCEPTED' : p.status === 'declined' ? 'DECLINED' : 'NEEDS-ACTION';
          z.push(`ATTENDEE;CN=${this.icsMaskieren(p.memberName).replace(/:/g, ' ')};ROLE=${p.role === 'organizer' ? 'REQ-PARTICIPANT' : 'OPT-PARTICIPANT'};PARTSTAT=${stat}:mailto:${mail}`);
        }
      }
      z.push('END:VEVENT');
    }
    z.push('END:VCALENDAR');
    return z.map(l => this.icsFalten(l)).join('\r\n') + '\r\n';
  }

  /** Einen Termin als .ics-Datei (ohne Teilnehmer). */
  static exportSingleEventIcs(event: CalendarEvent, categories: CalendarEventCategory[] = []): string {
    return this.exportToIcs([event], categories, event.title);
  }

  /**
   * Liest einen iCal-Zeitpunkt. Zeiten in UTC („Z“) oder mit Zeitzone (TZID)
   * werden in die Ortszeit des Vereins (Berlin) umgerechnet.
   */
  private static icsZeitpunkt(kopf: string[], wert: string): { datum: string; zeit: string; nurDatum: boolean } | null {
    const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?)?(Z)?$/.exec(wert.trim());
    if (!m) return null;
    const datum = `${m[1]}-${m[2]}-${m[3]}`;
    if (!istDatum(datum)) return null;
    const params = new Map(kopf.slice(1).map(p => [p.split('=')[0].toUpperCase(), p.split('=').slice(1).join('=')]));
    if (!m[4] || (params.get('VALUE') || '').toUpperCase() === 'DATE') return { datum, zeit: '', nurDatum: true };
    const tzid = (params.get('TZID') || '').replace(/"/g, '');
    const quelle = m[7] === 'Z' ? 'UTC' : tzid || null;
    let wand = { datum, zeit: `${m[4]}:${m[5]}` };
    if (quelle && quelle !== BERLIN) {
      const umgerechnet = zuBerlin(datum, +m[4], +m[5], quelle);
      if (umgerechnet) wand = umgerechnet;
    }
    return { ...wand, nurDatum: false };
  }

  /**
   * Liest iCal-Text (D-125). Ganztägige Termine: Das Ende in der Datei ist
   * der Folgetag und wird zurückgerechnet (vorher wurde jeder Termin bei jedem
   * Ex- und Import einen Tag länger). Die Kennung wird ohne die beim Export
   * angehängte Endung übernommen, damit ein zweiter Import denselben Termin
   * erkennt. Teilnehmer werden nicht übernommen; Wiederholungen, die der
   * Kalender nicht abbilden kann, werden gemeldet.
   */
  static parseIcs(
    icsText: string,
    existingCategories: CalendarEventCategory[] = [],
    jetzt: Date = new Date()
  ): { events: CalendarEvent[]; errors: string[] } {
    const events: CalendarEvent[] = [];
    const errors: string[] = [];
    const stempel = jetzt.toISOString();
    const zeilen = icsText.replace(/\r?\n[ \t]/g, '').split(/\r\n|\r|\n/);
    let drin = false;
    let eig: Array<{ kopf: string[]; wert: string }> = [];
    let nr = 0;
    let teilnehmer = 0;
    const TAGCODES = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

    for (const roh of zeilen) {
      const zeile = roh.trimEnd();
      if (/^BEGIN:VEVENT$/i.test(zeile)) {
        drin = true;
        eig = [];
        continue;
      }
      if (/^END:VEVENT$/i.test(zeile) && drin) {
        drin = false;
        nr++;
        const erste = (name: string) => eig.find(p => p.kopf[0].toUpperCase() === name);
        const titel = erste('SUMMARY') ? this.icsEntmaskieren(erste('SUMMARY')!.wert).trim() : '';
        const sRoh = erste('DTSTART');
        const s = sRoh ? this.icsZeitpunkt(sRoh.kopf, sRoh.wert) : null;
        if (!titel || !s) {
          errors.push(`Termin ${nr} übersprungen: Titel oder Beginn fehlt.`);
          continue;
        }
        const eRoh = erste('DTEND');
        const e = eRoh ? this.icsZeitpunkt(eRoh.kopf, eRoh.wert) : null;
        let ende = e?.datum || s.datum;
        if (s.nurDatum && e) ende = plusTage(e.datum, -1);
        if (ende < s.datum) ende = s.datum;

        let recurrence: EventRecurrence | undefined;
        const rr = erste('RRULE');
        if (rr) {
          const t = new Map(rr.wert.split(';').map(x => x.split('=')).filter(x => x.length >= 2).map(x => [x[0].toUpperCase(), x.slice(1).join('=')]));
          const f = (t.get('FREQ') || '').toUpperCase();
          const ok = ['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY', 'BIWEEKLY'].includes(f);
          const kompliziert = ['BYSETPOS', 'BYMONTHDAY', 'BYMONTH', 'BYYEARDAY', 'BYWEEKNO'].some(k => t.has(k)) ||
            (t.get('BYDAY') || '').split(',').some(d => d.trim() !== '' && !/^[A-Z]{2}$/i.test(d.trim()));
          if (!ok || kompliziert) {
            errors.push(`„${titel}“: Die Wiederholung (${rr.wert.slice(0, 40)}) lässt sich nicht abbilden; der Termin wurde ohne Wiederholung übernommen.`);
          } else {
            const iv = Math.max(1, parseInt(t.get('INTERVAL') || '1', 10) || 1);
            const frequenz = (f === 'BIWEEKLY' ? 'weekly' : f.toLowerCase()) as EventRecurrence['frequency'];
            recurrence = { frequency: frequenz, interval: f === 'BIWEEKLY' ? iv * 2 : iv, endType: 'never' };
            if (frequenz === 'weekly') {
              const tage = (t.get('BYDAY') || '').split(',').map(d => TAGCODES.indexOf(d.trim().toUpperCase())).filter(i => i >= 0);
              recurrence.daysOfWeek = tage.length ? tage : [wochentag(s.datum)];
            }
            const anzahl = parseInt(t.get('COUNT') || '', 10);
            const bis = /^(\d{4})(\d{2})(\d{2})/.exec(t.get('UNTIL') || '');
            if (anzahl > 0) {
              recurrence.endType = 'count';
              recurrence.count = anzahl;
            } else if (bis) {
              recurrence.endType = 'until_date';
              recurrence.untilDate = `${bis[1]}-${bis[2]}-${bis[3]}`;
            }
          }
        }
        // Ausgenommene Tage (EXDATE, auch mehrfach und mit Komma getrennt)
        const ausnahmen = eig
          .filter(p => p.kopf[0].toUpperCase() === 'EXDATE')
          .flatMap(p => p.wert.split(',').map(w => this.icsZeitpunkt(p.kopf, w)?.datum))
          .filter((d): d is string => !!d);
        if (ausnahmen.length && recurrence) recurrence.exceptionDates = [...new Set(ausnahmen)].sort();

        const geo = erste('GEO')?.wert.split(';').map(Number);
        const uid = (erste('UID')?.wert || '').trim();
        const id = uid ? (uid.endsWith(UID_ENDUNG) ? uid.slice(0, -UID_ENDUNG.length) : uid) : `evt-import-${jetzt.getTime()}-${nr}`;
        const kat = erste('CATEGORIES') ? this.icsEntmaskieren(erste('CATEGORIES')!.wert).split(',')[0] : '';
        const termin: CalendarEvent = {
          id,
          title: titel,
          description: erste('DESCRIPTION') ? this.icsEntmaskieren(erste('DESCRIPTION')!.wert).trim() || undefined : undefined,
          categoryId: this.artFinden(kat, existingCategories),
          department: 'all',
          startDate: s.datum,
          startTime: s.nurDatum ? undefined : s.zeit,
          endDate: ende,
          endTime: s.nurDatum || !e || e.nurDatum ? undefined : e.zeit,
          isAllDay: s.nurDatum,
          location: erste('LOCATION') ? this.icsEntmaskieren(erste('LOCATION')!.wert).trim() || undefined : undefined,
          participants: [],
          createdAt: stempel,
          updatedAt: stempel
        };
        if (geo && geo.length === 2 && geo.every(Number.isFinite)) {
          termin.locationLat = geo[0];
          termin.locationLng = geo[1];
        }
        if (recurrence) termin.recurrence = recurrence;
        events.push(termin);
        continue;
      }
      if (!drin) continue;
      const i = zeile.indexOf(':');
      if (i < 0) continue;
      const kopf = zeile.slice(0, i).split(';');
      if (kopf[0].toUpperCase() === 'ATTENDEE') teilnehmer++;
      eig.push({ kopf, wert: zeile.slice(i + 1) });
    }
    if (teilnehmer > 0) errors.push(`Teilnehmerlisten (${teilnehmer} Einträge) werden nicht übernommen.`);
    return { events, errors };
  }

  /** Terminart nach Name (genau, sonst enthalten), sonst „Allgemeiner Termin“. */
  private static artFinden(roh: string, arten: CalendarEventCategory[]): string {
    const r = roh.trim().toLowerCase();
    if (!r) return 'cat-general';
    const genau = arten.find(a => a.name.toLowerCase() === r);
    if (genau) return genau.id;
    return arten.find(a => a.name.toLowerCase().includes(r) || r.includes(a.name.toLowerCase()))?.id || 'cat-general';
  }

  /**
   * Trennt gelesene Termine in neue und schon vorhandene (gleiche Kennung
   * oder gleicher Titel, gleicher Tag und gleiche Uhrzeit). Vorher wurden
   * vorhandene beim zweiten Import doppelt angelegt bzw. überschrieben.
   */
  static trenneNeueTermine(gelesen: CalendarEvent[], vorhandene: CalendarEvent[]): { neu: CalendarEvent[]; vorhanden: CalendarEvent[] } {
    const ids = new Set(vorhandene.map(e => e.id));
    const schluessel = new Set(vorhandene.map(e => `${e.title.trim().toLowerCase()}|${e.startDate}|${e.startTime || ''}`));
    const neu: CalendarEvent[] = [];
    const vorhanden: CalendarEvent[] = [];
    for (const e of gelesen) {
      const k = `${e.title.trim().toLowerCase()}|${e.startDate}|${e.startTime || ''}`;
      if (ids.has(e.id) || schluessel.has(k)) vorhanden.push(e);
      else {
        neu.push(e);
        ids.add(e.id);
        schluessel.add(k);
      }
    }
    return { neu, vorhanden };
  }

  // =========================================================================
  // CSV EXPORT & IMPORT
  // =========================================================================

  /**
   * Export CalendarEvents to CSV
   */
  static exportToCsv(
    events: CalendarEvent[],
    categories: CalendarEventCategory[] = []
  ): string {
    const categoryMap = new Map<string, string>();
    categories.forEach((c) => categoryMap.set(c.id, c.name));

    const rows = events.map((e) => {
      const catName = categoryMap.get(e.categoryId) || 'Allgemein';
      const STATUS: Record<string, string> = { invited: 'Eingeladen', confirmed: 'Zugesagt', declined: 'Abgesagt', attended: 'Teilgenommen' };
      const participantNames = (e.participants || []).map((p) => `${p.memberName} (${STATUS[p.status] || p.status})`).join('; ');
      const recText = serieText(e.recurrence);

      return {
        'Titel': e.title,
        'Kategorie': catName,
        'Abteilung': e.department === 'all' ? 'Alle Abteilungen' : e.department || '',
        'Startdatum': e.startDate,
        'Startzeit': e.isAllDay ? 'Ganztägig' : e.startTime || '',
        'Enddatum': e.endDate || e.startDate,
        'Endzeit': e.isAllDay ? 'Ganztägig' : e.endTime || '',
        'Ganztägig': e.isAllDay ? 'Ja' : 'Nein',
        'Ort': e.location || '',
        'Wiederholung': recText,
        'Teilnehmer': participantNames,
        'Beschreibung': e.description || ''
      };
    });

    return Papa.unparse(rows, {
      delimiter: ';',
      header: true
    });
  }

  /**
   * Parse CSV content into CalendarEvents
   */
  static parseCsv(
    csvText: string,
    existingCategories: CalendarEventCategory[] = []
  ): { events: CalendarEvent[]; errors: string[] } {
    const events: CalendarEvent[] = [];
    const errors: string[] = [];

    const categoryMap = new Map<string, string>();
    existingCategories.forEach((c) => categoryMap.set(c.name.toLowerCase(), c.id));

    const result = Papa.parse<Record<string, string>>(csvText, {
      header: true,
      skipEmptyLines: true
    });

    if (result.errors && result.errors.length > 0) {
      result.errors.forEach((err) => errors.push(`Zeile ${err.row}: ${err.message}`));
    }

    result.data.forEach((row, idx) => {
      // Find title column
      const title = row['Titel'] || row['titel'] || row['Title'] || row['Betreff'] || row['Name'] || row['Summary'];
      if (!title) {
        errors.push(`Zeile ${idx + 2}: Kein Titel angegeben`);
        return;
      }

      // Find date columns
      const rawStart = row['Startdatum'] || row['Start Date'] || row['Datum'] || row['Start'] || row['Date'];
      if (!rawStart) {
        errors.push(`Zeile ${idx + 2}: Kein Startdatum angegeben (${title})`);
        return;
      }

      // Datum prüfen statt ungeprüft übernehmen (31.02. oder „morgen“ ergab vorher kaputte Termine)
      const startDate = leseDatum(rawStart);
      if (!startDate) {
        errors.push(`Zeile ${idx + 2} („${title}“) übersprungen: Startdatum „${rawStart}“ ist ungültig.`);
        return;
      }
      const rawEnd = (row['Enddatum'] || row['End Date'] || row['Ende'] || '').trim();
      let endDate = rawEnd ? leseDatum(rawEnd) || startDate : startDate;
      if (endDate < startDate) {
        errors.push(`Zeile ${idx + 2} („${title}“): Das Ende lag vor dem Beginn und wurde auf den Beginn gesetzt.`);
        endDate = startDate;
      }

      const uhrzeit = (v: string | undefined) => {
        const m = /^(\d{1,2})[:.](\d{2})(?:[:.]\d{2})?(?:\s*Uhr)?$/i.exec((v || '').trim());
        return m && +m[1] <= 23 && +m[2] <= 59 ? `${m[1].padStart(2, '0')}:${m[2]}` : undefined;
      };
      const rohStart = row['Startzeit'] || row['Start Time'] || row['Uhrzeit'] || '';
      const isAllDay = (row['Ganztägig'] || '').toLowerCase().startsWith('j') || (row['All Day'] || '').toLowerCase() === 'true' || rohStart.toLowerCase().startsWith('ganzt');
      const startTime = isAllDay ? undefined : uhrzeit(rohStart);
      const endTime = isAllDay ? undefined : uhrzeit(row['Endzeit'] || row['End Time']);
      if (!isAllDay && rohStart && !startTime) errors.push(`Zeile ${idx + 2} („${title}“): Startzeit „${rohStart}“ nicht lesbar, der Termin hat keine Uhrzeit.`);
      const location = row['Ort'] || row['Location'] || row['Adresse'] || '';
      const description = row['Beschreibung'] || row['Description'] || row['Notizen'] || '';
      const rohSparte = (row['Abteilung'] || row['Department'] || '').trim();
      const department = !rohSparte || rohSparte.toLowerCase().startsWith('alle') ? 'all' : rohSparte;

      // Category matching
      const rawCat = (row['Kategorie'] || row['Category'] || '').toLowerCase().trim();
      let categoryId = 'cat-general';
      if (rawCat && categoryMap.has(rawCat)) {
        categoryId = categoryMap.get(rawCat)!;
      } else if (rawCat) {
        const match = existingCategories.find((c) => c.name.toLowerCase().includes(rawCat) || rawCat.includes(c.name.toLowerCase()));
        if (match) categoryId = match.id;
      }

      events.push({
        id: `evt-csv-${Date.now()}-${idx}`,
        title: title.trim(),
        description: description.trim(),
        categoryId,
        department,
        startDate,
        startTime,
        endDate,
        endTime,
        isAllDay,
        location: location.trim() || undefined,
        participants: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    });

    return { events, errors };
  }

  // =========================================================================
  // PARTICIPANT INVITATION & EMAIL / SHARE
  // =========================================================================

  /**
   * `mailto:`-Link für die Einladung. Alle Empfänger stehen in der
   * Blindkopie; der Text nennt keine Teilnehmer, das Datum steht deutsch, der
   * Vereinsname kommt aus den Einstellungen (D-114).
   */
  static generateMailtoLink(event: CalendarEvent, clubName = ''): string {
    const an = empfaenger(event);
    const subject = encodeURIComponent(einladungsBetreff(event, clubName));
    const body = encodeURIComponent(einladungsText(event, clubName));
    return an.length ? `mailto:?bcc=${an.join(',')}&subject=${subject}&body=${body}` : `mailto:?subject=${subject}&body=${body}`;
  }

  /** Text für Nachrichten-Apps oder den Newsletter, ohne Namen der Teilnehmer (D-114). */
  static generateShareableText(event: CalendarEvent, clubName = ''): string {
    return einladungsText(event, clubName);
  }
}
