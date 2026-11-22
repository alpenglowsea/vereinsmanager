package de.vereinsmanager.core.inventory

import de.vereinsmanager.core.export.Csv
import de.vereinsmanager.core.export.Export
import de.vereinsmanager.core.export.PdfTabelle
import de.vereinsmanager.core.finance.BuchungRegeln
import de.vereinsmanager.core.members.MemberMaterial
import de.vereinsmanager.core.members.MemberRules
import de.vereinsmanager.core.members.Zeit
import de.vereinsmanager.core.store.DocumentStore
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.doubleOrNull
import java.math.BigDecimal
import java.math.RoundingMode
import java.text.Collator
import java.text.NumberFormat
import java.time.LocalDate
import java.time.ZonedDateTime
import java.util.Locale

/** Ein Gegenstand im Inventar (Bereich "inventory"); [raw] ist das gespeicherte Dokument mit allen, auch unbekannten, Feldern. */
data class Artikel(
    val raw: JsonObject,
    val id: String,
    val nummer: String,
    val name: String,
    val art: String,
    val sparte: String,
    val menge: Int,
    val einheit: String,
    val standort: String,
    val zustand: String,
    val kaufdatum: String,
    val kaufpreis: BigDecimal?,
    val zeitwert: BigDecimal?,
    val lieferant: String,
    val zustaendig: String,
    val einsatz: String,
    val seriennummer: String,
    val notizen: String,
    val foto: String,
    val letztePruefung: String,
    val naechstePruefung: String,
    /** „Ausgemustert am“ (JJJJ-MM-TT), Feld `retiredAt`; nur bei Zustand „discarded“ (R4, wie Desktop). */
    val ausgemustertAm: String = "",
) {
    val ausgemustert get() = zustand == "discarded"

    /** Wert je Stück: Zeitwert, sonst Anschaffungspreis; ein Zeitwert von 0 € ist ein Wert und gilt nicht als „fehlt“. */
    val stueckwert: BigDecimal? get() = zeitwert ?: kaufpreis

    /** Wert aller Stücke; ohne Angabe 0. */
    val wert: BigDecimal get() = (stueckwert ?: BigDecimal.ZERO).multiply(BigDecimal(menge))

    companion object {
        private fun t(o: JsonObject, k: String) = (o[k] as? JsonPrimitive)?.takeIf { it !is JsonNull }?.contentOrNull ?: ""
        private fun z(o: JsonObject, k: String) = (o[k] as? JsonPrimitive)?.takeIf { it !is JsonNull }?.contentOrNull?.toBigDecimalOrNull()

        fun from(o: JsonObject): Artikel {
            val m = (o["quantity"] as? JsonPrimitive)?.let { it.contentOrNull?.toLongOrNull() ?: it.doubleOrNull?.toLong() } ?: 1L
            return Artikel(
                raw = o, id = t(o, "id"), nummer = t(o, "itemNumber"), name = t(o, "name").ifEmpty { "Gegenstand" },
                art = t(o, "category").ifEmpty { "other" }, sparte = t(o, "department").ifEmpty { "Gesamtverein" },
                menge = m.toInt().coerceAtLeast(1), einheit = t(o, "unit").ifEmpty { "Stk." }, standort = t(o, "location"),
                zustand = t(o, "condition").ifEmpty { "good" }, kaufdatum = t(o, "purchaseDate"), kaufpreis = z(o, "purchasePrice"),
                zeitwert = z(o, "currentValue"), lieferant = t(o, "supplier"), zustaendig = t(o, "responsiblePerson"),
                einsatz = t(o, "assignedTo"), seriennummer = t(o, "serialNumber"), notizen = t(o, "notes"), foto = t(o, "photoUrl"),
                letztePruefung = t(o, "lastCheckedDate"), naechstePruefung = t(o, "nextInspectionDate"),
                ausgemustertAm = t(o, "retiredAt"),
            )
        }
    }
}

