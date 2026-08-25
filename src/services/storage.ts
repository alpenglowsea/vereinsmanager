import {
  Member,
  Transaction,
  FinancialAccount,
  MemberAuditLog,
  ClubSettings,
  InventoryItem,
  MemberBulkUpdates,
  SepaRunHistory,
  DeploymentMode,
  ClubDocument,
  DocumentCategory,
  DocumentFolder,
  DonationReceipt
} from '../types';
import { DEFAULT_DEPARTMENTS } from '../data/taxSpheres';
import { INITIAL_INVENTORY } from '../data/initialInventory';
import { getInitialDocuments } from '../data/initialDocuments';
import { getInitialFolders } from '../data/initialFolders';
import { getStoredSupabaseConfig, getSupabaseClient } from './supabaseClient';
import { CloudStorageService } from './cloudStorage';
import { getDonationPdfDataUrl } from './donationService';

const STORAGE_KEY_MODE = 'vm_deployment_mode';

const DB_NAME = 'VereinsManager_LocalDB_v1';
const DB_VERSION = 6;

const STORES = {
  MEMBERS: 'members',
  TRANSACTIONS: 'transactions',
  ACCOUNTS: 'accounts',
  AUDIT_LOGS: 'audit_logs',
  SETTINGS: 'settings',
  INVENTORY: 'inventory',
  SEPA_RUNS: 'sepa_runs',
  DOCUMENTS: 'documents',
  DONATIONS: 'donations',
  FOLDERS: 'folders'
};

const DEFAULT_SETTINGS: ClubSettings = {
  clubName: 'TSV Musterstadt 1890 e.V.',
  associationNumber: 'VR 48219 (Amtsgericht Musterstadt)',
  taxNumber: '112/5840/1922 (Finanzamt Musterstadt)',
  taxOffice: 'Finanzamt Musterstadt',
  taxExemptionDate: '10.01.2024',
  taxAssessmentPeriod: '2021 bis 2023',
  promotedPurposes: 'Förderung des Sports (§ 52 Abs. 2 Satz 1 Nr. 21 AO)',
  creditorId: 'DE98ZZZ09999999999',
  creditorIban: 'DE89370501981122334455',
  creditorBic: 'SPKDMUSTXXX',
  creditorAccountId: 'acc-1',
  address: 'Sportplatzweg 12, 12345 Musterstadt',
  chairman: 'Dr. Michael Sommer',
  treasurer: 'Sabine Weber',
  email: 'vorstand@tsv-musterstadt1890.de',
  departments: DEFAULT_DEPARTMENTS
};

const INITIAL_DONATIONS: DonationReceipt[] = [
  {
    id: 'don-1',
    receiptNumber: 'ZB-2025-001',
    type: 'money',
    date: '2025-01-20',
    donorType: 'external',
    donorName: 'Musterstadt Stadtwerke AG',
    donorAddress: {
      street: 'Energiestraße',
      houseNumber: '1',
      zip: '12345',
      city: 'Musterstadt',
      country: 'Deutschland'
    },
    amount: 1500.00,
    amountInWords: 'Eintausendfünfhundert Euro',
    isWaiverOfRefund: false,
    taxOffice: 'Finanzamt Musterstadt',
    taxNumber: '112/5840/1922',
    exemptionDate: '10.01.2024',
    assessmentPeriod: '2021 bis 2023',
    promotedPurpose: 'Förderung des Sports (§ 52 Abs. 2 Satz 1 Nr. 21 AO)',
    isDirectlyPromoted: true,
    issuedBy: 'Sabine Weber (Schatzmeisterin)',
    cityAndDate: 'Musterstadt, 20.01.2025',
    transactionId: 'tx-2',
    notes: 'Zweckgebundene Spende für neue Jugendtore',
    createdAt: '2025-01-20T14:30:00.000Z',
    updatedAt: '2025-01-20T14:30:00.000Z'
  },
  {
    id: 'don-2',
    receiptNumber: 'ZB-2025-002',
    type: 'goods',
    date: '2025-02-14',
    donorType: 'member',
    memberId: 'mem-6',
    donorName: 'Christian Koch',
    donorAddress: {
      street: 'Kastanienweg',
      houseNumber: '11',
      zip: '12345',
      city: 'Musterstadt',
      country: 'Deutschland'
    },
    amount: 850.00,
    amountInWords: 'Achthundertfünfzig Euro',
    isWaiverOfRefund: false,
    goodsDescription: '1x Professionelle Tischtennisplatte JOOLA 2000-S Pro inkl. Netzgarnitur & Zubehör (Neuwertig)',
    goodsOrigin: 'private',
    goodsValuationBasis: 'Original-Kaufbeleg Sport-Thieme GmbH vom 10.01.2025 über 899,00 € liegt vor',
    taxOffice: 'Finanzamt Musterstadt',
    taxNumber: '112/5840/1922',
    exemptionDate: '10.01.2024',
    assessmentPeriod: '2021 bis 2023',
    promotedPurpose: 'Förderung des Sports (§ 52 Abs. 2 Satz 1 Nr. 21 AO)',
    isDirectlyPromoted: true,
    issuedBy: 'Sabine Weber (Schatzmeisterin)',
    cityAndDate: 'Musterstadt, 14.02.2025',
    notes: 'Sachspende für die Jugendabteilung Tischtennis & Turnen',
    createdAt: '2025-02-14T11:00:00.000Z',
    updatedAt: '2025-02-14T11:00:00.000Z'
  }
];


const INITIAL_ACCOUNTS: FinancialAccount[] = [
  {
    id: 'acc-1',
    name: 'Sparkasse Girokonto (Hauptkonto)',
    accountType: 'bank',
    iban: 'DE89370501981122334455',
    bic: 'SPKDMUSTXXX',
    initialBalance: 12450.00,
    color: 'emerald',
    description: 'Hauptgeschäftskonto für Beiträge, Rechnungen und Gehälter',
    createdAt: '2024-01-01T00:00:00.000Z'
  },
  {
    id: 'acc-2',
    name: 'Volksbank Spendenkonto',
    accountType: 'bank',
    iban: 'DE44370601909988776655',
    bic: 'GENODEM1MST',
    initialBalance: 3200.00,
    color: 'blue',
    description: 'Zweckgebundenes Konto für Spenden & Jugendförderung',
    createdAt: '2024-01-01T00:00:00.000Z'
  },
  {
    id: 'acc-3',
    name: 'Hauptkasse (Bargeld Vereinsheim)',
    accountType: 'cash',
    initialBalance: 850.00,
    color: 'amber',
    description: 'Barkasse für Kiosk, Spieltags-Eintritt und Auslagen',
    createdAt: '2024-01-01T00:00:00.000Z'
  }
];

