/**
 * Regeln für Sitzungen und Protokolle (P21/P22), wie Android `Sitzungen.kt`.
 *
 * Hier steht alles, was sich ohne Fenster prüfen lässt: Pflichtangaben,
 * Stimmen, Unterschriften mit Fingerabdruck, Kennzahlen, Voraussetzungen für
 * Einladung und Registerauszug, Mailtext. Die Fenster rufen nur diese
 * Funktionen auf, damit Desktop und Handy dieselben Entscheidungen treffen.
 */
import {
  ClubDocument,
  Meeting,
  MeetingAgendaItem,
  MeetingDigitalSignature,
  MeetingResolution,
  MeetingStatus,
  MeetingType
} from '../types';
import { sha256Hex } from './sha256';

export const SITZUNGSARTEN: Record<MeetingType, string> = {
  board: 'Vorstandssitzung',
  general_assembly: 'Mitgliederversammlung',
  extraordinary_assembly: 'Außerordentliche Mitgliederversammlung',
  committee: 'Ausschuss / Fachbereich / Beirat',
  department: 'Abteilungsversammlung',
  other: 'Sonstige Sitzung'
};

export const SITZUNGSSTATUS: Record<MeetingStatus, string> = {
  scheduled: 'Einberufen / geplant',
  in_progress: 'In Durchführung',
  draft: 'Protokoll im Entwurf',
  review: 'In Vorprüfung',
  approved: 'Genehmigt',
  cancelled: 'Abgesagt'
};

/** „Genehmigt“ ergibt sich aus den beiden Unterschriften und wird nicht von Hand gewählt. */
export const STATUS_WAHL = (Object.keys(SITZUNGSSTATUS) as MeetingStatus[]).filter(s => s !== 'approved');

export const ERGEBNISSE: Record<MeetingResolution['result'], string> = {
  accepted: 'Angenommen',
  rejected: 'Abgelehnt',
  deferred: 'Vertagt'
};

export const ROLLE_LEITUNG = 'Versammlungsleiter';
export const ROLLE_SCHRIFT = 'Schriftführer';

export const GESPERRT =
  'Das Protokoll ist unterschrieben und gesperrt. Entfernen Sie zuerst die Unterschriften, wenn Sie es ändern wollen.';

export const artName = (a: string): string => SITZUNGSARTEN[a as MeetingType] ?? 'Sitzung';
export const statusName = (s: string): string => SITZUNGSSTATUS[s as MeetingStatus] ?? s;
export const istVersammlung = (m: Pick<Meeting, 'type'>): boolean =>
  m.type === 'general_assembly' || m.type === 'extraordinary_assembly';

const istDatum = (d: string | undefined): boolean => !!d && /^\d{4}-\d{2}-\d{2}$/.test(d) && !isNaN(Date.parse(d + 'T00:00:00Z'));
const istZeit = (t: string | undefined): boolean => !!t && /^([01]\d|2[0-3]):[0-5]\d$/.test(t);
const istGanzzahl = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 0;

/** „13.11.2026“ */
export const deutsch = (iso: string | undefined): string => (iso && istDatum(iso.slice(0, 10)) ? iso.slice(0, 10).split('-').reverse().join('.') : iso || '');

/**
 * Ort für „Ort, den …“ aus der Vereinsadresse: die Stadt ohne Postleitzahl.
 * Ohne erkennbaren Ort leer (vorher stand dann „Musterstadt“ im Dokument).
 */
export function ortDesVereins(adresse: { city?: string } | string | undefined | null): string {
  if (!adresse) return '';
  if (typeof adresse !== 'string') return (adresse.city || '').trim();
  if (!adresse.includes(',')) return '';
  return (adresse.split(',').pop() || '').replace(/^\s*\d{4,5}\s+/, '').trim();
}

// ---------- Unterschriften

/**
 * Gehört die Unterschrift der Versammlungsleitung? Erkannt an der gespeicherten
 * Rolle, wie Android. „leitung“ kommt hinzu, weil der Desktop früher
 * „Versammlungsleitung gem. Satzung“ schrieb. Kein Abgleich über Namen und
 * keine Annahme „die erste Unterschrift ist die Leitung“ mehr (alte Regel).
 */
