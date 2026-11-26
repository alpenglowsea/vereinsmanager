package de.vereinsmanager.core.skr42

import de.vereinsmanager.core.store.InMemoryDocumentStore
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Assert.assertFalse
import org.junit.Assert.fail
import org.junit.Test

/** Dieselben Fälle prüft `src/utils/kontenrahmen.test.ts` am Desktop; dazu die Wege über den Speicher. */
class KontenrahmenTest {
    private val standard = listOf(
        Skr42Main("HK-50000", "50000", "Personal", "expense", listOf(
            Skr42Sub("50100", "Übungsleiter (lang)", "50100 - Übungsleiter", 0),
            Skr42Sub("50010", "Löhne", "50010 - Löhne", 0),
        )),
        Skr42Main("HK-40000", "40000", "Mitgliedsbeiträge", "income", listOf(
            Skr42Sub("40000", "Beiträge (lang)", "40000 - Beiträge", 0),
        )),
    )
    private fun json(s: String) = Json.parseToJsonElement(s)
    private val eigene = Kontenrahmen.leseEigene(json("""{
        "customMainCategories":[{"id":"HK-9000-CUSTOM","code":"9000","name":"Eigenes","type":"expense","subCategories":[{"code":"9001","name":"Eins","label":"9001 - Eins","vatRateDefault":19}]}],
        "customSubCategories":[{"mainCatIdOrCode":"40000","subCategory":{"code":"40005","name":"Schnupper","label":"40005 - Schnupper","vatRateDefault":0}}]}"""))

    @Test
    fun setztZusammenUndSortiert() {
        val k = Kontenrahmen.wirksam(standard, eigene, Kontenrahmen.Anpassungen())
        assertEquals(listOf("9000", "40000", "50000"), k.map { it.code })
        assertEquals(listOf("40000", "40005"), k[1].subCategories.map { it.code })
        assertEquals(listOf("50010", "50100"), k[2].subCategories.map { it.code })
        assertTrue(k[1].subCategories[1].isCustom)
        assertEquals("50100", standard[0].subCategories[0].code)
    }

    @Test
    fun wendetAnpassungenAn() {
        val a = Kontenrahmen.leseAnpassungen(json("""{"nummernkreise":{"50000":{"name":"Personalkosten"}},
            "konten":{"50100":{"name":"Übungsleiterpauschale","vatRateDefault":7,"ausgeblendet":true},"40000":{"name":"  "}}}"""))
        assertNull(a.konten["40000"])
        val m = Kontenrahmen.wirksam(standard, Kontenrahmen.Eigene(), a).first { it.code == "50000" }
        assertEquals("Personalkosten", m.name)
        assertEquals("Personal", m.originalName)
        val s = m.subCategories.first { it.code == "50100" }
        assertEquals("50100 - Übungsleiterpauschale", s.label)
        assertEquals("Übungsleiterpauschale", s.name)
        assertEquals("Übungsleiter", s.originalName)
        assertEquals(7, s.vatRateDefault)
        assertEquals(0, s.originalVatRate)
        assertTrue(s.ausgeblendet)
        assertEquals("Übungsleiterpauschale", Kontenrahmen.kontoBezeichnung(s))
    }

    @Test
    fun blendetAusBehaeltAberVerwendetes() {
        val a = Kontenrahmen.leseAnpassungen(json("""{"nummernkreise":{"9000":{"ausgeblendet":true}},"konten":{"50100":{"ausgeblendet":true}}}"""))
        val k = Kontenrahmen.wirksam(standard, eigene, a)
        assertEquals(listOf("40000", "50000"), Kontenrahmen.nurSichtbare(k).map { it.code })
        assertEquals(listOf("50010"), Kontenrahmen.nurSichtbare(k).first { it.code == "50000" }.subCategories.map { it.code })
        val mitAlt = Kontenrahmen.nurSichtbare(k, nummernkreis = "9000 - Eigenes", konto = "50100")
        assertEquals(listOf("9000", "40000", "50000"), mitAlt.map { it.code })
        assertEquals(listOf("50010", "50100"), mitAlt.first { it.code == "50000" }.subCategories.map { it.code })
    }

