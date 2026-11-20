package de.vereinsmanager.core.meeting

import de.vereinsmanager.core.documents.Dokument
import de.vereinsmanager.core.documents.DokumentForm
import de.vereinsmanager.core.documents.DokumentStore
import de.vereinsmanager.core.documents.Dokumente
import de.vereinsmanager.core.documents.StandardOrdner
import de.vereinsmanager.core.donation.Unterschrift
import de.vereinsmanager.core.files.FileStore
import de.vereinsmanager.core.members.Member
import de.vereinsmanager.core.members.Zeit
import de.vereinsmanager.core.store.DocumentStore
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.doubleOrNull
import kotlinx.serialization.json.intOrNull
import java.security.MessageDigest
import java.time.LocalDate
import java.time.LocalTime
import java.time.ZonedDateTime

private fun JsonObject.s(k: String): String = (this[k] as? JsonPrimitive)?.contentOrNull.orEmpty()
private fun JsonObject.b(k: String, standard: Boolean = false): Boolean = (this[k] as? JsonPrimitive)?.booleanOrNull ?: standard
private fun JsonObject.i(k: String): Int? = (this[k] as? JsonPrimitive)?.let { it.intOrNull ?: it.doubleOrNull?.toInt() }
private fun JsonObject.liste(k: String): List<JsonObject> = (this[k] as? JsonArray)?.mapNotNull { it as? JsonObject } ?: emptyList()
private fun str(v: String): JsonElement = JsonPrimitive(v)

data class Beschluss(
    val raw: JsonObject, val id: String, val nummer: String, val titel: String, val antrag: String, val antragsteller: String,
    val ja: Int, val nein: Int, val enthaltung: Int, val ergebnis: String, val steuer: Boolean, val register: Boolean,
    val verantwortlich: String, val frist: String, val notiz: String,
) {
    companion object {
        fun from(o: JsonObject) = Beschluss(
            o, o.s("id"), o.s("agendaItemNumber"), o.s("title"), o.s("motionText"), o.s("proposer"),
            o.i("votesFor") ?: 0, o.i("votesAgainst") ?: 0, o.i("votesAbstain") ?: 0, o.s("result").ifEmpty { "accepted" },
            o.b("isTaxRelevant"), o.b("isRegisterRelevant"), o.s("responsiblePerson"), o.s("dueDate"), o.s("notes"),
        )
    }
}

data class Top(
    val raw: JsonObject, val id: String, val nummer: String, val titel: String, val berichterstatter: String,
    val notizen: String, val beschluesse: List<Beschluss>,
) {
    companion object {
        fun from(o: JsonObject) = Top(
            o, o.s("id"), o.s("number"), o.s("title"), o.s("speaker"), o.s("discussionNotes"), o.liste("resolutions").map(Beschluss::from),
        )
    }
}

data class Anwesender(
    val raw: JsonObject, val id: String, val memberId: String, val name: String, val email: String, val rolle: String,
    val anwesend: Boolean, val stimmrecht: Boolean, val unterzeichner: Boolean,
) {
    companion object {
        fun from(o: JsonObject) = Anwesender(
            o, o.s("id"), o.s("memberId"), o.s("name"), o.s("email"), o.s("role"),
            o.b("present", true), o.b("hasVotingRight", true), o.b("isSignatory"),
        )
    }
}

/** Eine Unterschrift unter dem Protokoll. [inhalt] ist der Fingerabdruck des Protokolltextes zum Zeitpunkt der Unterschrift (leer bei älteren/Desktop-Unterschriften). */
data class Signatur(
    val raw: JsonObject, val id: String, val name: String, val rolle: String, val zeit: String, val unterschrift: Unterschrift?, val inhalt: String,
) {
    /** „leitung“: ältere Desktop-Unterschriften hießen „Versammlungsleitung gem. Satzung“. */
    val istLeitung: Boolean get() = rolle.lowercase().let { "leiter" in it || "leitung" in it || "vorsitz" in it }
    val istSchrift: Boolean get() = !istLeitung && rolle.lowercase().let { "schrift" in it || "protokoll" in it }

    companion object {
        fun from(o: JsonObject): Signatur {
            val aspekt = o.i("aspect")?.toDouble() ?: (o["aspect"] as? JsonPrimitive)?.doubleOrNull
            val striche = (o["strokes"] as? JsonArray)?.mapNotNull { st ->
                (st as? JsonArray)?.mapNotNull { p ->
                    val a = p as? JsonArray
                    val x = (a?.getOrNull(0) as? JsonPrimitive)?.doubleOrNull
                    val y = (a?.getOrNull(1) as? JsonPrimitive)?.doubleOrNull
                    if (x != null && y != null) x to y else null
                }
            }.orEmpty()
            val u = if (aspekt != null && aspekt > 0) Unterschrift(aspekt, striche).takeIf { !it.leer } else null
            return Signatur(o, o.s("id"), o.s("name"), o.s("role"), o.s("signedAt"), u, o.s("contentHash"))
        }
    }
}

