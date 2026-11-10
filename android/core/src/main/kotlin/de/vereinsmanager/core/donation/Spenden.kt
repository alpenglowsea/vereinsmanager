package de.vereinsmanager.core.donation

import de.vereinsmanager.core.backup.BackupPaket
import de.vereinsmanager.core.finance.Belege
import de.vereinsmanager.core.finance.BuchungDokument
import de.vereinsmanager.core.finance.BuchungForm
import de.vereinsmanager.core.finance.BuchungRegeln
import de.vereinsmanager.core.finance.Finance
import de.vereinsmanager.core.documents.DokumentStore
import de.vereinsmanager.core.export.Export
import de.vereinsmanager.core.files.FileStore
import de.vereinsmanager.core.files.putBytes
import de.vereinsmanager.core.members.Member
import de.vereinsmanager.core.members.Zeit
import de.vereinsmanager.core.skr42.Skr42
import de.vereinsmanager.core.settings.Vereinsdaten
import de.vereinsmanager.core.store.DocumentStore
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull
import java.math.BigDecimal
import java.math.RoundingMode
import java.time.LocalDate
import java.time.ZonedDateTime

/** Das Formular einer Zuwendungsbestätigung. Beträge als Text, so wie sie getippt werden. */
data class SpendeForm(
    val id: String,
    /** "money" (Geldzuwendung) oder "goods" (Sachzuwendung) */
    val art: String = "money",
    val nummer: String = "",
    val datum: String = "",
    /** "member" oder "external" */
    val quelle: String = "external",
    val mitgliedId: String = "",
    val name: String = "",
    val strasse: String = "",
    val hausnummer: String = "",
    val plz: String = "",
    val ort: String = "",
    val land: String = "Deutschland",
    val betrag: String = "",
    val inWorten: String = "",
    val verzicht: Boolean = false,
    val sachBeschreibung: String = "",
    /** "private" oder "business" */
    val sachHerkunft: String = "private",
    val sachUnterlagen: String = "",
    val finanzamt: String = "",
    val steuernummer: String = "",
    val freistellung: String = "",
    val feststellung: String = "",
    val veranlagung: String = "",
    val zweck: String = "",
    val aussteller: String = "",
    val ortDatum: String = "",
    val notiz: String = "",
    /** Die hinterlegte Unterschrift ins PDF setzen. */
    val unterschrift: Boolean = false,
)

/** Was beim Speichern zusätzlich geschehen soll. */
data class SpendeOptionen(
    /** Nur bei Geldzuwendungen und nur, solange noch keine Buchung verknüpft ist. */
    val buchungAnlegen: Boolean = false,
    val kontoId: String = "",
    val pdfAblegen: Boolean = true,
    /** Eine schon verknüpfte Buchung an Betrag, Datum und Name der Bestätigung angleichen. */
    val buchungAnpassen: Boolean = false,
)

data class SpendeErgebnis(val spende: DonationReceipt, val buchungId: String?, val dokumentId: String?, val pdfFehler: String?)

/** Ein PDF zu einer Bestätigung erzeugen; wird von der App geliefert (dort liegt das Zeichnen). */
typealias SpendenPdf = (DonationReceipt, ClubTaxSettings) -> ByteArray

/**
 * Zuwendungsbestätigungen im Bereich `donations`. Wie am Desktop gehört zu einer Bestätigung auf Wunsch eine Einnahmebuchung
 * (nur Geldspenden) und ein abgelegtes PDF im Dokumentenarchiv. Abweichungen vom Desktop: Nummern werden nicht doppelt vergeben,
 * die Buchung geht auf Konto 40450 statt nur in eine Kategorie, das PDF liegt im Ordner „Belege <Jahr>/Spendenbescheinigungen“, und beim Ändern oder
 * Löschen entscheidet der Anwender, was mit der verknüpften Buchung geschieht.
 */
object Spenden {
    const val BEREICH = "donations"
    private const val DOKUMENTE = "documents"
    const val NUMMERNKREIS_CODE = "40400"
    const val KONTO_CODE = "40450"

    private fun s(v: String) = JsonPrimitive(v)
    private fun t(o: JsonObject?, k: String) = (o?.get(k) as? JsonPrimitive)?.takeIf { it !is JsonNull }?.contentOrNull ?: ""

    private fun zahl(v: BigDecimal): JsonElement {
        val k = v.stripTrailingZeros()
        return if (k.scale() <= 0) JsonPrimitive(k.toBigInteger().toLong()) else JsonPrimitive(k.toDouble())
    }

