-- ==============================================================================
-- VEREINSMANAGER: ZUGRIFFSSCHUTZ FÜR DIE CLOUD-DATENBANK (Row Level Security)
-- ==============================================================================
--
-- WAS DIESES SKRIPT TUT
--
-- Bis hierher galt in der Datenbank die Regel "USING (true)" — übersetzt:
-- jeder, der den öffentlichen Schlüssel der Datenbank kennt, durfte alle
-- Tabellen lesen UND schreiben. Dieser Schlüssel steht im Browser jedes
-- Anwenders und ist damit kein Geheimnis. Mitgliederdaten samt Anschrift,
-- Geburtsdatum und IBAN, das Kassenbuch und sogar das Änderungsprotokoll
-- waren so ohne jede Anmeldung erreichbar.
--
-- Nach diesem Skript gilt:
--   * Ohne Anmeldung ist keine Tabelle mehr lesbar oder schreibbar.
--     Einzige Ausnahme: Ein Aufnahmeantrag darf eingereicht werden —
--     eingereicht, nicht gelesen, nicht geändert, nicht gelöscht.
--   * Angemeldete Benutzer sehen und ändern nur die Bereiche, für die
--     ihre Rechte das hergeben. Diese Prüfung läuft im Server, nicht im
--     Browser — sie lässt sich mit Entwicklerwerkzeugen nicht umgehen.
--   * Das Änderungsprotokoll (audit_logs) kann geschrieben, aber von
--     niemandem mehr geändert oder gelöscht werden. Ein Protokoll, das
--     der Beschuldigte bereinigen kann, ist für eine Kassenprüfung
--     wertlos.
--
-- AUSFÜHREN
--
-- Supabase-Projekt öffnen -> SQL Editor -> New query -> Inhalt einfügen
-- -> Run. Das Skript ist wiederholbar: Ein zweiter Durchlauf richtet
-- keinen Schaden an. Bestehende Daten werden nicht angefasst.
--
-- DANACH NICHT VERGESSEN: Abschnitt 7 ganz unten legt den ersten
-- Benutzer an. Ohne diesen Schritt kommt niemand mehr an die Daten —
-- auch nicht der Vorstand.
-- ==============================================================================


-- ==============================================================================
-- 1. TABELLE DER VEREINSBENUTZER
-- ==============================================================================
--
-- Die Anmeldedaten selbst verwaltet Supabase (Tabelle auth.users, Passwörter
-- verschlüsselt). Hier steht nur, WER WAS DARF. Ein Eintrag je Person.

CREATE TABLE IF NOT EXISTS public.club_users (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  role_name TEXT NOT NULL DEFAULT 'Benutzer',
  -- Rechte je Menüpunkt, z. B. {"members":"edit","finance":"view", ...}
  permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now())
);

COMMENT ON TABLE public.club_users IS
  'Rechte je Vereinsbenutzer. Die Anmeldung selbst liegt in auth.users.';


-- ==============================================================================
-- 2. HILFSFUNKTIONEN
-- ==============================================================================
--
-- SECURITY DEFINER ist hier notwendig und kein Versehen: Die Funktion muss
-- club_users lesen dürfen, während sie gerade entscheidet, ob club_users
-- gelesen werden darf. Ohne diesen Zusatz würde sich die Prüfung selbst
-- blockieren. SET search_path verhindert, dass jemand der Funktion eine
-- eigene, untergeschobene Tabelle unterschiebt.

CREATE OR REPLACE FUNCTION public.vm_permissions()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
  SELECT COALESCE(
    (SELECT cu.permissions
       FROM public.club_users cu
      WHERE cu.user_id = auth.uid()
        AND cu.is_active),
    '{}'::jsonb
  );
$fn$;

-- Ist der Anmelder überhaupt ein freigeschalteter Vereinsbenutzer?
CREATE OR REPLACE FUNCTION public.vm_is_member()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
  SELECT EXISTS (
    SELECT 1 FROM public.club_users cu
     WHERE cu.user_id = auth.uid() AND cu.is_active
  );
$fn$;

-- Darf dieser Bereich angesehen werden?
CREATE OR REPLACE FUNCTION public.vm_can_view(area TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
  SELECT COALESCE(public.vm_permissions() ->> area, 'none') IN ('view', 'edit');
$fn$;

-- Darf in diesem Bereich geändert werden?
CREATE OR REPLACE FUNCTION public.vm_can_edit(area TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
  SELECT COALESCE(public.vm_permissions() ->> area, 'none') = 'edit';
$fn$;

-- Manche Tabellen werden von mehreren Bereichen gebraucht: Die Mitgliederliste
-- etwa auch vom SEPA-Lauf und von den Rechnungen. Hier genügt einer der
-- genannten Bereiche.
CREATE OR REPLACE FUNCTION public.vm_can_view_any(areas TEXT[])
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
  SELECT EXISTS (
    SELECT 1
      FROM unnest(areas) AS a
     WHERE COALESCE(public.vm_permissions() ->> a, 'none') IN ('view', 'edit')
  );
$fn$;

-- Vollzugriff als fertiger Wert — für das Anlegen des ersten Benutzers.
-- Auswertungsbereiche stehen auf 'view', weil es dort nichts zu ändern gibt.
CREATE OR REPLACE FUNCTION public.vm_full_permissions()
RETURNS JSONB
LANGUAGE sql
IMMUTABLE
AS $fn$
  SELECT '{
    "dashboard": "view",
    "members": "edit",
    "online_applications": "edit",
    "member_analytics": "view",
    "member_surveys": "edit",
    "finance": "edit",
    "sepa": "edit",
    "invoices": "edit",
    "donations": "edit",
    "guv": "view",
    "finance_analytics": "view",
    "contacts": "edit",
    "calendar": "edit",
    "meetings": "edit",
    "inventory": "edit",
    "documents": "edit",
    "settings": "edit",
    "users": "edit"
  }'::jsonb;
$fn$;


-- ==============================================================================
-- 3. ALTE RICHTLINIEN ENTFERNEN
-- ==============================================================================
--
-- Richtlinien werden ODER-verknüpft: Eine einzige verbliebene Regel mit
-- "USING (true)" würde alle folgenden Einschränkungen aushebeln. Deshalb
-- wird hier alles Vorhandene auf diesen Tabellen entfernt, auch Regeln mit
-- Namen, die dieses Skript nicht kennt.

DO $cleanup$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname
      FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename IN (
         'settings', 'accounts', 'members', 'transactions', 'inventory',
         'sepa_runs', 'audit_logs', 'contacts', 'invoices', 'invoice_templates',
         'meetings', 'meeting_templates', 'donations', 'calendar_events',
         'calendar_categories', 'documents', 'folders', 'online_applications',
         'application_settings', 'dashboard_config', 'club_users',
         'club_invitations'
       )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I',
                   r.policyname, r.schemaname, r.tablename);
  END LOOP;
