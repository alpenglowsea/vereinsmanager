# Changelog

Alle relevanten Änderungen und Versionsstände des VereinsManagers werden in dieser Datei dokumentiert.

---

## [Unveröffentlicht] — Fehlerbehebungen nach dem Abgleich mit der Android-Fassung

Beim Bau der Android-App sind Fehler der Desktop-Fassung aufgefallen
(Liste: `claude/desktop-aenderungen.md`, Reihenfolge:
`claude/desktop-umsetzungsplan.md`). Sie werden paketweise behoben.

### Paket 01 — SEPA-Datei (D-53, D-20)

- **Neues Dateiformat pain.008.001.08 (D-53):** Die Lastschriftdatei wird
  jetzt im aktuellen Format geschrieben. Die bisherige Datei
  (pain.008.001.02) wurde von der Bank mit „XML-Dokument ist nicht gültig“
  abgewiesen. Im Beitragslauf gibt es ein neues Feld „Dateiformat“; das alte
  Format bleibt wählbar. Unterschiede: neuer Namensraum, `BICFI` statt `BIC`,
  keine `schemaLocation`-Angabe mehr, Kennungen ohne Unterstrich und mit
  höchstens 35 Zeichen (vorher z. B. `PMT-monthly_15-…`).
- **Ein Zahlungsblock je Mandatsfolge (D-20):** Bisher stand über allen Posten
  fest „Folgelastschrift“ (RCUR), egal was beim Mitglied eingetragen war.
  Jetzt bilden Erst-, einmalige, Folge- und letzte Lastschriften je einen
  eigenen Block mit eigener Anzahl und Kontrollsumme.
- **Rechnen in ganzen Cent:** Kontrollsummen, das Prüfprotokoll und das
  Teilen eines Beitrags (z. B. Jahresbeitrag im Monatslauf) rechnen in Cent
  statt mit Kommazahlen; Rundungsabweichungen von einem Cent sind damit
  ausgeschlossen.
- Tests: sieben neue in `sepaService.test.ts` (Formate, Blöcke je Folge,
  Kennungen, Rundung).
- Nicht gegen die offizielle Schemadatei der Deutschen Kreditwirtschaft
  geprüft; der Aufbau folgt der Android-Datei, die die Sparkasse des Vereins
  am 10.11.2026 angenommen hat.

### Paket 02 — Formulare verlieren nichts (D-13, D-43, D-60, D-116)

Vier Formulare bauten den Datensatz beim Speichern aus ihren Eingabefeldern
neu auf. Alles, was das Formular nicht kennt, ging dabei verloren.

- **Sitzung (D-116):** Ein unterschriebenes Protokoll verlor beim Bearbeiten
  seine Unterschriften, den Verweis auf das archivierte PDF und die Angabe
  zur eigenen Vorlage. Sie bleiben jetzt erhalten.
- **Rechnung (D-43):** Zahldatum, Zahlart, die verknüpfte Buchung und der
  Verweis auf das abgelegte PDF bleiben beim Bearbeiten erhalten.
- **Buchung (D-13) und Kontakt (D-60):** Felder, die das Formular nicht
  kennt (etwa aus der Android-Fassung), bleiben erhalten. Beim Kontakt gilt
  das auch für Adresse, Bankverbindung und Ansprechpartner. Eine vollständig
  geleerte Bankverbindung wird weiterhin entfernt.
- Gemeinsame Hilfsfunktion `src/utils/keepUnknownFields.ts` mit acht Tests.

### Paket 30, Teil 1 — Sicherungspaket der Android-App einspielen (D-06)

- **Neu:** Unter Einstellungen → Datensicherung und im Einrichtungsfenster
  lässt sich jetzt auch das Sicherungspaket der Android-App einspielen: eine
  ZIP-Datei mit `sicherung.json` und den Belegen, Dokumenten und Fotos als
  einzelnen Dateien (Format 1.3.0), **auch mit Passwort** (AES-256). Die
  Datei wird am Inhalt erkannt, nicht an der Endung.
- Beim Einlesen werden die Dateien wieder in die Einträge gesetzt (so
  speichert der Desktop sie bisher). Danach läuft alles über den vorhandenen
  Einspielweg mit Vorschau, Sicherheitskopie und der Wahl zwischen Ersetzen
  und Ergänzen.
- Falsches oder fehlendes Passwort und beschädigte Pakete werden mit einer
  eigenen Meldung abgewiesen, bevor etwas am Bestand geändert wird. Fehlt im
  Paket eine Datei, auf die ein Eintrag verweist, wird der Eintrag ohne Datei
  übernommen und das gemeldet.
- Eigener Code ohne neue Pakete: ZIP-Leser (`src/utils/zipReader.ts`),
  Entpacken (`src/utils/inflate.ts`), AES für ZIP (`src/utils/aes.ts`),
  Übersetzung (`src/services/backupPaket.ts`); 42 neue Tests, geprüft gegen
  zlib und OpenSSL von Node.
- **Noch nicht umgesetzt:** das Schreiben eines Pakets am Desktop. Der
  Desktop sichert weiterhin als JSON-Datei.

### Paket 03 — Sicherung vollständig (D-12, D-31)

- **Eigene SKR-42-Konten in der Sicherung (D-12):** Selbst angelegte Konten
  und Nummernkreise lagen nur im Browserspeicher und fehlten in jeder
  Sicherung. Sie werden jetzt mitgesichert (im Bereich `settings`, Feld
  `customSkr42Accounts`) und beim Einspielen wiederhergestellt: bei
  „Ersetzen“ ersetzt, bei „Ergänzen“ um Fehlendes ergänzt. Enthält eine
  Sicherung das Feld nicht (ältere Datei, Sicherung vom Handy), bleiben die
  vorhandenen eigenen Konten unangetastet.
- **Kontenreihenfolge (D-31):** Die Reihenfolge der Konten steht jetzt allein
  am Konto selbst (Feld `order`) und damit in der Sicherung. Die frühere
  Liste im Browserspeicher wird nur noch einmalig übernommen. Nach dem
  Einspielen einer Sicherung gilt die Reihenfolge aus der Sicherung; ein
  bearbeitetes Konto behält seinen Platz, ein neues kommt ans Ende.
- **Bankkonto wird Barkasse:** IBAN und BIC werden dabei geleert, statt
  unsichtbar am Konto stehen zu bleiben.
- Fünf neue Tests für das Sichern und Einspielen der eigenen Konten.

### Paket 04 — Nummernvergabe (D-07, D-28, D-48, D-59, D-61, D-66, D-98, D-120)

Nummern wurden an vielen Stellen als „Anzahl der Einträge plus eins“
vergeben. Nach dem Löschen eines Eintrags entstand so eine Nummer doppelt.
Jetzt gilt überall: höchste vorhandene Nummer plus eins
(`src/utils/nummern.ts`, 21 Tests).

- **Belege, Rechnungen, Zuwendungsbestätigungen** (`BE-`, `RE-`, `ZB-`):
  höchste Nummer des Jahres plus eins.
- **Bankimport** (`BK-`): zählt die vorhandenen Nummern des Jahres weiter,
  statt bei jedem Import wieder bei 1 zu beginnen.
- **Kontakt-Import:** Kontaktnummern aus der höchsten vorhandenen
  fortgezählt.
- **Mitgliedsnummer:** Vorschlag aus der höchsten vergebenen Nummer im
  Schema des Bestands (z. B. `M-0107` → `M-0108`).
- **Inventarnummer:** fortlaufend im Schema des Bestands (`INV-001`,
  `INV-002` … oder z. B. `INV-FB-003`) statt einer Zufallszahl.
- **Tagesordnungspunkte:** neuer Punkt = höchste TOP-Nummer plus eins; nach
  dem Entfernen eines Punkts wird lückenlos durchgezählt (nur wenn alle
  Punkte die Form „TOP n“ haben), die Beschlüsse des Punkts ziehen mit.
- **Doppelte Nummern werden abgelehnt:** Mitgliedsnummer, Kontaktnummer und
  Inventarnummer, ohne Rücksicht auf Groß-/Kleinschreibung. Das
  Kontaktformular zeigt Fehler an der Kontaktnummer jetzt auch an.

### Paket 05 — Löschen räumt auf (D-08, D-30, D-31, D-104, D-124, D-146)

Gelöscht wurde an mehreren Stellen ohne Rücksicht auf Verknüpfungen. Die
Regeln stehen jetzt gesammelt in `src/utils/loeschRegeln.ts` (13 Tests) und
entsprechen der Android-Fassung.

- **Buchung löschen (D-08, D-30):** Das Beleg-Dokument der Buchung in der
  Dokumentenverwaltung wird mitgelöscht, einzeln und beim Sammellöschen.
  Vorher blieb es als Waise stehen.
- **Konto löschen (D-31):** Hängen Buchungen am Konto, fragt das Kontenfenster,
  welches andere Konto sie übernimmt, und überträgt sie. Läge dadurch eine
  Umbuchung zwischen ein und demselben Konto, wird nichts geändert und der
  Grund genannt. Vorher blieben die Buchungen ohne Konto zurück.
- **Inventar löschen (D-104):** Ein Gegenstand, der noch an Mitglieder
  ausgegeben ist, lässt sich nicht löschen; der Dialog nennt Mitglieder und
  Stückzahl. Das Sammellöschen überspringt solche Gegenstände und zählt sie
  anschließend auf.
- **Sparte löschen (D-146):** wird verweigert, solange Mitglieder, Buchungen
  (auch Teilbuchungen) oder Inventar sie verwenden; die Meldung nennt die
  Anzahl.
- **Sitzung löschen (D-124):** Ein archiviertes Protokoll in der
  Dokumentenverwaltung bleibt beim Löschen der Sitzung erhalten (wie bei
  Android). Vorher wurde es ohne Rückfrage mitgelöscht.

### Paket 29 — Neues Mitglied aufnehmen (D-96, D-95, D-04)

Wie in der Handy-App: Das neue Mitglied füllt den Antrag im Beisein des
Vereins am Desktop selbst aus und unterschreibt; danach prüft der Verein und
nimmt auf. Regeln in `src/utils/antragRegeln.ts`, PDF-Aufbau in
`src/services/antragPdf.ts` (19 Tests mit denselben Fällen wie Android
`AntragTest.kt`). Das Aussehen ist das des Desktops.

- **Menü Mitglieder → „Neues Mitglied aufnehmen“** öffnet den Antrag als
  Vollbild in fünf Schritten (Person, Mitgliedschaft, Zahlung, Erklärungen,
  Prüfen), große Schrift, Fehler am Feld und neben dem Knopf. Verlassen nur
  über „Abbrechen (Vereinsvertreter)“ mit Rückfrage. Unter 18: gesetzlicher
  Vertreter mit eigener Unterschrift, Mitgliedsart „Kinder und Jugendliche“
  wird vorgeschlagen. Fremdes Konto: der Kontoinhaber unterschreibt das
  Mandat selbst (außer er ist der Vertreter).
- **Prüfen durch den Verein:** Übersicht, Warnung bei möglicher Dublette
  (gleicher Name oder gleiche E-Mail), Mitgliedsnummer mit Vorschlag.
  „Als Mitglied aufnehmen“ legt das PDF im Archiv („Digitale
  Aufnahmeanträge“) und das Mitglied an, zusammen oder gar nicht; danach
  öffnet sich das neue Mitglied. Nichts wird erfunden: keine BIC, keine
  Bank, Mandatsreferenz `MANDAT-<Nr>-<Jahr>`, Erstlastschrift. Der Antrag
  selbst wird nirgends aufbewahrt; „Verwerfen“ löscht ihn.
- **Einstellungen → Aufnahmeantrag:** Texte für Einwilligung und Satzung
  (mit „Standardtext wiederherstellen“), Satzung und Datenschutz-Vordruck als
  PDF (jede Fassung als eigenes Dokument im Archiv, das neue Mitglied kann
  sie in Schritt 4 öffnen), leeres Antragsformular als PDF zum Ausdrucken
  (D-95), mit dem Briefpapier der Rechnungsvorlage. Gleiche Felder wie
  Android (`applicationPrivacyText`, `applicationStatuteText`,
  `applicationStatuteDocId`, `applicationPrivacyDocId`).
- **Entfallen (D-96, Entscheidung 25.10.2026):** öffentliches
  Online-Formular, Antragsliste mit Ablehnen-Archiv, Prüffenster, eigene
  Antragsvorlage, Dashboard-Kachel „Online-Mitgliedsanträge“ und die beiden
  orangefarbenen Hinweise. Gelöscht: `OnlineApplicationsView`,
  `PublicApplicationForm`, `ApplicationReviewModal`,
  `ApplicationTemplateModal`, `DigitalSignaturePad`, `membershipPdfService`.
- **Sicherung (D-04):** `onlineApplications` und `applicationSettings` werden
  nicht mehr geschrieben; in älteren Dateien überlesen. Die Datenbank
  entfernt die beiden Bereiche samt Inhalt beim ersten Start (Version 10).

### Logo: echt durchsichtig, und als App-Symbol am Handy

- **`public/logo_transparent.png`**: Das „durchsichtige“ Logo hatte das
  graue Schachbrettmuster, mit dem Bildprogramme Durchsichtigkeit anzeigen,
  fest ins Bild gemalt, auch blass innerhalb des Wappens. Jetzt ist der
  Hintergrund wirklich durchsichtig, das Wappen innen reinweiß. Sichtbar wurde
  das Muster im Dunkelmodus (Logo oben links) und im Browser-Tab.
- **Android-Symbol**: statt des grünen Android-Männchens das Otter-Logo auf
  Weiß, so verkleinert, dass das ganze Wappen in jeder Symbolform (rund,
  abgerundet, eckig) sichtbar bleibt. Dazu eine einfarbige Fassung für
  „Designte Symbole“. Die Bilder liegen je Bildschirmdichte als
  `ic_launcher_foreground.png` und `ic_launcher_monochrome.png` in
  `mipmap-*dpi`; `drawable/ic_launcher_foreground.xml` (das Männchen) ist
  entfernt.
- Desktop-Symbole (`src-tauri/icons`) unverändert; sie zeigten das Logo schon
  auf Weiß.

### Version 2.0.0: gemeinsame Nummer, signierte Handy-Fassung auf GitHub

Entscheidungen vom 25.11.2026: Versionssprung auf 2.0.0 (die alten
1.x-Veröffentlichungen stammen aus der Zeit vor dem Umbau), reguläre
Veröffentlichung statt Vorabversion, Desktop für Windows, macOS und Linux.
- **Eine Nummer für Desktop und Handy:** 2.0.0 in `package.json`,
  `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml` und
  `android/app/build.gradle.kts` (`vmVersion`; vorher Handy „1.0“). Die
  laufende Nummer für Android wird daraus berechnet (2.0.0 → 20000).
- **Bauablauf** (`release-desktop.yml`, jetzt „VereinsManager Release
  (Desktop und Handy)“):
  - neuer erster Schritt `pruefen`: bricht ab, wenn die Marke nicht zur
    Nummer an allen vier Stellen passt;
  - Veröffentlichung regulär (`prerelease: false`), sonst fände die
    Versionsprüfung sie nicht; neuer Text mit Installationshinweisen für
    Windows, macOS und Android;
  - neuer Teil `android`: Kern-Tests, signierte Release-APK, an dieselbe
    Veröffentlichung gehängt (beim Testbau an den Lauf). Der Schlüssel kommt
    aus vier Secrets und liegt nur während des Baus auf dem Bau-Rechner.
- **Gradle:** Signierung über Umgebungsvariablen; ohne sie wie bisher.
- **Versionsprüfung am Desktop:** sucht die Installationsdatei des eigenen
  Systems (.exe, .dmg, .AppImage) statt nur der Windows-Datei.
- **Anleitung:** `DESKTOP_RELEASE.md` mit Versionsnummer, Signierschlüssel,
  Secrets, Umstieg auf dem eigenen Handy, Testbau und Veröffentlichen.
- Tests: Desktop +1 (572).

### Versionsprüfung nur auf Klick (Desktop und Handy); Einstellungen-Reiter werden behalten

Wunsch vom 25.11.2026: Ohne Klick oder Tippen geht nichts nach draußen.
- **Desktop, Versionskachel in der Seitenleiste:** fragte bisher bei jedem
  Start von selbst bei GitHub nach (bis zu vier Abfragen, zuletzt sogar die
  `package.json` im Hauptzweig). Jetzt nur über „Jetzt prüfen“ im
  aufgeklappten Fenster, eine einzige Abfrage nach der neuesten
  *veröffentlichten* Version. Die Kachel zeigte vorher ungeprüft „Aktuell &
  geprüft“; jetzt „Klicken: nach Updates suchen“ und nach der Prüfung das
  Ergebnis. Eigene Meldungen für „keine Verbindung“, „nichts
  veröffentlicht“ und „zu viele Abfragen“.
- **Handy:** neue Karte „Version“ unter Einstellungen → Allgemein, gleiche
  Regeln und Texte. Dafür braucht die App jetzt die Berechtigung
  `INTERNET` (vorher hatte sie keine einzige); benutzt wird sie nur dort.
- Gemeinsame Regeln: `src/utils/versionspruefung.ts` und
  `android/core/.../settings/Versionspruefung.kt`, je 6 Tests mit denselben
  Fällen. `AppUpdateInfo` und der nie einstellbare Repository-Schlüssel
  `vm_github_repo` sind entfernt.
- **Einstellungen am Handy:** Die Liste aus dem vorigen Paket ruckelte beim
  Blättern (T-421) und ist zurückgenommen. Stattdessen wird jeder Reiter
  beim ersten Besuch aufgebaut und danach unsichtbar behalten; jeder weitere
  Wechsel ist nur noch ein Umschalten. Der erste Aufbau kommt ein Bild
  später, damit der angetippte Reiter sofort als gewählt erscheint. Beim
  Wechsel wird der Cursor aus dem alten Reiter genommen.
- Tests: Desktop +6 (571), Android +6 (734).

### Handy: Einstellungen zeichnen nur noch sichtbare Karten

Aus T-419: „Allgemein“ und „Verein“ öffneten sich weiter verzögert, die
anderen drei Reiter sofort. Gemeinsam ist den beiden die Zahl der
Eingabefelder (je rund 20, darunter zwei lange Texte), die beim Wechsel alle
auf einmal aufgebaut wurden.
- Die Reiter sind jetzt eine Liste (`LazyColumn`), die nur zeichnet, was zu
  sehen ist; weitere Karten entstehen beim Blättern. Jeder Reiter merkt sich
  seine Position.
- Die Antrags-Karten sind dafür einzelne Listeneinträge
  (`antragEinstellungenKarten`). Eingaben, die nur in einer Karte stehen
  (neue Art, neue Sparte, oberer Rand), bleiben beim Wegblättern erhalten.
- „Datensicherung“, „Unterstützen“ und „Fehler melden“ bleiben je ein
  Eintrag (dort greifen Karten ineinander; sie waren schon schnell).
- Sprung aus dem Beitragslauf zur Gläubiger-ID: blättert jetzt erst zur
  Karte „Lastschrifteinzug“.

### Handy: Einstellungen schneller, „Löschen“ bei den Mitgliedsarten einzeilig

Aus der Prüfung vom 25.11.2026.
- **Reiterwechsel in den Einstellungen:** Zwei Karten haben beim Öffnen ihres
  Reiters im Hauptfaden gerechnet und den Wechsel damit aufgehalten.
  - „Verein“ → Sparten: Für jede Sparte wurden alle Mitglieder, Buchungen und
    Inventargegenstände gelesen und gezählt (bei 3 Sparten also neunmal).
    Jetzt einmal je Bereich (`Sparten.verwendungAlle`) und im Hintergrund;
    der Hinweis „In Verwendung …“ erscheint einen Augenblick später.
  - „Allgemein“ → Briefpapier: Die Vorschau wurde bei jedem Öffnen aus dem
    gespeicherten Text (Base64, oft mehrere MB) neu entschlüsselt und als Bild
    gelesen. Jetzt im Hintergrund und gemerkt, solange es dasselbe ist.
- **Mitgliedsarten:** „▲ nach oben“ / „▼ nach unten“ sind schmale
  Pfeilknöpfe wie bei den Sparten; „Löschen“ steht einzeilig daneben.
- Tests: Android ein Prüffall mehr im bestehenden Sparten-Test (weiter 728).

### Nachtrag Mitgliedsarten: Historie, Sicherung in der Rückfrage, Warnung

Aus der Prüfung vom 25.11.2026 (T-396, T-402, T-409).
- **Historie:** Eine Art ohne Verschieben zu löschen oder wiederherzustellen
  schreibt jetzt bei jedem betroffenen Mitglied einen Eintrag
  („Mitgliedsart „Familie“ gelöscht (ohne Verschieben)“, Mitgliedschaftstyp
  Familie → Familie (gelöscht), und umgekehrt), an beiden Fassungen.
  Verschobene Mitglieder bekamen ihren Eintrag schon über die
  Sammelbearbeitung.
- **„Alle Daten löschen“:** „Erst Datensicherung speichern“ steht jetzt in
  der Rückfrage selbst statt auf der Karte; die Rückfrage bleibt dabei offen.
  Desktop und Handy.
- **ESLint:** Die siebte Warnung (`MeetingEmailModal`, fehlende Abhängigkeit
  der Mitgliedsarten) ist behoben; wieder 6.
- Tests: Desktop +1 (565), Android +1 (728).

### Mitgliedsarten bearbeitbar, Ehrenmitglied als Art, leichtere Schnappschüsse

Wünsche und Entscheidungen von Johannes vom 25.11.2026, an Desktop und Handy.

**Mitgliedsarten in den Einstellungen**
- Neue Karte „Mitgliedsarten“ (Desktop: Einstellungen → Vereinsstammdaten;
  Handy: Einstellungen → Allgemein). Sie ersetzt „Beitragsvorgaben je
  Mitgliedsart“ bzw. „Beiträge je Mitgliedsart“. Arten umbenennen, neu
  anlegen, in der Reihenfolge verschieben, Beitragsvorgabe je Art. Die erste
  Art ist die Vorgabe für neue Mitglieder.
- Drei Schalter je Art statt fester Regeln: **beitragsfrei** (bisher nur
  Ehrenmitglied), **unter 18 vorschlagen** (bisher Jugend; höchstens eine
  Art), **im Aufnahmeantrag** (bisher alle außer Ehrenmitglied).
- **Löschen:** Hat die Art Mitglieder, fragt die App, in welche Art sie
  verschoben werden sollen; Löschen ohne Verschieben bleibt möglich. Das
  Verschieben geschieht erst beim Speichern, über die Sammelbearbeitung (also
  mit Eintrag in der Historie). Eine gelöschte Art bleibt mit ihrem Namen
  erhalten („Familie (gelöscht)“), damit Mitglieder ohne Verschieben ihren
  Namen behalten, und lässt sich wiederherstellen.
- Am Mitglied steht weiter die Kennung der Art, nicht der Name. Bestehende
  Mitglieder und alte Sicherungen bleiben gültig; ein neuer Name gilt überall
  zugleich. Format: `BACKUP_FORMAT.md` Abschnitt 11, Sicherungsversion
  unverändert.
- Die Namen kommen jetzt überall aus dieser Liste: Mitgliederliste, Filter,
  Sortierung, Detailansicht, Formular, Sammelbearbeitung, Statistik,
  Startseite, Stammblatt, CSV und PDF, Historie, Sitzungs-Mail, Import,
  Aufnahmeantrag samt leerem Formular. Vorher standen sie an rund zehn
  Stellen je Fassung, nicht einheitlich („Jugend / Kind“, „Kinder und
  Jugendliche“ …). Die Startseiten-Kachel „Neue Mitglieder“ und die
  Empfängerliste der Sitzungs-Mail zeigten am Desktop sogar die interne
  Kennung („full“).
- **Aufnahmeantrag:** zeigt den Namen der Art. Die längeren Beschreibungen
  von früher („Ermäßigt (Schüler, Studierende, Auszubildende, Rentner)“)
  stehen dort nicht mehr; wer sie will, benennt die Art entsprechend.
- **Import am Handy:** Ohne Beitrag in der Datei gilt jetzt die
  Beitragsvorgabe der Art, wie am Desktop (vorher feste 60/80/120 €). Eine
  eigene Art wird am genauen Namen erkannt.

**„Ehrenmitglied“ ist kein Status mehr, sondern eine Mitgliedsart**
- Aus den Status-Auswahlen entfernt (Formular, Sammelbearbeitung, Filter).
- Bestehende Mitglieder mit diesem Status stellen beide Fassungen beim Start
  und nach dem Einspielen einer Sicherung um: Status „Aktiv“, Art
  „Ehrenmitglied“. **Der Beitrag bleibt unverändert**, damit niemandem still
  eine Lastschrift wegfällt; die App meldet einmal, wie viele es waren.
- Behoben: Am Desktop fehlte „Ehrenmitglied“ im Filter nach Typ.
- Testverein: Die zwei Ehrenmitglieder haben jetzt Status „Aktiv“ (zwei
  Zeilen in `Testverein.json`; sonst unverändert, nachgeprüft).

**Schnappschüsse**
- Desktop: kein Schnappschuss mehr nach jeder Änderung (bisher bei Arbeit
  alle 5 Minuten eine vollständige Kopie samt Belegen). Jetzt einmal am Tag
  beim Start und vor riskanten Schritten: Einspielen einer Sicherung,
  Auslagern eines Jahresarchivs. Liste und Aufräumen lesen nur noch Datum
  und Anzahl; vorher luden sie jedes Mal alle Kopien vollständig in den
  Speicher. Vorhandene Schnappschüsse ziehen beim ersten Start einmal um
  (Datenbankversion 2).
- An beiden Fassungen höchstens 5: die 3 letzten täglichen und die 2 letzten
  anderen (Handy vorher 7 + 5, Desktop 12).
- Beim Wiederherstellen entstand am Desktop eine doppelte Sicherheitskopie;
  jetzt eine.
- **„Alle Daten löschen“** löscht an beiden Fassungen auch die Schnappschüsse
  (das Handy legte vorher einen an, der liegen blieb). Davor bietet die App
  „Erst Datensicherung speichern“ an.

- Tests: Desktop +9, jetzt 564. Android +7, jetzt 727.

### Nachbesserung Handy — Speichern-Leiste in den Einstellungen, Plus-Knopf

Aus der Prüfung vom 25.11.2026 (T-376) und den Wünschen von Johannes.