const INITIAL_MEMBERS: Member[] = [
  {
    id: 'mem-1',
    memberNumber: 'MG-001',
    firstName: 'Maximilian',
    lastName: 'Müller',
    gender: 'm',
    birthDate: '1984-05-14',
    address: {
      street: 'Hauptstraße',
      houseNumber: '42',
      zip: '12345',
      city: 'Musterstadt',
      country: 'Deutschland'
    },
    phone: '0171 1234567',
    email: 'max.mueller@example.de',
    entryDate: '2015-03-01',
    status: 'active',
    department: 'Fußball',
    membershipType: 'full',
    feeAmount: 15.00,
    feePeriod: 'monthly',
    paymentMethod: 'sepa',
    bankDetails: {
      iban: 'DE12370501980000123456',
      bic: 'SPKDMUSTXXX',
      bankName: 'Sparkasse Musterstadt',
      accountHolder: 'Maximilian Müller',
      mandateDate: '2015-03-01',
      mandateReference: 'MANDAT-MG001-2015',
      monthlyDueDay: 1
    },
    notes: 'Spielführer 1. Herrenmannschaft. Erste-Hilfe-Zertifikat vorhanden.',
    dataPrivacyConsent: true,
    createdAt: '2015-03-01T08:00:00.000Z',
    updatedAt: '2024-01-15T10:30:00.000Z'
  },
  {
    id: 'mem-2',
    memberNumber: 'MG-002',
    firstName: 'Anna-Lena',
    lastName: 'Schmidt',
    gender: 'w',
    birthDate: '1992-11-20',
    address: {
      street: 'Birkenweg',
      houseNumber: '7a',
      zip: '12345',
      city: 'Musterstadt',
      country: 'Deutschland'
    },
    phone: '0152 9876543',
    email: 'a.schmidt@example.de',
    entryDate: '2018-09-01',
    status: 'active',
    department: 'Tennis',
    membershipType: 'full',
    feeAmount: 20.00,
    feePeriod: 'monthly',
    paymentMethod: 'sepa',
    bankDetails: {
      iban: 'DE45370501980000987654',
      bic: 'SPKDMUSTXXX',
      bankName: 'Sparkasse Musterstadt',
      accountHolder: 'Anna-Lena Schmidt',
      mandateDate: '2018-09-01',
      mandateReference: 'MANDAT-MG002-2018',
      monthlyDueDay: 15
    },
    notes: 'Jugendtrainerin Tennis mit C-Lizenz. Ehrenamtspauschale berechtigt.',
    dataPrivacyConsent: true,
    createdAt: '2018-09-01T09:00:00.000Z',
    updatedAt: '2024-02-10T14:15:00.000Z'
  },
  {
    id: 'mem-3',
    memberNumber: 'MG-003',
    firstName: 'Felix',
    lastName: 'Schneider',
    gender: 'm',
    birthDate: '2010-04-12',
    address: {
      street: 'Goethestraße',
      houseNumber: '15',
      zip: '12345',
      city: 'Musterstadt',
      country: 'Deutschland'
    },
    phone: '0160 5544332',
    email: 'familie.schneider@example.de',
    entryDate: '2021-01-15',
    status: 'active',
    department: 'Leichtathletik',
    membershipType: 'youth',
    feeAmount: 10.00,
    feePeriod: 'monthly',
    paymentMethod: 'sepa',
    bankDetails: {
      iban: 'DE78370501980000554433',
      bic: 'SPKDMUSTXXX',
      bankName: 'Sparkasse Musterstadt',
      accountHolder: 'Thomas Schneider (Vater)',
      mandateDate: '2021-01-10',
      mandateReference: 'MANDAT-MG003-2021',
      monthlyDueDay: 1
    },
    notes: 'Jugendfördergruppe Sprint / Weitsprung.',
    dataPrivacyConsent: true,
    createdAt: '2021-01-15T11:00:00.000Z',
    updatedAt: '2023-11-20T16:00:00.000Z'
  },
  {
    id: 'mem-4',
    memberNumber: 'MG-004',
    firstName: 'Heinrich',
    lastName: 'Bauer',
    gender: 'm',
    birthDate: '1948-02-18',
    address: {
      street: 'Lindenallee',
      houseNumber: '3',
      zip: '12345',
      city: 'Musterstadt',
      country: 'Deutschland'
    },
    phone: '01234 56789',
    email: 'h.bauer.veteran@example.de',
    entryDate: '1970-05-01',
    status: 'honorary',
    department: 'Ehrenmitglieder',
    membershipType: 'honorary',
    feeAmount: 0.00,
    feePeriod: 'yearly',
    paymentMethod: 'cash',
    bankDetails: {
      iban: '',
      bic: '',
      bankName: '',
      accountHolder: '',
      mandateDate: '',
      mandateReference: ''
    },
    notes: 'Ehrenmitglied seit 2020. 50 Jahre Vereinsmitgliedschaft.',
    dataPrivacyConsent: true,
    createdAt: '1970-05-01T00:00:00.000Z',
    updatedAt: '2020-05-01T12:00:00.000Z'
  },
  {
    id: 'mem-5',
    memberNumber: 'MG-005',
    firstName: 'Laura',
    lastName: 'Wagner',
    gender: 'w',
    birthDate: '1998-07-03',
    address: {
      street: 'Schulstraße',
      houseNumber: '22',
      zip: '12345',
      city: 'Musterstadt',
      country: 'Deutschland'
    },
    phone: '0176 3322110',
    email: 'l.wagner@example.de',
    entryDate: '2022-04-01',
    status: 'passive',
    department: 'Turnen & Gymnastik',
    membershipType: 'reduced',
    feeAmount: 40.00,
    feePeriod: 'yearly',
    paymentMethod: 'transfer',
    bankDetails: {
      iban: '',
      bic: '',
      bankName: '',
      accountHolder: '',
      mandateDate: '',
      mandateReference: ''
    },
    notes: 'Studium bis 2025. Nachweis vorgelegt.',
    dataPrivacyConsent: true,
    createdAt: '2022-04-01T10:00:00.000Z',
    updatedAt: '2024-03-01T09:00:00.000Z'
  },
  {
    id: 'mem-6',
    memberNumber: 'MG-006',
    firstName: 'Christian',
    lastName: 'Koch',
    gender: 'm',
    birthDate: '1979-09-12',
    address: {
      street: 'Kastanienweg',
      houseNumber: '11',
      zip: '12345',
      city: 'Musterstadt',
      country: 'Deutschland'
    },
    phone: '0170 8899001',
    email: 'c.koch@firma-koch.de',
    entryDate: '2019-06-15',
    status: 'active',
    department: 'Schach',
    membershipType: 'supporting',
    feeAmount: 75.00,
    feePeriod: 'quarterly',
    paymentMethod: 'sepa',
    bankDetails: {
      iban: 'DE91370501980000889900',
      bic: 'SPKDMUSTXXX',
      bankName: 'Sparkasse Musterstadt',
      accountHolder: 'Christian Koch',
      mandateDate: '2019-06-10',
      mandateReference: 'MANDAT-MG006-2019'
    },
    notes: 'Fördermitglied und Sponsor der Jugendmannschaften.',
    dataPrivacyConsent: true,
    createdAt: '2019-06-15T14:00:00.000Z',
    updatedAt: '2024-01-08T11:20:00.000Z'
  },
  {
    id: 'mem-7',
    memberNumber: 'MG-007',
    firstName: 'Sophie',
    lastName: 'Becker',
    gender: 'w',
    birthDate: '2004-03-29',
    address: {
      street: 'Am Sportfeld',
      houseNumber: '5',
      zip: '12345',
      city: 'Musterstadt',
      country: 'Deutschland'
    },
    phone: '0151 7766554',
    email: 'sophie.becker@example.de',
    entryDate: '2023-01-10',
    status: 'active',
    department: 'Volleyball',
    membershipType: 'full',
    feeAmount: 60.00,
    feePeriod: 'half_yearly',
    paymentMethod: 'sepa',
    bankDetails: {
      iban: 'DE62370501980000776655',
      bic: 'SPKDMUSTXXX',
      bankName: 'Sparkasse Musterstadt',
      accountHolder: 'Sophie Becker',
      mandateDate: '2023-01-05',
      mandateReference: 'MANDAT-MG007-2023'
    },
    notes: 'Damenmannschaft Volleyball.',
    dataPrivacyConsent: true,
    createdAt: '2023-01-10T10:00:00.000Z',
    updatedAt: '2023-01-10T10:00:00.000Z'
  },
  {
    id: 'mem-8',
    memberNumber: 'MG-008',
    firstName: 'Jonas',
    lastName: 'Richter',
    gender: 'm',
    birthDate: '1995-08-17',
    address: {
      street: 'Parkstraße',
      houseNumber: '19',
      zip: '12345',
      city: 'Musterstadt',
      country: 'Deutschland'
    },
    phone: '0175 4433221',
    email: 'j.richter@example.de',
    entryDate: '2020-02-01',
    status: 'active',
    department: 'Fußball',
    membershipType: 'full',
    feeAmount: 18.00,
    feePeriod: 'monthly',
    paymentMethod: 'sepa',
    bankDetails: {
      iban: 'DE21370501980000332211',
      bic: 'SPKDMUSTXXX',
      bankName: 'Sparkasse Musterstadt',
      accountHolder: 'Jonas Richter',
      mandateDate: '2020-02-01',
      mandateReference: 'MANDAT-MG008-2020',
      monthlyDueDay: 15
    },
    notes: '2. Herrenmannschaft Fußball.',
    dataPrivacyConsent: true,
    createdAt: '2020-02-01T10:00:00.000Z',
    updatedAt: '2024-01-10T10:00:00.000Z'
  },
  {
    id: 'mem-9',
    memberNumber: 'MG-009',
    firstName: 'Katharina',
    lastName: 'Hoffmann',
    gender: 'w',
    birthDate: '1988-12-05',
    address: {
      street: 'Rosenweg',
      houseNumber: '4',
      zip: '12345',
      city: 'Musterstadt',
      country: 'Deutschland'
    },
    phone: '0157 1122334',
    email: 'k.hoffmann@example.de',
    entryDate: '2017-07-01',
    status: 'active',
    department: 'Turnen & Gymnastik',
    membershipType: 'full',
    feeAmount: 120.00,
    feePeriod: 'yearly',
    paymentMethod: 'sepa',
    bankDetails: {
      iban: 'DE39370501980000112233',
      bic: 'SPKDMUSTXXX',
      bankName: 'Sparkasse Musterstadt',
      accountHolder: 'Katharina Hoffmann',
      mandateDate: '2017-07-01',
      mandateReference: 'MANDAT-MG009-2017'
    },
    notes: 'Übungsleiterin Eltern-Kind-Turnen.',
    dataPrivacyConsent: true,
    createdAt: '2017-07-01T10:00:00.000Z',
    updatedAt: '2024-01-05T10:00:00.000Z'
  }
];

