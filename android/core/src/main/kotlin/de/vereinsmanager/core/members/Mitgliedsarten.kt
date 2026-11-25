package de.vereinsmanager.core.members

import de.vereinsmanager.core.settings.Vereinsdaten
import de.vereinsmanager.core.store.DocumentStore
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.contentOrNull
import java.util.Locale

/** Eine Mitgliedsart, wie der Verein sie in den Einstellungen festlegt. Am Mitglied steht nur die Kennung [id]. */
data class MitgliedsArt(
    val id: String,
    val name: String,
    /** Wahl der Art setzt Beitrag 0, keine Zahlweise, Zahlart „beitragsfrei“ (bisher nur Ehrenmitglied). */
    val beitragsfrei: Boolean = false,
    /** Wird für unter 18-Jährige vorgeschlagen (Aufnahmeantrag, Import; bisher Jugend). Höchstens eine Art. */
    val unter18: Boolean = false,
    /** Steht im Aufnahmeantrag zur Wahl (bisher alle außer Ehrenmitglied). */
    val imAntrag: Boolean = false,
    /** Gelöscht, bleibt aber für den Namen in der Liste („Jugend (gelöscht)“). */
    val geloescht: Boolean = false,
)

/**
 * Mitgliedsarten, vom Verein bearbeitbar (Wunsch Johannes, 25.11.2026). Gespeichert in den Vereinsdaten unter `membershipTypes`,
 * im selben Dokument wie am Desktop; fehlt das Feld, gelten die sechs bisherigen Arten. Gleiche Regeln wie Desktop `mitgliedsarten.ts`:
 * Kennung statt Name am Mitglied, die erste nicht gelöschte Art ist die Vorgabe, `ausgetreten`/`terminated` sind keine Arten.
 */
object Mitgliedsarten {
    const val SCHLUESSEL = "membershipTypes"
    private const val MAX_NAME = 60
    private val DE = Locale.GERMANY

    val STANDARD: List<MitgliedsArt> = listOf(
        MitgliedsArt("full", "Vollmitglied", imAntrag = true),
        MitgliedsArt("reduced", "Ermäßigt", imAntrag = true),
        MitgliedsArt("youth", "Jugend / Kinder", unter18 = true, imAntrag = true),
        MitgliedsArt("family", "Familie", imAntrag = true),
        MitgliedsArt("supporting", "Fördermitglied", imAntrag = true),
        MitgliedsArt("honorary", "Ehrenmitglied", beitragsfrei = true),
    )

    val AUSTRITT = setOf("ausgetreten", "terminated")
    fun istAustritt(id: String?) = id != null && id in AUSTRITT

    private fun s(o: JsonObject, k: String) = (o[k] as? JsonPrimitive)?.contentOrNull?.trim().orEmpty()
    private fun b(o: JsonObject, k: String) = (o[k] as? JsonPrimitive)?.booleanOrNull == true

    /** Liest die Liste; Unbrauchbares und doppelte Kennungen fallen weg. Ohne nicht gelöschte Art gelten die Standardarten. */
    fun lesen(settings: JsonObject?): List<MitgliedsArt> {
        val roh = settings?.get(SCHLUESSEL) as? JsonArray ?: return STANDARD
        val gesehen = HashSet<String>()
        val liste = roh.mapNotNull { e ->
            val o = e as? JsonObject ?: return@mapNotNull null
            val id = s(o, "id")
            if (id.isEmpty() || istAustritt(id) || !gesehen.add(id)) return@mapNotNull null
            MitgliedsArt(
                id, s(o, "name").take(MAX_NAME).ifEmpty { id },
                beitragsfrei = b(o, "beitragsfrei"), unter18 = b(o, "unter18"), imAntrag = b(o, "imAntrag"), geloescht = b(o, "geloescht"),
            )
        }
        return if (liste.any { !it.geloescht }) liste else STANDARD
    }

    fun lesen(store: DocumentStore): List<MitgliedsArt> = lesen(store.get(Vereinsdaten.BEREICH, Vereinsdaten.ID))

    /** Die Liste als JSON, wie der Desktop sie schreibt (nur gesetzte Schalter). */
    fun json(liste: List<MitgliedsArt>): JsonArray = JsonArray(liste.map { a ->
        val m = linkedMapOf<String, JsonElement>("id" to JsonPrimitive(a.id), "name" to JsonPrimitive(a.name.trim()))
        if (a.beitragsfrei) m["beitragsfrei"] = JsonPrimitive(true)
        if (a.unter18) m["unter18"] = JsonPrimitive(true)
        if (a.imAntrag) m["imAntrag"] = JsonPrimitive(true)
        if (a.geloescht) m["geloescht"] = JsonPrimitive(true)
        JsonObject(m)
    })

    fun aktive(liste: List<MitgliedsArt>) = liste.filter { !it.geloescht }
    fun standard(liste: List<MitgliedsArt>): String = aktive(liste).firstOrNull()?.id ?: "full"
    fun finde(liste: List<MitgliedsArt>, id: String?) = liste.firstOrNull { it.id == id }

    /** Anzeigename; gelöschte mit „(gelöscht)“, unbekannte mit ihrer Kennung. */
    fun name(liste: List<MitgliedsArt>, id: String?): String {
        if (id.isNullOrEmpty()) return "–"
        if (istAustritt(id)) return "Ausgetreten"
        val a = finde(liste, id) ?: return id
        return if (a.geloescht) "${a.name} (gelöscht)" else a.name
    }

