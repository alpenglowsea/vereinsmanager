package de.vereinsmanager.core.contacts

import de.vereinsmanager.core.export.Csv
import de.vereinsmanager.core.export.PdfTabelle
import de.vereinsmanager.core.donation.DonationExport
import de.vereinsmanager.core.finance.Buchung
import de.vereinsmanager.core.members.Zeit
import de.vereinsmanager.core.sepa.SepaService
import de.vereinsmanager.core.store.DocumentStore
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull
import java.math.BigDecimal
import java.time.ZonedDateTime

data class KontaktAdresse(val strasse: String = "", val hausnummer: String = "", val plz: String = "", val ort: String = "", val land: String = "") {
    /** "Musterweg 1, 17235 Neustrelitz" ohne leere Teile. */
    val einzeilig: String
        get() = listOf("$strasse $hausnummer".trim(), "$plz $ort".trim()).filter { it.isNotEmpty() }.joinToString(", ")
}

data class Ansprechpartner(
    val anrede: String = "", val vorname: String = "", val nachname: String = "", val funktion: String = "",
    val email: String = "", val telefon: String = "",
) {
    val name: String get() = listOf(anrede, vorname, nachname).filter { it.isNotBlank() }.joinToString(" ")
}

/** Ein Kontakt (Geschäftspartner, Lieferant, Sponsor, Spender …) aus dem Bereich `contacts`, Felder wie am Desktop (`ClubContact`). */
data class Kontakt(
    val id: String,
    val nummer: String,
    /** "legal" (Firma/Organisation) oder "natural" (Privatperson) */
    val art: String,
    val typen: List<String>,
    val anzeigeName: String,
    val firma: String,
    val rechtsform: String,
    val anrede: String,
    val vorname: String,
    val nachname: String,
    val geburtsdatum: String,
    val steuernummer: String,
    val handelsregister: String,
    val ansprech: Ansprechpartner?,
    val adresse: KontaktAdresse,
    val email: String,
    val telefon: String,
    val mobil: String,
    val web: String,
    val iban: String,
    val bic: String,
    val bank: String,
    val inhaber: String,
    val debKred: String,
    val notizen: String,
    val tags: List<String>,
    val erstellt: String,
    val geaendert: String,
    val roh: JsonObject,
) {
    val istFirma get() = art == "legal"
}

/** Alle Eingaben des Kontaktformulars als Text. */
data class KontaktForm(
    val id: String,
    val nummer: String,
    val art: String = "legal",
    val typen: List<String> = emptyList(),
    val firma: String = "",
    /** Eintrag aus [Kontakte.RECHTSFORMEN]; bei "Sonstige" gilt [rechtsformFrei]. */
    val rechtsform: String = "",
    val rechtsformFrei: String = "",
    val anrede: String = "",
    val vorname: String = "",
    val nachname: String = "",
    val geburtsdatum: String = "",
    val steuernummer: String = "",
    val handelsregister: String = "",
    val apAnrede: String = "",
    val apVorname: String = "",
    val apNachname: String = "",
    val apFunktion: String = "",
    val apEmail: String = "",
    val apTelefon: String = "",
    val strasse: String = "",
    val hausnummer: String = "",
    val plz: String = "",
    val ort: String = "",
    val land: String = "Deutschland",
    val email: String = "",
    val telefon: String = "",
    val mobil: String = "",
    val web: String = "",
    val iban: String = "",
    val bic: String = "",
    val bank: String = "",
    val inhaber: String = "",
    val debKred: String = "",
    val notizen: String = "",
    val tagsText: String = "",
)

/** Einnahmen und Ausgaben eines Kontakts (ohne Umbuchungen). */
data class KontaktBilanz(val anzahl: Int, val einnahmen: BigDecimal, val ausgaben: BigDecimal)

object Kontakte {
    const val BEREICH = "contacts"

    /** Reihenfolge und Beschriftung wie am Desktop. */
    val TYPEN: Map<String, String> = linkedMapOf(
        "sponsor" to "Sponsor", "donor" to "Spender", "supplier" to "Lieferant", "service" to "Dienstleister",
        "association" to "Verband / Sportbund", "authority" to "Kommune / Behörde", "partner" to "Kooperationspartner",
        "member_contact" to "Mitgliedsbezug", "other" to "Sonstige",
    )

