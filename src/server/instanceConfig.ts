/**
 * Serverseitige Konfiguration dieser Installation.
 * ---------------------------------------------------------------------------
 *
 * Hier liegen die Geheimnisse dieser Installation: die Zugangsdaten zum
 * Postfach des Vereins und der Schlüssel zum KI-Anbieter. Sie gehören bewusst
 * NICHT zu den Vereinsstammdaten:
 *
 *   - Vereinsstammdaten (Name, Anschrift, Vorstand) sind Daten des Vereins.
 *     Sie wandern in jede Datensicherung und bei einem Umzug mit.
 *   - Postfach-Zugangsdaten und KI-Schlüssel gehören zu dieser einen
 *     Installation. Sie bleiben hier, tauchen in keiner Sicherung auf und
 *     müssen nach einer Neuinstallation einmalig neu eingetragen werden.
 *
 * Warum überhaupt verschlüsseln, wenn der Schlüssel doch danebenliegt?
 * ---------------------------------------------------------------------------
 * Weil der Server beides im Klartext braucht — er meldet sich damit beim
 * Mailanbieter beziehungsweise beim KI-Anbieter an. Hashen wie bei den
 * Benutzer-Passwörtern der App geht deshalb nicht: aus einem Hash lässt sich
 * das Ursprüngliche nicht zurückgewinnen.
 *
 * Was die Verschlüsselung leistet, ist trotzdem viel: Sie schützt gegen die
 * Fälle, die in der Praxis wirklich vorkommen — jemand sichert den Ordner auf
 * einen USB-Stick, jemand gibt ein Docker-Abbild weiter, eine Datei rutscht
 * versehentlich in das GitHub-Verzeichnis. In all diesen Fällen wandert meist
 * nur eine der beiden Dateien mit, und dann ist der Inhalt wertlos.
 *
 * Was sie NICHT leistet: Wer sich auf dem Server anmelden kann und beide
 * Dateien liest, kommt an das Passwort. Das kann keine Lösung verhindern,
 * die dem Server erlaubt, selbstständig Mails zu verschicken.
 *
 * Wo liegen die Dateien?
 * ---------------------------------------------------------------------------
 *   daten/konfiguration.json   die Einstellungen, Passwort darin verschlüsselt
 *   daten/schluessel.key       der Schlüssel dazu
 *
 * Beide nur für den Besitzer lesbar (Rechte 600), das Verzeichnis 700. Unter
 * Windows kennt das Dateisystem diese Rechte nicht; dort greift die Maßnahme
 * ins Leere, was Node stillschweigend hinnimmt.
 *
 * Über die Umgebungsvariablen lässt sich beides verlegen:
 *   VM_DATA_DIR     anderes Verzeichnis (z. B. ein Docker-Volume)
 *   VM_SECRET_KEY   Schlüssel direkt vorgeben (64 Hex-Zeichen). Dann wird
 *                   keine Schlüsseldatei angelegt. Sinnvoll, wenn der
 *                   Schlüssel in einer Passwortverwaltung liegen soll.
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

// ---------------------------------------------------------------------------
// Typen
// ---------------------------------------------------------------------------

/** Vollständige Zugangsdaten inklusive Klartext-Passwort. Nur serverintern. */
export interface SmtpCredentials {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  fromEmail: string;
  fromName: string;
}

/**
 * Das, was die Oberfläche zu sehen bekommt. Das Passwort ist hier bewusst
 * nicht enthalten — nur die Auskunft, ob eines hinterlegt ist.
 */
export interface SmtpConfigPublic {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  fromEmail: string;
  fromName: string;
  hasPassword: boolean;
  /** true, sobald ein Hostname hinterlegt ist. */
  configured: boolean;
}