    @Test
    fun anpassungenEintragenUndZuruecknehmen() {
        var a = Kontenrahmen.mitKontoAnpassung(Kontenrahmen.Anpassungen(), "50100", name = " Pauschale ", ust = 7, originalName = "Übungsleiter", originalUst = 0)
        assertEquals(Kontenrahmen.KontoAnpassung("Pauschale", 7), a.konten["50100"])
        a = Kontenrahmen.mitKontoAnpassung(a, "50100", name = "Übungsleiter", ust = 0, originalName = "Übungsleiter", originalUst = 0)
        assertNull(a.konten["50100"])
        a = Kontenrahmen.mitNummernkreisAnpassung(a, "50000", ausgeblendet = true, originalName = "Personal")
        assertEquals(Kontenrahmen.NummernkreisAnpassung(ausgeblendet = true), a.nummernkreise["50000"])
        a = Kontenrahmen.mitNummernkreisAnpassung(a, "50000", ausgeblendet = false, originalName = "Personal")
        assertNull(a.nummernkreise["50000"])
    }

    @Test
    fun prueftNummernUndBezeichnungen() {
        val k = Kontenrahmen.wirksam(standard, eigene, Kontenrahmen.Anpassungen())
        assertEquals("Bitte eine Nummer eingeben.", Kontenrahmen.pruefeNeueNummer("", false, k))
        assertEquals("Die Nummer besteht aus 4 bis 6 Ziffern.", Kontenrahmen.pruefeNeueNummer("12a45", false, k))
        assertEquals("Das Konto 50100 gibt es schon (Übungsleiter).", Kontenrahmen.pruefeNeueNummer("50100", false, k))
        assertEquals("Den Nummernkreis 50000 gibt es schon (Personal).", Kontenrahmen.pruefeNeueNummer("50000", true, k))
        assertNull(Kontenrahmen.pruefeNeueNummer("50200", false, k))
        assertEquals("50101", Kontenrahmen.vorschlagNummer(k, "expense", "50000"))
        assertEquals("40006", Kontenrahmen.vorschlagNummer(k, "income", "40000"))
        assertEquals("51000", Kontenrahmen.vorschlagNummer(k, "expense"))
        assertEquals("Bitte eine Bezeichnung eingeben.", Kontenrahmen.pruefeBezeichnung("  "))
        assertNull(Kontenrahmen.pruefeBezeichnung("Neu"))
    }

    @Test
    fun bezeichnungInBuchungen() {
        val tx = json("""[
          {"id":"a","skrAccount":"50100","subCategory":"50100 - Übungsleiter","category":"50100 - Übungsleiter","mainCategory":"50000 - Personal"},
          {"id":"b","skrAccount":"50010","subCategory":"50010 - Löhne","category":"50010 - Löhne","mainCategory":"50000 - Personal"},
          {"id":"c","subCategory":"50100 - Übungsleiter","category":"50100 - Übungsleiter","mainCategory":"50000 - Personal"},
          {"id":"d","skrAccount":"40000","category":"x","mainCategory":"40000 - Mitgliedsbeiträge","isSplit":true,"splits":[
            {"id":"d1","skrAccount":"40000","subCategory":"40000 - Beiträge","category":"40000 - Beiträge","mainCategory":"40000 - Mitgliedsbeiträge"},
            {"id":"d2","skrAccount":"50100","subCategory":"50100 - Übungsleiter","category":"50100 - Übungsleiter","mainCategory":"50000 - Personal"}]}
        ]""").jsonArray.map { it.jsonObject }
        fun id(o: JsonObject) = o["id"]!!.jsonPrimitive.content
        fun f(o: JsonObject, k: String) = o[k]!!.jsonPrimitive.content
        val vorher = Kontenrahmen.wirksam(standard, Kontenrahmen.Eigene(), Kontenrahmen.Anpassungen())
        fun umbenannt(roh: String) = Kontenrahmen.wirksam(standard, Kontenrahmen.Eigene(), Kontenrahmen.leseAnpassungen(json(roh)))
        val k = Kontenrahmen.buchungenAngleichen(tx, vorher, umbenannt("""{"konten":{"50100":{"name":"Pauschale"}}}"""))
        assertEquals(listOf("a", "c", "d"), k.map(::id))
        assertEquals("50100 - Pauschale", f(k[0], "subCategory"))
        assertEquals("50100 - Pauschale", f(k[0], "category"))
        assertEquals("50100 - Pauschale", f(k[2]["splits"]!!.jsonArray[1].jsonObject, "subCategory"))
        assertSame(tx[3]["splits"]!!.jsonArray[0], k[2]["splits"]!!.jsonArray[0])
        assertEquals("50100 - Übungsleiter", f(tx[0], "subCategory"))
        val nachher = umbenannt("""{"nummernkreise":{"50000":{"name":"Personalkosten"}}}""")
        val n = Kontenrahmen.buchungenAngleichen(tx, vorher, nachher)
        assertEquals(listOf("a", "b", "c", "d"), n.map(::id))
        assertEquals("40000 - Mitgliedsbeiträge", f(n[3], "mainCategory"))
        assertEquals("50000 - Personalkosten", f(n[3]["splits"]!!.jsonArray[1].jsonObject, "mainCategory"))
        assertEquals(emptyList<JsonObject>(), Kontenrahmen.buchungenAngleichen(n, nachher, nachher))
        assertEquals(3, Kontenrahmen.kontoVerwendungen(tx, "50100"))
        assertEquals(0, Kontenrahmen.kontoVerwendungen(tx, "9001"))
        assertEquals(4, Kontenrahmen.nummernkreisVerwendungen(tx, "50000"))
        assertEquals(1, Kontenrahmen.nummernkreisVerwendungen(tx, "40000"))
    }

