import { Member, Gender, MembershipStatus, MembershipType, PaymentMethod, FeePeriod, ClubSettings } from '../types';

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
}

// CSV Parser Helper supporting quotes, multiline values, and separators (;, \t, ,)
export function parseCSVToRows(text: string): { headers: string[]; rows: Record<string, string>[] } {
  // Strip BOM if present
  let cleanText = text.replace(/^\uFEFF/, '').trim();
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
export function autoDetectMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9äöüß]/g, '');

  const rules: { key: keyof ColumnMapping; aliases: string[] }[] = [
    {
      key: 'memberNumber',
      aliases: ['mitgliedsnummer', 'mitgliedsnr', 'mitgliedsno', 'mgnr', 'mgnr', 'nr', 'mitgliedsid', 'membernumber', 'memberno', 'memberid', 'ausweisnummer']
    },
    {
      key: 'firstName',
      aliases: ['vorname', 'firstname', 'givenname', 'vname', 'rufname']
    },
    {
      key: 'lastName',
      aliases: ['nachname', 'lastname', 'familienname', 'surname', 'nname']
    },
    {
      key: 'fullName',
      aliases: ['name', 'fullname', 'vollständigername', 'mitgliedsname', 'mitglied']
    },
    {
      key: 'gender',
      aliases: ['geschlecht', 'gender', 'anrede', 'sex']
    },
    {
      key: 'birthDate',
      aliases: ['geburtsdatum', 'geburtstag', 'gebdatum', 'birthdate', 'dob', 'geboren', 'geburtsjahr', 'geb']
    },
    {
      key: 'street',
      aliases: ['straße', 'strasse', 'str', 'street', 'straßenname', 'anschrift']
    },
    {
      key: 'houseNumber',
      aliases: ['hausnummer', 'hausnr', 'hnr', 'housenumber', 'nr']
    },
    {
      key: 'fullAddress',
      aliases: ['adresse', 'address', 'wohnadresse', 'straßeundhausnummer']
    },
    {
      key: 'zip',
      aliases: ['plz', 'postleitzahl', 'zip', 'zipcode', 'postalcode']
    },
    {
      key: 'city',
      aliases: ['ort', 'stadt', 'city', 'wohnort', 'gemeinde']
    },
    {
      key: 'country',
      aliases: ['land', 'country', 'staat', 'nation']
    },
    {
      key: 'phone',
      aliases: ['telefon', 'telefonnummer', 'phone', 'mobil', 'handy', 'mobilnummer', 'tel', 'festnetz']
    },
    {
      key: 'email',
      aliases: ['email', 'emailadresse', 'mail', 'mailadresse', 'epost']
    },
    {
      key: 'department',
      aliases: ['abteilung', 'sparte', 'department', 'sportart', 'sektion', 'bereich', 'gruppe']
    },
    {
      key: 'status',
      aliases: ['status', 'mitgliedsstatus', 'mitgliedschaftsstatus', 'zustand']
    },
    {
      key: 'membershipType',
      aliases: ['mitgliedschaftstyp', 'typ', 'beitragsgruppe', 'tarif', 'art', 'mitgliedsart', 'beitragsart']
    },
    {
      key: 'feeAmount',
      aliases: ['beitrag', 'beitragshöhe', 'betrag', 'fee', 'jahresbeitrag', 'monatsbeitrag', 'summe', 'kosten']
    },
    {
      key: 'feePeriod',
      aliases: ['zahlungsweise', 'zahlungsintervall', 'intervall', 'periode', 'turnus', 'abrechnung', 'frequenz']
    },
    {
      key: 'paymentMethod',
      aliases: ['zahlungsmethode', 'zahlungsart', 'zahlweg', 'bezahlung', 'paymentmethod']
    },
    {
      key: 'iban',
      aliases: ['iban', 'kontonummer', 'bankkonto', 'sepaiban']
    },
    {
      key: 'bic',
      aliases: ['bic', 'swift', 'swiftbic', 'blz', 'bankleitzahl']
    },
    {
      key: 'bankName',
      aliases: ['bank', 'bankname', 'kreditinstitut', 'institut', 'sparkasse']
    },
    {
      key: 'accountHolder',
      aliases: ['kontoinhaber', 'kontoinhaberin', 'inhaber', 'accountholder']
    },
    {
      key: 'mandateDate',
      aliases: ['mandatsdatum', 'sepamandat', 'mandaterteilt', 'mandatedate']
    },
    {
      key: 'mandateReference',
      aliases: ['mandatsreferenz', 'mandatsref', 'mandatnr', 'mandateno']
    },
    {
      key: 'entryDate',
      aliases: ['eintritt', 'eintrittsdatum', 'beitritt', 'beitrittsdatum', 'mitgliedseit', 'entrydate', 'startdate', 'beginn']
    },
    {
      key: 'exitDate',
      aliases: ['austritt', 'austrittsdatum', 'kündigung', 'kündigungsdatum', 'exitdate', 'endedatum']
    },
    {
      key: 'notes',
      aliases: ['notizen', 'bemerkungen', 'bemerkung', 'kommentar', 'anmerkung', 'notes', 'info']
    }
  ];

  headers.forEach(header => {
    const norm = normalize(header);
    for (const rule of rules) {
      if (!mapping[rule.key]) {
        if (rule.aliases.some(alias => norm === alias || norm.includes(alias))) {
          mapping[rule.key] = header;
          break;
        }
      }
    }
  });

  // If we have separate firstName & lastName, don't use fullName
  if (mapping.firstName && mapping.lastName) {
    delete mapping.fullName;
  }

  // If we have separate street and houseNumber, don't use fullAddress
  if (mapping.street && mapping.houseNumber) {
    delete mapping.fullAddress;
  }

  return mapping;
}

