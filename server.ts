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

// Lazy initialize Gemini API client
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is not configured.");
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
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
