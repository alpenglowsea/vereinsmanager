package de.vereinsmanager.core.members

import de.vereinsmanager.core.store.DocumentStore
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull
import java.time.ZonedDateTime

/** Speichern und Löschen von Mitgliedern samt Änderungsprotokoll, jeweils alles oder nichts. */
object MemberStore {
    const val AREA = "members"
    const val LOG = "auditLogs"
    const val MATERIAL = "memberInventory"
    const val DOCUMENTS = "documents"

    private fun text(o: JsonObject, k: String) = (o[k] as? JsonPrimitive)?.contentOrNull ?: ""

    /** Legt ein Mitglied an oder ändert es. Gibt das gespeicherte Dokument zurück. */
    fun speichern(store: DocumentStore, form: MemberForm, now: ZonedDateTime = ZonedDateTime.now()): JsonObject =
        store.transaction {
            val alt = store.get(AREA, form.id)
            val neu = MemberDocument.build(form, alt, now)
            if (alt == null) {
                store.put(AREA, form.id, neu)
                val log = MemberAudit.angelegt(neu, now)
                store.put(LOG, text(log, "id"), log)
            } else {
                val log = MemberAudit.geaendert(alt, neu, now)
                store.put(AREA, form.id, neu)
                if (log != null) store.put(LOG, text(log, "id"), log)
            }
            neu
        }

    /**
     * Löscht ein Mitglied (Entscheidung 9): Dokumente behalten oder löschen; noch ausgegebenes Material
     * zurückgeben oder auf ein anderes Mitglied übertragen. Das Protokoll bleibt erhalten.
     * Bereits zurückgegebene Ausgaben bleiben als Verlauf unverändert stehen.
     */
    fun loeschen(
        store: DocumentStore, id: String, documents: DocumentChoice, material: MaterialChoice,
        now: ZonedDateTime = ZonedDateTime.now(),
    ): DeleteReport = store.transaction { entfernen(store, id, documents, material, now, sammel = false) }

    /** Mehrere Mitglieder auf einmal; ein Protokolleintrag "Sammellöschung: …" je Mitglied. Alles oder nichts. */
    fun sammelLoeschen(
        store: DocumentStore, ids: List<String>, documents: DocumentChoice, material: MaterialChoice,
        now: ZonedDateTime = ZonedDateTime.now(),
    ): DeleteReport = store.transaction {
        if (material is MaterialChoice.Transfer) {
            require(material.toMemberId !in ids) { "Das Ziel-Mitglied für das Material wird selbst gelöscht." }
        }
        var d = 0
        var r = 0
        var t = 0
        for (id in ids) {
            val x = entfernen(store, id, documents, material, now, sammel = true)
            d += x.documentsDeleted; r += x.materialReturned; t += x.materialTransferred
        }
        DeleteReport(d, r, t)
    }

    private fun entfernen(
        store: DocumentStore, id: String, documents: DocumentChoice, material: MaterialChoice,
        now: ZonedDateTime, sammel: Boolean,
    ): DeleteReport {
        val member = store.get(AREA, id) ?: throw IllegalArgumentException("Mitglied nicht gefunden.")
        if (material is MaterialChoice.Transfer) {
            require(material.toMemberId != id) { "Das Material kann nicht auf dasselbe Mitglied übertragen werden." }
            requireNotNull(store.get(AREA, material.toMemberId)) { "Das Ziel-Mitglied für das Material gibt es nicht." }
        }
        val heute = now.toLocalDate().toString()
        val stamp = Zeit.stempel(now)

        var docs = 0
        if (documents == DocumentChoice.DELETE) {
            for (d in store.all(DOCUMENTS)) if (text(d, "memberId") == id) { store.delete(DOCUMENTS, text(d, "id")); docs++ }
        }

        var returned = 0
        var moved = 0
        for (a in store.all(MATERIAL)) {
            if (text(a, "memberId") != id || text(a, "status") == "returned") continue
            val aid = text(a, "id")
            when (material) {
                MaterialChoice.Return -> {
                    store.put(
                        MATERIAL, aid,
                        JsonObject(a + mapOf("status" to JsonPrimitive("returned"), "returnDate" to JsonPrimitive(heute), "updatedAt" to JsonPrimitive(stamp))),
                    )
                    returned++
                }
                is MaterialChoice.Transfer -> {
                    store.put(
                        MATERIAL, aid,
                        JsonObject(a + mapOf("memberId" to JsonPrimitive(material.toMemberId), "updatedAt" to JsonPrimitive(stamp))),
                    )
                    moved++
                }
            }
        }

        val log = MemberAudit.geloescht(member, now, sammel)
        store.put(LOG, text(log, "id"), log)
        store.delete(AREA, id)
        return DeleteReport(docs, returned, moved)
    }

    /**
     * Sammelbearbeitung (Funktionsinventar "Sammelbearbeitung"): ändert nur die gesetzten Felder, mit den
     * Verknüpfungsregeln des Formulars. Mitglieder ohne tatsächliche Änderung bleiben unberührt (kein Protokoll,
     * kein neuer Änderungszeitstempel). Alles oder nichts.
     */
    fun sammelAendern(
        store: DocumentStore, ids: List<String>, edit: BulkEdit, now: ZonedDateTime = ZonedDateTime.now(),
    ): BulkReport = store.transaction {
        var changed = 0
        var unchanged = 0
        var skipped = 0
        for (id in ids) {
            val alt = store.get(AREA, id) ?: throw IllegalArgumentException("Mitglied nicht gefunden.")
            val res = MemberBulk.anwenden(MemberRules.von(Member.from(alt)), edit, now.toLocalDate())
            if (res.feeSkipped) skipped++
            val neu = MemberDocument.build(res.form, alt, now)
            val log = MemberAudit.geaendert(alt, neu, now, sammel = true)
            if (log == null) {
                unchanged++
            } else {
                store.put(AREA, id, neu)
                store.put(LOG, text(log, "id"), log)
                changed++
            }
        }
        BulkReport(changed, unchanged, skipped)
    }

    /** Anzahl noch ausgegebener Gegenstände und verknüpfter Dokumente, für die Rückfrage vor dem Löschen. */
    fun abhaengigkeiten(store: DocumentStore, id: String): Pair<Int, Int> {
        val material = store.all(MATERIAL).count { text(it, "memberId") == id && text(it, "status") != "returned" }
        val docs = store.all(DOCUMENTS).count { text(it, "memberId") == id }
        return material to docs
    }
}
