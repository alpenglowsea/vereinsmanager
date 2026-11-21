/**
 * Rechenregeln des Kalenders (P19), wie die Android-Fassung (`Kalender.kt`).
 *
 * Alle Daten sind Texte der Form JJJJ-MM-TT und werden ohne Uhrzeit und ohne
 * Zeitzone gerechnet. Vorher rechnete der Desktop mit `Date`-Objekten und
 * `setMonth`; dabei sprang der 31. eines Monats plus ein Monat in den
 * übernächsten Monat (D-107, D-108).
 */
import type { CalendarEvent, EventParticipant, EventRecurrence, Member, SpecialCalendarItem } from '../types';

export interface Vorkommen {
  instanceId: string;
  originalEvent: CalendarEvent;
  /** Erster Tag dieses Vorkommens. */
  date: string;
  /** Letzter Tag (bei mehrtägigen Terminen später als `date`). */
  endDate: string;
  startTime?: string;
  endTime?: string;
  isAllDay: boolean;
  isRecurrenceInstance: boolean;
}

const pad = (n: number) => String(n).padStart(2, '0');

export const istSchaltjahr = (j: number) => (j % 4 === 0 && j % 100 !== 0) || j % 400 === 0;

/** Tage im Monat; `m` von 1 bis 12. */
export function tageImMonat(j: number, m: number): number {
  return [31, istSchaltjahr(j) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
}

function teile(iso: string): [number, number, number] | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  if (!m) return null;
  const j = +m[1], mo = +m[2], t = +m[3];
  if (mo < 1 || mo > 12 || t < 1 || t > tageImMonat(j, mo)) return null;
  return [j, mo, t];
}

export const istDatum = (iso: string) => teile(iso) !== null;

const iso = (j: number, m: number, t: number) => `${j}-${pad(m)}-${pad(t)}`;

/** Tage seit 1970 (für Abstände, ohne Zeitzonen und Sommerzeit). */
function tagNummer(d: string): number {
  const [j, m, t] = teile(d) as [number, number, number];
  return Math.round(Date.UTC(j, m - 1, t) / 86400000);
}

