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

Beide haben die Endung `.json` und sind UTF-8-Text. Daneben gibt es seit
Format 1.3.0 das **Sicherungspaket** (`.zip`), siehe Abschnitt 8; beide
Fassungen schreiben und lesen es (Desktop schreibt seit P30 Teil 2,
21.11.2026).

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
- **Eine Datei gilt als Sicherung, wenn mindestens einer der 19 Bereiche
  vorkommt.** Sonst lehnt die App sie ab, bevor etwas verändert wird.
- Die Datei wird mit Einrückung (2 Leerzeichen) geschrieben. Beim Lesen spielt
  das keine Rolle.

## 3. Die 19 Bereiche

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
| `settings` | einzel | Vereinsstammdaten und Einstellungen |

**Entfallene Bereiche (Entscheidung 25.10.2026):** `onlineApplications` (Aufnahmeanträge) und
`applicationSettings` (Antragsformular-Einstellungen) gehören nicht mehr zur Sicherung, weder in der
Android-App noch am Desktop (dort seit Paket P29, November 2026). Steht einer der beiden in einer
älteren Datei, wird er beim Einspielen überlesen und verworfen. Der Desktop entfernt die beiden
Speicherbereiche beim ersten Start nach dem Update samt Inhalt aus seiner Datenbank.

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

### Ergänzungen vom 16.11.2026 (ohne neue Formatversion)

- **`settings.customSkr42Accounts`**: die selbst angelegten Nummernkreise und Konten,
  `{ customMainCategories: [...], customSubCategories: [{ mainCatIdOrCode, subCategory }] }`. Das Feld ist freiwillig.
- **`settings.skr42Anpassungen`** (seit 26.11.2026): Anpassungen des Vereins am Kontenrahmen, auch an den mitgelieferten
  Konten, immer über die **ursprüngliche** Nummer (Schlüssel; mitgeliefert oder beim Anlegen vergeben):
  `{ nummernkreise: { "<Schlüssel>": { nummer?, name?, ausgeblendet? } }, konten: { "<Schlüssel>": { nummer?, name?, vatRateDefault?, ausgeblendet? } } }`.
  `nummer` (seit 2.1.0, ebenfalls 26.11.2026) ist die neue Nummer, wenn der Verein umnummeriert hat; der Schlüssel bleibt
  dabei gleich. Nur abweichende Werte stehen drin; ein Eintrag gleich dem Original fällt weg. Das Feld ist freiwillig.
  Eine ältere Fassung ohne `nummer` überliest das Feld und zeigt die ursprünglichen Nummern; die Buchungen tragen aber
  schon die neuen.
- Beide Felder gelten an **Desktop und Android** gleich (Regeln: `src/utils/kontenrahmen.ts`,
  `android/core/.../skr42/Kontenrahmen.kt`). Am Handy liegen sie so im Dokument `settings/main`; am Desktop liegen sie in
  der Datenbank getrennt von den Stammdaten (Kennung `kontenrahmen`) und werden beim Sichern in `settings` eingefügt.
  Beim Einspielen: „Ersetzen“ ersetzt den Kontenrahmen, „Ergänzen“ nimmt fehlende Konten und Anpassungen hinzu (gleiche
  Nummer = vorhanden). Fehlt ein Feld in der Datei (ältere Sicherung), bleibt der vorhandene Stand dazu unangetastet,
  an beiden Fassungen.
- Buchungen tragen Nummernkreis und Konto als Text („40000 - Bezeichnung“) und die Nummer (`skrAccount`). Eine neue
  Bezeichnung schreibt die App beim Umbenennen in alle Buchungen des Kontos bzw. Nummernkreises, samt Teilbuchungen.
- **`accounts[].order`** ist die maßgebliche Reihenfolge der Konten (0, 1, 2 …), an Desktop und Android. Die frühere
  Desktop-Liste im Browserspeicher (`vm_accounts_order`) gilt nicht mehr.

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

