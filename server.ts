import express from "express";
import compression from "compression";
import path from "path";
import fs from "node:fs";
import crypto from "node:crypto";
import { RateLimiter } from "./src/utils/rateLimit";
import {
  readSmtpConfigPublic,
  readSmtpCredentials,
  writeSmtpConfig,
  deleteSmtpConfig,
  readAccessKey,
  readAiConfigPublic,
  readAiCredentials,
  readAiZugangFuerTest,
  writeAiConfig,
  deleteAiConfig,
  type AiProvider,
} from "./src/server/instanceConfig";
import {
  ZUGRIFF_HEADER,
  pruefeZugriff,
  erstelleCloudPruefer,
} from "./src/server/apiAuth";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import nodemailer from "nodemailer";

dotenv.config();

const app = express();
// Port aus der Umgebung übernehmen (z. B. in Docker oder hinter einem
// Reverse-Proxy), sonst 3000 als Standard.
const PORT = Number(process.env.PORT) || 3000;

// Auf welcher Netzwerkadresse gelauscht wird.
//
// "0.0.0.0" heißt: auf allen — der Server ist dann aus dem ganzen Netzwerk
// erreichbar. Für Docker und den NAS-Betrieb ist das richtig und nötig, denn
// dort greifen andere Rechner zu.
//
// Die Desktop-Fassung setzt dagegen VM_HOST=127.0.0.1. Dann nimmt der Server
// ausschließlich Anfragen vom eigenen Rechner an. Er gehört dort allein dem
// Programm, das ihn gestartet hat; im WLAN eines Vereinsheims hat er nichts
// zu suchen. Der Zugriffsschlüssel würde Fremde zwar abweisen — besser ist
// aber, wenn ihre Anfragen gar nicht erst ankommen.
const HOST = process.env.VM_HOST || "0.0.0.0";

// Lauscht der Server nur auf dem eigenen Rechner, kann außer dem Programm,
// das ihn gestartet hat, niemand mit ihm sprechen. Nur dann gibt er den
// Zugriffsschlüssel in der Bereitschaftsmeldung mit aus (siehe
// starteLauscher). Bei "0.0.0.0" unterbleibt das: Dort landete er in
// Docker-Protokollen, die durchaus anderswo aufbewahrt werden.
const NUR_EIGENER_RECHNER =
  HOST === "127.0.0.1" || HOST === "localhost" || HOST === "::1";

// Hinter einem Reverse-Proxy (Traefik, nginx, Synology-Portalanmeldung)
// steht die Adresse des Besuchers im Kopf "X-Forwarded-For"; ohne diese
// Zeile sähe der Server nur immer wieder die Adresse des Proxys. Die "1"
// bedeutet: genau einem vorgelagerten Proxy wird geglaubt. Das wird für
// die geplante Ratenbegrenzung des öffentlichen Aufnahmeformulars
// gebraucht — sonst würde entweder jeder oder niemand ausgebremst.
app.set("trust proxy", 1);

// Antworten unterwegs komprimieren. Das fertige Browser-Bundle ist
// mehrere Megabyte groß und schrumpft dabei auf etwa ein Drittel. Früher
// hat das der nginx im Container übernommen, den es nicht mehr gibt.
app.use(compression());

// Sicherheitskopfzeilen für alle Antworten.
app.use((_req, res, next) => {
  // Keine geratenen Dateitypen: Eine hochgeladene Datei, die wie ein
  // Bild aussieht, darf nicht als Skript ausgeführt werden.
  res.setHeader("X-Content-Type-Options", "nosniff");
  // Nicht in fremde Seiten einbetten lassen (Schutz vor Clickjacking).
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  // Beim Klick auf einen Link nach außen nicht die vollständige
  // aufgerufene Adresse mitgeben — die kann Mitgliedsnummern enthalten.
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  next();
});

// ---------------------------------------------------------------------------
// Ratenbegrenzung
// ---------------------------------------------------------------------------
//
// Keiner der /api-Endpunkte verlangt eine Anmeldung. Stellt ein Verein
// seinen Server ins Internet, kann ihn jeder aufrufen, der die Adresse
// kennt. Drei Stufen, nach dem, was ein Missbrauch jeweils kostet:
//
//   allgemein — schützt den Server davor, unter Last zusammenzubrechen
//   teuer     — KI-Aufrufe. Jeder einzelne kostet den Verein bares Geld
//               über seinen API-Schlüssel.
//   post      — E-Mail-Versand. Missbrauch bedeutet hier, dass im Namen
//               des Vereins Nachrichten verschickt werden. Das kostet
//               nicht nur Geld, sondern den Ruf der Absenderadresse.
//
// Die Zahlen sind so gewählt, dass normale Arbeit nicht auffällt: Wer
// zwanzig Belege hintereinander einscannt, bleibt unter 30 je Stunde.
const MINUTE = 60_000;
const STUNDE = 60 * MINUTE;

const bremseAllgemein = new RateLimiter({ limit: 120, windowMs: 5 * MINUTE });
const bremseTeuer     = new RateLimiter({ limit: 30,  windowMs: STUNDE });
const bremsePost      = new RateLimiter({ limit: 20,  windowMs: STUNDE });
const bremseMeldung   = new RateLimiter({ limit: 5,   windowMs: STUNDE });

// Die Kennung des Absenders. Hinter einem Reverse-Proxy liefert
// req.ip dank "trust proxy" oben die echte Adresse des Aufrufers.
// Sie wird nur im Arbeitsspeicher gezählt und nirgends gespeichert.
const absender = (req: express.Request): string => req.ip || "unbekannt";

const bremse =
  (limiter: RateLimiter, was: string) =>
  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const ergebnis = limiter.check(absender(req));
    if (ergebnis.allowed) {
      next();
      return;
    }
    res.setHeader("Retry-After", String(ergebnis.retryAfterSeconds));
    // 429 ist der dafür vorgesehene Statuscode. Wichtig, dass es nicht 500
    // ist: Sonst hielte der Betreiber eine wirksame Bremse für einen Defekt.
    res.status(429).json({
      success: false,
      error: `Zu viele Anfragen (${was}). Bitte in ${Math.ceil(
        ergebnis.retryAfterSeconds / 60
      )} Minute(n) noch einmal versuchen.`,
      retryAfterSeconds: ergebnis.retryAfterSeconds,
    });
  };

// Gilt für alles unter /api. Die Statusseite ist ausgenommen: Docker fragt
// sie alle 30 Sekunden ab, und eine Bremse, die den eigenen Healthcheck
// aussperrt, würde den Container in eine Neustartschleife schicken.
app.use("/api", (req, res, next) => {
  if (req.path === "/health") {
    next();
    return;
  }
  bremse(bremseAllgemein, "allgemein")(req, res, next);
});

// ---------------------------------------------------------------------------
// Zugriffsschutz
// ---------------------------------------------------------------------------
//
// Steht vor dem Einlesen des Anfragekörpers: Ein fremder Aufruf soll nicht
// erst 50 MB Anhang hochladen dürfen, bevor er abgewiesen wird.
//
// Die Statusseite bleibt offen — Docker fragt sie alle 30 Sekunden ab und
// kann keinen Schlüssel mitschicken. Sie verrät nichts außer "Server läuft".
//
// Einzelheiten zu den zwei anerkannten Ausweisen: src/server/apiAuth.ts

const zugriffsschluessel = (() => {
  try {
    return readAccessKey();
  } catch (fehler) {
    // Lässt sich der Schlüssel nicht ablegen (etwa weil das Datenverzeichnis
    // nicht beschreibbar ist), läuft der Server mit einem flüchtigen weiter,
    // statt gar nicht zu starten. Er ändert sich dann bei jedem Neustart.
    console.error(
      "Der Zugriffsschlüssel konnte nicht gespeichert werden. Der Server " +
        "arbeitet mit einem flüchtigen Schlüssel weiter, der sich bei jedem " +
        "Neustart ändert. Abhilfe: VM_ACCESS_KEY setzen oder dafür sorgen, " +
        "dass das Verzeichnis aus VM_DATA_DIR beschreibbar ist.",
      fehler
    );
    return {
      key: crypto.randomBytes(16).toString("hex"),
      quelle: "datei" as const,
      neuErzeugt: true,
    };
  }
})();