// Date Normalizer
function parseGermanOrISODate(val?: string): string | undefined {
  if (!val) return undefined;
  const clean = val.trim();
  if (!clean) return undefined;

  // DD.MM.YYYY or D.M.YYYY
  const deMatch = clean.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (deMatch) {
    const day = deMatch[1].padStart(2, '0');
    const month = deMatch[2].padStart(2, '0');
    const year = deMatch[3];
    return `${year}-${month}-${day}`;
  }

  // YYYY-MM-DD
  const isoMatch = clean.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    const year = isoMatch[1];
    const month = isoMatch[2].padStart(2, '0');
    const day = isoMatch[3].padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // DD/MM/YYYY
  const slashMatch = clean.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const day = slashMatch[1].padStart(2, '0');
    const month = slashMatch[2].padStart(2, '0');
    const year = slashMatch[3];
    return `${year}-${month}-${day}`;
  }

  // Just a 4 digit year
  if (/^\d{4}$/.test(clean)) {
    return `${clean}-01-01`;
  }

  const d = new Date(clean);
  if (!isNaN(d.getTime())) {
    return d.toISOString().split('T')[0];
  }

  return undefined;
}

// Parse Number / Currency
function parseCurrencyNumber(val?: string): number {
  if (!val) return 0;
  let clean = val.replace(/[^0-9,.-]/g, '').trim();
  if (!clean) return 0;

  // Handle German format: 1.250,50 -> 1250.50
  if (clean.includes(',') && clean.includes('.')) {
    if (clean.lastIndexOf(',') > clean.lastIndexOf('.')) {
      clean = clean.replace(/\./g, '').replace(',', '.');
    } else {
      clean = clean.replace(/,/g, '');
    }
  } else if (clean.includes(',')) {
    clean = clean.replace(',', '.');
  }

  const num = parseFloat(clean);
  return isNaN(num) ? 0 : Math.max(0, num);
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
  if (l.includes('gekündigt') || l.includes('austritt') || l.includes('beendet')) return 'terminated';
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

// Main function: Convert parsed CSV rows to Member objects with mapping
export function convertRowsToMembers(
  rows: Record<string, string>[],
  mapping: ColumnMapping,
  existingMembers: Member[],
  settings: ClubSettings,
  defaultDepartment?: string
): ParsedMemberRow[] {
  const existingMapByNumber = new Map<string, Member>();
  const existingMapByName = new Map<string, Member>();

  existingMembers.forEach(m => {
    if (m.memberNumber) existingMapByNumber.set(m.memberNumber.toLowerCase().trim(), m);
    const nameKey = `${m.lastName.toLowerCase().trim()}_${m.firstName.toLowerCase().trim()}`;
    existingMapByName.set(nameKey, m);
  });

  let counter = existingMembers.length + 101;

  return rows.map((row, index) => {
    const warnings: string[] = [];

    // Names
    let firstName = mapping.firstName ? row[mapping.firstName] || '' : '';
    let lastName = mapping.lastName ? row[mapping.lastName] || '' : '';

    if ((!firstName || !lastName) && mapping.fullName && row[mapping.fullName]) {
      const split = splitFullName(row[mapping.fullName]);
      if (!firstName) firstName = split.firstName;
      if (!lastName) lastName = split.lastName;
    }

    if (!lastName && !firstName) {
      warnings.push('Vor- oder Nachname fehlt.');
    }

    // Member number
    let memberNumber = mapping.memberNumber ? row[mapping.memberNumber] || '' : '';
    if (!memberNumber) {
      memberNumber = `M-${String(counter++).padStart(4, '0')}`;
    }

    // Birth date & age
    const birthDate = parseGermanOrISODate(mapping.birthDate ? row[mapping.birthDate] : undefined);
    let age: number | undefined;
    if (birthDate) {
      const birth = new Date(birthDate);
      if (!isNaN(birth.getTime())) {
        const today = new Date();
        age = today.getFullYear() - birth.getFullYear();
        const m = today.getMonth() - birth.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
          age--;
        }
      }
    }

    // Address
    let street = mapping.street ? row[mapping.street] || '' : '';
    let houseNumber = mapping.houseNumber ? row[mapping.houseNumber] || '' : '';

    if (!street && mapping.fullAddress && row[mapping.fullAddress]) {
      const split = splitAddress(row[mapping.fullAddress]);
      street = split.street;
      houseNumber = split.houseNumber;
    }

    const zip = mapping.zip ? row[mapping.zip] || '' : '';
    const city = mapping.city ? row[mapping.city] || '' : '';
    const country = mapping.country ? row[mapping.country] || 'Deutschland' : 'Deutschland';

    // Contact
    const phone = mapping.phone ? row[mapping.phone] || '' : '';
    const email = mapping.email ? row[mapping.email] || '' : '';

    // Department / Sparte
    let department = mapping.department ? row[mapping.department] || '' : '';
    if (!department) {
      department = defaultDepartment || settings.departments[0] || 'Hauptverein';
    }

    // Status & Membership Type
    const status = normalizeStatus(mapping.status ? row[mapping.status] : undefined);
    const membershipType = normalizeMembershipType(mapping.membershipType ? row[mapping.membershipType] : undefined, age);

    // Fee & Payment
    let feeAmount = parseCurrencyNumber(mapping.feeAmount ? row[mapping.feeAmount] : undefined);
    // If no fee is mapped or fee is 0, give a sensible default based on type
    if (feeAmount === 0 && status === 'active' && membershipType !== 'honorary') {
      if (membershipType === 'youth') feeAmount = 60.00;
      else if (membershipType === 'reduced') feeAmount = 80.00;
      else feeAmount = 120.00;
    }

    const feePeriod = normalizeFeePeriod(mapping.feePeriod ? row[mapping.feePeriod] : undefined);

    // Bank & IBAN
    let iban = mapping.iban ? (row[mapping.iban] || '').replace(/\s/g, '').toUpperCase() : '';
    const bic = mapping.bic ? (row[mapping.bic] || '').replace(/\s/g, '').toUpperCase() : '';
    const bankName = mapping.bankName ? row[mapping.bankName] || '' : '';
    const accountHolder = mapping.accountHolder ? row[mapping.accountHolder] || `${firstName} ${lastName}`.trim() : `${firstName} ${lastName}`.trim();

    const paymentMethod = normalizePaymentMethod(mapping.paymentMethod ? row[mapping.paymentMethod] : undefined, iban);

    if (iban && !iban.startsWith('DE') && iban.length < 15) {
      warnings.push(`IBAN (${iban}) scheint unvollständig zu sein.`);
    }

    // Dates
    const entryDate = parseGermanOrISODate(mapping.entryDate ? row[mapping.entryDate] : undefined) || new Date().toISOString().split('T')[0];
    const exitDate = parseGermanOrISODate(mapping.exitDate ? row[mapping.exitDate] : undefined);
    const mandateDate = parseGermanOrISODate(mapping.mandateDate ? row[mapping.mandateDate] : undefined) || (iban ? entryDate : '');
    const mandateReference = mapping.mandateReference ? row[mapping.mandateReference] || '' : (iban ? `MANDAT-${memberNumber}` : '');

    const notes = mapping.notes ? row[mapping.notes] || '' : '';

    // Check duplicate
    let isDuplicate = false;
    let existingMemberId: string | undefined;

    if (existingMapByNumber.has(memberNumber.toLowerCase().trim())) {
      isDuplicate = true;
      existingMemberId = existingMapByNumber.get(memberNumber.toLowerCase().trim())?.id;
    } else {
      const nameKey = `${lastName.toLowerCase().trim()}_${firstName.toLowerCase().trim()}`;
      if (lastName && firstName && existingMapByName.has(nameKey)) {
        isDuplicate = true;
        existingMemberId = existingMapByName.get(nameKey)?.id;
      }
    }

    const id = existingMemberId || `mem-${Date.now()}-${index}-${Math.random().toString(36).substring(2, 6)}`;

    const member: Member = {
      id,
      memberNumber,
      firstName,
      lastName,
      gender: normalizeGender(mapping.gender ? row[mapping.gender] : undefined),
      birthDate,
      address: {
        street,
        houseNumber,
        zip,
        city,
        country
      },
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
      bankDetails: {
        iban,
        bic,
        bankName,
        accountHolder,
        mandateDate,
        mandateReference
      },
      notes,
      dataPrivacyConsent: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    return {
      id,
      selected: warnings.length === 0 || !!(firstName || lastName),
      raw: row,
      hasWarnings: warnings.length > 0,
      warnings,
      isDuplicate,
      existingMemberId,
      member
    };
  });
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
    'Jahresbeitrag in Euro',
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
