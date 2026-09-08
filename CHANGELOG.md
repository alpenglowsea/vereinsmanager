# Changelog

Alle relevanten Änderungen und Versionsstände des VereinsManagers werden in dieser Datei dokumentiert.

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
