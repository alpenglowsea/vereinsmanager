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
  DonationReceipt,
  CalendarEvent,
  CalendarEventCategory,
  OnlineMembershipApplication,
  ApplicationTemplateSettings,
  ClubContact,
  ClubInvoice,
  InvoiceTemplateSettings,
  Meeting,
  MeetingTemplateSettings
} from '../types';
import { UserDashboardConfig } from '../types/dashboard';
import { DEFAULT_DASHBOARD_CONFIG } from '../data/defaultDashboard';
import { DEFAULT_DEPARTMENTS } from '../data/taxSpheres';
import { INITIAL_INVENTORY } from '../data/initialInventory';
import { INITIAL_CONTACTS } from '../data/initialContacts';
import { INITIAL_INVOICES, DEFAULT_INVOICE_TEMPLATE } from '../data/initialInvoices';
import { INITIAL_MEETINGS, DEFAULT_MEETING_TEMPLATE } from '../data/initialMeetings';
import { getInitialDocuments } from '../data/initialDocuments';
import { getInitialFolders } from '../data/initialFolders';
import { DEFAULT_CALENDAR_CATEGORIES, INITIAL_CALENDAR_EVENTS } from '../data/initialEvents';
import { getStoredSupabaseConfig, getSupabaseClient } from './supabaseClient';
import { CloudStorageService } from './cloudStorage';
import { getDonationPdfDataUrl } from './donationService';
import { getMembershipApplicationPdfDataUrl } from './membershipPdfService';
import { AuthService } from './authService';

const STORAGE_KEY_MODE = 'vm_deployment_mode';

const LIVE_DB_NAME = 'VereinsManager_LiveDB_v1';
const DEMO_DB_NAME = 'VereinsManager_DemoDB_v1';
const DB_VERSION = 8;

function isDemoModeActive(): boolean {
  return AuthService.isDemoMode();
}

function getActiveDBName(): string {
  return isDemoModeActive() ? DEMO_DB_NAME : LIVE_DB_NAME;
}

function getStorePrefix(): string {
  return isDemoModeActive() ? 'vm_demo_' : 'vm_live_';
}

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
  FOLDERS: 'folders',
  CALENDAR_EVENTS: 'calendar_events',
  CALENDAR_CATEGORIES: 'calendar_categories',
  ONLINE_APPLICATIONS: 'online_applications',
  APPLICATION_SETTINGS: 'application_settings',
  DASHBOARD_CONFIG: 'dashboard_config',
  CONTACTS: 'contacts',
  INVOICES: 'invoices',
  INVOICE_TEMPLATES: 'invoice_templates',
  MEETINGS: 'meetings',
  MEETING_TEMPLATES: 'meeting_templates'
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
  boardMembers: [
    { id: 'bm-1', role: '1. Vorsitzender', name: 'Dr. Michael Sommer', email: 'vorstand@tsv-musterstadt1890.de' },
    { id: 'bm-2', role: 'Schatzmeisterin / Kassenwart', name: 'Sabine Weber', email: 'finanzen@tsv-musterstadt1890.de' },
    { id: 'bm-3', role: '2. Vorsitzender', name: 'Thomas Müller' },
    { id: 'bm-4', role: 'Schriftführerin', name: 'Claudia Schmidt' }
  ],
  email: 'vorstand@tsv-musterstadt1890.de',
  departments: DEFAULT_DEPARTMENTS,
  smtpHost: 'smtp.ionos.de',
  smtpPort: 587,
  smtpSecure: false,
  smtpUser: 'vorstand@tsv-musterstadt1890.de',
  smtpPassword: '',
  smtpFromEmail: 'vorstand@tsv-musterstadt1890.de',
  smtpFromName: 'TSV Musterstadt 1890 e.V. Vorstand'
};

const DEFAULT_APPLICATION_SETTINGS: ApplicationTemplateSettings = {
  headerText: 'Herzlich willkommen beim TSV Musterstadt 1890 e.V.! Füllen Sie den Online-Aufnahmeantrag bitte vollständig aus.',
  notificationEmail: 'vorstand@tsv-musterstadt1890.de',
  defaultFeeRules: {
    full: 18.0,
    reduced: 12.0,
    youth: 10.0,
    family: 30.0,
    supporting: 25.0
  },
  requirePhotoConsent: true,
  requireHealthConfirmation: true
};

const SAMPLE_SIG_PNG = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="60" viewBox="0 0 200 60"><path d="M 20 40 Q 50 10, 80 35 T 140 30 T 180 35" fill="none" stroke="%230f172a" stroke-width="3" stroke-linecap="round"/></svg>';

