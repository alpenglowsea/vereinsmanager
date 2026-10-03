import express from "express";
import compression from "compression";
import path from "path";
import fs from "node:fs";
import crypto from "node:crypto";
import { RateLimiter } from "./src/utils/rateLimit";
import { readAccessKey } from "./src/server/instanceConfig";
import {
  ZUGRIFF_HEADER,
  pruefeZugriff,
  erstelleCloudPruefer,
} from "./src/server/apiAuth";
import {
  listMembers,
  getMember,
  createMember,
  updateMember,
  deleteMember,
} from "./src/server/db/repositories/members";
import {
  SITZUNG_HEADER,
  ersteEinrichtung,
  anmelden,
  abmelden,
  pruefeSitzung,
  istEinrichtungAusstehend,
  passwortZuruecksetzen,
} from "./src/server/localAuth";
import {
  createUser as legeBenutzerAn,
  listUsers as listeBenutzer,
  setActive as setzeBenutzerAktiv,
  setPassword as setzeBenutzerPasswort,
  setPermissions as setzeBenutzerRechte,
  verifyCredentials as pruefeZugangsdaten,
  BenutzerAnlegenFehler,
} from "./src/server/db/repositories/localUsers";
import { canView, canEdit, AREA_LABEL } from "./src/utils/permissions";
import type { PermissionArea } from "./src/types";
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
// Eng begrenzt wie bremseMeldung: "Passwort vergessen" ist ein
// sicherheitsrelevanter Vorgang, auch wenn die Antwort inzwischen für jede
// Adresse identisch ausfällt — keine 20 oder gar 120 Versuche je Stunde.
const bremsePasswortReset = new RateLimiter({ limit: 5, windowMs: STUNDE });

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


// ---------------------------------------------------------------------------
// Eigener Server (Betriebsart 3): lokale Datenhaltung in SQLite
// ---------------------------------------------------------------------------
//
// Umbau aus der Übergabe: Wer nicht bei Supabase arbeiten will, soll seine
// Vereinsdaten stattdessen auf diesem Server selbst halten können — in einer
// einzigen Datei, ohne fremden Anbieter.
//
// Seit Stufe 2 kennt dieser Server dafür eigene Benutzerkonten (siehe
// src/server/localAuth.ts). Zum bestehenden Zugriffsschlüssel der
// Installation (siehe oben, "Zugriffsschutz") kommt für die Routen unter
// /api/local-server/* jetzt eine zweite Hürde: eine gültige Anmeldung. Der
// Zugriffsschlüssel entscheidet weiterhin "darf diese Anfrage den Server
// überhaupt erreichen", die Anmeldung zusätzlich "als wer".
//
// Seit Stufe 3 kommt als dritte Hürde die Rechteprüfung selbst dazu
// (erfordertRecht unten): Angemeldet zu sein reicht jetzt nicht mehr, das
// Konto muss laut seinen Berechtigungen (local_users.permissions, dieselben
// 18 Bereiche wie in der Oberfläche von Betriebsart 1/2, siehe
// utils/permissions.ts) auch das jeweilige Mindestrecht haben. Zwei Routen
// bleiben davon ausgenommen, weil sie nicht "was darf dieses Konto", sondern
// "wer ist dieses Konto" beantworten — Selbstauskunft und Passwortänderung
// prüft niemand gegen einen Bereich, jedes angemeldete Konto darf beides mit
// sich selbst.
//
// Die Datenbankdatei entsteht dabei bewusst erst beim ERSTEN Aufruf einer
// dieser Routen (getLocalDb() öffnet sie beim ersten Zugriff, siehe
// src/server/db/localDb.ts). Ein Verein, der Betriebsart 1 (lokal im
// Browser) oder 2 (Supabase) nutzt und diese Routen nie aufruft, bekommt
// also auch nie eine "daten/vereinsdaten.sqlite" angelegt.
//
// Absichtlich noch OHNE dass die Oberfläche diese Routen überhaupt kennt —
// das folgt erst in einer späteren Stufe, wenn eine dritte Betriebsart
// tatsächlich auswählbar wird. Bis dahin ist das hier ein für sich
// funktionsfähiges, aber noch unsichtbares Fundament.

/**
 * Verlangt eine gültige Sitzung (siehe SITZUNG_HEADER). Hängt bei Erfolg den
 * angemeldeten Benutzer als `lokalerBenutzer` an die Anfrage — Routen, die
 * wissen müssen, wer da schreibt (z. B. "Passwort ändern"), lesen es dort.
 */