    fun alle(store: DocumentStore): List<DonationReceipt> =
        store.all(BEREICH).map { it.toDonationReceipt() }.sortedWith(compareByDescending<DonationReceipt> { it.date.ifEmpty { it.createdAt } })

    fun steuerangaben(store: DocumentStore): ClubTaxSettings = (store.get(Vereinsdaten.BEREICH, Vereinsdaten.ID) ?: JsonObject(emptyMap())).toClubTaxSettings()

    private fun laufNummer(nummer: String, jahr: Int): Int? =
        Regex("""^ZB-$jahr-(\d+)$""").matchEntire(nummer.trim())?.groupValues?.get(1)?.toIntOrNull()

    /** „ZB-2026-004“: höchste Nummer des Jahres plus eins (am Desktop: Anzahl plus eins, das vergibt nach einem Löschen Nummern doppelt). */
    fun naechsteNummer(vorhandene: List<String>, jahr: Int): String {
        val hoechste = vorhandene.mapNotNull { laufNummer(it, jahr) }.maxOrNull() ?: 0
        return "ZB-$jahr-${(hoechste + 1).toString().padStart(3, '0')}"
    }

    fun neueId(): String = "don-" + System.currentTimeMillis() + "-" + Zeit.zufall()

    fun inWorten(betrag: String): String = BuchungRegeln.parseBetrag(betrag)?.takeIf { it.signum() > 0 }?.let { DonationService.numberToGermanWords(it) } ?: ""

    /** Ein neues Formular, mit den Angaben der Vereinsdaten vorbelegt. */
    fun neu(store: DocumentStore, heute: LocalDate = LocalDate.now()): SpendeForm {
        val st = steuerangaben(store)
        val v = Vereinsdaten.lesen(store)
        return SpendeForm(
            id = neueId(), nummer = naechsteNummer(alle(store).map { it.receiptNumber }, heute.year), datum = heute.toString(),
            betrag = "100", inWorten = inWorten("100"),
            sachUnterlagen = "Kaufbeleg / Rechnung liegt vor",
            finanzamt = st.taxOffice, steuernummer = st.taxNumber, freistellung = st.taxExemptionDate, feststellung = st.taxStatementDate,
            veranlagung = st.taxAssessmentPeriod, zweck = st.promotedPurposes,
            aussteller = "${v.kassenwart.ifBlank { "Schatzmeister" }} (Vorstand)",
            ortDatum = DonationService.standardOrtUndDatum(st, heute),
            unterschrift = Unterschriften.lesen(store) != null,
        )
    }

    /** Das Formular zum Bearbeiten einer vorhandenen Bestätigung. Fehlende Steuerangaben kommen aus den Vereinsdaten. */
    fun von(r: DonationReceipt, st: ClubTaxSettings): SpendeForm = SpendeForm(
        id = r.id, art = r.type, nummer = r.receiptNumber, datum = r.date, quelle = r.donorType, mitgliedId = r.memberId.orEmpty(),
        name = r.donorName, strasse = r.donorAddress.street, hausnummer = r.donorAddress.houseNumber, plz = r.donorAddress.zip,
        ort = r.donorAddress.city, land = r.donorAddress.country.ifEmpty { "Deutschland" },
        betrag = BuchungRegeln.betragText(r.amount), inWorten = r.amountInWords, verzicht = r.isWaiverOfRefund,
        sachBeschreibung = r.goodsDescription.orEmpty(), sachHerkunft = r.goodsOrigin ?: "private", sachUnterlagen = r.goodsValuationBasis.orEmpty(),
        finanzamt = r.taxOffice.ifEmpty { st.taxOffice }, steuernummer = r.taxNumber.ifEmpty { st.taxNumber },
        freistellung = r.exemptionDate.ifEmpty { st.taxExemptionDate }, feststellung = r.statementDate?.ifEmpty { null } ?: st.taxStatementDate,
        veranlagung = r.assessmentPeriod.ifEmpty { st.taxAssessmentPeriod }, zweck = r.promotedPurpose.ifEmpty { st.promotedPurposes },
        aussteller = r.issuedBy, ortDatum = r.cityAndDate, notiz = r.notes.orEmpty(), unterschrift = r.signed,
    )

    /** Übernimmt Name und Anschrift eines Mitglieds. */
    fun mitMitglied(f: SpendeForm, m: Member): SpendeForm = f.copy(
        quelle = "member", mitgliedId = m.id, name = "${m.firstName} ${m.lastName}".trim(),
        strasse = m.street, hausnummer = m.houseNumber, plz = m.zip, ort = m.city, land = m.country.ifEmpty { "Deutschland" },
    )

