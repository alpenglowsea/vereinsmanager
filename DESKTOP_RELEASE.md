# 🖥️📱 VereinsManager veröffentlichen (Windows, macOS, Linux und Android)

Der Bauablauf **„VereinsManager Release (Desktop und Handy)“** auf GitHub
(`.github/workflows/release-desktop.yml`) erzeugt die Installationsdateien
für alle drei Desktop-Systeme und die Android-App und hängt sie an eine
Veröffentlichung. Auf dem eigenen Rechner muss dafür nichts installiert sein.

---

## 🔢 Versionsnummer

Desktop und Handy haben **eine gemeinsame Nummer** (seit 2.0.0, Entscheidung
25.11.2026). Sie steht an vier Stellen, die vor jeder Veröffentlichung
gleichziehen müssen:

| Datei | Zeile |
|---|---|
| `package.json` | `"version": "2.0.0",` |
| `src-tauri/tauri.conf.json` | `"version": "2.0.0",` |
| `src-tauri/Cargo.toml` | `version = "2.0.0"` |
| `android/app/build.gradle.kts` | `val vmVersion = "2.0.0"` |

(`package-lock.json` zieht `npm install` von selbst nach.)

Die Marke heißt dann `v2.0.0`. Passt eine der vier Stellen nicht, bricht der
Bau im ersten Schritt ab und sagt, welche. Die laufende Nummer, die Android
zusätzlich verlangt, rechnet die App selbst aus (2.0.0 → 20000, 2.1.3 → 20103).

Muster: Fehlerbehebungen erhöhen die letzte Zahl (2.0.1), neue Funktionen die
mittlere (2.1.0).

---

## 📱 Handy: Signierschlüssel (einmalig)

Android installiert eine App nur mit Unterschrift, und ein Update nur mit
**derselben** Unterschrift. Der Schlüssel dafür wird einmal angelegt und dann
für immer benutzt.

> ⚠️ **Geht der Schlüssel oder sein Passwort verloren, lässt sich keine
> spätere Fassung mehr über die installierte spielen.** Jeder Nutzer müsste die
> App deinstallieren (dabei gehen die Daten auf dem Handy verloren) und seine
> Datensicherung neu einspielen. Deshalb: Schlüsseldatei und Passwort an zwei
> getrennten, sicheren Orten aufbewahren (z. B. Passwortmanager und ein
> verschlüsselter USB-Stick). **Nie ins Repository.**

### 1. Schlüssel anlegen (Android Studio)
1. Projekt `android` in Android Studio öffnen.
2. Menü **Build → Generate Signed App Bundle or APK…** → **APK** → *Next*.
3. Bei *Key store path* auf **Create new…**:
   - *Key store path:* ein Ort **außerhalb** des Repository-Ordners, z. B. `Dokumente\VereinsManager-Schluessel\vereinsmanager.jks`
   - *Password* / *Confirm:* ein langes Passwort (das „Keystore-Passwort“)
   - *Alias:* `vereinsmanager`
   - *Key → Password:* dasselbe oder ein zweites Passwort (das „Key-Passwort“)
   - *Validity (years):* `50`
   - *Certificate:* bei *First and Last Name* den Vereins- oder eigenen Namen; der Rest darf leer bleiben
   - *OK*
4. Den Assistenten danach mit *Cancel* schließen; gebaut wird auf GitHub.

### 2. Schlüssel als Text kopieren (Windows PowerShell)
```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("$HOME\Documents\VereinsManager-Schluessel\vereinsmanager.jks")) | Set-Clipboard
```
(Pfad anpassen.) Der Schlüssel steht jetzt als langer Text in der Zwischenablage.

### 3. Secrets bei GitHub hinterlegen
Repository → **Settings → Secrets and variables → Actions → New repository secret**, viermal:

| Name | Inhalt |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | der Text aus Schritt 2 (einfügen) |
| `ANDROID_KEYSTORE_PASSWORT` | das Keystore-Passwort |
| `ANDROID_KEY_ALIAS` | `vereinsmanager` |
| `ANDROID_KEY_PASSWORT` | das Key-Passwort |

GitHub zeigt Secrets nach dem Speichern nie wieder an, auch nicht in den
Protokollen des Baus. Der Bau legt den Schlüssel nur für seine Dauer in einen
temporären Ordner und löscht ihn danach.

### Umstieg auf dem eigenen Handy
Die Fassung, die Android Studio mit dem grünen Pfeil installiert, trägt eine
andere Unterschrift (den Entwicklungsschlüssel von Android Studio). Die erste
Release-Fassung lässt sich deshalb **nicht darüber** installieren:
1. In der alten App eine Datensicherung anlegen und vom Handy wegkopieren.
2. Alte App deinstallieren.
3. Release-APK installieren, Sicherung einspielen.

Danach installiert jede weitere Release-Fassung ohne Umweg über die alte.

---

## 🚀 Veröffentlichen