(Das Sicherungspaket, Abschnitt 8, ist ein Entwurf dieser Änderung und wird ebenfalls nur gemeinsam eingeführt.)

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
   (Test, der die 19 Schlüssel dieser Datei gegen den Code abgleicht).

## 8. Sicherungspaket (Format 1.3.0) – Entwurf, Stand 27.10.2026

**Status:** auf Android im Kern umgesetzt und getestet (`BackupPaket`). Am Desktop seit 16.11.2026 **lesbar**
(`src/services/backupPaket.ts`, mit und ohne Passwort) und seit 21.11.2026 **schreibbar**
(`src/services/backupPaketSchreiben.ts`, ZIP-Schreiber `src/utils/zipSchreiben.ts`). Beim Sichern am Desktop ist das Paket
vorgewählt; die JSON-Sicherung nach den Abschnitten 1 bis 5 bleibt wählbar. Die Android-App liest beides.

**Desktop beim Schreiben:** Jede Base64-Data-URL an den vier Stellen der Tabelle unten wird zu einer Datei im ZIP, im Eintrag
steht danach der Pfad. Gleicher Inhalt steht nur einmal im ZIP (erkannt am Base64-Text; Android erkennt ihn an der Datei-Kennung,
nach dem Einspielen einer Desktop-Sicherung also ebenfalls am Inhalt). Leere Werte, Internetadressen und Data-URLs ohne Base64
bleiben unverändert im Eintrag. Pfade und Dateinamen nach denselben Regeln wie Android (`Dateinamen`, Ordnerpfade, Belegnamen,
Reihenfolge Dokumente → Buchungen → Mitglieder → Inventar). Deflate über `CompressionStream('deflate-raw')`; fehlt die Funktion,
gültige Deflate-Blöcke ohne Kompression. Größen stehen im lokalen Kopf vor den Daten (kein Datenbeschreiber), damit Android das
Paket als Datenstrom liest. Mit Passwort: AE-2, AES-256, PBKDF2-HMAC-SHA1 mit 1000 Runden, je Eintrag ein zufälliges Salz,
CRC 0, Zusatzfeld `0x9901` mit Methode 8, Versionsangabe 51. Gegengeprüft mit Info-ZIP `unzip -t`, Java `ZipInputStream`
(Datenstrom wie am Handy), Python `zipfile` und einer eigenen Python-Entschlüsselung nach der AE-Beschreibung; am 21.11.2026
in der Android-App eingespielt, mit und ohne Passwort (T-275).

**Desktop beim Lesen:** Die Dateien werden aus dem ZIP geholt und als Data-URL wieder in die Einträge gesetzt (`file` → `dataUrl`,
`receipt.file` → `receipt.dataUrl`, `avatarFile` → `avatarUrl`, `photoFile` → `photoUrl`); danach läuft der Einspielweg aus
Abschnitt 4. `sicherung.json` wird am Namen gefunden und muss am Desktop nicht der erste Eintrag sein. Passwörter werden als UTF-8
gelesen. Geprüft gegen selbst gebaute Testpakete (zlib und OpenSSL von Node) nach der Beschreibung unten.

**Warum:** Belege, Dokumente und Fotos als Base64 im Text sprengen bei echten Beständen Speicher und Zeilengrenzen
(Abschnitt 6). Im Paket liegen sie als eigene Dateien.

### Aufbau

Eine ZIP-Datei (Endung `.zip`). Der **erste Eintrag ist `sicherung.json`**, danach die Dateien:

```
sicherung.json
dokumente/<Ordner>/<Unterordner>/<Datei>
dokumente/Buchhaltungsbelege & Finanzen/Belege 2026/2026-03-01 Sportshop Franke BE-2026-010.pdf
mitglieder-fotos/M-0012 Müller Jörg.jpg
inventar-fotos/Trikotsatz.png
```

