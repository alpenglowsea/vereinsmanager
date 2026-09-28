# 🏛️ Betriebs-, Bereitstellungs- & Umzugs-Leitfaden: VereinsManager

Der **VereinsManager** bietet maximale Flexibilität: Sie können als Einzelperson mit der **kostenlosen, lokalen Desktop-App** beginnen und später bei Bedarf **mit allen vorhandenen Vereinsdaten in die Cloud oder auf einen eigenen Server umziehen**.

---

## 💻 Modus 1: Lokale Desktop-App (Standard & Schnelleinstieg)

*Ideal für den Einstieg, für einzelne Kassenwarte oder zur unverbindlichen Erkundung.*

- **0,00 € Kosten & 0 Server-Einrichtung**
- **100 % Offline-fähig**: Alle Daten liegen in einer lokalen Datenbank auf Ihrem Computer.
- **Fertige Installationspakete**: Über GitHub Releases als `.exe` (Windows), `.dmg` (macOS) oder `.AppImage` (Linux) herunterladen und per Doppelklick starten.
- **Alternativer Skriptstart**: Ausführen über `start-windows.bat` (Windows) oder `start-mac-linux.sh` (Mac/Linux).
- **Datensicherung**: Jederzeit 1-Klick JSON-Komplettsicherung über den Menüpunkt *Einstellungen* oder den *Deployment Hub*.

---

## 🔄 1-Klick Daten-Umzug: Von Lokal in die Cloud oder auf den eigenen Server

Wenn Sie in der lokalen Desktop-App bereits Mitglieder, Buchungen, Bankkonten oder Inventar erfasst haben und nun die Arbeit auf mehrere Vorstandsmitglieder verteilen möchten:

1. **Sicherheits-Backup erstellen**: Im **Deployment Hub** (oder unter *Einstellungen*) auf **„Komplett-Backup (.json) sichern“** klicken.
2. **Cloud-Ziel verbinden**: Im Tab **Cloud-Setup** Ihre Supabase-Zugangsdaten eintragen.
3. **1-Klick Migration starten**: Auf **„🚀 Alle lokalen Daten jetzt in die Cloud übertragen“** klicken.
4. **Ergebnis**: Alle Mitglieder, Buchungsjournale, Bankkonten, Inventare und Einstellungen werden sekundenschnell übertragen.
5. **Datensicherheit**: Ihre lokalen Daten bleiben als zusätzliche Sicherheitskopie auf Ihrem Computer erhalten.

---

## ☁️ Modus 2: Universeller Cloud-Betrieb (Multi-User für den Vorstand)

*Echtzeit-Zusammenarbeit für Vorstand, Schatzmeister, Kassenprüfer & Trainer – DSGVO-konform in Deutschland.*

