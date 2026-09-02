export type Gender = 'm' | 'w' | 'd' | 'none';

export type MembershipStatus = 'active' | 'passive' | 'honorary' | 'terminated' | 'suspended';

export type MembershipType = 'full' | 'reduced' | 'youth' | 'family' | 'supporting' | 'honorary' | 'ausgetreten' | 'terminated';

export type PaymentMethod = 'sepa' | 'transfer' | 'cash' | 'standing_order';

export type FeePeriod = 'monthly' | 'quarterly' | 'half_yearly' | 'yearly' | 'none';

export interface Address {
  street: string;
  houseNumber: string;
  zip: string;
  city: string;
  country: string;
}

export interface BankDetails {
  iban: string;
  bic: string;
  bankName: string;
  accountHolder: string;
  mandateDate: string;
  mandateReference: string;
  monthlyDueDay?: 1 | 15; // Fälligkeitstag bei monatlichem Einzug (1. oder 15.)
  mandateSequenceType?: 'FRST' | 'RCUR';
}

export interface Member {
  id: string;
  memberNumber: string;
  firstName: string;
  lastName: string;
  gender: Gender;
  birthDate?: string;
  avatarUrl?: string; // Base64 data URL or picture
  address: Address;
  phone: string;
  email: string;
  entryDate: string;
  exitDate?: string;
  status: MembershipStatus;
  department: string;
  membershipType: MembershipType;
  feeAmount: number;
  feePeriod: FeePeriod;
  paymentMethod: PaymentMethod;
  bankDetails: BankDetails;
  notes: string;
  dataPrivacyConsent: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MemberAuditChange {
  field: string;
  label: string;
  oldValue: any;
  newValue: any;
}

export interface MemberBulkUpdates {
  paymentMethod?: PaymentMethod;
  feePeriod?: FeePeriod;
  status?: MembershipStatus;
  membershipType?: MembershipType;
  department?: string;
  feeAmount?: number;
  entryDate?: string;
  exitDate?: string;
  monthlyDueDay?: 1 | 15;
  dataPrivacyConsent?: boolean;
  notesAction?: 'append' | 'replace';
  notesValue?: string;
}

export interface MemberAuditLog {
  id: string;
  memberId: string;
  memberNumber: string;
  memberName: string;
  timestamp: string;
  author: string;
  action: 'create' | 'update' | 'delete' | 'status_change';
  summary: string;
  changes: MemberAuditChange[];
}

export type AccountType = 'bank' | 'cash' | 'paypal' | 'other';

export interface FinancialAccount {
  id: string;
  name: string;
  accountType: AccountType;
  iban?: string;
  bic?: string;
  initialBalance: number;
  color: string;
  description?: string;
  createdAt: string;
}

// 4 Tax Spheres according to German Association Law (§§ 51 ff. AO / Gemeinnützigkeitsrecht)
export type TaxSphere = 'ideell' | 'vermoegen' | 'zweckbetrieb' | 'wirtschaftlich';

export interface TaxSphereInfo {
  id: TaxSphere;
  name: string;
  subtitle: string;
  description: string;
  color: string;
  examples: string[];
}

export interface ReceiptAttachment {
  name: string;
  type: string; // e.g. 'application/pdf' | 'image/jpeg' | 'image/png'
  size: number;
  dataUrl: string; // Base64 data URL stored locally
  uploadedAt: string;
}

export interface Skr42SubCategory {
  code: string; // e.g. '3110'
  name: string; // e.g. 'Laufende Mitgliedsbeiträge'
  label: string; // e.g. '3110 - Laufende Mitgliedsbeiträge'
  vatRateDefault: 0 | 7 | 19;
}

export interface Skr42MainCategory {
  id: string; // e.g. 'HK-3100'
  code: string; // e.g. '3100'
  name: string; // e.g. 'Echte Mitgliedsbeiträge & Aufnahmegebühren'
  sphere: TaxSphere;
  type: 'income' | 'expense';
  subCategories: Skr42SubCategory[];
}

export interface Transaction {
  id: string;
  date: string; // YYYY-MM-DD
  amount: number; // positive = Einnahme, negative = Ausgabe
  type: 'income' | 'expense' | 'transfer';
  accountId: string;
  targetAccountId?: string; // only for internal transfers
  documentNumber: string;
  bookingText: string;
  partner: string; // Zahlungsempfänger / Einzahler
  sphere: TaxSphere;
  mainCategory?: string; // e.g. '3100 - Echte Mitgliedsbeiträge & Aufnahmegebühren'
  subCategory?: string;  // e.g. '3110 - Laufende Mitgliedsbeiträge'
  skrAccount?: string;   // e.g. '3110'
  category: string;      // Backwards compatible combined name / Nebenkategorie
  vatRate: 0 | 7 | 19;
  notes?: string;
  receipt?: ReceiptAttachment;
  createdAt: string;
  updatedAt: string;
}

export interface ClubSettings {
  clubName: string;
  clubLogoUrl?: string; // Optional custom club logo as Base64 Data URL
  associationNumber: string; // z.B. VR 12345
  taxNumber: string; // z.B. 12/345/67890
  creditorId: string; // Gläubiger-ID für SEPA
  creditorIban?: string; // Vereinskonto IBAN für Gutschrift
  creditorBic?: string; // Vereinsbank BIC
  creditorAccountId?: string; // Verknüpftes Finanzkonto in der Kassenführung
  address: Address | string;
  clubAddress?: Address;
  chairman: string;
  treasurer: string;
  email: string;
  phone?: string;
  website?: string;
  departments: string[];
  theme?: 'light' | 'dark' | 'system';
  currency?: string;
  dateFormat?: string;
  fiscalYearStart?: string;
  taxOffice?: string; // z.B. 'Finanzamt Musterstadt'
  taxExemptionDate?: string; // z.B. '10.01.2024'
  taxAssessmentPeriod?: string; // z.B. '2021 bis 2023'
  promotedPurposes?: string; // z.B. 'Förderung des Sports (§ 52 Abs. 2 Satz 1 Nr. 21 AO)'
  geminiApiKey?: string; // Eigener Google Gemini API-Schlüssel für KI-Funktionen (Buchungsassistent, Beleg- & Antragsscan)
}

export interface BookingAiSuggestion {
  sphere: TaxSphere;
  mainCategoryId?: string;
  mainCategoryName: string;
  mainCategoryCode: string;
  subCategoryLabel: string;
  subCategoryCode: string;
  subCategoryName: string;
  vatRate: 0 | 7 | 19;
  type: 'income' | 'expense';
  suggestedBookingText?: string;
  confidence: number;
  reasoning: string;
}

// SEPA Lastschrift & Beitragslauf Typen
export type SepaPeriodFilter =
  | 'monthly_1'      // Monatlicher Einzug: Nur 1. des Monats
  | 'monthly_15'     // Monatlicher Einzug: Nur 15. des Monats
  | 'monthly_all'    // Monatlicher Einzug: Alle (1. & 15.)
  | 'quarterly'      // Quartalsbeitrag (1/4 des Jahres bzw. Quartalsbetrag)
  | 'half_yearly'    // Halbjahresbeitrag (1/2 des Jahres bzw. Halbjahresbetrag)
  | 'yearly'         // Jahresbeitrag
  | 'all';           // Alle fälligen Zahlungen

export interface SepaCollectionItem {
  memberId: string;
  memberNumber: string;
  memberName: string;
  accountHolder: string;
  iban: string;
  bic: string;
  bankName?: string;
  mandateReference: string;
  mandateDate: string;
  sequenceType: 'RCUR' | 'FRST' | 'OOFF';
  amount: number;
  feePeriod: FeePeriod;
  monthlyDueDay?: 1 | 15;
  remittanceInfo: string; // Verwendungszweck (z.B. "Mitgliedsbeitrag 09/2026 MG-001 Maximilian Mueller")
  endToEndId: string; // Eindeutige Referenz pro Lastschriftposten
  isValid: boolean;
  validationErrors: string[];
  selected: boolean;
}

export interface SepaRunConfig {
  runId: string;
  runTitle: string;
  periodFilter: SepaPeriodFilter;
  targetYear: number;
  targetMonth: number; // 1-12
  targetQuarter?: 1 | 2 | 3 | 4;
  targetHalfYear?: 1 | 2;
  executionDate: string; // YYYY-MM-DD
  creditorId: string;
  creditorName: string;
  creditorIban: string;
  creditorBic?: string;
  remittanceTemplate: string;
  targetAccountId?: string;
  autoBook: boolean;
}

export interface SepaRunHistory {
  id: string;
  title: string;
  executionDate: string;
  createdAt: string;
  totalAmount: number;
  totalTransactions: number;
  periodFilter: SepaPeriodFilter;
  targetYear: number;
  targetMonth?: number;
  bookedToAccountId?: string;
  isBooked: boolean;
  xmlContent?: string;
  items: SepaCollectionItem[];
}

export type InventoryCategory =
  | 'sports_equipment' // Sportgerät (z.B. Bälle, Tore, Netze, Matten)
  | 'apparel'          // Bekleidung / Trikotsätze / Trainingsanzüge
  | 'accessories'      // Zubehör & Trainingshilfen (Hütchen, Leibchen, Pfeifen)
  | 'facility'         // Platz- & Hallenpflege (Rasenmäher, Kreidewagen, Netze)
  | 'electronics'      // Elektronik & IT (Anzeigetafel, Musikanlage, Laptop)
  | 'medical'          // Erste Hilfe & Medizin (Sanitätskoffer, Eisbox)
  | 'furniture'        // Vereinsheim & Mobiliar (Bierzeltgarnituren, Tische, Stühle)
  | 'other';           // Sonstiges

export type ItemCondition = 'new' | 'good' | 'used' | 'damaged' | 'in_repair' | 'discarded';

export interface InventoryItem {
  id: string;
  itemNumber: string; // z.B. INV-2024-001
  name: string;
  category: InventoryCategory;
  department: string; // Sparte/Abteilung z.B. Fußball, Tennis oder "Gesamtverein"
  quantity: number;
  unit: string; // Stk., Paar, Set, Kiste
  location: string; // z.B. Geräteraum Platz 1, Kabine 3, Vereinsheim Keller
  condition: ItemCondition;
  purchaseDate?: string; // YYYY-MM-DD
  purchasePrice?: number; // Anschaffungswert in EUR
  currentValue?: number; // Geschätzter Zeitwert
  supplier?: string; // Händler / Hersteller z.B. Sport2000, Erima
  responsiblePerson?: string; // Verantwortlicher / Zeugwart z.B. "Markus Meier (Zeugwart)"
  assignedTo?: string; // Verliehen an / im Einsatz bei (z.B. "1. Herren", "U15 Jugend")
  serialNumber?: string; // Seriennummer / Inventarnummer
  notes?: string;
  photoUrl?: string; // Optionales Foto des Gegenstands
  lastCheckedDate?: string; // Datum der letzten Inventur / Prüfung
  nextInspectionDate?: string; // Nächste Prüfung (z.B. TÜV Sportgeräte)
  createdAt: string;
  updatedAt: string;
}

// Dokumentenverwaltung
export type DocumentCategory =
  | 'belege'      // Buchhaltungsbelege (Rechnungen, Quittungen, Spendenbelege)
  | 'vertraege'   // Verträge & Vereinbarungen (Mietverträge, Übungsleiter, Sponsoring)
  | 'satzung'     // Satzung & Ordnungen (Vereinssatzung, Beitragsordnung, Geschäftsordnung)
  | 'protokolle'  // Protokolle & Versammlungen (Jahreshauptversammlung, Vorstandssitzung)
  | 'mitglieder'  // Mitglieder & Anträge (Aufnahmeanträge, Kündigungen, Vollmachten)
  | 'bescheide'   // Finanzamt & Bescheide (Freistellungsbescheid, Gemeinnützigkeit, Registerauszug)
  | 'sonstiges';  // Sonstige Dokumente (Flyer, Urkunden, Presse, Schadensmeldungen)

export interface DocumentFolder {
  id: string;
  name: string;
  parentId?: string | null; // null oder undefined für oberste Ebene, sonst ID des übergeordneten Ordners
  category?: DocumentCategory | 'all'; // Verknüpfte Kategorie oder allgemein
  color?: string; // z.B. '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#64748b'
  icon?: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ClubDocument {
  id: string;
  title: string;
  fileName: string;
  fileType: string; // MIME type or extension (e.g. 'application/pdf', 'image/jpeg', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
  fileSize: number; // in Bytes
  dataUrl: string; // Base64 data URL
  category: DocumentCategory;
  folderId?: string | null; // ID des zugeordneten Ordners / Unterordners
  date: string; // YYYY-MM-DD (Dokumentendatum)
  uploadDate: string; // ISO datetime
  tags: string[];
  notes?: string;
  transactionId?: string; // Verknüpfte Buchung
  transactionDocNumber?: string; // z.B. 'BE-2025-001'
  memberId?: string; // Verknüpftes Mitglied
  memberName?: string;
  isReceipt?: boolean; // Kennzeichnet, ob es ein Buchungsbeleg ist
  createdAt: string;
  updatedAt: string;
}

// Betriebsmodi & Deployment
export type DeploymentMode = 'local' | 'cloud' | 'selfhosted';

// Benutzer & Rechteverwaltung
export interface UserPermissions {
  canViewMembers: boolean;
  canEditMembers: boolean;
  canViewFinances: boolean;
  canEditFinances: boolean;
  canExecuteSepa: boolean;
  canManageDonations: boolean;
  canManageDocuments: boolean;
  canManageInventory: boolean;
  canManageSettings: boolean;
  canManageUsers: boolean;
  canManageCalendar?: boolean;
}

export interface AppUser {
  id: string;
  username: string; // e.g. "admin", "schatzmeister", "kassenpruefer"
  email: string;
  name: string;
  password: string; // Plaintext or hashed password
  customRoleName?: string; // Optional descriptive title e.g. "1. Vorsitzender", "Kassenwart"
  permissions: UserPermissions;
  isActive: boolean;
  lastLogin?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface SecuritySettings {
  authRequired: boolean;
  autoLockMinutes: number; // 0 = never, 5, 15, 30, 60
}

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  isConfigured: boolean;
}

export interface UserAuthSession {
  user: AppUser | null;
  isAuthenticated: boolean;
  loginMethod?: 'user' | 'demo' | 'supabase';
  loginTime?: string;
}

// Spenden & Zuwendungsbestätigungen (BMF Muster)
export type DonationType = 'money' | 'goods';

export interface DonationReceipt {
  id: string;
  receiptNumber: string; // z.B. ZB-2025-001
  type: DonationType; // 'money' = Geldzuwendung, 'goods' = Sachzuwendung
  date: string; // YYYY-MM-DD (Tag der Zuwendung)
  donorType: 'member' | 'external';
  memberId?: string;
  donorName: string; // Name des Spenders / Unternehmens
  donorAddress: Address;
  amount: number; // Betrag bzw. Wert in EUR
  amountInWords: string; // Betrag in Buchstaben (z.B. 'Eintausendfünfhundert Euro')
  isWaiverOfRefund: boolean; // Verzicht auf die Erstattung von Aufwendungen
  // Spezifisch für Sachzuwendungen:
  goodsDescription?: string; // Genaue Bezeichnung des Gegenstands, Alter, Zustand etc.
  goodsOrigin?: 'business' | 'private'; // Herkunft: Betriebs- oder Privatvermögen
  goodsValuationBasis?: string; // Unterlagen zur Wertermittlung (Rechnung, Gutachten)
  // Steuer- & Freistellungsangaben:
  taxOffice: string;
  taxNumber: string;
  exemptionDate: string;
  assessmentPeriod: string;
  promotedPurpose: string;
  isDirectlyPromoted: boolean;
  issuedBy: string; // Aussteller / Vertretungsberechtigter
  cityAndDate: string; // Ort und Datum der Ausstellung
  // Verknüpfungen:
  transactionId?: string;
  documentId?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// ----------------------------------------------------
// TERMIN- & VERANSTALTUNGSKALENDER
// ----------------------------------------------------

export interface CalendarEventCategory {
  id: string;
  name: string;
  color: string; // Hex color (e.g. '#3b82f6')
  badgeBg: string; // Tailwind class (e.g. 'bg-blue-100')
  badgeText: string; // Tailwind class (e.g. 'text-blue-800')
  badgeBorder: string; // Tailwind class (e.g. 'border-blue-300')
  icon?: string; // Lucide icon name or emoji
  description?: string;
  isSystem?: boolean;
}

export type RecurrenceFrequency = 'none' | 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'yearly';

export interface EventRecurrence {
  frequency: RecurrenceFrequency;
  interval: number; // e.g. every 1 week, every 2 weeks
  daysOfWeek?: number[]; // 0 = Sunday, 1 = Monday, ..., 6 = Saturday (for weekly recurrence)
  endType: 'never' | 'until_date' | 'count';
  untilDate?: string; // YYYY-MM-DD
  count?: number; // Total number of occurrences
}

export type ParticipantRole = 'participant' | 'organizer' | 'helper' | 'trainer' | 'referee';
export type ParticipantStatus = 'invited' | 'confirmed' | 'declined' | 'attended';

export interface EventParticipant {
  memberId: string;
  memberName: string;
  memberEmail?: string;
  memberPhone?: string;
  memberDepartment?: string;
  role: ParticipantRole;
  status: ParticipantStatus;
  notes?: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  categoryId: string;
  department?: string; // Specific department or 'all'
  startDate: string; // YYYY-MM-DD
  startTime?: string; // HH:MM (e.g. '18:30')
  endDate: string; // YYYY-MM-DD
  endTime?: string; // HH:MM (e.g. '20:00')
  isAllDay: boolean;
  location?: string; // Address or facility name
  locationLat?: number; // GPS Latitude for OpenStreetMap
  locationLng?: number; // GPS Longitude for OpenStreetMap
  recurrence?: EventRecurrence;
  participants: EventParticipant[];
  maxParticipants?: number;
  color?: string; // Optional custom hex color override
  createdById?: string;
  createdAt: string;
  updatedAt: string;
}

export type CalendarViewMode = 'month' | 'week' | 'day' | 'agenda';

export interface SpecialCalendarItem {
  id: string;
  type: 'birthday' | 'anniversary';
  title: string;
  date: string; // YYYY-MM-DD
  memberId: string;
  memberName: string;
  memberDepartment?: string;
  years: number; // Age or years of membership
  isMilestone: boolean; // e.g. 18, 30, 40, 50, 60, 70, 75, 80... or 10, 25, 40, 50 years membership
  details: string;
}

// ----------------------------------------------------
// ONLINE-MITGLIEDSANTRAG & DIGITALES AUFNAHMEWESEN
// ----------------------------------------------------

export type ApplicationStatus = 'pending' | 'approved' | 'rejected';

export interface OnlineMembershipApplication {
  id: string;
  applicationNumber: string; // z.B. 'ANTRAG-2026-001'
  submittedAt: string; // ISO datetime
  status: ApplicationStatus;
  reviewedAt?: string;
  reviewedBy?: string;
  rejectionReason?: string;
  createdMemberId?: string;
  createdMemberNumber?: string;
  generatedDocumentId?: string;

