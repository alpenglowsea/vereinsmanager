package de.vereinsmanager.core.antrag

import de.vereinsmanager.core.documents.DokumentException
import de.vereinsmanager.core.documents.DokumentForm
import de.vereinsmanager.core.documents.DokumentStore
import de.vereinsmanager.core.documents.Dokument
import de.vereinsmanager.core.documents.Dokumente
import de.vereinsmanager.core.documents.StandardOrdner
import de.vereinsmanager.core.donation.Unterschrift
import de.vereinsmanager.core.files.FileStore
import de.vereinsmanager.core.members.Member
import de.vereinsmanager.core.sepa.SepaService
import de.vereinsmanager.core.settings.Vereinsdaten
import de.vereinsmanager.core.store.DocumentStore
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull
import java.math.BigDecimal
import java.time.LocalDate
import java.time.Period

/**
 * Ein Aufnahmeantrag, wie ihn das neue Mitglied am Gerät ausfüllt. Alles ist Text, Daten stehen als JJJJ-MM-TT.
 * Der Beitrag steht nicht hier: Er ergibt sich aus der Mitgliedsart und den Beitragsvorgaben des Vereins ([AntragEinstellungen]).
 */
data class Antrag(
    val vorname: String = "", val nachname: String = "", val geschlecht: String = "none", val geburtsdatum: String = "",
    val staatsangehoerigkeit: String = "Deutsch", val telefon: String = "", val email: String = "",
    val strasse: String = "", val hausnummer: String = "", val plz: String = "", val ort: String = "", val land: String = "Deutschland",
    val vertreterName: String = "", val vertreterBeziehung: String = "Mutter", val vertreterTelefon: String = "", val vertreterEmail: String = "",
    val sparte: String = "", val mitgliedsart: String = "full", val eintritt: String = "", val vorverein: String = "", val notiz: String = "",
    /** "sepa" oder "transfer" */
    val zahlungsart: String = "sepa", val iban: String = "", val bic: String = "", val bankname: String = "", val kontoinhaber: String = "",
    val faelligkeitstag: Int = 1,
    val datenschutz: Boolean = false, val satzung: Boolean = false,
    val unterschrift: Unterschrift? = null, val vertreterUnterschrift: Unterschrift? = null, val kontoinhaberUnterschrift: Unterschrift? = null,
) {
    val name get() = "$vorname $nachname".trim()
    val sepa get() = zahlungsart == "sepa"
}

/** Beitragsvorgabe einer Mitgliedsart: Betrag (als Text, z. B. "18" oder "12,50") und Zahlweise (monthly, quarterly, half_yearly, yearly). */
data class BeitragsVorgabe(val betrag: String, val periode: String) {
    val wert: BigDecimal get() = betrag.trim().replace(',', '.').toBigDecimalOrNull()?.takeIf { it.signum() >= 0 } ?: BigDecimal.ZERO
}

