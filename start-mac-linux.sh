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
# Der Server braucht ein paar Sekunden, bis er antwortet (Vite übersetzt die
# Oberfläche beim allerersten Start). Deshalb kurz warten, statt den Browser
# sofort auf eine noch tote Adresse zu öffnen.
echo "[*] Starte VereinsManager auf http://localhost:3000 ..."

oeffne_browser() {
    if [[ "$OSTYPE" == "darwin"* ]]; then
        open "$1"
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        xdg-open "$1" 2>/dev/null || true
    fi
}

(
    for _versuch in $(seq 1 100); do
        if curl --silent --fail --output /dev/null "http://localhost:3000"; then
            break
        fi
        sleep 0.3
    done
    oeffne_browser "http://localhost:3000"
) &

npm run dev