/**
 * Der Anbieter, mit dem die KI-Funktionen sprechen. Es ist nur noch einer —
 * und dass hier trotzdem ein Typ mit einem einzigen Wert steht, ist Absicht:
 * Käme je ein zweiter dazu, meldet der Compiler jede Stelle, die davon nichts
 * weiß.
 *
 * Wie es dazu kam, weil die Frage sonst alle paar Monate neu gestellt wird:
 *
 *   Es waren einmal vier — Google, OpenAI, Anthropic und eine frei eintragbare
 *   Adresse. Diese Auswahl war nur zur Hälfte echt: Von fünf KI-Funktionen
 *   konnte genau eine mit den anderen dreien arbeiten, die übrigen vier
 *   brauchten Google. Wer OpenAI eintrug, bekam vier Fehlermeldungen, die
 *   nicht sagten, warum.
 *
 *   Dann kam Mistral AI dazu — französisches Unternehmen, Verarbeitung auf
 *   EU-Infrastruktur, Auftragsverarbeitungsvertrag: fachlich die bessere Wahl
 *   für eine deutsche Vereinsverwaltung, und als einziger Anbieter neben
 *   Google in der Lage, alle fünf Funktionen zu bedienen. Der Umbau war
 *   fertig und ist in Commit 4b0933b nachzulesen.
 *
 *   Gescheitert ist er an etwas, das in keiner Dokumentation stand: Mistrals
 *   kostenloser Zugang teilt ohne hinterlegte Zahlungsdaten gar kein
 *   Kontingent zu — der Server antwortet mit
 *   `x-ratelimit-limit-req-minute: 0` und weist jede Anfrage ab. Einem
 *   ehrenamtlichen Kassenwart Zahlungsdaten abzuverlangen, damit er eine
 *   Belegerkennung ausprobieren kann, ist keine zumutbare Hürde.
 *
 * Bleibt Google Gemini — mit dem Nachteil, dass dessen kostenloser Tarif die
 * übermittelten Inhalte zum Training verwenden darf und sich das dort nicht
 * abschalten lässt. Deshalb sind die KI-Funktionen standardmäßig aus und
 * verlangen beim Einschalten eine Bestätigung.
 */
export type AiProvider = 'gemini';

/**
 * Vollständige KI-Zugangsdaten inklusive Klartext-Schlüssel. Nur serverintern —
 * dieses Ergebnis darf niemals in eine HTTP-Antwort geraten.
 */
export interface AiCredentials {
  provider: AiProvider;
  apiKey: string;
  model: string;
  /**
   * Woher der Schlüssel stammt. 'umgebung' heißt: aus GEMINI_API_KEY und
   * Geschwistern, wie es der Docker-Betrieb erlaubt. Für Fehlermeldungen
   * nützlich — "kein Schlüssel hinterlegt" hieße sonst zweierlei.
   */
  quelle: 'konfiguration' | 'umgebung';
}

/**
 * Das, was die Oberfläche zu sehen bekommt. Der Schlüssel ist hier bewusst
 * nicht enthalten — nur die Auskunft, ob einer hinterlegt ist.
 */
export interface AiConfigPublic {
  provider: AiProvider;
  model: string;
  hasApiKey: boolean;
  /** Woher ein vorhandener Schlüssel stammt; ohne Schlüssel 'keine'. */
  schluesselQuelle: 'konfiguration' | 'umgebung' | 'keine';
  /** true, sobald die KI-Funktionen tatsächlich arbeiten könnten. */
  configured: boolean;
}

/** Eingabe beim Speichern. Zu apiKey siehe writeAiConfig(). */
export interface AiConfigInput {
  provider: AiProvider;
  model?: string;
  apiKey?: string | null;
}

interface StoredAi {
  provider: AiProvider;
  model?: string;
  /** Verschlüsselt, Format siehe encrypt(). */
  apiKeyEncrypted?: string;
}

/** Eingabe beim Speichern. Siehe writeSmtpConfig() zur Behandlung von password. */
export interface SmtpConfigInput {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  fromEmail: string;
  fromName: string;
  password?: string | null;
}

interface StoredSmtp {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  fromEmail: string;
  fromName: string;
  /** Verschlüsselt, Format siehe encrypt(). */
  passwordEncrypted?: string;
}

interface StoredConfig {
  version: number;
  smtp?: StoredSmtp;
  ai?: StoredAi;
  /**
   * Zugriffsschlüssel für die /api-Endpunkte. Bewusst unverschlüsselt: Er ist
   * kein fremdes Geheimnis, sondern der Ausweis, den dieser Server selbst
   * ausstellt und prüfen muss. Ihn mit einem Schlüssel zu verschlüsseln, der
   * in derselben Datei daneben läge, gewänne nichts.
   */
  accessKey?: string;
}

/** Woher der Zugriffsschlüssel stammt und ob er gerade erst entstanden ist. */
export interface AccessKeyInfo {
  key: string;
  quelle: 'umgebung' | 'datei';
  neuErzeugt: boolean;
}

const LEERE_KONFIGURATION: SmtpConfigPublic = {
  host: '',
  port: 587,
  secure: false,
  user: '',
  fromEmail: '',
  fromName: '',
  hasPassword: false,
  configured: false,
};