// Für die Prüfung von Supabase-Anmeldetoken braucht der Server eigene Werte.
// Die VITE_-Variablen helfen hier nicht: Die werden beim Bauen in das
// Browser-JavaScript geschrieben und existieren im Serverprozess nicht.
const cloudPruefer = erstelleCloudPruefer(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

app.use("/api", (req, res, next) => {
  if (req.path === "/health") {
    next();
    return;
  }

  pruefeZugriff(
    {
      zugriffsschluessel: req.headers[ZUGRIFF_HEADER],
      authorization: req.headers.authorization,
    },
    zugriffsschluessel.key,
    cloudPruefer
  )
    .then((ergebnis) => {
      if (ergebnis.erlaubt) {
        next();
        return;
      }
      // Der Statuscode bleibt für alle Ablehnungen 401. Der genaue Fall steht
      // im "code": Nur bei ZUGRIFF_VERWEIGERT fragt die Oberfläche nach dem
      // Zugriffsschlüssel — bei "nicht freigeschaltet" oder "Supabase nicht
      // erreichbar" wäre diese Nachfrage ein Irrweg, weil kein Schlüssel der
      // Welt das Problem löst. Dort zeigt sie nur den Text an.
      res.status(401).json({
        success: false,
        error: ergebnis.grund,
        code: ergebnis.code || "ZUGRIFF_VERWEIGERT",
      });
    })
    .catch(next);
});

// Body parser for JSON and large payloads (PDF / Image Base64)
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

/**
 * Der KI-Schlüssel kommt ausschließlich von diesem Server.
 * ---------------------------------------------------------------------------
 *
 * Früher schickte die Oberfläche ihn bei jedem Aufruf mit (`userApiKey`), weil
 * sie ihn selbst im Browser vorrätig hielt. Genau das ist der Grund, warum er
 * in jeder Datensicherung stand. Seit Fassung 0.9 liegt er verschlüsselt in
 * der Serverkonfiguration (src/server/instanceConfig.ts); ein Schlüssel im
 * Anfragekörper wird nicht mehr angenommen.
 *
 * Google Gemini ist der einzige Anbieter. Es war zwischenzeitlich mehr als
 * einer, und das hat sich nicht bewährt — die Begründung steht in
 * src/server/instanceConfig.ts beim Typ AiProvider.
 *
 * Ist kein Schlüssel hinterlegt, greift ersatzweise GEMINI_API_KEY aus der
 * Umgebung; fehlt auch der, sagt die Fehlermeldung genau das.
 */
const KEIN_GEMINI_SCHLUESSEL =
  "Für diese Funktion wird ein Google-Gemini-Schlüssel gebraucht. Bitte in den " +
  "Einstellungen unter KI einen Gemini-Schlüssel hinterlegen (oder auf dem Server " +
  "GEMINI_API_KEY setzen).";

const KI_NICHT_FREIGEGEBEN =
  "Die KI-Funktionen sind nicht freigegeben. Bei jedem Aufruf verlassen Daten des " +
  "Vereins das Haus, deshalb muss ein Vorstandsmitglied die Nutzung zuerst " +
  "ausdrücklich erlauben: Einstellungen → Allgemein → KI-Assistent.";

function geminiSchluessel(): string {
  const zugang = readAiCredentials();
  if (zugang?.provider === "gemini" && zugang.apiKey) return zugang.apiKey;
  // Die Umgebungsvariable ist ein Weg für den Docker-Betrieb, kein Weg an der
  // Freigabe vorbei. Ohne Freigabe liefert readAiCredentials() null — dann
  // darf auch GEMINI_API_KEY nicht greifen.
  if (!readAiConfigPublic().aktiviert) return "";
  return process.env.GEMINI_API_KEY?.trim() || "";
}

// Der Zugang wird zwischengespeichert, aber am Schlüssel festgemacht: Wird in
// den Einstellungen ein neuer eingetragen, greift er sofort. Ein Zwischen-
// speicher ohne diesen Vergleich arbeitete bis zum Neustart mit dem alten.
let geminiZwischenspeicher: { schluessel: string; client: GoogleGenAI } | null = null;

function baueGeminiClient(apiKey: string): GoogleGenAI {
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

function getGeminiClient(): GoogleGenAI {
  // Die Reihenfolge der Prüfungen entscheidet über die Verständlichkeit:
  // "nicht freigegeben" und "kein Schlüssel" sind zwei verschiedene Zustände
  // und brauchen zwei verschiedene Sätze. Eine gemeinsame Meldung schickte
  // den Anwender an die falsche Stelle.
  if (!readAiConfigPublic().aktiviert) {
    throw new Error(KI_NICHT_FREIGEGEBEN);
  }
  const apiKey = geminiSchluessel();
  if (!apiKey) {
    throw new Error(KEIN_GEMINI_SCHLUESSEL);
  }
  if (geminiZwischenspeicher?.schluessel === apiKey) {
    return geminiZwischenspeicher.client;
  }
  const client = baueGeminiClient(apiKey);
  geminiZwischenspeicher = { schluessel: apiKey, client };
  return client;
}

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    // Die Statusseite ist bewusst ohne Ausweis erreichbar (Docker fragt sie
    // regelmäßig ab). Sie darf deshalb nur verraten, OB ein Schlüssel da ist.
    hasGeminiKey: Boolean(geminiSchluessel()),
    aiEinsatzbereit: readAiConfigPublic().einsatzbereit,
    timestamp: new Date().toISOString(),
  });
});

/**
 * POST /api/submit-bugreport
 * Directly submits a bug report / support ticket to vereinsmanager@ik.me without needing an external mail program.
 */
app.post("/api/submit-bugreport", bremse(bremseMeldung, "Fehlermeldung"), async (req, res) => {
  try {
    const {
      subject,
      area,
      description,
      severity,
      contactName,
      contactEmail,
      appVersion,
      deploymentMode,
      clientDetails,
    } = req.body;

    if (!subject || !description) {
      return res.status(400).json({
        success: false,
        error: "Betreff und Problembeschreibung sind Pflichtfelder.",
      });
    }

    const ticketId = `VM-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const timestamp = new Date().toLocaleString("de-DE", { timeZone: "Europe/Berlin" });

    const severityLabels: Record<string, string> = {
      low: "Niedrig (Kosmetisch / Tippfehler)",
      normal: "Normal (Funktion fehlerhaft)",
      high: "Hoch (Wichtige Funktion blockiert)",
      critical: "Kritisch (Datenverlust / Absturz)",
    };

    const payload = {
      _subject: `[VereinsManager #${ticketId} - ${area || "Allgemein"}] ${subject.trim()}`,
      _template: "table",
      _captcha: "false",
      Ticket_ID: ticketId,
      Bereich: area || "Nicht angegeben",
      Betreff: subject.trim(),
      Schweregrad: severityLabels[severity] || severity || "Normal",
      Beschreibung: description.trim(),
      Absender_Name: contactName?.trim() || "Anonym / Nicht angegeben",
      Absender_Email: contactEmail?.trim() || "Keine Rückmelde-E-Mail angegeben",
      App_Version: appVersion || "v1.2.4",
      Betriebsmodus: deploymentMode || "Lokal",
      System_Info: clientDetails || "Keine",
      Eingangszeit: timestamp,
    };

    console.log(`[Bugreport #${ticketId}] Neuer Fehlerbericht eingegangen:`, {
      subject,
      area,
      severity,
      contactEmail,
    });

    let sentSuccessfully = false;

    // Attempt direct email delivery via FormSubmit HTTP API to vereinsmanager@ik.me
    try {
      const response = await fetch("https://formsubmit.co/ajax/vereinsmanager@ik.me", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        sentSuccessfully = true;
      } else {
        const text = await response.text();
        console.warn(`[Bugreport #${ticketId}] FormSubmit returned status ${response.status}:`, text);
      }
    } catch (deliveryError: any) {
      console.warn(`[Bugreport #${ticketId}] Direct email relay failed:`, deliveryError?.message || deliveryError);
    }

    return res.json({
      success: true,
      ticketId,
      sentTo: "vereinsmanager@ik.me",
      timestamp,
      deliveredDirectly: sentSuccessfully,
      message: sentSuccessfully
        ? `Ihr Fehlerbericht wurde erfolgreich direkt an vereinsmanager@ik.me übermittelt!`
        : `Ihr Fehlerbericht wurde im System mit Ticket #${ticketId} erfasst und vorbereitet.`,
    });
  } catch (error: any) {
    console.error("Fehler beim Übermitteln des Bugreports:", error);
    return res.status(500).json({
      success: false,
      error: error?.message || "Fehler beim Versenden des Fehlerberichts.",
    });
  }
});

/**
 * POST /api/test-ai-key
 *
 * Prüft, ob sich mit den KI-Zugangsdaten tatsächlich etwas anfangen lässt.
 * Unterstützt Google Gemini, OpenAI, Anthropic Claude und eigene Adressen
 * (Ollama, Groq, OpenRouter und alles andere, was die OpenAI-Schnittstelle
 * nachbildet).
 *
 * Dies ist der EINZIGE Endpunkt, der noch einen Schlüssel im Anfragekörper
 * annimmt — und das mit gutem Grund: Wer in den Einstellungen einen neuen
 * Schlüssel eintippt, soll ihn ausprobieren können, BEVOR er gespeichert wird.
 * Ohne diesen Weg müsste man erst einen womöglich falschen Schlüssel ablegen.
 *
 * Bleibt das Feld leer, wird der hinterlegte geprüft. Das ist der Normalfall
 * beim Knopf "Verbindung testen" an einer bereits eingerichteten Installation:
 * Die Oberfläche kennt den Schlüssel dann gar nicht und kann ihn nicht senden.
 */
app.post(["/api/test-ai-key", "/api/test-gemini-key"], bremse(bremseTeuer, "KI"), async (req, res) => {
  try {
    // Bewusst der ungesperrte Zugang: Der Test schickt "Antworte mit OK" und
    // sonst nichts. Er muss möglich sein, BEVOR jemand die Nutzung freigibt —
    // sonst müsste man erst erlauben, um herauszufinden, ob der Schlüssel
    // überhaupt stimmt.
    const hinterlegt = readAiZugangFuerTest();
    const koerper = req.body || {};

    // Ein im Körper mitgeschickter Schlüssel hat Vorrang: Genau dafür ist
    // dieser Endpunkt da. Ist das Feld leer, gilt der hinterlegte.
    const apiKey: string = (koerper.apiKey ?? "").trim() || hinterlegt?.apiKey || "";

    const geminiKey = apiKey || process.env.GEMINI_API_KEY?.trim() || "";
    if (!geminiKey) {
      return res.status(400).json({ success: false, error: "Kein Gemini API-Schlüssel angegeben." });
    }
    // Bewusst ohne den Zwischenspeicher: Hier wird ein Schlüssel geprüft, der
    // noch gar nicht gespeichert ist. Er darf den laufenden Betrieb nicht
    // beeinflussen — weder beim Gelingen noch beim Scheitern.
    const client = baueGeminiClient(geminiKey);
    const testModels = ["gemini-3.6-flash", "gemini-3.7-flash", "gemini-flash-latest", "gemini-2.5-flash"];
    let testResponse: any = null;
    let lastErr: any = null;
    for (const m of testModels) {
      try {
        testResponse = await client.models.generateContent({
          model: m,
          contents: "Antworte kurz mit 'OK'.",
        });
        if (testResponse?.text) break;
      } catch (err: any) {
        lastErr = err;
      }
    }
    if (!testResponse?.text && lastErr) {
      throw lastErr;
    }
    return res.json({
      success: true,
      message: "Verbindung zu Google Gemini erfolgreich hergestellt.",
      sampleResponse: testResponse?.text?.trim() || "OK",
    });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      error: error?.message || "Ungültiger oder abgelaufener API-Schlüssel.",
    });
  }
});