const INITIAL_APPLICATIONS: OnlineMembershipApplication[] = [
  {
    id: 'app-demo-1',
    applicationNumber: 'ANTRAG-2026-001',
    submittedAt: '2026-03-01T14:20:00.000Z',
    status: 'pending',
    firstName: 'Felix',
    lastName: 'Bauer',
    gender: 'm',
    birthDate: '2012-06-18', // 13-14 Jahre (Minderjährig)
    nationality: 'Deutsch',
    phone: '0176 9988776',
    email: 'familie.bauer@example.de',
    address: {
      street: 'Kastanienallee',
      houseNumber: '17',
      zip: '12345',
      city: 'Musterstadt',
      country: 'Deutschland'
    },
    department: 'Fußball',
    membershipType: 'youth',
    feeAmount: 10.00,
    feePeriod: 'monthly',
    entryDate: '2026-03-15',
    notes: 'Jugend D-Jugend Training. Bisher vereinslos.',
    previousClub: '',
    isMinor: true,
    guardianName: 'Martina Bauer',
    guardianRelation: 'Mutter',
    guardianPhone: '0176 9988776',
    guardianEmail: 'familie.bauer@example.de',
    paymentMethod: 'sepa',
    bankDetails: {
      iban: 'DE44370501980011223344',
      bic: 'SPKDMUSTXXX',
      bankName: 'Sparkasse Musterstadt',
      accountHolder: 'Martina Bauer',
      mandateDate: '2026-03-01',
      mandateReference: 'MANDAT-ANTRAG-2026-001',
      monthlyDueDay: 1
    },
    dataPrivacyConsent: true,
    statuteConsent: true,
    photoConsent: true,
    healthConfirmation: true,
    applicantSignature: SAMPLE_SIG_PNG,
    applicantSignatureDate: '2026-03-01T14:18:00.000Z',
    guardianSignature: SAMPLE_SIG_PNG,
    guardianSignatureDate: '2026-03-01T14:19:00.000Z'
  },
  {
    id: 'app-demo-2',
    applicationNumber: 'ANTRAG-2026-002',
    submittedAt: '2026-02-28T09:45:00.000Z',
    status: 'pending',
    firstName: 'Sophia',
    lastName: 'Wagner',
    gender: 'w',
    birthDate: '1996-09-12', // Erwachsen
    nationality: 'Deutsch',
    phone: '0151 4455667',
    email: 'sophia.wagner@example.de',
    address: {
      street: 'Lindenweg',
      houseNumber: '8b',
      zip: '12345',
      city: 'Musterstadt',
      country: 'Deutschland'
    },
    department: 'Tennis',
    membershipType: 'full',
    feeAmount: 18.00,
    feePeriod: 'monthly',
    entryDate: '2026-04-01',
    notes: 'Interesse an Sommer-Medenspielen Damen.',
    previousClub: 'TC Blau-Weiß 1920 e.V.',
    isMinor: false,
    paymentMethod: 'sepa',
    bankDetails: {
      iban: 'DE89370601900055667788',
      bic: 'GENODEM1MST',
      bankName: 'Volksbank Musterstadt',
      accountHolder: 'Sophia Wagner',
      mandateDate: '2026-02-28',
      mandateReference: 'MANDAT-ANTRAG-2026-002',
      monthlyDueDay: 1
    },
    dataPrivacyConsent: true,
    statuteConsent: true,
    photoConsent: true,
    healthConfirmation: true,
    applicantSignature: SAMPLE_SIG_PNG,
    applicantSignatureDate: '2026-02-28T09:44:00.000Z',
    sepaSignature: SAMPLE_SIG_PNG,
    sepaSignatureDate: '2026-02-28T09:44:00.000Z'
  }
];

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
  const currentDB = getActiveDBName();
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(currentDB, DB_VERSION);
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
      // Defensive check in case DB was created earlier without newer stores
      const missingStores = Object.values(STORES).filter(s => !db.objectStoreNames.contains(s));
      if (missingStores.length > 0) {
        db.close();
        const nextVersion = Math.max(db.version + 1, DB_VERSION + 1);
        const upgradeReq = indexedDB.open(currentDB, nextVersion);
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

let snapshotTimer: any = null;
function triggerAutoSnapshot() {
  if (isDemoModeActive()) return;
  if (snapshotTimer) clearTimeout(snapshotTimer);
  snapshotTimer = setTimeout(async () => {
    try {
      const { SnapshotService } = await import('./snapshotService');
      await SnapshotService.createSnapshot('periodic');
    } catch {}
  }, 4000);
}

async function getAllFromStore<T>(storeName: string): Promise<T[]> {
  const prefix = getStorePrefix();
  try {
    const db = await openDB();
    if (!db.objectStoreNames.contains(storeName)) {
      const local = localStorage.getItem(`${prefix}${storeName}`);
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
    const local = localStorage.getItem(`${prefix}${storeName}`);
    return local ? JSON.parse(local) : [];
  }
}

async function saveAllToStore<T extends { id: string }>(storeName: string, items: T[]): Promise<void> {
  const prefix = getStorePrefix();
  try {
    const db = await openDB();
    if (!db.objectStoreNames.contains(storeName)) {
      localStorage.setItem(`${prefix}${storeName}`, JSON.stringify(items));
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
          if (storeName !== STORES.TRANSACTIONS && storeName !== STORES.DOCUMENTS) {
            localStorage.setItem(`${prefix}${storeName}`, JSON.stringify(items));
          }
        } catch (_) {}
        if (items.length > 0) triggerAutoSnapshot();
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    localStorage.setItem(`${prefix}${storeName}`, JSON.stringify(items));
    if (items.length > 0) triggerAutoSnapshot();
  }
}

async function getItemFromStore<T>(storeName: string, id: string): Promise<T | null> {
  const prefix = getStorePrefix();
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
      triggerAutoSnapshot();
      return;
    }
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      store.put(item);
      tx.oncomplete = () => {
        triggerAutoSnapshot();
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    const items = await getAllFromStore<T>(storeName);
    const idx = items.findIndex(i => i.id === item.id);
    if (idx >= 0) items[idx] = item;
    else items.push(item);
    await saveAllToStore(storeName, items);
    triggerAutoSnapshot();
  }
}

async function deleteItemFromStore(storeName: string, id: string): Promise<void> {
  try {
    const db = await openDB();
    if (!db.objectStoreNames.contains(storeName)) {
      const items = await getAllFromStore<{ id: string }>(storeName);
      const filtered = items.filter(i => i.id !== id);
      await saveAllToStore(storeName, filtered);
      triggerAutoSnapshot();
      return;
    }
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      store.delete(id);
      tx.oncomplete = () => {
        triggerAutoSnapshot();
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    const items = await getAllFromStore<{ id: string }>(storeName);
    const filtered = items.filter(i => i.id !== id);
    await saveAllToStore(storeName, filtered);
    triggerAutoSnapshot();
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
    // Isolated Demo Sandbox NEVER communicates with or alters live Supabase tables
    if (isDemoModeActive()) return false;
    return this.getDeploymentMode() === 'cloud' && getStoredSupabaseConfig().isConfigured && Boolean(getSupabaseClient());
  },

  /**
   * Liefert Statistiken über die aktuell lokal auf dem Gerät gespeicherten Datensätze
   */
  async getLocalDataStats(): Promise<{
    members: number;
    transactions: number;
    accounts: number;
    inventory: number;
    sepaRuns: number;
    documents: number;
    donations: number;
    calendarEvents: number;
    auditLogs: number;
  }> {
    const [
      members,
      transactions,
      accounts,
      inventory,
      sepaRuns,
      documents,
      donations,
      calendarEvents,
      auditLogs
    ] = await Promise.all([
      getAllFromStore<Member>(STORES.MEMBERS),
      getAllFromStore<Transaction>(STORES.TRANSACTIONS),
      getAllFromStore<FinancialAccount>(STORES.ACCOUNTS),
      getAllFromStore<InventoryItem>(STORES.INVENTORY),
      getAllFromStore<SepaRunHistory>(STORES.SEPA_RUNS),
      getAllFromStore<ClubDocument>(STORES.DOCUMENTS),
      getAllFromStore<DonationReceipt>(STORES.DONATIONS),
      getAllFromStore<CalendarEvent>(STORES.CALENDAR_EVENTS),
      getAllFromStore<MemberAuditLog>(STORES.AUDIT_LOGS)
    ]);

    return {
      members: members.length,
      transactions: transactions.length,
      accounts: accounts.length,
      inventory: inventory.length,
      sepaRuns: sepaRuns.length,
      documents: documents.length,
      donations: donations.length,
      calendarEvents: calendarEvents.length,
      auditLogs: auditLogs.length
    };
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
    auditLogs: number;
    settings: boolean;
    documents: number;
    folders: number;
    donations: number;
    contacts: number;
    invoices: number;
    meetings: number;
    calendarEvents: number;
    calendarCategories: number;
    onlineApplications: number;
  }> {
    if (!getStoredSupabaseConfig().isConfigured) {
      throw new Error('Supabase ist noch nicht mit URL und Anon Key konfiguriert.');
    }

    const [
      localMembers,
      localTransactions,
      localAccounts,
      localInventory,
      localSepaRuns,
      localAuditLogs,
      localSettings,
      localDocuments,
      localFolders,
      localDonations,
      localContacts,
      localInvoices,
      localInvoiceTemplate,
      localMeetings,
      localMeetingTemplate,
      localCalendarEvents,
      localCalendarCategories,
      localOnlineApplications,
      localApplicationSettings,
      localDashboardConfig
    ] = await Promise.all([
      getAllFromStore<Member>(STORES.MEMBERS),
      getAllFromStore<Transaction>(STORES.TRANSACTIONS),
      getAllFromStore<FinancialAccount>(STORES.ACCOUNTS),
      getAllFromStore<InventoryItem>(STORES.INVENTORY),
      getAllFromStore<SepaRunHistory>(STORES.SEPA_RUNS),
      getAllFromStore<MemberAuditLog>(STORES.AUDIT_LOGS),
      this.getSettings(),
      getAllFromStore<ClubDocument>(STORES.DOCUMENTS),
      getAllFromStore<DocumentFolder>(STORES.FOLDERS),
      getAllFromStore<DonationReceipt>(STORES.DONATIONS),
      getAllFromStore<ClubContact>(STORES.CONTACTS),
      getAllFromStore<ClubInvoice>(STORES.INVOICES),
      this.getInvoiceTemplate(),
      getAllFromStore<Meeting>(STORES.MEETINGS),
      this.getMeetingTemplate(),
      getAllFromStore<CalendarEvent>(STORES.CALENDAR_EVENTS),
      getAllFromStore<CalendarEventCategory>(STORES.CALENDAR_CATEGORIES),
      getAllFromStore<OnlineMembershipApplication>(STORES.ONLINE_APPLICATIONS),
      this.getApplicationTemplateSettings(),
      this.getDashboardConfig()
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

    // 7. Audit Logs
    for (const log of localAuditLogs) {
      await CloudStorageService.saveAuditLog(log);
    }

    // 8. Folders
    if (localFolders.length > 0) {
      await CloudStorageService.batchSaveFolders(localFolders);
    }

    // 9. Documents
    if (localDocuments.length > 0) {
      await CloudStorageService.batchSaveDocuments(localDocuments);
    }

    // 10. Donations
    if (localDonations.length > 0) {
      await CloudStorageService.batchSaveDonations(localDonations);
    }

    // 11. Contacts
    if (localContacts.length > 0) {
      await CloudStorageService.batchSaveContacts(localContacts);
    }

    // 12. Invoices
    if (localInvoices.length > 0) {
      await CloudStorageService.batchSaveInvoices(localInvoices);
    }

    // 13. Invoice Template
    if (localInvoiceTemplate) {
      await CloudStorageService.saveInvoiceTemplate(localInvoiceTemplate);
    }

    // 14. Meetings
    if (localMeetings.length > 0) {
      await CloudStorageService.batchSaveMeetings(localMeetings);
    }

    // 15. Meeting Template
    if (localMeetingTemplate) {
      await CloudStorageService.saveMeetingTemplate(localMeetingTemplate);
    }

    // 16. Calendar Categories
    if (localCalendarCategories.length > 0) {
      await CloudStorageService.batchSaveCalendarCategories(localCalendarCategories);
    }

    // 17. Calendar Events
    if (localCalendarEvents.length > 0) {
      await CloudStorageService.batchSaveCalendarEvents(localCalendarEvents);
    }

    // 18. Online Applications
    if (localOnlineApplications.length > 0) {
      await CloudStorageService.batchSaveOnlineApplications(localOnlineApplications);
    }

    // 19. Application Settings
    if (localApplicationSettings) {
      await CloudStorageService.saveApplicationSettings(localApplicationSettings);
    }

    // 20. Dashboard Config
    if (localDashboardConfig) {
      await CloudStorageService.saveDashboardConfig(localDashboardConfig);
    }

    // Switch mode to cloud
    this.setDeploymentMode('cloud');

    return {
      members: localMembers.length,
      transactions: localTransactions.length,
      accounts: localAccounts.length,
      inventory: localInventory.length,
      sepaRuns: localSepaRuns.length,
      auditLogs: localAuditLogs.length,
      settings: Boolean(localSettings),
      documents: localDocuments.length,
      folders: localFolders.length,
      donations: localDonations.length,
      contacts: localContacts.length,
      invoices: localInvoices.length,
      meetings: localMeetings.length,
      calendarEvents: localCalendarEvents.length,
      calendarCategories: localCalendarCategories.length,
      onlineApplications: localOnlineApplications.length
    };
  },

  async init(): Promise<void> {
    const isDemo = isDemoModeActive();
    const initKey = isDemo ? 'vm_demo_initialized' : 'vm_live_initialized';
    const initialized = localStorage.getItem(initKey);

    if (isDemo) {
      if (!initialized) {
        // Load complete isolated Demo Sample Sandbox for TSV Musterstadt 1890 e.V.
        await saveAllToStore(STORES.ACCOUNTS, INITIAL_ACCOUNTS);
        await saveAllToStore(STORES.MEMBERS, INITIAL_MEMBERS);
        await saveAllToStore(STORES.TRANSACTIONS, INITIAL_TRANSACTIONS);
        await saveAllToStore(STORES.AUDIT_LOGS, INITIAL_AUDIT_LOGS);
        await saveAllToStore(STORES.INVENTORY, INITIAL_INVENTORY);
        await saveAllToStore(STORES.FOLDERS, getInitialFolders());
        await saveAllToStore(STORES.DOCUMENTS, getInitialDocuments());
        await saveAllToStore(STORES.DONATIONS, INITIAL_DONATIONS);
        await saveAllToStore(STORES.CONTACTS, INITIAL_CONTACTS);
        await saveAllToStore(STORES.CALENDAR_CATEGORIES, DEFAULT_CALENDAR_CATEGORIES);
        await saveAllToStore(STORES.CALENDAR_EVENTS, INITIAL_CALENDAR_EVENTS);
        await putItemToStore(STORES.SETTINGS, { id: 'main', ...DEFAULT_SETTINGS });
        await this.syncReceiptsToDocuments();
        await this.syncDonationsToDocuments();
        localStorage.setItem(initKey, 'true');
      } else {
        const existingFolders = await getAllFromStore<DocumentFolder>(STORES.FOLDERS);
        if (!existingFolders || existingFolders.length === 0) {
          await saveAllToStore(STORES.FOLDERS, getInitialFolders());
        }
        await this.syncReceiptsToDocuments();
        await this.syncDonationsToDocuments();
      }
    } else {
      // LIVE Mode Initialization with STRICT ZERO-DATA-LOSS GUARANTEE
      try {
        // 1. Altdaten-Prüfung: Falls die aktuelle Live-DB leer ist (z.B. nach einem App-Update),
        // führen wir automatisch einen Notfall-Scan über ältere Datenbanken und LocalStorage aus.
        const currentMembers = await getAllFromStore<Member>(STORES.MEMBERS);
        const currentTx = await getAllFromStore<Transaction>(STORES.TRANSACTIONS);

        if (currentMembers.length === 0 && currentTx.length === 0) {
          try {
            const { SnapshotService } = await import('./snapshotService');
            const recovery = await SnapshotService.scanAndRecoverLegacyData();
            if (recovery.recovered) {
              console.info(`[StorageService] Altdaten nach Update erfolgreich wiederhergestellt: ${recovery.details}`);
            }
          } catch (scanErr) {
            console.warn('[StorageService] Altdaten-Scan nicht verfügbar:', scanErr);
          }
        }

        // 2. Nur initialisieren, wenn Konten wirklich leer sind
        const existingAccounts = await getAllFromStore<FinancialAccount>(STORES.ACCOUNTS);
        if (existingAccounts.length === 0) {
          const starterAccounts: FinancialAccount[] = [
            {
              id: 'acc-main',
              name: 'Girokonto (Hauptkonto)',
              accountType: 'bank',
              iban: '',
              bic: '',
              initialBalance: 0.00,
              color: 'emerald',
              description: 'Hauptkonto für Beitrags- und Rechnungswesen',
              createdAt: new Date().toISOString()
            },
            {
              id: 'acc-cash',
              name: 'Vereinskasse (Bargeld)',
              accountType: 'cash',
              initialBalance: 0.00,
              color: 'amber',
              description: 'Handkasse für Veranstaltungen und Barbelege',
              createdAt: new Date().toISOString()
            }
          ];
          await saveAllToStore(STORES.ACCOUNTS, starterAccounts);
        }

        // 3. Ordner-Struktur für Dokumente nur bei Bedarf anlegen
        const existingFolders = await getAllFromStore<DocumentFolder>(STORES.FOLDERS);
        if (existingFolders.length === 0) {
          await saveAllToStore(STORES.FOLDERS, getInitialFolders());
        }

        // 4. Kalender-Kategorien nur anlegen falls leer
        const existingCategories = await getAllFromStore<CalendarEventCategory>(STORES.CALENDAR_CATEGORIES);
        if (existingCategories.length === 0) {
          await saveAllToStore(STORES.CALENDAR_CATEGORIES, DEFAULT_CALENDAR_CATEGORIES);
        }

        // 5. Vereinsstammdaten nur initialisieren, falls keine vorhanden sind
        const currentSettings = await getItemFromStore<ClubSettings>(STORES.SETTINGS, 'main');
        if (!currentSettings) {
          await putItemToStore(STORES.SETTINGS, {
            id: 'main',
            clubName: 'Mein Sportverein e.V.',
            associationNumber: '',
            taxNumber: '',
            taxOffice: '',
            taxExemptionDate: '',
            taxAssessmentPeriod: '',
            promotedPurposes: 'Förderung des Sports',
            creditorId: '',
            creditorIban: '',
            creditorBic: '',
            creditorAccountId: 'acc-main',
            address: '',
            chairman: '',
            treasurer: '',
            email: '',
            departments: DEFAULT_DEPARTMENTS
          });
        }

        // SICHERHEIT: Bestehende Daten in STORES.MEMBERS, TRANSACTIONS, CONTACTS, INVOICES,
        // MEETINGS, INVENTORY, DOCUMENTS, DONATIONS usw. werden NIEMALS mit [] überschrieben!
        localStorage.setItem(initKey, 'true');

        // 6. Automatischen Sicherheits-Snapshot im Hintergrund anstoßen
        try {
          const { SnapshotService } = await import('./snapshotService');
          await SnapshotService.createSnapshot('startup');
        } catch {}
      } catch (err) {
        console.warn('Initialisierung Live-DB:', err);
      }
    }
  },

  /**
   * Setzt die Demo-Sandbox vollständig auf Beispieldaten zurück
   */
  async resetDemoData(): Promise<void> {
    if (!isDemoModeActive()) return;
    await saveAllToStore(STORES.ACCOUNTS, INITIAL_ACCOUNTS);
    await saveAllToStore(STORES.MEMBERS, INITIAL_MEMBERS);
    await saveAllToStore(STORES.TRANSACTIONS, INITIAL_TRANSACTIONS);
    await saveAllToStore(STORES.AUDIT_LOGS, INITIAL_AUDIT_LOGS);
    await saveAllToStore(STORES.INVENTORY, INITIAL_INVENTORY);
    await saveAllToStore(STORES.FOLDERS, getInitialFolders());
    await saveAllToStore(STORES.DOCUMENTS, getInitialDocuments());
    await saveAllToStore(STORES.DONATIONS, INITIAL_DONATIONS);
    await saveAllToStore(STORES.CONTACTS, INITIAL_CONTACTS);
    await putItemToStore(STORES.SETTINGS, { id: 'main', ...DEFAULT_SETTINGS });
    await this.syncReceiptsToDocuments();
    await this.syncDonationsToDocuments();
  },

  /**
   * Richtet den Live-Verein bei einer Registrierung ein
   */
  async initLiveClub(clubName: string, chairmanName: string, email: string): Promise<void> {
    const current = await this.getSettings();
    const updated: ClubSettings = {
      ...current,
      id: 'main',
      clubName: clubName.trim(),
      chairman: chairmanName.trim(),
      email: email.trim(),
      departments: current?.departments?.length ? current.departments : DEFAULT_DEPARTMENTS
    };
    await this.saveSettings(updated);
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
      standing_order: 'Dauerauftrag',
      exempt: 'Beitragsfrei'
    };

    const periodTranslations: Record<string, string> = {
      monthly: 'monatlich',
      quarterly: 'vierteljährlich',
      half_yearly: 'halbjährlich',
      yearly: 'jährlich',
      none: 'beitragsfrei'
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
    if (this.isCloudActive()) {
      try {
        const cloudDocs = await CloudStorageService.getDocuments();
        if (cloudDocs && cloudDocs.length > 0) {
          saveAllToStore(STORES.DOCUMENTS, cloudDocs).catch(() => {});
          return cloudDocs;
        }
      } catch (err) {
        console.warn('Cloud getDocuments error:', err);
      }
    }
    const docs = await getAllFromStore<ClubDocument>(STORES.DOCUMENTS);
    return docs.sort((a, b) => new Date(b.date || b.createdAt).getTime() - new Date(a.date || a.createdAt).getTime());
  },

  async getDocument(id: string): Promise<ClubDocument | null> {
    if (this.isCloudActive()) {
      try {
        const cloudDoc = await CloudStorageService.getDocument(id);
        if (cloudDoc) return cloudDoc;
      } catch (err) {
        console.warn('Cloud getDocument error:', err);
      }
    }
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
    if (this.isCloudActive()) {
      await CloudStorageService.saveDocument(document);
    }
  },

  async saveBatchDocuments(documents: ClubDocument[]): Promise<void> {
    const current = await this.getDocuments();
    const map = new Map<string, ClubDocument>(current.map(d => [d.id, d]));
    documents.forEach(d => map.set(d.id, d));
    await saveAllToStore(STORES.DOCUMENTS, Array.from(map.values()));
    if (this.isCloudActive()) {
      await CloudStorageService.batchSaveDocuments(documents);
    }
  },

  async deleteDocument(id: string): Promise<void> {
    await deleteItemFromStore(STORES.DOCUMENTS, id);
    if (this.isCloudActive()) {
      await CloudStorageService.deleteDocument(id);
    }
  },

  async deleteMultipleDocuments(ids: string[]): Promise<number> {
    const current = await this.getDocuments();
    const idSet = new Set(ids);
    const remaining = current.filter(d => !idSet.has(d.id));
    await saveAllToStore(STORES.DOCUMENTS, remaining);
    if (this.isCloudActive()) {
      await CloudStorageService.deleteMultipleDocuments(ids);
    }
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
    if (this.isCloudActive()) {
      const changed = updated.filter(d => idSet.has(d.id));
      await CloudStorageService.batchSaveDocuments(changed);
    }
    return count;
  },

  // Folder Management
  async getFolders(): Promise<DocumentFolder[]> {
    if (this.isCloudActive()) {
      try {
        const cloudFolders = await CloudStorageService.getFolders();
        if (cloudFolders && cloudFolders.length > 0) {
          saveAllToStore(STORES.FOLDERS, cloudFolders).catch(() => {});
          return cloudFolders;
        }
      } catch (err) {
        console.warn('Cloud getFolders error:', err);
      }
    }
    const folders = await getAllFromStore<DocumentFolder>(STORES.FOLDERS);
    if (!folders || folders.length === 0) {
      const initial = getInitialFolders();
      await saveAllToStore(STORES.FOLDERS, initial);
      if (this.isCloudActive()) {
        await CloudStorageService.batchSaveFolders(initial);
      }
      return initial;
    }
    return folders.sort((a, b) => a.name.localeCompare(b.name, 'de'));
  },

  async getFolder(id: string): Promise<DocumentFolder | null> {
    if (this.isCloudActive()) {
      try {
        const cloudFolder = await CloudStorageService.getFolder(id);
        if (cloudFolder) return cloudFolder;
      } catch (err) {
        console.warn('Cloud getFolder error:', err);
      }
    }
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
    if (this.isCloudActive()) {
      await CloudStorageService.saveFolder(folder);
    }
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
      if (this.isCloudActive()) {
        const modifiedDocs = updatedDocs.filter(d => d.folderId === undefined);
        await CloudStorageService.batchSaveDocuments(modifiedDocs);
      }
    }

    // Remove deleted folders
    const remainingFolders = allFolders.filter(f => !toDeleteIds.has(f.id));
    await saveAllToStore(STORES.FOLDERS, remainingFolders);
    if (this.isCloudActive()) {
      for (const id of toDeleteIds) {
        await CloudStorageService.deleteFolder(id).catch(() => {});
      }
    }
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
    if (this.isCloudActive()) {
      try {
        const cloudDonations = await CloudStorageService.getDonations();
        if (cloudDonations && cloudDonations.length > 0) {
          saveAllToStore(STORES.DONATIONS, cloudDonations).catch(() => {});
          return cloudDonations;
        }
      } catch (err) {
        console.warn('Cloud getDonations error:', err);
      }
    }
    const donations = await getAllFromStore<DonationReceipt>(STORES.DONATIONS);
    return donations.sort((a, b) => new Date(b.date || b.createdAt).getTime() - new Date(a.date || a.createdAt).getTime());
  },

  async getDonation(id: string): Promise<DonationReceipt | null> {
    if (this.isCloudActive()) {
      try {
        const cloudDon = await CloudStorageService.getDonation(id);
        if (cloudDon) return cloudDon;
      } catch (err) {
        console.warn('Cloud getDonation error:', err);
      }
    }
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
    if (this.isCloudActive()) {
      await CloudStorageService.saveDonation(toSave);
    }

    return { receipt: toSave, document: createdDoc, transaction: createdTx };
  },

  async deleteDonationReceipt(id: string): Promise<void> {
    const existing = await getItemFromStore<DonationReceipt>(STORES.DONATIONS, id);
    if (existing?.documentId) {
      await this.deleteDocument(existing.documentId).catch(() => {});
    }
    await deleteItemFromStore(STORES.DONATIONS, id);
    if (this.isCloudActive()) {
      await CloudStorageService.deleteDonation(id);
    }
  },

  // ----------------------------------------------------
  // KONTAKTVERWALTUNG (KONTRAHENTEN, SPONSOREN, LIEFERANTEN)
  // ----------------------------------------------------
  async getContacts(): Promise<ClubContact[]> {
    if (this.isCloudActive()) {
      try {
        const cloudContacts = await CloudStorageService.getContacts();
        if (cloudContacts && cloudContacts.length > 0) {
          saveAllToStore(STORES.CONTACTS, cloudContacts).catch(() => {});
          return cloudContacts;
        }
      } catch (err) {
        console.warn('Cloud getContacts error:', err);
      }
    }
    const contacts = await getAllFromStore<ClubContact>(STORES.CONTACTS);
    if (contacts.length === 0 && isDemoModeActive()) {
      await saveAllToStore(STORES.CONTACTS, INITIAL_CONTACTS);
      if (this.isCloudActive()) {
        await CloudStorageService.batchSaveContacts(INITIAL_CONTACTS);
      }
      return [...INITIAL_CONTACTS];
    }
    return contacts.sort((a, b) => (a.displayName || '').localeCompare(b.displayName || '', 'de'));
  },

  async getContact(id: string): Promise<ClubContact | null> {
    if (this.isCloudActive()) {
      try {
        const cloudContact = await CloudStorageService.getContact(id);
        if (cloudContact) return cloudContact;
      } catch (err) {
        console.warn('Cloud getContact error:', err);
      }
    }
    return getItemFromStore<ClubContact>(STORES.CONTACTS, id);
  },

  async saveContact(contact: ClubContact): Promise<ClubContact> {
    const now = new Date().toISOString();
    const existing = await getItemFromStore<ClubContact>(STORES.CONTACTS, contact.id);
    const toSave: ClubContact = {
      ...contact,
      createdAt: existing?.createdAt || contact.createdAt || now,
      updatedAt: now
    };
    await putItemToStore(STORES.CONTACTS, toSave);
    if (this.isCloudActive()) {
      await CloudStorageService.saveContact(toSave);
    }
    return toSave;
  },

  async saveContacts(contacts: ClubContact[]): Promise<void> {
    await saveAllToStore(STORES.CONTACTS, contacts);
    if (this.isCloudActive()) {
      await CloudStorageService.batchSaveContacts(contacts);
    }
  },

  async deleteContact(id: string): Promise<void> {
    await deleteItemFromStore(STORES.CONTACTS, id);
    if (this.isCloudActive()) {
      await CloudStorageService.deleteContact(id);
    }
  },

  // ----------------------------------------------------
  // RECHNUNGSVERWALTUNG & VORLAGEN
  // ----------------------------------------------------
  async getInvoices(): Promise<ClubInvoice[]> {
    if (this.isCloudActive()) {
      try {
        const cloudInvoices = await CloudStorageService.getInvoices();
        if (cloudInvoices && cloudInvoices.length > 0) {
          saveAllToStore(STORES.INVOICES, cloudInvoices).catch(() => {});
          return cloudInvoices;
        }
      } catch (err) {
        console.warn('Cloud getInvoices error:', err);
      }
    }
    const invoices = await getAllFromStore<ClubInvoice>(STORES.INVOICES);
    if (invoices.length === 0 && isDemoModeActive()) {
      await saveAllToStore(STORES.INVOICES, INITIAL_INVOICES);
      if (this.isCloudActive()) {
        await CloudStorageService.batchSaveInvoices(INITIAL_INVOICES);
      }
      return [...INITIAL_INVOICES];
    }
    return invoices.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
  },

  async getInvoice(id: string): Promise<ClubInvoice | null> {
    if (this.isCloudActive()) {
      try {
        const cloudInv = await CloudStorageService.getInvoice(id);
        if (cloudInv) return cloudInv;
      } catch (err) {
        console.warn('Cloud getInvoice error:', err);
      }
    }
    return getItemFromStore<ClubInvoice>(STORES.INVOICES, id);
  },

  async saveInvoice(invoice: ClubInvoice): Promise<ClubInvoice> {
    const now = new Date().toISOString();
    const existing = await getItemFromStore<ClubInvoice>(STORES.INVOICES, invoice.id);
    const toSave: ClubInvoice = {
      ...invoice,
      createdAt: existing?.createdAt || invoice.createdAt || now,
      updatedAt: now
    };
    await putItemToStore(STORES.INVOICES, toSave);
    if (this.isCloudActive()) {
      await CloudStorageService.saveInvoice(toSave);
    }
    return toSave;
  },

  async saveInvoices(invoices: ClubInvoice[]): Promise<void> {
    await saveAllToStore(STORES.INVOICES, invoices);
    if (this.isCloudActive()) {
      await CloudStorageService.batchSaveInvoices(invoices);
    }
  },

  async deleteInvoice(id: string): Promise<void> {
    const existing = await getItemFromStore<ClubInvoice>(STORES.INVOICES, id);
    if (existing?.documentId) {
      await this.deleteDocument(existing.documentId).catch(() => {});
    }
    await deleteItemFromStore(STORES.INVOICES, id);
    if (this.isCloudActive()) {
      await CloudStorageService.deleteInvoice(id);
    }
  },

  async getInvoiceTemplate(): Promise<InvoiceTemplateSettings> {
    if (this.isCloudActive()) {
      try {
        const cloudTemplate = await CloudStorageService.getInvoiceTemplate();
        if (cloudTemplate) {
          await putItemToStore(STORES.INVOICE_TEMPLATES, { id: 'main_template', ...cloudTemplate });
          return cloudTemplate;
        }
      } catch (err) {
        console.warn('Cloud getInvoiceTemplate error:', err);
      }
    }
    const stored = await getItemFromStore<InvoiceTemplateSettings & { id: string }>(
      STORES.INVOICE_TEMPLATES,
      'main_template'
    );
    if (!stored) {
      return DEFAULT_INVOICE_TEMPLATE;
    }
    return stored;
  },

  async saveInvoiceTemplate(template: InvoiceTemplateSettings): Promise<InvoiceTemplateSettings> {
    const toSave = { id: 'main_template', ...template };
    await putItemToStore(STORES.INVOICE_TEMPLATES, toSave);
    if (this.isCloudActive()) {
      await CloudStorageService.saveInvoiceTemplate(template);
    }
    return toSave;
  },

  // ----------------------------------------------------
  // SITZUNGS- & PROTOKOLLVERWALTUNG
  // ----------------------------------------------------
  async getMeetings(): Promise<Meeting[]> {
    if (this.isCloudActive()) {
      try {
        const cloudMeetings = await CloudStorageService.getMeetings();
        if (cloudMeetings && cloudMeetings.length > 0) {
          saveAllToStore(STORES.MEETINGS, cloudMeetings).catch(() => {});
          return cloudMeetings;
        }
      } catch (err) {
        console.warn('Cloud getMeetings error:', err);
      }
    }
    const meetings = await getAllFromStore<Meeting>(STORES.MEETINGS);
    if (meetings.length === 0 && isDemoModeActive()) {
      await saveAllToStore(STORES.MEETINGS, INITIAL_MEETINGS);
      if (this.isCloudActive()) {
        await CloudStorageService.batchSaveMeetings(INITIAL_MEETINGS);
      }
      return [...INITIAL_MEETINGS];
    }
    return meetings.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
  },

  async getMeeting(id: string): Promise<Meeting | null> {
    if (this.isCloudActive()) {
      try {
        const cloudMeeting = await CloudStorageService.getMeeting(id);
        if (cloudMeeting) return cloudMeeting;
      } catch (err) {
        console.warn('Cloud getMeeting error:', err);
      }
    }
    return getItemFromStore<Meeting>(STORES.MEETINGS, id);
  },

  async saveMeeting(meeting: Meeting): Promise<Meeting> {
    const now = new Date().toISOString();
    const existing = await getItemFromStore<Meeting>(STORES.MEETINGS, meeting.id);
    const toSave: Meeting = {
      ...meeting,
      createdAt: existing?.createdAt || meeting.createdAt || now,
      updatedAt: now
    };
    await putItemToStore(STORES.MEETINGS, toSave);
    if (this.isCloudActive()) {
      await CloudStorageService.saveMeeting(toSave);
    }
    return toSave;
  },

  async saveMeetings(meetings: Meeting[]): Promise<void> {
    await saveAllToStore(STORES.MEETINGS, meetings);
    if (this.isCloudActive()) {
      await CloudStorageService.batchSaveMeetings(meetings);
    }
  },

  async deleteMeeting(id: string): Promise<void> {
    const existing = await getItemFromStore<Meeting>(STORES.MEETINGS, id);
    if (existing?.documentId) {
      await this.deleteDocument(existing.documentId).catch(() => {});
    }
    await deleteItemFromStore(STORES.MEETINGS, id);
    if (this.isCloudActive()) {
      await CloudStorageService.deleteMeeting(id);
    }
  },

  async getMeetingTemplate(): Promise<MeetingTemplateSettings> {
    if (this.isCloudActive()) {
      try {
        const cloudTemplate = await CloudStorageService.getMeetingTemplate();
        if (cloudTemplate) {
          await putItemToStore(STORES.MEETING_TEMPLATES, { id: 'main_meeting_template', ...cloudTemplate });
          return cloudTemplate;
        }
      } catch (err) {
        console.warn('Cloud getMeetingTemplate error:', err);
      }
    }
    const stored = await getItemFromStore<MeetingTemplateSettings & { id: string }>(
      STORES.MEETING_TEMPLATES,
      'main_meeting_template'
    );
    if (!stored) {
      return DEFAULT_MEETING_TEMPLATE;
    }
    return stored;
  },

  async saveMeetingTemplate(template: MeetingTemplateSettings): Promise<MeetingTemplateSettings> {
    const toSave = { id: 'main_meeting_template', ...template };
    await putItemToStore(STORES.MEETING_TEMPLATES, toSave);
    if (this.isCloudActive()) {
      await CloudStorageService.saveMeetingTemplate(template);
    }
    return toSave;
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

  // =========================================================================
  // TERMIN- & VERANSTALTUNGSKALENDER
  // =========================================================================

  async getCalendarEvents(): Promise<CalendarEvent[]> {
    if (this.isCloudActive()) {
      try {
        const cloudEvents = await CloudStorageService.getCalendarEvents();
        if (cloudEvents && cloudEvents.length > 0) {
          saveAllToStore(STORES.CALENDAR_EVENTS, cloudEvents).catch(() => {});
          return cloudEvents;
        }
      } catch (err) {
        console.warn('Cloud getCalendarEvents error:', err);
      }
    }
    const events = await getAllFromStore<CalendarEvent>(STORES.CALENDAR_EVENTS);
    if (events.length === 0 && isDemoModeActive()) {
      await saveAllToStore(STORES.CALENDAR_EVENTS, INITIAL_CALENDAR_EVENTS);
      if (this.isCloudActive()) {
        await CloudStorageService.batchSaveCalendarEvents(INITIAL_CALENDAR_EVENTS);
      }
      return INITIAL_CALENDAR_EVENTS;
    }
    return events;
  },

  async saveCalendarEvent(event: CalendarEvent): Promise<CalendarEvent> {
    const now = new Date().toISOString();
    const toSave: CalendarEvent = {
      ...event,
      updatedAt: now,
      createdAt: event.createdAt || now
    };
    await putItemToStore(STORES.CALENDAR_EVENTS, toSave);
    if (this.isCloudActive()) {
      await CloudStorageService.saveCalendarEvent(toSave);
    }
    return toSave;
  },

  async deleteCalendarEvent(id: string): Promise<void> {
    await deleteItemFromStore(STORES.CALENDAR_EVENTS, id);
    if (this.isCloudActive()) {
      await CloudStorageService.deleteCalendarEvent(id);
    }
  },

  async batchSaveCalendarEvents(events: CalendarEvent[]): Promise<void> {
    for (const evt of events) {
      await putItemToStore(STORES.CALENDAR_EVENTS, evt);
    }
    if (this.isCloudActive()) {
      await CloudStorageService.batchSaveCalendarEvents(events);
    }
  },

  async getCalendarCategories(): Promise<CalendarEventCategory[]> {
    if (this.isCloudActive()) {
      try {
        const cloudCats = await CloudStorageService.getCalendarCategories();
        if (cloudCats && cloudCats.length > 0) {
          saveAllToStore(STORES.CALENDAR_CATEGORIES, cloudCats).catch(() => {});
          return cloudCats;
        }
      } catch (err) {
        console.warn('Cloud getCalendarCategories error:', err);
      }
    }
    const categories = await getAllFromStore<CalendarEventCategory>(STORES.CALENDAR_CATEGORIES);
    if (categories.length === 0) {
      await saveAllToStore(STORES.CALENDAR_CATEGORIES, DEFAULT_CALENDAR_CATEGORIES);
      if (this.isCloudActive()) {
        await CloudStorageService.batchSaveCalendarCategories(DEFAULT_CALENDAR_CATEGORIES);
      }
      return DEFAULT_CALENDAR_CATEGORIES;
    }
    return categories;
  },

  async saveCalendarCategory(category: CalendarEventCategory): Promise<CalendarEventCategory> {
    await putItemToStore(STORES.CALENDAR_CATEGORIES, category);
    if (this.isCloudActive()) {
      await CloudStorageService.saveCalendarCategory(category);
    }
    return category;
  },

  async deleteCalendarCategory(id: string): Promise<void> {
    await deleteItemFromStore(STORES.CALENDAR_CATEGORIES, id);
    if (this.isCloudActive()) {
      await CloudStorageService.deleteCalendarCategory(id);
    }
  },

  // =========================================================================
  // ONLINE-MITGLIEDSANTRÄGE & DIGITALES AUFNAHMEWESEN
  // =========================================================================

  async getOnlineApplications(): Promise<OnlineMembershipApplication[]> {
    if (this.isCloudActive()) {
      try {
        const cloudApps = await CloudStorageService.getOnlineApplications();
        if (cloudApps && cloudApps.length > 0) {
          saveAllToStore(STORES.ONLINE_APPLICATIONS, cloudApps).catch(() => {});
          return cloudApps;
        }
      } catch (err) {
        console.warn('Cloud getOnlineApplications error:', err);
      }
    }
    const apps = await getAllFromStore<OnlineMembershipApplication>(STORES.ONLINE_APPLICATIONS);
    if (apps.length === 0 && isDemoModeActive()) {
      await saveAllToStore(STORES.ONLINE_APPLICATIONS, INITIAL_APPLICATIONS);
      if (this.isCloudActive()) {
        await CloudStorageService.batchSaveOnlineApplications(INITIAL_APPLICATIONS);
      }
      return INITIAL_APPLICATIONS;
    }
    return apps;
  },

  async saveOnlineApplication(app: OnlineMembershipApplication): Promise<OnlineMembershipApplication> {
    await putItemToStore(STORES.ONLINE_APPLICATIONS, app);
    if (this.isCloudActive()) {
      await CloudStorageService.saveOnlineApplication(app);
    }
    return app;
  },

  async deleteOnlineApplication(id: string): Promise<void> {
    await deleteItemFromStore(STORES.ONLINE_APPLICATIONS, id);
    if (this.isCloudActive()) {
      await CloudStorageService.deleteOnlineApplication(id);
    }
  },

  async getApplicationTemplateSettings(): Promise<ApplicationTemplateSettings> {
    if (this.isCloudActive()) {
      try {
        const cloudSettings = await CloudStorageService.getApplicationSettings();
        if (cloudSettings) {
          await putItemToStore(STORES.APPLICATION_SETTINGS, { id: 'main', ...cloudSettings });
          return cloudSettings;
        }
      } catch (err) {
        console.warn('Cloud getApplicationSettings error:', err);
      }
    }
    const stored = await getItemFromStore<ApplicationTemplateSettings & { id: string }>(
      STORES.APPLICATION_SETTINGS,
      'main'
    );
    if (!stored) {
      return DEFAULT_APPLICATION_SETTINGS;
    }
    return stored;
  },

  async saveApplicationTemplateSettings(settings: ApplicationTemplateSettings): Promise<ApplicationTemplateSettings> {
    await putItemToStore(STORES.APPLICATION_SETTINGS, { id: 'main', ...settings });
    if (this.isCloudActive()) {
      await CloudStorageService.saveApplicationSettings(settings);
    }
    return settings;
  },

  /**
   * Bestätigt einen Online-Aufnahmeantrag:
   * 1. Legt das neue Mitglied mit allen Feldern in der Mitgliedertabelle an.
   * 2. Erzeugt das offizielle Aufnahmeantrags-PDF inkl. digitaler Signaturen.
   * 3. Archiviert das Dokument automatisch im Dokumentenarchiv unter 'Mitglieder / Aufnahmeanträge'.
   * 4. Erstellt einen Audit-Log-Eintrag.
   * 5. Setzt den Antragsstatus auf 'approved'.
   */
  async approveOnlineApplication(
    appId: string,
    memberOverrides: Partial<Member>,
    author: string = 'Vorstand'
  ): Promise<{ member: Member; documentId: string }> {
    const apps = await this.getOnlineApplications();
    const app = apps.find(a => a.id === appId);
    if (!app) {
      throw new Error(`Aufnahmeantrag mit ID ${appId} nicht gefunden.`);
    }

    const clubSettings = await this.getSettings();
    const now = new Date().toISOString();
    const newMemberId = `mem-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const memberNum = memberOverrides.memberNumber || `MG-${Math.floor(100 + Math.random() * 900)}`;

    // 1. Neues Mitgliedsobjekt zusammenstellen
    const newMember: Member = {
      id: newMemberId,
      memberNumber: memberNum,
      firstName: app.firstName,
      lastName: app.lastName,
      gender: app.gender,
      birthDate: app.birthDate,
      address: app.address,
      phone: app.phone,
      email: app.email,
      entryDate: memberOverrides.entryDate || app.entryDate || now.slice(0, 10),
      status: 'active',
      department: memberOverrides.department || app.department,
      membershipType: memberOverrides.membershipType || app.membershipType,
      feeAmount: memberOverrides.feeAmount !== undefined ? memberOverrides.feeAmount : (app.feeAmount || 18.0),
      feePeriod: memberOverrides.feePeriod || app.feePeriod,
      paymentMethod: app.paymentMethod,
      bankDetails: {
        iban: app.bankDetails.iban,
        bic: app.bankDetails.bic,
        bankName: app.bankDetails.bankName,
        accountHolder: app.bankDetails.accountHolder || `${app.firstName} ${app.lastName}`,
        mandateDate: app.bankDetails.mandateDate || now.slice(0, 10),
        mandateReference: app.bankDetails.mandateReference || `MANDAT-${memberNum}`,
        monthlyDueDay: app.bankDetails.monthlyDueDay || 1
      },
      notes: [memberOverrides.notes, app.notes, app.previousClub ? `Vorverein: ${app.previousClub}` : '']
        .filter(Boolean)
        .join(' | ') || `Digitaler Aufnahmeantrag ${app.applicationNumber}`,
      dataPrivacyConsent: app.dataPrivacyConsent,
      createdAt: now,
      updatedAt: now
    };

    // Mitglied speichern
    await this.saveMember(newMember);

    // 2. Aufnahmeantrag PDF erzeugen & im Dokumentenarchiv ablegen (bevorzugt Original-PDF falls vorhanden)
    let documentId = `doc-app-${app.id}`;
    try {
      const pdfDataUrl = app.pdfDataUrl || getMembershipApplicationPdfDataUrl(app, clubSettings);
      const isOriginalUploadedPdf = Boolean(app.pdfDataUrl);
      const doc: ClubDocument = {
        id: documentId,
        title: `Aufnahmeantrag: ${newMember.lastName}, ${newMember.firstName} (${memberNum})`,
        fileName: isOriginalUploadedPdf ? `Aufnahmeantrag_Original_${newMember.lastName}_${newMember.firstName}_${memberNum}.pdf` : `Aufnahmeantrag_${newMember.lastName}_${newMember.firstName}_${memberNum}.pdf`,
        fileType: 'application/pdf',
        fileSize: Math.round(pdfDataUrl.length * 0.75),
        dataUrl: pdfDataUrl,
        category: 'mitglieder',
        folderId: 'folder-aufnahmeantraege',
        date: app.submittedAt ? app.submittedAt.slice(0, 10) : now.slice(0, 10),
        uploadDate: now,
        tags: ['Aufnahmeantrag', isOriginalUploadedPdf ? 'PDF-Scan' : 'Online', 'Beitrittserklärung', memberNum, app.department, 'SEPA-Mandat'],
        notes: isOriginalUploadedPdf 
          ? `Handschriftlich ausgefüllter & eingescannter Aufnahmeantrag (${app.applicationNumber}) für ${newMember.firstName} ${newMember.lastName}. Automatisch per KI ausgelesen und archiviert.`
          : `Vollständig ausgefüllter und digital signierter Aufnahmeantrag (${app.applicationNumber}) für ${newMember.firstName} ${newMember.lastName}. Beitragsgruppe: ${app.membershipType}, Sparte: ${app.department}.`,
        memberId: newMember.id,
        memberName: `${newMember.firstName} ${newMember.lastName}`,
        isReceipt: false,
        createdAt: now,
        updatedAt: now
      };
      await this.saveDocument(doc);
    } catch (err) {
      console.warn('PDF generation for document archive failed:', err);
    }

    // 3. Audit Log für neues Mitglied erstellen
    try {
      const auditLog: MemberAuditLog = {
        id: `log-app-${Date.now()}`,
        memberId: newMember.id,
        memberNumber: newMember.memberNumber,
        memberName: `${newMember.firstName} ${newMember.lastName}`,
        timestamp: now,
        author,
        action: 'create',
        summary: `Neues Mitglied über Online-Aufnahmeantrag (${app.applicationNumber}) aufgenommen`,
        changes: [
          { field: 'status', label: 'Status', oldValue: '–', newValue: 'Aktiv' },
          { field: 'department', label: 'Abteilung', oldValue: '–', newValue: newMember.department },
          { field: 'membershipType', label: 'Mitgliedsart', oldValue: '–', newValue: newMember.membershipType },
          { field: 'feeAmount', label: 'Beitrag', oldValue: '–', newValue: `${newMember.feeAmount.toFixed(2)} € (${newMember.feePeriod})` }
        ]
      };
      await this.saveAuditLog(auditLog);
    } catch (e) {
      console.warn('Audit log creation error:', e);
    }

    // 4. Antragsstatus auf 'approved' aktualisieren
    const updatedApp: OnlineMembershipApplication = {
      ...app,
      status: 'approved',
      reviewedAt: now,
      reviewedBy: author,
      createdMemberId: newMember.id,
      createdMemberNumber: newMember.memberNumber,
      generatedDocumentId: documentId
    };
    await this.saveOnlineApplication(updatedApp);

    return { member: newMember, documentId };
  },

  async rejectOnlineApplication(
    appId: string,
    rejectionReason: string,
    author: string = 'Vorstand'
  ): Promise<void> {
    const apps = await this.getOnlineApplications();
    const app = apps.find(a => a.id === appId);
    if (!app) {
      throw new Error(`Aufnahmeantrag mit ID ${appId} nicht gefunden.`);
    }

    const now = new Date().toISOString();
    const updatedApp: OnlineMembershipApplication = {
      ...app,
      status: 'rejected',
      reviewedAt: now,
      reviewedBy: author,
      rejectionReason
    };
    await this.saveOnlineApplication(updatedApp);
  },

  // Full Database Backup & Restore
  async exportFullBackup(): Promise<string> {
    const [
      members,
      transactions,
      accounts,
      auditLogs,
      inventory,
      sepaRuns,
      documents,
      donations,
      contacts,
      invoices,
      invoiceTemplate,
      meetings,
      meetingTemplate,
      dashboardConfig,
      calendarEvents,
      calendarCategories,
      onlineApplications,
      applicationSettings,
      settings
    ] = await Promise.all([
      this.getMembers(),
      this.getTransactions(),
      this.getAccounts(),
      this.getAuditLogs(),
      this.getInventory(),
      this.getSepaRuns(),
      this.getDocuments(),
      this.getDonations(),
      this.getContacts(),
      this.getInvoices(),
      this.getInvoiceTemplate(),
      this.getMeetings(),
      this.getMeetingTemplate(),
      this.getDashboardConfig(),
      this.getCalendarEvents(),
      this.getCalendarCategories(),
      this.getOnlineApplications(),
      this.getApplicationTemplateSettings(),
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
        contacts,
        invoices,
        invoiceTemplate,
        meetings,
        meetingTemplate,
        dashboardConfig,
        calendarEvents,
        calendarCategories,
        onlineApplications,
        applicationSettings,
        settings
      }
    };

    return JSON.stringify(backup, null, 2);
  },

  async importFullBackup(jsonString: string): Promise<{
    membersCount: number;
    transactionsCount: number;
    inventoryCount: number;
    documentsCount: number;
    donationsCount: number;
    calendarEventsCount: number;
    meetingsCount: number;
    invoicesCount: number;
    contactsCount: number;
  }> {
    const parsed = JSON.parse(jsonString);
    if (!parsed.data) {
      throw new Error('Ungültiges Sicherungsformat');
    }
    const {
      members = [],
      transactions = [],
      accounts = [],
      auditLogs = [],
      inventory = [],
      sepaRuns = [],
      documents = [],
      donations = [],
      contacts = [],
      invoices = [],
      invoiceTemplate,
      meetings = [],
      meetingTemplate,
      dashboardConfig,
      calendarEvents = [],
      calendarCategories = [],
      onlineApplications = [],
      applicationSettings,
      settings
    } = parsed.data;

    await saveAllToStore(STORES.MEMBERS, members);
    await saveAllToStore(STORES.TRANSACTIONS, transactions);
    await saveAllToStore(STORES.ACCOUNTS, accounts);
    await saveAllToStore(STORES.AUDIT_LOGS, auditLogs);
    await saveAllToStore(STORES.INVENTORY, inventory);
    await saveAllToStore(STORES.SEPA_RUNS, sepaRuns);
    await saveAllToStore(STORES.DOCUMENTS, documents);
    await saveAllToStore(STORES.DONATIONS, donations);
    if (contacts.length > 0) {
      await saveAllToStore(STORES.CONTACTS, contacts);
    }
    if (invoices.length > 0) {
      await saveAllToStore(STORES.INVOICES, invoices);
    }
    if (invoiceTemplate) {
      await putItemToStore(STORES.INVOICE_TEMPLATES, { id: 'main_template', ...invoiceTemplate });
    }
    if (meetings.length > 0) {
      await saveAllToStore(STORES.MEETINGS, meetings);
    }
    if (meetingTemplate) {
      await putItemToStore(STORES.MEETING_TEMPLATES, { id: 'main_template', ...meetingTemplate });
    }
    if (dashboardConfig) {
      await putItemToStore(STORES.DASHBOARD_CONFIG, { id: 'main_dashboard', ...dashboardConfig });
    }
    if (calendarCategories.length > 0) {
      await saveAllToStore(STORES.CALENDAR_CATEGORIES, calendarCategories);
    }
    await saveAllToStore(STORES.CALENDAR_EVENTS, calendarEvents);
    if (onlineApplications.length > 0) {
      await saveAllToStore(STORES.ONLINE_APPLICATIONS, onlineApplications);
    }
    if (applicationSettings) {
      await putItemToStore(STORES.APPLICATION_SETTINGS, { id: 'main', ...applicationSettings });
    }

    if (settings) {
      await putItemToStore(STORES.SETTINGS, { id: 'main', ...settings });
    }

    if (this.isCloudActive()) {
      if (members.length > 0) await CloudStorageService.batchSaveMembers(members);
      if (transactions.length > 0) await CloudStorageService.batchSaveTransactions(transactions);
      if (accounts.length > 0) await CloudStorageService.batchSaveAccounts(accounts);
      if (inventory.length > 0) await CloudStorageService.batchSaveInventory(inventory);
      if (settings) await CloudStorageService.saveSettings(settings);
      if (documents.length > 0) await CloudStorageService.batchSaveDocuments(documents);
      if (donations.length > 0) await CloudStorageService.batchSaveDonations(donations);
      if (contacts.length > 0) await CloudStorageService.batchSaveContacts(contacts);
      if (invoices.length > 0) await CloudStorageService.batchSaveInvoices(invoices);
      if (invoiceTemplate) await CloudStorageService.saveInvoiceTemplate(invoiceTemplate);
      if (meetings.length > 0) await CloudStorageService.batchSaveMeetings(meetings);
      if (meetingTemplate) await CloudStorageService.saveMeetingTemplate(meetingTemplate);
      if (calendarCategories.length > 0) await CloudStorageService.batchSaveCalendarCategories(calendarCategories);
      if (calendarEvents.length > 0) await CloudStorageService.batchSaveCalendarEvents(calendarEvents);
      if (onlineApplications.length > 0) await CloudStorageService.batchSaveOnlineApplications(onlineApplications);
      if (applicationSettings) await CloudStorageService.saveApplicationSettings(applicationSettings);
      if (dashboardConfig) await CloudStorageService.saveDashboardConfig(dashboardConfig);
    }

    return {
      membersCount: members.length,
      transactionsCount: transactions.length,
      inventoryCount: inventory.length,
      documentsCount: documents.length,
      donationsCount: donations.length,
      calendarEventsCount: calendarEvents.length,
      meetingsCount: meetings.length,
      invoicesCount: invoices.length,
      contactsCount: contacts.length
    };
  },

  async getDashboardConfig(): Promise<UserDashboardConfig> {
    if (this.isCloudActive()) {
      try {
        const cloudConfig = await CloudStorageService.getDashboardConfig();
        if (cloudConfig && cloudConfig.widgets && cloudConfig.widgets.length > 0) {
          await putItemToStore(STORES.DASHBOARD_CONFIG, { id: 'main_dashboard', ...cloudConfig });
          return cloudConfig;
        }
      } catch (err) {
        console.warn('Cloud getDashboardConfig error:', err);
      }
    }
    const stored = await getItemFromStore<UserDashboardConfig & { id: string }>(
      STORES.DASHBOARD_CONFIG,
      'main_dashboard'
    );
    if (!stored || !stored.widgets || stored.widgets.length === 0) {
      return DEFAULT_DASHBOARD_CONFIG;
    }
    return stored;
  },

  async saveDashboardConfig(config: UserDashboardConfig): Promise<UserDashboardConfig> {
    await putItemToStore(STORES.DASHBOARD_CONFIG, { id: 'main_dashboard', ...config });
    if (this.isCloudActive()) {
      await CloudStorageService.saveDashboardConfig(config);
    }
    return config;
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
    await saveAllToStore(STORES.CONTACTS, INITIAL_CONTACTS);
    await saveAllToStore(STORES.INVOICES, INITIAL_INVOICES);
    await putItemToStore(STORES.INVOICE_TEMPLATES, { id: 'main_template', ...DEFAULT_INVOICE_TEMPLATE });
    await saveAllToStore(STORES.MEETINGS, INITIAL_MEETINGS);
    await putItemToStore(STORES.MEETING_TEMPLATES, { id: 'main_template', ...DEFAULT_MEETING_TEMPLATE });
    await putItemToStore(STORES.DASHBOARD_CONFIG, { id: 'main_dashboard', ...DEFAULT_DASHBOARD_CONFIG });
    await saveAllToStore(STORES.CALENDAR_CATEGORIES, DEFAULT_CALENDAR_CATEGORIES);
    await saveAllToStore(STORES.CALENDAR_EVENTS, INITIAL_CALENDAR_EVENTS);
    await saveAllToStore(STORES.ONLINE_APPLICATIONS, INITIAL_APPLICATIONS);
    await putItemToStore(STORES.APPLICATION_SETTINGS, { id: 'main', ...DEFAULT_APPLICATION_SETTINGS });
    await putItemToStore(STORES.SETTINGS, { id: 'main', ...DEFAULT_SETTINGS });
    await this.syncReceiptsToDocuments();
    await this.syncDonationsToDocuments();

    if (this.isCloudActive()) {
      try {
        await Promise.allSettled([
          CloudStorageService.batchSaveAccounts(INITIAL_ACCOUNTS),
          CloudStorageService.batchSaveMembers(INITIAL_MEMBERS),
          CloudStorageService.batchSaveTransactions(INITIAL_TRANSACTIONS),
          CloudStorageService.batchSaveInventory(INITIAL_INVENTORY),
          CloudStorageService.batchSaveDocuments(getInitialDocuments()),
          CloudStorageService.batchSaveDonations(INITIAL_DONATIONS),
          CloudStorageService.batchSaveContacts(INITIAL_CONTACTS),
          CloudStorageService.batchSaveInvoices(INITIAL_INVOICES),
          CloudStorageService.saveInvoiceTemplate(DEFAULT_INVOICE_TEMPLATE),
          CloudStorageService.batchSaveMeetings(INITIAL_MEETINGS),
          CloudStorageService.saveMeetingTemplate(DEFAULT_MEETING_TEMPLATE),
          CloudStorageService.saveDashboardConfig(DEFAULT_DASHBOARD_CONFIG),
          CloudStorageService.batchSaveCalendarCategories(DEFAULT_CALENDAR_CATEGORIES),
          CloudStorageService.batchSaveCalendarEvents(INITIAL_CALENDAR_EVENTS),
          CloudStorageService.batchSaveOnlineApplications(INITIAL_APPLICATIONS),
          CloudStorageService.saveApplicationSettings(DEFAULT_APPLICATION_SETTINGS),
          CloudStorageService.saveSettings(DEFAULT_SETTINGS)
        ]);
      } catch (err) {
        console.warn('Cloud resetToDemoData warning:', err);
      }
    }
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
    await saveAllToStore(STORES.CONTACTS, []);
    await saveAllToStore(STORES.INVOICES, []);
    await saveAllToStore(STORES.MEETINGS, []);
    await putItemToStore(STORES.DASHBOARD_CONFIG, { id: 'main_dashboard', ...DEFAULT_DASHBOARD_CONFIG });
    await saveAllToStore(STORES.CALENDAR_CATEGORIES, DEFAULT_CALENDAR_CATEGORIES);
    await saveAllToStore(STORES.CALENDAR_EVENTS, []);
    await saveAllToStore(STORES.ONLINE_APPLICATIONS, []);
  }
};