- **Einstellungen: feste Speichern-Leiste.** Der Knopf für Beiträge und
  Antragstexte stand mitten in der Seite (zwischen „Satzung und
  Datenschutz-Vordruck“ und „Leeres Antragsformular“) und wurde übersehen;
  der Knopf für die Vereinsdaten stand am Ende einer langen Seite. Jetzt
  erscheint in den Reitern „Allgemein“ und „Verein“ unten eine Leiste
  „Ungespeicherte Änderungen – Speichern“, sobald etwas geändert ist. Sie
  bleibt beim Blättern stehen und zeigt danach „Gespeichert.“ oder den
  Fehler. Der Reiter trägt dann einen Punkt („Allgemein •“). Die beiden
  alten Knöpfe sind entfallen.
- **Plus-Knopf in der Navigationsleiste:** sitzt jetzt in der Leiste
  (52 statt 64 dp) und ragt nicht mehr über sie hinaus. Vorher überdeckte
  der überstehende Teil den Inhalt darüber, denn freigehalten war nur die
  Höhe der Leiste selbst.

### Code-Prüfung, Paket C5/C6 — Kontakte beim Buchen, Serientermine

Entscheidung Johannes vom 24.11.2026: alle drei Teile umsetzen.

- **Fehler am Desktop: Spender und Sponsoren landeten auf dem falschen
  Konto.** Wählte man in einer Einnahme einen Kontakt, der als Spender oder
  Sponsor eingetragen ist, trug das Buchungsformular Namen ein, die es im
  Kontenrahmen nicht gibt („Spenden und Zuwendungen“, „Sponsoring
  Einnahmen“). Die Kontonummer blieb auf dem ersten Einnahmekonto stehen
  (40000 „Echte Mitgliedsbeiträge“), bei Sponsoren fehlten die 19 %
  Umsatzsteuer. Die Finanz-Auswertung zählte solche Spenden deshalb nicht als
  Spenden. Jetzt: Spender → ideeller Bereich, Konto 40400 „Spenden &
  Zuwendungen allgemein“; Sponsor → wirtschaftlicher Geschäftsbetrieb, Konto
  44000 „Sponsoring & Werbung allgemein“ (19 %). Ist ein Kontakt beides,
  gilt Spender. Nicht bei Ausgaben und Splittbuchungen. Regel
  `kontaktVorbelegung` in `kontaktRegeln.ts`. **Schon gespeicherte
  Buchungen werden nicht berichtigt.**
- **Handy, Vorbelegung (C5):** dieselbe Regel (`BuchungRegeln.vorbelegung`).
  Sie greift beim Antippen eines Kontakt-Vorschlags unter „Zahlungspartner“.
  Ein Hinweis nennt, dass Sphäre und Konto im Schritt „Zuordnung“ vorbelegt
  wurden.
- **Handy, Kontakt aus der Buchung anlegen (C5):** Steht unter
  „Zahlungspartner“ ein Name, den es weder als Kontakt noch als Mitglied
  gibt, erscheint „Als Kontakt anlegen“. Ein kurzer Dialog fragt Firma oder
  Privatperson, Name und Kontakttypen (vorgewählt wie am Desktop: Sponsor
  bei Einnahmen, Lieferant bei Ausgaben). Die Buchung bleibt dabei offen.
  Weitere Angaben folgen später unter Kontakte. Den Namen einer
  Privatperson teilt die App wie der Desktop: erstes Wort Vorname, der Rest
  Nachname.
- **Gelöschten Serientermin zurückholen (C6):** gab es schon an beiden
  Fassungen (Termin bearbeiten → Wiederholung → „Ausgenommene Tage“ →
  „Wieder aufnehmen“ bzw. ×). Der Prüfbericht hatte das übersehen. Entfernt
  wurde nur die ungenutzte Hilfsfunktion `ohneAusnahme`.
- Tests: Desktop +1 (Vorbelegung), jetzt 555. Android +2 (Vorbelegung,
  Kontakt aus Buchung), jetzt 720.

### Code-Prüfung, Paket Gleichstand — vier Lücken zwischen Desktop und Handy

Aus dem Abgleich der Funktionen im Bericht `code-pruefung-2026-11-24.md`
(Punkte C1 bis C4). Je Plattform eine fehlende Funktion nachgezogen.

- **Beitragsvorgaben im Mitgliedsformular am Handy** (C1): Die Beiträge je
  Mitgliedsart aus den Einstellungen (Aufnahmeantrag → Beiträge) wurden am
  Handy bisher nur im Aufnahmeantrag genutzt. Jetzt füllt auch das
  Mitgliedsformular Beitrag und Zahlungsweise vor: beim neuen Mitglied und
  beim Wechsel der Mitgliedsart, wie am Desktop. Steht die Zahlungsart auf
  „beitragsfrei“, wird sie auf SEPA gestellt. Bei einem bestehenden Mitglied
  ändert ein Artwechsel den Beitrag nicht, damit individuelle Beiträge nicht
  überschrieben werden.
- **Rechnungen gesammelt löschen am Handy** (C2): Die Mehrfachauswahl gab es
  schon, es fehlte der Knopf „Löschen“. Nach einer Rückfrage werden die
  gewählten Rechnungen samt PDF gelöscht; verknüpfte Buchungen bleiben
  stehen, wie beim gesammelten Löschen am Desktop.
- **Sitzungsprotokoll ins Dokumentenarchiv am Desktop** (C3): Im
  Unterschriftendialog eines vollständig unterschriebenen Protokolls gibt es
  den Knopf „Im Archiv ablegen“. Das PDF mit den digitalen Unterschriften
  landet im Archivordner „Protokolle & Niederschriften“, Unterordner
  „Jahreshauptversammlungen (JHV)“ bzw. „Vorstandssitzungen“ je nach
  Sitzungsart, mit Titel „Protokoll: … vom …“ und den Schlagworten
  Protokoll und Sitzungsart. Die Sitzung merkt sich das Dokument, ein
  zweites Ablegen wird verhindert. Das Handy konnte das schon.
- **Zuwendungsbestätigungen als Excel am Handy** (C4): Neben CSV und ZIP
  gibt es „Excel – … Bestätigungen“. Gleicher Aufbau wie am Desktop:
  25 Spalten, Beträge als Zahl, Daten als echtes Datum, fixierte Kopfzeile
  mit Filter. Inhalte, die mit „=“ beginnen, bleiben Text und werden von
  Excel nicht als Formel ausgeführt. Dafür neuer Excel-Schreiber
  `core/export/Xlsx.kt` (Gegenstück zu `xlsxWriter.ts`).
- Tests: Desktop +3 (Protokollablage: Ordner, Dateiname, Regeln), jetzt 554.
  Android +3 (Vorgaben, Sammellöschen, Excel zurückgelesen), jetzt 718.

### Code-Prüfung, Paket 1 — Datumsfehler, Kleinigkeiten, toter Code

Aus der Durchsicht des ganzen Codes am 24.11.2026 (Bericht
`code-pruefung-2026-11-24.md` im Projekt). Keine neuen Funktionen.

- **Fälligkeit von Rechnungen am Desktop** (A1): Reichte das Zahlungsziel
  über die Umstellung auf Sommerzeit Ende März, lag das Fälligkeitsdatum
  einen Tag zu früh (20.03. + 14 Tage ergab 02.04. statt 03.04.). Das Datum
  wird jetzt als reines Kalenderdatum gerechnet (`plusTage`), wie am Handy.
  Nebenbei: Ein geleertes Rechnungsdatum löste vorher einen Fehler aus.
- **„Heute“ in Ortszeit** (A2): An 42 Stellen am Desktop entstand das
  heutige Datum aus der Weltzeit. Zwischen Mitternacht und 1 Uhr (Sommerzeit
  2 Uhr) schlug die App deshalb den Vortag vor, in Formularen, Dateinamen und
  beim SEPA-Ausführungsdatum. Jetzt überall `lokalesHeute()`. Die
  SEPA-Datumsumwandlung `formatDate` rechnet ebenfalls in Ortszeit.
- **Rechnungsliste** (A3): Die Sortierung nach Sphäre stellt Rechnungen ohne
  Sphäre ans Ende, statt die Reihenfolge durcheinanderzubringen.
- **Nach Löschen und Einspielen** (A4): Geöffnete Jahresarchive und gemerkte
  Filter werden vergessen nach „Alle lokalen Daten löschen“, nach dem
  Einspielen einer Sicherung (Einstellungen und Einrichtung) und nach dem
  Wiederherstellen eines Schnappschusses.
- **Toter Code entfernt:**
  - Desktop:
    - Ratenbegrenzung, Annahme großer Anfragen und `/api`-Weiche im Server;
      API-Adressen gibt es nicht mehr. Dazu `src/utils/rateLimit.ts` samt
      10 Tests.
    - `PROTOKOLLARTEN`, `SEITEN_NAMEN`, `ALL_ACCOUNT_CATEGORIES` (dessen
      Test prüft die Regel jetzt direkt am Kontenrahmen),
      `anzahlUnterlagen`.
    - die Felder `createdById`, `customTemplateUsed` (2×) und `signatoryId`,
      ein ungenutzter Parameter.
  - Handy:
    - eigene Leervorlage des Aufnahmeantrags (ohne Oberfläche, ersetzt durch
      Briefpapier und Beilagen) samt Test.
    - `KpiKachel`, zehn Nacht-Farben, `ibanAnzeige`, `unterkonten`,
      `counts`, `ICS_ZEIT`, `BuchungImport.warnungen`.
  - Veralteter Kommentar zu zxing (wird für den GiroCode gebraucht).
- Tests: Desktop −10 (Ratenbegrenzung) +1 (`plusTage` über die
  Zeitumstellung), jetzt 551. Android −1 (Leervorlage), jetzt 715.

### Runde 2, U — Unterlagen am Mitglied, Führungszeugnis, Filter bleiben stehen

- **Unterlagen am Mitglied** (Desktop und Handy): Am Mitglied gibt es den
  Bereich „Unterlagen“. Dort lassen sich Lizenzen, Nachweise und Ähnliches als
  PDF oder Bild anhängen, am Handy auch als Foto. Zu jeder Unterlage gehören:
  - eine Art (Trainer-/Übungsleiterlizenz, Erste-Hilfe-Nachweis,
    Schiedsrichterausweis, Aufnahmeantrag, Einverständnis, Sonstiges);
  - eine Bezeichnung;
  - auf Wunsch „ausgestellt am“ und „gültig bis“.

  Eine Unterlage ist ein normales Dokument im Ordner „Mitgliederunterlagen“.
  Der Ordner wird bei Bedarf angelegt. Ältere Dokumente eines Mitglieds
  erscheinen dort ebenfalls (Aufnahmeanträge als solche, sonst „Sonstiges“).
- **Führungszeugnis nur als Vermerk** (§ 72a Abs. 5 SGB VIII): Der Vermerk
  enthält, wann das Zeugnis eingesehen wurde, das Datum des Zeugnisses und ob
  eine einschlägige Verurteilung vorliegt. Die nächste Vorlage ist nach
  5 Jahren fällig; das Datum wird berechnet. Es gibt keinen Upload. Ein
  Hinweis erinnert daran, die Angaben nach Ende der Tätigkeit zu löschen.
- **Dashboard-Kachel „Unterlagen laufen ab“** (an beiden Fassungen): Sie zeigt
  Unterlagen, die in den nächsten 90 Tagen ablaufen oder schon abgelaufen
  sind, und fällige Führungszeugnisse. Ausgetretene Mitglieder zählen nicht.
  Ein Klick öffnet das Mitglied. Die Kachel erscheint auch bei einer schon
  gespeicherten Anordnung der Startseite, und zwar sofort sichtbar.
- **Mitglied löschen:** Auch der Desktop fragt jetzt nach den Dokumenten des
  Mitglieds (einzeln und beim Sammellöschen). An beiden Fassungen ist
  „mitlöschen“ vorgewählt, die Frage nennt die Anzahl. Vorher ließ der Desktop
  die Dokumente ohne Mitglied liegen.
- **Filter bleiben stehen (T-334):** Suche und Filter jeder Liste bleiben
  erhalten, wenn man einen Eintrag öffnet und zurückkommt oder den Bereich
  wechselt. Das gilt, solange die App läuft. Solange ein Filter gesetzt ist,
  gibt es den Knopf „Filter zurücksetzen“; die Sortierung bleibt dabei
  erhalten.
  - Desktop: 12 Ansichten. Die bisherigen eigenen Zurücksetzen-Knöpfe in
    fünf davon sind durch den gemeinsamen ersetzt.
  - Handy: 14 Bildschirme. Im Dokumentenarchiv merkt sich jeder Ordner seine
    eigene Suche.
- **Testverein** ergänzt: Ordner „Mitgliederunterlagen“ mit 5 Unterlagen (eine
  davon abgelaufen) und 2 Führungszeugnis-Vermerke.
- **Format:** freiwillige Felder `documents[].memberDocType`, `issuedAt`,
  `validUntil` und `members[].policeCertificate`. Die Sicherungsversion bleibt
  gleich (`BACKUP_FORMAT.md` Abschnitt 10).
- Reiter „Unterlagen“ am Desktop: Er zählt und listet aus der
  Dokumentenliste, die die App ohnehin im Speicher hat, und liest beim Öffnen
  nichts aus der Datenbank. Gespeicherte oder gelöschte Unterlagen meldet er
  einzeln an die App zurück. Ebenso nimmt die Löschen-Rückfrage beim Mitglied
  die Liste im Speicher. Vorher las jedes Öffnen zweimal alle Dokumente samt
  Dateiinhalt; im Programmfenster dauerte das 2 bis 3 Sekunden, und solange
  stand „(0)“ da (Rückmeldung T-344).
- **Unterlagen in der Änderungshistorie** (Desktop und Handy, Rückmeldung
  T-346): „Unterlage hinzugefügt: <Art>: <Bezeichnung>“, „Unterlage
  bearbeitet“ mit den geänderten Feldern (Art, Bezeichnung, ausgestellt am,
  gültig bis, Datei) und „Unterlage gelöscht“. Gilt für den Reiter
  „Unterlagen“ am Mitglied. Der Führungszeugnis-Vermerk kommt bewusst nicht
  ins Protokoll: Nach § 72a Abs. 5 SGB VIII ist er spätestens drei Monate nach
  Ende der Tätigkeit zu löschen, ein Protokolleintrag bliebe aber stehen.
- **Mitglied löschen am Desktop fragt nach ausgegebenem Material**
  (Rückmeldung T-352, wie Android). Ein Fenster fasst Dokumente und Material
  zusammen. Das Material geht entweder zurück ins Inventar (als heute
  zurückgegeben gebucht) oder auf ein anderes Mitglied über; dieses bekommt
  „Material übernommen von …“ in seine Historie. Vorher blieb es am Desktop
  einem gelöschten Mitglied zugeordnet und galt weiter als ausgegeben.
- **Dabei gefunden und behoben (seit 21.11.2026, Commit `18389b1`):** Das
  Mitglied-Detailfenster am Desktop lief in einer Endlosschleife. Es las etwa
  700-mal pro Sekunde das ganze Änderungsprotokoll aus der Datenbank, solange
  es offen war (gemessen im Prüfaufbau). Das füllte den Arbeitsspeicher und
  bremste alle anderen Datenbankzugriffe. Ursache: die Vorgabe `auditLogs = []`
  ist bei jedem Zeichnen eine neue Liste, und zwei Effekte hingen daran. Jetzt
  ist es eine feste leere Liste. Andere Stellen mit diesem Muster sind reine
  Rechnungen (`useMemo`) und laufen nicht in eine Schleife (von Claude
  durchgesehen).
- Aufgeräumt: die zwei Kotlin-Meldungen „Condition is always 'true'“ in
  `Spenden.kt` und `Rechnungen.kt`.
- Tests: Desktop 22 neu (`unterlagen.test.ts` 10, `gemerkteFilter.test.ts` 3,
  `unterlagenProtokoll.test.ts` 4, `mitgliedLoeschen.test.ts` 5), Android 6 neu
  (`UnterlagenTest.kt`). `DashboardTest.kt` ist an die neue Kachel angepasst.

### Runde 2, R4c — Jahresarchiv am Handy

- **Rechenkern** `android/core/.../backup/Jahresarchiv.kt`, Gegenstück zu
  `src/services/jahresarchiv.ts`. Er kann dasselbe:
  - auswählen (gleiche Regeln, erst ab dem Vorvorjahr);
  - Archiv schreiben (gleicher Aufbau wie das Sicherungspaket, auf Wunsch
    mit Passwort);
  - prüfen, auslagern, eine Datei anzeigen, alles zurückholen.

  Archive werden als Datenstrom gelesen und geschrieben; im Speicher liegt
  nur `archiv.json`.
- **Austausch Desktop ↔ Handy:** Beide wählen für denselben Bestand dieselben
  Dateien aus, vergeben dieselben Pfade und schreiben dasselbe
  Inhaltsverzeichnis. Die Prüfdateien in
  `android/core/src/test/resources/jahresarchiv/` hat der Desktop-Code aus dem
  Testverein erzeugt: ein Teilbestand und das Archiv 2024 dazu.
- **Einstellungen → Datensicherung → „Jahresarchiv“** mit „Jahr archivieren …“
  und „Jahresarchiv zurückholen …“. Der Ablauf hat vier Schritte wie am
  Desktop:
  1. Jahr wählen.
  2. Vorschau und Passwort (vorgewählt), dann speichern.
  3. Die gespeicherte Datei noch einmal wählen; die App prüft jede Datei.
  4. Auslagern.

  Vor dem Auslagern legt die App einen Schnappschuss an (neuer Grund „Vor dem
  Auslagern ins Jahresarchiv“).
- **Vermerk an Beleg, Dokument und Gegenstand** mit „Aus Archiv anzeigen …“.
  Ein geöffnetes Archiv bleibt bis zum Beenden der App offen. In der
  Dokumentenliste steht „Jahresarchiv <Jahr>“ statt der Größe.
- **Neue Datei hebt den Vermerk auf:** Das gilt für einen neuen Beleg, ein neu
  erzeugtes Rechnungs- oder Spenden-PDF und ein neues Foto.
- **Dabei gefunden und behoben (Inventarfotos):**
  - Fotos, die mit einer Sicherung vom Desktop kamen, liegen am Handy als Datei
    vor. Sie wurden nie angezeigt, weil das Handy nur am Handy aufgenommene
    Fotos kannte. Jetzt zeigen Detailansicht und Formular beide.
  - Bekam ein solcher Gegenstand am Handy ein neues Foto, blieb die alte Datei
    stehen. Beim nächsten Ausgeben einer JSON-Sicherung hätte sie das neue Foto
    überschrieben. Jetzt ersetzt das neue Foto die alte Datei, und
    „Foto entfernen“ entfernt beide.
- Rechnungs- und Spenden-Vorschau am Handy: Liegt das PDF im Jahresarchiv und
  ist das Archiv nicht geöffnet, wird es wie bisher neu erzeugt.
- Tests: 13 neu in `JahresarchivTest.kt`.

### Runde 2, R4b — Jahresarchiv am Desktop bedienen

- **Einstellungen → Datensicherung → „Jahresarchiv“** mit zwei Knöpfen:
  „Jahr archivieren …“ und „Jahresarchiv zurückholen …“
  (`JahresarchivDialog.tsx`).
- **Archivieren in vier Schritten:**
  1. Jahr wählen. Das laufende Jahr und das Vorjahr sind ausgegraut, mit
     Begründung.
  2. Vorschau: Dateien je Art, eingesparte Größe, Aufbewahrungsfrist.
     Passwort ist vorgewählt, lässt sich aber abwählen. Dann speichern.
  3. Die gespeicherte Datei noch einmal auswählen. Die App prüft, dass es
     genau dieses Archiv ist (Kennung), und prüft jede Datei gegen ihre
     Prüfsumme.
  4. Erst danach werden die Dateien aus dem Bestand genommen. Die Daten
     werden dafür frisch geladen; Dateien, die sich inzwischen geändert
     haben, bleiben im Bestand und werden genannt.
  - Wer nach Schritt 2 abbricht, verliert nichts.
  - „Gespeichertes Archiv prüfen und auslagern …“ setzt bei Schritt 3
    wieder ein.
- **Zurückholen:** Archiv wählen, bei Bedarf Passwort, Prüfung, dann
  zurückschreiben. Die Archivdatei bleibt dabei unverändert.
- **Vermerk an den Einträgen:**
  - Buchung (Details und Bearbeiten), Dokumentenliste (Karten und Tabelle)
    und Gegenstand zeigen „Im Jahresarchiv <Jahr>“.
  - Beleg- und Dokumentansicht sowie Gegenstand-Details bieten
    „Aus Archiv anzeigen …“ (`ArchivDateiLaden.tsx`). Damit wird die
    Datei nur angezeigt, nicht wieder eingelagert.
  - Ein einmal geöffnetes Archiv merkt sich die App bis zum Beenden.
  - Herunterladen ist bei archivierten Dateien ausgeblendet. Der
    Sammel-Download übergeht sie und sagt, wie viele.
- **Neue Datei hebt den Vermerk auf:** Bekommt ein archivierter Eintrag
  wieder eine Datei, gilt ab dann die Datei im Bestand. Das betrifft einen
  neuen Beleg, ein neues Foto und ein neu erzeugtes Rechnungs- oder
  Spenden-PDF. Die Speicherfunktionen in `storage.ts` entfernen den
  Vermerk dann.
- **Inventar, Nachtrag aus T-308:** Ausgemusterte Gegenstände zeigen keine
  fällige Prüfung mehr. Detailansicht: „Entfällt (ausgemustert)“, ohne
  „Heute geprüft“. Liste: keine Prüfzeile. Am Handy ebenso
  (`InventarUi.kt`).
- `BackupPasswordDialog` kann jetzt auch nach dem Passwort eines Archivs
  fragen.
- Tests: einer neu in `jahresarchiv.test.ts` (Vermerk aufheben, `imArchiv`).

### Runde 2, R4a — Jahresarchiv: Grundlagen

- **„Ausgemustert am“** an Desktop und Handy (`inventory[].retiredAt`). Wird
  beim Ausmustern auf heute gesetzt und lässt sich ändern; ein vorhandenes
  Datum bleibt beim erneuten Speichern; wer den Gegenstand wieder in Gebrauch
  nimmt, verliert das Datum. Gleiche Regel in der Sammelbearbeitung. Geprüft:
  gültiges Datum, nicht in der Zukunft, nicht vor dem Kaufdatum. Anzeige in
  der Detailansicht. Der Testverein hat die Daten bei seinen zwei
  ausgemusterten Gegenständen (2023, 2024).
- **Rechenkern des Jahresarchivs** am Desktop (`src/services/jahresarchiv.ts`,
  14 Tests mit dem Testverein): welche Dateien eines Jahres ins Archiv gehören
  (Belege, Rechnungs- und Spenden-PDFs, Fotos ausgemusterter Gegenstände),
  ab welchem Jahr archiviert werden darf (Vorvorjahr) und wie lange
  aufzubewahren ist; Archiv schreiben (ZIP wie das Sicherungspaket, auf Wunsch
  mit Passwort, dazu `archiv.json` mit SHA-256 je Datei und ein
  `Inhaltsverzeichnis.csv`); zurücklesen und prüfen; Dateien aus dem Bestand
  nehmen und vermerken (nur, wenn die Datei unverändert ist); einzelne Datei
  anzeigen; ganzes Jahr zurückholen. Noch ohne Bedienung (R4b).
- `utils/sha256.ts` rechnet jetzt auch Prüfsummen von Dateien
  (`sha256HexBytes`, gegen Node geprüft).
- **Format:** `BACKUP_FORMAT.md`, neuer Abschnitt 9 (Archivdatei, Vermerk
  `archiv`/`photoArchiv` im Bestand, Regeln). Die Sicherung behält ihre
  Version; die neuen Felder sind freiwillig.

### Runde 2, R3 — Fenster in der Größe veränderbar

- **Ziehen an Kanten und Ecken** ändert die Größe der Fenster zum Bearbeiten
  und Ansehen (45 Fenster in 43 Dateien). Neuer Baustein
  `src/components/VeraenderbaresFenster.tsx`, Rechenregeln in
  `src/utils/fenstergroesse.ts` (15 Tests). Mittig stehende Fenster wachsen
  nach beiden Seiten; die gezogene Kante bleibt unter der Maus. Die
  Mitglied-Detailansicht (Seitenleiste rechts) lässt sich nur an der linken
  Kante ziehen.
- **Größe je Fensterart gemerkt**, nur auf diesem Gerät (Browserspeicher,
  `vm_fenstergroessen_v1`), nicht in der Datensicherung.
- **Kleineres Programmfenster:** Die gemerkte Größe wird beim Öffnen und bei
  jeder Größenänderung des Programmfensters auf den vorhandenen Platz
  begrenzt. Kopfzeile und Knöpfe bleiben sichtbar, der Inhalt rollt. Wird
  das Programmfenster wieder groß, kommt die gemerkte Größe zurück.
  Unlesbare gespeicherte Werte werden übergangen.
- **Doppelklick auf die Kopfzeile** stellt die Ausgangsgröße wieder her.
- Mindestgröße 360 × 240 Bildpunkte; „Startseite anpassen“ 440 und
  „Ausgegebenes Material“ 400 Bildpunkte hoch, weil dort mehrere feste
  Leisten übereinander liegen.
- Beim Ziehen über eine PDF- oder Kartenansicht blieb das Fenster zunächst
  hängen (die eingebettete Ansicht schluckt die Mausbewegungen); während des
  Ziehens liegt deshalb eine unsichtbare Fläche über allem.
- **Nicht veränderbar** bleiben Rückfragen und reine Meldungen (Löschen
  bestätigen, Hinweise nach Sammelaktionen, PDF-Auswahl), die Passwortabfrage
  der Sicherung, das Zeichnen von Unterschriften, „Rechnung als bezahlt
  markieren“, „Datensicherung erstellen“ und die Auswahl „Neues Dokument“.
- Ohne gemerkte Größe sehen die Fenster aus wie vorher (bei Claude mit
  Bildschirmfotos verglichen). Ausnahme: „Ordner anlegen“ und „Dokument
  bearbeiten“ sind jetzt höchstens 92 % des Bildschirms hoch und rollen
  dann; vorher ragten sie bei wenig Platz unten aus dem Bild.

### Runde 2, R2 — Ohne Anmeldung und Demo, Testverein zum Ausprobieren

