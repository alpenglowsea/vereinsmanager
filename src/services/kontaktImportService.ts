/**
 * Regeln für den Kontakt-Import (P18: D-56 bis D-58, D-73), wie die
 * Android-Fassung (`KontaktImport.kt`). Vorher stand diese Logik im Fenster
 * selbst und war nicht prüfbar.
 */
import type { ClubContact, ContactPersonType, ContactType } from '../types';
import { normKopf, ordneSpaltenZu, leseDatum, SpaltenRegel } from '../utils/importRegeln';
import { naechsteKontaktNummer } from '../utils/nummern';
import { ibanFehler, bicFehler, emailFehler } from '../utils/kontaktRegeln';
import { CONTACT_TYPES_LIST } from '../data/contactConstants';

export interface KontaktSpalten {
  contactNumber?: string;
  displayName?: string;
  firstName?: string;
  lastName?: string;
  salutation?: string;
  personType?: string;
  legalForm?: string;
  types?: string;
  contactPersonName?: string;
  street?: string;
  houseNumber?: string;
  zip?: string;
  city?: string;
  country?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  website?: string;
  iban?: string;
  bic?: string;
  bankName?: string;
  accountHolder?: string;
  taxId?: string;
  commercialRegister?: string;
  dateOfBirth?: string;
  notes?: string;
  tags?: string;
}

/** Wie die Art bestimmt wird, wenn die Datei sie nicht angibt. */
export type ArtVorgabe = 'erkennen' | 'legal' | 'natural';

export interface KontaktZeile {
  id: string;
  kontakt: ClubContact;
  /** Hinweise, die den Import nicht verhindern. */
  hinweise: string[];
  /** Fehler, die den Import verhindern (z. B. kein Name). */
  fehler: string[];
  /** Anzeigename und Nummer des vorhandenen Kontakts, dem die Zeile gleicht (D-58). */
  duplikat?: string;
  selected: boolean;
  /** Nummer aus der Datei (sonst wird beim Import fortgezählt). */
  nummerAusDatei: boolean;
}

export const KONTAKT_SPALTEN: SpaltenRegel<keyof KontaktSpalten>[] = [
  { feld: 'contactNumber', genau: ['kontaktnummer', 'kontaktnr', 'nummer', 'nr'], teil: ['kontaktnummer', 'kontaktnr'] },
  { feld: 'displayName', genau: ['name', 'firma', 'firmenname', 'namefirma', 'bezeichnung', 'organisation', 'displayname', 'unternehmen', 'partner'], teil: ['firmenname', 'organisation'] },
  { feld: 'firstName', genau: ['vorname', 'firstname'], teil: ['vorname'] },
  { feld: 'lastName', genau: ['nachname', 'familienname', 'lastname'], teil: ['nachname'] },
  { feld: 'salutation', genau: ['anrede', 'salutation'], teil: ['anrede'] },
  { feld: 'personType', genau: ['art', 'personenart', 'personentyp', 'persontype', 'firmaprivat'], teil: ['personenart'] },
  { feld: 'legalForm', genau: ['rechtsform', 'legalform'], teil: ['rechtsform'] },
  { feld: 'types', genau: ['kontakttyp', 'kontakttypen', 'typ', 'typen', 'rolle', 'rollen', 'kategorie', 'types'], teil: ['kontakttyp'] },
  { feld: 'contactPersonName', genau: ['ansprechpartner', 'kontaktperson', 'vertreter'], teil: ['ansprechpartner', 'kontaktperson'] },
  { feld: 'street', genau: ['strasse', 'strassehausnummer', 'adresse', 'anschrift', 'street'], teil: ['strasse', 'anschrift'] },
  { feld: 'houseNumber', genau: ['hausnummer', 'hausnr', 'housenumber'], teil: ['hausnr', 'hausnummer'] },
  { feld: 'zip', genau: ['plz', 'postleitzahl', 'zip'], teil: ['postleitzahl'] },
  { feld: 'city', genau: ['ort', 'stadt', 'wohnort', 'city'], teil: ['wohnort'] },
  { feld: 'country', genau: ['land', 'country'], teil: [] },
  { feld: 'email', genau: ['email', 'emailadresse', 'mail'], teil: ['mail'] },
  { feld: 'mobile', genau: ['mobil', 'mobiltelefon', 'handy', 'mobile'], teil: ['mobil', 'handy'] },
  { feld: 'phone', genau: ['telefon', 'tel', 'festnetz', 'phone', 'telefonnummer'], teil: ['telefon', 'festnetz'] },
  { feld: 'website', genau: ['webseite', 'website', 'homepage', 'web', 'internet', 'url'], teil: ['webseite', 'website', 'homepage'] },
  { feld: 'iban', genau: ['iban'], teil: ['iban'] },
  { feld: 'bic', genau: ['bic', 'swift'], teil: ['swift'] },
  { feld: 'bankName', genau: ['bank', 'bankname', 'kreditinstitut', 'institut'], teil: ['bankname', 'kreditinstitut'] },
  { feld: 'accountHolder', genau: ['kontoinhaber', 'kontoinhaberin'], teil: ['kontoinhaber'] },
  { feld: 'taxId', genau: ['steuernummer', 'steuernr', 'ustid', 'umsatzsteuerid', 'taxid'], teil: ['steuernummer', 'ustid'] },
  { feld: 'commercialRegister', genau: ['handelsregister', 'registernummer', 'vereinsregister'], teil: ['register'] },
  { feld: 'dateOfBirth', genau: ['geburtsdatum', 'geburtstag', 'dateofbirth'], teil: ['geburtsdatum'] },
  { feld: 'notes', genau: ['notizen', 'notiz', 'bemerkung', 'bemerkungen', 'kommentar', 'notes'], teil: ['notiz', 'bemerkung', 'kommentar'] },
  { feld: 'tags', genau: ['tags', 'stichwoerter', 'schlagwoerter', 'stichworte'], teil: ['stichwort', 'schlagwort'] }
];

