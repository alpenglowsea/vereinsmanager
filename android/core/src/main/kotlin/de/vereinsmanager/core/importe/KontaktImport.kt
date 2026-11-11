package de.vereinsmanager.core.importe

import de.vereinsmanager.core.contacts.Kontakt
import de.vereinsmanager.core.contacts.KontaktForm
import de.vereinsmanager.core.contacts.Kontakte
import de.vereinsmanager.core.members.MemberCsv
import de.vereinsmanager.core.sepa.SepaService
import de.vereinsmanager.core.store.DocumentStore
import java.time.ZonedDateTime

enum class KontaktFeld(val label: String) {
    NAME("Name / Firma"), VORNAME("Vorname"), NACHNAME("Nachname"), ANREDE("Anrede"), ART("Art (Firma / Privatperson)"),
    RECHTSFORM("Rechtsform"), TYPEN("Kontakttyp(en)"), NUMMER("Kontaktnummer"),
    STRASSE("Straße (mit Hausnummer, wenn nicht getrennt)"), HAUSNUMMER("Hausnummer"), PLZ("PLZ"), ORT("Ort"), LAND("Land"),
    EMAIL("E-Mail"), TELEFON("Telefon"), MOBIL("Mobil"), WEB("Webseite"),
    IBAN("IBAN"), BIC("BIC"), BANK("Bank"), INHABER("Kontoinhaber"), STEUERNUMMER("Steuernummer"), REGISTER("Handelsregister"),
    GEBURTSDATUM("Geburtsdatum"), ANSPRECHPARTNER("Ansprechpartner"), NOTIZEN("Notizen"), TAGS("Stichwörter"),
}

/** Wie die Art (Firma/Privatperson) bestimmt wird, wenn die Datei sie nicht angibt. */
enum class ArtVorgabe(val text: String) { ERKENNEN("Automatisch erkennen"), FIRMA("Immer Firma"), PRIVAT("Immer Privatperson") }

data class KontaktZeile(
    val index: Int,
    val form: KontaktForm,
    val hinweise: List<String> = emptyList(),
    /** Fehler, die den Import dieser Zeile verhindern (z. B. kein Name). */
    val fehler: List<String> = emptyList(),
    /** Anzeigename und Nummer des vorhandenen Kontakts, der dieser Zeile gleicht. */
    val duplikat: String? = null,
)

data class KontaktImportBericht(val angelegt: Int, val ersteNummer: String, val letzteNummer: String)

