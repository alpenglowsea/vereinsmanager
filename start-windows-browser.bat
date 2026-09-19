@echo off
:: ==========================================================
::  Hilfsskript. Wird von start-windows.bat aufgerufen und
::  nicht von Hand gestartet.
::
::  Aufgabe: warten, bis der Server seinen Zugriffsschluessel
::  geschrieben hat, und dann den Browser mit diesem Schluessel
::  in der Adresse oeffnen. Alles hinter dem Rautezeichen
::  schickt der Browser NICHT an den Server — der Schluessel
::  landet damit in keinem Serverprotokoll.
:: ==========================================================
setlocal enabledelayedexpansion
cd /d "%~dp0"

set SCHLUESSEL=

:: Wurde ein eigener Schluessel vorgegeben, steht er nicht in der
:: Konfigurationsdatei — dann gilt dieser.
if defined VM_ACCESS_KEY set SCHLUESSEL=%VM_ACCESS_KEY%

if not defined SCHLUESSEL (
    for /l %%v in (1,1,100) do (
        if exist "daten\konfiguration.json" (
            for /f "usebackq delims=" %%a in (`powershell -NoProfile -Command "try{(Get-Content -Raw 'daten\konfiguration.json' ^| ConvertFrom-Json).accessKey}catch{''}"`) do set SCHLUESSEL=%%a
        )
        if defined SCHLUESSEL goto :gefunden
        powershell -NoProfile -Command "Start-Sleep -Milliseconds 300" >nul
    )
)

:gefunden
if defined SCHLUESSEL (
    start "" "http://localhost:3000/#zugriff=!SCHLUESSEL!"
) else (
    echo [!] Der Zugriffsschluessel des Servers konnte nicht gelesen werden.
    echo     Die App startet trotzdem. E-Mail-Versand, Belegerkennung und
    echo     KI-Funktionen bleiben aber gesperrt. Der Schluessel steht in der
    echo     Ausgabe des Server-Fensters und laesst sich in der App unter
    echo     Einstellungen - Allgemein eintragen.
    timeout /t 8 >nul
    start "" "http://localhost:3000"
)
endlocal