/** Spaltenzuordnung: genaue Überschriften zuerst, jede Spalte nur einmal. */
export function erkenneKontaktSpalten(headers: string[]): KontaktSpalten {
  return ordneSpaltenZu(headers, KONTAKT_SPALTEN);
}

/** Rechtsformen als ganze Wörter (vorher genügte „ev“ oder „ug“ irgendwo im Text, D-56). */
const RECHTSFORM_WOERTER = new Set(['gmbh', 'ag', 'kg', 'ug', 'ev', 'gbr', 'ohg', 'mbh', 'stiftung', 'verein', 'co', 'se', 'ggmbh', 'kgaa', 'eg', 'ek']);

export function siehtNachFirmaAus(name: string): boolean {
  const woerter = (name || '')
    .toLowerCase()
    .split(/[\s,()/&-]+/)
    .map(w => w.trim().replace(/\.+$/, '').replace(/\./g, ''))
    .filter(Boolean);
  return woerter.some(w => RECHTSFORM_WOERTER.has(w)) || /e\.\s?V\./i.test(name || '');
}

/** Art aus dem Text der Spalte; null, wenn unklar. */
export function artAusText(t: string): ContactPersonType | null {
  const n = normKopf(t);
  if (!n) return null;
  if (n.includes('privat') || n.includes('person') || n.includes('natuerlich') || n === 'natural' || n === 'p') return 'natural';
  if (n.includes('firma') || n.includes('unternehmen') || n.includes('organisation') || n.includes('juristisch') || n.includes('verein') || n === 'legal' || n === 'f' || siehtNachFirmaAus(t)) return 'legal';
  return null;
}

const TYP_STAEMME: Array<[ContactType, string[]]> = [
  ['sponsor', ['sponsor']],
  ['donor', ['spende', 'spender', 'förder', 'foerder']],
  ['supplier', ['liefer', 'ware']],
  ['service', ['dienst', 'service', 'handwerk']],
  ['association', ['verband', 'sportbund', 'bund']],
  ['authority', ['behörd', 'behoerd', 'kommune', 'gemeinde', 'stadt', 'amt']],
  ['partner', ['kooper', 'partner']],
  ['member_contact', ['mitglied']],
  ['other', ['sonst', 'other']]
];

/** Erkennt alle neun Kontakttypen (vorher nur sieben, D-57); zweiter Wert: nicht erkannte Teile. */
export function kontaktTypen(text: string): { typen: ContactType[]; unbekannt: string[] } {
  const typen: ContactType[] = [];
  const unbekannt: string[] = [];
  for (const teil of (text || '').split(/[,;/|]/).map(s => s.trim()).filter(Boolean)) {
    const l = teil.toLowerCase();
    const n = normKopf(teil);
    const direkt = CONTACT_TYPES_LIST.find(t => t.id === l || normKopf(t.label) === n)?.id;
    const stamm = TYP_STAEMME.find(([, s]) => s.some(w => (w.length <= 3 ? l.split(/\W+/).includes(w) : l.includes(w))))?.[0];
    const k = direkt ?? stamm;
    if (k) {
      if (!typen.includes(k)) typen.push(k);
    } else unbekannt.push(teil);
  }
  return { typen, unbekannt };
}

