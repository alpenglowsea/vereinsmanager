# 🖥️ VereinsManager Desktop-Apps erstellen (Windows .exe, Mac .dmg, Linux .AppImage)

Mit der integrierten **Tauri + GitHub Actions** Pipeline können Sie vollautomatisch fertige Installationsdateien für Windows, macOS und Linux erzeugen lassen, ohne selbst Build-Tools auf Ihrem PC installieren zu müssen.

---

## 🚀 So erstellen Sie einen neuen Desktop-Release auf GitHub:

### Methode 1: Über ein Versions-Tag (Empfohlen)
Sobald Sie einen neuen Versionsstand freigeben möchten, erstellen Sie einfach einen Git-Tag (z. B. `v1.1.0`):

```bash
git tag v1.1.0
git push origin v1.1.0
```

---

### Methode 2: Direkt über die GitHub-Weboberfläche (1-Klick)
1. Öffnen Sie Ihr Repository auf GitHub.
2. Klicken Sie oben auf den Tab **Actions**.
3. Wählen Sie in der linken Seitenleiste den Workflow **„VereinsManager Desktop Release“** aus.
4. Klicken Sie rechts auf **„Run workflow“**. Dort stehen zwei Felder:
   - *Release Version* — die Versionsnummer, z. B. `v1.1.0`
   - *Als Release veröffentlichen?* — `ja` oder `nein`
5. Bestätigen Sie mit **„Run workflow“**.

---

## 🧪 Bauen, ohne ein Release zu veröffentlichen

Steht das zweite Feld auf **`nein`** (so ist es voreingestellt), entsteht im
Repository nichts: **kein Release, keine Marke.** Gebaut wird trotzdem für alle
drei Betriebssysteme.

Die fertigen Pakete finden Sie anschließend in der Übersicht des Laufs ganz
unten unter **„Artifacts“**, eine ZIP-Datei je Betriebssystem. Sie werden
sieben Tage aufbewahrt und dann von selbst gelöscht.

Dafür ist das gedacht: eine Änderung ausprobieren, ohne den Anwendern eine
Fassung vorzusetzen, die noch gar keine sein soll. Erst wenn sich eine
Änderung bewährt hat, lohnt ein echtes Release.

> Weil die Pakete in einer ZIP-Datei stecken, ist eine daraus entpackte
> `.AppImage` unter Linux wieder nicht ausführbar — siehe „Installation unter
> Linux“ weiter unten.

Wird der Bau dagegen durch das Veröffentlichen einer Marke ausgelöst
(Methode 1), entsteht immer ein Release. Die Frage stellt sich dort nicht.

---

## 📦 Wo finden Dritte / Vorstände die fertigen Downloads?

Nachdem GitHub Actions den Build abgeschlossen hat (dauert ca. 15–20 Minuten,
bei warmem Zwischenspeicher weniger):
1. Öffnen Sie Ihr Repository auf GitHub und klicken Sie rechts auf **Releases**.
2. Dort finden Sie die fertigen Pakete zum Direkt-Download:
   - 🪟 **Windows:**
     - `VereinsManager_1.1.0_x64-setup.exe` (NSIS-Installer: Installiert wahlweise für alle Benutzer in `C:\Programme\VereinsManager` oder lokal)
   - 🍏 **macOS:** `VereinsManager_1.1.0_aarch64.dmg` (Apple Silicon: M1 und neuer)
   - 🐧 **Linux:** `VereinsManager_1.1.0_amd64.AppImage`

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
chmod +x VereinsManager_1.1.0_amd64.AppImage
./VereinsManager_1.1.0_amd64.AppImage
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
