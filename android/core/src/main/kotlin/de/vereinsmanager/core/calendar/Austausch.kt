package de.vereinsmanager.core.calendar

import de.vereinsmanager.core.export.Csv
import de.vereinsmanager.core.importe.Tabellen
import de.vereinsmanager.core.members.CsvTable
import de.vereinsmanager.core.members.Zeit
import de.vereinsmanager.core.store.DocumentStore
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.ZoneId
import java.time.ZoneOffset
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter

/** Gelesene Termine als fertige Dokumente (noch nicht gespeichert) und Hinweise für die Anzeige. */
data class TerminLesung(val termine: List<JsonObject>, val hinweise: List<String>)

/** Austausch mit anderen Kalendern: iCal (.ics) und Tabellen (CSV). */
object Austausch {
    private val ICS_UTC = DateTimeFormatter.ofPattern("yyyyMMdd'T'HHmmss'Z'")
    private val BERLIN = ZoneId.of("Europe/Berlin")
    private const val UID_ENDUNG = "@vereinsmanager.lokal"
    private val TAGCODES = listOf("SU", "MO", "TU", "WE", "TH", "FR", "SA")

    // ---------- iCal schreiben ----------

    private fun maskieren(s: String) = s.replace("\\", "\\\\").replace(";", "\\;").replace(",", "\\,").replace("\r", "").replace("\n", "\\n")

    /** Zeilen länger als 75 Byte werden gefaltet (Fortsetzung mit einem Leerzeichen), wie es RFC 5545 verlangt. */
    private fun falten(zeile: String): String {
        if (zeile.toByteArray(Charsets.UTF_8).size <= 75) return zeile
        val sb = StringBuilder()
        var bytes = 0
        var grenze = 75
        var i = 0
        while (i < zeile.length) {
            val cp = zeile.codePointAt(i)
            val teil = String(Character.toChars(cp))
            val n = teil.toByteArray(Charsets.UTF_8).size
            if (bytes + n > grenze) { sb.append("\r\n "); bytes = 1; grenze = 75 }
            sb.append(teil); bytes += n; i += teil.length
        }
        return sb.toString()
    }

    private fun tagText(iso: String) = iso.replace("-", "")
    private fun zeitText(iso: String, zeit: String) = tagText(iso) + "T" + zeit.replace(":", "").padEnd(4, '0').take(4) + "00"