/**
 * POST /api/categorize-booking
 * Intelligent categorization of transactions according to German Non-Profit Tax Law (§§ 51 ff. AO)
 * and DATEV Standardkontenrahmen für Vereine (SKR 42).
 */
app.post("/api/categorize-booking", bremse(bremseTeuer, "KI"), async (req, res) => {
  try {
    const { description, bookingText, partner, amount, type } = req.body;

    // Schlüssel und Modell holt sich getGeminiClient() selbst aus der
    // Serverkonfiguration. Früher schickte die Oberfläche sie mit — dafür
    // musste sie den Schlüssel im Browser vorrätig halten.

    const queryText = (description || bookingText || "").trim();
    if (!queryText && !partner) {
      return res.status(400).json({
        success: false,
        error: "Bitte geben Sie eine kurze Beschreibung oder einen Buchungstext an.",
      });
    }

    const prompt = `Du bist ein hochqualifizierter Steuer- und Buchhaltungsexperte für deutsches Gemeinnützigkeits- und Vereinssteuerrecht (§§ 51 ff. Abgabenordnung - AO) sowie den DATEV Standardkontenrahmen 42 (SKR 42 für Vereine, Stiftungen & gGmbHs).

Analysiere den folgenden Geschäftsvorfall eines gemeinnützigen Sport- und Kulturvereins und ordne ihn präzise zu:

BUCHUNGSDATEN:
- Beschreibung / Erklärung des Vorfalls: "${queryText}"
- Zahlungspartner / Empfänger / Absender: "${partner || 'Nicht angegeben'}"
- Betrag: ${amount ? `${amount} EUR` : 'Nicht angegeben'}
- Vorausgewählte Buchungsart: ${type || 'automatisch erkennen'}

REGELWERK DER 4 STEUERLICHEN SPHÄREN (DATEV SKR 42 - 5-stellig):
1. "ideell" (Ideeller Bereich - Satzungsgemäße Kernaktivitäten, steuerfrei, 0% USt):
   - Einnahmen: Mitgliedsbeiträge (40000), Spenden/Zuwendungen (40400/40450), Zuschüsse/Fördermittel (40700), Bußgelder/sonstiges (40800)
   - Ausgaben: Verbandsabgaben/LSB (66100), Verwaltung/Büro/IT/Bank/Versicherung (68000), Satzungsgemäße Förderung (50000)
2. "vermoegen" (Vermögensverwaltung - Fruchtziehung aus Vermögen, ertragssteuerfrei, 0% USt):
   - Einnahmen: Miete & Pacht Vereinsheim/Gaststätte (46100), Zinsen & Kapitalerträge (47000)
   - Ausgaben: Bewirtschaftung & Erhaltung vermietetes Vermögen (62150)
3. "zweckbetrieb" (Zweckbetrieb - Wirtschaftliche Betätigung zur Zweckerreichung gem. §§ 65-68 AO, steuerbegünstigt, i.d.R. 7% USt oder 0% Vorsteuer):
   - Einnahmen: Eintrittsgelder Sport (41100), Kurse & Lehrgänge (41200), Startgelder (41300), Sportartikel Selbstkosten (41400)
   - Ausgaben: Übungsleiterpauschale § 3 Nr. 26 EStG (60040), Ehrenamtspauschale (60020), Sportstätten & Hallenmieten (62100), Reisekosten Sport (63100), Sportgeräte/Bälle/Trikots (65100), Startgelder (66150)
4. "wirtschaftlich" (Wirtschaftlicher Geschäftsbetrieb - Voll steuerpflichtig, Wettbewerb, 19% USt):
   - Einnahmen: Kiosk & Bewirtung (43100/43200), Bandenwerbung/Sponsoring (44100), Merchandising (45100)
   - Ausgaben: Wareneinkauf Speisen & Getränke (51000/51100), Werbeaufwand (67100), Steuern wirtschaftlicher Betrieb (73100)

AUFGABE:
Gib ausschließlich valides JSON mit diesem Format aus:
{
  "sphere": "ideell" | "vermoegen" | "zweckbetrieb" | "wirtschaftlich",
  "type": "income" | "expense",
  "mainCategoryCode": "65000",
  "mainCategoryName": "Spielbetrieb, Sportgeräte & Trikots",
  "subCategoryCode": "65100",
  "subCategoryName": "Sportgeräte & Trainingsmaterial",
  "subCategoryLabel": "65100 - Sportgeräte & Trainingsmaterial",
  "vatRate": 0 | 7 | 19,
  "suggestedBookingText": "Prägnanter Buchungstext",
  "confidence": 0.95,
  "reasoning": "Kurze 1-2 Satz Begründung nach Gemeinnützigkeitsrecht"
}`;

    const ai = getGeminiClient();

    const schemaConfig = {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          sphere: {
            type: Type.STRING,
            enum: ["ideell", "vermoegen", "zweckbetrieb", "wirtschaftlich"],
          },
          type: {
            type: Type.STRING,
            enum: ["income", "expense"],
          },
          mainCategoryCode: { type: Type.STRING },
          mainCategoryName: { type: Type.STRING },
          subCategoryCode: { type: Type.STRING },
          subCategoryName: { type: Type.STRING },
          subCategoryLabel: { type: Type.STRING },
          // Gemini akzeptiert bei "enum" ausschliesslich Zeichenketten, auch
          // wenn "type" etwas anderes sagt (INTEGER, NUMBER, BOOLEAN). Ein
          // enum aus Zahlen wie [0, 7, 19] weist die Anfrage mit 400
          // INVALID_ARGUMENT zurueck: "Invalid value ... (TYPE_STRING), 0".
          // Diese Einschraenkung steht in keiner Anleitung, ist aber
          // wiederholt dokumentiert, u. a. hier:
          // https://github.com/anomalyco/opencode/issues/12784
          // Deshalb hier Zeichenketten anfordern und nach dem Einlesen der
          // Antwort zurueck in eine Zahl wandeln (siehe unten).
          vatRate: { type: Type.STRING, enum: ["0", "7", "19"] },
          suggestedBookingText: { type: Type.STRING },
          confidence: { type: Type.NUMBER },
          reasoning: { type: Type.STRING },
        },
        required: ["sphere", "type", "subCategoryCode", "subCategoryLabel", "vatRate", "reasoning"],
      },
    };

    const candidateModels = ["gemini-3.6-flash", "gemini-3.7-flash", "gemini-flash-latest", "gemini-2.5-flash", "gemini-3.1-flash-lite"];
    let response: any = null;
    let lastError: any = null;

    for (const model of candidateModels) {
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          response = await ai.models.generateContent({
            model,
            contents: prompt,
            config: schemaConfig,
          });
          if (response?.text) {
            break;
          }
        } catch (err: any) {
          lastError = err;
          console.warn(`Attempt ${attempt} with model ${model} failed for categorize-booking:`, err?.message || err);
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }
      if (response?.text) {
        break;
      }
    }

    if (!response || !response.text) {
      throw lastError || new Error("Keine Antwort vom KI-Dienst erhalten.");
    }

    const parsedData = JSON.parse(response.text || "{}");
    // vatRate kam wegen der Gemini-Einschraenkung oben als Zeichenkette
    // zurueck ("7" statt 7). Die Oberfläche erwartet weiterhin eine Zahl —
    // sie rechnet damit (z. B. Umsatzsteuer aus dem Betrag).
    if (typeof parsedData.vatRate === "string") {
      const alsZahl = Number(parsedData.vatRate);
      if (Number.isFinite(alsZahl)) parsedData.vatRate = alsZahl;
    }
    return res.json({
      success: true,
      data: parsedData,
    });
  } catch (error: any) {
    console.error("Fehler bei der KI-Buchungskategorisierung:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Die Buchung konnte nicht durch die KI analysiert werden.",
    });
  }
});

/**
 * POST /api/scan-application-pdf
 * Analyzes a scanned / photographed / digital membership application (PDF or image)
 * and extracts all form fields, signatures, and checkboxes using Gemini 3.7 Flash multimodal vision.
 */