END
$cleanup$;


-- ==============================================================================
-- 4. ZUGRIFFSSCHUTZ EINSCHALTEN
-- ==============================================================================
--
-- Ohne diesen Schritt bleiben die Richtlinien wirkungslos.

ALTER TABLE public.settings             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.members              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sepa_runs            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_templates    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meetings             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_templates    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.donations            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_events      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_categories  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.folders              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.online_applications  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.application_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dashboard_config     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_users           ENABLE ROW LEVEL SECURITY;


-- ==============================================================================
-- 5. RICHTLINIEN JE TABELLE
-- ==============================================================================
--
-- Aufbau: eine Regel fürs Lesen, eine fürs Schreiben. "TO authenticated"
-- bedeutet: gilt nur für angemeldete Benutzer. Nicht angemeldete Besucher
-- erhalten keine einzige Regel und damit keinen Zugriff — mit der einen
-- Ausnahme beim Aufnahmeantrag weiter unten.

-- --- Vereinsstammdaten --------------------------------------------------
-- Lesbar für jeden Vereinsbenutzer: Vereinsname und Anschrift stehen auf
-- jedem Ausdruck, jeder Rechnung und jeder Bescheinigung.
CREATE POLICY "settings lesen" ON public.settings
  FOR SELECT TO authenticated USING (public.vm_is_member());
CREATE POLICY "settings schreiben" ON public.settings
  FOR ALL TO authenticated
  USING (public.vm_can_edit('settings'))
  WITH CHECK (public.vm_can_edit('settings'));

-- --- Konten -------------------------------------------------------------
CREATE POLICY "accounts lesen" ON public.accounts
  FOR SELECT TO authenticated
  USING (public.vm_can_view_any(ARRAY['finance', 'guv', 'finance_analytics', 'sepa', 'donations', 'invoices']));
CREATE POLICY "accounts schreiben" ON public.accounts
  FOR ALL TO authenticated
  USING (public.vm_can_edit('finance'))
  WITH CHECK (public.vm_can_edit('finance'));

-- --- Mitglieder ---------------------------------------------------------
-- Die Mitgliederliste braucht auch der Beitragseinzug (Zahlungspflichtige),
-- die Rechnung (Empfänger), der Kalender (Geburtstage), das Inventar
-- (Ausgabe) und der Sitzungsdienst (Teilnehmer). Wer keinen dieser
-- Bereiche hat, bekommt keine Mitgliederdaten zu sehen.
CREATE POLICY "members lesen" ON public.members
  FOR SELECT TO authenticated
  USING (public.vm_can_view_any(ARRAY['members', 'member_analytics', 'online_applications', 'member_surveys', 'sepa', 'invoices', 'inventory', 'meetings', 'calendar']));
CREATE POLICY "members schreiben" ON public.members
  FOR ALL TO authenticated
  USING (public.vm_can_edit('members'))
  WITH CHECK (public.vm_can_edit('members'));

-- --- Buchungen ----------------------------------------------------------
CREATE POLICY "transactions lesen" ON public.transactions
  FOR SELECT TO authenticated
  USING (public.vm_can_view_any(ARRAY['finance', 'guv', 'finance_analytics', 'sepa', 'donations', 'invoices']));
CREATE POLICY "transactions schreiben" ON public.transactions
  FOR ALL TO authenticated
  USING (public.vm_can_edit('finance'))
  WITH CHECK (public.vm_can_edit('finance'));

-- --- Inventar -----------------------------------------------------------
CREATE POLICY "inventory lesen" ON public.inventory
  FOR SELECT TO authenticated
  USING (public.vm_can_view_any(ARRAY['inventory', 'members']));
CREATE POLICY "inventory schreiben" ON public.inventory
  FOR ALL TO authenticated
  USING (public.vm_can_edit('inventory'))
  WITH CHECK (public.vm_can_edit('inventory'));

-- --- SEPA-Läufe ---------------------------------------------------------
CREATE POLICY "sepa_runs lesen" ON public.sepa_runs
  FOR SELECT TO authenticated USING (public.vm_can_view('sepa'));
CREATE POLICY "sepa_runs schreiben" ON public.sepa_runs
  FOR ALL TO authenticated
  USING (public.vm_can_edit('sepa'))
  WITH CHECK (public.vm_can_edit('sepa'));

-- --- Änderungsprotokoll -------------------------------------------------
-- Absichtlich OHNE Regel für UPDATE und DELETE: Was einmal protokolliert
-- ist, bleibt stehen. Auch für den Vorstand. Ein Protokoll, das sich
-- nachträglich glätten lässt, taugt bei einer Kassenprüfung nichts.
-- Löschen ist nur über das Supabase-Dashboard möglich (Dienstschlüssel) —
-- zum Beispiel, wenn ein Mitglied nach Art. 17 DSGVO Löschung verlangt.
CREATE POLICY "audit_logs lesen" ON public.audit_logs
  FOR SELECT TO authenticated USING (public.vm_can_view('members'));