data class Sitzung(
    val raw: JsonObject, val id: String, val titel: String, val art: String, val status: String, val protokollart: String,
    val datum: String, val beginn: String, val ende: String, val ort: String, val leitung: String, val schrift: String,
    val einladungsDatum: String, val einladungsWeg: String, val einladungOk: Boolean, val beschlussfaehig: Boolean,
    val stimmberechtigte: Int?, val tops: List<Top>, val teilnehmer: List<Anwesender>, val notizen: String,
    val signiertAm: String, val signaturen: List<Signatur>, val dokumentId: String, val erstellt: String, val geaendert: String,
) {
    val gesperrt: Boolean get() = signaturen.isNotEmpty()
    val leitungSigniert: Boolean get() = signaturen.any { it.istLeitung }
    val schriftSigniert: Boolean get() = signaturen.any { it.istSchrift }
    val vollstaendigUnterschrieben: Boolean get() = leitungSigniert && schriftSigniert
    val beschluesse: List<Beschluss> get() = tops.flatMap { it.beschluesse }
    val istVersammlung: Boolean get() = art == "general_assembly" || art == "extraordinary_assembly"

    /** Anwesende mit Stimmrecht laut Teilnehmerliste. */
    val stimmenAnwesend: Int get() = teilnehmer.count { it.anwesend && it.stimmrecht }

    /** Die Zahl der anwesenden Stimmberechtigten: die Eingabe, sonst die Zählung aus der Teilnehmerliste, sonst unbekannt. */
    val stimmberechtigteWirksam: Int? get() = stimmberechtigte ?: stimmenAnwesend.takeIf { it > 0 }

    companion object {
        fun from(o: JsonObject) = Sitzung(
            o, o.s("id"), o.s("title"), o.s("type").ifEmpty { "other" }, o.s("status").ifEmpty { "scheduled" }, o.s("protocolType").ifEmpty { "results" },
            o.s("date"), o.s("startTime"), o.s("endTime"), o.s("location"), o.s("chairperson"), o.s("minuteKeeper"),
            o.s("invitationDate"), o.s("invitationMethod"), o.b("invitationCompliant"), o.b("quorumConfirmed"),
            o.i("totalEligibleVoters"), o.liste("agenda").map(Top::from), o.liste("attendees").map(Anwesender::from), o.s("generalNotes"),
            o.s("signedAt"), o.liste("signatures").map(Signatur::from), o.s("documentId"), o.s("createdAt"), o.s("updatedAt"),
        )
    }
}

// ---------------------------------------------------------------- Formulare

data class BeschlussForm(
    val id: String, val titel: String = "", val antrag: String = "", val antragsteller: String = "",
    val ja: String = "", val nein: String = "", val enthaltung: String = "", val ergebnis: String = "accepted",
    val steuer: Boolean = false, val register: Boolean = false, val verantwortlich: String = "", val frist: String = "", val notiz: String = "",
) {
    companion object {
        fun von(b: Beschluss) = BeschlussForm(
            b.id, b.titel, b.antrag, b.antragsteller, b.ja.toString(), b.nein.toString(), b.enthaltung.toString(), b.ergebnis,
            b.steuer, b.register, b.verantwortlich, b.frist, b.notiz,
        )
    }
}

data class TopForm(
    val id: String, val titel: String = "", val berichterstatter: String = "", val notizen: String = "", val beschluesse: List<BeschlussForm> = emptyList(),
) {
    companion object {
        fun von(t: Top) = TopForm(t.id, t.titel, t.berichterstatter, t.notizen, t.beschluesse.map(BeschlussForm::von))
    }
}

data class AnwesenderForm(
    val id: String, val memberId: String = "", val name: String = "", val email: String = "", val rolle: String = "",
    val anwesend: Boolean = true, val stimmrecht: Boolean = true, val unterzeichner: Boolean = false,
) {
    companion object {
        fun von(a: Anwesender) = AnwesenderForm(a.id, a.memberId, a.name, a.email, a.rolle, a.anwesend, a.stimmrecht, a.unterzeichner)
    }
}

data class SitzungForm(
    val id: String? = null, val titel: String = "", val art: String = "board", val status: String = "scheduled", val protokollart: String = "results",
    val datum: String = "", val beginn: String = "", val ende: String = "", val ort: String = "", val leitung: String = "", val schrift: String = "",
    val einladungsDatum: String = "", val einladungsWeg: String = "", val einladungOk: Boolean = false, val beschlussfaehig: Boolean = false,
    val stimmberechtigte: String = "", val tops: List<TopForm> = emptyList(), val teilnehmer: List<AnwesenderForm> = emptyList(), val notizen: String = "",
) {
    companion object {
        fun von(s: Sitzung) = SitzungForm(
            s.id, s.titel, s.art, s.status, s.protokollart, s.datum, s.beginn, s.ende, s.ort, s.leitung, s.schrift, s.einladungsDatum,
            s.einladungsWeg, s.einladungOk, s.beschlussfaehig, s.stimmberechtigte?.toString().orEmpty(), s.tops.map(TopForm::von),
            s.teilnehmer.map(AnwesenderForm::von), s.notizen,
        )
    }
}

class SitzungException(message: String) : Exception(message)

// ---------------------------------------------------------------- Logik

object Sitzungen {
    const val AREA = "meetings"

