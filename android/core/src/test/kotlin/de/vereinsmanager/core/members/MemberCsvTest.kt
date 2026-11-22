package de.vereinsmanager.core.members

import de.vereinsmanager.core.backup.BackupFile
import de.vereinsmanager.core.backup.BackupImporter
import de.vereinsmanager.core.backup.ImportMode
import de.vereinsmanager.core.store.InMemoryDocumentStore
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.math.BigDecimal
import java.time.LocalDate
import java.time.ZoneOffset
import java.time.ZonedDateTime

/**
 * Die Umwandlung wird gegen die echte Desktop-Fassung geprüft: `golden_desktop.json` enthält Eingaben und die Ausgaben,
 * die memberImportService.ts dazu geliefert hat (erzeugt mit Node am 26.10.2026).
 */
class MemberCsvTest {
    private val heute = LocalDate.of(2026, 10, 26)
    private val jetzt = ZonedDateTime.of(2026, 10, 26, 8, 30, 0, 0, ZoneOffset.UTC)
    private val abteilungen = listOf("Fußball", "Tennis")

    private val golden: JsonObject by lazy {
        Json.parseToJsonElement(javaClass.getResourceAsStream("/import/golden_desktop.json")!!.readBytes().toString(Charsets.UTF_8)).jsonObject
    }
    private val inputs by lazy { golden["inputs"]!!.jsonArray.map { it.jsonObject } }
    private fun input(name: String) = inputs.first { str(it, "name") == name }

    private fun str(o: JsonObject, k: String): String = (o[k] as? JsonPrimitive)?.takeIf { it !is JsonNull }?.content ?: ""
    private fun s(o: JsonObject, k: String) = (o[k] as JsonPrimitive).content

    private val keyToField = mapOf(
        "memberNumber" to ImportField.NUMMER, "firstName" to ImportField.VORNAME, "lastName" to ImportField.NACHNAME,
        "fullName" to ImportField.VOLLNAME, "gender" to ImportField.GESCHLECHT, "birthDate" to ImportField.GEBURTSDATUM,
        "street" to ImportField.STRASSE, "houseNumber" to ImportField.HAUSNUMMER, "fullAddress" to ImportField.KOMPLETTADRESSE,
        "zip" to ImportField.PLZ, "city" to ImportField.ORT, "country" to ImportField.LAND, "phone" to ImportField.TELEFON,
        "email" to ImportField.EMAIL, "department" to ImportField.SPARTE, "status" to ImportField.STATUS,
        "membershipType" to ImportField.TYP, "feeAmount" to ImportField.BEITRAG, "feePeriod" to ImportField.ZAHLWEISE,
        "paymentMethod" to ImportField.ZAHLART, "iban" to ImportField.IBAN, "bic" to ImportField.BIC,
        "bankName" to ImportField.BANK, "accountHolder" to ImportField.KONTOINHABER, "mandateDate" to ImportField.MANDATSDATUM,
        "mandateReference" to ImportField.MANDATSREFERENZ, "entryDate" to ImportField.EINTRITT,
        "exitDate" to ImportField.AUSTRITT, "notes" to ImportField.NOTIZEN,
    )

    private fun desktopMapping(i: JsonObject): ColumnMapping =
        (i["mapping"] as JsonObject).entries.associate { (k, v) -> keyToField.getValue(k) to (v as JsonPrimitive).content }

    private fun existing(i: JsonObject): List<Member> = (i["existing"] as JsonArray).map { e ->
        val o = e.jsonObject
        Member.from(JsonObject(mapOf("id" to o["id"]!!, "memberNumber" to o["memberNumber"]!!, "firstName" to o["firstName"]!!, "lastName" to o["lastName"]!!)))
    }

    // ---- Alle Felder kommen aus den Feldern der Datei ----

    @Test fun neunundzwanzigFelder() {
        assertEquals(29, ImportField.values().size)
        assertEquals(29, keyToField.size)
    }

    // ---- Einlesen gegen den Desktop ----

