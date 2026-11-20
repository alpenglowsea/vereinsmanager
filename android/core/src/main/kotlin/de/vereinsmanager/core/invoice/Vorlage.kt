package de.vereinsmanager.core.invoice

import de.vereinsmanager.core.backup.SingleIds
import de.vereinsmanager.core.members.Zeit
import de.vereinsmanager.core.store.DocumentStore
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.intOrNull
import java.time.ZonedDateTime

/** Die Rechnungsvorlage (`invoiceTemplate`). Vorgaben wie `DEFAULT_INVOICE_TEMPLATE` am Desktop; [kleinunternehmerHinweis] ist neu. */
data class Vorlage(
    val name: String = "Standard-Vereinsbriefbogen (DIN 5008)",
    /** Eigenes Briefpapier als Bild (Data-URL, PNG oder JPEG); leer: Standard-Briefkopf. */
    val briefpapier: String = "",
    val briefpapierName: String = "",
    val briefpapierDatum: String = "",
    val randOben: Int = 45,
    val einleitung: String = "Sehr geehrte Damen und Herren,\n\nwir bedanken uns für das entgegengebrachte Vertrauen und die gute Zusammenarbeit. Für die vereinbarten Leistungen stellen wir Ihnen folgende Positionen in Rechnung:",
    val schluss: String = "Zahlungsziel: Bitte überweisen Sie den Rechnungsbetrag ohne Abzug innerhalb von 14 Tagen unter Angabe der Rechnungsnummer auf unser unten genanntes Vereinskonto.",
    val zahlungszielTage: Int = 14,
    val faltmarken: Boolean = true,
    val giroCode: Boolean = true,
    /** "#rrggbb" */
    val akzent: String = "#1e40af",
    val kleinunternehmerHinweis: String = "Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.",
) {
    val hatBriefpapier: Boolean get() = briefpapier.isNotBlank()

    /** Die Akzentfarbe als ARGB-Zahl; bei ungültigem Wert das Standardblau. */
    val akzentFarbe: Int get() = Regex("""^#([0-9a-fA-F]{6})$""").matchEntire(akzent.trim())?.groupValues?.get(1)?.toInt(16)?.let { 0xFF000000.toInt() or it } ?: 0xFF1E40AF.toInt()
}

object Vorlagen {
    const val BEREICH = "invoiceTemplate"
    val ID = SingleIds.INVOICE_TEMPLATE

    private fun t(o: JsonObject?, k: String) = (o?.get(k) as? JsonPrimitive)?.takeIf { it !is JsonNull }?.contentOrNull
    private fun b(o: JsonObject?, k: String) = (o?.get(k) as? JsonPrimitive)?.booleanOrNull
    private fun n(o: JsonObject?, k: String) = (o?.get(k) as? JsonPrimitive)?.takeIf { it !is JsonNull }?.let { it.intOrNull ?: it.contentOrNull?.toDoubleOrNull()?.toInt() }

    fun lesen(o: JsonObject?): Vorlage {
        val v = Vorlage()
        return Vorlage(
            name = t(o, "templateName") ?: v.name, briefpapier = t(o, "customBlankoDataUrl").orEmpty(),
            briefpapierName = t(o, "customBlankoFileName").orEmpty(), briefpapierDatum = t(o, "customBlankoUploadedAt").orEmpty(),
            randOben = n(o, "marginTop") ?: v.randOben, einleitung = t(o, "defaultIntroText") ?: v.einleitung,
            schluss = t(o, "defaultOutroText") ?: v.schluss, zahlungszielTage = n(o, "defaultPaymentTermsDays") ?: v.zahlungszielTage,
            faltmarken = b(o, "showFoldingMarks") ?: v.faltmarken, giroCode = b(o, "showGiroCode") ?: v.giroCode,
            akzent = t(o, "accentColor") ?: v.akzent, kleinunternehmerHinweis = t(o, "smallBusinessNotice") ?: v.kleinunternehmerHinweis,
        )
    }

    fun lesen(store: DocumentStore): Vorlage = lesen(store.get(BEREICH, ID))