export const istLeitung = (rolle: string | undefined): boolean => {
  const r = (rolle || '').toLowerCase();
  return r.includes('leiter') || r.includes('leitung') || r.includes('vorsitz');
};
export const istSchrift = (rolle: string | undefined): boolean => {
  const r = (rolle || '').toLowerCase();
  return !istLeitung(rolle) && (r.includes('schrift') || r.includes('protokoll'));
};

export const leitungsUnterschrift = (m: Pick<Meeting, 'signatures'>) => (m.signatures || []).find(s => istLeitung(s.role));
export const schriftUnterschrift = (m: Pick<Meeting, 'signatures'>) => (m.signatures || []).find(s => istSchrift(s.role));
export const vollstaendigUnterschrieben = (m: Pick<Meeting, 'signatures'>): boolean =>
  !!leitungsUnterschrift(m) && !!schriftUnterschrift(m);
/** Ein Protokoll mit mindestens einer Unterschrift ist gesperrt (wie Android). */
export const gesperrt = (m: Pick<Meeting, 'signatures'>): boolean => (m.signatures || []).length > 0;

// ---------- Werte so lesen wie Android (für den gemeinsamen Fingerabdruck)

const text = (v: unknown): string => (v === undefined || v === null ? '' : String(v));
const wahr = (v: unknown, standard: boolean): boolean => (v === true || v === 'true' ? true : v === false || v === 'false' ? false : standard);
const ganz = (v: unknown): number | null => {
  if (typeof v === 'number') return Number.isFinite(v) ? Math.trunc(v) : null;
  if (typeof v === 'string' && v.trim() !== '') {
    const d = Number(v.trim());
    return Number.isFinite(d) ? Math.trunc(d) : null;
  }
  return null;
};

/** Anwesende mit Stimmrecht laut Teilnehmerliste. */
export const stimmenAnwesend = (m: Pick<Meeting, 'attendees'>): number =>
  (m.attendees || []).filter(a => wahr(a.present, true) && wahr(a.hasVotingRight, true)).length;

/** Die Eingabe, sonst die Zählung aus der Teilnehmerliste, sonst unbekannt (null). */
export const stimmberechtigteWirksam = (m: Pick<Meeting, 'attendees' | 'totalEligibleVoters'>): number | null => {
  const e = ganz(m.totalEligibleVoters);
  if (e !== null) return e;
  const n = stimmenAnwesend(m);
  return n > 0 ? n : null;
};

/**
 * Fingerabdruck des Protokollinhalts (ohne Status, Unterschriften und
 * Zeitstempel), Zeichen für Zeichen wie Android `Sitzungen.inhaltsstempel`,
 * damit eine am Handy geleistete Unterschrift am Desktop geprüft werden kann
 * und umgekehrt.
 */
export function inhaltsstempel(m: Meeting): string {
  let sb = '';
  const p = (...w: unknown[]) => {
    sb += w.map(x => (typeof x === 'boolean' ? String(x) : x === null ? '' : text(x))).join('\u001f') + '\u001e';
  };
  const o = m as unknown as Record<string, unknown>;
  p(
    text(o.title),
    text(o.type) || 'other',
    text(o.protocolType) || 'results',
    text(o.date),
    text(o.startTime),
    text(o.endTime),
    text(o.location),
    text(o.chairperson),
    text(o.minuteKeeper),
    text(o.invitationDate),
    text(o.invitationMethod),
    wahr(o.invitationCompliant, false),
    wahr(o.quorumConfirmed, false),
    ganz(o.totalEligibleVoters),
    text(o.generalNotes)
  );
  (m.agenda || []).forEach(t => {
    p('T', text(t.number), text(t.title), text(t.speaker), text(t.discussionNotes));
    (t.resolutions || []).forEach(b =>
      p(
        'B',
        text(b.agendaItemNumber),
        text(b.title),
        text(b.motionText),
        text(b.proposer),
        ganz(b.votesFor) ?? 0,
        ganz(b.votesAgainst) ?? 0,
        ganz(b.votesAbstain) ?? 0,
        text(b.result) || 'accepted',
        wahr(b.isTaxRelevant, false),
        wahr(b.isRegisterRelevant, false),
        text(b.responsiblePerson),
        text(b.dueDate),
        text(b.notes)
      )
    );
  });
  (m.attendees || []).forEach(a =>
    p('A', text(a.name), text(a.role), wahr(a.present, true), wahr(a.hasVotingRight, true), wahr(a.isSignatory, false))
  );
  return sha256Hex(sb).slice(0, 32);
}