- ZIP nach Standard, Dateinamen UTF-8 (Flag Bit 11), Kompression Deflate. Schreiben ohne Kenntnis der Größe vorab
  (Datenbeschreibung nach den Daten), deshalb beim Lesen mit Datenstrom nur Deflate, nicht „gespeichert“.
- **Passwort (optional):** WinZip-AES (AE-2), 256 Bit, Schlüsselableitung PBKDF2-HMAC-SHA1 mit 1000 Runden
  (so legt es der Standard fest), jeder Eintrag einzeln. Auf Android mit der Bibliothek zip4j 2.11.5 (Apache-2.0)
  erzeugt und mit einer unabhängigen Python-Umsetzung der AE-Beschreibung nachgerechnet (Schlüssel, Prüfwert,
  HMAC, Entschlüsselung stimmen). **Dateinamen und Ordnernamen sind nach dem ZIP-Standard nicht verschlüsselt**, der
  Inhalt aller Einträge einschließlich `sicherung.json` schon. Mindestlänge des Passworts: 8 Zeichen (Anwendungsregel, nicht Teil des Formats).
- Die alte Hülle aus Abschnitt 5 (AES-GCM) bleibt für JSON-Sicherungen bestehen und lesbar.

### `sicherung.json`

Wie Abschnitt 2 mit `version: "1.3.0"`. Der Inhalt von Dateien steht nicht mehr im Eintrag. Statt der Data-URL steht der
**Pfad der Datei im ZIP**:

| Bereich | bisher (1.2.3) | im Paket (1.3.0) |
| --- | --- | --- |
| `documents[]` | `dataUrl` | `file` |
| `transactions[].receipt` | `receipt.dataUrl` | `receipt.file` |
| `members[]` | `avatarUrl` | `avatarFile` |
| `inventory[]` | `photoUrl` | `photoFile` |

- Dieselbe Datei darf von mehreren Einträgen genannt werden (gleicher Pfad); sie steht im ZIP nur einmal. Das ist der
  Normalfall, wenn ein Beleg zugleich an der Buchung hängt und als Dokument geführt wird.
- Andere Data-URLs (Logo, Unterschriften, Briefpapier-Vorlagen in den Einstellungen, Sitzungen und Anträgen) bleiben unverändert
  im Text; sie sind klein und gehören nicht zu dieser Änderung.
- Maßgeblich sind die Pfade in der JSON. Die Namen im ZIP sind für Menschen gedacht: Ordner stammen aus `folders[]`
  (Name, `parentId`), Belege liegen unter „Buchhaltungsbelege & Finanzen / Belege <Jahr der Buchung>“, Dokumente ohne Ordner unter
  „(ohne Ordner)“. Verbotene Zeichen (`/ \ : * ? " < > |`, Steuerzeichen) werden zu „-“, Namen auf 100 Zeichen gekürzt, gleiche Namen
  im selben Ordner erhalten „ (2)“, „ (3)“ (Groß-/Kleinschreibung zählt nicht).
- Beim Lesen werden nur Einträge beachtet, die die JSON nennt. Pfade aus dem ZIP werden nie als Dateipfade im System verwendet.
- Fehlt eine genannte Datei im ZIP, wird der Verweis weggelassen und gemeldet; der Eintrag selbst bleibt.

### Einspielen

1. `sicherung.json` lesen (muss der erste Eintrag sein; größer als 64 MB gilt als unplausibel).
2. Jede genannte Datei einlesen und ablegen. Bei einem Fehler (falsches Passwort, beschädigter Eintrag, abgeschnittene Datei)
   wird nichts eingespielt und bereits abgelegte Dateien werden wieder entfernt.
3. Einträge nach Abschnitt 4 einspielen (Ersetzen oder Zusammenführen).
4. Dateien, auf die kein Eintrag mehr verweist, entfernen.