    fun beitragsfrei(liste: List<MitgliedsArt>, id: String?) = finde(liste, id)?.beitragsfrei == true
    fun unter18Art(liste: List<MitgliedsArt>): String? = aktive(liste).firstOrNull { it.unter18 }?.id
    fun antragsArten(liste: List<MitgliedsArt>) = aktive(liste).filter { it.imAntrag }

    /** Fehler vor dem Speichern: `name.<id>` je Feld, `liste` für die ganze Liste. Gleiche Texte wie am Desktop. */
    fun pruefen(liste: List<MitgliedsArt>): Map<String, String> {
        val f = LinkedHashMap<String, String>()
        val aktiv = aktive(liste)
        if (aktiv.isEmpty()) f["liste"] = "Mindestens eine Mitgliedsart muss bleiben."
        val namen = HashSet<String>()
        for (a in aktiv) {
            val n = a.name.trim()
            when {
                n.isEmpty() -> f["name.${a.id}"] = "Bitte einen Namen eingeben."
                n.length > MAX_NAME -> f["name.${a.id}"] = "Höchstens $MAX_NAME Zeichen."
                !namen.add(n.lowercase(DE)) -> f["name.${a.id}"] = "Diesen Namen gibt es schon."
            }
        }
        if (aktiv.count { it.unter18 } > 1) f["liste"] = "Nur eine Art kann für unter 18-Jährige vorgeschlagen werden."
        return f
    }

    fun neu(liste: List<MitgliedsArt>, name: String, jetzt: Long = System.currentTimeMillis()): MitgliedsArt {
        val basis = "art-${jetzt.toString(36)}"
        var id = basis
        var i = 2
        while (liste.any { it.id == id }) id = "$basis-${i++}"
        return MitgliedsArt(id, name.trim(), imAntrag = true)
    }

    fun loeschen(liste: List<MitgliedsArt>, id: String) = liste.map { if (it.id == id) it.copy(geloescht = true, unter18 = false) else it }
    fun wiederherstellen(liste: List<MitgliedsArt>, id: String) = liste.map { if (it.id == id) it.copy(geloescht = false) else it }

    fun verschieben(liste: List<MitgliedsArt>, id: String, richtung: Int): List<MitgliedsArt> {
        val i = liste.indexOfFirst { it.id == id }
        val j = i + richtung
        if (i < 0 || j !in liste.indices) return liste
        return liste.toMutableList().also { val t = it[i]; it[i] = it[j]; it[j] = t }
    }

    /**
     * Auswahl für den Typ-Filter: alle nicht gelöschten Arten, gelöschte und unbekannte nur, solange Mitglieder so
     * eingetragen sind, dazu „Ausgetreten“ (Entscheidung 7: vollständig).
     */
    fun filter(liste: List<MitgliedsArt>, members: List<Member>): Map<String, String> {
        val m = LinkedHashMap<String, String>()
        for (a in liste) if (!a.geloescht || members.any { it.type == a.id }) m[a.id] = name(liste, a.id)
        for (x in members) if (!istAustritt(x.type) && x.type !in m) m[x.type] = name(liste, x.type)
        m["ausgetreten"] = "Ausgetreten"
        return m
    }

    /** Mitglieder, die mit dieser Art eingetragen sind, auch gekündigte (so viele verschiebt das Löschen). */
    fun anzahl(members: List<Member>, id: String) = members.count { it.type == id }

    /** Art aus einem Import-Text: genauer Name, dann die bisherigen Stichwörter, sonst bei unter 18 die vorgeschlagene, sonst die Vorgabe. */
    fun ausText(liste: List<MitgliedsArt>, text: String?, alter: Long?): String {
        val aktiv = aktive(liste)
        val l = text.orEmpty().lowercase(DE).trim()
        if (l.isNotEmpty()) {
            aktiv.firstOrNull { it.name.lowercase(DE) == l || it.id == l }?.let { return it.id }
            val stichwoerter = listOf(
                listOf("jugend", "kind", "schüler", "youth") to "youth",
                listOf("ermäßigt", "student", "senior", "azubi") to "reduced",
                listOf("familie") to "family",
                listOf("förder", "sponsor") to "supporting",
                listOf("ehren") to "honorary",
            )
            for ((woerter, id) in stichwoerter) if (woerter.any { it in l } && aktiv.any { it.id == id }) return id
        }
        val jung = if (alter != null && alter < 18) unter18Art(liste) else null
        return jung ?: standard(liste)
    }

    /**
     * „Ehrenmitglied“ war bis 25.11.2026 auch ein Status. Jetzt nur noch eine Art: Status „Aktiv“, Art „Ehrenmitglied“.
     * Der Beitrag bleibt (keine Lastschrift fällt still weg). Arbeitet auf den gespeicherten Dokumenten, damit Felder anderer
     * Fassungen erhalten bleiben. Gibt die Zahl der umgestellten Mitglieder zurück.
     */
    fun ehrenStatusUmstellen(store: DocumentStore): Int {
        var n = 0
        store.transaction {
            for (doc in store.all(MemberStore.AREA)) {
                if ((doc["status"] as? JsonPrimitive)?.contentOrNull != "honorary") continue
                val m = LinkedHashMap<String, JsonElement>(doc)
                m["status"] = JsonPrimitive("active")
                val typ = (doc["membershipType"] as? JsonPrimitive)?.contentOrNull
                if (!istAustritt(typ)) m["membershipType"] = JsonPrimitive("honorary")
                m["updatedAt"] = JsonPrimitive(java.time.Instant.now().toString())
                store.put(MemberStore.AREA, (doc["id"] as JsonPrimitive).content, JsonObject(m))
                n++
            }
        }
        return n
    }
}