    val ARTEN: Map<String, String> = linkedMapOf(
        "board" to "Vorstandssitzung", "general_assembly" to "Mitgliederversammlung", "extraordinary_assembly" to "Außerordentliche Mitgliederversammlung",
        "committee" to "Ausschuss / Fachbereich / Beirat", "department" to "Abteilungsversammlung", "other" to "Sonstige Sitzung",
    )
    val STATUS: Map<String, String> = linkedMapOf(
        "scheduled" to "Einberufen / geplant", "in_progress" to "In Durchführung", "draft" to "Protokoll im Entwurf",
        "review" to "In Vorprüfung", "approved" to "Genehmigt", "cancelled" to "Abgesagt",
    )
    /** Der Status „Genehmigt“ ergibt sich aus den beiden Unterschriften und wird nicht von Hand gesetzt. */
    val STATUS_WAHL: Map<String, String> = STATUS.filterKeys { it != "approved" }
    val ERGEBNISSE: Map<String, String> = linkedMapOf("accepted" to "Angenommen", "rejected" to "Abgelehnt", "deferred" to "Vertagt")
    val PROTOKOLLARTEN: Map<String, String> = linkedMapOf("results" to "Ergebnisprotokoll", "verbatim" to "Verlaufsprotokoll")
    const val ROLLE_LEITUNG = "Versammlungsleiter"
    const val ROLLE_SCHRIFT = "Schriftführer"

    fun artName(a: String) = ARTEN[a] ?: "Sitzung"
    fun statusName(s: String) = STATUS[s] ?: s
    fun datum(iso: String): LocalDate? = try { LocalDate.parse(iso) } catch (e: Exception) { null }
    private fun zeit(t: String): LocalTime? = try { LocalTime.parse(t) } catch (e: Exception) { null }
    private fun zahl(t: String): Int? = t.trim().toIntOrNull()?.takeIf { it >= 0 }

    // ---------- Lesen

    fun alle(store: DocumentStore): List<Sitzung> =
        store.all(AREA).map(Sitzung::from).sortedWith(compareByDescending<Sitzung> { it.datum }.thenByDescending { it.beginn })

    fun sitzung(store: DocumentStore, id: String): Sitzung? = store.get(AREA, id)?.let { Sitzung.from(it) }

    // ---------- Neu / Vorlagen

    /** Die übliche Tagesordnung, nur als Ausgangspunkt zum Ändern (keine Beispielpersonen, keine Jahreszahl im Text). */
    fun standardTagesordnung(art: String, jetzt: Long = System.currentTimeMillis()): List<TopForm> {
        val titel = when (art) {
            "general_assembly", "extraordinary_assembly" -> listOf(
                "Begrüßung und Feststellung der ordnungsgemäßen Ladung und Beschlussfähigkeit", "Bericht des Vorstands", "Kassenbericht und Bericht der Kassenprüfer",
                "Aussprache und Entlastung des Vorstands", "Wahlen", "Anträge und Verschiedenes",
            )
            "board", "committee", "department" -> listOf(
                "Begrüßung und Genehmigung des letzten Protokolls", "Berichte", "Laufende Projekte und Beschlussfassung", "Termine und Verschiedenes",
            )
            else -> emptyList()
        }
        return titel.mapIndexed { i, t -> TopForm("top-$jetzt-${i + 1}", t) }
    }

    /** Ein leeres Formular; der Titel enthält die aktuelle Jahreszahl, sonst nichts Erfundenes. */
    fun neu(art: String, heute: LocalDate): SitzungForm = SitzungForm(
        titel = if (art == "general_assembly") "Mitgliederversammlung ${heute.year}" else if (art == "extraordinary_assembly") "Außerordentliche Mitgliederversammlung ${heute.year}" else ARTEN[art] ?: "Sitzung",
        art = art, datum = heute.toString(), tops = standardTagesordnung(art),
    )

    // ---------- Prüfen

    /** Fehlertexte je Feld. Schlüssel: titel, datum, beginn, ende, einladungsDatum, stimmberechtigte, top<i>, beschluss<i>.<j>, teilnehmer<i>. */
    fun pruefen(f: SitzungForm): Map<String, String> {
        val e = LinkedHashMap<String, String>()
        if (f.titel.isBlank()) e["titel"] = "Bitte einen Titel eingeben."
        val d = datum(f.datum)
        if (d == null) e["datum"] = "Bitte ein gültiges Datum wählen."
        if (f.beginn.isNotBlank() && zeit(f.beginn) == null) e["beginn"] = "Uhrzeit ungültig."
        if (f.ende.isNotBlank()) {
            val z = zeit(f.ende); val b = zeit(f.beginn)
            if (z == null) e["ende"] = "Uhrzeit ungültig."
            else if (b != null && !z.isAfter(b)) e["ende"] = "Das Ende muss nach dem Beginn liegen."
        }
        if (f.einladungsDatum.isNotBlank()) {
            val ed = datum(f.einladungsDatum)
            if (ed == null) e["einladungsDatum"] = "Datum ungültig."
            else if (d != null && ed.isAfter(d)) e["einladungsDatum"] = "Die Einladung kann nicht nach der Sitzung liegen."
        }
        if (f.stimmberechtigte.isNotBlank() && zahl(f.stimmberechtigte) == null) e["stimmberechtigte"] = "Bitte eine ganze Zahl (0 oder mehr) eingeben."
        if (f.status == "approved") e["status"] = "Genehmigt wird das Protokoll durch die beiden Unterschriften."
        val grenze = zahl(f.stimmberechtigte) ?: f.teilnehmer.count { it.anwesend && it.stimmrecht }.takeIf { it > 0 }
        f.tops.forEachIndexed { i, t ->
            if (t.titel.isBlank()) e["top$i"] = "Der Tagesordnungspunkt braucht einen Titel."
            t.beschluesse.forEachIndexed { j, b -> beschlussFehler(b, grenze)?.let { e["beschluss$i.$j"] = it } }
        }
        f.teilnehmer.forEachIndexed { i, a -> if (a.name.isBlank()) e["teilnehmer$i"] = "Der Name fehlt." }
        return e
    }

