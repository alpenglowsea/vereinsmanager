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

# 2. Container starten
docker compose up -d --build
```
Die Anwendung ist danach unter `http://[Server-IP]:8080` erreichbar.

### Einrichtung auf Synology DiskStation (Container Manager):
1. Öffnen Sie im DSM den **Container Manager** &rarr; **Projekt** &rarr; **Erstellen**.
2. Projektname vergeben (z. B. `vereinsmanager`) und den Quellcode-Ordner zuweisen.
3. Die `docker-compose.yml` hinterlegen und auf **Starten** klicken.

---

## 👥 Benutzer- & Rollenverwaltung im Vorstand

Im Cloud-Betrieb können Vorstandsmitglieder über Supabase Auth verwaltet werden:
- **1. Vorsitzender / 2. Vorsitzender**: Vollzugriff auf alle Bereiche.
- **Kassenwart / Schatzmeister**: Vollzugriff auf Buchungen, SEPA-Lastschriften, Spenden & Finanzen.
- **Kassenprüfer**: Leserechte auf Buchungsjournal, Belege und Kassenberichte.
- **Abteilungsleiter / Trainer**: Spartenspezifische Mitglieder- & Inventarverwaltung.

Einladungen können direkt über das Supabase Dashboard (**Authentication > Users**) an die E-Mail-Adressen der Vorstandsmitglieder versendet werden.
