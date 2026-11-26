package de.vereinsmanager.core.skr42

import de.vereinsmanager.core.members.Zeit
import de.vereinsmanager.core.settings.Vereinsdaten
import de.vereinsmanager.core.store.DocumentStore
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.intOrNull
import java.time.ZonedDateTime

/**
 * Kontenrahmen des Vereins: der mitgelieferte SKR 42, dazu eigene Nummernkreise und Konten und die Anpassungen des
 * Vereins (Nummer, Bezeichnung, Steuersatz-Vorgabe, ausgeblendet).
 *
 * Gleiche Regeln und Texte wie am Desktop (`src/utils/kontenrahmen.ts`), mit denselben Prüffällen.
 *
 * Gespeichert im Dokument `settings/main`, in denselben Feldern wie am Desktop; damit reist beides in jeder
 * Datensicherung mit (BACKUP_FORMAT.md, Abschnitt 3):
 *  - `customSkr42Accounts`: eigene Nummernkreise und Konten
 *  - `skr42Anpassungen`: `{ nummernkreise: { "<Schlüssel>": { nummer?, name?, ausgeblendet? } },
 *                           konten: { "<Schlüssel>": { nummer?, name?, vatRateDefault?, ausgeblendet? } } }`
 *
 * Der Schlüssel ist die ursprüngliche Nummer (mitgeliefert oder beim Anlegen vergeben). Er ändert sich nie, auch wenn der
 * Verein die Nummer ändert (`nummer`); im wirksamen Kontenrahmen steht er dann als `originalCode`. Daran hängen die
 * Anpassungen und die Vorgaben der App („Beiträge auf 40000“, siehe [standardKonto]). Damit Schlüssel eindeutig bleiben,
 * bekommt ein neu angelegtes Konto keine Nummer, die ursprünglich einem anderen gehört ([pruefeNeueNummer]).
 *
 * Entscheidungen Johannes, 26.11.2026: änderbar sind Nummer, Bezeichnung, Steuersatz-Vorgabe und „ausgeblendet“, auch
 * bei den Standardkonten; eine neue Nummer oder Bezeichnung geht auf alle Buchungen über; bekommt ein Nummernkreis eine
 * neue Nummer, ziehen seine Konten um denselben Abstand mit; Nummernkreise und Konten stehen immer aufsteigend nach der
 * Nummer.
 */
object Kontenrahmen {
    const val FELD_EIGENE = "customSkr42Accounts"
    const val FELD_ANPASSUNGEN = "skr42Anpassungen"
    private val STEUERSAETZE = setOf(0, 7, 19)
    private val NUMMER = Regex("^\\d{4,6}$")

    data class NummernkreisAnpassung(val name: String? = null, val ausgeblendet: Boolean = false, val nummer: String? = null) {
        val leer get() = name == null && !ausgeblendet && nummer == null
    }
    data class KontoAnpassung(val name: String? = null, val vatRateDefault: Int? = null, val ausgeblendet: Boolean = false, val nummer: String? = null) {
        val leer get() = name == null && vatRateDefault == null && !ausgeblendet && nummer == null
    }
    data class Anpassungen(
        val nummernkreise: Map<String, NummernkreisAnpassung> = emptyMap(),
        val konten: Map<String, KontoAnpassung> = emptyMap(),
    )
    /** Eigene Konten, die unter einem Standard-Nummernkreis hängen. */
    data class EigenesKonto(val nummernkreis: String, val konto: Skr42Sub)
    data class Eigene(val nummernkreise: List<Skr42Main> = emptyList(), val konten: List<EigenesKonto> = emptyList())

    fun kontoText(code: String, name: String) = "$code - $name"

    /** Die Bezeichnung eines Kontos ohne Nummer, so wie sie in den Listen steht (aus der Beschriftung). */
    fun kontoBezeichnung(s: Skr42Sub): String = s.label.removePrefix("${s.code} - ").takeIf { s.label.startsWith("${s.code} - ") } ?: s.name

    /** Nach der Nummer aufsteigend; Nummern als Zahlen verglichen (999 vor 1000), sonst als Text. */
    val nachNummer = Comparator<String> { a, b ->
        val x = a.trim().toLongOrNull(); val y = b.trim().toLongOrNull()
        if (x != null && y != null && x != y) x.compareTo(y) else a.compareTo(b)
    }

    // ------------------------------------------------------------------ Lesen
    private fun t(o: JsonObject?, k: String) = (o?.get(k) as? JsonPrimitive)?.takeIf { it !is JsonNull }?.contentOrNull

    private fun leseKonto(x: JsonElement?): Skr42Sub? {
        val o = x as? JsonObject ?: return null
        val code = t(o, "code")?.trim()?.takeIf { it.isNotEmpty() } ?: return null
        val name = t(o, "name")?.trim()?.takeIf { it.isNotEmpty() } ?: code
        val label = t(o, "label")?.trim()?.takeIf { it.isNotEmpty() } ?: kontoText(code, name)
        val ust = (o["vatRateDefault"] as? JsonPrimitive)?.intOrNull?.takeIf { it in STEUERSAETZE } ?: 0
        return Skr42Sub(code = code, name = name, label = label, vatRateDefault = ust, isCustom = true)
    }

