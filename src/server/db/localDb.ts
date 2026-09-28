/**
 * Verbindung zur lokalen SQLite-Datenbank des eigenen Servers (Betriebsart 3).
 * ---------------------------------------------------------------------------
 *
 * Das ist die Gegenstelle zu supabaseClient.ts im Cloud-Betrieb: Dort spricht
 * die Oberfläche mit einer fremden Datenbank über das Netz, hier hält der
 * Server selbst eine einzige Datei auf der eigenen Platte offen.
 *
 * Warum node:sqlite und nicht ein zusätzliches Paket (z. B. better-sqlite3)?
 * ---------------------------------------------------------------------------
 * better-sqlite3 wäre die reifere, "klassische" Wahl gewesen — aber es bringt
 * für jede Plattform eine vorkompilierte Programmdatei mit, die beim
 * Installieren nachgeladen oder aus dem Quelltext gebaut werden muss. Genau
 * das passiert in .github/workflows/release-desktop.yml NICHT mehr: Der
 * Schritt "Server-Laufzeit zusammenstellen" installiert die Pakete für die
 * Desktop-Fassung bewusst mit `--ignore-scripts` (Zeile "npm ci --omit=dev
 * --no-audit --ignore-scripts") — das unterdrückt genau den Installationsschritt,
 * den better-sqlite3 dafür bräuchte. Das Paket stünde zwar im Ordner, aber
 * ohne die dazugehörige Programmdatei, und der Server stürzte beim ersten
 * Zugriff auf die Datenbank ab. Diesen Schritt zu ändern hätte bedeutet, für
 * alle Pakete zusammen zuzulassen, dass sie beim Installieren beliebigen Code
 * ausführen dürfen — ein Sicherheitsgewinn, der extra dafür eingebaut wurde,
 * würde für eine einzelne Datenbank-Anbindung wieder aufgegeben.
 *
 * node:sqlite ist dagegen Bestandteil von Node selbst — keine Programmdatei,
 * kein Installationsschritt, der schiefgehen kann, nichts, was `--ignore-
 * scripts` betrifft. Der einzige Nachteil: Node stuft dieses Modul noch als
 * "Release Candidate" ein (Stufe 1.2 von 3, noch nicht "Stable") und gibt bei
 * jeder Verbindung einmalig eine Hinweiszeile auf der Konsole aus
 * ("ExperimentalWarning: SQLite is an experimental feature..."). Das ist
 * keine Fehlermeldung — nur Node, das ehrlich sagt, dass sich an der
 * Schnittstelle theoretisch noch etwas ändern könnte. Für dieses Projekt
 * wiegt das wenig: Jede gebaute Fassung bringt ihre eigene, fest eingepackte
 * Node-Laufzeitumgebung mit (siehe DESKTOP_RELEASE.md, "vm-node-<plattform>"),
 * läuft also immer mit genau der Node-Version, mit der sie gebaut wurde — ein
 * späterer Node-Wechsel auf einem fremden Rechner kann dieser Fassung nichts
 * mehr ändern.
 *
 * Wo liegt die Datei?
 * ---------------------------------------------------------------------------
 * Im selben Verzeichnis wie die übrige Serverkonfiguration (dataDir() aus
 * instanceConfig.ts, per VM_DATA_DIR verlegbar): daten/vereinsdaten.sqlite.
 * Anders als konfiguration.json und schluessel.key gehört diese Datei zu den
 * Vereinsstammdaten — sie darf und soll bei einer Datensicherung mitgenommen
 * werden.
 *
 * Warum kein WAL-Modus? SQLites "Write-Ahead-Log"-Modus beschleunigt
 * gleichzeitige Lese-/Schreibzugriffe, hält dafür aber dauerhaft zwei
 * zusätzliche Dateien neben der eigentlichen (*-wal, *-shm) und verlangt für
 * eine saubere Sicherung einen expliziten Zwischenschritt ("Checkpoint").
 * Dieser Server bedient einen einzigen Verein mit überschaubarem Andrang —
 * der Vorteil des WAL-Modus wiegt hier nichts. Bleibt es bei der Vorgabe
 * (dem "Rollback Journal"), reicht "Datei kopieren" für eine Sicherung immer
 * aus, solange dabei nicht gerade geschrieben wird: Es gibt dann nur die eine
 * Datei, nie eine zweite, die dazugehört.
 */