- **Keine Anmeldung mehr am Desktop.** Der Anmeldebildschirm, die
  automatische Sperre und das App-Passwort sind entfernt. Wie am Handy
  schützt das Benutzerkonto des Rechners die Daten; in den Einstellungen
  steht dazu ein Hinweis (Rechnerpasswort, Festplattenverschlüsselung). Die
  App startet direkt; oben rechts führt ein Knopf zu den Einstellungen.
  Entfernt: `LoginScreen.tsx`, `authService.ts`, `passwordService.ts` (mit
  seinen 11 Tests).
- **Kein Demo-Modus mehr.** Die eingebauten Beispieldaten („TSV
  Musterstadt“) und die eigene Demo-Datenbank sind entfernt
  (`initialContacts.ts`, `initialDocuments.ts`, `initialInventory.ts`; in
  `initialInvoices.ts`, `initialMeetings.ts`, `initialEvents.ts` bleiben nur
  die Vorlagen). Beim ersten Start räumt die App Reste von Demo und
  Anmeldung einmal weg (`entferneAltlastenDemoUndAnmeldung` in
  `storage.ts`). Die echten Vereinsdaten sind davon nicht berührt.
- **Dabei gefunden:** Fehlten die Vereinsstammdaten, lieferte die App
  ersatzweise die Stammdaten des Demo-Vereins (TSV Musterstadt mit dessen
  Steuernummer und Gläubiger-ID). Jetzt sind es neutrale, leere Angaben.
- **Bearbeiter im Änderungsprotokoll heißt „Admin“**, am Desktop wie am
  Handy (vorher „Kassier / Administrator“ bzw. „Kassier (CSV Import)“).
  Bestehende Einträge bleiben, wie sie sind. Android: `MemberEdit.kt`,
  zwei Tests angepasst.
- **Update-Anzeige ehrlich gemacht.** In der Desktop-App lief bisher immer
  ein *vorgetäuschtes* Update: Die App fand das Update-Modul von Tauri nicht
  (es ist gar nicht eingebaut, und der Aufruf stammte aus Tauri 1) und
  „installierte“ dann zum Schein mit Fortschrittsbalken, ohne etwas zu
  ändern. Jetzt prüft sie nur, ob es eine neuere Version auf GitHub gibt,
  und bietet den Download an — mit dem Hinweis, vorher eine Sicherung zu
  machen. Ohne Internet sagt sie, dass sie es nicht prüfen kann.
- **Testverein zum Ausprobieren:** `testdaten/Testverein.json` (nur im
  Repository, nicht in der App) — „TSV Testhausen 1921 e.V.“, 2022 bis
  November 2026, 50 Mitglieder in 3 Sparten, 637 Buchungen, 20 Kontakte,
  250 Termine (50 je Jahr), 10 Sitzungen, 15 Inventargegenstände,
  113 Dokumente. Erzeugt von `src/testdaten/testverein.ts` mit den
  App-Funktionen für Beitragslauf, Spende, Rechnung, Belegordner und
  Unterschrift; neu erzeugen mit `npm run testverein`. 21 Tests
  (`testverein.test.ts`): Umfang, alle Verweise, eindeutige Nummern, gültige
  IBAN/BIC/E-Mail, kein Konto im Minus, alle Sitzungen, Termine und
  Gegenstände bestehen die Prüfungen der Eingabemasken, die App erkennt die
  Datei als Sicherung, und die Datei im Repository passt zum Programm.
  Das Einrichtungsfenster und die README weisen darauf hin.

### Runde 2, R1 — Gleichstand Desktop/Handy und Aufräumen

- **Desktop liest CSV auch in Windows-1252** (ältere Bank- und
  Excel-Exporte), wie Android: erst streng UTF-8, sonst Windows-1252 mit
  Hinweis „Prüfen Sie Umlaute in der Vorschau“; in allen fünf Importen
  (`dekodiereText` in `src/utils/importDatei.ts`, 1 Test).
- **Android erkennt im Bankimport „Name Zahlungsbeteiligter“ und
  „IBAN Zahlungsbeteiligter“** (neueres Bank-CSV-Format), wie der Desktop;
  vorher hätte Android hier per Teiltreffer die eigene IBAN aus „IBAN
  Auftragskonto“ genommen (1 Test in `ImporteTest.kt`).
- **Android: „Proben (Entwicklung)“ entfernt** (Knopf in Einstellungen →
  Datensicherung, `ProbeScreen.kt`).
- Repository: versehentlich hochgeladene Lieferungs-ZIPs (`Claude outputs/`)
  entfernt und in `.gitignore` aufgenommen.

### Paket 28 — Excel-Dateien lesen (D-72, E5)

Eigener Leser ohne Bibliothek in `src/utils/xlsxReader.ts`, Nachbau von
Android `Xlsx` (`core/importe/Tabellen.kt`): erste Tabelle des
Arbeitsbuchs, gemeinsame Texte ohne Lautschrift, Formeln mit gespeichertem
Ergebnis, WAHR/FALSCH, Fehlerwerte leer; Datum als JJJJ-MM-TT und Uhrzeit
als HH:MM (am Zahlenformat erkannt), Zahlen mit Komma ohne Tausenderpunkt;
doppelte Überschriften als „Name_2“. Das ZIP liest der vorhandene Leser aus
P30 Teil 1. Der XML-Leser kennt keine DTD und keine fremden Entitäten.

- **Alle Importe nehmen .xlsx:** Bankimport, Buchungsimport, Mitglieder,
  Kontakte, Termine. Gemeinsamer Einstieg `src/utils/importDatei.ts` erkennt
  Excel am Inhalt und gibt die Tabelle direkt weiter (ohne Umweg über
  CSV-Text); CSV-Dateien laufen genau wie vorher. Dafür neu:
  `BankImportService.parseBankZeilen`, `CalendarService.parseTabelle`.
- **Verständliche Meldungen** für alte .xls-Dateien, mit Passwort geschützte
  Excel-Dateien und ZIP-Dateien ohne Tabelle.
- **Android:** Der Mitglieder-Import liest jetzt ebenfalls .xlsx
  (Buchungen, Kontakte und Termine konnten es schon).
- 8 Tests, darunter eine echte, von LibreOffice geschriebene Datei
  (`xlsxTestdaten.ts`, Erwartungen mit openpyxl gegengelesen) bis in den
  Bankimport.
- Nebenbei: In der Anleitung des Buchungsimports stand `$\rightarrow$`
  statt eines Pfeils.

### Paket 30, Teil 2 — Sicherungspaket am Desktop schreiben (D-06, E6)

- **Sichern als Paket (.zip), vorgewählt:** wie die Handy-App,
  `sicherung.json` (Format 1.3.0) zuerst, dann Belege, Dokumente und Fotos
  als Dateien mit denselben Pfaden und Namen wie am Handy; gleicher Inhalt
  nur einmal. Die bisherige JSON-Datei bleibt wählbar.
- **Mit Passwort:** WinZip-AES-256 (AE-2) je Eintrag, wie zip4j am Handy.
  Hinweis im Fenster, dass die Dateinamen im Paket lesbar bleiben.
- `src/utils/zipSchreiben.ts` (Deflate über `CompressionStream`, sonst
  gültig ohne Kompression; AES-Einträge), `src/services/backupPaketSchreiben.ts`.
  6 Tests: Rundlauf über den Desktop-Leser, unabhängiges Lesen mit Node
  (zlib/OpenSSL) von vorn wie am Handy. Zusätzlich von Hand gegengeprüft mit
  Info-ZIP, Java `ZipInputStream` und einer Python-Umsetzung der
  AE-Beschreibung. **Nicht geprüft:** Einspielen in der Android-App.

### Nachbesserung T-265

- Kontoinhaber im Antrag folgt dem Vorschlag (bei unter 18 der Vertreter),
  bis er von Hand geändert wird; auch nach Zurückblättern und Ändern von
  Geburtsdatum oder Vertreter. Desktop und Android.

### Nachbesserungen aus der Prüfung von P29

- **T-252:** Der Aufnahmeantrag ist jetzt ein Fenster im Stil des Desktops
  wie „Neues Mitglied anlegen“: beschriftete Abschnitte „1. Person“ bis
  „5. Prüfen & Abgeben“ statt der farbigen Leiste, rot markiert, wo etwas
  fehlt; bereits besuchte Abschnitte lassen sich direkt anklicken. Normale
  Schriftgrößen, Knöpfe unten rechts.
- **T-258:** Unter 18 unterschreibt nur noch der gesetzliche Vertreter, nicht
  das Kind (Antrag, PDF, Prüfung). Als Kontoinhaber wird dann der Vertreter
  vorgeschlagen statt des Kindes. Das leere Formular hat beide Linien
  („ab 18 Jahren“ / „bei unter 18“). Android ebenso.
- **T-255:** Keine Seitenzahl mehr unten auf dem Antrags-PDF; sie stieß mit
  dem Fuß des Briefpapiers zusammen. Android ebenso.
- **T-257:** Beim Prüfen steht die Mitgliedsnummer als „höchste vergebene
  + 1“ im Feld, darunter „Nächste freie Nummer: …“ statt des Satzes „Sie
  können sie ändern“.
- **T-261:** PDF-Vorschau (Antrag Schritt 4, Dokumentenarchiv, Belege)
  über eine Blob-Adresse statt einer langen `data:`-Adresse; diese zeigt
  das eingebaute Browserfenster bei größeren Dateien nicht an
  (`src/utils/pdfVorschau.ts`, 1 Test).
- **Briefpapier in den Einstellungen:** neue Karte „Briefpapier“ unter
  Einstellungen → Vereinsstammdaten (Hochladen, Austauschen, Entfernen,
  oberer Rand). Gilt für Rechnungen, Sitzungen und den Antrag und wirkt
  sofort. Gespeichert wird weiterhin in der Rechnungsvorlage, ältere
  Sicherungen bleiben gültig. Die Rechnungsvorlage zeigt nur noch an,
  welches Briefpapier aktiv ist; Sitzungsseite und Sitzungsvorlage führen mit
  ihrem Knopf jetzt in die Einstellungen.
- **T-251 (Android):** Die drei Knöpfe im Reiter „Material“ stehen
  gleichmäßig links, Mitte, rechts; Schrift wieder größer (13 sp).

### Nachbesserungen aus der Prüfung von P26/P27

- **T-244:** „Gemeinnützig – Freistellungsbescheid vom …“ erscheint jetzt
  auch, wenn das Datum wie in den Einstellungen üblich als „10.01.2024“
  eingetragen ist (vorher nur bei JJJJ-MM-TT, daher immer „Kein
  Freistellungsbescheid hinterlegt“).
- **T-245:** Klick auf einen Termin im Dashboard öffnet den Kalender im
  Monat des Termins mit dessen Details (bei Serien: der angeklickte Tag).
  Am Handy ebenso: Tippen auf einen Termin öffnet ihn; zurück steht der
  Kalender auf seinem Monat.
- **T-247 (Android):** Knöpfe im Reiter „Material“ mit kleinerer Schrift,
  damit „Entfernen“ nicht mehr abgeschnitten wird.

### Paket 26/27 — Dashboard: Rechnen und Anzeige (D-132 bis D-142)

Zahlen wie Android `Dashboard.kt` in `src/utils/dashboardRegeln.ts`
(12 Tests mit denselben Beispielen wie am Handy). Das Aussehen der Kacheln
bleibt das des Desktops.

- **§ 64-Kachel (D-132, D-134):** Grenze je Kalenderjahr (bis 2025 45.000 €,
  ab 2026 50.000 €) aus derselben Rechnung wie die EÜR-Seite; Text „… von
  50.000 €“, bei Überschreitung „Grenze überschritten“. Gelb ab 75 %.
- **Jahres-Saldo, vier Sphären, Cashflow (D-134):** aufgeteilte Buchungen
  zählen Teil für Teil in ihrer Sphäre, Umbuchungen nicht. Der Cashflow
  nimmt die Monate der Finanz-Auswertung (Spenden als Einnahme).
- **Ausgetretene (D-135):** Sparten, Altersstruktur, Geschlechter, „Neueste
  Mitglieder“ und Neuzugänge zählen nur aktuelle Mitglieder; Prozent der
  Sparten beziehen sich auf sie.
- **SEPA (D-136):** „Jahres-Soll aller Beiträge“ mit Zahlrhythmus statt
  „~ Summe“ der Einzelbeträge.
- **Rechnungen (D-137):** offen = gestellt und nicht bezahlt; Entwürfe und
  Stornierte zählen weder als Forderung noch als abgerechnet.
- **Datum (D-138):** „überfällig“ und „anstehende Sitzungen“ nach dem
  lokalen Datum statt UTC.
- **Alter (D-139):** auf den Tag genau; fünf Gruppen wie Android (0–13,
  14–17, 18–59, ab 60, ohne Geburtsdatum).
- **Geburtstage (D-133, D-141):** Kachel „Geburtstage & Jubiläen“: alle
  Geburtstage und Mitgliedsjubiläen (10/25/40/50 Jahre) der nächsten 30 Tage
  nach der Rechnung des Kalenders. Wer heute Geburtstag hat, steht mit
  „Heute!“ oben; der 29.2. wird in Jahren ohne Schalttag zum 28.2.
- **„Gemeinnützig“ (D-140):** zeigt „Gemeinnützig – Freistellungsbescheid
  vom …“; ohne Datum „Kein Freistellungsbescheid hinterlegt“.
- **Termine (D-142):** die nächsten drei Vorkommen auch aus Serien.
- **Kachelbeschreibungen** in „Dashboard anpassen“ passen jetzt zum Inhalt.
- **Bedienleiste der Kacheln** (Ziehen, Breite, Entfernen) sitzt mittig auf
  der Oberkante statt oben rechts und verdeckt keine Verweise mehr.
- **Android, Reiter „Material“ beim Mitglied (T-224):** die drei Knöpfe
  stehen einzeilig, „Entfernen“ rechts in Warnfarbe.

### Paket 25 — Finanz-Auswertung (D-75 bis D-78, D-80)

Zahlen wie Android `Finanzauswertung.kt` in `src/services/finanzAuswertung.ts`,
Diagramme für das PDF wie Android `Diagramme.kt` in
`src/services/finanzDiagramme.ts` (8 Tests mit denselben Beispielen wie am Handy).
Am Bildschirm bleiben die Desktop-Diagramme, nur die Zahlen kommen jetzt aus
derselben Rechnung.

- **Kontostand-Verlauf (D-75):** echter Kontostand am Monatsende (bzw. bei
  „Alle Jahre“ am Jahresende, dazu „Anfang“): Anfangsbestand der Konten plus
  alle Buchungen bis dahin, auch aus früheren Jahren. Umbuchungen wirken je
  Konto. Vorher wurden nur die Buchungen des Zeitraums aufsummiert.
- **Spenden (D-76):** nur Einnahmen auf Nummernkreis 40400; eine Ausgabe dort
  (z. B. Rückerstattung) zählt als Ausgabe.
- **Einnahme/Ausgabe (D-77):** nach Buchungsart wie in der EÜR, nicht nach
  dem Vorzeichen.
- **Bereichsfilter (D-78):** gilt je Teilbetrag aufgeteilter Buchungen;
  unbekannter Bereich zählt als ideell.
- **CSV und PDF (D-80):** zwei neue Knöpfe in der Filterleiste. CSV mit allen
  Zahlen (Kennzahlen, Monate, Kontostand, Mixe, Sparten), PDF mit zwei Seiten
  A4 und den Diagrammen wie am Handy. Dateiname
  „Finanzauswertung_<Jahr>_<Verein>“.
- Beschriftungen wie am Handy: Torte „Anteil an allen Bewegungen“,
  „Kontostand-Verlauf“, Kachel „Saldo“.

### Material im Änderungsprotokoll des Mitglieds (Gleichstand mit Android)

- Jede Material-Änderung steht jetzt auch am Desktop im Änderungsprotokoll
  des Mitglieds, mit denselben Texten wie am Handy: „Material ausgegeben“,
  „Material bearbeitet“ (mit Menge, Ausgabedatum, Eigenanteil, Notiz,
  Gegenstand als alt → neu), „Material zurückgegeben“, „Material wieder
  ausgegeben“, „Material-Verknüpfung entfernt“. Gilt für alle Wege
  (Mitgliedsfenster, Detailfenster des Gegenstands, „Ausgeteilte
  Gegenstände“), weil es beim Speichern selbst geschieht
  (`src/utils/materialProtokoll.ts`, ein Test mit denselben Fällen wie
  Android). Ohne Änderung entsteht kein Eintrag. Die Historie im
  Mitgliedsfenster aktualisiert sich sofort.

### Nachtrag zu P23/P24 — Detailansicht Inventar, Gleichstand mit Android

- **Detailansicht eines Gegenstands** (Desktop) im eigenen Fenster wie bei
  Kontakten, Rechnungen und Buchungen: Klick auf die Zeile bzw. „Details“ in
  der Kartenansicht. Inhalt wie am Handy: Menge, Wert gesamt, Prüfung,
  Hinweise (ausgemustert, ausgegeben, Prüfung überfällig), Foto, Angaben,
  Notizen; Knöpfe Bearbeiten, „Heute geprüft“, Löschen.
- **„Ausgegeben an“** (Desktop und Android): Die Detailansicht nennt, wer den
  Gegenstand gerade hat (Mitglied, Menge, Ausgabedatum, Eigenanteil, Notiz),
  neueste Ausgabe zuerst. Ein Klick auf das Mitglied öffnet es.
- **Zurückgeben aus der Detailansicht** (Desktop und Android): Jede Ausgabe
  unter „Ausgegeben an“ hat einen Knopf „Zurückgeben“; nach einer Rückfrage
  wird die Rückgabe mit dem heutigen Datum eingetragen (Rückmeldung aus
  T-215). Das Desktop-Fenster folgt im Aufbau den übrigen Desktop-Fenstern
  (Abschnitte mit Angaben wie bei Kontakten und Rechnungen) statt der
  Handy-Ansicht.
- **Sammelbearbeitung:** Fehler stehen jetzt am betroffenen Feld und neben
  dem Knopf statt oben im Fenster (Rückmeldung aus T-208).
- **Android:** Hinweis „Stimmen ohne Teilnehmer“ im Sitzungsformular wie am
  Desktop (`Sitzungen.stimmenUngeprueft`, ein Test).

### Pakete 23 und 24 — Inventar (D-97, D-99 bis D-103, D-105, D-106)

Regeln wie Android `Inventar.kt` in `src/utils/inventarRegeln.ts` (6 Tests).

- **Beträge (D-97):** Anschaffungspreis und Zeitwert werden in deutscher
  Schreibweise gelesen („1.234,50“ = 1.234,50 €; vorher wurde daraus 1,234).
  Negative oder unlesbare Beträge werden am Feld abgelehnt. Inventarnummer
  eindeutig ohne Rücksicht auf Groß-/Kleinschreibung, Menge ganze Zahl ab 1.
- **Standort (D-99):** kein vorbelegtes „Geräteraum / Zentrallager“ mehr,
  kein stilles „Vereinsgelände“ beim Speichern; der Standort darf leer
  bleiben (wie Android).
- **Ausgemustertes (D-100):** zählt in keiner Kennzahl und keiner Summe mit
  und erscheint in der Liste nur, wenn der Zustandsfilter „Ausgemustert“
  gewählt ist. Auch der Filter „Prüfung fällig“ lässt es weg.
- **Wert (D-101):** überall gleich: Zeitwert, sonst Anschaffungspreis, mal
  Menge. Ein Zeitwert von 0 € gilt als Wert. Gilt für Kennzahlen, Liste,
  Kartenansicht, Sortierung, PDF (vorher ohne Menge und mit Ausgemustertem)
  und die Inventar-Kachel im Dashboard (vorher nur Anschaffungspreis; das war
  für P27 vorgesehen und ist hier mit erledigt).
- **CSV (D-102):** beide Export-Knöpfe liefern dasselbe Format wie Android:
  19 Spalten, Semikolon, Punkt als Dezimalzeichen, Kategorie und Zustand als
  Klartext, neue Spalte „Aktuell ausgegeben“.
- **Sammelbearbeitung (D-103):** Ein angehaktes, leeres Feld leert dieses
  Feld bei allen gewählten Gegenständen (vorher wurden Zuständige Person und
  Standort dann still übergangen, andere Felder aber geleert). Der Standort
  darf nicht leer werden, eine Notiz braucht Text. Gezählt wird nur, was sich
  wirklich ändert. Fehler bleiben im Fenster stehen.
- **Foto (D-105):** Foto wählen oder (am Gerät mit Kamera) aufnehmen, auf
  höchstens 1024 Pixel verkleinert, gespeichert wie am Handy; Anzeige im
  Formular und in der Kartenansicht. Ein am Handy aufgenommenes Foto geht
  beim Bearbeiten am Desktop nicht mehr verloren; auch andere unbekannte
  Felder bleiben erhalten.
- **Ausgabe an Mitglieder (D-106):** Ausgemustertes lässt sich nicht neu
  ausgeben. Eine bestehende Ausgabe eines inzwischen ausgemusterten
  Gegenstands bleibt bearbeitbar.
- **PDF „Auswahl“:** Titel und Dateiname waren vertauscht (im PDF stand der
  Dateiname als Überschrift).
- **Sitzungen (Hinweis aus T-192):** Sind Stimmen eingetragen, aber weder
  Teilnehmer mit Stimmrecht noch die Zahl der Stimmberechtigten, zeigt das
  Formular einen gelben Hinweis. Speichern bleibt möglich.

### Pakete 21 und 22 — Sitzungen (D-117 bis D-119, D-121 bis D-123, D-127 bis D-131)

Regeln wie Android `Sitzungen.kt` in `src/utils/sitzungRegeln.ts` (16 Tests).

- **Unterschriften (D-117):** Jede Unterschrift speichert einen Fingerabdruck
  des Protokolltextes (gleiches Verfahren wie Android; ein gemeinsamer
  Prüfwert steht in beiden Testsammlungen). Mit der ersten Unterschrift ist
  das Protokoll gesperrt, mit der zweiten „Genehmigt“; von Hand lässt sich
  „Genehmigt“ nicht mehr wählen. „Bearbeiten“ bietet bei einem
  unterschriebenen Protokoll an, die Unterschriften zu entfernen. Wird der
  Text dennoch geändert (z. B. durch eingespielte Daten), zeigen Liste und
  PDF „Text nach Unterschrift geändert“. Zuordnung Leitung/Protokoll nur
  noch über die Rolle, nicht über Namen oder Reihenfolge (Rest aus P08).
  Unterschriften werden zusätzlich als Linienzüge gespeichert (wie Android),
  im PDF scharf gezeichnet. Ohne eingetragenen Namen oder bei abgesagter
  Sitzung keine Unterschrift.
- **Beschlüsse (D-118):** Neue Beschlüsse starten leer. Prüfung: Titel,
  Wortlaut, Stimmen eingetragen, Summe höchstens die anwesenden
  Stimmberechtigten, „angenommen“ nur mit mehr Ja- als Nein-Stimmen. Das
  Ergebnis folgt den Stimmen (änderbar). Die Beschlussnummer folgt beim
  Speichern ihrem TOP; im PDF stand vorher „[TOP TOP 2]“.
- **Pflichtangaben (D-122):** Fehler am Feld, Reiter markiert, Sprung zum
  ersten Fehler. Eine leere Stimmenzahl bleibt leer (wurde zu 1).
- **Keine Musterdaten (D-119, D-131):** Kein „Vereinsheim TSV Musterstadt“,
  keine Fantasiepersonen, kein „Standard-Vorstand laden“, keine feste
  Jahreszahl, keine erfundenen Stimmenzahlen beim Artwechsel; nichts
  vorangekreuzt. Auch in den PDFs keine Platzhalter („Musterstadt“,
  „1. Vorsitzender“, „Finanzamt“).
- **Registerauszug (D-127):** nur mit festgestellter Beschlussfähigkeit und
  einem angenommenen, gekennzeichneten Beschluss; enthält nur diese
  Beschlüsse; „form- und fristgerecht“ nur, wenn angekreuzt; kein
  pauschales „einstimmig / mehrheitlich angenommen“.
- **Einladung:** nur mit Datum, Uhrzeit, Ort und Tagesordnung. Ohne
  erfundene Angaben („Akkreditierung ab 30 Min.“, Antragsfrist 7 Tage,
  „Sportfreunde“, Zusicherung „form- und fristgerecht“); Grußformel wie
  Android.
- **Kennzahlen (D-128):** Finanzamt und Register zählen nur angenommene
  Beschlüsse; abgelehnt und vertagt getrennt.
- **Filter und Anzeige (D-121, D-129):** alle Sitzungsarten und Status
  wählbar; „Abgesagt“ statt „cancelled“.
- **Mail (D-130):** ohne „sportliche Grüße“, ohne „Unser Verein“; Leitung
  und Verein nur, wenn eingetragen.
- **Briefpapier (D-123):** wie Android ein gemeinsames Briefpapier aus der
  Rechnungsvorlage; ein früher nur für Sitzungen hochgeladenes gilt weiter,
  bis die Rechnungsvorlage eines hat.
- Android: ältere Desktop-Unterschriften („Versammlungsleitung gem.
  Satzung“) werden als Leitung erkannt; ein Test prüft den gemeinsamen
  Fingerabdruck.

### Pakete 19 und 20 — Kalender: Rechnen und Austausch (D-107 bis D-115, D-125, D-126)

- **Monatsansicht (D-107):** Vor/Zurück vom 31. eines Monats springt nicht
  mehr über den kürzeren Nachbarmonat hinweg.
- **Serien (D-108):** Jedes Vorkommen wird aus dem ersten Termin berechnet.
  Eine Monatsserie am 31. bleibt beim Monatsletzten (28./30./31.), eine
  Jahresserie am 29.02. fällt in anderen Jahren auf den 28.02. Vorher
  rutschte die Serie nach dem ersten kurzen Monat dauerhaft auf einen
  anderen Tag.
- **Intervall (D-109):** frei von 1 bis 99 für Tage, Wochen, Monate und
  Jahre („alle 3 Wochen am Montag und Mittwoch“). Das alte „Alle 2 Wochen“
  wird beim Öffnen zu „alle 2 Woche(n)“; bei mehreren Wochentagen war es
  vorher falsch.
- **Mehrtägige Termine (D-110)** stehen an jedem ihrer Tage, auch wenn sie im
  Vormonat beginnen.
- **Geburtstage und Jubiläen (D-111):** 29.02. in Jahren ohne Schalttag am
  28.02.; über den Jahreswechsel sichtbar; „Jahre im Verein“ statt „Jahre TSV“.
