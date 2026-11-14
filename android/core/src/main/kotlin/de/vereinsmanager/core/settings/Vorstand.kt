package de.vereinsmanager.core.settings

import de.vereinsmanager.core.members.Zeit
import de.vereinsmanager.core.store.DocumentStore
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull
import java.time.ZonedDateTime
import java.util.UUID

/** Ein Mitglied des Vorstands. [funktion] ist wie am Desktop frei wählbarer Text. */
data class Vorstandsmitglied(
    val id: String,
    val funktion: String,
    val name: String,
    val email: String = "",
    val telefon: String = "",
)

/**
 * Die Vorstandsliste (`boardMembers` in `settings/main`). Aus ihr werden `chairman` (Vorsitzende/r) und `treasurer`
 * (Kassenwart) abgeleitet, weil Briefkopf, Lastschriftprotokoll und Spendenquittung diese beiden Felder lesen.
 *
 * Die Zuordnung erkennt die Funktion am Wortlaut, nicht an der Stelle in der Liste (der Desktop nimmt sonst
 * den ersten und zweiten Eintrag – dann wird aus dem Schriftführer an Platz 2 ein Kassenwart).
 */
object Vorstand {
    /** Vorschläge für die Funktion; frei überschreibbar. */
    val FUNKTIONEN = listOf(
        "1. Vorsitzende/r", "2. Vorsitzende/r", "Kassenwart / Schatzmeister", "Schriftführer/in",
        "Kassenprüfer/in", "Beisitzer/in", "Sportwart", "Jugendleiter/in",
    )

    private val NICHT_ERSTER = listOf("stellv", "stv", "vize", "2.", "3.", "zweit", "dritt", "jugend", "ausschuss", "abteilung", "beirat", "sparten")
    private val NICHT_KASSE = listOf("prüf", "pruef", "revis", "stellv", "stv", "vize", "2.")
    private val KASSE = listOf("kassenwart", "kassier", "kassenführ", "kassenfuehr", "schatzmeister", "finanzwart", "finanzvorstand")

    fun istVorsitz(funktion: String): Boolean {
        val f = funktion.lowercase().trim()
        return (f.contains("vorsitz") || f.contains("präsident") || f.contains("praesident")) && NICHT_ERSTER.none { f.contains(it) }
    }

    fun istKasse(funktion: String): Boolean {
        val f = funktion.lowercase().trim()
        return KASSE.any { f.contains(it) } && NICHT_KASSE.none { f.contains(it) }
    }

    /** Name der ersten Person mit passender Funktion, oder null. Personen ohne Namen zählen nicht. */
    fun vorsitz(liste: List<Vorstandsmitglied>): String? = liste.firstOrNull { it.name.isNotBlank() && istVorsitz(it.funktion) }?.name?.trim()
    fun kasse(liste: List<Vorstandsmitglied>): String? = liste.firstOrNull { it.name.isNotBlank() && istKasse(it.funktion) }?.name?.trim()

    private fun t(o: JsonObject?, k: String) = (o?.get(k) as? JsonPrimitive)?.takeIf { it !is JsonNull }?.contentOrNull ?: ""

    /**
     * Die Liste aus den Einstellungen. Fehlt `boardMembers` (Android-Bestand von früher oder ein neuer Verein),
     * entstehen die Einträge aus `chairman` und `treasurer`, damit nichts verloren geht.
     */
    fun lesen(settings: JsonObject?): List<Vorstandsmitglied> {
        val liste = (settings?.get("boardMembers") as? JsonArray)?.mapNotNull { e ->
            val o = e as? JsonObject ?: return@mapNotNull null
            Vorstandsmitglied(
                id = t(o, "id").ifEmpty { neueId() }, funktion = t(o, "role"), name = t(o, "name"),
                email = t(o, "email"), telefon = t(o, "phone"),
            )
        }.orEmpty()
        if (liste.isNotEmpty()) return liste
        return buildList {
            t(settings, "chairman").takeIf { it.isNotBlank() }?.let { add(Vorstandsmitglied("bm-1", "1. Vorsitzende/r", it)) }
            t(settings, "treasurer").takeIf { it.isNotBlank() }?.let { add(Vorstandsmitglied("bm-2", "Kassenwart / Schatzmeister", it)) }
        }
    }