export type Pruefung = 'gueltig' | 'geaendert' | 'unbekannt';

/** Passt die Unterschrift noch zum Text? „unbekannt“ bei älteren Unterschriften ohne Fingerabdruck. */
export function pruefeUnterschrift(m: Meeting, s: MeetingDigitalSignature): Pruefung {
  if (!s.contentHash) return 'unbekannt';
  return s.contentHash === inhaltsstempel(m) ? 'gueltig' : 'geaendert';
}

export interface NeueUnterschrift {
  dataUrl: string;
  aspect?: number;
  strokes?: number[][][];
  geraet: string;
}

/**
 * Setzt die Unterschrift der Leitung oder der Protokollführung. Mit der
 * zweiten wird das Protokoll „Genehmigt“ (wie Android). Wirft einen Fehlertext,
 * wenn der Name fehlt oder die Sitzung abgesagt ist.
 */
export function unterschreibe(m: Meeting, rolle: typeof ROLLE_LEITUNG | typeof ROLLE_SCHRIFT, u: NeueUnterschrift, jetzt = new Date()): Meeting {
  if (m.status === 'cancelled') throw new Error('Eine abgesagte Sitzung wird nicht unterschrieben.');
  const leitung = rolle === ROLLE_LEITUNG;
  const name = ((leitung ? m.chairperson : m.minuteKeeper) || '').trim();
  if (!name) throw new Error(`Bitte zuerst den Namen der ${leitung ? 'Versammlungsleitung' : 'Protokollführung'} in der Sitzung eintragen.`);
  const neu: MeetingDigitalSignature = {
    id: `sig-${jetzt.getTime()}-${Math.random().toString(36).slice(2, 6)}`,
    name,
    role: rolle,
    signatureDataUrl: u.dataUrl,
    signedAt: jetzt.toISOString(),
    deviceInfo: u.geraet,
    contentHash: inhaltsstempel(m)
  };
  if (u.aspect && u.strokes && u.strokes.length) {
    neu.aspect = u.aspect;
    neu.strokes = u.strokes;
  }
  const behalten = (m.signatures || []).filter(s => (leitung ? !istLeitung(s.role) : !istSchrift(s.role)));
  const signatures = [...behalten, neu];
  const fertig = vollstaendigUnterschrieben({ signatures });
  const tag = `${jetzt.getFullYear()}-${String(jetzt.getMonth() + 1).padStart(2, '0')}-${String(jetzt.getDate()).padStart(2, '0')}`;
  return {
    ...m,
    signatures,
    ...(fertig ? { status: 'approved' as MeetingStatus, signedAt: tag } : {}),
    updatedAt: jetzt.toISOString()
  };
}

/** Nimmt alle Unterschriften zurück und entsperrt. Aus „Genehmigt“ wird „In Vorprüfung“; der Archiv-Verweis wird gelöst. */
export function unterschriftenEntfernen(m: Meeting, jetzt = new Date()): Meeting {
  const kopie: Meeting = { ...m, updatedAt: jetzt.toISOString() };
  delete kopie.signatures;
  delete kopie.signedAt;
  delete kopie.documentId;
  if (m.status === 'approved') kopie.status = 'review';
  return kopie;
}

// ---------- Neu / Vorlagen

