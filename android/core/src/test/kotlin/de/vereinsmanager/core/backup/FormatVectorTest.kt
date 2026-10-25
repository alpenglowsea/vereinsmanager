package de.vereinsmanager.core.backup

import org.junit.Assert.assertEquals
import org.junit.Test

/** Die Testdatei aus BACKUP_FORMAT.md, Abschnitt 5: Muss exakt diesen Text ergeben. */
class FormatVectorTest {
    private val passwort = "Pässwort-ÄÖÜ-12345"

    private val huelle = """{"app":"VereinsManager Lokal","format":"vereinsmanager-verschluesselt","version":1,"kdf":"PBKDF2-SHA256","iterations":600000,"cipher":"AES-256-GCM","salt":"SSKEOmZtQSOcSn+OOCx7LQ==","iv":"WTnCAvSKUWtAQbro","daten":"j29+2iHw9hI97XycB8pHLA3OTTEuuiK+8DTkU+nX638aFD8AI6LwSEGhNKUB0QbbBRZiCx+2aEHP6ln3TMaQZJwZdPX7TYVbnQqK1EDNjHB+CiTU5OcAuX4IVRxDCu/peoFcwKyEm/5x+KKpMTwhX0sOYlFH6VYQrwTSaGvFkyrbIbFoj3IVgnjdYYlgQ/2f9A7F9cXZO95DrxAUzftsW8AXZJ8pKi+9TPrA8WsdpL8aGQi3jPp8i4SyHgAVTh/Wxi2P+K+H9dQaVmAcXwLAnF+ahA+3wtJYYu7qUw=="}"""

    @Test fun entschluesseltExaktDenErwartetenText() {
        val erwartet = listOf(
            "{",
            "  \"app\": \"VereinsManager Lokal\",",
            "  \"version\": \"1.2.3\",",
            "  \"data\": {",
            "    \"members\": [",
            "      {",
            "        \"id\": \"m1\",",
            "        \"firstName\": \"Jörg\",",
            "        \"lastName\": \"Müßig ✓ 日本\"",
            "      }",
            "    ]",
            "  }",
            "}",
        ).joinToString("\n")
        assertEquals(erwartet, BackupCrypto.decrypt(huelle, passwort))
    }
}
