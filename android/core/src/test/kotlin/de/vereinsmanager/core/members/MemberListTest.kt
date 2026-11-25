package de.vereinsmanager.core.members

import de.vereinsmanager.core.backup.BackupFile
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.LocalDate

class MemberListTest {
    private val demoFile by lazy {
        BackupFile.parse(javaClass.getResourceAsStream("/demo/demo_klartext.json")!!.readBytes().toString(Charsets.UTF_8))
    }
    private val members by lazy { demoFile.list("members")!!.map { Member.from(it) } }
    private val departments by lazy {
        (demoFile.single("settings")!!["departments"] as JsonArray).map { (it as JsonPrimitive).content }
    }

    private fun numbers(l: List<Member>) = l.map { it.number }

    @Test fun demoMitgliederWerdenGelesen() {
        assertEquals(9, members.size)
        val m = members.first { it.number == "MG-001" }
        assertEquals("Müller, Maximilian", m.displayName)
        assertEquals("Fußball", m.department)
        assertEquals("Musterstadt", m.city)
        assertEquals(0, m.fee.compareTo(java.math.BigDecimal("15")))
        assertEquals("MM", m.initials)
    }

    @Test fun kacheln() {
        val s = MemberList.stats(members, departments)
        assertEquals(9, s.total)
        assertEquals(7, s.active)
        assertEquals(1, s.passive)
        assertEquals(78, s.activePercent) // 7 von 9
        assertEquals(11, s.passivePercent)
        assertEquals(11, s.departments.size) // zehn Sparten und "Ohne Sparte"
        assertEquals(listOf("Fußball", "Turnen & Gymnastik"), s.departments.take(2).map { it.name })
        assertEquals(2, s.departments[0].count)
        assertEquals(0, s.departments.first { it.name == MemberList.NO_DEPARTMENT }.count)
    }

    @Test fun gekuendigteZaehlenNichtMit() {
        val gekuendigt = Member.from(demoFile.list("members")!![0].let {
            kotlinx.serialization.json.JsonObject(it + ("status" to JsonPrimitive("terminated")))
        })
        val ausgetreten = Member.from(demoFile.list("members")!![1].let {
            kotlinx.serialization.json.JsonObject(it + ("membershipType" to JsonPrimitive("ausgetreten")))
        })
        val s = MemberList.stats(listOf(gekuendigt, ausgetreten) + members.drop(2), departments)
        assertEquals(7, s.total)
    }

    @Test fun suche() {
        assertEquals(listOf("MG-001"), numbers(MemberList.filter(members, MemberFilter(search = "müller"))))
        assertEquals(listOf("MG-001", "MG-008"), numbers(MemberList.filter(members, MemberFilter(search = "FUßBALL"))))
        assertEquals(listOf("MG-001"), numbers(MemberList.filter(members, MemberFilter(search = "0171"))))
        assertEquals(9, MemberList.filter(members, MemberFilter(search = "musterstadt")).size)
        assertEquals(9, MemberList.filter(members, MemberFilter(search = "  ")).size)
    }

    @Test fun filterKombinierbar() {
        assertEquals(listOf("MG-005"), numbers(MemberList.filter(members, MemberFilter(status = "passive"))))
        assertEquals(listOf("MG-004"), numbers(MemberList.filter(members, MemberFilter(type = "honorary"))))
        assertEquals(listOf("MG-004"), numbers(MemberList.filter(members, MemberFilter(payment = "cash"))))
        assertEquals(
            listOf("MG-001", "MG-008"),
            numbers(MemberList.filter(members, MemberFilter(status = "active", department = "Fußball", payment = "sepa"))),
        )
        assertEquals(0, MemberList.filter(members, MemberFilter(status = "terminated")).size)
    }

    @Test fun sortierung() {
        assertEquals(
            (1..9).map { "MG-00$it" },
            numbers(MemberList.sort(members.reversed(), SortKey.NUMBER)),
        )
        assertEquals(
            listOf("Bauer", "Becker", "Hoffmann", "Koch", "Müller", "Richter", "Schmidt", "Schneider", "Wagner"),
            MemberList.sort(members, SortKey.NAME).map { it.lastName },
        )
        assertEquals("MG-009", MemberList.sort(members, SortKey.FEE, ascending = false).first().number)
    }

    @Test fun naturlicheReihenfolge() {
        val sortiert = listOf("M-10", "M-2", "M-1", "M-0100").sortedWith { a, b -> MemberList.naturalCompare(a, b) }
        assertEquals(listOf("M-1", "M-2", "M-10", "M-0100"), sortiert)
    }

    @Test fun umlauteSortierenDeutsch() {
        assertTrue(MemberList.compareText("Müller", "Mutz") < 0) // ü gilt wie u
        assertTrue(MemberList.compareText("Ärzte", "Zeppelin") < 0)
    }

    @Test fun alterUndMitgliedsdauer() {
        val heute = LocalDate.of(2026, 10, 26)
        assertEquals(42, MemberList.age("1984-05-14", heute))
        assertEquals(41, MemberList.age("1984-12-01", heute))
        assertNull(MemberList.age("", heute))
        assertEquals("3 Jahre im Verein", MemberList.membershipDuration("2023-01-10", heute))
        assertEquals("Neu im Verein (< 1 Jahr)", MemberList.membershipDuration("2026-03-01", heute))
        assertEquals("1 Jahr im Verein", MemberList.membershipDuration("2025-10-26", heute))
    }

    @Test fun beschriftungen() {
        assertEquals("Ehrenmitglied", Mitgliedsarten.name(Mitgliedsarten.STANDARD, "honorary"))
        assertEquals("Beitragsfrei", MemberLabels.PAYMENT["exempt"])
        assertEquals("viertelj.", MemberLabels.FEE_PERIOD_SHORT["quarterly"])
        // Ehrenmitglied ist seit 25.11.2026 kein Status mehr
        assertEquals(4, MemberLabels.STATUS.size)
    }
}
