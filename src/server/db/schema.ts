/**
 * Datenbankschema des eigenen Servers (SQLite).
 * ---------------------------------------------------------------------------
 *
 * Das ist das SQLite-Gegenstück zu `supabase_schema.sql`. Wer im Cloud-Betrieb
 * arbeitet, bekommt seine Tabellen dort — wer den eigenen Server (Modus 3)
 * nutzt, bekommt exakt dieselben Vereinsdaten hier, in einer einzelnen Datei
 * auf der eigenen Platte statt in einer fremden Cloud-Datenbank.
 *
 * Seit Stufe 2 (siehe local_users / local_sessions unten) gibt es eigene
 * Benutzerkonten für diesen Server — das Gegenstück zu club_users, nur ohne
 * Einrichtungscode und Einladungen per Mail (siehe localAuth.ts, wo das
 * begründet ist).
 *
 * Bewusst NICHT enthalten (folgt in einer späteren Stufe):
 *   - Die Rechteprüfung je Bereich (aktuell nur clientseitig plus in
 *     supabase_rls.sql) — local_users trägt zwar schon eine "permissions"-
 *     Spalte, aber noch NIEMAND wertet sie serverseitig aus. Das ist eine
 *     eigene, sicherheitskritische Stufe für sich.
 *   - application_throttle (Ratenbegrenzung fürs Aufnahmeformular) — hängt
 *     an der Rechteprüfung, weil sie ohne diese keinen Sinn ergibt.
 *
 * Unterschiede zu supabase_schema.sql, und warum:
 * ---------------------------------------------------------------------------
 *
 * 1. JSONB → TEXT. SQLite kennt keinen eigenen JSON-Datentyp. Strukturierte
 *    Felder (Adressen, Bankverbindungen, Belege, Tagesordnungen, …) werden
 *    als JSON-Text abgelegt und vom Server beim Lesen/Schreiben selbst
 *    serialisiert (siehe localDb.ts). Für die Oberfläche ändert sich nichts —
 *    sie bekommt weiterhin ein normales JavaScript-Objekt.
 *
 * 2. BOOLEAN → INTEGER (0/1). SQLite hat keinen eigenen Wahrheitswert-Typ.
 *
 * 3. TIMESTAMP / DATE → TEXT. Gespeichert wird ein ISO-8601-Text
 *    (z. B. "2026-09-27T12:34:56.000Z"), erzeugt vom Server beim Schreiben —
 *    nicht durch eine SQL-seitige DEFAULT-Funktion. Postgres' `now()` hat in
 *    SQLite keine Entsprechung, die dasselbe Format liefert; die Zeit hier
 *    im Anwendungscode zu setzen ist außerdem einfacher zu testen.
 *
 * 4. NUMERIC(x,y) → REAL. SQLite kennt keine exakte Festkommazahl. Das ist
 *    unkritisch: Die Oberfläche rechnet mit Beträgen ohnehin als
 *    JavaScript-Zahl (siehe z. B. `feeAmount.toFixed(2)` in MembersView.tsx),
 *    und genau diese Zahl kommt beim Cloud-Betrieb heute schon aus
 *    Postgres' NUMERIC über JSON als Zahl an. An der Genauigkeit für
 *    Euro-Beträge (maximal zwei Nachkommastellen) ändert das nichts.
 *
 * 5. Die "Nachrüstung"-Abschnitte aus supabase_schema.sql (ALTER TABLE ADD
 *    COLUMN IF NOT EXISTS für Vereine, die die Tabelle schon in einer
 *    älteren Fassung hatten) fehlen hier bewusst — das ist eine frische
 *    Installation, es gibt keine ältere Fassung nachzuziehen. Der aktuelle,
 *    vollständige Spaltensatz steht gleich in der CREATE-TABLE-Anweisung.
 *    Künftige Änderungen an diesem Schema laufen über `schema_meta` (unten)
 *    und eigene Migrationsschritte in localDb.ts — nicht durch Bearbeiten
 *    dieser Datei im Nachhinein.
 *
 * Warum alle CREATE-Anweisungen IF NOT EXISTS sind: Dieses Skript läuft bei
 * JEDEM Start des Servers. Bei einer bereits vorhandenen Datenbank tut es
 * dann nichts — genau wie bei `supabase_schema.sql`.
 */

