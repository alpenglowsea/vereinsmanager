# 🏛️ VereinsManager

> **Kostenlose, DSGVO-konforme und revisionssichere Vereinsverwaltung für gemeinnützige Vereine (e.V.) in Deutschland.**  
> Läuft vollständig lokal auf einem Gerät — als native Desktop-App (Tauri) oder im Browser —, ohne Cloud, ohne Abonnement, ohne dass irgendetwas den Rechner verlässt.

---

## 📑 Inhaltsverzeichnis

- [Überblick & Leitphilosophie](#-überblick--leitphilosophie)
- [Systemarchitektur](#-systemarchitektur)
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
  - [3. DIN 5008 Rechnungs-Engine & Blanko-Briefpapier-Offset](#3-din-5008-rechnungs-engine--blanko-briefpapier-offset)
  - [4. Sitzungsdienst & Beschlussbuch](#4-sitzungsdienst--beschlussbuch)
- [Installations- & Betriebsanleitung](#-installations---betriebsanleitung)
  - [Voraussetzungen](#voraussetzungen)
  - [Die Desktop-App nutzen (empfohlener Weg)](#die-desktop-app-nutzen-empfohlener-weg)
  - [Alternativ: Start aus dem Quellcode im Browser](#alternativ-start-aus-dem-quellcode-im-browser)
  - [Zugriffsschlüssel des Servers](#zugriffsschlüssel-des-servers)
- [Datensicherheit, Revisionssicherheit & Backups](#-datensicherheit-revisionssicherheit--backups)
- [Lizenz](#-lizenz)

---

## 🌟 Überblick & Leitphilosophie

**VereinsManager** wurde speziell entwickelt, um ehrenamtlichen Vereinsvorständen, Schatzmeistern, Abteilungsleitern und Geschäftsstellen ein professionelles, intuitives Werkzeug an die Hand zu geben, ohne sie in kostspielige Software-Abonnements oder Cloud-Silos zu zwingen.

* **100 % Datensouveränität:** Alle Daten verbleiben ausschließlich lokal auf dem eigenen Rechner (Browser-Datenbank). Es gibt keinen Cloud-Dienst, an den etwas übertragen wird.
* **Vollständige Rechtssicherheit für deutsche e.V.:** Berücksichtigt die strengen Vorgaben der Abgabenordnung (AO), des BGB, der DSGVO sowie die Richtlinien des Bundesfinanzministeriums (BMF).
* **Ein Gerät, keine Serverinfrastruktur:** Die Anwendung ist bewusst auf einen einzigen Arbeitsplatz zugeschnitten (z. B. den Rechner des Kassenwarts oder im Vereinsheim) — kein eigener Server, kein Netzwerkzugriff von außen, keine Cloud-Anmeldung.

---

## 🏗️ Systemarchitektur

VereinsManager läuft vollständig auf einem einzigen Gerät. Es gibt bewusst nur eine Betriebsart:

```text
        ┌──────────────────────────────────────────────────────────────────────┐
        │                        VereinsManager Frontend                       │
        │              (React 19 + TypeScript + Tailwind CSS)                  │
        └───────────────────────────────────┬────────────────────────────────┘
                                              │
                                              ▼
                                ┌────────────────────────┐
                                │   Browser-Datenbank     │
                                │  (100 % lokal, offline) │
                                └────────────────────────┘
```

Alle Vereinsdaten (Mitglieder, Buchungen, Dokumente, Einstellungen …) liegen ausschließlich in der Browser-Datenbank dieses einen Geräts. Es gibt keinen Datenabgleich zwischen mehreren Geräten und keine Mehrbenutzer-Anmeldung — wer die App nutzt, nutzt sie an diesem einen Arbeitsplatz.

**Zwei gleichwertige Wege, dieselbe Anwendung zu öffnen:**

1. **Als native Desktop-App (Tauri v2)** — der empfohlene Weg für den laufenden Betrieb. Fertige Installationspakete für Windows (`.exe`/`.msi`), macOS (`.dmg`) und Linux (`.deb`/`.AppImage`) über GitHub Releases. Die App bringt einen kleinen, mitgelieferten Server mit, der ausschließlich auf diesem einen Rechner lauscht (`127.0.0.1`) — aus dem Netzwerk ist er nicht erreichbar.
2. **Direkt aus dem Quellcode im Systembrowser** — über die beiliegenden Startskripte (`start-windows.bat` / `start-mac-linux.sh`). Praktisch zum Ausprobieren oder für die Entwicklung; nutzt denselben, nur lokal lauschenden Server.

In beiden Fällen dieselbe Anwendung, dieselben Daten, derselbe Funktionsumfang.

---

## 🏛️ Die 7 Hauptfunktionen der App im Detail

VereinsManager gliedert sich in **sieben voll integrierte Hauptmodule**, die sämtliche operativen und gesetzlichen Aufgaben eines eingetragenen Vereins (e.V.) abdecken:

```text
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                                 VEREINSMANAGER HAUPTMODULE                                  │
├──────────────┬──────────────┬──────────────┬──────────────┬──────────────┬──────────────┬──────────────┤
│ 1. MITGLIEDER│ 2. FINANZEN  │ 3. KONTAKTE  │ 4. KALENDER  │ 5. SITZUNGEN │ 6. INVENTAR  │ 7. DOKUMENTE │
│ • Stammdaten │ • 4 Sphären  │ • Partner    │ • Termine    │ • Versammlung│ • Geräte     │ • Belegarchiv│
│ • Beiträge   │ • Eigene Kto.│ • Sponsoren  │ • Sparten    │ • Beschlüsse │ • Ausleihe an│ • Revision   │
│ • Online-Antr│ • SEPA XML   │ • Verbände   │ • Räume      │ • Protokolle │   Mitglieder │ • Verknüpfung│
│ • Statistiken│ • EÜR / DIN  │ • Schnittst. │ • iCal-Sync  │ • PDF-Export │ • Prüffristen│ • Volltext   │
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
  * **Option *„Beitragsfrei"*:** Für Ehrenmitglieder, Schiedsrichter oder beurlaubte Mitglieder. Befreit automatisch von Pflichtangaben (IBAN/BIC), sperrt den Einzug und hebt den Status in der Kartei hervor.
  * Frei wählbarer Fälligkeitstag (1. oder 15. des Monats) für maßgeschneiderte Kassenläufe.
* **Status- & Spartenmanagement:**
  * Statusarten: *Aktiv*, *Passiv*, *Ehrenmitglied* und *Ausgetreten*.
  * **Automatische Beitragssperre:** Bei Status *Ausgetreten* wird das Mitglied sofort vor versehentlichen SEPA-Einzügen oder Rechnungsstellungen geschützt.
  * Beliebig viele Abteilungen/Sparten (z. B. Fußball, Turnen, Tennis) mit individueller Zuordnung und Sortierung per Drag & Drop.
* **Digitale Aufnahmeanträge:**
  * Digitales Aufnahmeformular mit Signaturfeld (Touchscreen/Maus) zur Erfassung durch den Vorstand — etwa am eigenen Gerät bei einem Vereinstermin oder beim Nacherfassen eines Papierantrags.
  * Automatische Erfassung des SEPA-Lastschriftmandats mit rechtssicherem Bestätigungstext.
  * Übersicht aller erfassten Anträge für den Vorstand mit 1-Klick-Übernahme in den regulären Mitgliederbestand.
* **Mitglieder-Statistiken & Demografie:**
  * Grafische Analysen der Altersverteilung, Geschlechteranteile, Spartenbelegungen und Eintritts-/Austrittstrends.
* **Massen-Import, Export & Etiketten:**
  * CSV/Excel-Import mit intelligentem Spalten-Mapping.
  * Export nach CSV, Excel, vCard (.vcf) sowie druckfertige PDF-Mitgliederlisten und Adressetiketten.

---

### 2. Finanz- & Kassenverwaltung (inkl. 4 Sphären & Rechnungen)

Rechtssichere und transparente Buchführung für den ehrenamtlichen Schatzmeister:

* **Das 4-Sphären-Buchungsjournal (§ 52 AO):**
  * Strikte Trennung aller Einnahmen und Ausgaben in *Ideeller Bereich*, *Vermögensverwaltung*, *Zweckbetrieb* und *Wirtschaftlicher Geschäftsbetrieb* (nach SKR 42).
  * Lückenloses Buchungsjournal mit automatischer Belegnummerierung, Buchungstext, Beleg-Upload und Steuersatz (0%, 7%, 19%).
* **Flexible Kontenverwaltung:**
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
* **Protokoll-Versand:**
  * Fertiges Protokoll als PDF exportieren und über das lokale E-Mail-Programm an Mitglieder und Vorstände verschicken (`mailto:`-Link mit vorausgefülltem Text, Anhang wird separat heruntergeladen).

---

### 6. Inventar-, Material- & Geräteverwaltung

Transparente Verwaltung aller Sachwerte und Betriebsmittel des Vereins:

* **Sachmittelkatalog:**
  * Erfassung von Trainingsmaterialien, Bällen, Trikotsätzen, Turngeräten, IT-Equipment, Fahrzeugen, Werkzeugen und Schlüsseln.
  * Anschaffungspreise, Zeitwerte, Seriennummern und Aufbewahrungsorte.
* **Verknüpfung von Inventar und Mitgliedern:**
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
* **Verknüpfung zu Buchungen & Mitgliedern:**
  * Revisionssichere Bindung hochgeladener Belege an die jeweiligen Buchungssätze im Journal und Aufnahmeanträge an das Mitglied.
* **Revisionssicheres Audit-Log:**
  * Unveränderliche Protokollierung aller Dateioperationen (Upload, Bearbeitung, Löschung) mit Zeitstempel.
* **Integrierter Dokumentenbetrachter:**
  * Direkte Vorschau von PDFs, Scans und Bildern direkt in der Anwendung, ohne externe Programme.

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

### 3. DIN 5008 Rechnungs-Engine & Blanko-Briefpapier-Offset

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

### 4. Sitzungsdienst & Beschlussbuch

Für rechtskonforme Vorstandssitzungen und Mitgliederversammlungen nach § 32 BGB:

* **Tagesordnungen & Quorum:** Automatische Ermittlung der Beschlussfähigkeit anhand der Anwesenheitsliste und der Vereinssatzung.
* **Beschlussfassung:** Jeder Beschluss erhält eine eindeutige, fortlaufende Nummer (`BES-JJJJ-XXX`) und dokumentiert Ja-, Nein- und Enthaltungsstimmen.
* **Digitale Signatur:** Protokollführer und 1. Vorsitzender können das Protokoll direkt auf einem Touchscreen (Tablet, Smartphone) oder per Maus digital gegenzeichnen.
* **Versand:** Das fertige Protokoll samt PDF wird über das lokale E-Mail-Programm verschickt (`mailto:`-Link) — ein direkter Versand ab der Anwendung selbst findet nicht statt.

---

## 🚀 Installations- & Betriebsanleitung

### Voraussetzungen

Für die fertigen Installationspakete (empfohlener Weg) wird nichts weiter benötigt — siehe unten.

Nur für den Start aus dem Quellcode:
* **Node.js:** Version 20.x oder 22.x LTS
* **npm:** Version 9.x oder neuer

### Die Desktop-App nutzen (empfohlener Weg)

1. Unter den [GitHub Releases](https://github.com/alpenglowsea/vereinsmanager/releases) das passende Paket herunterladen:
   * **Windows:** `.exe`-Installer oder `.msi`
   * **macOS:** `.dmg` (Apple Silicon: M1 und neuer)
   * **Linux:** `.deb` (empfohlen) oder `.AppImage`
2. Installieren bzw. starten — die App öffnet ihr eigenes Fenster und bringt den dafür nötigen Server gleich mit. Er lauscht ausschließlich auf diesem Rechner (`127.0.0.1`) und ist aus dem Netzwerk nicht erreichbar.

Details zum Bau eigener Releases: [`DESKTOP_RELEASE.md`](DESKTOP_RELEASE.md).

---

### Alternativ: Start aus dem Quellcode im Browser

```bash
git clone https://github.com/alpenglowsea/vereinsmanager.git
cd vereinsmanager
npm install
```

Danach eines der beiliegenden Startskripte ausführen:
* **Windows:** Doppelklick auf `start-windows.bat`
* **macOS / Linux:** `./start-mac-linux.sh`

Beide installieren bei Bedarf die Pakete, starten den lokalen Server und öffnen die Anwendung automatisch im Systembrowser — mit demselben Zugriffsschlüssel-Mechanismus wie die Desktop-App (siehe unten), nur eben im Browserfenster statt im eigenen Programmfenster.

Für die reine Entwicklung (Hot-Reload) steht außerdem `npm run dev` zur Verfügung; die Anwendung läuft dann unter `http://localhost:3000`.

---

### Zugriffsschlüssel des Servers

Der mitgelieferte Server beantwortet keinen `/api`-Aufruf ohne Ausweis. Das betrifft heute nur noch den Fehlerbericht-Knopf in den Einstellungen (`/api/submit-bugreport`) — alle anderen Bereiche (Mitglieder, Finanzen, Dokumente, …) arbeiten unabhängig vom Server, direkt in der Browser-Datenbank.

Der Zugriffsschlüssel entsteht beim ersten Start von selbst. Sowohl die Desktop-App als auch die Startskripte übergeben ihn automatisch — hier ist normalerweise nichts zu tun. Nur falls das einmal nicht funktioniert hat (z. B. durch gesperrten Browser-Speicher im privaten Modus), zeigt die Anwendung eine Maske zum manuellen Eintragen; der Schlüssel steht dann in der Startausgabe des Servers (das Fenster bzw. Terminal, in dem er läuft).

Da der Server ausschließlich auf `127.0.0.1` lauscht, kann ohnehin niemand außerhalb dieses einen Rechners auf ihn zugreifen.

---

## 🔒 Datensicherheit, Revisionssicherheit & Backups

* **Keine externen Tracking-Dienste:** Keine Cookies von Drittanbietern, keine Telemetrie-Tracker.
* **1-Klick-Gesamt-Backup:**  
  Unter **Systemeinstellungen > Datensicherung & Import** kann zu jedem Zeitpunkt eine vollständige, unverschlüsselte JSON-Sicherungsdatei der gesamten Vereinsdatenbank (Mitglieder, Buchungen, Belege, Rechnungen, Protokolle, Einstellungen) heruntergeladen und auf einem USB-Stick oder Netzlaufwerk archiviert werden.
* **Wiederherstellung (Restore):**  
  Die gesicherte JSON-Datei kann in jeder frischen VereinsManager-Instanz mit einem Klick vollständig wieder eingespielt werden.

---

## 📄 Lizenz

Dieses Projekt ist unter der **Apache 2.0 Lizenz** veröffentlicht – siehe die beiliegende [LICENSE](LICENSE) Datei für Details.  
Freie Nutzung für alle gemeinnützigen Vereine, Initiativen und Organisationen.
