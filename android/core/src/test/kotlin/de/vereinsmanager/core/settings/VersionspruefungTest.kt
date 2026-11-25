package de.vereinsmanager.core.settings

import de.vereinsmanager.core.settings.Versionspruefung.Aktuell
import de.vereinsmanager.core.settings.Versionspruefung.Neuer
import org.junit.Assert.assertEquals
import org.junit.Test

/** Dieselben Fälle prüft `src/utils/versionspruefung.test.ts` am Desktop. */
class VersionspruefungTest {
    private val apk = listOf(".apk")

    private fun antwort(tag: String, dateien: List<String> = emptyList(), htmlUrl: String = "https://github.com/alpenglowsea/vereinsmanager/releases/tag/$tag") =
        """{"tag_name":"$tag","html_url":"$htmlUrl","published_at":"2026-12-01T10:00:00Z","assets":[${dateien.joinToString(",") { "{\"name\":\"$it\"}" }}]}"""

    private fun text(status: Int, body: String?, installiert: String = "1.1.0") =
        Versionspruefung.text(Versionspruefung.auswerten(status, body, installiert, apk), installiert)

    @Test
    fun vergleichtNachZahlen() {
        assertEquals(1, Versionspruefung.vergleichen("1.10.0", "1.9.0"))
        assertEquals(0, Versionspruefung.vergleichen("v1.1.0", "1.1"))
        assertEquals(-1, Versionspruefung.vergleichen("1.0", "1.0.1"))
        assertEquals(0, Versionspruefung.vergleichen("1.2.0-beta", "1.2.0"))
    }

    @Test
    fun neuereVersionMitDatei() {
        val e = Versionspruefung.auswerten(200, antwort("v1.2.0", listOf("VereinsManager_1.2.0_x64-setup.exe", "VereinsManager-1.2.0.apk")), "1.1.0", apk)
        assertEquals(Neuer("1.2.0", "https://github.com/alpenglowsea/vereinsmanager/releases/tag/v1.2.0", "VereinsManager-1.2.0.apk", "2026-12-01"), e)
        assertEquals(
            "Version 1.2.0 ist erschienen (01.12.2026). Installiert ist 1.1.0. Installationsdatei: VereinsManager-1.2.0.apk.",
            Versionspruefung.text(e, "1.1.0"),
        )
    }

    @Test
    fun neuereVersionOhneDatei() {
        assertEquals(
            "Version 1.2.0 ist erschienen (01.12.2026). Installiert ist 1.1.0. Für diese Fassung liegt der neuen Version keine Installationsdatei bei.",
            text(200, antwort("v1.2.0", listOf("VereinsManager_1.2.0_x64-setup.exe"))),
        )
    }

    @Test
    fun gleicheOderAeltereVersion() {
        assertEquals(Aktuell("1.1.0"), Versionspruefung.auswerten(200, antwort("v1.1.0"), "1.1.0", apk))
        assertEquals("Sie haben die neueste Version (1.1.0).", text(200, antwort("v1.1.0")))
        assertEquals("Sie haben die neueste Version (1.0).", text(200, antwort("v1.0.0"), installiert = "1.0"))
        assertEquals("Installiert ist 1.1.0, die neueste veröffentlichte Version ist 1.0.0. Ihre Fassung ist neuer.", text(200, antwort("v1.0.0")))
    }

    @Test
    fun fremdeAdresseWirdErsetzt() {
        val e = Versionspruefung.auswerten(200, antwort("v2.0.0", htmlUrl = "https://example.com/x"), "1.1.0", apk) as Neuer
        assertEquals(Versionspruefung.VERSIONEN_SEITE, e.seite)
    }

    @Test
    fun nichtsVeroeffentlichtFehlerKeineVerbindung() {
        assertEquals("Auf GitHub ist noch keine Version veröffentlicht.", text(404, "{}"))
        assertEquals("Keine Verbindung zu GitHub. Ist das Gerät mit dem Internet verbunden?", text(-1, null))
        assertEquals("GitHub nimmt gerade keine Abfragen an (zu viele in kurzer Zeit). Bitte später noch einmal versuchen.", text(403, "{}"))
        assertEquals("Die Antwort von GitHub ließ sich nicht lesen.", text(200, "kein json"))
        assertEquals("Die Antwort von GitHub ließ sich nicht lesen.", text(200, """{"name":"ohne Tag"}"""))
        assertEquals("GitHub hat unerwartet geantwortet (Fehler 500).", text(500, "x"))
    }
}