    val RECHTSFORMEN = listOf(
        "GmbH", "AG", "GmbH & Co. KG", "UG (haftungsbeschränkt)", "e.V.", "GbR", "OHG", "KG", "Einzelunternehmen", "Stiftung",
        "Körperschaft d.ö.R.", "Sonstige",
    )

    val ANREDEN = listOf("Herr", "Frau", "Divers", "Dr.", "Prof. Dr.")

    private fun t(o: JsonObject?, k: String) = (o?.get(k) as? JsonPrimitive)?.contentOrNull ?: ""
    private fun sub(o: JsonObject?, k: String) = o?.get(k) as? JsonObject
    private fun liste(o: JsonObject, k: String) = (o[k] as? JsonArray)?.mapNotNull { (it as? JsonPrimitive)?.contentOrNull } ?: emptyList()

    fun von(o: JsonObject): Kontakt {
        val a = sub(o, "address")
        val b = sub(o, "bankDetails")
        val cp = sub(o, "contactPerson")
        return Kontakt(
            id = t(o, "id"), nummer = t(o, "contactNumber"), art = t(o, "personType").ifEmpty { "natural" }, typen = liste(o, "types"),
            anzeigeName = t(o, "displayName").ifEmpty { t(o, "companyName") }, firma = t(o, "companyName"), rechtsform = t(o, "legalForm"),
            anrede = t(o, "salutation"), vorname = t(o, "firstName"), nachname = t(o, "lastName"), geburtsdatum = t(o, "dateOfBirth"),
            steuernummer = t(o, "taxId"), handelsregister = t(o, "commercialRegister"),
            ansprech = cp?.let { Ansprechpartner(t(it, "salutation"), t(it, "firstName"), t(it, "lastName"), t(it, "roleOrPosition"), t(it, "email"), t(it, "phone")) },
            adresse = KontaktAdresse(t(a, "street"), t(a, "houseNumber"), t(a, "zip"), t(a, "city"), t(a, "country")),
            email = t(o, "email"), telefon = t(o, "phone"), mobil = t(o, "mobile"), web = t(o, "website"),
            iban = t(b, "iban"), bic = t(b, "bic"), bank = t(b, "bankName"), inhaber = t(b, "accountHolder"),
            debKred = t(o, "creditorOrDebtorNumber"), notizen = t(o, "notes"), tags = liste(o, "tags"),
            erstellt = t(o, "createdAt"), geaendert = t(o, "updatedAt"), roh = o,
        )
    }

    /** Alle Kontakte, nach Name sortiert. */
    fun alle(store: DocumentStore): List<Kontakt> =
        store.all(BEREICH).map { von(it) }.filter { it.id.isNotEmpty() }.sortedBy { it.anzeigeName.lowercase() }

    fun neueId(): String = "cnt-" + System.currentTimeMillis() + "-" + Zeit.zufall(3)

    /** Höchste vorhandene Zahl + 1, mindestens K-1001 (wie am Desktop; nur die Ziffern der Nummer zählen). */
    fun naechsteNummer(kontakte: List<Kontakt>): String {
        val hoechste = kontakte.mapNotNull { it.nummer.filter(Char::isDigit).toIntOrNull() }.fold(1000) { m, n -> if (n > m) n else m }
        return "K-" + (hoechste + 1).toString().padStart(4, '0')
    }

    fun neu(store: DocumentStore, typ: String? = null): KontaktForm =
        KontaktForm(id = neueId(), nummer = naechsteNummer(alle(store)), typen = listOfNotNull(typ))

    /**
     * Name aus dem Zahlungspartner einer Buchung ins Formular (C5, wie Desktop `ContactFormModal`):
     * Firma → ganzer Name; Privatperson → erstes Wort Vorname, der Rest Nachname (ein Wort: nur Nachname).
     */
    fun mitName(f: KontaktForm, art: String, name: String): KontaktForm {
        val teile = name.trim().split(Regex("\\s+")).filter { it.isNotEmpty() }
        return when {
            art == "legal" -> f.copy(art = art, firma = name.trim(), vorname = "", nachname = "")
            teile.size > 1 -> f.copy(art = art, firma = "", vorname = teile.first(), nachname = teile.drop(1).joinToString(" "))
            else -> f.copy(art = art, firma = "", vorname = "", nachname = teile.firstOrNull().orEmpty())
        }
    }

