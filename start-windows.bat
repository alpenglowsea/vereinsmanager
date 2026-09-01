@echo off
setlocal
chcp 65001 >nul
title VereinsManager - Start-Assistent
echo ========================================================
echo   VereinsManager - Revisionssichere Vereinsverwaltung
echo ========================================================
echo.

:: 1. Prüfen, ob Node.js installiert ist
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [!] Node.js wurde nicht auf Ihrem System gefunden.
    echo.
    echo [*] HINWEIS: Wenn Sie die fertige Desktop-App (.msi / .exe) aus den
    echo     GitHub Releases nutzen, benoetigen Sie KEIN Node.js!
    echo.
    echo [*] Moechten Sie den Entwicklungs-Server starten?
    echo     Laden Sie Node.js (LTS, ca. 30 MB) herunter: https://nodejs.org
    echo     (Tipp: Beim Setup das optionale 'Chocolatey/Tools'-Haekchen einfach weglassen)
    echo.
    pause
    exit /b 1
)

:: 2. Prüfen, ob node_modules existiert
if not exist "node_modules\" (
    echo [*] Installiere notwendige Pakete (npm install)...
    call npm install
    if %errorlevel% neq 0 (
        echo [!] Fehler bei der Installation der Abhaengigkeiten.
        pause
        exit /b 1
    )
)

:: 3. Anwendung starten und Browser öffnen
echo.
echo [*] Starte VereinsManager...
echo [*] Oeffne Browser unter http://localhost:3000
echo.

start "" http://localhost:3000
npm run dev
pause