CREATE POLICY "audit_logs schreiben" ON public.audit_logs
  FOR INSERT TO authenticated WITH CHECK (public.vm_is_member());

-- --- Kontakte -----------------------------------------------------------
CREATE POLICY "contacts lesen" ON public.contacts
  FOR SELECT TO authenticated
  USING (public.vm_can_view_any(ARRAY['contacts', 'invoices', 'finance', 'donations']));
CREATE POLICY "contacts schreiben" ON public.contacts
  FOR ALL TO authenticated
  USING (public.vm_can_edit('contacts'))
  WITH CHECK (public.vm_can_edit('contacts'));

-- --- Rechnungen ---------------------------------------------------------
CREATE POLICY "invoices lesen" ON public.invoices
  FOR SELECT TO authenticated
  USING (public.vm_can_view_any(ARRAY['invoices', 'finance', 'guv', 'finance_analytics']));
CREATE POLICY "invoices schreiben" ON public.invoices
  FOR ALL TO authenticated
  USING (public.vm_can_edit('invoices'))
  WITH CHECK (public.vm_can_edit('invoices'));

CREATE POLICY "invoice_templates lesen" ON public.invoice_templates
  FOR SELECT TO authenticated USING (public.vm_can_view('invoices'));
CREATE POLICY "invoice_templates schreiben" ON public.invoice_templates
  FOR ALL TO authenticated
  USING (public.vm_can_edit('invoices'))
  WITH CHECK (public.vm_can_edit('invoices'));

-- --- Sitzungen ----------------------------------------------------------
CREATE POLICY "meetings lesen" ON public.meetings
  FOR SELECT TO authenticated USING (public.vm_can_view('meetings'));
CREATE POLICY "meetings schreiben" ON public.meetings
  FOR ALL TO authenticated
  USING (public.vm_can_edit('meetings'))
  WITH CHECK (public.vm_can_edit('meetings'));

CREATE POLICY "meeting_templates lesen" ON public.meeting_templates
  FOR SELECT TO authenticated USING (public.vm_can_view('meetings'));
CREATE POLICY "meeting_templates schreiben" ON public.meeting_templates
  FOR ALL TO authenticated
  USING (public.vm_can_edit('meetings'))
  WITH CHECK (public.vm_can_edit('meetings'));

-- --- Zuwendungsbestätigungen -------------------------------------------
CREATE POLICY "donations lesen" ON public.donations
  FOR SELECT TO authenticated
  USING (public.vm_can_view_any(ARRAY['donations', 'finance', 'guv']));
CREATE POLICY "donations schreiben" ON public.donations
  FOR ALL TO authenticated
  USING (public.vm_can_edit('donations'))
  WITH CHECK (public.vm_can_edit('donations'));

-- --- Kalender -----------------------------------------------------------
CREATE POLICY "calendar_events lesen" ON public.calendar_events
  FOR SELECT TO authenticated USING (public.vm_can_view('calendar'));
CREATE POLICY "calendar_events schreiben" ON public.calendar_events
  FOR ALL TO authenticated
  USING (public.vm_can_edit('calendar'))
  WITH CHECK (public.vm_can_edit('calendar'));

CREATE POLICY "calendar_categories lesen" ON public.calendar_categories
  FOR SELECT TO authenticated USING (public.vm_can_view('calendar'));
CREATE POLICY "calendar_categories schreiben" ON public.calendar_categories
  FOR ALL TO authenticated
  USING (public.vm_can_edit('calendar'))
  WITH CHECK (public.vm_can_edit('calendar'));

-- --- Dokumente ----------------------------------------------------------
-- Im Archiv liegen Belege zu Buchungen, Rechnungen, Spenden und Sitzungen.
CREATE POLICY "documents lesen" ON public.documents
  FOR SELECT TO authenticated
  USING (public.vm_can_view_any(ARRAY['documents', 'members', 'finance', 'invoices', 'donations', 'meetings']));
CREATE POLICY "documents schreiben" ON public.documents
  FOR ALL TO authenticated
  USING (public.vm_can_edit('documents'))
  WITH CHECK (public.vm_can_edit('documents'));

CREATE POLICY "folders lesen" ON public.folders
  FOR SELECT TO authenticated USING (public.vm_can_view('documents'));
CREATE POLICY "folders schreiben" ON public.folders
  FOR ALL TO authenticated
  USING (public.vm_can_edit('documents'))
  WITH CHECK (public.vm_can_edit('documents'));

-- --- Online-Aufnahmeanträge --------------------------------------------
CREATE POLICY "online_applications lesen" ON public.online_applications
  FOR SELECT TO authenticated USING (public.vm_can_view('online_applications'));
CREATE POLICY "online_applications schreiben" ON public.online_applications
  FOR ALL TO authenticated
  USING (public.vm_can_edit('online_applications'))
  WITH CHECK (public.vm_can_edit('online_applications'));

-- Die eine Ausnahme für nicht angemeldete Besucher: Ein Antrag darf
-- eingereicht werden. Nur eingereicht — es gibt bewusst keine Lese-,
-- Änderungs- oder Löschregel für anon, auch nicht für den eigenen Antrag.
-- Die Bedingung stellt zusätzlich sicher, dass niemand sich selbst einen
-- bereits genehmigten Antrag in die Datenbank legt.
CREATE POLICY "online_applications einreichen" ON public.online_applications
  FOR INSERT TO anon
  WITH CHECK (
    status = 'pending'
    AND reviewed_at IS NULL
    AND reviewed_by IS NULL
    AND created_member_id IS NULL
  );

CREATE POLICY "application_settings lesen" ON public.application_settings
  FOR SELECT TO authenticated USING (public.vm_is_member());
CREATE POLICY "application_settings schreiben" ON public.application_settings
  FOR ALL TO authenticated
  USING (public.vm_can_edit('online_applications'))
  WITH CHECK (public.vm_can_edit('online_applications'));