app.post("/api/scan-application-pdf", bremse(bremseTeuer, "KI"), async (req, res) => {
  try {
    const { fileDataUrl, mimeType, fileName } = req.body;


    if (!fileDataUrl) {
      return res.status(400).json({ error: "Keine Datei (fileDataUrl) übermittelt." });
    }

    // Extract base64 part
    const commaIndex = fileDataUrl.indexOf(",");
    const base64Data = commaIndex !== -1 ? fileDataUrl.substring(commaIndex + 1) : fileDataUrl;
    const detectedMimeType = mimeType || (fileDataUrl.startsWith("data:") ? fileDataUrl.substring(5, fileDataUrl.indexOf(";")) : "application/pdf");

    // Initialize Gemini with optional user API key

    const prompt = `Du bist ein hochpräziser KI-Dokumenten-Parser für deutsche Vereins-Mitgliedsanträge und Aufnahmeformulare (sowohl handschriftlich ausgefüllt, gedruckt als auch digital ausgefüllt).

Analysiere das beigefügte Dokument akribisch und extrahiere alle relevanten Daten für die Vereinsmitgliederverwaltung.

Extrahiere:
1. Vorname und Nachname des Antragstellers
2. Geschlecht ('m', 'w', 'd' oder 'none')
3. Geburtsdatum im Format YYYY-MM-DD (falls erkennbar)
4. Vollständige Anschrift: Straße, Hausnummer, Postleitzahl (PLZ, 5-stellig), Ort/Stadt, Land (Standard 'Deutschland')
5. Kontaktdaten: Telefon / Mobilnummer, E-Mail-Adresse
6. Gewünschte Sparte / Sportart / Abteilung (z.B. Fußball, Tennis, Turnen, Gymnastik, Schwimmen, etc.)
7. Gewünschtes Eintrittsdatum im Format YYYY-MM-DD (falls nicht angegeben, heutiges Datum oder leer)
8. Mitgliedsart ('full' für Vollzahler/Erwachsener, 'reduced' für Ermäßigt/Student/Rentner, 'youth' für Jugend/Kind, 'family' für Familie, 'supporting' für Förderer)
9. Beitragsintervall ('monthly', 'quarterly', 'half_yearly', 'yearly')
10. Beitragshöhe als Zahl (Euro), falls auf dem Formular vermerkt
11. Zahlungsart: 'sepa' (Lastschrift), 'transfer' (Überweisung), 'cash' (Bar)
12. Bankverbindung & SEPA-Lastschriftmandat:
    - IBAN (ohne Leerzeichen, z.B. DE...)
    - BIC (8 oder 11 Zeichen)
    - Bankname / Kreditinstitut
    - Kontoinhaber
    - Mandatsdatum (YYYY-MM-DD)
13. Minderjährigen-Prüfung & Gesetzliche Vertreter:
    - isMinor: true wenn das Geburtsdatum < 18 Jahre ist oder ein Erziehungsberechtigter angegeben ist
    - Name des Erziehungsberechtigten
    - Telefon & E-Mail des Erziehungsberechtigten
    - Verwandtschaftsverhältnis ('Mutter', 'Vater', 'Gesetzlicher Vormund')
14. Einwilligungen & Checkboxen (true/false):
    - dataPrivacyConsent (Datenschutz / DSGVO)
    - statuteConsent (Satzung anerkannt)
    - photoConsent (Foto-/Medieneinwilligung)
    - healthConfirmation (Sporttauglichkeit)
15. Unterschriften-Prüfung:
    - hasApplicantSignature: true/false (ob eine handschriftliche oder digitale Unterschrift des Antragstellers sichtbar ist)
    - hasGuardianSignature: true/false (ob eine Unterschrift des Erziehungsberechtigten sichtbar ist)
    - hasSepaSignature: true/false (ob ein SEPA-Mandat unterschrieben ist)
16. Bemerkungen / Notizen: Besondere Hinweise, Freitextnotizen auf dem Formular.
17. confidence: Einschätzung der Lesbarkeit von 0.0 (sehr unscharf/unleserlich) bis 1.0 (perfekt lesbar).
18. rawExtractedTextSummary: Kurze stichpunktartige Zusammenfassung der Erkennung.

Falls ein Feld nicht auf dem Dokument steht oder unleserlich ist, setze einen leeren String bzw. Standardwert ein. Erfinde keine Bankdaten oder Namen.`;

    const ai = getGeminiClient();

    const schemaConfig = {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          firstName: { type: Type.STRING },
          lastName: { type: Type.STRING },
          gender: { type: Type.STRING, enum: ["m", "w", "d", "none"] },
          birthDate: { type: Type.STRING, description: "YYYY-MM-DD" },
          nationality: { type: Type.STRING },
          phone: { type: Type.STRING },
          email: { type: Type.STRING },
          address: {
            type: Type.OBJECT,
            properties: {
              street: { type: Type.STRING },
              houseNumber: { type: Type.STRING },
              zip: { type: Type.STRING },
              city: { type: Type.STRING },
              country: { type: Type.STRING },
            },
            required: ["street", "houseNumber", "zip", "city"],
          },
          department: { type: Type.STRING },
          membershipType: {
            type: Type.STRING,
            enum: ["full", "reduced", "youth", "family", "supporting", "honorary"],
          },
          feePeriod: {
            type: Type.STRING,
            enum: ["monthly", "quarterly", "half_yearly", "yearly"],
          },
          feeAmount: { type: Type.NUMBER },
          entryDate: { type: Type.STRING, description: "YYYY-MM-DD" },
          paymentMethod: {
            type: Type.STRING,
            enum: ["sepa", "transfer", "cash", "standing_order"],
          },
          bankDetails: {
            type: Type.OBJECT,
            properties: {
              iban: { type: Type.STRING },
              bic: { type: Type.STRING },
              bankName: { type: Type.STRING },
              accountHolder: { type: Type.STRING },
              mandateDate: { type: Type.STRING },
            },
          },
          isMinor: { type: Type.BOOLEAN },
          guardianName: { type: Type.STRING },
          guardianPhone: { type: Type.STRING },
          guardianEmail: { type: Type.STRING },
          guardianRelation: { type: Type.STRING },
          dataPrivacyConsent: { type: Type.BOOLEAN },
          statuteConsent: { type: Type.BOOLEAN },
          photoConsent: { type: Type.BOOLEAN },
          healthConfirmation: { type: Type.BOOLEAN },
          hasApplicantSignature: { type: Type.BOOLEAN },
          hasGuardianSignature: { type: Type.BOOLEAN },
          hasSepaSignature: { type: Type.BOOLEAN },
          notes: { type: Type.STRING },
          confidence: { type: Type.NUMBER },
          rawExtractedTextSummary: { type: Type.STRING },
        },
        required: ["firstName", "lastName", "address"],
      },
    };

    const payload = [
      {
        inlineData: {
          mimeType: detectedMimeType,
          data: base64Data,
        },
      },
      {
        text: prompt,
      },
    ];

    // Helper with retry logic and fallback models in case of high load (503 / 429)
    const candidateModels = ["gemini-3.6-flash", "gemini-3.7-flash", "gemini-flash-latest", "gemini-2.5-flash", "gemini-3.1-flash-lite"];
    let response: any = null;
    let lastError: any = null;

    for (const model of candidateModels) {
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          response = await ai.models.generateContent({
            model,
            contents: payload,
            config: schemaConfig,
          });
          if (response?.text) {
            break;
          }
        } catch (err: any) {
          lastError = err;
          console.warn(`Attempt ${attempt} with model ${model} failed:`, err?.message || err);
          // Wait 1.5s before retry
          await new Promise((resolve) => setTimeout(resolve, 1500));
        }
      }
      if (response?.text) {
        break;
      }
    }

    if (!response || !response.text) {
      throw lastError || new Error("Keine Antwort vom KI-Dienst erhalten.");
    }

    const parsedJson = JSON.parse(response.text || "{}");
    return res.json({
      success: true,
      data: parsedJson,
      fileName,
    });
  } catch (error: any) {
    console.error("Fehler bei der KI-Antragsextraktion:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Die Datei konnte nicht durch die KI analysiert werden.",
    });
  }
});

/**
 * POST /api/meetings/analyze-notes
 * Analyzes uploaded notes (PDF, JPEG, PNG, WEBP) such as handwritten notes, whiteboard photos,
 * printed drafts, or scanned minutes and structures them into a complete meeting protocol with TOPs and resolutions.
 */
