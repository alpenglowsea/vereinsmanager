package de.vereinsmanager.core.invoice

import de.vereinsmanager.core.donation.DonationExport
import de.vereinsmanager.core.donation.DonorAddress
import de.vereinsmanager.core.export.Csv
import java.time.LocalDate

/** Tabellen-Export und Hilfen für Rechnungen. */
object RechnungsExport {
    val SPALTEN = listOf(
        "Rechnungsnummer", "Datum", "Faelligkeit", "Status", "Empfaenger", "Firma", "Strasse", "PLZ_Ort", "Betreff",
        "Netto_EUR", "USt_EUR", "Gesamt_EUR", "Steuersphaere", "Bezahlt_am",
    )

    fun statusText(status: String): String = when (status) {
        "draft" -> "Entwurf"
        "open" -> "Offen"
        "paid" -> "Bezahlt"
        "cancelled" -> "Storniert"
        "overdue" -> "Überfällig"
        else -> status
    }

    fun sphaereText(s: String): String = when (s) {
        "ideell" -> "Ideeller Bereich"
        "vermoegen" -> "Vermögensverwaltung"
        "zweckbetrieb" -> "Zweckbetrieb"
        "wirtschaftlich" -> "Wirtschaftlicher Geschäftsbetrieb"
        else -> s
    }

    fun csvDateiInhalt(liste: List<Rechnung>): String = Csv.schreiben(
        SPALTEN,
        liste.map { r ->
            listOf(
                DonationExport.csvTextSicher(r.nummer), DonationExport.deutschesDatum(r.datum), DonationExport.deutschesDatum(r.faellig),
                statusText(r.status), DonationExport.csvTextSicher(Csv.einzeilig(r.name)), DonationExport.csvTextSicher(Csv.einzeilig(r.firma)),
                DonationExport.csvTextSicher("${r.adresse.street} ${r.adresse.houseNumber}".trim()),
                DonationExport.csvTextSicher("${r.adresse.zip} ${r.adresse.city}".trim()), DonationExport.csvTextSicher(Csv.einzeilig(r.betreff)),
                DonationExport.deutscherBetrag(r.netto), DonationExport.deutscherBetrag(r.ustGesamt), DonationExport.deutscherBetrag(r.brutto),
                sphaereText(r.sphaere), r.bezahltAm?.let { DonationExport.deutschesDatum(it) }.orEmpty(),
            )
        },
    )

    /** Dateiname eines Rechnungs-PDFs. */
    fun pdfDateiname(r: Rechnung): String =
        "Rechnung_${DonationExport.dateinameTeil(r.nummer).ifEmpty { "ohne-Nr" }}_${DonationExport.dateinameTeil(r.anzeigeName).ifEmpty { "Empfaenger" }}.pdf"

    /** Eine Beispielrechnung für das Probe-PDF der Vorlage. */
    fun beispiel(heute: LocalDate = LocalDate.now(), vorlage: Vorlage = Vorlage()): Rechnung {
        val f = listOf(
            PositionForm("b1", "Beispielleistung Vereinsfest (Standaufbau)", "2", "Std.", "45,00", 19),
            PositionForm("b2", "Beispiel-Material", "1", "Stk.", "30,00", 7),
        )
        val s = RechnungsRegeln.berechnen(f, false)
        val d = heute.toString()
        return Rechnung(
            id = "beispiel", nummer = "RE-${heute.year}-000", datum = d, leistungsdatum = d, faellig = RechnungsRegeln.faellig(d, vorlage.zahlungszielTage),
            status = "open", empfaengerArt = "custom", empfaengerId = null, name = "Erika Mustermann", firma = "Musterfirma GmbH", ansprechpartner = "",
            adresse = DonorAddress("Musterstraße", "1", "12345", "Musterstadt", "Deutschland"), email = "", telefon = "",
            titel = "Rechnung", betreff = "Beispielrechnung", einleitung = vorlage.einleitung, positionen = s.positionen, schluss = vorlage.schluss,
            sphaere = "wirtschaftlich", netto = s.netto, ustJeSatz = s.ustJeSatz, ustGesamt = s.ustGesamt, brutto = s.brutto,
            zahlungszielTage = vorlage.zahlungszielTage, bezahltAm = null, zahlart = null, buchungId = null, dokumentId = null, notiz = "",
            kleinunternehmer = false, erstellt = "", geaendert = "",
        )
    }
}