- **Terminformular (D-112):** prüft Ende vor Beginn, Uhrzeiten, Intervall und
  Serienende; die Meldung steht neben dem Speichern-Knopf. Jeder Teilnehmer
  nur einmal. „Heute“ in Ortszeit statt UTC.
- **iCal-Export (D-113):** gültige Wiederholungsregeln (kein „BIWEEKLY“
  mehr), keine erfundenen Teilnehmer-Adressen, lange Zeilen nach Norm
  gefaltet, kein fester Vereinsname.
- **iCal-Import (D-125):** Ganztägige Termine werden nicht mehr bei jedem
  Hin und Zurück einen Tag länger; die Kennung wird ohne Endung übernommen;
  Sonderzeichen werden richtig zurückgewandelt; Zeiten in UTC oder anderer
  Zeitzone werden in Berliner Ortszeit umgerechnet. Schon vorhandene Termine
  (gleiche Kennung oder gleicher Titel, Tag und Uhrzeit) werden in der
  Vorschau gekennzeichnet und übersprungen. Wiederholungen, die der Kalender
  nicht abbilden kann, und Teilnehmerlisten werden gemeldet.
- **CSV-Import:** ungültige Daten werden gemeldet statt übernommen; Uhrzeiten
  geprüft. CSV-Export: Wiederholung und Status auf Deutsch.
- **Einladung (D-114):** Text ohne Namen und Zusagen der Teilnehmer, Datum
  deutsch („Fr, 20.11.2026, 18:00–19:30 Uhr“), Vereinsname aus den
  Einstellungen (kein „TSV Musterstadt“, kein „Mit sportlichen Grüßen“),
  alle Empfänger in der Blindkopie.
- **Karte (D-115, E8):** bleibt; die Anfrage an OpenStreetMap geht weiterhin
  nur auf Klick hinaus, ein Hinweis sagt das jetzt.
- **Terminart löschen (D-126):** Rückfrage nennt, wie viele Termine sie
  benutzen; diese wechseln zu „Allgemeiner Termin“ statt mit unbekannter Art
  stehen zu bleiben.
- Regeln in `src/utils/kalenderRegeln.ts` (11 Tests), Austausch in
  `calendarService.ts` (5 Tests, erstmals).

### Nachtrag P19/P20 — Dialoge, Ausnahmetage, Terminarten

- **Keine Browser-Fenster mehr:** Alle Rückfragen und Meldungen, die noch als
  einfaches Browser-Fenster (`alert`/`confirm`) erschienen, kommen jetzt im
  Stil der App (`src/utils/dialoge.ts`, `DialogHost.tsx`). Betroffen waren
  42 Aufrufe in 25 Dateien: Sitzungen, SEPA-Lauf, Konten, Buchungen,
  Kontakte, Mitglieder, Rechnungen, Inventar, Anträge, Kalender, Startseite.
- **Einzelne Serientermine löschen (EXDATE), Desktop und Android:** Beim
  Löschen eines Serientermins aus der Terminliste oder den Termindetails
  fragt die App „Nur am …“ oder „Ganze Serie“. Der einzelne Tag wird als
  Ausnahme in der Serie vermerkt (`recurrence.exceptionDates`, auf beiden
  Fassungen gleich). Im Terminformular stehen die ausgenommenen Tage und
  lassen sich wieder aufnehmen. Bei „Ende nach n Mal“ zählt ein
  ausgenommener Tag mit (wie in iCal). Der iCal-Export schreibt sie als
  `EXDATE`, der Import liest sie; der Hinweis „wird nicht übernommen“
  entfällt. Vorher löschte der Knopf in der Terminliste ohne Rückfrage die
  ganze Serie.
- **Einzelnen Serientermin ändern, Desktop und Android:** „Bearbeiten“ bei
  einem Serientermin fragt „Nur am …“ oder „Ganze Serie“. Der einzelne Tag
  wird beim Speichern ein eigener Termin mit Verweis auf die Serie
  (`seriesOrigin`, auf beiden Fassungen gleich); die Serie lässt den Tag
  dann aus (Ausnahme wie beim Löschen). Die Details zeigen „einzeln
  geändert, ursprünglich am …“. Ein solcher Tag lässt sich in der Serie nicht
  wieder aufnehmen (sonst stünde er doppelt da). Wer die ganze Serie
  löscht, löscht ihre einzeln geänderten Termine mit; die Rückfrage nennt
  die Zahl. Die Termindetails zeigen bei Serien jetzt den angeklickten Tag
  statt des ersten Termins der Serie. Im iCal-Export steht der geänderte
  Termin als eigener Termin, die Serie mit dem Tag als `EXDATE`.
- Terminformular (Desktop): Felder, die das Formular nicht kennt (z. B.
  Farbe, Verweis auf die Serie), bleiben beim Speichern erhalten.
- **Standard-Terminarten löschbar (Desktop, wie Android):** mit Hinweis; ihre
  Termine wechseln zu „Allgemeiner Termin“ (bzw. der ersten verbleibenden
  Art). Die letzte Terminart lässt sich nicht löschen.
- Tests: zwei neu in `kalenderRegeln.test.ts`, einer in
  `calendarService.test.ts`, zwei in `KalenderTest.kt` (Android).

### Nachtrag P18

- Mitglieder-Import: ein negativer Beitrag wird nicht übernommen (Hinweis);
  P18 hatte ihn versehentlich positiv gemacht.
- **Android:** Mitglieder-Import liest „1.250“ wie die Buchungsimporte als
  1.250 € mit Hinweis (vorher 1,25 €); unlesbare Beiträge werden gemeldet.

### Paket 18 — Mitglieder- und Kontakt-Import (D-32, D-56 bis D-58, D-73)

- **Mitglieder: Spaltenzuordnung (D-32):** genaue Überschriften zuerst, jede
  Spalte nur einmal. „Status (Aktiv/Passiv/Ehrenmitglied/Gekündigt)“ der
  eigenen Vorlage wird wieder zum Status und nicht zum Namen.
- **Mitglieder: Nummern** werden aus der höchsten vergebenen fortgezählt (vorher
  aus der Anzahl). Bei „Immer als neues Mitglied anlegen“ bekommt ein
  Duplikat eine freie Nummer statt derselben noch einmal.
- **Mitglieder: „Aktualisieren“** überschreibt nur noch Felder, die in der
  Datei gefüllt sind. Vorher ersetzte es das ganze Mitglied: Erziehungsberechtigte,
  Mandatsfolge, abweichender Kontoinhaber und alles, was die Datei nicht
  enthielt, gingen verloren, und der Beitrag fiel auf einen Festwert.
- **Mitglieder: Werte:** „1.250“ ist 1.250 € mit Hinweis „bitte prüfen“ (vorher
  1,25 €). Unmögliche oder unlesbare Daten werden gemeldet statt geraten.
  Ohne Beitrag in der Datei gilt die Beitragsvorgabe der Mitgliedsart aus den
  Einstellungen (vorher fest 60/80/120 € jährlich). „Ausgetreten“ wird als
  Status erkannt. Alle Hinweise einer Zeile sind sichtbar, nicht nur der erste.
- **Kontakte (D-56):** Firma nur noch an einer Rechtsform als ganzes Wort
  erkannt; „Evangelisch“ oder „Zeugner“ machen niemanden mehr zur Firma.
  Die Art lässt sich vorgeben und in der Vorschau je Zeile umschalten.
- **Kontakte (D-57):** alle neun Kontakttypen; Ansprechpartner ohne feste
  Anrede „Herr/Frau“ und ohne feste Funktion; Vor- und Nachname, Anrede,
  Kontaktnummer, Hausnummer, Land, Bank, Kontoinhaber, Steuernummer,
  Handelsregister und Geburtsdatum werden übernommen.
- **Kontakte (D-58):** mögliche Duplikate (gleiche Nummer oder gleicher Name)
  sind in der Vorschau markiert und abgewählt; jede Zeile ist einzeln
  wählbar. Ungültige IBAN, BIC und E-Mail werden nicht übernommen und
  gemeldet. Eine vergebene Nummer aus der Datei wird ersetzt.
- Regeln in `src/services/kontaktImportService.ts` (9 Tests) und
  `memberImportService.ts` (8 Tests, erstmals).

### Pakete 16 und 17 — Kontakte und Buchungsimporte (D-54, D-55, D-61, D-65, D-67 bis D-71)

- **Kontakt-Summen (D-54):** Einnahmen und Ausgaben eines Kontakts zählen
  jetzt alle zugeordneten Buchungen; vorher nur die ersten zehn. Die Liste
  zeigt die neuesten zehn. Umbuchungen zählen nicht mit, Ausgaben stehen ohne
  doppeltes Minuszeichen.
- **Zuordnung zum Kontakt (D-55):** nur bei genau gleichem Namen oder gleicher
  Firma (Groß-/Kleinschreibung egal) oder über die Kontaktnummer als ganzes
  Wort. Vorher fand „Müller“ auch „Müller Bau GmbH“.
- **Kontaktformular (D-61, Rest):** IBAN mit Prüfziffer, BIC mit 8 oder 11
  Zeichen und beide E-Mail-Felder werden geprüft; die Meldung steht am Feld.
- **Duplikate im Bankimport (D-65):** Wie im Excel-Import: gleiches Datum,
  gleicher Betrag und dazu gleiche Belegnummer, gleicher Partner oder gleicher
  Text. Solche Zeilen sind in der Vorschau markiert und abgewählt.
- **Unlesbares Datum (D-67):** wird nicht mehr still zu „heute“, sondern zur
  Fehlerzeile. Das Datum lässt sich in der Vorschau eintragen; erst dann ist
  die Zeile wählbar. Gilt für beide Importe.
- **Spaltenzuordnung (D-68, D-70):** erst genaue Überschriften, dann
  Teiltreffer nur mit längeren Wörtern, jede Spalte nur einmal. „Name“,
  „Artikel“ oder „Bankverbindung“ landen nicht mehr in falschen Feldern.
- **Konto und Umsatzsteuer (D-69):** Beide Importe setzen ein SKR-42-Konto:
  aus der Datei (Kontonummer oder genauer Name), sonst das Konto der letzten
  Buchung desselben Partners. In der Vorschau je Zeile wählbar und für alle
  angehakten Zeilen zugleich. Die Umsatzsteuer kommt aus dem Konto; vorher
  setzte der Bankimport sie pauschal nach Bereich (19/7/0 %), und der
  Excel-Import wählte bei fehlendem Treffer irgendein erstes Konto.
- **Beträge (D-71):** „S“ und „H“ zählen nur direkt hinter einer Zahl.
  „1.250“ ist jetzt 1.250 € (vorher im Bankimport 1,25 €) und wird als
  „bitte prüfen“ markiert.
- **Weiteres:** Belegnummern im Jahr der Buchung; eine schon vergebene
  Belegnummer aus der Datei wird ersetzt und gemeldet. Die wirkungslose
  Auswahl „Bestehende Buchungen aktualisieren“ ist entfernt. Die Mustervorlage
  nennt aktuelle Kontonummern. Der Excel-Import schätzt den Bereich nicht mehr
  aus Stichwörtern, sondern nimmt Spalte, Vorschlag oder Vorgabe (wie Android).
- Regeln in `src/utils/kontaktRegeln.ts` (5 Tests) und
  `src/utils/importRegeln.ts` (13 Tests); Kontoauswahl `SkrKontoAuswahl`.

### Nachbesserungen aus der Prüfung von P13 bis P15

- **Kontoinhaber (T-128):** Nach dem Leeren des Felds bietet es den vollen
  Namen als Vorschlag an (Liste beim Eintippen und Knopf „Vorschlag
  übernehmen“).
- **Prozente der Auswertung (T-131):** Wo jedes Mitglied genau einmal zählt
  (z. B. Typ-Kachel), ergeben die Anteile zusammen genau 100 % (Verteilung
  nach größtem Rest); vorher konnten es 101 % sein.
- **Sammelbearbeitung (T-133):** Ein gelber Hinweis nennt, bei welchen
  Mitgliedern welche Felder gesperrt waren und deshalb nicht geändert wurden.

### Pakete 13 bis 15 — Mitglieder und Beitrag (D-02, D-21 bis D-27, D-29, D-63)

- **Mandatsfolge wählbar (D-21):** Im Mitgliedsformular gibt es bei SEPA die
  Auswahl „Erstlastschrift / Folgelastschrift“; neue Mitglieder beginnen mit
  Erstlastschrift (vorher immer Folgelastschrift).
- **Nach dem ersten Einzug (D-22):** Nach dem Verbuchen eines Beitragslaufs
  bietet die App an, die mit Erstlastschrift eingezogenen Mitglieder auf
  Folgelastschrift umzustellen; umgestellt wird nur auf „Umstellen“.
- **Kontoinhaber (D-25):** folgt dem Namen, solange das Feld leer ist oder
  noch den automatisch eingetragenen Namen enthält. Vorher wurde nur der
  erste Buchstabe übernommen („M“ statt „Max Müller“). Eine eigene Eingabe
  (Konto der Eltern) bleibt, und das Feld lässt sich leeren. Die
  `exhaustive-deps`-Warnung in `MemberFormModal` bleibt bewusst bestehen.
- **Beitragslauf (D-23):** Mitglieder mit Austritt vor dem Tag des Laufs
  oder Eintritt danach werden nicht mehr eingezogen; Ein- oder Austritt am
  selben Tag schon (wie Android).
- **Prüfprotokoll (D-24):** Der Stern „weicht vom Mitglied ab“ steht nur
  noch bei echter Abweichung; vorher hatte ihn jede Zeile, weil „Max Müller“
  mit „Müller, Max“ verglichen wurde.
- **Verbuchen (D-02):** auf Konto 40000 „Echte Mitgliedsbeiträge (laufend)“,
  ideeller Bereich, mit Sparte; Belegnummern ohne Doppel. Ein Lauf lässt
  sich nur einmal verbuchen; die Rückfrage ist ein eigenes Fenster.
- **Ausführungsdatum am Wochenende:** Hinweis unter dem Datumsfeld.
- **Sammelbearbeitung (D-27):** wendet die Regeln des Formulars an, z. B.
  setzt „gekündigt“ auch Beitrag, Zahlweise und Zahlungsart zurück und
  trägt das Austrittsdatum ein; bei Ausgetretenen oder beitragsfreien
  Mitgliedern wird kein Beitrag gesetzt.
- **Statistik (D-26):** Die Kachel „Mitgliedschaftstyp“ bezieht die Prozente
  auf alle Mitglieder; vorher konnten es zusammen über 100 % sein.
- **Stammblatt (D-29):** deutsche Begriffe statt „ACTIVE“, „FULL“, „SEPA“;
  dazu die nächste Lastschriftart.
- **Telefonnummern (D-63, E9):** Ein Klick kopiert die Nummer in die
  Zwischenablage (Mitglieder, Kontakte, Rechnungsliste); ein `tel:`-Link tut
  am Rechner oft nichts. E-Mail-Adressen öffnen weiter das Mailprogramm.
- Regeln in `src/utils/mitgliedRegeln.ts` (11 Tests) und
  `src/services/beitragsBuchung.ts` (4 Tests), dazu 1 Test in
  `sepaService.test.ts`.

### Paket 11 und 12 — Rechnungen: Inhalt, PDF und Zahlung (D-01, D-05, D-44 bis D-46, D-49 bis D-52, D-149)

- **Als bezahlt markieren (D-01, D-46):** Die Statusknöpfe in den
  Rechnungsdetails waren nicht angeschlossen. Jetzt fragt „Als bezahlt
  markieren“ nach Zahldatum, Zahlart und auf Wunsch nach der Einnahmebuchung
  (Konto, Einnahmekonto mit Vorschlag nach der Sphäre). Die Buchung lautet
  über den Bruttobetrag, bei mehreren Steuersätzen aufgeteilt je Satz;
  Belegnummer = Rechnungsnummer (bei Kollision mit Zusatz). „Zurück auf
  offen“ fragt, ob die Buchung gelöscht oder behalten wird; „Stornieren“
  geht erst nach dem Zurücksetzen. Wie in der Android-Fassung.
- **Bearbeiten und Löschen:** Ändert sich der Betrag einer Rechnung mit
  Buchung, fragt die App, ob die Buchung angeglichen wird. Löschen fragt
  immer nach (der Knopf in den Details löschte bisher ohne Rückfrage) und bei
  einer Buchung, ob sie mitgelöscht wird. Doppelte Rechnungsnummern werden
  abgelehnt; Meldungen stehen neben dem Speichern-Knopf statt in
  Browserfenstern. „Bezahlt“ lässt sich im Formular nicht mehr direkt wählen.
- **Kleinunternehmer (D-05, D-52):** Häkchen je Rechnung (Feld
  `smallBusiness`, wie Android): alle Positionen 0 %, im PDF nur der
  Gesamtbetrag und darunter der Hinweis aus der Vorlage
  (`smallBusinessNotice`, Standard „Gemäß § 19 UStG wird keine Umsatzsteuer
  berechnet.“).
- **PDF:** kein erfundener „Kreditinstitut: Sparkasse / Hausbank“ mehr
  (D-44); keine interne Kennung wie „member-1699…“ als „Kundennummer / Ref.“
  (D-50); Akzentfarbe der Vorlage wirkt und ist jetzt einstellbar,
  Briefpapier und oberer Rand gelten auch auf Folgeseiten (D-45);
  Seitenumbruch für lange Texte, Summen und Zahlungsbox, Fußzeile und
  „Seite x von y“ auf jeder Seite; Telefon, E-Mail und Webseite des Vereins
  im Briefkopf (D-149, auch in der Android-Fassung).
- **GiroCode (D-51):** Verwendungszweck „Rechnung RE-…“ in Zeile 11 statt der
  Rechnungsnummer in der Zeile für genormte Referenzen; die Zahlungsbox steht
  direkt nach dem Inhalt statt höchstens bei 235 mm (konnte Text überdecken).
- **Menge (D-49):** bis zu drei Nachkommastellen (0,75 bleibt 0,75). Die
  Umsatzsteuer wird je Satz aus der Nettosumme gerechnet, nicht je Position.
- **Vorlage:** Briefpapier nur noch als PNG oder JPG (ein PDF oder WEBP
  erschien bisher ohne Meldung gar nicht); die Felder für unteren, linken und
  rechten Rand sind ausgeblendet, weil sie nie wirkten (Werte bleiben
  gespeichert).
- Regeln in `src/services/rechnungsRegeln.ts` (14 Tests); Android:
  `Absender.kontaktZeile` mit einem Test.

### Paket 10 — Ablage im Ordner (D-40, D-47)

- **Zuwendungsbestätigungen (D-40):** Das PDF liegt jetzt unter
  „Buchhaltungsbelege & Finanzen → Belege <Jahr> → Spendenbescheinigungen“,
  wie am Handy. Vorher lag es ohne Ordner (bzw. nach der Nacharbeit aus D-16
  im Jahresordner). Beim Löschen der Bestätigung wird es weiterhin
  mitgelöscht.
- **Rechnungen (D-47):** Je Rechnung gibt es genau ein PDF-Dokument
  (`doc-inv-<Rechnung>`); erneutes Speichern mit „PDF ablegen“ ersetzt es,
  statt ein weiteres anzulegen. Ablage unter „Belege <Jahr> →
  Ausgangsrechnungen“. Nach dem Löschen einer Rechnung verschwindet ihr PDF
  jetzt auch sofort aus der Dokumentenliste.
- **Vorhandene PDFs** werden einmalig in diese Ordner einsortiert, sofern sie
  ohne Ordner, im Haupt- oder im Jahresordner liegen. Was jemand selbst in
  einen anderen Ordner verschoben hat, bleibt dort. Die Ordner werden am
  Namen erkannt; am Handy angelegte gleichnamige Ordner werden mitbenutzt.
- Regeln in `src/utils/belegOrdner.ts` (4 neue Tests).

### Paket 09 — Spenden (D-03, D-10, D-38, D-39, D-41, D-42)

- **Betrag in Worten (D-03):** „Ein Euro“ statt „Eins Euro“, „Einhunderteins“
  statt „Einhundertein“, „ein Cent“ statt „eins Cent“; gerechnet in ganzen
  Cent. Wie die Android-Fassung. Bereits ausgestellte Bestätigungen werden
  nicht nachgeprüft (Entscheidung E7).
- **Worte passen ins Feld (D-42):** Ein langer Text wurde im einzeiligen Feld
  des Vordrucks abgeschnitten. Jetzt wird die Schrift bis 5,5 pt verkleinert,
  danach zweizeilig in 6 pt (wie Android).
- **Einnahmebuchung auf Konto 40450 (D-10, D-38):** Nummernkreis 40400,
  ideeller Bereich, 0 % Umsatzsteuer, Belegnummer `SP-<Jahr>-<Ziffern>` ohne
  Doppel (bei Kollision `-2`, `-3` …) statt Zufallszahl. Vorher stand nur die
  Kategorie „Spenden / Schenkungen“ ohne Konto an der Buchung; die
  Finanz-Auswertung zählte sie deshalb nicht als Spende.
- **Verknüpfte Buchung (D-39):** Beim Bearbeiten ging die Verknüpfung zur
  Buchung verloren (das Formular baute die Bestätigung neu auf). Jetzt bleibt
  sie, und wenn Betrag, Datum oder Name nicht mehr zur Buchung passen, fragt
  die App: angleichen oder unverändert lassen. Beim Löschen: nur die
  Bestätigung oder Bestätigung und Buchung.
- **Unterschrift (D-41):** In den Vereinsdaten lässt sich eine Unterschrift
  zeichnen (Maus, Stift oder Finger), gespeichert als Linienzüge im selben
  Format wie am Handy. Je Bestätigung ein Häkchen „Unterschrift ins PDF
  setzen“; sie steht dann rechts neben Ort und Datum.
- **Formular:** doppelte Bestätigungsnummern werden abgelehnt; Meldungen
  stehen neben dem Speichern-Knopf statt in Browserfenstern.
- Tests: `betragInWorten.test.ts` (7), `spendenBuchung.test.ts` (5),
  `unterschrift.test.ts` (4).

### Nachbesserungen aus der Prüfung von P08

- **Vorstand (T-73, T-74):** Die Meldung „nicht gespeichert“ steht jetzt
  neben dem Knopf „Vereinsstammdaten speichern“ statt oben auf der Seite.
- **Sparte umbenennen (T-82):** Die App lädt die Daten danach ohne
  Ladebildschirm neu; die Seite bleibt stehen, und die Meldung erscheint
  grün an der Spartenliste.

### Paket 08 — Einstellungen und Datenschutz (D-143, D-144, D-145, D-146, D-147, D-148, D-94)

- **Vorsitz und Kassenwart (D-143):** werden nur noch an der Funktion
  erkannt, mit derselben Wortliste wie die Android-Fassung. Vorher wurde ein
  „Kassenprüfer“ oder ein Schriftführer an Platz 2 zum Kassenwart und ein
  „Stellv. Vorsitzender“ an Platz 1 zum Vorsitzenden; beides erschien auf
  Zuwendungsbestätigungen, im Lastschriftprotokoll und im Briefkopf. Passt
  niemand, bleibt das Feld leer und die Seite zeigt einen Hinweis.
  Vorstandseinträge brauchen Name und Funktion, die E-Mail wird geprüft,
  dieselbe Person mit derselben Funktion zweimal wird abgelehnt (zwei Ämter
  für eine Person bleiben erlaubt). Ganz leere Zeilen werden beim Speichern
  weggelassen. Funktionsvorschläge wie bei Android. Regeln in
  `src/utils/vorstand.ts` (8 Tests).
- **Währung, Datumsformat, Geschäftsjahresbeginn (D-144):** entfernt; sie
  wurden gespeichert, aber nirgends ausgewertet. Vorhandene Werte entfallen
  beim nächsten Speichern.
- **Logo (D-145):** Auswählen oder Entfernen speichert nicht mehr sofort
  (dabei gingen auch alle anderen ungespeicherten Eingaben mit), sondern erst
  mit „Speichern“; bis dahin steht „Noch nicht gespeichert“ daneben. Ebenso
  speichern Design, Farbschema und Schrift nur noch ihren eigenen Wert.
- **Sparten (D-146, Rest):** lassen sich umbenennen; der neue Name wird an
  allen Mitgliedern, Buchungen (auch Teilbuchungen), Inventarstücken und
  Terminen übernommen. Gleiche Sparten werden ohne Rücksicht auf Groß- und
  Kleinschreibung abgelehnt, mit Meldung. Regeln in
  `src/utils/sparteUmbenennen.ts` (5 Tests).
- **Eigene Rückfragen statt `alert()`/`confirm()` (D-147):** neues Fenster
  `BestaetigungsDialog`. „Alle Daten löschen“ verlangt wie bei Android das
  Eintippen von LÖSCHEN; Schnappschuss wiederherstellen und löschen fragen im
  selben Fenster nach. Die Meldungen zu Vorstand und Sparten stehen jetzt
  direkt bei der Liste.
- **Fehlerbericht ohne Drittanbieter (D-148):** Der Direktversand über
  formsubmit.co ist entfernt. Er übertrug Name, E-Mail, Beschreibung,
  Browserkennung und Fenstergröße an einen fremden Dienst. Jetzt öffnet der
  Bericht das E-Mail-Programm; ohne E-Mail-Programm hilft „Text kopieren“.
- **Beitragsvorgaben je Mitgliedsart (D-94):** neue Karte in den
  Vereinsdaten (Vollmitglied, ermäßigt, Kinder/Jugend, Familie, Fördermitglied:
  Betrag und Zahlweise), gespeichert wie bei Android unter
  `membershipFeeDefaults`, Startwerte 18/12/10/30/25 € monatlich. Beim Anlegen
  eines **neuen** Mitglieds werden Betrag und Zahlweise beim Wählen der Art
  vorgeschlagen; bestehende Mitglieder bleiben unverändert. Regeln in
  `src/utils/beitragsVorgaben.ts` (4 Tests).
- **Telefon und Webseite des Vereins (D-149):** bleiben; sie werden in
  Paket 11 in Briefkopf bzw. Fußzeile der Rechnung gedruckt.

### Paket 07 — EÜR und Berichte (D-09, D-34, D-35, D-36, D-37, D-132)

- **Gemeinsame Rechnung:** EÜR-Seite und EÜR-PDF rechnen jetzt an derselben
  Stelle (`src/services/buchungsBerichte.ts`, 16 Tests), in ganzen Cent.