    @Test
    fun nummeriertUmAuchMitgelieferte() {
        val a = Kontenrahmen.leseAnpassungen(json("""{"konten":{"50100":{"nummer":"50150","name":"Pauschale"},"50010":{"nummer":"50010"},"40000":{"nummer":"12a"}}}"""))
        assertEquals(mapOf("50100" to Kontenrahmen.KontoAnpassung(name = "Pauschale", nummer = "50150")), a.konten)
        val k = Kontenrahmen.wirksam(standard, Kontenrahmen.Eigene(), a)
        val m = k.first { it.code == "50000" }
        assertEquals(listOf("50010", "50150"), m.subCategories.map { it.code })
        val s = m.subCategories[1]
        assertEquals("50150 - Pauschale", s.label)
        assertEquals("50100", s.originalCode)
        assertEquals("50150", Kontenrahmen.standardKonto("50100", k)!!.second.code)
        assertNull(Kontenrahmen.standardKonto("50150", k))
        assertEquals(
            "Die Nummer 50100 gehört ursprünglich zum Konto „Pauschale“ (heute 50150) und bleibt dafür frei. Bitte eine andere wählen.",
            Kontenrahmen.pruefeNeueNummer("50100", false, k),
        )
        assertNull(Kontenrahmen.pruefeNeueNummer("50100", false, k, anlegen = false))
        assertNull(Kontenrahmen.pruefeNeueNummer("50150", false, k, setOf("50100"), anlegen = false))
        // in der Sicherung als "nummer"
        assertEquals("50150", Kontenrahmen.anpassungenAlsJson(a)["konten"]!!.jsonObject["50100"]!!.jsonObject["nummer"]!!.jsonPrimitive.content)
    }

    @Test
    fun plantNeueKontonummer() {
        val vorher = Kontenrahmen.wirksam(standard, eigene, Kontenrahmen.Anpassungen())
        val leer = Kontenrahmen.Anpassungen()
        assertEquals("Das Konto 50010 gibt es schon (Löhne).", Kontenrahmen.planeAenderung(vorher, leer, true, "50100", nummer = "50010").fehler)
        assertEquals("Die Nummer besteht aus 4 bis 6 Ziffern.", Kontenrahmen.planeAenderung(vorher, leer, true, "50100", nummer = "501").fehler)
        val p = Kontenrahmen.planeAenderung(vorher, leer, true, "50100", nummer = "50110").anpassungen!!
        assertEquals(mapOf("50100" to Kontenrahmen.KontoAnpassung(nummer = "50110")), p.konten)
        val nachher = Kontenrahmen.wirksam(standard, eigene, p)
        val tx = json("""[
          {"id":"a","skrAccount":"50100","subCategory":"50100 - Übungsleiter","category":"50100 - Übungsleiter","mainCategory":"50000 - Personal"},
          {"id":"b","subCategory":"50100 - Übungsleiter","category":"50100 - Übungsleiter","mainCategory":"50000 - Personal"},
          {"id":"c","skrAccount":"50010","subCategory":"50010 - Löhne","category":"50010 - Löhne","mainCategory":"50000 - Personal"}
        ]""").jsonArray.map { it.jsonObject }
        val g = Kontenrahmen.buchungenAngleichen(tx, vorher, nachher)
        assertEquals(
            listOf(listOf("a", "50110", "50110 - Übungsleiter", "50110 - Übungsleiter"), listOf("b", null, "50110 - Übungsleiter", "50110 - Übungsleiter")),
            g.map { o -> listOf("id", "skrAccount", "subCategory", "category").map { o[it]?.jsonPrimitive?.content } },
        )
        // zurück auf die ursprüngliche Nummer: die Anpassung verschwindet
        assertTrue(Kontenrahmen.planeAenderung(nachher, p, true, "50110", nummer = "50100").anpassungen!!.konten.isEmpty())
    }