function ausTagNummer(n: number): string {
  const d = new Date(n * 86400000);
  return iso(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

export const plusTage = (d: string, n: number) => ausTagNummer(tagNummer(d) + n);
export const tageZwischen = (von: string, bis: string) => tagNummer(bis) - tagNummer(von);
/** 0 = Sonntag … 6 = Samstag (wie am Desktop gespeichert). */
export const wochentag = (d: string) => ((tagNummer(d) % 7) + 7 + 4) % 7;

/** Monate addieren; ein Tag, den es im Zielmonat nicht gibt, wird der Monatsletzte (31.01. + 1 → 28./29.02.). */
export function plusMonate(d: string, n: number): string {
  const [j, m, t] = teile(d) as [number, number, number];
  const gesamt = j * 12 + (m - 1) + n;
  const zj = Math.floor(gesamt / 12);
  const zm = (gesamt % 12) + 1;
  return iso(zj, zm, Math.min(t, tageImMonat(zj, zm)));
}

export const plusJahre = (d: string, n: number) => plusMonate(d, n * 12);

/** Für die Monatsansicht: gleicher Tag im Nachbarmonat, höchstens der Monatsletzte (D-107). */
export function monatVerschieben(d: Date, delta: number): Date {
  const gesamt = d.getFullYear() * 12 + d.getMonth() + delta;
  const j = Math.floor(gesamt / 12);
  const m = gesamt % 12;
  return new Date(j, m, Math.min(d.getDate(), tageImMonat(j, m + 1)));
}

/** Heute in Ortszeit (nicht UTC: kurz nach Mitternacht wäre es sonst noch „gestern“, D-112). */
export function heuteIso(jetzt: Date = new Date()): string {
  return iso(jetzt.getFullYear(), jetzt.getMonth() + 1, jetzt.getDate());
}

export interface Serie {
  frequenz: 'daily' | 'weekly' | 'monthly' | 'yearly';
  intervall: number;
  wochentage: number[];
  endeArt: 'never' | 'until_date' | 'count';
  bis: string;
  anzahl: number;
  /** Ausgenommene Tage (EXDATE). */
  ausnahmen: string[];
}

/** Liest die gespeicherte Wiederholung; „biweekly“ (alter Desktop) wird zu wöchentlich mit doppeltem Intervall. */
export function normiereSerie(r: EventRecurrence | undefined | null): Serie | null {
  if (!r || !r.frequency || r.frequency === 'none') return null;
  const iv = Math.max(1, Math.floor(Number(r.interval) || 1));
  const frequenz = r.frequency === 'biweekly' ? 'weekly' : r.frequency;
  if (!['daily', 'weekly', 'monthly', 'yearly'].includes(frequenz)) return null;
  return {
    frequenz: frequenz as Serie['frequenz'],
    intervall: r.frequency === 'biweekly' ? iv * 2 : iv,
    wochentage: (r.daysOfWeek || []).filter(n => Number.isInteger(n) && n >= 0 && n <= 6),
    endeArt: r.endType || 'never',
    bis: r.untilDate || '',
    anzahl: Math.max(0, Math.floor(Number(r.count) || 0)),
    ausnahmen: (r.exceptionDates || []).filter(istDatum)
  };
}

const montagsFolge = (tag: number) => (tag + 6) % 7;

/**
 * Starttage einer Serie bis `grenze`, in zeitlicher Reihenfolge. Jedes
 * Vorkommen wird aus dem ersten Termin berechnet, nicht aus dem vorigen:
 * Eine Monatsserie am 31. bleibt beim Monatsletzten, eine Jahresserie am
 * 29.02. fällt in anderen Jahren auf den 28.02. (D-108). Das Intervall gilt
 * für alle Arten, auch bei mehreren Wochentagen (D-109).
 */
export function serienTage(start: string, s: Serie, grenze: string, hoechstens = 20000): string[] {
  const out: string[] = [];
  if (!istDatum(start) || !istDatum(grenze)) return out;
  const iv = Math.max(1, s.intervall);
  const limit = s.endeArt === 'count' ? Math.min(Math.max(1, s.anzahl), hoechstens) : hoechstens;
  const bis = s.endeArt === 'until_date' && istDatum(s.bis) && s.bis < grenze ? s.bis : grenze;
  const add = (d: string) => {
    out.push(d);
    return out.length >= limit;
  };
  if (s.frequenz === 'weekly') {
    const tage = [...new Set(s.wochentage.length ? s.wochentage : [wochentag(start)])].sort((a, b) => montagsFolge(a) - montagsFolge(b));
    const montag = plusTage(start, -montagsFolge(wochentag(start)));
    for (let w = 0; ; w++) {
      const wm = plusTage(montag, w * 7 * iv);
      if (wm > bis) break;
      for (const tag of tage) {
        const d = plusTage(wm, montagsFolge(tag));
        if (d < start || d > bis) continue;
        if (add(d)) return out;
      }
    }
    return out;
  }
  for (let k = 0; ; k++) {
    const d = s.frequenz === 'daily' ? plusTage(start, k * iv) : s.frequenz === 'monthly' ? plusMonate(start, k * iv) : plusJahre(start, k * iv);
    if (d > bis) break;
    if (add(d)) break;
  }
  return out;
}

/**
 * Alle Vorkommen im Zeitraum `von` … `bis` (einschließlich). Mehrtägige
 * Termine erscheinen auch dann, wenn sie vor dem Zeitraum beginnen (D-110).
 */
export function vorkommen(events: CalendarEvent[], von: string, bis: string): Vorkommen[] {
  const out: Vorkommen[] = [];
  for (const e of events) {
    if (!istDatum(e.startDate)) continue;
    const ende = istDatum(e.endDate) && e.endDate >= e.startDate ? e.endDate : e.startDate;
    const dauer = tageZwischen(e.startDate, ende);
    const s = normiereSerie(e.recurrence);
    // Ausgenommene Tage zählen bei „Ende nach n Mal“ mit (wie iCal): die Serie
    // wird erst gebildet, dann werden die Ausnahmen herausgenommen
    const aus = new Set(s?.ausnahmen || []);
    const tage = s ? serienTage(e.startDate, s, bis).filter(d => !aus.has(d)) : [e.startDate];
    for (const d of tage) {
      const de = dauer ? plusTage(d, dauer) : d;
      if (d > bis || de < von) continue;
      out.push({
        instanceId: `${e.id}_${d}`,
        originalEvent: e,
        date: d,
        endDate: de,
        startTime: e.startTime,
        endTime: e.endTime,
        isAllDay: e.isAllDay,
        isRecurrenceInstance: d !== e.startDate
      });
    }
  }
  return out.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    if (a.isAllDay !== b.isAllDay) return a.isAllDay ? -1 : 1;
    return (a.startTime || '').localeCompare(b.startTime || '') || a.originalEvent.title.localeCompare(b.originalEvent.title, 'de');
  });
}

