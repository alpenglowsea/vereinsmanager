export type Gender = 'm' | 'w' | 'd' | 'none';

export type MembershipStatus = 'active' | 'passive' | 'honorary' | 'terminated' | 'suspended';

export type MembershipType = 'full' | 'reduced' | 'youth' | 'family' | 'supporting' | 'honorary';

export type PaymentMethod = 'sepa' | 'transfer' | 'cash' | 'standing_order';

export type FeePeriod = 'monthly' | 'quarterly' | 'half_yearly' | 'yearly';

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
  associationNumber: string; // z.B. VR 12345
  taxNumber: string; // z.B. 12/345/67890
  creditorId: string; // Gläubiger-ID für SEPA
  creditorIban?: string; // Vereinskonto IBAN für Gutschrift
  creditorBic?: string; // Vereinsbank BIC
  creditorAccountId?: string; // Verknüpftes Finanzkonto in der Kassenführung
  address: string;
  chairman: string;
  treasurer: string;
  email: string;
  departments: string[];
  taxOffice?: string; // z.B. 'Finanzamt Musterstadt'
  taxExemptionDate?: string; // z.B. '10.01.2024'
  taxAssessmentPeriod?: string; // z.B. '2021 bis 2023'
  promotedPurposes?: string; // z.B. 'Förderung des Sports (§ 52 Abs. 2 Satz 1 Nr. 21 AO)'
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

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  isConfigured: boolean;
}

export interface UserAuthSession {
  user: {
    id: string;
    email: string;
    role?: string;
    clubName?: string;
    lastSignIn?: string;
  } | null;
  isAuthenticated: boolean;
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