    /** Ist der Name schon als Kontakt (Anzeigename oder Firma) bekannt? Ohne Rücksicht auf Groß-/Kleinschreibung. */
    fun bekannt(kontakte: List<Kontakt>, name: String): Boolean {
        val n = name.trim()
        return n.isNotEmpty() && kontakte.any { it.anzeigeName.trim().equals(n, ignoreCase = true) || it.firma.trim().equals(n, ignoreCase = true) }
    }

    fun von(k: Kontakt): KontaktForm {
        val bekannt = k.rechtsform in RECHTSFORMEN
        return KontaktForm(
            id = k.id, nummer = k.nummer, art = k.art, typen = k.typen.filter { it in TYPEN },
            firma = k.firma, rechtsform = if (k.rechtsform.isEmpty() || bekannt) k.rechtsform else "Sonstige",
            rechtsformFrei = if (k.rechtsform.isNotEmpty() && !bekannt) k.rechtsform else "",
            anrede = k.anrede, vorname = k.vorname, nachname = k.nachname, geburtsdatum = k.geburtsdatum,
            steuernummer = k.steuernummer, handelsregister = k.handelsregister,
            apAnrede = k.ansprech?.anrede.orEmpty(), apVorname = k.ansprech?.vorname.orEmpty(), apNachname = k.ansprech?.nachname.orEmpty(),
            apFunktion = k.ansprech?.funktion.orEmpty(), apEmail = k.ansprech?.email.orEmpty(), apTelefon = k.ansprech?.telefon.orEmpty(),
            strasse = k.adresse.strasse, hausnummer = k.adresse.hausnummer, plz = k.adresse.plz, ort = k.adresse.ort,
            land = k.adresse.land.ifEmpty { "Deutschland" }, email = k.email, telefon = k.telefon, mobil = k.mobil, web = k.web,
            iban = k.iban, bic = k.bic, bank = k.bank, inhaber = k.inhaber, debKred = k.debKred, notizen = k.notizen, tagsText = k.tags.joinToString(", "),
        )
    }

    /** Der Anzeigename, wie er gespeichert wird: Firmenname, bei Privatpersonen „Anrede Vorname Nachname“ (wie am Desktop). */
    fun anzeigeName(f: KontaktForm): String =
        if (f.art == "legal") f.firma.trim() else listOf(f.anrede, f.vorname, f.nachname).map { it.trim() }.filter { it.isNotEmpty() }.joinToString(" ")

    private val EMAIL = Regex("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$")
    private val BIC = Regex("^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$")

    /** Fehler je Feld (Schlüssel: nummer, firma, nachname, typen, iban, bic, email, apEmail); leer = in Ordnung. */
    fun pruefen(store: DocumentStore, f: KontaktForm): Map<String, String> {
        val e = linkedMapOf<String, String>()
        val nr = f.nummer.trim()
        if (nr.isEmpty()) e["nummer"] = "Die Kontaktnummer ist erforderlich."
        else if (alle(store).any { it.id != f.id && it.nummer.trim().equals(nr, ignoreCase = true) }) e["nummer"] = "Die Kontaktnummer $nr gibt es schon."
        if (f.art == "legal") { if (f.firma.isBlank()) e["firma"] = "Firmen- oder Organisationsname ist erforderlich." }
        else if (f.nachname.isBlank()) e["nachname"] = "Der Nachname ist erforderlich."
        if (f.typen.isEmpty()) e["typen"] = "Bitte mindestens einen Kontakttyp wählen."
        if (f.iban.isNotBlank()) SepaService.validateIban(f.iban).let { if (!it.isValid) e["iban"] = it.error ?: "Ungültige IBAN." }
        if (f.bic.isNotBlank() && !BIC.matches(f.bic.filterNot(Char::isWhitespace).uppercase())) e["bic"] = "Die BIC hat 8 oder 11 Zeichen (Buchstaben und Ziffern)."
        if (f.email.isNotBlank() && !EMAIL.matches(f.email.trim())) e["email"] = "Das ist keine gültige E-Mail-Adresse."
        if (f.apEmail.isNotBlank() && !EMAIL.matches(f.apEmail.trim())) e["apEmail"] = "Das ist keine gültige E-Mail-Adresse."
        return e
    }

