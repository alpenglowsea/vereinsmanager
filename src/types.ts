export type Gender = 'm' | 'w' | 'd' | 'none';

export type MembershipStatus = 'active' | 'passive' | 'honorary' | 'terminated' | 'suspended';

export type MembershipType = 'full' | 'reduced' | 'youth' | 'family' | 'supporting' | 'honorary' | 'ausgetreten' | 'terminated';

export type PaymentMethod = 'sepa' | 'transfer' | 'cash' | 'standing_order' | 'exempt';

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

export interface BoardMember {
  id: string;
  role: string; // Frei wählbar/benennbar: z.B. '1. Vorsitzender', '2. Vorsitzender', 'Schatzmeister / Kassenwart', 'Schriftführer', 'Sportwart', 'Jugendleiter'
  name: string; // Name des Vorstandsmitglieds
  email?: string;
  phone?: string;
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
  boardMembers?: BoardMember[]; // Frei konfigurierbare Vorstandsmitglieder
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
  geminiApiKey?: string; // Eigener Google Gemini API-Schlüssel für KI-Funktionen (Rückwärtskompatibilität)
  aiProvider?: AiProviderType; // 'gemini' | 'openai' | 'anthropic' | 'custom'
  aiApiKey?: string; // Allgemeiner API-Schlüssel für den gewählten Anbieter
  aiModel?: string; // Ausgewähltes Modell (z.B. 'gpt-4o-mini', 'claude-3-5-haiku-20241022')
  aiBaseUrl?: string; // Basis-URL für lokale / benutzerdefinierte KI (z.B. 'http://localhost:11434/v1')
  // SMTP-Konfiguration für E-Mail-Versand (Sitzungsdienst, Einladungen, Protokolle)
  smtpHost?: string; // z.B. 'smtp.ionos.de', 'smtp.strato.de', 'mail.gmx.net', 'smtp.gmail.com'
  smtpPort?: number; // z.B. 587 (STARTTLS) oder 465 (SSL/TLS)
  smtpSecure?: boolean; // true = Port 465 / SSL, false = Port 587 / STARTTLS
  smtpUser?: string; // Benutzername / E-Mail für SMTP-Auth
  smtpPassword?: string; // Passwort / App-Passwort
  smtpFromEmail?: string; // Absender-Adresse (z.B. vorstand@tsv-musterstadt1890.de)
  smtpFromName?: string; // Absender-Name (z.B. 'TSV Musterstadt 1890 e.V. Vorstand')
}

export interface SmtpConfig {
  host?: string;
  port?: number;
  secure?: boolean;
  user?: string;
  password?: string;
  fromEmail?: string;
  fromName?: string;
}

export type AiProviderType = 'gemini' | 'openai' | 'anthropic' | 'custom';