function erfordertAnmeldung(req: express.Request, res: express.Response, next: express.NextFunction) {
  const befund = pruefeSitzung(req.headers[SITZUNG_HEADER]);
  if (!befund.angemeldet || !befund.benutzer) {
    return res.status(401).json({ success: false, error: befund.grund, code: "ANMELDUNG_ERFORDERLICH" });
  }
  (req as any).lokalerBenutzer = befund.benutzer;
  next();
}

/**
 * Verlangt zusätzlich das angegebene Mindestrecht in einem der 18 Bereiche
 * (AREA_DEFINITIONS in utils/permissions.ts) — muss auf jeder Route HINTER
 * erfordertAnmeldung stehen, weil sie (req as any).lokalerBenutzer liest,
 * das erst dort gesetzt wird.
 *
 * "view" lässt auch ein Konto mit "edit" in diesem Bereich durch (canView
 * ist so gebaut, siehe utils/permissions.ts) — wer bearbeiten darf, darf
 * auch lesen.
 */
function erfordertRecht(bereich: PermissionArea, mindestens: "view" | "edit") {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const benutzer = (req as any).lokalerBenutzer;
    const erlaubt =
      mindestens === "edit" ? canEdit(benutzer.permissions, bereich) : canView(benutzer.permissions, bereich);
    if (!erlaubt) {
      return res.status(403).json({
        success: false,
        error: `Für "${AREA_LABEL[bereich]}" fehlt die Berechtigung.`,
        code: "RECHT_FEHLT",
      });
    }
    next();
  };
}

/**
 * Sagt der Oberfläche, ob sie die Ersteinrichtungsmaske oder die normale
 * Anmeldemaske zeigen soll — ohne Anmeldung abrufbar (dafür gibt es ja noch
 * gar kein Konto, im ausstehenden Fall), aber wie jede /api-Route weiterhin
 * hinter dem Zugriffsschlüssel der Installation (siehe "Zugriffsschutz"
 * oben, das gilt global für alles unter /api).
 */
app.get("/api/local-server/auth/status", (_req, res) => {
  return res.json({ success: true, setupPending: istEinrichtungAusstehend() });
});

app.post("/api/local-server/auth/setup", async (req, res) => {
  try {
    const { email, name, password } = req.body ?? {};
    if (typeof email !== "string" || typeof name !== "string" || typeof password !== "string") {
      return res.status(400).json({ success: false, error: "E-Mail-Adresse, Name und Passwort werden benötigt." });
    }
    const ergebnis = await ersteEinrichtung({ email, name, password });
    if (!ergebnis.erfolg || !ergebnis.benutzer || !ergebnis.sitzungsToken) {
      return res.status(400).json({ success: false, error: ergebnis.grund });
    }
    return res.status(201).json({
      success: true,
      user: ergebnis.benutzer,
      sessionToken: ergebnis.sitzungsToken,
    });
  } catch (error: any) {
    if (error instanceof BenutzerAnlegenFehler) {
      return res.status(400).json({ success: false, error: error.message });
    }
    console.error("Fehler bei der Ersteinrichtung des eigenen Servers:", error);
    return res.status(500).json({ success: false, error: error.message || "Die Einrichtung ist fehlgeschlagen." });
  }
});

app.post("/api/local-server/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body ?? {};
    if (typeof email !== "string" || typeof password !== "string") {
      return res.status(400).json({ success: false, error: "E-Mail-Adresse und Passwort werden benötigt." });
    }
    const ergebnis = await anmelden(email, password);
    if (!ergebnis.erfolg || !ergebnis.benutzer || !ergebnis.sitzungsToken) {
      return res.status(401).json({ success: false, error: ergebnis.grund });
    }
    return res.json({ success: true, user: ergebnis.benutzer, sessionToken: ergebnis.sitzungsToken });
  } catch (error: any) {
    console.error("Fehler bei der Anmeldung am eigenen Server:", error);
    return res.status(500).json({ success: false, error: error.message || "Die Anmeldung ist fehlgeschlagen." });
  }
});

