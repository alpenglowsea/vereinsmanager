@echo off
:: ==========================================================
::  Hilfsskript. Wird von start-windows.bat aufgerufen und
::  nicht von Hand gestartet.
::
::  Aufgabe: warten, bis der Server antwortet, und dann den
::  Browser oeffnen. Der Server braucht beim allerersten Start
::  einen Moment, weil Vite die Oberflaeche erst uebersetzen muss.
:: ==========================================================
setlocal
cd /d "%~dp0"

for /l %%v in (1,1,100) do (
    powershell -NoProfile -Command "try { Invoke-WebRequest -Uri 'http://localhost:3000' -UseBasicParsing -TimeoutSec 1 | Out-Null; exit 0 } catch { exit 1 }"
    if not errorlevel 1 goto :bereit
    powershell -NoProfile -Command "Start-Sleep -Milliseconds 300" >nul
)

:bereit
start "" "http://localhost:3000"
endlocal
