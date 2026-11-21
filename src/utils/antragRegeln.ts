/**
 * Aufnahmeantrag am Gerät (P29, D-96), Regeln wie Android `Antrag.kt` und
 * `Aufnahme.kt`.
 *
 * Ablauf: Das neue Mitglied füllt den Antrag im Beisein des Vereins am
 * Bildschirm aus und unterschreibt. Danach prüft ein Vereinsvertreter die
 * Angaben, vergibt die Mitgliedsnummer und nimmt die Person auf. Dabei
 * entstehen das Mitglied und das PDF des Antrags im Dokumentenarchiv,
 * zusammen oder gar nicht. Der Antrag selbst wird nirgends gespeichert.
 *
 * Alle Daten stehen als JJJJ-MM-TT. Nichts wird erfunden: leere BIC oder Bank
 * bleiben leer, Vertreterdaten nur wie eingegeben.
 */
import type { ClubSettings, Gender, Member, MembershipType } from '../types';
import type { Unterschrift } from './unterschrift';
import { ibanFehler, bicFehler, emailFehler } from './kontaktRegeln';
import { leseVorgaben, BeitragsVorgabe, VorgabeArt, VorgabePeriode } from './beitragsVorgaben';
import { nummerVergeben } from './nummern';

export interface Antrag {
  vorname: string;
  nachname: string;
  geschlecht: Gender;
  geburtsdatum: string;
  staatsangehoerigkeit: string;
  telefon: string;
  email: string;
  strasse: string;
  hausnummer: string;
  plz: string;
  ort: string;
  land: string;
  vertreterName: string;
  vertreterBeziehung: string;
  vertreterTelefon: string;
  vertreterEmail: string;
  sparte: string;
  mitgliedsart: VorgabeArt;
  eintritt: string;
  vorverein: string;
  notiz: string;
  zahlungsart: 'sepa' | 'transfer';
  iban: string;
  bic: string;
  bankname: string;
  kontoinhaber: string;
  faelligkeitstag: 1 | 15;
  datenschutz: boolean;
  satzung: boolean;
  unterschrift: Unterschrift | null;
  vertreterUnterschrift: Unterschrift | null;
  kontoinhaberUnterschrift: Unterschrift | null;
}

export function neuerAntrag(werte: Partial<Antrag> = {}): Antrag {
  return {
    vorname: '', nachname: '', geschlecht: 'none', geburtsdatum: '', staatsangehoerigkeit: 'Deutsch', telefon: '', email: '',
    strasse: '', hausnummer: '', plz: '', ort: '', land: 'Deutschland',
    vertreterName: '', vertreterBeziehung: 'Mutter', vertreterTelefon: '', vertreterEmail: '',
    sparte: '', mitgliedsart: 'full', eintritt: '', vorverein: '', notiz: '',
    zahlungsart: 'sepa', iban: '', bic: '', bankname: '', kontoinhaber: '', faelligkeitstag: 1,
    datenschutz: false, satzung: false, unterschrift: null, vertreterUnterschrift: null, kontoinhaberUnterschrift: null,
    ...werte
  };
}

export const antragName = (a: Antrag) => `${a.vorname} ${a.nachname}`.trim();
const istSepa = (a: Antrag) => a.zahlungsart === 'sepa';

// ---------- Auswahllisten und Texte (wie Android)

/** Die Mitgliedsarten, die im Antrag zur Wahl stehen, mit Beschreibung für das neue Mitglied. */
export const ANTRAG_ARTEN: { art: VorgabeArt; label: string }[] = [
  { art: 'full', label: 'Vollmitglied (Erwachsene)' },
  { art: 'reduced', label: 'Ermäßigt (Schüler, Studierende, Auszubildende, Rentner)' },
  { art: 'youth', label: 'Kinder und Jugendliche' },
  { art: 'family', label: 'Familienbeitrag' },
  { art: 'supporting', label: 'Fördermitglied (passiv)' }
];
export const artName = (art: string) => ANTRAG_ARTEN.find(a => a.art === art)?.label ?? art;