    fun leseEigene(roh: JsonElement?): Eigene {
        val o = roh as? JsonObject ?: return Eigene()
        val haupt = (o["customMainCategories"] as? JsonArray).orEmpty().mapNotNull { e ->
            val m = e as? JsonObject ?: return@mapNotNull null
            val code = t(m, "code")?.trim()?.takeIf { it.isNotEmpty() } ?: return@mapNotNull null
            Skr42Main(
                id = t(m, "id")?.takeIf { it.isNotEmpty() } ?: "HK-$code-CUSTOM",
                code = code,
                name = t(m, "name")?.trim()?.takeIf { it.isNotEmpty() } ?: code,
                type = if (t(m, "type") == "expense") "expense" else "income",
                subCategories = (m["subCategories"] as? JsonArray).orEmpty().mapNotNull(::leseKonto),
                isCustom = true,
            )
        }
        val unter = (o["customSubCategories"] as? JsonArray).orEmpty().mapNotNull { e ->
            val u = e as? JsonObject ?: return@mapNotNull null
            val kreis = t(u, "mainCatIdOrCode") ?: return@mapNotNull null
            leseKonto(u["subCategory"])?.let { EigenesKonto(kreis, it) }
        }
        return Eigene(haupt, unter)
    }

    fun leseAnpassungen(roh: JsonElement?): Anpassungen {
        val o = roh as? JsonObject ?: return Anpassungen()
        val kreise = (o["nummernkreise"] as? JsonObject).orEmpty().mapNotNull { (code, e) ->
            val a = e as? JsonObject ?: return@mapNotNull null
            NummernkreisAnpassung(
                name = t(a, "name")?.trim()?.takeIf { it.isNotEmpty() },
                ausgeblendet = (a["ausgeblendet"] as? JsonPrimitive)?.booleanOrNull == true,
                nummer = t(a, "nummer")?.trim()?.takeIf { NUMMER.matches(it) && it != code },
            ).takeIf { !it.leer }?.let { code to it }
        }.toMap()
        val konten = (o["konten"] as? JsonObject).orEmpty().mapNotNull { (code, e) ->
            val a = e as? JsonObject ?: return@mapNotNull null
            KontoAnpassung(
                name = t(a, "name")?.trim()?.takeIf { it.isNotEmpty() },
                vatRateDefault = (a["vatRateDefault"] as? JsonPrimitive)?.intOrNull?.takeIf { it in STEUERSAETZE },
                ausgeblendet = (a["ausgeblendet"] as? JsonPrimitive)?.booleanOrNull == true,
                nummer = t(a, "nummer")?.trim()?.takeIf { NUMMER.matches(it) && it != code },
            ).takeIf { !it.leer }?.let { code to it }
        }.toMap()
        return Anpassungen(kreise, konten)
    }

    // ------------------------------------------------------------------ Schreiben (JSON wie am Desktop)
    private fun kontoJson(s: Skr42Sub) = JsonObject(linkedMapOf(
        "code" to JsonPrimitive(s.code), "name" to JsonPrimitive(s.name), "label" to JsonPrimitive(s.label),
        "vatRateDefault" to JsonPrimitive(s.vatRateDefault), "isCustom" to JsonPrimitive(true),
    ))

    fun eigeneAlsJson(e: Eigene) = JsonObject(linkedMapOf(
        "customMainCategories" to JsonArray(e.nummernkreise.map { m ->
            JsonObject(linkedMapOf(
                "id" to JsonPrimitive(m.id), "code" to JsonPrimitive(m.code), "name" to JsonPrimitive(m.name),
                "type" to JsonPrimitive(m.type), "subCategories" to JsonArray(m.subCategories.map(::kontoJson)),
                "isCustom" to JsonPrimitive(true),
            ))
        }),
        "customSubCategories" to JsonArray(e.konten.map { u ->
            JsonObject(linkedMapOf("mainCatIdOrCode" to JsonPrimitive(u.nummernkreis), "subCategory" to kontoJson(u.konto)))
        }),
    ))

    fun anpassungenAlsJson(a: Anpassungen) = JsonObject(linkedMapOf(
        "nummernkreise" to JsonObject(a.nummernkreise.mapValues { (_, n) ->
            JsonObject(buildMap {
                n.nummer?.let { put("nummer", JsonPrimitive(it)) }
                n.name?.let { put("name", JsonPrimitive(it)) }
                if (n.ausgeblendet) put("ausgeblendet", JsonPrimitive(true))
            })
        }),
        "konten" to JsonObject(a.konten.mapValues { (_, k) ->
            JsonObject(buildMap {
                k.nummer?.let { put("nummer", JsonPrimitive(it)) }
                k.name?.let { put("name", JsonPrimitive(it)) }
                k.vatRateDefault?.let { put("vatRateDefault", JsonPrimitive(it)) }
                if (k.ausgeblendet) put("ausgeblendet", JsonPrimitive(true))
            })
        }),
    ))