// ---------------------------------------------------------------------------
// Dateiablage
// ---------------------------------------------------------------------------

/**
 * Die Pfade werden bei jedem Aufruf neu bestimmt und nicht beim Laden des
 * Moduls zwischengespeichert. Das kostet nichts und macht die Tests möglich:
 * sie setzen VM_DATA_DIR auf ein Wegwerf-Verzeichnis.
 */
function dataDir(): string {
  const eingestellt = process.env.VM_DATA_DIR?.trim();
  return eingestellt ? path.resolve(eingestellt) : path.join(process.cwd(), 'daten');
}

function configPath(): string {
  return path.join(dataDir(), 'konfiguration.json');
}

function keyPath(): string {
  return path.join(dataDir(), 'schluessel.key');
}

function ensureDataDir(): string {
  const verzeichnis = dataDir();
  if (!fs.existsSync(verzeichnis)) {
    fs.mkdirSync(verzeichnis, { recursive: true, mode: 0o700 });
  }
  return verzeichnis;
}

/**
 * Schreiben in zwei Schritten: erst in eine Nebendatei, dann umbenennen.
 * Ein Umbenennen ist auf allen gängigen Dateisystemen unteilbar. Bricht der
 * Strom mitten im Schreiben weg, liegt entweder die alte oder die neue Fassung
 * vor — nie eine halbe.
 */
function writeFileSafely(ziel: string, inhalt: string): void {
  ensureDataDir();
  const temporaer = `${ziel}.tmp`;
  fs.writeFileSync(temporaer, inhalt, { encoding: 'utf8', mode: 0o600 });
  try {
    fs.chmodSync(temporaer, 0o600);
  } catch {
    // Unter Windows nicht unterstützt — kein Grund zum Abbruch.
  }
  fs.renameSync(temporaer, ziel);
}

// ---------------------------------------------------------------------------
// Schlüssel
// ---------------------------------------------------------------------------

/**
 * Liefert den 32 Byte langen Schlüssel. Reihenfolge:
 *   1. Umgebungsvariable VM_SECRET_KEY (64 Hex-Zeichen)
 *   2. vorhandene Schlüsseldatei
 *   3. neuer Zufallsschlüssel, der dann angelegt wird
 */
function getKey(): Buffer {
  const ausUmgebung = process.env.VM_SECRET_KEY?.trim();
  if (ausUmgebung) {
    if (!/^[0-9a-fA-F]{64}$/.test(ausUmgebung)) {
      throw new Error(
        'VM_SECRET_KEY muss aus genau 64 Hex-Zeichen bestehen (32 Byte). ' +
          'Einen gültigen Wert erzeugt: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
      );
    }
    return Buffer.from(ausUmgebung, 'hex');
  }

  const datei = keyPath();
  if (fs.existsSync(datei)) {
    const inhalt = fs.readFileSync(datei, 'utf8').trim();
    if (/^[0-9a-fA-F]{64}$/.test(inhalt)) {
      return Buffer.from(inhalt, 'hex');
    }
    // Unbrauchbare Schlüsseldatei: nicht überschreiben, sondern melden. Ein
    // stillschweigend neu erzeugter Schlüssel würde ein noch entschlüsselbares
    // Passwort unwiederbringlich unlesbar machen.
    throw new Error(
      `Die Schlüsseldatei ${datei} ist unbrauchbar (erwartet werden 64 Hex-Zeichen). ` +
        'Bitte die Datei prüfen oder löschen; nach dem Löschen muss das SMTP-Passwort neu eingetragen werden.'
    );
  }

  const neu = crypto.randomBytes(32);
  writeFileSafely(datei, neu.toString('hex'));
  return neu;
}

// ---------------------------------------------------------------------------
// Ver- und Entschlüsselung
// ---------------------------------------------------------------------------

/**
 * AES-256-GCM. GCM liefert nicht nur Vertraulichkeit, sondern auch einen
 * Prüfwert ("tag"): Wurde am verschlüsselten Text auch nur ein Bit verändert,
 * schlägt das Entschlüsseln fehl, statt Unsinn zurückzugeben.
 *
 * Format: v1:<iv>:<tag>:<geheimtext>, jeder Teil base64.
 * Das v1 vorne macht einen späteren Wechsel des Verfahrens möglich, ohne dass
 * alte Dateien unlesbar werden.
 */