  // Persönliche Daten des Antragstellers
  firstName: string;
  lastName: string;
  gender: Gender;
  birthDate: string; // YYYY-MM-DD
  nationality?: string;
  phone: string;
  email: string;

  // Anschrift
  address: Address;

  // Mitgliedschaft & Sparte
  department: string;
  membershipType: MembershipType;
  feeAmount?: number;
  feePeriod: FeePeriod;
  entryDate: string; // YYYY-MM-DD
  notes?: string;
  previousClub?: string;

  // Gesetzlicher Vertreter (bei Minderjährigen / unter 18 Jahren)
  isMinor: boolean;
  guardianName?: string;
  guardianPhone?: string;
  guardianEmail?: string;
  guardianAddress?: Address;
  guardianRelation?: string; // z.B. 'Mutter', 'Vater', 'Gesetzlicher Vormund'

  // Zahlungsweise & SEPA-Lastschrift
  paymentMethod: PaymentMethod;
  bankDetails: BankDetails;

  // Rechtliche Zustimmungen & Einwilligungen
  dataPrivacyConsent: boolean;
  statuteConsent: boolean; // Satzung & Ordnungen anerkannt
  photoConsent: boolean; // Einwilligung für Vereinsfotos/Medien
  healthConfirmation: boolean; // Sporttauglichkeit / Gesundheitliche Eignung

