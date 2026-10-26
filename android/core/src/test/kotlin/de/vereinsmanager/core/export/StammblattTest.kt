package de.vereinsmanager.core.export

import de.vereinsmanager.core.members.Member
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.LocalDate

class StammblattTest {
    private val heute = LocalDate.of(2026, 10, 26)
    private fun obj(s: String) = Json.parseToJsonElement(s).jsonObject

    private val m = Member.from(
        obj(
            """{"id":"m","memberNumber":"MG-001","firstName":"Maximilian","lastName":"Müller","gender":"m","birthDate":"1984-05-14",
            "address":{"street":"Hauptstraße","houseNumber":"42","zip":"12345","city":"Musterstadt","country":"Deutschland"},
            "phone":"","email":"max@x.de","entryDate":"2015-03-01","status":"active","department":"Fußball","membershipType":"full",
            "feeAmount":15,"feePeriod":"monthly","paymentMethod":"sepa","dataPrivacyConsent":true,"notes":"",
            "bankDetails":{"iban":"DE89370400440532013000","bic":"COBADEFFXXX","bankName":"Commerzbank","accountHolder":"Maximilian Müller","mandateDate":"2020-01-01","mandateReference":"MANDAT-MG-001"}}""",
        ),
    )

    @Test fun inhaltUndFormat() {
        val d = Stammblatt.erstellen(m, obj("""{"clubName":"TSV Demo","address":{"street":"Weg","houseNumber":"1","zip":"11111","city":"Stadt"},"email":"v@x.de","associationNumber":"VR 1","taxNumber":"123"}"""), heute)
        assertEquals("TSV Demo", d.verein)
        assertEquals("Weg 1, 11111 Stadt | v@x.de", d.kopf1)
        assertEquals("VR 1 | Steuernummer: 123", d.kopf2)
        assertEquals("Erstellt am: 26.10.2026", d.erstellt)
        assertEquals(2, d.abschnitte.size)
        assertTrue(d.abschnitte.all { a -> a.zeilen.all { it.size == 4 } && a.breiten.size == 4 })
        val basis = d.abschnitte[0].zeilen
        assertEquals(listOf("Mitgliedsnummer:", "MG-001", "Status:", "Aktiv"), basis[0])
        assertEquals("14.05.1984", basis[2][1])
        assertEquals("–", basis[5][1]) // keine Telefonnummer
        assertEquals("–", basis[4][3]) // kein Austritt
        val zahlung = d.abschnitte[1].zeilen
        assertEquals("15,00 €", zahlung[0][3])
        assertEquals("Monatlich", zahlung[1][1])
        assertEquals("DE89 3704 0044 0532 0130 00", zahlung[3][1])
        assertEquals("01.01.2020", zahlung[4][3])
        assertEquals("Interne Notizen: Keine besonderen Vermerke.", d.notizen)
        assertTrue(d.datenschutz.endsWith("(Einwilligung erteilt)"))
        assertEquals("stammblatt_MG-001_Müller.pdf", d.dateiname)
    }

    @Test fun ohneVereinsdaten() {
        val d = Stammblatt.erstellen(m, null, heute)
        assertEquals("Verein", d.verein)
        assertEquals("", d.kopf1)
        assertEquals("", d.kopf2)
    }

    @Test fun anschriftAlsText() {
        assertEquals("Hauptstr. 3, Ort", Stammblatt.vereinsAnschrift(obj("""{"address":" Hauptstr. 3, Ort "}""")))
        assertEquals("", Stammblatt.vereinsAnschrift(obj("{}")))
    }
}