    private fun s(v: String): JsonElement = JsonPrimitive(v)

    /** Setzt [k] auf [v], oder entfernt den Schlüssel, wenn [v] leer ist (am Desktop fehlen leere Felder). */
    private fun setze(m: MutableMap<String, JsonElement>, k: String, v: String) { if (v.isEmpty()) m.remove(k) else m[k] = s(v) }

    /** Speichert den Kontakt. Felder, die das Formular nicht kennt, bleiben erhalten. Wirft bei Fehlern in der Eingabe. */
    fun speichern(store: DocumentStore, f: KontaktForm, now: ZonedDateTime = ZonedDateTime.now()): Kontakt {
        pruefen(store, f).values.firstOrNull()?.let { throw IllegalArgumentException(it) }
        val alt = store.get(BEREICH, f.id)
        val m = LinkedHashMap<String, JsonElement>(alt ?: JsonObject(emptyMap()))
        val stempel = now.toInstant().toString()
        val name = anzeigeName(f)
        m["id"] = s(f.id)
        m["contactNumber"] = s(f.nummer.trim())
        m["personType"] = s(f.art)
        m["types"] = JsonArray(f.typen.map { s(it) })
        m["displayName"] = s(name)
        val a = LinkedHashMap<String, JsonElement>(sub(alt, "address") ?: JsonObject(emptyMap()))
        a["street"] = s(f.strasse.trim()); a["houseNumber"] = s(f.hausnummer.trim()); a["zip"] = s(f.plz.trim()); a["city"] = s(f.ort.trim())
        a["country"] = s(f.land.trim().ifEmpty { "Deutschland" })
        m["address"] = JsonObject(a)
        m["email"] = s(f.email.trim())
        m["phone"] = s(f.telefon.trim())
        setze(m, "mobile", f.mobil.trim()); setze(m, "website", f.web.trim()); setze(m, "notes", f.notizen.trim())
        setze(m, "creditorOrDebtorNumber", f.debKred.trim())
        val tags = f.tagsText.split(',').map { it.trim() }.filter { it.isNotEmpty() }
        if (tags.isEmpty()) m.remove("tags") else m["tags"] = JsonArray(tags.map { s(it) })
        if (!m.containsKey("createdAt")) m["createdAt"] = s(stempel)
        m["updatedAt"] = s(stempel)

        if (f.art == "legal") {
            m["companyName"] = s(f.firma.trim())
            val form = if (f.rechtsform == "Sonstige") f.rechtsformFrei.trim().ifEmpty { "Sonstige" } else f.rechtsform
            setze(m, "legalForm", form)
            setze(m, "taxId", f.steuernummer.trim()); setze(m, "commercialRegister", f.handelsregister.trim())
            if (listOf(f.apNachname, f.apVorname, f.apEmail, f.apTelefon).any { it.isNotBlank() }) {
                val c = LinkedHashMap<String, JsonElement>(sub(alt, "contactPerson") ?: JsonObject(emptyMap()))
                c["salutation"] = s(f.apAnrede)
                setze(c, "firstName", f.apVorname.trim()); setze(c, "lastName", f.apNachname.trim()); setze(c, "roleOrPosition", f.apFunktion.trim())
                setze(c, "email", f.apEmail.trim()); setze(c, "phone", f.apTelefon.trim())
                m["contactPerson"] = JsonObject(c)
            } else m.remove("contactPerson")
            listOf("salutation", "firstName", "lastName", "dateOfBirth").forEach { m.remove(it) }
        } else {
            m["salutation"] = s(f.anrede)
            setze(m, "firstName", f.vorname.trim()); m["lastName"] = s(f.nachname.trim()); setze(m, "dateOfBirth", f.geburtsdatum)
            listOf("companyName", "legalForm", "taxId", "commercialRegister", "contactPerson").forEach { m.remove(it) }
        }

        if (listOf(f.iban, f.bic, f.bank, f.inhaber).any { it.isNotBlank() }) {
            val b = LinkedHashMap<String, JsonElement>(sub(alt, "bankDetails") ?: JsonObject(emptyMap()))
            b["iban"] = s(f.iban.filterNot(Char::isWhitespace).uppercase())
            setze(b, "bic", f.bic.filterNot(Char::isWhitespace).uppercase()); setze(b, "bankName", f.bank.trim())
            b["accountHolder"] = s(f.inhaber.trim().ifEmpty { name })
            m["bankDetails"] = JsonObject(b)
        } else m.remove("bankDetails")

        val doc = JsonObject(m)
        store.put(BEREICH, f.id, doc)
        return von(doc)
    }