- **EÜR-PDF (D-34):** löst aufgeteilte Buchungen Teil für Teil auf und
  gliedert wie die EÜR-Seite nach Sphäre, Nummernkreis und Konto, jeweils mit
  Einnahmen, Ausgaben und Ergebnis. Vorher zählte eine aufgeteilte Buchung
  ganz zur Sphäre der ersten Zeile, und gegliedert wurde nur nach dem Textfeld
  „Kategorie“. Unter der Tabelle steht der Stand der Besteuerungsgrenze.
- **Besteuerungsgrenze § 64 Abs. 3 AO (D-09, D-37, D-132):** je Kalenderjahr
  45.000 € bis 2025 und 50.000 € ab 2026 (Einnahmen einschließlich
  Umsatzsteuer). Überschritten erst bei MEHR als dem Grenzbetrag; genau
  50.000,00 € sind noch frei. Bei „Alle Geschäftsjahre“ keine Kachel, sondern
  ein Hinweis. Die Kachel heißt nicht mehr „Kleinunternehmerregelung“ (das ist
  § 19 UStG und etwas anderes).
- **Buchungsjournal-PDF (D-35):** Umbuchungen stehen in der Liste (mit
  „Konto -> Zielkonto“; die Standardschrift des PDF kennt den Pfeil „→“ nicht
  und druckte stattdessen „!'“, T-66), zählen aber nicht in den Summen. Am Ende stehen
  Einnahmen, Ausgaben und Saldo getrennt statt einer Gesamtsumme aller Beträge.
- **Buchungs-CSV (D-36):** Spalten wie in der Android-Fassung, neu mit Teil,
  Zielkonto, Sparte und SKR-Konto. Aufgeteilte Buchungen erscheinen als eine
  Zeile je Teil (z. B. „2/3“), mit dem Vorzeichen der Buchung, sodass die
  Summe der Betragsspalte stimmt.
- **Aufgeteilte Buchung:** Die vorgegebene zweite Zeile ist jetzt Konto 68500
  „Bankgebühren & Zahlungsverkehr“ statt 68100 (heißt im Kontenrahmen
  „Büromaterial & Druckkosten“); ebenso in der Android-Fassung.

### Paket 06 — Buchungsformular und -liste (D-11, D-14, D-15, D-30)

- **Filter „Nur Einnahmen“ / „Nur Ausgaben“ (D-11):** filtert nach der
  Buchungsart statt nach dem Vorzeichen. Umbuchungen erscheinen dort nicht
  mehr.
- **Umbuchung ohne Zielkonto (D-11):** wird beim Speichern abgelehnt.
- **Wechsel Einnahme ↔ Ausgabe (D-15):** Passt der gewählte Nummernkreis nicht
  zur neuen Art, springt die Auswahl auf den ersten passenden.
- **Aufgeteilte Buchung (D-14):** Die vorgegebene zweite Zeile (Konto 68100)
  trägt Nummernkreis und Bezeichnung jetzt so, wie sie im Kontenrahmen stehen,
  statt eines veralteten festen Textes.
- **Sammelbearbeitung (D-30):** Bei Umbuchungen und aufgeteilten Buchungen
  bleiben Sphäre, Sparte, Konto des Kontenrahmens und Umsatzsteuer unverändert;
  eine Umbuchung wird nicht auf ihr eigenes Zielkonto umgestellt. Ein Hinweis
  nennt anschließend, wie viele Buchungen übersprungen wurden. Regeln in
  `src/utils/buchungSammel.ts` (8 Tests), wie bei Android.

### Nachbesserungen aus der Prüfung von P02 bis P05

- **Sitzung bearbeiten (T-01):** Das Sitzungsformular übernahm seine Werte nur
  beim allerersten Anzeigen. Beim Bearbeiten erschienen deshalb die Angaben
  einer zuvor geöffneten Sitzung oder die Musterwerte (z. B. bei Leitung und
  Protokollführung), und das Speichern schrieb sie in die bearbeitete Sitzung.
  Das Formular wird jetzt bei jedem Öffnen neu aufgebaut.
- **Spenden und Rechnungen (T-15):** Nummer und Datum stehen in getrennten
  Spalten. Sortieren nach Datum ordnet Belege desselben Tages nach ihrer
  Nummer; die Nummer ist auch für sich sortierbar (Zahlen als Zahlen, also
  RE-2026-9 vor RE-2026-10).
- **Inventar (T-19):** Inventarnummer und Bezeichnung in getrennten, einzeln
  sortierbaren Spalten.
- **Neue Spalten erscheinen an ihrem Platz:** Wer die Spaltenreihenfolge
  einer Tabelle selbst festgelegt hat, bekommt die neue Spalte „Nr.“ direkt
  vor „Datum“ (bzw. „Inventar-Nr.“ vor „Gegenstand“), nicht am Tabellenende.
- **Mitgliedsformular (T-17):** Reiter mit einem Fehler sind rot markiert; das
  Speichern springt zum ersten davon (vorher wertete es den Fehlerstand des
  vorigen Versuchs aus). Der Fehler am Eintrittsdatum wird jetzt angezeigt.
- **Kontaktformular (T-18):** Das Speichern springt zum ersten fehlerhaften
  Feld; neben dem Knopf steht die Meldung.
- In beiden Formularen verschwindet eine rote Markierung, sobald das Feld
  stimmt.
- **Belege im Ordner (T-23, D-16):** Der Beleg einer Buchung wird in
  „Buchhaltungsbelege & Finanzen / Belege <Jahr>“ abgelegt (fehlende Ordner
  werden angelegt, wie bei Android). Früher ohne Ordner abgelegte Belege
  werden einmalig dorthin einsortiert; selbst einsortierte bleiben, wo sie
  sind. Regeln in `src/utils/belegOrdner.ts` (6 Tests).
- **Löschen einer Buchung mit Beleg:** Die Rückfrage sagt, dass der Beleg aus
  der Dokumentenverwaltung mitgelöscht wird (einzeln und beim Sammellöschen).
- **Sparte in Verwendung (T-31):** Die Meldung erscheint jetzt direkt bei der
  Spartenliste statt oben auf der Seite.
- Sortierhilfen in `src/utils/sortierung.ts` (5 Tests).

---

## [1.1.0] — 2026-10-05 — Vereinfachung auf eine einzige Betriebsart

Grundlegende Umstellung: Statt drei Betriebsarten (lokal allein / lokal mit
Supabase-Cloud / gehosteter eigener Server) gibt es jetzt nur noch eine
einzige — rein lokal, ein Gerät. Zusammen mit KI-Funktionen und
E-Mail-Versand sind auch alle Funktionen entfernt, die nur für eine der
beiden anderen Betriebsarten existierten. Vollständige Begründung und
Versionsgeschichte der einzelnen Schritte: `claude/plan-vereinfachung.md`

### Nachtrag 10 — Zuwendungsbestätigung nach amtlichem Muster; „Speichern unter“ überall

- **Vordruck:** Die Zuwendungsbestätigung (Geld- und Sachspende) ist nach dem
  amtlichen Muster 034122 des Bundesfinanzministeriums neu aufgebaut
  (Maße am Beispiel-PDF gemessen, Schrift Helvetica ≈ Arial).
- **Steuerangaben immer aktuell:** Finanzamt, Steuernummer, Datum des
  Freistellungs-/Feststellungsbescheids, Veranlagungszeitraum und
  begünstigte Zwecke kommen aus den Vereinsstammdaten. Neue Bescheinigungen
  übernehmen sie automatisch (Felder schreibgeschützt); bereits
  ausgestellte behalten ihre gespeicherten Angaben (rechtlich maßgeblich) und
  lassen sich mit einem Knopf bewusst aktualisieren. Es werden keine Werte
  mehr erfunden; fehlende Angaben werden angezeigt.
- **Neue Felder in den Vereinsstammdaten:** Veranlagungszeitraum, Datum des
  Feststellungsbescheids (§ 60a AO), steuerbegünstigte Zwecke.
- **„Speichern unter“ bei jedem Download:** Alle Herunterladen-Knöpfe der App
  (PDF, CSV, XML, Excel, Kalender, QR-Codes, Dokumente, Belege …) laufen über
  eine gemeinsame Funktion. Wo das Fenster es kann, erscheint die Ordner- und
  Namensauswahl; sonst wird normal heruntergeladen. Mehrere Dokumente werden
  als eine ZIP-Datei mit einem einzigen Dialog gespeichert.

### Nachtrag 9 — Spenden: ZIP-Download und Listen-Export

- In der Spendenübersicht gibt es drei neue Knöpfe: **PDFs als ZIP** (alle
  Zuwendungsbestätigungen als einzelne PDFs in einer ZIP-Datei), **Excel**
  und **CSV** (Liste mit allen Angaben der Bescheinigungen). Ist etwas
  angekreuzt, gilt der Export für die Auswahl, sonst für alle gerade
  angezeigten (gefilterten) Bescheinigungen. Es wird nichts verändert oder
  gelöscht; eine Sammel-Löschung gibt es bewusst nicht.
- ZIP- und Excel-Dateien werden ohne zusätzliches Paket erzeugt
  (`src/utils/zipWriter.ts`, `src/utils/xlsxWriter.ts`), die Listenlogik
  steht in `src/services/donationExport.ts`.
- Bekannte Eigenheit der CSV-Datei: Excel entfernt beim Öffnen führende
  Nullen (PLZ 01067 → 1067). Die Excel-Datei hat dieses Problem nicht.

### Nachtrag 8 — Dunkelmodus für die ganze App; feste Farben bei Piktogrammen und Schnellzugriff

- Bisher fehlte bei rund 700 weißen und vielen hellgrauen Flächen die
  dunkle Entsprechung, deshalb blieben Kacheln, Tabellen und Dialoge im
  Dunkelmodus weiß. Jetzt haben alle Flächen, Schriften, Rahmen, Trennlinien
  und farbigen Hinweisflächen (grün, rot, gelb, blau …) ihr dunkles Gegenstück.
  Die Ergänzung ist in 73 Dateien als normale `dark:`-Klassen im Quelltext
  sichtbar (keine versteckte Sonderregel). Stellen, die schon eine dunkle
  Klasse hatten, blieben unverändert.
- Unverändert hell bleibt das öffentliche Aufnahmeformular
  (`PublicApplicationForm.tsx`).
- Die Piktogramme in der Seitenleiste und die Schnellzugriff-Knöpfe auf dem
  Dashboard behalten in jedem Farbschema ihre ursprünglichen Farben (Standard-
  Blau/Indigo): `.vm-sidebar svg` und `.vm-quick button` in `index.css`.
- Nachbesserung nach dem ersten Test: Mehrere Stellen (u. a. die Sparten-Felder
  in den Vereinsstammdaten) nutzten Farbstufen, die es gar nicht gibt
  (`slate-850`, `-750`, `-650`) und blieben deshalb hell; jetzt auf die
  vorhandenen Stufen gesetzt. Der Knopf „XML herunterladen" im Beitragslauf
  bleibt im Dunkelmodus hell mit dunkler Schrift, damit er sich vom blauen
  Feld abhebt und in jedem Farbschema lesbar ist.

### Nachtrag 7 — Farbschema in der ganzen Oberfläche; volle Breite

- Die Seitenleiste bekommt je Farbschema einen eigenen dunklen Ton (Grün:
  Tannengrün, Rot: Weinrot, …). Dazu werden nur die drei Grautöne der Leiste
  umgefärbt; die Farben der Menü-Piktogramme bleiben in jedem Schema wie im
  Standard.
- Im hellen Modus bekommen Seitenhintergrund und Kopfzeile einen leichten
  Farbschimmer des Schemas. Im dunklen Modus bleibt alles neutral.
- Der Arbeitsbereich ist nicht mehr auf 1280 Pixel begrenzt (jetzt 2400).
  Die Tabellen (Mitglieder, Buchungen, Inventar, Kontakte, Rechnungen,
  Spenden) füllen die Breite aus, die Spalten wachsen anteilig mit. Die
  Einstellungen sind auf 1600 Pixel begrenzt, damit Formularzeilen nicht zu
  lang werden.

### Nachtrag 6 — Farbschemata und Schriftarten

- Einstellungen → Allgemein → „Erscheinungsbild": neue Auswahl **Farbschema**
  (Blau, Grün, Rot, Orange, Gelb, Türkis, Violett, Anthrazit) und
  **Schriftart** (Systemschrift, Source Sans 3, Chakra Petch, Lora).
- Beides gehört zum Verein: Es wird in den Vereinsdaten gespeichert und reist
  mit der Datensicherung mit. Zusätzlich merkt sich das Gerät die Wahl, damit
  Anmeldebildschirm und Start nicht erst in den Standardfarben erscheinen.
- Die Farben werden zentral ausgetauscht (index.css): Die Stufen von „blue" und
  „indigo" bekommen je Schema andere Werte. Grün und Rot sind dunkel und
  gedeckt, damit die leuchtenden Knöpfe „Bestätigen" und „Löschen" auffallen.
  Orange und Gelb tragen dunkle Schrift auf den Flächen.
- Die Schriften kommen als Dateien mit dem Programm (`@fontsource/…`, SIL Open
  Font License), nichts wird von fremden Servern geladen. **Neue Pakete:**
  `@fontsource/source-sans-3`, `@fontsource/chakra-petch`, `@fontsource/lora`.
- PDF-Dokumente behalten ihre eigene Schrift und Farbe. Vom Benutzer gewählte
  Datenfarben (Kalenderkategorien, Ordnerfarben) bleiben unverändert.

### Nachtrag 5 — Automatische Sperre einstellbar

- Einstellungen → Allgemein → „Regionale Anzeige & Standardeinstellungen":
  neue Auswahl „Automatische Sperre bei Inaktivität" (5 Minuten bis 4 Stunden,
  Standard 15 Minuten) und „Nie automatisch sperren". Die Einstellung gilt für
  das Gerät und wird sofort übernommen. Die Sperrfunktion selbst gab es schon,
  nur die Einstellmöglichkeit fehlte.
- Mausrad und Berührung zählen jetzt ebenfalls als Aktivität — wer lange
  Listen nur durchscrollt, wurde sonst mittendrin gesperrt.

### Nachtrag 4 — Fehlerbericht: der Server-Weg entfällt, Hinweis bei gesperrter Verbindung

- **Ursache, warum nie ein Bericht ankam (am Linux-Laptop geprüft):**
  1. Der Weg über den lokalen Server konnte nie funktionieren: Der Mail-Dienst
     FormSubmit nimmt nur Anfragen aus einer Webseite an und weist Anfragen
     vom Server mit „Make sure you open this page through a web server" ab.
  2. Die Empfängeradresse musste bei FormSubmit einmalig bestätigt werden
     („This form needs Activation") — das ist inzwischen geschehen.
  3. Im Heimnetz des Testers lieferte der DNS des Routers für `formsubmit.co`
     keine Adresse; mit 1.1.1.1 und 8.8.8.8 klappte die Auflösung sofort.
- Der Versand läuft deshalb nur noch direkt aus dem App-Fenster. Der
  Server-Endpunkt `/api/submit-bugreport` und der dadurch ungenutzte
  `src/services/apiClient.ts` sind entfernt.
- Scheitert die Verbindung, nennt die Meldung die Ursache und gibt den Hinweis,
  dass ein Filter im Netzwerk (Fritzbox, Pi-hole, VPN) die Adresse
  `formsubmit.co` blockieren kann und dort als Ausnahme einzutragen ist.

### Nachtrag 3 — Seiten und Seiten-Auswahl auch in Kontakten, Rechnungen, Dokumenten und Spenden

- Diese vier Tabellen zeigten bisher alles auf einer Seite. Sie haben jetzt
  wie Mitglieder, Buchungen und Inventar die Seitenwahl (25 / 50 / 100 / alle)
  und dieselbe Seiten-Auswahl (Kopfkästchen = aktuelle Seite, Auswahl bleibt
  beim Blättern, „Alle n … der Tabelle auswählen" in der Leiste).
- Spenden hat erstmals Auswahlkästchen. Es gibt dort noch keine Sammelaktion
  für die Auswahl.
- Gemeinsamer Baustein für die Seitenwahl: `src/hooks/usePagination.ts`.

### Nachtrag 2 — Fehlerbericht meldet die Wahrheit; Auswahl über mehrere Seiten

- **Fehlerbericht:** Der lokale Server meldete „erfolgreich", auch wenn der
  Mail-Dienst (FormSubmit) den Bericht gar nicht angenommen hatte — er prüfte
  nur, ob überhaupt eine Antwort kam, nicht deren Inhalt. Die Oberfläche
  zeigte dann grün „versendet". Jetzt zählt allein die Antwort des
  Mail-Dienstes; bei einem Fehlschlag erscheint ein gelber Hinweis mit dem
  Grund und dem Weg über „E-Mail-App" bzw. „Kopieren". Auch bei Erfolg heißt
  es nur noch „an den Mail-Dienst übergeben", denn ob die Mail im Postfach
  landet, lässt sich von der App aus nicht prüfen.
- **Desktop-Fassung:** Die Meldungen des mitgelieferten Servers wurden nur bis
  zum Start im Terminal angezeigt, danach nicht mehr. Sie laufen jetzt
  dauerhaft weiter (nützlich bei der Fehlersuche).
- **Auswahl in Tabellen mit Seiten (Mitglieder, Buchungen, Inventar):** Das
  Kästchen in der Kopfzeile wählt nur noch die Einträge der aktuellen Seite.
  Die Auswahl bleibt beim Blättern erhalten. Reicht eine Seite nicht für alle
  Treffer, bietet die Leiste über der Tabelle „Alle n … der Tabelle
  auswählen" an (n = alle Treffer der aktuellen Suche/Filterung);
  „Auswahl aufheben" leert alles. Rechenlogik: `src/utils/tableSelection.ts`
  (7 Tests).

### Nachtrag nach dem ersten Test der Linux-Fassung — Einspielen meldet Fehler jetzt laut

- Beim Einspielen einer Datensicherung (z. B. Linux-AppImage, frisches Gerät)
  kamen Kontakte an, Mitglieder, Buchungen und Dokumente fehlten, ohne dass
  eine Fehlermeldung erschien. Ursache der Stille: Der Speichercode wich bei
  einem Fehler der Browser-Datenbank unbemerkt auf den kleinen
  localStorage aus, der nur Listen bis 25 Einträge aufnimmt. Kleine Bereiche
  sahen dadurch heil aus, große verschwanden.
- Das Einspielen schreibt jetzt ohne diesen Ausweg, zählt jeden Bereich nach
  dem Schreiben nach und nennt am Ende alle Bereiche, die nicht gespeichert
  werden konnten, samt der Fehlerursache.
- Die Fehlermeldung erscheint im Einspiel-Dialog selbst (rot, über den
  Knöpfen), nicht in der Statusleiste dahinter — vorher sah es aus, als sei der
  Klick wirkungslos.
- **Ursache auf dem Linux-Gerät:** Ein früher installiertes `.deb` hatte im
  Datenordner (`~/.local/share/de.vereinsmanager.app`) eine Datenbank mit einer
  neueren Webansicht angelegt, die das AppImage nicht lesen konnte
  („Unable to establish IDB database file"). Abhilfe: Den Ordner umbenennen oder
  löschen und die App neu starten. Betrifft nur, wer zwischen verschiedenen
  Paketarten wechselt.

### Release 1.1.0 — Version, Pakete, Update-Prüfung

- Versionsnummer auf 1.1.0 (`package.json`, `package-lock.json`, `tauri.conf.json`, `Cargo.toml`).
- **Ein Paket je Betriebssystem:** Windows `.exe` (NSIS-Installer), macOS `.dmg`
  (Apple Silicon), Linux `.AppImage`. Die `.msi` und die `.deb` entfallen
  (`--bundles` im Workflow). Anleitung und README angepasst.
- **Update-Prüfung korrigiert:** Sie fragte beim Konto `strelitzerfc` nach neuen
  Fassungen statt bei `alpenglowsea`. Die Ersatz-Download-Links zeigen jetzt auf
  die Release-Seite statt auf erfundene Dateinamen.

### Schritt 7g — Tote Reste aufgeräumt

- **Passwortprüfung:** Der eigene Ersatzweg für Browser ohne `crypto.subtle`
  (JavaScript-Eigenbau von PBKDF2) und die Klartext-Prüfung alter Passwörter
  sind entfernt. Gespeicherte Passwörter bleiben gültig (gleiches Verfahren,
  gleiches Format). Fehlt dem Browser die Funktion (App über `http://` von
  einer anderen Adresse als `localhost` geöffnet), meldet die Anmeldung das
  jetzt klar, statt auf Selbstgebautes auszuweichen.
- **Rechte-Gerüst entfernt:** Seit der Umstellung auf ein Gerätepasswort darf
  jeder alles. Die Attrappen `mayAccess`/`mayEdit`/`requireEdit`, die Hilfsfunktion
  `guard`, die Props `canEdit`/`onLocked`, `lockClass`/`lockTitle`
  (`src/utils/uiLock.ts` gelöscht), die „Nur Leserecht“-Hinweise und die
  grauen Navigations-Sperren sind aus allen Ansichten raus (rund 460 Stellen).
  Das Verhalten der App ändert sich dadurch nicht.
- **Notfall-Scan entfernt:** `scanAndRecoverLegacyData` samt Knopf in den
  Einstellungen und automatischem Aufruf beim Start. Er suchte in Speicherorten
  (`vm_members`, `club_members`, `VereinsManager_DB` …), die in der gesamten
  Git-Geschichte nie von der App beschrieben wurden. Snapshots lassen sich
  weiterhin unter Einstellungen wiederherstellen.
- **GitHub-Zugriffstoken:** `getGitHubToken`/`setGitHubToken` entfernt; es gab
  keinen Aufrufer, die Update-Abfrage braucht für das öffentliche Repository
  kein Token.
- **Nie benutzt:** Die Datei `DocumentMoveModal.tsx`, vier Funktionen
  (`getContactTypeMeta`, `computeContactDisplayName`, `findSkr42SubCategory`,
  `extractCity`), die alten PayPal-Bilder (rund 1,4 MB in `public/` und
  `src/assets/`, der QR-Code wird längst im Programm erzeugt), `Caddyfile.example`
  (verwies auf nicht mehr vorhandene Docker-Dateien) sowie die Reste aus Google
  AI Studio (`metadata.json`, `assets/.aistudio/`).
- **Nachtrag:** Die Wurzel-`logo_transparent.png` (nicht verwendet; die App
  nutzt die Datei in `public/`) und die Tabelle der alten 4-stelligen
  Kontonummern (`LEGACY_CODE_MAP`) sind entfernt. Buchungen mit alten
  Kontonummern werden nicht mehr automatisch umgesetzt.

### Schritt 7f — „Alle lokalen Daten löschen“ löscht wirklich alles; Muster-Knopf entfernt

- „Alle lokalen Daten löschen“ ließ bisher Vereinsstammdaten, Ordner,
  Vorlagen, Inventar-Ausgaben, Anwendungs- und Startseiten-Einstellungen sowie
  einige Reste im localStorage stehen. Jetzt wird jeder Datenbereich geleert
  (die Schleife läuft über `STORES`, ein neuer Bereich wird automatisch
  mitgeleert). Danach legt die App die leere Grundausstattung an (zwei
  Starter-Konten, Ordner, Kalender-Kategorien, neutrale Stammdaten). Das
  Gerätepasswort, die Farbwahl und die automatische Sperre bleiben.
- Die Grundausstattung ist aus dem Start (`init`) in die gemeinsame Funktion
  `legeGrundausstattungAn` gewandert; Start und Löschen nutzen denselben Code.
- Der Knopf „Musterdaten laden (TSV Musterstadt)“ und `resetToDemoData()` sind
  entfernt: Er überschrieb die echten Vereinsdaten mit Beispieldaten; für
  Beispieldaten gibt es die Demo, die eine eigene Datenbank hat.

### Schritt 7e — „Alle lokalen Daten löschen“ löscht auch die Snapshots

- Die automatischen Sicherheitskopien (Snapshots) blieben beim Löschen aller
  Daten zurück: bis zu zwölf vollständige, unverschlüsselte Kopien des
  Bestands. Schlimmer noch: Beim nächsten Start stellte die Altdaten-Prüfung
  die gerade gelöschten Daten aus genau diesen Kopien wieder her.
- Jetzt werden beim Löschen alle Snapshots mitgelöscht, eine wartende
  automatische Sicherung wird verworfen, und während des Löschens entsteht
  keine neue. Schlägt das Löschen der Snapshots fehl, meldet die Oberfläche
  einen Fehler, statt Erfolg anzuzeigen. Drei neue Tests.

### Schritt 7d — Verschlüsselte Datensicherung (optional)

- Beim Erstellen einer Sicherung fragt die App, ob sie mit Passwort
  verschlüsselt werden soll (vorgewählt, aber nicht erzwungen). Verfahren:
  AES-256-GCM, Schlüssel per PBKDF2-SHA256 mit 600 000 Runden, Salz und
  Startzahl zufällig je Datei. Ein falsches Passwort oder eine veränderte
  Datei wird erkannt.
- Deutlicher Hinweis im Dialog: Das Passwort ist nicht wiederherstellbar;
  das Erstellen verlangt eine Bestätigung.
- Beim Einspielen (Einstellungen und Ersteinrichtung) wird eine verschlüsselte
  Datei erkannt und das Passwort abgefragt. Alte, unverschlüsselte Sicherungen
  lassen sich wie bisher einspielen.
- Ohne `crypto.subtle` (App über „http://“ von einer fremden Adresse) ist die
  Verschlüsselung nicht verfügbar; die App sagt das, statt auf eine
  selbstgebaute Verschlüsselung auszuweichen. Elf neue Tests.

### Schritt 7c — Vereinsstammdaten neu geordnet, Import korrigiert

- Reiter „Vereinsstammdaten“ in sieben Kacheln gegliedert: Logo, Name &
  Anschrift, Kontaktdaten, Vorstand, Steuerliche Angaben, SEPA, Abteilungen.
- Beim Einspielen einer Sicherung im Modus „nur Ergänzen“ verdrängten die
  Muster-Stammdaten eines frischen Geräts die echten Angaben aus der Datei
  (Vorstand, VR-Nr., Steuernummer …). Die Stammdaten werden jetzt feldweise
  zusammengeführt: selbst Eingetragenes bleibt, leere Felder und unberührte
  Mustertexte werden aus der Datei gefüllt. Fünf neue Tests.
(Projektdokumentation, nicht Teil dieses Repositories).

### 🤖 KI-Funktionen vollständig entfernt

- Belegerkennung (OCR), Buchungsvorschläge und automatische
  Protokollauswertung samt der zugehörigen Google-Gemini-Anbindung komplett
  entfernt — acht Dateien gelöscht, Server-Endpunkte und Freigabe-Verwaltung
  aus `server.ts` entfernt, Abhängigkeit `@google/genai` entfernt.

### ✉️ SMTP/E-Mail-Versand entfernt

- Direktversand von Sitzungseinladungen und -protokollen über einen
  vereinseigenen SMTP-Server entfernt. Protokolle werden weiterhin als PDF
  exportiert und lassen sich über das lokale E-Mail-Programm verschicken
  (`mailto:`-Link) — nur der zusätzliche Direktversand ab der Anwendung
  selbst ist weggefallen.
- Die serverseitige Verschlüsselungsschicht, die ausschließlich das
  SMTP-Passwort schützte, ist mit entfernt worden, da es dieses Passwort
  nicht mehr gibt.

### 🖥️ Eigener Server-Betrieb entfernt

- Die Betriebsart „gehostet" (eigener Server mit eigener SQLite-Datenbank,
  eigenen Benutzerkonten und feingranularen Rechten) ist komplett entfernt.
  Die zugrunde liegende Erkenntnis: Die eigentlichen Vereinsdaten lagen auch
  in dieser Betriebsart immer lokal im Browser — der eigene Server bot nur
  eine zusätzliche Anmeldesperre, keine geteilten Daten.
- Die allgemeine Zugriffsschranke vor den `/api`-Routen (Zugriffsschlüssel)
  blieb an dieser Stelle zunächst erhalten — sie war nie betriebsart-spezifisch
  (siehe aber unten: sie ist inzwischen ebenfalls entfernt).

### ☁️ Cloud-/Supabase-Betrieb entfernt

- Die Betriebsart „lokal mit Supabase" (Zwei-Wege-Synchronisation zwischen
  mehreren Geräten über eine Cloud-Datenbank) ist komplett entfernt, inkl.
  des gesamten Supabase-Unterbaus, der Cloud-Benutzerverwaltung und der
  SQL-Dateien für Schema und Zugriffsregeln.
- **Mitgliederbefragung komplett entfernt:** Diese Funktion setzte den
  Cloud-Betrieb voraus und ist mit ihm entfernt worden — Ansicht,
  Navigationspunkt, Speicherfunktionen, Typen und der Eintrag in der
  Datensicherung.

### 🧹 Aufräumen

- Den Typ für die (jetzt nicht mehr vorhandene) Auswahl zwischen
  Betriebsarten vollständig aus dem Code entfernt.
- **Docker komplett entfernt** (`Dockerfile`, `docker-compose.yml`,
  `.dockerignore`, `nginx.conf`) — es gibt nur noch die eine lokale
  Betriebsart, für die kein Container nötig ist.
- **Server hört nur noch auf diesem einen Gerät:** Der mitgelieferte Server
  lauscht jetzt fest auf `127.0.0.1` statt wie bisher auf allen Adressen —
  er ist aus dem Netzwerk nicht mehr erreichbar.
- **Mobil-Ansicht komplett entfernt:** Die eigene, für schmale Bildschirme
  gebaute Ansicht mit Tab-Leiste ist entfernt — ihre Grundlage (Zugriff von
  einem zweiten, mobilen Gerät auf dieselben Daten) war an die jetzt
  entfernten Mehrgeräte-Betriebsarten gebunden.
- **Öffentliches Aufnahmeformular nicht mehr von außen erreichbar:** Der
  URL-Aufruf, über den das Aufnahmeformular ohne Anmeldung von außen
  aufgerufen werden konnte (samt teilbarem Link und QR-Code), ist entfernt —
  seine Grundlage (ein von außen erreichbarer Server) ist mit der
  Localhost-only-Entscheidung oben entfallen. Das Formular selbst bleibt für
  die manuelle Erfassung durch den Vorstand erhalten.
- **`/api/health` entfernt:** Diese offene Statusseite diente ausschließlich
  der Container-Überwachung durch Docker und ist mit Docker entfernt worden.
- Ein dabei gefundener, kleiner Folgefehler korrigiert: Das
  Aufnahmeformular zeigte noch ein „SSL & DSGVO-konform"-Abzeichen, das seit
  dem rein lokalen Betrieb ohne SSL schlicht falsch war.
- Dokumentation auf den neuen Stand gebracht: `README.md` grundlegend
  überarbeitet, `DEPLOYMENT_GUIDE_DE.md` komplett entfernt (beschrieb
  ausschließlich die jetzt entfernten Betriebsarten), `DESKTOP_RELEASE.md`
  und `.github/workflows/release-desktop.yml` von Erwähnungen der
  entfernten Funktionen bereinigt.

### 🔐 Benutzerverwaltung durch ein einziges Gerätepasswort ersetzt

- Das Rechtesystem (18 einzeln einstellbare Bereiche je Person, serverseitig
  durchgesetzt) ist komplett entfernt. Es war an die jetzt entfernte eigene
  Server-Variante gebunden und ergab allein lokal keinen Sinn mehr: Zugriff
  auf einen Rechner mit VereinsManager bedeutet ohnehin schon Zugriff auf
  die Vereinsdaten selbst — eine feinere Sperre innerhalb der Anwendung
  täuschte dort einen Schutz vor, den es nicht gab.
- Es gibt jetzt genau ein Passwort pro Gerät. Wer es kennt, hat vollen
  Zugriff — keine einzelnen Benutzerkonten, keine Rollen, keine
  Bereichsrechte mehr.
- Anmeldemaske: Der „Importieren"-Reiter ist entfallen (Import geschieht
  jetzt im neuen Einrichtungs-Dialog, siehe unten), „Registrieren" ist auf
  Benutzername und Passwort verschlankt.
- **Neu: Einrichtungs-Dialog.** Erscheint nach der ersten erfolgreichen
  Anmeldung oder Registrierung, wenn auf diesem Gerät noch keine
  Vereinsdaten liegen — Wahl zwischen „Neuen Verein anlegen" und
  „Vorhandene Daten importieren" (.json-Sicherung). Bewusst *nach* der
  Anmeldung statt davor, damit das Gerätepasswort in jedem Fall schon
  feststeht, bevor irgendetwas mit Vereinsdaten passiert.
- Der Dialog erscheint auch nach einer gewöhnlichen Anmeldung, nicht nur
  nach einer Registrierung — sonst stünde jemand, der zuvor „Alle lokalen
  Daten löschen" genutzt hat, vor einem leeren, unerklärten Dashboard statt
  vor der Wahl zwischen neu anlegen und importieren.
- Das Gerätepasswort reist nicht mehr mit der Datensicherung (.json) mit —
  es gehört zu diesem einen Gerät, nicht zum Verein. Eine importierte
  Sicherung überschreibt dadurch nie das Passwort des Zielgeräts, und eine
  weitergegebene Sicherung gibt nie versehentlich ein Passwort mit weiter.
- Bestehende Installationen mit einem alten Mehrbenutzerkonto müssen sich
  einmalig neu „registrieren", um ein neues Gerätepasswort zu vergeben. Die
  Vereinsdaten selbst sind davon nicht betroffen und werden unverändert
  erkannt — eine automatische Übernahme der alten Konten findet nicht statt.
- Gelöschte Dateien: `src/data/roles.ts`, `src/utils/permissions.ts` (samt
  Test), `src/components/PermissionMatrix.tsx`,
  `src/components/UserManageModal.tsx`.

### 🔑 Server-Zugriffsschlüssel entfernt

- Der reguläre Weg ist die Nutzung über die Tauri-Desktop-App — ein
  zusätzlicher Zugriffsschlüssel vor den `/api`-Routen bot dort (zusätzlich
  zur Localhost-only-Bindung oben) keinen echten Zugewinn mehr und ist
  entfernt.

### 📋 Aufnahmeformular: Staatsangehörigkeit und Erziehungsberechtigte ergänzt, Foto-Einwilligung/Gesundheitsbestätigung entfernt

- Neu, mit der Mitgliederdatenbank verknüpft: Staatsangehörigkeit sowie —
  bei Minderjährigen — Name, Verhältnis, Telefon und E-Mail des
  Erziehungsberechtigten.
- Die Fragen nach Foto-Einwilligung und Gesundheitsbestätigung im Formular
  waren überflüssig und sind entfallen, samt der zugehörigen, nie genutzten
  Einstellungen `requirePhotoConsent`/`requireHealthConfirmation`.

### 🧹 Aufräumen (Einstellungen)

- Reiter „Betriebsmodi" aus den Einstellungen entfernt — es gibt nur noch
  die eine Betriebsart.
- Die Kachel „Aktueller lokaler Datenbestand auf diesem Gerät" ist von dort
  in den Tab „Datensicherung" gewandert, wo sie inhaltlich besser hinpasst.

---

## [1.0.0] - 2026-09-28

### 🧪 309 Tests in 20 Dateien, alle grün — erstes Release

Ab hier zählt die Versionsnummer wirklich mit: 1.0.0 ist ein bewusster
Neustart der Zählung (siehe Anmerkung bei v1.2.3 weiter unten). Das
Rechtesystem, die eigene Server-Variante samt Passwort-Rücksetzung und die
Absicherung der /api-Routen sind fertig und durch echte Tests geprüft.

### ⚖️ Lizenz vereinheitlicht: Apache 2.0

Die Lizenzangabe war an drei Stellen widersprüchlich: README.md sagte
„Apache 2.0", `package.json` sagte `UNLICENSED` (praktisch: keine Weitergabe
erlaubt), `src-tauri/Cargo.toml` sagte `MIT`. Außerdem fehlte die eigentliche
`LICENSE`-Datei, obwohl die README schon darauf verlinkte. Jetzt gilt
einheitlich Apache 2.0: `package.json`, `package-lock.json` und `Cargo.toml`
tragen `"Apache-2.0"`, und die `LICENSE`-Datei mit dem vollständigen Text
liegt im Projekt.