    private fun beschlussFehler(b: BeschlussForm, grenze: Int?): String? {
        if (b.titel.isBlank()) return "Bitte einen Kurztitel eingeben."
        if (b.antrag.isBlank()) return "Bitte den Wortlaut des Antrags eingeben."
        if (b.frist.isNotBlank() && datum(b.frist) == null) return "Die Frist ist kein gültiges Datum."
        val ja = if (b.ja.isBlank()) 0 else zahl(b.ja)
        val nein = if (b.nein.isBlank()) 0 else zahl(b.nein)
        val enth = if (b.enthaltung.isBlank()) 0 else zahl(b.enthaltung)
        if (ja == null || nein == null || enth == null) return "Die Stimmen müssen ganze Zahlen (0 oder mehr) sein."
        val summe = ja + nein + enth
        if (b.ergebnis != "deferred" && summe == 0) return "Bitte die Stimmen eintragen."
        if (grenze != null && summe > grenze) return "Es sind $summe Stimmen eingetragen, aber nur $grenze stimmberechtigte Anwesende."
        if (b.ergebnis == "accepted" && ja <= nein) return "Mit höchstens so vielen Ja- wie Nein-Stimmen kann ein Beschluss nicht angenommen sein."
        return null
    }

    /**
     * Lassen sich die Stimmen nicht gegen die Anwesenden prüfen? Das ist der Fall, wenn weder die Zahl der
     * Stimmberechtigten eingetragen ist noch anwesende Teilnehmer mit Stimmrecht erfasst sind, aber Beschlüsse
     * Stimmen haben. Kein Fehler, nur ein Hinweis (wie Desktop `stimmenUngeprueft`).
     */
    fun stimmenUngeprueft(f: SitzungForm): Boolean {
        if (zahl(f.stimmberechtigte) != null || f.teilnehmer.any { it.anwesend && it.stimmrecht }) return false
        fun n(t: String) = t.trim().toIntOrNull() ?: 0
        return f.tops.any { t -> t.beschluesse.any { n(it.ja) + n(it.nein) + n(it.enthaltung) > 0 } }
    }

    /** Vorschlag für das Ergebnis aus den Stimmen (einfache Mehrheit; Enthaltungen zählen nicht, Gleichstand gilt als abgelehnt). Satzungen können mehr verlangen. */
    fun ergebnisVorschlag(ja: Int, nein: Int): String = if (ja > nein) "accepted" else "rejected"

    // ---------- Speichern

    private fun nummer(i: Int) = "TOP ${i + 1}"

    private fun beschlussRaw(b: BeschlussForm, top: String, basis: JsonObject?): JsonObject {
        val m = LinkedHashMap<String, JsonElement>(basis ?: JsonObject(emptyMap()))
        m["id"] = str(b.id)
        m["agendaItemNumber"] = str(top)
        m["title"] = str(b.titel.trim()); m["motionText"] = str(b.antrag.trim())
        if (b.antragsteller.isBlank()) m.remove("proposer") else m["proposer"] = str(b.antragsteller.trim())
        m["votesFor"] = JsonPrimitive(b.ja.trim().toIntOrNull() ?: 0)
        m["votesAgainst"] = JsonPrimitive(b.nein.trim().toIntOrNull() ?: 0)
        m["votesAbstain"] = JsonPrimitive(b.enthaltung.trim().toIntOrNull() ?: 0)
        m["result"] = str(b.ergebnis)
        m["isTaxRelevant"] = JsonPrimitive(b.steuer); m["isRegisterRelevant"] = JsonPrimitive(b.register)
        if (b.verantwortlich.isBlank()) m.remove("responsiblePerson") else m["responsiblePerson"] = str(b.verantwortlich.trim())
        if (b.frist.isBlank()) m.remove("dueDate") else m["dueDate"] = str(b.frist)
        if (b.notiz.isBlank()) m.remove("notes") else m["notes"] = str(b.notiz.trim())
        return JsonObject(m)
    }

    private fun ersetze(m: MutableMap<String, JsonElement>, k: String, v: String) { if (v.isBlank()) m.remove(k) else m[k] = str(v.trim()) }