    @Test
    fun verschiebtNummernkreisSamtKonten() {
        val vorher = Kontenrahmen.wirksam(standard, eigene, Kontenrahmen.Anpassungen())
        val leer = Kontenrahmen.Anpassungen()
        val p = Kontenrahmen.planeAenderung(vorher, leer, false, "40000", nummer = "41000").anpassungen!!
        assertEquals(mapOf("40000" to Kontenrahmen.NummernkreisAnpassung(nummer = "41000")), p.nummernkreise)
        assertEquals(mapOf("40000" to Kontenrahmen.KontoAnpassung(nummer = "41000"), "40005" to Kontenrahmen.KontoAnpassung(nummer = "41005")), p.konten)
        val nachher = Kontenrahmen.wirksam(standard, eigene, p)
        assertEquals(listOf("9000", "41000", "50000"), nachher.map { it.code })
        assertEquals(listOf("41000", "41005"), nachher[1].subCategories.map { it.code })
        assertEquals("41000", Kontenrahmen.standardNummernkreis("40000", nachher)!!.code)
        val tx = json("""[{"id":"a","skrAccount":"40005","subCategory":"40005 - Schnupper","category":"40005 - Schnupper","mainCategory":"40000 - Mitgliedsbeiträge"}]""")
            .jsonArray.map { it.jsonObject }
        val g = Kontenrahmen.buchungenAngleichen(tx, vorher, nachher)[0]
        assertEquals(listOf("41005", "41005 - Schnupper", "41000 - Mitgliedsbeiträge"), listOf("skrAccount", "subCategory", "mainCategory").map { g[it]!!.jsonPrimitive.content })
        assertEquals("Den Nummernkreis 50000 gibt es schon (Personal).", Kontenrahmen.planeAenderung(vorher, leer, false, "9000", nummer = "50000").fehler)
        assertEquals("Das Konto 9001 käme dabei auf 40000: Das Konto 40000 gibt es schon (Beiträge).",
            Kontenrahmen.planeAenderung(vorher, leer, false, "9000", nummer = "39999").fehler)
        assertEquals("Das Konto 9001 käme dabei auf 1000000; Kontonummern haben 4 bis 6 Ziffern. Bitte eine andere Nummer wählen.",
            Kontenrahmen.planeAenderung(vorher, leer, false, "9000", nummer = "999999").fehler)
    }

    @Test
    fun nummernUeberDenSpeicher() {
        val s = InMemoryDocumentStore()
        s.put("settings", "main", JsonObject(mapOf("id" to JsonPrimitive("main"))))
        s.put("transactions", "t1", JsonObject(mapOf("id" to JsonPrimitive("t1"), "skrAccount" to JsonPrimitive("40450"),
            "subCategory" to JsonPrimitive("40450 - x"), "category" to JsonPrimitive("40450 - x"), "mainCategory" to JsonPrimitive("40400 - x"))))
        val v = Kontenrahmen.vorschau(s, false, "40400", nummer = "49400")
        assertNull(v.fehler)
        assertEquals(1, v.buchungen)
        assertEquals(Skr42.standard.first { it.code == "40400" }.subCategories.size, v.konten)
        val r = Kontenrahmen.nummernkreisAendern(s, "40400", nummer = "49400")
        assertEquals(Kontenrahmen.Geaendert(1, "49400"), r)
        val b = s.get("transactions", "t1")!!
        assertEquals("49450", b["skrAccount"]!!.jsonPrimitive.content)
        assertTrue(b["mainCategory"]!!.jsonPrimitive.content.startsWith("49400 - "))
        assertEquals("49450", Kontenrahmen.standardKonto("40450", Kontenrahmen.wirksam(s))!!.second.code)
        // zurück: Nummernkreis auf das Original, die Konten ziehen wieder mit
        Kontenrahmen.nummernkreisAendern(s, "49400", nummer = "40400")
        assertTrue(Kontenrahmen.anpassungen(s).konten.isEmpty() && Kontenrahmen.anpassungen(s).nummernkreise.isEmpty())
        assertEquals("40450", s.get("transactions", "t1")!!["skrAccount"]!!.jsonPrimitive.content)
    }