import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { ensureDataDir } from '../instanceConfig';
import { SCHEMA_SQL, SCHEMA_VERSION } from './schema';

function dbPath(): string {
  return path.join(ensureDataDir(), 'vereinsdaten.sqlite');
}

/**
 * Die offene Verbindung. Wird beim ersten Zugriff aufgebaut und danach
 * wiederverwendet — SQLite-Verbindungen sind nicht teuer, aber jede
 * Schema-Prüfung beim Öffnen unnötig zu wiederholen, ist reine Verschwendung.
 */
let verbindung: DatabaseSync | null = null;

/**
 * Bringt eine frisch geöffnete Datenbank auf den erwarteten Stand. Läuft bei
 * jedem Start des Servers — bei einer bereits vorhandenen, aktuellen
 * Datenbank tun die CREATE-Anweisungen (alle mit IF NOT EXISTS) dann nichts.
 *
 * Ist die Datenbank älter als diese Fassung von VereinsManager (schema_meta
 * .version < SCHEMA_VERSION), wäre hier künftig eine Migration einzuhängen.
 * Für Version 1 gibt es noch keine vorherige Fassung, also auch noch keine
 * Migration nachzuziehen — dieser Fall kann heute nicht eintreten.
 *
 * Ist die Datenbank NEUER als diese Fassung des Programms (jemand hat eine
 * ältere VereinsManager-Version über eine neuere Datenbank gestartet), wird
 * bewusst abgebrochen: Blind weiterzuarbeiten könnte Spalten übersehen, die
 * eine neuere Fassung bereits erwartet.
 */
function initialisiere(db: DatabaseSync): void {
  db.exec('PRAGMA foreign_keys = ON');
  // Wartet notfalls kurz auf eine Sperre, statt sofort mit "database is
  // locked" abzubrechen. Bei einer einzigen Verbindung im Normalfall
  // wirkungslos — eine billige Absicherung für den Tag, an dem doch einmal
  // zwei Zugriffe aufeinandertreffen.
  db.exec('PRAGMA busy_timeout = 5000');
  db.exec(SCHEMA_SQL);

  // Der Umweg über "unknown": node:sqlite liefert hier ein generisches
  // Record<string, SQLOutputValue> zurück, nicht "unknown" — ein direkter
  // Sprung zu einer konkreten Form wie { version: number } lehnt der
  // TypeScript-Compiler deshalb als "überlappt nicht ausreichend" ab (siehe
  // dieselbe Anmerkung in repositories/members.ts).
  const zeile = db.prepare('SELECT version FROM schema_meta WHERE id = 1').get() as unknown as
    | { version: number }
    | undefined;

  if (!zeile) {
    db.prepare('INSERT INTO schema_meta (id, version) VALUES (1, ?)').run(SCHEMA_VERSION);
    return;
  }

  if (zeile.version > SCHEMA_VERSION) {
    throw new Error(
      `Die Datenbank ${dbPath()} wurde von einer neueren Fassung von VereinsManager ` +
        `angelegt (Schema-Version ${zeile.version}; diese Fassung kennt nur bis ` +
        `${SCHEMA_VERSION}). Bitte VereinsManager aktualisieren, bevor diese ` +
        'Installation den eigenen Server wieder startet.'
    );
  }

  // zeile.version < SCHEMA_VERSION: Platz für künftige Migrationsschritte.
}

/**
 * Liefert die eine, gemeinsam genutzte Datenbankverbindung. Öffnet sie beim
 * ersten Aufruf und prüft dabei das Schema; jeder weitere Aufruf bekommt
 * dieselbe Verbindung zurück.
 */
export function getLocalDb(): DatabaseSync {
  if (verbindung) return verbindung;
  const db = new DatabaseSync(dbPath());
  initialisiere(db);
  verbindung = db;
  return verbindung;
}

/**
 * Nur für Tests: schließt eine offene Verbindung und vergisst sie, damit der
 * nächste getLocalDb()-Aufruf (z. B. nach einem Wechsel von VM_DATA_DIR in
 * einem anderen Test) eine neue Datenbank öffnet statt die alte Verbindung
 * weiterzuverwenden.
 */
export function closeLocalDbForTests(): void {
  verbindung?.close();
  verbindung = null;
}
