import { Member, Gender, MembershipStatus, MembershipType, PaymentMethod, FeePeriod, ClubSettings } from '../types';
import { ordneSpaltenZu, leseDatum, leseBetrag, SpaltenRegel } from '../utils/importRegeln';
import { naechsteNummerImSchema } from '../utils/nummern';
import { leseVorgaben, vorgabeFuer } from '../utils/beitragsVorgaben';

export interface ColumnMapping {
  memberNumber?: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  gender?: string;
  birthDate?: string;
  street?: string;
  houseNumber?: string;
  fullAddress?: string;
  zip?: string;
  city?: string;
  country?: string;
  phone?: string;
  email?: string;
  department?: string;
  status?: string;
  membershipType?: string;
  feeAmount?: string;
  feePeriod?: string;
  paymentMethod?: string;
  iban?: string;
  bic?: string;
  bankName?: string;
  accountHolder?: string;
  mandateDate?: string;
  mandateReference?: string;
  entryDate?: string;
  exitDate?: string;
  notes?: string;
}

export interface ParsedMemberRow {
  id: string;
  selected: boolean;
  raw: Record<string, string>;
  hasWarnings: boolean;
  warnings: string[];
  isDuplicate: boolean;
  existingMemberId?: string;
  member: Member;
  /**
   * Felder, die in der Datei einen Wert hatten. Nur diese überschreiben beim
   * „Aktualisieren“ das vorhandene Mitglied (wie Android); vorher wurde das
   * ganze Mitglied ersetzt.
   */
  vorhanden: string[];
}