    // ------------------------------------------------------------------ Der wirksame Kontenrahmen
    fun wirksam(standard: List<Skr42Main>, eigene: Eigene, a: Anpassungen): List<Skr42Main> {
        val haupt = standard.toMutableList()
        for (m in eigene.nummernkreise) {
            val i = haupt.indexOfFirst { it.code == m.code || it.id == m.id }
            val kopie = m.copy(isCustom = true, subCategories = m.subCategories.map { it.copy(isCustom = true) })
            if (i >= 0) { if (haupt[i].isCustom) haupt[i] = kopie } else haupt.add(kopie)
        }
        for (u in eigene.konten) {
            val i = haupt.indexOfFirst { it.id == u.nummernkreis || it.code == u.nummernkreis }
            if (i < 0 || haupt[i].subCategories.any { it.code == u.konto.code }) continue
            haupt[i] = haupt[i].copy(subCategories = haupt[i].subCategories + u.konto.copy(isCustom = true))
        }
        return haupt.map { m ->
            val na = a.nummernkreise[m.code]
            val umbenannt = na?.name != null && na.name != m.name
            val neueNummer = na?.nummer?.takeIf { it != m.code }
            m.copy(
                code = neueNummer ?: m.code,
                originalCode = neueNummer?.let { m.code },
                name = if (umbenannt) na!!.name!! else m.name,
                originalName = if (umbenannt) m.name else null,
                ausgeblendet = na?.ausgeblendet == true,
                subCategories = m.subCategories.map { s ->
                    val k = a.konten[s.code] ?: return@map s
                    val bisher = kontoBezeichnung(s)
                    val neuerName = k.name?.takeIf { it != bisher }
                    val neueUst = k.vatRateDefault?.takeIf { it != s.vatRateDefault }
                    val kontoNummer = k.nummer?.takeIf { it != s.code }
                    val bezeichnung = neuerName ?: bisher
                    s.copy(
                        code = kontoNummer ?: s.code,
                        originalCode = kontoNummer?.let { s.code },
                        name = neuerName ?: s.name,
                        label = if (neuerName != null || kontoNummer != null) kontoText(kontoNummer ?: s.code, bezeichnung) else s.label,
                        originalName = neuerName?.let { bisher },
                        vatRateDefault = neueUst ?: s.vatRateDefault,
                        originalVatRate = neueUst?.let { s.vatRateDefault },
                        ausgeblendet = k.ausgeblendet,
                    )
                }.sortedWith(compareBy(nachNummer) { it.code }),
            )
        }.sortedWith(compareBy(nachNummer) { it.code })
    }

    /** Für Auswahllisten: ohne Ausgeblendetes; was eine Buchung schon verwendet, bleibt sichtbar. */
    fun nurSichtbare(struktur: List<Skr42Main>, nummernkreis: String? = null, konto: String? = null): List<Skr42Main> =
        nurSichtbare(struktur, setOfNotNull(nummernkreis), setOfNotNull(konto))

    /** Wie oben, für mehrere gewählte Werte (Buchung mit Teilbuchungen). */
    fun nurSichtbare(struktur: List<Skr42Main>, nummernkreise: Set<String>, konten: Set<String>): List<Skr42Main> =
        struktur.map { m ->
            m.copy(subCategories = m.subCategories.filter { s -> !s.ausgeblendet || s.code in konten || s.label in konten })
        }.filter { m ->
            val gewaehlt = listOf(m.id, m.code, kontoText(m.code, m.name)).any { it in nummernkreise }
            gewaehlt || (!m.ausgeblendet && m.subCategories.isNotEmpty())
        }

    /**
     * Vorschlag für eine neue Nummer, wie am Desktop (customCategoryService.suggestNextCode): im Nummernkreis die höchste
     * Kontonummer + 1 (die nächste freie), für einen neuen Nummernkreis der nächste freie runde Tausender über der
     * höchsten Nummer dieser Richtung.
     */
    fun vorschlagNummer(struktur: List<Skr42Main>, typ: String, nummernkreis: String? = null): String {
        val belegt = struktur.flatMap { m -> m.subCategories.map { it.code } }.toSet()
        if (!nummernkreis.isNullOrEmpty()) {
            val m = struktur.firstOrNull { it.code == nummernkreis || it.id == nummernkreis }
            if (m != null) {
                var n = m.subCategories.mapNotNull { it.code.toLongOrNull() }.maxOrNull()?.plus(1) ?: m.code.toLongOrNull() ?: return m.code
                while ("$n" in belegt) n++
                return "$n"
            }
        }
        val zahlen = struktur.filter { it.type == typ }.flatMap { m -> listOf(m.code) + m.subCategories.map { it.code } }.mapNotNull { it.toLongOrNull() }
        val hoechste = zahlen.maxOrNull() ?: if (typ == "income") 40000L else 50000L
        var basis = ((hoechste + 1 + 999) / 1000) * 1000
        while (struktur.any { it.code == "$basis" } || "$basis" in belegt) basis += 1000
        return "$basis"
    }