/** „Mustermann, Max“ oder „Max Mustermann“ → Vor- und Nachname. */
export function teileName(voll: string): { vorname: string; nachname: string } {
  const t = (voll || '').trim();
  if (!t) return { vorname: '', nachname: '' };
  if (t.includes(',')) {
    const [nach, ...rest] = t.split(',').map(s => s.trim());
    return { vorname: rest.join(' '), nachname: nach };
  }
  const teile = t.split(/\s+/);
  if (teile.length === 1) return { vorname: '', nachname: teile[0] };
  const nachname = teile.pop() as string;
  return { vorname: teile.join(' '), nachname };
}

function teileAdresse(adresse: string): { strasse: string; hausnummer: string } {
  const m = /^(.*?)(?:\s+(\d+[a-zA-Z\s/-]*))$/.exec((adresse || '').trim());
  return m ? { strasse: m[1].trim(), hausnummer: m[2].trim() } : { strasse: (adresse || '').trim(), hausnummer: '' };
}

const normName = (s: string | undefined) => (s || '').toLowerCase().replace(/\s+/g, ' ').trim();

/** Anzeigename wie im Kontaktformular: Firma bzw. „Anrede Vorname Nachname“. */
export function anzeigeName(k: Pick<ClubContact, 'personType' | 'companyName' | 'salutation' | 'firstName' | 'lastName'>): string {
  return k.personType === 'legal'
    ? (k.companyName || '').trim()
    : [k.salutation, k.firstName, k.lastName].filter(Boolean).join(' ').trim();
}

/**
 * Wandelt die Zeilen um. Nummern aus der Datei nur, wenn frei; sonst werden
 * sie beim Import fortgezählt. Ungültige IBAN, BIC und E-Mail werden nicht
 * übernommen und gemeldet. Mögliche Duplikate (gleiche Nummer oder gleicher
 * Name) sind abgewählt (D-58).
 */