    @Test fun einlesenStimmtMitDemDesktopUeberein() {
        for (i in inputs) {
            val t = MemberCsv.parse(str(i, "csv"))
            assertEquals("Überschriften ${str(i, "name")}", (i["headers"] as JsonArray).map { (it as JsonPrimitive).content }, t.headers)
            val soll = (i["parsedRows"] as JsonArray).map { r -> r.jsonObject.entries.associate { it.key to (it.value as JsonPrimitive).content } }
            assertEquals("Zeilen ${str(i, "name")}", soll, t.rows)
        }
    }

    @Test fun leereOderLeerzeichenDatei() {
        assertEquals(CsvTable(emptyList(), emptyList()), MemberCsv.parse(""))
        assertEquals(CsvTable(emptyList(), emptyList()), MemberCsv.parse("  \n \n"))
        assertEquals(CsvTable(emptyList(), emptyList()), MemberCsv.parse("﻿"))
    }

    @Test fun nurUeberschriftenGibtKeineZeilen() {
        val t = MemberCsv.parse("Vorname;Nachname")
        assertEquals(listOf("Vorname", "Nachname"), t.headers)
        assertTrue(t.rows.isEmpty())
    }

    @Test fun doppelteUeberschriftenWerdenNummeriert() {
        val t = MemberCsv.parse("A;A;;A\n1;2;3;4")
        assertEquals(listOf("A", "A_2", "Spalte", "A_3"), t.headers)
        assertEquals(mapOf("A" to "1", "A_2" to "2", "Spalte" to "3", "A_3" to "4"), t.rows[0])
    }

    @Test fun kuerzereZeilenWerdenAufgefuellt() {
        val t = MemberCsv.parse("A;B;C\n1;2")
        assertEquals("", t.rows[0]["C"])
    }

    @Test fun semikolonGewinntBeiGleichstand() {
        assertEquals(listOf("A", "B,C"), MemberCsv.parse("A;B,C\n1;2").headers)
    }

    @Test fun komplettesBeispielDerVorlage() {
        val t = MemberCsv.parse(MemberCsv.vorlage(abteilungen))
        assertEquals(23, t.headers.size)
        assertEquals(3, t.rows.size)
        assertEquals("Mannschaftsführer 1. Herren", t.rows[0]["Notizen"])
    }

    @Test fun vorlageIstBytegleichMitDerDesktopVorlage() {
        assertEquals(str(input("vorlage"), "csv"), MemberCsv.vorlage(abteilungen))
    }

    @Test fun vorlageNimmtDieErstenZweiSparten() {
        val t = MemberCsv.parse(MemberCsv.vorlage(listOf("Handball", "Judo", "Chor")))
        assertEquals("Handball", t.rows[0]["Sparte/Abteilung"])
        assertEquals("Judo", t.rows[1]["Sparte/Abteilung"])
        assertEquals("Handball", t.rows[2]["Sparte/Abteilung"])
    }

    // ---- Kodierung ----

    @Test fun utf8WirdErkannt() {
        val (text, fallback) = MemberCsv.decode("Müller;Ärger\n".toByteArray(Charsets.UTF_8))
        assertEquals("Müller;Ärger\n", text)
        assertFalse(fallback)
    }

    @Test fun windows1252WirdErkannt() {
        val bytes = "Müller;Größe;€".toByteArray(java.nio.charset.Charset.forName("windows-1252"))
        val (text, fallback) = MemberCsv.decode(bytes)
        assertEquals("Müller;Größe;€", text)
        assertTrue(fallback)
    }

    // ---- Spalten erkennen ----

    @Test fun spaltenErkennungWieDesktopAusserBeiStatusDerVorlage() {
        for (i in inputs) {
            val mine = MemberCsv.erkenneSpalten((i["headers"] as JsonArray).map { (it as JsonPrimitive).content })
            val soll = desktopMapping(i).toMutableMap()
            if (str(i, "name") == "vorlage") {
                // Verbesserung gegenüber dem Desktop: die Statusspalte der Vorlage wird erkannt.
                soll[ImportField.STATUS] = "Status (Aktiv/Passiv/Ehrenmitglied/Gekündigt)"
            }
            assertEquals(str(i, "name"), soll, mine)
        }
    }

