package de.vereinsmanager.core.members

import org.junit.Assert.assertEquals
import org.junit.Test

class IbanTest {
    @Test fun gruppiert() {
        assertEquals("DE89 3704 0044 0532 0130 00", Iban.gruppiert("DE89370400440532013000"))
        assertEquals("DE89 3704 0044 0532 0130 00", Iban.gruppiert("de89 3704  0044 0532 0130 00"))
        assertEquals("DE12", Iban.gruppiert("DE12"))
        assertEquals("DE12 3", Iban.gruppiert("de123"))
        assertEquals("", Iban.gruppiert(""))
    }
}