data class AntragEinstellungen(
    val beitraege: Map<String, BeitragsVorgabe>,
    val datenschutz: String,
    val satzung: String,
    /** Kennung des Dokuments mit der eigenen Leervorlage; leer = das App-eigene leere Formular */
    val vorlageDokId: String = "",
    /** Kennung des hinterlegten Satzungs-PDFs (leer = keins); das neue Mitglied kann es in Schritt 4 öffnen */
    val satzungDokId: String = "",
    /** Kennung des hinterlegten Datenschutz-Vordrucks (leer = keiner) */
    val datenschutzDokId: String = "",
) {
    fun beitrag(art: String): BeitragsVorgabe = beitraege[art] ?: STANDARD_BEITRAEGE.getValue("full")

    companion object {
        /** Die Mitgliedsarten, die im Antrag zur Wahl stehen (wie am Desktop), mit Beschreibung für das neue Mitglied. */
        val ARTEN = linkedMapOf(
            "full" to "Vollmitglied (Erwachsene)",
            "reduced" to "Ermäßigt (Schüler, Studierende, Auszubildende, Rentner)",
            "youth" to "Kinder und Jugendliche",
            "family" to "Familienbeitrag",
            "supporting" to "Fördermitglied (passiv)",
        )
        val PERIODEN = linkedMapOf("monthly" to "monatlich", "quarterly" to "vierteljährlich", "half_yearly" to "halbjährlich", "yearly" to "jährlich")
        /** Startwerte wie am Desktop; der Verein ändert sie in den Einstellungen. */
        val STANDARD_BEITRAEGE: Map<String, BeitragsVorgabe> = linkedMapOf(
            "full" to BeitragsVorgabe("18", "monthly"), "reduced" to BeitragsVorgabe("12", "monthly"), "youth" to BeitragsVorgabe("10", "monthly"),
            "family" to BeitragsVorgabe("30", "monthly"), "supporting" to BeitragsVorgabe("25", "monthly"),
        )
        const val STANDARD_DATENSCHUTZ =
            "Ich willige ein, dass {verein} meine personenbezogenen Daten (Name, Anschrift, Geburtsdatum, Kontakt- und Bankdaten sowie " +
                "Angaben zur Mitgliedschaft) für die Mitgliederverwaltung, den Beitragseinzug, die Vereinskommunikation und – soweit für den " +
                "Sport- oder Spielbetrieb erforderlich – die Meldung an Verbände verarbeitet und speichert. Eine Weitergabe an unbefugte Dritte " +
                "findet nicht statt. Nach Ende der Mitgliedschaft werden die Daten im Rahmen der gesetzlichen Aufbewahrungsfristen gelöscht. " +
                "Ich habe das Recht auf Auskunft, Berichtigung, Löschung und Einschränkung der Verarbeitung sowie auf Beschwerde bei der " +
                "zuständigen Datenschutzaufsichtsbehörde und kann diese Einwilligung jederzeit mit Wirkung für die Zukunft widerrufen."
        const val STANDARD_SATZUNG = "Ich erkenne die Satzung und die Beitragsordnung von {verein} in der jeweils gültigen Fassung an."
        const val SEPA_TEXT =
            "Ich ermächtige {verein}, Zahlungen von meinem Konto mittels Lastschrift einzuziehen. Zugleich weise ich mein Kreditinstitut an, " +
                "die vom Verein auf mein Konto gezogenen Lastschriften einzulösen. Hinweis: Ich kann innerhalb von acht Wochen, beginnend mit " +
                "dem Belastungsdatum, die Erstattung des belasteten Betrages verlangen. Es gelten dabei die mit meinem Kreditinstitut " +
                "vereinbarten Bedingungen."

        fun standard() = AntragEinstellungen(STANDARD_BEITRAEGE, STANDARD_DATENSCHUTZ, STANDARD_SATZUNG)
    }
}

/** Liest und schreibt die Antrags-Einstellungen im Vereinsdaten-Dokument (`settings/main`); alle anderen Felder bleiben unverändert. */
object AntragEinstellungenStore {
    const val K_BEITRAEGE = "membershipFeeDefaults"
    const val K_DATENSCHUTZ = "applicationPrivacyText"
    const val K_SATZUNG = "applicationStatuteText"
    const val K_VORLAGE = "applicationTemplateDocId"
    const val K_SATZUNG_DOK = "applicationStatuteDocId"
    const val K_DATENSCHUTZ_DOK = "applicationPrivacyDocId"
    const val ORDNER_ID = "folder-aufnahmeantraege"
    const val MAX_VORLAGE = 10 * 1024 * 1024

    private fun t(o: JsonObject?, k: String) = (o?.get(k) as? JsonPrimitive)?.takeIf { it !is JsonNull }?.contentOrNull ?: ""

    fun lesen(settings: JsonObject?): AntragEinstellungen {
        val std = AntragEinstellungen.standard()
        val b = settings?.get(K_BEITRAEGE) as? JsonObject
        val beitraege = LinkedHashMap<String, BeitragsVorgabe>()
        for ((art, vorgabe) in std.beitraege) {
            val o = b?.get(art) as? JsonObject
            val betrag = t(o, "amount").ifEmpty { vorgabe.betrag }
            val periode = t(o, "period").takeIf { it in AntragEinstellungen.PERIODEN }
            beitraege[art] = BeitragsVorgabe(betrag, periode ?: vorgabe.periode)
        }
        return AntragEinstellungen(
            beitraege, t(settings, K_DATENSCHUTZ).ifBlank { std.datenschutz }, t(settings, K_SATZUNG).ifBlank { std.satzung }, t(settings, K_VORLAGE),
            satzungDokId = t(settings, K_SATZUNG_DOK), datenschutzDokId = t(settings, K_DATENSCHUTZ_DOK),
        )
    }