**Interne Darstellung auf Android** (nicht Teil des Austauschformats): Der Eintrag trägt `fileId` (bei Fotos `avatarFileId`,
`photoFileId`) und verweist auf eine Datei im lokalen Dateispeicher. Beim Lesen einer alten JSON-Sicherung (1.2.3) werden
die Data-URLs in den Dateispeicher ausgelagert; gleiche Inhalte (SHA-256) werden nur einmal abgelegt.

### Belege (so schreibt sie Android)

Ein Beleg steht wie am Desktop doppelt im Bestand: als `transactions[].receipt` und als Dokument mit der Kennung
`doc-receipt-<Buchungs-Id>` (`category: "belege"`, `isReceipt: true`, `transactionId`, `transactionDocNumber`). Beide zeigen auf
dieselbe Datei; im Paket steht sie deshalb nur einmal. Das Dokument liegt im Ordner „Belege <Jahr>“ (Jahr der Buchung) unter
„Buchhaltungsbelege & Finanzen“; fehlen die Ordner, legt Android sie an (Kennungen `folder-belege` und `folder-belege-<Jahr>`,
falls frei). Der Dateiname lautet `<Datum> <Zahlungspartner> <Belegnummer>.<Endung>`. Fotos werden auf Android vor dem Ablegen
zu einer PDF (längere Seite höchstens 1600 Pixel, JPEG-Qualität 75, eine Seite je Foto); Dateien über 8 MB werden abgelehnt.

### Offene Punkte für den Desktop

- Lesen von AES-ZIP: erledigt (eigener Code, keine Bibliothek). Schreiben: erledigt (P30 Teil 2), am Handy eingespielt mit und ohne Passwort (21.11.2026).
- Umstellung von `Transaction.receipt` / `ClubDocument.dataUrl` auf Dateiverweise und Migration beim ersten Start.
- Gemeinsame Gegenprobe: erledigt. Android → Desktop am 16.11.2026, Desktop → Android am 21.11.2026, jeweils mit und ohne Passwort.

## 9. Jahresarchiv (Format 1.0.0) – Stand 22.11.2026

**Status:** An beiden Fassungen umgesetzt: Desktop `src/services/jahresarchiv.ts` (R4a, Bedienung R4b), Android
`android/core/.../backup/Jahresarchiv.kt` (R4c). Beide wählen dieselben Dateien aus, vergeben dieselben Pfade und lesen die
Archive der anderen (Prüfdateien des Desktops in `android/core/src/test/resources/jahresarchiv/`, `JahresarchivTest.kt`).

**Android, Speicherform:** Am Handy liegen die Dateien meist im Dateispeicher (`fileId`, `photoFileId`), am Handy
aufgenommene Inventarfotos als Data-URL in `photoUrl`; beides wird archiviert. Nach dem Auslagern steht am Handy dieselbe
Form wie am Desktop (`dataUrl: ""` und `archiv`, bzw. `photoArchiv` ohne Foto-Feld); `fileId`/`photoFileId` entfallen.
Beim Zurückholen kommen die Dateien wieder in den Dateispeicher, auch Inventarfotos (`photoFileId`).

**Wozu:** Belege, Rechnungs- und Spenden-PDFs sowie Fotos ausgemusterter Gegenstände eines abgeschlossenen Jahres
wandern aus dem Bestand in eine eigene Datei. Die Einträge selbst (Buchung, Rechnung, Spende, Gegenstand) bleiben
vollständig im Bestand und auswertbar; an ihnen steht nur ein **Vermerk**, wo die Datei liegt. Die Sicherung wird dadurch
dauerhaft kleiner.

### Was ins Archiv eines Jahres gehört

| Art (`art`) | Stelle im Bestand | Jahr nach |
| --- | --- | --- |
| `beleg` | `transactions[].receipt` und das Dokument `doc-receipt-<Buchung>`; sonstige Dokumente mit `isReceipt: true` oder `category: "belege"` | Buchungsdatum; ohne Buchung Dokumentdatum `date` |
| `rechnung` | Dokument einer Rechnung (`invoices[].documentId` bzw. `doc-inv-<Rechnung>`) | Rechnungsdatum |
| `spende` | Dokument einer Zuwendungsbestätigung (`donations[].documentId` bzw. `doc-don-<Spende>`) | Tag der Zuwendung (`date`) |
| `inventarfoto` | `inventory[].photoUrl` eines Gegenstands mit `condition: "discarded"` | `retiredAt`, sonst Datum von `updatedAt` |