    /**
     * Speichert eine neue oder geänderte Sitzung. Unbekannte Felder (auch Unterschriften und Archiv-Verweis) bleiben erhalten – der Desktop
     * verliert sie beim Bearbeiten. Ein unterschriebenes Protokoll ist gesperrt, bis die Unterschriften entfernt werden.
     * Die TOP-Nummern werden immer fortlaufend neu vergeben.
     */
    fun speichern(store: DocumentStore, f: SitzungForm, now: ZonedDateTime = ZonedDateTime.now()): Sitzung = store.transaction {
        val fehler = pruefen(f)
        if (fehler.isNotEmpty()) throw SitzungException(fehler.values.first())
        val alt = f.id?.let { store.get(AREA, it) }
        if (f.id != null && alt == null) throw SitzungException("Die Sitzung gibt es nicht mehr.")
        if (alt != null && Sitzung.from(alt).gesperrt) throw SitzungException(GESPERRT)
        val stempel = Zeit.stempel(now)
        val id = f.id ?: "meet-${now.toInstant().toEpochMilli()}-${Zeit.zufall(4)}"
        val m = LinkedHashMap<String, JsonElement>(alt ?: JsonObject(emptyMap()))
        m["id"] = str(id)
        m["title"] = str(f.titel.trim()); m["type"] = str(f.art); m["status"] = str(f.status); m["protocolType"] = str(f.protokollart)
        m["date"] = str(f.datum)
        m["startTime"] = str(f.beginn.trim())
        ersetze(m, "endTime", f.ende)
        m["location"] = str(f.ort.trim()); m["chairperson"] = str(f.leitung.trim()); m["minuteKeeper"] = str(f.schrift.trim())
        ersetze(m, "invitationDate", f.einladungsDatum); ersetze(m, "invitationMethod", f.einladungsWeg)
        m["invitationCompliant"] = JsonPrimitive(f.einladungOk); m["quorumConfirmed"] = JsonPrimitive(f.beschlussfaehig)
        val sb = zahl(f.stimmberechtigte)
        if (sb == null) m.remove("totalEligibleVoters") else m["totalEligibleVoters"] = JsonPrimitive(sb)
        val altTops = alt?.liste("agenda")?.associateBy { it.s("id") }.orEmpty()
        m["agenda"] = JsonArray(f.tops.mapIndexed { i, t ->
            val tm = LinkedHashMap<String, JsonElement>(altTops[t.id] ?: JsonObject(emptyMap()))
            tm["id"] = str(t.id); tm["number"] = str(nummer(i)); tm["title"] = str(t.titel.trim())
            ersetze(tm, "speaker", t.berichterstatter); ersetze(tm, "discussionNotes", t.notizen)
            val altB = (altTops[t.id]?.liste("resolutions")).orEmpty().associateBy { it.s("id") }
            if (t.beschluesse.isEmpty()) tm.remove("resolutions")
            else tm["resolutions"] = JsonArray(t.beschluesse.map { beschlussRaw(it, nummer(i), altB[it.id]) })
            JsonObject(tm)
        })
        val altA = alt?.liste("attendees")?.associateBy { it.s("id") }.orEmpty()
        m["attendees"] = JsonArray(f.teilnehmer.map { a ->
            val am = LinkedHashMap<String, JsonElement>(altA[a.id] ?: JsonObject(emptyMap()))
            am["id"] = str(a.id); am["name"] = str(a.name.trim()); am["role"] = str(a.rolle.trim())
            ersetze(am, "memberId", a.memberId); ersetze(am, "email", a.email)
            am["present"] = JsonPrimitive(a.anwesend); am["hasVotingRight"] = JsonPrimitive(a.stimmrecht); am["isSignatory"] = JsonPrimitive(a.unterzeichner)
            JsonObject(am)
        })
        ersetze(m, "generalNotes", f.notizen)
        m["createdAt"] = str(alt?.s("createdAt").orEmpty().ifEmpty { stempel }); m["updatedAt"] = str(stempel)
        val neu = JsonObject(m)
        store.put(AREA, id, neu)
        Sitzung.from(neu)
    }

    const val GESPERRT = "Das Protokoll ist unterschrieben und gesperrt. Entfernen Sie zuerst die Unterschriften, wenn Sie es ändern wollen."

    /** Löscht nur die Sitzung; ein archiviertes Protokoll-Dokument bleibt unberührt (der Desktop würde es mitlöschen). */
    fun loeschen(store: DocumentStore, id: String) = store.delete(AREA, id)

    // ---------- Unterschriften

    private fun hexOf(b: ByteArray) = b.joinToString("") { "%02x".format(it) }

    /** Fingerabdruck des Protokollinhalts (ohne Status, Unterschriften und Zeitstempel). Ändert sich der Text, passt er nicht mehr zu den Unterschriften. */
    fun inhaltsstempel(s: Sitzung): String {
        val sb = StringBuilder()
        fun p(vararg w: Any?) { sb.append(w.joinToString("\u001f") { it?.toString().orEmpty() }).append('\u001e') }
        p(s.titel, s.art, s.protokollart, s.datum, s.beginn, s.ende, s.ort, s.leitung, s.schrift, s.einladungsDatum, s.einladungsWeg, s.einladungOk, s.beschlussfaehig, s.stimmberechtigte, s.notizen)
        s.tops.forEach { t ->
            p("T", t.nummer, t.titel, t.berichterstatter, t.notizen)
            t.beschluesse.forEach { b -> p("B", b.nummer, b.titel, b.antrag, b.antragsteller, b.ja, b.nein, b.enthaltung, b.ergebnis, b.steuer, b.register, b.verantwortlich, b.frist, b.notiz) }
        }
        s.teilnehmer.forEach { a -> p("A", a.name, a.rolle, a.anwesend, a.stimmrecht, a.unterzeichner) }
        return hexOf(MessageDigest.getInstance("SHA-256").digest(sb.toString().toByteArray(Charsets.UTF_8))).take(32)
    }

