package de.vereinsmanager.core.settings

import de.vereinsmanager.core.members.Zeit
import de.vereinsmanager.core.sepa.SepaService
import de.vereinsmanager.core.store.DocumentStore
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull
import java.time.ZonedDateTime

/** Die Vereinsdaten aus den Einstellungen, soweit die App sie bearbeiten kann. */
data class VereinsForm(
    val name: String = "",
    val strasse: String = "",
    val hausnummer: String = "",
    val plz: String = "",
    val ort: String = "",
    val vorsitzender: String = "",
    val kassenwart: String = "",
    val glaeubigerId: String = "",
    val iban: String = "",
    val bic: String = "",
    /** Angaben für Zuwendungsbestätigungen (Spendenquittungen) */
    val finanzamt: String = "",
    val steuernummer: String = "",
    val freistellungsDatum: String = "",
    val feststellungsDatum: String = "",
    val veranlagungszeitraum: String = "",
    val zweck: String = "",
    /** Für den Briefkopf der Rechnungen */
    val email: String = "",
    val registernummer: String = "",
)

/** Die Angaben, die ein SEPA-Lastschrifteinzug vom Verein braucht. */
data class Glaeubiger(val id: String, val name: String, val iban: String, val bic: String, val kassenwart: String, val anschrift: String)

/**
 * Liest und schreibt die Vereinsdaten im Dokument `settings/main` (wie am Desktop). Alle anderen Felder der Einstellungen
 * bleiben beim Speichern unverändert.
 */
object Vereinsdaten {
    const val BEREICH = "settings"
    const val ID = "main"

    private fun t(o: JsonObject?, k: String) = (o?.get(k) as? JsonPrimitive)?.takeIf { it !is JsonNull }?.contentOrNull ?: ""

    fun lesen(settings: JsonObject?): VereinsForm {
        val a = settings?.get("address")
        val (strasse, haus, plz, ort) = when (a) {
            is JsonObject -> listOf(t(a, "street"), t(a, "houseNumber"), t(a, "zip"), t(a, "city"))
            is JsonPrimitive -> listOf(a.contentOrNull.orEmpty(), "", "", "") // am Desktop kann die Anschrift auch ein einziger Text sein
            else -> listOf("", "", "", "")
        }
        return VereinsForm(
            name = t(settings, "clubName"), strasse = strasse, hausnummer = haus, plz = plz, ort = ort,
            vorsitzender = t(settings, "chairman"), kassenwart = t(settings, "treasurer"),
            glaeubigerId = t(settings, "creditorId"), iban = t(settings, "creditorIban"), bic = t(settings, "creditorBic"),
            finanzamt = t(settings, "taxOffice"), steuernummer = t(settings, "taxNumber"),
            freistellungsDatum = t(settings, "taxExemptionDate"), feststellungsDatum = t(settings, "taxStatementDate"),
            veranlagungszeitraum = t(settings, "taxAssessmentPeriod"), zweck = t(settings, "promotedPurposes"),
            email = t(settings, "email"), registernummer = t(settings, "associationNumber"),
        )
    }

    fun lesen(store: DocumentStore): VereinsForm = lesen(store.get(BEREICH, ID))

    /** Fehlermeldungen je Feld; leer, wenn alles in Ordnung ist. Leere IBAN/BIC sind erlaubt (dann ist nur kein Lastschrifteinzug möglich). */
    fun pruefen(f: VereinsForm): Map<String, String> {
        val e = linkedMapOf<String, String>()
        if (f.name.isBlank()) e["name"] = "Bitte den Vereinsnamen eingeben."
        val iban = f.iban.filterNot { it.isWhitespace() }
        if (iban.isNotEmpty()) SepaService.validateIban(iban).let { if (!it.isValid) e["iban"] = it.error ?: "Die IBAN ist ungültig." }
        if (!SepaService.validateBic(f.bic)) e["bic"] = "Die BIC ist ungültig."
        return e
    }