/** Eingabefelder der Inventar-Maske. [id] ist null bei einem neuen Gegenstand. */
data class ArtikelForm(
    val id: String? = null,
    val art: String = "sports_equipment",
    val name: String = "",
    val nummer: String = "",
    val menge: String = "1",
    val einheit: String = "Stk.",
    val zustand: String = "good",
    val sparte: String = "Gesamtverein",
    val standort: String = "",
    val zustaendig: String = "",
    val einsatz: String = "",
    val seriennummer: String = "",
    val kaufdatum: String = "",
    val kaufpreis: String = "",
    val zeitwert: String = "",
    val lieferant: String = "",
    val letztePruefung: String = "",
    val naechstePruefung: String = "",
    val notizen: String = "",
    /** Foto als Data-URL (JPEG), leer = keines. */
    val foto: String = "",
    /** „Ausgemustert am“; nur bei Zustand „discarded“ beachtet. Leer = heute bzw. bisheriges Datum. */
    val ausgemustertAm: String = "",
) {
    companion object {
        fun von(a: Artikel) = ArtikelForm(
            a.id, a.art, a.name, a.nummer, a.menge.toString(), a.einheit, a.zustand, a.sparte, a.standort, a.zustaendig, a.einsatz,
            a.seriennummer, a.kaufdatum, a.kaufpreis?.let { BuchungRegeln.betragText(it) } ?: "", a.zeitwert?.let { BuchungRegeln.betragText(it) } ?: "",
            a.lieferant, a.letztePruefung, a.naechstePruefung, a.notizen, a.foto, a.ausgemustertAm,
        )
    }
}

/** Mehrere Gegenstände auf einmal ändern. null = unverändert; "" bei einem freiwilligen Feld = Feld leeren. */
data class SammelAenderung(
    val sparte: String? = null,
    val art: String? = null,
    val zustand: String? = null,
    /** Der Standort darf nicht leer gesetzt werden. */
    val standort: String? = null,
    val zustaendig: String? = null,
    val einsatz: String? = null,
    val lieferant: String? = null,
    val letztePruefung: String? = null,
    val naechstePruefung: String? = null,
    val notizText: String? = null,
    val notizAnhaengen: Boolean = true,
) {
    val leer get() = listOf(sparte, art, zustand, standort, zustaendig, einsatz, lieferant, letztePruefung, naechstePruefung, notizText).all { it == null }
}

data class LoeschErgebnis(val geloescht: Int, /** Name und Zahl der noch ausgegebenen Stücke der übersprungenen Gegenstände. */ val gesperrt: List<Pair<String, Int>>)

data class InventarFilter(
    val suche: String = "",
    val sparte: String? = null,
    val art: String? = null,
    val zustand: String? = null,
    /** Nur Gegenstände, deren Prüfung überfällig ist oder in den nächsten 30 Tagen ansteht. */
    val nurPruefung: Boolean = false,
)

enum class InventarSort(val text: String) { NAME("Bezeichnung"), NUMMER("Inventar-Nr."), STANDORT("Standort"), ZUSTAND("Zustand"), WERT("Wert") }

data class InventarKennzahlen(
    val positionen: Int, val einheiten: Int, val wert: BigDecimal, val sparten: Int, val reparatur: Int, val ueberfaellig: Int,
)

object Inventar {
    const val AREA = MemberMaterial.INVENTORY
    const val PRUEFTAGE = 30L
    const val FOTO_MAX_ZEICHEN = 1_500_000