app.post("/api/meetings/analyze-notes", bremse(bremseTeuer, "KI"), async (req, res) => {
  try {
    const { fileDataUrl, mimeType, fileName, meetingContext } = req.body;


    if (!fileDataUrl) {
      return res.status(400).json({ error: "Keine Datei mit Notizen übermittelt." });
    }

    const commaIndex = fileDataUrl.indexOf(",");
    const base64Data = commaIndex !== -1 ? fileDataUrl.substring(commaIndex + 1) : fileDataUrl;
    const detectedMimeType = mimeType || (fileDataUrl.startsWith("data:") ? fileDataUrl.substring(5, fileDataUrl.indexOf(";")) : "application/pdf");


    const prompt = `Du bist ein hochqualifizierter Experte für deutsches Vereinsrecht (§§ 27, 32 BGB), Vereinsversammlungen und rechtssichere Protokollführung für gemeinnützige Sport- und Kulturvereine.
Analysiere das beigefügte Dokument akribisch (es kann sich um handschriftliche Notizen, ein Foto eines Whiteboards / Flipcharts, einen getippten Entwurf oder ein eingescanntes Protokoll handeln).

KONTEXT DER SITZUNG (falls vorhanden):
- Sitzungstitel: ${meetingContext?.title || "Vereinssitzung"}
- Sitzungstyp: ${meetingContext?.type || "board"}
- Datum: ${meetingContext?.date || "Nicht angegeben"}

AUFGABE:
Extrahiere alle erkennbaren Inhalte und überführe sie in eine saubere, strukturierte Sitzungs- und Protokollstruktur:
1. Titel der Sitzung (title)
2. Sitzungsart (type): Eine von 'board' (Vorstandssitzung), 'general_assembly' (Ordentliche MV), 'extraordinary_assembly' (Außerordentliche MV), 'committee' (Ausschuss), 'department' (Abteilungsversammlung), 'other' (Sonstige)
3. Datum im Format YYYY-MM-DD (date)
4. Uhrzeit Beginn HH:MM (startTime) und Ende HH:MM (endTime)
5. Ort / Treffpunkt (location)
6. Versammlungsleiter (chairperson) und Protokollführer / Schriftführer (minuteKeeper)
7. Tagesordnungspunkte (agenda):
   Für jeden TOP:
   - number: z.B. "TOP 1", "TOP 2", etc.
   - title: Thema des Tagesordnungspunkts
   - speaker: Berichterstatter / Sprecher (falls erkennbar)
   - discussionNotes: Sachliche, präzise Zusammenfassung der Beratung und Diskussion im Stil eines Ergebnisprotokolls
   - resolutions: Alle gefassten Beschlüsse und Abstimmungen zu diesem TOP:
     - title: Kurztitel des Beschlusses
     - motionText: Rechtssicherer, verbindlicher Antragswortlaut (z.B. "Der Vorstand beschließt...")
     - proposer: Antragsteller
     - votesFor: Ja-Stimmen (Zahl)
     - votesAgainst: Nein-Stimmen (Zahl)
     - votesAbstain: Enthaltungen (Zahl)
     - result: 'accepted' (angenommen), 'rejected' (abgelehnt) oder 'deferred' (vertagt)
     - isTaxRelevant: true wenn steuerlich/Finanzamt-relevant (z.B. Ehrenamtspauschalen, Anschaffungen, Rücklagen, Haushaltsplan)
     - isRegisterRelevant: true wenn registerrelevant für Amtsgericht / Notar (z.B. Wahlen Vorstand § 26 BGB, Satzungsänderungen § 33 BGB, Beitragsordnung sofern in Satzung)
     - responsiblePerson: Name des Verantwortlichen zur Umsetzung
     - dueDate: Frist zur Umsetzung (YYYY-MM-DD oder Zeitangabe)
     - notes: Sonstige Erläuterungen
8. Anwesende Personen (attendees): Name, Rolle (z.B. "1. Vorsitzender", "Schatzmeister", "Schriftführer", "Mitglied"), present: true, hasVotingRight: true/false
9. Allgemeine Anmerkungen / Fazit (generalNotes)
10. confidence: Einschätzung der Lesbarkeit (0.0 bis 1.0)
11. extractedRawSummary: Eine stichpunktartige Zusammenfassung der Notizen.

Falls bestimmte Angaben auf den Notizen nicht vorhanden sind, ergänze sinnvolle Standardwerte bzw. lasse optionale Felder leer.`;

    const ai = getGeminiClient();

    const schemaConfig = {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          type: {
            type: Type.STRING,
            enum: ["board", "general_assembly", "extraordinary_assembly", "committee", "department", "other"],
          },
          date: { type: Type.STRING, description: "YYYY-MM-DD" },
          startTime: { type: Type.STRING, description: "HH:MM" },
          endTime: { type: Type.STRING, description: "HH:MM" },
          location: { type: Type.STRING },
          chairperson: { type: Type.STRING },
          minuteKeeper: { type: Type.STRING },
          agenda: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                number: { type: Type.STRING },
                title: { type: Type.STRING },
                speaker: { type: Type.STRING },
                discussionNotes: { type: Type.STRING },
                resolutions: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      title: { type: Type.STRING },
                      motionText: { type: Type.STRING },
                      proposer: { type: Type.STRING },
                      votesFor: { type: Type.INTEGER },
                      votesAgainst: { type: Type.INTEGER },
                      votesAbstain: { type: Type.INTEGER },
                      result: { type: Type.STRING, enum: ["accepted", "rejected", "deferred"] },
                      isTaxRelevant: { type: Type.BOOLEAN },
                      isRegisterRelevant: { type: Type.BOOLEAN },
                      responsiblePerson: { type: Type.STRING },
                      dueDate: { type: Type.STRING },
                      notes: { type: Type.STRING },
                    },
                    required: ["title", "motionText", "result"],
                  },
                },
              },
              required: ["number", "title"],
            },
          },
          attendees: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                role: { type: Type.STRING },
                present: { type: Type.BOOLEAN },
                hasVotingRight: { type: Type.BOOLEAN },
              },
              required: ["name"],
            },
          },
          generalNotes: { type: Type.STRING },
          confidence: { type: Type.NUMBER },
          extractedRawSummary: { type: Type.STRING },
        },
        required: ["agenda"],
      },
    };

    const payload = [
      {
        inlineData: {
          mimeType: detectedMimeType,
          data: base64Data,
        },
      },
      { text: prompt },
    ];

    const candidateModels = ["gemini-3.6-flash", "gemini-3.7-flash", "gemini-flash-latest", "gemini-2.5-flash", "gemini-3.1-flash-lite"];
    let response: any = null;
    let lastError: any = null;

    for (const model of candidateModels) {
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          response = await ai.models.generateContent({
            model,
            contents: payload,
            config: schemaConfig,
          });
          if (response?.text) break;
        } catch (err: any) {
          lastError = err;
          console.warn(`Attempt ${attempt} with ${model} for analyze-notes failed:`, err?.message || err);
          await new Promise((resolve) => setTimeout(resolve, 1200));
        }
      }
      if (response?.text) break;
    }

    if (!response || !response.text) {
      throw lastError || new Error("Keine Antwort vom KI-Dienst erhalten.");
    }

    const parsedJson = JSON.parse(response.text || "{}");
    return res.json({
      success: true,
      data: parsedJson,
      fileName,
    });
  } catch (error: any) {
    console.error("Fehler bei der Notizen-Analyse:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Die Notizen konnten nicht ausgewertet werden.",
    });
  }
});

/**
 * POST /api/meetings/analyze-audio
 * Transcribes and analyzes audio recordings (Vorstandssitzungen, Ausschüsse, etc.)
 * Strictly forbidden for Mitgliederversammlungen (general_assembly, extraordinary_assembly) for privacy reasons.
 */
app.post("/api/meetings/analyze-audio", bremse(bremseTeuer, "KI"), async (req, res) => {
  try {
    const { audioDataUrl, mimeType, fileName, meetingContext } = req.body;


    if (!audioDataUrl) {
      return res.status(400).json({ error: "Keine Audio-Aufnahme übermittelt." });
    }

    // Explicit privacy protection guard for Mitgliederversammlungen
    const meetingType = meetingContext?.type || "board";
    if (meetingType === "general_assembly" || meetingType === "extraordinary_assembly") {
      return res.status(403).json({
        success: false,
        error: "Die Audio-Transkription ist für Mitgliederversammlungen aus Datenschutzgründen (DSGVO § 201 StGB / Vertraulichkeit des Wortes) und wegen der Stimmenvielfalt nicht zulässig. Bitte nutzen Sie Textnotizen oder den Dokumenten-Upload.",
      });
    }

    const commaIndex = audioDataUrl.indexOf(",");
    const base64Data = commaIndex !== -1 ? audioDataUrl.substring(commaIndex + 1) : audioDataUrl;
    const detectedMimeType = mimeType || (audioDataUrl.startsWith("data:") ? audioDataUrl.substring(5, audioDataUrl.indexOf(";")) : "audio/webm");


    const prompt = `Du bist ein erfahrener juristischer Protokollführer für Vorstandssitzungen und Gremiensitzungen eines gemeinnützigen Sport- und Kulturvereins (§§ 27 ff. BGB).
Höre die beigefügte Tonaufnahme der Sitzung sorgfältig an und erstelle daraus ein vollständiges, rechtssicheres Sitzungsprotokoll.

KONTEXT DER SITZUNG:
- Titel: ${meetingContext?.title || "Vorstandssitzung"}
- Sitzungstyp: ${meetingType}
- Datum: ${meetingContext?.date || "Heute"}

AUFGABE:
1. Identifiziere den Sitzungsverlauf und gliedere ihn in klare Tagesordnungspunkte (agenda / TOPs).
2. Fasse zu jedem TOP die wesentlichen Wortbeiträge und Beratungsergebnisse im Stil eines sachlichen Ergebnisprotokolls zusammen.
3. Extrahiere alle Anträge und Beschlussfassungen:
   - Antragswortlaut (motionText)
   - Abstimmungsergebnis (Ja, Nein, Enthaltung) falls genannt
   - Ob der Beschluss angenommen/abgelehnt/vertagt wurde
   - Steuerliche Relevanz (Finanzamt: Übungsleitergelder, Anschaffungen, Ausgaben, Spenden)
   - Vereinsregister-Relevanz (Amtsgericht: Vorstandsbestellungen, Vertretungsbefugnis)
   - Verantwortlicher und Umsetzungsfrist
4. Erfasse namentlich genannte Teilnehmer und ihre Funktionen.
5. Gib eine kompakte Zusammenfassung / Transkript-Essenz der wichtigsten Sitzungsinhalte an.`;

    const ai = getGeminiClient();

    const schemaConfig = {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          date: { type: Type.STRING, description: "YYYY-MM-DD" },
          startTime: { type: Type.STRING, description: "HH:MM" },
          endTime: { type: Type.STRING, description: "HH:MM" },
          location: { type: Type.STRING },
          chairperson: { type: Type.STRING },
          minuteKeeper: { type: Type.STRING },
          agenda: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                number: { type: Type.STRING },
                title: { type: Type.STRING },
                speaker: { type: Type.STRING },
                discussionNotes: { type: Type.STRING },
                resolutions: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      title: { type: Type.STRING },
                      motionText: { type: Type.STRING },
                      proposer: { type: Type.STRING },
                      votesFor: { type: Type.INTEGER },
                      votesAgainst: { type: Type.INTEGER },
                      votesAbstain: { type: Type.INTEGER },
                      result: { type: Type.STRING, enum: ["accepted", "rejected", "deferred"] },
                      isTaxRelevant: { type: Type.BOOLEAN },
                      isRegisterRelevant: { type: Type.BOOLEAN },
                      responsiblePerson: { type: Type.STRING },
                      dueDate: { type: Type.STRING },
                      notes: { type: Type.STRING },
                    },
                    required: ["title", "motionText", "result"],
                  },
                },
              },
              required: ["number", "title"],
            },
          },
          attendees: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                role: { type: Type.STRING },
                present: { type: Type.BOOLEAN },
                hasVotingRight: { type: Type.BOOLEAN },
              },
              required: ["name"],
            },
          },
          generalNotes: { type: Type.STRING },
          transcriptSummary: { type: Type.STRING },
        },
        required: ["agenda"],
      },
    };

    const payload = [
      {
        inlineData: {
          mimeType: detectedMimeType,
          data: base64Data,
        },
      },
      { text: prompt },
    ];

    const candidateModels = ["gemini-3.6-flash", "gemini-3.7-flash", "gemini-flash-latest", "gemini-2.5-flash"];
    let response: any = null;
    let lastError: any = null;

    for (const model of candidateModels) {
      try {
        response = await ai.models.generateContent({
          model,
          contents: payload,
          config: schemaConfig,
        });
        if (response?.text) break;
      } catch (err: any) {
        lastError = err;
        console.warn(`Audio analysis with ${model} failed:`, err?.message || err);
      }
    }

    if (!response || !response.text) {
      throw lastError || new Error("Die Audioaufnahme konnte nicht transkribiert werden.");
    }

    const parsedJson = JSON.parse(response.text || "{}");
    return res.json({
      success: true,
      data: parsedJson,
      fileName,
    });
  } catch (error: any) {
    console.error("Fehler bei der Audio-Transkription:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Fehler bei der Audioauswertung.",
    });
  }
});