    enum class Pruefung { GUELTIG, GEAENDERT, UNBEKANNT }

    /** Passt die Unterschrift noch zum Text? UNBEKANNT bei Unterschriften ohne Fingerabdruck (z. B. am Desktop erfasst). */
    fun pruefung(s: Sitzung, g: Signatur): Pruefung = when {
        g.inhalt.isEmpty() -> Pruefung.UNBEKANNT
        g.inhalt == inhaltsstempel(s) -> Pruefung.GUELTIG
        else -> Pruefung.GEAENDERT
    }

    private fun strichRaw(u: Unterschrift): Pair<JsonElement, JsonElement> {
        fun rund(v: Double): JsonElement = JsonPrimitive(String.format(java.util.Locale.ROOT, "%.4f", v.coerceIn(0.0, 1.0)).toDouble())
        return JsonPrimitive(u.seitenverhaeltnis) to JsonArray(u.striche.filter { it.size >= 2 }.map { st -> JsonArray(st.map { (x, y) -> JsonArray(listOf(rund(x), rund(y))) }) })
    }

    /**
     * Setzt die Unterschrift der Leitung ([ROLLE_LEITUNG]) oder der Schriftführung ([ROLLE_SCHRIFT]). [bildDatenUrl] ist die Unterschrift als
     * PNG-Data-URL (für den Desktop); die Linienzüge werden zusätzlich gespeichert und für das PDF gebraucht.
     * Mit der zweiten Unterschrift wird das Protokoll „Genehmigt“.
     */
    fun unterschreiben(
        store: DocumentStore, id: String, rolle: String, u: Unterschrift, bildDatenUrl: String, geraet: String = "Touch-Eingabe (Android)",
        now: ZonedDateTime = ZonedDateTime.now(),
    ): Sitzung = store.transaction {
        require(rolle == ROLLE_LEITUNG || rolle == ROLLE_SCHRIFT) { "Unbekannte Rolle." }
        val alt = store.get(AREA, id) ?: throw SitzungException("Die Sitzung gibt es nicht mehr.")
        val s = Sitzung.from(alt)
        if (s.status == "cancelled") throw SitzungException("Eine abgesagte Sitzung wird nicht unterschrieben.")
        if (u.leer) throw SitzungException("Bitte erst unterschreiben.")
        val name = (if (rolle == ROLLE_LEITUNG) s.leitung else s.schrift).trim()
        if (name.isEmpty()) throw SitzungException("Bitte zuerst den Namen der ${if (rolle == ROLLE_LEITUNG) "Versammlungsleitung" else "Protokollführung"} eintragen.")
        val stempel = inhaltsstempel(s)
        val (aspekt, strichJson) = strichRaw(u)
        val neue = JsonObject(linkedMapOf(
            "id" to str("sig-${now.toInstant().toEpochMilli()}-${Zeit.zufall(4)}"), "name" to str(name), "role" to str(rolle),
            "signatureDataUrl" to str(bildDatenUrl), "signedAt" to str(now.toInstant().toString()), "deviceInfo" to str(geraet),
            "contentHash" to str(stempel), "aspect" to aspekt, "strokes" to strichJson,
        ))
        val behalten = alt.liste("signatures").filter { Signatur.from(it).let { g -> if (rolle == ROLLE_LEITUNG) !g.istLeitung else !g.istSchrift } }
        val alle = behalten + neue
        val m = LinkedHashMap<String, JsonElement>(alt)
        m["signatures"] = JsonArray(alle)
        val sig = alle.map(Signatur::from)
        if (sig.any { it.istLeitung } && sig.any { it.istSchrift }) {
            m["status"] = str("approved"); m["signedAt"] = str(now.toLocalDate().toString())
        }
        m["updatedAt"] = str(Zeit.stempel(now))
        JsonObject(m).also { store.put(AREA, id, it) }.let { Sitzung.from(it) }
    }

    /** Nimmt alle Unterschriften zurück und entsperrt das Protokoll. Aus „Genehmigt“ wird „In Vorprüfung“; der Archiv-Verweis wird gelöst (das Dokument bleibt im Archiv). */
    fun unterschriftenEntfernen(store: DocumentStore, id: String, now: ZonedDateTime = ZonedDateTime.now()): Sitzung = store.transaction {
        val alt = store.get(AREA, id) ?: throw SitzungException("Die Sitzung gibt es nicht mehr.")
        val m = LinkedHashMap<String, JsonElement>(alt)
        m.remove("signatures"); m.remove("signedAt"); m.remove("documentId")
        if (alt.s("status") == "approved") m["status"] = str("review")
        m["updatedAt"] = str(Zeit.stempel(now))
        JsonObject(m).also { store.put(AREA, id, it) }.let { Sitzung.from(it) }
    }