    @Test
    fun ergaenztNurFehlendes() {
        val hier = Kontenrahmen.leseAnpassungen(json("""{"konten":{"50100":{"name":"Hier"}}}"""))
        val datei = Kontenrahmen.leseAnpassungen(json("""{"konten":{"50100":{"name":"Datei"},"50010":{"ausgeblendet":true}}}"""))
        assertEquals(mapOf("50100" to Kontenrahmen.KontoAnpassung("Hier"), "50010" to Kontenrahmen.KontoAnpassung(ausgeblendet = true)),
            Kontenrahmen.ergaenzeAnpassungen(hier, datei).konten)
        val zus = Kontenrahmen.ergaenzeEigene(eigene, Kontenrahmen.leseEigene(json("""{
            "customMainCategories":[{"code":"9000","name":"Anders","type":"expense","subCategories":[]},{"code":"9100","name":"Neu","type":"income","subCategories":[]}],
            "customSubCategories":[{"mainCatIdOrCode":"40000","subCategory":{"code":"40005","name":"Doppelt"}}]}""")))
        assertEquals(listOf("9000 Eigenes", "9100 Neu"), zus.nummernkreise.map { "${it.code} ${it.name}" })
        assertEquals(1, zus.konten.size)
    }

    // ---------------------------------------------------------------- über den Speicher (mit dem echten SKR 42)
    @Test
    fun ueberDenSpeicher() {
        val s = InMemoryDocumentStore()
        s.put("settings", "main", JsonObject(mapOf("id" to JsonPrimitive("main"), "clubName" to JsonPrimitive("TSV"))))
        val konto = Skr42.standard.first().subCategories.first()
        s.put("transactions", "t1", JsonObject(mapOf("id" to JsonPrimitive("t1"), "skrAccount" to JsonPrimitive(konto.code),
            "subCategory" to JsonPrimitive(konto.label), "category" to JsonPrimitive(konto.label))))
        // umbenennen: die Buchung zieht mit, andere Felder der Einstellungen bleiben
        assertEquals(1, Kontenrahmen.kontoAendern(s, konto.code, name = "Neuer Name").buchungen)
        assertEquals("${konto.code} - Neuer Name", s.get("transactions", "t1")!!["subCategory"]!!.jsonPrimitive.content)
        assertEquals("TSV", s.get("settings", "main")!!["clubName"]!!.jsonPrimitive.content)
        // nur Steuersatz: keine Buchung ändert sich
        assertEquals(0, Kontenrahmen.kontoAendern(s, konto.code, ust = 19).buchungen)
        assertEquals(19, Kontenrahmen.wirksam(s).flatMap { it.subCategories }.first { it.code == konto.code }.vatRateDefault)
        // zurück auf das Original: Anpassung fällt weg, Buchung trägt wieder den Originaltext
        Kontenrahmen.kontoAendern(s, konto.code, name = Kontenrahmen.kontoBezeichnung(konto), ust = konto.vatRateDefault)
        assertTrue(Kontenrahmen.anpassungen(s).konten.isEmpty())
        assertEquals(konto.label, s.get("transactions", "t1")!!["subCategory"]!!.jsonPrimitive.content)
        // neuer Nummernkreis und neues Konto; doppelte Nummer abgelehnt
        Kontenrahmen.neuerNummernkreis(s, "9000", "Eigenes", "expense")
        Kontenrahmen.neuesKonto(s, "9000", "9001", "Zweites", 7)
        Kontenrahmen.neuesKonto(s, Skr42.standard.first().code, "40099", "Unter Standard")
        val w = Kontenrahmen.wirksam(s)
        assertEquals(listOf("9000", "9001"), w.first { it.code == "9000" }.subCategories.map { it.code })
        assertTrue(w.first { it.code == Skr42.standard.first().code }.subCategories.any { it.code == "40099" && it.isCustom })
        assertEquals(w.map { it.code }, w.map { it.code }.sortedBy { it.toLong() })
        try { Kontenrahmen.neuesKonto(s, "9000", "9001", "Doppelt"); fail() } catch (e: IllegalArgumentException) {
            assertEquals("Das Konto 9001 gibt es schon (Zweites).", e.message)
        }
        // löschen: nicht, solange gebucht; sonst ja
        s.put("transactions", "t2", JsonObject(mapOf("id" to JsonPrimitive("t2"), "skrAccount" to JsonPrimitive("9001"))))
        try { Kontenrahmen.eigenesKontoLoeschen(s, "9001"); fail() } catch (e: IllegalArgumentException) {
            assertEquals("Das Konto 9001 wird in 1 Buchung verwendet. Blenden Sie es stattdessen aus.", e.message)
        }
        Kontenrahmen.eigenesKontoLoeschen(s, "40099")
        assertFalse(Kontenrahmen.wirksam(s).flatMap { it.subCategories }.any { it.code == "40099" })
        // Nummernkreis umbenennen
        Kontenrahmen.nummernkreisAendern(s, "9000", name = "Mein Kreis")
        assertEquals("Mein Kreis", Kontenrahmen.wirksam(s).first { it.code == "9000" }.name)
    }

