@echo off
chcp 65001 >nul
title VereinsManager - Start-Assistent
echo ========================================================
echo   VereinsManager • Revisionssichere Vereinsverwaltung
echo ========================================================
echo.

:: 1. Prüfen, ob Node.js installiert ist
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [!] Node.js wurde nicht auf Ihrem System gefunden.
    echo [*] Installiere Node.js via Windows Package Manager (winget)...
    echo.
    winget install OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements
    if %errorlevel% neq 0 (
        echo [!] Automatische Installation fehlgeschlagen.
        echo Bitte laden Sie Node.js manuell herunter: https://nodejs.org
        pause
        exit /b 1
    )
    echo [*] Node.js wurde erfolgreich installiert! Bitte starten Sie diese Datei erneut.
    pause
    exit /b 0
)

:: 2. Prüfen, ob node_modules existiert
if not exist "node_modules\" (
    echo [*] Installiere notwendige Pakete (npm install)...
    call npm install
    if %errorlevel% neq 0 (
        echo [!] Fehler bei der Installation der Abhängigkeiten.
        pause
        exit /b 1
    )
)

:: 3. Anwendung starten und Browser öffnen
echo.
echo [*] Starte VereinsManager...
echo [*] Öffne Browser unter http://localhost:3000
echo.

start "" http://localhost:3000
npm run dev
pause