    /**
     * Termine als gültige iCal-Datei. Zeiten stehen ohne Zeitzone (gelten dort, wo der Kalender sie öffnet).
     * [mitTeilnehmern]: Teilnehmer mit E-Mail-Adresse als ATTENDEE aufnehmen; Teilnehmer ohne Adresse erhalten keine erfundene (der Desktop erfindet eine).
     */
    fun icsSchreiben(termine: List<Termin>, arten: List<Terminart>, kalenderName: String, jetzt: ZonedDateTime = ZonedDateTime.now(), mitTeilnehmern: Boolean = false): String {
        val namen = arten.associate { it.id to it.name }
        val z = ArrayList<String>()
        z += "BEGIN:VCALENDAR"; z += "VERSION:2.0"; z += "PRODID:-//VereinsManager//Terminkalender//DE"; z += "CALSCALE:GREGORIAN"; z += "METHOD:PUBLISH"
        z += "X-WR-CALNAME:${maskieren(kalenderName)}"
        val stempel = jetzt.withZoneSameInstant(ZoneOffset.UTC).format(ICS_UTC)
        for (t in termine) {
            z += "BEGIN:VEVENT"
            z += "UID:" + (if (t.id.contains('@')) t.id else t.id + UID_ENDUNG)
            z += "DTSTAMP:$stempel"
            val ende = t.ende.ifEmpty { t.beginn }
            if (t.ganztaegig || t.beginnZeit.isEmpty()) {
                z += "DTSTART;VALUE=DATE:${tagText(t.beginn)}"
                // Bei ganztägigen Terminen ist das Ende nicht eingeschlossen: Folgetag.
                z += "DTEND;VALUE=DATE:${tagText(LocalDate.parse(ende).plusDays(1).toString())}"
            } else {
                z += "DTSTART:${zeitText(t.beginn, t.beginnZeit)}"
                z += "DTEND:${zeitText(ende, t.endeZeit.ifEmpty { t.beginnZeit })}"
            }
            z += "SUMMARY:${maskieren(t.titel)}"
            if (t.beschreibung.isNotBlank()) z += "DESCRIPTION:${maskieren(t.beschreibung)}"
            if (t.ort.isNotBlank()) z += "LOCATION:${maskieren(t.ort)}"
            val lat = (t.raw["locationLat"] as? JsonPrimitive)?.content?.toDoubleOrNull()
            val lng = (t.raw["locationLng"] as? JsonPrimitive)?.content?.toDoubleOrNull()
            if (lat != null && lng != null) z += "GEO:${"%.6f".format(java.util.Locale.ROOT, lat)};${"%.6f".format(java.util.Locale.ROOT, lng)}"
            z += "CATEGORIES:${maskieren(namen[t.art] ?: "Allgemein")}"
            t.serie?.let { s ->
                var r = "RRULE:FREQ=${s.frequenz.uppercase()}"
                if (s.intervall > 1) r += ";INTERVAL=${s.intervall}"
                if (s.frequenz == "weekly" && s.wochentage.isNotEmpty()) r += ";BYDAY=" + s.wochentage.sortedBy { (it + 6) % 7 }.joinToString(",") { TAGCODES[it] }
                if (s.endeArt == "until_date" && s.bis.isNotEmpty()) {
                    // UNTIL hat dieselbe Form wie DTSTART: Datum bei ganztägigen, sonst Datum mit Uhrzeit (ohne Zeitzone).
                    r += if (t.ganztaegig || t.beginnZeit.isEmpty()) ";UNTIL=${tagText(s.bis)}" else ";UNTIL=${tagText(s.bis)}T235959"
                } else if (s.endeArt == "count" && s.anzahl > 0) r += ";COUNT=${s.anzahl}"
                z += r
                // Ausgenommene Tage in derselben Form wie DTSTART
                if (s.ausnahmen.isNotEmpty()) z += if (t.ganztaegig || t.beginnZeit.isEmpty()) "EXDATE;VALUE=DATE:" + s.ausnahmen.joinToString(",") { tagText(it) }
                else "EXDATE:" + s.ausnahmen.joinToString(",") { zeitText(it, t.beginnZeit) }
            }
            if (mitTeilnehmern) for (p in t.teilnehmer) {
                if (!p.email.contains('@')) continue
                val stat = when (p.status) { "confirmed", "attended" -> "ACCEPTED"; "declined" -> "DECLINED"; else -> "NEEDS-ACTION" }
                z += "ATTENDEE;CN=${maskieren(p.name).replace(":", " ")};ROLE=${if (p.rolle == "organizer") "REQ-PARTICIPANT" else "OPT-PARTICIPANT"};PARTSTAT=$stat:mailto:${p.email.trim()}"
            }
            z += "END:VEVENT"
        }
        z += "END:VCALENDAR"
        return z.joinToString("\r\n") { falten(it) } + "\r\n"
    }

    // ---------- iCal lesen ----------

    private fun entmaskieren(s: String): String {
        val sb = StringBuilder()
        var i = 0
        while (i < s.length) {
            val c = s[i]
            if (c == '\\' && i + 1 < s.length) {
                when (val n = s[i + 1]) { 'n', 'N' -> sb.append('\n'); ',', ';', '\\' -> sb.append(n); else -> { sb.append(c); sb.append(n) } }
                i += 2
            } else { sb.append(c); i++ }
        }
        return sb.toString()
    }

    private class Zeitpunkt(val datum: String, val zeit: String, val nurDatum: Boolean)

