package de.vereinsmanager.android.data

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import de.vereinsmanager.core.store.DocumentStore
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonObject

/**
 * Speicher auf dem Handy: eine SQLite-Tabelle, je Eintrag ein vollständiges JSON-Dokument.
 *
 * Bewusst ohne Room: weniger Zusatzbausteine beim Bauen, und der Speicher besteht ohnehin nur aus
 * "Bereich, Kennung, Dokument". Bekannte Grenze: Android liest eine Zeile höchstens bis etwa 2 MB am Stück;
 * ein einzelnes Dokument (z. B. ein Scan) darüber ließe sich nicht lesen. Das ist in Phase 4 (Dokumente) zu lösen.
 */
class SqliteDocumentStore(context: Context) :
    SQLiteOpenHelper(context.applicationContext, "vereinsmanager.db", null, 1), DocumentStore {

    override fun onCreate(db: SQLiteDatabase) {
        db.execSQL(
            "CREATE TABLE docs (seq INTEGER PRIMARY KEY AUTOINCREMENT, area TEXT NOT NULL, id TEXT NOT NULL, " +
                "json TEXT NOT NULL, UNIQUE(area, id))",
        )
    }

    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {}

    override fun ids(area: String): List<String> {
        val out = ArrayList<String>()
        readableDatabase.rawQuery("SELECT id FROM docs WHERE area = ? ORDER BY seq", arrayOf(area)).use { c ->
            while (c.moveToNext()) out.add(c.getString(0))
        }
        return out
    }

    override fun count(area: String): Int =
        readableDatabase.rawQuery("SELECT COUNT(*) FROM docs WHERE area = ?", arrayOf(area)).use { c ->
            if (c.moveToFirst()) c.getInt(0) else 0
        }

    override fun get(area: String, id: String): JsonObject? =
        readableDatabase.rawQuery("SELECT json FROM docs WHERE area = ? AND id = ?", arrayOf(area, id)).use { c ->
            if (c.moveToFirst()) Json.parseToJsonElement(c.getString(0)).jsonObject else null
        }

    override fun all(area: String): List<JsonObject> {
        val out = ArrayList<JsonObject>()
        readableDatabase.rawQuery("SELECT json FROM docs WHERE area = ? ORDER BY seq", arrayOf(area)).use { c ->
            while (c.moveToNext()) out.add(Json.parseToJsonElement(c.getString(0)).jsonObject)
        }
        return out
    }

    override fun put(area: String, id: String, doc: JsonObject) {
        val db = writableDatabase
        val values = ContentValues().apply { put("json", doc.toString()) }
        // Kein "INSERT OR REPLACE" und kein UPSERT: Beides ändert die Reihenfolge bzw. fehlt auf älteren Androids.
        val changed = db.update("docs", values, "area = ? AND id = ?", arrayOf(area, id))
        if (changed == 0) {
            values.put("area", area)
            values.put("id", id)
            db.insertOrThrow("docs", null, values)
        }
    }

    override fun delete(area: String, id: String) {
        writableDatabase.delete("docs", "area = ? AND id = ?", arrayOf(area, id))
    }

    override fun clear(area: String) {
        writableDatabase.delete("docs", "area = ?", arrayOf(area))
    }

    override fun <T> transaction(block: () -> T): T {
        val db = writableDatabase
        db.beginTransaction()
        try {
            val result = block()
            db.setTransactionSuccessful()
            return result
        } finally {
            db.endTransaction()
        }
    }
}