/**
 * POST /api/local-server/auth/request-password-reset
 * ---------------------------------------------------------------------------
 * "Passwort vergessen" — für JEDES Konto auf diesem Server, nicht nur für
 * den Vorstand: Es gibt keinen Weg zurück ins eigene Konto außer der eigenen
 * Erinnerung ans Passwort (siehe PUT .../auth/password, das ein bekanntes
 * Passwort voraussetzt) oder einem anderen Konto mit dem Recht
 * "Benutzer & Rechte", das aber nur die Berechtigungen ändern kann, nicht
 * das Passwort selbst.
 *
 * Diese Version kennt keinen E-Mail-Versand mehr (siehe Entfernung von
 * SMTP). Ein Link per E-Mail ließe sich also ohnehin nie verschicken — die
 * Route bleibt deshalb bestehen, antwortet aber immer mit derselben
 * ehrlichen Auskunft, statt stillschweigend zu verschwinden und der
 * Oberfläche einen unerklärten 404 zu liefern. Das Antwortverhalten bleibt
 * bewusst UNABHÄNGIG davon, ob "email" zu einem Konto gehört — sonst ließe
 * sich allein über diese Route prüfen, welche Adressen existieren.
 */
app.post(
  "/api/local-server/auth/request-password-reset",
  bremse(bremsePasswortReset, "Passwort-Zurücksetzen"),
  async (req, res) => {
    try {
      const { email } = req.body ?? {};
      if (typeof email !== "string" || !email.trim() || !email.includes("@")) {
        return res.status(400).json({ success: false, error: "Bitte eine gültige E-Mail-Adresse angeben." });
      }

      return res.status(400).json({
        success: false,
        code: "KEIN_EMAIL_VERSAND",
        error:
          "Dieser Server kann keine E-Mails mehr versenden. Ein Zurücksetzen per Link ist deshalb nicht möglich " +
          "— bitte an ein Vorstandsmitglied mit Zugriff auf die Servereinstellungen wenden.",
      });
    } catch (error: any) {
      console.error("Fehler bei /api/local-server/auth/request-password-reset:", error);
      return res.status(500).json({ success: false, error: "Unerwarteter Fehler." });
    }
  }
);

/**
 * POST /api/local-server/auth/reset-password
 * Löst einen per E-Mail verschickten Link ein und setzt das neue Passwort.
 */
app.post(
  "/api/local-server/auth/reset-password",
  bremse(bremsePasswortReset, "Passwort-Zurücksetzen"),
  async (req, res) => {
    try {
      const { token, newPassword } = req.body ?? {};
      if (typeof token !== "string" || !token.trim()) {
        return res.status(400).json({ success: false, error: "Der Link ist unvollständig oder ungültig." });
      }
      if (typeof newPassword !== "string" || !newPassword) {
        return res.status(400).json({ success: false, error: "Bitte ein neues Passwort angeben." });
      }

      const ergebnis = await passwortZuruecksetzen(token.trim(), newPassword);
      if (!ergebnis.erfolg) {
        return res.status(400).json({ success: false, error: ergebnis.grund });
      }
      return res.json({ success: true, message: "Das Passwort wurde geändert. Sie können sich jetzt damit anmelden." });
    } catch (error: any) {
      console.error("Fehler bei /api/local-server/auth/reset-password:", error);
      return res.status(500).json({ success: false, error: "Unerwarteter Fehler." });
    }
  }
);

app.post("/api/local-server/auth/logout", (req, res) => {
  const token = req.headers[SITZUNG_HEADER];
  if (typeof token === "string" && token.trim()) {
    abmelden(token.trim());
  }
  // Auch ohne (noch) gültige Sitzung antwortet das mit Erfolg — nach einer
  // Abmeldung ist "schon abgemeldet" kein Fehler.
  return res.json({ success: true });
});

app.get("/api/local-server/auth/me", erfordertAnmeldung, (req, res) => {
  return res.json({ success: true, user: (req as any).lokalerBenutzer });
});

app.put("/api/local-server/auth/password", erfordertAnmeldung, async (req, res) => {
  try {
    const benutzer = (req as any).lokalerBenutzer;
    const { currentPassword, newPassword } = req.body ?? {};
    if (typeof currentPassword !== "string" || typeof newPassword !== "string") {
      return res.status(400).json({ success: false, error: "Bisheriges und neues Passwort werden benötigt." });
    }

    const pruefung = await pruefeZugangsdaten(benutzer.email, currentPassword);
    if (!pruefung.ok) {
      return res.status(401).json({ success: false, error: "Das bisherige Passwort ist nicht korrekt." });
    }

    await setzeBenutzerPasswort(benutzer.id, newPassword);
    // setzeBenutzerPasswort beendet dabei alle Sitzungen dieses Kontos,
    // auch die aktuelle (siehe repositories/localUsers.ts) — die Oberfläche
    // muss sich also mit dem neuen Passwort erneut anmelden.
    return res.json({
      success: true,
      message: "Passwort geändert. Bitte mit dem neuen Passwort erneut anmelden.",
    });
  } catch (error: any) {
    if (error instanceof BenutzerAnlegenFehler) {
      return res.status(400).json({ success: false, error: error.message });
    }
    console.error("Fehler beim Ändern eines Passworts (eigener Server):", error);
    return res.status(500).json({ success: false, error: error.message || "Das Passwort konnte nicht geändert werden." });
  }
});

