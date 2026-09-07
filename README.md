# 🏛️ VereinsManager

> **Moderne, DSGVO-konforme und revisionssichere Vereinsverwaltung für gemeinnützige Vereine (e.V.) in Deutschland.**  
> Unterstützt Offline-First-Betrieb im Browser, Desktop-App (Tauri) sowie standortunabhängiges Arbeiten im Vorstandsteam via Cloud-Synchronisation (Supabase PostgreSQL).

---

## 📑 Inhaltsverzeichnis

- [Überblick & Leitphilosophie](#-überblick--leitphilosophie)
- [Systemarchitektur & Betriebsmodi](#-systemarchitektur--betriebsmodi)
- [Funktionsübersicht der Module](#-funktionsübersicht-der-module)
- [Detaillierte Beschreibung der komplexesten Kernfunktionen](#-detaillierte-beschreibung-der-komplexesten-kernfunktionen)
  - [1. Das 4-Sphären-Gemeinnützigkeitsmodell (§ 52 AO)](#1-das-4-sphären-gemeinnützigkeitsmodell--52-ao)
  - [2. Der SEPA-Lastschriftlauf (pain.008 XML) & Mandatsprüfung](#2-der-sepa-lastschriftlauf-pain008-xml--mandatsprüfung)
  - [3. Hybride Offline-First- & Cloud-Synchronisation](#3-hybride-offline-first---cloud-synchronisation)
  - [4. DIN 5008 Rechnungs-Engine & Blanko-Briefpapier-Offset](#4-din-5008-rechnungs-engine--blanko-briefpapier-offset)
  - [5. Sitzungsdienst, Beschlussbuch & DSGVO-konformer SMTP-Versand](#5-sitzungsdienst-beschlussbuch--dsgvo-konformer-smtp-versand)
- [Installations- & Betriebsanleitung](#-installations---betriebsanleitung)
  - [Voraussetzungen](#voraussetzungen)
  - [Lokale Entwicklung / Schnellstart](#lokale-entwicklung--schnellstart)
  - [Produktions-Build & Serverstart](#produktions-build--serverstart)
  - [Cloud-Synchronisation mit Supabase einrichten](#cloud-synchronisation-mit-supabase-einrichten)
  - [SMTP-Postausgangsserver konfigurieren](#smtp-postausgangsserver-konfigurieren)
  - [Desktop-App mit Tauri kompilieren](#desktop-app-mit-tauri-kompilieren)
- [Datensicherheit, Revisionssicherheit & Backups](#-datensicherheit-revisionssicherheit--backups)
- [Lizenz](#-lizenz)

---

## 🌟 Überblick & Leitphilosophie

**VereinsManager** wurde speziell entwickelt, um ehrenamtlichen Vereinsvorständen, Schatzmeistern, Abteilungsleitern und Geschäftsstellen ein professionelles, intuitives Werkzeug an die Hand zu geben, ohne sie in kostspielige Software-Abonnements oder proprietäre Cloud-Silos zu zwingen.

* **100 % Datensouveränität:** Daten verbleiben lokal auf Ihrem Rechner (IndexedDB) oder in Ihrer eigenen, dedizierten Cloud-Instanz (Supabase).
* **Vollständige Rechtssicherheit für deutsche e.V.:** Berücksichtigt die strengen Vorgaben der Abgabenordnung (AO), des BGB, der DSGVO sowie die Richtlinien des Bundesfinanzministeriums (BMF).
* **Keine Zwangsserver:** Die Basisanwendung läuft vollständig clientseitig im Webbrowser – auch komplett ohne aktive Internetverbindung.

---

## 🏗️ Systemarchitektur & Betriebsmodi

Die Anwendung vereint drei flexible Betriebsmodi in einer einzigen Codebasis:

```text
               ┌────────────────────────────────────────────────────────┐
               │                VereinsManager Frontend                 │
               │         (React 19 + TypeScript + Tailwind CSS)         │
               └───────────┬────────────────────────┬───────────────────┘
                           │                        │
             Modus 1: Lokal│          Modus 2: Cloud│          Modus 3: Server
                           ▼                        ▼                        ▼
       ┌────────────────────────┐  ┌────────────────────────┐  ┌────────────────────────┐
       │   Browser IndexedDB    │  │   Supabase (Postgres)  │  │  Node.js Express API   │
       │ (100% Offline-First)   │  │ (Zwei-Wege-Sync & Team)│  │ (SMTP, OCR & KI-Proxy) │
       └────────────────────────┘  └────────────────────────┘  └────────────────────────┘
```

1. **Modus 1: Lokal (Offline-First / IndexedDB)**  
   Daten werden ausschließlich im lokalen Browserspeicher gehalten. Perfekt für Einzel-Kassenwarte, die keine Serverinfrastruktur verwalten möchten.
2. **Modus 2: Cloud-Sync (Supabase PostgreSQL)**  
   Ermöglicht mehreren Vorstandsmitgliedern ortsunabhängiges Arbeiten mit bidirektionalem Datenabgleich, Konflikterkennung und Echtzeit-Statusanzeige.
3. **Modus 3: Desktop-App (Tauri v2)**  
   Native Desktop-Anwendung für Windows (.exe), macOS (.dmg) und Linux (.AppImage) mit Zugriff auf lokale Dateisysteme und Hardware-Drucker.

---

## 📦 Funktionsübersicht der Module

| Modul | Hauptmerkmale |
| :--- | :--- |
| **Mitgliederverwaltung** | Vollständige Stammdaten, Beitragsrhythmen (inkl. *Beitragsfrei*), Status (*Aktiv, Passiv, Ehrenmitglied, Ausgetreten* mit automatischer Beitragssperre), Spartenzuweisung, CSV/Excel-Import & -Export, detailliertes Änderungsprotokoll. |
| **Online-Aufnahmeanträge** | Öffentliches, responsives Antragsformular mit digitaler Touch-Signatur, automatischer SEPA-Mandatserteilung, Vorstands-Prüfungsansicht und 1-Klick-Übernahme in die Mitgliederkartei. |
| **Finanzwesen & 4 Sphären** | Revisionssicheres Buchungsjournal, getrennte Kassenbücher und Bankkonten, Zuordnung zu den 4 steuerlichen Sphären nach § 52 AO, EÜR-Überschussrechnung, Budgetanalysen. |
| **SEPA-Lastschriftlauf** | Vollautomatischer Lastschriftlauf mit ISO-konformer **pain.008.001.02 XML-Generierung**, Mandatsprüfung, IBAN/BIC-Validierung und automatischer Buchungserzeugung. |
| **Rechnungswesen (DIN 5008)**| Normgerechte Rechnungsstellung nach DIN 5008, Unterstützung von **Blanko-Briefpapier (Druck-Offset)**, automatische Rechnungsnummern, PDF-Vorschau, Mahnwesen & Buchungsübernahme. |
| **Zuwendungsbestätigungen** | Spendenbescheinigungen nach amtlichem **BMF-Muster** (Geldspende, Sachspende, Verzicht auf Aufwendungsersatz), integrierter Freistellungsbescheid-Nachweis. |
| **Sitzungsdienst & Protokolle**| Verwaltung von Mitgliederversammlungen & Vorstandssitzungen, Tagesordnungspunkte (TOPs), Stimmberechtigung, Beschlussfassung, digitale Signatur, PDF-Export & **SMTP-E-Mail-Direktversand**. |
| **Dokumentenmanagement** | Revisionssicheres Archiv mit Ordnerstrukturen, Tags, Dokumentenkategorien und integriertem **Kamera-Scanner mit automatischer Belegerkennung**. |
| **Kalender & Veranstaltungen**| Vereinskalender mit Sparten- und Raumfiltern, iCal-Export, Anwesenheitsplanung und Verknüpfung mit Mitgliedern. |
| **Benutzer- & Rollenverwaltung**| Granulare Berechtigungen (Admin, Finanzen, Mitglieder, Lesezugriff), Session-Sperre (PIN/Passwort) und DSGVO-konforme Audit-Logs. |

---

## 🔬 Detaillierte Beschreibung der komplexesten Kernfunktionen

### 1. Das 4-Sphären-Gemeinnützigkeitsmodell (§ 52 AO)

Die steuerliche Gemeinnützigkeit eines Vereins in Deutschland erfordert eine strikte Trennung aller Einnahmen und Ausgaben in vier voneinander unabhängige Sphären:

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                             Die 4 Vereins-Sphären                           │
├──────────────────────────────┬──────────────────────────────────────────────┤
│ 1. Ideeller Bereich          │ 2. Vermögensverwaltung                       │
│ • Echte Mitgliedsbeiträge    │ • Zinserträge, Dividenden                    │
│ • Reine Geld- & Sachspenden  │ • Langfristige Verpachtung von Vereinsheim   │
│ • Aufnahmegebühren, Umlagen  │ • Zinsaufwendungen für Vereinsimmobilien     │
│ (Steuerfrei)                 │ (Grundsätzlich umsatzsteuerfrei, ertragstfr.)│
├──────────────────────────────┼──────────────────────────────────────────────┤
│ 3. Zweckbetrieb (§ 65-68 AO) │ 4. Wirtschaftlicher Geschäftsbetrieb         │
│ • Eintrittsgelder Sportevents│ • Vereinsfeste, Bier- & Essensverkauf        │
│ • Startgebühren für Turniere │ • Trikotsponsoring & Bandenwerbung           │
│ • Sportkurse & Lehrgänge     │ • Vereins-Merchandising                      │
│ (Begünstigter Steuersatz 7%) │ (Voll steuerpflichtig: KSt, GewSt, 19% USt)  │
└──────────────────────────────┴──────────────────────────────────────────────┘
```

* **Funktionsweise im VereinsManager:**  
  Jede Buchung wird zwingend einer dieser Sphären zugeordnet. Die integrierte EÜR berechnet getrennte Salden für jede Sphäre. Sollte der wirtschaftliche Geschäftsbetrieb die gesetzliche Freigrenze (derzeit 45.000 € Einnahmen p.a.) überschreiten, weist das System mit Warnhinweisen darauf hin, um die Gemeinnützigkeit nicht zu gefährden.

---

### 2. Der SEPA-Lastschriftlauf (pain.008 XML) & Mandatsprüfung

Der automatische Einzug von Mitgliedsbeiträgen erfolgt über den europäischen SEPA-Standard:

* **Ablauf & Algorithmus:**
  1. **Selektion:** Das System filtert alle aktiven Mitglieder, deren Zahlungsart auf *Lastschrift* steht und deren Fälligkeitsintervall (z. B. Quartal, Halbjahr, Jahr) zum gewählten Einzugsstichtag passt.
  2. **Mandatsvalidierung:** Jede Transaktion prüft die Existenz von Mandatsreferenz, Signaturdatum und IBAN/BIC.
  3. **Sequenztypen-Zuordnung:**
     * `FRST` (Erstlastschrift): Wenn zum Mandat noch keine vorherige Lastschrift verbucht wurde.
     * `RCUR` (Folgelastschrift): Für alle regulären, wiederkehrenden Einzüge.
     * `OOFF` (Einmallastschrift): Für einmalige Sonderbeiträge oder Aufnahmegebühren.
  4. **XML-Erstellung (`pain.008.001.02`):** Es wird eine standardisierte XML-Datei nach ISO 20022 erzeugt, die direkt bei Sparkassen, Volksbanken, der Bundesbank oder im Online-Banking (z. B. per HBCI/FinTS) eingereicht werden kann.
  5. **Auto-Buchung:** Auf Wunsch erzeugt das System automatisch die passenden Buchungssätze im Beitragsjournal für alle selektierten Mitglieder.

---

### 3. Hybride Offline-First- & Cloud-Synchronisation

Um Ausfallsicherheit und mobile Unabhängigkeit auf dem Sportplatz mit kollaborativer Vorstandsarbeit zu verbinden, nutzt VereinsManager eine **Multi-Tier-Speicherarchitektur**:

* **Lokaler Cache (IndexedDB):** Alle Lese- und Schreibvorgänge erfolgen mit 0 ms Latenz primär gegen die lokale IndexedDB im Browser.
* **Sync-Engine (`SupabaseService`):**
  * Erkennt online/offline Statuswechsel automatisch.
  * Beim Verbindungsaufbau gleicht ein Zeitstempel-basierter Delta-Algorithmus veränderte Datensätze (`updated_at`) mit der Cloud-PostgreSQL-Datenbank ab.
  * Bei gleichzeitigen Bearbeitungen greift eine deterministische *Last-Write-Wins*-Regel mit automatischer Versionierung, sodass keine Daten verloren gehen.
  * Eine visuelle Status-Pille in der Navigationsleiste informiert permanent über den Synchronisationszustand (*Online / Synchronisiert*, *Synchronisiere...* oder *Offline-Modus*).

---

### 4. DIN 5008 Rechnungs-Engine & Blanko-Briefpapier-Offset

Die Rechnungserstellung erfüllt formell und optisch alle Kriterien der **DIN 5008** (Geschäftsbriefe Form A und Form B):

* **Normgerechte Abstände:**
  * Absender-Kleinstzeile exakt 45 mm von der Oberkante.
  * Adressfenster (Breite 85 mm, Höhe 45 mm) passgenau für Fensterbriefumschläge (DIN C6/5 und DIN lang).
  * Faltmarken bei 105 mm und 210 mm sowie Lochmarke bei 148,5 mm.
* **Der Blanko-Briefpapier-Modus (Offset-Druck):**  
  Viele Vereine besitzen bereits vorgedrucktes Briefpapier mit Logo, Vorstandskopf und Bankverbindung in der Fußzeile.  
  * Im Blanko-Modus schaltet die PDF-Engine Vereinslogo, Briefkopf und Fußzeile ab und versieht den Inhaltsbereich mit einem millimetergenau einstellbaren Randabstand (Top- & Bottom-Offset).
  * Der Ausdruck erfolgt exakt in die Freiräume des physischen Vordrucks.

---

### 5. Sitzungsdienst, Beschlussbuch & DSGVO-konformer SMTP-Versand

Für rechtskonforme Vorstandssitzungen und Mitgliederversammlungen nach § 32 BGB:

* **Tagesordnungen & Quorum:** Automatische Ermittlung der Beschlussfähigkeit anhand der Anwesenheitsliste und der Vereinssatzung.
* **Beschlussfassung:** Jeder Beschluss erhält eine eindeutige, fortlaufende Nummer (`BES-JJJJ-XXX`) und dokumentiert Ja-, Nein- und Enthaltungsstimmen.
* **Digitale Signatur:** Protokollführer und 1. Vorsitzender können das Protokoll direkt auf einem Touchscreen (Tablet, Smartphone) oder per Maus digital gegenzeichnen.
* **DSGVO-konformer SMTP-Relay-Versand:**
  * Der Versand von Einladungen und Protokollen samt generierter PDF erfolgt wahlweise über den lokalen Mail-Client (`mailto:`) oder **direkt aus der Anwendung über den konfigurierten SMTP-Server des Vereins** (z. B. IONOS, Strato, Gmail).
  * **DSGVO-Schutz:** Alle Empfänger werden ausnahmslos als Blindkopie (**BCC**) adressiert. So wird verhindert, dass private E-Mail-Adressen von Mitgliedern offengelegt werden.

---

## 🚀 Installations- & Betriebsanleitung

### Voraussetzungen

* **Node.js:** Version 20.x oder 22.x LTS
* **npm:** Version 9.x oder neuer
* Ein moderner Webbrowser (Chrome, Firefox, Safari, Edge)

### Lokale Entwicklung / Schnellstart

1. **Repository klonen:**
   ```bash
   git clone https://github.com/strelitzerfc/vereinsmanager.git
   cd vereinsmanager
   ```

2. **Abhängigkeiten installieren:**
   ```bash
   npm install
   ```

3. **Entwicklungsserver starten:**
   ```bash
   npm run dev
   ```
   Die Anwendung startet standardmäßig auf:  
   `http://localhost:3000`

---

### Produktions-Build & Serverstart

Für den produktiven Einsatz auf einem vServer, Cloud Run oder Docker-Container:

1. **Frontend & Backend kompilieren:**
   ```bash
   npm run build
   ```
   *Kompiliert das Vite-Frontend nach `dist/` und bündelt das Express-Backend nach `dist/server.cjs`.*

2. **Produktionsserver starten:**
   ```bash
   npm start
   ```

---

### Cloud-Synchronisation mit Supabase einrichten

Wenn Sie im Vorstandsteam gemeinsam mit denselben Daten arbeiten möchten:

1. Erstellen Sie ein kostenloses Projekt auf [supabase.com](https://supabase.com).
2. Öffnen Sie in Supabase den **SQL Editor** und führen Sie das folgende Schema aus:

```sql
-- VereinsManager Tabellen-Schema
create table if not exists members (
  id text primary key,
  member_number text,
  first_name text,
  last_name text,
  email text,
  phone text,
  status text default 'active',
  membership_type text default 'full',
  fee numeric default 0,
  payment_interval text default 'yearly',
  payment_method text default 'bank_transfer',
  iban text,
  bic text,
  mandate_reference text,
  mandate_date text,
  join_date text,
  birth_date text,
  departments jsonb default '[]',
  data jsonb,
  updated_at timestamp with time zone default now()
);

create table if not exists transactions (
  id text primary key,
  document_number text,
  date text,
  booking_text text,
  partner text,
  amount numeric,
  type text,
  sphere text default 'ideell',
  account_id text,
  category text,
  data jsonb,
  updated_at timestamp with time zone default now()
);

create table if not exists accounts (
  id text primary key,
  name text,
  type text,
  account_number text,
  balance numeric default 0,
  data jsonb,
  updated_at timestamp with time zone default now()
);

create table if not exists invoices (
  id text primary key,
  invoice_number text,
  date text,
  due_date text,
  recipient_name text,
  total_gross numeric,
  status text default 'draft',
  items jsonb default '[]',
  data jsonb,
  updated_at timestamp with time zone default now()
);

create table if not exists meetings (
  id text primary key,
  title text,
  type text,
  status text default 'draft',
  date text,
  agenda_items jsonb default '[]',
  resolutions jsonb default '[]',
  attendees jsonb default '[]',
  data jsonb,
  updated_at timestamp with time zone default now()
);

create table if not exists club_settings (
  id text primary key default 'default',
  club_name text,
  data jsonb,
  updated_at timestamp with time zone default now()
);
```

3. Hinterlegen Sie Ihre Projekt-URL und den `anon`-Key in der `.env`-Datei oder in der Web-Oberfläche unter **Systemeinstellungen > 5. Betriebsmodi**:
   ```env
   VITE_SUPABASE_URL=https://ihr-projekt.supabase.co
   VITE_SUPABASE_ANON_KEY=ihr-anon-key
   ```

---

### SMTP-Postausgangsserver konfigurieren

Für den automatischen Versand von Sitzungseinladungen und Protokollen:

1. Öffnen Sie in der Anwendung die **Systemeinstellungen > 2. Vereinsstammdaten**.
2. Scrollen Sie zum Bereich **SMTP-Server für den Sitzungsdienst & E-Mail-Versand**.
3. Wählen Sie entweder einen Schnellwahl-Button (*IONOS, Strato, Gmail, GMX, Web.de, Telekom*) oder tragen Sie Ihre Zugangsdaten manuell ein:
   * **Host:** z. B. `smtp.ionos.de`
   * **Port:** `587` (STARTTLS) oder `465` (SSL)
   * **Benutzer & Passwort:** Ihre E-Mail-Zugangsdaten
4. Klicken Sie auf **SMTP-Verbindung testen**, um die Funktionsfähigkeit sofort zu verifizieren.

---

### Desktop-App mit Tauri kompilieren

Die Desktop-Version benötigt [Rust](https://rustup.rs/) und das Tauri CLI.

* **Im Entwicklungsmodus ausführen:**
  ```bash
  npm run tauri dev
  ```
* **Installationspakete (Setup.exe / DMG / AppImage) erstellen:**
  ```bash
  npm run tauri build
  ```
  Die fertigen Installationsdateien befinden sich anschließend in:  
  `src-tauri/target/release/bundle/`

---

## 🔒 Datensicherheit, Revisionssicherheit & Backups

* **Keine externen Tracking-Dienste:** Keine Cookies von Drittanbietern, keine Telemetrie-Tracker.
* **1-Klick-Gesamt-Backup:**  
  Unter **Systemeinstellungen > 4. Datensicherung & Import** kann zu jedem Zeitpunkt eine vollständige, unverschlüsselte JSON-Sicherungsdatei der gesamten Vereinsdatenbank (Mitglieder, Buchungen, Belege, Rechnungen, Protokolle, Einstellungen) heruntergeladen und auf einem USB-Stick oder Netzlaufwerk archiviert werden.
* **Wiederherstellung (Restore):**  
  Die gesicherte JSON-Datei kann in jeder frischen VereinsManager-Instanz mit einem Klick vollständig wieder eingespielt werden.

---

## 📄 Lizenz

Dieses Projekt ist unter der **Apache 2.0 Lizenz** veröffentlicht – siehe die beiliegende [LICENSE](LICENSE) Datei für Details.  
Freie Nutzung für alle gemeinnützigen Vereine, Initiativen und Organisationen.
