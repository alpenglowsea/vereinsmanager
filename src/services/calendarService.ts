import {
  CalendarEvent,
  CalendarEventCategory,
  EventParticipant,
  EventRecurrence,
  Member,
  SpecialCalendarItem
} from '../types';
import Papa from 'papaparse';

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
    const instances: ExpandedEventInstance[] = [];
    const startDateObj = this.parseLocalDate(rangeStart);
    const endDateObj = this.parseLocalDate(rangeEnd);

    for (const event of events) {
      if (!event.recurrence || event.recurrence.frequency === 'none') {
        // Non-recurring event: check overlap
        if (event.startDate <= rangeEnd && event.endDate >= rangeStart) {
          instances.push({
            instanceId: `${event.id}_${event.startDate}`,
            originalEvent: event,
            date: event.startDate,
            endDate: event.endDate || event.startDate,
            startTime: event.startTime,
            endTime: event.endTime,
            isAllDay: event.isAllDay,
            isRecurrenceInstance: false
          });
        }
      } else {
        // Recurring event: compute occurrences
        const rec = event.recurrence;
        const eventStart = this.parseLocalDate(event.startDate);
        const eventEnd = event.endDate ? this.parseLocalDate(event.endDate) : eventStart;
        const durationDays = Math.max(0, Math.round((eventEnd.getTime() - eventStart.getTime()) / (1000 * 60 * 60 * 24)));

        let cur = new Date(eventStart);
        let count = 0;
        const maxOccurrences = rec.count || 300; // safety ceiling

        // Until date limit
        const untilLimit = rec.untilDate ? this.parseLocalDate(rec.untilDate) : null;

        while (cur <= endDateObj) {
          if (rec.endType === 'count' && count >= maxOccurrences) break;
          if (rec.endType === 'until_date' && untilLimit && cur > untilLimit) break;

          // Check if current date is after or equal to rangeStart and satisfies daysOfWeek
          const curStr = this.formatDate(cur);
          const dayOfWeek = cur.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat

          let matches = true;
          if (rec.frequency === 'weekly' || rec.frequency === 'biweekly') {
            if (rec.daysOfWeek && rec.daysOfWeek.length > 0) {
              matches = rec.daysOfWeek.includes(dayOfWeek);
            }
          }

          if (matches && cur >= eventStart) {
            if (curStr >= rangeStart && curStr <= rangeEnd) {
              const instanceEnd = new Date(cur);
              instanceEnd.setDate(instanceEnd.getDate() + durationDays);
              const instanceEndStr = this.formatDate(instanceEnd);

              instances.push({
                instanceId: `${event.id}_${curStr}`,
                originalEvent: event,
                date: curStr,
                endDate: instanceEndStr,
                startTime: event.startTime,
                endTime: event.endTime,
                isAllDay: event.isAllDay,
                isRecurrenceInstance: count > 0 || curStr !== event.startDate
              });
            }
            count++;
          }

          // Advance current date based on frequency
          if (rec.frequency === 'daily') {
            const step = rec.interval || 1;
            cur.setDate(cur.getDate() + step);
          } else if (rec.frequency === 'weekly') {
            if (rec.daysOfWeek && rec.daysOfWeek.length > 1) {
              // Day-by-day step within week
              cur.setDate(cur.getDate() + 1);
            } else {
              const step = (rec.interval || 1) * 7;
              cur.setDate(cur.getDate() + step);
            }
          } else if (rec.frequency === 'biweekly') {
            const step = (rec.interval || 1) * 14;
            cur.setDate(cur.getDate() + step);
          } else if (rec.frequency === 'monthly') {
            const step = rec.interval || 1;
            cur.setMonth(cur.getMonth() + step);
          } else if (rec.frequency === 'yearly') {
            const step = rec.interval || 1;
            cur.setFullYear(cur.getFullYear() + step);
          } else {
            break;
          }
        }
      }
    }

    // Sort by date, then startTime
    return instances.sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      if (a.isAllDay && !b.isAllDay) return -1;
      if (!a.isAllDay && b.isAllDay) return 1;
      return (a.startTime || '').localeCompare(b.startTime || '');
    });
  }

  /**
   * Compute member birthdays and club anniversaries for a given year / range
   */
  static getSpecialItems(
    members: Member[],
    year: number
  ): SpecialCalendarItem[] {
    const items: SpecialCalendarItem[] = [];
    const milestoneBirthdays = [18, 30, 40, 50, 60, 65, 70, 75, 80, 85, 90, 95, 100];
    const milestoneAnniversaries = [10, 20, 25, 30, 40, 50, 60, 70];

    for (const member of members) {
      if (member.status === 'terminated') continue;

      // 1. Birthday
      if (member.birthDate) {
        const parts = member.birthDate.split('-');
        if (parts.length === 3) {
          const birthYear = parseInt(parts[0], 10);
          const month = parts[1];
          const day = parts[2];
          const age = year - birthYear;

          if (age > 0) {
            const isMilestone = milestoneBirthdays.includes(age);
            const date = `${year}-${month}-${day}`;
            const name = `${member.firstName} ${member.lastName}`.trim();

            items.push({
              id: `bday-${member.id}-${year}`,
              type: 'birthday',
              title: `${name} (${age}. Geburtstag)${isMilestone ? ' 🎂' : ''}`,
              date,
              memberId: member.id,
              memberName: name,
              memberDepartment: member.department,
              years: age,
              isMilestone,
              details: isMilestone
                ? `Runder Geburtstag: ${age} Jahre (${member.membershipType === 'honorary' ? 'Ehrenmitglied' : member.department})`
                : `${age}. Geburtstag (${member.department})`
            });
          }
        }
      }

      // 2. Club Anniversary (Jubiläum)
      if (member.entryDate) {
        const parts = member.entryDate.split('-');
        if (parts.length === 3) {
          const entryYear = parseInt(parts[0], 10);
          const month = parts[1];
          const day = parts[2];
          const years = year - entryYear;

          if (years >= 5) {
            const isMilestone = milestoneAnniversaries.includes(years);
            const date = `${year}-${month}-${day}`;
            const name = `${member.firstName} ${member.lastName}`.trim();

            let titleSuffix = '';
            if (years === 25) titleSuffix = ' (Silbernes Jubiläum 🥈)';
            else if (years === 50) titleSuffix = ' (Goldenes Jubiläum 🥇)';
            else if (years === 60) titleSuffix = ' (Diamant-Jubiläum 💎)';
            else if (isMilestone) titleSuffix = ` (${years} Jahre Jubiläum 🎖️)`;
            else titleSuffix = ` (${years} Jahre TSV)`;

            items.push({
              id: `anniv-${member.id}-${year}`,
              type: 'anniversary',
              title: `${name}${titleSuffix}`,
              date,
              memberId: member.id,
              memberName: name,
              memberDepartment: member.department,
              years,
              isMilestone,
              details: `${years} Jahre Vereinszugehörigkeit seit ${day}.${month}.${entryYear} (${member.department})`
            });
          }
        }
      }
    }

    return items.sort((a, b) => a.date.localeCompare(b.date));
  }

  // =========================================================================
  // iCalendar / ICS EXPORT & IMPORT
  // =========================================================================

  /**
   * Format single date string to iCal date format (YYYYMMDD or YYYYMMDDTHHMMSS)
   */
  private static toIcsDateTime(dateStr: string, timeStr?: string, isAllDay = false): string {
    const cleanDate = dateStr.replace(/-/g, '');
    if (isAllDay || !timeStr) {
      return `VALUE=DATE:${cleanDate}`;
    }
    const cleanTime = timeStr.replace(/:/g, '') + '00';
    return `${cleanDate}T${cleanTime}`;
  }

  /**
   * Escape special characters for iCal strings
   */
  private static escapeIcsText(str: string): string {
    if (!str) return '';
    return str
      .replace(/\\/g, '\\\\')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '');
  }

  /**
   * Generate RFC 5545 compliant iCalendar (.ics) string
   */
  static exportToIcs(
    events: CalendarEvent[],
    categories: CalendarEventCategory[] = [],
    calendarName = 'TSV Musterstadt 1890 e.V. Terminkalender'
  ): string {
    const categoryMap = new Map<string, string>();
    categories.forEach((c) => categoryMap.set(c.id, c.name));

    const lines: string[] = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//VereinsManager Lokal//Terminkalender v1.0//DE',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      `X-WR-CALNAME:${this.escapeIcsText(calendarName)}`,
      'X-WR-TIMEZONE:Europe/Berlin'
    ];

    for (const evt of events) {
      const catName = categoryMap.get(evt.categoryId) || 'Allgemein';
      const uid = evt.id.includes('@') ? evt.id : `${evt.id}@vereinsmanager.lokal`;
      const createdIso = (evt.createdAt ? new Date(evt.createdAt) : new Date())
        .toISOString()
        .replace(/[-:]/g, '')
        .replace(/\.\d{3}/, '');

      lines.push('BEGIN:VEVENT');
      lines.push(`UID:${uid}`);
      lines.push(`DTSTAMP:${createdIso}`);

      if (evt.isAllDay) {
        lines.push(`DTSTART;${this.toIcsDateTime(evt.startDate, undefined, true)}`);
        // For all day events, DTEND is exclusive (next day)
        const nextDay = this.parseLocalDate(evt.endDate || evt.startDate);
        nextDay.setDate(nextDay.getDate() + 1);
        lines.push(`DTEND;${this.toIcsDateTime(this.formatDate(nextDay), undefined, true)}`);
      } else {
        lines.push(`DTSTART:${this.toIcsDateTime(evt.startDate, evt.startTime || '09:00')}`);
        const endDt = evt.endDate || evt.startDate;
        const endTm = evt.endTime || evt.startTime || '10:00';
        lines.push(`DTEND:${this.toIcsDateTime(endDt, endTm)}`);
      }

      lines.push(`SUMMARY:${this.escapeIcsText(evt.title)}`);

      if (evt.description) {
        lines.push(`DESCRIPTION:${this.escapeIcsText(evt.description)}`);
      }

      if (evt.location) {
        lines.push(`LOCATION:${this.escapeIcsText(evt.location)}`);
      }

      if (evt.locationLat && evt.locationLng) {
        lines.push(`GEO:${evt.locationLat.toFixed(6)};${evt.locationLng.toFixed(6)}`);
      }

      lines.push(`CATEGORIES:${this.escapeIcsText(catName)}`);

      // Recurrence rule
      if (evt.recurrence && evt.recurrence.frequency !== 'none') {
        const r = evt.recurrence;
        let rrule = `RRULE:FREQ=${r.frequency.toUpperCase()}`;
        if (r.interval && r.interval > 1) {
          rrule += `;INTERVAL=${r.interval}`;
        }
        if (r.daysOfWeek && r.daysOfWeek.length > 0) {
          const dayCodes = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
          rrule += `;BYDAY=${r.daysOfWeek.map((d) => dayCodes[d]).join(',')}`;
        }
        if (r.endType === 'until_date' && r.untilDate) {
          const cleanUntil = r.untilDate.replace(/-/g, '');
          rrule += `;UNTIL=${cleanUntil}T235959Z`;
        } else if (r.endType === 'count' && r.count) {
          rrule += `;COUNT=${r.count}`;
        }
        lines.push(rrule);
      }

      // Attendees / Participants
      if (evt.participants && evt.participants.length > 0) {
        for (const p of evt.participants) {
          const mail = p.memberEmail || `mitglied-${p.memberId}@verein.local`;
          const role = p.role === 'organizer' ? 'REQ-PARTICIPANT' : 'OPT-PARTICIPANT';
          const partStat = p.status === 'confirmed' ? 'ACCEPTED' : p.status === 'declined' ? 'DECLINED' : 'NEEDS-ACTION';
          lines.push(`ATTENDEE;CN=${this.escapeIcsText(p.memberName)};ROLE=${role};PARTSTAT=${partStat}:mailto:${mail}`);
        }
      }

      lines.push('END:VEVENT');
    }

    lines.push('END:VCALENDAR');
    return lines.join('\r\n');
  }

  /**
   * Export single event to .ics file
   */
  static exportSingleEventIcs(event: CalendarEvent, categories: CalendarEventCategory[] = []): string {
    return this.exportToIcs([event], categories, event.title);
  }

  /**
   * Parse an iCalendar (.ics / .ical) text into CalendarEvents
   */
  static parseIcs(
    icsText: string,
    existingCategories: CalendarEventCategory[] = []
  ): { events: CalendarEvent[]; errors: string[] } {
    const events: CalendarEvent[] = [];
    const errors: string[] = [];

    // Unfold folded lines (lines starting with space or tab)
    const unfolded = icsText.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '');
    const lines = unfolded.split(/\r\n|\r|\n/);

    let inVEvent = false;
    let currentEvent: Partial<CalendarEvent> = {};
    let attendees: EventParticipant[] = [];

    const categoryMap = new Map<string, string>();
    existingCategories.forEach((c) => {
      categoryMap.set(c.name.toLowerCase(), c.id);
    });

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      if (line === 'BEGIN:VEVENT') {
        inVEvent = true;
        currentEvent = {
          id: `evt-import-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          participants: [],
          categoryId: 'cat-general',
          isAllDay: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        attendees = [];
        continue;
      }

      if (line === 'END:VEVENT' && inVEvent) {
        if (currentEvent.title && currentEvent.startDate) {
          if (!currentEvent.endDate) currentEvent.endDate = currentEvent.startDate;
          currentEvent.participants = attendees;
          events.push(currentEvent as CalendarEvent);
        } else {
          errors.push(`Übersprungen: VEVENT ohne Titel oder Startdatum (Zeile ${i})`);
        }
        inVEvent = false;
        currentEvent = {};
        attendees = [];
        continue;
      }

      if (!inVEvent) continue;

      // Parse properties: NAME;PARAM=VAL:VALUE
      const colonIdx = line.indexOf(':');
      if (colonIdx === -1) continue;

      const propHeader = line.substring(0, colonIdx);
      const propValue = line.substring(colonIdx + 1);
      const propName = propHeader.split(';')[0].toUpperCase();

      // Unescape text
      const unescapedVal = propValue
        .replace(/\\n/g, '\n')
        .replace(/\\,/g, ',')
        .replace(/\\;/g, ';')
        .replace(/\\\\/g, '\\');

      switch (propName) {
        case 'UID':
          currentEvent.id = propValue.trim();
          break;

        case 'SUMMARY':
          currentEvent.title = unescapedVal.trim();
          break;

        case 'DESCRIPTION':
          currentEvent.description = unescapedVal.trim();
          break;

        case 'LOCATION':
          currentEvent.location = unescapedVal.trim();
          break;

        case 'GEO': {
          const [latStr, lngStr] = propValue.split(';');
          if (latStr && lngStr) {
            currentEvent.locationLat = parseFloat(latStr);
            currentEvent.locationLng = parseFloat(lngStr);
          }
          break;
        }

        case 'CATEGORIES': {
          const rawCat = unescapedVal.split(',')[0].trim().toLowerCase();
          const matchedId = categoryMap.get(rawCat);
          if (matchedId) {
            currentEvent.categoryId = matchedId;
          } else {
            // Find closest or default
            const found = existingCategories.find((c) => c.name.toLowerCase().includes(rawCat) || rawCat.includes(c.name.toLowerCase()));
            currentEvent.categoryId = found ? found.id : 'cat-general';
          }
          break;
        }

        case 'DTSTART': {
          const isDateOnly = propHeader.toUpperCase().includes('VALUE=DATE') || !propValue.includes('T');
          if (isDateOnly) {
            const raw = propValue.replace(/[^0-9]/g, '');
            if (raw.length >= 8) {
              currentEvent.startDate = `${raw.substring(0, 4)}-${raw.substring(4, 6)}-${raw.substring(6, 8)}`;
              currentEvent.isAllDay = true;
            }
          } else {
            // DateTime e.g. 20260815T143000Z or 20260815T143000
            const [dPart, tPart] = propValue.split('T');
            const cleanD = dPart.replace(/[^0-9]/g, '');
            if (cleanD.length >= 8) {
              currentEvent.startDate = `${cleanD.substring(0, 4)}-${cleanD.substring(4, 6)}-${cleanD.substring(6, 8)}`;
            }
            if (tPart) {
              const cleanT = tPart.replace(/[^0-9]/g, '');
              if (cleanT.length >= 4) {
                currentEvent.startTime = `${cleanT.substring(0, 2)}:${cleanT.substring(2, 4)}`;
              }
            }
          }
          break;
        }

        case 'DTEND': {
          const isDateOnly = propHeader.toUpperCase().includes('VALUE=DATE') || !propValue.includes('T');
          if (isDateOnly) {
            const raw = propValue.replace(/[^0-9]/g, '');
            if (raw.length >= 8) {
              currentEvent.endDate = `${raw.substring(0, 4)}-${raw.substring(4, 6)}-${raw.substring(6, 8)}`;
            }
          } else {
            const [dPart, tPart] = propValue.split('T');
            const cleanD = dPart.replace(/[^0-9]/g, '');
            if (cleanD.length >= 8) {
              currentEvent.endDate = `${cleanD.substring(0, 4)}-${cleanD.substring(4, 6)}-${cleanD.substring(6, 8)}`;
            }
            if (tPart) {
              const cleanT = tPart.replace(/[^0-9]/g, '');
              if (cleanT.length >= 4) {
                currentEvent.endTime = `${cleanT.substring(0, 2)}:${cleanT.substring(2, 4)}`;
              }
            }
          }
          break;
        }

        case 'RRULE': {
          // Parse RRULE:FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,WE
          const rruleParts = propValue.split(';');
          const rec: EventRecurrence = {
            frequency: 'none',
            interval: 1,
            endType: 'never'
          };

          for (const part of rruleParts) {
            const [k, v] = part.split('=');
            if (!k || !v) continue;
            const key = k.toUpperCase();
            const val = v.toUpperCase();

            if (key === 'FREQ') {
              if (val === 'DAILY') rec.frequency = 'daily';
              else if (val === 'WEEKLY') rec.frequency = 'weekly';
              else if (val === 'MONTHLY') rec.frequency = 'monthly';
              else if (val === 'YEARLY') rec.frequency = 'yearly';
            } else if (key === 'INTERVAL') {
              rec.interval = parseInt(val, 10) || 1;
            } else if (key === 'COUNT') {
              rec.endType = 'count';
              rec.count = parseInt(val, 10);
            } else if (key === 'UNTIL') {
              rec.endType = 'until_date';
              const cleanU = val.replace(/[^0-9]/g, '');
              if (cleanU.length >= 8) {
                rec.untilDate = `${cleanU.substring(0, 4)}-${cleanU.substring(4, 6)}-${cleanU.substring(6, 8)}`;
              }
            } else if (key === 'BYDAY') {
              const dayMap: Record<string, number> = {
                SU: 0,
                MO: 1,
                TU: 2,
                WE: 3,
                TH: 4,
                FR: 5,
                SA: 6
              };
              rec.daysOfWeek = val
                .split(',')
                .map((d) => dayMap[d.trim()])
                .filter((n) => typeof n === 'number');
            }
          }

          if (rec.frequency !== 'none') {
            currentEvent.recurrence = rec;
          }
          break;
        }

        case 'ATTENDEE': {
          // CN=Max Mustermann;ROLE=...:mailto:email
          let cn = '';
          const cnMatch = propHeader.match(/CN=([^;:]+)/i);
          if (cnMatch) cn = cnMatch[1].replace(/["']/g, '');

          let email = '';
          if (propValue.toLowerCase().startsWith('mailto:')) {
            email = propValue.substring(7).trim();
          }

          attendees.push({
            memberId: `att-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            memberName: cn || email || 'Teilnehmer',
            memberEmail: email || undefined,
            role: 'participant',
            status: 'invited'
          });
          break;
        }
      }
    }

    return { events, errors };
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
      const participantNames = e.participants.map((p) => `${p.memberName} (${p.status})`).join('; ');
      let recText = 'Keine';
      if (e.recurrence && e.recurrence.frequency !== 'none') {
        recText = `${e.recurrence.frequency} (Intervall: ${e.recurrence.interval || 1})`;
      }

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

      // Clean date format (handle YYYY-MM-DD or DD.MM.YYYY)
      let startDate = rawStart.trim();
      if (startDate.includes('.')) {
        const parts = startDate.split('.');
        if (parts.length === 3) {
          startDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }
      }

      let endDate = row['Enddatum'] || row['End Date'] || row['Ende'] || startDate;
      if (endDate.includes('.')) {
        const parts = endDate.split('.');
        if (parts.length === 3) {
          endDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }
      }

      const isAllDay = (row['Ganztägig'] || '').toLowerCase().startsWith('j') || (row['All Day'] || '').toLowerCase() === 'true';
      const startTime = isAllDay ? undefined : row['Startzeit'] || row['Start Time'] || row['Uhrzeit'] || undefined;
      const endTime = isAllDay ? undefined : row['Endzeit'] || row['End Time'] || undefined;
      const location = row['Ort'] || row['Location'] || row['Adresse'] || '';
      const description = row['Beschreibung'] || row['Description'] || row['Notizen'] || '';
      const department = row['Abteilung'] || row['Department'] || 'all';

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
        startTime: startTime ? startTime.trim() : undefined,
        endDate,
        endTime: endTime ? endTime.trim() : undefined,
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
   * Generate `mailto:` link for inviting participants via email
   */
  static generateMailtoLink(
    event: CalendarEvent,
    clubName = 'TSV Musterstadt 1890 e.V.'
  ): string {
    const emails = event.participants
      .map((p) => p.memberEmail)
      .filter((e): e is string => Boolean(e && e.includes('@')));

    const timeStr = event.isAllDay
      ? 'Ganztägig'
      : `${event.startTime || 'Beginn'} - ${event.endTime || 'Ende'} Uhr`;

    const dateStr = event.startDate === event.endDate || !event.endDate
      ? event.startDate
      : `${event.startDate} bis ${event.endDate}`;

    const subject = encodeURIComponent(`Einladung: ${event.title} [${clubName}]`);

    const bodyText = [
      `Liebe Vereinsmitglieder,`,
      ``,
      `wir laden herzlich zum folgenden Vereinstermin ein:`,
      ``,
      `📅 Termin: ${event.title}`,
      `📆 Datum: ${dateStr}`,
      `⏰ Uhrzeit: ${timeStr}`,
      event.location ? `📍 Ort: ${event.location}` : '',
      event.description ? `\n📝 Details:\n${event.description}\n` : '',
      `Bitte geben Sie uns eine kurze Rückmeldung, ob Sie teilnehmen können.`,
      ``,
      `Mit sportlichen Grüßen,`,
      `${clubName}`
    ]
      .filter((line) => line !== undefined)
      .join('\n');

    const body = encodeURIComponent(bodyText);

    // If multiple emails, use bcc for privacy (DSGVO compliant)
    if (emails.length === 1) {
      return `mailto:${emails[0]}?subject=${subject}&body=${body}`;
    } else if (emails.length > 1) {
      return `mailto:?bcc=${emails.join(',')}&subject=${subject}&body=${body}`;
    } else {
      return `mailto:?subject=${subject}&body=${body}`;
    }
  }

  /**
   * Generate clean formatted text for WhatsApp, Messenger, or Newsletter
   */
  static generateShareableText(
    event: CalendarEvent,
    clubName = 'TSV Musterstadt 1890 e.V.'
  ): string {
    const timeStr = event.isAllDay
      ? 'Ganztägig'
      : `${event.startTime || 'Beginn'} - ${event.endTime || 'Ende'} Uhr`;

    const dateStr = event.startDate === event.endDate || !event.endDate
      ? event.startDate
      : `${event.startDate} bis ${event.endDate}`;

    const lines = [
      `🌟 *${event.title}* [${clubName}]`,
      `📅 Datum: ${dateStr}`,
      `⏰ Uhrzeit: ${timeStr}`,
      event.location ? `📍 Ort: ${event.location}` : '',
      event.location ? `🗺️ OpenStreetMap: https://www.openstreetmap.org/search?query=${encodeURIComponent(event.location)}` : '',
      event.description ? `\n📝 Beschreibung:\n${event.description}` : '',
      event.participants && event.participants.length > 0
        ? `\n👥 Teilnehmer (${event.participants.length}):\n${event.participants.map((p) => `• ${p.memberName} (${p.status === 'confirmed' ? 'Zugesagt' : p.status === 'declined' ? 'Abgesagt' : 'Eingeladen'})`).join('\n')}`
        : ''
    ];

    return lines.filter(Boolean).join('\n');
  }
}