Nicht ins Archiv: andere Dokumente (Satzung, Verträge, Protokolle), Mitgliederfotos, Unterschriften, Logo, Briefpapier.
Archiviert werden darf frühestens das **Vorvorjahr** (Entscheidung 22.11.2026); das Vorjahr wird mit Begründung abgelehnt.

### Neues Feld „Ausgemustert am“

`inventory[].retiredAt` (JJJJ-MM-TT, freiwillig). Gesetzt nur bei `condition: "discarded"`: beim Ausmustern das eingegebene
Datum, sonst heute; ein schon vorhandenes Datum bleibt beim erneuten Speichern. Wechselt der Zustand weg von „discarded“,
wird das Feld entfernt. Gleiche Regel an beiden Fassungen (Desktop `ausmusterungsDatum`, Android `Inventar.ausgemustertAm`),
auch in der Sammelbearbeitung.

### Aufbau der Archivdatei

Eine ZIP-Datei wie das Sicherungspaket (Abschnitt 8: UTF-8-Namen, Deflate, Größen im lokalen Kopf, auf Wunsch AES-256
nach WinZip AE-2; Dateinamen sind auch dann nicht verschlüsselt). Name vorgeschlagen `VereinsManager_Archiv_<Verein>_<Jahr>.zip`.

```
archiv.json                         (erster Eintrag)
Inhaltsverzeichnis.csv              (für Menschen: Excel, Kassenprüfer, Finanzamt)
dokumente/Buchhaltungsbelege & Finanzen/Belege 2024/<Datei>
dokumente/Buchhaltungsbelege & Finanzen/Belege 2024/Ausgangsrechnungen/<Datei>
inventar-fotos/<Gegenstand>.png
```

Pfade und Dateinamen entstehen nach denselben Regeln wie im Sicherungspaket (Ordnerpfade aus `folders[]`, Belegnamen, gleiche
Inhalte nur einmal). Ein Beleg, der an der Buchung und als Dokument hängt, steht deshalb einmal im Archiv.

**`archiv.json`:**

| Feld | Inhalt |
| --- | --- |
| `format` | immer `"VereinsManager-Jahresarchiv"` |
| `version` | `"1.0.0"`; Leser akzeptieren `1.x` |
| `kennung` | eindeutige Kennung dieses Archivs (zufällig beim Erstellen) |
| `verein`, `jahr`, `erstelltAm` | Vereinsname, Jahr, Zeitpunkt (ISO) |
| `aufbewahrung[]` | je enthaltener Art: `art`, `bezeichnung`, `jahre` (null = keine Pflicht), `bis` (JJJJ-MM-TT oder null), `grundlage` |
| `dateien[]` | `pfad`, `sha256` (hexadezimal, klein), `groesse` (Bytes), `typ` (MIME) |
| `eintraege[]` | `art`, `bereich` (`transactions`/`documents`/`inventory`), `id`, `pfad`, `datum`, freiwillig `belegnummer`, `betrag`, dazu `bezeichnung` |

**Fristen** (Anzeige, keine Rechtsberatung): Buchungsbelege und ausgestellte Rechnungen 8 Jahre (§ 147 Abs. 3 AO bzw.
§ 14b UStG in der Fassung ab 2025), Doppel der Zuwendungsbestätigungen vorsichtshalber 10 Jahre (§ 50 Abs. 7 EStDV nennt
keine eigene Frist), Inventarfotos keine Pflicht. Die Frist beginnt mit dem Ende des Kalenderjahres: Belege 2024 bis
31.12.2032.