### 📖 Deployment Guide und README auf den gehosteten Betrieb gebracht

- **`DEPLOYMENT_GUIDE_DE.md`, Abschnitt „Modus 3", vollständig neu**: Beschrieb
  bisher noch den alten Stand — der Container liefere nur die Anwendung aus,
  die Daten müssten trotzdem bei Supabase liegen (die dort genannte „offene
  Baustelle"). Beschreibt jetzt den tatsächlichen Stand: eigene
  SQLite-Datenbank, Ersteinrichtung des ersten Vorstandskontos, die 18 einzeln
  einstellbaren Rechtebereiche samt Rollenvorlagen, „Passwort vergessen", die
  aktualisierte Tabelle „Wo liegen die Daten?" (jetzt drei echte Spalten statt
  zwei) und die neue Caddy-Vorlage neben `nginx.conf`. Der Abschnitt
  „Benutzer- & Rollenverwaltung" unterscheidet jetzt klar zwischen den zwei
  unabhängigen Benutzersystemen (gehostet vs. Supabase).
- **`README.md` aufgeräumt:**
  - Die Klon-Adresse in der Schnellstart-Anleitung zeigte auf einen falschen,
    nicht existierenden Namen (`strelitzerfc` statt `alpenglowsea`) —
    korrigiert.
  - Das Supabase-Tabellen-Schema stand als eigener, unvollständiger und
    veralteter SQL-Block in der README (fehlten u. a. `donations`,
    `contacts`, `sepa_runs` und viele weitere Tabellen) — ersetzt durch einen
    Verweis auf die tatsächlich gepflegte `supabase_schema.sql`, damit es
    nur noch eine einzige, aktuelle Quelle dafür gibt.
  - Das Architektur-Diagramm und die Betriebsmodus-Beschreibung nannten
    „Modus 3" fälschlich als reinen App-Server ohne eigene Daten und führten
    „Modus 3: Desktop-App" als dritten Modus, obwohl das gar kein
    Betriebsmodus, sondern eine der drei Oberflächen ist — richtiggestellt,
    inklusive Erwähnung der Mobil-Ansicht.

### 🧪 Echte Route-Tests für den eigenen Server, Caddy als Alternative zu nginx für HTTPS

- **Neu: Tests, die den echten Aufrufweg nehmen, nicht nur die einzelnen
  Bausteine.** Bislang prüften alle Tests des eigenen Servers (Anmeldung,
  Sitzungen, "Passwort vergessen" usw.) die zugehörigen Funktionen direkt —
  nie den tatsächlichen Weg, den ein Aufruf von außen nimmt: durch die
  Ratenbegrenzung, den Zugriffsschutz und die eigentliche Route in
  `server.ts`. Neu hinzugekommen ist `src/server/serverRoutes.test.ts`: 15
  Tests, die per echtem HTTP-Aufruf (Werkzeug `supertest`, neue
  Testabhängigkeit) genau diesen Weg gehen — unter anderem die vollständige
  Kette bei "Passwort vergessen": E-Mail-Versand abfangen (keine echte Mail
  verschickt), den Link daraus auslesen, prüfen, dass er sowohl den
  Reset-Token als auch den Zugriffsschlüssel enthält, und mit dem
  ausgelesenen Token tatsächlich ein neues Passwort setzen. Dazu die
  Ratenbegrenzung des Zurücksetzens (fünf Aufrufe je Stunde, danach 429) und
  der Zugriffsschutz (fehlender oder falscher Schlüssel → 401), beide
  ebenfalls über echte Aufrufe statt nachgebaut.
- **Dafür musste `server.ts` minimal anfassbar gemacht werden:** Bisher
  startete die Datei beim bloßen Laden unbedingt einen echten Server
  (`startServer()` am Dateiende) — das hätte jeden Testlauf einen echten
  Netzwerk-Port belegen und einen Vite-Entwicklungsserver hochfahren lassen.
  `app` wird jetzt exportiert, und der Aufruf von `startServer()` unterbleibt,
  wenn die neue Umgebungsvariable `VM_TEST_NO_LISTEN=1` gesetzt ist — genau
  wie bei `VM_DATA_DIR` ausschließlich für Tests gedacht. Kein bisheriger
  Startweg (`npm run dev`, der gebaute Server, die Desktop-Fassung) setzt
  diese Variable, alle starten unverändert wie zuvor.
- **Caddy als zweite, einfachere Vorlage für HTTPS von außen** (`Caddyfile.example`,
  neu, neben der bereits vorhandenen `nginx.conf`): Caddy holt sich das
  Let's-Encrypt-Zertifikat für die eigene DynDNS-Adresse beim ersten Start
  selbständig und erneuert es von selbst — ohne den separaten
  `certbot`-Schritt, den `nginx.conf` braucht. Für Vereine ohne eigene
  Erfahrung mit Zertifikaten der Weg mit den wenigsten Schritten; `nginx.conf`
  bleibt daneben bestehen, wer lieber dabei bleibt oder es schon eingerichtet
  hat.
- Dabei eine veraltete Kommentarzeile in `server.ts` korrigiert (behauptete,
  kein `/api`-Endpunkt verlange eine Anmeldung — stimmte seit Einführung des
  Zugriffsschutzes nicht mehr). Reine Dokumentation, kein Verhaltensunterschied.

### 🔑 Passwort vergessen — jetzt für alle Benutzer auf dem eigenen Server, nicht nur den Vorstand

- **Neu: Auf dem eigenen Server (Betriebsart "gehostet") kann jeder Benutzer
  sein Passwort selbst zurücksetzen**, nicht mehr nur über ein Vorstandsmitglied
  mit Zugriff auf die Benutzerverwaltung. Auf der Anmeldemaske ein Link
  "Passwort vergessen?", E-Mail-Adresse eingeben, fertig — sofern zu dieser
  Adresse ein Konto besteht, kommt eine E-Mail mit einem Link zum Setzen eines
  neuen Passworts.
- **Der Link ist genau eine Stunde gültig und genau einmal einlösbar.** Danach
  bzw. nach der ersten Nutzung funktioniert er nicht mehr — für einen neuen
  Versuch muss erneut "Passwort vergessen" angestoßen werden, was zugleich
  jeden noch offenen älteren Link desselben Kontos entwertet. Ein
  fehlgeschlagener Versuch (z. B. ein zu schwaches neues Passwort) verbraucht
  den Link dagegen **nicht** — er bleibt bis zum Ablauf gültig.
- **In der Datenbank steht nie der Link selbst, sondern nur sein
  SHA-256-Streuwert.** Anders als das Sitzungstoken der laufenden Anmeldung
  verlässt ein Reset-Link den Server per E-Mail und kann theoretisch in einem
  Postfach, einer Weiterleitung oder einer Mail-Datensicherung landen — läge
  der Rohwert in der Datenbank, würde eine ausgelesene Datenbankdatei allein
  schon genügen, um ihn zu benutzen. Mit dem Streuwert braucht es zusätzlich
  die E-Mail selbst.
- **Kein Ausplaudern, ob eine Adresse überhaupt ein Konto hat:** Die Antwort
  auf die Anfrage ist immer derselbe allgemeine Satz ("falls zu dieser Adresse
  ein Konto besteht …"), unabhängig davon, ob tatsächlich eine E-Mail
  verschickt wurde. Einzige Ausnahme: Ist auf diesem Server serverseitig noch
  gar kein E-Mail-Versand eingerichtet, wird das offen gesagt — das betrifft
  dann ohnehin die ganze Installation und nicht ein einzelnes Konto, verrät
  also nichts über eine bestimmte Adresse.
- **Begrenzt auf 5 Anfragen pro Stunde** (dieselbe Ratenbegrenzung wie bei den
  anderen empfindlichen Endpunkten), damit sich das Verfahren nicht zum
  Verschicken beliebig vieler E-Mails missbrauchen lässt.
- **Ein Stolperstein wurde dabei schon vor der ersten Nutzung gefunden und
  behoben:** Der Server nimmt grundsätzlich keine Anfrage ohne den
  Zugriffsschlüssel dieser Installation an — auch nicht die Anmeldemaske
  selbst. Ein Reset-Link, der nur den Reset-Token enthalten hätte, wäre auf
  einem Gerät, das diesen Schlüssel noch nicht kennt (z. B. weil sich jemand
  von einem neuen Rechner aus anmelden will), ins Leere gelaufen, bevor er
  überhaupt die Reset-Maske erreicht. Der Link trägt deshalb beides: den
  Zugriffsschlüssel und den Reset-Token.

### 📱 Mobil-Ansicht: sechs schlanke Bereiche für den Zugriff unterwegs

- **Neu: Wer sich auf einem Telefon anmeldet, bekommt eine eigene, für den
  schmalen Bildschirm gebaute Ansicht** — eine Tab-Leiste am unteren Rand
  statt der Seitenleiste, große Tippflächen statt dichter Tabellen, keine
  Rechtsklick-Menüs (die gibt es auf einem Touchscreen ohnehin nicht). **Das
  ist dabei ausdrücklich kein zweiter, unabhängiger App-Baum**: Anmeldung,
  Berechtigungen und Daten sind exakt dieselben wie am Desktop, nur die
  Darstellung unterscheidet sich. Jede der sechs Kacheln/Tabs erscheint nur,
  wenn die Person laut ihren Rechten mindestens Lesezugriff auf den
  jeweiligen Bereich hat — dieselbe Prüfung wie am Desktop, kein zweites
  Regelwerk, das aus Versehen einmal etwas anderes erlauben könnte. Von der
  Mobil-Ansicht aus lässt sich jederzeit zur Desktop-Ansicht wechseln (und
  zurück), außerdem abmelden.
- **Start-Übersicht:** Kacheln für Mitgliederbestand, Kontostand, nächste
  Termine und Sitzungsdienst — sowie ein Hinweis auf neue Aufnahmeanträge,
  falls welche warten. Alle Zahlen darauf sind bewusst dieselben
  Berechnungen wie die Desktop-Kacheln (u. a. `LiquidityWidget`,
  `MeetingsKpiWidget`), damit auf dem Telefon niemals eine andere Zahl steht
  als am Desktop. Was auf dem Desktop per Drag & Drop frei anordenbar ist,
  gibt es hier bewusst nicht — auf einem Touchscreen ergäbe das keinen Sinn.
- **Mitglied nachschlagen:** bewusst nur lesend — anlegen, ändern und
  löschen bleiben der Desktop-Ansicht vorbehalten, das hier ist für "wie war
  noch die Telefonnummer/Adresse von …", nicht für die Pflege der
  Stammdaten. Bewusst **nicht** angezeigt werden Bankverbindung (IBAN/BIC)
  und interne Notizen: Ein Blick übers Handy-Display sollte nicht gleich
  eine Kontonummer zeigen; wer das braucht, nutzt die Desktop-Ansicht. Dazu
  Filter (Status, Abteilung, Mitgliedstyp) und Sortierung — bewusst nur eine
  kleine, mobil-taugliche Auswahl statt aller Spalten der Desktop-Tabelle,
  standardmäßig eingeklappt, damit die Liste beim Öffnen nicht gleich von
  Filtern verstellt wird.
- **Termine:** ebenfalls nur lesend, dafür mit denselben vier Ansichten wie
  am Desktop — Monat, Woche, Tag und Liste —, für den schmalen Bildschirm
  aber neu zusammengesetzt statt 1:1 übernommen: Das dichte Tabellen-Gitter
  des Desktops wäre auf einem Telefon unlesbar klein, Monat und Woche zeigen
  deshalb nur einen Punkt pro Termin, ein Tipp auf einen Tag blendet darunter
  die ausführliche Liste ein. **Dabei einen Bug in der ursprünglichen
  Termine-Liste gefunden und behoben:** Sie hatte nur die rohen
  Termin-Einträge gefiltert, ohne Wiederholungen aufzulösen — ein
  wöchentliches Training wäre nur an seinem ursprünglichen Starttag
  aufgetaucht und danach aus "anstehend" verschwunden, obwohl es sich ja
  jede Woche wiederholt. Läuft jetzt für alle vier Ansichten einheitlich
  über denselben `CalendarService` wie der Desktop-Kalender, der
  Wiederholungen (und Geburtstage/Jubiläen) korrekt auflöst — und bleibt
  dabei wie am Desktop auf die nächsten 60 Tage begrenzt, damit sich ein
  jährlich wiederkehrender Termin nicht endlos weit in die Zukunft
  auffächert.
- **Buchung erfassen:** der Anwendungsfall "gerade eben eingekauft, Beleg
  gleich digitalisieren, bevor er verloren geht" — eine Buchung erfassen und
  direkt den Beleg dazu fotografieren. Die Kamera-Erfassung selbst ist
  nichts Neues: Sie verwendet unverändert dasselbe Bauteil wie am Desktop
  (`ReceiptCameraScannerModal`), das bisher nur aus der Desktop-Buchungsmaske
  heraus erreichbar war. Gespeichert wird über genau denselben Weg wie am
  Desktop — keine zweite Speicherlogik. Nummernkreis und Konto (SKR 42)
  werden wie am Desktop als zwei zusammenhängende Felder erfasst statt als
  einzelne "Kategorie", mit denselben Auswahl- und Hilfsfunktionen, damit
  hier nie eine Auswahl möglich ist, die es am Desktop nicht gibt — und
  genau wie am Desktop ist der Nummernkreis nicht auf Einnahme/Ausgabe
  beschränkt, beide Kontenlisten stehen immer zur Auswahl.
- **Sitzungsdienst:** eine bereits angelegte Sitzung unterwegs nachschlagen
  und ihr nachträglich eine Audioaufnahme hinzufügen — Anlegen und Löschen
  von Sitzungen bleiben der Desktop-Ansicht vorbehalten. Die Aufnahme- und
  Auswertungslogik selbst ist nicht neu gebaut: Es wird exakt dasselbe
  Bauteil wie in der Desktop-Sitzungsmaske wiederverwendet
  (`MeetingAudioRecorderModal`), samt der dort bereits vorhandenen Sperre für
  Mitgliederversammlungen (§ 201 StGB) und der Gemini-Transkription. Das
  Ergebnis wird anschließend genauso übernommen wie am Desktop: erkannte
  Angaben (Titel/Datum/Ort/etc.) überschreiben die bisherigen, eine erkannte
  Tagesordnung ersetzt die bestehende, erkannte Teilnehmer werden ohne
  Duplikate ergänzt, die Transkript-Essenz wird an die Notizen angehängt.
- **Dokumente (schlank):** bewusst nur ansehen, suchen und hochladen — keine
  Ordnerverwaltung (anlegen, löschen, verschieben von Ordnern), das war
  deine ausdrückliche Wahl gegenüber der vollen Dokumentenverwaltung. Zum
  Ansehen und Hochladen wird nichts neu gebaut: Beide Bildschirme sind exakt
  dieselben Bauteile wie am Desktop (`DocumentViewerModal`,
  `DocumentUploadModal`), unverändert wiederverwendet — die Schaltfläche
  "Metadaten bearbeiten" bleibt dabei automatisch verborgen, weil sie das
  Bauteil nur zeigt, wenn man ihr eine Bearbeiten-Funktion übergibt, und die
  wird hier schlicht nicht übergeben. Beim Hochladen lässt sich weiterhin
  ein vorhandener Ordner auswählen (kein Anlegen/Verwalten von Ordnern,
  sondern nur "wohin soll die Datei"), damit am Desktop nicht alles im
  Hauptverzeichnis landet, was jemand unterwegs hochgeladen hat. Filter
  (Kategorie, Dateiformat, Jahr) und Sortierung übernehmen dieselbe Logik
  wie am Desktop. **Bewusste Abweichung vom bisherigen Verhalten:** "Neueste
  zuerst" sortiert jetzt — wie am Desktop — nach dem Dokumentendatum (z. B.
  dem Datum auf dem Beleg selbst), nicht mehr nach dem technischen
  Hochlade-Zeitpunkt. Das passt in aller Regel besser zum Inhalt, kann sich
  aber von der bisherigen Reihenfolge unterscheiden, wenn ein älteres
  Dokument erst kürzlich nachgetragen wurde.

### 👁️ Spalten ein-/ausblenden per Rechtsklick — jetzt in allen sechs Tabellen, dabei zwei weitere Bugs gefunden und behoben

- **Neu: Rechtsklick auf einen beliebigen Spaltenkopf öffnet ein Menü, in dem
  sich jede Spalte dieser Tabelle einzeln an- oder abhaken lässt.** Nichts
  wird dabei gelöscht — eine ausgeblendete Spalte bleibt an ihrem Platz in
  der (per Drag & Drop wählbaren) Reihenfolge, sie erscheint nur nicht mehr
  in der Anzeige, bis man sie über dasselbe Menü wieder anhakt. Mindestens
  eine Spalte muss sichtbar bleiben — bei nur noch einer verbleibenden
  sichtbaren Spalte ist ihr Kästchen im Menü deaktiviert, damit nie eine
  komplett leere Tabelle entstehen kann. Wie Reihenfolge und Breite wird das
  je Tabelle im Browser gespeichert (`localStorage`), nicht in der Cloud —
  bleibt also über einen Neustart erhalten, aber nur auf diesem Gerät in
  diesem Browser.