const INITIAL_TRANSACTIONS: Transaction[] = [
  {
    id: 'tx-1',
    date: '2025-01-15',
    amount: 3450.00,
    type: 'income',
    accountId: 'acc-1',
    documentNumber: 'BE-2025-001',
    bookingText: 'SEPA-Sammellastschrift Mitgliedsbeiträge 1. Halbjahr',
    partner: 'Mitglieder TSV Musterstadt',
    sphere: 'ideell',
    category: 'Mitgliedsbeiträge',
    vatRate: 0,
    notes: 'Einzug von 42 Mitgliedsbeiträgen per DTAUS/SEPA XML',
    createdAt: '2025-01-15T10:00:00.000Z',
    updatedAt: '2025-01-15T10:00:00.000Z'
  },
  {
    id: 'tx-2',
    date: '2025-01-20',
    amount: 1500.00,
    type: 'income',
    accountId: 'acc-2',
    documentNumber: 'BE-2025-002',
    bookingText: 'Zweckgebundene Spende für neue Jugendtore',
    partner: 'Musterstadt Stadtwerke AG',
    sphere: 'ideell',
    category: 'Spenden / Schenkungen',
    vatRate: 0,
    notes: 'Spendenbescheinigung nach amtl. Muster ausgestellt',
    createdAt: '2025-01-20T14:30:00.000Z',
    updatedAt: '2025-01-20T14:30:00.000Z'
  },
  {
    id: 'tx-3',
    date: '2025-01-25',
    amount: -450.00,
    type: 'expense',
    accountId: 'acc-1',
    documentNumber: 'BE-2025-003',
    bookingText: 'Jahresbeitrag Landessportbund & Sportfachverbände',
    partner: 'Landessportbund NRW e.V.',
    sphere: 'ideell',
    category: 'Verbandsabgaben & Beiträge',
    vatRate: 0,
    notes: 'Pflichtbeitrag inkl. Sportversicherung ARAG',
    createdAt: '2025-01-25T09:15:00.000Z',
    updatedAt: '2025-01-25T09:15:00.000Z'
  },
  {
    id: 'tx-4',
    date: '2025-02-02',
    amount: 600.00,
    type: 'income',
    accountId: 'acc-1',
    documentNumber: 'BE-2025-004',
    bookingText: 'Pachterlöse Vereinsgaststätte Monat Januar/Februar',
    partner: 'Gastronomie Pächter Luigi Rossi',
    sphere: 'vermoegen',
    category: 'Pachterlöse Vereinsgelände',
    vatRate: 0,
    notes: 'Pachtvertrag vom 01.01.2023',
    createdAt: '2025-02-02T11:00:00.000Z',
    updatedAt: '2025-02-02T11:00:00.000Z'
  },
  {
    id: 'tx-5',
    date: '2025-02-10',
    amount: 820.00,
    type: 'income',
    accountId: 'acc-3',
    documentNumber: 'BE-2025-005',
    bookingText: 'Startgelder & Eintritt Winter-Hallenturnier',
    partner: 'Teilnehmende Mannschaften & Zuschauer',
    sphere: 'zweckbetrieb',
    category: 'Startgelder & Meldegebühren',
    vatRate: 7,
    notes: '16 Gastmannschaften à 30 € + Zuschauereintritte',
    createdAt: '2025-02-10T19:00:00.000Z',
    updatedAt: '2025-02-10T19:00:00.000Z'
  },
  {
    id: 'tx-6',
    date: '2025-02-10',
    amount: 1150.00,
    type: 'income',
    accountId: 'acc-3',
    documentNumber: 'BE-2025-006',
    bookingText: 'Kioskverkauf Speisen & Getränke Hallenturnier',
    partner: 'Turniergäste / Kioskerlöse',
    sphere: 'wirtschaftlich',
    category: 'Verkauf Speisen & Getränke (Vereinsfeste)',
    vatRate: 19,
    notes: 'Wirtschaftlicher Geschäftsbetrieb Bewirtung',
    createdAt: '2025-02-10T20:00:00.000Z',
    updatedAt: '2025-02-10T20:00:00.000Z'
  },
  {
    id: 'tx-7',
    date: '2025-02-11',
    amount: -480.00,
    type: 'expense',
    accountId: 'acc-1',
    documentNumber: 'BE-2025-007',
    bookingText: 'Wareneinkauf Getränke & Grillgut Turniertag',
    partner: 'Metro Großmarkt Musterstadt',
    sphere: 'wirtschaftlich',
    category: 'Wareneinkauf Speisen & Getränke',
    vatRate: 19,
    notes: 'Rechnung #ME-884920 Vorsteuerabzug 19%',
    createdAt: '2025-02-11T10:00:00.000Z',
    updatedAt: '2025-02-11T10:00:00.000Z'
  },
  {
    id: 'tx-8',
    date: '2025-02-15',
    amount: -600.00,
    type: 'expense',
    accountId: 'acc-1',
    documentNumber: 'BE-2025-008',
    bookingText: 'Übungsleiterpauschale 1. Quartal 2025',
    partner: 'Anna-Lena Schmidt',
    sphere: 'zweckbetrieb',
    category: 'Übungsleiterpauschalen (§ 3 Nr. 26 EStG)',
    vatRate: 0,
    notes: 'Steuerfreie Aufwandsentschädigung Tennis-Jugend',
    createdAt: '2025-02-15T15:00:00.000Z',
    updatedAt: '2025-02-15T15:00:00.000Z'
  },
  {
    id: 'tx-9',
    date: '2025-02-20',
    amount: 1200.00,
    type: 'income',
    accountId: 'acc-1',
    documentNumber: 'BE-2025-009',
    bookingText: 'Bandenwerbung Saison 2024/2025',
    partner: 'Autohaus Müller GmbH',
    sphere: 'wirtschaftlich',
    category: 'Banden- & Bannerwerbung',
    vatRate: 19,
    notes: 'Rechnung #RE-2025-012 zzgl. 19% MwSt.',
    createdAt: '2025-02-20T11:45:00.000Z',
    updatedAt: '2025-02-20T11:45:00.000Z'
  },
  {
    id: 'tx-10',
    date: '2025-03-01',
    amount: -280.00,
    type: 'expense',
    accountId: 'acc-1',
    documentNumber: 'BE-2025-010',
    bookingText: 'Neue Spielbälle & Trainingshütchen Jugend',
    partner: 'Sportshop Franke',
    sphere: 'zweckbetrieb',
    category: 'Sportgeräte & Trainingsmaterial',
    vatRate: 19,
    notes: 'Trainingsausstattung Fußball- und Leichtathletikabteilung',
    createdAt: '2025-03-01T14:00:00.000Z',
    updatedAt: '2025-03-01T14:00:00.000Z'
  }
];

const INITIAL_AUDIT_LOGS: MemberAuditLog[] = [
  {
    id: 'log-1',
    memberId: 'mem-1',
    memberNumber: 'MG-001',
    memberName: 'Maximilian Müller',
    timestamp: '2024-01-15T10:30:00.000Z',
    author: 'Kassier (Sabine Weber)',
    action: 'update',
    summary: 'Telefonnummer und E-Mail aktualisiert',
    changes: [
      { field: 'phone', label: 'Telefonnummer', oldValue: '0171 0000000', newValue: '0171 1234567' },
      { field: 'email', label: 'E-Mail', oldValue: 'm.mueller@alt.de', newValue: 'max.mueller@example.de' }
    ]
  },
  {
    id: 'log-2',
    memberId: 'mem-2',
    memberNumber: 'MG-002',
    memberName: 'Anna-Lena Schmidt',
    timestamp: '2024-02-10T14:15:00.000Z',
    author: 'Vorstand (Dr. Sommer)',
    action: 'update',
    summary: 'Beitragsklasse und Trainerlizenz-Notiz ergänzt',
    changes: [
      { field: 'notes', label: 'Notizen', oldValue: 'Tennisspielerin', newValue: 'Jugendtrainerin Tennis mit C-Lizenz. Ehrenamtspauschale berechtigt.' }
    ]
  }
];

// IndexedDB Helper
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      Object.values(STORES).forEach(storeName => {
        if (!db.objectStoreNames.contains(storeName)) {
          db.createObjectStore(storeName, { keyPath: 'id' });
        }
      });
    };
    request.onsuccess = () => {
      const db = request.result;
      // Defensive check in case DB was created earlier without newer stores (e.g. INVENTORY or SEPA_RUNS)
      const missingStores = Object.values(STORES).filter(s => !db.objectStoreNames.contains(s));
      if (missingStores.length > 0) {
        db.close();
        const nextVersion = Math.max(db.version + 1, DB_VERSION + 1);
        const upgradeReq = indexedDB.open(DB_NAME, nextVersion);
        upgradeReq.onupgradeneeded = (e) => {
          const upDb = (e.target as IDBOpenDBRequest).result;
          Object.values(STORES).forEach(storeName => {
            if (!upDb.objectStoreNames.contains(storeName)) {
              upDb.createObjectStore(storeName, { keyPath: 'id' });
            }
          });
        };
        upgradeReq.onsuccess = () => resolve(upgradeReq.result);
        upgradeReq.onerror = () => resolve(db);
        return;
      }
      resolve(db);
    };
    request.onerror = () => reject(request.error);
  });
}

async function getAllFromStore<T>(storeName: string): Promise<T[]> {
  try {
    const db = await openDB();
    if (!db.objectStoreNames.contains(storeName)) {
      const local = localStorage.getItem(`vm_${storeName}`);
      return local ? JSON.parse(local) : [];
    }
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    // Fallback to localStorage
    const local = localStorage.getItem(`vm_${storeName}`);
    return local ? JSON.parse(local) : [];
  }
}