    // ---------- Archiv

    fun dateiname(prefix: String, s: Sitzung, endung: String = "pdf"): String {
        val sicher = s.titel.replace(Regex("[^A-Za-z0-9äöüÄÖÜß_-]+"), "_").trim('_').ifEmpty { "Sitzung" }
        return "${prefix}_${s.datum}_$sicher.$endung"
    }

    fun imArchiv(store: DocumentStore, s: Sitzung): Boolean = s.dokumentId.isNotEmpty() && store.get(Dokumente.DOKUMENTE, s.dokumentId) != null

    /** Der Standardordner für das Protokoll dieser Sitzungsart; fehlende Standardordner werden dabei angelegt. */
    fun archivOrdnerId(art: String): String = when (art) {
        "general_assembly", "extraordinary_assembly" -> "folder-jhv"
        "board" -> "folder-vorstand"
        else -> "folder-protokolle"
    }

    private fun archivOrdner(store: DocumentStore, art: String, now: ZonedDateTime): String {
        val id = archivOrdnerId(art)
        if (store.get(Dokumente.ORDNER, id) == null) StandardOrdner.anlegenFehlende(store, now)
        return if (store.get(Dokumente.ORDNER, id) != null) id else ""
    }

    /** Legt das unterschriebene Protokoll als PDF in der Kategorie „Protokolle & Versammlungen“ ab und merkt sich das Dokument an der Sitzung. */
    fun archivieren(store: DocumentStore, files: FileStore, id: String, pdf: ByteArray, now: ZonedDateTime = ZonedDateTime.now()): Dokument {
        val s = sitzung(store, id) ?: throw SitzungException("Die Sitzung gibt es nicht mehr.")
        if (!s.vollstaendigUnterschrieben) throw SitzungException("Ins Archiv kommt nur ein Protokoll mit beiden Unterschriften.")
        if (imArchiv(store, s)) throw SitzungException("Das Protokoll liegt schon im Archiv.")
        val ordner = archivOrdner(store, s.art, now)
        val form = DokumentForm(
            id = DokumentStore.neueId(), titel = "Protokoll: ${s.titel} vom ${Zeit.deutsch(s.datum)}", kategorie = "protokolle",
            ordnerId = ordner, datum = s.datum, tags = "Protokoll, ${artName(s.art)}",
        )
        return store.transaction {
            val d = DokumentStore.neu(store, files, pdf, dateiname("Protokoll", s), "application/pdf", form, now)
            val m = LinkedHashMap<String, JsonElement>(store.get(AREA, id)!!)
            m["documentId"] = str(d.id)
            store.put(AREA, id, JsonObject(m))
            d
        }
    }

    // ---------- Auswertung

    data class Statistik(val gesamt: Int, val versammlungen: Int, val vorstand: Int, val angenommen: Int, val abgelehnt: Int, val vertagt: Int, val steuer: Int, val register: Int)

    /** Gezählt werden die Beschlüsse; Steuer- und Register-Kennzeichen nur bei angenommenen (der Desktop zählt auch abgelehnte als „rechtskräftig“). */
    fun statistik(liste: List<Sitzung>): Statistik {
        val b = liste.flatMap { it.beschluesse }
        return Statistik(
            liste.size, liste.count { it.istVersammlung }, liste.count { it.art == "board" },
            b.count { it.ergebnis == "accepted" }, b.count { it.ergebnis == "rejected" }, b.count { it.ergebnis == "deferred" },
            b.count { it.ergebnis == "accepted" && it.steuer }, b.count { it.ergebnis == "accepted" && it.register },
        )
    }

    fun filtern(liste: List<Sitzung>, suche: String, art: String?, status: String?): List<Sitzung> {
        val q = suche.trim().lowercase()
        return liste.filter { s ->
            (art == null || s.art == art) && (status == null || s.status == status) &&
                (q.isEmpty() || s.titel.lowercase().contains(q) || s.ort.lowercase().contains(q) || s.leitung.lowercase().contains(q) ||
                    s.tops.any { t -> t.titel.lowercase().contains(q) || t.notizen.lowercase().contains(q) || t.beschluesse.any { b -> b.titel.lowercase().contains(q) || b.antrag.lowercase().contains(q) } })
        }
    }

    data class BuchEintrag(val sitzung: Sitzung, val top: Top, val beschluss: Beschluss)

    /** Alle Beschlüsse, neueste Sitzung zuerst, innerhalb einer Sitzung in Reihenfolge der Tagesordnung. [kennzeichen]: null, "tax" oder "register". */
    fun beschlussbuch(liste: List<Sitzung>, kennzeichen: String?, suche: String): List<BuchEintrag> {
        val q = suche.trim().lowercase()
        return liste.sortedWith(compareByDescending<Sitzung> { it.datum }.thenByDescending { it.beginn }).flatMap { s ->
            s.tops.flatMap { t -> t.beschluesse.map { BuchEintrag(s, t, it) } }
        }.filter { e ->
            (kennzeichen != "tax" || e.beschluss.steuer) && (kennzeichen != "register" || e.beschluss.register) &&
                (q.isEmpty() || e.beschluss.titel.lowercase().contains(q) || e.beschluss.antrag.lowercase().contains(q) || e.sitzung.titel.lowercase().contains(q))
        }
    }

