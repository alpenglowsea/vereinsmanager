package de.vereinsmanager.core.members

import de.vereinsmanager.core.documents.Dokument
import de.vereinsmanager.core.documents.DokumentForm
import de.vereinsmanager.core.documents.DokumentStore
import de.vereinsmanager.core.documents.Dokumente
import de.vereinsmanager.core.files.FileStore
import de.vereinsmanager.core.store.DocumentStore
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.contentOrNull
import java.time.LocalDate
import java.time.ZonedDateTime
import java.time.temporal.ChronoUnit

/*
 * Unterlagen am Mitglied und Führungszeugnis-Vermerk (Paket U) – Gegenstück zu src/utils/unterlagen.ts.
 *
 * Eine Unterlage ist ein gewöhnliches Dokument mit `memberId`, dazu `memberDocType`, `issuedAt` und `validUntil`.
 * Der Vermerk zum erweiterten Führungszeugnis steht am Mitglied (`policeCertificate`): nach § 72a Abs. 5 SGB VIII nur
 * Einsichtnahme, Datum des Zeugnisses und ob eine einschlägige Verurteilung eingetragen ist – keine Kopie.
 */

/** Vermerk zum erweiterten Führungszeugnis (Feldnamen wie am Desktop). */
data class Fuehrungszeugnis(val eingesehenAm: String, val datum: String, val einschlaegig: Boolean) {
    fun json(): JsonObject = JsonObject(
        linkedMapOf(
            "inspectedAt" to JsonPrimitive(eingesehenAm), "certificateDate" to JsonPrimitive(datum),
            "relevantConviction" to JsonPrimitive(einschlaegig),
        ),
    )

    companion object {
        fun aus(e: JsonElement?): Fuehrungszeugnis? {
            val o = e as? JsonObject ?: return null
            fun t(k: String) = (o[k] as? JsonPrimitive)?.takeIf { it !is JsonNull }?.contentOrNull.orEmpty()
            return Fuehrungszeugnis(t("inspectedAt"), t("certificateDate"), (o["relevantConviction"] as? JsonPrimitive)?.booleanOrNull ?: false)
        }
    }
}

object Unterlagen {
    data class Art(val wert: String, val text: String)

    val ARTEN: List<Art> = listOf(
        Art("trainerlizenz", "Trainer-/Übungsleiterlizenz"),
        Art("erste_hilfe", "Erste-Hilfe-Nachweis"),
        Art("schiedsrichter", "Schiedsrichterausweis"),
        Art("aufnahmeantrag", "Aufnahmeantrag"),
        Art("einverstaendnis", "Einverständnis (z. B. Fotos)"),
        Art("sonstiges", "Sonstiges"),
    )

    fun istArt(w: String?) = ARTEN.any { it.wert == w }

    /** Anzeigetext; unbekannt oder leer = „Sonstiges“. */
    fun artText(w: String?): String = ARTEN.firstOrNull { it.wert == w }?.text ?: "Sonstiges"

    /** Art eines Dokuments am Mitglied; ohne Angabe gilt ein Aufnahmeantrag (Kennung „doc-antrag-…“ oder Stichwort) als solcher. */
    fun artVon(id: String, art: String?, tags: List<String>): String = when {
        istArt(art) -> art!!
        id.startsWith("doc-antrag-") || "Aufnahmeantrag" in tags -> "aufnahmeantrag"
        else -> "sonstiges"
    }

    fun artVon(d: Dokument): String = artVon(d.id, d.unterlagenArt, d.tags)

    /** So viele Tage vor Ablauf erscheint eine Unterlage im Dashboard. */
    const val WARN_TAGE = 90L

    /** Nach so vielen Jahren ist ein neues Führungszeugnis fällig. */
    const val FZ_JAHRE = 5L

    const val ORDNER_ID = "folder-mitgliederunterlagen"
    const val ORDNER_NAME = "Mitgliederunterlagen"
    const val ORDNER_ELTERN = "folder-mitglieder"
    const val ORDNER_FARBE = "#0ea5e9"
    const val ORDNER_TEXT = "Lizenzen, Nachweise und Einverständnisse einzelner Mitglieder"

    private val DATUM = Regex("""^\d{4}-\d{2}-\d{2}$""")

    fun datum(d: String?): LocalDate? =
        if (d == null || !DATUM.matches(d)) null else try { LocalDate.parse(d) } catch (e: Exception) { null }

    fun istDatum(d: String?) = datum(d) != null