object KontaktImport {
    val REGELN: List<Triple<KontaktFeld, List<String>, List<String>>> = listOf(
        Triple(KontaktFeld.NUMMER, listOf("kontaktnummer", "kontaktnr", "nummer", "nr"), listOf("kontaktnummer", "kontaktnr")),
        Triple(KontaktFeld.NAME, listOf("name", "firma", "firmenname", "bezeichnung", "organisation", "displayname", "unternehmen", "partner"), listOf("firmenname", "organisation")),
        Triple(KontaktFeld.VORNAME, listOf("vorname", "firstname"), listOf("vorname")),
        Triple(KontaktFeld.NACHNAME, listOf("nachname", "familienname", "lastname"), listOf("nachname")),
        Triple(KontaktFeld.ANREDE, listOf("anrede", "salutation"), listOf("anrede")),
        Triple(KontaktFeld.ART, listOf("art", "personenart", "personentyp", "persontype", "firmaprivat"), listOf("personenart")),
        Triple(KontaktFeld.RECHTSFORM, listOf("rechtsform", "legalform"), listOf("rechtsform")),
        Triple(KontaktFeld.TYPEN, listOf("kontakttyp", "kontakttypen", "typ", "rolle", "kategorie", "types"), listOf("kontakttyp")),
        Triple(KontaktFeld.ANSPRECHPARTNER, listOf("ansprechpartner", "kontaktperson", "vertreter"), listOf("ansprechpartner", "kontaktperson")),
        Triple(KontaktFeld.STRASSE, listOf("strasse", "strassehausnummer", "adresse", "anschrift", "street"), listOf("strasse", "anschrift")),
        Triple(KontaktFeld.HAUSNUMMER, listOf("hausnummer", "hausnr", "housenumber"), listOf("hausnr", "hausnummer")),
        Triple(KontaktFeld.PLZ, listOf("plz", "postleitzahl", "zip"), listOf("plz", "postleitzahl")),
        Triple(KontaktFeld.ORT, listOf("ort", "stadt", "wohnort", "city"), listOf("wohnort")),
        Triple(KontaktFeld.LAND, listOf("land", "country"), emptyList()),
        Triple(KontaktFeld.EMAIL, listOf("email", "emailadresse", "mail", "e-mail"), listOf("mail")),
        Triple(KontaktFeld.MOBIL, listOf("mobil", "mobiltelefon", "handy", "mobile"), listOf("mobil", "handy")),
        Triple(KontaktFeld.TELEFON, listOf("telefon", "tel", "festnetz", "phone", "telefonnummer"), listOf("telefon", "festnetz")),
        Triple(KontaktFeld.WEB, listOf("webseite", "website", "homepage", "web", "internet", "url"), listOf("webseite", "website", "homepage")),
        Triple(KontaktFeld.IBAN, listOf("iban"), listOf("iban")),
        Triple(KontaktFeld.BIC, listOf("bic", "swift"), listOf("swift")),
        Triple(KontaktFeld.BANK, listOf("bank", "bankname", "kreditinstitut", "institut"), listOf("bankname", "kreditinstitut")),
        Triple(KontaktFeld.INHABER, listOf("kontoinhaber", "kontoinhaberin"), listOf("kontoinhaber")),
        Triple(KontaktFeld.STEUERNUMMER, listOf("steuernummer", "steuernr", "ustid", "umsatzsteuerid", "taxid"), listOf("steuernummer", "ustid")),
        Triple(KontaktFeld.REGISTER, listOf("handelsregister", "registernummer", "vereinsregister"), listOf("register")),
        Triple(KontaktFeld.GEBURTSDATUM, listOf("geburtsdatum", "geburtstag", "dateofbirth"), listOf("geburtsdatum")),
        Triple(KontaktFeld.NOTIZEN, listOf("notizen", "notiz", "bemerkung", "bemerkungen", "kommentar", "notes"), listOf("notiz", "bemerkung", "kommentar")),
        Triple(KontaktFeld.TAGS, listOf("tags", "stichwoerter", "schlagwoerter", "stichworte"), listOf("stichwort", "schlagwort")),
    )

    fun erkenneSpalten(headers: List<String>): Map<KontaktFeld, String> = Tabellen.zuordnen(headers, REGELN)

    /** Rechtsformen als ganze Wörter (nicht als Buchstabenfolge irgendwo im Text, wie es der Desktop mit „ev“ und „ug“ tut). */
    private val RECHTSFORM_WOERTER = setOf("gmbh", "ag", "kg", "ug", "ev", "gbr", "ohg", "mbh", "stiftung", "verein", "co", "se", "ggmbh", "kgaa", "eg", "e.k.", "ek")

    fun siehtNachFirmaAus(name: String): Boolean {
        val woerter = name.lowercase().split(Regex("[\\s,()/&-]+")).map { it.trim().trimEnd('.').replace(".", "") }.filter { it.isNotEmpty() }
        return woerter.any { it in RECHTSFORM_WOERTER } || name.contains("e.V.", ignoreCase = true)
    }

    /** Liest die Art aus einem Text der Spalte; null, wenn unklar. */
    fun artAusText(t: String): String? {
        val n = Tabellen.norm(t)
        if (n.isEmpty()) return null
        return when {
            n.contains("privat") || n.contains("person") || n.contains("natuerlich") || n == "natural" || n == "p" -> "natural"
            n.contains("firma") || n.contains("unternehmen") || n.contains("organisation") || n.contains("juristisch") || n.contains("verein") ||
                n == "legal" || n == "f" || siehtNachFirmaAus(t) -> "legal"
            else -> null
        }
    }