/** Findet das Vorkommen an diesem Tag statt? Auch mehrtägige, die schon laufen (D-110). */
export const amTag = (v: { date: string; endDate: string }, tag: string) => v.date <= tag && tag <= v.endDate;

const RUNDE_GEBURTSTAGE = new Set([18, 30, 40, 50, 60, 65, 70, 75, 80, 85, 90, 95, 100]);
const RUNDE_JUBILAEEN = new Set([10, 20, 25, 30, 40, 50, 60, 70]);

/** Der Jahrestag im Jahr `jahr`; der 29.02. ist in Jahren ohne Schalttag der 28.02. (D-111). */
export function jahrestag(datum: string, jahr: number): string | null {
  const t = teile(datum);
  if (!t) return null;
  return iso(jahr, t[1], Math.min(t[2], tageImMonat(jahr, t[1])));
}

/**
 * Geburtstage und Vereinsjubiläen (ab 5 Jahren) der nicht ausgetretenen
 * Mitglieder im Zeitraum, auch über den Jahreswechsel (die Monatsansicht im
 * Dezember zeigt die ersten Januartage mit, D-111).
 */
export function besondereTage(members: Member[], von: string, bis: string): SpecialCalendarItem[] {
  const out: SpecialCalendarItem[] = [];
  if (!istDatum(von) || !istDatum(bis)) return out;
  const deutsch = (d: string) => d.split('-').reverse().join('.');
  for (let jahr = +von.slice(0, 4); jahr <= +bis.slice(0, 4); jahr++) {
    for (const m of members) {
      if (m.status === 'terminated') continue;
      const name = `${m.firstName || ''} ${m.lastName || ''}`.trim();
      const geb = m.birthDate ? teile(m.birthDate) : null;
      if (geb) {
        const alter = jahr - geb[0];
        const tag = jahrestag(m.birthDate as string, jahr);
        if (alter > 0 && tag && tag >= von && tag <= bis) {
          const rund = RUNDE_GEBURTSTAGE.has(alter);
          out.push({
            id: `bday-${m.id}-${jahr}`,
            type: 'birthday',
            title: `${name} (${alter}. Geburtstag)${rund ? ' 🎂' : ''}`,
            date: tag,
            memberId: m.id,
            memberName: name,
            memberDepartment: m.department,
            years: alter,
            isMilestone: rund,
            details: rund ? `Runder Geburtstag: ${alter} Jahre (${m.department})` : `${alter}. Geburtstag (${m.department})`
          });
        }
      }
      const ein = m.entryDate ? teile(m.entryDate) : null;
      if (ein) {
        const jahre = jahr - ein[0];
        const tag = jahrestag(m.entryDate as string, jahr);
        if (jahre >= 5 && tag && tag >= von && tag <= bis) {
          const rund = RUNDE_JUBILAEEN.has(jahre);
          const zusatz =
            jahre === 25 ? ' (Silbernes Jubiläum 🥈)'
              : jahre === 50 ? ' (Goldenes Jubiläum 🥇)'
                : jahre === 60 ? ' (Diamant-Jubiläum 💎)'
                  : rund ? ` (${jahre} Jahre Jubiläum 🎖️)`
                    : ` (${jahre} Jahre im Verein)`;
          out.push({
            id: `anniv-${m.id}-${jahr}`,
            type: 'anniversary',
            title: `${name}${zusatz}`,
            date: tag,
            memberId: m.id,
            memberName: name,
            memberDepartment: m.department,
            years: jahre,
            isMilestone: rund,
            details: `${jahre} Jahre Vereinszugehörigkeit seit ${deutsch(m.entryDate as string)} (${m.department})`
          });
        }
      }
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title, 'de'));
}

export interface TerminEingabe {
  titel: string;
  beginn: string;
  ende: string;
  ganztaegig: boolean;
  beginnZeit: string;
  endeZeit: string;
  serie: boolean;
  frequenz: string;
  intervall: number | string;
  wochentage: number[];
  endeArt: string;
  bis: string;
  anzahl: number | string;
}