-- --- Anordnung der Kacheln ---------------------------------------------
-- Reine Ansichtssache, keine Vereinsdaten.
CREATE POLICY "dashboard_config lesen" ON public.dashboard_config
  FOR SELECT TO authenticated USING (public.vm_is_member());
CREATE POLICY "dashboard_config schreiben" ON public.dashboard_config
  FOR ALL TO authenticated
  USING (public.vm_is_member())
  WITH CHECK (public.vm_is_member());

-- --- Benutzer und Rechte ------------------------------------------------
-- Jeder darf den eigenen Eintrag lesen — die Anwendung braucht ihn, um zu
-- wissen, welche Menüpunkte sie anzeigen darf. Fremde Einträge sieht nur,
-- wer die Benutzerverwaltung einsehen darf.
CREATE POLICY "club_users lesen" ON public.club_users
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.vm_can_view('users'));
CREATE POLICY "club_users schreiben" ON public.club_users
  FOR ALL TO authenticated
  USING (public.vm_can_edit('users'))
  WITH CHECK (public.vm_can_edit('users'));


-- ==============================================================================
-- 6. TABELLEN- UND FUNKTIONSRECHTE
-- ==============================================================================
--
-- Zweites Schloss neben den Richtlinien. Die Richtlinien oben regeln, WELCHE
-- ZEILEN jemand sieht; die folgenden Rechte regeln, ob er die Tabelle
-- überhaupt anfassen darf. Sollte irgendwann versehentlich wieder eine zu
-- großzügige Richtlinie entstehen, greift immer noch dieses zweite Schloss.
--
-- "anon" ist die Rolle für Besucher ohne Anmeldung.

REVOKE ALL ON public.settings, public.accounts, public.members,
  public.transactions, public.inventory, public.sepa_runs, public.audit_logs,
  public.contacts, public.invoices, public.invoice_templates, public.meetings,
  public.meeting_templates, public.donations, public.calendar_events,
  public.calendar_categories, public.documents, public.folders,
  public.online_applications, public.application_settings,
  public.dashboard_config, public.club_users
  FROM anon;

-- Die eine erlaubte Handlung ohne Anmeldung: einen Antrag einreichen.
GRANT INSERT ON public.online_applications TO anon;

-- Angemeldete Benutzer dürfen die Tabellen ansprechen; was sie dann
-- tatsächlich sehen und ändern, entscheiden die Richtlinien oben.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.club_users TO authenticated;

-- PostgreSQL gibt neue Funktionen standardmässig für ALLE frei, auch für
-- nicht angemeldete Besucher. Das wird hier zurückgenommen und einzeln
-- wieder vergeben.
REVOKE EXECUTE ON FUNCTION public.vm_permissions()        FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.vm_is_member()          FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.vm_can_view(TEXT)       FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.vm_can_edit(TEXT)       FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.vm_can_view_any(TEXT[]) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.vm_full_permissions()   FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.vm_permissions()          TO authenticated;
GRANT EXECUTE ON FUNCTION public.vm_is_member()            TO authenticated;
GRANT EXECUTE ON FUNCTION public.vm_can_view(TEXT)         TO authenticated;
GRANT EXECUTE ON FUNCTION public.vm_can_edit(TEXT)         TO authenticated;
GRANT EXECUTE ON FUNCTION public.vm_can_view_any(TEXT[])   TO authenticated;
GRANT EXECUTE ON FUNCTION public.vm_full_permissions()     TO authenticated;


-- ==============================================================================
-- 7. EINRICHTUNGSCODE FÜR DEN ERSTEN BENUTZER
-- ==============================================================================
--
-- Der erste Vorstand soll sich im Programm registrieren können, ohne hier im
-- Dashboard Hand anzulegen. Damit in dieser Zeit nicht ein Fremder den Platz
-- besetzt, verlangt die Registrierung einen Einrichtungscode.
--
-- Der Code wird beim ersten Durchlauf dieses Skripts einmal erzeugt und ganz
-- unten angezeigt. Er gilt genau einmal: Sobald sich der erste Benutzer
-- eingetragen hat, ist er verbraucht.

CREATE TABLE IF NOT EXISTS public.club_setup (
  id TEXT PRIMARY KEY DEFAULT 'main',
  setup_code TEXT NOT NULL,
  code_used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.club_setup ENABLE ROW LEVEL SECURITY;

-- Absichtlich OHNE jede Richtlinie: Auf diese Tabelle kommt niemand direkt,
-- auch kein angemeldeter Benutzer. Nur die Prüffunktion unten darf hinein.
REVOKE ALL ON public.club_setup FROM anon, authenticated;

-- Code erzeugen, aber nur beim allerersten Durchlauf.
INSERT INTO public.club_setup (id, setup_code)
SELECT 'main',
       upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 4) || '-' ||
             substr(replace(gen_random_uuid()::text, '-', ''), 1, 4) || '-' ||
             substr(replace(gen_random_uuid()::text, '-', ''), 1, 4))
 WHERE NOT EXISTS (SELECT 1 FROM public.club_setup);


-- Steht die Einrichtung noch aus? Diese Auskunft darf jeder einholen; sie
-- verrät nur, ob der Verein schon einen Benutzer hat, und steuert, was das
-- Anmeldefenster anbietet.
CREATE OR REPLACE FUNCTION public.vm_setup_pending()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
  SELECT NOT EXISTS (SELECT 1 FROM public.club_users);
$fn$;


/**
 * Den ersten Benutzer eintragen.
 *
 * Gibt eine Klartextmeldung zurück statt einen Fehler zu werfen, damit das
 * Programm dem Anwender sagen kann, woran es lag. Mögliche Rückgaben:
 * 'ok', 'nicht angemeldet', 'falscher code', 'bereits eingerichtet'.
 */
