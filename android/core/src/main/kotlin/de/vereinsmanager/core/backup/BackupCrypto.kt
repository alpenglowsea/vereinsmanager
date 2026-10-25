package de.vereinsmanager.core.backup

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import java.security.SecureRandom
import java.text.Normalizer
import java.util.Base64
import javax.crypto.AEADBadTagException
import javax.crypto.Cipher
import javax.crypto.SecretKeyFactory
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.PBEKeySpec
import javax.crypto.spec.SecretKeySpec

class WrongPasswordException : Exception("Falsches Passwort oder beschädigte Datei.")

/**
 * Verschlüsselte Sicherung, kompatibel zur Desktop-Fassung (src/services/backupCrypto.ts):
 * PBKDF2-SHA256 (600 000 Runden) -> AES-256-GCM. Das Passwort geht als rohes UTF-8
 * ein, ohne Unicode-Normalisierung (so macht es der Desktop).
 */
object BackupCrypto {
    const val ITERATIONS = 600_000
    const val MIN_ITERATIONS = 100_000
    const val MAX_ITERATIONS = 5_000_000
    const val MIN_PASSWORD_LENGTH = 8

    /**
     * Umlaute können je nach Tastatur zusammengesetzt (NFC) oder zerlegt (NFD) ankommen.
     * Der Desktop normalisiert nicht, also probieren wir: wie getippt, NFC, NFD.
     */
    fun passwordVariants(password: String): List<String> =
        listOf(
            password,
            Normalizer.normalize(password, Normalizer.Form.NFC),
            Normalizer.normalize(password, Normalizer.Form.NFD),
        ).distinct()

    private fun key(password: String, salt: ByteArray, iterations: Int): SecretKeySpec {
        val spec = PBEKeySpec(password.toCharArray(), salt, iterations, 256)
        // PBEKeySpec wandelt mit PBKDF2WithHmacSHA256 die Zeichen als UTF-8 um.
        val raw = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(spec).encoded
        return SecretKeySpec(raw, "AES")
    }

    /** Entschlüsselt die Hülle und liefert den Klartext der Sicherung (JSON-Text). */
    fun decrypt(envelopeText: String, password: String): String {
        val env = try {
            Json.parseToJsonElement(envelopeText).jsonObject
        } catch (e: Exception) {
            throw BackupFormatException("Die Datei ist keine gültige JSON-Datei.")
        }
        if (env["format"]?.jsonPrimitive?.content != BackupFile.ENCRYPTED_FORMAT) {
            throw BackupFormatException("Die Datei ist keine verschlüsselte Sicherung.")
        }
        val iterations = env["iterations"]?.jsonPrimitive?.int
            ?: throw BackupFormatException("Die Hülle enthält keine Rundenzahl.")
        if (iterations < MIN_ITERATIONS || iterations > MAX_ITERATIONS) {
            throw BackupFormatException("Ungültige Rundenzahl in der verschlüsselten Datei.")
        }
        val b64 = Base64.getDecoder()
        fun field(n: String) = try {
            b64.decode(env[n]!!.jsonPrimitive.content)
        } catch (e: Exception) {
            throw BackupFormatException("Feld „$n“ der verschlüsselten Datei fehlt oder ist ungültig.")
        }
        val salt = field("salt")
        val iv = field("iv")
        val cipherText = field("daten")

        for (variant in passwordVariants(password)) {
            try {
                val c = Cipher.getInstance("AES/GCM/NoPadding")
                c.init(Cipher.DECRYPT_MODE, key(variant, salt, iterations), GCMParameterSpec(128, iv))
                return String(c.doFinal(cipherText), Charsets.UTF_8)
            } catch (e: AEADBadTagException) {
                // nächste Schreibweise versuchen
            }
        }
        throw WrongPasswordException()
    }

    /** Verschlüsselt den Klartext der Sicherung und liefert die Hülle als JSON-Text. */
    fun encrypt(plainText: String, password: String, iterations: Int = ITERATIONS): String {
        require(password.length >= MIN_PASSWORD_LENGTH) { "Das Passwort braucht mindestens 8 Zeichen." }
        val rnd = SecureRandom()
        val salt = ByteArray(16).also(rnd::nextBytes)
        val iv = ByteArray(12).also(rnd::nextBytes)
        val c = Cipher.getInstance("AES/GCM/NoPadding")
        c.init(Cipher.ENCRYPT_MODE, key(password, salt, iterations), GCMParameterSpec(128, iv))
        val out = c.doFinal(plainText.toByteArray(Charsets.UTF_8))
        val b64 = Base64.getEncoder()
        val env = JsonObject(
            linkedMapOf(
                "app" to JsonPrimitive(BackupFile.APP_NAME),
                "format" to JsonPrimitive(BackupFile.ENCRYPTED_FORMAT),
                "version" to JsonPrimitive(1),
                "kdf" to JsonPrimitive("PBKDF2-SHA256"),
                "iterations" to JsonPrimitive(iterations),
                "cipher" to JsonPrimitive("AES-256-GCM"),
                "salt" to JsonPrimitive(b64.encodeToString(salt)),
                "iv" to JsonPrimitive(b64.encodeToString(iv)),
                "daten" to JsonPrimitive(b64.encodeToString(out)),
            ),
        )
        return Json.encodeToString(kotlinx.serialization.json.JsonElement.serializer(), env)
    }
}