    private val TYP_STAEMME: List<Pair<String, List<String>>> = listOf(
        "sponsor" to listOf("sponsor"),
        "donor" to listOf("spende", "spender", "foerder", "förder"),
        "supplier" to listOf("liefer", "ware"),
        "service" to listOf("dienst", "service", "handwerk"),
        "association" to listOf("verband", "sportbund", "bund"),
        "authority" to listOf("behoerd", "behörd", "kommune", "gemeinde", "stadt", "amt"),
        "partner" to listOf("kooper", "partner"),
        "member_contact" to listOf("mitglied"),
        "other" to listOf("sonst", "other"),
    )

    /** Erkennt alle neun Kontakttypen (Kennung, Beschriftung oder Stichwort); zweiter Wert: nicht erkannte Wörter. */
    fun typen(text: String): Pair<List<String>, List<String>> {
        val ergebnis = LinkedHashSet<String>()
        val unbekannt = ArrayList<String>()
        text.split(Regex("[,;/|]")).map { it.trim() }.filter { it.isNotEmpty() }.forEach { teil ->
            val l = teil.lowercase()
            val n = Tabellen.norm(teil)
            val direkt = Kontakte.TYPEN.entries.firstOrNull { it.key == l || Tabellen.norm(it.value) == n }?.key
            val stamm = TYP_STAEMME.firstOrNull { (_, s) -> s.any { w -> if (w.length <= 3) l.split(Regex("\\W+")).any { it == w } else l.contains(w) } }?.first
            val k = direkt ?: stamm
            if (k != null) ergebnis.add(k) else unbekannt.add(teil)
        }
        return ergebnis.toList() to unbekannt
    }

    private val EMAIL = Regex("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$")
    private val BIC = Regex("^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$")

    private fun normName(s: String) = Tabellen.norm(s)

