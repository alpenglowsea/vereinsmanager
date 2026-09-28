/**
 * Anmeldung am eigenen Server (Betriebsart 3) — Zusammenspiel von Konten
 * (repositories/localUsers.ts) und Sitzungen (repositories/localSessions.ts).
 * ---------------------------------------------------------------------------
 *
 * Diese Datei ist das Gegenstück zu apiAuth.ts, nur eine Ebene weiter innen:
 * apiAuth.ts entscheidet "darf diese Anfrage den Server überhaupt erreichen"
 * (der Zugriffsschlüssel der Installation, unverändert). Diese Datei
 * entscheidet zusätzlich, für die lokalen Datenrouten unter
 * /api/local-server/*, "als wer ist diese Anfrage angemeldet".
 *
 * server.ts verdrahtet beides zu Express-Middleware; die eigentliche Logik
 * steht bewusst hier, ohne jede Express-Abhängigkeit — genau wie bei
 * pruefeZugriff() in apiAuth.ts lässt sich das dadurch ohne einen laufenden
 * Server testen.
 */

import { ALL_AREAS_EDIT, ALL_AREAS_NONE } from '../utils/permissions';
import {
  countUsers,
  createUser,
  getUserByEmail,
  getUserById,
  setPassword,
  verifyCredentials,
  BenutzerAnlegenFehler,
  type LocalUser,
} from './db/repositories/localUsers';
import { createSession, deleteSession, getSession } from './db/repositories/localSessions';
import {
  createPasswordReset,
  loesePasswortResetEin,
  pruefePasswortReset,
} from './db/repositories/localPasswordResets';

/** Der Kopf, in dem die Oberfläche den Sitzungscode mitschickt. */
export const SITZUNG_HEADER = 'x-vm-sitzung';

/**
 * Bewusst KEIN "discriminated union" (also nicht zwei sich ausschließende
 * Formen je nach erfolg), obwohl das auf den ersten Blick nahegelegen hätte
 * — genau diese Form hatte bei dir einen echten `npm run check`-Fehler
 * ausgelöst, den ich hier nicht nachstellen konnte: Sobald `erfolg` je nach
 * Zweig zwischen `true` und `false` unterschied, hat TypeScript in deiner
 * Fassung (5.8) an mehreren Stellen NICHT erkannt, dass im "erfolg: false"-
 * Zweig automatisch ein `grund`-Feld existiert — obwohl genau dieses Muster
 * in meiner eigenen Prüfumgebung (TypeScript 6.0, ohne npm-Zugriff kann ich
 * dort keine ältere Fassung installieren) fehlerfrei durchläuft. Ich habe
 * die genaue Ursache nicht gefunden; diese Form hier umgeht das Problem
 * vollständig, weil `benutzer`, `sitzungsToken` und `grund` jetzt IMMER
 * erlaubte (aber optionale) Felder sind, egal was `erfolg` gerade ist — es
 * gibt also nichts mehr, was der Compiler an dieser Stelle "erkennen"
 * müsste. Der Nachteil: Der Compiler prüft nicht mehr von sich aus, dass
 * bei erfolg:true auch wirklich ein benutzer mitgeschickt wird — das
 * übernehmen jetzt die Funktionen unten von Hand (siehe die "|| !...".
 * Prüfungen in anmelden() und in server.ts).
 */
export interface AnmeldeErgebnis {
  erfolg: boolean;
  benutzer?: LocalUser;
  sitzungsToken?: string;
  grund?: string;
}

/**
 * Richtet das allererste Konto ein und meldet es gleich an — kein
 * gesonderter Einrichtungscode nötig (siehe Übergabe-Vorschlag vom 27.09.):
 * Wer diese Route überhaupt erreicht, hat bereits den Zugriffsschlüssel der
 * Installation, und genau der übernimmt hier die Rolle des Codes.
 *
 * Verweigert die Einrichtung, sobald bereits ein Konto existiert — danach
 * geht es nur noch über die normale Anmeldung oder darüber, dass ein
 * bestehendes Konto ein weiteres anlegt (siehe createUser in
 * repositories/localUsers.ts).
 */
export async function ersteEinrichtung(params: {
  email: string;
  name: string;
  password: string;
}): Promise<AnmeldeErgebnis> {
  if (countUsers() > 0) {
    return {
      erfolg: false,
      grund: 'Es besteht bereits ein Konto auf diesem Server. Bitte über die normale Anmeldung fortfahren.',
    };
  }

  const benutzer = await createUser({
    email: params.email,
    name: params.name,
    password: params.password,
    customRoleName: '1. Vorsitzende(r)',
    permissions: ALL_AREAS_EDIT,
    mustChangePassword: false,
  });

  // Zwischen der Prüfung oben und dem Anlegen liegt ein await (siehe
  // createUser) — ein zweiter, fast gleichzeitiger Einrichtungsversuch
  // könnte theoretisch ebenfalls durchkommen. Die Folge wäre höchstens ein
  // zweites Vorstandskonto statt eines einzigen, keine Sicherheitslücke;
  // ein Schloss dafür wäre hier mehr Aufwand, als der seltene Fall wert ist.

  const sitzung = createSession(benutzer.id);
  return { erfolg: true, benutzer, sitzungsToken: sitzung.token };
}