    fun pruefen(v: Vorlage): Map<String, String> {
        val e = linkedMapOf<String, String>()
        if (v.zahlungszielTage !in 0..365) e["tage"] = "Das Zahlungsziel muss zwischen 0 und 365 Tagen liegen."
        if (!Regex("""^#[0-9a-fA-F]{6}$""").matches(v.akzent.trim())) e["akzent"] = "Bitte die Farbe als #rrggbb angeben, z. B. #1e40af."
        if (v.randOben !in 0..120) e["rand"] = "Der obere Rand muss zwischen 0 und 120 mm liegen."
        return e
    }

    /** Speichert die Vorlage; Felder, die diese App nicht kennt (Ränder, Logo, …), bleiben unverändert. */
    fun speichern(store: DocumentStore, v: Vorlage, now: ZonedDateTime = ZonedDateTime.now()): Vorlage {
        val fehler = pruefen(v)
        if (fehler.isNotEmpty()) throw IllegalArgumentException(fehler.values.first())
        store.transaction {
            val m = LinkedHashMap<String, JsonElement>(store.get(BEREICH, ID) ?: JsonObject(emptyMap()))
            m["id"] = JsonPrimitive(ID)
            m["templateName"] = JsonPrimitive(v.name)
            if (v.hatBriefpapier) {
                m["customBlankoDataUrl"] = JsonPrimitive(v.briefpapier); m["customBlankoFileName"] = JsonPrimitive(v.briefpapierName)
                m["customBlankoUploadedAt"] = JsonPrimitive(v.briefpapierDatum.ifEmpty { Zeit.stempel(now) })
            } else {
                m.remove("customBlankoDataUrl"); m.remove("customBlankoFileName"); m.remove("customBlankoUploadedAt")
            }
            m["marginTop"] = JsonPrimitive(v.randOben)
            m["defaultIntroText"] = JsonPrimitive(v.einleitung); m["defaultOutroText"] = JsonPrimitive(v.schluss)
            m["defaultPaymentTermsDays"] = JsonPrimitive(v.zahlungszielTage)
            m["showFoldingMarks"] = JsonPrimitive(v.faltmarken); m["showGiroCode"] = JsonPrimitive(v.giroCode)
            m["accentColor"] = JsonPrimitive(v.akzent.trim()); m["smallBusinessNotice"] = JsonPrimitive(v.kleinunternehmerHinweis)
            store.put(BEREICH, ID, JsonObject(m))
        }
        return lesen(store)
    }
}

/** Die Absenderangaben aus den Vereinsdaten (`settings/main`). */
data class Absender(
    val name: String, val anschrift: String, val email: String, val register: String, val finanzamt: String, val steuernummer: String,
    val vorsitzender: String, val kassenwart: String, val iban: String, val bic: String, val glaeubigerId: String,
    /** Telefon und Webseite des Vereins, für den Briefkopf der Rechnung (E10, wie Desktop) */
    val telefon: String = "", val webseite: String = "",
) {
    /** „Tel.: … • E-Mail • Webseite“ – nur, was eingetragen ist (wie `kontaktZeile` am Desktop). */
    val kontaktZeile: String get() = listOf(
        telefon.trim().let { if (it.isNotEmpty()) "Tel.: $it" else "" }, email.trim(), webseite.trim(),
    ).filter { it.isNotEmpty() }.joinToString(" • ")

    companion object {
        private fun t(o: JsonObject?, k: String) = (o?.get(k) as? JsonPrimitive)?.takeIf { it !is JsonNull }?.contentOrNull.orEmpty()

        fun lesen(settings: JsonObject?): Absender = Absender(
            name = t(settings, "clubName"),
            anschrift = de.vereinsmanager.core.export.Stammblatt.vereinsAnschrift(settings),
            email = t(settings, "email"), register = t(settings, "associationNumber"), finanzamt = t(settings, "taxOffice"),
            steuernummer = t(settings, "taxNumber"), vorsitzender = t(settings, "chairman"), kassenwart = t(settings, "treasurer"),
            iban = t(settings, "creditorIban").uppercase().filterNot { it.isWhitespace() }, bic = t(settings, "creditorBic").uppercase().filterNot { it.isWhitespace() },
            glaeubigerId = t(settings, "creditorId"),
            telefon = t(settings, "phone"), webseite = t(settings, "website"),
        )
    }
}