    /** Fehlertext für das Formular, oder null, wenn alles in Ordnung ist. */
    fun pruefen(store: DocumentStore, f: SpendeForm): String? {
        val b = BuchungRegeln.parseBetrag(f.betrag)
        if (b == null || b.signum() <= 0) return "Bitte einen gültigen Betrag größer 0 € eingeben."
        if (f.name.isBlank()) return "Bitte den Namen des Spenders eingeben."
        if (f.art == "goods" && f.sachBeschreibung.isBlank()) return "Bitte die genaue Bezeichnung der Sachspende eingeben."
        if (f.datum.isBlank()) return "Bitte das Datum der Zuwendung eingeben."
        val nr = f.nummer.trim()
        if (nr.isNotEmpty() && alle(store).any { it.id != f.id && it.receiptNumber.trim().equals(nr, ignoreCase = true) }) {
            return "Die Nummer $nr gibt es schon. Bitte eine andere wählen."
        }
        return null
    }

    /** Die verknüpfte Buchung, falls es sie noch gibt. */
    fun verknuepfteBuchung(store: DocumentStore, r: DonationReceipt): JsonObject? = r.transactionId?.let { store.get(Finance.BUCHUNGEN, it) }

    /** Würde das Speichern Angaben ändern, die auch in der verknüpften Buchung stehen (Betrag, Datum, Name)? */
    fun buchungBetroffen(store: DocumentStore, f: SpendeForm): Boolean {
        val alt = store.get(BEREICH, f.id)?.toDonationReceipt() ?: return false
        val buchung = verknuepfteBuchung(store, alt) ?: return false
        val neuBetrag = BuchungRegeln.parseBetrag(f.betrag) ?: return false
        val buchBetrag = t(buchung, "amount").toBigDecimalOrNull() ?: return true
        return buchBetrag.compareTo(neuBetrag) != 0 || t(buchung, "date") != f.datum || t(buchung, "partner") != f.name.trim()
    }

    private fun bestaetigungJson(f: SpendeForm, betrag: BigDecimal, base: JsonObject?, now: ZonedDateTime): LinkedHashMap<String, JsonElement> {
        val stamp = Zeit.stempel(now)
        val m = LinkedHashMap<String, JsonElement>(base ?: JsonObject(emptyMap()))
        val geld = f.art != "goods"
        m["id"] = s(f.id)
        m["receiptNumber"] = s(f.nummer.trim())
        m["type"] = s(if (geld) "money" else "goods")
        m["date"] = s(f.datum)
        m["donorType"] = s(f.quelle)
        if (f.quelle == "member" && f.mitgliedId.isNotEmpty()) m["memberId"] = s(f.mitgliedId) else m.remove("memberId")
        m["donorName"] = s(f.name.trim())
        m["donorAddress"] = JsonObject(
            linkedMapOf(
                "street" to s(f.strasse.trim()), "houseNumber" to s(f.hausnummer.trim()), "zip" to s(f.plz.trim()),
                "city" to s(f.ort.trim()), "country" to s(f.land.trim().ifEmpty { "Deutschland" }),
            ),
        )
        m["amount"] = zahl(betrag)
        m["amountInWords"] = s(f.inWorten.trim().ifEmpty { DonationService.numberToGermanWords(betrag) })
        m["isWaiverOfRefund"] = JsonPrimitive(f.verzicht)
        if (geld) { m.remove("goodsDescription"); m.remove("goodsOrigin"); m.remove("goodsValuationBasis") }
        else {
            m["goodsDescription"] = s(f.sachBeschreibung.trim()); m["goodsOrigin"] = s(f.sachHerkunft); m["goodsValuationBasis"] = s(f.sachUnterlagen.trim())
        }
        m["taxOffice"] = s(f.finanzamt.trim()); m["taxNumber"] = s(f.steuernummer.trim())
        m["exemptionDate"] = s(f.freistellung.trim()); m["statementDate"] = s(f.feststellung.trim())
        m["assessmentPeriod"] = s(f.veranlagung.trim()); m["promotedPurpose"] = s(f.zweck.trim())
        m["isDirectlyPromoted"] = JsonPrimitive(true)
        m["issuedBy"] = s(f.aussteller.trim()); m["cityAndDate"] = s(f.ortDatum.trim())
        m["notes"] = s(f.notiz.trim())
        m["signed"] = JsonPrimitive(f.unterschrift)
        m["createdAt"] = base?.get("createdAt") ?: s(stamp)
        m["updatedAt"] = s(stamp)
        return m
    }

