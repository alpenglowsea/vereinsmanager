# 🚀 Betriebs- & Deployment-Leitfaden: VereinsManager

Der VereinsManager unterstützt **3 flexible Betriebsmodi**, die jeder Verein frei wählen und jederzeit wechseln kann:

---

## ☁️ Option A: 1-Klick Cloud (IONOS Deploy Now + Supabase EU) – *Empfohlen für den Verein*

Diese Option bietet geräteübergreifende Synchronisation in Echtzeit für mehrere Vorstandsmitglieder bei minimalen Kosten (~1 €/Monat) und 100 % DSGVO-Konformität in Deutschland.

### 1. Supabase Datenbank anlegen (0,00 € Free-Tier)
1. Besuchen Sie [supabase.com](https://supabase.com) und erstellen Sie ein kostenloses Konto.
2. Neues Projekt anlegen:
   - **Name:** `Mein-VereinsManager`
   - **Region:** `Central EU (Frankfurt) / eu-central-1` *(Wichtig für DSGVO!)*
   - **Database Password:** Sicheres Passwort generieren und notieren.
3. Öffnen Sie im Supabase Dashboard den Menüpunkt **SQL Editor**.
4. Kopieren Sie das Initialisierungsskript aus der App (oder aus `supabase_schema.sql`) und klicken Sie auf **Run**. Alle Tabellen und Sicherheitsregeln (RLS) sind nun aktiv.
5. Gehen Sie auf **Project Settings > API** und kopieren Sie:
   - `Project URL` (z. B. `https://xyzabc.supabase.co`)
   - `anon / public Key` (z. B. `eyJhbGciOiJIUzI1NiIsIn...`)

### 2. IONOS Deploy Now Hosting (~1 €/Monat)
1. Loggen Sie sich bei [IONOS Deploy Now](https://www.ionos.de/cloud/deploy-now) ein.
2. Neues Projekt erstellen und mit Ihrem GitHub-Repository verknüpfen.
3. Framework: **Vite / Static Site** auswählen.
4. **Build Command:** `npm run build`
5. **Publish Directory:** `dist`
6. Umgebungsvariablen in IONOS hinterlegen:
   - `VITE_SUPABASE_URL` = Ihre Supabase Project URL
   - `VITE_SUPABASE_ANON_KEY` = Ihr Supabase Anon Key
   - `VITE_DEPLOYMENT_MODE` = `cloud`
7. Speichern & Bereitstellen: IONOS baut die App automatisch bei jedem Git-Push und stellt ein kostenloses SSL-Zertifikat bereit.
8. *(Optional)* Eigene Vereinsdomain verknüpfen (z. B. `verwaltung.mein-verein.de`).

---

## 🐳 Option B: Selbsthoster & Docker (NAS / Raspberry Pi / vServer)

Ideal für Vereine mit eigener IT-Infrastruktur oder Synology / QNAP NAS.

### Starten mit Docker Compose:
```bash
# 1. Repository klonen
git clone https://github.com/ihr-verein/vereinsmanager.git
cd vereinsmanager

# 2. Container im Hintergrund starten
docker compose up -d --build
```
Die Anwendung ist sofort unter `http://localhost:8080` bzw. Ihrer Server-IP erreichbar.

---

## 💻 Option C: Lokaler Einzelplatz (Browser / IndexedDB)

- **0,00 € Kosten, 0 Einrichtung**
- Läuft direkt im Webbrowser (Chrome, Firefox, Safari, Edge).
- Alle Daten liegen ausschließlich verschlüsselt in der lokalen Browser-Datenbank (IndexedDB).
- Funktioniert 100 % offline ohne Internetverbindung.
- Datensicherung per 1-Klick JSON-Export/Import im Menü Einstellungen.

---

## 🔄 Datenübertragung (Migration von Lokal zu Cloud)
Wenn Sie bereits lokale Mitglieder oder Buchungen in der App eingetragen haben:
1. Öffnen Sie in der App oben rechts **Cloud & Deployment Hub**.
2. Tragen Sie Ihre Supabase-Zugangsdaten ein.
3. Klicken Sie auf **"Lokale Vereinsdaten jetzt in Supabase übertragen"**.
4. Alle Daten werden sekundenschnell synchronisiert!