    @Test
    fun sicherungErsetzenUndErgaenzen() {
        fun datei(name: String) = de.vereinsmanager.core.backup.BackupFile.parse("""{"app":"VereinsManager Lokal","version":"1.2.3","exportedAt":"2026-11-26T10:00:00.000Z","data":{
            "settings":{"clubName":"TSV","customSkr42Accounts":{"customMainCategories":[],"customSubCategories":[{"mainCatIdOrCode":"40000","subCategory":{"code":"40098","name":"$name","label":"40098 - $name","vatRateDefault":0}}]},
            "skr42Anpassungen":{"konten":{"40000":{"name":"$name"},"40001":{"ausgeblendet":true}}}}}}""")
        val s = InMemoryDocumentStore()
        de.vereinsmanager.core.backup.BackupImporter.import(datei("Aus Datei"), s, de.vereinsmanager.core.backup.ImportMode.REPLACE)
        assertEquals("40000 - Aus Datei", Kontenrahmen.wirksam(s).flatMap { it.subCategories }.first { it.code == "40000" }.label)
        assertTrue(Kontenrahmen.wirksam(s).flatMap { it.subCategories }.first { it.code == "40001" }.ausgeblendet)
        // hier ändern, dann eine andere Datei ergänzen: Vorhandenes bleibt, Fehlendes kommt dazu
        Kontenrahmen.kontoAendern(s, "40000", name = "Hier")
        Kontenrahmen.kontoAendern(s, "40001", ausgeblendet = false)
        de.vereinsmanager.core.backup.BackupImporter.import(datei("Zweite"), s, de.vereinsmanager.core.backup.ImportMode.MERGE)
        val a = Kontenrahmen.anpassungen(s)
        assertEquals("Hier", a.konten["40000"]?.name)
        assertEquals(true, a.konten["40001"]?.ausgeblendet)
        assertEquals(listOf("Aus Datei"), Kontenrahmen.eigene(s).konten.map { it.konto.name })
        // ältere Datei ohne Kontenrahmen ersetzt den Rest, der Kontenrahmen bleibt
        de.vereinsmanager.core.backup.BackupImporter.import(de.vereinsmanager.core.backup.BackupFile.parse(
            """{"app":"VereinsManager Lokal","version":"1.2.3","exportedAt":"2026-11-26T10:00:00.000Z","data":{"settings":{"clubName":"Alt"}}}"""), s, de.vereinsmanager.core.backup.ImportMode.REPLACE)
        assertEquals("Hier", Kontenrahmen.anpassungen(s).konten["40000"]?.name)
        assertEquals("Alt", (s.get("settings", "main")!!["clubName"] as JsonPrimitive).content)
    }
}