    enum class Ablauf { OHNE, GUELTIG, BALD, ABGELAUFEN }

    /** Stand einer Frist; der Tag selbst gilt noch. */
    fun ablauf(bis: String?, heute: LocalDate, tage: Long = WARN_TAGE): Ablauf {
        val b = datum(bis) ?: return Ablauf.OHNE
        val rest = ChronoUnit.DAYS.between(heute, b)
        return when {
            rest < 0 -> Ablauf.ABGELAUFEN
            rest <= tage -> Ablauf.BALD
            else -> Ablauf.GUELTIG
        }
    }

    /** Nächstes Führungszeugnis fällig: Datum + 5 Jahre (29. Februar → 28.). */
    fun faellig(v: Fuehrungszeugnis?): String? = v?.let { datum(it.datum) }?.plusYears(FZ_JAHRE)?.toString()

    fun pruefeUnterlage(art: String, titel: String, ausgestelltAm: String, gueltigBis: String): String? {
        if (!istArt(art)) return "Bitte eine Art wählen."
        if (titel.isBlank()) return "Bitte eine Bezeichnung eingeben."
        if (ausgestelltAm.isNotEmpty() && !istDatum(ausgestelltAm)) return "„Ausgestellt am“ ist kein gültiges Datum."
        if (gueltigBis.isNotEmpty() && !istDatum(gueltigBis)) return "„Gültig bis“ ist kein gültiges Datum."
        if (ausgestelltAm.isNotEmpty() && gueltigBis.isNotEmpty() && gueltigBis < ausgestelltAm) return "„Gültig bis“ liegt vor „Ausgestellt am“."
        return null
    }

    fun pruefeFuehrungszeugnis(v: Fuehrungszeugnis, heute: LocalDate): String? {
        val h = heute.toString()
        if (!istDatum(v.datum)) return "Bitte das Datum des Führungszeugnisses eingeben."
        if (!istDatum(v.eingesehenAm)) return "Bitte das Datum der Einsichtnahme eingeben."
        if (v.datum > h) return "Das Datum des Führungszeugnisses liegt in der Zukunft."
        if (v.eingesehenAm > h) return "Die Einsichtnahme liegt in der Zukunft."
        if (v.eingesehenAm < v.datum) return "Die Einsichtnahme liegt vor dem Datum des Führungszeugnisses."
        return null
    }

    data class Erinnerung(
        val memberId: String, val memberName: String,
        /** "unterlage" oder "fuehrungszeugnis" */
        val art: String, val text: String,
        /** Gültig bis bzw. fällig am */
        val datum: String, val abgelaufen: Boolean, val documentId: String?,
    )

    private fun JsonObject.t(k: String) = (this[k] as? JsonPrimitive)?.takeIf { it !is JsonNull }?.contentOrNull.orEmpty()

    /**
     * „Unterlagen laufen ab“ im Dashboard: Unterlagen mit „gültig bis“ in den nächsten [tage] Tagen oder schon vorbei,
     * dazu fällige Führungszeugnisse; nur Mitglieder, die nicht ausgetreten sind. Nach Datum sortiert.
     */
    fun erinnerungen(members: List<JsonObject>, documents: List<JsonObject>, heute: LocalDate, tage: Long = WARN_TAGE): List<Erinnerung> {
        val aktiv = members.filter { it.t("status") != "terminated" }.associateBy { it.t("id") }
        fun name(m: JsonObject) = "${m.t("firstName")} ${m.t("lastName")}".trim()
        val aus = ArrayList<Erinnerung>()
        for (d in documents) {
            val m = aktiv[d.t("memberId")] ?: continue
            if (d.t("memberId").isEmpty()) continue
            val s = ablauf(d.t("validUntil"), heute, tage)
            if (s != Ablauf.BALD && s != Ablauf.ABGELAUFEN) continue
            val tags = (d["tags"] as? kotlinx.serialization.json.JsonArray)?.mapNotNull { (it as? JsonPrimitive)?.contentOrNull }.orEmpty()
            val art = artVon(d.t("id"), d.t("memberDocType"), tags)
            aus += Erinnerung(m.t("id"), name(m), "unterlage", "${artText(art)}: ${d.t("title")}", d.t("validUntil"), s == Ablauf.ABGELAUFEN, d.t("id"))
        }
        for (m in aktiv.values) {
            val f = faellig(Fuehrungszeugnis.aus(m["policeCertificate"])) ?: continue
            val s = ablauf(f, heute, tage)
            if (s == Ablauf.BALD || s == Ablauf.ABGELAUFEN) aus += Erinnerung(m.t("id"), name(m), "fuehrungszeugnis", "Erweitertes Führungszeugnis", f, s == Ablauf.ABGELAUFEN, null)
        }
        return aus.sortedWith(compareBy({ it.datum }, { it.memberName }, { it.text }))
    }