CREATE OR REPLACE FUNCTION public.vm_claim_first_admin(
  code TEXT,
  display_name TEXT,
  role_label TEXT DEFAULT '1. Vorsitzende(r)'
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  stored  TEXT;
  used_at TIMESTAMP WITH TIME ZONE;
  uid     UUID := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RETURN 'nicht angemeldet';
  END IF;

  -- Sperre, damit zwei gleichzeitige Versuche nicht beide durchkommen.
  LOCK TABLE public.club_setup IN EXCLUSIVE MODE;

  SELECT cs.setup_code, cs.code_used_at
    INTO stored, used_at
    FROM public.club_setup cs
   WHERE cs.id = 'main';

  IF stored IS NULL OR used_at IS NOT NULL THEN
    RETURN 'bereits eingerichtet';
  END IF;

  IF EXISTS (SELECT 1 FROM public.club_users) THEN
    RETURN 'bereits eingerichtet';
  END IF;

  -- Bindestriche und Gross-/Kleinschreibung beim Vergleich ignorieren.
  IF upper(regexp_replace(COALESCE(code, ''), '[^A-Za-z0-9]', '', 'g'))
     <> upper(regexp_replace(stored, '[^A-Za-z0-9]', '', 'g')) THEN
    RETURN 'falscher code';
  END IF;

  INSERT INTO public.club_users (user_id, name, email, role_name, permissions, is_active)
  VALUES (
    uid,
    COALESCE(NULLIF(trim(display_name), ''), 'Vorstand'),
    COALESCE((SELECT u.email FROM auth.users u WHERE u.id = uid), ''),
    COALESCE(NULLIF(trim(role_label), ''), '1. Vorsitzende(r)'),
    public.vm_full_permissions(),
    TRUE
  );

  UPDATE public.club_setup
     SET code_used_at = timezone('utc'::text, now())
   WHERE id = 'main';

  RETURN 'ok';
END
$fn$;

-- Auch hier: erst allen entziehen, dann gezielt vergeben. Den Anspruch auf
-- den ersten Platz darf nur erheben, wer angemeldet ist.
REVOKE EXECUTE ON FUNCTION public.vm_setup_pending()                     FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.vm_claim_first_admin(TEXT, TEXT, TEXT) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.vm_setup_pending()                     TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.vm_claim_first_admin(TEXT, TEXT, TEXT) TO authenticated;


-- ==============================================================================
-- 7b. EINLADUNGEN FÜR WEITERE BENUTZER
-- ==============================================================================
--
-- Der Vorstand kann aus dem Browser heraus keine fremden Konten anlegen: Der
-- öffentliche Schlüssel darf das nicht, und ein Schlüssel, der es dürfte,
-- hätte im Browser nichts verloren. Deshalb der Umweg über eine Einladung.
--
-- Ablauf: Der Vorstand legt hier Name, E-Mail und Rechte fest und bekommt
-- einen Einladungscode. Den schickt er der Person auf seinem Weg (E-Mail,
-- Messenger, Zettel). Die Person registriert sich mit ihrer E-Mail-Adresse
-- und dem Code und vergibt dabei ihr eigenes Passwort. Der Vorstand erfährt
-- dieses Passwort nie — das ist beabsichtigt.

CREATE TABLE IF NOT EXISTS public.club_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  role_name TEXT NOT NULL DEFAULT 'Benutzer',
  permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
  invite_code TEXT NOT NULL UNIQUE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()) + INTERVAL '14 days',
  accepted_at TIMESTAMP WITH TIME ZONE,
  accepted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_club_invitations_email ON public.club_invitations (lower(email));

ALTER TABLE public.club_invitations ENABLE ROW LEVEL SECURITY;

-- Einladungen sieht und verwaltet nur, wer Benutzer verwalten darf. Die
-- eingeladene Person braucht keinen Zugriff auf die Tabelle — sie legt nur
-- ihren Code vor, geprüft wird er von der Funktion weiter unten.
CREATE POLICY "club_invitations lesen" ON public.club_invitations
  FOR SELECT TO authenticated USING (public.vm_can_view('users'));
CREATE POLICY "club_invitations schreiben" ON public.club_invitations
  FOR ALL TO authenticated
  USING (public.vm_can_edit('users'))
  WITH CHECK (public.vm_can_edit('users'));

REVOKE ALL ON public.club_invitations FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.club_invitations TO authenticated;


/**
 * Rechteangaben säubern.
 *
 * Nimmt nur bekannte Bereiche an und setzt Auswertungsbereiche höchstens auf
 * "ansehen". Damit kann auch eine fehlerhafte oder manipulierte Eingabe aus
 * dem Browser keine Rechte erzeugen, die es gar nicht geben soll.
 */
CREATE OR REPLACE FUNCTION public.vm_normalize_permissions(raw JSONB)
RETURNS JSONB
LANGUAGE sql
IMMUTABLE
AS $fn$
  SELECT COALESCE(jsonb_object_agg(area, level), '{}'::jsonb)
    FROM (
      SELECT a.area,
             CASE
               WHEN COALESCE(raw ->> a.area, 'none') NOT IN ('none', 'view', 'edit') THEN 'none'
               WHEN a.view_only AND COALESCE(raw ->> a.area, 'none') = 'edit'        THEN 'view'
               ELSE COALESCE(raw ->> a.area, 'none')
             END AS level
        FROM (VALUES
               ('dashboard', TRUE),  ('members', FALSE), ('online_applications', FALSE),
               ('member_analytics', TRUE), ('member_surveys', FALSE), ('finance', FALSE),
               ('sepa', FALSE), ('invoices', FALSE), ('donations', FALSE),
               ('guv', TRUE), ('finance_analytics', TRUE), ('contacts', FALSE),
               ('calendar', FALSE), ('meetings', FALSE), ('inventory', FALSE),
               ('documents', FALSE), ('settings', FALSE), ('users', FALSE)
             ) AS a(area, view_only)
    ) AS normalized;
$fn$;


/**
 * Einladung anlegen. Gibt den Code zurück, den der Vorstand weitergibt.
 */