app.get("/api/local-server/users", erfordertAnmeldung, erfordertRecht("users", "view"), (_req, res) => {
  try {
    return res.json({ success: true, users: listeBenutzer() });
  } catch (error: any) {
    console.error("Fehler beim Lesen der Benutzerliste (eigener Server):", error);
    return res.status(500).json({ success: false, error: error.message || "Die Benutzerliste konnte nicht gelesen werden." });
  }
});

/**
 * Legt ein weiteres Konto an. Verlangt "edit" im Bereich "users" — derselbe
 * Bereich, den die Oberfläche in Betriebsart 1/2 unter "Benutzer & Rechte"
 * zeigt (siehe AREA_DEFINITIONS in utils/permissions.ts).
 *
 * Neue Konten bekommen bewusst keine Rechte (ALL_AREAS_NONE) und müssen ihr
 * Anfangspasswort bei der ersten Anmeldung ändern (mustChangePassword) — der
 * Vorstand vergibt die passenden Rechte anschließend über die Route unten.
 */
app.post("/api/local-server/users", erfordertAnmeldung, erfordertRecht("users", "edit"), async (req, res) => {
  try {
    const { email, name, password, customRoleName } = req.body ?? {};
    if (typeof email !== "string" || typeof name !== "string" || typeof password !== "string") {
      return res.status(400).json({ success: false, error: "E-Mail-Adresse, Name und ein Anfangspasswort werden benötigt." });
    }
    const benutzer = await legeBenutzerAn({
      email,
      name,
      password,
      customRoleName: typeof customRoleName === "string" ? customRoleName : undefined,
      mustChangePassword: true,
    });
    return res.status(201).json({ success: true, user: benutzer });
  } catch (error: any) {
    if (error instanceof BenutzerAnlegenFehler) {
      return res.status(400).json({ success: false, error: error.message });
    }
    console.error("Fehler beim Anlegen eines Benutzers (eigener Server):", error);
    return res.status(500).json({ success: false, error: error.message || "Das Konto konnte nicht angelegt werden." });
  }
});

/**
 * Setzt die Berechtigungen eines bestehenden Kontos vollständig neu (alle
 * Bereiche auf einmal, siehe setPermissions in repositories/localUsers.ts).
 * Verlangt ebenfalls "edit" im Bereich "users".
 *
 * Seit der Rückmeldung von Johannes vom 27.09. mit eingebautem Schutz gegen
 * das versehentliche Sperren des letzten Kontos mit "users"-Rechten — siehe
 * die Prüfung in setPermissions() selbst (repositories/localUsers.ts), die
 * unabhängig von dieser Route greift.
 */
app.put("/api/local-server/users/:id/permissions", erfordertAnmeldung, erfordertRecht("users", "edit"), (req, res) => {
  try {
    const aktualisiert = setzeBenutzerRechte(req.params.id, req.body?.permissions);
    if (!aktualisiert) {
      return res.status(404).json({ success: false, error: `Kein Konto mit der id ${req.params.id}.` });
    }
    return res.json({ success: true, user: aktualisiert });
  } catch (error: any) {
    if (error instanceof BenutzerAnlegenFehler) {
      return res.status(400).json({ success: false, error: error.message });
    }
    console.error("Fehler beim Setzen von Berechtigungen (eigener Server):", error);
    return res.status(500).json({ success: false, error: error.message || "Die Berechtigungen konnten nicht gesetzt werden." });
  }
});

/**
 * Aktiviert oder deaktiviert ein Konto. Verlangt ebenfalls "edit" im Bereich
 * "users" — dasselbe Recht wie für die Rechtevergabe, weil eine Deaktivierung
 * denselben Schutzbedarf hat.
 *
 * Wer die Änderung vornimmt (der angemeldete Benutzer, nicht der aus der
 * URL) geht als drittes Argument in setActive() ein — dort sitzt die
 * Prüfung, dass sich niemand selbst deaktivieren kann.
 */
