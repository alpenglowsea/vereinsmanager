# Sicherungsformat des VereinsManagers

Diese Datei beschreibt die Sicherungsdatei, über die die Desktop-Fassung
(Tauri/React) und die Android-App (Kotlin) denselben Bestand austauschen.
Sie ist der **Vertrag zwischen beiden Fassungen**: Das Format ändert sich nur
gemeinsam, siehe „Änderungsregel“ am Ende.

Quelle der Angaben ist der Programmcode der Desktop-Fassung (Stand
Commit `fe325af`): `src/services/backupContents.ts`, `src/services/backupCrypto.ts`
und `exportFullBackup` / `importFullBackup` in `src/services/storage.ts`.
Geprüft wurde zusätzlich eine echte Demo-Sicherung (Format-Version 1.2.3).

## 1. Zwei Dateiarten

Beide haben die Endung `.json` und sind UTF-8-Text.

- **Klartext-Sicherung:** ein JSON-Objekt, Aufbau siehe Abschnitt 2.
- **Verschlüsselte Sicherung:** ein JSON-Objekt („Hülle“), das die Klartext-
  Sicherung als verschlüsselten Text enthält, Aufbau siehe Abschnitt 5.
  Erkennung: Feld `format` hat den Wert `vereinsmanager-verschluesselt`.

## 2. Aufbau der Klartext-Sicherung

```json
{
  "app": "VereinsManager Lokal",
  "version": "1.2.3",
  "exportedAt": "2026-10-24T21:26:53.016Z",
  "data": { "members": [ ... ], "transactions": [ ... ], ... }
}
```

- `app`, `version`, `exportedAt` sind Kopfangaben. Beim Einlesen werden sie
  nur angezeigt, nicht geprüft.
- Die Daten liegen unter `data`. Fehlt `data`, wird das Objekt selbst als
  Daten behandelt (ältere Dateien).
- **Eine Datei gilt als Sicherung, wenn mindestens einer der 21 Bereiche
  vorkommt.** Sonst lehnt die App sie ab, bevor etwas verändert wird.
- Die Datei wird mit Einrückung (2 Leerzeichen) geschrieben. Beim Lesen spielt
  das keine Rolle.

## 3. Die 21 Bereiche

`liste` = Array von Einträgen, jeder Eintrag hat eine Kennung `id` (Text).
`einzel` = genau ein Objekt.

| Schlüssel in `data` | Art | Inhalt |
| --- | --- | --- |
| `members` | liste | Mitglieder |
| `transactions` | liste | Buchungen |
| `accounts` | liste | Finanzkonten |
| `auditLogs` | liste | Änderungsprotokoll |
| `inventory` | liste | Inventar |
| `memberInventory` | liste | Inventar-Ausgaben an Mitglieder |
| `sepaRuns` | liste | SEPA-Läufe |
| `documents` | liste | Dokumente (Dateiinhalt als Data-URL im Eintrag) |
| `folders` | liste | Dokumentenordner |
| `donations` | liste | Zuwendungsbestätigungen |
| `contacts` | liste | Kontakte |
| `invoices` | liste | Rechnungen |
| `invoiceTemplate` | einzel | Rechnungsvorlage |
| `meetings` | liste | Sitzungen |
| `meetingTemplate` | einzel | Sitzungsvorlage |
| `dashboardConfig` | einzel | Einstellungen der Startseite |
| `calendarEvents` | liste | Termine |
| `calendarCategories` | liste | Terminkategorien |
| `onlineApplications` | liste | Aufnahmeanträge |
| `applicationSettings` | einzel | Antragsformular-Einstellungen |
| `settings` | einzel | Vereinsstammdaten und Einstellungen |

**Nicht Teil der Sicherung:** das Gerätepasswort. Es sperrt nur das jeweilige
Gerät und reist bewusst nicht mit. Das gilt auch für die Android-App: Jedes
Gerät hat sein eigenes Gerätepasswort.

### Felder der Einträge

Welche Felder ein Eintrag hat, steht in `src/types.ts` der Desktop-Fassung.
Für den Austausch gilt:

- **Unbekannte Felder müssen erhalten bleiben.** Die Android-App speichert
  jeden Eintrag als vollständiges JSON-Dokument und schreibt ihn beim Export
  unverändert zurück, auch wenn sie ein Feld nicht kennt. Nur so geht beim
  Hin- und Herschieben nichts verloren, wenn die Desktop-Fassung ein Feld
  ergänzt.
- Beträge, Datumsangaben und Aufzählungen werden so geschrieben, wie sie die
  Desktop-Fassung schreibt. Die Android-App erfindet keine eigenen Formate.

## 4. Einspielen (Import)

Zwei Arten: **Ersetzen** und **Ergänzen**.

**Vor jedem Einspielen** legt die App eine Sicherheitskopie des bisherigen
Bestands an. Schlägt das fehl, läuft der Import trotzdem weiter. Die Android-
App muss das ebenso tun, allerdings mit einer Warnung an den Benutzer, falls
die Kopie fehlt.

