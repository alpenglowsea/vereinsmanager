# ==========================================================
#  Dockerfile für den VereinsManager
#
#  Der Container startet den Express-Server aus server.ts. Dieser
#  liefert die Oberfläche aus UND beantwortet die /api/-Aufrufe:
#  Belegerkennung, Buchungsvorschläge, Protokollauswertung,
#  E-Mail-Versand, SMTP-Test und Fehlermeldungen.
#
#  Die frühere Fassung hat nur die fertige Oberfläche mit einem
#  nginx ausgeliefert. Das Backend war gar nicht im Image. Jeder
#  /api/-Aufruf bekam die HTML-Startseite zurück, und die Funktionen
#  scheiterten mit einer Meldung, aus der niemand schließen konnte,
#  woran es liegt. Deshalb ist nginx hier nicht mehr beteiligt.
#
#  Zwei Stufen:
#    1. builder – installiert alles und baut Oberfläche + Backend
#    2. runtime – enthält nur noch das Gebaute und Node.js
# ==========================================================


# ----------------------------------------------------------
#  1. Bauen
# ----------------------------------------------------------
# node:24 ist die aktuelle Fassung mit Langzeitunterstützung.
# Vorher stand hier node:20, das seit April 2026 keine
# Sicherheitsupdates mehr bekommt.
FROM node:24-alpine AS builder

WORKDIR /app

# Erst nur die beiden Paketlisten kopieren. Solange sich daran
# nichts ändert, überspringt Docker beim nächsten Bauen die
# Installation und greift auf den Zwischenstand zurück.
COPY package.json package-lock.json ./

# "npm ci" installiert exakt die Fassungen aus package-lock.json —
# im Gegensatz zu "npm install", das auch neuere nehmen dürfte.
RUN npm ci

COPY . .

# Alles mit VITE_-Präfix wird beim Bauen fest in das JavaScript für
# den Browser hineingeschrieben. Diese Werte müssen deshalb JETZT
# da sein. Sie später dem fertigen Container als Umgebungsvariable
# mitzugeben, hat keinerlei Wirkung — genau das stand vorher in der
# docker-compose.yml. Wer den Cloud-Modus nicht nutzt, lässt sie leer
# und trägt die Supabase-Daten stattdessen in der App unter
# Einstellungen → Cloud-Synchronisation ein.
ARG VITE_SUPABASE_URL=""
ARG VITE_SUPABASE_ANON_KEY=""
ARG VITE_DEPLOYMENT_MODE="local"
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL \
    VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY \
    VITE_DEPLOYMENT_MODE=$VITE_DEPLOYMENT_MODE

# Erzeugt dist/ (Oberfläche) und dist/server.cjs (Backend).
RUN npm run build


# ----------------------------------------------------------
#  2. Betreiben
# ----------------------------------------------------------
FROM node:24-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY package.json package-lock.json ./

# --omit=dev installiert nur die "dependencies" aus der package.json,
# nicht die "devDependencies". Übrig bleiben die fünf Pakete, die der
# Server im Betrieb wirklich lädt: express, compression, dotenv,
# nodemailer und @google/genai. Alles rund um die Oberfläche (React,
# Tailwind, jspdf, lucide-react …) wurde in Stufe 1 bereits zu
# fertigem JavaScript in dist/ verarbeitet und wird hier nicht mehr
# gebraucht.
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist

# Verzeichnis für die Konfiguration dieser Installation: die
# SMTP-Zugangsdaten und der Schlüssel, mit dem das Passwort darin
# verschlüsselt ist (siehe src/server/instanceConfig.ts).
#
# Es muss SCHON IM IMAGE liegen und dem Benutzer "node" gehören. Grund:
# Hängt Docker beim ersten Start ein Volume an diese Stelle, übernimmt
# es Rechte und Eigentümer von dem Verzeichnis, das im Image darunter
# liegt. Fehlt es hier, legt Docker eines an, das dem Administrator
# gehört — der Server läuft aber als "node" und könnte dann nichts
# hineinschreiben. Die Zugangsdaten ließen sich nicht speichern.
RUN mkdir -p /app/daten && chown node:node /app/daten
ENV VM_DATA_DIR=/app/daten

# Nicht als Administrator laufen lassen: Sollte jemand eine Lücke im
# Server finden, hat er dann nur die Rechte eines normalen Benutzers.
# Der Benutzer "node" ist im offiziellen Image bereits angelegt.
USER node

EXPOSE 3000

# Docker fragt regelmäßig die Statusseite ab. Antwortet sie nicht
# mehr, meldet der Container sich als "unhealthy" — und mit
# "restart: unless-stopped" startet er neu, statt still auszufallen.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/server.cjs"]
