/**
 * Anbindung an Mistral AI.
 * ---------------------------------------------------------------------------
 *
 * Warum Mistral? Weil der VereinsManager „DSGVO-konform" im Untertitel trägt
 * und diese Zusage bei einem KI-Anbieter anfängt. Mistral ist ein
 * französisches Unternehmen und verarbeitet auf EU-Infrastruktur; eine
 * Übermittlung in ein Drittland entfällt damit. Beim kostenlosen Kontingent
 * dürfen Eingaben zum Training verwendet werden — anders als bei Google lässt
 * sich das aber in der Verwaltungskonsole des Anbieters abschalten. Genau das
 * sollte ein Verein tun, bevor der erste Aufnahmeantrag durch die Erkennung
 * läuft; die Oberfläche weist darauf hin.
 *
 * Drei Schnittstellen werden gebraucht, und sie sind bei Mistral bewusst
 * getrennt — anders als bei Google, wo alles über einen Aufruf läuft:
 *
 *   /v1/chat/completions      Text hinein, Text oder JSON heraus
 *   /v1/ocr                   PDF oder Bild hinein, Markdown heraus
 *   /v1/audio/transcriptions  Tonaufnahme hinein, Text heraus
 *
 * Für Belegerkennung, Antragsübernahme und Protokollauswertung heißt das:
 * zwei Schritte statt einem. Erst wird das Dokument in Text verwandelt, dann
 * wird dieser Text von einem Sprachmodell ausgewertet. Das ist kein Umweg,
 * sondern hat einen Vorteil: Der Zwischenschritt ist lesbar, und wenn etwas
 * schiefgeht, lässt sich sagen, ob die Erkennung oder die Auswertung schuld
 * war.
 *
 * Eine Unsicherheit, die der Ehrlichkeit halber hier steht: Die Übergabe
 * eines Dokuments als Data-URL (`data:application/pdf;base64,…`) entspricht
 * dem, was Mistrals Dokumentation als „OCR with a Base64 Encoded PDF"
 * überschreibt. Das genaue Beispiel dazu konnte ich nicht einsehen. Sollte
 * die Erkennung mit einer Meldung über ein ungültiges Dokument scheitern,
 * ist das die erste Stelle zum Nachsehen.
 */

/** Feste Adresse. Bewusst nicht einstellbar: Es gibt nur diesen einen Dienst. */
const BASIS = 'https://api.mistral.ai/v1';

/**
 * Vorgabemodelle. Alle drei tragen "-latest": Mistral zieht darunter jeweils
 * die neueste Ausgabe nach, ohne dass hier etwas geändert werden muss.
 *
 * Für den Textteil ist bewusst das kleine Modell gewählt. Die Aufgaben hier
 * sind eng umrissen (ein Beleg, ein Formular, eine Kontierung) und brauchen
 * kein großes Modell — das kostet nur Kontingent und Wartezeit. Wer es anders
 * will, trägt in den Einstellungen ein anderes Modell ein.
 */
export const MISTRAL_MODELLE = {
  text: 'mistral-small-latest',
  ocr: 'mistral-ocr-latest',
  ton: 'voxtral-mini-latest',
} as const;

// Alle drei Kennungen sind gegen die Modellliste eines echten Kontos geprueft
// (GET /v1/models): 'mistral-small-latest' zeigt dort auf mistral-small-2603,
// 'mistral-ocr-latest' traegt die Faehigkeit ocr, 'voxtral-mini-latest' die
// Faehigkeit audio_transcription. Wer hier etwas aendert, sollte dieselbe
// Liste abfragen — eine erfundene Kennung scheitert erst zur Laufzeit, und die
// Fehlermeldung zeigt dann nicht auf das Modell.

/**
 * Zerlegt eine Data-URL in ihre zwei Bestandteile.
 *
 * Die Oberfläche reicht Dateien durchgängig als Data-URL herein
 * (`data:<typ>;base64,<inhalt>`), weil das im Browser der einfachste Weg ist,
 * eine ausgewählte Datei weiterzugeben.
 */