    // ------------------------------------------------------------------ Prüfen und Ändern
    fun pruefeBezeichnung(name: String): String? = when {
        name.isBlank() -> "Bitte eine Bezeichnung eingeben."
        name.trim().length > 120 -> "Die Bezeichnung ist zu lang (höchstens 120 Zeichen)."
        else -> null
    }

    /** Der feste Schlüssel eines Kontos: die ursprüngliche Nummer (siehe oben). */
    fun schluessel(s: Skr42Sub) = s.originalCode ?: s.code
    fun schluessel(m: Skr42Main) = m.originalCode ?: m.code

    /**
     * Ein mitgeliefertes Konto über seine ursprüngliche Nummer, wo auch immer es heute steht. Für die Vorgaben der App
     * (Beiträge 40000, Spenden 40450, Rechnungen, zweite Teilzeile 68500 …): Hat der Verein das Konto umnummeriert, bucht
     * die App auf die neue Nummer.
     */
    fun standardKonto(code: String, struktur: List<Skr42Main>): Pair<Skr42Main, Skr42Sub>? {
        for (m in struktur) m.subCategories.firstOrNull { !it.isCustom && schluessel(it) == code }?.let { return m to it }
        return null
    }

    /** Ein mitgelieferter Nummernkreis über seine ursprüngliche Nummer (wie [standardKonto]). */
    fun standardNummernkreis(code: String, struktur: List<Skr42Main>): Skr42Main? =
        struktur.firstOrNull { !it.isCustom && schluessel(it) == code }

    /**
     * Fehlermeldung zu einer neuen Nummer, sonst null. Konten- und Nummernkreisnummern sind je für sich eindeutig.
     *  - [ausgenommen]: Schlüssel der Einträge, die gerade selbst eine neue Nummer bekommen (sie zählen nicht als belegt).
     *  - [anlegen] (Vorgabe): Die Nummer wird Schlüssel eines neuen Eintrags; dann darf sie auch nicht die ursprüngliche
     *    Nummer eines anderen sein. Beim Umnummerieren gilt das nicht, dort zählt nur, was heute belegt ist.
     */
    fun pruefeNeueNummer(
        code: String, nummernkreis: Boolean, struktur: List<Skr42Main>, ausgenommen: Set<String> = emptySet(), anlegen: Boolean = true,
    ): String? {
        val c = code.trim()
        if (c.isEmpty()) return "Bitte eine Nummer eingeben."
        if (!NUMMER.matches(c)) return "Die Nummer besteht aus 4 bis 6 Ziffern."
        data class E(val code: String, val key: String, val text: String)
        val eintraege = (if (nummernkreis) struktur.map { E(it.code, schluessel(it), it.name) }
            else struktur.flatMap { m -> m.subCategories.map { E(it.code, schluessel(it), kontoBezeichnung(it)) } })
            .filter { it.key !in ausgenommen }
        eintraege.firstOrNull { it.code == c }?.let {
            return if (nummernkreis) "Den Nummernkreis $c gibt es schon (${it.text})." else "Das Konto $c gibt es schon (${it.text})."
        }
        if (anlegen) eintraege.firstOrNull { it.key == c }?.let {
            return "Die Nummer $c gehört ursprünglich ${if (nummernkreis) "zum Nummernkreis" else "zum Konto"} „${it.text}“ " +
                "(heute ${it.code}) und bleibt dafür frei. Bitte eine andere wählen."
        }
        return null
    }

    /**
     * Trägt eine Anpassung ein (null = unverändert lassen). Was dem Original entspricht, fällt weg. [code] ist der
     * Schlüssel (ursprüngliche Nummer).
     */
    fun mitKontoAnpassung(
        a: Anpassungen, code: String, name: String? = null, ust: Int? = null, ausgeblendet: Boolean? = null,
        originalName: String, originalUst: Int, nummer: String? = null,
    ): Anpassungen {
        val alt = a.konten[code] ?: KontoAnpassung()
        val n = (name ?: alt.name)?.trim()?.takeIf { it.isNotEmpty() && it != originalName }
        val u = (ust ?: alt.vatRateDefault)?.takeIf { it != originalUst }
        val nr = (nummer ?: alt.nummer)?.trim()?.takeIf { it.isNotEmpty() && it != code }
        val e = KontoAnpassung(n, u, ausgeblendet ?: alt.ausgeblendet, nr)
        return a.copy(konten = if (e.leer) a.konten - code else a.konten + (code to e))
    }