    fun umwandeln(
        rows: List<Map<String, String>>, mapping: Map<KontaktFeld, String>, vorgabeArt: ArtVorgabe, vorgabeTyp: String,
        vorhandene: List<Kontakt>,
    ): List<KontaktZeile> {
        fun wert(r: Map<String, String>, f: KontaktFeld) = mapping[f]?.let { r[it] }?.trim().orEmpty()
        val nummernVorhanden = vorhandene.map { it.nummer.trim().lowercase() }.toHashSet()
        val namenVorhanden = vorhandene.associateBy { normName(it.anzeigeName) }.filterKeys { it.isNotEmpty() }
        val nummernDatei = HashSet<String>()

        return rows.mapIndexed { i, r ->
            val hinweise = ArrayList<String>()
            val fehler = ArrayList<String>()
            var name = wert(r, KontaktFeld.NAME)
            var vor = wert(r, KontaktFeld.VORNAME)
            var nach = wert(r, KontaktFeld.NACHNAME)
            val artText = wert(r, KontaktFeld.ART)
            val rechtsformText = wert(r, KontaktFeld.RECHTSFORM)

            val art = artAusText(artText) ?: when (vorgabeArt) {
                ArtVorgabe.FIRMA -> "legal"
                ArtVorgabe.PRIVAT -> "natural"
                ArtVorgabe.ERKENNEN -> when {
                    rechtsformText.isNotEmpty() -> "legal"
                    name.isNotEmpty() && vor.isEmpty() && nach.isEmpty() && siehtNachFirmaAus(name) -> "legal"
                    name.isEmpty() && nach.isEmpty() && vor.isEmpty() -> "natural"
                    else -> "natural"
                }
            }
            if (artText.isNotEmpty() && artAusText(artText) == null) hinweise.add("Art „$artText“ nicht erkannt – ${if (art == "legal") "als Firma" else "als Privatperson"} übernommen.")

            var firma = ""
            if (art == "legal") {
                firma = name.ifEmpty { listOf(vor, nach).filter { it.isNotEmpty() }.joinToString(" ") }
                vor = ""; nach = ""
                if (firma.isEmpty()) fehler.add("Kein Firmenname.")
            } else {
                if (nach.isEmpty() && name.isNotEmpty()) {
                    val (v, n) = MemberCsv.namenTeilen(name)
                    if (vor.isEmpty()) vor = v
                    nach = n.ifEmpty { v.also { vor = "" } }
                } else if (nach.isEmpty() && vor.isNotEmpty()) { nach = vor; vor = "" }
                if (nach.isEmpty()) fehler.add("Kein Name.")
            }

            // Typen
            val typText = wert(r, KontaktFeld.TYPEN)
            val (gefunden, unbekannt) = typen(typText)
            if (unbekannt.isNotEmpty()) hinweise.add("Kontakttyp „${unbekannt.joinToString(", ")}“ nicht erkannt.")
            val typenListe = gefunden.ifEmpty { listOf(vorgabeTyp.ifEmpty { "other" }) }
            if (gefunden.isEmpty() && typText.isNotEmpty()) hinweise.add("Stattdessen „${Kontakte.TYPEN[typenListe[0]]}“ gesetzt.")

            // Adresse
            var strasse = wert(r, KontaktFeld.STRASSE)
            var hausnr = wert(r, KontaktFeld.HAUSNUMMER)
            if (hausnr.isEmpty() && strasse.isNotEmpty() && mapping[KontaktFeld.HAUSNUMMER] == null) {
                val (s, h) = MemberCsv.adresseTeilen(strasse); strasse = s; hausnr = h
            }

            // Bank und Kontaktdaten: Ungültiges nicht übernehmen, aber sagen
            var iban = wert(r, KontaktFeld.IBAN)
            if (iban.isNotEmpty()) SepaService.validateIban(iban).let { if (!it.isValid) { hinweise.add("IBAN „$iban“ ungültig – nicht übernommen."); iban = "" } }
            var bic = wert(r, KontaktFeld.BIC).filterNot(Char::isWhitespace).uppercase()
            if (bic.isNotEmpty() && !BIC.matches(bic)) { hinweise.add("BIC „$bic“ ungültig – nicht übernommen."); bic = "" }
            var email = wert(r, KontaktFeld.EMAIL)
            if (email.isNotEmpty() && !EMAIL.matches(email)) { hinweise.add("E-Mail „$email“ ungültig – nicht übernommen."); email = "" }
            val gebRoh = wert(r, KontaktFeld.GEBURTSDATUM)
            val geb = if (art == "natural" && gebRoh.isNotEmpty()) (Tabellen.datum(gebRoh) ?: run { hinweise.add("Geburtsdatum „$gebRoh“ nicht lesbar – nicht übernommen."); "" }) else ""

            var apV = ""; var apN = ""
            val ap = wert(r, KontaktFeld.ANSPRECHPARTNER)
            if (art == "legal" && ap.isNotEmpty()) { val (v, n) = MemberCsv.namenTeilen(ap); apV = if (n.isEmpty()) "" else v; apN = n.ifEmpty { v } }

            // Nummer: aus der Datei nur, wenn frei
            var nummer = wert(r, KontaktFeld.NUMMER)
            if (nummer.isNotEmpty()) {
                val k = nummer.lowercase()
                if (k in nummernVorhanden || !nummernDatei.add(k)) { hinweise.add("Kontaktnummer $nummer gibt es schon – es wird eine neue vergeben."); nummer = "" }
            }

            val form = KontaktForm(
                id = "", nummer = nummer, art = art, typen = typenListe, firma = firma,
                rechtsform = if (art == "legal" && rechtsformText in Kontakte.RECHTSFORMEN) rechtsformText else if (art == "legal" && rechtsformText.isNotEmpty()) "Sonstige" else "",
                rechtsformFrei = if (art == "legal" && rechtsformText.isNotEmpty() && rechtsformText !in Kontakte.RECHTSFORMEN) rechtsformText else "",
                anrede = if (art == "natural") wert(r, KontaktFeld.ANREDE) else "", vorname = vor, nachname = nach, geburtsdatum = geb,
                steuernummer = wert(r, KontaktFeld.STEUERNUMMER), handelsregister = wert(r, KontaktFeld.REGISTER),
                apVorname = apV, apNachname = apN,
                strasse = strasse, hausnummer = hausnr, plz = wert(r, KontaktFeld.PLZ), ort = wert(r, KontaktFeld.ORT),
                land = wert(r, KontaktFeld.LAND).ifEmpty { "Deutschland" },
                email = email, telefon = wert(r, KontaktFeld.TELEFON), mobil = wert(r, KontaktFeld.MOBIL), web = wert(r, KontaktFeld.WEB),
                iban = iban, bic = bic, bank = wert(r, KontaktFeld.BANK), inhaber = wert(r, KontaktFeld.INHABER),
                notizen = wert(r, KontaktFeld.NOTIZEN), tagsText = wert(r, KontaktFeld.TAGS),
            )
            val anzeige = Kontakte.anzeigeName(form)
            val dup = (nummer.takeIf { it.isNotEmpty() && it.lowercase() in nummernVorhanden }
                ?.let { n -> vorhandene.firstOrNull { it.nummer.trim().equals(n, true) } })
                ?: namenVorhanden[normName(anzeige)]
            KontaktZeile(i, form, hinweise, fehler, dup?.let { "${it.anzeigeName} (${it.nummer})" })
        }
    }

