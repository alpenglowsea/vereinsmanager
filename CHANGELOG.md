# Changelog

Alle relevanten Änderungen und Versionsstände des VereinsManagers werden in dieser Datei dokumentiert.

---

## [unveröffentlicht]

### 🛑 KI ist ab Werk aus — und wird nur mit Namen und Datum eingeschaltet

- **Bisher lief die KI, sobald ein Schlüssel hinterlegt war.** Das ist die
  falsche Vorgabe für eine Vereinsverwaltung: Ein Kassenwart, der einen
  Schlüssel einträgt, weil er die Belegerkennung sehen möchte, hat damit noch
  keine Entscheidung darüber getroffen, dass Kontoauszüge und Aufnahmeanträge
  des Vereins an Google gehen. Die Nutzung muss ein eigener, bewusster Schritt
  sein.
- **Deshalb gibt es jetzt drei Zustände statt zwei:** *Aus* (nichts
  hinterlegt), *eingerichtet, aber nicht freigegeben* (Schlüssel liegt da, es
  passiert nichts) und *in Betrieb*. Der mittlere Zustand ist neu und ist der,
  in dem eine bestehende Installation nach der Aktualisierung landet — auch
  wenn dort längst ein Schlüssel lag. Niemand wird ungefragt weiterbetrieben.
- **Die Sperre sitzt im Server, nicht in der Oberfläche.** `readAiCredentials()`
  gibt ohne Freigabe `null` zurück; jeder KI-Endpunkt bricht davor mit einer
  eigenen Meldung ab (`KI_NICHT_FREIGEGEBEN`, zu unterscheiden von „kein
  Schlüssel hinterlegt"). Auch der Ersatzweg über die Umgebungsvariable
  `GEMINI_API_KEY` ist mitgesperrt — sonst hätte eine `.env` die Entscheidung
  stillschweigend überstimmt. Wer die Oberfläche umgeht und die Endpunkte
  direkt anspricht, kommt damit ebenfalls nicht durch.
- **Einzige Ausnahme ist der Verbindungstest.** Er darf auch ohne Freigabe
  laufen, sonst ließe sich ein Schlüssel nicht prüfen, bevor man ihn freigibt.
  Er schickt einen Blindtext an den Anbieter, keine Vereinsdaten.
- **Freigeben heißt: Name eintragen und einen Hinweis bestätigen.** Der Hinweis
  benennt ohne Beschönigung, was geschieht — welche Daten den Server verlassen,
  dass der kostenlose Tarif die Verwendung zum Training einschließt, dass der
  Verein als Verantwortlicher im Sinne der DSGVO auftritt und dass dafür ein
  Auftragsverarbeitungsvertrag nötig ist, den Google nur im kostenpflichtigen
  Tarif anbietet. Wer bestätigt, steht mit Namen und Zeitpunkt in der
  Konfiguration; das ist die Angabe, die im Zweifel gegenüber der
  Mitgliederversammlung oder einer Aufsichtsbehörde zählt. Zurücknehmen geht
  jederzeit und löscht diese Angabe wieder.
- **Die KI-Knöpfe in den übrigen Masken bleiben sichtbar und werden ausgegraut**
  — nach demselben Muster wie die Knöpfe des Rechtesystems. Beim Darüberfahren
  erklären sie, warum sie gesperrt sind, und verweisen auf die Einstellungen.
  Betroffen sind Buchungsvorschlag und Belegerkennung im Buchungsdialog, die
  Entwurfshilfe, die Ton- und die Notizenauswertung bei den Protokollen sowie
  die Antragsübernahme aus PDF — dort startet zusätzlich der automatische
  Durchlauf beim Öffnen nicht mehr. Verschwundene Knöpfe erzeugen Ratlosigkeit;
  gesperrte mit Begründung nicht.
- **Ein Fehler, den erst der Regressionstest zeigte:** Das Umlegen der Freigabe
  schrieb die Modellauswahl mit, weil „nicht mitgeschickt" und „auf leer setzen"
  im Server nicht unterschieden wurden. Wer freigab, verlor sein eingestelltes
  Modell. Behoben und mit einem eigenen Test festgenagelt.

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
