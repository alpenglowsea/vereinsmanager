package de.vereinsmanager.core.finance

import de.vereinsmanager.core.backup.BackupPaket
import de.vereinsmanager.core.backup.Dateityp
import de.vereinsmanager.core.backup.Dateiverwaltung
import de.vereinsmanager.core.backup.text
import de.vereinsmanager.core.files.Dateinamen
import de.vereinsmanager.core.files.FileStore
import de.vereinsmanager.core.files.putBytes
import de.vereinsmanager.core.members.Zeit
import de.vereinsmanager.core.store.DocumentStore
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import java.time.ZonedDateTime
import java.util.UUID

class BelegException(message: String) : Exception(message)

/** Was beim Anhängen entstanden ist, für die Rückmeldung an den Anwender. */
data class BelegErgebnis(val dateiName: String, val ordnerName: String, val ersetzt: Boolean)

/**
 * Belege an Buchungen. Wie am Desktop steht der Beleg doppelt im Bestand: als `receipt` an der Buchung und als
 * Dokument `doc-receipt-<Buchungs-Id>` (Kategorie „belege") im Dokumentenarchiv; beide zeigen auf dieselbe Datei im
 * [FileStore]. Das Dokument liegt im Ordner „Belege <Jahr>" unter „Buchhaltungsbelege & Finanzen" (wird bei Bedarf angelegt).
 */
object Belege {
    /** Wie am Desktop: größer als 8 MB wird nicht angenommen. */
    const val MAX_GROESSE = 8L * 1024 * 1024

    const val HAUPTORDNER_ID = "folder-belege"
    const val HAUPTORDNER_NAME = "Buchhaltungsbelege & Finanzen"

    private const val DOKUMENTE = "documents"
    private const val ORDNER = "folders"
    private val ERLAUBT = setOf("pdf", "jpg", "png", "webp", "gif")

    fun dokumentId(buchungId: String) = "doc-receipt-$buchungId"

    /** Die Kennung der Datei, die an der Buchung hängt (null: kein Beleg oder Beleg ohne Datei). */
    fun dateiId(buchung: JsonObject?): String? =
        (buchung?.get("receipt") as? JsonObject)?.text("fileId")?.takeIf { it.isNotEmpty() }

    /** Prüft Größe und Dateityp (an den ersten Bytes, nicht am Namen) und gibt die Endung zurück. */
    fun pruefen(bytes: ByteArray): String {
        if (bytes.isEmpty()) throw BelegException("Die Datei ist leer.")
        if (bytes.size > MAX_GROESSE) {
            throw BelegException("Die Datei ist zu groß (${bytes.size / 1024 / 1024} MB). Erlaubt sind höchstens ${MAX_GROESSE / 1024 / 1024} MB.")
        }
        val endung = Dateityp.erkennen(bytes.copyOf(minOf(bytes.size, 16)))
        if (endung == null || endung !in ERLAUBT) throw BelegException("Dieser Dateityp wird nicht unterstützt. Möglich sind PDF und Bilder (JPEG, PNG).")
        return endung
    }

    /** „2026-03-01 Sportshop BE-2026-010.pdf" – dasselbe Schema wie im Sicherungspaket. */
    fun dateiName(datum: String, partner: String, nummer: String, endung: String): String {
        val roh = listOf(datum, partner, nummer).map { it.trim() }.filter { it.isNotEmpty() }.joinToString(" ").ifEmpty { "Beleg" }
        return Dateinamen.bereinigen("$roh.$endung")
    }

    private fun jahr(datum: String): String? = datum.trim().take(4).takeIf { it.length == 4 && it.all(Char::isDigit) }

    private fun zufall() = UUID.randomUUID().toString().replace("-", "").take(10)

    private fun s(v: String) = JsonPrimitive(v)

    private fun parentId(o: JsonObject): String? = (o["parentId"] as? JsonPrimitive)?.takeIf { it !is JsonNull }?.content?.takeIf { it.isNotEmpty() }