    val ARTEN: Map<String, String> = linkedMapOf(
        "sports_equipment" to "Sportgerät", "apparel" to "Bekleidung / Trikotsätze", "accessories" to "Zubehör & Trainingshilfen",
        "facility" to "Platz- & Hallenpflege", "electronics" to "Elektronik & IT / Audio", "medical" to "Erste Hilfe & Medizin",
        "furniture" to "Vereinsheim & Mobiliar", "other" to "Sonstiges Inventar",
    )
    val ARTEN_KURZ: Map<String, String> = linkedMapOf(
        "sports_equipment" to "Sportgerät", "apparel" to "Bekleidung", "accessories" to "Zubehör", "facility" to "Platzpflege",
        "electronics" to "Elektronik", "medical" to "Erste Hilfe", "furniture" to "Mobiliar", "other" to "Sonstiges",
    )
    val ZUSTAENDE: Map<String, String> = linkedMapOf(
        "new" to "Neuwertig", "good" to "Guter Zustand", "used" to "Gebraucht / Abgenutzt", "damaged" to "Beschädigt / Reparaturbedarf",
        "in_repair" to "In Reparatur / Wartung", "discarded" to "Ausgemustert / Entsorgt",
    )
    val EINHEITEN = listOf("Stk.", "Set", "Paar", "Kiste / Koffer", "Paket (10er)", "Rolle", "Flasche / Kanister", "Meter")
    private val ZUSTAND_REIHE = ZUSTAENDE.keys.withIndex().associate { it.value to it.index }

    private fun t(o: JsonObject, k: String) = (o[k] as? JsonPrimitive)?.takeIf { it !is JsonNull }?.contentOrNull ?: ""
    private val kollator: Collator = Collator.getInstance(Locale.GERMANY)

    fun alle(store: DocumentStore): List<Artikel> = store.all(AREA).map { Artikel.from(it) }
    fun artikel(store: DocumentStore, id: String): Artikel? = store.get(AREA, id)?.let { Artikel.from(it) }

    /** Wie viele Stücke je Gegenstand gerade an Mitglieder ausgegeben (nicht zurückgegeben) sind. */
    fun ausgegeben(store: DocumentStore): Map<String, Int> =
        MemberMaterial.alle(store).filter { !it.returned }.groupBy { it.itemId }.mapValues { (_, l) -> l.sumOf { it.quantity } }

    // ---------- Anlegen und Ändern ----------

    /** Vorschlag für die nächste Inventarnummer im Schema, das der Verein schon benutzt (INV-FB-001 → INV-FB-002). */
    fun naechsteNummer(vorhandene: List<Artikel>): String {
        val nummern = vorhandene.map { it.nummer }.filter { it.isNotBlank() }
        return if (nummern.isEmpty()) "INV-001" else MemberRules.naechsteNummer(nummern)
    }

    fun neu(vorhandene: List<Artikel>, sparte: String = "Gesamtverein") = ArtikelForm(nummer = naechsteNummer(vorhandene), sparte = sparte)

    private fun datumOk(s: String) = s.isEmpty() || runCatching { LocalDate.parse(s) }.isSuccess

    /**
     * „Ausgemustert am“ (R4, gleiche Regel wie Desktop `ausmusterungsDatum`): nicht ausgemustert → kein Datum;
     * eingegebenes Datum gilt; sonst bleibt ein vorhandenes Datum eines schon ausgemusterten Gegenstands; sonst heute.
     * Das Datum bestimmt, in welches Jahresarchiv ein Foto des Gegenstands gehört.
     */
    fun ausgemustertAm(altZustand: String?, altDatum: String?, neuerZustand: String, eingabe: String, heute: LocalDate): String? {
        if (neuerZustand != "discarded") return null
        eingabe.trim().takeIf { it.isNotEmpty() }?.let { return it }
        if (altZustand == "discarded" && !altDatum.isNullOrBlank()) return altDatum
        return heute.toString()
    }