/** Die übliche Tagesordnung, nur als Ausgangspunkt (keine Beispielpersonen, keine Jahreszahl im Text). */
export function standardTagesordnung(art: MeetingType, jetzt = Date.now()): MeetingAgendaItem[] {
  const titel =
    art === 'general_assembly' || art === 'extraordinary_assembly'
      ? [
          'Begrüßung und Feststellung der ordnungsgemäßen Ladung und Beschlussfähigkeit',
          'Bericht des Vorstands',
          'Kassenbericht und Bericht der Kassenprüfer',
          'Aussprache und Entlastung des Vorstands',
          'Wahlen',
          'Anträge und Verschiedenes'
        ]
      : art === 'board' || art === 'committee' || art === 'department'
        ? [
            'Begrüßung und Genehmigung des letzten Protokolls',
            'Berichte',
            'Laufende Projekte und Beschlussfassung',
            'Termine und Verschiedenes'
          ]
        : [];
  return titel.map((t, i) => ({ id: `top-${jetzt}-${i + 1}`, number: `TOP ${i + 1}`, title: t }));
}

/** Titel einer neuen Sitzung; nur bei Versammlungen mit der Jahreszahl (wie Android). */
export function standardTitel(art: MeetingType, jahr: number): string {
  if (art === 'general_assembly') return `Mitgliederversammlung ${jahr}`;
  if (art === 'extraordinary_assembly') return `Außerordentliche Mitgliederversammlung ${jahr}`;
  return SITZUNGSARTEN[art] ?? 'Sitzung';
}

/** Gleicht eine Tagesordnung der Vorgabe dieser Art (nur die Titel zählen)? Dann darf ein Artwechsel sie ersetzen. */
export function istStandardTagesordnung(agenda: MeetingAgendaItem[], art: MeetingType): boolean {
  const s = standardTagesordnung(art).map(t => t.title);
  return agenda.length === s.length && agenda.every((t, i) => t.title === s[i] && !(t.resolutions || []).length && !t.discussionNotes && !t.speaker);
}

// ---------- Prüfen

/**
 * Fehlertexte je Feld. Schlüssel: titel, datum, beginn, ende, einladungsDatum,
 * stimmberechtigte, status, top<i>, beschluss<i>.<j>, teilnehmer<i>.
 * Wie Android; Uhrzeit, Ort und Personen sind keine Pflicht (die Einladung
 * verlangt sie, siehe `einladungFehlt`).
 */
export function pruefeSitzung(m: Meeting): Record<string, string> {
  const e: Record<string, string> = {};
  if (!(m.title || '').trim()) e.titel = 'Bitte einen Titel eingeben.';
  const d = istDatum(m.date) ? m.date : null;
  if (!d) e.datum = 'Bitte ein gültiges Datum wählen.';
  if (m.startTime && !istZeit(m.startTime)) e.beginn = 'Uhrzeit ungültig.';
  if (m.endTime) {
    if (!istZeit(m.endTime)) e.ende = 'Uhrzeit ungültig.';
    else if (istZeit(m.startTime) && m.endTime <= m.startTime) e.ende = 'Das Ende muss nach dem Beginn liegen.';
  }
  if (m.invitationDate) {
    if (!istDatum(m.invitationDate)) e.einladungsDatum = 'Datum ungültig.';
    else if (d && m.invitationDate > d) e.einladungsDatum = 'Die Einladung kann nicht nach der Sitzung liegen.';
  }
  if (m.totalEligibleVoters !== undefined && m.totalEligibleVoters !== null && !istGanzzahl(m.totalEligibleVoters)) {
    e.stimmberechtigte = 'Bitte eine ganze Zahl (0 oder mehr) eingeben.';
  }
  if (m.status === 'approved' && !gesperrt(m)) e.status = 'Genehmigt wird das Protokoll durch die beiden Unterschriften.';
  const grenze = istGanzzahl(m.totalEligibleVoters) ? m.totalEligibleVoters : stimmenAnwesend(m) > 0 ? stimmenAnwesend(m) : null;
  (m.agenda || []).forEach((t, i) => {
    if (!(t.title || '').trim()) e[`top${i}`] = 'Der Tagesordnungspunkt braucht einen Titel.';
    (t.resolutions || []).forEach((b, j) => {
      const f = beschlussFehler(b, grenze);
      if (f) e[`beschluss${i}.${j}`] = f;
    });
  });
  (m.attendees || []).forEach((a, i) => {
    if (!(a.name || '').trim()) e[`teilnehmer${i}`] = 'Der Name fehlt.';
  });
  return e;
}

