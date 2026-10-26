package de.vereinsmanager.core.export

import de.vereinsmanager.core.backup.BackupFile
import de.vereinsmanager.core.backup.BackupImporter
import de.vereinsmanager.core.backup.ImportMode
import de.vereinsmanager.core.members.Ausgabe
import de.vereinsmanager.core.members.AusgabeForm
import de.vereinsmanager.core.members.Member
import de.vereinsmanager.core.members.MemberMaterial
import de.vereinsmanager.core.store.InMemoryDocumentStore
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.jsonObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.math.BigDecimal
import java.time.LocalDate

class ExportTest {
    private val heute = LocalDate.of(2026, 10, 26)

    private fun demo(): InMemoryDocumentStore {
        val text = javaClass.getResourceAsStream("/demo/demo_klartext.json")!!.readBytes().toString(Charsets.UTF_8)
        return InMemoryDocumentStore().also { BackupImporter.import(BackupFile.parse(text), it, ImportMode.REPLACE) }
    }

    private fun member(json: String) = Member.from(Json.parseToJsonElement(json).jsonObject)

    // ---- CSV-Grundlagen (PapaParse-Regeln) ----

    @Test fun anfuehrungszeichenNurWoNoetig() {
        val csv = Csv.schreiben(listOf("A", "B"), listOf(listOf("x", "a;b"), listOf(" y", "z\"q"), listOf("l1\nl2", "ok ")))
        assertEquals(Csv.BOM + "A;B\r\nx;\"a;b\"\r\n\" y\";\"z\"\"q\"\r\n\"l1\nl2\";\"ok \"", csv)
    }

    @Test fun kommaUndUmlauteBleibenUngequotet() {
        assertEquals(Csv.BOM + "A\r\nMüller, Max", Csv.schreiben(listOf("A"), listOf(listOf("Müller, Max"))))
    }

    @Test fun ohneZeilenNurBom() {
        assertEquals(Csv.BOM, Csv.schreiben(listOf("A"), emptyList()))
    }

    @Test fun zeilenumbruecheWerdenLeerzeichen() {
        assertEquals("a b c d", Csv.einzeilig("a\r\nb\nc\rd"))
    }

    @Test fun beitragMitZweiNachkommastellenUndPunkt() {
        assertEquals("15.00", Export.fixed2(BigDecimal("15")))
        assertEquals("12.50", Export.fixed2(BigDecimal("12.5")))
        assertEquals("1250.51", Export.fixed2(BigDecimal("1250.505")))
        assertEquals("0.00", Export.fixed2(BigDecimal.ZERO))
    }

    // ---- Mitglieder-CSV ----

    @Test fun achtundzwanzigSpalten() {
        assertEquals(28, Export.MITGLIEDER_KOPF.size)
        val m = demo().all("members").map { Member.from(it) }
        assertTrue(m.all { Export.mitgliederZeile(it).size == 28 })
    }

    @Test fun mitgliederZeileMitSonderfaellen() {
        val m = member(
            """{"id":"x","memberNumber":"X-1","firstName":"Eva","lastName":"Mü;ller","gender":"d","birthDate":"1990-01-02",
               "address":{"street":"A,B","houseNumber":"1","zip":"12345","city":"Ort","country":"Deutschland"},"phone":"1","email":"e@x.de",
               "entryDate":"2020-01-01","status":"on_hold","department":"Tennis","membershipType":"ausgetreten","feeAmount":12.5,
               "feePeriod":"half_yearly","paymentMethod":"cash","dataPrivacyConsent":false,"notes":"Z1\nZ2",
               "bankDetails":{"iban":"DE1","bic":"B","bankName":"Bank","accountHolder":"Eva","mandateDate":"2020-01-01","mandateReference":"M1"}}""",
        )
        val z = Export.mitgliederZeile(m)
        assertEquals(
            listOf(
                "X-1", "Mü;ller", "Eva", "Divers", "1990-01-02", "A,B", "1", "12345", "Ort", "Deutschland", "1", "e@x.de", "2020-01-01", "",
                "Ruhend", "Tennis", "Ausgetreten", "12.50", "Halbjährlich", "Bar", "DE1", "B", "Bank", "Eva", "2020-01-01", "M1", "Nein", "Z1 Z2",
            ),
            z,
        )
    }

    @Test fun mitgliederCsvKopfzeileUndZeilenzahl() {
        val m = demo().all("members").map { Member.from(it) }
        val csv = Export.mitgliederCsv(m)
        assertTrue(csv.startsWith(Csv.BOM + "Mitgliedsnummer;Nachname;Vorname;Geschlecht;"))
        assertTrue(csv.contains(";Mandatsreferenz;DSGVO-Einwilligung;Notizen\r\n"))
        assertEquals(10, csv.split("\r\n").size) // Kopf + 9 Mitglieder, solange keine Notiz einen Umbruch behält
    }