export const PERIODEN_NAME: Record<VorgabePeriode, string> = {
  monthly: 'monatlich',
  quarterly: 'vierteljährlich',
  half_yearly: 'halbjährlich',
  yearly: 'jährlich'
};

export const GESCHLECHTER: { wert: Gender; label: string }[] = [
  { wert: 'none', label: 'keine Angabe' },
  { wert: 'w', label: 'weiblich' },
  { wert: 'm', label: 'männlich' },
  { wert: 'd', label: 'divers' }
];
export const BEZIEHUNGEN = ['Mutter', 'Vater', 'Vormund', 'Sonstige'];

export const STANDARD_DATENSCHUTZ =
  'Ich willige ein, dass {verein} meine personenbezogenen Daten (Name, Anschrift, Geburtsdatum, Kontakt- und Bankdaten sowie ' +
  'Angaben zur Mitgliedschaft) für die Mitgliederverwaltung, den Beitragseinzug, die Vereinskommunikation und – soweit für den ' +
  'Sport- oder Spielbetrieb erforderlich – die Meldung an Verbände verarbeitet und speichert. Eine Weitergabe an unbefugte Dritte ' +
  'findet nicht statt. Nach Ende der Mitgliedschaft werden die Daten im Rahmen der gesetzlichen Aufbewahrungsfristen gelöscht. ' +
  'Ich habe das Recht auf Auskunft, Berichtigung, Löschung und Einschränkung der Verarbeitung sowie auf Beschwerde bei der ' +
  'zuständigen Datenschutzaufsichtsbehörde und kann diese Einwilligung jederzeit mit Wirkung für die Zukunft widerrufen.';
export const STANDARD_SATZUNG = 'Ich erkenne die Satzung und die Beitragsordnung von {verein} in der jeweils gültigen Fassung an.';
export const SEPA_TEXT =
  'Ich ermächtige {verein}, Zahlungen von meinem Konto mittels Lastschrift einzuziehen. Zugleich weise ich mein Kreditinstitut an, ' +
  'die vom Verein auf mein Konto gezogenen Lastschriften einzulösen. Hinweis: Ich kann innerhalb von acht Wochen, beginnend mit ' +
  'dem Belastungsdatum, die Erstattung des belasteten Betrages verlangen. Es gelten dabei die mit meinem Kreditinstitut ' +
  'vereinbarten Bedingungen.';

/** „{verein}“ durch den Vereinsnamen ersetzen. */
export const mitVerein = (text: string, verein: string) => text.split('{verein}').join(verein.trim() || 'dem Verein');