    @Test fun statusMitWortMitgliedWirdNichtVomVollnamenGeschluckt() {
        val m = MemberCsv.erkenneSpalten(listOf("Name", "Mitglied seit", "Status (Ehrenmitglied?)"))
        assertEquals("Name", m[ImportField.VOLLNAME])
        assertEquals("Status (Ehrenmitglied?)", m[ImportField.STATUS])
    }

    @Test fun vollnameWirdBeiGetrenntenNamenVerworfen() {
        val m = MemberCsv.erkenneSpalten(listOf("Name", "Vorname", "Nachname"))
        assertNull(m[ImportField.VOLLNAME])
    }

    @Test fun komplettadresseWirdBeiStrasseUndHausnummerVerworfen() {
        val m = MemberCsv.erkenneSpalten(listOf("Adresse", "Straße", "Hausnummer"))
        assertNull(m[ImportField.KOMPLETTADRESSE])
    }

    // ---- Umwandeln gegen den Desktop ----

    private fun gleichWieDesktop(name: String) {
        val i = input(name)
        val table = MemberCsv.parse(str(i, "csv"))
        val mapping = desktopMapping(i)
        val ex = existing(i)
        val dept = str(i, "defaultDepartment").ifEmpty { null }
        val rows = MemberCsv.umwandeln(table.rows, mapping, ex, abteilungen, dept, heute)
        val soll = (i["rows"] as JsonArray).map { it.jsonObject }
        assertEquals(soll.size, rows.size)
        val numCol = mapping[ImportField.NUMMER]
        for ((idx, e) in soll.withIndex()) {
            val r = rows[idx]
            val f = r.form
            val tag = "$name Zeile ${idx + 1}"
            val explicitNumber = numCol != null && table.rows[idx][numCol].orEmpty().isNotEmpty()
            if (explicitNumber) assertEquals("$tag Nummer", s(e, "memberNumber"), f.number)
            fun d(x: String) = if (x == "TODAY") heute.toString() else x
            assertEquals("$tag Vorname", str(e, "firstName"), f.firstName)
            assertEquals("$tag Nachname", str(e, "lastName"), f.lastName)
            assertEquals("$tag Geschlecht", str(e, "gender"), f.gender)
            assertEquals("$tag Geburt", str(e, "birthDate"), f.birthDate)
            assertEquals("$tag Straße", str(e, "street"), f.street)
            assertEquals("$tag Hausnr", str(e, "houseNumber"), f.houseNumber)
            assertEquals("$tag PLZ", str(e, "zip"), f.zip)
            assertEquals("$tag Ort", str(e, "city"), f.city)
            assertEquals("$tag Land", str(e, "country"), f.country)
            assertEquals("$tag Telefon", str(e, "phone"), f.phone)
            assertEquals("$tag Mail", str(e, "email"), f.email)
            assertEquals("$tag Eintritt", d(str(e, "entryDate")), f.entryDate)
            assertEquals("$tag Austritt", str(e, "exitDate"), f.exitDate)
            assertEquals("$tag Sparte", str(e, "department"), f.department)
            assertEquals("$tag Typ", str(e, "membershipType"), f.type)
            // Bewusste Abweichung: "Ausgetreten" wird hier Gekündigt (Desktop: aktiv, mit Standardbeitrag).
            val statusUeberschrieben = f.status == "terminated" && str(e, "status") != "terminated"
            // Bewusste Abweichung (20.11.2026, wie die Buchungsimporte): "1.000" ist 1000 € mit Hinweis, nicht 1 €.
            val rohBeitrag = mapping[ImportField.BEITRAG]?.let { table.rows[idx][it] }
            val mehrdeutig = MemberCsv.betragMehrdeutig(rohBeitrag)
            if (mehrdeutig) assertEquals("$tag Beitrag (Tausender)", 0, MemberCsv.betrag(rohBeitrag).compareTo(f.feeValue))
            else if (!statusUeberschrieben) assertEquals("$tag Beitrag", 0, BigDecimal(s(e, "feeAmount")).compareTo(f.feeValue))
            assertEquals("$tag Zahlweise", str(e, "feePeriod"), f.feePeriod)
            assertEquals("$tag Zahlart", str(e, "paymentMethod"), f.paymentMethod)
            assertEquals("$tag IBAN", str(e, "iban"), f.iban)
            assertEquals("$tag BIC", str(e, "bic"), f.bic)
            assertEquals("$tag Bank", str(e, "bankName"), f.bankName)
            assertEquals("$tag Kontoinhaber", str(e, "accountHolder"), f.accountHolder)
            assertEquals("$tag Mandatsdatum", d(str(e, "mandateDate")), f.mandateDate)
            if (!explicitNumber && str(e, "mandateReference").startsWith("MANDAT-")) {
                // Die Nummer wird hier anders fortgezählt als am Desktop; die Referenz folgt der Nummer.
                assertEquals("$tag Mandatsreferenz", "MANDAT-${f.number}", f.mandateReference)
            } else {
                assertEquals("$tag Mandatsreferenz", str(e, "mandateReference"), f.mandateReference)
            }
            assertEquals("$tag Notizen", str(e, "notes"), f.notes)
            assertEquals("$tag Warnungen", (e["warnings"] as JsonArray).map { (it as JsonPrimitive).content }, r.warnings.filterNot { mehrdeutig && it.contains("Tausenderpunkt") })
            if (mehrdeutig) assertTrue("$tag Hinweis Tausender", r.warnings.any { it.contains("Tausenderpunkt") })
            if (explicitNumber) {
                assertEquals("$tag Dublette", e["existingMemberId"]?.takeIf { it !is JsonNull }?.let { (it as JsonPrimitive).content }, r.duplicateOf)
            }
        }
    }

