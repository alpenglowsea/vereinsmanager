package de.vereinsmanager.android

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.ColorMatrix
import android.graphics.ColorMatrixColorFilter
import android.graphics.Matrix
import android.graphics.Paint
import android.media.ExifInterface
import de.vereinsmanager.core.files.FotoSeite
import java.io.ByteArrayOutputStream
import java.io.InputStream
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sqrt

/**
 * Was der Anwender an einem Foto eingestellt hat: [grad] zusätzlich zur Ausrichtung der Kamera im Uhrzeigersinn (0, 90, 180, 270)
 * und der Ausschnitt als Bruchteil (0 bis 1) des gedrehten Bildes: links, oben, rechts, unten.
 */
data class SeitenEdit(val grad: Int = 0, val links: Float = 0f, val oben: Float = 0f, val rechts: Float = 1f, val unten: Float = 1f) {
    val istVoll get() = links <= 0f && oben <= 0f && rechts >= 1f && unten >= 1f
    val istUnveraendert get() = grad == 0 && istVoll
}

/**
 * Macht aus einem Foto eine Seite für die Beleg-PDF: gedreht und zugeschnitten, auf höchstens [MAX_PIXEL] Bildpunkte
 * (und [MAX_SEITE] Pixel Kantenlänge) verkleinert, auf weißem Grund, optional in Graustufen, als JPEG mit Qualität [QUALITAET].
 * Die PDF selbst baut der Kern ([de.vereinsmanager.core.files.FotoPdf]).
 */
object BildZuPdf {
    /** Etwa 1,5 Megapixel: ein A4-Blatt hat dann rund 125 Punkte je Zoll. Die Werte sind Schätzungen, die sich beim Ausprobieren ändern lassen. */
    const val MAX_PIXEL = 1_500_000
    /** Damit ein langer, schmaler Kassenbon nicht zu schmal wird, zählt für ihn die Pixelzahl, nicht die Länge. */
    const val MAX_SEITE = 2400
    const val QUALITAET = 60

    class BildFehler(message: String) : Exception(message)

    private fun ausrichtung(oeffnen: () -> InputStream): Int = try {
        oeffnen().use { s ->
            when (ExifInterface(s).getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL)) {
                ExifInterface.ORIENTATION_ROTATE_90 -> 90
                ExifInterface.ORIENTATION_ROTATE_180 -> 180
                ExifInterface.ORIENTATION_ROTATE_270 -> 270
                else -> 0
            }
        }
    } catch (e: Exception) {
        0
    }

    fun drehen(b: Bitmap, grad: Int): Bitmap {
        if (grad % 360 == 0) return b
        val m = Matrix().apply { postRotate((grad % 360).toFloat()) }
        return Bitmap.createBitmap(b, 0, 0, b.width, b.height, m, true)
    }

    /** Das Bild so, wie die Kamera es meint (Ausrichtung berücksichtigt), höchstens etwa [maxSeite] Pixel lang – zum Betrachten beim Zuschneiden. */
    fun vorschau(oeffnen: () -> InputStream, maxSeite: Int): Bitmap {
        val rand = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        oeffnen().use { BitmapFactory.decodeStream(it, null, rand) }
        if (rand.outWidth <= 0 || rand.outHeight <= 0) throw BildFehler("Das Bild lässt sich nicht lesen.")
        var teiler = 1
        while (max(rand.outWidth, rand.outHeight) / (teiler * 2) >= maxSeite) teiler *= 2
        val roh = oeffnen().use { BitmapFactory.decodeStream(it, null, BitmapFactory.Options().apply { inSampleSize = teiler }) }
            ?: throw BildFehler("Das Bild lässt sich nicht lesen.")
        val gedreht = drehen(roh, ausrichtung(oeffnen))
        if (gedreht !== roh) roh.recycle()
        return gedreht
    }

    /** [oeffnen] muss bei jedem Aufruf einen neuen Datenstrom liefern (das Bild wird mehrfach gelesen). */
    fun seite(oeffnen: () -> InputStream, edit: SeitenEdit = SeitenEdit(), grau: Boolean = false): FotoSeite {
        val rand = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        oeffnen().use { BitmapFactory.decodeStream(it, null, rand) }
        if (rand.outWidth <= 0 || rand.outHeight <= 0) throw BildFehler("Das Bild lässt sich nicht lesen.")

        val grad = (ausrichtung(oeffnen) + edit.grad) % 360
        val quer = grad == 90 || grad == 270
        val gedrehtB = if (quer) rand.outHeight else rand.outWidth
        val gedrehtH = if (quer) rand.outWidth else rand.outHeight
        // Größe des Ausschnitts in Originalpixeln und der Verkleinerungsfaktor, mit dem er in die Grenzen passt.
        val ausschnittB = max(1f, (edit.rechts - edit.links) * gedrehtB)
        val ausschnittH = max(1f, (edit.unten - edit.oben) * gedrehtH)
        val faktor = min(1f, min(sqrt(MAX_PIXEL / (ausschnittB * ausschnittH)), MAX_SEITE / max(ausschnittB, ausschnittH)))
        // Das Bild gleich verkleinert einlesen, solange der Ausschnitt dabei nicht kleiner wird als nötig.
        var teiler = 1
        while (teiler * 2 * faktor <= 1f) teiler *= 2
        val roh = oeffnen().use { BitmapFactory.decodeStream(it, null, BitmapFactory.Options().apply { inSampleSize = teiler }) }
            ?: throw BildFehler("Das Bild lässt sich nicht lesen.")

        val gedreht = drehen(roh, grad)
        if (gedreht !== roh) roh.recycle()
        val x = (edit.links * gedreht.width).toInt().coerceIn(0, gedreht.width - 1)
        val y = (edit.oben * gedreht.height).toInt().coerceIn(0, gedreht.height - 1)
        val b = ((edit.rechts - edit.links) * gedreht.width).toInt().coerceIn(1, gedreht.width - x)
        val h = ((edit.unten - edit.oben) * gedreht.height).toInt().coerceIn(1, gedreht.height - y)
        val ausgeschnitten = if (x == 0 && y == 0 && b == gedreht.width && h == gedreht.height) gedreht
        else Bitmap.createBitmap(gedreht, x, y, b, h)
        if (ausgeschnitten !== gedreht) gedreht.recycle()

        val f2 = faktor * teiler
        val klein = if (f2 < 0.99f) {
            Bitmap.createScaledBitmap(ausgeschnitten, max(1, (ausgeschnitten.width * f2).toInt()), max(1, (ausgeschnitten.height * f2).toInt()), true)
        } else {
            ausgeschnitten
        }
        if (klein !== ausgeschnitten) ausgeschnitten.recycle()

        val fertig = Bitmap.createBitmap(klein.width, klein.height, Bitmap.Config.ARGB_8888)
        val farbe = Paint(Paint.FILTER_BITMAP_FLAG)
        if (grau) farbe.colorFilter = ColorMatrixColorFilter(ColorMatrix().apply { setSaturation(0f) })
        Canvas(fertig).apply {
            drawColor(Color.WHITE)
            drawBitmap(klein, 0f, 0f, farbe)
        }
        val out = ByteArrayOutputStream()
        fertig.compress(Bitmap.CompressFormat.JPEG, QUALITAET, out)
        val seite = FotoSeite(out.toByteArray(), fertig.width, fertig.height)
        klein.recycle()
        fertig.recycle()
        return seite
    }
}