export const SCHEMA_VERSION = 1;

export const SCHEMA_SQL = `
-- ---------------------------------------------------------------------------
-- Schema-Version. Dient künftigen Migrationen: localDb.ts liest diesen Wert
-- beim Start und weiß dann, welche Änderungen an einer bestehenden Datenbank
-- noch nachzuziehen sind. Der CHECK sorgt dafür, dass es nie mehr als eine
-- Zeile geben kann.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS schema_meta (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  version INTEGER NOT NULL
);

-- 1. SETTINGS (Vereinsdaten & Gläubiger-ID)
CREATE TABLE IF NOT EXISTS settings (
  id TEXT PRIMARY KEY DEFAULT 'main',
  club_name TEXT NOT NULL,
  club_logo_url TEXT,
  association_number TEXT,
  tax_number TEXT,
  creditor_id TEXT,
  creditor_iban TEXT,
  creditor_bic TEXT,
  creditor_account_id TEXT,
  address TEXT,
  club_address TEXT,
  chairman TEXT,
  treasurer TEXT,
  board_members TEXT,
  email TEXT,
  phone TEXT,
  website TEXT,
  departments TEXT,
  currency TEXT,
  date_format TEXT,
  fiscal_year_start TEXT,
  tax_office TEXT,
  tax_exemption_date TEXT,
  tax_assessment_period TEXT,
  promoted_purposes TEXT,
  updated_at TEXT NOT NULL
);

-- 2. ACCOUNTS (Finanzkonten / Barkassen)
CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  account_type TEXT NOT NULL,
  iban TEXT,
  bic TEXT,
  initial_balance REAL NOT NULL DEFAULT 0,
  color TEXT DEFAULT 'emerald',
  description TEXT,
  created_at TEXT NOT NULL
);

-- 3. MEMBERS (Mitgliederverwaltung)
CREATE TABLE IF NOT EXISTS members (
  id TEXT PRIMARY KEY,
  member_number TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  gender TEXT DEFAULT 'none',
  birth_date TEXT,
  avatar_url TEXT,
  address TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  entry_date TEXT NOT NULL,
  exit_date TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  department TEXT NOT NULL,
  membership_type TEXT NOT NULL DEFAULT 'full',
  fee_amount REAL NOT NULL DEFAULT 0,
  fee_period TEXT DEFAULT 'monthly',
  payment_method TEXT DEFAULT 'sepa',
  bank_details TEXT,
  notes TEXT,
  data_privacy_consent INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_members_status ON members (status);
CREATE INDEX IF NOT EXISTS idx_members_department ON members (department);
CREATE INDEX IF NOT EXISTS idx_members_number ON members (member_number);

-- 4. TRANSACTIONS (Buchungsjournal / Kassenbuch)
CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  amount REAL NOT NULL,
  type TEXT NOT NULL,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  target_account_id TEXT,
  document_number TEXT NOT NULL,
  booking_text TEXT NOT NULL,
  partner TEXT NOT NULL,
  sphere TEXT NOT NULL,
  main_category TEXT,
  sub_category TEXT,
  skr_account TEXT,
  category TEXT NOT NULL,
  vat_rate REAL DEFAULT 0,
  department TEXT,
  notes TEXT,
  receipt TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions (date);
CREATE INDEX IF NOT EXISTS idx_transactions_account ON transactions (account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_sphere ON transactions (sphere);

-- 5. INVENTORY (Vereinsinventar & Material)
CREATE TABLE IF NOT EXISTS inventory (
  id TEXT PRIMARY KEY,
  item_number TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  department TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit TEXT DEFAULT 'Stk.',
  location TEXT,
  condition TEXT DEFAULT 'good',
  purchase_date TEXT,
  purchase_price REAL,
  current_value REAL,
  supplier TEXT,
  responsible_person TEXT,
  assigned_to TEXT,
  serial_number TEXT,
  notes TEXT,
  photo_url TEXT,
  last_checked_date TEXT,
  next_inspection_date TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_inventory_department ON inventory (department);
CREATE INDEX IF NOT EXISTS idx_inventory_category ON inventory (category);

-- 6. SEPA_RUNS (SEPA-Lastschrift Historie)
CREATE TABLE IF NOT EXISTS sepa_runs (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  execution_date TEXT NOT NULL,
  created_at TEXT NOT NULL,
  total_amount REAL NOT NULL,
  total_transactions INTEGER NOT NULL,
  period_filter TEXT NOT NULL,
  target_year INTEGER NOT NULL,
  target_month INTEGER,
  booked_to_account_id TEXT,
  is_booked INTEGER DEFAULT 0,
  xml_content TEXT,
  items TEXT NOT NULL DEFAULT '[]'
);

-- 7. AUDIT_LOGS (Revisionssicheres Änderungsprotokoll)
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  member_id TEXT NOT NULL,
  member_number TEXT NOT NULL,
  member_name TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  author TEXT NOT NULL,
  action TEXT NOT NULL,
  summary TEXT NOT NULL,
  changes TEXT DEFAULT '[]'
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_member ON audit_logs (member_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs (timestamp DESC);

-- 8. CONTACTS (Geschäftspartner, Lieferanten, Sponsoren, Spender)
CREATE TABLE IF NOT EXISTS contacts (
  id TEXT PRIMARY KEY,
  contact_number TEXT NOT NULL,
  person_type TEXT NOT NULL,
  types TEXT DEFAULT '[]',
  company_name TEXT,
  legal_form TEXT,
  contact_person TEXT,
  tax_id TEXT,
  commercial_register TEXT,
  salutation TEXT,
  first_name TEXT,
  last_name TEXT,
  date_of_birth TEXT,
  display_name TEXT NOT NULL,
  address TEXT NOT NULL DEFAULT '{}',
  email TEXT,
  phone TEXT,
  mobile TEXT,
  website TEXT,
  bank_details TEXT DEFAULT '{}',
  creditor_or_debtor_number TEXT,
  notes TEXT,
  tags TEXT DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_contacts_display_name ON contacts (display_name);
CREATE INDEX IF NOT EXISTS idx_contacts_number ON contacts (contact_number);

-- 9. INVOICES (Rechnungswesen / Ausgangsrechnungen DIN 5008)
CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  invoice_number TEXT NOT NULL,
  date TEXT NOT NULL,
  delivery_date TEXT,
  due_date TEXT NOT NULL,
  status TEXT NOT NULL,
  recipient_type TEXT NOT NULL,
  recipient_id TEXT,
  recipient_name TEXT NOT NULL,
  recipient_company TEXT,
  recipient_contact_person TEXT,
  recipient_address TEXT NOT NULL DEFAULT '{}',
  recipient_email TEXT,
  recipient_phone TEXT,
  title TEXT NOT NULL,
  subject TEXT NOT NULL,
  intro_text TEXT,
  items TEXT NOT NULL DEFAULT '[]',
  outro_text TEXT,
  tax_sphere TEXT,
  subtotal_net REAL NOT NULL DEFAULT 0,
  vat_amounts TEXT DEFAULT '{}',
  total_vat REAL NOT NULL DEFAULT 0,
  total_amount REAL NOT NULL DEFAULT 0,
  payment_terms_days INTEGER NOT NULL DEFAULT 14,
  paid_at TEXT,
  payment_method TEXT,
  linked_transaction_id TEXT,
  document_id TEXT,
  custom_template_used INTEGER DEFAULT 0,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices (status);
CREATE INDEX IF NOT EXISTS idx_invoices_date ON invoices (date DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_number ON invoices (invoice_number);

-- 10. INVOICE_TEMPLATES (Briefpapier & DIN 5008 Rechnungsvorlagen)
CREATE TABLE IF NOT EXISTS invoice_templates (
  id TEXT PRIMARY KEY DEFAULT 'main_template',
  template_name TEXT NOT NULL,
  custom_blanko_data_url TEXT,
  custom_blanko_file_name TEXT,
  custom_blanko_uploaded_at TEXT,
  margin_top INTEGER DEFAULT 25,
  margin_bottom INTEGER DEFAULT 20,
  margin_left INTEGER DEFAULT 25,
  margin_right INTEGER DEFAULT 20,
  default_intro_text TEXT,
  default_outro_text TEXT,
  default_payment_terms_days INTEGER DEFAULT 14,
  default_due_notice TEXT,
  show_club_logo INTEGER DEFAULT 1,
  show_folding_marks INTEGER DEFAULT 1,
  show_giro_code INTEGER DEFAULT 1,
  accent_color TEXT DEFAULT '#1e3a8a',
  updated_at TEXT NOT NULL
);

-- 11. MEETINGS (Sitzungsdienst & rechtssichere BGB-Protokolle)
CREATE TABLE IF NOT EXISTS meetings (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  type TEXT NOT NULL,
  status TEXT NOT NULL,
  protocol_type TEXT NOT NULL,
  date TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT,
  location TEXT NOT NULL,
  chairperson TEXT NOT NULL,
  minute_keeper TEXT NOT NULL,
  invitation_date TEXT,
  invitation_method TEXT,
  invitation_compliant INTEGER DEFAULT 0,
  quorum_confirmed INTEGER DEFAULT 0,
  total_eligible_voters INTEGER,
  agenda TEXT NOT NULL DEFAULT '[]',
  attendees TEXT NOT NULL DEFAULT '[]',
  general_notes TEXT,
  custom_template_used INTEGER DEFAULT 0,
  signed_at TEXT,
  signatures TEXT DEFAULT '[]',
  document_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_meetings_date ON meetings (date DESC);
CREATE INDEX IF NOT EXISTS idx_meetings_status ON meetings (status);

-- 12. MEETING_TEMPLATES (Sitzungsvorlagen & Briefpapier)
CREATE TABLE IF NOT EXISTS meeting_templates (
  id TEXT PRIMARY KEY DEFAULT 'main_meeting_template',
  template_name TEXT NOT NULL,
  custom_blanko_data_url TEXT,
  custom_blanko_file_name TEXT,
  custom_blanko_uploaded_at TEXT,
  margin_top INTEGER DEFAULT 25,
  margin_bottom INTEGER DEFAULT 20,
  margin_left INTEGER DEFAULT 20,
  margin_right INTEGER DEFAULT 20,
  show_club_header INTEGER DEFAULT 1,
  show_club_logo INTEGER DEFAULT 1,
  show_signatures_block INTEGER DEFAULT 1,
  show_register_extract_notice INTEGER DEFAULT 1,
  accent_color TEXT DEFAULT '#e11d48',
  updated_at TEXT NOT NULL
);

-- 13. DONATIONS (Spenden & BMF-Zuwendungsbestätigungen)
CREATE TABLE IF NOT EXISTS donations (
  id TEXT PRIMARY KEY,
  receipt_number TEXT NOT NULL,
  type TEXT NOT NULL,
  date TEXT NOT NULL,
  donor_type TEXT NOT NULL,
  member_id TEXT,
  donor_name TEXT NOT NULL,
  donor_address TEXT NOT NULL DEFAULT '{}',
  amount REAL NOT NULL,
  amount_in_words TEXT NOT NULL,
  is_waiver_of_refund INTEGER DEFAULT 0,
  goods_description TEXT,
  goods_origin TEXT,
  goods_valuation_basis TEXT,
  tax_office TEXT NOT NULL,
  tax_number TEXT NOT NULL,
  exemption_date TEXT NOT NULL,
  assessment_period TEXT NOT NULL,
  promoted_purpose TEXT NOT NULL,
  is_directly_promoted INTEGER DEFAULT 1,
  issued_by TEXT NOT NULL,
  city_and_date TEXT NOT NULL,
  transaction_id TEXT,
  document_id TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_donations_date ON donations (date DESC);
CREATE INDEX IF NOT EXISTS idx_donations_number ON donations (receipt_number);

-- 14. CALENDAR_EVENTS (Vereinskalender & Termine)
CREATE TABLE IF NOT EXISTS calendar_events (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  category_id TEXT NOT NULL,
  department TEXT,
  start_date TEXT NOT NULL,
  start_time TEXT,
  end_date TEXT NOT NULL,
  end_time TEXT,
  is_all_day INTEGER DEFAULT 0,
  location TEXT,
  location_lat REAL,
  location_lng REAL,
  recurrence TEXT,
  participants TEXT DEFAULT '[]',
  max_participants INTEGER,
  color TEXT,
  created_by_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_calendar_events_start ON calendar_events (start_date);

-- 15. CALENDAR_CATEGORIES (Kategorien für Termine)
CREATE TABLE IF NOT EXISTS calendar_categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  badge_bg TEXT NOT NULL,
  badge_text TEXT NOT NULL,
  badge_border TEXT NOT NULL,
  icon TEXT,
  description TEXT,
  is_system INTEGER DEFAULT 0
);

-- 16. DOCUMENTS (Dokumentenablage & Belegarchiv)
CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  data_url TEXT NOT NULL,
  category TEXT NOT NULL,
  folder_id TEXT,
  date TEXT NOT NULL,
  upload_date TEXT NOT NULL,
  tags TEXT DEFAULT '[]',
  notes TEXT,
  transaction_id TEXT,
  transaction_doc_number TEXT,
  member_id TEXT,
  member_name TEXT,
  is_receipt INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_documents_category ON documents (category);
CREATE INDEX IF NOT EXISTS idx_documents_folder ON documents (folder_id);

-- 17. FOLDERS (Ordnerstruktur im Dokumentenarchiv)
CREATE TABLE IF NOT EXISTS folders (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  parent_id TEXT,
  category TEXT,
  color TEXT,
  icon TEXT,
  description TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 18. ONLINE_APPLICATIONS (Digitale Mitgliedsanträge)
CREATE TABLE IF NOT EXISTS online_applications (
  id TEXT PRIMARY KEY,
  application_number TEXT NOT NULL,
  submitted_at TEXT NOT NULL,
  status TEXT NOT NULL,
  reviewed_at TEXT,
  reviewed_by TEXT,
  rejection_reason TEXT,
  created_member_id TEXT,
  created_member_number TEXT,
  generated_document_id TEXT,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  gender TEXT NOT NULL,
  birth_date TEXT NOT NULL,
  nationality TEXT,
  phone TEXT NOT NULL,
  email TEXT NOT NULL,
  address TEXT NOT NULL DEFAULT '{}',
  department TEXT NOT NULL,
  membership_type TEXT NOT NULL,
  fee_amount REAL,
  fee_period TEXT NOT NULL,
  entry_date TEXT NOT NULL,
  notes TEXT,
  previous_club TEXT,
  is_minor INTEGER DEFAULT 0,
  guardian_name TEXT,
  guardian_phone TEXT,
  guardian_email TEXT,
  guardian_address TEXT,
  guardian_relation TEXT,
  payment_method TEXT NOT NULL,
  bank_details TEXT NOT NULL DEFAULT '{}',
  data_privacy_consent INTEGER DEFAULT 0,
  statute_consent INTEGER DEFAULT 0,
  photo_consent INTEGER DEFAULT 0,
  health_confirmation INTEGER DEFAULT 0,
  applicant_signature TEXT,
  applicant_signature_date TEXT,
  guardian_signature TEXT,
  guardian_signature_date TEXT,
  sepa_signature TEXT,
  sepa_signature_date TEXT,
  pdf_data_url TEXT,
  custom_template_used INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_online_apps_status ON online_applications (status);

-- 19. APPLICATION_SETTINGS (Einstellungen Aufnahmeformular)
CREATE TABLE IF NOT EXISTS application_settings (
  id TEXT PRIMARY KEY DEFAULT 'main',
  club_logo_url TEXT,
  header_text TEXT,
  custom_pdf_template_data_url TEXT,
  custom_pdf_template_file_name TEXT,
  custom_pdf_template_uploaded_at TEXT,
  introductory_text TEXT,
  data_privacy_text TEXT,
  statute_text TEXT,
  default_fee_rules TEXT,
  require_photo_consent INTEGER DEFAULT 0,
  require_health_confirmation INTEGER DEFAULT 0,
  contact_email TEXT,
  notification_email TEXT,
  updated_at TEXT NOT NULL
);

-- 20. DASHBOARD_CONFIG (Individuelle Dashboard-Anordnung & Widgets)
CREATE TABLE IF NOT EXISTS dashboard_config (
  id TEXT PRIMARY KEY DEFAULT 'main_dashboard',
  config TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 21. LOCAL_USERS (Benutzerkonten dieses Servers, seit Stufe 2)
--
-- Angelehnt an AppUser (src/types.ts), dem Benutzertyp des Browser-Modus —
-- dieselben Feldnamen (name, custom_role_name, permissions, is_active,
-- last_login), nur ohne "username": Diese Installation meldet ausschließlich
-- über die E-Mail-Adresse an. "permissions" ist als JSON-Text schon
-- vorhanden, wird aber erst ab der Stufe zur Rechteprüfung ausgewertet.
CREATE TABLE IF NOT EXISTS local_users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  custom_role_name TEXT,
  permissions TEXT NOT NULL DEFAULT '{}',
  is_active INTEGER NOT NULL DEFAULT 1,
  must_change_password INTEGER NOT NULL DEFAULT 0,
  last_login TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_local_users_email ON local_users (email);

-- 22. LOCAL_SESSIONS (angemeldete Sitzungen, seit Stufe 2)
--
-- Bewusst ein einfacher Zufallscode als eigene Zeile statt eines signierten
-- Tokens (JWT o. Ä.) — Begründung in repositories/localSessions.ts.
CREATE TABLE IF NOT EXISTS local_sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES local_users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  last_used_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_local_sessions_user ON local_sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_local_sessions_expires ON local_sessions (expires_at);

-- 23. LOCAL_PASSWORD_RESETS ("Passwort vergessen"-Verknüpfungen)
--
-- Anders als bei local_sessions oben steht hier NICHT der Rohwert des
-- Tokens, sondern sein SHA-256-Streuwert (siehe
-- repositories/localPasswordResets.ts). Ein Sitzungscode verlässt den
-- Browser nie; ein Reset-Link dagegen geht per E-Mail hinaus und kann in
-- einem Postfach, einer Weiterleitung oder einer Mail-Datensicherung
-- landen, auf die diese Datenbank selbst keinen Einfluss hat — ihn
-- trotzdem nur als Streuwert abzulegen, kostet hier nichts und nimmt einer
-- ausgelesenen Datenbankdatei zumindest diesen einen Weg zum Konto.
CREATE TABLE IF NOT EXISTS local_password_resets (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES local_users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_local_password_resets_user ON local_password_resets (user_id);
CREATE INDEX IF NOT EXISTS idx_local_password_resets_expires ON local_password_resets (expires_at);
`;
