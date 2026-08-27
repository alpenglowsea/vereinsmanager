import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { SupabaseConfig, UserAuthSession } from '../types';

const STORAGE_KEY_URL = 'vm_supabase_url';
const STORAGE_KEY_KEY = 'vm_supabase_anon_key';
const STORAGE_KEY_MODE = 'vm_deployment_mode';

let clientInstance: SupabaseClient | null = null;
let currentConfigKey = '';

export function getStoredSupabaseConfig(): SupabaseConfig {
  const envUrl = (import.meta as any).env?.VITE_SUPABASE_URL || '';
  const envKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '';

  const storedUrl = localStorage.getItem(STORAGE_KEY_URL) || envUrl;
  const storedKey = localStorage.getItem(STORAGE_KEY_KEY) || envKey;

  return {
    url: storedUrl.trim(),
    anonKey: storedKey.trim(),
    isConfigured: Boolean(storedUrl.trim() && storedKey.trim())
  };
}

export function saveStoredSupabaseConfig(url: string, anonKey: string): void {
  const cleanUrl = url.trim();
  const cleanKey = anonKey.trim();

  localStorage.setItem(STORAGE_KEY_URL, cleanUrl);
  localStorage.setItem(STORAGE_KEY_KEY, cleanKey);
  clientInstance = null; // Reset cached client
}

export function clearStoredSupabaseConfig(): void {
  localStorage.removeItem(STORAGE_KEY_URL);
  localStorage.removeItem(STORAGE_KEY_KEY);
  clientInstance = null;
}

export function getSupabaseClient(): SupabaseClient | null {
  const config = getStoredSupabaseConfig();
  if (!config.isConfigured) {
    return null;
  }

  const cacheKey = `${config.url}:::${config.anonKey}`;
  if (clientInstance && currentConfigKey === cacheKey) {
    return clientInstance;
  }

  try {
    clientInstance = createClient(config.url, config.anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    });
    currentConfigKey = cacheKey;
    return clientInstance;
  } catch (err) {
    console.error('Fehler beim Initialisieren des Supabase-Clients:', err);
    return null;
  }
}