async function saveAllToStore<T extends { id: string }>(storeName: string, items: T[]): Promise<void> {
  try {
    const db = await openDB();
    if (!db.objectStoreNames.contains(storeName)) {
      localStorage.setItem(`vm_${storeName}`, JSON.stringify(items));
      return;
    }
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      store.clear();
      items.forEach(item => store.put(item));
      tx.oncomplete = () => {
        // Also mirror in localStorage for redundancy if small
        try {
          // Avoid storing large base64 attachments in localStorage
          if (storeName !== STORES.TRANSACTIONS && storeName !== STORES.DOCUMENTS) {
            localStorage.setItem(`vm_${storeName}`, JSON.stringify(items));
          }
        } catch (_) {}
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    localStorage.setItem(`vm_${storeName}`, JSON.stringify(items));
  }
}

async function getItemFromStore<T>(storeName: string, id: string): Promise<T | null> {
  try {
    const db = await openDB();
    if (!db.objectStoreNames.contains(storeName)) {
      const items = await getAllFromStore<T & { id: string }>(storeName);
      return items.find(i => i.id === id) || null;
    }
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    const items = await getAllFromStore<T & { id: string }>(storeName);
    return items.find(i => i.id === id) || null;
  }
}

async function putItemToStore<T extends { id: string }>(storeName: string, item: T): Promise<void> {
  try {
    const db = await openDB();
    if (!db.objectStoreNames.contains(storeName)) {
      const items = await getAllFromStore<T>(storeName);
      const idx = items.findIndex(i => i.id === item.id);
      if (idx >= 0) items[idx] = item;
      else items.push(item);
      await saveAllToStore(storeName, items);
      return;
    }
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      store.put(item);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    const items = await getAllFromStore<T>(storeName);
    const idx = items.findIndex(i => i.id === item.id);
    if (idx >= 0) items[idx] = item;
    else items.push(item);
    await saveAllToStore(storeName, items);
  }
}

async function deleteItemFromStore(storeName: string, id: string): Promise<void> {
  try {
    const db = await openDB();
    if (!db.objectStoreNames.contains(storeName)) {
      const items = await getAllFromStore<{ id: string }>(storeName);
      const filtered = items.filter(i => i.id !== id);
      await saveAllToStore(storeName, filtered);
      return;
    }
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      store.delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    const items = await getAllFromStore<{ id: string }>(storeName);
    const filtered = items.filter(i => i.id !== id);
    await saveAllToStore(storeName, filtered);
  }
}

export const StorageService = {
  getDeploymentMode(): DeploymentMode {
    const envMode = (import.meta as any).env?.VITE_DEPLOYMENT_MODE as DeploymentMode | undefined;
    const storedMode = localStorage.getItem(STORAGE_KEY_MODE) as DeploymentMode | null;
    if (storedMode) return storedMode;
    if (envMode) return envMode;
    const cfg = getStoredSupabaseConfig();
    return cfg.isConfigured ? 'cloud' : 'local';
  },

  setDeploymentMode(mode: DeploymentMode): void {
    localStorage.setItem(STORAGE_KEY_MODE, mode);
  },

  isCloudActive(): boolean {
    return this.getDeploymentMode() === 'cloud' && getStoredSupabaseConfig().isConfigured && Boolean(getSupabaseClient());
  },

  /**
   * Überträgt alle lokalen Vereinsdaten (IndexedDB) mit einem Klick in die Supabase Cloud
   */
  async migrateLocalToCloud(): Promise<{
    members: number;
    transactions: number;
    accounts: number;
    inventory: number;
    sepaRuns: number;
    settings: boolean;
  }> {
    if (!getStoredSupabaseConfig().isConfigured) {
      throw new Error('Supabase ist noch nicht mit URL und Anon Key konfiguriert.');
    }

    const [localMembers, localTransactions, localAccounts, localInventory, localSepaRuns, localSettings] = await Promise.all([
      getAllFromStore<Member>(STORES.MEMBERS),
      getAllFromStore<Transaction>(STORES.TRANSACTIONS),
      getAllFromStore<FinancialAccount>(STORES.ACCOUNTS),
      getAllFromStore<InventoryItem>(STORES.INVENTORY),
      getAllFromStore<SepaRunHistory>(STORES.SEPA_RUNS),
      this.getSettings()
    ]);

    // 1. Settings
    if (localSettings) {
      await CloudStorageService.saveSettings(localSettings);
    }

    // 2. Accounts
    if (localAccounts.length > 0) {
      await CloudStorageService.batchSaveAccounts(localAccounts);
    }

    // 3. Members
    if (localMembers.length > 0) {
      await CloudStorageService.batchSaveMembers(localMembers);
    }

    // 4. Transactions
    if (localTransactions.length > 0) {
      await CloudStorageService.batchSaveTransactions(localTransactions);
    }

    // 5. Inventory
    if (localInventory.length > 0) {
      await CloudStorageService.batchSaveInventory(localInventory);
    }

    // 6. Sepa Runs
    for (const run of localSepaRuns) {
      await CloudStorageService.saveSepaRun(run);
    }

    // Switch mode to cloud
    this.setDeploymentMode('cloud');

    return {
      members: localMembers.length,
      transactions: localTransactions.length,
      accounts: localAccounts.length,
      inventory: localInventory.length,
      sepaRuns: localSepaRuns.length,
      settings: Boolean(localSettings)
    };
  },

  async init(): Promise<void> {
    const initialized = localStorage.getItem('vm_initialized');
    if (!initialized) {
      await saveAllToStore(STORES.ACCOUNTS, INITIAL_ACCOUNTS);
      await saveAllToStore(STORES.MEMBERS, INITIAL_MEMBERS);
      await saveAllToStore(STORES.TRANSACTIONS, INITIAL_TRANSACTIONS);
      await saveAllToStore(STORES.AUDIT_LOGS, INITIAL_AUDIT_LOGS);
      await saveAllToStore(STORES.INVENTORY, INITIAL_INVENTORY);
      await saveAllToStore(STORES.FOLDERS, getInitialFolders());
      await saveAllToStore(STORES.DOCUMENTS, getInitialDocuments());
      await saveAllToStore(STORES.DONATIONS, INITIAL_DONATIONS);
      await putItemToStore(STORES.SETTINGS, { id: 'main', ...DEFAULT_SETTINGS });
      await this.syncReceiptsToDocuments();
      await this.syncDonationsToDocuments();
      localStorage.setItem('vm_initialized', 'true');
    } else {
      // Seed folders if existing user upgrades and folders store is empty
      const existingFolders = await getAllFromStore<DocumentFolder>(STORES.FOLDERS);
      if (!existingFolders || existingFolders.length === 0) {
        await saveAllToStore(STORES.FOLDERS, getInitialFolders());
      }
      // Seed inventory if existing user upgrades and inventory store is empty
      const existingInventory = await getAllFromStore<InventoryItem>(STORES.INVENTORY);
      if (!existingInventory || existingInventory.length === 0) {
        await saveAllToStore(STORES.INVENTORY, INITIAL_INVENTORY);
      }
      // Seed documents if existing user upgrades and documents store is empty
      const existingDocs = await getAllFromStore<ClubDocument>(STORES.DOCUMENTS);
      if (!existingDocs || existingDocs.length === 0) {
        await saveAllToStore(STORES.DOCUMENTS, getInitialDocuments());
      }
      // Seed donations if existing user upgrades
      const existingDonations = await getAllFromStore<DonationReceipt>(STORES.DONATIONS);
      if (!existingDonations || existingDonations.length === 0) {
        await saveAllToStore(STORES.DONATIONS, INITIAL_DONATIONS);
      }
      // Always sync receipts from transactions & donations into documents
      await this.syncReceiptsToDocuments();
      await this.syncDonationsToDocuments();
    }
  },

  // Members
  async getMembers(): Promise<Member[]> {
    if (this.isCloudActive()) {
      try {
        const cloudMembers = await CloudStorageService.getMembers();
        if (cloudMembers && cloudMembers.length > 0) {
          // Cache locally for offline resilience
          saveAllToStore(STORES.MEMBERS, cloudMembers).catch(() => {});
          return cloudMembers;
        }
      } catch (err) {
        console.warn('Cloud getMembers failed, fallback to local storage:', err);
      }
    }
    return getAllFromStore<Member>(STORES.MEMBERS);
  },

  async getMember(id: string): Promise<Member | null> {
    if (this.isCloudActive()) {
      try {
        const cloudMember = await CloudStorageService.getMember(id);
        if (cloudMember) return cloudMember;
      } catch (err) {
        console.warn('Cloud getMember failed, fallback to local storage:', err);
      }
    }
    return getItemFromStore<Member>(STORES.MEMBERS, id);
  },

  async saveMember(member: Member, author = 'Kassier / Administrator'): Promise<void> {
    const existing = await getItemFromStore<Member>(STORES.MEMBERS, member.id);
    const now = new Date().toISOString();
    
    if (existing) {
      // Record audit log
      const changes: MemberAuditLog['changes'] = [];
      const keys: (keyof Member)[] = [
        'firstName', 'lastName', 'gender', 'birthDate', 'phone', 'email',
        'entryDate', 'exitDate', 'status', 'department', 'membershipType',
        'feeAmount', 'feePeriod', 'paymentMethod', 'notes'
      ];
      
      const labels: Record<string, string> = {
        firstName: 'Vorname',
        lastName: 'Nachname',
        gender: 'Geschlecht',
        birthDate: 'Geburtsdatum',
        phone: 'Telefon',
        email: 'E-Mail',
        entryDate: 'Eintrittsdatum',
        exitDate: 'Austrittsdatum',
        status: 'Mitgliedsstatus',
        department: 'Abteilung',
        membershipType: 'Mitgliedschaftstyp',
        feeAmount: 'Beitragshöhe',
        feePeriod: 'Zahlungsweise',
        paymentMethod: 'Zahlungsmethode',
        notes: 'Notizen'
      };

      for (const key of keys) {
        if (existing[key] !== member[key]) {
          changes.push({
            field: key,
            label: labels[key] || key,
            oldValue: existing[key] || '–',
            newValue: member[key] || '–'
          });
        }
      }

      if (JSON.stringify(existing.address) !== JSON.stringify(member.address)) {
        changes.push({
          field: 'address',
          label: 'Adresse',
          oldValue: `${existing.address.street} ${existing.address.houseNumber}, ${existing.address.zip} ${existing.address.city}`,
          newValue: `${member.address.street} ${member.address.houseNumber}, ${member.address.zip} ${member.address.city}`
        });
      }

      if (JSON.stringify(existing.bankDetails) !== JSON.stringify(member.bankDetails)) {
        changes.push({
          field: 'bankDetails',
          label: 'Bankverbindung / SEPA',
          oldValue: existing.bankDetails.iban ? `IBAN: ${existing.bankDetails.iban}` : 'Keine Bankdaten',
          newValue: member.bankDetails.iban ? `IBAN: ${member.bankDetails.iban}` : 'Keine Bankdaten'
        });
      }

      if (changes.length > 0) {
        const auditLog: MemberAuditLog = {
          id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          memberId: member.id,
          memberNumber: member.memberNumber,
          memberName: `${member.firstName} ${member.lastName}`,
          timestamp: now,
          author,
          action: 'update',
          summary: `${changes.length} Feld(er) aktualisiert (${changes.map(c => c.label).join(', ')})`,
          changes
        };
        await putItemToStore(STORES.AUDIT_LOGS, auditLog);
        if (this.isCloudActive()) {
          CloudStorageService.saveAuditLog(auditLog).catch(() => {});
        }
      }

      member.updatedAt = now;
      await putItemToStore(STORES.MEMBERS, member);
      if (this.isCloudActive()) {
        await CloudStorageService.saveMember(member);
      }
    } else {
      // New member
      member.createdAt = now;
      member.updatedAt = now;
      await putItemToStore(STORES.MEMBERS, member);
      if (this.isCloudActive()) {
        await CloudStorageService.saveMember(member);
      }

      const auditLog: MemberAuditLog = {
        id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        memberId: member.id,
        memberNumber: member.memberNumber,
        memberName: `${member.firstName} ${member.lastName}`,
        timestamp: now,
        author,
        action: 'create',
        summary: `Neues Mitglied (${member.memberNumber}) angelegt`,
        changes: []
      };
      await putItemToStore(STORES.AUDIT_LOGS, auditLog);
      if (this.isCloudActive()) {
        CloudStorageService.saveAuditLog(auditLog).catch(() => {});
      }
    }
  },

  async deleteMember(id: string, author = 'Kassier / Administrator'): Promise<void> {
    const existing = await getItemFromStore<Member>(STORES.MEMBERS, id);
    if (existing) {
      const auditLog: MemberAuditLog = {
        id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        memberId: existing.id,
        memberNumber: existing.memberNumber,
        memberName: `${existing.firstName} ${existing.lastName}`,
        timestamp: new Date().toISOString(),
        author,
        action: 'delete',
        summary: `Mitglied (${existing.memberNumber} - ${existing.firstName} ${existing.lastName}) gelöscht`,
        changes: []
      };
      await putItemToStore(STORES.AUDIT_LOGS, auditLog);
      if (this.isCloudActive()) {
        CloudStorageService.saveAuditLog(auditLog).catch(() => {});
      }
    }
    await deleteItemFromStore(STORES.MEMBERS, id);
    if (this.isCloudActive()) {
      await CloudStorageService.deleteMember(id);
    }
  },

  async deleteMultipleMembers(ids: string[], author = 'Kassier / Administrator'): Promise<number> {
    const allMembers = await this.getMembers();
    const idSet = new Set(ids);
    const toDelete = allMembers.filter(m => idSet.has(m.id));
    const now = new Date().toISOString();

    for (const mem of toDelete) {
      const auditLog: MemberAuditLog = {
        id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        memberId: mem.id,
        memberNumber: mem.memberNumber,
        memberName: `${mem.firstName} ${mem.lastName}`,
        timestamp: now,
        author,
        action: 'delete',
        summary: `Sammellöschung: Mitglied (${mem.memberNumber} - ${mem.firstName} ${mem.lastName}) gelöscht`,
        changes: []
      };
      await putItemToStore(STORES.AUDIT_LOGS, auditLog);
      await deleteItemFromStore(STORES.MEMBERS, mem.id);
      if (this.isCloudActive()) {
        CloudStorageService.deleteMember(mem.id).catch(() => {});
        CloudStorageService.saveAuditLog(auditLog).catch(() => {});
      }
    }

    return toDelete.length;
  },

  async bulkUpdateMembers(
    ids: string[],
    updates: MemberBulkUpdates,
    author = 'Kassier / Administrator'
  ): Promise<{ updatedCount: number; updatedMembers: Member[] }> {
    const allMembers = await this.getMembers();
    const idSet = new Set(ids);
    const now = new Date().toISOString();
    const updatedMembersList: Member[] = [];

    const fieldLabels: Record<string, string> = {
      paymentMethod: 'Zahlungsmethode',
      feePeriod: 'Zahlungsweise',
      status: 'Mitgliedsstatus',
      membershipType: 'Mitgliedschaftstyp',
      department: 'Abteilung / Sparte',
      feeAmount: 'Beitragshöhe (€)',
      entryDate: 'Eintrittsdatum',
      exitDate: 'Austrittsdatum',
      dataPrivacyConsent: 'Datenschutz-Einwilligung',
      notes: 'Notizen'
    };

    const statusTranslations: Record<string, string> = {
      active: 'Aktiv',
      passive: 'Passiv',
      honorary: 'Ehrenmitglied',
      suspended: 'Ruhend',
      terminated: 'Gekündigt'
    };

    const paymentTranslations: Record<string, string> = {
      sepa: 'SEPA-Lastschrift',
      transfer: 'Überweisung',
      cash: 'Bargeld',
      standing_order: 'Dauerauftrag'
    };

    const periodTranslations: Record<string, string> = {
      monthly: 'monatlich',
      quarterly: 'vierteljährlich',
      half_yearly: 'halbjährlich',
      yearly: 'jährlich'
    };

    const typeTranslations: Record<string, string> = {
      full: 'Vollmitglied',
      youth: 'Jugend / Kinder',
      reduced: 'Ermäßigt',
      family: 'Familie',
      supporting: 'Förderer / Sponsor',
      honorary: 'Ehrenmitglied'
    };

    const formatVal = (field: string, val: any) => {
      if (val === undefined || val === null || val === '') return '–';
      if (field === 'status') return statusTranslations[val] || val;
      if (field === 'paymentMethod') return paymentTranslations[val] || val;
      if (field === 'feePeriod') return periodTranslations[val] || val;
      if (field === 'membershipType') return typeTranslations[val] || val;
      if (field === 'feeAmount') return `${Number(val).toFixed(2)} €`;
      if (field === 'dataPrivacyConsent') return val ? 'Zugestimmt' : 'Nicht erteilt';
      return String(val);
    };

    for (const mem of allMembers) {
      if (!idSet.has(mem.id)) continue;

      const memberCopy = { ...mem };
      const changes: MemberAuditLog['changes'] = [];

      // Payment Method
      if (updates.paymentMethod !== undefined && memberCopy.paymentMethod !== updates.paymentMethod) {
        changes.push({
          field: 'paymentMethod',
          label: fieldLabels.paymentMethod,
          oldValue: formatVal('paymentMethod', memberCopy.paymentMethod),
          newValue: formatVal('paymentMethod', updates.paymentMethod)
        });
        memberCopy.paymentMethod = updates.paymentMethod;
      }

      // Fee Period
      if (updates.feePeriod !== undefined && memberCopy.feePeriod !== updates.feePeriod) {
        changes.push({
          field: 'feePeriod',
          label: fieldLabels.feePeriod,
          oldValue: formatVal('feePeriod', memberCopy.feePeriod),
          newValue: formatVal('feePeriod', updates.feePeriod)
        });
        memberCopy.feePeriod = updates.feePeriod;
      }

      // Status
      if (updates.status !== undefined && memberCopy.status !== updates.status) {
        changes.push({
          field: 'status',
          label: fieldLabels.status,
          oldValue: formatVal('status', memberCopy.status),
          newValue: formatVal('status', updates.status)
        });
        memberCopy.status = updates.status;
      }

      // Membership Type
      if (updates.membershipType !== undefined && memberCopy.membershipType !== updates.membershipType) {
        changes.push({
          field: 'membershipType',
          label: fieldLabels.membershipType,
          oldValue: formatVal('membershipType', memberCopy.membershipType),
          newValue: formatVal('membershipType', updates.membershipType)
        });
        memberCopy.membershipType = updates.membershipType;
      }

      // Department
      if (updates.department !== undefined && memberCopy.department !== updates.department) {
        changes.push({
          field: 'department',
          label: fieldLabels.department,
          oldValue: memberCopy.department || '–',
          newValue: updates.department
        });
        memberCopy.department = updates.department;
      }

      // Fee Amount
      if (updates.feeAmount !== undefined && memberCopy.feeAmount !== updates.feeAmount) {
        changes.push({
          field: 'feeAmount',
          label: fieldLabels.feeAmount,
          oldValue: `${memberCopy.feeAmount.toFixed(2)} €`,
          newValue: `${updates.feeAmount.toFixed(2)} €`
        });
        memberCopy.feeAmount = updates.feeAmount;
      }

      // Entry Date
      if (updates.entryDate !== undefined && updates.entryDate !== '' && memberCopy.entryDate !== updates.entryDate) {
        changes.push({
          field: 'entryDate',
          label: fieldLabels.entryDate,
          oldValue: memberCopy.entryDate || '–',
          newValue: updates.entryDate
        });
        memberCopy.entryDate = updates.entryDate;
      }

      // Monthly Due Day
      if (updates.monthlyDueDay !== undefined && memberCopy.bankDetails?.monthlyDueDay !== updates.monthlyDueDay) {
        changes.push({
          field: 'monthlyDueDay',
          label: 'Fälligkeitstag (monatlicher Einzug)',
          oldValue: memberCopy.bankDetails?.monthlyDueDay ? `${memberCopy.bankDetails.monthlyDueDay}. des Monats` : '–',
          newValue: `${updates.monthlyDueDay}. des Monats`
        });
        memberCopy.bankDetails = {
          ...memberCopy.bankDetails,
          monthlyDueDay: updates.monthlyDueDay
        };
      }

      // Exit Date
      if (updates.exitDate !== undefined && memberCopy.exitDate !== updates.exitDate) {
        changes.push({
          field: 'exitDate',
          label: fieldLabels.exitDate,
          oldValue: memberCopy.exitDate || '–',
          newValue: updates.exitDate || '–'
        });
        memberCopy.exitDate = updates.exitDate || undefined;
      }

      // Data Privacy Consent
      if (updates.dataPrivacyConsent !== undefined && memberCopy.dataPrivacyConsent !== updates.dataPrivacyConsent) {
        changes.push({
          field: 'dataPrivacyConsent',
          label: fieldLabels.dataPrivacyConsent,
          oldValue: memberCopy.dataPrivacyConsent ? 'Zugestimmt' : 'Nicht erteilt',
          newValue: updates.dataPrivacyConsent ? 'Zugestimmt' : 'Nicht erteilt'
        });
        memberCopy.dataPrivacyConsent = updates.dataPrivacyConsent;
      }

      // Notes
      if (updates.notesAction === 'replace' && updates.notesValue !== undefined) {
        if (memberCopy.notes !== updates.notesValue) {
          changes.push({
            field: 'notes',
            label: fieldLabels.notes,
            oldValue: memberCopy.notes || '–',
            newValue: updates.notesValue || '–'
          });
          memberCopy.notes = updates.notesValue;
        }
      } else if (updates.notesAction === 'append' && updates.notesValue && updates.notesValue.trim()) {
        const newNotes = memberCopy.notes ? `${memberCopy.notes}\n${updates.notesValue.trim()}` : updates.notesValue.trim();
        changes.push({
          field: 'notes',
          label: 'Notiz angehängt',
          oldValue: memberCopy.notes || '–',
          newValue: newNotes
        });
        memberCopy.notes = newNotes;
      }

      if (changes.length > 0) {
        memberCopy.updatedAt = now;
        await putItemToStore(STORES.MEMBERS, memberCopy);
        if (this.isCloudActive()) {
          CloudStorageService.saveMember(memberCopy).catch(() => {});
        }

        const auditLog: MemberAuditLog = {
          id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          memberId: memberCopy.id,
          memberNumber: memberCopy.memberNumber,
          memberName: `${memberCopy.firstName} ${memberCopy.lastName}`,
          timestamp: now,
          author,
          action: 'update',
          summary: `Sammeländerung Stammdaten: ${changes.length} Feld(er) angepasst (${changes.map(c => c.label).join(', ')})`,
          changes
        };
        await putItemToStore(STORES.AUDIT_LOGS, auditLog);
        if (this.isCloudActive()) {
          CloudStorageService.saveAuditLog(auditLog).catch(() => {});
        }
        updatedMembersList.push(memberCopy);
      }
    }

    return {
      updatedCount: updatedMembersList.length,
      updatedMembers: updatedMembersList
    };
  },

  async batchSaveMembers(members: Member[], author = 'Kassier (CSV Import)'): Promise<{ added: number; updated: number }> {
    const current = await this.getMembers();
    const map = new Map<string, Member>(current.map(m => [m.id, m]));
    let added = 0;
    let updated = 0;
    const now = new Date().toISOString();

    for (const mem of members) {
      if (map.has(mem.id)) {
        updated++;
        mem.updatedAt = now;
      } else {
        added++;
        mem.createdAt = mem.createdAt || now;
        mem.updatedAt = now;
      }
      map.set(mem.id, mem);
    }

    await saveAllToStore(STORES.MEMBERS, Array.from(map.values()));
    if (this.isCloudActive()) {
      await CloudStorageService.batchSaveMembers(members);
    }

    const auditLog: MemberAuditLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      memberId: 'batch-import',
      memberNumber: 'CSV-IMPORT',
      memberName: `${members.length} Mitglieder`,
      timestamp: now,
      author,
      action: 'create',
      summary: `Batch-CSV-Import: ${added} Mitglied(er) neu hinzugefügt, ${updated} aktualisiert.`,
      changes: []
    };
    await putItemToStore(STORES.AUDIT_LOGS, auditLog);
    if (this.isCloudActive()) {
      CloudStorageService.saveAuditLog(auditLog).catch(() => {});
    }

    return { added, updated };
  },

  // Audit Logs
  async getAuditLogs(memberId?: string): Promise<MemberAuditLog[]> {
    if (this.isCloudActive()) {
      try {
        const logs = await CloudStorageService.getAuditLogs();
        if (logs && logs.length > 0) {
          if (memberId) return logs.filter(l => l.memberId === memberId);
          return logs;
        }
      } catch (err) {
        console.warn('Cloud getAuditLogs error:', err);
      }
    }
    const logs = await getAllFromStore<MemberAuditLog>(STORES.AUDIT_LOGS);
    logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    if (memberId) {
      return logs.filter(l => l.memberId === memberId);
    }
    return logs;
  },

  // Accounts
  async getAccounts(): Promise<FinancialAccount[]> {
    if (this.isCloudActive()) {
      try {
        const cloudAccounts = await CloudStorageService.getAccounts();
        if (cloudAccounts && cloudAccounts.length > 0) {
          saveAllToStore(STORES.ACCOUNTS, cloudAccounts).catch(() => {});
          return cloudAccounts;
        }
      } catch (err) {
        console.warn('Cloud getAccounts error:', err);
      }
    }
    return getAllFromStore<FinancialAccount>(STORES.ACCOUNTS);
  },

  async saveAccount(account: FinancialAccount): Promise<void> {
    if (!account.id) {
      account.id = `acc-${Date.now()}`;
      account.createdAt = new Date().toISOString();
    }
    await putItemToStore(STORES.ACCOUNTS, account);
    if (this.isCloudActive()) {
      await CloudStorageService.saveAccount(account);
    }
  },

  async deleteAccount(id: string): Promise<void> {
    await deleteItemFromStore(STORES.ACCOUNTS, id);
    if (this.isCloudActive()) {
      await CloudStorageService.deleteAccount(id);
    }
  },

  // Transactions
  async getTransactions(): Promise<Transaction[]> {
    if (this.isCloudActive()) {
      try {
        const cloudTxs = await CloudStorageService.getTransactions();
        if (cloudTxs && cloudTxs.length > 0) {
          saveAllToStore(STORES.TRANSACTIONS, cloudTxs).catch(() => {});
          return cloudTxs;
        }
      } catch (err) {
        console.warn('Cloud getTransactions error:', err);
      }
    }
    const txs = await getAllFromStore<Transaction>(STORES.TRANSACTIONS);
    return txs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  },

  async saveTransaction(transaction: Transaction): Promise<void> {
    const now = new Date().toISOString();
    if (!transaction.id) {
      transaction.id = `tx-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      transaction.createdAt = now;
    }
    transaction.updatedAt = now;
    await putItemToStore(STORES.TRANSACTIONS, transaction);
    
    // Automatische Synchronisation des Belegs in die Dokumentenverwaltung
    if (transaction.receipt && transaction.receipt.dataUrl) {
      const docId = `doc-receipt-${transaction.id}`;
      const doc: ClubDocument = {
        id: docId,
        title: `Beleg: ${transaction.documentNumber} - ${transaction.bookingText || transaction.partner}`,
        fileName: transaction.receipt.name || `Beleg_${transaction.documentNumber}.pdf`,
        fileType: transaction.receipt.type || 'application/pdf',
        fileSize: transaction.receipt.size || 0,
        dataUrl: transaction.receipt.dataUrl,
        category: 'belege',
        date: transaction.date,
        uploadDate: transaction.receipt.uploadedAt || transaction.createdAt || now,
        tags: ['Beleg', transaction.sphere, transaction.category, transaction.documentNumber].filter(Boolean),
        notes: transaction.notes || `Buchungsbeleg für ${transaction.partner} (${transaction.bookingText})`,
        transactionId: transaction.id,
        transactionDocNumber: transaction.documentNumber,
        isReceipt: true,
        createdAt: transaction.createdAt || now,
        updatedAt: now
      };
      await putItemToStore(STORES.DOCUMENTS, doc);
    }
    
    if (this.isCloudActive()) {
      await CloudStorageService.saveTransaction(transaction);
    }
  },

  async saveBatchTransactions(transactions: Transaction[]): Promise<void> {
    const current = await this.getTransactions();
    const map = new Map<string, Transaction>(current.map(t => [t.id, t]));
    transactions.forEach(t => map.set(t.id, t));
    await saveAllToStore(STORES.TRANSACTIONS, Array.from(map.values()));
    if (this.isCloudActive()) {
      await CloudStorageService.batchSaveTransactions(transactions);
    }
  },

  async batchSaveTransactions(transactions: Transaction[]): Promise<void> {
    return this.saveBatchTransactions(transactions);
  },

  async deleteTransaction(id: string): Promise<void> {
    await deleteItemFromStore(STORES.TRANSACTIONS, id);
    if (this.isCloudActive()) {
      await CloudStorageService.deleteTransaction(id);
    }
  },

  // Inventory
  async getInventory(): Promise<InventoryItem[]> {
    if (this.isCloudActive()) {
      try {
        const cloudItems = await CloudStorageService.getInventory();
        if (cloudItems && cloudItems.length > 0) {
          saveAllToStore(STORES.INVENTORY, cloudItems).catch(() => {});
          return cloudItems;
        }
      } catch (err) {
        console.warn('Cloud getInventory error:', err);
      }
    }
    return getAllFromStore<InventoryItem>(STORES.INVENTORY);
  },

  async getInventoryItem(id: string): Promise<InventoryItem | null> {
    if (this.isCloudActive()) {
      try {
        const item = await CloudStorageService.getInventory().then(list => list.find(i => i.id === id) || null);
        if (item) return item;
      } catch (err) {
        console.warn('Cloud getInventoryItem error:', err);
      }
    }
    return getItemFromStore<InventoryItem>(STORES.INVENTORY, id);
  },

  async saveInventoryItem(item: InventoryItem): Promise<void> {
    const existing = await getItemFromStore<InventoryItem>(STORES.INVENTORY, item.id);
    const now = new Date().toISOString();

    const toSave: InventoryItem = {
      ...item,
      createdAt: existing?.createdAt || item.createdAt || now,
      updatedAt: now
    };

    await putItemToStore(STORES.INVENTORY, toSave);
    if (this.isCloudActive()) {
      await CloudStorageService.saveInventoryItem(toSave);
    }
  },

  async batchSaveInventory(items: InventoryItem[]): Promise<void> {
    for (const item of items) {
      await this.saveInventoryItem(item);
    }
  },

  async deleteInventoryItem(id: string): Promise<void> {
    await deleteItemFromStore(STORES.INVENTORY, id);
    if (this.isCloudActive()) {
      await CloudStorageService.deleteInventoryItem(id);
    }
  },

  // Settings
  async getSettings(): Promise<ClubSettings> {
    if (this.isCloudActive()) {
      try {
        const cloudSettings = await CloudStorageService.getSettings();
        if (cloudSettings) {
          putItemToStore(STORES.SETTINGS, { id: 'main', ...cloudSettings }).catch(() => {});
          return cloudSettings;
        }
      } catch (err) {
        console.warn('Cloud getSettings error:', err);
      }
    }
    const res = await getItemFromStore<ClubSettings & { id: string }>(STORES.SETTINGS, 'main');
    if (res) {
      const { id, ...rest } = res;
      return rest as ClubSettings;
    }
    return DEFAULT_SETTINGS;
  },

  async saveSettings(settings: ClubSettings): Promise<void> {
    await putItemToStore(STORES.SETTINGS, { id: 'main', ...settings });
    if (this.isCloudActive()) {
      await CloudStorageService.saveSettings(settings);
    }
  },

  // SEPA Run History & Financial Booking
  async getSepaRuns(): Promise<SepaRunHistory[]> {
    if (this.isCloudActive()) {
      try {
        const cloudRuns = await CloudStorageService.getSepaRuns();
        if (cloudRuns && cloudRuns.length > 0) {
          saveAllToStore(STORES.SEPA_RUNS, cloudRuns).catch(() => {});
          return cloudRuns;
        }
      } catch (err) {
        console.warn('Cloud getSepaRuns error:', err);
      }
    }
    const runs = await getAllFromStore<SepaRunHistory>(STORES.SEPA_RUNS);
    return runs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  async saveSepaRun(run: SepaRunHistory): Promise<void> {
    await putItemToStore(STORES.SEPA_RUNS, run);
    if (this.isCloudActive()) {
      await CloudStorageService.saveSepaRun(run);
    }
  },

  async deleteSepaRun(id: string): Promise<void> {
    await deleteItemFromStore(STORES.SEPA_RUNS, id);
    if (this.isCloudActive()) {
      await CloudStorageService.deleteSepaRun(id);
    }
  },

  /**
   * Automatically books all debit items of a SEPA run into the financial accounting ledger
   */
  async bookSepaRunTransactions(run: SepaRunHistory, targetAccountId: string): Promise<Transaction[]> {
    const activeItems = run.items.filter(i => i.selected && i.isValid && i.amount > 0);
    const now = new Date().toISOString();
    const createdTransactions: Transaction[] = [];

    for (const item of activeItems) {
      const docNum = `SEPA-${run.targetYear}-${run.targetMonth ? run.targetMonth.toString().padStart(2, '0') : 'RUN'}-${item.memberNumber}`;
      const tx: Transaction = {
        id: `tx-sepa-${run.id}-${item.memberNumber}-${Math.random().toString(36).substring(2, 6)}`,
        date: run.executionDate,
        amount: item.amount, // Income (positive)
        type: 'income',
        accountId: targetAccountId,
        documentNumber: docNum,
        bookingText: item.remittanceInfo,
        partner: item.accountHolder || item.memberName,
        sphere: 'ideell',
        category: 'Mitgliedsbeiträge',
        vatRate: 0,
        notes: `Automatische Verbuchung aus SEPA-Beitragslauf "${run.title}" (Mandat: ${item.mandateReference}, IBAN: ${item.iban.slice(0, 6)}...${item.iban.slice(-4)})`,
        createdAt: now,
        updatedAt: now
      };
      createdTransactions.push(tx);
    }

    // Save batch transactions
    if (createdTransactions.length > 0) {
      await this.saveBatchTransactions(createdTransactions);
    }

    // Mark SEPA run as booked
    const updatedRun: SepaRunHistory = {
      ...run,
      isBooked: true,
      bookedToAccountId: targetAccountId
    };
    await this.saveSepaRun(updatedRun);

    return createdTransactions;
  },

  // Documents Management
  async getDocuments(): Promise<ClubDocument[]> {
    const docs = await getAllFromStore<ClubDocument>(STORES.DOCUMENTS);
    return docs.sort((a, b) => new Date(b.date || b.createdAt).getTime() - new Date(a.date || a.createdAt).getTime());
  },

  async getDocument(id: string): Promise<ClubDocument | null> {
    return getItemFromStore<ClubDocument>(STORES.DOCUMENTS, id);
  },

  async saveDocument(document: ClubDocument): Promise<void> {
    const now = new Date().toISOString();
    if (!document.id) {
      document.id = `doc-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      document.createdAt = now;
    }
    document.updatedAt = now;
    await putItemToStore(STORES.DOCUMENTS, document);
  },

  async saveBatchDocuments(documents: ClubDocument[]): Promise<void> {
    const current = await this.getDocuments();
    const map = new Map<string, ClubDocument>(current.map(d => [d.id, d]));
    documents.forEach(d => map.set(d.id, d));
    await saveAllToStore(STORES.DOCUMENTS, Array.from(map.values()));
  },

  async deleteDocument(id: string): Promise<void> {
    await deleteItemFromStore(STORES.DOCUMENTS, id);
  },

  async deleteMultipleDocuments(ids: string[]): Promise<number> {
    const current = await this.getDocuments();
    const idSet = new Set(ids);
    const remaining = current.filter(d => !idSet.has(d.id));
    await saveAllToStore(STORES.DOCUMENTS, remaining);
    return ids.length;
  },

  async moveDocumentsToCategory(ids: string[], targetCategory: DocumentCategory): Promise<number> {
    const current = await this.getDocuments();
    const idSet = new Set(ids);
    const now = new Date().toISOString();
    let count = 0;
    const updated = current.map(d => {
      if (idSet.has(d.id)) {
        count++;
        return {
          ...d,
          category: targetCategory,
          updatedAt: now
        };
      }
      return d;
    });
    await saveAllToStore(STORES.DOCUMENTS, updated);
    return count;
  },

  // Folder Management
  async getFolders(): Promise<DocumentFolder[]> {
    const folders = await getAllFromStore<DocumentFolder>(STORES.FOLDERS);
    if (!folders || folders.length === 0) {
      const initial = getInitialFolders();
      await saveAllToStore(STORES.FOLDERS, initial);
      return initial;
    }
    return folders.sort((a, b) => a.name.localeCompare(b.name, 'de'));
  },

  async getFolder(id: string): Promise<DocumentFolder | null> {
    return getItemFromStore<DocumentFolder>(STORES.FOLDERS, id);
  },

  async saveFolder(folder: DocumentFolder): Promise<void> {
    const now = new Date().toISOString();
    if (!folder.id) {
      folder.id = `folder-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      folder.createdAt = now;
    }
    folder.updatedAt = now;
    await putItemToStore(STORES.FOLDERS, folder);
  },

  async deleteFolder(folderId: string): Promise<void> {
    // Retrieve all folders to find descendant subfolders recursively
    const allFolders = await this.getFolders();
    const toDeleteIds = new Set<string>([folderId]);

    let added = true;
    while (added) {
      added = false;
      for (const f of allFolders) {
        if (f.parentId && toDeleteIds.has(f.parentId) && !toDeleteIds.has(f.id)) {
          toDeleteIds.add(f.id);
          added = true;
        }
      }
    }

    // Unassign documents inside deleted folders (or keep them at root / unassigned)
    const docs = await this.getDocuments();
    let docsChanged = false;
    const updatedDocs = docs.map(d => {
      if (d.folderId && toDeleteIds.has(d.folderId)) {
        docsChanged = true;
        return {
          ...d,
          folderId: undefined,
          updatedAt: new Date().toISOString()
        };
      }
      return d;
    });

    if (docsChanged) {
      await saveAllToStore(STORES.DOCUMENTS, updatedDocs);
    }

    // Remove deleted folders
    const remainingFolders = allFolders.filter(f => !toDeleteIds.has(f.id));
    await saveAllToStore(STORES.FOLDERS, remainingFolders);
  },

  async moveDocumentToFolder(docId: string, folderId: string | null, newCategory?: DocumentCategory): Promise<void> {
    const doc = await this.getDocument(docId);
    if (!doc) return;
    doc.folderId = folderId || undefined;
    if (newCategory) {
      doc.category = newCategory;
    }
    doc.updatedAt = new Date().toISOString();
    await this.saveDocument(doc);
  },

  async batchMoveDocumentsToFolder(docIds: string[], folderId: string | null, targetCategory?: DocumentCategory): Promise<number> {
    const current = await this.getDocuments();
    const idSet = new Set(docIds);
    const now = new Date().toISOString();
    let count = 0;
    const updated = current.map(d => {
      if (idSet.has(d.id)) {
        count++;
        return {
          ...d,
          folderId: folderId || undefined,
          ...(targetCategory ? { category: targetCategory } : {}),
          updatedAt: now
        };
      }
      return d;
    });
    await saveAllToStore(STORES.DOCUMENTS, updated);
    return count;
  },

  /**
   * Synchronisiert Belege aus Transaktionen in die Dokumentenablage
   */
  async syncReceiptsToDocuments(): Promise<number> {
    const [txs, docs] = await Promise.all([
      this.getTransactions(),
      this.getDocuments()
    ]);
    const docMap = new Map<string, ClubDocument>(docs.map(d => [d.id, d]));
    let synced = 0;

    for (const tx of txs) {
      if (tx.receipt && tx.receipt.dataUrl) {
        const docId = `doc-receipt-${tx.id}`;
        if (!docMap.has(docId)) {
          const doc: ClubDocument = {
            id: docId,
            title: `Beleg: ${tx.documentNumber} - ${tx.bookingText || tx.partner}`,
            fileName: tx.receipt.name || `Beleg_${tx.documentNumber}.pdf`,
            fileType: tx.receipt.type || 'application/pdf',
            fileSize: tx.receipt.size || 0,
            dataUrl: tx.receipt.dataUrl,
            category: 'belege',
            date: tx.date,
            uploadDate: tx.receipt.uploadedAt || tx.createdAt || new Date().toISOString(),
            tags: ['Beleg', tx.sphere, tx.category, tx.documentNumber].filter(Boolean),
            notes: tx.notes || `Buchungsbeleg für ${tx.partner}`,
            transactionId: tx.id,
            transactionDocNumber: tx.documentNumber,
            isReceipt: true,
            createdAt: tx.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          docMap.set(docId, doc);
          synced++;
        }
      }
    }

    if (synced > 0) {
      await saveAllToStore(STORES.DOCUMENTS, Array.from(docMap.values()));
    }
    return synced;
  },

  // Spenden & Zuwendungsbestätigungen (BMF Muster)
  async getDonations(): Promise<DonationReceipt[]> {
    const donations = await getAllFromStore<DonationReceipt>(STORES.DONATIONS);
    return donations.sort((a, b) => new Date(b.date || b.createdAt).getTime() - new Date(a.date || a.createdAt).getTime());
  },

  async getDonation(id: string): Promise<DonationReceipt | null> {
    return getItemFromStore<DonationReceipt>(STORES.DONATIONS, id);
  },

  async saveDonationReceipt(
    receipt: DonationReceipt,
    options?: {
      autoArchiveDoc?: boolean;
      autoCreateTx?: boolean;
      targetAccountId?: string;
    }
  ): Promise<{ receipt: DonationReceipt; document?: ClubDocument; transaction?: Transaction }> {
    const now = new Date().toISOString();
    const existing = await getItemFromStore<DonationReceipt>(STORES.DONATIONS, receipt.id);
    const settings = await this.getSettings();

    const toSave: DonationReceipt = {
      ...receipt,
      createdAt: existing?.createdAt || receipt.createdAt || now,
      updatedAt: now
    };

    let createdTx: Transaction | undefined;
    let createdDoc: ClubDocument | undefined;

    // 1. Auto-create booking in financial accounting if requested (for Geldspenden)
    if (options?.autoCreateTx && options.targetAccountId && toSave.type === 'money' && !toSave.transactionId) {
      const docNum = `SP-${new Date(toSave.date).getFullYear()}-${toSave.receiptNumber.replace(/[^0-9]/g, '').slice(-3) || Math.floor(100 + Math.random() * 900)}`;
      const tx: Transaction = {
        id: `tx-don-${toSave.id}-${Date.now()}`,
        date: toSave.date,
        amount: toSave.amount, // Income (positive)
        type: 'income',
        accountId: options.targetAccountId,
        documentNumber: docNum,
        bookingText: `Spende / Zuwendung: ${toSave.donorName} (${toSave.receiptNumber})`,
        partner: toSave.donorName,
        sphere: 'ideell',
        category: 'Spenden / Schenkungen',
        vatRate: 0,
        notes: `Zuwendungsbestätigung ${toSave.receiptNumber} nach amtl. BMF-Muster. ${toSave.notes || ''}`.trim(),
        createdAt: now,
        updatedAt: now
      };
      await this.saveTransaction(tx);
      createdTx = tx;
      toSave.transactionId = tx.id;
    }

    // 2. Auto-generate PDF & archive in document storage
    if (options?.autoArchiveDoc !== false) {
      try {
        const pdfDataUrl = getDonationPdfDataUrl(toSave, settings);
        const docId = toSave.documentId || `doc-don-${toSave.id}`;
        const isGoods = toSave.type === 'goods';
        const doc: ClubDocument = {
          id: docId,
          title: `Zuwendungsbestätigung: ${toSave.receiptNumber} - ${toSave.donorName}`,
          fileName: `Zuwendungsbestaetigung_${toSave.receiptNumber}_${toSave.donorName.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`,
          fileType: 'application/pdf',
          fileSize: Math.round(pdfDataUrl.length * 0.75),
          dataUrl: pdfDataUrl,
          category: 'belege',
          date: toSave.date,
          uploadDate: now,
          tags: ['Spendenbescheinigung', 'Zuwendungsbestätigung', isGoods ? 'Sachzuwendung' : 'Geldzuwendung', toSave.receiptNumber, 'BMF-Muster'],
          notes: `${isGoods ? 'Sachspende' : 'Geldspende'} über ${toSave.amount.toFixed(2)} € von ${toSave.donorName}. BMF-konformes amtliches Formular.`,
          transactionId: toSave.transactionId,
          memberId: toSave.memberId,
          memberName: toSave.donorName,
          isReceipt: true,
          createdAt: now,
          updatedAt: now
        };
        await this.saveDocument(doc);
        createdDoc = doc;
        toSave.documentId = doc.id;
      } catch (err) {
        console.warn('Could not auto-generate PDF for document archive:', err);
      }
    }

    await putItemToStore(STORES.DONATIONS, toSave);

    return { receipt: toSave, document: createdDoc, transaction: createdTx };
  },

  async deleteDonationReceipt(id: string): Promise<void> {
    const existing = await getItemFromStore<DonationReceipt>(STORES.DONATIONS, id);
    if (existing?.documentId) {
      await this.deleteDocument(existing.documentId).catch(() => {});
    }
    await deleteItemFromStore(STORES.DONATIONS, id);
  },

  /**
   * Synchronisiert alle Zuwendungsbestätigungen als PDF in die Dokumentenablage
   */
  async syncDonationsToDocuments(): Promise<number> {
    const [donations, docs, settings] = await Promise.all([
      this.getDonations(),
      this.getDocuments(),
      this.getSettings()
    ]);
    const docMap = new Map<string, ClubDocument>(docs.map(d => [d.id, d]));
    let synced = 0;

    for (const don of donations) {
      const docId = don.documentId || `doc-don-${don.id}`;
      if (!docMap.has(docId)) {
        try {
          const pdfDataUrl = getDonationPdfDataUrl(don, settings);
          const isGoods = don.type === 'goods';
          const doc: ClubDocument = {
            id: docId,
            title: `Zuwendungsbestätigung: ${don.receiptNumber} - ${don.donorName}`,
            fileName: `Zuwendungsbestaetigung_${don.receiptNumber}_${don.donorName.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`,
            fileType: 'application/pdf',
            fileSize: Math.round(pdfDataUrl.length * 0.75),
            dataUrl: pdfDataUrl,
            category: 'belege',
            date: don.date,
            uploadDate: don.createdAt || new Date().toISOString(),
            tags: ['Spendenbescheinigung', 'Zuwendungsbestätigung', isGoods ? 'Sachzuwendung' : 'Geldzuwendung', don.receiptNumber, 'BMF-Muster'],
            notes: `${isGoods ? 'Sachspende' : 'Geldspende'} über ${don.amount.toFixed(2)} € von ${don.donorName}. BMF-konformes amtliches Formular.`,
            transactionId: don.transactionId,
            memberId: don.memberId,
            memberName: don.donorName,
            isReceipt: true,
            createdAt: don.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          docMap.set(docId, doc);
          synced++;
        } catch (err) {
          console.warn('Failed to generate donation document sync:', err);
        }
      }
    }

    if (synced > 0) {
      await saveAllToStore(STORES.DOCUMENTS, Array.from(docMap.values()));
    }
    return synced;
  },

  // Full Database Backup & Restore
  async exportFullBackup(): Promise<string> {
    const [members, transactions, accounts, auditLogs, inventory, sepaRuns, documents, donations, settings] = await Promise.all([
      this.getMembers(),
      this.getTransactions(),
      this.getAccounts(),
      this.getAuditLogs(),
      this.getInventory(),
      this.getSepaRuns(),
      this.getDocuments(),
      this.getDonations(),
      this.getSettings()
    ]);

    const backup = {
      app: 'VereinsManager Lokal',
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      data: {
        members,
        transactions,
        accounts,
        auditLogs,
        inventory,
        sepaRuns,
        documents,
        donations,
        settings
      }
    };

    return JSON.stringify(backup, null, 2);
  },

  async importFullBackup(jsonString: string): Promise<{ membersCount: number; transactionsCount: number; inventoryCount: number; documentsCount: number; donationsCount: number }> {
    const parsed = JSON.parse(jsonString);
    if (!parsed.data) {
      throw new Error('Ungültiges Sicherungsformat');
    }
    const { members = [], transactions = [], accounts = [], auditLogs = [], inventory = [], sepaRuns = [], documents = [], donations = [], settings } = parsed.data;

    await saveAllToStore(STORES.MEMBERS, members);
    await saveAllToStore(STORES.TRANSACTIONS, transactions);
    await saveAllToStore(STORES.ACCOUNTS, accounts);
    await saveAllToStore(STORES.AUDIT_LOGS, auditLogs);
    await saveAllToStore(STORES.INVENTORY, inventory);
    await saveAllToStore(STORES.SEPA_RUNS, sepaRuns);
    await saveAllToStore(STORES.DOCUMENTS, documents);
    await saveAllToStore(STORES.DONATIONS, donations);
    if (settings) {
      await putItemToStore(STORES.SETTINGS, { id: 'main', ...settings });
    }

    if (this.isCloudActive()) {
      if (members.length > 0) await CloudStorageService.batchSaveMembers(members);
      if (transactions.length > 0) await CloudStorageService.batchSaveTransactions(transactions);
      if (accounts.length > 0) await CloudStorageService.batchSaveAccounts(accounts);
      if (inventory.length > 0) await CloudStorageService.batchSaveInventory(inventory);
      if (settings) await CloudStorageService.saveSettings(settings);
    }

    return {
      membersCount: members.length,
      transactionsCount: transactions.length,
      inventoryCount: inventory.length,
      documentsCount: documents.length,
      donationsCount: donations.length
    };
  },

  async resetToDemoData(): Promise<void> {
    await saveAllToStore(STORES.ACCOUNTS, INITIAL_ACCOUNTS);
    await saveAllToStore(STORES.MEMBERS, INITIAL_MEMBERS);
    await saveAllToStore(STORES.TRANSACTIONS, INITIAL_TRANSACTIONS);
    await saveAllToStore(STORES.AUDIT_LOGS, INITIAL_AUDIT_LOGS);
    await saveAllToStore(STORES.INVENTORY, INITIAL_INVENTORY);
    await saveAllToStore(STORES.SEPA_RUNS, []);
    await saveAllToStore(STORES.DOCUMENTS, getInitialDocuments());
    await saveAllToStore(STORES.DONATIONS, INITIAL_DONATIONS);
    await putItemToStore(STORES.SETTINGS, { id: 'main', ...DEFAULT_SETTINGS });
    await this.syncReceiptsToDocuments();
    await this.syncDonationsToDocuments();
  },

  async clearAllData(): Promise<void> {
    await saveAllToStore(STORES.ACCOUNTS, []);
    await saveAllToStore(STORES.MEMBERS, []);
    await saveAllToStore(STORES.TRANSACTIONS, []);
    await saveAllToStore(STORES.AUDIT_LOGS, []);
    await saveAllToStore(STORES.INVENTORY, []);
    await saveAllToStore(STORES.SEPA_RUNS, []);
    await saveAllToStore(STORES.DOCUMENTS, []);
    await saveAllToStore(STORES.DONATIONS, []);
  }
};