### Erst ausprobieren (Testbau)
1. Repository → **Actions** → links **„VereinsManager Release (Desktop und Handy)“** → rechts **„Run workflow“**.
2. *Release Version:* `v2.0.0`, *Als Release veröffentlichen?:* **`nein`** → *Run workflow*.
3. Nach dem Lauf (etwa 20 Minuten) unten unter **„Artifacts“** die ZIP-Dateien laden: je Desktop-System eine und `vereinsmanager-android`.
4. Ausprobieren. Die Android-Fassung ist dabei die echte Release-Fassung (verdichtet und optimiert), also genau das, was Nutzer bekämen.

### Dann veröffentlichen
Entweder wie oben mit *Als Release veröffentlichen?:* **`ja`**, oder über eine Marke:

```bash
git tag v2.0.0
git push origin v2.0.0
```

Es entsteht eine reguläre Veröffentlichung (keine „Vorabversion“): Die
Versionsprüfung in der App fragt nach der neuesten regulären Version und fände
eine Vorabversion nicht.

---

## 🧪 Bauen, ohne ein Release zu veröffentlichen

Steht das zweite Feld auf **`nein`** (so ist es voreingestellt), entsteht im
Repository nichts: **kein Release, keine Marke.** Gebaut wird trotzdem für alle
drei Betriebssysteme und das Handy.

Die fertigen Pakete finden Sie anschließend in der Übersicht des Laufs ganz
unten unter **„Artifacts“**, eine ZIP-Datei je Betriebssystem und eine für Android. Sie werden
sieben Tage aufbewahrt und dann von selbst gelöscht.

Dafür ist das gedacht: eine Änderung ausprobieren, ohne den Anwendern eine
Fassung vorzusetzen, die noch gar keine sein soll. Erst wenn sich eine
Änderung bewährt hat, lohnt ein echtes Release.

> Weil die Pakete in einer ZIP-Datei stecken, ist eine daraus entpackte
> `.AppImage` unter Linux wieder nicht ausführbar — siehe „Installation unter
> Linux“ weiter unten.

Wird der Bau dagegen durch das Veröffentlichen einer Marke ausgelöst
(`git push origin v2.0.0`), entsteht immer ein Release. Die Frage stellt sich dort nicht.

---

## 📦 Wo finden Dritte / Vorstände die fertigen Downloads?

Nachdem GitHub Actions den Build abgeschlossen hat (dauert ca. 15–20 Minuten,
bei warmem Zwischenspeicher weniger):
1. Öffnen Sie Ihr Repository auf GitHub und klicken Sie rechts auf **Releases**.
2. Dort finden Sie die fertigen Pakete zum Direkt-Download:
   - 🪟 **Windows:**
     - `VereinsManager_2.0.0_x64-setup.exe` (NSIS-Installer: Installiert wahlweise für alle Benutzer in `C:\Programme\VereinsManager` oder lokal)
   - 🍏 **macOS:** `VereinsManager_2.0.0_aarch64.dmg` (Apple Silicon: M1 und neuer)
   - 🐧 **Linux:** `VereinsManager_2.0.0_amd64.AppImage`
   - 📱 **Android:** `VereinsManager_2.0.0_android.apk`

Je Betriebssystem gibt es genau ein Paket. (Die Dateinamen sind aus dem Muster
von Tauri abgeleitet; der genaue Name steht nach dem ersten Lauf im Release.)

> **Nur noch Apple Silicon.** Die frühere Universal-Fassung enthielt zusätzlich
> die Bauform für ältere Intel-Macs — und damit auch eine zweite
> Node-Laufzeitumgebung. Das ist doppelter Platzbedarf für Geräte, die nicht
> mehr unterstützt werden sollen.

---

## 🐧 Installation unter Linux: die `.AppImage`

Die `.AppImage` läuft auf den meisten Linux-Fassungen, ohne dass etwas
installiert wird — sie ist eine einzelne Datei, die alles Nötige mitbringt.
Sie wurde auf Ubuntu 22.04 gebaut und läuft deshalb auf dieser und auf neueren
Fassungen; auf deutlich älteren kann sie scheitern.

**Sie braucht einen zusätzlichen Handgriff:** Sie muss als „ausführbar"
gekennzeichnet werden. Ein Browser tut das beim Herunterladen nicht, und kein
Paket der Welt kann es mitbringen: Diese Kennzeichnung steckt nicht *in* der
Datei, sondern ist eine Eigenschaft, die das Dateisystem daneben führt. Genau
so soll es sein — sonst könnte jede heruntergeladene Datei von selbst starten.

Ohne Terminal: **Rechtsklick → Eigenschaften → Zugriffsrechte → Haken bei
„Datei als Programm ausführen"**. Danach genügt ein Doppelklick.

Mit Terminal:

```bash
chmod +x VereinsManager_2.0.0_amd64.AppImage
./VereinsManager_2.0.0_amd64.AppImage
```

Dieser Handgriff ist bei **jedem neuen Download** erneut nötig.

Meldet die `.AppImage` etwas über `libfuse.so.2`, fehlt eine Systembibliothek,
die manche Linux-Fassungen (z. B. Ubuntu 24.04) nicht mehr vorinstallieren:
`sudo apt install libfuse2`.