function encrypt(klartext: string): string {
  const schluessel = getKey();
  const iv = crypto.randomBytes(12); // 96 Bit, der für GCM empfohlene Wert
  const cipher = crypto.createCipheriv('aes-256-gcm', schluessel, iv);
  const geheim = Buffer.concat([cipher.update(klartext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString('base64')}:${tag.toString('base64')}:${geheim.toString('base64')}`;
}

/**
 * Gibt null zurück, wenn sich der Text nicht entschlüsseln lässt — etwa weil
 * der Schlüssel ausgetauscht wurde. Das ist kein Absturzgrund: Die App soll
 * dann melden "kein Passwort hinterlegt" und zur Neueingabe auffordern.
 */
function decrypt(gespeichert: string): string | null {
  try {
    const teile = gespeichert.split(':');
    if (teile.length !== 4 || teile[0] !== 'v1') return null;
    const [, ivB64, tagB64, geheimB64] = teile;
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      getKey(),
      Buffer.from(ivB64, 'base64')
    );
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
    const klar = Buffer.concat([
      decipher.update(Buffer.from(geheimB64, 'base64')),
      decipher.final(),
    ]);
    return klar.toString('utf8');
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Lesen und Schreiben der Konfiguration
// ---------------------------------------------------------------------------

function readStored(): StoredConfig {
  const datei = configPath();
  if (!fs.existsSync(datei)) return { version: 1 };
  try {
    const geparst = JSON.parse(fs.readFileSync(datei, 'utf8')) as StoredConfig;
    if (!geparst || typeof geparst !== 'object') return { version: 1 };
    // Jedes Feld einzeln übernehmen und nicht einfach durchreichen: So landet
    // nichts in der Datei, was dort nichts zu suchen hat. Wird hier ein neues
    // Feld vergessen, geht es beim nächsten Schreiben verloren.
    return {
      version: geparst.version ?? 1,
      smtp: geparst.smtp,
      ai: geparst.ai,
      accessKey: geparst.accessKey,
    };
  } catch (fehler) {
    console.error(
      `Die Serverkonfiguration ${datei} ist nicht lesbar und wird ignoriert. ` +
        'Die SMTP-Einstellungen und der KI-Schlüssel müssen neu eingetragen werden.',
      fehler
    );
    return { version: 1 };
  }
}

function writeStored(konfiguration: StoredConfig): void {
  writeFileSafely(configPath(), JSON.stringify(konfiguration, null, 2));
}

function toPublic(smtp: StoredSmtp | undefined): SmtpConfigPublic {
  if (!smtp) return { ...LEERE_KONFIGURATION };
  return {
    host: smtp.host || '',
    port: smtp.port || (smtp.secure ? 465 : 587),
    secure: Boolean(smtp.secure),
    user: smtp.user || '',
    fromEmail: smtp.fromEmail || '',
    fromName: smtp.fromName || '',
    // Ein Passwort, das sich nicht mehr entschlüsseln lässt, gilt als nicht
    // vorhanden. Sonst zeigte die Oberfläche "hinterlegt", und der Versand
    // schlüge trotzdem fehl.
    hasPassword: Boolean(smtp.passwordEncrypted && decrypt(smtp.passwordEncrypted) !== null),
    configured: Boolean(smtp.host?.trim()),
  };
}

/** Was die Oberfläche abfragen darf. Enthält kein Passwort. */
export function readSmtpConfigPublic(): SmtpConfigPublic {
  return toPublic(readStored().smtp);
}

/**
 * Vollständige Zugangsdaten für den Mailversand. Nur serverintern verwenden —
 * dieses Ergebnis darf niemals in eine HTTP-Antwort geraten.
 *
 * Gibt null zurück, wenn kein Hostname hinterlegt ist; das Passwort darf leer
 * sein, weil es Mailserver ohne Anmeldung gibt (etwa im eigenen Netz).
 */
export function readSmtpCredentials(): SmtpCredentials | null {
  const { smtp } = readStored();
  if (!smtp?.host?.trim()) return null;

  const passwort = smtp.passwordEncrypted ? decrypt(smtp.passwordEncrypted) : '';
  if (passwort === null) {
    console.warn(
      'Das hinterlegte SMTP-Passwort lässt sich nicht entschlüsseln. ' +
        'Vermutlich wurde die Schlüsseldatei ausgetauscht oder gelöscht. ' +
        'Bitte das Passwort in den Einstellungen neu eintragen.'
    );
  }

  return {
    host: smtp.host.trim(),
    port: smtp.port || (smtp.secure ? 465 : 587),
    secure: Boolean(smtp.secure),
    user: smtp.user?.trim() || '',
    password: passwort ?? '',
    fromEmail: smtp.fromEmail?.trim() || '',
    fromName: smtp.fromName?.trim() || '',
  };
}

/**
 * Speichert die Zugangsdaten. Das Feld `password` wird dreifach unterschieden,
 * damit die Oberfläche das Passwort nie zurückbekommen muss:
 *
 *   undefined  → bestehendes Passwort bleibt unverändert
 *                (der Normalfall: jemand ändert nur den Absendernamen)
 *   ''  / null → Passwort wird entfernt
 *   Zeichen    → neues Passwort, verschlüsselt abgelegt
 */
export function writeSmtpConfig(eingabe: SmtpConfigInput): SmtpConfigPublic {
  const vorhanden = readStored();
  const bisher = vorhanden.smtp;

  const neu: StoredSmtp = {
    host: eingabe.host.trim(),
    port: eingabe.port,
    secure: Boolean(eingabe.secure),
    user: eingabe.user.trim(),
    fromEmail: eingabe.fromEmail.trim(),
    fromName: eingabe.fromName.trim(),
    passwordEncrypted: bisher?.passwordEncrypted,
  };

  if (eingabe.password === null || eingabe.password === '') {
    delete neu.passwordEncrypted;
  } else if (typeof eingabe.password === 'string') {
    neu.passwordEncrypted = encrypt(eingabe.password);
  }

  writeStored({ ...vorhanden, version: 1, smtp: neu });
  return toPublic(neu);
}

/** Entfernt die SMTP-Zugangsdaten vollständig. Die Schlüsseldatei bleibt. */
export function deleteSmtpConfig(): SmtpConfigPublic {
  const vorhanden = readStored();
  delete vorhanden.smtp;
  writeStored({ ...vorhanden, version: 1 });
  return { ...LEERE_KONFIGURATION };
}

// ---------------------------------------------------------------------------
// KI-Zugangsdaten
// ---------------------------------------------------------------------------

/** Welcher Anbieter gilt, solange nichts eingestellt ist. */
const VORGABE_ANBIETER: AiProvider = 'gemini';

/**
 * Der Schlüssel darf auch aus der Umgebung kommen — für den Docker- und
 * Server-Betrieb ist das der bequemste Weg: Er steht dann in der Compose-Datei
 * oder in den Geheimnissen der Betriebsumgebung und landet ebenfalls in keiner
 * Datensicherung.
 */
function schluesselAusUmgebung(provider: AiProvider): string {
  const namen: Record<AiProvider, string> = {
    gemini: 'GEMINI_API_KEY',
  };
  return process.env[namen[provider]]?.trim() || '';
}

function kiZuOeffentlich(ai: StoredAi | undefined): AiConfigPublic {
  const provider = ai?.provider || VORGABE_ANBIETER;
  // Ein Schlüssel, der sich nicht mehr entschlüsseln lässt, gilt als nicht
  // vorhanden. Sonst zeigte die Oberfläche "hinterlegt", und jeder KI-Aufruf
  // schlüge trotzdem fehl.
  const ausDatei = Boolean(ai?.apiKeyEncrypted && decrypt(ai.apiKeyEncrypted) !== null);
  const ausUmgebung = !ausDatei && schluesselAusUmgebung(provider).length > 0;
  const hasApiKey = ausDatei || ausUmgebung;

  return {
    provider,
    model: ai?.model?.trim() || '',
    hasApiKey,
    schluesselQuelle: ausDatei ? 'konfiguration' : ausUmgebung ? 'umgebung' : 'keine',
    configured: hasApiKey,
  };
}

/** Was die Oberfläche abfragen darf. Enthält keinen Schlüssel. */
export function readAiConfigPublic(): AiConfigPublic {
  return kiZuOeffentlich(readStored().ai);
}

/**
 * Vollständige KI-Zugangsdaten für den Aufruf beim Anbieter. Nur serverintern.
 *
 * Gibt null zurück, wenn gar nichts nutzbar hinterlegt ist. Die Reihenfolge:
 * erst der verschlüsselt abgelegte Schlüssel, dann die Umgebungsvariable.
 */
export function readAiCredentials(): AiCredentials | null {
  const { ai } = readStored();
  const provider = ai?.provider || VORGABE_ANBIETER;

  let apiKey = '';
  let quelle: AiCredentials['quelle'] = 'konfiguration';

  if (ai?.apiKeyEncrypted) {
    const klar = decrypt(ai.apiKeyEncrypted);
    if (klar === null) {
      console.warn(
        'Der hinterlegte KI-Schlüssel lässt sich nicht entschlüsseln. ' +
          'Vermutlich wurde die Schlüsseldatei ausgetauscht oder gelöscht. ' +
          'Bitte den Schlüssel in den Einstellungen neu eintragen.'
      );
    } else {
      apiKey = klar;
    }
  }

  if (!apiKey) {
    const ausUmgebung = schluesselAusUmgebung(provider);
    if (ausUmgebung) {
      apiKey = ausUmgebung;
      quelle = 'umgebung';
    }
  }

  if (!apiKey) return null;

  return {
    provider,
    apiKey,
    model: ai?.model?.trim() || '',
    quelle,
  };
}

/**
 * Speichert die KI-Einstellungen. Das Feld `apiKey` wird dreifach
 * unterschieden, damit die Oberfläche den Schlüssel nie zurückbekommen muss:
 *
 *   undefined  → bestehender Schlüssel bleibt unverändert
 *                (der Normalfall: jemand wechselt nur das Modell)
 *   ''  / null → Schlüssel wird entfernt
 *   Zeichen    → neuer Schlüssel, verschlüsselt abgelegt
 */
export function writeAiConfig(eingabe: AiConfigInput): AiConfigPublic {
  const vorhanden = readStored();
  const bisher = vorhanden.ai;

  const neu: StoredAi = {
    provider: eingabe.provider,
    model: eingabe.model?.trim() || undefined,
    apiKeyEncrypted: bisher?.apiKeyEncrypted,
  };

  if (eingabe.apiKey === null || eingabe.apiKey === '') {
    delete neu.apiKeyEncrypted;
  } else if (typeof eingabe.apiKey === 'string') {
    neu.apiKeyEncrypted = encrypt(eingabe.apiKey);
  }

  writeStored({ ...vorhanden, version: 1, ai: neu });
  return kiZuOeffentlich(neu);
}

/** Entfernt die KI-Zugangsdaten vollständig. Die Schlüsseldatei bleibt. */
export function deleteAiConfig(): AiConfigPublic {
  const vorhanden = readStored();
  delete vorhanden.ai;
  writeStored({ ...vorhanden, version: 1 });
  // Nicht die leere Konfiguration zurückgeben, sondern neu berechnen: Steht
  // ein Schlüssel in der Umgebung, ist nach dem Löschen eben dieser wieder
  // maßgeblich — und die Oberfläche soll das anzeigen.
  return kiZuOeffentlich(undefined);
}

// ---------------------------------------------------------------------------
// Zugriffsschlüssel für die /api-Endpunkte
// ---------------------------------------------------------------------------

/**
 * Liefert den Zugriffsschlüssel dieser Installation. Reihenfolge:
 *
 *   1. Umgebungsvariable VM_ACCESS_KEY — wer einen eigenen setzen will
 *   2. der in der Konfiguration hinterlegte
 *   3. ein neu gewürfelter, der dann hinterlegt wird
 *
 * 16 Byte Zufall, als Hex geschrieben: 32 Zeichen, nur Ziffern und a–f. Das
 * ist bewusst kein Base64 — der Schlüssel muss gelegentlich abgetippt werden,
 * und dabei sind Groß-/Kleinschreibung und Zeichen wie I, l, O, 0 die
 * häufigste Fehlerquelle.
 */
export function readAccessKey(): AccessKeyInfo {
  const ausUmgebung = process.env.VM_ACCESS_KEY?.trim();
  if (ausUmgebung) {
    if (ausUmgebung.length < 16) {
      console.warn(
        `VM_ACCESS_KEY ist mit ${ausUmgebung.length} Zeichen sehr kurz. ` +
          'Ein kurzer Schlüssel lässt sich durchprobieren; empfohlen sind mindestens 24 Zeichen.'
      );
    }
    return { key: ausUmgebung, quelle: 'umgebung', neuErzeugt: false };
  }

  const vorhanden = readStored();
  if (vorhanden.accessKey) {
    return { key: vorhanden.accessKey, quelle: 'datei', neuErzeugt: false };
  }

  const neu = crypto.randomBytes(16).toString('hex');
  writeStored({ ...vorhanden, version: 1, accessKey: neu });
  return { key: neu, quelle: 'datei', neuErzeugt: true };
}