    fun pruefen(f: ArtikelForm, vorhandene: List<Artikel>, heute: LocalDate = LocalDate.now()): Map<String, String> {
        val e = LinkedHashMap<String, String>()
        if (f.name.isBlank()) e["name"] = "Bitte eine Bezeichnung eingeben."
        val n = f.nummer.trim()
        if (n.isEmpty()) e["nummer"] = "Bitte eine Inventarnummer eingeben."
        else if (vorhandene.any { it.id != f.id && it.nummer.trim().equals(n, ignoreCase = true) }) e["nummer"] = "Diese Inventarnummer gibt es schon."
        val m = f.menge.trim().toIntOrNull()
        if (m == null || m < 1) e["menge"] = "Menge: ganze Zahl ab 1."
        if (f.kaufpreis.isNotBlank() && BuchungRegeln.parseBetrag(f.kaufpreis) == null) e["kaufpreis"] = "Bitte einen Betrag eingeben, z. B. 1.234,50."
        if (f.zeitwert.isNotBlank() && BuchungRegeln.parseBetrag(f.zeitwert) == null) e["zeitwert"] = "Bitte einen Betrag eingeben, z. B. 1.234,50."
        if (!datumOk(f.kaufdatum)) e["kaufdatum"] = "Kaufdatum ist ungültig."
        if (!datumOk(f.letztePruefung)) e["letztePruefung"] = "Datum ist ungültig."
        if (!datumOk(f.naechstePruefung)) e["naechstePruefung"] = "Datum ist ungültig."
        if (f.art !in ARTEN) e["art"] = "Bitte eine Art wählen."
        if (f.zustand !in ZUSTAENDE) e["zustand"] = "Bitte einen Zustand wählen."
        if (f.foto.isNotEmpty() && (!f.foto.startsWith("data:image/") || f.foto.length > FOTO_MAX_ZEICHEN)) e["foto"] = "Das Foto ist ungültig oder zu groß."
        val am = f.ausgemustertAm.trim()
        if (f.zustand == "discarded" && am.isNotEmpty()) {
            val d = runCatching { LocalDate.parse(am) }.getOrNull()
            val kauf = runCatching { LocalDate.parse(f.kaufdatum.trim()) }.getOrNull()
            when {
                d == null -> e["ausgemustertAm"] = "Datum ist ungültig."
                d.isAfter(heute) -> e["ausgemustertAm"] = "Das Datum liegt in der Zukunft."
                kauf != null && d.isBefore(kauf) -> e["ausgemustertAm"] = "Ausgemustert vor dem Kaufdatum?"
            }
        }
        return e
    }

    private fun zahl(v: BigDecimal): JsonElement {
        val k = v.stripTrailingZeros()
        return if (k.scale() <= 0) JsonPrimitive(k.toBigInteger().toLong()) else JsonPrimitive(k.toDouble())
    }

    private fun setzen(m: MutableMap<String, JsonElement>, key: String, wert: String) {
        val w = wert.trim()
        if (w.isEmpty()) m.remove(key) else m[key] = JsonPrimitive(w)
    }

    fun neueId(now: ZonedDateTime = ZonedDateTime.now()) = "inv-${now.toInstant().toEpochMilli()}-${Zeit.zufall(5)}"

    /** Prüft und speichert; unbekannte Felder des bisherigen Dokuments bleiben erhalten. */
    fun speichern(store: DocumentStore, f: ArtikelForm, now: ZonedDateTime = ZonedDateTime.now()): JsonObject = store.transaction {
        val fehler = pruefen(f, alle(store), now.toLocalDate())
        require(fehler.isEmpty()) { fehler.values.first() }
        val base = f.id?.let { store.get(AREA, it) }
        require(f.id == null || base != null) { "Den Gegenstand gibt es nicht mehr." }
        val stamp = Zeit.stempel(now)
        val id = f.id ?: neueId(now)
        val m = LinkedHashMap<String, JsonElement>(base ?: emptyMap())
        m["id"] = JsonPrimitive(id)
        m["itemNumber"] = JsonPrimitive(f.nummer.trim())
        m["name"] = JsonPrimitive(f.name.trim())
        m["category"] = JsonPrimitive(f.art)
        m["department"] = JsonPrimitive(f.sparte.ifBlank { "Gesamtverein" })
        m["quantity"] = JsonPrimitive(f.menge.trim().toInt())
        m["unit"] = JsonPrimitive(f.einheit.ifBlank { "Stk." })
        m["location"] = JsonPrimitive(f.standort.trim())
        m["condition"] = JsonPrimitive(f.zustand)
        ausgemustertAm(base?.let { t(it, "condition") }, base?.let { t(it, "retiredAt") }, f.zustand, f.ausgemustertAm, now.toLocalDate())
            ?.let { m["retiredAt"] = JsonPrimitive(it) } ?: m.remove("retiredAt")
        setzen(m, "purchaseDate", f.kaufdatum)
        BuchungRegeln.parseBetrag(f.kaufpreis)?.let { m["purchasePrice"] = zahl(it) } ?: m.remove("purchasePrice")
        BuchungRegeln.parseBetrag(f.zeitwert)?.let { m["currentValue"] = zahl(it) } ?: m.remove("currentValue")
        setzen(m, "supplier", f.lieferant)
        setzen(m, "responsiblePerson", f.zustaendig)
        setzen(m, "assignedTo", f.einsatz)
        setzen(m, "serialNumber", f.seriennummer)
        setzen(m, "notes", f.notizen)
        setzen(m, "lastCheckedDate", f.letztePruefung)
        setzen(m, "nextInspectionDate", f.naechstePruefung)
        if (f.foto.isEmpty()) m.remove("photoUrl") else m["photoUrl"] = JsonPrimitive(f.foto)
        if (base == null) m["createdAt"] = JsonPrimitive(stamp)
        m["updatedAt"] = JsonPrimitive(stamp)
        JsonObject(m).also { store.put(AREA, id, it) }
    }