export async function testSupabaseConnection(url?: string, anonKey?: string): Promise<{ success: boolean; error?: string }> {
  const targetUrl = (url || getStoredSupabaseConfig().url).trim();
  const targetKey = (anonKey || getStoredSupabaseConfig().anonKey).trim();

  if (!targetUrl || !targetKey) {
    return { success: false, error: 'Supabase URL und Anon Key dürfen nicht leer sein.' };
  }

  if (!targetUrl.startsWith('https://')) {
    return { success: false, error: 'Die Supabase-URL muss mit https:// beginnen (z.B. https://xyzcompany.supabase.co).' };
  }

  try {
    const testClient = createClient(targetUrl, targetKey, {
      auth: { persistSession: false }
    });

    // Test a lightweight query on settings or auth
    const { error } = await testClient.from('settings').select('id').limit(1);

    if (error) {
      // If table doesn't exist yet, it still reached Supabase (PGRST116 or 42P01 is table not found, which means connection succeeded)
      if (error.code === '42P01' || error.message.includes('relation') || error.message.includes('does not exist')) {
        return {
          success: true,
          error: 'Verbindung erfolgreich! Tabellen müssen noch im Supabase SQL Editor angelegt werden (siehe Skript unten).'
        };
      }
      return { success: false, error: error.message || 'Verbindung fehlgeschlagen' };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Netzwerkfehler beim Verbindungstest zu Supabase.' };
  }
}

// Authentication Helpers
export async function getAuthSession(): Promise<UserAuthSession> {
  const client = getSupabaseClient();
  if (!client) {
    return { user: null, isAuthenticated: false };
  }

  try {
    const { data: { session }, error } = await client.auth.getSession();
    if (error || !session || !session.user) {
      return { user: null, isAuthenticated: false };
    }

    return {
      user: {
        id: session.user.id,
        username: session.user.email?.split('@')[0] || 'clouduser',
        email: session.user.email || '',
        name: session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'Cloud-Benutzer',
        password: '',
        customRoleName: session.user.user_metadata?.role || 'Cloud-Benutzer',
        permissions: {
          canViewMembers: true,
          canEditMembers: true,
          canViewFinances: true,
          canEditFinances: true,
          canExecuteSepa: true,
          canManageDonations: true,
          canManageDocuments: true,
          canManageInventory: true,
          canManageSettings: true,
          canManageUsers: true
        },
        isActive: true,
        createdAt: session.user.created_at || new Date().toISOString(),
        lastLogin: session.user.last_sign_in_at
      },
      isAuthenticated: true
    };
  } catch (err) {
    return { user: null, isAuthenticated: false };
  }
}

export async function signInUser(email: string, password: string): Promise<{ success: boolean; error?: string }> {
  const client = getSupabaseClient();
  if (!client) return { success: false, error: 'Supabase ist noch nicht konfiguriert.' };

  try {
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Anmeldung fehlgeschlagen' };
  }
}

export async function signUpUser(
  email: string,
  password: string,
  role: string = 'Vorstand',
  clubName: string = 'Mein Verein'
): Promise<{ success: boolean; error?: string; message?: string }> {
  const client = getSupabaseClient();
  if (!client) return { success: false, error: 'Supabase ist noch nicht konfiguriert.' };

  try {
    const { data, error } = await client.auth.signUp({
      email,
      password,
      options: {
        data: {
          role,
          club_name: clubName
        }
      }
    });

    if (error) return { success: false, error: error.message };
    
    if (data.user && !data.session) {
      return {
        success: true,
        message: 'Registrierung erfolgreich! Bitte prüfen Sie Ihre E-Mails zur Bestätigung des Kontos.'
      };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Registrierung fehlgeschlagen' };
  }
}

export async function signOutUser(): Promise<void> {
  const client = getSupabaseClient();
  if (client) {
    await client.auth.signOut();
  }
}

export async function sendPasswordReset(email: string): Promise<{ success: boolean; error?: string }> {
  const client = getSupabaseClient();
  if (!client) return { success: false, error: 'Supabase ist noch nicht konfiguriert.' };

  try {
    const { error } = await client.auth.resetPasswordForEmail(email);
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Vollständiges PostgreSQL / Supabase Schema für den VereinsManager.
 * Kann mit 1 Klick kopiert und im Supabase SQL Editor ausgeführt werden.
 */
export const SUPABASE_SCHEMA_SQL = `-- ==============================================================================
-- VEREINSMANAGER: SUPABASE / POSTGRESQL INITIALISIERUNGSSKRIPT
-- Erstellt alle Tabellen, Indizes und Sicherheitsregeln (RLS) für den Verein.
-- Region-Empfehlung: Frankfurt am Main (eu-central-1) für 100% DSGVO-Konformität
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

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) & BERECHTIGUNGEN
-- Ermöglicht authentifizierten Vorstandsmitgliedern Lese- und Schreibzugriff
-- ==============================================================================

ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sepa_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Richtlinien für authentifizierte Benutzer (Vorstand)
CREATE POLICY "Vorstand Lese- und Schreibzugriff Settings" ON public.settings FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Vorstand Lese- und Schreibzugriff Accounts" ON public.accounts FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Vorstand Lese- und Schreibzugriff Members" ON public.members FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Vorstand Lese- und Schreibzugriff Transactions" ON public.transactions FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Vorstand Lese- und Schreibzugriff Inventory" ON public.inventory FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Vorstand Lese- und Schreibzugriff SepaRuns" ON public.sepa_runs FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Vorstand Lese- und Schreibzugriff AuditLogs" ON public.audit_logs FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- Richtlinien für Anon-Key (falls Vorstand ohne separaten Einzel-Login mit Team-Schlüssel arbeitet)
CREATE POLICY "Anon Lese- und Schreibzugriff Settings" ON public.settings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Anon Lese- und Schreibzugriff Accounts" ON public.accounts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Anon Lese- und Schreibzugriff Members" ON public.members FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Anon Lese- und Schreibzugriff Transactions" ON public.transactions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Anon Lese- und Schreibzugriff Inventory" ON public.inventory FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Anon Lese- und Schreibzugriff SepaRuns" ON public.sepa_runs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Anon Lese- und Schreibzugriff AuditLogs" ON public.audit_logs FOR ALL USING (true) WITH CHECK (true);
`;