// CSV Parser Helper supporting quotes, multiline values, and separators (;, \t, ,)
export function parseCSVToRows(text: string): { headers: string[]; rows: Record<string, string>[] } {
  // Strip BOM if present
  const cleanText = text.replace(/^\uFEFF/, '').trim();
  if (!cleanText) return { headers: [], rows: [] };

  // Detect delimiter from first 3 lines
  const firstLines = cleanText.split(/\r?\n/).slice(0, 3).join('\n');
  const countSemicolons = (firstLines.match(/;/g) || []).length;
  const countTabs = (firstLines.match(/\t/g) || []).length;
  const countCommas = (firstLines.match(/,/g) || []).length;

  let delimiter = ',';
  if (countSemicolons >= countCommas && countSemicolons >= countTabs) {
    delimiter = ';';
  } else if (countTabs > countCommas && countTabs > countSemicolons) {
    delimiter = '\t';
  }

  // Parse CSV state machine
  const allRows: string[][] = [];
  let currentRow: string[] = [];
  let currentVal = '';
  let insideQuotes = false;

  for (let i = 0; i < cleanText.length; i++) {
    const char = cleanText[i];
    const nextChar = cleanText[i + 1];

    if (insideQuotes) {
      if (char === '"' && nextChar === '"') {
        currentVal += '"';
        i++; // skip escaped quote
      } else if (char === '"') {
        insideQuotes = false;
      } else {
        currentVal += char;
      }
    } else {
      if (char === '"') {
        insideQuotes = true;
      } else if (char === delimiter) {
        currentRow.push(currentVal.trim());
        currentVal = '';
      } else if (char === '\r') {
        // ignore CR
      } else if (char === '\n') {
        currentRow.push(currentVal.trim());
        if (currentRow.some(val => val !== '')) {
          allRows.push(currentRow);
        }
        currentRow = [];
        currentVal = '';
      } else {
        currentVal += char;
      }
    }
  }

  // Last token
  if (currentVal || currentRow.length > 0) {
    currentRow.push(currentVal.trim());
    if (currentRow.some(val => val !== '')) {
      allRows.push(currentRow);
    }
  }

  if (allRows.length === 0) return { headers: [], rows: [] };

  const rawHeaders = allRows[0].map(h => h.replace(/^["']|["']$/g, '').trim());
  // Ensure unique headers
  const headerCount: Record<string, number> = {};
  const headers = rawHeaders.map(h => {
    const name = h || 'Spalte';
    if (headerCount[name]) {
      headerCount[name]++;
      return `${name}_${headerCount[name]}`;
    }
    headerCount[name] = 1;
    return name;
  });

  const rows: Record<string, string>[] = [];
  for (let i = 1; i < allRows.length; i++) {
    const rowValues = allRows[i];
    const rowObj: Record<string, string> = {};
    headers.forEach((header, index) => {
      rowObj[header] = (rowValues[index] || '').replace(/^["']|["']$/g, '').trim();
    });
    rows.push(rowObj);
  }

  return { headers, rows };
}

// Auto-detect matching column based on common aliases
const MITGLIED_SPALTEN: SpaltenRegel<keyof ColumnMapping>[] = [
  { feld: 'memberNumber', genau: ['mitgliedsnummer', 'mitgliedsnr', 'mitgliedsno', 'mgnr', 'nr', 'nummer', 'mitgliedsid', 'membernumber', 'memberno', 'memberid', 'ausweisnummer'], teil: ['mitgliedsnummer', 'mitgliedsnr'] },
  { feld: 'firstName', genau: ['vorname', 'firstname', 'givenname', 'vname', 'rufname'], teil: ['vorname'] },
  { feld: 'lastName', genau: ['nachname', 'lastname', 'familienname', 'surname', 'nname'], teil: ['nachname', 'familienname'] },
  // Nur bei genauem Treffer: „Status (Aktiv/Passiv/Ehrenmitglied/…)“ enthält „mitglied“ (D-32)
  { feld: 'fullName', genau: ['name', 'fullname', 'vollstaendigername', 'mitgliedsname', 'mitglied'], teil: [] },
  { feld: 'gender', genau: ['geschlecht', 'gender', 'anrede', 'sex'], teil: ['geschlecht'] },
  { feld: 'birthDate', genau: ['geburtsdatum', 'geburtstag', 'gebdatum', 'birthdate', 'dob', 'geboren', 'geburtsjahr', 'geb'], teil: ['geburtsdatum', 'geburtstag', 'geburtsjahr'] },
  { feld: 'street', genau: ['strasse', 'str', 'street', 'strassenname'], teil: ['strasse'] },
  { feld: 'houseNumber', genau: ['hausnummer', 'hausnr', 'hnr', 'housenumber'], teil: ['hausnummer', 'hausnr'] },
  { feld: 'fullAddress', genau: ['adresse', 'address', 'anschrift', 'wohnadresse', 'strasseundhausnummer', 'strassehausnummer'], teil: ['adresse', 'anschrift'] },
  { feld: 'zip', genau: ['plz', 'postleitzahl', 'zip', 'zipcode', 'postalcode'], teil: ['postleitzahl'] },
  { feld: 'city', genau: ['ort', 'stadt', 'city', 'wohnort', 'gemeinde'], teil: ['wohnort'] },
  { feld: 'country', genau: ['land', 'country', 'staat', 'nation'], teil: [] },
  { feld: 'phone', genau: ['telefon', 'telefonnummer', 'phone', 'mobil', 'handy', 'mobilnummer', 'tel', 'festnetz'], teil: ['telefon', 'mobil', 'handy'] },
  { feld: 'email', genau: ['email', 'emailadresse', 'mail', 'mailadresse', 'epost'], teil: ['email', 'mail'] },
  { feld: 'department', genau: ['abteilung', 'sparte', 'department', 'sportart', 'sektion', 'bereich', 'gruppe'], teil: ['sparte', 'abteilung'] },
  { feld: 'status', genau: ['status', 'mitgliedsstatus', 'mitgliedschaftsstatus', 'zustand'], teil: ['status'] },
  // Vor dem Beitrag: „Beitragsgruppe (…)“ enthält auch „beitrag“
  { feld: 'membershipType', genau: ['mitgliedschaftstyp', 'typ', 'beitragsgruppe', 'tarif', 'art', 'mitgliedsart', 'beitragsart'], teil: ['mitgliedschaftstyp', 'beitragsgruppe', 'mitgliedsart', 'beitragsart'] },
  { feld: 'feeAmount', genau: ['beitrag', 'beitragshoehe', 'betrag', 'fee', 'jahresbeitrag', 'monatsbeitrag', 'summe', 'kosten'], teil: ['beitrag', 'betrag'] },
  { feld: 'feePeriod', genau: ['zahlungsweise', 'zahlungsintervall', 'intervall', 'periode', 'turnus', 'abrechnung', 'frequenz', 'zahlweise'], teil: ['zahlungsweise', 'zahlungsintervall', 'zahlweise', 'turnus'] },
  { feld: 'paymentMethod', genau: ['zahlungsmethode', 'zahlungsart', 'zahlweg', 'bezahlung', 'paymentmethod'], teil: ['zahlungsmethode', 'zahlungsart'] },
  { feld: 'iban', genau: ['iban', 'kontonummer', 'bankkonto', 'sepaiban'], teil: ['iban'] },
  { feld: 'bic', genau: ['bic', 'swift', 'swiftbic', 'blz', 'bankleitzahl'], teil: ['swift'] },
  { feld: 'bankName', genau: ['bank', 'bankname', 'kreditinstitut', 'institut'], teil: ['bankname', 'kreditinstitut'] },
  { feld: 'accountHolder', genau: ['kontoinhaber', 'kontoinhaberin', 'inhaber', 'accountholder'], teil: ['kontoinhaber'] },
  { feld: 'mandateDate', genau: ['mandatsdatum', 'sepamandat', 'mandaterteilt', 'mandatedate'], teil: ['mandatsdatum'] },
  { feld: 'mandateReference', genau: ['mandatsreferenz', 'mandatsref', 'mandatnr', 'mandateno'], teil: ['mandatsreferenz'] },
  { feld: 'entryDate', genau: ['eintritt', 'eintrittsdatum', 'beitritt', 'beitrittsdatum', 'mitgliedseit', 'entrydate', 'startdate', 'beginn'], teil: ['eintritt', 'beitritt', 'mitgliedseit'] },
  { feld: 'exitDate', genau: ['austritt', 'austrittsdatum', 'kuendigung', 'kuendigungsdatum', 'exitdate', 'endedatum'], teil: ['austritt', 'kuendigungsdatum'] },
  { feld: 'notes', genau: ['notizen', 'notiz', 'bemerkungen', 'bemerkung', 'kommentar', 'anmerkung', 'notes', 'info'], teil: ['notiz', 'bemerkung', 'kommentar'] }
];

/**
 * Spaltenzuordnung: erst genaue Überschriften, dann Teiltreffer nur mit
 * längeren Wörtern, jede Spalte nur einmal (D-32, wie Android). Vorher fing
 * „Status (Aktiv/Passiv/Ehrenmitglied/Gekündigt)“ der eigenen Vorlage wegen
 * „mitglied“ das Namensfeld ein, und der Status blieb unzugeordnet.
 */
export function autoDetectMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = ordneSpaltenZu(headers, MITGLIED_SPALTEN);
  if (mapping.firstName && mapping.lastName) delete mapping.fullName;
  if (mapping.street && mapping.houseNumber) delete mapping.fullAddress;
  return mapping;
}

/** Datum wie in den Buchungsimporten, dazu ein reines Jahr (→ 1. Januar). Unmögliche Daten ergeben undefined. */
export function leseImportDatum(val?: string): string | undefined {
  const v = (val || '').trim();
  if (!v) return undefined;
  if (/^\d{4}$/.test(v)) return `${v}-01-01`;
  return leseDatum(v) ?? undefined;
}

// Split full name into first and last name
function splitFullName(fullName: string): { firstName: string; lastName: string } {
  const clean = fullName.trim();
  if (!clean) return { firstName: '', lastName: '' };

  // "Mustermann, Max"
  if (clean.includes(',')) {
    const parts = clean.split(',').map(s => s.trim());
    return {
      lastName: parts[0] || '',
      firstName: parts.slice(1).join(' ') || ''
    };
  }

  // "Dr. Max Mustermann" or "Max Mustermann"
  const parts = clean.split(/\s+/);
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: '' };
  }
  const lastName = parts.pop() || '';
  const firstName = parts.join(' ');
  return { firstName, lastName };
}

// Split combined address (e.g. "Musterstraße 12a") into street and houseNumber
function splitAddress(address: string): { street: string; houseNumber: string } {
  const clean = address.trim();
  const match = clean.match(/^(.*?)(?:\s+(\d+[a-zA-Z\s/-]*))$/);
  if (match) {
    return {
      street: match[1].trim(),
      houseNumber: match[2].trim()
    };
  }
  return { street: clean, houseNumber: '' };
}

// Gender normalizer
function normalizeGender(val?: string): Gender {
  if (!val) return 'none';
  const l = val.toLowerCase().trim();
  if (l.startsWith('m') || l === 'herr' || l === 'männlich' || l === 'male') return 'm';
  if (l.startsWith('w') || l.startsWith('f') || l === 'frau' || l === 'weiblich' || l === 'female') return 'w';
  if (l.startsWith('d') || l === 'divers') return 'd';
  return 'none';
}

// Status normalizer
function normalizeStatus(val?: string): MembershipStatus {
  if (!val) return 'active';
  const l = val.toLowerCase().trim();
  if (l.includes('passiv')) return 'passive';
  if (l.includes('ehren')) return 'honorary';
  if (l.includes('ruhend') || l.includes('ausgesetzt')) return 'suspended';
  if (l.includes('gekündigt') || l.includes('austritt') || l.includes('ausgetreten') || l.includes('beendet')) return 'terminated';
  return 'active';
}

// Membership Type normalizer
function normalizeMembershipType(val?: string, age?: number): MembershipType {
  if (!val) {
    if (age !== undefined && age < 18) return 'youth';
    return 'full';
  }
  const l = val.toLowerCase().trim();
  if (l.includes('jugend') || l.includes('kind') || l.includes('schüler') || l.includes('youth')) return 'youth';
  if (l.includes('ermäßigt') || l.includes('student') || l.includes('senior') || l.includes('azubi')) return 'reduced';
  if (l.includes('familie')) return 'family';
  if (l.includes('förder') || l.includes('sponsor')) return 'supporting';
  if (l.includes('ehren')) return 'honorary';
  return 'full';
}

// Payment method normalizer
function normalizePaymentMethod(val?: string, iban?: string): PaymentMethod {
  if (iban && iban.trim().length >= 10) return 'sepa';
  if (!val) return 'transfer';
  const l = val.toLowerCase().trim();
  if (l.includes('sepa') || l.includes('lastschrift') || l.includes('einzug')) return 'sepa';
  if (l.includes('bar')) return 'cash';
  if (l.includes('dauerauftrag')) return 'standing_order';
  return 'transfer';
}

// Fee period normalizer
function normalizeFeePeriod(val?: string): FeePeriod {
  if (!val) return 'yearly';
  const l = val.toLowerCase().trim();
  if (l.includes('monat')) return 'monthly';
  if (l.includes('quartal') || l.includes('vierteljahr')) return 'quarterly';
  if (l.includes('halbjahr') || l.includes('semester')) return 'half_yearly';
  return 'yearly';
}

const PERIODEN_TEXT: Record<string, string> = { monthly: 'monatlich', quarterly: 'vierteljährlich', half_yearly: 'halbjährlich', yearly: 'jährlich' };

const euro = (n: number) => n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Wandelt die Zeilen in Vorschauzeilen um. Gegenüber früher (wie Android):
 * fehlende Mitgliedsnummern werden aus der höchsten vergebenen fortgezählt,
 * unlesbare Daten ergeben einen Hinweis statt eines geratenen Datums,
 * „1.250“ ist 1.250 € mit Hinweis, und ohne Beitrag in der Datei gilt die
 * Beitragsvorgabe der Mitgliedsart aus den Einstellungen (statt fester 60/80/120 €).
 */
export function convertRowsToMembers(
  rows: Record<string, string>[],
  mapping: ColumnMapping,
  existingMembers: Member[],
  settings: ClubSettings,
  defaultDepartment?: string,
  heute: string = new Date().toISOString().slice(0, 10)
): ParsedMemberRow[] {
  const existingMapByNumber = new Map<string, Member>();
  const existingMapByName = new Map<string, Member>();

  existingMembers.forEach(m => {
    if (m.memberNumber) existingMapByNumber.set(m.memberNumber.toLowerCase().trim(), m);
    const nameKey = `${(m.lastName || '').toLowerCase().trim()}_${(m.firstName || '').toLowerCase().trim()}`;
    existingMapByName.set(nameKey, m);
  });

  // Vergebene Nummern: Bestand plus alle ausdrücklich genannten Nummern der Datei
  const vergeben: string[] = existingMembers.map(m => m.memberNumber).filter(Boolean);
  const nummernSpalte = mapping.memberNumber;
  if (nummernSpalte) {
    rows.forEach(r => {
      const n = (r[nummernSpalte] || '').trim();
      if (n) vergeben.push(n);
    });
  }
  const vorgaben = leseVorgaben(settings.membershipFeeDefaults);

  return rows.map((row, index) => {
    const warnings: string[] = [];
    const vorhanden = new Set<string>();
    const zelle = (feld: keyof ColumnMapping) => {
      const spalte = mapping[feld];
      return spalte ? (row[spalte] || '').trim() : '';
    };

    // Namen
    let firstName = zelle('firstName');
    let lastName = zelle('lastName');
    if ((!firstName || !lastName) && zelle('fullName')) {
      const split = splitFullName(zelle('fullName'));
      if (!firstName) firstName = split.firstName;
      if (!lastName) lastName = split.lastName;
    }
    if (firstName) vorhanden.add('firstName');
    if (lastName) vorhanden.add('lastName');
    if (!lastName && !firstName) warnings.push('Vor- oder Nachname fehlt.');

    // Mitgliedsnummer: aus der Datei, sonst höchste vergebene + 1 (D-32)
    let memberNumber = zelle('memberNumber');
    if (memberNumber) vorhanden.add('memberNumber');
    else {
      memberNumber = naechsteNummerImSchema(vergeben, 'M-0101');
      vergeben.push(memberNumber);
    }

    // Geburtsdatum und Alter
    const birthText = zelle('birthDate');
    const birthDate = leseImportDatum(birthText);
    if (birthText && !birthDate) warnings.push(`Geburtsdatum „${birthText}“ ist nicht lesbar.`);
    if (birthDate) vorhanden.add('birthDate');
    let age: number | undefined;
    if (birthDate) {
      const [bj, bm, bt] = birthDate.split('-').map(Number);
      const [hj, hm, ht] = heute.split('-').map(Number);
      age = hj - bj - (hm < bm || (hm === bm && ht < bt) ? 1 : 0);
    }

    // Adresse
    let street = zelle('street');
    let houseNumber = zelle('houseNumber');
    if (!street && zelle('fullAddress')) {
      const split = splitAddress(zelle('fullAddress'));
      street = split.street;
      houseNumber = split.houseNumber;
    }
    if (street) vorhanden.add('street');
    if (houseNumber) vorhanden.add('houseNumber');
    const zip = zelle('zip');
    const city = zelle('city');
    const country = zelle('country') || 'Deutschland';
    if (zip) vorhanden.add('zip');
    if (city) vorhanden.add('city');
    if (zelle('country')) vorhanden.add('country');

    const phone = zelle('phone');
    const email = zelle('email');
    if (phone) vorhanden.add('phone');
    if (email) vorhanden.add('email');

    let department = zelle('department');
    if (department) vorhanden.add('department');
    else department = defaultDepartment || settings.departments[0] || 'Hauptverein';

    const status = normalizeStatus(zelle('status') || undefined);
    const membershipType = normalizeMembershipType(zelle('membershipType') || undefined, age);
    if (zelle('status')) vorhanden.add('status');
    if (zelle('membershipType')) vorhanden.add('membershipType');

    // Beitrag: „1.250“ ist 1.250 € mit Hinweis; nie negativ
    const rohBeitrag = zelle('feeAmount');
    const zahl = leseBetrag(rohBeitrag);
    if (rohBeitrag && !zahl) warnings.push(`Beitrag „${rohBeitrag}“ ist nicht lesbar.`);
    if (zahl?.mehrdeutig) warnings.push(`Beitrag „${rohBeitrag}“ als ${euro(Math.abs(zahl.wert))} € gelesen (Tausenderpunkt) – bitte prüfen.`);
    let feeAmount = zahl ? Math.abs(zahl.wert) : 0;
    let feePeriod = normalizeFeePeriod(zelle('feePeriod') || undefined);
    if (zelle('feePeriod')) vorhanden.add('feePeriod');
    if (feeAmount > 0) vorhanden.add('feeAmount');
    else if (status === 'active') {
      // Ohne Beitrag in der Datei: Vorgabe der Mitgliedsart aus den Einstellungen
      const v = vorgabeFuer(vorgaben, membershipType);
      if (v) {
        feeAmount = v.amount;
        if (zelle('feePeriod') && feePeriod !== v.period) {
          warnings.push(`Kein Beitrag in der Datei: Vorgabe ${euro(v.amount)} € ${PERIODEN_TEXT[v.period]} übernommen; die Zahlungsweise der Datei (${PERIODEN_TEXT[feePeriod] ?? feePeriod}) wurde dafür ersetzt.`);
        }
        feePeriod = v.period;
      }
    }

    // Bank
    const iban = zelle('iban').replace(/\s/g, '').toUpperCase();
    const bic = zelle('bic').replace(/\s/g, '').toUpperCase();
    const bankName = zelle('bankName');
    const accountHolder = zelle('accountHolder') || `${firstName} ${lastName}`.trim();
    const paymentMethod = normalizePaymentMethod(zelle('paymentMethod') || undefined, iban);
    if (iban) vorhanden.add('iban');
    if (bic) vorhanden.add('bic');
    if (bankName) vorhanden.add('bankName');
    if (zelle('accountHolder')) vorhanden.add('accountHolder');
    if (zelle('paymentMethod') || iban) vorhanden.add('paymentMethod');
    if (iban && !iban.startsWith('DE') && iban.length < 15) warnings.push(`IBAN (${iban}) scheint unvollständig zu sein.`);

    // Daten: unlesbar ergibt einen Hinweis (vorher still „heute“ bzw. geraten)
    const entryText = zelle('entryDate');
    const entryParsed = leseImportDatum(entryText);
    if (entryText && !entryParsed) warnings.push(`Eintrittsdatum „${entryText}“ ist nicht lesbar; heute eingesetzt.`);
    if (entryParsed) vorhanden.add('entryDate');
    const entryDate = entryParsed || heute;
    const exitText = zelle('exitDate');
    const exitDate = leseImportDatum(exitText);
    if (exitText && !exitDate) warnings.push(`Austrittsdatum „${exitText}“ ist nicht lesbar.`);
    if (exitDate) vorhanden.add('exitDate');
    const mandateText = zelle('mandateDate');
    const mandateParsed = leseImportDatum(mandateText);
    if (mandateText && !mandateParsed) warnings.push(`Mandatsdatum „${mandateText}“ ist nicht lesbar.`);
    if (mandateParsed) vorhanden.add('mandateDate');
    const mandateDate = mandateParsed || (iban ? entryDate : '');
    const mandateReference = mapping.mandateReference ? zelle('mandateReference') : (iban ? `MANDAT-${memberNumber}` : '');
    if (zelle('mandateReference')) vorhanden.add('mandateReference');

    const notes = zelle('notes');
    if (notes) vorhanden.add('notes');
    if (zelle('gender')) vorhanden.add('gender');

    // Duplikat: gleiche Nummer oder gleicher Name
    let existingMemberId: string | undefined = existingMapByNumber.get(memberNumber.toLowerCase().trim())?.id;
    if (!existingMemberId && lastName && firstName) {
      existingMemberId = existingMapByName.get(`${lastName.toLowerCase().trim()}_${firstName.toLowerCase().trim()}`)?.id;
    }
    const isDuplicate = !!existingMemberId;

    const id = existingMemberId || `mem-${Date.now()}-${index}-${Math.random().toString(36).substring(2, 6)}`;
    const jetzt = new Date().toISOString();

    const member: Member = {
      id,
      memberNumber,
      firstName,
      lastName,
      gender: normalizeGender(zelle('gender') || undefined),
      birthDate,
      address: { street, houseNumber, zip, city, country },
      phone,
      email,
      entryDate,
      exitDate,
      status,
      department,
      membershipType,
      feeAmount,
      feePeriod,
      paymentMethod,
      bankDetails: { iban, bic, bankName, accountHolder, mandateDate, mandateReference },
      notes,
      dataPrivacyConsent: true,
      createdAt: jetzt,
      updatedAt: jetzt
    };

    return {
      id,
      selected: !!(firstName || lastName),
      raw: row,
      hasWarnings: warnings.length > 0,
      warnings,
      isDuplicate,
      existingMemberId,
      member,
      vorhanden: [...vorhanden]
    };
  });
}

/**
 * Übernimmt nur die Felder, die in der Datei einen Wert hatten, in das
 * vorhandene Mitglied; alles andere bleibt, auch Felder, die der Import gar
 * nicht kennt (Erziehungsberechtigte, Mandatsfolge, Foto …).
 */
export function uebernehmeMitglied(alt: Member, neu: Member, vorhanden: Iterable<string>): Member {
  const p = new Set(vorhanden);
  const m: Member = { ...alt, address: { ...alt.address }, bankDetails: { ...alt.bankDetails } };
  const direkt: Array<keyof Member> = ['memberNumber', 'firstName', 'lastName', 'gender', 'birthDate', 'phone', 'email', 'department', 'status', 'membershipType', 'feeAmount', 'feePeriod', 'paymentMethod', 'entryDate', 'exitDate', 'notes'];
  for (const f of direkt) if (p.has(f)) (m as unknown as Record<string, unknown>)[f] = neu[f];
  for (const f of ['street', 'houseNumber', 'zip', 'city', 'country'] as const) if (p.has(f)) m.address[f] = neu.address[f];
  for (const f of ['iban', 'bic', 'bankName', 'accountHolder', 'mandateDate', 'mandateReference'] as const) if (p.has(f)) m.bankDetails[f] = neu.bankDetails[f];
  return m;
}

/**
 * Bereitet die angehakten Zeilen zum Speichern vor (D-32):
 * - „aktualisieren“: nur Felder mit Wert in der Datei überschreiben;
 * - „überspringen“: Duplikate weglassen;
 * - „immer neu“: Duplikat als neues Mitglied mit neuer Kennung.
 * Eine schon vergebene Nummer bekommt bei neuen Mitgliedern die nächste freie
 * (vorher entstanden bei „immer neu“ doppelte Mitgliedsnummern).
 */
export function bereiteMitgliederImportVor(
  zeilen: ParsedMemberRow[],
  strategie: 'update' | 'skip' | 'create_always',
  vorhandene: Member[]
): Member[] {
  const nachId = new Map(vorhandene.map(m => [m.id, m]));
  const vergebenListe: string[] = vorhandene.map(m => m.memberNumber).filter(Boolean);
  const vergeben = new Set(vergebenListe.map(n => n.toLowerCase()));
  const ergebnis: Member[] = [];
  for (const z of zeilen) {
    if (!z.selected) continue;
    if (z.isDuplicate && strategie === 'skip') continue;
    const alt = z.existingMemberId ? nachId.get(z.existingMemberId) : undefined;
    if (alt && strategie === 'update') {
      ergebnis.push(uebernehmeMitglied(alt, z.member, z.vorhanden));
      continue;
    }
    let m: Member = { ...z.member };
    if (z.isDuplicate) m.id = `mem-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    if (vergeben.has(m.memberNumber.toLowerCase())) {
      const altNr = m.memberNumber;
      const neuNr = naechsteNummerImSchema(vergebenListe, 'M-0101');
      m = {
        ...m,
        memberNumber: neuNr,
        bankDetails: {
          ...m.bankDetails,
          mandateReference: m.bankDetails.mandateReference === `MANDAT-${altNr}` ? `MANDAT-${neuNr}` : m.bankDetails.mandateReference
        }
      };
    }
    vergeben.add(m.memberNumber.toLowerCase());
    vergebenListe.push(m.memberNumber);
    ergebnis.push(m);
  }
  return ergebnis;
}

// Generate sample CSV template for download
export function generateSampleCSVTemplate(settings: ClubSettings): string {
  const headers = [
    'Mitgliedsnummer',
    'Vorname',
    'Nachname',
    'Geschlecht (m/w/d)',
    'Geburtsdatum (TT.MM.JJJJ)',
    'Straße',
    'Hausnummer',
    'PLZ',
    'Ort',
    'Telefon',
    'E-Mail',
    'Sparte/Abteilung',
    'Status (Aktiv/Passiv/Ehrenmitglied/Gekündigt)',
    'Beitragsgruppe (Vollzahler/Jugend/Ermäßigt/Familie)',
    'Beitrag in Euro (je Zahlung)',
    'Zahlungsweise (Jährlich/Monatlich/Halbjährlich/Quartal)',
    'Zahlungsmethode (SEPA/Überweisung/Bar)',
    'IBAN',
    'BIC',
    'Bankname',
    'Kontoinhaber',
    'Eintrittsdatum (TT.MM.JJJJ)',
    'Notizen'
  ];

  const sampleDept1 = settings.departments[0] || 'Fußball';
  const sampleDept2 = settings.departments[1] || 'Tennis';

  const rows = [
    [
      'M-0101',
      'Max',
      'Mustermann',
      'm',
      '15.04.1988',
      'Hauptstraße',
      '14a',
      '12345',
      'Musterstadt',
      '0171 1234567',
      'max.mustermann@beispiel.de',
      sampleDept1,
      'Aktiv',
      'Vollzahler',
      '120,00',
      'Jährlich',
      'SEPA',
      'DE12500105170648489890',
      'HELGDEF1822',
      'Frankfurter Sparkasse',
      'Max Mustermann',
      '01.01.2020',
      'Mannschaftsführer 1. Herren'
    ],
    [
      'M-0102',
      'Sophie',
      'Schneider',
      'w',
      '22.09.2010',
      'Sportplatzweg',
      '7',
      '12345',
      'Musterstadt',
      '0151 9876543',
      'eltern.schneider@beispiel.de',
      sampleDept2,
      'Aktiv',
      'Jugend',
      '60,00',
      'Jährlich',
      'SEPA',
      'DE89370400440532013000',
      'DRESDEFFXXX',
      'Commerzbank',
      'Thomas Schneider',
      '15.03.2022',
      'Jugendförderkader'
    ],
    [
      'M-0103',
      'Klaus',
      'Bauer',
      'm',
      '05.11.1965',
      'Waldweg',
      '3',
      '12345',
      'Musterstadt',
      '01234 56789',
      'klaus.bauer@beispiel.de',
      sampleDept1,
      'Passiv',
      'Ermäßigt',
      '40,00',
      'Jährlich',
      'Überweisung',
      '',
      '',
      '',
      '',
      '01.07.1995',
      'Fördermitglied & Schiedsrichter'
    ]
  ];

  const escapeCSV = (field: string) => {
    if (field.includes(';') || field.includes('"') || field.includes('\n')) {
      return `"${field.replace(/"/g, '""')}"`;
    }
    return field;
  };

  const csvContent = [
    headers.map(escapeCSV).join(';'),
    ...rows.map(row => row.map(escapeCSV).join(';'))
  ].join('\r\n');

  return '\uFEFF' + csvContent; // Add UTF-8 BOM for flawless Excel/Google Sheets opening
}