    /** „Heute geprüft“: setzt nur das Datum der letzten Prüfung. */
    fun geprueft(store: DocumentStore, id: String, heute: LocalDate = LocalDate.now(), now: ZonedDateTime = ZonedDateTime.now()): JsonObject =
        store.transaction {
            val b = store.get(AREA, id) ?: throw IllegalArgumentException("Den Gegenstand gibt es nicht mehr.")
            val m = LinkedHashMap<String, JsonElement>(b)
            m["lastCheckedDate"] = JsonPrimitive(heute.toString())
            m["updatedAt"] = JsonPrimitive(Zeit.stempel(now))
            JsonObject(m).also { store.put(AREA, id, it) }
        }

    // ---------- Löschen und Sammelbearbeitung ----------

    /** Löscht die Gegenstände, die nirgends mehr ausgegeben sind; die übrigen bleiben und werden im Ergebnis genannt. */
    fun loeschen(store: DocumentStore, ids: Collection<String>): LoeschErgebnis = store.transaction {
        val aus = ausgegeben(store)
        var n = 0
        val gesperrt = ArrayList<Pair<String, Int>>()
        for (id in ids.toSet()) {
            val a = store.get(AREA, id)?.let { Artikel.from(it) } ?: continue
            val draussen = aus[id] ?: 0
            if (draussen > 0) gesperrt += a.name to draussen else { store.delete(AREA, id); n++ }
        }
        LoeschErgebnis(n, gesperrt)
    }

    fun pruefenSammel(a: SammelAenderung): String? {
        if (a.leer) return "Bitte mindestens eine Änderung wählen."
        if (a.standort != null && a.standort.isBlank()) return "Der Standort darf nicht leer sein."
        if (a.sparte != null && a.sparte.isBlank()) return "Bitte eine Sparte wählen."
        if (a.art != null && a.art !in ARTEN) return "Bitte eine Art wählen."
        if (a.zustand != null && a.zustand !in ZUSTAENDE) return "Bitte einen Zustand wählen."
        if (a.letztePruefung?.let { !datumOk(it) } == true) return "Das Datum der letzten Prüfung ist ungültig."
        if (a.naechstePruefung?.let { !datumOk(it) } == true) return "Das Datum der nächsten Prüfung ist ungültig."
        if (a.notizText != null && a.notizText.isBlank()) return "Bitte eine Notiz eingeben oder die Änderung abwählen."
        return null
    }