function zerlegeDataUrl(dataUrl: string): { mimeType: string; base64: string } {
  const treffer = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(dataUrl);
  if (!treffer) {
    // Kein Data-URL-Format: Dann ist der Inhalt vermutlich schon reines
    // base64. Dem Aufrufer bleibt es überlassen, den Typ zu kennen.
    return { mimeType: '', base64: dataUrl };
  }
  return { mimeType: treffer[1] || '', base64: treffer[3] || '' };
}

/**
 * Macht aus einer Fehlerantwort eine Meldung, mit der ein Vorstandsmitglied
 * etwas anfangen kann.
 *
 * Die nackten Statusmeldungen („401", „429") sagen niemandem etwas, der nicht
 * täglich mit Schnittstellen arbeitet. Die häufigen Fälle bekommen deshalb
 * einen deutschen Satz, der auch sagt, was zu tun ist.
 */
async function fehlerAusAntwort(antwort: Response, was: string): Promise<Error> {
  // Erst als Text lesen, dann versuchen zu deuten. Andersherum ginge es nicht:
  // Ein Antwortkörper lässt sich nur EINMAL lesen. Scheiterte `json()` an
  // einer Antwort, die gar kein JSON ist, wäre der Körper bereits verbraucht
  // und ein `text()` im Auffangzweig liefe ins Leere — ausgerechnet dann, wenn
  // die Meldung am dringendsten gebraucht wird.
  const roh = await antwort.text().catch(() => '');
  let einzelheit: string;
  try {
    const daten = JSON.parse(roh);
    einzelheit = daten?.message || daten?.error?.message || daten?.detail?.[0]?.msg || '';
  } catch {
    // Keine JSON-Antwort — etwa die HTML-Fehlerseite eines zwischengeschalteten
    // Servers. Dann taugt der rohe Text als Hinweis, gekürzt auf ein Maß, das
    // eine Fehlermeldung nicht sprengt.
    einzelheit = roh.slice(0, 300);
  }

  // Die Wortwahl von Mistral wird ERGAENZT, nicht ersetzt.
  //
  // Das war hier zuerst anders: Ein freundlicher deutscher Satz trat an die
  // Stelle der Originalmeldung. Das ist gut gemeint und im Ergebnis schaedlich,
  // denn dieselbe Statusnummer hat mehrere Ursachen — eine 429 bedeutet mal
  // "zu viele Anfragen", mal "dieses Konto ist noch nicht freigeschaltet".
  // Wer die Originalmeldung wegwirft, nimmt sich die Moeglichkeit, das zu
  // unterscheiden.
  const nachsatz = einzelheit ? ` (Mistral meldet: ${einzelheit})` : '';

  if (antwort.status === 401 || antwort.status === 403) {
    return new Error(
      'Mistral hat den Schlüssel abgelehnt. Bitte in den Einstellungen unter KI ' +
        'prüfen, ob er vollständig und noch gültig ist.' +
        nachsatz
    );
  }
  if (antwort.status === 429) {
    return new Error(
      'Mistral hat die Anfrage abgewiesen. Das heißt meist eines von zwei Dingen: ' +
        'zu viele Anfragen in kurzer Zeit — dann hilft eine Minute warten. Oder das ' +
        'Konto ist noch nicht vollständig freigeschaltet: Der kostenlose Tarif von ' +
        'Mistral verlangt einmalig eine Bestätigung der Telefonnummer in der ' +
        'Mistral-Konsole, sonst wird jede Anfrage abgewiesen, obwohl der Schlüssel ' +
        'gültig ist.' +
        nachsatz
    );
  }
  if (antwort.status === 402) {
    return new Error('Das Guthaben des Mistral-Kontos ist aufgebraucht.' + nachsatz);
  }
  return new Error(
    `${was} ist bei Mistral fehlgeschlagen (HTTP ${antwort.status})` +
      (einzelheit ? `: ${einzelheit}` : '.')
  );
}

