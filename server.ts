import express from "express";
import compression from "compression";
import path from "path";
import fs from "node:fs";
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

// Der Server liefert nur die Oberfläche aus; API-Adressen gibt es keine
// mehr. Die frühere Ratenbegrenzung für /api und die Annahme großer
// Anfragen sind deshalb entfernt (Code-Prüfung 24.11.2026).

// Vite middleware & SPA serving
async function startServer() {
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
