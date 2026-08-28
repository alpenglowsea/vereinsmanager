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
4. Klicken Sie rechts auf **„Run workflow“**, geben Sie die gewünschte Versionsnummer ein (z. B. `v1.0.0`) und bestätigen Sie mit **„Run workflow“**.

---

## 📦 Wo finden Dritte / Vorstände die fertigen Downloads?

Nachdem GitHub Actions den Build abgeschlossen hat (dauert ca. 3–5 Minuten):
1. Öffnen Sie Ihr Repository auf GitHub und klicken Sie rechts auf **Releases**.
2. Dort finden Sie die fertigen Pakete zum Direkt-Download:
   - 🪟 **Windows:** `VereinsManager_1.0.0_x64-setup.exe` oder `.msi`
   - 🍏 **macOS:** `VereinsManager_1.0.0_universal.dmg` (Intel & Apple Silicon M1/M2/M3/M4)
   - 🐧 **Linux:** `VereinsManager_1.0.0_amd64.AppImage` oder `.deb`

---

## ⚡ Schnellstart für Entwickler / lokales Testen (ohne Binary-Build)

Für den direkten Start aus dem Quellcode liegen im Hauptverzeichnis bequeme Starter-Skripte bereit:
- **Windows:** Doppelklick auf `start-windows.bat`
- **macOS / Linux:** Ausführen von `./start-mac-linux.sh`