**`Inhaltsverzeichnis.csv`:** UTF-8 mit BOM, Trennzeichen `;`, Zeilenende CRLF. Spalten: Art, Datum (TT.MM.JJJJ),
Belegnummer, Betrag (EUR, Komma), Bezeichnung, Datei im Archiv, SHA-256. Ein Beleg an Buchung und Dokument steht einmal.

### Vermerk im Bestand

Nach dem Auslagern trägt der Eintrag statt der Datei einen Vermerk:

| Stelle | Datei vorher | danach |
| --- | --- | --- |
| `documents[]` | `dataUrl` | `dataUrl: ""` und `archiv: {…}` |
| `transactions[].receipt` | `receipt.dataUrl` | `receipt.dataUrl: ""` und `receipt.archiv: {…}` |
| `inventory[]` | `photoUrl` | `photoUrl` entfällt, `photoArchiv: {…}` |

Vermerk: `{ jahr, kennung, datei, pfad, sha256, groesse, typ, archiviertAm }` – `kennung` und `pfad` finden die Datei im
Archiv, `sha256` prüft sie, `datei` ist der vorgeschlagene Name (nur zur Anzeige; der Anwender darf die Datei umbenennen).

**In der Sicherung** reist der Vermerk unverändert mit (JSON 1.2.3 wie oben; im Paket 1.3.0 steht für solche Einträge
kein `file`, der Vermerk bleibt). Damit zeigen beide Fassungen nach dem Einspielen „im Jahresarchiv 2024“. Ältere
Programmstände, die den Vermerk nicht kennen, sehen nur einen Eintrag ohne Datei. Android behält die Felder `archiv` und
`photoArchiv` beim Einspielen, Bearbeiten und Sichern unverändert (R4c, geprüft in `JahresarchivTest`).

### Regeln beim Auslagern und Zurückholen

1. Erst das Archiv schreiben, dann die **gespeicherte** Datei erneut einlesen und jede Datei gegen `sha256` und `groesse`
   prüfen. Erst danach wird im Bestand etwas entfernt.
2. Entfernt wird eine Datei nur, wenn sie im Bestand noch genau die im Archiv ist (gleiche Prüfsumme). Wurde sie
   inzwischen ersetzt, bleibt sie und wird gemeldet.
3. Anzeigen einer einzelnen Datei und Zurückholen eines Jahres prüfen `kennung` und `sha256`; ein anderes Archiv oder eine
   veränderte Datei wird abgelehnt.
4. Die App löscht nie Textdaten und nie eine Archivdatei. Vernichten darf der Verein das Archiv nach Ablauf der Fristen
   selbst.
5. Bekommt ein archivierter Eintrag wieder eine Datei (neuer Beleg, neues Foto, neu erzeugtes Rechnungs- oder Spenden-PDF),
   entfällt der Vermerk; maßgeblich ist dann die Datei im Bestand. Beide Fassungen machen das beim Speichern.

## 10. Unterlagen am Mitglied und Führungszeugnis-Vermerk – Stand 23.11.2026 (ohne neue Formatversion)

Alle Felder sind freiwillig. Ältere Programmstände übergehen sie; beide Fassungen behalten sie beim Einspielen,
Bearbeiten und Sichern.

**Unterlage = Dokument** in `documents[]` mit `memberId` (gab es schon) und drei neuen Feldern:

| Feld | Inhalt |
| --- | --- |
| `memberDocType` | `trainerlizenz`, `erste_hilfe`, `schiedsrichter`, `aufnahmeantrag`, `einverstaendnis` oder `sonstiges` |
| `issuedAt` | ausgestellt am, `JJJJ-MM-TT` |
| `validUntil` | gültig bis, `JJJJ-MM-TT` |