export function wandleKontakteUm(
  rows: Record<string, string>[],
  sp: KontaktSpalten,
  vorgabeArt: ArtVorgabe,
  vorgabeTyp: ContactType,
  vorhandene: ClubContact[]
): KontaktZeile[] {
  const nummernVorhanden = new Set(vorhandene.map(k => (k.contactNumber || '').trim().toLowerCase()).filter(Boolean));
  const namenVorhanden = new Map<string, ClubContact>();
  for (const k of vorhandene) {
    const n = normName(k.displayName);
    if (n && !namenVorhanden.has(n)) namenVorhanden.set(n, k);
  }
  const nummernDatei = new Set<string>();
  const jetzt = new Date().toISOString();

  return rows.map((r, i) => {
    const w = (f: keyof KontaktSpalten) => {
      const s = sp[f];
      return s ? (r[s] || '').trim() : '';
    };
    const hinweise: string[] = [];
    const fehler: string[] = [];
    const name = w('displayName');
    let vor = w('firstName');
    let nach = w('lastName');
    const artText = w('personType');
    const rechtsform = w('legalForm');

    // Art: Spalte, sonst Vorgabe, sonst erkennen (Rechtsform als ganzes Wort)
    const art: ContactPersonType = artAusText(artText) ?? (
      vorgabeArt === 'legal' ? 'legal'
        : vorgabeArt === 'natural' ? 'natural'
          : rechtsform ? 'legal'
            : name && !vor && !nach && siehtNachFirmaAus(name) ? 'legal'
              : 'natural'
    );
    if (artText && !artAusText(artText)) hinweise.push(`Art „${artText}“ nicht erkannt – als ${art === 'legal' ? 'Firma' : 'Privatperson'} übernommen.`);

    let firma = '';
    if (art === 'legal') {
      firma = name || [vor, nach].filter(Boolean).join(' ');
      vor = '';
      nach = '';
      if (!firma) fehler.push('Kein Firmenname.');
    } else {
      if (!nach && name) {
        const t = teileName(name);
        if (!vor) vor = t.vorname;
        nach = t.nachname;
      } else if (!nach && vor) {
        nach = vor;
        vor = '';
      }
      if (!nach) fehler.push('Kein Name.');
    }

    // Typen: alle neun, Unbekanntes melden
    const typText = w('types');
    const { typen, unbekannt } = kontaktTypen(typText);
    if (unbekannt.length) hinweise.push(`Kontakttyp „${unbekannt.join(', ')}“ nicht erkannt.`);
    const typenListe: ContactType[] = typen.length ? typen : [vorgabeTyp || 'other'];
    if (!typen.length && typText) hinweise.push(`Stattdessen „${CONTACT_TYPES_LIST.find(t => t.id === typenListe[0])?.label ?? typenListe[0]}“ gesetzt.`);

    // Adresse: ohne eigene Hausnummernspalte aus der Straße lösen
    let strasse = w('street');
    let hausnr = w('houseNumber');
    if (!hausnr && strasse && !sp.houseNumber) {
      const a = teileAdresse(strasse);
      strasse = a.strasse;
      hausnr = a.hausnummer;
    }

    // Bank und Kontaktdaten: Ungültiges nicht übernehmen, aber sagen
    let iban = w('iban').replace(/\s+/g, '').toUpperCase();
    if (iban && ibanFehler(iban)) { hinweise.push(`IBAN „${w('iban')}“ ungültig – nicht übernommen.`); iban = ''; }
    let bic = w('bic').replace(/\s+/g, '').toUpperCase();
    if (bic && bicFehler(bic)) { hinweise.push(`BIC „${bic}“ ungültig – nicht übernommen.`); bic = ''; }
    let email = w('email');
    if (email && emailFehler(email)) { hinweise.push(`E-Mail „${email}“ ungültig – nicht übernommen.`); email = ''; }
    const gebRoh = w('dateOfBirth');
    let geb = '';
    if (art === 'natural' && gebRoh) {
      geb = leseDatum(gebRoh) || '';
      if (!geb) hinweise.push(`Geburtsdatum „${gebRoh}“ nicht lesbar – nicht übernommen.`);
    }

    // Ansprechpartner ohne feste Anrede „Herr/Frau“ und ohne feste Funktion (D-57)
    const ap = w('contactPersonName');
    const apTeile = art === 'legal' && ap ? teileName(ap) : null;

    // Nummer: aus der Datei nur, wenn frei
    let nummer = w('contactNumber');
    let dupNachNummer: ClubContact | undefined;
    if (nummer) {
      const k = nummer.toLowerCase();
      dupNachNummer = vorhandene.find(v => (v.contactNumber || '').trim().toLowerCase() === k);
      if (nummernVorhanden.has(k) || nummernDatei.has(k)) {
        hinweise.push(`Kontaktnummer ${nummer} gibt es schon – es wird eine neue vergeben.`);
        nummer = '';
      } else nummernDatei.add(k);
    }

    const kontakt: ClubContact = {
      id: `cnt-imp-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 6)}`,
      contactNumber: nummer,
      personType: art,
      types: typenListe,
      displayName: '',
      address: { street: strasse, houseNumber: hausnr, zip: w('zip'), city: w('city'), country: w('country') || 'Deutschland' },
      email,
      phone: w('phone'),
      mobile: w('mobile') || undefined,
      website: w('website') || undefined,
      notes: w('notes') || undefined,
      tags: w('tags') ? w('tags').split(/[,;]+/).map(s => s.trim()).filter(Boolean) : undefined,
      createdAt: jetzt,
      updatedAt: jetzt
    };
    if (art === 'legal') {
      kontakt.companyName = firma;
      kontakt.legalForm = rechtsform || undefined;
      kontakt.taxId = w('taxId') || undefined;
      kontakt.commercialRegister = w('commercialRegister') || undefined;
      if (apTeile && (apTeile.vorname || apTeile.nachname)) {
        kontakt.contactPerson = { firstName: apTeile.vorname || undefined, lastName: apTeile.nachname || undefined };
      }
    } else {
      kontakt.salutation = w('salutation') || undefined;
      kontakt.firstName = vor || undefined;
      kontakt.lastName = nach;
      kontakt.dateOfBirth = geb || undefined;
    }
    kontakt.displayName = anzeigeName(kontakt);
    const bank = w('bankName');
    const inhaber = w('accountHolder');
    if (iban || bic || bank || inhaber) {
      kontakt.bankDetails = { iban, bic: bic || undefined, bankName: bank || undefined, accountHolder: inhaber || kontakt.displayName };
    }

    // Duplikat: gleiche Nummer oder gleicher Anzeigename
    const dup = dupNachNummer ?? namenVorhanden.get(normName(kontakt.displayName));
    const zeile: KontaktZeile = {
      id: kontakt.id,
      kontakt,
      hinweise,
      fehler,
      duplikat: dup ? `${dup.displayName} (${dup.contactNumber})` : undefined,
      selected: fehler.length === 0 && !dup,
      nummerAusDatei: !!nummer
    };
    return zeile;
  });
}