    fun lesen(store: DocumentStore): AntragEinstellungen = lesen(store.get(Vereinsdaten.BEREICH, Vereinsdaten.ID))

    /** Fehler je Mitgliedsart ("beitrag.full" …); leer, wenn alles in Ordnung ist. */
    fun pruefen(e: AntragEinstellungen): Map<String, String> {
        val f = LinkedHashMap<String, String>()
        for ((art, v) in e.beitraege) {
            val x = v.betrag.trim().replace(',', '.').toBigDecimalOrNull()
            if (x == null || x.signum() < 0) f["beitrag.$art"] = "Bitte einen Betrag eingeben, z. B. 18 oder 12,50."
        }
        return f
    }

    private fun aendern(store: DocumentStore, aenderung: (MutableMap<String, JsonElement>) -> Unit) {
        store.transaction {
            val alt = store.get(Vereinsdaten.BEREICH, Vereinsdaten.ID)
            val m = LinkedHashMap<String, JsonElement>(alt ?: JsonObject(emptyMap()))
            m["id"] = JsonPrimitive(Vereinsdaten.ID)
            aenderung(m)
            store.put(Vereinsdaten.BEREICH, Vereinsdaten.ID, JsonObject(m))
        }
    }

    /** Speichert Beiträge und Texte. Ein Text, der dem Standard entspricht, wird nicht gespeichert (dann gilt künftig ein besserer Standard). */
    fun speichern(store: DocumentStore, e: AntragEinstellungen) {
        pruefen(e).values.firstOrNull()?.let { throw IllegalArgumentException(it) }
        aendern(store) { m ->
            m[K_BEITRAEGE] = JsonObject(e.beitraege.mapValues { (_, v) ->
                JsonObject(linkedMapOf<String, JsonElement>("amount" to JsonPrimitive(v.wert.setScale(2, java.math.RoundingMode.HALF_UP)), "period" to JsonPrimitive(v.periode)))
            })
            if (e.datenschutz.isBlank() || e.datenschutz == AntragEinstellungen.STANDARD_DATENSCHUTZ) m.remove(K_DATENSCHUTZ) else m[K_DATENSCHUTZ] = JsonPrimitive(e.datenschutz.trim())
            if (e.satzung.isBlank() || e.satzung == AntragEinstellungen.STANDARD_SATZUNG) m.remove(K_SATZUNG) else m[K_SATZUNG] = JsonPrimitive(e.satzung.trim())
        }
    }

    private fun ordnerKennung(store: DocumentStore, files: FileStore?): String {
        if (store.get(Dokumente.ORDNER, ORDNER_ID) == null) StandardOrdner.anlegenFehlende(store)
        if (store.get(Dokumente.ORDNER, ORDNER_ID) != null) return ORDNER_ID
        return Dokumente.ordner(store).firstOrNull { it.name == "Digitale Aufnahmeanträge" }?.id.orEmpty()
    }

    /** Das Dokument mit der eigenen Leervorlage, wenn es (noch) existiert. */
    fun vorlage(store: DocumentStore): Dokument? {
        val id = lesen(store).vorlageDokId.ifEmpty { return null }
        return store.get(Dokumente.DOKUMENTE, id)?.let { Dokument.from(it) }
    }

    /** Die Bytes der eigenen Leervorlage; null, wenn keine hinterlegt oder die Datei fehlt. */
    fun vorlageBytes(store: DocumentStore, files: FileStore): ByteArray? {
        val d = vorlage(store) ?: return null
        val id = d.dateiId ?: return null
        return files.open(id)?.use { it.readBytes() }
    }