/**
 * Stellt eine Textanfrage.
 *
 * `alsJson` schaltet Mistrals JSON-Modus ein: Das Modell antwortet dann
 * garantiert mit gültigem JSON und nicht mit Text, in dem irgendwo JSON
 * steckt. Das erspart das Herausschneiden von Code-Blöcken, an dem solche
 * Auswertungen sonst regelmäßig scheitern.
 */
export async function mistralText(optionen: {
  schluessel: string;
  modell?: string;
  system?: string;
  eingabe: string;
  alsJson?: boolean;
  maxTokens?: number;
}): Promise<string> {
  const nachrichten: { role: string; content: string }[] = [];
  if (optionen.system) nachrichten.push({ role: 'system', content: optionen.system });
  nachrichten.push({ role: 'user', content: optionen.eingabe });

  const antwort = await fetch(`${BASIS}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${optionen.schluessel}`,
    },
    body: JSON.stringify({
      model: optionen.modell?.trim() || MISTRAL_MODELLE.text,
      messages: nachrichten,
      temperature: 0.2,
      ...(optionen.maxTokens ? { max_tokens: optionen.maxTokens } : {}),
      ...(optionen.alsJson ? { response_format: { type: 'json_object' } } : {}),
    }),
  });

  if (!antwort.ok) throw await fehlerAusAntwort(antwort, 'Die Textanfrage');

  const daten = await antwort.json();
  const inhalt = daten?.choices?.[0]?.message?.content;
  if (typeof inhalt !== 'string' || !inhalt.trim()) {
    throw new Error('Mistral hat eine leere Antwort geliefert.');
  }
  return inhalt.trim();
}

/**
 * Wandelt ein PDF oder Bild in Text (Markdown) um.
 *
 * Mistral unterscheidet im Anfragekörper zwischen Dokumenten und Bildern —
 * ein PDF geht als `document_url`, ein Foto als `image_url`. Beides kann als
 * Data-URL übergeben werden; die Datei verlässt damit den Server nur für
 * diesen einen Aufruf und wird nirgends abgelegt.
 *
 * Bewusst NICHT genutzt: Mistrals Dateiablage (`/v1/files`). Sie wäre der
 * andere dokumentierte Weg, würde die Datei aber beim Anbieter liegen lassen.
 * Für einen Aufnahmeantrag mit Namen, Anschrift und Bankverbindung ist das
 * der falsche Handel.
 */
