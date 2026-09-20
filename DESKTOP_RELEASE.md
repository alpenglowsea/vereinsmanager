# 🖥️ VereinsManager Desktop-Apps erstellen (Windows .exe, Mac .dmg, Linux .AppImage)

Mit der integrierten **Tauri + GitHub Actions** Pipeline können Sie vollautomatisch fertige Installationsdateien für Windows, macOS und Linux erzeugen lassen, ohne selbst Build-Tools auf Ihrem PC installieren zu müssen.

---

## 🚀 So erstellen Sie einen neuen Desktop-Release auf GitHub:

### Methode 1: Über ein Versions-Tag (Empfohlen)
Sobald Sie einen neuen Versionsstand freigeben möchten, erstellen Sie einfach einen Git-Tag (z. B. `v1.0.0`):

```bash
git tag v1.0.0
git push origin v1.0.0
```

---

### Methode 2: Direkt über die GitHub-Weboberfläche (1-Klick)
1. Öffnen Sie Ihr Repository auf GitHub.
2. Klicken Sie oben auf den Tab **Actions**.
3. Wählen Sie in der linken Seitenleiste den Workflow **„VereinsManager Desktop Release“** aus.
4. Klicken Sie rechts auf **„Run workflow“**. Dort stehen zwei Felder:
   - *Release Version* — die Versionsnummer, z. B. `v0.9.0`
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
     - `VereinsManager_0.9.0_x64-setup.exe` (NSIS-Installer: Installiert wahlweise für alle Benutzer in `C:\Programme\VereinsManager` oder lokal)
     - `VereinsManager_0.9.0_x64_de-DE.msi` (Offizielles Windows MSI-Paket – besonders empfohlen für Firmen-/Schul-PCs)
   - 🍏 **macOS:** `VereinsManager_0.9.0_aarch64.dmg` (Apple Silicon: M1 und neuer)
   - 🐧 **Linux:** `VereinsManager_0.9.0_amd64.deb` (empfohlen) oder `.AppImage`

> **Nur noch Apple Silicon.** Die frühere Universal-Fassung enthielt zusätzlich
> die Bauform für ältere Intel-Macs — und damit auch eine zweite
> Node-Laufzeitumgebung. Das ist doppelter Platzbedarf für Geräte, die nicht
> mehr unterstützt werden sollen.

---

## 🐧 Installation unter Linux: bitte die `.deb`

**Empfohlen: `VereinsManager_0.9.0_amd64.deb`.** Doppelklick, installieren,
fertig — danach steht VereinsManager im Startmenü wie jedes andere Programm.

**Die `.AppImage` braucht einen zusätzlichen Handgriff.** Sie installiert sich
nicht, sondern läuft, wie sie ist — dafür muss sie aber als „ausführbar"
gekennzeichnet werden. Ein Browser tut das beim Herunterladen nicht, und kein
Paket der Welt kann es mitbringen: Diese Kennzeichnung steckt nicht *in* der
Datei, sondern ist eine Eigenschaft, die das Dateisystem daneben führt. Genau
so soll es sein — sonst könnte jede heruntergeladene Datei von selbst starten.

Ohne Terminal: **Rechtsklick → Eigenschaften → Zugriffsrechte → Haken bei
„Datei als Programm ausführen"**. Danach genügt ein Doppelklick.

Mit Terminal:

```bash
chmod +x VereinsManager_0.9.0_amd64.AppImage
./VereinsManager_0.9.0_amd64.AppImage
```

Dieser Handgriff ist bei **jedem neuen Download** erneut nötig.

Meldet die `.AppImage` etwas über `libfuse.so.2`, fehlt eine Systembibliothek,
die manche Linux-Fassungen nicht mehr vorinstallieren:
`sudo apt install libfuse2`. Die `.deb` braucht sie nicht.

---

## 🧩 Was seit Fassung 1.3 mitgeliefert wird