### Schritt A: Kostenlose Cloud-Datenbank einrichten (Supabase Frankfurt / EU)
1. Kostenloses Konto auf [supabase.com](https://supabase.com) erstellen.
2. Neues Projekt erstellen:
   - **Region:** `Central EU (Frankfurt / eu-central-1)` *(Wichtig für DSGVO!)*
   - **Database Password:** Sicheres Kennwort vergeben.
3. Im Supabase Dashboard links den **SQL Editor** öffnen.
4. Das Skript aus `supabase_schema.sql` (oder direkt aus dem Deployment Hub) einfügen und auf **Run** klicken.
5. Unter **Project Settings > API** die `Project URL` und den `anon / public Key` kopieren.
6. Die beiden Werte im **Deployment Hub** der App eintragen und auf **Speichern & Aktivieren** klicken.

> 💡 **Tipp für Vorstände (Kein Webhosting nötig):**
> Sie können die **Desktop-App** auf den PCs aller Vorstandsmitglieder installieren und überall dieselbe Supabase-URL eintragen. Alle Vorstände arbeiten sofort in Echtzeit synchron, ohne dass Sie eine Website hosten müssen!

---

### Schritt B: Web-App bei einem beliebigen Hoster bereitstellen (Optional für Web-Zugriff)

Falls Sie die Anwendung zusätzlich als geschützte Web-App im Browser unter Ihrer Vereinsdomain bereitstellen möchten, funktioniert dies mit **jedem beliebigen Webhoster**:

#### Universelle Bereitstellungsparameter:
- **Build Command:** `npm run build`
- **Output / Publish Directory:** `dist`
- **Node.js Version:** `18+` oder `20+`
- **Umgebungsvariablen (Environment Variables):**
  - `VITE_SUPABASE_URL` = `https://[ihr-projekt].supabase.co`
  - `VITE_SUPABASE_ANON_KEY` = `eyJhbGciOiJIUzI1Ni...`
  - `VITE_DEPLOYMENT_MODE` = `cloud`

#### Beliebte Hoster im Überblick:
| Hoster | Besonderheit | Typische Kosten |
| :--- | :--- | :--- |
| **Hetzner Cloud / Webhosting** | Rechenzentren in Falkenstein/Nürnberg, 100 % DSGVO | ab ~1,50 € / Monat |
| **Strato / IONOS** | Deutsche Rechenzentren, Vereinsdomain (.de) inklusive | ab ~1,00 € / Monat |
| **Netlify / Vercel / Cloudflare Pages** | Weltweites CDN, automatisches SSL, 1-Klick GitHub Deploy | 0,00 € (Free-Tier) |
| **Klassischer Webspace / FTP** | Nach `npm run build` den Inhalt von `dist/` per SFTP hochladen | vorhanden |

---

## 🖥️ Modus 3: Gehostet — eigener Server mit eigenen Daten (Docker / Synology NAS / QNAP / Raspberry Pi / vServer)

*Für Vereine mit eigener Server-Hardware oder einem vServer, die volle
Datenhoheit UND mehrere gleichzeitig angemeldete Personen wollen, ohne dafür
bei einem Cloud-Anbieter wie Supabase zu landen.*

**Was sich hier grundlegend geändert hat:** Früher lieferte dieser Container
nur die Anwendung aus — die Vereinsdaten mussten trotzdem bei Supabase
liegen (Modus 2), sonst sah jedes angemeldete Gerät nur seinen eigenen,
unabhängigen Bestand. Genau das war die „offene Baustelle", die dieser
Leitfaden früher an dieser Stelle genannt hat. Seit dieser Fassung hat der
Container eine eigene Datenbank (SQLite, Datei `daten/vereinsdaten.sqlite`)
und ein eigenes Benutzersystem — mehrere Vorstandsmitglieder arbeiten am
selben Bestand, ganz ohne Supabase. Wer stattdessen (oder zusätzlich)
Supabase im selben Container verwenden möchte, kann das weiterhin tun —
siehe die Tabelle „Wo liegen die Daten?" weiter unten, wie die beiden sich
zueinander verhalten.

### Starten per Docker Compose:
```bash
# 1. Repository klonen
git clone https://github.com/alpenglowsea/vereinsmanager.git
cd vereinsmanager

# 2. Optional: Konfiguration anlegen
#    Nur nötig, wenn die KI-Funktionen genutzt werden sollen.
cp .env.example .env
#    In der .env den GEMINI_API_KEY eintragen.

# 3. Container bauen und starten
docker compose up -d --build
```
Die Anwendung ist danach unter `http://[Server-IP]:8080` erreichbar.

Nützliche Befehle danach:
```bash
docker compose logs -f      # Protokoll mitlesen
docker compose restart      # neu starten
docker compose down         # anhalten
docker compose up -d --build  # nach einem Update neu bauen
```

Ob alles läuft, zeigt die Statusseite: `http://[Server-IP]:8080/api/health`
gibt `{"status":"ok", …}` zurück. Kommt dort stattdessen eine HTML-Seite,
läuft nur die Oberfläche und nicht der Serverteil.

### Einrichtung auf Synology DiskStation (Container Manager):
1. Öffnen Sie im DSM den **Container Manager** &rarr; **Projekt** &rarr; **Erstellen**.
2. Projektname vergeben (z. B. `vereinsmanager`) und den Quellcode-Ordner zuweisen.
3. Die `docker-compose.yml` hinterlegen und auf **Starten** klicken.

> **Hinweis zu Port 8080:** Auf einer Synology ist dieser Port häufig schon
> vom DSM selbst belegt. In dem Fall in der `docker-compose.yml` die linke
> Zahl unter `ports` ändern, z. B. auf `"8081:3000"`.

### 👤 Erste Einrichtung: das erste Vorstandskonto

Beim allerersten Aufruf der Adresse zeigt die App statt der Anmeldemaske
eine Ersteinrichtung: Name, E-Mail-Adresse und ein Passwort für das erste
Konto. Dieses Konto bekommt automatisch die Rolle **„1. Vorsitzende(r)"**
mit **Vollzugriff auf alle 18 Bereiche** und ist im selben Schritt gleich
angemeldet — es muss dafür niemand extra etwas freischalten.

Jedes **weitere** Konto (über *Einstellungen → Benutzer & Rechte* vom
Vorstand angelegt) startet dagegen bewusst **ohne jeden Zugriff**. Wer es
angelegt hat, vergibt anschließend selbst, welche der 18 Bereiche diese
Person sehen oder bearbeiten darf — siehe die Tabelle weiter unten. Ein neu
angelegtes Konto muss beim ersten Anmelden sein anfängliches Passwort
ändern.

### 🔑 Passwort vergessen

Jede Person mit einem eigenen Konto kann ihr Passwort selbständig
zurücksetzen — nicht nur der Vorstand mit Zugriff auf die
Benutzerverwaltung. Auf der Anmeldemaske genügt ein Klick auf „Passwort
vergessen?" und die eigene E-Mail-Adresse; es kommt eine E-Mail mit einem
Link, der eine Stunde gültig und genau einmal einlösbar ist.

**Voraussetzung:** Auf diesem Server muss ein SMTP-Postausgangsserver
eingerichtet sein (*Einstellungen → Vereinsstammdaten*, siehe der
gleichnamige Abschnitt in der README) — ohne E-Mail-Versand kann kein Link
verschickt werden, und die App sagt das auch offen dazu, statt eine
Fehlermeldung ohne Erklärung zu zeigen. Ob eine eingegebene Adresse
tatsächlich zu einem Konto gehört, verrät die App dabei nie — die Antwort
ist immer dieselbe, unabhängig davon.

### 🔐 Rechte je Bereich — 18 Bereiche einzeln steuerbar

Unter *Einstellungen → Benutzer & Rechte* lässt sich für jede Person und
jeden der folgenden 18 Bereiche einzeln „kein Zugriff", „lesen" oder
„bearbeiten" einstellen — serverseitig durchgesetzt, nicht nur in der
Oberfläche versteckt: Ein Knopf, für den das Recht fehlt, bleibt sichtbar,
aber ausgegraut, mit einer Erklärung beim Darüberfahren.

Übersicht (Dashboard) · Mitgliederverwaltung · Online-Aufnahmeanträge ·
Mitglieder-Statistiken · Mitgliederbefragungen · Buchungen & Kassenbuch ·
SEPA-Beitragslauf · Rechnungen · Zuwendungsbestätigungen · EÜR/GuV & Sphären
· Finanz-Auswertungen · Kontakte & Partner · Vereinskalender ·
Sitzungsdienst & Beschlussbuch · Inventar & Material · Dokumentenarchiv ·
Vereinseinstellungen · Benutzer & Rechte

Für den Anfang gibt es fertige Rollenvorlagen zum Übernehmen, die sich
danach jederzeit noch verfeinern lassen: **Vorstand (alles)**,
**Schatzmeister/in**, **Mitgliederverwaltung**, **Kassenprüfer/in (nur
lesen)** und **Kein Zugriff**.

### ⚠️ Wo liegen die Daten?

| | **lokal allein** (Vorgabe) | **lokal mit Supabase** | **gehostet** |
| :--- | :--- | :--- | :--- |
| Daten liegen | in der IndexedDB des Browsers | in der Supabase-Datenbank | in der SQLite-Datei auf dem Server |
| Mehrere Personen an mehreren Geräten | sehen **getrennte Bestände** | sehen **denselben Bestand** | sehen **denselben Bestand** |
| Anmeldung | keine, nur dieses Gerät | eigenes Konto je Person (Supabase Auth) | eigenes Konto je Person (auf diesem Server) |
| Wo läuft die Anmeldeprüfung | — | bei Supabase | auf dem eigenen Server, nirgends sonst |
| Gerätewechsel | nur über Datensicherung + Rückspielen | einfach anmelden | einfach anmelden |
| „Websitedaten löschen" im Browser | löscht die Vereinsdaten | löscht nur den Zwischenspeicher | löscht nur den Zwischenspeicher |

Dieser Container kann **beides zugleich**: eigene Konten für die
gehosteten Daten UND zusätzlich eine Supabase-Verbindung, falls gewünscht —
beide Systeme laufen unabhängig nebeneinander und vermischen sich nicht. Für
die meisten Vereine, die einen eigenen Server betreiben, ersetzt „gehostet"
aber gerade den Umweg über Supabase.

Und in jedem Fall: regelmäßig über **Einstellungen &rarr; Datensicherung**
sichern — die SQLite-Datei gehört bei „gehostet" mit zu den
Vereinsstammdaten und darf (und soll) in eine Datensicherung mit hinein.

### 🛡️ Schutz vor Missbrauch

Zwei Stellen sind von aussen erreichbar, ohne dass sich jemand anmelden
muss. Beide sind begrenzt:

**Das öffentliche Aufnahmeformular** (im Cloud-Betrieb, also „lokal mit
Supabase"). Die Datenbank nimmt höchstens 20 Anträge je Stunde, 60 je Tag
und 3 je E-Mail-Adresse und Tag an. Wer darüber liegt, bekommt einen
freundlichen Hinweis mit der Bitte, sich direkt an den Verein zu wenden.
Für den Vorstand gelten diese Grenzen nicht — er kann jederzeit
Papieranträge nacherfassen.

Dabei wird **die IP-Adresse des Absenders nicht gespeichert**, auch nicht
als Prüfsumme. Gezählt wird nur, wie viele Anträge insgesamt eingegangen
sind. Für die Datenschutzerklärung des Vereins ist hier also nichts
nachzutragen. Der Preis dieser Entscheidung: Wer die Stundengrenze mutwillig
ausschöpft, sperrt damit für den Rest der Stunde auch echte Interessenten
aus. Die Grenzen lassen sich in `supabase_rls.sql`, Abschnitt 7d, anpassen.

**Die /api-Endpunkte** des Servers (KI-Funktionen, E-Mail-Versand, die
Konten- und Rechteverwaltung von „gehostet") sind seit Fassung 1.3 nicht
mehr frei zugänglich. Wer sie aufrufen will, braucht einen von zwei
Ausweisen:

* **Den Zugriffsschlüssel dieser Installation.** Der Server würfelt ihn beim
  ersten Start selbst aus und zeigt ihn in seiner Startausgabe an
  (`docker compose logs vereinsmanager`). Im Lokalbetrieb übergibt ihn das
  Startskript automatisch an den Browser; nur wer die App von einem anderen
  Rechner aus öffnet, trägt ihn einmalig unter *Einstellungen → Allgemein*
  ein. Ein eigener Wert lässt sich über `VM_ACCESS_KEY` vorgeben — dann
  bleibt er auch nach einem Neuaufbau des Containers derselbe.
* **Das Anmeldetoken aus dem Cloud-Betrieb.** Sind `SUPABASE_URL` und
  `SUPABASE_ANON_KEY` auch als Umgebungsvariablen des Servers gesetzt, prüft
  er das Token bei Supabase nach. Dann genügt die normale Anmeldung in der
  App, und niemand muss einen Schlüssel eintragen.

Dieser Zugriffsschlüssel ist eine **zusätzliche, davon unabhängige** Schicht
vor den eigenen Konten von „gehostet": Er entscheidet, ob eine Anfrage den
Server überhaupt erreicht — die Anmeldung mit E-Mail-Adresse und Passwort
danach, ob und als wer. Ein „Passwort vergessen"-Link trägt deshalb absichtlich
beide Angaben zugleich (siehe oben), sonst käme jemand auf einem neuen Gerät
nicht einmal bis zur Anmeldemaske.

Die Statusseite `/api/health` bleibt bewusst offen, damit Docker den
Container überwachen kann. Sie verrät nichts ausser „Server läuft".

Die Ratenbegrenzung gilt zusätzlich weiter: 120 Aufrufe je 5 Minuten
allgemein, 30 je Stunde für KI-Aufrufe (die kosten den Verein über seinen
API-Schlüssel Geld), 20 je Stunde für den E-Mail-Versand und 5 je Stunde für
„Passwort vergessen" (sicherheitsrelevant, deshalb enger als die übrigen).
Gezählt wird je IP-Adresse, ausschliesslich im Arbeitsspeicher — ein
Neustart setzt die Zähler zurück, und gespeichert wird nichts.

> **Was der Zugriffsschlüssel allein nicht leistet:** Er hält Fremde
> draussen, unterscheidet aber die eigenen Leute nicht voneinander. Genau
> dafür gibt es bei „gehostet" jetzt die eigenen Konten mit individuellen
> Rechten (siehe oben) — vorher war das nur im Cloud-Betrieb mit Supabase
> möglich.

### Verschlüsselte Adresse (HTTPS)

Soll die Anwendung über das Internet erreichbar sein — bei „gehostet" über
klassische Portweiterleitung am Router und eine DynDNS-Adresse, bewusst ohne
einen Drittanbieter-Tunnel dazwischen —, gehört ein Reverse-Proxy davor, der
das Zertifikat übernimmt. Zwei fertige, kommentierte Vorlagen liegen im
Projekt:

* **`nginx.conf`** — der klassische Weg. Das Zertifikat wird einmalig mit
  `certbot --nginx -d verwaltung.mein-verein.de` eingerichtet und danach von
  certbot selbständig erneuert.
* **`Caddyfile.example`** — die einfachere Alternative. Caddy fordert das
  Let's-Encrypt-Zertifikat für die eingetragene Adresse beim ersten Start
  selbständig an und erneuert es von selbst, ganz ohne separaten
  certbot-Schritt. Für einen Verein ohne eigene Erfahrung mit Zertifikaten
  der Weg mit den wenigsten Schritten — die genaue Einrichtung (inklusive
  eines zusätzlichen Diensts in der `docker-compose.yml`) steht als
  Kommentar am Anfang der Datei.

Das ist nicht nur eine Frage des Datenschutzes: Ohne HTTPS stellt der
Browser die Funktion `crypto.subtle` nicht bereit, mit der die Passwörter
gesichert werden. Die App weicht dann auf ein langsameres eigenes
Verfahren aus. Die Ausnahme ist `http://localhost` — das gilt dem Browser
als sicher.

---

## 👥 Benutzer- & Rollenverwaltung im Vorstand

Es gibt jetzt **zwei unabhängige Benutzersysteme** — welches gilt, hängt vom
Betriebsmodus ab:

* **Bei „gehostet"** (eigener Server mit eigener Datenbank, siehe oben):
  Konten liegen auf dem eigenen Server, mit fein einstellbaren Rechten je der
  18 Bereiche und eigenem „Passwort vergessen". Details siehe der Abschnitt
  „🔐 Rechte je Bereich" weiter oben in diesem Leitfaden.
* **Bei „lokal mit Supabase"** (Modus 2): Vorstandsmitglieder werden über
  Supabase Auth verwaltet, mit gröberen, vordefinierten Rollen:
  - **1. Vorsitzender / 2. Vorsitzender**: Vollzugriff auf alle Bereiche.
  - **Kassenwart / Schatzmeister**: Vollzugriff auf Buchungen, SEPA-Lastschriften, Spenden & Finanzen.
  - **Kassenprüfer**: Leserechte auf Buchungsjournal, Belege und Kassenberichte.
  - **Abteilungsleiter / Trainer**: Spartenspezifische Mitglieder- & Inventarverwaltung.

  Einladungen können direkt über das Supabase Dashboard
  (**Authentication > Users**) an die E-Mail-Adressen der
  Vorstandsmitglieder versendet werden.

Beide Systeme sind vollständig voneinander getrennt: Ein bei „gehostet"
angelegtes Konto existiert nicht in Supabase und umgekehrt.