    /**
     * Hinterlegt eine eigene Leervorlage (PDF). Sie liegt als Dokument im Ordner „Digitale Aufnahmeanträge“ und ist damit in der Sicherung.
     * Eine frühere Vorlage wird ersetzt.
     */
    fun vorlageSetzen(store: DocumentStore, files: FileStore, bytes: ByteArray, dateiName: String, heute: LocalDate): Dokument {
        if (bytes.size < 8 || String(bytes, 0, 5, Charsets.ISO_8859_1) != "%PDF-") throw DokumentException("Das ist keine PDF-Datei.")
        if (bytes.size > MAX_VORLAGE) throw DokumentException("Die Datei ist zu groß (höchstens ${MAX_VORLAGE / 1024 / 1024} MB).")
        val alt = vorlage(store)
        val form = DokumentForm(
            id = DokumentStore.neueId(), titel = "Eigene Antragsvorlage (leeres Formular)", kategorie = "mitglieder",
            ordnerId = ordnerKennung(store, files), datum = heute.toString(), tags = "Vorlage, Aufnahmeantrag",
            notiz = "Wird in der App als leeres Antragsformular angeboten.",
        )
        val neu = DokumentStore.neu(store, files, bytes, dateiName.ifBlank { "Antragsvorlage.pdf" }, "application/pdf", form)
        aendern(store) { it[K_VORLAGE] = JsonPrimitive(neu.id) }
        if (alt != null) DokumentStore.loeschen(store, files, listOf(alt.id))
        return neu
    }

    /** Entfernt die eigene Leervorlage (das Dokument wird gelöscht); danach gilt wieder das App-eigene Formular. */
    fun vorlageEntfernen(store: DocumentStore, files: FileStore) {
        val alt = vorlage(store)
        aendern(store) { it.remove(K_VORLAGE) }
        if (alt != null) DokumentStore.loeschen(store, files, listOf(alt.id))
    }

    /** Zwei PDFs, die der Verein hinterlegt und die das neue Mitglied in Schritt 4 des Antrags öffnen kann. */
    enum class Beilage(val schluessel: String, val titel: String, val kategorie: String, val tags: String, val dateiName: String) {
        SATZUNG("applicationStatuteDocId", "Satzung", "satzung", "Satzung, Aufnahmeantrag", "Satzung.pdf"),
        DATENSCHUTZ("applicationPrivacyDocId", "Datenschutz-Vordruck", "mitglieder", "Datenschutz, Aufnahmeantrag", "Datenschutz.pdf"),
    }

    /** Das hinterlegte Dokument, wenn es (noch) existiert. */
    fun beilage(store: DocumentStore, b: Beilage): Dokument? {
        val id = t(store.get(Vereinsdaten.BEREICH, Vereinsdaten.ID), b.schluessel).ifEmpty { return null }
        return store.get(Dokumente.DOKUMENTE, id)?.let { Dokument.from(it) }
    }

    /**
     * Hinterlegt eine Beilage (nur PDF). Sie liegt als Dokument im Archiv (Satzung unter „Satzung & Ordnungen“, der Datenschutz-Vordruck
     * unter „Digitale Aufnahmeanträge“) und ist damit in der Sicherung. Jede Fassung wird als neues Dokument mit Datum im Titel abgelegt;
     * frühere Fassungen bleiben im Archiv erhalten (nachvollziehbar), nur die neue wird dem Antragsteller angeboten.
     */
    fun beilageSetzen(store: DocumentStore, files: FileStore, b: Beilage, bytes: ByteArray, dateiName: String, heute: LocalDate): Dokument {
        if (bytes.size < 8 || String(bytes, 0, 5, Charsets.ISO_8859_1) != "%PDF-") throw DokumentException("Das ist keine PDF-Datei.")
        if (bytes.size > MAX_VORLAGE) throw DokumentException("Die Datei ist zu groß (höchstens ${MAX_VORLAGE / 1024 / 1024} MB).")
        StandardOrdner.anlegenFehlende(store)
        val ordner = when (b) {
            Beilage.SATZUNG -> "folder-satzung".takeIf { store.get(Dokumente.ORDNER, it) != null }.orEmpty()
            Beilage.DATENSCHUTZ -> ordnerKennung(store, files)
        }
        val form = DokumentForm(
            id = DokumentStore.neueId(), titel = freierTitel(store, "${b.titel} vom ${"%02d.%02d.%04d".format(heute.dayOfMonth, heute.monthValue, heute.year)}"),
            kategorie = b.kategorie, ordnerId = ordner, datum = heute.toString(), tags = b.tags,
            notiz = "Wird im Aufnahmeantrag dem neuen Mitglied zum Ansehen angeboten, solange es die aktuelle Fassung ist.",
        )
        val neu = DokumentStore.neu(store, files, bytes, dateiName.ifBlank { b.dateiName }, "application/pdf", form)
        aendern(store) { it[b.schluessel] = JsonPrimitive(neu.id) }
        return neu
    }