/** Wechselt die Art einer Zeile (Firma ↔ Privatperson) und ordnet die Namen neu. */
export function mitArt(z: KontaktZeile, art: ContactPersonType, vorhandene: ClubContact[]): KontaktZeile {
  const k = z.kontakt;
  if (k.personType === art) return z;
  let neu: ClubContact;
  if (art === 'legal') {
    const name = [k.firstName, k.lastName].filter(Boolean).join(' ');
    neu = { ...k, personType: 'legal', companyName: name, firstName: undefined, lastName: undefined, salutation: undefined, dateOfBirth: undefined };
  } else {
    const t = teileName(k.companyName || '');
    neu = { ...k, personType: 'natural', firstName: t.vorname || undefined, lastName: t.nachname, companyName: undefined, legalForm: undefined, contactPerson: undefined, taxId: undefined, commercialRegister: undefined };
  }
  neu.displayName = anzeigeName(neu);
  if (neu.bankDetails && neu.bankDetails.accountHolder === k.displayName) neu.bankDetails = { ...neu.bankDetails, accountHolder: neu.displayName };
  const fehler = neu.displayName ? [] : [art === 'legal' ? 'Kein Firmenname.' : 'Kein Name.'];
  const dup = vorhandene.find(v => normName(v.displayName) === normName(neu.displayName));
  return {
    ...z,
    kontakt: neu,
    fehler,
    duplikat: dup ? `${dup.displayName} (${dup.contactNumber})` : undefined,
    // War die Zeile wegen eines Fehlers gesperrt, wird sie jetzt angehakt (außer Duplikat)
    selected: fehler.length === 0 && (z.fehler.length > 0 ? !dup : z.selected)
  };
}

/**
 * Die angehakten Zeilen ohne Fehler zum Speichern; leere Nummern aus der
 * höchsten vorhandenen fortgezählt.
 */
export function bereiteKontaktImportVor(zeilen: KontaktZeile[], vorhandene: ClubContact[]): ClubContact[] {
  const vergeben: Array<string | undefined> = [
    ...vorhandene.map(k => k.contactNumber),
    ...zeilen.filter(z => z.selected && z.fehler.length === 0).map(z => z.kontakt.contactNumber).filter(Boolean)
  ];
  return zeilen
    .filter(z => z.selected && z.fehler.length === 0)
    .map(z => {
      if (z.kontakt.contactNumber) return z.kontakt;
      const nr = naechsteKontaktNummer(vergeben);
      vergeben.push(nr);
      return { ...z.kontakt, contactNumber: nr };
    });
}

export const KONTAKT_VORLAGE = [
  'Name / Firma;Vorname;Nachname;Personenart;Rechtsform;Kontakttypen;Ansprechpartner;E-Mail;Telefon;Straße;PLZ;Ort;IBAN;BIC;Notizen',
  'Sport Schmitt GmbH;;;Firma;GmbH;Lieferant, Dienstleister;Schmitt, Thomas;info@sport-schmitt.de;03981 445566;Markt 12;17235;Neustrelitz;DE89370400440532013000;COBADEFFXXX;Sportkleidung & Bälle',
  'Malerbetrieb Farbenfroh e.K.;;;Firma;e.K.;Sponsor, Dienstleister;Meier, Sandra;kontakt@farbenfroh.de;03981 123456;Seestr. 4;17235;Neustrelitz;;;Bandenwerbung Hauptplatz',
  ';Markus;Weber;Privat;;Spender, Förderer;;dr.weber@beispiel.de;0171 9988776;Bahnhofstr. 8;17235;Neustrelitz;;;Regelmäßiger Förderer Jugendbereich',
  'Kreissportbund Meckl.-Seenplatte;;;Firma;e.V.;Verband, Behörde;Schmidt, Peter;info@ksb-seenplatte.de;0395 554433;Am Wall 1;17033;Neubrandenburg;;;Dachverband'
].join('\n');
