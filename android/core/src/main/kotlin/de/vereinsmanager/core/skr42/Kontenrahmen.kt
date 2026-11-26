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
 * Vereins (Bezeichnung, Steuersatz-Vorgabe, ausgeblendet).
 *
 * Gleiche Regeln und Texte wie am Desktop (`src/utils/kontenrahmen.ts`), mit denselben Prüffällen.
 *
 * Gespeichert im Dokument `settings/main`, in denselben Feldern wie am Desktop; damit reist beides in jeder
 * Datensicherung mit (BACKUP_FORMAT.md, Abschnitt 3):
 *  - `customSkr42Accounts`: eigene Nummernkreise und Konten
 *  - `skr42Anpassungen`: `{ nummernkreise: { "<Nummer>": { name?, ausgeblendet? } },
 *                           konten: { "<Nummer>": { name?, vatRateDefault?, ausgeblendet? } } }`
 *
 * Entscheidungen Johannes, 26.11.2026: änderbar sind Bezeichnung, Steuersatz-Vorgabe und „ausgeblendet“, auch bei den
 * Standardkonten; eine neue Bezeichnung geht auf alle Buchungen des Kontos über; Nummernkreise und Konten stehen immer
 * aufsteigend nach der Nummer.
 */
object Kontenrahmen {
    const val FELD_EIGENE = "customSkr42Accounts"
    const val FELD_ANPASSUNGEN = "skr42Anpassungen"
    private val STEUERSAETZE = setOf(0, 7, 19)

