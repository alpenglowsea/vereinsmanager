package de.vereinsmanager.core.settings

/**
 * Die vier frei wählbaren Plätze der Navigationsleiste (zwei links, zwei rechts vom Mittelknopf).
 * Die Plätze werden als Namen der Ziele gespeichert (z. B. "START"); welche Namen es gibt, weiß die Oberfläche und reicht sie als
 * [erlaubt] herein. Die Wahl gilt nur für dieses Gerät und steht nicht in der Datensicherung.
 */
object Leiste {
    const val PLAETZE = 4

    /** Voreinstellung: Start, Mitglieder, Buchungen, Kalender. */
    val STANDARD: List<String> = listOf("START", "MITGLIEDER", "BUCHUNGEN", "KALENDER")

    /** Aus dem gespeicherten Text; ist er leer, kaputt, doppelt oder nennt unbekannte Ziele, gilt die Voreinstellung. */
    fun lesen(roh: String?, erlaubt: Set<String>): List<String> {
        val l = roh.orEmpty().split(',').map { it.trim() }.filter { it.isNotEmpty() }
        return if (gueltig(l, erlaubt)) l else STANDARD.filter { it in erlaubt }.takeIf { it.size == PLAETZE } ?: erlaubt.toList().take(PLAETZE)
    }

    fun kodieren(plaetze: List<String>): String = plaetze.joinToString(",")

    /** Genau vier verschiedene, bekannte Ziele. */
    fun gueltig(plaetze: List<String>, erlaubt: Set<String>): Boolean =
        plaetze.size == PLAETZE && plaetze.toSet().size == PLAETZE && plaetze.all { it in erlaubt }

    /**
     * Legt [ziel] auf [platz]. Steht es schon auf einem anderen Platz, tauschen beide die Plätze – so bleiben immer vier
     * verschiedene Ziele, und nichts geht verloren.
     */
    fun setzen(plaetze: List<String>, platz: Int, ziel: String): List<String> {
        require(platz in 0 until PLAETZE) { "Platz $platz gibt es nicht." }
        require(plaetze.size == PLAETZE) { "Die Leiste hat $PLAETZE Plätze." }
        val alt = plaetze[platz]
        if (alt == ziel) return plaetze
        val andere = plaetze.indexOf(ziel)
        val neu = plaetze.toMutableList()
        neu[platz] = ziel
        if (andere >= 0) neu[andere] = alt
        return neu
    }
}