    fun mitNummernkreisAnpassung(
        a: Anpassungen, code: String, name: String? = null, ausgeblendet: Boolean? = null, originalName: String, nummer: String? = null,
    ): Anpassungen {
        val alt = a.nummernkreise[code] ?: NummernkreisAnpassung()
        val n = (name ?: alt.name)?.trim()?.takeIf { it.isNotEmpty() && it != originalName }
        val nr = (nummer ?: alt.nummer)?.trim()?.takeIf { it.isNotEmpty() && it != code }
        val e = NummernkreisAnpassung(n, ausgeblendet ?: alt.ausgeblendet, nr)
        return a.copy(nummernkreise = if (e.leer) a.nummernkreise - code else a.nummernkreise + (code to e))
    }

    /** Neue Anpassungen oder eine Fehlermeldung (genau eins von beiden ist gesetzt). */
    data class Plan(val anpassungen: Anpassungen? = null, val fehler: String? = null)

    /**
     * Plant eine Änderung an einem Nummernkreis oder Konto, gegeben über seine heutige Nummer (null = unverändert).
     * Bekommt ein Nummernkreis eine neue Nummer, ziehen alle seine Konten (auch ausgeblendete und eigene) um denselben
     * Abstand mit; jede neue Nummer muss frei sein. Wie `planeAenderung` am Desktop.
     */
    fun planeAenderung(
        struktur: List<Skr42Main>, a: Anpassungen, konto: Boolean, code: String,
        nummer: String? = null, name: String? = null, ust: Int? = null, ausgeblendet: Boolean? = null,
    ): Plan {
        name?.let { n -> pruefeBezeichnung(n)?.let { return Plan(fehler = it) } }
        if (ust != null && ust !in STEUERSAETZE) return Plan(fehler = "Steuersatz $ust gibt es nicht.")
        val nr = nummer?.trim()
        if (konto) {
            val s = struktur.firstNotNullOfOrNull { m -> m.subCategories.firstOrNull { it.code == code } }
                ?: return Plan(fehler = "Das Konto $code gibt es nicht.")
            val key = schluessel(s)
            if (nr != null && nr != s.code) pruefeNeueNummer(nr, false, struktur, setOf(key), anlegen = false)?.let { return Plan(fehler = it) }
            return Plan(mitKontoAnpassung(a, key, name, ust, ausgeblendet, s.originalName ?: kontoBezeichnung(s), s.originalVatRate ?: s.vatRateDefault, nr))
        }
        val m = struktur.firstOrNull { it.code == code } ?: return Plan(fehler = "Den Nummernkreis $code gibt es nicht.")
        val key = schluessel(m)
        var neu = a
        if (nr != null && nr != m.code) {
            pruefeNeueNummer(nr, true, struktur, setOf(key), anlegen = false)?.let { return Plan(fehler = it) }
            val abstand = nr.toLong() - m.code.toLong()
            val eigeneKonten = m.subCategories.map(::schluessel).toSet()
            for (s in m.subCategories) {
                val ziel = ((s.code.toLongOrNull() ?: 0L) + abstand).toString()
                if (!NUMMER.matches(ziel)) {
                    return Plan(fehler = "Das Konto ${s.code} käme dabei auf $ziel; Kontonummern haben 4 bis 6 Ziffern. Bitte eine andere Nummer wählen.")
                }
                pruefeNeueNummer(ziel, false, struktur, eigeneKonten, anlegen = false)?.let { return Plan(fehler = "Das Konto ${s.code} käme dabei auf $ziel: $it") }
                neu = mitKontoAnpassung(neu, schluessel(s), originalName = s.originalName ?: kontoBezeichnung(s), originalUst = s.originalVatRate ?: s.vatRateDefault, nummer = ziel)
            }
        }
        return Plan(mitNummernkreisAnpassung(neu, key, name, ausgeblendet, m.originalName ?: m.name, nr))
    }

    fun ergaenzeAnpassungen(vorhanden: Anpassungen, neu: Anpassungen) =
        Anpassungen(neu.nummernkreise + vorhanden.nummernkreise, neu.konten + vorhanden.konten)

    fun ergaenzeEigene(vorhanden: Eigene, neu: Eigene): Eigene {
        val haupt = vorhanden.nummernkreise.toMutableList()
        for (m in neu.nummernkreise) if (haupt.none { it.id == m.id || it.code == m.code }) haupt.add(m)
        val unter = vorhanden.konten.toMutableList()
        for (u in neu.konten) if (unter.none { it.nummernkreis == u.nummernkreis && it.konto.code == u.konto.code }) unter.add(u)
        return Eigene(haupt, unter)
    }

    // ------------------------------------------------------------------ Buchungen
    private fun gehoertZuKonto(o: JsonObject, code: String): Boolean {
        val skr = t(o, "skrAccount")
        if (!skr.isNullOrEmpty()) return skr == code
        val sub = t(o, "subCategory").orEmpty()
        return sub == code || sub.startsWith("$code - ")
    }
    private fun gehoertZuNummernkreis(o: JsonObject, code: String): Boolean {
        val m = t(o, "mainCategory").orEmpty()
        return m == code || m.startsWith("$code - ")
    }

