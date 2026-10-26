package de.vereinsmanager.core.members

/** IBAN in der amtlichen Vierergruppierung ("DE89 3704 0044 0532 0130 00"). Gespeichert wird sie weiterhin ohne Leerzeichen. */
object Iban {
    fun gruppiert(iban: String): String =
        iban.filterNot { it.isWhitespace() }.uppercase(java.util.Locale.ROOT).chunked(4).joinToString(" ")
}