    @Test fun vorlageWieDesktop() = gleichWieDesktop("vorlage")
    @Test fun kommaDateiWieDesktop() = gleichWieDesktop("komma")
    @Test fun tabDateiWieDesktop() = gleichWieDesktop("tab")
    @Test fun anfuehrungsDateiWieDesktop() = gleichWieDesktop("semikolon-anfuehrung")

    // ---- Einzelregeln ----

    @Test fun datumsformate() {
        assertEquals("2021-06-05", MemberCsv.datum(" 5.6.2021 "))
        assertEquals("2020-02-01", MemberCsv.datum("01/02/2020"))
        assertEquals("1999-01-01", MemberCsv.datum("1999"))
        assertEquals("1980-07-03", MemberCsv.datum("1980-07-03T10:00:00"))
        assertEquals("2020-01-05", MemberCsv.datum("2020-1-5"))
        assertNull(MemberCsv.datum("31.02.2020"))
        assertNull(MemberCsv.datum("2020-13-01"))
        assertNull(MemberCsv.datum("gestern"))
        assertNull(MemberCsv.datum(""))
        assertNull(MemberCsv.datum(null))
    }

    @Test fun betraege() {
        assertEquals(0, BigDecimal("1250.50").compareTo(MemberCsv.betrag("1.250,50")))
        assertEquals(0, BigDecimal("1250.50").compareTo(MemberCsv.betrag("1,250.50")))
        assertEquals(0, BigDecimal("15").compareTo(MemberCsv.betrag("€ 15,00")))
        assertEquals(0, BigDecimal("12.5").compareTo(MemberCsv.betrag("12,5")))
        assertEquals(0, MemberCsv.betrag("-5").signum())
        assertEquals(0, MemberCsv.betrag("abc").signum())
        assertEquals(0, MemberCsv.betrag("").signum())
        assertEquals(0, MemberCsv.betrag(null).signum())
        // "1.250" ist 1250 € wie in den Buchungsimporten (vorher 1,25 €) und wird als mehrdeutig gemeldet
        assertEquals(0, BigDecimal("1250").compareTo(MemberCsv.betrag("1.250")))
        assertTrue(MemberCsv.betragMehrdeutig("1.250"))
        assertFalse(MemberCsv.betragMehrdeutig("1.250,00"))
    }

    @Test fun namenTeilen() {
        assertEquals("Max" to "Mustermann", MemberCsv.namenTeilen("Mustermann, Max"))
        assertEquals("Dr. Max" to "Mustermann", MemberCsv.namenTeilen("Dr. Max Mustermann"))
        assertEquals("Max" to "", MemberCsv.namenTeilen("Max"))
        assertEquals("" to "", MemberCsv.namenTeilen("  "))
    }

