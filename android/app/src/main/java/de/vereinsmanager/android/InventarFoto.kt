package de.vereinsmanager.android

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.util.Base64
import de.vereinsmanager.core.inventory.Inventar
import java.io.ByteArrayOutputStream
import java.io.InputStream

/**
 * Das Foto eines Gegenstands: wird auf höchstens [MAX_SEITE] Pixel Kantenlänge verkleinert (Ausrichtung der Kamera berücksichtigt)
 * und als JPEG-Data-URL im Gegenstand gespeichert – dasselbe Feld („photoUrl“), das auch die Desktop-Fassung kennt.
 * Die Zahlen sind Schätzungen; beim Ausprobieren lassen sie sich anpassen.
 */
object ArtikelFoto {
    const val MAX_SEITE = 1024
    private const val PREFIX = "data:image/jpeg;base64,"

    /** [oeffnen] muss bei jedem Aufruf einen neuen Datenstrom liefern. */
    fun zuDataUrl(oeffnen: () -> InputStream): String {
        val gross = BildZuPdf.vorschau(oeffnen, MAX_SEITE)
        // vorschau() verkleinert nur in Zweierschritten; hier auf die endgültige Größe bringen.
        val lang = maxOf(gross.width, gross.height)
        val bild = if (lang <= MAX_SEITE) gross else {
            val f = MAX_SEITE.toFloat() / lang
            Bitmap.createScaledBitmap(gross, maxOf(1, (gross.width * f).toInt()), maxOf(1, (gross.height * f).toInt()), true)
                .also { if (it !== gross) gross.recycle() }
        }
        try {
            // Qualität schrittweise senken, falls das Foto (ungewöhnlich) zu groß wird.
            for (q in intArrayOf(80, 65, 50, 35)) {
                val out = ByteArrayOutputStream()
                bild.compress(Bitmap.CompressFormat.JPEG, q, out)
                val url = PREFIX + Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP)
                if (url.length <= Inventar.FOTO_MAX_ZEICHEN) return url
            }
            throw IllegalStateException("Das Foto bleibt zu groß.")
        } finally {
            bild.recycle()
        }
    }

    /** Für die Anzeige; null, wenn das Foto nicht lesbar ist. Nur für ein einzelnes Foto aufrufen, nicht für die ganze Liste. */
    fun bild(dataUrl: String): Bitmap? = try {
        val roh = Base64.decode(dataUrl.substringAfter(','), Base64.DEFAULT)
        BitmapFactory.decodeByteArray(roh, 0, roh.size)
    } catch (e: Exception) { null }
}