    /** Findet oder legt einen Unterordner [name] unter [elternId] an. Gibt dessen Kennung zurück. */
    internal fun unterordner(store: DocumentStore, elternId: String, name: String, beschreibung: String, stempel: String): String {
        store.all(ORDNER).firstOrNull { parentId(it) == elternId && it.text("name") == name }?.text("id")?.let { return it }
        val id = "folder-" + zufall()
        store.put(
            ORDNER, id,
            JsonObject(
                linkedMapOf(
                    "id" to s(id), "name" to s(name), "parentId" to s(elternId), "category" to s("belege"), "color" to s("#10b981"),
                    "description" to s(beschreibung), "createdAt" to s(stempel), "updatedAt" to s(stempel),
                ),
            ),
        )
        return id
    }

    /** Findet oder legt an: „Buchhaltungsbelege & Finanzen" und darunter „Belege <Jahr>". Gibt die Kennung des Zielordners zurück. */
    internal fun zielOrdner(store: DocumentStore, jahr: String?, stempel: String): String {
        val alle = store.all(ORDNER)
        val haupt = alle.firstOrNull { it.text("id") == HAUPTORDNER_ID }
            ?: alle.firstOrNull { it.text("name") == HAUPTORDNER_NAME && parentId(it) == null }
        val hauptId = haupt?.text("id") ?: run {
            val id = if (store.get(ORDNER, HAUPTORDNER_ID) == null) HAUPTORDNER_ID else "folder-" + zufall()
            store.put(
                ORDNER, id,
                JsonObject(
                    linkedMapOf(
                        "id" to s(id), "name" to s(HAUPTORDNER_NAME), "category" to s("belege"), "color" to s("#10b981"),
                        "description" to s("Ein- und Ausgangsrechnungen, Quittungen und Spendenbelege"),
                        "createdAt" to s(stempel), "updatedAt" to s(stempel),
                    ),
                ),
            )
            id
        }
        if (jahr == null) return hauptId
        val name = "Belege $jahr"
        alle.firstOrNull { parentId(it) == hauptId && it.text("name") == name }?.text("id")?.let { return it }
        val id = if (store.get(ORDNER, "folder-belege-$jahr") == null) "folder-belege-$jahr" else "folder-" + zufall()
        store.put(
            ORDNER, id,
            JsonObject(
                linkedMapOf(
                    "id" to s(id), "name" to s(name), "parentId" to s(hauptId), "category" to s("belege"), "color" to s("#10b981"),
                    "description" to s("Rechnungen und Zahlungsnachweise des Geschäftsjahres $jahr"),
                    "createdAt" to s(stempel), "updatedAt" to s(stempel),
                ),
            ),
        )
        return id
    }