    private fun zeitpunkt(kopf: List<String>, wert: String): Zeitpunkt? {
        val w = wert.trim()
        val params = kopf.drop(1).associate { p -> p.substringBefore('=').uppercase() to p.substringAfter('=', "") }
        val ziffern = Regex("^(\\d{4})(\\d{2})(\\d{2})(?:T(\\d{2})(\\d{2})(\\d{2})?)?(Z)?$").find(w) ?: return null
        val (j, m, t) = listOf(ziffern.groupValues[1], ziffern.groupValues[2], ziffern.groupValues[3])
        val datum = runCatching { LocalDate.of(j.toInt(), m.toInt(), t.toInt()) }.getOrNull() ?: return null
        if (ziffern.groupValues[4].isEmpty() || params["VALUE"]?.uppercase() == "DATE") return Zeitpunkt(datum.toString(), "", true)
        var ldt = LocalDateTime.of(datum, java.time.LocalTime.of(ziffern.groupValues[4].toInt(), ziffern.groupValues[5].toInt()))
        // Zeiten in UTC oder mit fremder Zeitzone werden in die Ortszeit des Vereins (Berlin) umgerechnet.
        val quelle = when {
            ziffern.groupValues[7] == "Z" -> ZoneOffset.UTC as java.time.ZoneId
            params["TZID"] != null -> runCatching { ZoneId.of(params["TZID"]!!.trim('"')) }.getOrNull()
            else -> null
        }
        if (quelle != null) ldt = ZonedDateTime.of(ldt, quelle).withZoneSameInstant(BERLIN).toLocalDateTime()
        return Zeitpunkt(ldt.toLocalDate().toString(), "%02d:%02d".format(ldt.hour, ldt.minute), false)
    }

    private fun artFinden(roh: String, arten: List<Terminart>): String {
        val r = roh.trim().lowercase()
        if (r.isEmpty()) return "cat-general"
        arten.firstOrNull { it.name.lowercase() == r }?.let { return it.id }
        return arten.firstOrNull { it.name.lowercase().contains(r) || r.contains(it.name.lowercase()) }?.id ?: "cat-general"
    }

    private fun dokument(
        id: String, titel: String, beschreibung: String, art: String, sparte: String, beginn: String, beginnZeit: String, ende: String, endeZeit: String,
        ganztaegig: Boolean, ort: String, geo: Pair<Double, Double>?, serie: JsonObject?, stempel: String,
    ): JsonObject {
        val m = LinkedHashMap<String, JsonElement>()
        m["id"] = JsonPrimitive(id); m["title"] = JsonPrimitive(titel)
        if (beschreibung.isNotBlank()) m["description"] = JsonPrimitive(beschreibung.trim())
        m["categoryId"] = JsonPrimitive(art); m["department"] = JsonPrimitive(sparte)
        m["startDate"] = JsonPrimitive(beginn)
        if (!ganztaegig && beginnZeit.isNotEmpty()) m["startTime"] = JsonPrimitive(beginnZeit)
        m["endDate"] = JsonPrimitive(ende)
        if (!ganztaegig && endeZeit.isNotEmpty()) m["endTime"] = JsonPrimitive(endeZeit)
        m["isAllDay"] = JsonPrimitive(ganztaegig)
        if (ort.isNotBlank()) m["location"] = JsonPrimitive(ort.trim())
        if (geo != null) { m["locationLat"] = JsonPrimitive(geo.first); m["locationLng"] = JsonPrimitive(geo.second) }
        if (serie != null) m["recurrence"] = serie
        m["participants"] = JsonArray(emptyList())
        m["createdAt"] = JsonPrimitive(stempel); m["updatedAt"] = JsonPrimitive(stempel)
        return JsonObject(m)
    }

