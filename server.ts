import express from "express";
import compression from "compression";
import path from "path";
import fs from "node:fs";
import crypto from "node:crypto";
import { RateLimiter } from "./src/utils/rateLimit";
import { readAccessKey } from "./src/server/instanceConfig";
import { ZUGRIFF_HEADER, pruefeZugriff } from "./src/server/apiAuth";
import dotenv from "dotenv";

dotenv.config();

// Exportiert (nur) für src/server/serverRoutes.test.ts: Echte Tests gegen
// die tatsächlichen Routen brauchen Zugriff auf "app", ohne dabei über
// startServer() weiter unten einen echten Port zu belegen oder einen
// Vite-Entwicklungsserver zu starten — siehe die Bedingung um den Aufruf von
// startServer() am Dateiende.
export const app = express();
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
// Der Zugriffsschlüssel weiter unten ("Zugriffsschutz") hält Fremde
// draussen, unterscheidet aber niemanden voneinander, der ihn kennt — und
// diese Ratenbegrenzung hier greift zusätzlich, unabhängig davon, WER
// aufruft.
//
//   allgemein — schützt den Server davor, unter Last zusammenzubrechen
const MINUTE = 60_000;
const STUNDE = 60 * MINUTE;

const bremseAllgemein = new RateLimiter({ limit: 120, windowMs: 5 * MINUTE });
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
// Einzelheiten zum Zugriffsschlüssel: src/server/apiAuth.ts

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

app.use("/api", (req, res, next) => {
  if (req.path === "/health") {
    next();
    return;
  }

  pruefeZugriff(
    {
      zugriffsschluessel: req.headers[ZUGRIFF_HEADER],
    },
    zugriffsschluessel.key
  )
    .then((ergebnis) => {
      if (ergebnis.erlaubt) {
        next();
        return;
      }
      // Der Statuscode bleibt für alle Ablehnungen 401. Aktuell gibt es nur
      // einen Ablehnungsgrund (ZUGRIFF_VERWEIGERT); der "code" bleibt trotzdem
      // im Antwortkörper, falls künftig weitere Fälle hinzukommen.
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

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
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

// ---------------------------------------------------------------------------
// Prüf-Route für den Zugriffsschlüssel
// ---------------------------------------------------------------------------
//
// Bis einschliesslich Schritt 3 der Vereinfachung gab es hier den ganzen
// eigenen Server-Betrieb (Betriebsart 3: Benutzerkonten samt Rechten in
// einer eigenen SQLite-Datenbank, siehe src/server/localAuth.ts und
// src/server/db/*). Diese Betriebsart entfällt — ihr einziger praktischer
// Nutzen war eine Anmeldesperre vor der Oberfläche; die eigentlichen
// Vereinsdaten lagen schon vorher, genau wie im reinen Lokalbetrieb, nur im
// Browser der jeweiligen Person (siehe die Entfernung dieser Betriebsart in
// der Übergabe).
//
// Übrig bleibt der Bedarf von src/components/ServerAccessKeyPanel.tsx: Die
// Oberfläche muss irgendeine geschützte Route abfragen können, um zu sehen,
// ob der im Browser hinterlegte Zugriffsschlüssel vom Server überhaupt noch
// anerkannt wird. Der Inhalt der Antwort spielt dafür keine Rolle — wichtig
// ist nur, dass "Zugriffsschutz" oben die Anfrage ohne gültigen Schlüssel
// gar nicht erst bis hierher durchlässt.
app.get("/api/access-check", (_req, res) => {
  res.json({ success: true });
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

// VM_TEST_NO_LISTEN ist ausschließlich für serverRoutes.test.ts gedacht,
// genau wie VM_DATA_DIR es bereits ist (siehe dort). Ohne diese Bedingung
// würde schon das bloße Importieren dieser Datei in einem Test einen echten
// Netzwerk-Port belegen und einen Vite-Entwicklungsserver hochfahren — beides
// unerwünscht und bei parallel laufenden Testdateien eine Quelle für
// Port-Kollisionen. Jeder bisherige Startweg (npm run dev, der gebaute
// Server, die Desktop-Fassung) setzt diese Variable nicht und startet
// deshalb unverändert wie zuvor.
if (process.env.VM_TEST_NO_LISTEN !== "1") {
  startServer();
}