app.put("/api/local-server/users/:id/active", erfordertAnmeldung, erfordertRecht("users", "edit"), (req, res) => {
  try {
    const { isActive } = req.body ?? {};
    if (typeof isActive !== "boolean") {
      return res.status(400).json({ success: false, error: "isActive (true/false) wird benötigt." });
    }
    const ausfuehrender = (req as any).lokalerBenutzer;
    const aktualisiert = setzeBenutzerAktiv(req.params.id, isActive, ausfuehrender.id);
    if (!aktualisiert) {
      return res.status(404).json({ success: false, error: `Kein Konto mit der id ${req.params.id}.` });
    }
    return res.json({ success: true, user: aktualisiert });
  } catch (error: any) {
    if (error instanceof BenutzerAnlegenFehler) {
      return res.status(400).json({ success: false, error: error.message });
    }
    console.error("Fehler beim Sperren/Freigeben eines Kontos (eigener Server):", error);
    return res.status(500).json({ success: false, error: error.message || "Das Konto konnte nicht geändert werden." });
  }
});

app.get("/api/local-server/members", erfordertAnmeldung, erfordertRecht("members", "view"), (_req, res) => {
  try {
    return res.json({ success: true, members: listMembers() });
  } catch (error: any) {
    console.error("Fehler beim Lesen der Mitgliederliste (eigener Server):", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Die Mitgliederliste konnte nicht gelesen werden.",
    });
  }
});

app.get("/api/local-server/members/:id", erfordertAnmeldung, erfordertRecht("members", "view"), (req, res) => {
  try {
    const mitglied = getMember(req.params.id);
    if (!mitglied) {
      return res.status(404).json({ success: false, error: `Kein Mitglied mit der id ${req.params.id}.` });
    }
    return res.json({ success: true, member: mitglied });
  } catch (error: any) {
    console.error("Fehler beim Lesen eines Mitglieds (eigener Server):", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Das Mitglied konnte nicht gelesen werden.",
    });
  }
});

app.post("/api/local-server/members", erfordertAnmeldung, erfordertRecht("members", "edit"), (req, res) => {
  try {
    const eingabe = req.body ?? {};
    if (typeof eingabe.memberNumber !== "string" || !eingabe.memberNumber.trim()) {
      return res.status(400).json({ success: false, error: "Keine Mitgliedsnummer angegeben." });
    }
    if (typeof eingabe.firstName !== "string" || !eingabe.firstName.trim()) {
      return res.status(400).json({ success: false, error: "Kein Vorname angegeben." });
    }
    if (typeof eingabe.lastName !== "string" || !eingabe.lastName.trim()) {
      return res.status(400).json({ success: false, error: "Kein Nachname angegeben." });
    }
    if (typeof eingabe.entryDate !== "string" || !eingabe.entryDate.trim()) {
      return res.status(400).json({ success: false, error: "Kein Eintrittsdatum angegeben." });
    }
    if (typeof eingabe.department !== "string" || !eingabe.department.trim()) {
      return res.status(400).json({ success: false, error: "Keine Abteilung angegeben." });
    }

    const mitglied = createMember(eingabe);
    return res.status(201).json({ success: true, member: mitglied });
  } catch (error: any) {
    console.error("Fehler beim Anlegen eines Mitglieds (eigener Server):", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Das Mitglied konnte nicht angelegt werden.",
    });
  }
});

app.put("/api/local-server/members/:id", erfordertAnmeldung, erfordertRecht("members", "edit"), (req, res) => {
  try {
    const mitglied = updateMember(req.params.id, req.body ?? {});
    if (!mitglied) {
      return res.status(404).json({ success: false, error: `Kein Mitglied mit der id ${req.params.id}.` });
    }
    return res.json({ success: true, member: mitglied });
  } catch (error: any) {
    console.error("Fehler beim Ändern eines Mitglieds (eigener Server):", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Das Mitglied konnte nicht geändert werden.",
    });
  }
});

app.delete("/api/local-server/members/:id", erfordertAnmeldung, erfordertRecht("members", "edit"), (req, res) => {
  try {
    const geloescht = deleteMember(req.params.id);
    if (!geloescht) {
      return res.status(404).json({ success: false, error: `Kein Mitglied mit der id ${req.params.id}.` });
    }
    return res.json({ success: true });
  } catch (error: any) {
    console.error("Fehler beim Löschen eines Mitglieds (eigener Server):", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Das Mitglied konnte nicht gelöscht werden.",
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