    /**
     * Liest iCal-Text. Teilnehmer (ATTENDEE) werden nicht übernommen. Eine Wiederholungsregel, die der Kalender nicht abbilden kann
     * (z. B. „jeden ersten Montag“) wird als Hinweis gemeldet, der Termin kommt dann ohne Wiederholung.
     * Ganztägige Termine: Das Ende in der Datei ist der Folgetag und wird zurückgerechnet (der Desktop verlängert sie beim Import um einen Tag).
     */
    fun icsLesen(text: String, arten: List<Terminart>, jetzt: ZonedDateTime = ZonedDateTime.now()): TerminLesung {
        val hinweise = ArrayList<String>()
        val termine = ArrayList<JsonObject>()
        val stempel = Zeit.stempel(jetzt)
        val zeilen = text.replace(Regex("\r?\n[ \t]"), "").split(Regex("\r\n|\r|\n"))
        var drin = false
        var eigenschaften = ArrayList<Pair<List<String>, String>>()
        var nr = 0
        for (roh in zeilen) {
            val zeile = roh.trimEnd()
            if (zeile.equals("BEGIN:VEVENT", true)) { drin = true; eigenschaften = ArrayList(); continue }
            if (zeile.equals("END:VEVENT", true) && drin) {
                drin = false; nr++
                val p = eigenschaften
                fun erste(name: String) = p.firstOrNull { it.first[0].uppercase() == name }
                val titel = erste("SUMMARY")?.second?.let { entmaskieren(it).trim() }.orEmpty()
                val s = erste("DTSTART")?.let { zeitpunkt(it.first, it.second) }
                if (titel.isEmpty() || s == null) { hinweise += "Termin $nr übersprungen: Titel oder Beginn fehlt."; continue }
                val e = erste("DTEND")?.let { zeitpunkt(it.first, it.second) }
                var ende = e?.datum ?: s.datum
                if (s.nurDatum && e != null) ende = LocalDate.parse(e.datum).minusDays(1).toString()
                if (ende < s.datum) ende = s.datum
                var serie: JsonObject? = null
                erste("RRULE")?.let { (_, w) ->
                    val teile = w.split(';').mapNotNull { it.split('=', limit = 2).takeIf { x -> x.size == 2 }?.let { x -> x[0].uppercase() to x[1] } }.toMap()
                    val f = teile["FREQ"]?.uppercase()
                    val ok = f in setOf("DAILY", "WEEKLY", "MONTHLY", "YEARLY", "BIWEEKLY")
                    val kompliziert = teile.keys.any { it in setOf("BYSETPOS", "BYMONTHDAY", "BYMONTH", "BYYEARDAY", "BYWEEKNO") } ||
                        (teile["BYDAY"]?.split(',')?.any { !Regex("^[A-Z]{2}$").matches(it.trim().uppercase()) } == true)
                    if (!ok || kompliziert) hinweise += "„$titel“: Die Wiederholung (${w.take(40)}) lässt sich nicht abbilden; der Termin wurde ohne Wiederholung übernommen."
                    else {
                        val m = LinkedHashMap<String, JsonElement>()
                        val iv = (teile["INTERVAL"]?.toIntOrNull() ?: 1).coerceAtLeast(1)
                        val frequenz = if (f == "BIWEEKLY") "weekly" else f!!.lowercase()
                        m["frequency"] = JsonPrimitive(frequenz); m["interval"] = JsonPrimitive(if (f == "BIWEEKLY") iv * 2 else iv)
                        if (frequenz == "weekly") {
                            val tage = teile["BYDAY"]?.split(',')?.mapNotNull { TAGCODES.indexOf(it.trim().uppercase()).takeIf { i -> i >= 0 } }.orEmpty()
                                .ifEmpty { listOf(LocalDate.parse(s.datum).dayOfWeek.value % 7) }
                            m["daysOfWeek"] = JsonArray(tage.map { JsonPrimitive(it) })
                        }
                        val bis = teile["UNTIL"]?.let { u -> Regex("^(\\d{4})(\\d{2})(\\d{2})").find(u)?.let { "${it.groupValues[1]}-${it.groupValues[2]}-${it.groupValues[3]}" } }
                        val anzahl = teile["COUNT"]?.toIntOrNull()
                        when {
                            anzahl != null && anzahl > 0 -> { m["endType"] = JsonPrimitive("count"); m["count"] = JsonPrimitive(anzahl) }
                            bis != null -> { m["endType"] = JsonPrimitive("until_date"); m["untilDate"] = JsonPrimitive(bis) }
                            else -> m["endType"] = JsonPrimitive("never")
                        }
                        serie = JsonObject(m)
                    }
                }
                // Ausgenommene Tage (EXDATE, auch mehrfach und mit Komma getrennt)
                val ausnahmen = p.filter { it.first[0].uppercase() == "EXDATE" }
                    .flatMap { (kopf, w) -> w.split(',').mapNotNull { zeitpunkt(kopf, it)?.datum } }.distinct().sorted()
                if (ausnahmen.isNotEmpty() && serie != null) {
                    serie = JsonObject(serie!! + ("exceptionDates" to JsonArray(ausnahmen.map { JsonPrimitive(it) })))
                }
                val geo = erste("GEO")?.second?.split(';')?.let { g -> g.getOrNull(0)?.toDoubleOrNull()?.let { a -> g.getOrNull(1)?.toDoubleOrNull()?.let { b -> a to b } } }
                val uid = erste("UID")?.second?.trim()?.removeSuffix(UID_ENDUNG)?.takeIf { it.isNotEmpty() }
                val id = uid ?: "evt-import-${jetzt.toInstant().toEpochMilli()}-$nr"
                termine += dokument(
                    id, titel, erste("DESCRIPTION")?.second?.let { entmaskieren(it) }.orEmpty(),
                    artFinden(erste("CATEGORIES")?.second?.let { entmaskieren(it).substringBefore(',') }.orEmpty(), arten), Kalender.ALLE_SPARTEN,
                    s.datum, s.zeit, ende, e?.zeit.orEmpty(), s.nurDatum, erste("LOCATION")?.second?.let { entmaskieren(it) }.orEmpty(), geo, serie, stempel,
                )
                continue
            }
            if (!drin) continue
            val i = zeile.indexOf(':')
            if (i < 0) continue
            // Der Doppelpunkt in Parameterwerten in Anführungszeichen ist selten; hier genügt der erste.
            eigenschaften += zeile.substring(0, i).split(';') to zeile.substring(i + 1)
        }
        val attendees = text.lines().count { it.startsWith("ATTENDEE", true) }
        if (attendees > 0) hinweise += "Teilnehmerlisten ($attendees Einträge) werden nicht übernommen."
        return TerminLesung(termine, hinweise)
    }