const ZEIT = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Prüft die Eingaben des Terminformulars wie Android (D-112). Schlüssel = Feld, Wert = Meldung. */
export function pruefeTermin(f: TerminEingabe): Record<string, string> {
  const e: Record<string, string> = {};
  if (!f.titel.trim()) e.titel = 'Bitte einen Titel eingeben.';
  if (!istDatum(f.beginn)) e.beginn = 'Bitte ein Datum wählen.';
  if (!istDatum(f.ende)) e.ende = 'Bitte ein Datum wählen.';
  else if (istDatum(f.beginn) && f.ende < f.beginn) e.ende = 'Das Ende liegt vor dem Beginn.';
  if (!f.ganztaegig) {
    if (!ZEIT.test(f.beginnZeit)) e.beginnZeit = 'Uhrzeit als HH:MM, z. B. 18:30.';
    if (f.endeZeit && !ZEIT.test(f.endeZeit)) e.endeZeit = 'Uhrzeit als HH:MM, z. B. 19:30.';
    else if (f.endeZeit && ZEIT.test(f.beginnZeit) && !e.ende && f.beginn === f.ende && f.endeZeit < f.beginnZeit) e.endeZeit = 'Das Ende liegt vor dem Beginn.';
  }
  if (f.serie) {
    const iv = Number(f.intervall);
    if (!Number.isInteger(iv) || iv < 1 || iv > 99) e.intervall = 'Intervall: ganze Zahl von 1 bis 99.';
    if (f.frequenz === 'weekly' && f.wochentage.length === 0) e.wochentage = 'Bitte mindestens einen Wochentag wählen.';
    if (f.endeArt === 'until_date') {
      if (!istDatum(f.bis)) e.bis = 'Bitte ein Enddatum der Serie wählen.';
      else if (istDatum(f.beginn) && f.bis < f.beginn) e.bis = 'Das Enddatum liegt vor dem ersten Termin.';
    }
    if (f.endeArt === 'count') {
      const n = Number(f.anzahl);
      if (!Number.isInteger(n) || n < 1 || n > 999) e.anzahl = 'Anzahl: ganze Zahl von 1 bis 999.';
    }
  }
  return e;
}

/** Jeder Teilnehmer nur einmal (der erste Eintrag zählt, D-112). */
export function ohneDoppelteTeilnehmer(liste: EventParticipant[]): EventParticipant[] {
  const gesehen = new Set<string>();
  return liste.filter(p => (gesehen.has(p.memberId) ? false : (gesehen.add(p.memberId), true)));
}

// ---------- Texte ----------

const TAGE_KURZ = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

/** „Do, 12.11.2026“ */
export function datumKurz(d: string): string {
  return istDatum(d) ? `${TAGE_KURZ[wochentag(d)]}, ${d.split('-').reverse().join('.')}` : d;
}

/** „Do, 12.11.2026, 18:00–19:30 Uhr“ bzw. „… bis …“ / „ganztägig“. */
export function zeitText(e: Pick<CalendarEvent, 'startDate' | 'endDate' | 'startTime' | 'endTime' | 'isAllDay'>): string {
  const ende = e.endDate || e.startDate;
  const tage = ende === e.startDate ? datumKurz(e.startDate) : `${datumKurz(e.startDate)} bis ${datumKurz(ende)}`;
  if (e.isAllDay) return `${tage}, ganztägig`;
  const b = e.startTime || '';
  const en = e.endTime || '';
  const zeit = !b ? '' : !en ? `${b} Uhr` : ende === e.startDate ? `${b}–${en} Uhr` : `${b} Uhr bis ${en} Uhr`;
  return zeit ? `${tage}, ${zeit}` : tage;
}

/** Die Wiederholung in Worten: „alle 2 Wochen (Mo, Mi), bis 31.12.2026“. */
export function serieText(r: EventRecurrence | undefined | null): string {
  const s = normiereSerie(r);
  if (!s) return 'Keine';
  const iv = s.intervall;
  let grund: string;
  if (s.frequenz === 'daily') grund = iv === 1 ? 'täglich' : `alle ${iv} Tage`;
  else if (s.frequenz === 'weekly') {
    const tage = [...s.wochentage].sort((a, b) => montagsFolge(a) - montagsFolge(b)).map(t => TAGE_KURZ[t]).join(', ');
    grund = (iv === 1 ? 'wöchentlich' : `alle ${iv} Wochen`) + (tage ? ` (${tage})` : '');
  } else if (s.frequenz === 'monthly') grund = iv === 1 ? 'monatlich' : `alle ${iv} Monate`;
  else grund = iv === 1 ? 'jährlich' : `alle ${iv} Jahre`;
  const ohne = s.ausnahmen.length ? `, ohne ${s.ausnahmen.length === 1 ? s.ausnahmen[0].split('-').reverse().join('.') : `${s.ausnahmen.length} Termine`}` : '';
  if (s.endeArt === 'until_date' && s.bis) return `${grund}, bis ${s.bis.split('-').reverse().join('.')}${ohne}`;
  if (s.endeArt === 'count' && s.anzahl) return `${grund}, ${s.anzahl} Mal${ohne}`;
  return grund + ohne;
}