- **Zwei Bugs dabei gefunden und behoben, die das Menü zunächst unbenutzbar
  gemacht hätten:**
  1. **Das Menü ging im selben Moment wieder zu, in dem es aufging** — ein
     Rechtsklick auf einen Spaltenkopf schien zunächst gar nichts zu tun.
     Ursache: Das Menü meldet sich selbst beim Dokument an, um sich beim
     nächsten Klick außerhalb zu schließen — das geschah aber noch während
     genau desselben Rechtsklicks, der das Menü überhaupt erst geöffnet
     hatte, und fing dieses eine Ereignis gleich selbst wieder ab. Behoben,
     indem sich das Menü seine eigenen Schließen-Erkennungen erst einen
     Wimpernschlag später (einen "Tick") anmeldet, nie für den öffnenden
     Klick selbst.
  2. **Scrollen innerhalb der Spaltenliste (bei vielen Spalten, eigene
     Bildlaufleiste im Menü) hat das Menü sofort geschlossen**, statt einfach
     nur die Liste zu scrollen. Ursache: Dieselbe Schließen-Erkennung, die
     merken soll "die Seite scrollt weg, also Menü schließen", hat technisch
     bedingt auch das Scrollen *innerhalb* des Menüs selbst mitbekommen.
     Behoben, indem jetzt vorher geprüft wird, ob das Scroll-Ereignis aus dem
     Menü selbst kommt — nur ein Scrollen außerhalb schließt es noch.
  - Beide Ursachen habe ich nicht nur vermutet, sondern im laufenden Browser
    nachgewiesen (Ereignis-Protokollierung mit Zeitstempeln) und die
    Reparatur danach ebenfalls live getestet, bevor ich weitergemacht habe.
- **Für jede der sechs Tabellen einzeln entschieden, welche zusätzlichen
  Felder als eigene Spalte angeboten werden, wie sie ggf. zusammengefasst
  sind und ob sie zunächst sichtbar oder ausgeblendet starten** (die
  jeweilige Entscheidung stand jedes Mal bei dir, hier nur die Umsetzung):
  - **Mitglieder:** Alle besprochenen Felder neu als Spalte, E-Mail bleibt
    wie gewünscht unter dem Namen in der Namensspalte, Telefonnummer als
    eigene Spalte.
  - **Finanzen:** Nummernkreis & SKR42-Konto bleiben wie gewünscht in einer
    gemeinsamen Spalte, Steuersatz als eigene Spalte — beide starten
    sichtbar, die übrigen neuen Spalten (Abteilung, Notizen, Buchungsart)
    starten ausgeblendet. Bei gesplitteten Buchungen zeigt eine Spalte
    "Gemischt" an (mit den einzelnen Werten als Tooltip), sobald sich die
    Teilbuchungen in diesem Feld unterscheiden.
  - **Kontakte:** BIC, Kontoinhaber und Tags wie gewünscht als eigene,
    sichtbare Spalten; die übrigen sieben neuen Felder (Geburtsdatum, Mobil,
    Webseite, Steuer-ID, Handelsregister, Gläubiger-/Schuldnernummer,
    Notizen) starten ausgeblendet.
  - **Rechnungen:** Da hierzu keine Platzierungswunsch genannt wurde, starten
    alle sieben neuen Spalten ausgeblendet (Liefertermin, Zahlungsziel,
    Bezahlt am, Zahlungsart, enthaltene USt., Notizen, sowie
    Empfänger-E-Mail/Telefon als eine gemeinsame Spalte).
  - **Spenden:** Die alte, fest eincodierte Anzeige "BMF-Archiviert" (das
    stammte noch aus AI Studio) zeigte das unabhängig davon, ob überhaupt ein
    PDF hinterlegt war. Zeigt jetzt nur noch "Archiviert" — und nur, wenn
    `documentId` tatsächlich auf ein noch vorhandenes Dokument verweist,
    genau wie beim Knopf "In Dokumentenablage ansehen" daneben. Die sieben
    neuen Felder zur Zuwendungsbestätigung (Finanzamt, Steuernummer,
    Freistellungsdatum, Veranlagungszeitraum, unmittelbare Förderung,
    Aussteller, Herkunft & Bewertungsgrundlage der Sachspende) starten
    ausgeblendet — auch hierzu gab es keine Platzierungsvorgabe.
  - **Inventar:** Einkaufspreis und Zeitwert wie gewünscht als zwei eigene,
    sichtbare Spalten (zusätzlich zur bisherigen, kombinierten Spalte
    "Zeitwert / Anschaffung", die unverändert bleibt). Die übrigen
    besprochenen Felder (Kaufdatum, Lieferant, Notizen, zuletzt geprüft am)
    bekommen wie gewünscht **keine** eigene Spalte, sondern stehen als
    kleine Zusatzzeile in bestehenden Spalten (Kaufdatum & Lieferant unter
    dem Einkaufspreis, Notizen unter dem Gegenstandsnamen, "zuletzt geprüft"
    bei der nächsten Prüfung unter dem Zustand).
- **Nicht selbst geprüft:** `npm run check` und der Test in allen sechs
  Tabellen im Browser stehen wie besprochen jetzt bei dir an.

### 🖱️ Drei gemeldete Probleme an den Tabellen behoben: Auto-Fit, mitscrollender Kopf, plus neu Spalten per Drag & Drop sortierbar

- **Bug 1 behoben: Doppelklick auf den Ziehgriff hat die Spalte bei jedem
  weiteren Doppelklick ein Stück breiter gemacht, statt sich einmal richtig
  einzupendeln.** Ursache: Die Messung "wie breit müsste die Spalte für ihren
  Inhalt sein" lief über eine Browser-Eigenschaft (`scrollWidth`), die bei
  Tabellen mit fester Spaltenaufteilung (`table-layout: fixed` — das war für
  das gleichmäßige Ziehen an den Rändern nötig) keine zuverlässigen Werte
  liefert, sondern bei jeder Messung ein kleines Stück zu groß ausfällt.
  Behoben, indem die Messung jetzt an einer unsichtbaren Kopie der Zelle
  außerhalb der Tabelle stattfindet (Kopie einfügen, Breite messen, Kopie
  wieder entfernen) — dort gibt es die feste Spaltenaufteilung nicht, die
  Messung ist deshalb bei jedem Doppelklick gleich genau.
- **Bug 2 behoben: Der Spaltenkopf ist beim Scrollen mit weggelaufen, statt
  oben sichtbar zu bleiben — er hätte es eigentlich schon seit der letzten
  Änderung tun sollen, tat es aber in keiner der sechs Tabellen.** Zwei
  voneinander unabhängige Ursachen gefunden:
  1. Der Scroll-Rahmen um jede Tabelle war nur seitlich als Scroll-Bereich
     markiert (`overflow-x: auto`). Der Browser leitet daraus aber von sich
     aus *auch* einen senkrechten Scroll-Bereich ab, obwohl das nicht
     beabsichtigt war — und ein "mitscrollender" (sticky) Kopf funktioniert
     nur bezogen auf den tatsächlichen, äußeren Seiten-Scroll-Bereich, nicht
     auf einen unbeabsichtigten inneren. Jetzt ist der senkrechte Bereich
     ausdrücklich als "nicht eigener Scroll-Bereich" markiert.
  2. Die abgerundete "Karte" um jede Tabelle (für die runden Ecken) hatte
     eine Eigenschaft (`overflow: hidden`), die zum Abschneiden der Ecken
     gedacht war — dieselbe Eigenschaft blockiert aber, komplett unabhängig
     vom ersten Punkt, ebenfalls jeden mitscrollenden Kopf, egal wie tief
     verschachtelt. Diese Eigenschaft musste von der Karte selbst entfernt
     werden.
  - **Nebenwirkung, die ich in Kauf genommen habe:** Weil die Karte jetzt
    nicht mehr an allen vier Ecken automatisch abschneidet, habe ich die
    Rundung dort neu gesetzt, wo es gefahrlos geht (am unteren Rand, an der
    Fußzeile mit Seitennavigation — die steht in normalem Textfluss, nicht
    "hinter" dem mitscrollenden Kopf). Am *oberen* Rand habe ich es bewusst
    NICHT versucht: Der Spaltenkopf selbst ist ja "sticky" und löst sich beim
    Scrollen von der eigentlichen Kartenkante — eine Rundung direkt am
    Spaltenkopf würde dann, sobald man scrollt, wie eine losgelöste
    abgerundete Ecke mitten auf der Seite wirken, nicht wie eine Kartenecke.
    Das wollte ich nicht. Mögliche Folge: Bei "Inventar" und "Spenden" könnte
    die obere Ecke der Tabellenkarte jetzt eckig statt rund aussehen (bei den
    anderen vier Tabellen nicht, weil dort andere Elemente über der Tabelle
    liegen, die die Rundung ohnehin schon tragen). Bitte kurz draufschauen
    und melden, ob das auffällt — dann finden wir dafür eine gezieltere
    Lösung.
- **Neu, wie gewünscht: Die Spaltenreihenfolge lässt sich in allen sechs
  Tabellen selbst per Drag & Drop festlegen.** Den kompletten Spaltenkopf
  (außer dem schmalen Ziehgriff für die Breite ganz rechts) anklicken,
  halten und an die gewünschte Stelle ziehen — eine blaue Markierung zeigt
  dabei an, wo die Spalte landen würde. Ein einfacher Klick zum Sortieren
  funktioniert unverändert weiter und wird durch die neue Zieh-Funktion nicht
  gestört (der Browser unterscheidet einen bloßen Klick von einem
  Ziehen-und-Loslassen von sich aus).
  - **Auch die Reihenfolge wird dauerhaft gespeichert** — genau wie die
    Spaltenbreiten im Browser-Speicher (`localStorage`) je Tabelle, nicht in
    der Cloud. Sie bleibt über einen Neustart der Anwendung erhalten, gilt
    aber nur auf diesem Gerät in diesem Browser.
  - Die Auswahl-Kästchen-Spalte (ganz links) und die Aktionen-Spalte (ganz
    rechts) sind bewusst NICHT verschiebbar — nur die Datenspalten
    dazwischen lassen sich umsortieren. Alles andere hätte an anderer Stelle
    in der Bedienung zu Verwirrung geführt (z.B. Auswahl-Kästchen, die
    plötzlich nicht mehr am Rand stehen).
- **Nicht selbst geprüft:** Wie immer fehlt mir hier der Zugriff auf das
  npm-Registry, ich konnte also weder `npm run check` noch das Ergebnis im
  Browser selbst ausführen. Bitte nach dem Laden folgendes kurz testen:
  - In allen sechs Tabellen eine Spalte per Ziehen an eine andere Stelle
    verschieben, danach die Seite neu laden — bleibt die neue Reihenfolge
    erhalten?
  - Am rechten Spaltenrand doppelklicken — pendelt sich die Breite jetzt
    einmal richtig ein, statt bei jedem weiteren Doppelklick weiter zu
    wachsen?
  - Bei einer längeren Liste nach unten scrollen — bleibt der Spaltenkopf
    jetzt oben sichtbar?
  - Bei "Inventar" und "Spenden": Sieht die obere linke/rechte Ecke der
    Tabellenkarte eckig statt rund aus? (Siehe Erklärung oben — falls ja,
    einfach kurz Bescheid geben.)

### 🔧 Nachbesserung: Spalten-Ziehen und mitscrollender Kopf funktionierten trotz obigem Eintrag noch nicht

- **Warum der Eintrag oben zu früh kam:** Ich hatte beide Reparaturen nur
  anhand des Quellcodes eingeschätzt, ohne sie in der tatsächlich laufenden
  Anwendung auszuprobieren — dafür fehlte mir bis dahin der Zugriff. Beide
  griffen nicht: Die Spaltenreihenfolge änderte sich beim Loslassen nicht,
  der Tabellenkopf blieb weiter nicht stehen. Für diesen Eintrag konnte ich
  die laufende Anwendung direkt im Browser untersuchen und die tatsächlichen
  Ursachen nachweisen, bevor ich etwas geändert habe.
- **Spalten-Ziehen — Ursache gefunden: React hat die Verschiebe-Logik beim
  Loslassen zweimal ausgeführt, und die beiden Ausführungen haben sich
  gegenseitig aufgehoben.** React prüft während der Entwicklung absichtlich,
  ob bestimmte Funktionen "sauber" geschrieben sind, indem es sie zur
  Kontrolle zweimal aufruft. Die Verschiebe-Funktion war so gebaut, dass sie
  bei diesem zweiten, eigentlich nur zur Kontrolle gedachten Aufruf ihre
  Wirkung ein zweites Mal ausgeführt hat — und eine Spalte zweimal an dieselbe
  Stelle verschieben landet exakt wieder in der Ausgangsreihenfolge. Nach
  außen sah das aus wie "passiert einfach gar nichts". Behoben, indem die
  Verschiebe-Logik jetzt so geschrieben ist, dass sie sich bei einem
  Kontrollaufruf nicht wiederholt.
- **Mitscrollender Kopf — die erste Reparatur (oben) hat aus einem anderen
  Grund nicht gegriffen, als vermutet.** Der Browser hat eine Regel: Setzt
  man bei einem Element "seitlich scrollbar" (`overflow-x: auto`), erklärt er
  automatisch auch die *senkrechte* Richtung für scrollbar — selbst wenn man
  das Gegenteil ausdrücklich hinschreibt. Genau das hatte ich in der ersten
  Reparatur versucht ("senkrecht ausdrücklich nicht scrollbar"), und der
  Browser hat es stillschweigend ignoriert. Dadurch wurde jeder einzelne
  Tabellen-Rahmen selbst zu einem eigenen (nie tatsächlich benutzten)
  Scroll-Bereich, und ein mitscrollender Kopf bezieht sich immer auf den
  *nächstgelegenen* Scroll-Bereich — hier also auf den falschen. Behoben,
  indem das seitliche Scrollen nicht mehr am einzelnen Tabellen-Rahmen hängt,
  sondern am äußeren Seitenbereich, der ohnehin schon für das senkrechte
  Scrollen zuständig ist. **Nebenwirkung, die ich bewusst in Kauf genommen
  habe:** Ist eine Tabelle breiter als der Bildschirm, scrollt jetzt die
  ganze Seite seitlich mit, nicht mehr nur die Tabelle selbst — darüber
  liegende, schmalere Bereiche zeigen beim seitlichen Scrollen dann einfach
  leeren Platz. Ich halte das für den saubereren Kompromiss, weil es der
  einzige Weg war, den Kopf zuverlässig zum Mitscrollen zu bringen.
- **Beide Ursachen habe ich vor der Änderung im laufenden Browser
  nachgewiesen** (nicht nur vermutet) — beim Spalten-Ziehen durch Nachbauen
  des Ziehvorgangs per Skript mit Beobachtung, wie oft und wann gespeichert
  wird; beim Tabellenkopf durch Auslesen der vom Browser tatsächlich
  berechneten Eigenschaften. Von dir bestätigt: Beides funktioniert jetzt,
  auch nach erneutem Anmelden bleibt die Spaltenreihenfolge erhalten.
- **Nebenbei aufgetreten und behoben:** Bei der Reparatur des Tabellenkopfs
  ist mir in `DonationsView.tsx` ein Fehler in einem Code-Kommentar
  unterlaufen (`{/* ... */}` an einer Stelle verwendet, an der diese
  Schreibweise ungültig ist), der die gesamte Anwendung zum Absturz gebracht
  hat. Das war kein Problem mit `npm run check` oder dem Server selbst,
  sondern ein echter Tippfehler von mir — durch dein `npm run check` sofort
  sichtbar geworden und seitdem behoben.

### 📋 Alle sechs Tabellen: sortierbar, Spaltenbreite ziehbar, Kopf bleibt beim Scrollen sichtbar

- **Kontakte, Rechnungen, Spenden und Inventar lassen sich jetzt genauso durch
  Klick auf den Spaltenkopf sortieren** wie bisher schon Mitglieder und das
  Buchungsjournal. Ein Klick sortiert aufsteigend, ein zweiter Klick auf
  denselben Kopf dreht die Richtung um, ein Pfeilsymbol zeigt an, wonach
  gerade sortiert wird.
- **Alle sechs Tabellen lassen sich in der Spaltenbreite ziehen.** Am rechten
  Rand jeder Spalte gibt es einen schmalen Ziehgriff; ein Doppelklick darauf
  passt die Spalte automatisch an den breitesten *gerade angezeigten* Eintrag
  an (bei mehrseitigen Listen also an die aktuelle Seite — die Tabelle kennt
  nur die Zeilen, die auch tatsächlich dargestellt sind).
- **Die gewählten Spaltenbreiten werden dauerhaft gespeichert** — wie
  besprochen im Browser-Speicher (`localStorage`) je Tabelle, nicht in der
  Cloud. Das bedeutet: Die Breiten bleiben über einen Neustart der Anwendung
  hinweg erhalten, gelten aber nur auf diesem Gerät in diesem Browser. Auf
  einem anderen Rechner oder in einem anderen Browser fängt die Breite wieder
  beim sinnvollen Startwert an.
- **Der Spaltenkopf bleibt beim Scrollen oben sichtbar** (in allen sechs
  Tabellen), damit bei langen Listen immer erkennbar bleibt, welche Spalte
  welche ist.
- **Gemeinsame Bausteine statt sechsmal derselbe Code:** Zwei neue Hooks
  (`useSortableColumns`, `useResizableColumns`) und eine gemeinsame
  Tabellenkopf-Komponente (`SortableResizableTh`) stecken hinter allen sechs
  Tabellen. Bei Mitgliedern und dem Buchungsjournal wurde die schon
  vorhandene, funktionierende Sortierlogik dabei bewusst NICHT angetastet —
  nur Breite und mitscrollender Kopf kamen neu hinzu. Das Buchungsjournal
  sortiert deshalb weiterhin beim ersten Klick auf "Datum" oder "Betrag"
  absteigend (neueste/höchste zuerst), die vier neu umgestellten Tabellen
  dagegen beim ersten Klick aufsteigend (außer Spenden: dort zuerst
  absteigend nach Datum, also neueste zuerst, wie es vorher schon war).
- **Kleinere Entscheidungen dabei, die ich nicht extra abgestimmt habe:**
  - Bei Mitgliedern und dem Buchungsjournal wurden die alten
    Sortierpfeile (↑↓↕ als Textzeichen) durch dieselben Pfeilsymbole
    ersetzt, die jetzt auch die anderen vier Tabellen benutzen — rein
    optisch, damit alle sechs Tabellen gleich aussehen.
  - In Kontakten ist die alte Sortierung "nach Erstellungsdatum" entfallen
    (dazu gab es keine sichtbare Spalte, an der man das hätte ablesen
    können). In Rechnungen sortiert die zusammengefasste Spalte
    "Nr. & Datum" jetzt nur noch nach Datum, nicht mehr getrennt auch nach
    Rechnungsnummer (Nummern vergeben sich ohnehin fortlaufend nach Datum).
  - In Kontakten und Rechnungen ist dafür das alte Dropdown-Menü samt
    A→Z/Z→A-Knopf für die Sortierung komplett entfallen — es tat jetzt
    dasselbe wie der Klick auf den Spaltenkopf, nur an zwei Stellen gleichzeitig.
  - Bei ausgewählten Zeilen erscheint in fünf der sechs Tabellen eine
    dunkle Aktionsleiste, die ebenfalls oben "kleben" bleibt. Sie liegt
    optisch über dem neuen Tabellenkopf. Das kann in einem schmalen
    Sonderfall (wenn man mit aktiver Auswahl mittendrin scrollt) zu einer
    kurzen Überlappung führen — keine größere Bau-Lösung dafür gesucht,
    nur bewusst in Kauf genommen.
  - Die Start-Spaltenbreiten (bei Aktions-Spalten z.B.) sind nur eine
    Schätzung meinerseits, wie viel Platz die Knöpfe ungefähr brauchen —
    nach dem ersten Ziehen merkt sich der Browser ohnehin die eigene Wahl.
- **Nicht selbst geprüft:** Auch hier konnte ich weder `npm run check` noch
  das Ergebnis im Browser selbst ausführen (derselbe fehlende Zugriff aufs
  npm-Registry wie bei den letzten Malen). Bitte nach `npm install` einmal
  `npm run check` laufen lassen und in allen sechs Tabellen kurz
  durchklicken: auf ein paar Spaltenköpfe klicken (sortiert es richtig?),
  am rechten Spaltenrand ziehen und doppelklicken (passt sich die Breite an
  den Inhalt an?) und bei einer längeren Liste nach unten scrollen (bleibt
  der Kopf oben sichtbar?).

### 📊 Buchungsjournal: Sphäre und Konto entkoppelt, "Nummernkreis"/"Konto" statt "Hauptkonto"/"Unterkonto", sechs neue Auswertungen

- **Die Sphäre stand bisher am Konto — das ist laut DATEV-Handbuch zum SKR 42
  (S. 31) falsch.** Die steuerliche Sphäre (ideell / Vermögensverwaltung /
  Zweckbetrieb / wirtschaftlicher Geschäftsbetrieb) wird je Buchung über ein
  eigenes Feld (KOST1) vergeben, unabhängig vom gewählten Konto. Bisher hing
  in der Anwendung jedes Konto fest an genau einer Sphäre, filterte die
  Kontenauswahl danach und setzte die Sphäre automatisch, sobald ein Konto
  gewählt wurde — beides ist entfallen. Sphäre und Kontierung lassen sich
  jetzt unabhängig voneinander wählen, in der normalen Buchungsmaske, bei
  Splittbuchungen, in der Sammelbearbeitung, beim Import aus Bankauszug,
  Excel/Google Sheets und beim Anlegen eigener Konten.
- **Namen geändert:** "Hauptkonto" heißt jetzt "Nummernkreis" (die fünfstellige
  Kontengruppe, z.B. 40000), "Nebenkonto"/"Unterkonto" heißt "Konto" (das
  einzelne Konto darin, z.B. 40010). Das betrifft nur die Kontierung nach SKR
  42 — die Bezeichnung "Hauptkonto" für das Bankkonto einer Kasse (z.B.
  "Sparkasse Girokonto (Hauptkonto)") ist etwas anderes und unverändert
  stehen geblieben.
- **Vier Nummern waren doppelt vergeben** (50000, 60000, 62000, 69000 —
  Letztere sogar vierfach), weil sie sich bisher nur über die Sphäre
  unterschieden. Ohne Sphärenfilter wären sie gleichzeitig in derselben Liste
  aufgetaucht. Auf Nachfrage neu durchnummeriert (51000, 60200, 62100, 69050,
  69100, 69300) — die inhaltliche Unterscheidung bleibt erhalten, nur die
  Nummer hat sich geändert.
- **Neues Feld "Sparte"** je Buchung (und je Teilbetrag bei Splittbuchungen) —
  z.B. "Fußball" oder "Tennis", leer bedeutet Gesamtverein. Unabhängig von
  Sphäre und Konto.
- **"Spenden" ist jetzt eine eigene Größe:** Buchungen auf dem Nummernkreis
  40400 ("Spenden, Schenkungen & Zuwendungen") zählen in den Auswertungen
  nicht mehr als "Einnahmen", sondern werden separat ausgewiesen — sonst
  würde eine Spende doppelt auftauchen.
- **Die Finanz-Auswertungen sind neu aufgebaut**, mit der Diagramm-Bibliothek
  Recharts (neu als Abhängigkeit) statt selbstgebauter CSS-Balken: monatliche
  Einnahmen/Ausgaben/Spenden, Jahresübersicht als Kreisdiagramm,
  Einnahmen-Mix und Ausgaben-Mix je Sparte (mit "Gesamtverein" als Summe über
  alle Buchungen), ein kumulierter Kontostand-Verlauf übers Jahr
  ("Fieberkurve") und eine Sparten-Übersicht mit Einnahmen, Ausgaben und
  Summe nebeneinander.
- **Die Supabase-Datenbank braucht die Spalte `department`** in der Tabelle
  `transactions` für das neue Sparte-Feld — `supabase_schema.sql` enthält
  jetzt `ALTER TABLE ... ADD COLUMN IF NOT EXISTS department TEXT;`, das sich
  gefahrlos beliebig oft ausführen lässt. Wer die Cloud-Anbindung nutzt, muss
  dieses Skript einmal erneut in Supabase ausführen, sonst bleibt die Sparte
  beim nächsten Abgleich leer.
- **Nebenbei gefunden, hier NICHT behoben:** Beim Nachsehen ist aufgefallen,
  dass Splittbuchungen (`is_split`/`splits`) in der Supabase-Tabelle
  `transactions` gar keine eigenen Spalten haben — weder in
  `supabase_schema.sql` noch in `supabase_rls.sql`. Das deutet darauf hin,
  dass Splittbuchungen im Cloud-Betrieb schon vor diesem Umbau nicht
  gespeichert werden konnten. Unabhängig von der heutigen Arbeit und noch
  nicht näher untersucht.
- **Nicht selbst geprüft:** Ich konnte weder `npm run check` noch das
  Diagramm-Ergebnis in einem Browser selbst ausführen — dieser Rechner darf
  nicht auf das npm-Registry zugreifen. Die Umstellung auf Recharts 3 wurde
  stattdessen sorgfältig gegen die offizielle Migrationsanleitung von Version
  2 auf 3 geprüft, aber "sorgfältig geprüft" ersetzt nicht "einmal
  ausgeführt". Bitte nach `npm install` einmal `npm run check` laufen lassen
  und kurz auf den Reiter "Finanz-Auswertungen" schauen, ob die sechs
  Diagramme vernünftig aussehen.

### 🤖 Ein KI-Anbieter statt vier halber — und warum es nicht Mistral wurde

- **Die Auswahl versprach mehr, als dahintersteckte.** Von fünf KI-Funktionen
  konnte genau eine — die Zuordnung von Buchungen — mit OpenAI, Anthropic oder
  einer eigenen Adresse arbeiten. Belegerkennung, Antragsübernahme und beide
  Protokollauswertungen riefen immer Google Gemini auf, gleichgültig was
  eingestellt war. Wer brav OpenAI eintrug, bekam vier von fünf Funktionen
  nicht zum Laufen und eine Fehlermeldung, die nicht sagte, warum. Alle drei
  sind entfallen.