export function beschlussFehler(b: MeetingResolution, grenze: number | null): string | null {
  if (!(b.title || '').trim()) return 'Bitte einen Kurztitel eingeben.';
  if (!(b.motionText || '').trim()) return 'Bitte den Wortlaut des Antrags eingeben.';
  if (b.dueDate && !istDatum(b.dueDate)) return 'Die Frist ist kein gültiges Datum.';
  const ja = b.votesFor ?? 0;
  const nein = b.votesAgainst ?? 0;
  const enth = b.votesAbstain ?? 0;
  if (![ja, nein, enth].every(istGanzzahl)) return 'Die Stimmen müssen ganze Zahlen (0 oder mehr) sein.';
  const summe = ja + nein + enth;
  if (b.result !== 'deferred' && summe === 0) return 'Bitte die Stimmen eintragen.';
  if (grenze !== null && summe > grenze) return `Es sind ${summe} Stimmen eingetragen, aber nur ${grenze} stimmberechtigte Anwesende.`;
  if (b.result === 'accepted' && ja <= nein) return 'Mit höchstens so vielen Ja- wie Nein-Stimmen kann ein Beschluss nicht angenommen sein.';
  return null;
}

/**
 * Lassen sich die Stimmen nicht gegen die Anwesenden prüfen? Das ist der
 * Fall, wenn weder die Zahl der Stimmberechtigten eingetragen ist noch
 * Teilnehmer mit Stimmrecht erfasst sind, aber Beschlüsse Stimmen haben
 * (Hinweis aus T-192). Kein Fehler, nur ein Hinweis.
 */
export function stimmenUngeprueft(m: Pick<Meeting, 'agenda' | 'attendees' | 'totalEligibleVoters'>): boolean {
  if (stimmberechtigteWirksam(m) !== null) return false;
  return (m.agenda || []).some(t => (t.resolutions || []).some(r => (r.votesFor || 0) + (r.votesAgainst || 0) + (r.votesAbstain || 0) > 0));
}

/**
 * Vorschlag für das Ergebnis aus den Stimmen: einfache Mehrheit, Enthaltungen
 * zählen nicht, Gleichstand gilt als abgelehnt. Satzungen können mehr
 * verlangen; das Ergebnis bleibt deshalb von Hand änderbar.
 */
export const ergebnisVorschlag = (ja: number, nein: number): MeetingResolution['result'] => (ja > nein ? 'accepted' : 'rejected');

/** Ein neuer Beschluss startet leer (vorher: alle Stimmberechtigten „Ja“ und „angenommen“, D-118). */
export function neuerBeschluss(topNummer: string, jetzt = Date.now()): MeetingResolution {
  return {
    id: `res-${jetzt}-${Math.random().toString(36).slice(2, 6)}`,
    agendaItemNumber: topNummer,
    title: '',
    motionText: '',
    votesFor: 0,
    votesAgainst: 0,
    votesAbstain: 0,
    result: 'accepted',
    isTaxRelevant: false,
    isRegisterRelevant: false
  };
}

/** Beim Speichern: Jeder Beschluss trägt die Nummer seines TOPs (sie war nur beim Anlegen gesetzt). */
export const beschlussNummernAngleichen = (agenda: MeetingAgendaItem[]): MeetingAgendaItem[] =>
  agenda.map(t => (t.resolutions?.length ? { ...t, resolutions: t.resolutions.map(r => ({ ...r, agendaItemNumber: t.number })) } : t));

// ---------- Auswertung

export interface SitzungsStatistik {
  gesamt: number;
  versammlungen: number;
  vorstand: number;
  angenommen: number;
  abgelehnt: number;
  vertagt: number;
  steuer: number;
  register: number;
}