CREATE OR REPLACE FUNCTION public.vm_create_invitation(
  invite_email TEXT,
  invite_name  TEXT,
  role_label   TEXT,
  perms        JSONB
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  new_code TEXT;
  clean_email TEXT := lower(trim(COALESCE(invite_email, '')));
BEGIN
  IF NOT public.vm_can_edit('users') THEN
    RETURN 'keine berechtigung';
  END IF;

  IF clean_email = '' OR position('@' IN clean_email) = 0 THEN
    RETURN 'ungueltige email';
  END IF;

  IF EXISTS (SELECT 1 FROM public.club_users cu WHERE lower(cu.email) = clean_email) THEN
    RETURN 'bereits benutzer';
  END IF;

  -- Offene Einladung an dieselbe Adresse ersetzen statt verdoppeln.
  DELETE FROM public.club_invitations
   WHERE lower(email) = clean_email AND accepted_at IS NULL;

  new_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 4) || '-' ||
                    substr(replace(gen_random_uuid()::text, '-', ''), 1, 4) || '-' ||
                    substr(replace(gen_random_uuid()::text, '-', ''), 1, 4));

  INSERT INTO public.club_invitations (email, name, role_name, permissions, invite_code, created_by)
  VALUES (clean_email,
          COALESCE(NULLIF(trim(invite_name), ''), clean_email),
          COALESCE(NULLIF(trim(role_label), ''), 'Benutzer'),
          public.vm_normalize_permissions(COALESCE(perms, '{}'::jsonb)),
          new_code,
          auth.uid());

  RETURN new_code;
END
$fn$;


/**
 * Einladung einlösen. Wird vom eingeladenen Benutzer aufgerufen, nachdem er
 * sich registriert und angemeldet hat.
 *
 * Der Code allein genügt nicht: Die E-Mail-Adresse des angemeldeten Kontos
 * muss zu der passen, an die eingeladen wurde. Sonst könnte ein
 * weitergereichter Code von irgendwem eingelöst werden.
 */