    /** Wendet die Änderung an; zählt nur Gegenstände, die sich wirklich geändert haben. */
    fun sammelAendern(store: DocumentStore, ids: Collection<String>, a: SammelAenderung, now: ZonedDateTime = ZonedDateTime.now()): Int = store.transaction {
        pruefenSammel(a)?.let { throw IllegalArgumentException(it) }
        val stamp = Zeit.stempel(now)
        var n = 0
        for (id in ids.toSet()) {
            val b = store.get(AREA, id) ?: continue
            val m = LinkedHashMap<String, JsonElement>(b)
            a.sparte?.let { m["department"] = JsonPrimitive(it.trim()) }
            a.art?.let { m["category"] = JsonPrimitive(it) }
            a.zustand?.let {
                m["condition"] = JsonPrimitive(it)
                ausgemustertAm(t(b, "condition"), t(b, "retiredAt"), it, "", now.toLocalDate())
                    ?.let { d -> m["retiredAt"] = JsonPrimitive(d) } ?: m.remove("retiredAt")
            }
            a.standort?.let { m["location"] = JsonPrimitive(it.trim()) }
            a.zustaendig?.let { setzen(m, "responsiblePerson", it) }
            a.einsatz?.let { setzen(m, "assignedTo", it) }
            a.lieferant?.let { setzen(m, "supplier", it) }
            a.letztePruefung?.let { setzen(m, "lastCheckedDate", it) }
            a.naechstePruefung?.let { setzen(m, "nextInspectionDate", it) }
            a.notizText?.let { neu ->
                val alt = t(b, "notes")
                m["notes"] = JsonPrimitive(if (a.notizAnhaengen && alt.isNotEmpty()) "$alt\n${neu.trim()}" else neu.trim())
            }
            if (JsonObject(m) != b) {
                m["updatedAt"] = JsonPrimitive(stamp)
                store.put(AREA, id, JsonObject(m))
                n++
            }
        }
        n
    }

    // ---------- Anzeige: Prüfung, Kennzahlen, Filter ----------

    private fun tag(s: String): LocalDate? = runCatching { LocalDate.parse(s) }.getOrNull()

    fun ueberfaellig(a: Artikel, heute: LocalDate): Boolean = !a.ausgemustert && tag(a.naechstePruefung)?.isBefore(heute) == true
    fun pruefungBald(a: Artikel, heute: LocalDate): Boolean =
        !a.ausgemustert && tag(a.naechstePruefung)?.let { !it.isAfter(heute.plusDays(PRUEFTAGE)) } == true
    fun reparatur(a: Artikel) = a.zustand == "damaged" || a.zustand == "in_repair"

    /** Kennzahlen über den Bestand; Ausgemustertes zählt nirgends mit. */
    fun kennzahlen(alle: List<Artikel>, heute: LocalDate = LocalDate.now()): InventarKennzahlen {
        val bestand = alle.filter { !it.ausgemustert }
        return InventarKennzahlen(
            bestand.size, bestand.sumOf { it.menge }, bestand.fold(BigDecimal.ZERO) { s, a -> s + a.wert },
            bestand.map { it.sparte }.toSet().size, bestand.count { reparatur(it) }, bestand.count { ueberfaellig(it, heute) },
        )
    }

    fun sparten(alle: List<Artikel>, bekannte: List<String>): List<String> =
        (listOf("Gesamtverein") + bekannte + alle.map { it.sparte }).filter { it.isNotBlank() }.distinct()

    fun filtern(alle: List<Artikel>, f: InventarFilter, sort: InventarSort = InventarSort.NAME, aufsteigend: Boolean = true, heute: LocalDate = LocalDate.now()): List<Artikel> {
        val q = f.suche.trim().lowercase(Locale.GERMANY)
        val l = alle.filter { a ->
            (f.zustand == "discarded" || !a.ausgemustert) &&
                (f.sparte == null || a.sparte == f.sparte) && (f.art == null || a.art == f.art) &&
                (f.zustand == null || a.zustand == f.zustand) &&
                (!f.nurPruefung || pruefungBald(a, heute)) &&
                (q.isEmpty() || listOf(a.name, a.nummer, a.standort, a.zustaendig, a.einsatz, a.lieferant, a.seriennummer, a.notizen)
                    .any { it.lowercase(Locale.GERMANY).contains(q) })
        }
        val c: Comparator<Artikel> = when (sort) {
            InventarSort.NAME -> compareBy(kollator) { it.name }
            InventarSort.NUMMER -> compareBy(kollator) { it.nummer }
            InventarSort.STANDORT -> compareBy(kollator) { it.standort }
            InventarSort.ZUSTAND -> compareBy { ZUSTAND_REIHE[it.zustand] ?: 99 }
            InventarSort.WERT -> compareBy { it.wert }
        }
        return l.sortedWith(if (aufsteigend) c.thenBy(kollator) { it.name } else c.reversed().thenBy(kollator) { it.name })
    }