    fun speichern(store: DocumentStore, f: VereinsForm, now: ZonedDateTime = ZonedDateTime.now()): VereinsForm {
        val fehler = pruefen(f)
        if (fehler.isNotEmpty()) throw IllegalArgumentException(fehler.values.first())
        store.transaction {
            val alt = store.get(BEREICH, ID)
            val m = LinkedHashMap<String, JsonElement>(alt ?: JsonObject(emptyMap()))
            m["id"] = JsonPrimitive(ID)
            m["clubName"] = JsonPrimitive(f.name.trim())
            val altAdresse = alt?.get("address")
            val unveraendertText = altAdresse is JsonPrimitive && f.strasse == altAdresse.contentOrNull.orEmpty() &&
                f.hausnummer.isEmpty() && f.plz.isEmpty() && f.ort.isEmpty()
            if (!unveraendertText) {
                val a = LinkedHashMap<String, JsonElement>((altAdresse as? JsonObject) ?: JsonObject(emptyMap()))
                a["street"] = JsonPrimitive(f.strasse.trim())
                a["houseNumber"] = JsonPrimitive(f.hausnummer.trim())
                a["zip"] = JsonPrimitive(f.plz.trim())
                a["city"] = JsonPrimitive(f.ort.trim())
                if (!a.containsKey("country")) a["country"] = JsonPrimitive("Deutschland")
                m["address"] = JsonObject(a)
            }
            m["chairman"] = JsonPrimitive(f.vorsitzender.trim())
            m["treasurer"] = JsonPrimitive(f.kassenwart.trim())
            m["creditorId"] = JsonPrimitive(f.glaeubigerId.uppercase().filterNot { it.isWhitespace() })
            m["creditorIban"] = JsonPrimitive(f.iban.uppercase().filterNot { it.isWhitespace() })
            m["creditorBic"] = JsonPrimitive(f.bic.uppercase().trim())
            m["taxOffice"] = JsonPrimitive(f.finanzamt.trim())
            m["taxNumber"] = JsonPrimitive(f.steuernummer.trim())
            m["taxExemptionDate"] = JsonPrimitive(f.freistellungsDatum.trim())
            m["taxStatementDate"] = JsonPrimitive(f.feststellungsDatum.trim())
            m["taxAssessmentPeriod"] = JsonPrimitive(f.veranlagungszeitraum.trim())
            m["promotedPurposes"] = JsonPrimitive(f.zweck.trim())
            m["email"] = JsonPrimitive(f.email.trim())
            m["associationNumber"] = JsonPrimitive(f.registernummer.trim())
            m["updatedAt"] = JsonPrimitive(Zeit.stempel(now))
            store.put(BEREICH, ID, JsonObject(m))
        }
        return lesen(store)
    }

    /** Die Gläubigerdaten für einen Einzug, oder null (mit Grund in [fehlt]), wenn etwas fehlt. */
    fun glaeubiger(settings: JsonObject?): Glaeubiger? = if (fehlt(settings) != null) null else Glaeubiger(
        id = t(settings, "creditorId").uppercase().trim(), name = t(settings, "clubName"),
        iban = t(settings, "creditorIban").uppercase().filterNot { it.isWhitespace() }, bic = t(settings, "creditorBic").uppercase().trim(),
        kassenwart = t(settings, "treasurer"), anschrift = de.vereinsmanager.core.export.Stammblatt.vereinsAnschrift(settings),
    )

    /** Was für einen Lastschrifteinzug in den Einstellungen noch fehlt (null: alles da). */
    fun fehlt(settings: JsonObject?): String? {
        if (t(settings, "creditorId").isBlank()) return "Die Gläubiger-ID fehlt."
        if (t(settings, "creditorIban").isBlank()) return "Die IBAN des Vereinskontos fehlt."
        val check = SepaService.validateIban(t(settings, "creditorIban"))
        if (!check.isValid) return "Die IBAN des Vereinskontos ist ungültig: ${check.error}"
        if (!SepaService.validateBic(t(settings, "creditorBic"))) return "Die BIC des Vereinskontos ist ungültig."
        return null
    }
}
