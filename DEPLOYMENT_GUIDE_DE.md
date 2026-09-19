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

## 🐳 Modus 3: Eigener Server & Docker (Synology NAS / QNAP / Raspberry Pi / vServer)

*Für Vereine mit eigener Server-Hardware und dem Wunsch nach 100 % lokaler Datenhoheit.*

### Starten per Docker Compose:
```bash
# 1. Repository klonen
git clone https://github.com/ihr-verein/vereinsmanager.git
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

### ⚠️ Wo liegen die Daten?

Der Container liefert die Anwendung aus und rechnet — **eine Datenbank
enthält er nicht.** Wo die Vereinsdaten landen, entscheidet der
Betriebsmodus in der App unter **Einstellungen &rarr;
Cloud-Synchronisation**:

| | **Lokalbetrieb** (Vorgabe) | **Cloud-Betrieb** (Supabase eingerichtet) |
| :--- | :--- | :--- |
| Daten liegen | in der IndexedDB des jeweiligen Browsers | in der Supabase-Datenbank |
| Zwei Vorstandsmitglieder an zwei Geräten | sehen **zwei getrennte Bestände** | sehen **denselben Bestand** |
| Anmeldung | Benutzer nur auf diesem Gerät | eigenes Konto je Person, Rechte serverseitig geprüft |
| Gerätewechsel | nur über Datensicherung + Rückspielen | einfach anmelden |
| „Websitedaten löschen“ im Browser | löscht die Vereinsdaten | löscht nur den Zwischenspeicher |

Wer gemeinsam an einem Datenbestand arbeiten will, braucht also den
**Cloud-Betrieb** — auch dann, wenn dieser Container auf dem eigenen NAS
läuft. Der eigene Server hostet die Anwendung, nicht die Daten; die
Datenbank ersetzt er nicht.

> **Offene Baustelle:** Ein echter Zwischenweg — Daten auf dem eigenen
> Server statt bei Supabase, mit mehreren Anwendern — existiert derzeit
> nicht. Er steht auf der Liste, ist aber ein eigenes Vorhaben.

Und in beiden Fällen: regelmäßig über **Einstellungen &rarr;
Datensicherung** sichern.

### 🛡️ Schutz vor Missbrauch

Zwei Stellen sind von aussen erreichbar, ohne dass sich jemand anmelden
muss. Beide sind begrenzt:

**Das öffentliche Aufnahmeformular** (nur im Cloud-Betrieb). Die Datenbank
nimmt höchstens 20 Anträge je Stunde, 60 je Tag und 3 je E-Mail-Adresse und
Tag an. Wer darüber liegt, bekommt einen freundlichen Hinweis mit der Bitte,
sich direkt an den Verein zu wenden. Für den Vorstand gelten diese Grenzen
nicht — er kann jederzeit Papieranträge nacherfassen.

Dabei wird **die IP-Adresse des Absenders nicht gespeichert**, auch nicht
als Prüfsumme. Gezählt wird nur, wie viele Anträge insgesamt eingegangen
sind. Für die Datenschutzerklärung des Vereins ist hier also nichts
nachzutragen. Der Preis dieser Entscheidung: Wer die Stundengrenze mutwillig
ausschöpft, sperrt damit für den Rest der Stunde auch echte Interessenten
aus. Die Grenzen lassen sich in `supabase_rls.sql`, Abschnitt 7d, anpassen.

**Die /api-Endpunkte** des Servers (KI-Funktionen, E-Mail-Versand) sind seit
Fassung 1.3 nicht mehr frei zugänglich. Wer sie aufrufen will, braucht einen
von zwei Ausweisen:

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

Die Statusseite `/api/health` bleibt bewusst offen, damit Docker den
Container überwachen kann. Sie verrät nichts ausser „Server läuft".

Die Ratenbegrenzung gilt zusätzlich weiter: 120 Aufrufe je 5 Minuten
allgemein, 30 je Stunde für KI-Aufrufe (die kosten den Verein über seinen
API-Schlüssel Geld) und 20 je Stunde für den E-Mail-Versand. Gezählt wird je
IP-Adresse, ausschliesslich im Arbeitsspeicher — ein Neustart setzt die
Zähler zurück, und gespeichert wird nichts.

> **Was dieser Schutz nicht leistet:** Im Lokalbetrieb benutzen alle
> Vorstandsmitglieder denselben Zugriffsschlüssel. Er hält Fremde draussen,
> unterscheidet aber die eigenen Leute nicht voneinander. Wer das braucht,
> betreibt die Anwendung im Cloud-Modus mit persönlichen Konten.

### Verschlüsselte Adresse (HTTPS)

Soll die Anwendung über das Internet erreichbar sein, gehört ein
Reverse-Proxy davor, der das Zertifikat übernimmt — etwa der in DSM
eingebaute, Traefik, Caddy oder ein nginx. Eine kommentierte nginx-Vorlage
liegt im Projekt unter `nginx.conf`.

Das ist nicht nur eine Frage des Datenschutzes: Ohne HTTPS stellt der
Browser die Funktion `crypto.subtle` nicht bereit, mit der die Passwörter
gesichert werden. Die App weicht dann auf ein langsameres eigenes
Verfahren aus. Die Ausnahme ist `http://localhost` — das gilt dem Browser
als sicher.

---

## 👥 Benutzer- & Rollenverwaltung im Vorstand

Im Cloud-Betrieb können Vorstandsmitglieder über Supabase Auth verwaltet werden:
- **1. Vorsitzender / 2. Vorsitzender**: Vollzugriff auf alle Bereiche.
- **Kassenwart / Schatzmeister**: Vollzugriff auf Buchungen, SEPA-Lastschriften, Spenden & Finanzen.
- **Kassenprüfer**: Leserechte auf Buchungsjournal, Belege und Kassenberichte.
- **Abteilungsleiter / Trainer**: Spartenspezifische Mitglieder- & Inventarverwaltung.

Einladungen können direkt über das Supabase Dashboard (**Authentication > Users**) an die E-Mail-Adressen der Vorstandsmitglieder versendet werden.