/**
 * POST /api/meetings/ai-assist
 * Intelligent text & drafting assistant for meeting minutes and resolutions:
 * - polish_discussion: turns rough bullets into legally objective protocol text
 * - formulate_resolution: turns informal intent into legally sound, non-profit conform motion text
 * - suggest_agenda: proposes structured agenda based on meeting purpose
 * - summarize_meeting: generates an executive summary
 */
app.post("/api/meetings/ai-assist", bremse(bremseTeuer, "KI"), async (req, res) => {
  try {
    const { action, input, context } = req.body;


    if (!action || !input) {
      return res.status(400).json({ error: "Aktion und Eingabetext sind erforderlich." });
    }

    let prompt = "";
    let schemaConfig: any = null;

    if (action === "formulate_resolution") {
      prompt = `Du bist ein juristischer Experte für deutsches Vereinsrecht (§§ 26, 32, 33 BGB) und Gemeinnützigkeitsrecht (§§ 51 ff. AO).
Formuliere aus der folgenden informellen Beschlussidee einen rechtssicheren, präzisen Beschlussantrag für eine Vereinssitzung:

BESCHLUSSIDEE / STICHWORT:
"${input}"

SITZUNGSKONTEXT:
- Sitzung: ${context?.meetingTitle || "Vorstandssitzung"}
- TOP: ${context?.topTitle || "Beschlussfassung"}
- Typ: ${context?.meetingType || "board"}

AUFGABE:
1. Formuliere einen klaren Titel (title)
2. Formuliere einen präzisen, rechtsgültigen Beschlusswortlaut im Präsens (motionText), z.B. "Der Vorstand beschließt einstimmig, ... / Die Mitgliederversammlung beschließt ...".
3. Prüfe, ob dieser Beschluss steuerlich relevant für das Finanzamt ist (isTaxRelevant: true wenn Mittelverwendung, Ehrenamtspauschalen, Investition, Haushalt, Spenden).
4. Prüfe, ob dieser Beschluss registerrelevant für das Vereinsregister beim Amtsgericht ist (isRegisterRelevant: true wenn Vorstandswahl gem. § 26 BGB, Satzungsänderung § 33 BGB).
5. Schlage ein Ergebnis vor (result: 'accepted').
6. Schlage einen Begründungs-/Rechtshinweis vor (notes).`;

      schemaConfig = {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            motionText: { type: Type.STRING },
            proposer: { type: Type.STRING },
            result: { type: Type.STRING, enum: ["accepted", "rejected", "deferred"] },
            isTaxRelevant: { type: Type.BOOLEAN },
            isRegisterRelevant: { type: Type.BOOLEAN },
            responsiblePerson: { type: Type.STRING },
            notes: { type: Type.STRING },
          },
          required: ["title", "motionText", "result", "isTaxRelevant", "isRegisterRelevant"],
        },
      };
    } else if (action === "polish_discussion") {
      prompt = `Du bist ein erfahrener Protokollführer für Vereine.
Wandle die folgenden stichpunktartigen, rohen Notizen in einen sachlichen, rechtssicheren Protokolltext für ein Vereins-Ergebnisprotokoll um (§ 32 BGB).

ROHNOTIZEN:
"${input}"

KONTEXT:
- TOP: ${context?.topTitle || "Aussprache"}
- Sitzungsart: ${context?.meetingType || "board"}

REGELN:
- Sachlich, neutral und objektiv im Präteritum/Perfekt formuliert.
- Klare Gedankenführung, keine emotionalen oder parteiischen Formulierungen.
- Wesentliche Argumente und das Beratungsergebnis prägnant herausstellen.
- Antwort als formatierten Fließtext zurückgeben.`;
    } else if (action === "suggest_agenda") {
      prompt = `Du bist ein Vereinsberater.
Erstelle für den folgenden Sitzungstyp und thematischen Schwerpunkt eine empfohlene, vollständige Tagesordnung (TOPs) gem. deutscher Vereinspraxis:

SITZUNGSTYP: ${context?.meetingType || "board"}
SCHWERPUNKT / ANLASS: "${input}"

AUFGABE:
Gib eine Liste strukturierter Tagesordnungspunkte (TOP 1, TOP 2, ...) mit Titel und kurzer Beschreibung der geplanten Inhalte zurück.`;

      schemaConfig = {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              number: { type: Type.STRING },
              title: { type: Type.STRING },
              speaker: { type: Type.STRING },
              description: { type: Type.STRING },
            },
            required: ["number", "title"],
          },
        },
      };
    } else {
      return res.status(400).json({ error: `Unbekannte Aktion: ${action}` });
    }

    const ai = getGeminiClient();

    const aiConfig: any = {};
    if (schemaConfig) {
      aiConfig.responseMimeType = schemaConfig.responseMimeType;
      aiConfig.responseSchema = schemaConfig.responseSchema;
    }

    const candidateModels = ["gemini-3.6-flash", "gemini-3.7-flash", "gemini-flash-latest", "gemini-2.5-flash"];
    let response: any = null;
    let lastError: any = null;

    for (const model of candidateModels) {
      try {
        response = await ai.models.generateContent({
          model,
          contents: prompt,
          config: aiConfig,
        });
        if (response?.text) break;
      } catch (err: any) {
        lastError = err;
        console.warn(`ai-assist with ${model} failed:`, err?.message || err);
      }
    }

    if (!response || !response.text) {
      throw lastError || new Error("Die KI-Entwurfshilfe konnte keine Antwort generieren.");
    }

    const rawText = response.text || "";
    let data: any = rawText;
    if (schemaConfig) {
      try {
        data = JSON.parse(rawText);
      } catch (parseErr) {
        console.warn("JSON parse error in ai-assist:", parseErr);
      }
    }

    return res.json({
      success: true,
      data,
    });
  } catch (error: any) {
    console.error("Fehler bei der KI-Entwurfshilfe:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Fehler beim Ausführen der KI-Entwurfshilfe.",
    });
  }
});

// ---------------------------------------------------------------------------
// SMTP-Zugangsdaten
// ---------------------------------------------------------------------------
//
// Die Zugangsdaten zum Postfach des Vereins liegen auf dem Server, nicht in
// den Vereinsstammdaten. Damit stehen sie weder in der IndexedDB des Browsers
// noch in einer Datensicherung, und sie gehen bei keinem Versand über die
// Leitung. Einzelheiten in src/server/instanceConfig.ts.
//
// Das Passwort bewegt sich nur in eine Richtung: Es kommt beim Speichern
// herein und wird nie wieder herausgegeben.

/**
 * Baut den Versandweg zum Mailserver auf. Eine Stelle für Test und Versand,
 * damit getestet wird, was später auch tatsächlich verschickt wird.
 *
 * Zu rejectUnauthorized: Voreingestellt ist die Prüfung des Zertifikats. Ein
 * Mailserver im eigenen Haus hat manchmal ein selbst ausgestelltes Zertifikat,
 * das keine Prüfstelle bestätigt. Für diesen Fall — und nur für ihn — gibt es
 * VM_SMTP_ALLOW_SELF_SIGNED=true. Ohne Prüfung könnte sich jemand im selben
 * Netz zwischen Server und Mailanbieter schieben und das Passwort mitlesen.
 */
function createSmtpTransport(zugangsdaten: {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
}) {
  const selbstSigniertErlaubt = process.env.VM_SMTP_ALLOW_SELF_SIGNED === "true";
  return nodemailer.createTransport({
    host: zugangsdaten.host,
    port: zugangsdaten.port,
    secure: zugangsdaten.secure || zugangsdaten.port === 465,
    auth: zugangsdaten.user
      ? {
          user: zugangsdaten.user,
          pass: zugangsdaten.password,
        }
      : undefined,
    tls: {
      rejectUnauthorized: !selbstSigniertErlaubt,
    },
    connectionTimeout: 15000,
    greetingTimeout: 10000,
  });
}

/**
 * GET /api/smtp/config
 * Auskunft über die hinterlegten Zugangsdaten — ohne das Passwort. Ob eines
 * hinterlegt ist, verrät das Feld hasPassword.
 */
app.get("/api/smtp/config", (_req, res) => {
  try {
    return res.json({ success: true, config: readSmtpConfigPublic() });
  } catch (error: any) {
    console.error("Fehler beim Lesen der SMTP-Konfiguration:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Die hinterlegten Zugangsdaten konnten nicht gelesen werden.",
    });
  }
});

/**
 * POST /api/smtp/config
 * Speichert die Zugangsdaten.
 *
 * Fehlt das Feld "password", bleibt ein hinterlegtes Passwort unverändert.
 * Das ist der Normalfall, denn die Oberfläche kennt es nicht und kann es
 * folglich nicht mitschicken. Ein leerer Text entfernt das Passwort.
 */
app.post("/api/smtp/config", bremse(bremsePost, "E-Mail"), (req, res) => {
  try {
    const { host, port, secure, user, fromEmail, fromName, password } = req.body ?? {};

    if (typeof host !== "string" || !host.trim()) {
      return res.status(400).json({ success: false, error: "Kein SMTP-Host angegeben (z. B. smtp.ionos.de)." });
    }
    const portNum = Number(port) || (secure ? 465 : 587);
    if (!Number.isInteger(portNum) || portNum < 1 || portNum > 65535) {
      return res.status(400).json({ success: false, error: "Der Port muss eine ganze Zahl zwischen 1 und 65535 sein." });
    }
    if (password !== undefined && password !== null && typeof password !== "string") {
      return res.status(400).json({ success: false, error: "Ungültige Angabe beim Passwort." });
    }

    const config = writeSmtpConfig({
      host,
      port: portNum,
      secure: Boolean(secure) || portNum === 465,
      user: typeof user === "string" ? user : "",
      fromEmail: typeof fromEmail === "string" ? fromEmail : "",
      fromName: typeof fromName === "string" ? fromName : "",
      password,
    });

    // Bewusst ohne Passwort im Protokoll.
    console.info(
      `SMTP-Zugangsdaten gespeichert: ${config.host}:${config.port}, Passwort hinterlegt: ${config.hasPassword ? "ja" : "nein"}`
    );
    return res.json({ success: true, config });
  } catch (error: any) {
    console.error("Fehler beim Speichern der SMTP-Konfiguration:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Die Zugangsdaten konnten nicht gespeichert werden.",
    });
  }
});

