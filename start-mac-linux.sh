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

# 3. Browser öffnen (Plattform-unabhängig)
echo "[*] Starte VereinsManager auf http://localhost:3000 ..."

if [[ "$OSTYPE" == "darwin"* ]]; then
    (sleep 2 && open http://localhost:3000) &
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    (sleep 2 && xdg-open http://localhost:3000 2>/dev/null || true) &
fi

npm run dev