    fun kontoVerwendungen(buchungen: List<JsonObject>, code: String): Int = buchungen.count { b ->
        gehoertZuKonto(b, code) || (b["splits"] as? JsonArray).orEmpty().any { (it as? JsonObject)?.let { s -> gehoertZuKonto(s, code) } == true }
    }

    fun nummernkreisVerwendungen(buchungen: List<JsonObject>, code: String): Int = buchungen.count { b ->
        gehoertZuNummernkreis(b, code) || (b["splits"] as? JsonArray).orEmpty().any { (it as? JsonObject)?.let { s -> gehoertZuNummernkreis(s, code) } == true }
    }

    /**
     * Was eine Änderung im Kontenrahmen für die Buchungen bedeutet (Entscheidung Johannes, 26.11.2026): Jede neue Nummer
     * und jede neue Bezeichnung geht auf alle Buchungen über. Verglichen wird der Kontenrahmen vorher und nachher über den
     * festen Schlüssel; so deckt eine Funktion Umbenennen, Umnummerieren, das Verschieben eines ganzen Nummernkreises und
     * das Zurücksetzen ab. Konto: `subCategory` und `category` werden „Nummer - Bezeichnung“, `skrAccount` die neue
     * Nummer; Nummernkreis: `mainCategory` wird „Nummer - Bezeichnung“; jeweils auch in den Teilbuchungen.
     * Liefert nur die geänderten Buchungen (neue Objekte). Wie `buchungenAngleichen` am Desktop.
     */
    fun buchungenAngleichen(buchungen: List<JsonObject>, vorher: List<Skr42Main>, nachher: List<Skr42Main>): List<JsonObject> {
        val kontoNeu = nachher.flatMap { it.subCategories }.associateBy(::schluessel)
        val kreisNeu = nachher.associateBy(::schluessel)
        val konten = HashMap<String, Pair<String, String>>() // alte Nummer → (neue Nummer, Text)
        for (s in vorher.flatMap { it.subCategories }) {
            val n = kontoNeu[schluessel(s)] ?: continue
            if (n.code != s.code || kontoBezeichnung(n) != kontoBezeichnung(s)) konten[s.code] = n.code to kontoText(n.code, kontoBezeichnung(n))
        }
        val kreise = HashMap<String, String>()
        for (m in vorher) {
            val n = kreisNeu[schluessel(m)] ?: continue
            if (n.code != m.code || n.name != m.name) kreise[m.code] = kontoText(n.code, n.name)
        }
        if (konten.isEmpty() && kreise.isEmpty()) return emptyList()
        fun vorne(text: String?) = text?.substringBefore(" - ")?.trim().orEmpty()
        fun setze(o: JsonObject): JsonObject {
            var y = o
            val skr = t(o, "skrAccount")
            val k = konten[skr?.takeIf { it.isNotEmpty() } ?: vorne(t(o, "subCategory"))]
            if (k != null && (t(o, "subCategory") != k.second || t(o, "category") != k.second || (skr != null && skr != k.first))) {
                y = JsonObject(LinkedHashMap<String, JsonElement>(y).apply {
                    put("subCategory", JsonPrimitive(k.second)); put("category", JsonPrimitive(k.second))
                    if (skr != null) put("skrAccount", JsonPrimitive(k.first))
                })
            }
            val nk = kreise[vorne(t(o, "mainCategory"))]
            if (nk != null && t(o, "mainCategory") != nk) y = JsonObject(LinkedHashMap<String, JsonElement>(y).apply { put("mainCategory", JsonPrimitive(nk)) })
            return y
        }
        return buchungen.mapNotNull { b ->
            var neu = setze(b)
            val teile = b["splits"] as? JsonArray
            if (teile != null && teile.isNotEmpty()) {
                val gesetzt = teile.map { e -> (e as? JsonObject)?.let(::setze) ?: e }
                if (gesetzt.indices.any { gesetzt[it] !== teile[it] }) neu = JsonObject(LinkedHashMap<String, JsonElement>(neu).apply { put("splits", JsonArray(gesetzt)) })
            }
            neu.takeIf { it !== b }
        }
    }

    // ------------------------------------------------------------------ Mit dem Speicher
    fun eigene(store: DocumentStore) = leseEigene(store.get(Vereinsdaten.BEREICH, Vereinsdaten.ID)?.get(FELD_EIGENE))
    fun anpassungen(store: DocumentStore) = leseAnpassungen(store.get(Vereinsdaten.BEREICH, Vereinsdaten.ID)?.get(FELD_ANPASSUNGEN))
    fun wirksam(store: DocumentStore): List<Skr42Main> = wirksam(Skr42.standard, eigene(store), anpassungen(store))