/**
 * GET /api/ai/config
 * Liefert Anbieter, Modell und Adresse — aber niemals den Schlüssel selbst,
 * nur die Auskunft, ob einer hinterlegt ist und woher er stammt.
 */
app.get("/api/ai/config", (_req, res) => {
  try {
    return res.json({ success: true, config: readAiConfigPublic() });
  } catch (error: any) {
    console.error("Fehler beim Lesen der KI-Konfiguration:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Die hinterlegten KI-Einstellungen konnten nicht gelesen werden.",
    });
  }
});

/**
 * POST /api/ai/config
 * Speichert die KI-Einstellungen.
 *
 * Fehlt das Feld "apiKey", bleibt ein hinterlegter Schlüssel unverändert —
 * der Normalfall, denn die Oberfläche kennt ihn nicht und kann ihn folglich
 * nicht mitschicken. Ein leerer Text entfernt ihn.
 */
app.post("/api/ai/config", bremse(bremsePost, "KI-Einstellungen"), (req, res) => {
  try {
    const { provider, model, apiKey, aktiviert, bestaetigtVon } = req.body ?? {};

    // Nur noch ein Anbieter. Die Prüfung bleibt trotzdem stehen: Sie hält
    // eine alte Oberfläche oder eine Datensicherung davon ab, einen Anbieter
    // einzutragen, den es hier nicht mehr gibt.
    const erlaubte: AiProvider[] = ["gemini"];
    if (!erlaubte.includes(provider)) {
      return res.status(400).json({
        success: false,
        error: `Unbekannter KI-Anbieter. Möglich ist: ${erlaubte.join(", ")}.`,
      });
    }
    if (apiKey !== undefined && apiKey !== null && typeof apiKey !== "string") {
      return res.status(400).json({ success: false, error: "Ungültige Angabe beim Schlüssel." });
    }

    if (aktiviert !== undefined && typeof aktiviert !== "boolean") {
      return res.status(400).json({ success: false, error: "Ungültige Angabe bei der Freigabe." });
    }
    // Eine Freigabe ohne Namen wird abgelehnt. Nicht aus Förmlichkeit: Die
    // Frage, die einem Verein später gestellt wird, lautet "wer hat das
    // erlaubt?" — und darauf muss die Anwendung antworten können.
    if (aktiviert === true && !(typeof bestaetigtVon === "string" && bestaetigtVon.trim())) {
      return res.status(400).json({
        success: false,
        error: "Für die Freigabe wird festgehalten, wer sie erteilt hat. Bitte einen Namen mitschicken.",
      });
    }

    const config = writeAiConfig({
      provider,
      model: typeof model === "string" ? model : "",
      apiKey,
      aktiviert: typeof aktiviert === "boolean" ? aktiviert : undefined,
      bestaetigtVon: typeof bestaetigtVon === "string" ? bestaetigtVon : undefined,
    });

    // Bewusst ohne den Schlüssel im Protokoll.
    console.info(
      `KI-Einstellungen gespeichert: Anbieter ${config.provider}, ` +
        `Modell ${config.model || "(Vorgabe)"}, Schlüssel hinterlegt: ${config.hasApiKey ? "ja" : "nein"}, ` +
        `freigegeben: ${config.aktiviert ? `ja (${config.bestaetigtVon}, ${config.bestaetigtAm})` : "nein"}`
    );
    return res.json({ success: true, config });
  } catch (error: any) {
    console.error("Fehler beim Speichern der KI-Konfiguration:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Die KI-Einstellungen konnten nicht gespeichert werden.",
    });
  }
});

/**
 * DELETE /api/ai/config
 * Entfernt die KI-Einstellungen vollständig. Steht ein Schlüssel in der
 * Umgebung des Servers, gilt danach wieder dieser.
 */
app.delete("/api/ai/config", bremse(bremsePost, "KI-Einstellungen"), (_req, res) => {
  try {
    const config = deleteAiConfig();
    console.info("KI-Einstellungen entfernt.");
    return res.json({ success: true, config });
  } catch (error: any) {
    console.error("Fehler beim Entfernen der KI-Konfiguration:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Die KI-Einstellungen konnten nicht entfernt werden.",
    });
  }
});

/**
 * DELETE /api/smtp/config
 * Entfernt die Zugangsdaten vollständig. Der Schlüssel bleibt liegen.
 */
app.delete("/api/smtp/config", bremse(bremsePost, "E-Mail"), (_req, res) => {
  try {
    const config = deleteSmtpConfig();
    console.info("SMTP-Zugangsdaten entfernt.");
    return res.json({ success: true, config });
  } catch (error: any) {
    console.error("Fehler beim Entfernen der SMTP-Konfiguration:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Die Zugangsdaten konnten nicht entfernt werden.",
    });
  }
});

/**
 * POST /api/smtp/test
 * Prüft die auf dem Server hinterlegten Zugangsdaten. Es werden keine
 * Zugangsdaten entgegengenommen — geprüft wird genau das, was später auch
 * beim Versand verwendet wird. Optional geht eine echte Testnachricht raus.
 */
app.post("/api/smtp/test", bremse(bremsePost, "E-Mail"), async (req, res) => {
  try {
    const { testRecipient } = req.body ?? {};
    const zugangsdaten = readSmtpCredentials();

    if (!zugangsdaten) {
      return res.status(400).json({
        success: false,
        error: "Es sind noch keine SMTP-Zugangsdaten hinterlegt. Bitte zuerst speichern, dann testen.",
      });
    }

    const transporter = createSmtpTransport(zugangsdaten);
    await transporter.verify();

    if (testRecipient && typeof testRecipient === "string" && testRecipient.includes("@")) {
      const senderAddr = zugangsdaten.fromEmail || zugangsdaten.user || "noreply@vereinsmanager.app";
      await transporter.sendMail({
        from: `"VereinsManager SMTP-Test" <${senderAddr}>`,
        to: testRecipient.trim(),
        subject: "VereinsManager: SMTP-Verbindungstest erfolgreich",
        text: `Hallo,\n\ndiese Testnachricht bestätigt, dass Ihre SMTP-Konfiguration auf dem Server ${zugangsdaten.host}:${zugangsdaten.port} erfolgreich verbunden und authentifiziert werden konnte.\n\nSitzungseinladungen und Protokolle können ab sofort direkt aus der Anwendung versendet werden.\n\nHerzliche Grüße,\nIhr VereinsManager`,
      });
    }

    const verschluesselung = zugangsdaten.secure || zugangsdaten.port === 465 ? "SSL/TLS" : "STARTTLS";
    return res.json({
      success: true,
      message: `Verbindung zu SMTP-Server (${zugangsdaten.host}:${zugangsdaten.port}, ${verschluesselung}) erfolgreich aufgebaut und verifiziert.`,
    });
  } catch (error: any) {
    console.error("Fehler beim SMTP-Verbindungstest:", error);
    return res.status(400).json({
      success: false,
      error: error.message || "Verbindung zum SMTP-Server fehlgeschlagen. Bitte Host, Port und Anmeldedaten überprüfen.",
    });
  }
});

/**
 * POST /api/meetings/send-email
 * Versendet Sitzungseinladungen oder Protokolle per E-Mail an die Teilnehmer / Mitglieder.
 * Unterstützt echte Zustellung über SMTP (falls konfiguriert) oder liefert einen Zustellungsnachweis (DSGVO-konform mit BCC).
 */
