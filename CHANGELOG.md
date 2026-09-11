# Changelog

Alle relevanten Änderungen und Versionsstände des VereinsManagers werden in dieser Datei dokumentiert.

---

## [v1.2.2] - 2026-09-11

### 🚀 Neue Features & Verbesserungen

#### 📋 Mehrfachauswahl & Sammelaktionen („Buchungen & Journal“)
- **Checkbox-Auswahl analog zur Mitgliederverwaltung:** Buchungen können nun einzeln oder über die Kopfzeilen-Checkbox („Alle sichtbaren auswählen“, inkl. `indeterminate`-Status) gesammelt markiert werden.
- **Schwebende Aktionsleiste (Sticky Action Banner):** Bei mindestens einer markierten Buchung ploppt über der Tabelle ein dunkles Banner mit Live-Zähler auf (`z-index: 30`).
- **Sammelbearbeitung:** Mehrere Buchungen gleichzeitig anpassen – inklusive Buchungsdatum, steuerlicher Sphäre (Ideeller Bereich, Vermögensverwaltung, Zweckbetrieb, Wirtschaftlicher Geschäftsbetrieb nach SKR 42), Buchungskategorie/Konto, Zahlungskonto sowie USt-Satz.
- **Revisionssichere Sammellöschung:** Markierte Buchungssätze mit detaillierter Sicherheitsabfrage und automatischer Audit-Log-Protokollierung in einem Schritt löschen.
- **Selektiver CSV- & PDF-Export:** Gezielter Export ausschließlich der aktuell ausgewählten Buchungszeilen.

#### 📦 Mehrfachauswahl & Sammelaktionen („Inventar“)
- **Umfassende Mehrfachauswahl:** Checkboxen sowohl in der Tabellenansicht als auch in den Inventarkarten (Grid-Ansicht) mit optischer Markierungs-Hervorhebung.
- **Schwebende Aktionsleiste:** Direkt über der Inventarliste mit Zähler und Schnellzugriff auf alle Sammeloperationen.
- **Sammelbearbeitung für Inventar:** Gleichzeitige Aktualisierung von Sparte/Abteilung, Materialart/Kategorie, Zustand (Neuwertig, Gut, Gebraucht, Reparaturbedürftig, Auszusondern), Standort/Aufbewahrungsort, nächstem Prüfdatum und Zeugwart/Zuständigkeit.
- **Sammellöschung mit Sicherheitsmodal:** Bestätigungsdialog mit Auflistung aller ausgewählten Gegenstände und lückenloser Revisionssicherheit.
- **Selektiver CSV- & PDF-Export:** Direkter Export nur der markierten Inventargegenstände inklusive Stückzahlen und Wertansätzen.

#### 🖱️ Konten-Dropdowns: Dynamische Mauszeiger-Tooltips
- **Vollständige Lesbarkeit überlanger Bezeichnungen:** In den Drop-Down-Listen für Haupt- und Nebenkonto (z. B. Buchungsjournal, Buchungsmodal) wird beim Überfahren mit der Maus (`hover`) ein schwebendes, direkt am Mauszeiger haftendes Pop-up eingeblendet.
- Auch sehr lange Bankverbindungen, IBAN-Zusätze und Unterkontenbezeichnungen sind damit ohne horizontales Scrollen oder Abschneiden sofort vollständig lesbar.

---

## [v1.2.1] - 2026-09-10

### 🚀 Neue Features & Verbesserungen
- **Finanzkonten per Drag & Drop sortieren:** Bank- und Barkassen-Karten lassen sich direkt mit der Maus in jede gewünschte Reihenfolge verschieben und persistent speichern.
- **Interaktive Tabellensortierung im Journal:** Alle Spaltenköpfe des Kassenjournals (Datum, Beleg-Nr., Buchungstext, Sphäre, Kategorie, Beleg, Betrag) sind per Klick auf- und absteigend sortierbar.
- **Detailansicht für Buchungen:** Buchungszeilen lassen sich analog zur Mitgliederkartei anklicken und öffnen ein detailliertes Beleg- und Buchungsinformations-Modal.
- **Vorstand & Spartenverwaltung:** Optimierte Benennung und Drag & Drop Sortierung.
- **KI-Modell-Aktualisierung:** Umstellung der Beleg- und Dokumentenerkennung auf aktuelle multimodale Gemini-Modelle.

---

## [v1.2.0] - 2026-09-08

### 🚀 Neue Features & Verbesserungen