    private fun schreiben(store: DocumentStore, eigene: Eigene?, a: Anpassungen?, now: ZonedDateTime) {
        val alt = store.get(Vereinsdaten.BEREICH, Vereinsdaten.ID)
        val m = LinkedHashMap<String, JsonElement>(alt ?: JsonObject(emptyMap()))
        m["id"] = JsonPrimitive(Vereinsdaten.ID)
        if (eigene != null) m[FELD_EIGENE] = eigeneAlsJson(eigene)
        if (a != null) m[FELD_ANPASSUNGEN] = anpassungenAlsJson(a)
        m["updatedAt"] = JsonPrimitive(Zeit.stempel(now))
        store.put(Vereinsdaten.BEREICH, Vereinsdaten.ID, JsonObject(m))
    }

    /** Neuer Nummernkreis mit einem ersten Konto (gleiche Nummer und Bezeichnung, wenn nicht anders angegeben). */
    fun neuerNummernkreis(
        store: DocumentStore, code: String, name: String, typ: String, kontoCode: String? = null, kontoName: String? = null,
        ust: Int = 0, now: ZonedDateTime = ZonedDateTime.now(),
    ): Skr42Main = store.transaction {
        val struktur = wirksam(store)
        pruefeNeueNummer(code, true, struktur)?.let { throw IllegalArgumentException(it) }
        pruefeBezeichnung(name)?.let { throw IllegalArgumentException(it) }
        val kc = kontoCode?.trim()?.takeIf { it.isNotEmpty() } ?: code.trim()
        val kn = kontoName?.trim()?.takeIf { it.isNotEmpty() } ?: name.trim()
        pruefeNeueNummer(kc, false, struktur)?.let { throw IllegalArgumentException(it) }
        val konto = Skr42Sub(kc, kn, kontoText(kc, kn), if (ust in STEUERSAETZE) ust else 0, isCustom = true)
        val kreis = Skr42Main("HK-${code.trim()}-CUSTOM", code.trim(), name.trim(), if (typ == "expense") "expense" else "income", listOf(konto), isCustom = true)
        val e = eigene(store)
        schreiben(store, e.copy(nummernkreise = e.nummernkreise + kreis), null, now)
        kreis
    }

    /** Neues Konto in einem vorhandenen Nummernkreis (Standard oder eigen). */
    fun neuesKonto(store: DocumentStore, nummernkreisCode: String, code: String, name: String, ust: Int = 0, now: ZonedDateTime = ZonedDateTime.now()): Skr42Sub =
        store.transaction {
            val struktur = wirksam(store)
            val kreis = struktur.firstOrNull { it.code == nummernkreisCode || it.id == nummernkreisCode }
                ?: throw IllegalArgumentException("Den Nummernkreis $nummernkreisCode gibt es nicht.")
            pruefeNeueNummer(code, false, struktur)?.let { throw IllegalArgumentException(it) }
            pruefeBezeichnung(name)?.let { throw IllegalArgumentException(it) }
            val konto = Skr42Sub(code.trim(), name.trim(), kontoText(code.trim(), name.trim()), if (ust in STEUERSAETZE) ust else 0, isCustom = true)
            val e = eigene(store)
            // Eigene Konten hängen am festen Schlüssel des Nummernkreises, nicht an seiner heutigen Nummer.
            val key = schluessel(kreis)
            val neu = if (kreis.isCustom) e.copy(nummernkreise = e.nummernkreise.map { if (it.code == key) it.copy(subCategories = it.subCategories + konto) else it })
                      else e.copy(konten = e.konten + EigenesKonto(key, konto))
            schreiben(store, neu, null, now)
            konto
        }

    /** Ergebnis einer Änderung: wie viele Buchungen angepasst wurden und die Nummer danach. */
    data class Geaendert(val buchungen: Int, val code: String)

    /** Was eine Änderung bewirken würde (für die Rückfrage): Fehler, betroffene Buchungen, Konten mit neuer Nummer. */
    data class Vorschau(val fehler: String?, val buchungen: Int, val konten: Int)

    fun vorschau(
        store: DocumentStore, konto: Boolean, code: String, nummer: String? = null, name: String? = null, ust: Int? = null, ausgeblendet: Boolean? = null,
    ): Vorschau {
        val vorher = wirksam(store)
        val plan = planeAenderung(vorher, anpassungen(store), konto, code, nummer, name, ust, ausgeblendet)
        val a = plan.anpassungen ?: return Vorschau(plan.fehler, 0, 0)
        val nachher = wirksam(Skr42.standard, eigene(store), a)
        val neu = nachher.flatMap { it.subCategories }.associate { schluessel(it) to it.code }
        val konten = vorher.flatMap { it.subCategories }.count { neu[schluessel(it)] != it.code }
        return Vorschau(null, buchungenAngleichen(store.all("transactions"), vorher, nachher).size, konten)
    }