/**
 * Nimmt einen Tag aus einer Serie heraus („nur diesen Termin löschen“).
 * Ist es der erste Termin der Serie, bleibt der Beginn trotzdem stehen; der
 * Tag wird nur übersprungen.
 */
export function mitAusnahme(e: CalendarEvent, datum: string): CalendarEvent {
  if (!e.recurrence) return e;
  const liste = [...new Set([...(e.recurrence.exceptionDates || []), datum])].sort();
  return { ...e, recurrence: { ...e.recurrence, exceptionDates: liste }, updatedAt: new Date().toISOString() };
}

/**
 * „Nur diesen Termin ändern“: Kopie des Serientermins für den Tag `datum`,
 * ohne Wiederholung, mit Verweis auf die Serie. Gespeichert wird sie als
 * eigener Termin; der Tag fällt dann in der Serie aus (`mitAusnahme`).
 * Gleiches Verfahren wie Android (`Kalender.einzeln`).
 */
export function einzelnAusSerie(e: CalendarEvent, datum: string, neueId: string, jetzt = new Date().toISOString()): CalendarEvent {
  const dauer = Math.max(0, tageZwischen(e.startDate, e.endDate || e.startDate));
  const kopie: CalendarEvent = {
    ...e,
    id: neueId,
    startDate: datum,
    endDate: dauer ? plusTage(datum, dauer) : datum,
    participants: (e.participants || []).map(p => ({ ...p })),
    seriesOrigin: { eventId: e.id, date: datum },
    createdAt: jetzt,
    updatedAt: jetzt
  };
  delete kopie.recurrence;
  return kopie;
}

/** Einzeln geänderte Termine, die aus der Serie `serienId` stammen. */
export function einzelTermine(events: CalendarEvent[], serienId: string): CalendarEvent[] {
  return events.filter(x => x.seriesOrigin?.eventId === serienId);
}

/** Nimmt eine Ausnahme wieder zurück. */
export function ohneAusnahme(e: CalendarEvent, datum: string): CalendarEvent {
  if (!e.recurrence) return e;
  const liste = (e.recurrence.exceptionDates || []).filter(d => d !== datum);
  const r = { ...e.recurrence };
  if (liste.length) r.exceptionDates = liste;
  else delete r.exceptionDates;
  return { ...e, recurrence: r, updatedAt: new Date().toISOString() };
}

/** E-Mail-Adressen der Teilnehmer (nur gültig aussehende, ohne Doppelte). */
export function empfaenger(e: CalendarEvent): string[] {
  return [...new Set((e.participants || []).map(p => (p.memberEmail || '').trim()).filter(m => m.includes('@')))];
}

export function einladungsBetreff(e: CalendarEvent, verein: string): string {
  return `Einladung: ${e.title}` + (verein.trim() ? ` [${verein.trim()}]` : '');
}

/**
 * Einladungstext für Mail oder Nachrichten-Apps. Er nennt bewusst keine
 * Teilnehmer und keine Zusagen (vorher standen Namen und Status aller
 * Eingeladenen darin, und der Text landete z. B. in einer Gruppe, D-114).
 */
export function einladungsText(e: CalendarEvent, verein: string): string {
  const z: string[] = [
    'Liebe Vereinsmitglieder,',
    '',
    'wir laden herzlich zu diesem Vereinstermin ein:',
    '',
    `Termin: ${e.title}`,
    `Wann: ${zeitText(e)}`
  ];
  if (e.location?.trim()) z.push(`Wo: ${e.location.trim()}`);
  if (normiereSerie(e.recurrence)) z.push(`Wiederholung: ${serieText(e.recurrence)}`);
  if (e.description?.trim()) z.push('', e.description.trim());
  z.push('', 'Bitte gebt uns eine kurze Rückmeldung, ob ihr teilnehmen könnt.');
  if (verein.trim()) z.push('', 'Mit freundlichen Grüßen', verein.trim());
  return z.join('\n');
}