    // ---------- CSV ----------

    val CSV_KOPF = listOf("Titel", "Kategorie", "Abteilung", "Startdatum", "Startzeit", "Enddatum", "Endzeit", "Ganztägig", "Ort", "Wiederholung", "Teilnehmer", "Beschreibung")

    /** Wie am Desktop: gleiche Spalten, Datum als JJJJ-MM-TT; die Wiederholung steht in Worten. */
    fun csvSchreiben(termine: List<Termin>, arten: List<Terminart>): String {
        val namen = arten.associate { it.id to it.name }
        return Csv.schreiben(
            CSV_KOPF,
            termine.map { t ->
                listOf(
                    t.titel, namen[t.art] ?: "Allgemein", if (t.sparte == Kalender.ALLE_SPARTEN) "Alle Abteilungen" else t.sparte, t.beginn,
                    if (t.ganztaegig) "Ganztägig" else t.beginnZeit, t.ende.ifEmpty { t.beginn }, if (t.ganztaegig) "Ganztägig" else t.endeZeit,
                    if (t.ganztaegig) "Ja" else "Nein", t.ort, t.serie?.let { Kalender.serieText(it) } ?: "Keine",
                    t.teilnehmer.joinToString("; ") { "${it.name} (${Kalender.STATUS[it.status] ?: it.status})" }, Csv.einzeilig(t.beschreibung),
                )
            },
        )
    }

    private val ALIASE = mapOf(
        "titel" to listOf("titel", "title", "betreff", "name", "summary", "bezeichnung"),
        "start" to listOf("startdatum", "startdate", "datum", "start", "date", "beginn"),
        "ende" to listOf("enddatum", "enddate", "ende", "bis"),
        "startzeit" to listOf("startzeit", "starttime", "uhrzeit", "beginnzeit"),
        "endzeit" to listOf("endzeit", "endtime"),
        "ganztag" to listOf("ganztaegig", "allday", "ganztag"),
        "ort" to listOf("ort", "location", "adresse", "veranstaltungsort"),
        "text" to listOf("beschreibung", "description", "notizen", "details"),
        "sparte" to listOf("abteilung", "department", "sparte"),
        "art" to listOf("kategorie", "category", "terminart", "art"),
    )