    /**
     * Ändert ein Konto oder einen Nummernkreis, gegeben über die heutige Nummer (null = unverändert). Neue Nummern und
     * Bezeichnungen gehen auf alle Buchungen über (auch beim Zurücksetzen).
     */
    fun aendern(
        store: DocumentStore, konto: Boolean, code: String, nummer: String? = null, name: String? = null, ust: Int? = null,
        ausgeblendet: Boolean? = null, now: ZonedDateTime = ZonedDateTime.now(),
    ): Geaendert = store.transaction {
        val vorher = wirksam(store)
        val plan = planeAenderung(vorher, anpassungen(store), konto, code, nummer, name, ust, ausgeblendet)
        val a = plan.anpassungen ?: throw IllegalArgumentException(plan.fehler)
        val key = if (konto) schluessel(vorher.flatMap { it.subCategories }.first { it.code == code }) else schluessel(vorher.first { it.code == code })
        schreiben(store, null, a, now)
        val nachher = wirksam(store)
        val geaendert = buchungenAngleichen(store.all("transactions"), vorher, nachher)
        for (b in geaendert) {
            val id = t(b, "id") ?: continue
            store.put("transactions", id, JsonObject(LinkedHashMap<String, JsonElement>(b).apply { put("updatedAt", JsonPrimitive(Zeit.stempel(now))) }))
        }
        val danach = if (konto) nachher.flatMap { it.subCategories }.firstOrNull { schluessel(it) == key }?.code else nachher.firstOrNull { schluessel(it) == key }?.code
        Geaendert(geaendert.size, danach ?: code)
    }

    /** Konto ändern: Nummer, Bezeichnung, Steuersatz-Vorgabe, ausgeblendet (null = unverändert). */
    fun kontoAendern(
        store: DocumentStore, code: String, name: String? = null, ust: Int? = null, ausgeblendet: Boolean? = null,
        now: ZonedDateTime = ZonedDateTime.now(), nummer: String? = null,
    ): Geaendert = aendern(store, true, code, nummer, name, ust, ausgeblendet, now)

    /** Nummernkreis ändern: Nummer (die Konten ziehen mit), Bezeichnung, ausgeblendet (null = unverändert). */
    fun nummernkreisAendern(
        store: DocumentStore, code: String, name: String? = null, ausgeblendet: Boolean? = null, now: ZonedDateTime = ZonedDateTime.now(),
        nummer: String? = null,
    ): Geaendert = aendern(store, false, code, nummer, name, null, ausgeblendet, now)

    /** Eigenes Konto löschen (heutige Nummer); nur, wenn keine Buchung es verwendet (sonst ausblenden). */
    fun eigenesKontoLoeschen(store: DocumentStore, code: String, now: ZonedDateTime = ZonedDateTime.now()) = store.transaction {
        val n = kontoVerwendungen(store.all("transactions"), code)
        if (n > 0) throw IllegalArgumentException("Das Konto $code wird in $n ${if (n == 1) "Buchung" else "Buchungen"} verwendet. Blenden Sie es stattdessen aus.")
        val heute = wirksam(store).flatMap { it.subCategories }.firstOrNull { it.code == code }
        if (heute != null && !heute.isCustom) throw IllegalArgumentException("Nur selbst angelegte Konten lassen sich löschen.")
        val key = heute?.let(::schluessel) ?: code
        val e = eigene(store)
        val neu = Eigene(
            e.nummernkreise.map { m -> if (m.subCategories.any { it.code == key }) m.copy(subCategories = m.subCategories.filter { it.code != key }) else m },
            e.konten.filter { it.konto.code != key },
        )
        schreiben(store, neu, anpassungen(store).let { it.copy(konten = it.konten - key) }, now)
    }

    /** Eigenen Nummernkreis löschen (heutige Nummer); nur, wenn keines seiner Konten in Buchungen vorkommt. */
    fun eigenenNummernkreisLoeschen(store: DocumentStore, code: String, now: ZonedDateTime = ZonedDateTime.now()) = store.transaction {
        val heute = wirksam(store).firstOrNull { it.code == code }
        val key = heute?.let(::schluessel) ?: code
        val e = eigene(store)
        val kreis = e.nummernkreise.firstOrNull { it.code == key }
        if (kreis == null || heute == null) throw IllegalArgumentException("Nur selbst angelegte Nummernkreise lassen sich löschen.")
        val buchungen = store.all("transactions")
        val n = heute.subCategories.sumOf { kontoVerwendungen(buchungen, it.code) }
        if (n > 0) throw IllegalArgumentException("Der Nummernkreis $code wird in Buchungen verwendet. Blenden Sie ihn stattdessen aus.")
        val a = anpassungen(store)
        schreiben(
            store,
            // eigene Konten, die in diesem Nummernkreis hingen, gehen mit
            Eigene(e.nummernkreise.filter { it.code != key }, e.konten.filter { it.nummernkreis != key && it.nummernkreis != kreis.id }),
            Anpassungen(a.nummernkreise - key, a.konten - heute.subCategories.map(::schluessel).toSet()),
            now,
        )
    }
}