Bis Fassung 1.2 enthielt das Desktop-Programm **nur die gebaute Oberfläche**.
Alles, was einen Server braucht, lief dort ins Leere: E-Mail-Versand,
Belegerkennung, Buchungsvorschläge, Protokollauswertung. Ein Aufruf an
`/api/...` fand schlicht niemanden, der antwortet.

Jetzt bringt das Programm denselben Server mit, den auch der Docker-Betrieb
verwendet. Im fertigen Paket stecken deshalb zusätzlich:

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

Der Server sucht sich einen freien Port, falls 3000 belegt ist, und legt seine
Konfiguration im Datenverzeichnis der Anwendung ab — nicht neben dem Programm,
wo ein Update sie überschreiben könnte.

### Warum niemand einen Zugriffsschlüssel eintippen muss

Die `/api`-Endpunkte verlangen einen Zugriffsschlüssel; ohne ihn weist der
Server jeden Aufruf ab. In der Desktop-Fassung bekommt die Oberfläche ihn
geschenkt: Der Server hängt ihn an seine Bereitschaftsmeldung an —

```
VM_SERVER_BEREIT http://127.0.0.1:3000/#zugriff=<schlüssel>
```

— und das Programm öffnet sein Fenster auf genau dieser Adresse. Die Oberfläche
liest den Schlüssel beim Start aus, merkt ihn sich und entfernt ihn wieder aus
der Adresszeile (`src/services/apiClient.ts`).

Der Schlüssel steht dabei **hinter dem Doppelkreuz**. Alles danach ist ein
sogenanntes Fragment und wird vom Browser nie an den Server geschickt — er
taucht deshalb in keinem Zugriffsprotokoll auf.

Angehängt wird er nur, wenn der Server ausschließlich auf dem eigenen Rechner
lauscht. Das ist in der Desktop-Fassung der Fall: Sie setzt `VM_HOST=127.0.0.1`,
damit der Server aus dem Netzwerk gar nicht erreichbar ist. Im Docker-Betrieb
lauscht er weiterhin auf allen Adressen — dort unterbleibt das Anhängen, weil
der Schlüssel sonst in Protokollen landete, die anderswo aufbewahrt werden.

**Wenn der Server nicht startet**, öffnet sich das Fenster trotzdem, dann mit
der mitgelieferten Oberfläche ohne Server. Die Anwendung verhält sich in diesem
Fall genau wie die bisherige Desktop-Fassung: Mitglieder, Finanzen und alles
Übrige arbeiten normal weiter, nur E-Mail-Versand und KI-Funktionen fehlen.
Lieber das als ein Programm, das gar nicht erst aufgeht. Was schiefging, steht
in der Konsolenausgabe des Programms.

---

## 🛡️ Wichtiger Hinweis zu Windows 11 SmartScreen & Defender

Wenn eine neue `.exe` frisch aus GitHub Actions heruntergeladen wird, kennt Microsoft die Datei noch nicht (da für gemeinnützige Vereine keine teuren kommerziellen Zertifikate für Hunderte Euro/Jahr gekauft werden). 

Windows 11 zeigt daher beim ersten Start oft den blauen Hinweis **„Der Computer wurde durch Windows geschützt“** (SmartScreen):

### So starten Anwender die App beim ersten Mal:
1. Im blauen SmartScreen-Fenster auf **„Weitere Informationen“** klicken.
2. Auf **„Trotzdem ausführen“** klicken.
3. Der Installer startet sofort, richtet das Startmenü- und Desktop-Icon ein und die App ist dauerhaft startklar.

> 💡 **Tipp:** Wenn Sie das **`.msi`**-Paket anstelle der `.exe` verwenden, stuft Windows das Installationspaket oft noch vertrauenswürdiger ein.

---

## ⚡ Schnellstart für Entwickler / lokales Testen (ohne Binary-Build)

Für den direkten Start aus dem Quellcode liegen im Hauptverzeichnis bequeme Starter-Skripte bereit:
- **Windows:** Doppelklick auf `start-windows.bat`
- **macOS / Linux:** Ausführen von `./start-mac-linux.sh`