**Vergleich** (vor dem Einspielen angezeigt): Einträge gelten als „derselbe“,
wenn ihre `id` übereinstimmt. Je Bereich werden Einträge in der Datei, vorhandene,
neue und zu überschreibende gezählt.

**Ersetzen**
- Je Listen-Bereich: Der Bereich wird geleert und mit dem Inhalt der Datei neu
  gefüllt.
- **Bereiche, die in der Datei fehlen (Schlüssel nicht vorhanden oder `null`),
  bleiben unverändert.** Eine ausdrücklich leere Liste (`[]`) leert den
  Bereich.
- Ein Eintrag ohne `id` ist ein Fehler für den ganzen Bereich. Nach dem
  Schreiben wird nachgezählt: Die Zahl der Einträge muss der Zahl der
  verschiedenen Kennungen entsprechen.
- Ein fehlgeschlagener Bereich reißt die anderen nicht mit. Am Ende nennt die
  Meldung alle betroffenen Bereiche.

**Ergänzen**
- **Der vorhandene Bestand gewinnt immer.** Aus der Datei kommen nur Einträge
  hinzu, deren `id` hier noch nicht existiert. Vorhandene werden nicht
  verändert, auch nicht, wenn die Datei eine neuere Fassung enthält.
- Eine leere Liste in der Datei tut nichts.
- Einzel-Bereiche: Ist hier schon einer vorhanden, bleibt er. Ausnahme
  `settings`, siehe unten.
- **`settings` wird feldweise zusammengeführt:** Ein Feld, das der Benutzer
  selbst gefüllt hat, bleibt. Ein leeres Feld oder ein noch unberührter
  Mustertext („TSV Musterstadt …“) wird durch den Wert aus der Datei ersetzt,
  sofern die Datei einen hat. Die Muster-Stammdaten stehen im Quellcode in
  `DEFAULT_SETTINGS`. Die Android-App braucht dieselbe Liste, siehe
  Phase-0-Aufgaben.

**Veraltete Felder in `settings`:** Beim Einspielen werden diese Felder
verworfen, nicht übernommen: `smtpHost`, `smtpPort`, `smtpSecure`, `smtpUser`,
`smtpPassword`, `smtpFromEmail`, `smtpFromName` sowie die KI-Zugangsfelder
(`VERALTETE_SMTP_FELDER` in `storage.ts`, Zeile 184 ff. enthält die vollständige
Liste). Die Android-App darf sie ebenfalls nie schreiben.

**Kennungen der Einzel-Bereiche** (Schlüssel in der Desktop-Datenbank):

| Bereich | Kennung in der Datenbank |
| --- | --- |
| `invoiceTemplate` | `main_template` |
| `meetingTemplate` | `main_meeting_template` |
| `dashboardConfig` | `main_dashboard` |
| `applicationSettings` | `main` |
| `settings` | `main` |

Die Einzel-Objekte in der Datei haben **nicht immer** eine `id` (in der
Demo-Sicherung fehlt sie bei vier von fünf). Beim Einspielen wird sie ergänzt,
eine in der Datei vorhandene `id` hat Vorrang.

**Auffälligkeit in der Desktop-Fassung (nur aus dem Code gelesen, nicht
ausprobiert):** Beim Einspielen wird `meetingTemplate` mit der Kennung
`main_template` ergänzt, gelesen wird sie aber unter `main_meeting_template`.
Weil der Export die Kennung `main_meeting_template` mitschreibt, geht das bei
Dateien von der Desktop-Fassung gut. Eine Datei, in der `meetingTemplate`
**keine** `id` hat, würde die Sitzungsvorlage unter dem falschen Schlüssel
ablegen, und sie wäre danach nicht auffindbar. Die Android-App schreibt
deshalb immer `"id": "main_meeting_template"` in ihre Exportdatei.

## 5. Verschlüsselte Sicherung

Die Hülle:

```json
{
  "app": "VereinsManager Lokal",
  "format": "vereinsmanager-verschluesselt",
  "version": 1,
  "kdf": "PBKDF2-SHA256",
  "iterations": 600000,
  "cipher": "AES-256-GCM",
  "salt": "<Base64, 16 Bytes>",
  "iv": "<Base64, 12 Bytes>",
  "daten": "<Base64, verschlüsselter Text samt Prüfwert>"
}
```

**Verschlüsseln**
1. Passwort: mindestens 8 Zeichen, als UTF-8 in Bytes umgewandelt.
2. Schlüssel: PBKDF2 mit HMAC-SHA-256, 600 000 Runden, 16 zufällige Bytes
   Salz, 32 Bytes (256 Bit) Länge.
3. Verschlüsseln: AES-256 im GCM-Modus, 12 zufällige Bytes IV, 128 Bit
   Prüfwert. Zusätzliche Authentifizierungsdaten gibt es nicht.
4. Klartext ist der UTF-8-Text der Klartext-Sicherung (Abschnitt 2).
5. `daten` ist das Ergebnis als Base64 (Standard-Alphabet mit Auffüllzeichen
   `=`): erst der verschlüsselte Text, **direkt dahinter die 16 Bytes
   Prüfwert**. Das entspricht dem Ausgabeformat von `AES/GCM/NoPadding` in
   Java und Kotlin.