    /** Wechselt die Art einer Zeile (Firma ↔ Privatperson) und ordnet die Namen neu. */
    fun mitArt(z: KontaktZeile, art: String): KontaktZeile {
        val f = z.form
        if (f.art == art) return z
        val neu = if (art == "legal") {
            val name = listOf(f.vorname, f.nachname).filter { it.isNotEmpty() }.joinToString(" ")
            f.copy(art = "legal", firma = name, vorname = "", nachname = "", anrede = "", geburtsdatum = "")
        } else {
            val (v, n) = MemberCsv.namenTeilen(f.firma)
            f.copy(art = "natural", vorname = if (n.isEmpty()) "" else v, nachname = n.ifEmpty { v }, firma = "", rechtsform = "", rechtsformFrei = "", apVorname = "", apNachname = "")
        }
        val fehler = if (Kontakte.anzeigeName(neu).isBlank()) listOf(if (art == "legal") "Kein Firmenname." else "Kein Name.") else emptyList()
        return z.copy(form = neu, fehler = fehler)
    }

    /** Legt die Kontakte an (alles oder nichts); leere Nummern werden fortlaufend aus der höchsten vorhandenen vergeben. */
    fun importieren(store: DocumentStore, zeilen: List<KontaktZeile>, now: ZonedDateTime = ZonedDateTime.now()): KontaktImportBericht {
        require(zeilen.isNotEmpty()) { "Keine Kontakte zum Importieren ausgewählt." }
        return store.transaction {
            val nummern = ArrayList<String>()
            zeilen.forEach { z ->
                z.fehler.firstOrNull()?.let { throw IllegalArgumentException("Zeile ${z.index + 2}: $it") }
                var f = z.form.copy(id = Kontakte.neueId())
                if (f.nummer.isBlank()) f = f.copy(nummer = Kontakte.naechsteNummer(Kontakte.alle(store)))
                val k = Kontakte.speichern(store, f, now)
                nummern.add(k.nummer)
            }
            KontaktImportBericht(zeilen.size, nummern.first(), nummern.last())
        }
    }

    fun vorlage(): String = listOf(
        "Name;Vorname;Nachname;Art;Kontakttyp;Straße;PLZ;Ort;E-Mail;Telefon;IBAN;Notizen",
        "Sportartikel Müller GmbH;;;Firma;Lieferant;Hauptstraße 12;12345;Musterstadt;info@mueller.example;0123 456789;;",
        ";Erika;Mustermann;Privatperson;Spender;Gartenweg 3;12345;Musterstadt;;;;",
    ).joinToString("\r\n") + "\r\n"
}
