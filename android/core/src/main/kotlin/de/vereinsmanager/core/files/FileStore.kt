package de.vereinsmanager.core.files

import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.io.IOException
import java.io.InputStream
import java.nio.file.AtomicMoveNotSupportedException
import java.nio.file.Files
import java.nio.file.StandardCopyOption

/**
 * Ablage für die Inhalte von Belegen, Dokumenten und Fotos. Die Datensätze in der Datenbank enthalten
 * nur noch Angaben (Name, Typ, Größe, Ordner) und die Kennung, unter der die Datei hier liegt.
 * Dateien werden als Datenstrom geschrieben und gelesen, nie ganz in den Speicher geladen.
 */
interface FileStore {
    /** Schreibt die Datei ganz oder gar nicht (eine vorhandene Datei bleibt bei einem Fehler unverändert). Gibt die Größe zurück. */
    fun put(id: String, input: InputStream): Long

    /** Öffnet die Datei zum Lesen; null, wenn es sie nicht gibt. Der Aufrufer schließt den Strom. */
    fun open(id: String): InputStream?

    fun size(id: String): Long?
    fun delete(id: String)
    fun ids(): List<String>
    fun clear()

    companion object {
        /** Erlaubte Kennungen: Buchstaben, Ziffern, Punkt, Unterstrich, Minus; höchstens 100 Zeichen, kein Punkt am Anfang. */
        private val ID = Regex("""[A-Za-z0-9_-][A-Za-z0-9._-]{0,99}""")
        fun pruefeKennung(id: String) {
            require(ID.matches(id)) { "Ungültige Dateikennung: \"$id\"" }
        }
    }
}

fun FileStore.putBytes(id: String, bytes: ByteArray): Long = put(id, ByteArrayInputStream(bytes))

/** Liest die ganze Datei in den Speicher. Nur für kleine Dateien gedacht (Tests, Fotos). */
fun FileStore.readBytes(id: String): ByteArray? = open(id)?.use { s ->
    val out = ByteArrayOutputStream()
    s.copyTo(out)
    out.toByteArray()
}

/** Für Tests. */
class InMemoryFileStore : FileStore {
    private val data = LinkedHashMap<String, ByteArray>()

    override fun put(id: String, input: InputStream): Long {
        FileStore.pruefeKennung(id)
        val bytes = input.readBytes() // erst lesen, dann ersetzen: bei einem Fehler bleibt das Alte stehen
        data[id] = bytes
        return bytes.size.toLong()
    }

    override fun open(id: String): InputStream? = data[id]?.let { ByteArrayInputStream(it) }
    override fun size(id: String): Long? = data[id]?.size?.toLong()
    override fun delete(id: String) { data.remove(id) }
    override fun ids(): List<String> = data.keys.toList()
    override fun clear() { data.clear() }
}

/** Dateien in einem Ordner, eine Datei je Kennung. Geschrieben wird erst in eine Zwischendatei, dann umbenannt. */
class DirFileStore(private val dir: File) : FileStore {
    private companion object {
        const val ZWISCHEN = ".tmp-"
    }

    private fun ziel(id: String): File {
        FileStore.pruefeKennung(id)
        return File(dir, id)
    }

    override fun put(id: String, input: InputStream): Long {
        val z = ziel(id)
        if (!dir.isDirectory && !dir.mkdirs()) throw IOException("Ordner nicht anlegbar: $dir")
        val tmp = File(dir, ZWISCHEN + id + "-" + System.nanoTime())
        try {
            var n = 0L
            FileOutputStream(tmp).use { out ->
                val buf = ByteArray(64 * 1024)
                while (true) {
                    val r = input.read(buf)
                    if (r < 0) break
                    out.write(buf, 0, r)
                    n += r
                }
                out.flush()
                out.fd.sync()
            }
            try {
                Files.move(tmp.toPath(), z.toPath(), StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE)
            } catch (e: AtomicMoveNotSupportedException) {
                Files.move(tmp.toPath(), z.toPath(), StandardCopyOption.REPLACE_EXISTING)
            }
            return n
        } catch (e: Throwable) {
            tmp.delete()
            throw e
        }
    }

    override fun open(id: String): InputStream? = ziel(id).takeIf { it.isFile }?.let { FileInputStream(it) }
    override fun size(id: String): Long? = ziel(id).takeIf { it.isFile }?.length()
    override fun delete(id: String) { ziel(id).delete() }

    override fun ids(): List<String> =
        (dir.listFiles() ?: emptyArray()).filter { it.isFile && !it.name.startsWith(ZWISCHEN) }.map { it.name }.sorted()

    override fun clear() {
        (dir.listFiles() ?: emptyArray()).filter { it.isFile }.forEach { it.delete() }
    }
}