    @Test fun pdfListeZeilen() {
        val m = demo().all("members").map { Member.from(it) }.sortedBy { it.number }
        val t = Export.mitgliederPdf(m, "TSV Demo", heute)
        assertEquals(10, t.spalten.size)
        assertEquals(269, t.breiten.sum())
        assertEquals(m.size, t.zeilen.size)
        assertTrue(t.zeilen.all { it.size == 10 })
        assertEquals("Stand: 26.10.2026 | Gesamt: ${m.size} Mitglieder", t.kopfRechts)
        assertEquals("TSV Demo - Vertrauliche Mitgliederdaten gem. DSGVO", t.fusszeile)
        assertEquals("MG-001", t.zeilen[0][0])
        assertEquals("Müller, Maximilian", t.zeilen[0][1])
        assertTrue(t.zeilen[0][8].matches(Regex("""\d+,\d\d € / (M\.|Q\.|H\.|J\.|Frei)""")))
    }

    @Test fun dateinamen() {
        assertEquals("TSV_Musterstadt_1890_e_V", Export.dateiname("TSV Musterstadt 1890 e.V."))
        assertEquals("Verein", Export.dateiname("  "))
        assertEquals("Müller", Export.dateiname("Müller"))
    }

    // ---- Material ----

    private fun mitMaterial(): InMemoryDocumentStore {
        val st = demo()
        val z = java.time.ZonedDateTime.of(2026, 10, 26, 8, 0, 0, 0, java.time.ZoneOffset.UTC)
        MemberMaterial.speichern(st, "mem-1", AusgabeForm(itemId = "inv-7", issueDate = "2026-01-05", hasContribution = true, contribution = "12,5", notes = "a\nb"), heute, z)
        val b = MemberMaterial.speichern(st, "mem-1", AusgabeForm(itemId = "inv-8", quantity = "2", issueDate = "2026-02-01"), heute, z)
        MemberMaterial.umschalten(st, (b["id"] as JsonPrimitive).content, heute, z)
        return st
    }

    @Test fun materialCsv() {
        val st = mitMaterial()
        val members = st.all("members").map { Member.from(it) }
        val csv = Export.materialCsv(MemberMaterial.ausgaben(st, "mem-1"), members, MemberMaterial.gegenstaende(st))
        val z = csv.removePrefix(Csv.BOM).split("\r\n")
        assertEquals("Mitgliedsnummer;Mitglied Name;Abteilung;Inventarnummer;Gegenstand;Menge;Einheit;Ausgabedatum;Status;Rückgabedatum;Eigenanteil;Eigenanteil Betrag (EUR);Notizen", z[0])
        assertEquals(3, z.size)
        // neueste zuerst: erst die zurückgegebenen Leibchen vom 01.02., dann der Trikotsatz
        assertTrue(z[1].startsWith("MG-001;Müller, Maximilian;"))
        assertTrue(z[1].contains(";INV-BE-002;"))
        assertTrue(z[1].contains(";2;Stk.;2026-02-01;Zurückgegeben;2026-10-26;Nein;0.00;"))
        assertTrue(z[2].contains(";Ja;12.50;a b"))
    }

    @Test fun materialOhneBekanntesMitglied() {
        val a = Ausgabe.from(JsonObject(mapOf("id" to JsonPrimitive("a"), "memberId" to JsonPrimitive("weg"), "itemName" to JsonPrimitive("Ball"), "quantity" to JsonPrimitive(3), "status" to JsonPrimitive("issued"))))
        val z = Export.materialZeile(a, null, null)
        assertEquals(listOf("", "", "", "", "Ball", "3", "Stk.", "", "Ausgegeben", "", "Nein", "0.00", ""), z)
        val t = Export.materialPdf(listOf(a), emptyList(), emptyList(), "V", heute)
        assertEquals("Unbekannt", t.zeilen[0][0])
        assertEquals(269, t.breiten.sum())
        assertEquals("Stand: 26.10.2026 | Gesamt: 1 Zuweisungen (1 aktiv) | Eigenanteil gesamt: 0,00 €", t.kopfRechts)
    }

    @Test fun uebersichtKennzahlenFilterSuche() {
        val st = mitMaterial()
        val members = st.all("members").map { Member.from(it) }
        val alle = MemberMaterial.alle(st)
        val k = MaterialUebersicht.kennzahlen(alle)
        assertEquals(2, k.gesamt); assertEquals(1, k.ausgegeben); assertEquals(1, k.zurueck)
        assertEquals(0, BigDecimal("12.5").compareTo(k.eigenanteil))
        assertEquals(1, MaterialUebersicht.filtern(alle, members, "", MaterialUebersicht.Filter.AUSGEGEBEN).size)
        assertEquals(1, MaterialUebersicht.filtern(alle, members, "leibchen", MaterialUebersicht.Filter.ALLE).size)
        assertEquals(2, MaterialUebersicht.filtern(alle, members, "MÜLLER", MaterialUebersicht.Filter.ALLE).size)
        assertEquals(1, MaterialUebersicht.filtern(alle, members, "a", MaterialUebersicht.Filter.ZURUECK).filter { it.returned }.size)
        assertEquals(0, MaterialUebersicht.filtern(alle, members, "schmidt", MaterialUebersicht.Filter.ALLE).size)
    }
}