    private fun konto(): Pair<String, String>? {
        val haupt = Skr42.mains("income").firstOrNull { it.code == NUMMERNKREIS_CODE } ?: return null
        val unter = haupt.subCategories.firstOrNull { it.code == KONTO_CODE } ?: return null
        return BuchungRegeln.nummernkreisText(haupt) to unter.label
    }

    private fun buchungsText(f: SpendeForm) = "Spende / Zuwendung: ${f.name.trim()} (${f.nummer.trim()})"

    /** Beleg-Nummer der Buchung: „SP-<Jahr>-<letzte 3 Ziffern der Bestätigung>“, bei Kollision mit Zusatz -2, -3 … */
    private fun belegNummer(store: DocumentStore, f: SpendeForm): String {
        val jahr = f.datum.take(4).takeIf { it.length == 4 && it.all(Char::isDigit) } ?: LocalDate.now().year.toString()
        val ziffern = f.nummer.filter(Char::isDigit).takeLast(3).ifEmpty { "000" }
        val grund = "SP-$jahr-$ziffern"
        val vergeben = store.all(Finance.BUCHUNGEN).map { t(it, "documentNumber") }.toSet()
        var nr = grund; var n = 2
        while (nr in vergeben) nr = "$grund-${n++}"
        return nr
    }