    // ---------- Voraussetzungen für die PDFs

    /** Was für die Einladung noch fehlt (leer = möglich). Es wird nichts erfunden: ohne Beginn und Ort gibt es keine Einladung. */
    fun einladungFehlt(s: Sitzung): List<String> = buildList {
        if (datum(s.datum) == null) add("Datum")
        if (s.beginn.isBlank()) add("Uhrzeit")
        if (s.ort.isBlank()) add("Ort")
        if (s.tops.isEmpty()) add("Tagesordnung")
    }

    /** Die angenommenen Beschlüsse, die für das Vereinsregister gekennzeichnet sind. */
    fun registerBeschluesse(s: Sitzung): List<Pair<Top, Beschluss>> =
        s.tops.flatMap { t -> t.beschluesse.filter { it.ergebnis == "accepted" && it.register }.map { t to it } }

    /** Ein Registerauszug nur bei bestätigter Beschlussfähigkeit und mindestens einem angenommenen, gekennzeichneten Beschluss. */
    fun auszugFehlt(s: Sitzung): String? = when {
        registerBeschluesse(s).isEmpty() -> "Kein angenommener Beschluss ist für das Vereinsregister gekennzeichnet."
        !s.beschlussfaehig -> "Die Beschlussfähigkeit ist nicht als festgestellt angekreuzt."
        else -> null
    }

    // ---------- Mail

    data class Empfaenger(val name: String, val email: String, val teilnehmer: Boolean)

    /** Erst die Teilnehmer der Sitzung (ihre Adresse, sonst die aus den Mitgliedern), dann alle aktiven Mitglieder mit Adresse. Jede Adresse nur einmal. */
    fun empfaenger(s: Sitzung, mitglieder: List<Member>): List<Empfaenger> {
        val gesehen = HashSet<String>()
        val aus = ArrayList<Empfaenger>()
        fun add(name: String, mail: String, t: Boolean) {
            val m = mail.trim()
            if (m.contains('@') && gesehen.add(m.lowercase())) aus.add(Empfaenger(name, m, t))
        }
        s.teilnehmer.forEach { a ->
            val mitglied = mitglieder.firstOrNull { it.id == a.memberId && a.memberId.isNotEmpty() }
            add(a.name, a.email.ifBlank { mitglied?.email.orEmpty() }, true)
        }
        mitglieder.filter { it.status == "active" }.sortedBy { it.displayName.lowercase() }.forEach { add(it.displayName, it.email, false) }
        return aus
    }

    enum class MailArt { EINLADUNG, PROTOKOLL }

    fun mailBetreff(s: Sitzung, art: MailArt): String =
        (if (art == MailArt.EINLADUNG) "Einladung: ${s.titel} am ${Zeit.deutsch(s.datum)}" else "Protokoll: ${s.titel} vom ${Zeit.deutsch(s.datum)}")

    /** Mailtext ohne erfundene Floskeln; Vereinsname und Leitung erscheinen nur, wenn sie eingetragen sind. */
    fun mailText(s: Sitzung, art: MailArt, verein: String): String = buildString {
        appendLine("Liebe Mitglieder,")
        appendLine()
        if (art == MailArt.EINLADUNG) {
            appendLine("wir laden herzlich zu dieser Sitzung ein:")
            appendLine()
            appendLine("Sitzung: ${s.titel}")
            appendLine("Wann: ${Zeit.deutsch(s.datum)}" + if (s.beginn.isNotBlank()) ", ${s.beginn} Uhr" + (if (s.ende.isNotBlank()) " bis ca. ${s.ende} Uhr" else "") else "")
            if (s.ort.isNotBlank()) appendLine("Wo: ${s.ort}")
            if (s.tops.isNotEmpty()) {
                appendLine()
                appendLine("Tagesordnung:")
                s.tops.forEach { appendLine("- ${it.nummer}: ${it.titel}") }
            }
        } else {
            appendLine("hier das Protokoll zur Sitzung:")
            appendLine()
            appendLine("Sitzung: ${s.titel}")
            appendLine("Datum: ${Zeit.deutsch(s.datum)}")
            if (s.leitung.isNotBlank()) appendLine("Leitung: ${s.leitung}")
            if (s.schrift.isNotBlank()) appendLine("Protokoll: ${s.schrift}")
            val b = s.beschluesse.count { it.ergebnis == "accepted" }
            if (b > 0) appendLine("Gefasste Beschlüsse: $b")
            if (!s.vollstaendigUnterschrieben) { appendLine(); appendLine("Hinweis: Das Protokoll ist noch nicht genehmigt.") }
        }
        if (verein.isNotBlank() || s.leitung.isNotBlank()) {
            appendLine()
            appendLine("Mit freundlichen Grüßen")
            if (s.leitung.isNotBlank()) appendLine(s.leitung)
            if (verein.isNotBlank()) append(verein)
        }
    }.trimEnd()
}
