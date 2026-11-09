package de.vereinsmanager.core.members

import java.time.LocalDate
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class MandatsfolgeTest {
    @Test
    fun neuesMitgliedStartetMitErstlastschrift() {
        assertEquals("FRST", MemberRules.neu("100", listOf("Fußball"), LocalDate.of(2026, 11, 9)).mandateSequenceType)
    }

    @Test
    fun auswahlKenntBeideFolgen() {
        assertEquals(setOf("FRST", "RCUR"), MemberLabels.MANDATE_SEQUENCE.keys)
        assertTrue(MemberLabels.MANDATE_SEQUENCE.values.all { it.isNotBlank() })
    }
}
