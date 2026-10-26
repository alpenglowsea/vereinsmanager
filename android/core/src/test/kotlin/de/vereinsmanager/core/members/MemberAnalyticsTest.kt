package de.vereinsmanager.core.members

import de.vereinsmanager.core.members.MemberAnalytics.Art
import de.vereinsmanager.core.members.MemberAnalytics.GeschlechtFilter
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.math.BigDecimal
import java.time.LocalDate
import java.time.ZoneId

class MemberAnalyticsTest {
    private val zone = ZoneId.of("Europe/Berlin")
    private val heute = LocalDate.of(2026, 10, 26)

    private fun m(
        id: String, status: String = "active", type: String = "full", dept: String = "Fußball", gender: String = "m", birth: String = "",
        entry: String = "2020-01-01", exit: String = "", fee: Int = 10, period: String = "monthly", pay: String = "sepa", updated: String = "2020-01-01T10:00:00.000Z",
    ) = Member.from(
        Json.parseToJsonElement(
            """{"id":"$id","memberNumber":"N-$id","firstName":"V$id","lastName":"N$id","status":"$status","membershipType":"$type","department":"$dept","gender":"$gender",
            "birthDate":"$birth","entryDate":"$entry","exitDate":"$exit","feeAmount":$fee,"feePeriod":"$period","paymentMethod":"$pay","updatedAt":"$updated","createdAt":"$updated"}""",
        ).jsonObject,
    )

    @Test fun kennzahlen() {
        val l = listOf(
            m("1", fee = 10, period = "monthly"), // 120
            m("2", status = "passive", fee = 60, period = "quarterly", pay = "transfer", dept = "Tennis"), // 240
            m("3", status = "terminated", fee = 100, period = "yearly"), // zählt nicht
            m("4", type = "ausgetreten", status = "passive", fee = 5, period = "yearly", pay = "cash"), // 5 Soll, aber nicht aktuell
        )
        val k = MemberAnalytics.kennzahlen(l)
        assertEquals(2, k.gesamt)
        assertEquals(1, k.aktiv)
        assertEquals(2, k.passiv) // zählt alle Passiven wie am Desktop
        assertEquals(0, BigDecimal("365").compareTo(k.jahresSoll))
        assertEquals(1, k.sepa)
        assertEquals(50, k.sepaProzent)
        assertEquals(2, k.sparten)
        assertEquals("Fußball", k.groessteSparte)
    }

    @Test fun leerer_bestand() {
        val k = MemberAnalytics.kennzahlen(emptyList())
        assertEquals(0, k.gesamt); assertEquals(0, k.sepaProzent); assertNull(k.groessteSparte)
    }

    @Test fun spartenSortiertUndNurAktuelle() {
        val l = listOf(m("1", dept = "A"), m("2", dept = "B"), m("3", dept = "B"), m("4", dept = "C", status = "terminated"))
        val s = MemberAnalytics.sparten(l)
        assertEquals(listOf("B", "A"), s.map { it.name })
        assertEquals(listOf(67, 33), s.map { it.prozent })
        assertEquals(0, BigDecimal("240").compareTo(s[0].jahresSoll))
    }

    @Test fun typenUndZahlwege() {
        val l = listOf(m("1"), m("2", type = "youth", pay = "cash"), m("3", type = "ausgetreten", status = "passive", pay = "transfer"))
        val t = MemberAnalytics.typen(l)
        assertEquals(7, t.size)
        assertEquals(1, t.first { it.schluessel == "ausgetreten" }.anzahl)
        assertEquals(33, t.first { it.schluessel == "full" }.prozent)
        val z = MemberAnalytics.zahlwege(l)
        assertEquals(listOf(1, 0, 0, 1), z.map { it.anzahl })
        assertEquals(50, z[0].prozent)
    }

    @Test fun altersgruppen() {
        val l = listOf(
            m("1", birth = "2013-10-27"), // 12
            m("2", birth = "2013-10-26"), // 13
            m("3", birth = "2012-10-26"), // 14 (Geburtstag heute)
            m("4", birth = "2008-10-27"), // 17
            m("5", birth = "1990-01-01"), // 36
            m("6", birth = "1966-10-26"), // 60
            m("7", birth = ""), m("8", birth = "kaputt"),
        )
        val g = MemberAnalytics.altersgruppen(l, GeschlechtFilter.ALLE, heute).associate { it.schluessel to it.anzahl }
        assertEquals(mapOf("kids" to 2, "teens" to 2, "adults" to 1, "seniors" to 1, "unknown" to 2), g)
    }

