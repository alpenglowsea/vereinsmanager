package de.vereinsmanager.core.backup

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test
import java.text.Normalizer

class BackupTest {
    // Passwort der Demo-Sicherung; "ä" bewusst als Escape, damit kein Editor es umnormalisiert.
    private val pwNfc = "diesisteinpasswortohneänderung"
    private val pwNfd = "diesisteinpasswortohneänderung"

    private fun res(name: String) =
        javaClass.getResourceAsStream("/demo/$name")!!.readBytes().toString(Charsets.UTF_8)

    @Test fun klartextDemoWirdGelesen() {
        val b = BackupFile.parse(res("demo_klartext.json"))
        assertEquals("VereinsManager Lokal", b.app)
        assertEquals(9, b.list("members")!!.size)
        assertEquals(10, b.list("transactions")!!.size)
        assertEquals(4, b.list("invoices")!!.size)
        assertNotNull(b.single("settings"))
    }

    @Test fun verworfeneBereicheKommenNichtDurch() {
        val b = BackupFile.parse(res("demo_klartext.json"))
        assertFalse(b.data.containsKey("onlineApplications"))
        assertFalse(b.data.containsKey("applicationSettings"))
        val out = b.toJsonText()
        assertFalse(out.contains("onlineApplications"))
        assertFalse(out.contains("applicationSettings"))
    }

    @Test fun hinUndZurueckVerliertNichts() {
        val b1 = BackupFile.parse(res("demo_klartext.json"))
        val b2 = BackupFile.parse(b1.toJsonText())
        assertEquals(b1.data, b2.data)
    }

    @Test fun nichtSicherungWirdAbgelehnt() {
        try { BackupFile.parse("""{"foo":1}"""); fail() } catch (_: BackupFormatException) {}
        try { BackupFile.parse("kein json"); fail() } catch (_: BackupFormatException) {}
    }

    @Test fun nullBereichZaehltAlsFehlend() {
        val b = BackupFile.parse("""{"data":{"members":[],"transactions":null}}""")
        assertTrue(b.data.containsKey("members"))
        assertFalse(b.data.containsKey("transactions"))
    }

    @Test fun huelleWirdErkannt() {
        assertTrue(BackupFile.isEncrypted(res("demo_verschluesselt.json")))
        assertFalse(BackupFile.isEncrypted(res("demo_klartext.json")))
    }

    @Test fun desktopDateiLaesstSichEntschluesseln() {
        val plain = BackupFile.parse(res("demo_klartext.json"))
        val dec = BackupFile.parse(BackupCrypto.decrypt(res("demo_verschluesselt.json"), pwNfc))
        assertEquals(plain.data, dec.data)
    }

    @Test fun zerlegtesPasswortFunktioniertAuch() {
        val dec = BackupFile.parse(BackupCrypto.decrypt(res("demo_verschluesselt.json"), pwNfd))
        assertEquals(9, dec.list("members")!!.size)
    }

    @Test fun falschesPasswortWirdAbgewiesen() {
        try { BackupCrypto.decrypt(res("demo_verschluesselt.json"), "falsches-passwort"); fail() }
        catch (_: WrongPasswordException) {}
    }

    @Test fun eigeneVerschluesselungKommtZurueck() {
        val text = "{\"data\":{\"members\":[]}}"
        val env = BackupCrypto.encrypt(text, pwNfc, iterations = 100_000)
        assertEquals(text, BackupCrypto.decrypt(env, pwNfc))
    }

    @Test fun passwortVarianten() {
        assertEquals(1, BackupCrypto.passwordVariants("abcdefgh").size)
        assertEquals(2, BackupCrypto.passwordVariants(pwNfc).size)
        assertEquals(Normalizer.normalize(pwNfd, Normalizer.Form.NFC), pwNfc)
    }
}
