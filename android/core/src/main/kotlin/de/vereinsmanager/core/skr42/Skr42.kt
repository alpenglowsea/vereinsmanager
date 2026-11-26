package de.vereinsmanager.core.skr42

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

@Serializable
data class Skr42Sub(
    val code: String,
    val name: String,
    val label: String,
    val vatRateDefault: Int,
    val isCustom: Boolean = false,
    /** Vom Verein ausgeblendet: nicht mehr in den Auswahllisten, alte Buchungen bleiben ([Kontenrahmen]). */
    val ausgeblendet: Boolean = false,
    /** Bezeichnung vor einer Anpassung durch den Verein (ohne Nummer); nur gesetzt, wenn angepasst. */
    val originalName: String? = null,
    /** Steuersatz vor einer Anpassung durch den Verein; nur gesetzt, wenn angepasst. */
    val originalVatRate: Int? = null,
    /**
     * Nummer vor einer Umnummerierung durch den Verein; nur gesetzt, wenn umnummeriert. Bleibt der feste Schlüssel des
     * Kontos (Anpassungen, Vorgaben der App wie „Beiträge auf 40000“), auch wenn [code] eine andere Nummer trägt.
     */
    val originalCode: String? = null,
)

@Serializable
data class Skr42Main(
    val id: String,
    val code: String,
    val name: String,
    /** "income" oder "expense" */
    val type: String,
    val subCategories: List<Skr42Sub>,
    val isCustom: Boolean = false,
    /** Vom Verein ausgeblendet ([Kontenrahmen]). */
    val ausgeblendet: Boolean = false,
    /** Bezeichnung vor einer Anpassung durch den Verein; nur gesetzt, wenn angepasst. */
    val originalName: String? = null,
    /** Nummer vor einer Umnummerierung durch den Verein (siehe [Skr42Sub.originalCode]). */
    val originalCode: String? = null,
)

/**
 * Der Kontenrahmen SKR 42 (Vereine). Die Daten stammen unverändert aus
 * src/data/taxSpheres.ts der Desktop-Fassung (Datei resources/skr42/skr42.json,
 * mit einem Skript erzeugt, damit sich nichts verschreibt).
 *
 * Eigene Konten und Anpassungen des Vereins mischt [Kontenrahmen.wirksam] hinzu; der mitgelieferte Stand bleibt
 * unverändert. Die App arbeitet mit diesem wirksamen Kontenrahmen (`AppModel.kontenrahmen`).
 */
object Skr42 {
    /** Hauptkonto "Spenden, Schenkungen & Zuwendungen": Auswertungen zählen es als Spenden. */
    const val SPENDEN_HAUPTKONTO_CODE = "40400"

    val standard: List<Skr42Main> by lazy {
        val text = Skr42::class.java.getResourceAsStream("/skr42/skr42.json")!!
            .readBytes().toString(Charsets.UTF_8)
        Json.decodeFromString<List<Skr42Main>>(text)
    }

    fun withCustom(custom: List<Skr42Main>): List<Skr42Main> = standard + custom

    fun mains(type: String? = null, source: List<Skr42Main> = standard): List<Skr42Main> =
        if (type == null) source else source.filter { it.type == type }

    /** Konten eines Nummernkreises (nach id, Code oder Name), sonst alle Konten des Typs. */
    fun subs(type: String? = null, mainId: String? = null, source: List<Skr42Main> = standard): List<Skr42Sub> {
        if (!mainId.isNullOrEmpty()) {
            val found = source.firstOrNull {
                it.id == mainId || it.code == mainId || it.name == mainId || "${it.code} - ${it.name}" == mainId
            }
            if (found != null) return found.subCategories
        }
        return mains(type, source).flatMap { it.subCategories }
    }

    /** Nummernkreis zu id, Code oder Name (auch "40400 - Name"); zuletzt über ein Konto. */
    fun findMain(identifier: String?, source: List<Skr42Main> = standard): Skr42Main? {
        if (identifier.isNullOrEmpty()) return null
        val clean = identifier.trim()
        val lower = clean.lowercase()
        val direct = source.firstOrNull {
            it.id == clean || it.code == clean || it.name.lowercase() == lower ||
                "${it.code} - ${it.name}".lowercase() == lower || clean.startsWith(it.code)
        }
        return direct ?: findMainForSub(clean, source)
    }

    /**
     * Nummernkreis zu einem Konto (Beschriftung, Name oder Nummer).
     *
     * Achtung, übernommen vom Desktop: Es genügt, wenn der Text die Kontonummer oder den
     * Kontonamen IRGENDWO enthält. Ein bloßes Stichwort wie "Mitgliedsbeiträge" findet nichts.
     */
    fun findMainForSub(subNameOrCode: String?, source: List<Skr42Main> = standard): Skr42Main? {
        if (subNameOrCode.isNullOrEmpty()) return null
        val clean = subNameOrCode.trim().lowercase()
        val raw = subNameOrCode.trim()
        return source.firstOrNull { main ->
            main.subCategories.any { sub ->
                sub.label.lowercase() == clean || sub.name.lowercase() == clean || sub.code == raw ||
                    clean.contains(sub.code) || clean.contains(sub.name.lowercase())
            }
        }
    }
}