    fun loeschen(store: DocumentStore, id: String) { store.delete(BEREICH, id) }

    /** Mehrere Kontakte auf einmal löschen (alles oder nichts). */
    fun sammelLoeschen(store: DocumentStore, ids: List<String>) { store.transaction { ids.forEach { store.delete(BEREICH, it) } } }

    // ---------------------------------------------------------------- Suche, Sortierung

    /** Die Felder, in denen die Suche nachsieht. */
    fun suchtext(k: Kontakt): List<String> = listOf(
        k.anzeigeName, k.firma, k.nummer, k.email, k.telefon, k.mobil, k.adresse.ort, k.adresse.plz, k.adresse.strasse, k.notizen, k.debKred, k.iban,
        k.ansprech?.name.orEmpty(), k.ansprech?.funktion.orEmpty(), k.ansprech?.email.orEmpty(),
    ) + k.tags

    fun passt(k: Kontakt, suche: String): Boolean {
        val q = suche.trim()
        return q.isEmpty() || suchtext(k).any { it.contains(q, ignoreCase = true) }
    }

    val SORTIERUNG: Map<String, String> = linkedMapOf("name" to "Name", "number" to "Nummer", "city" to "Ort", "types" to "Kontakttyp")

    fun sortieren(liste: List<Kontakt>, feld: String): List<Kontakt> {
        val c = java.text.Collator.getInstance(java.util.Locale.GERMANY)
        val schluessel: (Kontakt) -> String = when (feld) {
            "number" -> { k -> k.nummer.filter(Char::isDigit).padStart(12, '0') + k.nummer }
            "city" -> { k -> k.adresse.ort }
            "types" -> { k -> typenText(k) }
            else -> { k -> k.anzeigeName }
        }
        return liste.sortedWith { a, b -> c.compare(schluessel(a), schluessel(b)).let { if (it != 0) it else c.compare(a.anzeigeName, b.anzeigeName) } }
    }

    fun typenText(k: Kontakt): String = k.typen.joinToString(", ") { TYPEN[it] ?: it }

    // ---------------------------------------------------------------- Buchungen eines Kontakts

    private fun norm(s: String) = s.trim().lowercase().replace(Regex("\\s+"), " ")

    private fun enthaeltNummer(text: String, nummer: String) =
        text.isNotEmpty() && Regex("(?<![A-Za-z0-9])" + Regex.escape(nummer) + "(?![A-Za-z0-9])", RegexOption.IGNORE_CASE).containsMatchIn(text)

    /**
     * Buchungen, die zu diesem Kontakt gehören: Zahlungspartner ist genau der Name (Anzeigename oder Firma, Groß-/Kleinschreibung egal)
     * oder die Kontaktnummer; auch wenn die Nummer als ganzes Wort im Buchungstext oder in der Notiz steht. Neueste zuerst.
     * (Am Desktop genügt, dass sich Namen teilweise enthalten, das trifft auch fremde Buchungen.)
     */
    fun buchungenVon(k: Kontakt, buchungen: List<Buchung>): List<Buchung> {
        val namen = listOf(k.anzeigeName, k.firma).map { norm(it) }.filter { it.isNotEmpty() }.toSet()
        val nr = k.nummer.trim()
        return buchungen.filter { b ->
            val p = norm(b.partner)
            (p.isNotEmpty() && p in namen) || (nr.isNotEmpty() && (p == norm(nr) || enthaeltNummer(b.text, nr) || enthaeltNummer(b.notiz, nr)))
        }.sortedByDescending { it.datum }
    }