    /** Zahl der Dokumente dieser Mitglieder (z. B. für die Rückfrage beim Löschen). */
    fun anzahl(ids: Collection<String>, documents: List<JsonObject>): Int {
        val s = ids.toSet()
        return documents.count { it.t("memberId").let { id -> id.isNotEmpty() && id in s } }
    }

    // ---------------------------------------------------------------- Bestand ändern

    /** Legt den Ordner „Mitgliederunterlagen“ an, falls er fehlt (gleiche Kennung wie am Desktop). Gibt die Kennung zurück. */
    fun ordnerSicherstellen(store: DocumentStore, now: ZonedDateTime = ZonedDateTime.now()): String {
        if (store.get(Dokumente.ORDNER, ORDNER_ID) != null) return ORDNER_ID
        val stempel = de.vereinsmanager.core.members.Zeit.stempel(now)
        val m = LinkedHashMap<String, JsonElement>()
        m["id"] = JsonPrimitive(ORDNER_ID)
        m["name"] = JsonPrimitive(ORDNER_NAME)
        if (store.get(Dokumente.ORDNER, ORDNER_ELTERN) != null) m["parentId"] = JsonPrimitive(ORDNER_ELTERN)
        m["category"] = JsonPrimitive("mitglieder")
        m["color"] = JsonPrimitive(ORDNER_FARBE)
        m["description"] = JsonPrimitive(ORDNER_TEXT)
        m["createdAt"] = JsonPrimitive(stempel)
        m["updatedAt"] = JsonPrimitive(stempel)
        store.put(Dokumente.ORDNER, ORDNER_ID, JsonObject(m))
        return ORDNER_ID
    }

    /**
     * Legt eine Unterlage an: Dokument mit Datei im Ordner „Mitgliederunterlagen“, Kategorie „Mitglieder“.
     * Dokumentdatum ist „ausgestellt am“, sonst heute.
     */
    fun neu(
        store: DocumentStore, files: FileStore, bytes: ByteArray, dateiName: String, dateiTyp: String,
        mitgliedId: String, mitgliedName: String, art: String, titel: String, ausgestelltAm: String, gueltigBis: String,
        now: ZonedDateTime = ZonedDateTime.now(),
    ): Dokument {
        pruefeUnterlage(art, titel, ausgestelltAm, gueltigBis)?.let { throw de.vereinsmanager.core.documents.DokumentException(it) }
        val ordner = ordnerSicherstellen(store, now)
        val form = DokumentForm(
            DokumentStore.neueId(), titel = titel.trim(), kategorie = "mitglieder", ordnerId = ordner,
            datum = ausgestelltAm.ifEmpty { now.toLocalDate().toString() }, mitgliedId = mitgliedId, mitgliedName = mitgliedName,
            unterlagenArt = art, ausgestelltAm = ausgestelltAm, gueltigBis = gueltigBis,
        )
        return store.transaction {
            val d = DokumentStore.neu(store, files, bytes, dateiName, dateiTyp, form, now)
            protokolliere(store, mitgliedId, now, textHinzugefuegt(d))
            d
        }
    }

    /** Ändert Art, Bezeichnung und Daten einer Unterlage; Datei und übrige Angaben bleiben. Mit Eintrag im Änderungsprotokoll. */
    fun aendern(store: DocumentStore, id: String, art: String, titel: String, ausgestelltAm: String, gueltigBis: String, now: ZonedDateTime = ZonedDateTime.now()): Dokument {
        pruefeUnterlage(art, titel, ausgestelltAm, gueltigBis)?.let { throw de.vereinsmanager.core.documents.DokumentException(it) }
        return store.transaction {
            val alt = store.get(Dokumente.DOKUMENTE, id)?.let { Dokument.from(it) } ?: throw de.vereinsmanager.core.documents.DokumentException("Die Unterlage gibt es nicht mehr.")
            val form = DokumentForm.von(alt).copy(
                titel = titel.trim(), unterlagenArt = art, ausgestelltAm = ausgestelltAm, gueltigBis = gueltigBis,
                datum = ausgestelltAm.ifEmpty { alt.datum },
            )
            val neu = DokumentStore.aendern(store, form, now)
            val a = aenderungen(alt, neu)
            if (a.isNotEmpty()) protokolliere(store, neu.mitgliedId, now, textBearbeitet(neu), a)
            neu
        }
    }

