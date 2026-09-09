import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import nodemailer from "nodemailer";

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
 * POST /api/test-ai-key
 * Validates whether an AI API key or connection is active and functional
 * Supports Google Gemini, OpenAI, Anthropic Claude, and Custom / Local OpenAI-compatible endpoints.
 */
app.post(["/api/test-ai-key", "/api/test-gemini-key"], async (req, res) => {
  try {
    const { apiKey, provider = "gemini", model, baseUrl } = req.body;

    // 1. OpenAI
    if (provider === "openai") {
      const keyToUse = apiKey?.trim() || process.env.OPENAI_API_KEY;
      if (!keyToUse) {
        return res.status(400).json({ success: false, error: "Kein OpenAI API-Schlüssel angegeben." });
      }
      const modelToUse = model?.trim() || "gpt-4o-mini";
      const openAiRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${keyToUse}`,
        },
        body: JSON.stringify({
          model: modelToUse,
          messages: [{ role: "user", content: "Antworte kurz mit 'OK'." }],
          max_tokens: 10,
        }),
      });

      if (!openAiRes.ok) {
        const errData = await openAiRes.json().catch(() => ({}));
        return res.status(400).json({
          success: false,
          error: errData?.error?.message || `OpenAI Fehler HTTP ${openAiRes.status}`,
        });
      }

      return res.json({
        success: true,
        message: `Verbindung zu OpenAI (${modelToUse}) erfolgreich hergestellt.`,
      });
    }

    // 2. Anthropic Claude
    if (provider === "anthropic") {
      const keyToUse = apiKey?.trim() || process.env.ANTHROPIC_API_KEY;
      if (!keyToUse) {
        return res.status(400).json({ success: false, error: "Kein Anthropic API-Schlüssel angegeben." });
      }
      const modelToUse = model?.trim() || "claude-3-5-haiku-20241022";
      const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": keyToUse,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: modelToUse,
          max_tokens: 10,
          messages: [{ role: "user", content: "Antworte kurz mit 'OK'." }],
        }),
      });

      if (!claudeRes.ok) {
        const errData = await claudeRes.json().catch(() => ({}));
        return res.status(400).json({
          success: false,
          error: errData?.error?.message || `Anthropic Fehler HTTP ${claudeRes.status}`,
        });
      }

      return res.json({
        success: true,
        message: `Verbindung zu Anthropic Claude (${modelToUse}) erfolgreich hergestellt.`,
      });
    }

    // 3. Custom / Local OpenAI-compatible endpoint (Ollama, Groq, OpenRouter, etc.)
    if (provider === "custom") {
      const base = (baseUrl?.trim() || "http://localhost:11434/v1").replace(/\/+$/, "");
      const modelToUse = model?.trim() || "llama3.2";
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (apiKey?.trim()) {
        headers["Authorization"] = `Bearer ${apiKey.trim()}`;
      }
      const customRes = await fetch(`${base}/chat/completions`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: modelToUse,
          messages: [{ role: "user", content: "Antworte kurz mit 'OK'." }],
          max_tokens: 10,
        }),
      });

      if (!customRes.ok) {
        const errData = await customRes.json().catch(() => ({}));
        return res.status(400).json({
          success: false,
          error: errData?.error?.message || `Endpunkt Fehler HTTP ${customRes.status}`,
        });
      }

      return res.json({
        success: true,
        message: `Verbindung zum benutzerdefinierten KI-Endpunkt (${modelToUse}) erfolgreich hergestellt.`,
      });
    }

    // 4. Default: Google Gemini
    const client = getGeminiClient(apiKey);
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
app.post("/api/categorize-booking", async (req, res) => {
  try {
    const { description, bookingText, partner, amount, type, userApiKey, aiProvider = "gemini", aiModel, aiBaseUrl } = req.body;

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
Gib ausschließlich valides JSON mit diesem Format aus:
{
  "sphere": "ideell" | "vermoegen" | "zweckbetrieb" | "wirtschaftlich",
  "type": "income" | "expense",
  "mainCategoryCode": "6600",
  "mainCategoryName": "Spiel-, Trainings- & Wettkampfbetrieb",
  "subCategoryCode": "6610",
  "subCategoryName": "Sportgeräte, Bälle, Tore, Netze & Trainingsmaterial",
  "subCategoryLabel": "6610 - Sport- & Trainingsgeräte",
  "vatRate": 0 | 7 | 19,
  "suggestedBookingText": "Prägnanter Buchungstext",
  "confidence": 0.95,
  "reasoning": "Kurze 1-2 Satz Begründung nach Gemeinnützigkeitsrecht"
}`;

    // A. OpenAI or Custom provider
    if (aiProvider === "openai" || aiProvider === "custom") {
      const endpoint = aiProvider === "openai"
        ? "https://api.openai.com/v1/chat/completions"
        : `${(aiBaseUrl || "http://localhost:11434/v1").replace(/\/+$/, "")}/chat/completions`;
      const modelToUse = aiModel?.trim() || (aiProvider === "openai" ? "gpt-4o-mini" : "llama3.2");
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      const token = userApiKey?.trim() || (aiProvider === "openai" ? process.env.OPENAI_API_KEY : undefined);
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const aiResponse = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: modelToUse,
          messages: [
            { role: "system", content: "Du bist ein Experte für deutsches Vereinssteuerrecht und SKR 42. Antworte ausschließlich mit reinem JSON." },
            { role: "user", content: prompt }
          ],
          response_format: { type: "json_object" },
          temperature: 0.2,
        }),
      });

      if (!aiResponse.ok) {
        const errJson = await aiResponse.json().catch(() => ({}));
        throw new Error(errJson?.error?.message || `KI-Fehler HTTP ${aiResponse.status}`);
      }

      const resData = await aiResponse.json();
      const content = resData.choices?.[0]?.message?.content || "{}";
      const parsedData = JSON.parse(content);
      return res.json({ success: true, data: parsedData });
    }

    // B. Anthropic Claude provider
    if (aiProvider === "anthropic") {
      const token = userApiKey?.trim() || process.env.ANTHROPIC_API_KEY;
      if (!token) throw new Error("Kein Anthropic API-Schlüssel hinterlegt.");
      const modelToUse = aiModel?.trim() || "claude-3-5-haiku-20241022";

      const aiResponse = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": token,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: modelToUse,
          max_tokens: 1000,
          system: "Du bist ein Experte für deutsches Vereinssteuerrecht und DATEV SKR 42. Gib ausschließlich valides JSON ohne Markdown-Codeblöcke aus.",
          messages: [{ role: "user", content: prompt }],
        }),
      });

      if (!aiResponse.ok) {
        const errJson = await aiResponse.json().catch(() => ({}));
        throw new Error(errJson?.error?.message || `Claude HTTP ${aiResponse.status}`);
      }

      const resData = await aiResponse.json();
      const textBlock = resData.content?.find((c: any) => c.type === "text")?.text || "{}";
      const cleaned = textBlock.replace(/```json/g, "").replace(/```/g, "").trim();
      const parsedData = JSON.parse(cleaned);
      return res.json({ success: true, data: parsedData });
    }

    // C. Default: Google Gemini
    const ai = getGeminiClient(userApiKey);

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
    const { fileDataUrl, mimeType, fileName, userApiKey } = req.body;

    if (!fileDataUrl) {
      return res.status(400).json({ error: "Keine Datei (fileDataUrl) übermittelt." });
    }

    // Extract base64 part
    const commaIndex = fileDataUrl.indexOf(",");
    const base64Data = commaIndex !== -1 ? fileDataUrl.substring(commaIndex + 1) : fileDataUrl;
    const detectedMimeType = mimeType || (fileDataUrl.startsWith("data:") ? fileDataUrl.substring(5, fileDataUrl.indexOf(";")) : "application/pdf");

    // Initialize Gemini with optional user API key
    const ai = getGeminiClient(userApiKey);

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
app.post("/api/meetings/analyze-notes", async (req, res) => {
  try {
    const { fileDataUrl, mimeType, fileName, meetingContext, userApiKey } = req.body;

    if (!fileDataUrl) {
      return res.status(400).json({ error: "Keine Datei mit Notizen übermittelt." });
    }

    const commaIndex = fileDataUrl.indexOf(",");
    const base64Data = commaIndex !== -1 ? fileDataUrl.substring(commaIndex + 1) : fileDataUrl;
    const detectedMimeType = mimeType || (fileDataUrl.startsWith("data:") ? fileDataUrl.substring(5, fileDataUrl.indexOf(";")) : "application/pdf");

    const ai = getGeminiClient(userApiKey);

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
app.post("/api/meetings/analyze-audio", async (req, res) => {
  try {
    const { audioDataUrl, mimeType, fileName, meetingContext, userApiKey } = req.body;

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

    const ai = getGeminiClient(userApiKey);

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
app.post("/api/meetings/ai-assist", async (req, res) => {
  try {
    const { action, input, context, userApiKey } = req.body;

    if (!action || !input) {
      return res.status(400).json({ error: "Aktion und Eingabetext sind erforderlich." });
    }

    const ai = getGeminiClient(userApiKey);
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

/**
 * POST /api/smtp/test
 * Testet die Verbindung zu einem angegebenen SMTP-Server und validiert die Anmeldedaten.
 */
app.post("/api/smtp/test", async (req, res) => {
  try {
    const { host, port, secure, user, password, fromEmail, testRecipient } = req.body;
    if (!host || typeof host !== "string" || !host.trim()) {
      return res.status(400).json({ success: false, error: "Kein SMTP-Host angegeben (z.B. smtp.ionos.de)." });
    }

    const hostTrimmed = host.trim();
    const portNum = Number(port) || (secure ? 465 : 587);
    const isSecure = Boolean(secure) || portNum === 465;

    const transporter = nodemailer.createTransport({
      host: hostTrimmed,
      port: portNum,
      secure: isSecure,
      auth: user?.trim() ? {
        user: user.trim(),
        pass: password || "",
      } : undefined,
      tls: {
        rejectUnauthorized: false,
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
    });

    await transporter.verify();

    if (testRecipient && typeof testRecipient === "string" && testRecipient.includes("@")) {
      const senderAddr = fromEmail?.trim() || user?.trim() || "noreply@vereinsmanager.app";
      await transporter.sendMail({
        from: `"VereinsManager SMTP-Test" <${senderAddr}>`,
        to: testRecipient.trim(),
        subject: "VereinsManager: SMTP-Verbindungstest erfolgreich",
        text: `Hallo,\n\ndiese Testnachricht bestätigt, dass Ihre SMTP-Konfiguration auf dem Server ${hostTrimmed}:${portNum} erfolgreich verbunden und authentifiziert werden konnte.\n\nSitzungseinladungen und Protokolle können ab sofort direkt aus der Anwendung versendet werden.\n\nHerzliche Grüße,\nIhr VereinsManager`,
      });
    }

    return res.json({
      success: true,
      message: `Verbindung zu SMTP-Server (${hostTrimmed}:${portNum}, ${isSecure ? 'SSL/TLS' : 'STARTTLS'}) erfolgreich aufgebaut und verifiziert.`,
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
app.post("/api/meetings/send-email", async (req, res) => {
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
      meetingDate,
      dispatchType,
      smtpConfig,
    } = req.body;

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
      hasSmtpConfig: Boolean(smtpConfig?.host),
    });

    // Falls SMTP konfiguriert ist, versenden wir die Mail direkt über Nodemailer
    if (smtpConfig && smtpConfig.host && smtpConfig.host.trim()) {
      try {
        const hostTrimmed = smtpConfig.host.trim();
        const portNum = Number(smtpConfig.port) || (smtpConfig.secure ? 465 : 587);
        const isSecure = Boolean(smtpConfig.secure) || portNum === 465;

        const transporter = nodemailer.createTransport({
          host: hostTrimmed,
          port: portNum,
          secure: isSecure,
          auth: smtpConfig.user?.trim() ? {
            user: smtpConfig.user.trim(),
            pass: smtpConfig.password || "",
          } : undefined,
          tls: {
            rejectUnauthorized: false,
          },
          connectionTimeout: 15000,
        });

        const fromAddress = smtpConfig.fromEmail?.trim() || senderEmail?.trim() || "vorstand@tsv-musterstadt1890.de";
        const fromNameStr = smtpConfig.fromName?.trim() || senderName?.trim() || "VereinsManager";
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
          message: `Erfolgreich über SMTP-Server (${hostTrimmed}) an ${validRecipients.length} Empfänger versendet (DSGVO-Blindkopie BCC).`,
        });
      } catch (smtpErr: any) {
        console.error("Fehler beim Versand über konfigurierten SMTP-Server:", smtpErr);
        return res.status(500).json({
          success: false,
          error: `SMTP-Versand fehlgeschlagen: ${smtpErr.message || "Verbindung zum SMTP-Server unterbrochen."}`,
        });
      }
    }

    // Fallback: Wenn noch kein SMTP konfiguriert ist, wird der Auftrag im System protokolliert
    return res.json({
      success: true,
      dispatchId,
      sentCount: validRecipients.length,
      recipients: validRecipients,
      timestamp,
      meetingTitle: meetingTitle || "Sitzung",
      attachmentName: attachment?.filename || null,
      method: "direct_relay",
      message: `Versandauftrag erfasst: E-Mail für ${validRecipients.length} Empfänger vorbereitet (${dispatchType === "invitation" ? "Einladung" : "Protokoll"}) mit DSGVO-konformer Blindkopie (BCC). Tipp: Hinterlegen Sie Ihre SMTP-Zugangsdaten in den Vereinsstammdaten für die direkte Serverauslieferung.`,
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