Ordner: `folder-mitgliederunterlagen` („Mitgliederunterlagen“, Kategorie `mitglieder`), bei Bedarf angelegt, unter
`folder-mitglieder`, falls es den gibt. Ein Dokument mit `memberId`, aber ohne `memberDocType` gilt als
`aufnahmeantrag`, wenn seine Kennung mit `doc-antrag-` beginnt oder es das Schlagwort „Aufnahmeantrag“ trägt, sonst als
`sonstiges`. Unterlagen gehören nicht ins Jahresarchiv (Abschnitt 9).

**Führungszeugnis-Vermerk** `members[].policeCertificate`:

```json
{ "inspectedAt": "2024-05-06", "certificateDate": "2024-05-02", "relevantConviction": false }
```

Kein Dokument, keine Kopie (§ 72a Abs. 5 SGB VIII). Die nächste Vorlage (`certificateDate` + 5 Jahre; aus dem 29.02.
wird der 28.02.) wird berechnet und nicht gespeichert.

**Startseite:** neue Kachel `member_documents_expiry` in `dashboardConfig`. Fehlt sie in einer gespeicherten Anordnung,
hängen beide Fassungen sie beim Lesen hinten an, sichtbar.


## 11. Mitgliedsarten – Stand 25.11.2026 (ohne neue Formatversion)

Die Mitgliedsarten sind in den Einstellungen bearbeitbar. Gespeichert in `settings` unter `membershipTypes`, in der
Reihenfolge der Anzeige; die erste nicht gelöschte Art ist die Vorgabe für neue Mitglieder:

```json
"membershipTypes": [
  { "id": "full", "name": "Vollmitglied", "imAntrag": true },
  { "id": "youth", "name": "Jugend / Kinder", "unter18": true, "imAntrag": true },
  { "id": "honorary", "name": "Ehrenmitglied", "beitragsfrei": true },
  { "id": "art-mj3k9x2a", "name": "Senioren", "imAntrag": true },
  { "id": "family", "name": "Familie", "geloescht": true }
]
```

| Feld | Inhalt |
| --- | --- |
| `id` | Kennung; steht am Mitglied in `members[].membershipType`. Die bisherigen Arten behalten `full`, `reduced`, `youth`, `family`, `supporting`, `honorary`; neue heißen `art-…`. |
| `name` | Anzeigename, höchstens 60 Zeichen, unter den nicht gelöschten Arten eindeutig (ohne Groß-/Kleinschreibung). |
| `beitragsfrei` | Wahl der Art setzt Beitrag 0, Zahlweise `none`, Zahlart `exempt`. |
| `unter18` | Wird für unter 18-Jährige vorgeschlagen (Aufnahmeantrag, Import). Höchstens eine Art. |
| `imAntrag` | Im Aufnahmeantrag wählbar. |
| `geloescht` | Gelöscht; bleibt in der Liste, damit Mitglieder dieser Art ihren Namen behalten („Familie (gelöscht)“). |

Nur gesetzte Schalter werden geschrieben (`true`). Fehlt `membershipTypes` oder enthält es keine nicht gelöschte Art,
gelten die sechs bisherigen Arten (wie in der ersten Zeile der Tabelle). `ausgetreten` und `terminated` sind keine Arten,
sondern Austrittsvermerke, und stehen nie in der Liste. Eine Kennung am Mitglied, die es in der Liste nicht gibt (etwa aus
der Sicherung eines anderen Geräts), wird mit der Kennung angezeigt; nichts geht verloren.

`membershipFeeDefaults` (Beitragsvorgaben) ist wie bisher nach Kennung geordnet und gilt jetzt für jede nicht gelöschte,
nicht beitragsfreie Art; eine Art ohne Eintrag beginnt mit 0 € monatlich.

**„Ehrenmitglied“ ist kein Status mehr.** `members[].status` kennt nur noch `active`, `passive`, `suspended`,
`terminated`. Ein Mitglied mit `status: "honorary"` (ältere Bestände und Sicherungen) stellen beide Fassungen beim Start
und nach dem Einspielen um: `status: "active"`, `membershipType: "honorary"` (außer bei einem Austrittsvermerk); der
Beitrag bleibt unverändert.