export async function anmelden(email: string, password: string): Promise<AnmeldeErgebnis> {
  const pruefung = await verifyCredentials(email, password);
  if (!pruefung.ok || !pruefung.benutzer) {
    // Bewusst dieselbe Meldung für "Adresse unbekannt" und "Passwort
    // falsch" — sonst ließe sich von außen abtasten, welche Adressen
    // überhaupt ein Konto haben.
    if (pruefung.grund === 'DEAKTIVIERT') {
      return {
        erfolg: false,
        grund: 'Dieses Konto wurde deaktiviert. Bitte an den Vorstand wenden.',
      };
    }
    return { erfolg: false, grund: 'E-Mail-Adresse oder Passwort falsch.' };
  }

  const sitzung = createSession(pruefung.benutzer.id);
  return { erfolg: true, benutzer: pruefung.benutzer, sitzungsToken: sitzung.token };
}

export function abmelden(sitzungsToken: string): void {
  deleteSession(sitzungsToken);
}

/**
 * Steht die Ersteinrichtung noch aus, oder gibt es bereits mindestens ein
 * Konto auf diesem Server?
 *
 * Die Oberfläche braucht das VOR jedem Anmeldeversuch: Ohne diese Auskunft
 * wüsste sie nicht, ob sie die Ersteinrichtungsmaske (E-Mail, Name, Passwort
 * für den ersten Vorstand) oder die normale Anmeldemaske zeigen soll — genau
 * wie isCloudSetupPending() das für den Cloud-Betrieb schon beantwortet.
 */
export function istEinrichtungAusstehend(): boolean {
  return countUsers() === 0;
}

// Dieselbe Umstellung wie bei AnmeldeErgebnis oben (Begründung dort): eine
// einzige Form mit optionalen Feldern statt zwei sich ausschließender.
export interface SitzungsBefund {
  angemeldet: boolean;
  benutzer?: LocalUser;
  grund?: string;
}

/**
 * Prüft einen Sitzungscode aus dem SITZUNG_HEADER. Lehnt außerdem ab, wenn
 * das Konto inzwischen deaktiviert wurde — auch wenn die Sitzung selbst noch
 * gültig wäre: Eine Deaktivierung soll sofort wirken, nicht erst nach Ablauf
 * der Sitzung.
 */
export function pruefeSitzung(sitzungsToken: unknown): SitzungsBefund {
  if (typeof sitzungsToken !== 'string' || !sitzungsToken.trim()) {
    return { angemeldet: false, grund: 'Keine Anmeldung vorhanden. Bitte anmelden.' };
  }

  const sitzung = getSession(sitzungsToken.trim());
  if (!sitzung) {
    return { angemeldet: false, grund: 'Die Sitzung ist abgelaufen oder ungültig. Bitte erneut anmelden.' };
  }

  const benutzer = getUserById(sitzung.userId);
  if (!benutzer || !benutzer.isActive) {
    return { angemeldet: false, grund: 'Dieses Konto ist nicht mehr aktiv. Bitte an den Vorstand wenden.' };
  }

  return { angemeldet: true, benutzer };
}

/**
 * "Passwort vergessen": Ergebnis einer Anfrage. Bewusst so gebaut, dass
 * server.ts unabhängig davon, ob die Adresse zu einem Konto gehört, immer
 * dieselbe Auskunft an die Oberfläche geben kann (siehe die Route selbst) —
 * nur wenn hier ein Ergebnis zurückkommt, wird tatsächlich eine E-Mail
 * verschickt.
 *
 * Antwortet mit null sowohl bei unbekannter Adresse als auch bei einem
 * deaktivierten Konto — aus demselben Grund wie bei anmelden() oben: Ein
 * deaktiviertes Konto soll sich nicht über den Umweg "Passwort vergessen"
 * wieder hereinlassen, und von außen soll sich beides nicht unterscheiden
 * lassen.
 */
export function passwortVergessenAnfrage(email: string): {
  userId: string;
  token: string;
  name: string;
  email: string;
} | null {
  const benutzer = getUserByEmail(email);
  if (!benutzer || !benutzer.isActive) return null;

  const reset = createPasswordReset(benutzer.id);
  return { userId: benutzer.id, token: reset.token, name: benutzer.name, email: benutzer.email };
}

// Dieselbe Umstellung wie bei AnmeldeErgebnis oben (Begründung dort).
export interface PasswortResetErgebnis {
  erfolg: boolean;
  grund?: string;
}

/**
 * Löst einen Reset-Link ein: prüft ihn, setzt bei Erfolg das neue Passwort
 * (setPassword() – dieselbe Funktion wie bei der freiwilligen Änderung im
 * Konto selbst, beendet also auch hier alle bestehenden Sitzungen) und
 * markiert den Link erst DANACH als verbraucht. Scheitert das Setzen (z. B.
 * zu schwaches Passwort), bleibt der Link innerhalb seiner Gültigkeit
 * weiter benutzbar — ein Tippfehler beim neuen Passwort soll nicht dazu
 * führen, dass der ganze Link verfällt und eine neue E-Mail nötig wird.
 */
export async function passwortZuruecksetzen(
  token: string,
  neuesPasswort: string
): Promise<PasswortResetErgebnis> {
  const befund = pruefePasswortReset(token);
  if (!befund) {
    return {
      erfolg: false,
      grund: 'Dieser Link ist ungültig oder abgelaufen. Bitte ein neues Zurücksetzen anfordern.',
    };
  }

  try {
    await setPassword(befund.userId, neuesPasswort);
  } catch (fehler) {
    if (fehler instanceof BenutzerAnlegenFehler) {
      return { erfolg: false, grund: fehler.message };
    }
    throw fehler;
  }

  loesePasswortResetEin(token);
  return { erfolg: true };
}

// Nur re-exportiert, damit server.ts nicht zusätzlich aus repositories/
// importieren muss, wenn es einen neuen Benutzer anlegen will (z. B. wenn
// ein Vorstandsmitglied ein weiteres Konto erstellt).
export { createUser, listUsers } from './db/repositories/localUsers';
export { ALL_AREAS_NONE };
