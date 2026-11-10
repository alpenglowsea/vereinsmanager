package de.vereinsmanager.core.sepa

import org.junit.Assert.assertEquals
import org.junit.Test
import java.math.BigDecimal
import java.time.Clock
import java.time.Instant
import java.time.ZoneOffset

/** D-23: Wer vor dem Einzugstag ausgetreten oder erst danach eingetreten ist, wird nicht eingezogen. */
class EintrittAustrittTest {
    private val heute = Clock.fixed(Instant.parse("2026-06-15T10:00:00Z"), ZoneOffset.UTC)
    private val jaehrlich = SepaRunConfig(periodFilter = SepaPeriodFilter.YEARLY, targetYear = 2026)

    private fun mitglied(eintritt: String?, austritt: String?) = SepaMember(
        id = "m1", memberNumber = "M-0001", firstName = "Max", lastName = "Muster", status = "active",
        paymentMethod = "sepa", feeAmount = BigDecimal("120"), feePeriod = "yearly", entryDate = eintritt, exitDate = austritt,
        iban = "DE89370400440532013000", mandateReference = "MAND-1", mandateDate = "2020-01-01",
    )

    private fun anzahl(eintritt: String?, austritt: String?) =
        SepaService.buildCollectionItems(listOf(mitglied(eintritt, austritt)), jaehrlich, clock = heute).size

    @Test fun ohneDatenWirdEingezogen() = assertEquals(1, anzahl(null, null))
    @Test fun leereDatenWerdenIgnoriert() = assertEquals(1, anzahl("", ""))
    @Test fun austrittInDerVergangenheitWirdNichtEingezogen() = assertEquals(0, anzahl("2020-01-01", "2026-06-14"))
    @Test fun austrittHeuteWirdNochEingezogen() = assertEquals(1, anzahl("2020-01-01", "2026-06-15"))
    @Test fun austrittInDerZukunftWirdEingezogen() = assertEquals(1, anzahl("2020-01-01", "2026-12-31"))
    @Test fun eintrittInDerZukunftWirdNichtEingezogen() = assertEquals(0, anzahl("2026-06-16", null))
    @Test fun eintrittHeuteWirdEingezogen() = assertEquals(1, anzahl("2026-06-15", null))
    @Test fun unlesbaresDatumBlockiertNicht() = assertEquals(1, anzahl("kein Datum", "auch nicht"))
}