/** Steuer- und Register-Kennzeichen zählen nur bei angenommenen Beschlüssen (D-128). */
export function statistik(liste: Meeting[]): SitzungsStatistik {
  const b = liste.flatMap(m => (m.agenda || []).flatMap(t => t.resolutions || []));
  return {
    gesamt: liste.length,
    versammlungen: liste.filter(istVersammlung).length,
    vorstand: liste.filter(m => m.type === 'board').length,
    angenommen: b.filter(r => r.result === 'accepted').length,
    abgelehnt: b.filter(r => r.result === 'rejected').length,
    vertagt: b.filter(r => r.result === 'deferred').length,
    steuer: b.filter(r => r.result === 'accepted' && r.isTaxRelevant).length,
    register: b.filter(r => r.result === 'accepted' && r.isRegisterRelevant).length
  };
}

/** Suche und Filter der Sitzungsliste; die Art wird genau verglichen (D-121). */
export function filtern(liste: Meeting[], suche: string, art: string | null, status: string | null): Meeting[] {
  const q = suche.trim().toLowerCase();
  const enthaelt = (s: string | undefined) => (s || '').toLowerCase().includes(q);
  return liste.filter(
    m =>
      (art === null || m.type === art) &&
      (status === null || m.status === status) &&
      (q === '' ||
        enthaelt(m.title) ||
        enthaelt(m.location) ||
        enthaelt(m.chairperson) ||
        (m.agenda || []).some(
          t => enthaelt(t.title) || enthaelt(t.discussionNotes) || (t.resolutions || []).some(r => enthaelt(r.title) || enthaelt(r.motionText))
        ))
  );
}

// ---------- Voraussetzungen für die PDFs

/** Was für die Einladung noch fehlt (leer = möglich). Es wird nichts erfunden. */
export function einladungFehlt(m: { date: string; startTime?: string; location?: string; agenda?: unknown[] }): string[] {
  const f: string[] = [];
  if (!istDatum(m.date)) f.push('Datum');
  if (!(m.startTime || '').trim()) f.push('Uhrzeit');
  if (!(m.location || '').trim()) f.push('Ort');
  if (!(m.agenda || []).length) f.push('Tagesordnung');
  return f;
}

/** Die angenommenen, für das Vereinsregister gekennzeichneten Beschlüsse mit ihrem TOP. */
export const registerBeschluesse = (m: Meeting): { top: MeetingAgendaItem; beschluss: MeetingResolution }[] =>
  (m.agenda || []).flatMap(top => (top.resolutions || []).filter(r => r.result === 'accepted' && r.isRegisterRelevant).map(beschluss => ({ top, beschluss })));

/** Ein Registerauszug nur bei festgestellter Beschlussfähigkeit und mindestens einem angenommenen, gekennzeichneten Beschluss (D-127). */
export function auszugFehlt(m: Meeting): string | null {
  if (!registerBeschluesse(m).length) return 'Kein angenommener Beschluss ist für das Vereinsregister gekennzeichnet.';
  if (!m.quorumConfirmed) return 'Die Beschlussfähigkeit ist nicht als festgestellt angekreuzt.';
  return null;
}

// ---------- Mail (D-130)

export type MailArt = 'einladung' | 'protokoll';

export const mailBetreff = (m: Meeting, art: MailArt): string =>
  art === 'einladung' ? `Einladung: ${m.title} am ${deutsch(m.date)}` : `Protokoll: ${m.title} vom ${deutsch(m.date)}`;