    @Test fun adresseTeilen() {
        assertEquals("Musterstraße" to "12a", MemberCsv.adresseTeilen("Musterstraße 12a"))
        assertEquals("Hauptstr." to "5", MemberCsv.adresseTeilen("Hauptstr. 5"))
        assertEquals("Weg" to "7 b", MemberCsv.adresseTeilen("Weg 7 b"))
        assertEquals("Gasse" to "", MemberCsv.adresseTeilen("Gasse"))
    }

    @Test fun statusUndTypErkennung() {
        assertEquals("terminated", MemberCsv.status("Ausgetreten"))
        assertEquals("terminated", MemberCsv.status("gekündigt"))
        assertEquals("passive", MemberCsv.status("PASSIV"))
        assertEquals("active", MemberCsv.status(""))
        assertEquals("youth", MemberCsv.mitgliedstyp("", 12))
        assertEquals("full", MemberCsv.mitgliedstyp("", 40))
        assertEquals("full", MemberCsv.mitgliedstyp("", null))
        assertEquals("supporting", MemberCsv.mitgliedstyp("Fördermitglied", 70))
    }

    @Test fun unleserlichesDatumGibtWarnungStattFalschemDatum() {
        val rows = MemberCsv.umwandeln(
            listOf(mapOf("Vorname" to "A", "Nachname" to "B", "Geburtstag" to "31.02.2000", "Eintritt" to "irgendwann")),
            mapOf(ImportField.VORNAME to "Vorname", ImportField.NACHNAME to "Nachname", ImportField.GEBURTSDATUM to "Geburtstag", ImportField.EINTRITT to "Eintritt"),
            emptyList(), abteilungen, null, heute,
        )
        assertEquals("", rows[0].form.birthDate)
        assertEquals("2026-10-26", rows[0].form.entryDate)
        assertEquals(2, rows[0].warnings.size)
    }

    @Test fun fehlendeNummernWerdenFortgezaehlt() {
        val ex = listOf(Member.from(doc("""{"id":"x","memberNumber":"MG-009","firstName":"A","lastName":"B"}""")))
        val rows = MemberCsv.umwandeln(
            listOf(mapOf("V" to "Eins", "N" to "N1", "Nr" to ""), mapOf("V" to "Zwei", "N" to "N2", "Nr" to "MG-011"), mapOf("V" to "Drei", "N" to "N3", "Nr" to "")),
            mapOf(ImportField.VORNAME to "V", ImportField.NACHNAME to "N", ImportField.NUMMER to "Nr"),
            ex, abteilungen, null, heute,
        )
        // Es wird nach der höchsten vergebenen Nummer weitergezählt, auch der ausdrücklich genannten (MG-011).
        assertEquals(listOf("MG-012", "MG-011", "MG-013"), rows.map { it.form.number })
    }

    @Test fun standardSparteUndErsteSparte() {
        val m = mapOf(ImportField.VORNAME to "V", ImportField.NACHNAME to "N")
        val r = listOf(mapOf("V" to "A", "N" to "B"))
        assertEquals("Judo", MemberCsv.umwandeln(r, m, emptyList(), abteilungen, "Judo", heute)[0].form.department)
        assertEquals("Fußball", MemberCsv.umwandeln(r, m, emptyList(), abteilungen, null, heute)[0].form.department)
        assertEquals("Hauptverein", MemberCsv.umwandeln(r, m, emptyList(), emptyList(), null, heute)[0].form.department)
    }

    @Test fun beitragsVorgabenNachTyp() {
        val m = mapOf(ImportField.VORNAME to "V", ImportField.NACHNAME to "N", ImportField.TYP to "T", ImportField.STATUS to "S")
        fun fee(typ: String, st: String) = MemberCsv.umwandeln(listOf(mapOf("V" to "A", "N" to "B", "T" to typ, "S" to st)), m, emptyList(), abteilungen, null, heute)[0].form.fee
        assertEquals("60", fee("Jugend", "aktiv"))
        assertEquals("80", fee("Student", "aktiv"))
        assertEquals("120", fee("Voll", "aktiv"))
        assertEquals("0", fee("Ehren", "aktiv"))
    }

