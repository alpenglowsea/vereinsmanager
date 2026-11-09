package de.vereinsmanager.android

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Matrix
import android.media.ExifInterface
import de.vereinsmanager.core.files.FotoSeite
import java.io.ByteArrayOutputStream
import java.io.InputStream

/**
 * Macht aus einem Foto eine Seite für die Beleg-PDF: längere Seite höchstens [LANGE_SEITE] Pixel, nach der
 * Aufnahme-Ausrichtung (EXIF) gedreht, auf weißem Grund (PNG mit Transparenz), als JPEG mit Qualität [QUALITAET].
 * Die PDF selbst baut der Kern ([de.vereinsmanager.core.files.FotoPdf]).
 */
object BildZuPdf {
    const val LANGE_SEITE = 1600
    const val QUALITAET = 75

    class BildFehler(message: String) : Exception(message)

    /** [oeffnen] muss bei jedem Aufruf einen neuen Datenstrom liefern (das Bild wird mehrfach gelesen). */
    fun seite(oeffnen: () -> InputStream): FotoSeite {
        val rand = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        oeffnen().use { BitmapFactory.decodeStream(it, null, rand) }
        if (rand.outWidth <= 0 || rand.outHeight <= 0) throw BildFehler("Das Bild lässt sich nicht lesen.")

        var teiler = 1
        while (maxOf(rand.outWidth, rand.outHeight) / (teiler * 2) >= LANGE_SEITE) teiler *= 2
        val optionen = BitmapFactory.Options().apply { inSampleSize = teiler }
        val roh = oeffnen().use { BitmapFactory.decodeStream(it, null, optionen) } ?: throw BildFehler("Das Bild lässt sich nicht lesen.")

        val grad = try {
            oeffnen().use { s ->
                when (ExifInterface(s).getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL)) {
                    ExifInterface.ORIENTATION_ROTATE_90 -> 90f
                    ExifInterface.ORIENTATION_ROTATE_180 -> 180f
                    ExifInterface.ORIENTATION_ROTATE_270 -> 270f
                    else -> 0f
                }
            }
        } catch (e: Exception) {
            0f
        }
        val lang = maxOf(roh.width, roh.height)
        val faktor = if (lang > LANGE_SEITE) LANGE_SEITE.toFloat() / lang else 1f
        val matrix = Matrix().apply { postRotate(grad); postScale(faktor, faktor) }
        val gedreht = Bitmap.createBitmap(roh, 0, 0, roh.width, roh.height, matrix, true)

        val fertig = Bitmap.createBitmap(gedreht.width, gedreht.height, Bitmap.Config.ARGB_8888)
        Canvas(fertig).apply {
            drawColor(Color.WHITE)
            drawBitmap(gedreht, 0f, 0f, null)
        }
        val out = ByteArrayOutputStream()
        fertig.compress(Bitmap.CompressFormat.JPEG, QUALITAET, out)
        val seite = FotoSeite(out.toByteArray(), fertig.width, fertig.height)
        if (gedreht !== roh) roh.recycle()
        gedreht.recycle()
        fertig.recycle()
        return seite
    }
}