app.post("/api/meetings/send-email", bremse(bremsePost, "E-Mail"), async (req, res) => {
  try {
    const {
      recipients,
      subject,
      bodyText,
      bodyHtml,
      senderName,
      senderEmail,
      attachment,
      meetingTitle,
      dispatchType,
    } = req.body;

    // Zugangsdaten dieser Installation. Kommt hier null zurück, ist noch
    // nichts eingerichtet.
    const zugangsdaten = readSmtpCredentials();

    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({ error: "Keine Empfänger für den E-Mail-Versand angegeben." });
    }

    if (!subject || !bodyText) {
      return res.status(400).json({ error: "Betreff und Nachrichtentext sind erforderlich." });
    }

    const validRecipients = recipients
      .map((r: any) =>
        typeof r === "string"
          ? { email: r.trim(), name: "" }
          : { email: r.email?.trim(), name: r.name?.trim() || "" }
      )
      .filter((r: any) => r.email && r.email.includes("@"));

    if (validRecipients.length === 0) {
      return res.status(400).json({ error: "Keine gültigen E-Mail-Adressen in der Empfängerliste gefunden." });
    }

    const dispatchId = `MAIL-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const timestamp = new Date().toISOString();

    console.log(`[Meeting Email #${dispatchId}] Versandauftrag eingegangen:`, {
      type: dispatchType || "meeting",
      meetingTitle,
      recipientCount: validRecipients.length,
      subject,
      hasAttachment: Boolean(attachment?.filename),
      hasSmtpConfig: Boolean(zugangsdaten),
    });

    // Die Zugangsdaten kommen aus der Serverkonfiguration, nicht mehr aus der
    // Anfrage. Ein Aufrufer kann den Server damit nicht mehr auf einen
    // fremden Mailserver zeigen lassen — und das Passwort des Vereins dort
    // abliefern lassen.
    if (zugangsdaten) {
      try {
        const transporter = createSmtpTransport(zugangsdaten);

        const fromAddress = zugangsdaten.fromEmail || senderEmail?.trim() || "vorstand@tsv-musterstadt1890.de";
        const fromNameStr = zugangsdaten.fromName || senderName?.trim() || "VereinsManager";
        const fromHeader = `"${fromNameStr.replace(/"/g, '')}" <${fromAddress}>`;

        const bccList = validRecipients.map((r: any) => r.email);

        const attachmentsList = [];
        if (attachment && attachment.base64Data) {
          attachmentsList.push({
            filename: attachment.filename || `${dispatchType === "invitation" ? "Einladung" : "Protokoll"}.pdf`,
            content: Buffer.from(attachment.base64Data, "base64"),
            contentType: attachment.contentType || "application/pdf",
          });
        }

        await transporter.sendMail({
          from: fromHeader,
          to: fromAddress, // Primärer Empfänger: eigene Adresse (DSGVO-Standard bei Rundschreiben)
          bcc: bccList, // Alle eigentlichen Empfänger diskret im BCC
          subject,
          text: bodyText,
          html: bodyHtml || bodyText.replace(/\n/g, "<br/>"),
          attachments: attachmentsList,
        });

        return res.json({
          success: true,
          dispatchId,
          sentCount: validRecipients.length,
          recipients: validRecipients,
          timestamp,
          meetingTitle: meetingTitle || "Sitzung",
          attachmentName: attachment?.filename || null,
          method: "smtp",
          message: `Erfolgreich über SMTP-Server (${zugangsdaten.host}) an ${validRecipients.length} Empfänger versendet (DSGVO-Blindkopie BCC).`,
        });
      } catch (smtpErr: any) {
        console.error("Fehler beim Versand über konfigurierten SMTP-Server:", smtpErr);
        return res.status(500).json({
          success: false,
          error: `SMTP-Versand fehlgeschlagen: ${smtpErr.message || "Verbindung zum SMTP-Server unterbrochen."}`,
        });
      }
    }

    // Ohne hinterlegte Zugangsdaten kann der Server nichts verschicken.
    //
    // Frühere Fassungen meldeten hier "Versandauftrag erfasst" und gaben
    // success: true zurück. In der Oberfläche erschien daraufhin eine grüne
    // Erfolgsmeldung, obwohl keine einzige Mail das Haus verlassen hatte. Bei
    // einer Einladung zur Mitgliederversammlung kann das teuer werden: Der
    // Vorstand hält die Ladungsfrist für gewahrt, und die Versammlung ist
    // anfechtbar. Deshalb ist das hier jetzt ein klarer Fehlschlag.
    return res.status(400).json({
      success: false,
      error:
        "Es sind keine SMTP-Zugangsdaten hinterlegt, deshalb wurde nichts versendet. " +
        "Bitte unter Einstellungen → Vereinsstammdaten die Zugangsdaten zum Postfach eintragen. " +
        "Alternativ lässt sich die Nachricht über den Knopf \"Im E-Mail-Programm öffnen\" mit Thunderbird oder Outlook verschicken.",
    });
  } catch (error: any) {
    console.error("Fehler beim E-Mail-Versand:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Fehler beim E-Mail-Versand.",
    });
  }
});

// Vite middleware & SPA serving
async function startServer() {
  // Ein /api/-Aufruf, den es nicht gibt, muss als solcher erkennbar sein.
  // Ohne diese Zeilen fiele er unten in die SPA-Weiche und bekäme die
  // HTML-Startseite zurück; in der App käme dann die verwirrende Meldung
  // an, die Antwort des Servers sei kein gültiges JSON. Diese Weiche muss
  // hinter allen echten /api/-Routen und vor der Auslieferung der
  // Oberfläche stehen.
  app.use("/api", (req, res) => {
    res.status(404).json({
      success: false,
      error: `Unbekannter Server-Endpunkt: ${req.method} ${req.originalUrl}`,
    });
  });

  if (process.env.NODE_ENV !== "production") {
    // Vite wird bewusst erst HIER geladen und nicht oben als normaler
    // Import. Vite ist ein reines Entwicklungswerkzeug und steckt im
    // fertigen Container nicht mit drin. Stünde der Import oben, würde
    // Node ihn beim Start immer ausführen — auch im Produktivbetrieb,
    // wo es das Paket nicht gibt. Der Server käme dann gar nicht erst
    // hoch, mit der Meldung "Cannot find module 'vite'".
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Wo liegt die gebaute Oberfläche?
    //
    // Im Docker-Betrieb und beim Start aus dem Projektordner liegt sie unter
    // "dist" neben dem Arbeitsverzeichnis. In der Desktop-Fassung startet der
    // Server aber als mitgeliefertes Programm, und das Arbeitsverzeichnis ist
    // dann unvorhersehbar. Deshalb wird zuerst neben der Server-Datei selbst
    // gesucht und erst danach im Arbeitsverzeichnis.
    //
    // __dirname gibt es nur in der gebauten Fassung (esbuild erzeugt CommonJS).
    // Beim Entwickeln mit tsx läuft die Datei als ES-Modul, dort fehlt es —
    // deshalb die Abfrage.
    const eigenerOrdner = typeof __dirname !== "undefined" ? __dirname : process.cwd();
    const nebenDerServerDatei = path.join(eigenerOrdner, "dist");
    const distPath = fs.existsSync(path.join(nebenDerServerDatei, "index.html"))
      ? nebenDerServerDatei
      : path.join(process.cwd(), "dist");

    console.log(`Oberfläche wird ausgeliefert aus: ${distPath}`);

    app.use(
      express.static(distPath, {
        setHeaders: (res, filePath) => {
          // Alles in dist/assets/ trägt eine Prüfsumme im Dateinamen.
          // Ändert sich der Inhalt, ändert sich der Name — solche
          // Dateien darf der Browser beliebig lange behalten.
          if (filePath.includes(`${path.sep}assets${path.sep}`)) {
            res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
          } else {
            // Alles andere (vor allem index.html) jedes Mal neu
            // erfragen. Sonst sehen Anwender nach einem Update
            // wochenlang die alte Fassung.
            res.setHeader("Cache-Control", "no-cache");
          }
        },
      })
    );
    app.get("*", (req, res) => {
      res.setHeader("Cache-Control", "no-cache");
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  starteLauscher(PORT, 10);
}

/**
 * Nimmt den Betrieb auf einem Port auf — und weicht aus, wenn er belegt ist.
 *
 * Das Ausweichen ist für die Desktop-Fassung nötig: Dort startet der Server
 * mit dem Programm, und Port 3000 kann von etwas ganz anderem belegt sein.
 * Ohne Ausweichen bliebe die Anwendung schwarz, und niemand wüsste warum.
 *
 * Die letzte Zeile der Startausgabe ist bewusst maschinenlesbar:
 *
 *     VM_SERVER_BEREIT http://127.0.0.1:3000/#zugriff=<schlüssel>
 *
 * Die Desktop-Fassung wartet auf genau diese Zeile und öffnet ihr Fenster auf
 * der genannten Adresse — sonst zeigte sie eine Fehlerseite, weil der Server
 * noch startet.
 *
 * Der angehängte Zugriffsschlüssel ist der Grund, warum in der Desktop-Fassung
 * niemand etwas eintippen muss: Die Oberfläche liest ihn beim Start aus der
 * Adresse aus, merkt ihn sich und entfernt ihn wieder (siehe
 * src/services/apiClient.ts). Genau denselben Weg nimmt das Startskript für
 * den Browser-Betrieb.
 *
 * Er steht bewusst hinter dem Doppelkreuz: Alles danach ist ein "Fragment" und
 * wird vom Browser NICHT an den Server geschickt. Der Schlüssel taucht deshalb
 * in keinem Zugriffsprotokoll auf.
 *
 * Angehängt wird er nur, wenn der Server allein auf dem eigenen Rechner
 * lauscht. Im Docker-Betrieb bliebe die Zeile sonst mitsamt Schlüssel in den
 * Protokollen stehen.
 */
function starteLauscher(port: number, versucheUebrig: number): void {
  const lauscher = app.listen(port, HOST, () => {
    console.log(`VereinsManager Server running on ${HOST}:${port}`);

    // Der Zugriffsschlüssel wird beim Start ausgegeben, weil es sonst keinen
    // Weg gäbe, an ihn heranzukommen: Im Docker-Betrieb liegt die
    // Konfigurationsdatei im Volume, und niemand öffnet dort eine Datei. Wer
    // die Ausgabe des Servers lesen kann, hat ohnehin Zugriff auf den Server.
    if (zugriffsschluessel.quelle === "umgebung") {
      console.log("Zugriffsschlüssel: aus VM_ACCESS_KEY übernommen.");
    } else {
      console.log("");
      console.log("  Zugriffsschlüssel dieser Installation:");
      console.log(`      ${zugriffsschluessel.key}`);
      console.log("");
      console.log("  Wird in der Desktop-Fassung und beim Start über das mitgelieferte");
      console.log("  Skript automatisch übergeben. Nur wenn die App von einem anderen");
      console.log("  Rechner aus geöffnet wird (Docker, NAS), ist er dort einmalig unter");
      console.log("  Einstellungen → Allgemein einzutragen.");
      if (zugriffsschluessel.neuErzeugt) {
        console.log("  (soeben neu erzeugt)");
      }
      console.log("");
    }

    if (!cloudPruefer) {
      console.log(
        "Hinweis: SUPABASE_URL und SUPABASE_ANON_KEY sind auf dem Server nicht " +
          "gesetzt. Anmeldetoken aus dem Cloud-Betrieb können deshalb nicht geprüft " +
          "werden; es gilt allein der Zugriffsschlüssel."
      );
    }

    // Muss die letzte Zeile sein: Die Desktop-Fassung wartet darauf.
    const fensterAdresse = NUR_EIGENER_RECHNER
      ? `http://127.0.0.1:${port}/#zugriff=${encodeURIComponent(zugriffsschluessel.key)}`
      : `http://127.0.0.1:${port}`;
    console.log(`VM_SERVER_BEREIT ${fensterAdresse}`);
  });

  lauscher.on("error", (fehler: NodeJS.ErrnoException) => {
    if (fehler.code === "EADDRINUSE" && versucheUebrig > 0) {
      console.warn(`Port ${port} ist belegt — versuche es mit ${port + 1}.`);
      starteLauscher(port + 1, versucheUebrig - 1);
      return;
    }
    console.error("Der Server konnte nicht gestartet werden:", fehler);
    process.exit(1);
  });
}

startServer();
