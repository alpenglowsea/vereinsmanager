package de.vereinsmanager.core.antrag

import de.vereinsmanager.core.documents.DokumentForm
import de.vereinsmanager.core.documents.DokumentStore
import de.vereinsmanager.core.documents.Dokumente
import de.vereinsmanager.core.files.Dateinamen
import de.vereinsmanager.core.files.FileStore
import de.vereinsmanager.core.members.MemberForm
import de.vereinsmanager.core.members.MemberRules
import de.vereinsmanager.core.members.MemberStore
import de.vereinsmanager.core.store.DocumentStore
import java.time.LocalDate
import java.time.ZonedDateTime

data class AufnahmeErgebnis(val mitgliedId: String, val nummer: String, val dokumentId: String)

/** Nimmt einen geprüften, unterschriebenen Antrag als Mitglied auf und legt das PDF im Dokumentenarchiv ab. */
object Aufnahme {
    /** Das Mitgliedsformular zum Antrag. Es wird nichts erfunden: leere BIC oder Bank bleiben leer, Vertreterdaten nur wie eingegeben. */
    fun mitgliedForm(a: Antrag, nummer: String, vorgabe: BeitragsVorgabe, heute: LocalDate, id: String): MemberForm {
        val minder = AntragRegeln.minderjaehrig(a, heute)
        val notizen = listOfNotNull(
            a.vorverein.trim().takeIf { it.isNotEmpty() }?.let { "Vorverein: $it" },
            a.notiz.trim().takeIf { it.isNotEmpty() },
        ).joinToString(" | ")
        return MemberForm(
            id = id, number = nummer.trim(), firstName = a.vorname.trim(), lastName = a.nachname.trim(), gender = a.geschlecht,
            birthDate = a.geburtsdatum, nationality = a.staatsangehoerigkeit.trim(), isMinor = minder,
            guardianName = if (minder) a.vertreterName.trim() else "", guardianRelation = a.vertreterBeziehung,
            guardianPhone = if (minder) a.vertreterTelefon.trim() else "", guardianEmail = if (minder) a.vertreterEmail.trim() else "",
            street = a.strasse.trim(), houseNumber = a.hausnummer.trim(), zip = a.plz.trim(), city = a.ort.trim(), country = a.land.trim().ifEmpty { "Deutschland" },
            phone = a.telefon.trim(), email = a.email.trim().lowercase(), entryDate = a.eintritt, status = "active",
            department = a.sparte, type = a.mitgliedsart,
            fee = MemberRules.formatFee(vorgabe.wert), feePeriod = vorgabe.periode,
            // Beitragsfreie Art (Vorgabe mit Zahlweise „none“): beitragsfrei, wie Desktop
            paymentMethod = if (vorgabe.periode == "none") "exempt" else if (a.sepa) "sepa" else "transfer",
            iban = if (a.sepa) a.iban.filterNot { it.isWhitespace() }.uppercase() else "", bic = if (a.sepa) a.bic.trim().uppercase() else "",
            bankName = if (a.sepa) a.bankname.trim() else "", accountHolder = if (a.sepa) a.kontoinhaber.trim() else "",
            mandateDate = if (a.sepa) heute.toString() else "", mandateReference = if (a.sepa) "MANDAT-${nummer.trim()}-${heute.year}" else "",
            monthlyDueDay = if (a.faelligkeitstag == 15) 15 else 1,
            // Ein neues Mandat wurde noch nie eingezogen.
            mandateSequenceType = "FRST",
            notes = notizen, dataPrivacyConsent = a.datenschutz,
        )
    }

    /** Prüft, ob die Aufnahme möglich ist; Text des ersten Problems oder null. */
    fun pruefen(store: DocumentStore, a: Antrag, nummer: String, vorgabe: BeitragsVorgabe, heute: LocalDate, sparten: List<String>): String? {
        val arten = de.vereinsmanager.core.members.Mitgliedsarten.lesen(store)
        AntragRegeln.ersteFehlerSeite(a, heute, sparten, arten)?.let { s ->
            return AntragRegeln.fehler(s, a, heute, sparten, arten).values.first()
        }
        val andere = store.all(MemberStore.AREA).mapNotNull { (it["memberNumber"] as? kotlinx.serialization.json.JsonPrimitive)?.content }
        return MemberRules.validate(mitgliedForm(a, nummer, vorgabe, heute, "pruefung"), andere).values.firstOrNull()
    }

    fun dateiname(a: Antrag, nummer: String): String =
        Dateinamen.bereinigen("Aufnahmeantrag_${a.nachname}_${a.vorname}_$nummer.pdf")

    /**
     * Alles oder nichts: erst Prüfung, dann das PDF im Dokumentenarchiv, dann das Mitglied; schlägt das Speichern des Mitglieds fehl,
     * wird das PDF wieder entfernt. [pdf] ist das fertige PDF des Antrags.
     */
    fun aufnehmen(
        store: DocumentStore, files: FileStore, a: Antrag, nummer: String, vorgabe: BeitragsVorgabe, pdf: ByteArray, sparten: List<String>,
        heute: LocalDate, now: ZonedDateTime = ZonedDateTime.now(),
    ): AufnahmeErgebnis {
        pruefen(store, a, nummer, vorgabe, heute, sparten)?.let { throw IllegalArgumentException(it) }
        val mid = "mem-${System.currentTimeMillis()}-" + de.vereinsmanager.core.members.Zeit.zufall(4)
        val form = mitgliedForm(a, nummer, vorgabe, heute, mid)
        if (store.get(Dokumente.ORDNER, AntragEinstellungenStore.ORDNER_ID) == null) de.vereinsmanager.core.documents.StandardOrdner.anlegenFehlende(store, now)
        val ordner = if (store.get(Dokumente.ORDNER, AntragEinstellungenStore.ORDNER_ID) != null) AntragEinstellungenStore.ORDNER_ID
        else Dokumente.ordner(store).firstOrNull { it.name == "Digitale Aufnahmeanträge" }?.id.orEmpty()
        val dform = DokumentForm(
            id = DokumentStore.neueId(), titel = "Aufnahmeantrag: ${a.nachname.trim()}, ${a.vorname.trim()} (${nummer.trim()})",
            kategorie = "mitglieder", ordnerId = ordner, datum = heute.toString(),
            tags = listOfNotNull("Aufnahmeantrag", "Beitrittserklärung", nummer.trim(), a.sparte, "SEPA-Mandat".takeIf { a.sepa }).joinToString(", "),
            notiz = "Am Gerät ausgefüllter und unterschriebener Aufnahmeantrag. Einwilligung zur Datenverarbeitung und Anerkennung der Satzung " +
                "mit der Unterschrift erklärt.",
            mitgliedId = mid, mitgliedName = a.name,
        )
        val dok = DokumentStore.neu(store, files, pdf, dateiname(a, nummer), "application/pdf", dform, now)
        try {
            MemberStore.speichern(store, form, now)
        } catch (e: Throwable) {
            runCatching { DokumentStore.loeschen(store, files, listOf(dok.id), now) }
            throw e
        }
        return AufnahmeErgebnis(mid, nummer.trim(), dok.id)
    }
}