    /** Summen über alle gefundenen Buchungen (Umbuchungen zählen nicht). */
    fun bilanz(buchungen: List<Buchung>): KontaktBilanz {
        val echte = buchungen.filterNot { it.istUmbuchung }
        val ein = echte.filter { it.istEinnahme }.fold(BigDecimal.ZERO) { a, b -> a + b.betrag.abs() }
        val aus = echte.filter { it.istAusgabe }.fold(BigDecimal.ZERO) { a, b -> a + b.betrag.abs() }
        return KontaktBilanz(echte.size, ein, aus)
    }

    // ---------------------------------------------------------------- Export

    val CSV_SPALTEN = listOf(
        "Kontaktnummer", "Personenart", "Name / Firma", "Rechtsform", "Kontakttypen", "Ansprechpartner", "Steuernummer / USt-ID", "Handelsregister",
        "E-Mail", "Telefon", "Mobil", "Website", "Straße", "Hausnummer", "PLZ", "Ort", "Land", "IBAN", "BIC", "Bankname", "Kontoinhaber",
        "Kreditoren-/Debitorennr.", "Notizen", "Schlagwörter",
    )

    private fun ansprechText(k: Kontakt): String {
        val a = k.ansprech ?: return ""
        if (!k.istFirma) return ""
        return listOf(a.anrede, a.vorname, a.nachname, if (a.funktion.isNotEmpty()) "(${a.funktion})" else "").filter { it.isNotEmpty() }.joinToString(" ")
    }

    fun csvDateiInhalt(liste: List<Kontakt>): String = Csv.schreiben(
        CSV_SPALTEN,
        liste.map { k ->
            fun x(s: String) = DonationExport.csvTextSicher(Csv.einzeilig(s))
            listOf(
                x(k.nummer), if (k.istFirma) "Juristische Person (Firma / Organisation)" else "Natürliche Person", x(k.anzeigeName), x(k.rechtsform),
                typenText(k), x(ansprechText(k)), x(k.steuernummer), x(k.handelsregister), x(k.email), x(k.telefon), x(k.mobil), x(k.web),
                x(k.adresse.strasse), x(k.adresse.hausnummer), x(k.adresse.plz), x(k.adresse.ort), x(k.adresse.land), x(k.iban), x(k.bic), x(k.bank),
                x(k.inhaber), x(k.debKred), x(k.notizen), x(k.tags.joinToString(", ")),
            )
        },
    )

    fun pdfTabelle(liste: List<Kontakt>, verein: String, heute: java.time.LocalDate): PdfTabelle = PdfTabelle(
        verein, "Kontaktliste", "Stand: ${Zeit.deutsch(heute.toString())} | Gesamt: ${liste.size} Kontakte",
        listOf("Nr.", "Name / Firma", "Art", "Rolle(n)", "Ansprechpartner", "Telefon", "E-Mail", "Ort", "IBAN"),
        listOf(18, 50, 16, 40, 38, 28, 38, 24, 17),
        listOf('l', 'l', 'l', 'l', 'l', 'l', 'l', 'l', 'l'),
        liste.map { k ->
            val ap = k.ansprech?.takeIf { k.istFirma }?.let { a ->
                (listOf(a.nachname, a.vorname).filter { it.isNotEmpty() }.joinToString(", ") + if (a.funktion.isNotEmpty()) " (${a.funktion})" else "").trim()
            }.orEmpty()
            listOf(
                k.nummer.ifEmpty { "–" }, k.anzeigeName + if (k.rechtsform.isNotEmpty()) " (${k.rechtsform})" else "", if (k.istFirma) "Firma" else "Privat",
                typenText(k).ifEmpty { "–" }, ap.ifEmpty { "–" }, k.telefon.ifEmpty { k.mobil }.ifEmpty { "–" }, k.email.ifEmpty { "–" },
                "${k.adresse.plz} ${k.adresse.ort}".trim().ifEmpty { "–" }, if (k.iban.isNotEmpty()) k.iban.take(8) + "..." else "–",
            )
        },
        "$verein - Kontaktliste",
    )

    fun csvDateiname(verein: String, heute: java.time.LocalDate) = "kontakte_${DonationExport.dateinameTeil(verein).ifEmpty { "Verein" }}_$heute.csv"
    fun pdfDateiname(verein: String, heute: java.time.LocalDate) = "kontaktliste_${DonationExport.dateinameTeil(verein).ifEmpty { "Verein" }}_$heute.pdf"
}