    // ---- Schreiben in den Speicher ----

    private fun doc(json: String) = Json.parseToJsonElement(json).jsonObject

    private fun demoStore(): InMemoryDocumentStore {
        val text = javaClass.getResourceAsStream("/demo/demo_klartext.json")!!.readBytes().toString(Charsets.UTF_8)
        return InMemoryDocumentStore().also { BackupImporter.import(BackupFile.parse(text), it, ImportMode.REPLACE) }
    }

    private fun zeilen(store: InMemoryDocumentStore, csv: String): List<ImportRow> {
        val t = MemberCsv.parse(csv)
        val existing = store.all("members").map { Member.from(it) }
        return MemberCsv.umwandeln(t.rows, MemberCsv.erkenneSpalten(t.headers), existing, abteilungen, null, heute)
    }

    @Test fun aktualisierenUeberschreibtNurMitgelieferteFelder() {
        val store = demoStore()
        val vorher = store.get("members", "mem-1")!!
        val logs = store.count("auditLogs")
        val rows = zeilen(store, "Mitgliedsnummer;Telefon;E-Mail;Notizen\nMG-001;0170 555;;\n")
        assertTrue(rows[0].isDuplicate)
        val r = MemberCsv.importieren(store, rows, DuplicateStrategy.UPDATE, jetzt)
        assertEquals(CsvImportReport(0, 1, 0), r)
        val nachher = store.get("members", "mem-1")!!
        assertEquals("0170 555", s(nachher, "phone"))
        // Leere Zellen ändern nichts; alles andere bleibt, auch Bankdaten, Beitrag und Notizen.
        assertEquals(s(vorher, "email"), s(nachher, "email"))
        assertEquals(s(vorher, "notes"), s(nachher, "notes"))
        assertEquals(s(vorher, "firstName"), s(nachher, "firstName"))
        val bv = vorher["bankDetails"] as? JsonObject
        val bn = nachher["bankDetails"] as? JsonObject
        for (k in listOf("iban", "bic", "bankName", "accountHolder", "mandateReference", "mandateDate")) {
            assertEquals(k, bv?.get(k)?.toString(), bn?.get(k)?.toString())
        }
        assertEquals(vorher["feeAmount"].toString(), nachher["feeAmount"].toString())
        assertEquals(s(vorher, "createdAt"), s(nachher, "createdAt"))
        assertEquals("2026-10-26T08:30:00.000Z", s(nachher, "updatedAt"))
        assertEquals(logs + 1, store.count("auditLogs"))
        val log = store.all("auditLogs").last()
        assertEquals("Batch-CSV-Import: 0 Mitglied(er) neu hinzugefügt, 1 aktualisiert.", s(log, "summary"))
        assertEquals("batch-import", s(log, "memberId"))
        assertEquals("1 Mitglieder", s(log, "memberName"))
        assertEquals("Admin", s(log, "author"))
    }

    @Test fun beitragNullInDerDateiUeberschreibtNichts() {
        val store = demoStore()
        val rows = zeilen(store, "Mitgliedsnummer;Beitrag\nMG-001;0\n")
        MemberCsv.importieren(store, rows, DuplicateStrategy.UPDATE, jetzt)
        assertEquals("15", store.get("members", "mem-1")!!["feeAmount"].toString())
    }

    @Test fun ueberspringenAendertNichts() {
        val store = demoStore()
        val logs = store.count("auditLogs")
        val r = MemberCsv.importieren(store, zeilen(store, "Mitgliedsnummer;Telefon\nMG-001;1\n"), DuplicateStrategy.SKIP, jetzt)
        assertEquals(CsvImportReport(0, 0, 1), r)
        assertEquals("0171 1234567", s(store.get("members", "mem-1")!!, "phone"))
        assertEquals(logs, store.count("auditLogs"))
    }

