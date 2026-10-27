package de.vereinsmanager.core.files

/** Dateinamen und Ordnernamen für das Sicherungspaket: lesbar für Menschen und auf jedem Betriebssystem gültig. */
object Dateinamen {
    private val VERBOTEN = "/\\:*?\"<>|".toSet()
    private val WINDOWS_NAMEN = Regex("""(?i)(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])""")

    private fun istZwischenraumOderPunkt(c: Char) = c == ' ' || c == '.'

    private fun beschneiden(s: String): String = s.trimStart(' ').trimEnd { istZwischenraumOderPunkt(it) }

    /** Trennt "name.pdf" in ("name", ".pdf"). Eine Endung zählt nur, wenn sie 1 bis 10 Zeichen hat und davor etwas steht. */
    private fun trenne(name: String): Pair<String, String> {
        val i = name.lastIndexOf('.')
        if (i <= 0) return name to ""
        val endung = name.substring(i)
        return if (endung.length in 2..11) name.substring(0, i) to endung else name to ""
    }

    private fun kuerze(s: String, max: Int): String {
        if (s.length <= max) return s
        var t = s.substring(0, max.coerceAtLeast(0))
        if (t.isNotEmpty() && Character.isHighSurrogate(t.last())) t = t.dropLast(1) // kein halbes Sonderzeichen
        return t
    }

    /**
     * Macht aus einem beliebigen Text einen gültigen Namen: verbotene Zeichen und Steuerzeichen werden zu "-",
     * Leerzeichen am Anfang sowie Leerzeichen und Punkte am Ende entfallen, Windows-Sondernamen (CON, NUL …)
     * bekommen einen Unterstrich davor, zu lange Namen werden gekürzt (die Endung bleibt). Leer wird "Datei".
     * [mitEndung] = false für Ordner: dann wird nichts als Endung behandelt ("Satzung v1.2" bleibt ganz).
     */
    fun bereinigen(name: String, max: Int = 100, mitEndung: Boolean = true): String {
        val roh = name.map { if (it in VERBOTEN || it.code < 0x20 || it.code == 0x7f) '-' else it }.joinToString("")
        val sauber = beschneiden(roh)
        if (sauber.isEmpty()) return "Datei"
        val (basis0, endung) = if (mitEndung) trenne(sauber) else sauber to ""
        var basis = basis0
        if (WINDOWS_NAMEN.matches(basis)) basis = "_$basis"
        basis = beschneiden(kuerze(basis, max - endung.length))
        if (basis.isEmpty()) basis = "Datei"
        return basis + endung
    }

    /**
     * Macht den Namen im Ordner eindeutig, ohne auf Groß- und Kleinschreibung zu achten (Windows und macOS
     * unterscheiden sie nicht): "a.pdf" wird zu "a (2).pdf", "a (3).pdf" …. [vergeben] sind die bereits belegten Namen.
     */
    fun eindeutig(name: String, vergeben: Set<String>, mitEndung: Boolean = true): String {
        val belegt = vergeben.map { it.lowercase() }.toSet()
        if (name.lowercase() !in belegt) return name
        val (basis, endung) = if (mitEndung) trenne(name) else name to ""
        var n = 2
        while (true) {
            val kandidat = "$basis ($n)$endung"
            if (kandidat.lowercase() !in belegt) return kandidat
            n++
        }
    }
}