**Entschlüsseln:** `format` muss stimmen und `version` gleich `1` sein, sonst
„neuere Fassung“. `iterations` muss eine ganze Zahl zwischen 100 000 und
5 000 000 sein, `salt`, `iv`, `daten` müssen Texte sein. Bei falschem Passwort
oder veränderter Datei schlägt die Prüfung fehl. Beides ist nicht
unterscheidbar, die Meldung nennt deshalb beides.

**Es gibt keine Hintertür.** Ohne Passwort lässt sich die Datei nicht lesen.

### Geprüft, dass beide Seiten dieselbe Datei lesen

Am 24.10.2026 wurde die Verschlüsselung der Desktop-Fassung (`backupCrypto.ts`,
unverändert ausgeführt) gegen die Standard-Java-Kryptografie (`javax.crypto`,
`PBKDF2WithHmacSHA256` und `AES/GCM/NoPadding`, JDK 21) geprüft, in beide
Richtungen und mit einem Passwort mit Umlauten (`Pässwort-ÄÖÜ-12345`) sowie
einem Klartext mit Umlauten, ß und nicht-lateinischen Zeichen: Beide Seiten
lesen die Datei der jeweils anderen, ein falsches Passwort wird abgelehnt.

**Noch nicht geprüft:** auf einem Android-Gerät. Android verwendet nicht
dieselbe Kryptografie-Bibliothek wie ein Desktop-JDK. Bei Passwörtern mit
Nicht-ASCII-Zeichen können Anbieter-Unterschiede auftreten. Das ist Probe A in
Phase 0 und muss mit einem Umlaut-Passwort auf dem Nord 4 laufen. Als
Rückfallweg ist vorgesehen, die 600 000 Runden selbst mit `Mac(HmacSHA256)` zu
rechnen, statt die Schlüsselableitung dem Anbieter zu überlassen.

### Testdatei für die Android-Tests

Passwort: `Pässwort-ÄÖÜ-12345`

```json
{"app":"VereinsManager Lokal","format":"vereinsmanager-verschluesselt","version":1,"kdf":"PBKDF2-SHA256","iterations":600000,"cipher":"AES-256-GCM","salt":"SSKEOmZtQSOcSn+OOCx7LQ==","iv":"WTnCAvSKUWtAQbro","daten":"j29+2iHw9hI97XycB8pHLA3OTTEuuiK+8DTkU+nX638aFD8AI6LwSEGhNKUB0QbbBRZiCx+2aEHP6ln3TMaQZJwZdPX7TYVbnQqK1EDNjHB+CiTU5OcAuX4IVRxDCu/peoFcwKyEm/5x+KKpMTwhX0sOYlFH6VYQrwTSaGvFkyrbIbFoj3IVgnjdYYlgQ/2f9A7F9cXZO95DrxAUzftsW8AXZJ8pKi+9TPrA8WsdpL8aGQi3jPp8i4SyHgAVTh/Wxi2P+K+H9dQaVmAcXwLAnF+ahA+3wtJYYu7qUw=="}
```

Entschlüsselt muss exakt dieser Text herauskommen (2 Leerzeichen Einrückung,
Zeilenumbrüche `\n`, kein Zeilenumbruch am Ende):

```json
{
  "app": "VereinsManager Lokal",
  "version": "1.2.3",
  "data": {
    "members": [
      {
        "id": "m1",
        "firstName": "Jörg",
        "lastName": "Müßig ✓ 日本"
      }
    ]
  }
}
```

## 6. Größe

Dokumente, Belege und Unterschriften stecken als Base64-Text in der Datei. Die
Demo-Sicherung hat rund 177 KB, ein größter einzelner Dokument-Eintrag rund
17 KB. Echte Vereinsbestände mit vielen Belegen können viele Megabyte erreichen.
Die Desktop-Fassung testet eine mehrere Megabyte große verschlüsselte Sicherung.
Die Android-App muss große Dateien **streamend** lesen und darf nicht erst die
ganze Datei als einen Text laden. Probe C in Phase 0 misst das auf dem Gerät.

## 7. Änderungsregel

Dieses Format ändert sich **nur gemeinsam** für beide Fassungen:

1. Soll an der Desktop-Fassung etwas geändert werden, das die Sicherungsdatei
   berührt (neuer Bereich, neues Pflichtfeld, andere Verschlüsselung, andere
   Importregel), wird zuerst diese Datei angepasst und `version` entsprechend
   erhöht.
2. Die Android-App wird im selben Zug angepasst und gegen die Testdateien
   geprüft.
3. Auf der Desktop-Seite sorgt `pruefungAlleStoresGesichert` in
   `backupContents.ts` dafür, dass ein neuer Datenbereich nicht stillschweigend
   aus der Sicherung fällt. Die Android-App bekommt eine gleichwertige Prüfung
   (Test, der die 21 Schlüssel dieser Datei gegen den Code abgleicht).