    /**
     * Hängt [bytes] als Beleg an die Buchung; ein schon vorhandener Beleg wird ersetzt. Alles oder nichts: Geht beim
     * Speichern etwas schief, bleibt der Bestand wie vorher und die neue Datei wird wieder entfernt.
     */
    fun anhaengen(
        store: DocumentStore, files: FileStore, buchungId: String, bytes: ByteArray,
        now: ZonedDateTime = ZonedDateTime.now(),
    ): BelegErgebnis {
        val endung = pruefen(bytes)
        val buchung = store.get(Finance.BUCHUNGEN, buchungId) ?: throw BelegException("Die Buchung gibt es nicht mehr.")
        val datum = buchung.text("date").orEmpty()
        val nummer = buchung.text("documentNumber").orEmpty()
        val partner = buchung.text("partner").orEmpty()
        val text = buchung.text("bookingText").orEmpty()
        val name = dateiName(datum, partner, nummer, endung)
        val mime = Dateityp.mimeZu(endung) ?: "application/octet-stream"
        val stempel = Zeit.stempel(now)
        val alteDatei = dateiId(buchung)
        val ersetzt = buchung["receipt"] is JsonObject

        val neueId = BackupPaket.neueKennung(files)
        files.putBytes(neueId, bytes)
        val ordnerName: String
        try {
            ordnerName = store.transaction {
                val ordnerId = zielOrdner(store, jahr(datum), stempel)
                val beleg = JsonObject(
                    linkedMapOf(
                        "name" to s(name), "type" to s(mime), "size" to JsonPrimitive(bytes.size.toLong()),
                        "fileId" to s(neueId), "uploadedAt" to s(stempel),
                    ),
                )
                val b = LinkedHashMap<String, JsonElement>(buchung)
                b["receipt"] = beleg
                b["updatedAt"] = s(stempel)
                store.put(Finance.BUCHUNGEN, buchungId, JsonObject(b))

                val docId = dokumentId(buchungId)
                val alt = store.get(DOKUMENTE, docId)
                val d = LinkedHashMap<String, JsonElement>(alt ?: JsonObject(emptyMap()))
                val titelRest = text.ifEmpty { partner }
                d.putAll(
                    mapOf(
                        "id" to s(docId),
                        "title" to s("Beleg: $nummer" + if (titelRest.isNotEmpty()) " - $titelRest" else ""),
                        "fileName" to s(name), "fileType" to s(mime), "fileSize" to JsonPrimitive(bytes.size.toLong()),
                        "fileId" to s(neueId), "category" to s("belege"), "folderId" to s(ordnerId),
                        "date" to s(datum), "uploadDate" to s(stempel),
                        "tags" to JsonArray(
                            listOf("Beleg", buchung.text("sphere"), buchung.text("category"), nummer)
                                .filter { !it.isNullOrEmpty() }.map { s(it!!) },
                        ),
                        "transactionId" to s(buchungId), "transactionDocNumber" to s(nummer), "isReceipt" to JsonPrimitive(true),
                        "createdAt" to (alt?.get("createdAt") ?: s(stempel)), "updatedAt" to s(stempel),
                    ),
                )
                if (alt?.get("notes") == null) d["notes"] = s("Buchungsbeleg für $partner".trim())
                // Wenn die Daten alt (Data-URL) sind, darf sie nicht neben der neuen Datei stehen bleiben.
                d.remove("dataUrl")
                store.put(DOKUMENTE, docId, JsonObject(d))
                (store.get(ORDNER, ordnerId)?.text("name")) ?: ""
            }
        } catch (e: Throwable) {
            files.delete(neueId)
            throw e
        }
        if (alteDatei != null && alteDatei != neueId && alteDatei !in Dateiverwaltung.referenziert(store)) files.delete(alteDatei)
        return BelegErgebnis(name, ordnerName, ersetzt)
    }

    /** Nimmt den Beleg von der Buchung ab, entfernt sein Dokument im Archiv und löscht die Datei, wenn sie sonst niemand braucht. */
    fun entfernen(store: DocumentStore, files: FileStore, buchungId: String, now: ZonedDateTime = ZonedDateTime.now()) {
        val buchung = store.get(Finance.BUCHUNGEN, buchungId) ?: return
        val datei = dateiId(buchung)
        store.transaction {
            if (buchung.containsKey("receipt")) {
                val b = LinkedHashMap<String, JsonElement>(buchung)
                b.remove("receipt")
                b["updatedAt"] = s(Zeit.stempel(now))
                store.put(Finance.BUCHUNGEN, buchungId, JsonObject(b))
            }
            store.delete(DOKUMENTE, dokumentId(buchungId))
        }
        if (datei != null && datei !in Dateiverwaltung.referenziert(store)) files.delete(datei)
    }

    /** Löscht mehrere Buchungen samt Belegen (jede für sich vollständig). Gibt die Zahl der gelöschten zurück. */
    fun buchungenLoeschen(store: DocumentStore, files: FileStore, ids: List<String>): Int {
        var n = 0
        for (id in ids.distinct()) {
            if (store.get(Finance.BUCHUNGEN, id) == null) continue
            buchungLoeschen(store, files, id); n++
        }
        return n
    }

    /** Löscht die Buchung samt Beleg-Dokument und – wenn niemand sie mehr braucht – der Datei. */
    fun buchungLoeschen(store: DocumentStore, files: FileStore, buchungId: String) {
        val datei = dateiId(store.get(Finance.BUCHUNGEN, buchungId))
        store.transaction {
            store.delete(Finance.BUCHUNGEN, buchungId)
            store.delete(DOKUMENTE, dokumentId(buchungId))
        }
        if (datei != null && datei !in Dateiverwaltung.referenziert(store)) files.delete(datei)
    }
}
