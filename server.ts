import express from "express";
import compression from "compression";
import path from "path";
import fs from "node:fs";
import { RateLimiter } from "./src/utils/rateLimit";
import dotenv from "dotenv";

dotenv.config();

// Exportiert für Tests gegen die tatsächlichen Routen, die Zugriff auf "app"
// brauchen, ohne dabei über startServer() weiter unten einen echten Port zu
// belegen oder einen Vite-Entwicklungsserver zu starten — siehe die
// Bedingung um den Aufruf von startServer() am Dateiende (VM_TEST_NO_LISTEN).
// Derzeit nutzt kein Test diesen Export mehr (sein einziger Verwender,
// serverRoutes.test.ts, testete ausschließlich den jetzt entfernten
// Zugriffsschlüssel) — bewusst stehen gelassen für einen künftigen
// Routen-Test.
export const app = express();
// Port aus der Umgebung übernehmen, falls 3000 auf diesem Rechner schon
// belegt ist, sonst 3000 als Standard.
const PORT = Number(process.env.PORT) || 3000;

// Auf welcher Netzwerkadresse gelauscht wird.
//
// Es gibt nur die eine Betriebsart: ein Server, der ausschließlich auf dem
// eigenen Rechner läuft und ausschließlich von dort erreichbar ist. "Vom
// eigenen Rechner" heißt technisch "127.0.0.1" — niemand sonst im Netzwerk
// bekommt überhaupt eine Verbindung zustande.
const HOST = "127.0.0.1";

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
// Der Server nimmt nur von diesem einen Rechner Anfragen an (siehe HOST
// oben). Diese Ratenbegrenzung greift zusätzlich — unabhängig davon, WER
// aufruft.
//
//   allgemein — schützt den Server davor, unter Last zusammenzubrechen
const MINUTE = 60_000;
const STUNDE = 60 * MINUTE;

const bremseAllgemein = new RateLimiter({ limit: 120, windowMs: 5 * MINUTE });
const bremseMeldung   = new RateLimiter({ limit: 5,   windowMs: STUNDE });

// Die Kennung des Absenders. Da der Server nur auf 127.0.0.1 lauscht, ist das
// in der Praxis immer dieselbe Adresse — die Zählung dient trotzdem als
// zusätzliche Bremse. Sie wird nur im Arbeitsspeicher gezählt und nirgends
// gespeichert.
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

// Gilt für alles unter /api.
app.use("/api", (req, res, next) => {
  bremse(bremseAllgemein, "allgemein")(req, res, next);
});

// Body parser for JSON and large payloads (PDF / Image Base64)
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

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
      Betriebsmodus: "Lokal",
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
    // Beim Start aus dem Projektordner liegt sie unter "dist" neben dem
    // Arbeitsverzeichnis. In der Desktop-Fassung startet der Server aber als
    // mitgeliefertes Programm, und das Arbeitsverzeichnis ist dann
    // unvorhersehbar. Deshalb wird zuerst neben der Server-Datei selbst
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
 *     VM_SERVER_BEREIT http://127.0.0.1:3000/
 *
 * Die Desktop-Fassung wartet auf genau diese Zeile und öffnet ihr Fenster auf
 * der genannten Adresse — sonst zeigte sie eine Fehlerseite, weil der Server
 * noch startet. Genau denselben Weg nimmt das Startskript für den
 * Browser-Betrieb.
 */
function starteLauscher(port: number, versucheUebrig: number): void {
  const lauscher = app.listen(port, HOST, () => {
    console.log(`VereinsManager Server running on ${HOST}:${port}`);

    // Muss die letzte Zeile sein: Die Desktop-Fassung wartet darauf.
    console.log(`VM_SERVER_BEREIT http://127.0.0.1:${port}/`);
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

// VM_TEST_NO_LISTEN ist für einen Test gedacht, der server.ts importiert, um
// gegen die echten /api-Routen zu prüfen, ohne dabei einen echten
// Netzwerk-Port zu belegen oder einen Vite-Entwicklungsserver hochzufahren —
// beides unerwünscht und bei parallel laufenden Testdateien eine Quelle für
// Port-Kollisionen. Jeder bisherige Startweg (npm run dev, der gebaute
// Server, die Desktop-Fassung) setzt diese Variable nicht und startet
// deshalb unverändert wie zuvor.
if (process.env.VM_TEST_NO_LISTEN !== "1") {
  startServer();
}