    /** Gibt es den Titel schon (zweite Fassung am selben Tag), wird gezählt: „… (2)“, „… (3)“. */
    internal fun freierTitel(store: DocumentStore, basis: String): String {
        val belegt = Dokumente.dokumente(store).map { it.titel }.toSet()
        if (basis !in belegt) return basis
        var n = 2
        while ("$basis ($n)" in belegt) n++
        return "$basis ($n)"
    }

    /** Der Antrag bietet die Beilage nicht mehr an. Das Dokument bleibt im Archiv (löschen geht dort). */
    fun beilageEntfernen(store: DocumentStore, b: Beilage) {
        aendern(store) { it.remove(b.schluessel) }
    }
}

/** Prüfregeln des Antrags, Seite für Seite (die Bildschirmseiten des Formulars). */
object AntragRegeln {
    const val SEITE_PERSON = 1
    const val SEITE_MITGLIEDSCHAFT = 2
    const val SEITE_ZAHLUNG = 3
    const val SEITE_ERKLAERUNG = 4
    const val SEITE_ZUSAMMENFASSUNG = 5

    fun datum(text: String): LocalDate? = try { LocalDate.parse(text.trim()) } catch (e: Exception) { null }

    /** Alter in Jahren am [heute]; null bei unlesbarem oder zukünftigem Datum. */
    fun alter(geburtsdatum: String, heute: LocalDate): Int? {
        val g = datum(geburtsdatum) ?: return null
        if (g.isAfter(heute)) return null
        return Period.between(g, heute).years
    }

    fun minderjaehrig(a: Antrag, heute: LocalDate): Boolean = (alter(a.geburtsdatum, heute) ?: 99) < 18

    private fun norm(s: String) = s.trim().lowercase().replace(Regex("\\s+"), " ").replace(",", "")

    private fun gleicherName(inhaber: String, vor: String, nach: String): Boolean {
        val i = norm(inhaber)
        return i.isNotEmpty() && (i == norm("$vor $nach") || i == norm("$nach $vor"))
    }

    /** Das Konto gehört einer anderen Person als dem Antragsteller (z. B. einem Elternteil). */
    fun kontoinhaberAbweichend(a: Antrag): Boolean = a.sepa && a.kontoinhaber.isNotBlank() && !gleicherName(a.kontoinhaber, a.vorname, a.nachname)

    /** Eigene Unterschrift des Kontoinhabers nötig: SEPA, abweichender Inhaber – außer es ist der gesetzliche Vertreter, der ohnehin unterschreibt. */
    fun kontoinhaberMussUnterschreiben(a: Antrag, heute: LocalDate): Boolean {
        if (!kontoinhaberAbweichend(a)) return false
        if (minderjaehrig(a, heute) && a.vertreterName.isNotBlank() && norm(a.kontoinhaber) == norm(a.vertreterName)) return false
        return true
    }

    /**
     * Vorschlag für den Kontoinhaber, wenn das Feld noch leer ist: bei unter 18 der
     * gesetzliche Vertreter (das Konto gehört meist den Eltern), sonst die Person selbst.
     */
    fun kontoinhaberVorschlag(a: Antrag, heute: LocalDate): String =
        if (minderjaehrig(a, heute) && a.vertreterName.isNotBlank()) a.vertreterName.trim() else a.name

    /** Eine Mitgliedsart zum Alter; null, wenn das Alter unbekannt ist oder keine Änderung nahelegt. */
    fun vorschlagArt(alter: Int?): String? = if (alter != null && alter < 18) "youth" else null

    private fun plausibleEmail(e: String) = Regex("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$").matches(e.trim())