---

## 🧩 Was die Desktop-App mitbringt

Die Desktop-App besteht nicht nur aus der gebauten Oberfläche, sondern bringt
einen kleinen Server mit — denselben, der auch beim Start aus dem Projektordner
(die Start-Skripte) läuft. Er lauscht ausschließlich auf diesem Rechner. Im
fertigen Paket stecken deshalb zusätzlich:

| Was | Wofür |
|---|---|
| `binaries/vm-node-<plattform>` | die Node-Laufzeitumgebung, ohne die der Server nicht läuft |
| `server-runtime/server.cjs` | der Server selbst |
| `server-runtime/dist/` | die Oberfläche, die er ausliefert |
| `server-runtime/node_modules/` | die Pakete, die er zur Laufzeit lädt |

**Beides entsteht beim Bauen** (siehe die Schritte *„Node-Laufzeitumgebung als
Sidecar bereitstellen"* und *„Server-Laufzeit zusammenstellen"* im Workflow)
und liegt bewusst **nicht** im Repository — es sind mehrere hundert Megabyte,
die bei jedem Bau ohnehin neu entstehen.

Als Node-Laufzeitumgebung wird genau die genommen, die beim Bauen ohnehin auf
dem Bau-Rechner steht. Das erspart einen zusätzlichen Download samt Prüfsumme
und stellt sicher, dass ausgeliefert wird, womit auch gebaut wurde.

### Was das kostet

Das Paket wächst um **etwa 30 MB** (gemessen an der komprimierten
Node-Programmdatei), auf der Platte um gut 120 MB. Die Alternative wäre
gewesen, die Serverdienste ein zweites Mal in Rust nachzubauen — dann gäbe es
zwei Fassungen derselben Logik in zwei Sprachen, die für immer synchron
gehalten werden müssten. Der Platz ist das kleinere Übel.

### Wie der Start abläuft

1. Das Programm startet den mitgelieferten Server und liest dessen Ausgabe mit.
2. Es wartet auf die Zeile `VM_SERVER_BEREIT <adresse>` (höchstens 30 Sekunden).
3. Erst dann öffnet es sein Fenster — auf genau dieser Adresse.

Deshalb steht in `tauri.conf.json` **keine Fensterdefinition** mehr: Ein dort
eingetragenes Fenster ginge sofort beim Start auf und zeigte eine Fehlerseite,
solange der Server noch hochfährt. Größe, Titel und Adresse stehen jetzt in
`src-tauri/src/main.rs`.

Der Server sucht sich einen freien Port, falls 3000 belegt ist. Die
Bereitschaftsmeldung, auf die die Desktop-Fassung wartet, sieht entsprechend
schlicht aus:

```
VM_SERVER_BEREIT http://127.0.0.1:3000/
```

Der Server lauscht grundsätzlich fest nur auf `127.0.0.1` — aus dem Netzwerk
ist er nie erreichbar, egal ob Desktop-Fassung oder Start aus dem
Projektordner. Einen Zugriffsschlüssel oder einen anderen Ausweis verlangt er
seit Schritt 7 der Vereinfachung nicht mehr (früher gab es hier einen
installationsweiten Schlüssel, den die Oberfläche automatisch aus der
Fensteradresse übernahm — da ohnehin nur dieser eine Rechner den Server
erreichen kann, bot er keinen echten Zugewinn mehr).

**Wenn der Server nicht startet**, öffnet sich das Fenster trotzdem, dann mit
der mitgelieferten Oberfläche ohne Server. Mitglieder, Finanzen und alle
übrigen Bereiche arbeiten normal weiter — nur der Fehlerbericht-Knopf in den
Einstellungen fehlt, da er den Server braucht. Lieber das als ein Programm,
das gar nicht erst aufgeht. Was schiefging, steht in der Konsolenausgabe des
Programms.

---

## 🛡️ Wichtiger Hinweis zu Windows 11 SmartScreen & Defender

Wenn eine neue `.exe` frisch aus GitHub Actions heruntergeladen wird, kennt Microsoft die Datei noch nicht (da für gemeinnützige Vereine keine teuren kommerziellen Zertifikate für Hunderte Euro/Jahr gekauft werden). 

Windows 11 zeigt daher beim ersten Start oft den blauen Hinweis **„Der Computer wurde durch Windows geschützt“** (SmartScreen):

### So starten Anwender die App beim ersten Mal:
1. Im blauen SmartScreen-Fenster auf **„Weitere Informationen“** klicken.
2. Auf **„Trotzdem ausführen“** klicken.
3. Der Installer startet sofort, richtet das Startmenü- und Desktop-Icon ein und die App ist dauerhaft startklar.

---

## ⚡ Schnellstart für Entwickler / lokales Testen (ohne Binary-Build)

Für den direkten Start aus dem Quellcode liegen im Hauptverzeichnis bequeme Starter-Skripte bereit:
- **Windows:** Doppelklick auf `start-windows.bat`
- **macOS / Linux:** Ausführen von `./start-mac-linux.sh`