    @Test fun immerNeuAnlegenVergibtNeueNummerUndKennung() {
        val store = demoStore()
        val r = MemberCsv.importieren(
            store, zeilen(store, "Mitgliedsnummer;Vorname;Nachname\nMG-001;Maximilian;Müller\n"), DuplicateStrategy.CREATE_ALWAYS, jetzt,
        )
        assertEquals(CsvImportReport(1, 0, 0), r)
        assertEquals(10, store.count("members"))
        val neu = store.all("members").last()
        assertEquals("MG-010", s(neu, "memberNumber"))
        assertFalse(s(neu, "id") == "mem-1")
        assertEquals("Maximilian", s(neu, "firstName"))
    }

    @Test fun neueMitgliederBekommenFortlaufendeNummernUndEinProtokoll() {
        val store = demoStore()
        val logs = store.count("auditLogs")
        val r = MemberCsv.importieren(store, zeilen(store, "Vorname;Nachname\nEva;Neu\nTim;Neuer\n"), DuplicateStrategy.UPDATE, jetzt)
        assertEquals(CsvImportReport(2, 0, 0), r)
        assertEquals(listOf("MG-010", "MG-011"), store.all("members").takeLast(2).map { s(it, "memberNumber") })
        assertEquals(logs + 1, store.count("auditLogs"))
        assertEquals("Batch-CSV-Import: 2 Mitglied(er) neu hinzugefügt, 0 aktualisiert.", s(store.all("auditLogs").last(), "summary"))
        val m = store.all("members").last()
        assertEquals("2026-10-26", s(m, "entryDate"))
        assertEquals("true", m["dataPrivacyConsent"].toString())
        assertEquals("2026-10-26T08:30:00.000Z", s(m, "createdAt"))
    }

    @Test fun zweimalDieselbeNummerInDerDateiWirdEntschaerft() {
        val store = demoStore()
        MemberCsv.importieren(store, zeilen(store, "Mitgliedsnummer;Vorname;Nachname\nX-1;A;A\nX-1;B;B\n"), DuplicateStrategy.UPDATE, jetzt)
        val nums = store.all("members").map { s(it, "memberNumber") }
        assertEquals(11, nums.size)
        assertEquals(nums.size, nums.toSet().size)
        assertTrue("X-1" in nums)
    }

    @Test fun nachNamenWirdAuchOhneNummerAlsDubletteErkannt() {
        val store = demoStore()
        val rows = zeilen(store, "Vorname;Nachname;Telefon\nmaximilian;MÜLLER;999\n")
        assertEquals("mem-1", rows[0].duplicateOf)
        MemberCsv.importieren(store, rows, DuplicateStrategy.UPDATE, jetzt)
        assertEquals("999", s(store.get("members", "mem-1")!!, "phone"))
        assertEquals(9, store.count("members"))
    }

    @Test fun nichtsAusgewaehltSchreibtNichts() {
        val store = demoStore()
        val logs = store.count("auditLogs")
        val r = MemberCsv.importieren(store, emptyList(), DuplicateStrategy.UPDATE, jetzt)
        assertEquals(CsvImportReport(0, 0, 0), r)
        assertEquals(logs, store.count("auditLogs"))
    }

    @Test fun vorlageLaesstSichImportieren() {
        val store = InMemoryDocumentStore()
        val t = MemberCsv.parse(MemberCsv.vorlage(abteilungen))
        val rows = MemberCsv.umwandeln(t.rows, MemberCsv.erkenneSpalten(t.headers), emptyList(), abteilungen, null, heute)
        assertEquals(listOf("M-0101", "M-0102", "M-0103"), rows.map { it.form.number })
        assertEquals(listOf("active", "active", "passive"), rows.map { it.form.status })
        assertTrue(rows.all { it.warnings.isEmpty() })
        val r = MemberCsv.importieren(store, rows, DuplicateStrategy.UPDATE, jetzt)
        assertEquals(CsvImportReport(3, 0, 0), r)
        assertEquals("DE12500105170648489890", ((store.all("members")[0]["bankDetails"]) as JsonObject).let { s(it, "iban") })
        assertNotNull(store.get("auditLogs", store.ids("auditLogs").single()))
    }
}
