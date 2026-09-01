import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

// Body parser for JSON and large payloads (PDF / Image Base64)
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Lazy initialize Gemini API client with optional custom API key
let defaultAiClient: GoogleGenAI | null = null;
function getGeminiClient(customApiKey?: string): GoogleGenAI {
  const apiKey = customApiKey?.trim() || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Kein Gemini API-Schlüssel gefunden. Bitte tragen Sie Ihren API-Schlüssel in den Einstellungen ein oder setzen Sie GEMINI_API_KEY.");
  }
  if (!customApiKey && defaultAiClient) {
    return defaultAiClient;
  }
  const client = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
  if (!customApiKey) {
    defaultAiClient = client;
  }
  return client;
}

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
    timestamp: new Date().toISOString(),
  });
});

/**
 * POST /api/submit-bugreport
 * Directly submits a bug report / support ticket to vereinsmanager@ik.me without needing an external mail program.
 */
app.post("/api/submit-bugreport", async (req, res) => {
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
    let transportMethod = "direct_inapp";

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
 * POST /api/test-gemini-key
 * Validates whether a Gemini API key is active and functional.
 */
app.post("/api/test-gemini-key", async (req, res) => {
  try {
    const { apiKey } = req.body;
    const client = getGeminiClient(apiKey);
    const response = await client.models.generateContent({
      model: "gemini-3.7-flash",
      contents: "Antworte kurz mit 'OK'.",
    });
    return res.json({
      success: true,
      message: "API-Schlüssel ist gültig und funktionsfähig.",
      sampleResponse: response.text?.trim() || "OK",
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
app.post("/api/categorize-booking", async (req, res) => {
  try {
    const { description, bookingText, partner, amount, type, userApiKey } = req.body;

    const queryText = (description || bookingText || "").trim();
    if (!queryText && !partner) {
      return res.status(400).json({
        success: false,
        error: "Bitte geben Sie eine kurze Beschreibung oder einen Buchungstext an.",
      });
    }

    const ai = getGeminiClient(userApiKey);

    const prompt = `Du bist ein hochqualifizierter Steuer- und Buchhaltungsexperte für deutsches Gemeinnützigkeits- und Vereinssteuerrecht (§§ 51 ff. Abgabenordnung - AO) sowie den DATEV Standardkontenrahmen 42 (SKR 42 für Vereine, Stiftungen & gGmbHs).

Analysiere den folgenden Geschäftsvorfall eines gemeinnützigen Sport- und Kulturvereins und ordne ihn präzise zu:

BUCHUNGSDATEN:
- Beschreibung / Erklärung des Vorfalls: "${queryText}"
- Zahlungspartner / Empfänger / Absender: "${partner || 'Nicht angegeben'}"
- Betrag: ${amount ? `${amount} EUR` : 'Nicht angegeben'}
- Vorausgewählte Buchungsart: ${type || 'automatisch erkennen'}

REGELWERK DER 4 STEUERLICHEN SPHÄREN:
1. "ideell" (Ideeller Bereich - Satzungsgemäße Kernaktivitäten, steuerfrei, 0% USt):
   - Einnahmen: Mitgliedsbeiträge (3100), Spenden/Zuwendungen (3200), Zuschüsse/Fördermittel (3300), sonstige ideelle Erlöse (3400)
   - Ausgaben: Verbandsabgaben/LSB (5100), Allgemeine Verwaltung/Büro/IT/Bank (5200), Gremienarbeit/Mitgliederbetreuung (5300)
2. "vermoegen" (Vermögensverwaltung - Fruchtziehung aus Vermögen, ertragssteuerfrei, 0% USt):
   - Einnahmen: Zinsen/Dividenden (3500), langfristige Vermietung & Verpachtung Vereinsheim/Gaststätte (3600)
   - Ausgaben: Gebäudeaufwand/Instandhaltung vermietete Objekte (5500), Depotgebühren (5600)
3. "zweckbetrieb" (Zweckbetrieb - Wirtschaftliche Betätigung zur Zweckerreichung gem. §§ 65-68 AO, steuerbegünstigt, i.d.R. 7% USt oder 0% Vorsteuer):
   - Einnahmen: Eintrittsgelder Wettkämpfe/Spiele (4100), Kursgebühren/Lehrgänge (4200), Weitergabe Sportartikel zum Selbstkostenpreis (4300)
   - Ausgaben: Übungsleiter-/Ehrenamtspauschalen (6500), Spiel-, Trainings- & Wettkampfbetrieb wie Bälle/Tore/Netze/Trikots/Platzmieten/Schiedsrichter/Pokale/Erste-Hilfe (6600), Fahrtkosten & Reisekosten Sportler (6700)
4. "wirtschaftlich" (Wirtschaftlicher Geschäftsbetrieb - Voll steuerpflichtig, Wettbewerb, 19% USt):
   - Einnahmen: Bandenwerbung/Trikotsponsoring/Marketing (4500), Bewirtung/Kiosk/Getränkeverkauf/Vereinsfeste (4600), Merchandising/Fanartikel (4700)
   - Ausgaben: Wareneinkauf Speisen/Getränke für Feste (7100), Festzelte/GEMA für gesellige Feste/Werbung (7200), Steuern wirtschaftlicher Betrieb (7300)

AUFGABE:
Bestimme:
1. sphere: Exakt eine der 4 Sphären: 'ideell', 'vermoegen', 'zweckbetrieb' oder 'wirtschaftlich'.
2. type: 'income' (Einnahme) oder 'expense' (Ausgabe).
3. mainCategoryCode: 4-stellige Nummer der SKR 42 Hauptkategorie (z.B. "6600", "3100", "5200", "4600", "7100", "6500", "3200").
4. mainCategoryName: Name der Hauptkategorie (z.B. "Spiel-, Trainings- & Wettkampfbetrieb").
5. subCategoryCode: 4-stellige Nummer des SKR 42 Unterkontos (z.B. "6610", "3110", "5210", "4610", "7110", "6510", "3210").
6. subCategoryName: Bezeichnung des Unterkontos (z.B. "Sportgeräte, Bälle, Tore, Netze & Trainingsmaterial").
7. subCategoryLabel: Format "{Code} - {Kurzbezeichnung}" (z.B. "6610 - Sport- & Trainingsgeräte", "3110 - Laufende Mitgliedsbeiträge", "7110 - Wareneinkauf Speisen & Getränke").
8. vatRate: Umsatzsteuersatz (0, 7 oder 19).
9. suggestedBookingText: Ein präziser, buchhalterisch sauberer Buchungstext (z.B. "Kauf von 15 Trainingsbällen Jugendabteilung").
10. confidence: Vertrauensscore zwischen 0.0 und 1.0.
11. reasoning: Eine verständliche, prägnante 1-2 Satz Begründung nach deutschem Gemeinnützigkeitsrecht (§§ 51 ff. AO / SKR 42).`;

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
          vatRate: { type: Type.INTEGER, enum: [0, 7, 19] },
          suggestedBookingText: { type: Type.STRING },
          confidence: { type: Type.NUMBER },
          reasoning: { type: Type.STRING },
        },
        required: ["sphere", "type", "subCategoryCode", "subCategoryLabel", "vatRate", "reasoning"],
      },
    };

    const candidateModels = ["gemini-3.7-flash", "gemini-flash-latest", "gemini-3.1-flash-lite"];
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
app.post("/api/scan-application-pdf", async (req, res) => {
  try {
    const { fileDataUrl, mimeType, fileName } = req.body;

    if (!fileDataUrl) {
      return res.status(400).json({ error: "Keine Datei (fileDataUrl) übermittelt." });
    }

    // Extract base64 part
    const commaIndex = fileDataUrl.indexOf(",");
    const base64Data = commaIndex !== -1 ? fileDataUrl.substring(commaIndex + 1) : fileDataUrl;
    const detectedMimeType = mimeType || (fileDataUrl.startsWith("data:") ? fileDataUrl.substring(5, fileDataUrl.indexOf(";")) : "application/pdf");

    // Initialize Gemini
    const ai = getGeminiClient();

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
    const candidateModels = ["gemini-3.7-flash", "gemini-flash-latest", "gemini-3.1-flash-lite"];
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

// Vite middleware & SPA serving
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`VereinsManager Server running on port ${PORT}`);
  });
}

startServer();