export interface AiConfig {
  provider: AiProviderType;
  apiKey: string;
  model?: string;
  baseUrl?: string;
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

export interface ExtractedApplicationData {
  firstName?: string;
  lastName?: string;
  gender?: 'm' | 'w' | 'd' | 'none';
  birthDate?: string;
  nationality?: string;
  phone?: string;
  email?: string;
  address?: {
    street?: string;
    houseNumber?: string;
    zip?: string;
    city?: string;
    country?: string;
  };
  department?: string;
  membershipType?: 'full' | 'reduced' | 'youth' | 'family' | 'supporting' | 'honorary';
  feePeriod?: 'monthly' | 'quarterly' | 'half_yearly' | 'yearly';
  feeAmount?: number;
  entryDate?: string;
  paymentMethod?: 'sepa' | 'transfer' | 'cash' | 'standing_order';
  bankDetails?: {
    iban?: string;
    bic?: string;
    bankName?: string;
    accountHolder?: string;
    mandateDate?: string;
  };
  isMinor?: boolean;
  guardianName?: string;
  guardianPhone?: string;
  guardianEmail?: string;
  guardianRelation?: string;
  dataPrivacyConsent?: boolean;
  statuteConsent?: boolean;
  photoConsent?: boolean;
  healthConfirmation?: boolean;
  hasApplicantSignature?: boolean;
  hasGuardianSignature?: boolean;
  hasSepaSignature?: boolean;
  notes?: string;
  confidence?: number;
  rawExtractedTextSummary?: string;
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

// ----------------------------------------------------
// KONTAKTVERWALTUNG (NATÜRLICHE & JURISTISCHE PERSONEN)
// ----------------------------------------------------

export type ContactPersonType = 'natural' | 'legal';

export type ContactType =
  | 'supplier'       // Lieferant
  | 'donor'          // Spender
  | 'sponsor'        // Sponsor
  | 'service'        // Dienstleister / Handwerk
  | 'association'    // Verband / Sportbund
  | 'authority'      // Kommune / Behörde
  | 'partner'        // Kooperationspartner
  | 'member_contact' // Mitglieds-Bezug
  | 'other';         // Sonstige

export interface ContactPersonDetails {
  salutation?: string; // Herr, Frau, Dr., etc.
  firstName?: string;
  lastName?: string;
  roleOrPosition?: string; // z.B. Geschäftsführer, Marketingleiter, Trainer
  email?: string;
  phone?: string;
}

export interface ClubContact {
  id: string;
  contactNumber: string; // z.B. 'K-1001'
  personType: ContactPersonType; // 'natural' = Natürliche Person, 'legal' = Juristische Person (Firma / Organisation)
  types: ContactType[]; // z.B. ['sponsor', 'donor']

  // Juristische Person / Firma
  companyName?: string; // z.B. 'Musterstadt Stadtwerke AG'
  legalForm?: string; // z.B. 'GmbH', 'AG', 'e.V.', 'GbR', 'Stiftung'
  contactPerson?: ContactPersonDetails;
  taxId?: string; // Steuernummer / USt-IdNr.
  commercialRegister?: string; // z.B. 'HRB 12345 (Amtsgericht Musterstadt)'

  // Natürliche Person
  salutation?: string; // Herr, Frau, Dr., etc.
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;

  // Gemeinsame Kontaktdaten
  displayName: string; // Vollständiger Name / Firmenname für Anzeigen und Suchen
  address: Address;
  email: string;
  phone: string;
  mobile?: string;
  website?: string;

  // Buchhaltungs- / Bankdaten
  bankDetails?: {
    iban?: string;
    bic?: string;
    bankName?: string;
    accountHolder?: string;
  };
  creditorOrDebtorNumber?: string; // z.B. 'KRED-7001' oder 'DEB-1001'

  notes?: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

// ----------------------------------------------------
// RECHNUNGSVERWALTUNG & AUSGANGSRECHNUNGEN
// ----------------------------------------------------

export type InvoiceStatus = 'draft' | 'open' | 'paid' | 'overdue' | 'cancelled';

export interface InvoiceItem {
  id: string;
  position: number; // Fortlaufende Nummer (1, 2, 3...)
  description: string; // Beschreibung / Leistungsbezeichnung
  quantity: number; // Menge (rationale Zahlen z.B. 1, 2.5, 0.75)
  unit?: string; // z.B. 'Stück', 'Std.', 'Monate', 'Pauschale'
  unitPrice: number; // Einzelpreis in EUR
  vatRate: number; // 0, 7, 19 (%)
  totalPrice: number; // Menge * Einzelpreis
}

export interface ClubInvoice {
  id: string;
  invoiceNumber: string; // z.B. 'RE-2026-001'
  date: string; // YYYY-MM-DD
  deliveryDate?: string; // YYYY-MM-DD (Leistungs- / Lieferdatum)
  dueDate: string; // YYYY-MM-DD (Fälligkeitsdatum)
  status: InvoiceStatus;