    /** Fehlermeldungen je Feld für eine Seite; leer, wenn alles in Ordnung ist. Seite 5 prüft alles. */
    fun fehler(seite: Int, a: Antrag, heute: LocalDate, sparten: List<String>): Map<String, String> {
        val f = LinkedHashMap<String, String>()
        val alle = seite == SEITE_ZUSAMMENFASSUNG
        if (seite == SEITE_PERSON || alle) {
            if (a.vorname.isBlank()) f["vorname"] = "Bitte den Vornamen eingeben."
            if (a.nachname.isBlank()) f["nachname"] = "Bitte den Nachnamen eingeben."
            val g = datum(a.geburtsdatum)
            if (g == null) f["geburtsdatum"] = "Bitte das Geburtsdatum eingeben."
            else if (g.isAfter(heute)) f["geburtsdatum"] = "Das Geburtsdatum liegt in der Zukunft."
            if (a.strasse.isBlank()) f["strasse"] = "Bitte die Straße eingeben."
            if (a.hausnummer.isBlank()) f["hausnummer"] = "Bitte die Hausnummer eingeben."
            if (a.plz.isBlank()) f["plz"] = "Bitte die Postleitzahl eingeben."
            if (a.ort.isBlank()) f["ort"] = "Bitte den Wohnort eingeben."
            if (a.email.isNotBlank() && !plausibleEmail(a.email)) f["email"] = "Die E-Mail-Adresse sieht nicht richtig aus."
            if (minderjaehrig(a, heute) && datum(a.geburtsdatum) != null && a.vertreterName.isBlank())
                f["vertreterName"] = "Bei unter 18 Jahren bitte den gesetzlichen Vertreter angeben."
            if (a.vertreterEmail.isNotBlank() && !plausibleEmail(a.vertreterEmail)) f["vertreterEmail"] = "Die E-Mail-Adresse sieht nicht richtig aus."
        }
        if (seite == SEITE_MITGLIEDSCHAFT || alle) {
            if (a.sparte.isBlank() || (sparten.isNotEmpty() && a.sparte !in sparten)) f["sparte"] = "Bitte eine Sparte wählen."
            if (a.mitgliedsart !in AntragEinstellungen.ARTEN) f["mitgliedsart"] = "Bitte eine Mitgliedsart wählen."
            if (datum(a.eintritt) == null) f["eintritt"] = "Bitte das Eintrittsdatum eingeben."
        }
        if (seite == SEITE_ZAHLUNG || alle) {
            if (a.sepa) {
                val c = SepaService.validateIban(a.iban)
                if (a.iban.isBlank()) f["iban"] = "Für die Lastschrift wird die IBAN gebraucht."
                else if (!c.isValid) f["iban"] = c.error ?: "Die IBAN ist ungültig."
                if (a.kontoinhaber.isBlank()) f["kontoinhaber"] = "Bitte den Namen des Kontoinhabers eingeben."
                if (!SepaService.validateBic(a.bic)) f["bic"] = "Die BIC ist ungültig."
            }
        }
        if (seite == SEITE_ERKLAERUNG || alle) {
            if (!a.datenschutz) f["datenschutz"] = "Ohne die Einwilligung zur Datenverarbeitung ist keine Aufnahme möglich."
            if (!a.satzung) f["satzung"] = "Ohne Anerkennung der Satzung ist keine Aufnahme möglich."
            // Unter 18 unterschreibt allein der gesetzliche Vertreter, nicht das Kind (Wunsch Johannes, 21.11.2026)
            if (minderjaehrig(a, heute)) {
                if (a.vertreterUnterschrift == null || a.vertreterUnterschrift.leer)
                    f["vertreterUnterschrift"] = "Bei unter 18 Jahren unterschreibt der gesetzliche Vertreter."
            } else if (a.unterschrift == null || a.unterschrift.leer) f["unterschrift"] = "Bitte unterschreiben."
            if (kontoinhaberMussUnterschreiben(a, heute) && (a.kontoinhaberUnterschrift == null || a.kontoinhaberUnterschrift.leer))
                f["kontoinhaberUnterschrift"] = "Der Kontoinhaber muss das Lastschriftmandat unterschreiben."
        }
        return f
    }

    /** Erste Seite mit einem Fehler; null, wenn der Antrag vollständig ist. */
    fun ersteFehlerSeite(a: Antrag, heute: LocalDate, sparten: List<String>): Int? =
        (SEITE_PERSON..SEITE_ERKLAERUNG).firstOrNull { fehler(it, a, heute, sparten).isNotEmpty() }

    /** Mitglieder, die dem Antrag auffällig ähneln (gleicher Vor- und Nachname oder gleiche E-Mail-Adresse). */
    fun dubletten(a: Antrag, members: List<Member>): List<Member> {
        val vor = norm(a.vorname); val nach = norm(a.nachname); val mail = a.email.trim().lowercase()
        return members.filter {
            (vor.isNotEmpty() && nach.isNotEmpty() && norm(it.firstName) == vor && norm(it.lastName) == nach) ||
                (mail.isNotEmpty() && it.email.trim().lowercase() == mail)
        }
    }
}