    /**
     * Legt eine Bestätigung an oder ändert sie. Alles oder nichts für die Daten; das PDF ist eine Zugabe: schlägt es fehl,
     * bleibt die Bestätigung gespeichert und [SpendeErgebnis.pdfFehler] sagt warum.
     */
    fun speichern(
        store: DocumentStore, files: FileStore, f: SpendeForm, opt: SpendeOptionen, pdf: SpendenPdf?,
        now: ZonedDateTime = ZonedDateTime.now(),
    ): SpendeErgebnis {
        pruefen(store, f)?.let { throw IllegalArgumentException(it) }
        val betrag = BuchungRegeln.parseBetrag(f.betrag)!!.setScale(2, RoundingMode.HALF_UP)
        val stamp = Zeit.stempel(now)
        val alt = store.get(BEREICH, f.id)
        val altSpende = alt?.toDonationReceipt()
        val nummer = f.nummer.trim().ifEmpty { naechsteNummer(alle(store).map { it.receiptNumber }, f.datum.take(4).toIntOrNull() ?: now.year) }
        val form = f.copy(nummer = nummer)
        val json = bestaetigungJson(form, betrag, alt, now)

        var buchungId: String? = altSpende?.transactionId?.takeIf { store.get(Finance.BUCHUNGEN, it) != null }
        if (buchungId == null) json.remove("transactionId")

        // PDF vorab erzeugen, damit ein Fehler dort nichts Halbes hinterlässt.
        var pdfFehler: String? = null
        var bytes: ByteArray? = null
        val vorlaeufig = JsonObject(json).toDonationReceipt()
        if (opt.pdfAblegen && pdf != null) {
            try { bytes = pdf(vorlaeufig, steuerangaben(store)) } catch (e: Throwable) { pdfFehler = e.message ?: e.javaClass.simpleName }
        }
        val neueDatei = bytes?.let { BackupPaket.neueKennung(files).also { id -> files.putBytes(id, it) } }
        var dokId: String? = altSpende?.documentId
        var alteDatei: String? = null
        try {
            store.transaction {
                // Einnahmebuchung (nur Geldspenden, nur einmal)
                if (form.art != "goods" && opt.buchungAnlegen && buchungId == null) {
                    val k = konto() ?: throw IllegalStateException("Das Konto $KONTO_CODE fehlt im Kontenrahmen.")
                    if (store.get(Finance.KONTEN, opt.kontoId) == null) throw IllegalStateException("Bitte ein Konto für die Buchung wählen.")
                    val id = "tx-don-${f.id}-" + Zeit.zufall(4)
                    val bf = BuchungForm(
                        id = id, datum = form.datum, betrag = BuchungRegeln.betragText(betrag), art = "income", kontoId = opt.kontoId,
                        belegNummer = belegNummer(store, form), text = buchungsText(form), partner = form.name.trim(), sphaere = "ideell",
                        nummernkreis = k.first, konto = k.second, skrKonto = KONTO_CODE, ust = 0,
                        notiz = "Zuwendungsbestätigung ${form.nummer} nach amtl. BMF-Muster. ${form.notiz.trim()}".trim(),
                    )
                    store.put(Finance.BUCHUNGEN, id, BuchungDokument.build(bf, null, now))
                    buchungId = id
                } else if (opt.buchungAnpassen && buchungId != null) {
                    val b = store.get(Finance.BUCHUNGEN, buchungId!!)!!
                    val m = LinkedHashMap<String, JsonElement>(b)
                    val ausgabe = t(b, "type") == "expense"
                    m["date"] = s(form.datum)
                    m["amount"] = zahl(if (ausgabe) betrag.negate() else betrag)
                    m["partner"] = s(form.name.trim())
                    m["bookingText"] = s(buchungsText(form))
                    m["updatedAt"] = s(stamp)
                    store.put(Finance.BUCHUNGEN, buchungId!!, JsonObject(m))
                }
                if (buchungId != null) json["transactionId"] = s(buchungId!!)

                // PDF im Dokumentenarchiv
                if (neueDatei != null && bytes != null) {
                    val id = dokId?.takeIf { it.isNotEmpty() } ?: "doc-don-${f.id}"
                    val altDoc = store.get(DOKUMENTE, id)
                    alteDatei = altDoc?.let { t(it, "fileId") }?.takeIf { it.isNotEmpty() }
                    val jahrOrdner = Belege.zielOrdner(store, form.datum.take(4).takeIf { it.length == 4 && it.all(Char::isDigit) }, stamp)
                    val ordner = Belege.unterordner(store, jahrOrdner, "Spendenbescheinigungen", "Zuwendungsbestätigungen (Spendenquittungen) dieses Geschäftsjahres", stamp)
                    val sach = form.art == "goods"
                    val dateiName = "Zuwendungsbestaetigung_${DonationExport.dateinameTeil(form.nummer).ifEmpty { "ohne-Nr" }}_${DonationExport.dateinameTeil(form.name).ifEmpty { "Spender" }}.pdf"
                    val d = LinkedHashMap<String, JsonElement>(altDoc ?: JsonObject(emptyMap()))
                    d.putAll(
                        mapOf(
                            "id" to s(id), "title" to s("Zuwendungsbestätigung: ${form.nummer} - ${form.name.trim()}"),
                            "fileName" to s(dateiName), "fileType" to s("application/pdf"), "fileSize" to JsonPrimitive(bytes!!.size.toLong()),
                            "fileId" to s(neueDatei), "category" to s("belege"), "folderId" to s(ordner),
                            "date" to s(form.datum), "uploadDate" to s(stamp),
                            "tags" to JsonArray(
                                listOf("Spendenbescheinigung", "Zuwendungsbestätigung", if (sach) "Sachzuwendung" else "Geldzuwendung", form.nummer, "BMF-Muster").map { s(it) },
                            ),
                            "notes" to s("${if (sach) "Sachspende" else "Geldspende"} über ${Export.fixed2(betrag)} € von ${form.name.trim()}. BMF-konformes amtliches Formular."),
                            "isReceipt" to JsonPrimitive(true), "memberName" to s(form.name.trim()),
                            "createdAt" to (altDoc?.get("createdAt") ?: s(stamp)), "updatedAt" to s(stamp),
                        ),
                    )
                    if (buchungId != null) d["transactionId"] = s(buchungId!!) else d.remove("transactionId")
                    if (json["memberId"] != null) d["memberId"] = json["memberId"]!! else d.remove("memberId")
                    d.remove("dataUrl")
                    store.put(DOKUMENTE, id, JsonObject(d))
                    json["documentId"] = s(id)
                    dokId = id
                }
                store.put(BEREICH, f.id, JsonObject(json))
            }
        } catch (e: Throwable) {
            if (neueDatei != null) files.delete(neueDatei)
            throw e
        }
        val ad = alteDatei
        if (ad != null && ad != neueDatei && ad !in de.vereinsmanager.core.backup.Dateiverwaltung.referenziert(store)) files.delete(ad)
        return SpendeErgebnis(JsonObject(json).toDonationReceipt(), buchungId, dokId, pdfFehler)
    }

    /**
     * Löscht eine Bestätigung samt ihrem abgelegten PDF. Die verknüpfte Buchung wird nur mitgelöscht, wenn
     * [buchungMitLoeschen] gesetzt ist (am Desktop bleibt sie immer stehen).
     */
    fun loeschen(store: DocumentStore, files: FileStore, id: String, buchungMitLoeschen: Boolean) {
        val r = store.get(BEREICH, id)?.toDonationReceipt() ?: return
        store.delete(BEREICH, id)
        r.documentId?.let { DokumentStore.loeschen(store, files, listOf(it)) }
        if (buchungMitLoeschen) r.transactionId?.let { if (store.get(Finance.BUCHUNGEN, it) != null) Belege.buchungLoeschen(store, files, it) }
    }
}