  // Empfänger-Daten
  recipientType: 'member' | 'contact' | 'custom';
  recipientId?: string; // ID des verknüpften Mitglieds oder Kontakts
  recipientName: string; // Name oder Firmenname
  recipientCompany?: string;
  recipientContactPerson?: string; // Ansprechpartner (z.B. 'z. Hd. Herrn Müller')
  recipientAddress: Address;
  recipientEmail?: string;
  recipientPhone?: string;

  // Inhalte
  title: string; // z.B. 'Rechnung'
  subject: string; // Betreffzeile
  introText?: string; // Einleitungstext
  items: InvoiceItem[]; // Rechnungspositionen
  outroText?: string; // Schlusstext / Zahlungsbedingungen
  taxSphere?: TaxSphere; // Steuerliche Sphäre

  // Summen
  subtotalNet: number; // Netto-Summe
  vatAmounts: { [rate: number]: number }; // Aufschlüsselung nach USt-Sätzen
  totalVat: number; // Gesamt-Umsatzsteuer
  totalAmount: number; // Brutto-Gesamtbetrag (Zahlbetrag)

  // Zahlungsinformationen
  paymentTermsDays: number; // z.B. 14
  paidAt?: string; // Datum der Zahlung
  paymentMethod?: PaymentMethod;
  linkedTransactionId?: string;

  // Archivierung & Vorlage
  documentId?: string; // ID in der Dokumentenverwaltung
  customTemplateUsed?: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceTemplateSettings {
  id?: string;
  templateName: string;
  customBlankoDataUrl?: string; // Base64 Data URL der hochgeladenen Blanko-Vorlage (Briefpapier)
  customBlankoFileName?: string;
  customBlankoUploadedAt?: string;

  // Layout & Abstände in mm
  marginTop: number;
  marginBottom: number;
  marginLeft: number;
  marginRight: number;

  // Standard-Texte
  defaultIntroText: string;
  defaultOutroText: string;
  defaultPaymentTermsDays: number;
  defaultDueNotice: string;

  // Optionen
  showClubLogo: boolean;
  showFoldingMarks: boolean;
  showGiroCode: boolean; // BezahlCode / EPC-QR-Code
  accentColor: string; // Hex-Farbe
}

// ----------------------------------------------------
// SITZUNGS- & PROTOKOLLDIENST (COMPLIANCE & PROTOKOLLE)
// ----------------------------------------------------

export type MeetingType =
  | 'board' // Vorstandssitzung
  | 'general_assembly' // Ordentliche Mitgliederversammlung / Jahreshauptversammlung
  | 'extraordinary_assembly' // Außerordentliche Mitgliederversammlung
  | 'committee' // Ausschuss / Beirat / Fachbereich
  | 'department' // Abteilungsversammlung
  | 'other'; // Sonstige Sitzung

export type MeetingStatus =
  | 'scheduled' // Einberufen / Geplant
  | 'in_progress' // In Durchführung
  | 'draft' // Protokoll im Entwurf
  | 'review' // In Prüfung / Zur Genehmigung
  | 'approved' // Rechtskräftig genehmigt / abgeschlossen
  | 'cancelled'; // Abgesagt

export type MeetingProtocolType =
  | 'results' // Ergebnisprotokoll (Standard gem. BGB)
  | 'verbatim'; // Ausführliches Verlaufsprotokoll

export interface MeetingResolution {
  id: string;
  meetingId?: string;
  agendaItemNumber: string; // z.B. "TOP 4"
  title: string;
  motionText: string; // Exakter Antragswortlaut
  proposer?: string; // Antragsteller
  votesFor: number; // Ja-Stimmen
  votesAgainst: number; // Nein-Stimmen
  votesAbstain: number; // Enthaltungen
  result: 'accepted' | 'rejected' | 'deferred'; // Angenommen / Abgelehnt / Vertagt
  isTaxRelevant: boolean; // Relevant für Finanzamt (z. B. Ehrenamtspauschale, Rücklagen, Mittelverwendung)
  isRegisterRelevant: boolean; // Relevant für Vereinsregister / Notar (z.B. Vorstandswahlen § 26 BGB, Satzungsänderung § 33 BGB)
  responsiblePerson?: string; // Verantwortlich für die Umsetzung
  dueDate?: string; // Frist zur Umsetzung
  notes?: string;
}

export interface MeetingAgendaItem {
  id: string;
  number: string; // z.B. "TOP 1"
  title: string;
  speaker?: string; // Berichterstatter
  discussionNotes?: string; // Besprechung / Verlauf
  resolutions?: MeetingResolution[]; // Beschlüsse zu diesem TOP
}

export interface MeetingAttendee {
  id: string;
  memberId?: string;
  name: string;
  email?: string; // Für Einladungs- und Protokollversand
  role: string; // z.B. "Versammlungsleiter", "Schriftführer", "Vorstand", "Mitglied", "Gast"
  present: boolean;
  hasVotingRight: boolean; // Stimmberechtigt
  isSignatory: boolean; // Muss das Protokoll unterzeichnen gem. Satzung
  signatureDataUrl?: string; // Digital erfasste Unterschrift (Base64 PNG)
  signedAt?: string; // Zeitstempel der Unterschrift
}

export interface MeetingDigitalSignature {
  id: string;
  signatoryId?: string; // ID des Teilnehmers oder Mitglieds
  name: string;
  role: string; // "Versammlungsleiter" | "Schriftführer" | "Unterzeichner"
  signatureDataUrl: string; // Base64 PNG der Unterschrift
  signedAt: string; // ISO Zeitstempel der Unterzeichnung
  deviceInfo?: string; // z.B. "Touch-Eingabe (Smartphone)" oder "Mauszeiger (Desktop)"
}

export interface Meeting {
  id: string;
  title: string; // z.B. "Ordentliche Mitgliederversammlung 2026"
  type: MeetingType;
  status: MeetingStatus;
  protocolType: MeetingProtocolType;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  endTime?: string; // HH:MM
  location: string; // z.B. "Vereinsheim TSV Musterstadt"
  chairperson: string; // Versammlungsleiter
  minuteKeeper: string; // Protokollführer / Schriftführer

