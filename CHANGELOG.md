# Changelog

Alle relevanten Änderungen und Versionsstände des VereinsManagers werden in dieser Datei dokumentiert.

---

## [1.1.0] — 2026-10-05 — Vereinfachung auf eine einzige Betriebsart

Grundlegende Umstellung: Statt drei Betriebsarten (lokal allein / lokal mit
Supabase-Cloud / gehosteter eigener Server) gibt es jetzt nur noch eine
einzige — rein lokal, ein Gerät. Zusammen mit KI-Funktionen und
E-Mail-Versand sind auch alle Funktionen entfernt, die nur für eine der
beiden anderen Betriebsarten existierten. Vollständige Begründung und
Versionsgeschichte der einzelnen Schritte: `claude/plan-vereinfachung.md`

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