    private fun uhrzeit(s: String): String? {
        val m = Regex("^(\\d{1,2})[:.](\\d{2})(?:[:.]\\d{2})?(?:\\s*Uhr)?$", RegexOption.IGNORE_CASE).find(s.trim()) ?: return null
        val h = m.groupValues[1].toInt(); val min = m.groupValues[2].toInt()
        return if (h in 0..23 && min in 0..59) "%02d:%02d".format(h, min) else null
    }

    /** Liest eine Tabelle (aus CSV oder Excel) mit den Spalten, die auch [csvSchreiben] erzeugt, und gängigen Alternativnamen. */
    fun csvLesen(tabelle: CsvTable, arten: List<Terminart>, jetzt: ZonedDateTime = ZonedDateTime.now()): TerminLesung {
        val hinweise = ArrayList<String>()
        val termine = ArrayList<JsonObject>()
        val stempel = Zeit.stempel(jetzt)
        val normiert = tabelle.headers.associateBy { Tabellen.norm(it) }
        fun spalte(feld: String) = ALIASE[feld]!!.firstNotNullOfOrNull { normiert[it] }
        if (spalte("titel") == null) return TerminLesung(emptyList(), listOf("Die Spalte „Titel“ fehlt."))
        if (spalte("start") == null) return TerminLesung(emptyList(), listOf("Die Spalte „Startdatum“ fehlt."))
        tabelle.rows.forEachIndexed { i, z ->
            val zeile = i + 2
            fun w(feld: String) = spalte(feld)?.let { z[it] }?.trim().orEmpty()
            val titel = w("titel")
            if (titel.isEmpty()) { hinweise += "Zeile $zeile übersprungen: kein Titel."; return@forEachIndexed }
            val beginn = Tabellen.datum(w("start"))
            if (beginn == null) { hinweise += "Zeile $zeile („$titel“) übersprungen: Startdatum fehlt oder ist ungültig."; return@forEachIndexed }
            var ende = w("ende").takeIf { it.isNotEmpty() }?.let { Tabellen.datum(it) } ?: beginn
            if (ende < beginn) { hinweise += "Zeile $zeile („$titel“): Das Ende lag vor dem Beginn und wurde auf den Beginn gesetzt."; ende = beginn }
            val ganztag = w("ganztag").lowercase().let { it.startsWith("j") || it == "true" || it == "1" || it == "yes" } || w("startzeit").lowercase().startsWith("ganzt")
            val sp = w("sparte").let { if (it.isEmpty() || it.lowercase().startsWith("alle")) Kalender.ALLE_SPARTEN else it }
            val bz = uhrzeit(w("startzeit")).orEmpty()
            if (!ganztag && w("startzeit").isNotEmpty() && bz.isEmpty()) hinweise += "Zeile $zeile („$titel“): Startzeit „${w("startzeit")}“ nicht lesbar, der Termin hat keine Uhrzeit."
            termine += dokument(
                "evt-csv-${jetzt.toInstant().toEpochMilli()}-${i + 1}", titel, w("text"), artFinden(w("art"), arten), sp, beginn, bz, ende,
                uhrzeit(w("endzeit")).orEmpty(), ganztag, w("ort"), null, null, stempel,
            )
        }
        return TerminLesung(termine, hinweise)
    }

    // ---------- Speichern ----------

    /**
     * Speichert gelesene Termine. Schon vorhandene (gleiche Kennung oder gleicher Titel, gleicher Tag und gleiche Uhrzeit) werden
     * übersprungen; der Desktop überschreibt bei gleicher Kennung stillschweigend.
     */
    fun importieren(store: DocumentStore, lesung: TerminLesung): ImportBericht = store.transaction {
        val vorhanden = Kalender.alle(store)
        val ids = vorhanden.map { it.id }.toHashSet()
        val schluessel = vorhanden.map { Triple(it.titel.trim().lowercase(), it.beginn, it.beginnZeit) }.toHashSet()
        var neu = 0
        var skip = 0
        for (d in lesung.termine) {
            val t = Termin.from(d)
            val k = Triple(t.titel.trim().lowercase(), t.beginn, t.beginnZeit)
            if (t.id in ids || k in schluessel) { skip++; continue }
            store.put(Kalender.AREA, t.id, d)
            ids += t.id; schluessel += k; neu++
        }
        ImportBericht(neu, skip)
    }
}