  // Digitale Unterschriften (Base64 PNG Data URLs)
  applicantSignature?: string;
  applicantSignatureDate?: string;
  guardianSignature?: string;
  guardianSignatureDate?: string;
  sepaSignature?: string;
  sepaSignatureDate?: string;

  // PDF & Vorlagen
  pdfDataUrl?: string; // Zuletzt generierte Antrags-PDF
  customTemplateUsed?: boolean;
}

export interface ApplicationTemplateSettings {
  clubLogoUrl?: string;
  headerText?: string;
  customPdfTemplateDataUrl?: string; // Eigene hochgeladene PDF-Vorlage des Vereins
  customPdfTemplateFileName?: string;
  customPdfTemplateUploadedAt?: string;
  introductoryText?: string;
  dataPrivacyText?: string;
  statuteText?: string;
  defaultFeeRules?: {
    full: number;
    reduced: number;
    youth: number;
    family: number;
    supporting: number;
  };
  requirePhotoConsent?: boolean;
  requireHealthConfirmation?: boolean;
  contactEmail?: string;
  notificationEmail?: string;
}

export interface AppUpdateInfo {
  currentVersion: string;
  latestVersion: string;
  isUpdateAvailable: boolean;
  releaseTitle?: string;
  releaseDate?: string;
  releaseNotes?: string[];
  githubUrl?: string;
  downloadUrls?: {
    windows?: string;
    mac?: string;
    linux?: string;
  };
}