    /** Löscht eine Unterlage samt Datei und schreibt „Unterlage gelöscht“ ins Änderungsprotokoll des Mitglieds. */
    fun loeschen(store: DocumentStore, files: FileStore, id: String, now: ZonedDateTime = ZonedDateTime.now()) {
        val alt = store.get(Dokumente.DOKUMENTE, id)?.let { Dokument.from(it) } ?: return
        // Erst löschen (dabei werden auch Dateien entfernt, das lässt sich nicht zurücknehmen), dann protokollieren.
        DokumentStore.loeschen(store, files, listOf(id), now)
        protokolliere(store, alt.mitgliedId, now, textGeloescht(alt))
    }

    // ---- Änderungsprotokoll (T-346), Texte wie am Desktop (src/utils/unterlagenProtokoll.ts) ----
    // Der Führungszeugnis-Vermerk kommt bewusst nicht ins Protokoll: Nach § 72a Abs. 5 SGB VIII sind die Angaben
    // spätestens drei Monate nach Ende der Tätigkeit zu löschen; ein Protokolleintrag bliebe stehen.

    private fun datumText(iso: String) = if (iso.isEmpty()) "–" else Zeit.deutsch(iso)
    private fun leer(v: String) = v.ifEmpty { "–" }

    fun textHinzugefuegt(d: Dokument) = "Unterlage hinzugefügt: ${artText(artVon(d))}: ${d.titel}"
    fun textGeloescht(d: Dokument) = "Unterlage gelöscht: ${artText(artVon(d))}: ${d.titel}"
    fun textBearbeitet(d: Dokument) = "Unterlage bearbeitet: ${d.titel}"

    /** Geänderte Felder (Bezeichnung, alt, neu); leer, wenn sich nichts Protokollwürdiges geändert hat. */
    fun aenderungen(alt: Dokument, neu: Dokument): List<Triple<String, String, String>> {
        val l = ArrayList<Triple<String, String, String>>()
        val artAlt = artText(artVon(alt))
        val artNeu = artText(artVon(neu))
        if (artAlt != artNeu) l.add(Triple("Art", artAlt, artNeu))
        if (alt.titel != neu.titel) l.add(Triple("Bezeichnung", leer(alt.titel), leer(neu.titel)))
        if (alt.ausgestelltAm != neu.ausgestelltAm) l.add(Triple("Ausgestellt am", datumText(alt.ausgestelltAm), datumText(neu.ausgestelltAm)))
        if (alt.gueltigBis != neu.gueltigBis) l.add(Triple("Gültig bis", datumText(alt.gueltigBis), datumText(neu.gueltigBis)))
        if (alt.dateiName != neu.dateiName) l.add(Triple("Datei", leer(alt.dateiName), leer(neu.dateiName)))
        return l
    }

    /** Schreibt den Eintrag ins Protokoll des Mitglieds; gibt es das Mitglied nicht (mehr), entfällt er. */
    private fun protokolliere(store: DocumentStore, memberId: String, now: ZonedDateTime, summary: String, aenderungen: List<Triple<String, String, String>> = emptyList()) {
        if (memberId.isEmpty()) return
        val m = store.get(MemberStore.AREA, memberId) ?: return
        val l = MemberAudit.unterlage(m, now, summary, aenderungen)
        store.put(MemberStore.LOG, (l["id"] as JsonPrimitive).content, l)
    }

    /** Setzt den Führungszeugnis-Vermerk eines Mitglieds (null: Vermerk löschen). */
    fun fuehrungszeugnisSetzen(store: DocumentStore, memberId: String, v: Fuehrungszeugnis?, heute: LocalDate, now: ZonedDateTime = ZonedDateTime.now()) {
        if (v != null) pruefeFuehrungszeugnis(v, heute)?.let { throw IllegalArgumentException(it) }
        store.transaction {
            val alt = store.get(MemberStore.AREA, memberId) ?: throw IllegalArgumentException("Das Mitglied gibt es nicht mehr.")
            val m = LinkedHashMap<String, JsonElement>(alt)
            if (v == null) m.remove("policeCertificate") else m["policeCertificate"] = v.json()
            m["updatedAt"] = JsonPrimitive(Zeit.stempel(now))
            store.put(MemberStore.AREA, memberId, JsonObject(m))
        }
    }
}