export function beitragText(v: BeitragsVorgabe): string {
  const betrag = v.amount.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${betrag} € ${PERIODEN_NAME[v.period] ?? v.period}`;
}

// ---------- Einstellungen (in den Vereinsdaten, gleiche Felder wie Android)

export interface AntragEinstellungen {
  beitraege: Record<VorgabeArt, BeitragsVorgabe>;
  datenschutz: string;
  satzung: string;
  /** Dokument mit dem hinterlegten Satzungs-PDF (leer = keins) */
  satzungDokId: string;
  /** Dokument mit dem hinterlegten Datenschutz-Vordruck (leer = keiner) */
  datenschutzDokId: string;
}

const text = (v: unknown) => (typeof v === 'string' ? v : '');

export function leseAntragEinstellungen(s: Partial<ClubSettings> | null | undefined): AntragEinstellungen {
  return {
    beitraege: leseVorgaben(s?.membershipFeeDefaults),
    datenschutz: text(s?.applicationPrivacyText).trim() ? text(s?.applicationPrivacyText) : STANDARD_DATENSCHUTZ,
    satzung: text(s?.applicationStatuteText).trim() ? text(s?.applicationStatuteText) : STANDARD_SATZUNG,
    satzungDokId: text(s?.applicationStatuteDocId),
    datenschutzDokId: text(s?.applicationPrivacyDocId)
  };
}

/**
 * Die Texte zum Speichern in den Vereinsdaten. Ein Text, der dem Standard
 * entspricht (oder leer ist), wird nicht gespeichert; dann gilt künftig ein
 * verbesserter Standard (wie Android).
 */
export function antragTexteZumSpeichern(datenschutz: string, satzung: string): Pick<ClubSettings, 'applicationPrivacyText' | 'applicationStatuteText'> {
  const d = datenschutz.trim();
  const s = satzung.trim();
  return {
    applicationPrivacyText: !d || d === STANDARD_DATENSCHUTZ ? undefined : d,
    applicationStatuteText: !s || s === STANDARD_SATZUNG ? undefined : s
  };
}

/** Satzung und Datenschutz-Vordruck, die das neue Mitglied in Schritt 4 öffnen kann. */
export type Beilage = 'satzung' | 'datenschutz';
export const BEILAGEN: Record<Beilage, { titel: string; feld: 'applicationStatuteDocId' | 'applicationPrivacyDocId'; kategorie: 'satzung' | 'mitglieder'; ordner: string; tags: string[]; dateiName: string }> = {
  satzung: { titel: 'Satzung', feld: 'applicationStatuteDocId', kategorie: 'satzung', ordner: 'folder-satzung', tags: ['Satzung', 'Aufnahmeantrag'], dateiName: 'Satzung.pdf' },
  datenschutz: {
    titel: 'Datenschutz-Vordruck', feld: 'applicationPrivacyDocId', kategorie: 'mitglieder', ordner: 'folder-aufnahmeantraege',
    tags: ['Datenschutz', 'Aufnahmeantrag'], dateiName: 'Datenschutz.pdf'
  }
};
export const ORDNER_ANTRAEGE = 'folder-aufnahmeantraege';
export const MAX_BEILAGE = 10 * 1024 * 1024;

/**
 * Titel einer neuen Fassung: „Satzung vom 12.11.2026“; gibt es den schon
 * (zweite Fassung am selben Tag), wird gezählt: „… (2)“, „… (3)“.
 */
export function beilageTitel(b: Beilage, heute: string, vorhandeneTitel: Iterable<string>): string {
  const basis = `${BEILAGEN[b].titel} vom ${deutsch(heute)}`;
  const belegt = new Set(vorhandeneTitel);
  if (!belegt.has(basis)) return basis;
  let n = 2;
  while (belegt.has(`${basis} (${n})`)) n++;
  return `${basis} (${n})`;
}

/** Prüft eine hochgeladene Beilage: nur PDF, höchstens 10 MB. null = in Ordnung. */
export function beilageFehler(kopf: Uint8Array, groesse: number): string | null {
  const start = String.fromCharCode(...Array.from(kopf.slice(0, 5)));
  if (groesse < 8 || start !== '%PDF-') return 'Das ist keine PDF-Datei.';
  if (groesse > MAX_BEILAGE) return `Die Datei ist zu groß (höchstens ${MAX_BEILAGE / 1024 / 1024} MB).`;
  return null;
}

// ---------- Prüfregeln, Seite für Seite (die Schritte des Formulars)

export const SEITE_PERSON = 1;
export const SEITE_MITGLIEDSCHAFT = 2;
export const SEITE_ZAHLUNG = 3;
export const SEITE_ERKLAERUNG = 4;
export const SEITE_ZUSAMMENFASSUNG = 5;
export const SEITEN_NAMEN = ['', 'Person', 'Mitgliedschaft', 'Zahlung', 'Erklärungen', 'Prüfen'];

/** JJJJ-MM-TT als gültiges Datum; sonst null. */
export function datum(t: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec((t || '').trim());
  if (!m) return null;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3] ? m[0] : null;
}

export function deutsch(iso: string): string {
  const d = datum(iso);
  return d ? `${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(0, 4)}` : iso;
}

/** Alter in Jahren am Tag `heute`; null bei unlesbarem oder zukünftigem Datum. */
export function alter(geburtsdatum: string, heute: string): number | null {
  const g = datum(geburtsdatum);
  if (!g || g > heute) return null;
  let j = +heute.slice(0, 4) - +g.slice(0, 4);
  if (heute.slice(5) < g.slice(5)) j--;
  return j;
}

export const minderjaehrig = (a: Antrag, heute: string) => (alter(a.geburtsdatum, heute) ?? 99) < 18;

const norm = (s: string) => (s || '').trim().toLowerCase().replace(/\s+/g, ' ').replace(/,/g, '');

function gleicherName(inhaber: string, vor: string, nach: string): boolean {
  const i = norm(inhaber);
  return i !== '' && (i === norm(`${vor} ${nach}`) || i === norm(`${nach} ${vor}`));
}

/** Das Konto gehört einer anderen Person als dem Antragsteller (z. B. einem Elternteil). */
export const kontoinhaberAbweichend = (a: Antrag) => istSepa(a) && a.kontoinhaber.trim() !== '' && !gleicherName(a.kontoinhaber, a.vorname, a.nachname);

/** Eigene Unterschrift des Kontoinhabers nötig: SEPA, abweichender Inhaber, außer es ist der gesetzliche Vertreter, der ohnehin unterschreibt. */
export function kontoinhaberMussUnterschreiben(a: Antrag, heute: string): boolean {
  if (!kontoinhaberAbweichend(a)) return false;
  if (minderjaehrig(a, heute) && a.vertreterName.trim() && norm(a.kontoinhaber) === norm(a.vertreterName)) return false;
  return true;
}

/** Eine Mitgliedsart zum Alter; null, wenn das Alter unbekannt ist oder keine Änderung nahelegt. */
export const vorschlagArt = (jahre: number | null): VorgabeArt | null => (jahre !== null && jahre < 18 ? 'youth' : null);

/**
 * Vorschlag für den Kontoinhaber, wenn das Feld noch leer ist: bei unter 18
 * der gesetzliche Vertreter (das Konto gehört meist den Eltern), sonst die
 * Person selbst (T-258).
 */
export const kontoinhaberVorschlag = (a: Antrag, heute: string): string =>
  minderjaehrig(a, heute) && a.vertreterName.trim() ? a.vertreterName.trim() : antragName(a);

const leer = (u: Unterschrift | null) => !u || u.strokes.length === 0;

/** Fehlermeldungen je Feld für eine Seite; leer, wenn alles in Ordnung ist. Seite 5 prüft alles. */
export function fehler(seite: number, a: Antrag, heute: string, sparten: string[]): Record<string, string> {
  const f: Record<string, string> = {};
  const alle = seite === SEITE_ZUSAMMENFASSUNG;
  if (seite === SEITE_PERSON || alle) {
    if (!a.vorname.trim()) f.vorname = 'Bitte den Vornamen eingeben.';
    if (!a.nachname.trim()) f.nachname = 'Bitte den Nachnamen eingeben.';
    const g = datum(a.geburtsdatum);
    if (!g) f.geburtsdatum = 'Bitte das Geburtsdatum eingeben.';
    else if (g > heute) f.geburtsdatum = 'Das Geburtsdatum liegt in der Zukunft.';
    if (!a.strasse.trim()) f.strasse = 'Bitte die Straße eingeben.';
    if (!a.hausnummer.trim()) f.hausnummer = 'Bitte die Hausnummer eingeben.';
    if (!a.plz.trim()) f.plz = 'Bitte die Postleitzahl eingeben.';
    if (!a.ort.trim()) f.ort = 'Bitte den Wohnort eingeben.';
    if (a.email.trim() && emailFehler(a.email)) f.email = 'Die E-Mail-Adresse sieht nicht richtig aus.';
    if (minderjaehrig(a, heute) && g && !a.vertreterName.trim()) f.vertreterName = 'Bei unter 18 Jahren bitte den gesetzlichen Vertreter angeben.';
    if (a.vertreterEmail.trim() && emailFehler(a.vertreterEmail)) f.vertreterEmail = 'Die E-Mail-Adresse sieht nicht richtig aus.';
  }
  if (seite === SEITE_MITGLIEDSCHAFT || alle) {
    if (!a.sparte.trim() || (sparten.length > 0 && !sparten.includes(a.sparte))) f.sparte = 'Bitte eine Sparte wählen.';
    if (!ANTRAG_ARTEN.some(x => x.art === a.mitgliedsart)) f.mitgliedsart = 'Bitte eine Mitgliedsart wählen.';
    if (!datum(a.eintritt)) f.eintritt = 'Bitte das Eintrittsdatum eingeben.';
  }
  if ((seite === SEITE_ZAHLUNG || alle) && istSepa(a)) {
    if (!a.iban.trim()) f.iban = 'Für die Lastschrift wird die IBAN gebraucht.';
    else {
      const ib = ibanFehler(a.iban);
      if (ib) f.iban = ib;
    }
    if (!a.kontoinhaber.trim()) f.kontoinhaber = 'Bitte den Namen des Kontoinhabers eingeben.';
    if (bicFehler(a.bic)) f.bic = 'Die BIC ist ungültig.';
  }
  if (seite === SEITE_ERKLAERUNG || alle) {
    if (!a.datenschutz) f.datenschutz = 'Ohne die Einwilligung zur Datenverarbeitung ist keine Aufnahme möglich.';
    if (!a.satzung) f.satzung = 'Ohne Anerkennung der Satzung ist keine Aufnahme möglich.';
    // Unter 18 unterschreibt allein der gesetzliche Vertreter, nicht das Kind (T-258).
    if (minderjaehrig(a, heute)) {
      if (leer(a.vertreterUnterschrift)) f.vertreterUnterschrift = 'Bei unter 18 Jahren unterschreibt der gesetzliche Vertreter.';
    } else if (leer(a.unterschrift)) f.unterschrift = 'Bitte unterschreiben.';
    if (kontoinhaberMussUnterschreiben(a, heute) && leer(a.kontoinhaberUnterschrift)) f.kontoinhaberUnterschrift = 'Der Kontoinhaber muss das Lastschriftmandat unterschreiben.';
  }
  return f;
}

/** Erste Seite mit einem Fehler; null, wenn der Antrag vollständig ist. */
export function ersteFehlerSeite(a: Antrag, heute: string, sparten: string[]): number | null {
  for (let s = SEITE_PERSON; s <= SEITE_ERKLAERUNG; s++) if (Object.keys(fehler(s, a, heute, sparten)).length) return s;
  return null;
}

/** Mitglieder, die dem Antrag auffällig ähneln (gleicher Vor- und Nachname oder gleiche E-Mail-Adresse). */
export function dubletten<M extends Pick<Member, 'firstName' | 'lastName' | 'email'>>(a: Antrag, members: M[]): M[] {
  const vor = norm(a.vorname);
  const nach = norm(a.nachname);
  const mail = a.email.trim().toLowerCase();
  return members.filter(
    m => (vor && nach && norm(m.firstName) === vor && norm(m.lastName) === nach) || (mail && (m.email || '').trim().toLowerCase() === mail)
  );
}

// ---------- Aufnahme

/** Das Mitglied zum Antrag. Es wird nichts erfunden. */
export function mitgliedAusAntrag(a: Antrag, nummer: string, vorgabe: BeitragsVorgabe, heute: string, id: string, jetzt: string): Member {
  const minder = minderjaehrig(a, heute);
  const sepa = istSepa(a);
  const nr = nummer.trim();
  const notizen = [a.vorverein.trim() ? `Vorverein: ${a.vorverein.trim()}` : '', a.notiz.trim()].filter(Boolean).join(' | ');
  return {
    id,
    memberNumber: nr,
    firstName: a.vorname.trim(),
    lastName: a.nachname.trim(),
    gender: a.geschlecht,
    birthDate: a.geburtsdatum,
    nationality: a.staatsangehoerigkeit.trim(),
    address: { street: a.strasse.trim(), houseNumber: a.hausnummer.trim(), zip: a.plz.trim(), city: a.ort.trim(), country: a.land.trim() || 'Deutschland' },
    phone: a.telefon.trim(),
    email: a.email.trim().toLowerCase(),
    entryDate: a.eintritt,
    status: 'active',
    department: a.sparte,
    membershipType: a.mitgliedsart as MembershipType,
    feeAmount: vorgabe.amount,
    feePeriod: vorgabe.period,
    paymentMethod: sepa ? 'sepa' : 'transfer',
    bankDetails: {
      iban: sepa ? a.iban.replace(/\s+/g, '').toUpperCase() : '',
      bic: sepa ? a.bic.trim().toUpperCase() : '',
      bankName: sepa ? a.bankname.trim() : '',
      accountHolder: sepa ? a.kontoinhaber.trim() : '',
      mandateDate: sepa ? heute : '',
      mandateReference: sepa ? `MANDAT-${nr}-${heute.slice(0, 4)}` : '',
      monthlyDueDay: a.faelligkeitstag === 15 ? 15 : 1,
      // Ein neues Mandat wurde noch nie eingezogen.
      mandateSequenceType: 'FRST'
    },
    notes: notizen,
    dataPrivacyConsent: a.datenschutz,
    isMinor: minder,
    guardianName: minder ? a.vertreterName.trim() : '',
    guardianRelation: a.vertreterBeziehung,
    guardianPhone: minder ? a.vertreterTelefon.trim() : '',
    guardianEmail: minder ? a.vertreterEmail.trim() : '',
    createdAt: jetzt,
    updatedAt: jetzt
  };
}

/** Prüft, ob die Aufnahme möglich ist; Text des ersten Problems oder null. */
export function aufnahmeFehler(a: Antrag, nummer: string, heute: string, sparten: string[], members: Pick<Member, 'id' | 'memberNumber'>[]): string | null {
  const s = ersteFehlerSeite(a, heute, sparten);
  if (s !== null) return Object.values(fehler(s, a, heute, sparten))[0];
  if (!nummer.trim()) return 'Bitte eine Mitgliedsnummer eingeben.';
  if (nummerVergeben(nummer, members.map(m => ({ id: m.id, nummer: m.memberNumber })), undefined)) {
    return `Die Mitgliedsnummer „${nummer.trim()}“ ist bereits vergeben.`;
  }
  return null;
}

const dateiTeil = (t: string) => t.trim().replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, '_');

export const antragDateiname = (a: Antrag, nummer: string) =>
  `Aufnahmeantrag_${dateiTeil(a.nachname)}_${dateiTeil(a.vorname)}_${dateiTeil(nummer)}.pdf`;

export const antragDokTitel = (a: Antrag, nummer: string) => `Aufnahmeantrag: ${a.nachname.trim()}, ${a.vorname.trim()} (${nummer.trim()})`;

export const antragDokTags = (a: Antrag, nummer: string) =>
  ['Aufnahmeantrag', 'Beitrittserklärung', nummer.trim(), a.sparte, istSepa(a) ? 'SEPA-Mandat' : ''].filter(Boolean);

export const ANTRAG_DOK_NOTIZ =
  'Am Gerät ausgefüllter und unterschriebener Aufnahmeantrag. Einwilligung zur Datenverarbeitung und Anerkennung der Satzung ' +
  'mit der Unterschrift erklärt.';

/** Die IBAN zur Anzeige in Vierergruppen. */
export const ibanGruppiert = (iban: string) => iban.replace(/\s+/g, '').toUpperCase().replace(/(.{4})/g, '$1 ').trim();