    @Test fun altersgruppenNachGeschlecht() {
        val l = listOf(m("1", gender = "w", birth = "1990-01-01"), m("2", gender = "m", birth = "1990-01-01"), m("3", gender = "", birth = "1990-01-01"), m("4", gender = "none"))
        assertEquals(1, MemberAnalytics.altersgruppen(l, GeschlechtFilter.W, heute).first { it.schluessel == "adults" }.anzahl)
        assertEquals(2, MemberAnalytics.altersgruppen(l, GeschlechtFilter.KEIN, heute).sumOf { it.anzahl })
        assertEquals(listOf(1, 1, 0, 2), MemberAnalytics.geschlechter(l).map { it.second })
    }

    @Test fun datumsErkennung() {
        assertEquals(2026 to 4, MemberAnalytics.jahrMonat("2026-05-03", zone))
        assertEquals(2026 to 4, MemberAnalytics.jahrMonat("3.5.2026", zone))
        assertEquals(2027 to 0, MemberAnalytics.jahrMonat("2026-12-31T23:30:00.000Z", zone))
        assertNull(MemberAnalytics.jahrMonat("", zone))
        assertNull(MemberAnalytics.jahrMonat("irgendwann", zone))
    }

    private val bestand = listOf(
        m("1", entry = "2025-03-10"),
        m("2", entry = "2026-01-15"),
        m("3", entry = "2026-03-02", dept = "Tennis"),
        m("4", entry = "2020-05-05", exit = "2026-03-31", status = "terminated"),
        m("5", entry = "2019-01-01", status = "terminated", updated = "2026-06-10T10:00:00.000Z"), // ohne Austrittsdatum
        m("6", entry = "2018-01-01", exit = "2025-12-31", dept = "Tennis"),
    )

    @Test fun zugaengeAbgaengeJeJahr() {
        assertEquals(2, MemberAnalytics.eintritte(bestand, 2026, null, zone).size)
        assertEquals(2, MemberAnalytics.austritte(bestand, 2026, null, zone).size)
        assertEquals(1, MemberAnalytics.austritte(bestand, 2025, null, zone).size)
        assertEquals(1, MemberAnalytics.eintritte(bestand, 2026, "Tennis", zone).size)
        assertEquals(6, MemberAnalytics.eintritte(bestand, null, null, zone).size)
        assertEquals(3, MemberAnalytics.austritte(bestand, null, null, zone).size)
    }

    @Test fun monatsverlauf() {
        val mo = MemberAnalytics.monate(bestand, 2026, null, zone)
        assertEquals(12, mo.size)
        assertEquals(1, mo[0].zugaenge) // Januar
        assertEquals(1, mo[2].zugaenge) // März
        assertEquals(1, mo[2].abgaenge) // 31.03.
        assertEquals(1, mo[5].abgaenge) // Juni (Änderungsdatum)
    }

    @Test fun jahreUndVorgabe() {
        val j = MemberAnalytics.verfuegbareJahre(bestand, 2026, zone)
        assertEquals(listOf(2026, 2025, 2020, 2019, 2018), j)
        assertEquals(2026, MemberAnalytics.vorgabeJahr(j, 2026))
        assertEquals(2025, MemberAnalytics.vorgabeJahr(listOf(2025, 2020), 2026))
        assertEquals(2026, MemberAnalytics.vorgabeJahr(emptyList(), 2026))
        val v = MemberAnalytics.mehrjahr(bestand, j, null, zone)
        assertEquals(listOf(2018, 2019, 2020, 2025, 2026), v.map { it.jahr })
        assertEquals(0, v.last().saldo)
    }

    @Test fun jahreVor1951UndZuweitInZukunftWerdenIgnoriert() {
        val l = listOf(m("1", entry = "1940-01-01"), m("2", entry = "2040-01-01"), m("3", entry = "2027-02-02"))
        assertEquals(listOf(2027), MemberAnalytics.verfuegbareJahre(l, 2026, zone))
    }

    @Test fun ereignisseNeuesteZuerstUndSuche() {
        val e = MemberAnalytics.ereignisse(bestand, 2026, null, zone)
        assertEquals(4, e.size)
        assertEquals(Art.AUSTRITT, e[0].art) // Juni vor März
        assertEquals(2, MemberAnalytics.suchen(e, "", Art.EINTRITT).size)
        assertEquals(1, MemberAnalytics.suchen(e, "n-3", null).size)
        assertEquals(1, MemberAnalytics.suchen(e, "TENNIS", null).size)
        assertTrue(MemberAnalytics.suchen(e, "gibtsnicht", null).isEmpty())
    }
}