    data class NummernkreisAnpassung(val name: String? = null, val ausgeblendet: Boolean = false) {
        val leer get() = name == null && !ausgeblendet
    }
    data class KontoAnpassung(val name: String? = null, val vatRateDefault: Int? = null, val ausgeblendet: Boolean = false) {
        val leer get() = name == null && vatRateDefault == null && !ausgeblendet
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
            ).takeIf { !it.leer }?.let { code to it }
        }.toMap()
        val konten = (o["konten"] as? JsonObject).orEmpty().mapNotNull { (code, e) ->
            val a = e as? JsonObject ?: return@mapNotNull null
            KontoAnpassung(
                name = t(a, "name")?.trim()?.takeIf { it.isNotEmpty() },
                vatRateDefault = (a["vatRateDefault"] as? JsonPrimitive)?.intOrNull?.takeIf { it in STEUERSAETZE },
                ausgeblendet = (a["ausgeblendet"] as? JsonPrimitive)?.booleanOrNull == true,
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
                n.name?.let { put("name", JsonPrimitive(it)) }
                if (n.ausgeblendet) put("ausgeblendet", JsonPrimitive(true))
            })
        }),
        "konten" to JsonObject(a.konten.mapValues { (_, k) ->
            JsonObject(buildMap {
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
            m.copy(
                name = if (umbenannt) na!!.name!! else m.name,
                originalName = if (umbenannt) m.name else null,
                ausgeblendet = na?.ausgeblendet == true,
                subCategories = m.subCategories.map { s ->
                    val k = a.konten[s.code] ?: return@map s
                    val bisher = kontoBezeichnung(s)
                    val neuerName = k.name?.takeIf { it != bisher }
                    val neueUst = k.vatRateDefault?.takeIf { it != s.vatRateDefault }
                    s.copy(
                        name = neuerName ?: s.name,
                        label = neuerName?.let { kontoText(s.code, it) } ?: s.label,
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

    /** Fehlermeldung zu einer neuen Nummer, sonst null. Konten- und Nummernkreisnummern sind je für sich eindeutig. */
    fun pruefeNeueNummer(code: String, nummernkreis: Boolean, struktur: List<Skr42Main>): String? {
        val c = code.trim()
        if (c.isEmpty()) return "Bitte eine Nummer eingeben."
        if (!Regex("^\\d{4,6}$").matches(c)) return "Die Nummer besteht aus 4 bis 6 Ziffern."
        if (nummernkreis) struktur.firstOrNull { it.code == c }?.let { return "Den Nummernkreis $c gibt es schon (${it.name})." }
        else for (m in struktur) m.subCategories.firstOrNull { it.code == c }?.let { return "Das Konto $c gibt es schon (${kontoBezeichnung(it)})." }
        return null
    }

    /** Trägt eine Anpassung ein (null = unverändert lassen). Was dem Original entspricht, fällt weg. */
    fun mitKontoAnpassung(
        a: Anpassungen, code: String, name: String? = null, ust: Int? = null, ausgeblendet: Boolean? = null,
        originalName: String, originalUst: Int,
    ): Anpassungen {
        val alt = a.konten[code] ?: KontoAnpassung()
        val n = (name ?: alt.name)?.trim()?.takeIf { it.isNotEmpty() && it != originalName }
        val u = (ust ?: alt.vatRateDefault)?.takeIf { it != originalUst }
        val e = KontoAnpassung(n, u, ausgeblendet ?: alt.ausgeblendet)
        return a.copy(konten = if (e.leer) a.konten - code else a.konten + (code to e))
    }

    fun mitNummernkreisAnpassung(a: Anpassungen, code: String, name: String? = null, ausgeblendet: Boolean? = null, originalName: String): Anpassungen {
        val alt = a.nummernkreise[code] ?: NummernkreisAnpassung()
        val n = (name ?: alt.name)?.trim()?.takeIf { it.isNotEmpty() && it != originalName }
        val e = NummernkreisAnpassung(n, ausgeblendet ?: alt.ausgeblendet)
        return a.copy(nummernkreise = if (e.leer) a.nummernkreise - code else a.nummernkreise + (code to e))
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

    /** Neue Bezeichnung in die Buchungen übernehmen; liefert nur die geänderten Buchungen (neue Objekte). */
    fun buchungenUmbenennen(buchungen: List<JsonObject>, konto: Boolean, code: String, name: String): List<JsonObject> {
        val text = kontoText(code, name)
        fun setze(o: JsonObject): JsonObject {
            if (konto && gehoertZuKonto(o, code) && (t(o, "subCategory") != text || t(o, "category") != text)) {
                return JsonObject(LinkedHashMap<String, JsonElement>(o).apply { put("subCategory", JsonPrimitive(text)); put("category", JsonPrimitive(text)) })
            }
            if (!konto && gehoertZuNummernkreis(o, code) && t(o, "mainCategory") != text) {
                return JsonObject(LinkedHashMap<String, JsonElement>(o).apply { put("mainCategory", JsonPrimitive(text)) })
            }
            return o
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
            val neu = if (kreis.isCustom) e.copy(nummernkreise = e.nummernkreise.map { if (it.code == kreis.code) it.copy(subCategories = it.subCategories + konto) else it })
                      else e.copy(konten = e.konten + EigenesKonto(kreis.code, konto))
            schreiben(store, neu, null, now)
            konto
        }

    /** Ergebnis einer Änderung: wie viele Buchungen die neue Bezeichnung bekommen haben. */
    data class Geaendert(val buchungen: Int)

    /** Konto ändern: Bezeichnung, Steuersatz-Vorgabe, ausgeblendet (null = unverändert). */
    fun kontoAendern(
        store: DocumentStore, code: String, name: String? = null, ust: Int? = null, ausgeblendet: Boolean? = null,
        now: ZonedDateTime = ZonedDateTime.now(),
    ): Geaendert = store.transaction {
        val standardKonto = Skr42.standard.flatMap { it.subCategories }.firstOrNull { it.code == code }
        val e = eigene(store)
        val eigenesKonto = e.nummernkreise.flatMap { it.subCategories }.firstOrNull { it.code == code } ?: e.konten.firstOrNull { it.konto.code == code }?.konto
        val original = standardKonto ?: eigenesKonto ?: throw IllegalArgumentException("Das Konto $code gibt es nicht.")
        name?.let { n -> pruefeBezeichnung(n)?.let { throw IllegalArgumentException(it) } }
        if (ust != null && ust !in STEUERSAETZE) throw IllegalArgumentException("Steuersatz $ust gibt es nicht.")
        val vorher = wirksam(store).flatMap { it.subCategories }.first { it.code == code }
        val a = mitKontoAnpassung(anpassungen(store), code, name, ust, ausgeblendet, kontoBezeichnung(original), original.vatRateDefault)
        schreiben(store, null, a, now)
        val nachher = wirksam(store).flatMap { it.subCategories }.first { it.code == code }
        var n = 0
        if (kontoBezeichnung(nachher) != kontoBezeichnung(vorher)) n = umbenennenInBuchungen(store, true, code, kontoBezeichnung(nachher), now)
        Geaendert(n)
    }

    fun nummernkreisAendern(store: DocumentStore, code: String, name: String? = null, ausgeblendet: Boolean? = null, now: ZonedDateTime = ZonedDateTime.now()): Geaendert =
        store.transaction {
            val original = Skr42.standard.firstOrNull { it.code == code } ?: eigene(store).nummernkreise.firstOrNull { it.code == code }
                ?: throw IllegalArgumentException("Den Nummernkreis $code gibt es nicht.")
            name?.let { n -> pruefeBezeichnung(n)?.let { throw IllegalArgumentException(it) } }
            val vorher = wirksam(store).first { it.code == code }
            val a = mitNummernkreisAnpassung(anpassungen(store), code, name, ausgeblendet, original.name)
            schreiben(store, null, a, now)
            val nachher = wirksam(store).first { it.code == code }
            var n = 0
            if (nachher.name != vorher.name) n = umbenennenInBuchungen(store, false, code, nachher.name, now)
            Geaendert(n)
        }

    private fun umbenennenInBuchungen(store: DocumentStore, konto: Boolean, code: String, name: String, now: ZonedDateTime): Int {
        val geaendert = buchungenUmbenennen(store.all("transactions"), konto, code, name)
        for (b in geaendert) {
            val id = t(b, "id") ?: continue
            store.put("transactions", id, JsonObject(LinkedHashMap<String, JsonElement>(b).apply { put("updatedAt", JsonPrimitive(Zeit.stempel(now))) }))
        }
        return geaendert.size
    }

    /** Eigenes Konto löschen; nur, wenn keine Buchung es verwendet (sonst ausblenden). */
    fun eigenesKontoLoeschen(store: DocumentStore, code: String, now: ZonedDateTime = ZonedDateTime.now()) = store.transaction {
        val n = kontoVerwendungen(store.all("transactions"), code)
        if (n > 0) throw IllegalArgumentException("Das Konto $code wird in $n ${if (n == 1) "Buchung" else "Buchungen"} verwendet. Blenden Sie es stattdessen aus.")
        val e = eigene(store)
        val neu = Eigene(
            e.nummernkreise.mapNotNull { m -> if (m.subCategories.any { it.code == code }) m.copy(subCategories = m.subCategories.filter { it.code != code }) else m },
            e.konten.filter { it.konto.code != code },
        )
        schreiben(store, neu, anpassungen(store).let { it.copy(konten = it.konten - code) }, now)
    }

    /** Eigenen Nummernkreis löschen; nur, wenn keines seiner Konten in Buchungen vorkommt. */
    fun eigenenNummernkreisLoeschen(store: DocumentStore, code: String, now: ZonedDateTime = ZonedDateTime.now()) = store.transaction {
        val e = eigene(store)
        val kreis = e.nummernkreise.firstOrNull { it.code == code } ?: throw IllegalArgumentException("Nur selbst angelegte Nummernkreise lassen sich löschen.")
        val buchungen = store.all("transactions")
        val n = kreis.subCategories.sumOf { kontoVerwendungen(buchungen, it.code) }
        if (n > 0) throw IllegalArgumentException("Der Nummernkreis $code wird in Buchungen verwendet. Blenden Sie ihn stattdessen aus.")
        schreiben(store, e.copy(nummernkreise = e.nummernkreise.filter { it.code != code }), anpassungen(store).let { it.copy(nummernkreise = it.nummernkreise - code) }, now)
    }
}