#### 💾 Freie Wahl des Speicherorts (Native File System Access API)
- **Speicherort-Auswahl bei Datensicherungen:** Beim Herunterladen der vollständigen Datensicherung (`.json`) in den Einstellungen, über die Schnell-Sicherung oder den Datenschutz-Dialog öffnet sich nun das native Betriebssystem-Fenster *„Speichern unter…“*. Der Zielordner (z. B. lokaler Ordner, Netzlaufwerk, USB-Stick) und der Dateiname können frei gewählt werden.
- **Export von Listen und Belegen:** Gleiche native Speicherort-Unterstützung für CSV- und PDF-Exporte (Mitgliederliste, Buchungslisten, Jahresberichte).
- **Benutzerfreundliches Feedback:** Informative Erfolgsmeldung mit Nennung des gewählten Dateinamens sowie neutraler Hinweis bei manuellem Abbruch des Dialogs.

#### 📄 Mitgliedsanträge & KI-Scan-Importer
- **Direkter Client-Side KI-Fallback:** Die automatische Texterkennung handschriftlicher oder gedruckter Aufnahmeanträge (PDF, Scans, Smartphone-Fotos) funktioniert nun auch in der lokalen Desktop-App (Tauri / Offline-Betrieb) ohne Node-Server via direkter Anbindung an die Google Gemini Multimodal REST API (`gemini-2.5-flash`, `gemini-3.7-flash`).
- **Manueller Erfassungs-Fallback:** Neue Schaltfläche *„Ohne KI manuell erfassen & PDF übernehmen“* – ermöglicht das Erfassen und Archivieren des Antrags auch ohne hinterlegten API-Schlüssel, bei Netzwerkausfall oder API-Wartung.
- **Verbessertes Drag & Drop:** Fehlerfreie Annahme von Dateien unabhängig von Groß-/Kleinschreibung der Endung (`.PDF`, `.JPG`, `.png`, `.webp`), Beseitigung von Drag-Event-Flackern und problemlose Wiederholungsauswahl im Dateiauswahldialog.

#### 👥 Mitgliederverwaltung & Stammdaten
- **Aufnahmeantrag hochladen & archivieren:** Im Tab *„Antrag, Notizen & DSGVO“* können unterschriebene Aufnahmeanträge als PDF oder Bild hochgeladen werden. Der Antrag wird automatisch in den Mitgliedsdaten verankert und in der vereinsweiten Dokumentenverwaltung revisionssicher abgelegt.
- **Interaktive Tabellensortierung:** Sämtliche Spalten der Mitgliederliste (ID, Name, Status, Abteilung/Sparte, Eintrittsdatum, Wohnort/PLZ, Beitrag, Zahlungsart) können per Klick auf die Spaltenüberschrift auf- und absteigend sortiert werden.
- **Zahlungsmethode „Beitragsfrei“:** Neue Option in den Bank- und Zahlungsstammdaten für Ehrenmitglieder, Funktionäre oder freigestellte Mitglieder. Befreit von Pflichtfeldern (IBAN/BIC), synchronisiert den Beitragsrhythmus und hebt den Status optisch hervor.
- **Fälligkeitstag-Synchronisation:** Zuverlässige Erhaltung des gewählten Fälligkeitstags (1. oder 15. des Monats) beim Wechsel zwischen den Stammdaten-Reitern.

### 🐛 Fehlerbehebungen (Bugfixes)
- **JSON-Syntaxfehler im Scan-Importer behoben:** Beseitigung des Fehlers `Unexpected token '<', "<!doctype "... is not valid JSON`, der in lokalen Desktop-Clients auftrat, wenn Server-Endpunkte als HTML ausgeliefert wurden.
- **Synchronisation von Reitern und Stammdaten:** Korrektur von Feldüberschreibungen beim Navigieren im Mitgliedsbearbeitungs-Modal.
- **Browser- und Webview-Kompatibilität:** Zuverlässiger Fallback auf den Standard-Browser-Download, falls die File System Access API von der Umgebung nicht unterstützt wird.

---

## [v1.1.0] - Vorheriges Release
- Grundsteinlegung der Desktop-Applikation mit Tauri (Windows `.exe`/`.msi`, macOS `.dmg`, Linux `.AppImage`).
- Erweiterung der SEPA-XML-Generierung (pain.008) und Rechnungsverwaltung.
- Revisionssichere Beleg- und Dokumentenablage.