- **Mistral AI war gebaut und ist wieder ausgebaut.** Ein französisches
  Unternehmen mit Verarbeitung auf EU-Infrastruktur wäre für eine deutsche
  Vereinsverwaltung die bessere Wahl gewesen, und es beherrscht als einziger
  Anbieter neben Google alle fünf Funktionen. Gescheitert ist es an etwas, das
  in keiner Dokumentation stand: Der kostenlose Zugang teilt ohne hinterlegte
  Zahlungsdaten gar kein Kontingent zu — der Server antwortet mit
  `x-ratelimit-limit-req-minute: 0` und weist jede Anfrage ab. Einem
  ehrenamtlichen Kassenwart Zahlungsdaten abzuverlangen, damit er eine
  Belegerkennung ausprobieren kann, ist keine zumutbare Hürde. Der fertige
  Umbau liegt in **Commit 4b0933b** und ist von dort holbar, falls Mistral
  seinen Zugang eines Tages ändert.
- **Was dabei herauskam und bleibt:** Bei jedem geprüften Anbieter gilt
  dasselbe Muster — kostenlos heißt, die Daten dürfen zum Training verwendet
  werden; wer das ausschließen will, hinterlegt Zahlungsdaten. Einen Weg mit
  beidem gibt es nicht. Die Anwendung benennt das jetzt offen, statt einen
  kostenlosen Tarif als sorglose Empfehlung darzustellen.

### 🔐 Der KI-Schlüssel liegt nicht mehr im Browser — und in keiner Datensicherung

- **Er lag bisher an drei Stellen gleichzeitig:** im Browser-Speicher, in den
  Vereinsstammdaten (und damit in jeder Datensicherung sowie im Cloud-Betrieb
  zusätzlich in zwei Supabase-Spalten) und ersatzweise in der `.env` des
  Servers. Wer seine Sicherung weitergab oder verlor, gab den Schlüssel mit —
  und auf dessen Rechnung lässt sich Rechenzeit verbrauchen.
- **Jetzt liegt er verschlüsselt auf dem Server dieser Installation**
  (AES-256-GCM, Schlüsseldatei daneben), genau wie zuvor schon das
  SMTP-Passwort. Drei neue Endpunkte `GET/POST/DELETE /api/ai/config`; die
  Auskunft an die Oberfläche enthält nur, *ob* ein Schlüssel hinterlegt ist und
  woher er stammt — nie den Schlüssel selbst.
- **Die Direktaufrufe aus dem Browser sind entfallen.** Die Oberfläche rief
  Google, OpenAI und Anthropic bisher notfalls selbst auf, mit dem Schlüssel im
  Gepäck. Genau dafür musste er im Browser liegen. Alle KI-Aufrufe gehen jetzt
  über den eigenen Server.
- **Was das kostet:** KI-Funktionen brauchen künftig zwingend den
  mitgelieferten Server. Bei Startskript, Docker und Desktop-Fassung läuft er
  ohnehin mit; nur wer die gebaute Oberfläche auf einen reinen Dateispeicher
  legt, steht ohne da — dort funktioniert seit dieser Fassung aber auch der
  E-Mail-Versand nicht.
- **Der Schlüssel gilt jetzt für die ganze Installation**, nicht mehr je
  Browser. Es ist das Kontingent des Vereins, das verbraucht wird; es gehört an
  eine Stelle.
- **Bestehende Schlüssel ziehen von selbst um.** Beim ersten Start nach der
  Aktualisierung wird ein noch im Browser liegender Schlüssel auf den Server
  hochgeladen und lokal gelöscht — aber nur, wenn der Server das Speichern
  bestätigt hat. Niemand muss etwas tun.
- **Aus dem Buchungsdialog ist die Schlüsseleingabe verschwunden.** Dort ließ
  sich der Schlüssel bisher nebenbei eintippen. Da er nun für die ganze
  Installation gilt, gehört er in die Einstellungen; der Dialog verweist nur
  noch dorthin.
- **Aufgeräumt wird auch rückwirkend:** Ein Schlüssel, der noch in einer alten
  Datenbank oder Datensicherung steht, wird beim Laden aus den
  Vereinsstammdaten entfernt und nicht mehr in die Cloud übertragen. Die
  Supabase-Spalten `gemini_api_key`, `ai_api_key`, `ai_provider`, `ai_model` und
  `ai_base_url` werden beim Einspielen der Schemadatei gelöscht. Geprüft gegen
  eine echte PostgreSQL-16-Instanz, einmal als Neuinstallation und einmal als
  Aktualisierung einer Installation, in der der Schlüssel im Klartext stand.

### 🔑 Kein Zugriffsschlüssel mehr zum Abtippen — und ein Server, der nicht ins Netzwerk lauscht

- **Die Desktop-Fassung verlangte den Zugriffsschlüssel von Hand.** Das
  Startskript für den Browser-Betrieb übergab ihn längst automatisch über die
  Adresszeile; beim Zusammenbau der Desktop-Fassung war genau dieser Handgriff
  vergessen worden. Wer das Programm startete, musste den Schlüssel aus der
  Konsolenausgabe abschreiben — für Anwender ohne Terminal-Kenntnisse
  unzumutbar.
- **Jetzt hängt der Server ihn an seine Bereitschaftsmeldung an**
  (`VM_SERVER_BEREIT http://127.0.0.1:3000/#zugriff=…`), und das Programm öffnet
  sein Fenster auf dieser Adresse. Die Oberfläche liest den Schlüssel aus, merkt
  ihn sich und entfernt ihn wieder. Alles hinter dem Doppelkreuz ist ein
  Fragment und wird vom Browser nie an den Server geschickt — der Schlüssel
  steht deshalb in keinem Zugriffsprotokoll.
- **Der Server lauschte auch in der Desktop-Fassung auf allen Netzwerkadressen.**
  Für Docker ist das richtig, auf einem Schreibtischrechner nicht: Wer im selben
  WLAN saß, konnte ihn ansprechen. Der Zugriffsschlüssel hätte ihn abgewiesen,
  aber besser ist, wenn solche Anfragen gar nicht erst ankommen. Die
  Desktop-Fassung setzt nun `VM_HOST=127.0.0.1`.
- Dieselbe Angabe entscheidet, ob der Schlüssel überhaupt angehängt wird: nur
  bei einem Server, der allein auf dem eigenen Rechner lauscht. Im
  Docker-Betrieb unterbleibt es, sonst stünde er in Protokollen, die anderswo
  aufbewahrt werden.

### 🧪 Bauen, ohne ein Release zu veröffentlichen

- Der Desktop-Workflow hat ein zweites Feld bekommen: *Als Release
  veröffentlichen?* Steht es auf `nein` (die Vorgabe), entsteht weder Release
  noch Marke; die fertigen Pakete hängen als „Artifacts" am Lauf und werden nach
  sieben Tagen gelöscht. Eine kleine Änderung auszuprobieren kostet damit keine
  Versionsnummer mehr.
- Wird der Bau durch das Veröffentlichen einer Marke ausgelöst, entsteht wie
  bisher immer ein Release.

### 🐧 Linux: die `.deb` ist der empfohlene Weg

- Eine heruntergeladene `.AppImage` ist nicht ausführbar — diese Kennzeichnung
  steckt nicht in der Datei, sondern führt das Dateisystem daneben, und kein
  Paket kann sie mitbringen. Die Anleitung nennt jetzt die `.deb` als
  empfohlenen Weg (Doppelklick, installieren, fertig) und beschreibt für die
  `.AppImage` den Weg über *Rechtsklick → Eigenschaften → Zugriffsrechte* statt
  nur den Terminal-Befehl.

### 🖥️ Die Desktop-Fassung bringt den Server mit

- **Bisher lief dort alles ins Leere, was einen Server braucht:** E-Mail-Versand,
  Belegerkennung, Buchungsvorschläge, Protokollauswertung. Das Programm enthielt
  nur die gebaute Oberfläche; ein Aufruf an `/api/...` fand niemanden.
- **Jetzt wird derselbe Server mitgeliefert**, den auch der Docker-Betrieb
  verwendet, zusammen mit der Node-Laufzeitumgebung. Das Paket wächst dadurch um
  etwa 30 MB.
- **Start in drei Schritten:** Server starten, auf dessen Bereitmeldung warten
  (höchstens 30 s), dann das Fenster auf seine Adresse öffnen. Meldet er sich
  nicht, öffnet sich das Fenster trotzdem — dann ohne Server, also genau wie die
  bisherige Desktop-Fassung. Ein Programm, das gar nicht erst aufgeht, wäre das
  schlechtere Ergebnis.
- **Der Server weicht auf einen freien Port aus**, wenn 3000 belegt ist, und legt
  seine Konfiguration im Datenverzeichnis der Anwendung ab statt neben dem
  Programm, wo ein Update sie überschreiben könnte.
- **macOS: nur noch Apple Silicon.** Die Universal-Fassung hätte künftig auch
  eine zweite Node-Laufzeitumgebung für ältere Intel-Macs enthalten.
- Der Server findet die Oberfläche jetzt neben seiner eigenen Datei und nicht
  mehr nur im Arbeitsverzeichnis — in der Desktop-Fassung ist dieses
  unvorhersehbar.

### 💾 Datensicherung: vollständig, nachvollziehbar und umkehrbar

- **Fünf Datenbereiche fehlten in der Sicherung.** Wer seinen Bestand auf einen
  anderen Rechner mitnahm, verlor stillschweigend die Ordnerstruktur des
  Dokumentenarchivs, sämtliche Befragungen samt Antworten und Teilnahme-Links
  sowie die Ausgabe von Vereinsinventar an Mitglieder. Alle fünf sind jetzt
  dabei.
- **Der Compiler wacht künftig darüber.** Die Liste der Datenbereiche steht in
  `src/services/backupContents.ts`; ein neuer Bereich, der dort fehlt, lässt
  `npm run check` mit der Meldung fehlschlagen, welcher es ist. Ein vergessener
  Bereich ist damit kein stiller Datenverlust mehr.
- **Vor dem Einspielen wird gefragt.** Bisher genügte es, eine Datei auf den
  Anmeldebildschirm zu ziehen — der gesamte Bestand war ersetzt, ohne Rückfrage
  und ohne Weg zurück. Jetzt zeigt ein Dialog Verein, Datum und einen Abgleich
  je Bereich (in der Datei / hier vorhanden / wird überschrieben) und verlangt
  eine ausdrückliche Bestätigung.
- **Zwei Importarten:** *alles ersetzen* (Umzug, Wiederherstellung) oder *nur
  Fehlendes ergänzen* — dabei bleibt Vorhandenes unangetastet, und aus der Datei
  kommt nur hinzu, was es hier noch nicht gibt. Benutzerkonten aus der Datei
  bleiben draußen, wenn Kennung oder Anmeldename hier schon vergeben sind.
- **Automatische Sicherheitskopie** des bisherigen Bestands vor jedem Import.
  Sie liegt in einer eigenen Datenbank und ist über Einstellungen →
  Datensicherung zurückholbar. Schlägt sie fehl, sagt die Erfolgsmeldung das.
- **Bereiche, die in der Datei gar nicht vorkommen, bleiben unangetastet.** Eine
  ältere Sicherung löscht damit nichts, was sie noch nicht kannte.
- **Im Cloud-Betrieb ist der Reiter „Importieren" verschwunden.** Dort schrieb
  er nur in die Browser-Datenbank, die beim nächsten Laden ohnehin von Supabase
  überschrieben wurde — eine Erfolgsmeldung ohne Wirkung.
- Dieselbe Bestätigung gilt jetzt auch für den Import unter Einstellungen →
  Datensicherung; die knappe Rückfrage „Fortfahren?" entfällt.

### 📦 Bundle-Größe gemessen und bewusst so belassen

- **Gemessen am 19.09.2026:** Hauptbrocken 3.210 kB, nach Komprimierung 780 kB.
  Mit Stilen, Bild und Startseite rund 1,0 MB über die Leitung.
- **Keine Aufteilung in nachgeladene Teile.** Die Anwendung läuft am Rechner im
  Haus, meist im eigenen Netz; das Megabyte fällt einmal beim ersten Aufruf an.
  Die PDF-Bibliothek und ganze Programmteile nachzuladen, zöge sich durch neun
  Dateien und jeden PDF-Weg — viel Verwicklung für einen Gewinn, den dort
  niemand bemerkt.
- **Stolperdraht statt Dauerwarnung:** `chunkSizeWarningLimit` steht jetzt knapp
  über dem gemessenen Stand. Vites Vorgabe von 500 kB meldete sich bei jedem Bau
  und war nur noch Rauschen. Wächst der Brocken spürbar, meldet sie sich wieder.
- **Das Paket `motion` ist entfernt.** Es stand in der Paketliste, wurde aber von
  keiner Datei importiert und landete deshalb ohnehin nie im Bundle. Es
  verlängerte nur jedes `npm install` und den Docker-Bau.

### 🧹 Die letzten beiden `exhaustive-deps`-Warnungen sind weg

- **`App.tsx`** und **`ApplicationPdfImporterModal`** hielten jeweils eine
  Funktion fest, die bei jedem Rendern neu entsteht — in einem Effekt bzw.
  einer Merkfunktion, die genau einmal eingerichtet werden darf. Beide
  arbeiteten damit dauerhaft mit dem Stand des allerersten Rendervorgangs.
- Gelöst über eine Referenz, die immer auf die aktuelle Fassung zeigt. Sie ist
  selbst unveränderlich und gehört deshalb in keine Abhängigkeitsliste. Die
  Abhängigkeitsliste stimmt jetzt, ohne dass der Effekt mehrfach läuft.
- **Unverändert bleiben die fünf Warnungen** in `ContactFormModal`,
  `DonationFormModal`, `InvoiceFormModal`, `MemberFormModal` und
  `MemberDetailsDrawer`. Dort füllen die Effekte Formulare beim Öffnen vor;
  nähme man die geforderten Abhängigkeiten auf, liefen sie bei jedem
  Tastendruck erneut und überschrieben das gerade Eingetippte. Aus einer
  Warnung würde ein echter Fehler.

### ☁️ Vereinsstammdaten gingen im Cloud-Betrieb verloren — behoben

- **Von 29 Feldern wurden nur 13 nach Supabase übertragen.** Vorstandsmitglieder,
  Vereinslogo, Anschrift als Objekt, Telefon, Web-Adresse, Finanzamt,
  Freistellungsdaten, geförderte Zwecke, Währung, Datums- und
  Geschäftsjahresangaben sowie sämtliche KI-Einstellungen fehlten in der
  Zuordnung. Sie wurden beim Speichern verworfen und beim nächsten Laden auch
  örtlich überschrieben — ohne Fehlermeldung.
- **Die Zuordnung steht jetzt an einer Stelle** (`src/services/settingsMapping.ts`)
  und ist über den Typ `Record<SynchronisierteFelder, string>` abgesichert: Ein
  neues Feld in `ClubSettings`, das dort fehlt, lässt `npm run check`
  fehlschlagen — statt still Daten zu verlieren.
- **Beim Laden wird jetzt zusammengeführt statt ersetzt.** Was die Cloud nicht
  führt, bleibt örtlich erhalten.
- **Die Spalte `address` ist jetzt JSONB.** Die Vereinsanschrift darf als Text
  oder als strukturiertes Objekt vorliegen; in der bisherigen TEXT-Spalte wurde
  aus dem Objekt „[object Object]".
- **Hell/Dunkel wird bewusst nicht synchronisiert** — die Einstellung gehört zum
  Gerät, nicht zum Verein.
- **`supabase_schema.sql` rüstet bestehende Datenbanken nach.** Der neue
  Abschnitt 1b lässt sich gefahrlos mehrfach ausführen; er ergänzt die fehlenden
  Spalten, stellt `address` um und entfernt etwaige SMTP-Spalten aus früheren
  Fassungen. Geprüft gegen PostgreSQL 16: Eine nachgerüstete und eine frisch
  angelegte Datenbank haben danach denselben Aufbau.
- **Die öffentliche Vereinsauskunft `vm_public_club_info()`** setzte bei
  fehlender Anschrift einen leeren Text ein. Mit der JSONB-Spalte ist das kein
  gültiges JSON — die gesamte Schema-Datei brach an dieser Stelle ab. Korrigiert
  und gegen PostgreSQL 16 geprüft: Die Datei läuft vollständig durch (24
  Tabellen, 13 Funktionen), und die Auskunft liefert die Anschrift als Text, als
  Objekt und bei fehlendem Datensatz jeweils korrekt.

### 🔑 Die /api-Endpunkte verlangen einen Ausweis

- **Bisher konnte sie jeder aufrufen, der die Adresse kannte.** Wer einen im
  Internet erreichbaren Server fand, konnte über das Postfach des Vereins Mails
  verschicken oder auf dessen Rechnung KI-Anfragen stellen. Die Ratenbegrenzung
  begrenzte den Schaden, verhinderte ihn nicht.
- **Zwei anerkannte Ausweise, einer genügt:**
  - Der *Zugriffsschlüssel dieser Installation*. Er entsteht beim ersten Start
    von selbst und wird in der Startausgabe angezeigt. Im Lokalbetrieb übergibt
    ihn das Startskript automatisch an den Browser (`…#zugriff=…`), sodass
    niemand etwas eintragen muss. Ein eigener Wert lässt sich über
    `VM_ACCESS_KEY` vorgeben.
  - Das *Anmeldetoken aus dem Cloud-Betrieb*. Sind `SUPABASE_URL` und
    `SUPABASE_ANON_KEY` auch dem Server bekannt, prüft er das Token bei
    Supabase nach; die normale Anmeldung in der App genügt dann.
- **Neue Maske** unter *Einstellungen → Allgemein*: im Normalfall eine
  einzeilige Bestätigung, bei fehlendem Zugriff eine Karte mit Eingabefeld und
  der Erklärung, wo der Schlüssel zu finden ist.
- **Die Statusseite `/api/health` bleibt offen**, damit die Überwachung des
  Docker-Containers weiter funktioniert. Sie verrät nichts außer „Server läuft".
- **Nicht betroffen:** das öffentliche Aufnahmeformular und die
  Mitgliederbefragung. Beide sprechen direkt mit Supabase und haben dort ihre
  eigenen Schutzregeln.

### 🔐 SMTP-Zugangsdaten liegen nicht mehr in den Vereinsdaten

- **Das Passwort zum Postfach wandert auf den Server.** Bisher stand es im
  Klartext in den Vereinsstammdaten. Damit lag es in der Browser-Datenbank
  jedes Geräts, in **jeder Datensicherung** und ging bei **jedem Versand** über
  die Leitung. Jetzt liegt es in der Konfiguration der jeweiligen Installation
  (Ordner `daten/`, im Docker-Betrieb das Volume `vereinsmanager_daten`),
  verschlüsselt mit AES-256-GCM. Der Schlüssel dazu liegt in einer eigenen
  Datei; beide sind nur für den Besitzer lesbar.
- **Die Oberfläche kann das Passwort nur noch setzen, nicht lesen.** Vom Server
  kommt lediglich die Auskunft, ob eines hinterlegt ist.
- **Neue Endpunkte:** `GET`, `POST` und `DELETE` auf `/api/smtp/config`.
  `POST /api/smtp/test` und `POST /api/meetings/send-email` nehmen keine
  Zugangsdaten mehr entgegen, sondern verwenden die hinterlegten. Damit lässt
  sich der Server nicht mehr auf einen fremden Mailserver zeigen und das
  Passwort des Vereins dort abliefern.
- **Beim ersten Start nach dem Update** werden die alten SMTP-Felder aus den
  gespeicherten Vereinsstammdaten entfernt — auch beim Einspielen einer alten
  Datensicherung. Die Zugangsdaten sind **einmalig neu einzutragen**; das
  Passwort wird bewusst nicht übernommen.

### 🐛 Behoben

- **Der Mailversand meldete Erfolg, ohne etwas zu versenden.** Waren keine
  SMTP-Zugangsdaten hinterlegt, erschien eine grüne Bestätigung
  („Versandauftrag erfasst"), obwohl keine einzige Nachricht das Haus verlassen
  hatte. Bei einer Einladung zur Mitgliederversammlung kann das die Ladungsfrist
  betreffen und die Versammlung anfechtbar machen. Jetzt meldet die Anwendung
  einen klaren Fehlschlag und weist auf den Versand über das lokale
  E-Mail-Programm hin.
- **Das Zertifikat des Mailservers wurde nicht geprüft** (`rejectUnauthorized:
  false`). Damit konnte sich jemand im selben Netz zwischen Server und
  Mailanbieter schieben und das Passwort mitlesen. Die Prüfung ist jetzt
  eingeschaltet. Mailserver im eigenen Haus mit selbst ausgestelltem Zertifikat
  brauchen `VM_SMTP_ALLOW_SELF_SIGNED=true`.

---

> **Anmerkung:** Die folgenden Einträge (v1.1.0 bis v1.2.3) stammen aus der
> Zeit vor der eigentlichen Versionszählung — sie liefen parallel zur
> `package.json`, die noch bei 0.9.0 stand. Mit 1.0.0 oben beginnt die
> Zählung neu und bewusst; die alten Einträge bleiben hier stehen, weil sie
> die tatsächliche Entwicklungsgeschichte dokumentieren.

## [v1.2.3] - 2026-09-14

### 🚀 Neue Features & Verbesserungen

#### 🗳️ Mitgliederbefragung & Meinungsbilder (Neues Modul)
- **Vollintegriertes Befragungstool:** Erstellung und Verwaltung vereinsinterner Umfragen, Stimmungsbilder und Zufriedenheitsanalysen direkt im Navigationsbereich *Mitglieder*.
- **Vielseitige Fragetypen:**
  - ⭐ Sterne-Bewertung (1–5 Sterne mit Durchschnittswert)
  - 🔢 0–10 Skala mit automatischer Net Promoter Score (NPS) Berechnung
  - 🔘 Einfachauswahl (Single-Choice) mit frei definierbaren Antwortoptionen
  - ☑️ Mehrfachauswahl (Multiple-Choice)
  - 👍 Ja / Nein / Enthaltung für formelle Beschluss-Vorabfragen
  - 📝 Freitext-Rückmeldungen für Lob, Kritik und Anregungen
- **Vorkonfigurierte Mustervorlagen:** Sofort nutzbare Templates für *Allgemeine Mitgliederzufriedenheit*, *Trainingszeiten & Hallennutzung*, *Meinungsbild Beitragsanpassung* und *Vereinsfest-Organisation*.
- **Registrierungsfreie Teilnahme:** Mitglieder nehmen über ihren individuellen Link ohne Registrierung, Login oder Passwort direkt auf Smartphone, Tablet oder PC teil.
- **Kryptografische Einmal-Tokens:** Standardmäßig erzeugt das System für jedes berechtigte Mitglied einen individuellen Einmal-Token, der nach Absenden automatisch entwertet wird, um Mehrfachabstimmungen wirksam auszuschließen. Für unverbindliche Stimmungsbilder kann der Token-Zwang per Schalter deaktiviert werden.
- **Multi-Channel-Verteilung & Einladungen:**
  - 💬 **WhatsApp-Direktlink:** Öffnet WhatsApp Web oder die Smartphone-App mit personalisiertem Text und direktem Abstimmungslink.
  - ✉️ **E-Mail-Einladung:** Generiert fertige E-Mail-Entwürfe mit persönlicher Ansprache und Einladungslink.
  - 📄 **Druckfertige PDF-Teilnehmerliste:** Ideal zur handschriftlichen Verteilung oder postalischen Beilage.
  - 📊 **CSV-Export:** Vollständiger Export aller personalisierten Links zur Weiterverarbeitung.
- **Live-Analytics & Berichte:**
  - Echtzeit-Übersicht von Gesamtrückläufen, Rücklaufquoten und Status.
  - Graphische Balkendiagramme, NPS-Aufteilung (Promotoren, Passive, Detraktoren) und anonymisierte Freitextsammlungen.
  - **PDF-Ergebnisbericht:** Hochwertiger, druckfertiger Bericht für Vorstandssitzungen und Mitgliederversammlungen.
  - **CSV-Rohdatenexport:** Export aller Antworten für tiefgehende statistische Auswertungen.
- **Betriebsmodus-Schutz:** Dezenter Hinweis im lokalen Modus mit 1-Klick-Weiterleitung zur Cloud-Aktivierung.

#### 📦 Verknüpfung von Mitglied und Inventar (Ausleihe & Rückgabe)
- **Direkte Zuordnung an Vereinsmitglieder:** Inventargegenstände (Sportgeräte, Trainingssets, Trikotsätze, Schlüssel, Werkzeuge, IT-Hardware) können direkt einem registrierten Vereinsmitglied zugewiesen werden.
- **Komfortable Mitgliederauswahl:** Suchbare Dropdowns mit Mitgliedsname, Mitgliedsnummer und Sparte.
- **Leihstatus & Historie:** Erfassung von Ausleihdatum, geplantem Rückgabedatum, aktuellem Leihstatus (*Verfügbar*, *Verliehen*, *In Reparatur*, *Ausgesondert*) und individuellen Notizen.
- **1-Klick-Rücknahme:** Schnelle Rückbuchung direkt in der Inventarkarte oder Tabellenzeile mit automatischer Freigabe des Gegenstands.
- **Visuelle Indikatoren:** Farblich hervorgehobene Badges mit Name des Entleihers in der Kachel- und Tabellenansicht.

#### 🏦 Selbständiges Hinzufügen von Konten & flexible Finanzverwaltung
- **Eigene Konten flexibel anlegen:** Neben den Standardkonten können jederzeit beliebig viele eigene Bankkonten (Giro, Festgeld, Sparkasse, Unterkonten) sowie Barkassen mit eigener IBAN, BIC und Anfangsbestand angelegt werden.
- **Freie Sachkonten- & Kategorienkonfiguration:** Anpassung und Erweiterung von Buchungskategorien je Sphäre (Ideeller Bereich, Vermögensverwaltung, Zweckbetrieb, Wirtschaftlicher Geschäftsbetrieb).
- **Drag & Drop Sortierung:** Bank- und Barkassenkarten lassen sich per Maus in jede gewünschte Reihenfolge verschieben und persistent speichern.
- **Mauszeiger-Tooltips:** Dynamisch haftende Tooltips in allen Konten-Dropdowns zur vollständigen Lesbarkeit auch sehr langer IBANs und Kontobezeichnungen.

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
