/**
 * Serverseitige Konfiguration dieser Installation.
 * ---------------------------------------------------------------------------
 *
 * Bis Fassung 1.x lagen hier auch die verschlüsselten Zugangsdaten zum
 * Postfach des Vereins (SMTP) — der E-Mail-Versand wurde entfernt, seitdem
 * bleibt von dieser Datei nur eine einzige Aufgabe übrig: der
 * Zugriffsschlüssel für die /api-Endpunkte (siehe readAccessKey() unten).
 *
 * Der Schlüssel liegt bewusst unverschlüsselt in der Konfigurationsdatei: Er
 * ist kein fremdes Geheimnis, sondern der Ausweis, den dieser Server selbst
 * ausstellt und prüfen muss. Eine Verschlüsselung, deren Schlüssel in
 * derselben Datei daneben läge, gewänne nichts — deshalb gibt es seit der
 * Entfernung von SMTP auch keine separate Schlüsseldatei mehr.
 *
 * Wo liegt die Datei?
 * ---------------------------------------------------------------------------
 *   daten/konfiguration.json   enthält (nur noch) den Zugriffsschlüssel
 *
 * Nur für den Besitzer lesbar (Rechte 600), das Verzeichnis 700. Unter
 * Windows kennt das Dateisystem diese Rechte nicht; dort greift die Maßnahme
 * ins Leere, was Node stillschweigend hinnimmt.
 *
 * Über eine Umgebungsvariable lässt sich das Verzeichnis verlegen:
 *   VM_DATA_DIR     anderes Verzeichnis (z. B. ein Docker-Volume)
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

// ---------------------------------------------------------------------------
// Typen
// ---------------------------------------------------------------------------

interface StoredConfig {
  version: number;
  /**
   * Zugriffsschlüssel für die /api-Endpunkte. Bewusst unverschlüsselt: Er ist
   * kein fremdes Geheimnis, sondern der Ausweis, den dieser Server selbst
   * ausstellt und prüfen muss.
   */
  accessKey?: string;
}

/** Woher der Zugriffsschlüssel stammt und ob er gerade erst entstanden ist. */
export interface AccessKeyInfo {
  key: string;
  quelle: 'umgebung' | 'datei';
  neuErzeugt: boolean;
}

// ---------------------------------------------------------------------------
// Dateiablage
// ---------------------------------------------------------------------------

/**
 * Die Pfade werden bei jedem Aufruf neu bestimmt und nicht beim Laden des
 * Moduls zwischengespeichert. Das kostet nichts und macht die Tests möglich:
 * sie setzen VM_DATA_DIR auf ein Wegwerf-Verzeichnis.
 */
/**
 * Exportiert für src/server/db/localDb.ts: Die lokale SQLite-Datenbank des
 * eigenen Servers (Betriebsart 3) liegt bewusst im selben Verzeichnis wie
 * diese Konfigurationsdateien — dieselbe VM_DATA_DIR-Variable, derselbe Ort,
 * dieselbe Sicherungslogik. Eine zweite, eigene Definition dieser Funktion in
 * localDb.ts hätte auseinanderlaufen können, sobald sich hier einmal etwas
 * ändert (z. B. ein anderer Vorgabe-Pfad).
 */
export function dataDir(): string {
  const eingestellt = process.env.VM_DATA_DIR?.trim();
  return eingestellt ? path.resolve(eingestellt) : path.join(process.cwd(), 'daten');
}

function configPath(): string {
  return path.join(dataDir(), 'konfiguration.json');
}

export function ensureDataDir(): string {
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
      accessKey: geparst.accessKey,
    };
  } catch (fehler) {
    console.error(
      `Die Serverkonfiguration ${datei} ist nicht lesbar und wird ignoriert. ` +
        'Der Zugriffsschlüssel wird deshalb neu erzeugt.',
      fehler
    );
    return { version: 1 };
  }
}

function writeStored(konfiguration: StoredConfig): void {
  writeFileSafely(configPath(), JSON.stringify(konfiguration, null, 2));
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