CREATE OR REPLACE FUNCTION public.vm_accept_invitation(code TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  inv        public.club_invitations%ROWTYPE;
  uid        UUID := auth.uid();
  user_email TEXT;
  clean_code TEXT := upper(regexp_replace(COALESCE(code, ''), '[^A-Za-z0-9]', '', 'g'));
BEGIN
  IF uid IS NULL THEN
    RETURN 'nicht angemeldet';
  END IF;

  IF EXISTS (SELECT 1 FROM public.club_users cu WHERE cu.user_id = uid) THEN
    RETURN 'bereits benutzer';
  END IF;

  SELECT u.email INTO user_email FROM auth.users u WHERE u.id = uid;

  LOCK TABLE public.club_invitations IN EXCLUSIVE MODE;

  SELECT * INTO inv
    FROM public.club_invitations ci
   WHERE upper(regexp_replace(ci.invite_code, '[^A-Za-z0-9]', '', 'g')) = clean_code
   LIMIT 1;

  IF inv.id IS NULL THEN
    RETURN 'falscher code';
  END IF;

  IF inv.accepted_at IS NOT NULL THEN
    RETURN 'bereits eingeloest';
  END IF;

  IF inv.expires_at < timezone('utc'::text, now()) THEN
    RETURN 'abgelaufen';
  END IF;

  IF lower(COALESCE(user_email, '')) <> lower(inv.email) THEN
    RETURN 'falsche email';
  END IF;

  INSERT INTO public.club_users (user_id, name, email, role_name, permissions, is_active)
  VALUES (uid, inv.name, lower(COALESCE(user_email, inv.email)), inv.role_name,
          public.vm_normalize_permissions(inv.permissions), TRUE);

  UPDATE public.club_invitations
     SET accepted_at = timezone('utc'::text, now()),
         accepted_by = uid
   WHERE id = inv.id;

  RETURN 'ok';
END
$fn$;

REVOKE EXECUTE ON FUNCTION public.vm_normalize_permissions(JSONB)              FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.vm_create_invitation(TEXT, TEXT, TEXT, JSONB) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.vm_accept_invitation(TEXT)                    FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.vm_normalize_permissions(JSONB)               TO authenticated;
GRANT EXECUTE ON FUNCTION public.vm_create_invitation(TEXT, TEXT, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.vm_accept_invitation(TEXT)                    TO authenticated;


-- ==============================================================================
-- 7c. ÖFFENTLICHER AUFNAHMEANTRAG: WAS EIN BESUCHER SEHEN DARF
-- ==============================================================================
--
-- Der Online-Antrag soll von der Vereinswebsite aus erreichbar sein, ohne dass
-- sich jemand anmeldet. Dafür braucht das Formular ein paar Angaben: wie der
-- Verein heisst, welche Abteilungen es gibt, welche Beiträge gelten.
--
-- Die Tabelle "settings" selbst bleibt gesperrt — dort stehen auch die IBAN des
-- Vereinskontos, die Steuernummer und die Kontaktdaten des Vorstands. Statt
-- dessen gibt diese Funktion genau die Felder heraus, die auf dem Formular
-- ohnehin gedruckt werden. Sie liest mit erhöhten Rechten (SECURITY DEFINER)
-- und gibt nur das Aufgezählte zurück — ein Stern (*) steht hier bewusst
-- nirgends, damit ein später hinzugefügtes Feld nicht versehentlich mit
-- veröffentlicht wird.
--
-- Zur Gläubiger-Identifikationsnummer: Die gehört auf jedes SEPA-Mandat und
-- steht auf jeder Vorabankündigung, die der Verein verschickt. Sie ist kein
-- Geheimnis und erlaubt für sich genommen keine Abbuchung — anders als die
-- Kontoverbindung, die hier nicht herausgegeben wird.

CREATE OR REPLACE FUNCTION public.vm_public_club_info()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
  SELECT jsonb_build_object(
    'clubName',          COALESCE((SELECT s.club_name         FROM public.settings s WHERE s.id = 'main'), ''),
    'associationNumber', COALESCE((SELECT s.association_number FROM public.settings s WHERE s.id = 'main'), ''),
    'address',           COALESCE((SELECT s.address            FROM public.settings s WHERE s.id = 'main'), ''),
    'creditorId',        COALESCE((SELECT s.creditor_id        FROM public.settings s WHERE s.id = 'main'), ''),
    'departments',       COALESCE((SELECT s.departments        FROM public.settings s WHERE s.id = 'main'), '[]'::jsonb),
    'template', jsonb_build_object(
      'clubLogoUrl',               (SELECT a.club_logo_url               FROM public.application_settings a WHERE a.id = 'main'),
      'headerText',                (SELECT a.header_text                 FROM public.application_settings a WHERE a.id = 'main'),
      'introductoryText',          (SELECT a.introductory_text           FROM public.application_settings a WHERE a.id = 'main'),
      'dataPrivacyText',           (SELECT a.data_privacy_text           FROM public.application_settings a WHERE a.id = 'main'),
      'statuteText',               (SELECT a.statute_text                FROM public.application_settings a WHERE a.id = 'main'),
      'defaultFeeRules',           (SELECT a.default_fee_rules           FROM public.application_settings a WHERE a.id = 'main'),
      'requirePhotoConsent',       (SELECT a.require_photo_consent       FROM public.application_settings a WHERE a.id = 'main'),
      'requireHealthConfirmation', (SELECT a.require_health_confirmation FROM public.application_settings a WHERE a.id = 'main'),
      'contactEmail',              (SELECT a.contact_email               FROM public.application_settings a WHERE a.id = 'main')
    )
  );
$fn$;

REVOKE EXECUTE ON FUNCTION public.vm_public_club_info() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.vm_public_club_info() TO anon, authenticated;


-- ==============================================================================
-- 7d. BREMSE FÜR DAS ÖFFENTLICHE AUFNAHMEFORMULAR
-- ==============================================================================
--
-- Das Aufnahmeformular ist die einzige Stelle, an der jemand OHNE Anmeldung
-- etwas in die Datenbank schreiben darf. Ohne Begrenzung könnte ein
-- Skript in wenigen Minuten Zehntausende Scheinanträge einstellen. Der
-- Schaden wäre nicht nur eine unbrauchbare Antragsliste: Supabase rechnet
-- nach Speicher und Datenverkehr ab, und die kostenlose Stufe wäre schnell
-- erschöpft. Danach steht auch die Vereinsverwaltung selbst.
--
-- Bewusste Entscheidung: Hier wird die IP-Adresse des Absenders NICHT
-- gespeichert — auch nicht als Prüfsumme. Eine IP-Adresse ist ein
-- personenbezogenes Datum; wer sie verarbeitet, muss das in der
-- Datenschutzerklärung nennen und begründen. Für ein Vereinsformular, das
-- vielleicht zwanzig Mal im Jahr benutzt wird, steht das in keinem
-- Verhältnis. Gezählt wird deshalb nur, WIE VIELE Anträge insgesamt
-- eingegangen sind, nicht von wem.
--
-- Der Preis dieser Entscheidung, offen benannt: Wer die Stundengrenze
-- mutwillig ausschöpft, sperrt damit für den Rest der Stunde auch echte
-- Interessenten aus. Sie bekommen dann einen verständlichen Hinweis mit
-- der Bitte, sich direkt an den Verein zu wenden — der Antrag geht also
-- nicht verloren, er dauert nur länger. Gegen einen gezielten Angreifer
-- hilft das nicht, gegen ein wahlloses Skript und gegen den versehentlich
-- dreißigmal gedrückten Absendeknopf schon.

-- Der Zähler. Eine Zeile je Stunde, darin nur eine Zahl — keine Namen,
-- keine Adressen, nichts Personenbezogenes.
CREATE TABLE IF NOT EXISTS public.application_throttle (
  hour_bucket TIMESTAMP WITH TIME ZONE PRIMARY KEY,
  accepted    INTEGER NOT NULL DEFAULT 0
);

ALTER TABLE public.application_throttle ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.application_throttle FROM anon;
GRANT SELECT ON public.application_throttle TO authenticated;

DROP POLICY IF EXISTS "application_throttle lesen" ON public.application_throttle;
CREATE POLICY "application_throttle lesen" ON public.application_throttle
  FOR SELECT TO authenticated USING (public.vm_is_member());

-- Eine eigene Zählertabelle statt schlicht der Anträge selbst: Sonst könnte
-- ein Angreifer die Grenze umgehen, sobald der Vorstand aufräumt. Löscht
-- dieser die Scheinanträge, sänke die Zahl wieder und der nächste Schwall
-- ginge durch. Der Zähler hier bleibt davon unberührt.

CREATE OR REPLACE FUNCTION public.vm_throttle_public_application()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  -- Die drei Obergrenzen. Wer sie anpassen will, ändert nur diese Zahlen
  -- und führt die Funktion erneut aus.
  max_pro_stunde  CONSTANT INTEGER := 20;
  max_pro_tag     CONSTANT INTEGER := 60;
  max_je_mail_tag CONSTANT INTEGER := 3;

  jetzt       TIMESTAMPTZ := now();
  stunde      TIMESTAMPTZ := date_trunc('hour', now());
  zahl_stunde INTEGER;
  zahl_tag    INTEGER;
  zahl_mail   INTEGER;
BEGIN
  -- Angemeldete Benutzer sind nicht betroffen. Der Vorstand erfasst
  -- Papieranträge nach, importiert eingescannte Formulare und legt bei
  -- einer Vereinsgründung auch mal fünfzig Mitglieder auf einmal an.
  IF auth.uid() IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Ab hier bestimmt der Server den Zeitpunkt, nicht der Absender. Das ist
  -- keine Schikane: Der Wert kam bisher aus dem Browser, und wer ihn
  -- fälscht, könnte sich sonst an jeder Zeitgrenze vorbeischreiben — und
  -- nebenbei Anträge mit einem Eingangsdatum im Jahr 2099 einstellen.
  NEW.submitted_at := jetzt;

  -- Erst hochzählen, dann prüfen. Diese Reihenfolge ist wichtig: Das
  -- Hochzählen sperrt die Zeile für die Dauer des Vorgangs. Zwei
  -- gleichzeitige Anträge können dadurch nicht beide dieselbe freie
  -- Nummer sehen und gemeinsam über die Grenze rutschen. Wird unten
  -- abgebrochen, macht PostgreSQL auch dieses Hochzählen rückgängig.
  INSERT INTO public.application_throttle AS t (hour_bucket, accepted)
       VALUES (stunde, 1)
  ON CONFLICT (hour_bucket) DO UPDATE SET accepted = t.accepted + 1
    RETURNING t.accepted INTO zahl_stunde;

  SELECT COALESCE(SUM(t.accepted), 0) INTO zahl_tag
    FROM public.application_throttle t
   WHERE t.hour_bucket > jetzt - INTERVAL '24 hours';

  IF zahl_stunde > max_pro_stunde OR zahl_tag > max_pro_tag THEN
    -- Die Kennung am Anfang ist fuer das Programm, der Satz dahinter fuer
    -- den Fall, dass die Meldung doch einmal ungefiltert beim Besucher
    -- ankommt. Das Programm ersetzt sie durch einen eigenen Hinweis.
    RAISE EXCEPTION 'VM_ANTRAG_LIMIT_GESAMT: Es sind gerade ungewoehnlich viele Antraege eingegangen. Bitte versuchen Sie es spaeter noch einmal oder wenden Sie sich direkt an den Verein.';
  END IF;

  -- Zusätzlich je E-Mail-Adresse. Das fängt den häufigsten harmlosen Fall
  -- ab — mehrfach auf "Absenden" gedrückt — ohne eine Korrektur zu
  -- verhindern: Drei Versuche am Tag bleiben erlaubt. Hier entsteht kein
  -- neues Datum; die Adresse steht ohnehin im Antrag.
  SELECT count(*) INTO zahl_mail
    FROM public.online_applications a
   WHERE lower(a.email) = lower(NEW.email)
     AND a.submitted_at > jetzt - INTERVAL '24 hours';

  IF zahl_mail >= max_je_mail_tag THEN
    RAISE EXCEPTION 'VM_ANTRAG_LIMIT_MAIL: Von dieser E-Mail-Adresse liegen bereits mehrere Antraege vor. Bitte wenden Sie sich direkt an den Verein.';
  END IF;

  -- Zeilen, die älter als eine Woche sind, werden nicht mehr gebraucht.
  DELETE FROM public.application_throttle t
   WHERE t.hour_bucket < jetzt - INTERVAL '7 days';

  RETURN NEW;
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.vm_throttle_public_application() FROM PUBLIC;

DROP TRIGGER IF EXISTS vm_throttle_public_application ON public.online_applications;
CREATE TRIGGER vm_throttle_public_application
  BEFORE INSERT ON public.online_applications
  FOR EACH ROW EXECUTE FUNCTION public.vm_throttle_public_application();




-- ==============================================================================
-- 8. PROBE — muss LEER bleiben
-- ==============================================================================
--
-- Diese Abfrage sucht nach den drei Fehlern, die den Schutz aushebeln
-- würden. Sie darf KEINE Zeile liefern. Wenn doch, steht in der Spalte
-- "problem", woran es liegt.
--
-- Die Abfrage lässt sich jederzeit wiederholen — etwa nachdem jemand im
-- Supabase-Dashboard an den Richtlinien gedreht hat.

SELECT tablename, policyname, 'Regel erlaubt alles (USING true)' AS problem
  FROM pg_policies
 WHERE schemaname = 'public'
   AND (qual = 'true' OR with_check = 'true')

UNION ALL

SELECT tablename, policyname, 'Regel gilt ohne Anmeldung'
  FROM pg_policies
 WHERE schemaname = 'public'
   AND 'anon' = ANY(roles)
   AND policyname <> 'online_applications einreichen'

UNION ALL

SELECT tablename, '-', 'Zugriffsschutz ist fuer diese Tabelle ausgeschaltet'
  FROM pg_tables
 WHERE schemaname = 'public'
   AND NOT rowsecurity

ORDER BY 1, 2;


-- ==============================================================================
-- 9. ZWEITE PROBE — wer darf was
-- ==============================================================================
--
-- Zeigt für jeden eingetragenen Benutzer, welche Bereiche er ändern darf.
-- Nützlich zum Gegenlesen nach dem Vergeben von Rechten.

SELECT cu.name,
       cu.role_name,
       cu.is_active,
       (SELECT string_agg(key, ', ' ORDER BY key)
          FROM jsonb_each_text(cu.permissions)
         WHERE value = 'edit') AS darf_bearbeiten,
       (SELECT string_agg(key, ', ' ORDER BY key)
          FROM jsonb_each_text(cu.permissions)
         WHERE value = 'view') AS darf_nur_ansehen
  FROM public.club_users cu
 ORDER BY cu.name;


-- ==============================================================================
-- 10. EINRICHTUNGSCODE — HIER ABLESEN
-- ==============================================================================
--
-- Diesen Code braucht der Vorstand einmalig bei der Registrierung im
-- Programm. Steht dort "verbraucht am ...", ist die Einrichtung erledigt
-- und der Code wertlos.

SELECT CASE
         WHEN cs.code_used_at IS NULL
           THEN cs.setup_code
         ELSE 'verbraucht am ' || to_char(cs.code_used_at, 'DD.MM.YYYY HH24:MI')
       END AS einrichtungscode,
       (SELECT count(*) FROM public.club_users) AS bereits_eingetragene_benutzer
  FROM public.club_setup cs
 WHERE cs.id = 'main';