    fun lesen(store: DocumentStore): List<Vorstandsmitglied> = lesen(store.get(Vereinsdaten.BEREICH, Vereinsdaten.ID))

    fun neueId(): String = "bm-" + UUID.randomUUID().toString().take(8)

    /** Fehlermeldungen je Eintrag (Schlüssel: id); leer, wenn alles in Ordnung ist. Ganz leere Zeilen sind erlaubt und werden beim Speichern weggelassen. */
    fun pruefen(liste: List<Vorstandsmitglied>): Map<String, String> {
        val e = linkedMapOf<String, String>()
        for (m in liste) {
            val leer = m.funktion.isBlank() && m.name.isBlank() && m.email.isBlank() && m.telefon.isBlank()
            if (leer) continue
            if (m.name.isBlank()) e[m.id] = "Bitte einen Namen eingeben."
            else if (m.funktion.isBlank()) e[m.id] = "Bitte die Funktion eingeben."
            else if (m.email.isNotBlank() && !m.email.trim().matches(Regex("""[^@\s]+@[^@\s]+\.[^@\s]+"""))) e[m.id] = "Die E-Mail-Adresse sieht nicht richtig aus."
        }
        return e
    }

    /** Hinweise, die nicht am Speichern hindern: fehlt eine Person mit der Funktion, steht im Briefkopf „unbekannt“. */
    fun hinweise(liste: List<Vorstandsmitglied>): List<String> = buildList {
        if (vorsitz(liste) == null) add("Niemand hat die Funktion „Vorsitzende/r“ – im Briefkopf der Rechnungen und auf dem Dashboard fehlt dann der Name.")
        if (kasse(liste) == null) add("Niemand hat die Funktion „Kassenwart / Schatzmeister“ – im Lastschriftprotokoll und auf der Spendenbescheinigung fehlt dann der Name.")
    }

    /** Schreibt die Liste und leitet Vorsitz und Kassenwart daraus ab. Alles andere in den Einstellungen bleibt. */
    fun speichern(store: DocumentStore, liste: List<Vorstandsmitglied>, now: ZonedDateTime = ZonedDateTime.now()): List<Vorstandsmitglied> {
        pruefen(liste).values.firstOrNull()?.let { throw IllegalArgumentException(it) }
        val sauber = liste.filter { it.funktion.isNotBlank() || it.name.isNotBlank() || it.email.isNotBlank() || it.telefon.isNotBlank() }
            .map { it.copy(funktion = it.funktion.trim(), name = it.name.trim(), email = it.email.trim(), telefon = it.telefon.trim()) }
        store.transaction {
            val alt = store.get(Vereinsdaten.BEREICH, Vereinsdaten.ID)
            val m = LinkedHashMap<String, JsonElement>(alt ?: JsonObject(emptyMap()))
            m["id"] = JsonPrimitive(Vereinsdaten.ID)
            m["boardMembers"] = JsonArray(sauber.map { b ->
                val o = LinkedHashMap<String, JsonElement>()
                o["id"] = JsonPrimitive(b.id); o["role"] = JsonPrimitive(b.funktion); o["name"] = JsonPrimitive(b.name)
                if (b.email.isNotEmpty()) o["email"] = JsonPrimitive(b.email)
                if (b.telefon.isNotEmpty()) o["phone"] = JsonPrimitive(b.telefon)
                JsonObject(o)
            })
            m["chairman"] = JsonPrimitive(vorsitz(sauber).orEmpty())
            m["treasurer"] = JsonPrimitive(kasse(sauber).orEmpty())
            m["updatedAt"] = JsonPrimitive(Zeit.stempel(now))
            store.put(Vereinsdaten.BEREICH, Vereinsdaten.ID, JsonObject(m))
        }
        return lesen(store)
    }
}