export async function mistralOcr(optionen: {
  schluessel: string;
  dataUrl: string;
  mimeType?: string;
  modell?: string;
}): Promise<string> {
  const zerlegt = zerlegeDataUrl(optionen.dataUrl);
  const typ = (optionen.mimeType || zerlegt.mimeType || 'application/pdf').toLowerCase();
  const istBild = typ.startsWith('image/');

  // Sicherstellen, dass eine vollständige Data-URL übergeben wird — auch wenn
  // der Aufrufer nur den base64-Teil hatte.
  const vollstaendig = optionen.dataUrl.startsWith('data:')
    ? optionen.dataUrl
    : `data:${typ};base64,${zerlegt.base64}`;

  const dokument = istBild
    ? { type: 'image_url', image_url: vollstaendig }
    : { type: 'document_url', document_url: vollstaendig };

  const antwort = await fetch(`${BASIS}/ocr`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${optionen.schluessel}`,
    },
    body: JSON.stringify({
      model: optionen.modell?.trim() || MISTRAL_MODELLE.ocr,
      document: dokument,
      // Die erkannten Bilder brauchen wir nicht zurück — nur den Text. Das
      // spart erheblich Übertragung: Ein eingescannter Antrag käme sonst als
      // base64-Bild wieder herein.
      include_image_base64: false,
    }),
  });

  if (!antwort.ok) throw await fehlerAusAntwort(antwort, 'Die Texterkennung');

  const daten = await antwort.json();
  const seiten: { markdown?: string }[] = Array.isArray(daten?.pages) ? daten.pages : [];
  const text = seiten
    .map(seite => seite?.markdown || '')
    .join('\n\n')
    .trim();

  if (!text) {
    throw new Error(
      'Die Texterkennung hat nichts gefunden. Bei einem Foto hilft oft eine ' +
        'geradere Aufnahme mit besserem Licht; ein reines Bild-PDF ohne ' +
        'erkennbare Schrift lässt sich nicht auswerten.'
    );
  }
  return text;
}

/**
 * Schreibt eine Tonaufnahme mit.
 *
 * Hier wird die Datei als echter Datei-Anhang geschickt (multipart) und nicht
 * als Data-URL. Das ist der dokumentierte Weg für Tonaufnahmen, und er ist
 * auch der sparsamere: base64 bläht eine Aufnahme um ein Drittel auf, und
 * eine Mitgliederversammlung bringt schnell zweistellige Megabyte mit.
 */
export async function mistralTranskript(optionen: {
  schluessel: string;
  dataUrl: string;
  mimeType?: string;
  dateiName?: string;
  sprache?: string;
  modell?: string;
}): Promise<string> {
  const zerlegt = zerlegeDataUrl(optionen.dataUrl);
  const typ = optionen.mimeType || zerlegt.mimeType || 'audio/mpeg';
  const bytes = Buffer.from(zerlegt.base64, 'base64');

  const formular = new FormData();
  formular.append('model', optionen.modell?.trim() || MISTRAL_MODELLE.ton);
  // Deutsch fest vorgeben: Die Aufnahmen sind Vereinssitzungen. Ohne Angabe
  // rät das Modell die Sprache, und bei undeutlichen ersten Sekunden rät es
  // gelegentlich falsch — dann steht das halbe Protokoll auf Englisch.
  formular.append('language', optionen.sprache || 'de');
  formular.append(
    'file',
    new Blob([new Uint8Array(bytes)], { type: typ }),
    optionen.dateiName || 'aufnahme'
  );

  const antwort = await fetch(`${BASIS}/audio/transcriptions`, {
    method: 'POST',
    // Kein Content-Type von Hand setzen: Bei multipart gehört eine
    // Trennmarkierung dazu, die fetch selbst erzeugt. Wer den Kopf selbst
    // setzt, zerstört genau diese Angabe.
    headers: { Authorization: `Bearer ${optionen.schluessel}` },
    body: formular,
  });

  if (!antwort.ok) throw await fehlerAusAntwort(antwort, 'Die Transkription');

  const daten = await antwort.json();
  const text = typeof daten?.text === 'string' ? daten.text.trim() : '';
  if (!text) {
    throw new Error('Die Tonaufnahme enthielt nichts Verständliches.');
  }
  return text;
}

/**
 * Schneidet Code-Block-Markierungen weg, falls das Modell sie doch einmal
 * mitschickt, und liest das JSON.
 *
 * Im JSON-Modus sollte das nicht nötig sein. Es kostet aber nichts, und der
 * Unterschied zwischen "funktioniert" und "Fehlermeldung" hängt sonst an drei
 * Backticks.
 */
export function leseJson<T>(text: string): T {
  const sauber = text
    .replace(/^\s*```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();
  return JSON.parse(sauber) as T;
}

/** Prüft Schlüssel und Erreichbarkeit mit einer möglichst kleinen Anfrage. */
export async function mistralTest(
  schluessel: string,
  modell?: string
): Promise<{ success: boolean; message: string }> {
  try {
    const antwort = await mistralText({
      schluessel,
      modell,
      eingabe: "Antworte nur mit dem Wort OK.",
      maxTokens: 10,
    });
    return {
      success: true,
      message: `Verbindung zu Mistral (${modell?.trim() || MISTRAL_MODELLE.text}) erfolgreich hergestellt. Antwort: ${antwort.slice(0, 40)}`,
    };
  } catch (fehler: any) {
    return { success: false, message: fehler?.message || 'Verbindung zu Mistral fehlgeschlagen.' };
  }
}
