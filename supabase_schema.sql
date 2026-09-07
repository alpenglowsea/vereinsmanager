-- ==============================================================================
-- 🏛️ VEREINSMANAGER: SUPABASE / POSTGRESQL INITIALISIERUNGSSKRIPT
-- Erstellt alle Tabellen, Indizes und Sicherheitsregeln (RLS) für den Verein.
-- Empfohlene Cloud-Region: Frankfurt am Main (eu-central-1) für 100% DSGVO-Konformität
-- ==============================================================================

-- 1. TABELLE: SETTINGS (Vereinsdaten & Gläubiger-ID)
CREATE TABLE IF NOT EXISTS public.settings (
  id TEXT PRIMARY KEY DEFAULT 'main',
  club_name TEXT NOT NULL,
  association_number TEXT,
  tax_number TEXT,
  creditor_id TEXT,
  creditor_iban TEXT,
  creditor_bic TEXT,
  creditor_account_id TEXT,
  address TEXT,
  chairman TEXT,
  treasurer TEXT,
  email TEXT,
  departments JSONB DEFAULT '["Fußball", "Tennis", "Turnen", "Leichtathletik", "Schwimmen", "Volleyball"]'::jsonb,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. TABELLE: ACCOUNTS (Finanzkonten / Barkassen)
CREATE TABLE IF NOT EXISTS public.accounts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  account_type TEXT NOT NULL,
  iban TEXT,
  bic TEXT,
  initial_balance NUMERIC(12,2) DEFAULT 0.00 NOT NULL,
  color TEXT DEFAULT 'emerald',
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. TABELLE: MEMBERS (Mitgliederverwaltung)
CREATE TABLE IF NOT EXISTS public.members (
  id TEXT PRIMARY KEY,
  member_number TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  gender TEXT DEFAULT 'none',
  birth_date DATE,
  avatar_url TEXT,
  address JSONB NOT NULL DEFAULT '{"street":"","houseNumber":"","zip":"","city":"","country":"Deutschland"}'::jsonb,
  phone TEXT,
  email TEXT,
  entry_date DATE NOT NULL,
  exit_date DATE,
  status TEXT NOT NULL DEFAULT 'active',
  department TEXT NOT NULL,
  membership_type TEXT NOT NULL DEFAULT 'full',
  fee_amount NUMERIC(10,2) DEFAULT 0.00 NOT NULL,
  fee_period TEXT DEFAULT 'monthly',
  payment_method TEXT DEFAULT 'sepa',
  bank_details JSONB DEFAULT '{"iban":"","bic":"","bankName":"","accountHolder":"","mandateDate":"","mandateReference":""}'::jsonb,
  notes TEXT,
  data_privacy_consent BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_members_status ON public.members (status);
CREATE INDEX IF NOT EXISTS idx_members_department ON public.members (department);
CREATE INDEX IF NOT EXISTS idx_members_number ON public.members (member_number);

-- 4. TABELLE: TRANSACTIONS (Buchungsjournal / Kassenbuch)
CREATE TABLE IF NOT EXISTS public.transactions (
  id TEXT PRIMARY KEY,
  date DATE NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  type TEXT NOT NULL,
  account_id TEXT NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  target_account_id TEXT,
  document_number TEXT NOT NULL,
  booking_text TEXT NOT NULL,
  partner TEXT NOT NULL,
  sphere TEXT NOT NULL,
  main_category TEXT,
  sub_category TEXT,
  skr_account TEXT,
  category TEXT NOT NULL,
  vat_rate NUMERIC(4,1) DEFAULT 0.0,
  notes TEXT,
  receipt JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_transactions_date ON public.transactions (date);
CREATE INDEX IF NOT EXISTS idx_transactions_account ON public.transactions (account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_sphere ON public.transactions (sphere);

-- 5. TABELLE: INVENTORY (Vereinsinventar & Material)
CREATE TABLE IF NOT EXISTS public.inventory (
  id TEXT PRIMARY KEY,
  item_number TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  department TEXT NOT NULL,
  quantity INTEGER DEFAULT 1 NOT NULL,
  unit TEXT DEFAULT 'Stk.',
  location TEXT,
  condition TEXT DEFAULT 'good',
  purchase_date DATE,
  purchase_price NUMERIC(10,2),
  current_value NUMERIC(10,2),
  supplier TEXT,
  responsible_person TEXT,
  assigned_to TEXT,
  serial_number TEXT,
  notes TEXT,
  photo_url TEXT,
  last_checked_date DATE,
  next_inspection_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_inventory_department ON public.inventory (department);
CREATE INDEX IF NOT EXISTS idx_inventory_category ON public.inventory (category);

-- 6. TABELLE: SEPA_RUNS (SEPA-Lastschrift Historie)
CREATE TABLE IF NOT EXISTS public.sepa_runs (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  execution_date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  total_amount NUMERIC(12,2) NOT NULL,
  total_transactions INTEGER NOT NULL,
  period_filter TEXT NOT NULL,
  target_year INTEGER NOT NULL,
  target_month INTEGER,
  booked_to_account_id TEXT,
  is_booked BOOLEAN DEFAULT false,
  xml_content TEXT,
  items JSONB NOT NULL DEFAULT '[]'::jsonb
);

-- 7. TABELLE: AUDIT_LOGS (Revisionssicheres Änderungsprotokoll)
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id TEXT PRIMARY KEY,
  member_id TEXT NOT NULL,
  member_number TEXT NOT NULL,
  member_name TEXT NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  author TEXT NOT NULL,
  action TEXT NOT NULL,
  summary TEXT NOT NULL,
  changes JSONB DEFAULT '[]'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_member ON public.audit_logs (member_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON public.audit_logs (timestamp DESC);

-- 8. TABELLE: CONTACTS (Geschäftspartner, Lieferanten, Sponsoren, Spender)
CREATE TABLE IF NOT EXISTS public.contacts (
  id TEXT PRIMARY KEY,
  contact_number TEXT NOT NULL,
  person_type TEXT NOT NULL,
  types JSONB DEFAULT '[]'::jsonb,
  company_name TEXT,
  legal_form TEXT,
  contact_person JSONB,
  tax_id TEXT,
  commercial_register TEXT,
  salutation TEXT,
  first_name TEXT,
  last_name TEXT,
  date_of_birth DATE,
  display_name TEXT NOT NULL,
  address JSONB NOT NULL DEFAULT '{}'::jsonb,
  email TEXT,
  phone TEXT,
  mobile TEXT,
  website TEXT,
  bank_details JSONB DEFAULT '{}'::jsonb,
  creditor_or_debtor_number TEXT,
  notes TEXT,
  tags JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_contacts_display_name ON public.contacts (display_name);
CREATE INDEX IF NOT EXISTS idx_contacts_number ON public.contacts (contact_number);

-- 9. TABELLE: INVOICES (Rechnungswesen / Ausgangsrechnungen DIN 5008)
CREATE TABLE IF NOT EXISTS public.invoices (
  id TEXT PRIMARY KEY,
  invoice_number TEXT NOT NULL,
  date DATE NOT NULL,
  delivery_date DATE,
  due_date DATE NOT NULL,
  status TEXT NOT NULL,
  recipient_type TEXT NOT NULL,
  recipient_id TEXT,
  recipient_name TEXT NOT NULL,
  recipient_company TEXT,
  recipient_contact_person TEXT,
  recipient_address JSONB NOT NULL DEFAULT '{}'::jsonb,
  recipient_email TEXT,
  recipient_phone TEXT,
  title TEXT NOT NULL,
  subject TEXT NOT NULL,
  intro_text TEXT,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  outro_text TEXT,
  tax_sphere TEXT,
  subtotal_net NUMERIC(12,2) DEFAULT 0.00 NOT NULL,
  vat_amounts JSONB DEFAULT '{}'::jsonb,
  total_vat NUMERIC(12,2) DEFAULT 0.00 NOT NULL,
  total_amount NUMERIC(12,2) DEFAULT 0.00 NOT NULL,
  payment_terms_days INTEGER DEFAULT 14 NOT NULL,
  paid_at TIMESTAMP WITH TIME ZONE,
  payment_method TEXT,
  linked_transaction_id TEXT,
  document_id TEXT,
  custom_template_used BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.invoices (status);
CREATE INDEX IF NOT EXISTS idx_invoices_date ON public.invoices (date DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_number ON public.invoices (invoice_number);

-- 10. TABELLE: INVOICE_TEMPLATES (Briefpapier & DIN 5008 Rechnungsvorlagen)
CREATE TABLE IF NOT EXISTS public.invoice_templates (
  id TEXT PRIMARY KEY DEFAULT 'main_template',
  template_name TEXT NOT NULL,
  custom_blanko_data_url TEXT,
  custom_blanko_file_name TEXT,
  custom_blanko_uploaded_at TIMESTAMP WITH TIME ZONE,
  margin_top INTEGER DEFAULT 25,
  margin_bottom INTEGER DEFAULT 20,
  margin_left INTEGER DEFAULT 25,
  margin_right INTEGER DEFAULT 20,
  default_intro_text TEXT,
  default_outro_text TEXT,
  default_payment_terms_days INTEGER DEFAULT 14,
  default_due_notice TEXT,
  show_club_logo BOOLEAN DEFAULT true,
  show_folding_marks BOOLEAN DEFAULT true,
  show_giro_code BOOLEAN DEFAULT true,
  accent_color TEXT DEFAULT '#1e3a8a',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 11. TABELLE: MEETINGS (Sitzungsdienst & rechtssichere BGB-Protokolle)
CREATE TABLE IF NOT EXISTS public.meetings (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  type TEXT NOT NULL,
  status TEXT NOT NULL,
  protocol_type TEXT NOT NULL,
  date DATE NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT,
  location TEXT NOT NULL,
  chairperson TEXT NOT NULL,
  minute_keeper TEXT NOT NULL,
  invitation_date DATE,
  invitation_method TEXT,
  invitation_compliant BOOLEAN DEFAULT false,
  quorum_confirmed BOOLEAN DEFAULT false,
  total_eligible_voters INTEGER,
  agenda JSONB NOT NULL DEFAULT '[]'::jsonb,
  attendees JSONB NOT NULL DEFAULT '[]'::jsonb,
  general_notes TEXT,
  custom_template_used BOOLEAN DEFAULT false,
  signed_at TIMESTAMP WITH TIME ZONE,
  signatures JSONB DEFAULT '[]'::jsonb,
  document_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_meetings_date ON public.meetings (date DESC);
CREATE INDEX IF NOT EXISTS idx_meetings_status ON public.meetings (status);

-- 12. TABELLE: MEETING_TEMPLATES (Sitzungsvorlagen & Briefpapier)
CREATE TABLE IF NOT EXISTS public.meeting_templates (
  id TEXT PRIMARY KEY DEFAULT 'main_meeting_template',
  template_name TEXT NOT NULL,
  custom_blanko_data_url TEXT,
  custom_blanko_file_name TEXT,
  custom_blanko_uploaded_at TIMESTAMP WITH TIME ZONE,
  margin_top INTEGER DEFAULT 25,
  margin_bottom INTEGER DEFAULT 20,
  margin_left INTEGER DEFAULT 20,
  margin_right INTEGER DEFAULT 20,
  show_club_header BOOLEAN DEFAULT true,
  show_club_logo BOOLEAN DEFAULT true,
  show_signatures_block BOOLEAN DEFAULT true,
  show_register_extract_notice BOOLEAN DEFAULT true,
  accent_color TEXT DEFAULT '#e11d48',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 13. TABELLE: DONATIONS (Spenden & BMF-Zuwendungsbestätigungen)
CREATE TABLE IF NOT EXISTS public.donations (
  id TEXT PRIMARY KEY,
  receipt_number TEXT NOT NULL,
  type TEXT NOT NULL,
  date DATE NOT NULL,
  donor_type TEXT NOT NULL,
  member_id TEXT,
  donor_name TEXT NOT NULL,
  donor_address JSONB NOT NULL DEFAULT '{}'::jsonb,
  amount NUMERIC(12,2) NOT NULL,
  amount_in_words TEXT NOT NULL,
  is_waiver_of_refund BOOLEAN DEFAULT false,
  goods_description TEXT,
  goods_origin TEXT,
  goods_valuation_basis TEXT,
  tax_office TEXT NOT NULL,
  tax_number TEXT NOT NULL,
  exemption_date TEXT NOT NULL,
  assessment_period TEXT NOT NULL,
  promoted_purpose TEXT NOT NULL,
  is_directly_promoted BOOLEAN DEFAULT true,
  issued_by TEXT NOT NULL,
  city_and_date TEXT NOT NULL,
  transaction_id TEXT,
  document_id TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_donations_date ON public.donations (date DESC);
CREATE INDEX IF NOT EXISTS idx_donations_number ON public.donations (receipt_number);

-- 14. TABELLE: CALENDAR_EVENTS (Vereinskalender & Termine)
CREATE TABLE IF NOT EXISTS public.calendar_events (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  category_id TEXT NOT NULL,
  department TEXT,
  start_date DATE NOT NULL,
  start_time TEXT,
  end_date DATE NOT NULL,
  end_time TEXT,
  is_all_day BOOLEAN DEFAULT false,
  location TEXT,
  location_lat NUMERIC(10,7),
  location_lng NUMERIC(10,7),
  recurrence JSONB,
  participants JSONB DEFAULT '[]'::jsonb,
  max_participants INTEGER,
  color TEXT,
  created_by_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_calendar_events_start ON public.calendar_events (start_date);

-- 15. TABELLE: CALENDAR_CATEGORIES (Kategorien für Termine)
CREATE TABLE IF NOT EXISTS public.calendar_categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  badge_bg TEXT NOT NULL,
  badge_text TEXT NOT NULL,
  badge_border TEXT NOT NULL,
  icon TEXT,
  description TEXT,
  is_system BOOLEAN DEFAULT false
);

-- 16. TABELLE: DOCUMENTS (Dokumentenablage & Belegarchiv)
CREATE TABLE IF NOT EXISTS public.documents (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  data_url TEXT NOT NULL,
  category TEXT NOT NULL,
  folder_id TEXT,
  date DATE NOT NULL,
  upload_date TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  tags JSONB DEFAULT '[]'::jsonb,
  notes TEXT,
  transaction_id TEXT,
  transaction_doc_number TEXT,
  member_id TEXT,
  member_name TEXT,
  is_receipt BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_documents_category ON public.documents (category);
CREATE INDEX IF NOT EXISTS idx_documents_folder ON public.documents (folder_id);

-- 17. TABELLE: FOLDERS (Ordnerstruktur im Dokumentenarchiv)
CREATE TABLE IF NOT EXISTS public.folders (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  parent_id TEXT,
  category TEXT,
  color TEXT,
  icon TEXT,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 18. TABELLE: ONLINE_APPLICATIONS (Digitale Mitgliedsanträge)
CREATE TABLE IF NOT EXISTS public.online_applications (
  id TEXT PRIMARY KEY,
  application_number TEXT NOT NULL,
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  status TEXT NOT NULL,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewed_by TEXT,
  rejection_reason TEXT,
  created_member_id TEXT,
  created_member_number TEXT,
  generated_document_id TEXT,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  gender TEXT NOT NULL,
  birth_date DATE NOT NULL,
  nationality TEXT,
  phone TEXT NOT NULL,
  email TEXT NOT NULL,
  address JSONB NOT NULL DEFAULT '{}'::jsonb,
  department TEXT NOT NULL,
  membership_type TEXT NOT NULL,
  fee_amount NUMERIC(10,2),
  fee_period TEXT NOT NULL,
  entry_date DATE NOT NULL,
  notes TEXT,
  previous_club TEXT,
  is_minor BOOLEAN DEFAULT false,
  guardian_name TEXT,
  guardian_phone TEXT,
  guardian_email TEXT,
  guardian_address JSONB,
  guardian_relation TEXT,
  payment_method TEXT NOT NULL,
  bank_details JSONB NOT NULL DEFAULT '{}'::jsonb,
  data_privacy_consent BOOLEAN DEFAULT false,
  statute_consent BOOLEAN DEFAULT false,
  photo_consent BOOLEAN DEFAULT false,
  health_confirmation BOOLEAN DEFAULT false,
  applicant_signature TEXT,
  applicant_signature_date TIMESTAMP WITH TIME ZONE,
  guardian_signature TEXT,
  guardian_signature_date TIMESTAMP WITH TIME ZONE,
  sepa_signature TEXT,
  sepa_signature_date TIMESTAMP WITH TIME ZONE,
  pdf_data_url TEXT,
  custom_template_used BOOLEAN DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_online_apps_status ON public.online_applications (status);

-- 19. TABELLE: APPLICATION_SETTINGS (Einstellungen Aufnahmeformular)
CREATE TABLE IF NOT EXISTS public.application_settings (
  id TEXT PRIMARY KEY DEFAULT 'main',
  club_logo_url TEXT,
  header_text TEXT,
  custom_pdf_template_data_url TEXT,
  custom_pdf_template_file_name TEXT,
  custom_pdf_template_uploaded_at TIMESTAMP WITH TIME ZONE,
  introductory_text TEXT,
  data_privacy_text TEXT,
  statute_text TEXT,
  default_fee_rules JSONB,
  require_photo_consent BOOLEAN DEFAULT false,
  require_health_confirmation BOOLEAN DEFAULT false,
  contact_email TEXT,
  notification_email TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 20. TABELLE: DASHBOARD_CONFIG (Individuelle Dashboard-Anordnung & Widgets)
CREATE TABLE IF NOT EXISTS public.dashboard_config (
  id TEXT PRIMARY KEY DEFAULT 'main_dashboard',
  config JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) & BERECHTIGUNGEN
-- ==============================================================================

ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sepa_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.donations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.online_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.application_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dashboard_config ENABLE ROW LEVEL SECURITY;

-- Richtlinien für authentifizierte Benutzer (Vorstand)
CREATE POLICY "Vorstand Lese- und Schreibzugriff Settings" ON public.settings FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Vorstand Lese- und Schreibzugriff Accounts" ON public.accounts FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Vorstand Lese- und Schreibzugriff Members" ON public.members FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Vorstand Lese- und Schreibzugriff Transactions" ON public.transactions FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Vorstand Lese- und Schreibzugriff Inventory" ON public.inventory FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Vorstand Lese- und Schreibzugriff SepaRuns" ON public.sepa_runs FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Vorstand Lese- und Schreibzugriff AuditLogs" ON public.audit_logs FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Vorstand Lese- und Schreibzugriff Contacts" ON public.contacts FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Vorstand Lese- und Schreibzugriff Invoices" ON public.invoices FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Vorstand Lese- und Schreibzugriff InvoiceTemplates" ON public.invoice_templates FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Vorstand Lese- und Schreibzugriff Meetings" ON public.meetings FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Vorstand Lese- und Schreibzugriff MeetingTemplates" ON public.meeting_templates FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Vorstand Lese- und Schreibzugriff Donations" ON public.donations FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Vorstand Lese- und Schreibzugriff CalendarEvents" ON public.calendar_events FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Vorstand Lese- und Schreibzugriff CalendarCategories" ON public.calendar_categories FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Vorstand Lese- und Schreibzugriff Documents" ON public.documents FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Vorstand Lese- und Schreibzugriff Folders" ON public.folders FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Vorstand Lese- und Schreibzugriff OnlineApplications" ON public.online_applications FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Vorstand Lese- und Schreibzugriff ApplicationSettings" ON public.application_settings FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Vorstand Lese- und Schreibzugriff DashboardConfig" ON public.dashboard_config FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- Richtlinien für Anon-Key (Public Access für Team mit gemeinsamem Schlüssel)
CREATE POLICY "Anon Lese- und Schreibzugriff Settings" ON public.settings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Anon Lese- und Schreibzugriff Accounts" ON public.accounts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Anon Lese- und Schreibzugriff Members" ON public.members FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Anon Lese- und Schreibzugriff Transactions" ON public.transactions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Anon Lese- und Schreibzugriff Inventory" ON public.inventory FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Anon Lese- und Schreibzugriff SepaRuns" ON public.sepa_runs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Anon Lese- und Schreibzugriff AuditLogs" ON public.audit_logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Anon Lese- und Schreibzugriff Contacts" ON public.contacts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Anon Lese- und Schreibzugriff Invoices" ON public.invoices FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Anon Lese- und Schreibzugriff InvoiceTemplates" ON public.invoice_templates FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Anon Lese- und Schreibzugriff Meetings" ON public.meetings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Anon Lese- und Schreibzugriff MeetingTemplates" ON public.meeting_templates FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Anon Lese- und Schreibzugriff Donations" ON public.donations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Anon Lese- und Schreibzugriff CalendarEvents" ON public.calendar_events FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Anon Lese- und Schreibzugriff CalendarCategories" ON public.calendar_categories FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Anon Lese- und Schreibzugriff Documents" ON public.documents FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Anon Lese- und Schreibzugriff Folders" ON public.folders FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Anon Lese- und Schreibzugriff OnlineApplications" ON public.online_applications FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Anon Lese- und Schreibzugriff ApplicationSettings" ON public.application_settings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Anon Lese- und Schreibzugriff DashboardConfig" ON public.dashboard_config FOR ALL USING (true) WITH CHECK (true);