    // ---------- Ausgabe in Dateien ----------

    private fun de(v: BigDecimal): String =
        NumberFormat.getNumberInstance(Locale.GERMANY).apply { minimumFractionDigits = 2; maximumFractionDigits = 2 }.format(v)

    val CSV_KOPF = listOf(
        "Inventar-Nr.", "Bezeichnung", "Kategorie", "Sparte / Abteilung", "Menge", "Einheit", "Standort", "Zustand", "Anschaffungsdatum",
        "Anschaffungspreis (EUR)", "Zeitwert (EUR)", "Lieferant / Hersteller", "Zuständige Person", "Im Einsatz bei", "Seriennummer",
        "Letzte Prüfung", "Nächste Prüfung", "Aktuell ausgegeben", "Notizen",
    )

    fun csv(liste: List<Artikel>, ausgegeben: Map<String, Int> = emptyMap()): String = Csv.schreiben(
        CSV_KOPF,
        liste.map { a ->
            listOf(
                a.nummer, a.name, ARTEN[a.art] ?: a.art, a.sparte, a.menge.toString(), a.einheit, a.standort, ZUSTAENDE[a.zustand] ?: a.zustand,
                a.kaufdatum, a.kaufpreis?.let { Export.fixed2(it) } ?: "", a.zeitwert?.let { Export.fixed2(it) } ?: "", a.lieferant,
                a.zustaendig, a.einsatz, a.seriennummer, a.letztePruefung, a.naechstePruefung, (ausgegeben[a.id] ?: 0).toString(), Csv.einzeilig(a.notizen),
            )
        },
    )

    fun pdf(liste: List<Artikel>, verein: String, titel: String, heute: LocalDate): PdfTabelle {
        val summe = liste.filter { !it.ausgemustert }.fold(BigDecimal.ZERO) { s, a -> s + a.wert }
        val zeilen = liste.map { a ->
            listOf(
                a.nummer.ifEmpty { "–" }, a.name, a.sparte, "${a.menge} ${a.einheit}", a.standort.ifEmpty { "–" }, ZUSTAENDE[a.zustand]?.substringBefore(" /") ?: a.zustand,
                if (a.stueckwert != null) de(a.wert) else "–", a.zustaendig.ifEmpty { a.einsatz }.ifEmpty { "–" },
                if (a.naechstePruefung.isEmpty()) "–" else Export.datum(a.naechstePruefung),
            )
        } + listOf(listOf("", "Summe (ohne Ausgemustertes)", "", "", "", "", de(summe), "", ""))
        return PdfTabelle(
            verein, titel, "Stand: ${Zeit.deutsch(heute.toString())} | ${liste.size} Gegenstände",
            listOf("Inventar-Nr.", "Gegenstand", "Sparte", "Menge", "Standort", "Zustand", "Wert gesamt (€)", "Verantwortlich", "Nächste Prüfung"),
            listOf(24, 56, 26, 20, 38, 26, 25, 34, 20),
            listOf('l', 'l', 'l', 'c', 'l', 'l', 'r', 'l', 'c'),
            zeilen, "$verein - Inventar",
            setOf(zeilen.lastIndex),
        )
    }

    /** Fußnote, wie der Wert berechnet ist (steht in der App neben den Summen). */
    const val WERT_HINWEIS = "Wert = Zeitwert, sonst Anschaffungspreis, mal Menge. Ausgemustertes zählt nicht mit."
}