/** Mailtext ohne erfundene Floskeln; Vereinsname und Leitung erscheinen nur, wenn sie eingetragen sind. */
export function mailText(m: Meeting, art: MailArt, verein: string): string {
  const z: string[] = ['Liebe Mitglieder,', ''];
  if (art === 'einladung') {
    z.push('wir laden herzlich zu dieser Sitzung ein:', '', `Sitzung: ${m.title}`);
    z.push(`Wann: ${deutsch(m.date)}` + (m.startTime ? `, ${m.startTime} Uhr` + (m.endTime ? ` bis ca. ${m.endTime} Uhr` : '') : ''));
    if ((m.location || '').trim()) z.push(`Wo: ${m.location}`);
    if ((m.agenda || []).length) {
      z.push('', 'Tagesordnung:');
      m.agenda.forEach(t => z.push(`- ${t.number}: ${t.title}`));
    }
  } else {
    z.push('hier das Protokoll zur Sitzung:', '', `Sitzung: ${m.title}`, `Datum: ${deutsch(m.date)}`);
    if ((m.chairperson || '').trim()) z.push(`Leitung: ${m.chairperson}`);
    if ((m.minuteKeeper || '').trim()) z.push(`Protokoll: ${m.minuteKeeper}`);
    const n = (m.agenda || []).flatMap(t => t.resolutions || []).filter(r => r.result === 'accepted').length;
    if (n > 0) z.push(`Gefasste Beschlüsse: ${n}`);
    if (!vollstaendigUnterschrieben(m)) z.push('', 'Hinweis: Das Protokoll ist noch nicht genehmigt.');
  }
  if (verein.trim() || (m.chairperson || '').trim()) {
    z.push('', 'Mit freundlichen Grüßen');
    if ((m.chairperson || '').trim()) z.push(m.chairperson);
    if (verein.trim()) z.push(verein.trim());
  }
  return z.join('\n').trimEnd();
}

// ---------- Protokoll im Dokumentenarchiv ablegen (Code-Prüfung C3, wie Android Sitzungen.archivieren)

/** Standardordner für das abgelegte Protokoll je Sitzungsart (wie Android `archivOrdnerId`). */
export const protokollOrdnerId = (art: MeetingType | string): string =>
  art === 'general_assembly' || art === 'extraordinary_assembly' ? 'folder-jhv' : art === 'board' ? 'folder-vorstand' : 'folder-protokolle';

/** Dateiname wie Android `dateiname("Protokoll", s)`. */
export const protokollDateiname = (m: Pick<Meeting, 'title' | 'date'>): string => {
  const sicher = (m.title || '').replace(/[^A-Za-z0-9äöüÄÖÜß_-]+/g, '_').replace(/^_+|_+$/g, '') || 'Sitzung';
  return `Protokoll_${m.date}_${sicher}.pdf`;
};

/** Liegt das Protokoll schon im Archiv? Nur, wenn das vermerkte Dokument noch existiert. */
export const protokollImArchiv = (m: Pick<Meeting, 'documentId'>, documents: Pick<ClubDocument, 'id'>[]): boolean =>
  !!m.documentId && documents.some(d => d.id === m.documentId);

/** Warum das Protokoll (noch) nicht abgelegt werden kann; null = es geht. Texte wie Android. */
export function protokollAblageFehler(m: Pick<Meeting, 'signatures' | 'documentId'>, documents: Pick<ClubDocument, 'id'>[]): string | null {
  if (!vollstaendigUnterschrieben(m)) return 'Ins Archiv kommt nur ein Protokoll mit beiden Unterschriften.';
  if (protokollImArchiv(m, documents)) return 'Das Protokoll liegt schon im Archiv.';
  return null;
}

/** Das Dokument für das unterschriebene Protokoll; Titel, Kategorie und Schlagworte wie Android. */
export function protokollDokument(m: Meeting, dataUrl: string, folderId: string | null, jetzt: string): ClubDocument {
  return {
    id: `doc-prot-${m.id}-${Date.parse(jetzt).toString(36)}`,
    title: `Protokoll: ${m.title} vom ${deutsch(m.date)}`,
    fileName: protokollDateiname(m),
    fileType: 'application/pdf',
    fileSize: Math.round((dataUrl.length - dataUrl.indexOf(',') - 1) * 0.75),
    dataUrl,
    category: 'protokolle',
    folderId,
    date: m.date,
    uploadDate: jetzt,
    tags: ['Protokoll', SITZUNGSARTEN[m.type as MeetingType] ?? 'Sitzung'],
    createdAt: jetzt,
    updatedAt: jetzt
  };
}

