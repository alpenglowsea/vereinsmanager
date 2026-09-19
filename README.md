# 🏛️ VereinsManager

> **Moderne, DSGVO-konforme und revisionssichere Vereinsverwaltung für gemeinnützige Vereine (e.V.) in Deutschland.**  
> Unterstützt Offline-First-Betrieb im Browser, Desktop-App (Tauri) sowie standortunabhängiges Arbeiten im Vorstandsteam via Cloud-Synchronisation (Supabase PostgreSQL).

---

## 📑 Inhaltsverzeichnis

- [Überblick & Leitphilosophie](#-überblick--leitphilosophie)
- [Systemarchitektur & Betriebsmodi](#-systemarchitektur--betriebsmodi)
- [Die 7 Hauptfunktionen der App im Detail](#-die-7-hauptfunktionen-der-app-im-detail)
  - [1. Mitgliederverwaltung & Mitgliederbetreuung](#1-mitgliederverwaltung--mitgliederbetreuung)
  - [2. Finanz- & Kassenverwaltung (inkl. 4 Sphären & Rechnungen)](#2-finanz--kassenverwaltung-inkl-4-sphären--rechnungen)
  - [3. Kontakt-, Partner- & Sponsorenverwaltung](#3-kontakt--partner--sponsorenverwaltung)
  - [4. Termine & Vereinskalender](#4-termine--vereinskalender)
  - [5. Sitzungsdienst, Beschlussbuch & Versammlungen](#5-sitzungsdienst-beschlussbuch--versammlungen)
  - [6. Inventar-, Material- & Geräteverwaltung](#6-inventar--material--geräteverwaltung)
  - [7. Revisionssicheres Dokumenten- & Belegarchiv](#7-revisionssicheres-dokumenten--belegarchiv)
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

## 🏛️ Die 7 Hauptfunktionen der App im Detail

VereinsManager gliedert sich in **sieben voll integrierte Hauptmodule**, die sämtliche operativen und gesetzlichen Aufgaben eines eingetragenen Vereins (e.V.) abdecken:

```text
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                                 VEREINSMANAGER HAUPTMODULE                                  │
├──────────────┬──────────────┬──────────────┬──────────────┬──────────────┬──────────────┬──────────────┤
│ 1. MITGLIEDER│ 2. FINANZEN  │ 3. KONTAKTE  │ 4. KALENDER  │ 5. SITZUNGEN │ 6. INVENTAR  │ 7. DOKUMENTE │
│ • Stammdaten │ • 4 Sphären  │ • Partner    │ • Termine    │ • Versammlung│ • Geräte     │ • Belegarchiv│
│ • Beiträge   │ • Eigene Kto.│ • Sponsoren  │ • Sparten    │ • Beschlüsse │ • Ausleihe an│ • OCR-Scanner│
│ • Online-Antr│ • SEPA XML   │ • Verbände   │ • Räume      │ • Protokolle │   Mitglieder │ • Revision   │
│ • Umfragen   │ • EÜR / DIN  │ • Schnittst. │ • iCal-Sync  │ • SMTP-Mail  │ • Prüffristen│ • Verknüpfung│
└──────────────┴──────────────┴──────────────┴──────────────┴──────────────┴──────────────┴──────────────┘
```

---

### 1. Mitgliederverwaltung & Mitgliederbetreuung

Das zentrale Nervensystem der Vereinsorganisation:

* **Vollständige Stammdaten & Adressverwaltung:**
  * DSGVO-konforme Erfassung von Name, Anschrift, Geburtsdatum, Geschlecht, Telefon, Mobil, E-Mail sowie individueller Mitgliedsnummer.
  * Interaktive Tabellensortierung über alle Spaltenköpfe sowie Schnellfilterung nach Status und Sparte.
  * Hinterlegung von Bankverbindungen (IBAN/BIC) und SEPA-Mandatsdaten (Mandatsreferenz, Ausstellungsdatum).
* **Beitragsstrukturen & Zahlungsrhythmen:**
  * Freie Zuweisung von Monats-, Quartals-, Halbjahres- und Jahresbeiträgen.
  * **Option *„Beitragsfrei“*:** Für Ehrenmitglieder, Schiedsrichter oder beurlaubte Mitglieder. Befreit automatisch von Pflichtangaben (IBAN/BIC), sperrt den Einzug und hebt den Status in der Kartei hervor.
  * Frei wählbarer Fälligkeitstag (1. oder 15. des Monats) für maßgeschneiderte Kassenläufe.
* **Status- & Spartenmanagement:**
  * Statusarten: *Aktiv*, *Passiv*, *Ehrenmitglied* und *Ausgetreten*.
  * **Automatische Beitragssperre:** Bei Status *Ausgetreten* wird das Mitglied sofort vor versehentlichen SEPA-Einzügen oder Rechnungsstellungen geschützt.
  * Beliebig viele Abteilungen/Sparten (z. B. Fußball, Turnen, Tennis) mit individueller Zuordnung und Sortierung per Drag & Drop.
* **Online-Aufnahmeanträge & Digitales Aufnahmewesen:**
  * Responsives Online-Formular für Smartphone, Tablet und PC mit digitaler Signatur (Touchscreen/Maus).
  * Automatische Erfassung des SEPA-Lastschriftmandats mit rechtssicherem Bestätigungstext.
  * Übersicht aller eingegangenen Anträge für den Vorstand mit 1-Klick-Übernahme in den regulären Mitgliederbestand.
* **Mitglieder-Statistiken & Demografie:**
  * Grafische Analysen der Altersverteilung, Geschlechteranteile, Spartenbelegungen und Eintritts-/Austrittstrends.
* **Mitgliederbefragung & Meinungsbilder (Neu in v1.2.3):**
  * Erstellung interner Befragungen mit 6 Fragetypen: 1–5 Sterne, 0–10 NPS-Skala, Single-/Multiple-Choice, Ja/Nein/Enthaltung und Freitext.
  * Registrierungsfreie Stimmabgabe für Mitglieder via Direktlink.
  * **Einmal-Token-Schutz:** Automatische Generierung fälschungssicherer Einmal-Links gegen Mehrfachabstimmungen.
  * Multi-Channel-Versand per **WhatsApp-Direktlink**, E-Mail-Vorlage, druckfertiger PDF-Teilnehmerliste oder CSV.
  * Live-Auswertungen, Net Promoter Score (NPS) und druckfertiger PDF-Ergebnisbericht für Vorstandssitzungen.
* **Massen-Import, Export & Etiketten:**
  * CSV/Excel-Import mit intelligentem Spalten-Mapping.
  * Export nach CSV, Excel, vCard (.vcf) sowie druckfertige PDF-Mitgliederlisten und Adressetiketten.

---

### 2. Finanz- & Kassenverwaltung (inkl. 4 Sphären & Rechnungen)

Rechtssichere und transparente Buchführung für den ehrenamtlichen Schatzmeister:

* **Das 4-Sphären-Buchungsjournal (§ 52 AO):**
  * Strikte Trennung aller Einnahmen und Ausgaben in *Ideeller Bereich*, *Vermögensverwaltung*, *Zweckbetrieb* und *Wirtschaftlicher Geschäftsbetrieb* (nach SKR 42).
  * Lückenloses Buchungsjournal mit automatischer Belegnummerierung, Buchungstext, Beleg-Upload und Steuersatz (0%, 7%, 19%).
* **Flexible Kontenverwaltung (Neu in v1.2.3):**
  * Beliebig viele eigene Zahlungskonten anlegen: Girokonten, Sparkassen, Festgeldkonten, Barkassen und PayPal.
  * Anpassbare IBAN, BIC und Anfangsbestände.
  * **Drag & Drop Sortierung:** Kontokarten per Maus in die gewünschte Reihenfolge schieben.
  * **Mauszeiger-Tooltips:** Dynamische Tooltips zeigen bei überlangen Kontobezeichnungen und IBANs den vollen Text direkt am Mauszeiger.
* **Individuelle Sachkonten & Kategorien:**
  * Freie Anlage und Verwaltung von Buchungskategorien je Sphäre für eine präzise Kontierung.
* **SEPA-Lastschriftlauf (pain.008.001.02 XML):**
  * Vollautomatischer Einzugslauf für Mitgliedsbeiträge nach ISO 20022.
  * Automatische Unterscheidung von Erst- (`FRST`), Folge- (`RCUR`) und Einmallastschriften (`OOFF`).
  * Automatische Anlage aller Buchungssätze im Journal nach erfolgreicher Generierung.
* **Einnahmen-Überschuss-Rechnung (EÜR / GuV):**
  * Automatischer Abschluss nach den 4 Sphären mit Vorjahresvergleich.
  * **Freigrenzenüberwachung:** Permanente Überprüfung der gesetzlichen 45.000 €-Einnahmegrenze im wirtschaftlichen Geschäftsbetrieb mit rechtzeitigen Warnhinweisen.
* **DIN 5008 Rechnungswesen:**
  * Rechnungen und Mahnungen nach deutscher DIN 5008 (Form A/B) mit Falt- und Lochmarken.
  * **Blanko-Briefpapier-Offset:** Millimetergenaue Anpassung von Kopf- und Fußabständen zum Bedrucken vorbedruckten Vereinspapiers.
* **Amtliche Zuwendungsbestätigungen (BMF):**
  * Spendenbescheinigungen für Geldspenden, Sachspenden und Aufwandsverzichte nach aktuellem amtlichen Muster inklusive Freistellungsbescheid-Verankerung.
* **Sammelaktionen im Kassenjournal:**
  * Checkbox-Mehrfachauswahl, schwebende Aktionsleiste für Sammeländerungen (Sphäre, Steuer, Konto) und revisionssicheres Sammellöschen.

---

### 3. Kontakt-, Partner- & Sponsorenverwaltung

Verwaltung aller vereinsrelevanten Kontakte außerhalb der Mitgliedschaft:

* **Stammdaten von Partnern & Sponsoren:**
  * Strukturierte Erfassung von Firmen, Verbänden (z. B. LSB, Fachverbände), Behörden, Dienstleistern, Übungsleitern und Sponsoren.
  * Hinterlegung von juristischem Namen, Ansprechpartner, Position, Telefon, E-Mail, Anschrift und Steuernummer.
* **Bankdaten & Zahlungsverkehr:**
  * Speicherung von IBAN/BIC für Überweisungen und Abrechnungen.
* **Verknüpfung mit Finanzen & Spenden:**
  * Direkte Auswahl von Kontakten bei Rechnungserstellung, Spendenbescheinigungen und Ausgabenbuchungen.
* **Schnellkommunikation & Export:**
  * Direkte Verlinkung zu E-Mail-Client und Telefonie, Export von Partnerlisten nach CSV und PDF.

---

### 4. Termine & Vereinskalender

Zentrale Koordination aller Trainingszeiten, Spiele und Events:

* **Interaktiver Kalender:**
  * Übersichtliche Monats-, Wochen- und Listenansichten mit responsiver Bedienung.
* **Sparten- & Liegenschaftsfilter:**
  * Farbliche Kennzeichnung und Filterung nach Sportart/Abteilung sowie nach Räumen/Plätzen (z. B. Sporthalle 1, Vereinsheim, Rasenplatz).
* **Serientermine & Wiederholungen:**
  * Wöchentliche Trainingseinheiten, monatliche Vorstandssitzungen oder jährliche Turniere mit flexiblen Wiederholungsregeln.
* **Teilnehmer- & Anwesenheitsverwaltung:**
  * Zuordnung von Trainern/Verantwortlichen und Dokumentation von Anwesenheiten.
* **iCal-Export (.ics):**
  * Export einzelner Termine oder ganzer Spartenkalender zum direkten Einbinden in Smartphone-Kalender (Google Kalender, Apple iCal, Microsoft Outlook).

---

### 5. Sitzungsdienst, Beschlussbuch & Versammlungen

Rechtssichere Durchführung und Dokumentation von Gremiensitzungen:

* **Sitzungsarten:**
  * Unterstützung von Vorstandssitzungen, Beiratssitzungen, Fachausschüssen und ordentlichen/außerordentlichen Mitgliederversammlungen nach § 32 BGB.
* **Tagesordnungen (TOPs) & Ablaufplanung:**
  * Strukturierte Tagesordnungspunkte mit Titeln, Beratungsnotizen, Referenten und Zeiteinteilung.
* **Beschlussbuch & Beschlussfähigkeit (Quorum):**
  * Automatische Feststellung der Beschlussfähigkeit anhand der Anwesenheitsliste und der Vereinssatzung.
  * Lückenlose, fortlaufende Beschlussnummerierung (`BES-JJJJ-XXX`) mit Dokumentation von Ja-, Nein- und Enthaltungsstimmen.
* **Digitale Signatur:**
  * Unterschriftserfassung auf Touchscreen, Tablet oder per Maus für Sitzungsleiter und Protokollführer.
* **DSGVO-konformer SMTP-Relay-Versand:**
  * Direkter E-Mail-Versand von Einladungen und Protokollen samt PDF über den vereinseigenen SMTP-Server.
  * **Automatischer BCC-Schutz:** Alle Mitglieder und Vorstände werden ausnahmslos per Blindkopie adressiert, um E-Mail-Adressen vor fremden Blicken zu schützen.

---

### 6. Inventar-, Material- & Geräteverwaltung

Transparente Verwaltung aller Sachwerte und Betriebsmittel des Vereins:

* **Sachmittelkatalog:**
  * Erfassung von Trainingsmaterialien, Bällen, Trikotsätzen, Turngeräten, IT-Equipment, Fahrzeugen, Werkzeugen und Schlüsseln.
  * Anschaffungspreise, Zeitwerte, Seriennummern und Aufbewahrungsorte.
* **Verknüpfung von Inventar und Mitgliedern (Neu in v1.2.3):**
  * **Direkte Ausleihe an Vereinsmitglieder:** Zuweisung von Gegenständen an registrierte Mitglieder mit Auswahl aus der aktiven Mitgliederliste.
  * Erfassung von Ausleihdatum, geplantem Rückgabedatum und Zustand bei Übergabe.
  * **1-Klick-Rücknahme:** Schnelle Rückbuchung direkt aus der Tabelle oder Kachelkarte mit sofortiger Freigabe des Gegenstands.
  * Lückenlose Historie aller bisherigen Entleiher.
* **Prüffristen & Sicherheitsvorschriften:**
  * Überwachung gesetzlicher Prüftermine: **DGUV Vorschrift 3** (elektrische Betriebsmittel), TÜV für Sport- und Großgeräte, UVV sowie Verfallsdaten von Erste-Hilfe-Kästen.
  * Farblich hervorgehobene Warn-Badges bei fälligen oder abgelaufenen Prüfterminen.
* **Sammelaktionen im Inventar:**
  * Checkbox-Auswahl in Tabelle und Kacheln für Massenaktualisierungen (Zustand, Standort, Prüfdatum) und selektiven CSV-/PDF-Export.
* **Etikettierung & Barcodes:**
  * Automatische Generierung von QR-Codes und Barcodes zur schnellen Identifikation per Smartphone-Kamera.

---

### 7. Revisionssicheres Dokumenten- & Belegarchiv

GoBD-konforme digitale Ablage für alle vereinsrelevanten Dokumente:

* **Strukturierte Ordner- & Kategorienhierarchie:**
  * Strukturierte Ablage für Satzungen, Registerauszüge (VR), Freistellungsbescheide, Pacht- und Mietverträge, Sitzungsprotokolle und Kassenbelege.
* **KI-gestützter Dokumenten- & Belegscanner:**
  * Multimodale Texterkennung (OCR via Google Gemini) für Belegscans, Rechnungs-PDFs und Smartphone-Fotos.
  * Automatische Extraktion von Rechnungsdatum, Bruttobetrag, Belegnummer und Zahlungsempfänger mit 1-Klick-Übernahme in das Kassenjournal.
* **Verknüpfung zu Buchungen & Mitgliedern:**
  * Revisionssichere Bindung hochgeladener Belege an die jeweiligen Buchungssätze im Journal und Aufnahmeanträge an das Mitglied.
* **Revisionssicheres Audit-Log:**
  * Unveränderliche Protokollierung aller Dateioperationen (Upload, Bearbeitung, Löschung) mit Benutzer- und Zeitstempel.
* **Integrierter Dokumentenbetrachter:**
  * Direkte Vorschau von PDFs, Scans und Bildern im Webbrowser oder Desktop-Client ohne externe Programme.

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
4. Klicken Sie auf **Zugangsdaten auf dem Server speichern** und anschließend auf
   **Speichern & Verbindung testen**, um die Funktionsfähigkeit sofort zu verifizieren.

**Wo diese Zugangsdaten liegen — und warum nicht bei den Vereinsdaten**

Seit Fassung 1.3 speichert die Anwendung diese Angaben auf dem Server, auf dem sie
läuft (Ordner `daten/`, per `VM_DATA_DIR` verlegbar; im Docker-Betrieb im Volume
`vereinsmanager_daten`). Das Passwort wird dort mit AES-256-GCM verschlüsselt
abgelegt; der Schlüssel liegt in einer eigenen Datei daneben, beide nur für den
Besitzer lesbar.

Das hat drei Folgen, die Sie kennen sollten:

* Das Passwort steht **in keiner Datensicherung** und in keiner Browser-Datenbank.
  Es verlässt den Server auch beim Versand nicht mehr.
* Die Anwendung kann es **nicht wieder anzeigen** — nur ersetzen oder entfernen.
* Nach einer Neuinstallation, einem Umzug oder einem `docker compose down -v`
  müssen die Zugangsdaten **einmalig neu eingetragen** werden.

Wer vollen Zugriff auf den Server hat, kann das Passwort weiterhin auslesen: Der
Server muss es im Klartext verwenden, um sich beim Mailanbieter anzumelden.
Hashen wie bei den Benutzerkonten der Anwendung ist deshalb nicht möglich.

In der **Desktop-Fassung (Tauri)** ist kein Server enthalten. Dort lassen sich
keine Zugangsdaten hinterlegen, und der Direktversand steht nicht zur Verfügung;
der Versand über das lokale E-Mail-Programm funktioniert weiterhin.

---

### Zugriffsschlüssel des Servers

Der Server beantwortet seit Fassung 1.3 keinen `/api`-Aufruf mehr ohne Ausweis.
Betroffen sind E-Mail-Versand, Belegerkennung und alle KI-Funktionen. Ohne
diesen Schutz könnte jeder, der die Adresse eines im Internet erreichbaren
Servers kennt, über das Postfach des Vereins Mails verschicken oder auf dessen
Rechnung KI-Anfragen stellen.

Es genügt einer von zwei Ausweisen:

**1. Der Zugriffsschlüssel dieser Installation.** Er entsteht beim ersten Start
von selbst und steht in der Startausgabe des Servers:

```bash
docker compose logs vereinsmanager    # Docker / NAS
```

* **Lokalbetrieb:** Das mitgelieferte Startskript liest ihn aus und hängt ihn
  an die Adresse an, die es im Browser öffnet. Hier ist nichts zu tun.
* **Docker / NAS:** Einmalig je Browser unter *Einstellungen → Allgemein*
  eintragen. Alternativ `VM_ACCESS_KEY` in der `.env` setzen — dann bleibt der
  Schlüssel auch nach einem Neuaufbau des Containers derselbe.

**2. Das Anmeldetoken aus dem Cloud-Betrieb.** Sind `SUPABASE_URL` und
`SUPABASE_ANON_KEY` zusätzlich als Umgebungsvariablen des **Servers** gesetzt
(nicht nur als `VITE_`-Werte, die gelten allein für den Browser), prüft der
Server das Anmeldetoken bei Supabase nach. Dann genügt die normale Anmeldung
in der App.

Die Statusseite `/api/health` bleibt offen, damit Docker den Container
überwachen kann.

> Im Lokalbetrieb benutzen alle Vorstandsmitglieder denselben
> Zugriffsschlüssel. Er hält Fremde draußen, unterscheidet aber die eigenen
> Leute nicht voneinander — dafür gibt es den Cloud-Betrieb mit persönlichen
> Konten.

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