  // Rechtliche Vorprüfung & Compliance gem. BGB & Satzung
  invitationDate?: string; // Datum der Einladung
  invitationMethod?: string; // z.B. "Schriftlich per E-Mail gem. § 8 der Satzung"
  invitationCompliant: boolean; // Form- und fristgerecht eingeladen gem. Satzung
  quorumConfirmed: boolean; // Beschlussfähigkeit ordnungsgemäß festgestellt
  totalEligibleVoters?: number; // Anzahl der anwesenden stimmberechtigten Mitglieder

  // Inhalte
  agenda: MeetingAgendaItem[];
  attendees: MeetingAttendee[];
  generalNotes?: string;

  // Vorlagen & Dokumentenablage
  customTemplateUsed?: boolean;
  signedAt?: string;
  signatures?: MeetingDigitalSignature[]; // Digital erfasste Signaturen (Versammlungsleiter, Schriftführer, etc.)
  documentId?: string; // Referenz auf archiviertes PDF in der Dokumentenverwaltung

  createdAt: string;
  updatedAt: string;
}

export interface MeetingTemplateSettings {
  id?: string;
  templateName: string;
  customBlankoDataUrl?: string; // Base64 Data URL der hochgeladenen Blanko-Vorlage (Briefpapier)
  customBlankoFileName?: string;
  customBlankoUploadedAt?: string;

  // Layout & Abstände in mm
  marginTop: number;
  marginBottom: number;
  marginLeft: number;
  marginRight: number;

  // Optionen
  showClubHeader: boolean; // Wenn kein eigenes Briefpapier hochgeladen ist
  showClubLogo: boolean;
  showSignaturesBlock: boolean; // Offizielle Unterschriftenzeilen gem. Satzung
  showRegisterExtractNotice: boolean; // Hinweiszeile für Notar / Amtsgericht
  accentColor: string; // Hex-Farbe
}





