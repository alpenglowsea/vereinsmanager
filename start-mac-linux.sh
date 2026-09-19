#!/usr/bin/env bash

set -e

echo "========================================================"
echo "  VereinsManager • Revisionssichere Vereinsverwaltung   "
echo "========================================================"
echo ""

# 1. Prüfen, ob Node.js installiert ist
if ! command -v node &> /dev/null; then
    echo "[!] Node.js wurde nicht gefunden."
    echo "Bitte installieren Sie Node.js (LTS Version): https://nodejs.org"
    exit 1
fi

# 2. Prüfen, ob node_modules existiert
if [ ! -d "node_modules" ]; then
    echo "[*] Installiere Pakete (npm install)..."
    npm install
fi

# 3. Browser öffnen, sobald der Server bereit ist
#
# Neu seit Fassung 1.3: Der Server beantwortet keine /api-Anfrage mehr ohne
# Zugriffsschlüssel. Diesen erzeugt er beim ersten Start selbst und legt ihn in
# daten/konfiguration.json ab. Damit im Lokalbetrieb niemand etwas abtippen
# muss, wird er hier ausgelesen und an die Adresse angehängt, die im Browser
# geöffnet wird. Die App merkt ihn sich und entfernt ihn wieder aus der
# Adresszeile.
#
# Alles hinter dem Rautezeichen schickt der Browser NICHT an den Server; der
# Schlüssel landet also in keinem Serverprotokoll.
echo "[*] Starte VereinsManager auf http://localhost:3000 ..."

oeffne_browser() {
    if [[ "$OSTYPE" == "darwin"* ]]; then
        open "$1"
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        xdg-open "$1" 2>/dev/null || true
    fi
}

(
    schluessel=""

    # Wurde ein eigener Schlüssel vorgegeben, steht er nicht in der
    # Konfigurationsdatei — dann gilt dieser.
    if [ -n "$VM_ACCESS_KEY" ]; then
        schluessel="$VM_ACCESS_KEY"
    elif [ -f ".env" ]; then
        schluessel=$(sed -n 's/^[[:space:]]*VM_ACCESS_KEY[[:space:]]*=[[:space:]]*//p' .env | tail -n 1 | tr -d "\"'")
    fi

    # Sonst warten, bis der Server die Konfigurationsdatei geschrieben hat.
    # Beim allerersten Start dauert das einen Moment länger, weil Vite die
    # Oberfläche erst übersetzen muss.
    if [ -z "$schluessel" ]; then
        for _versuch in $(seq 1 100); do
            if [ -f "daten/konfiguration.json" ]; then
                schluessel=$(sed -n 's/.*"accessKey"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' daten/konfiguration.json)
                [ -n "$schluessel" ] && break
            fi
            sleep 0.3
        done
    fi

    if [ -n "$schluessel" ]; then
        oeffne_browser "http://localhost:3000/#zugriff=$schluessel"
    else
        echo ""
        echo "[!] Der Zugriffsschlüssel des Servers konnte nicht gelesen werden."
        echo "    Die App startet trotzdem. E-Mail-Versand, Belegerkennung und"
        echo "    KI-Funktionen bleiben aber gesperrt. Der Schlüssel steht in der"
        echo "    Ausgabe dieses Fensters und lässt sich in der App unter"
        echo "    Einstellungen -> Allgemein eintragen."
        echo ""
        oeffne_browser "http://localhost:3000"
    fi
) &

npm run dev
