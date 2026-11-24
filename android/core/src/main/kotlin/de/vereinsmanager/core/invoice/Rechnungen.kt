package de.vereinsmanager.core.invoice

import de.vereinsmanager.core.backup.BackupPaket
import de.vereinsmanager.core.backup.Dateiverwaltung
import de.vereinsmanager.core.documents.DokumentStore
import de.vereinsmanager.core.files.FileStore
import de.vereinsmanager.core.files.putBytes
import de.vereinsmanager.core.finance.Belege
import de.vereinsmanager.core.finance.BuchungDokument
import de.vereinsmanager.core.finance.BuchungForm
import de.vereinsmanager.core.finance.BuchungRegeln
import de.vereinsmanager.core.finance.Finance
import de.vereinsmanager.core.finance.TeilForm
import de.vereinsmanager.core.members.Member
import de.vereinsmanager.core.members.Zeit
import de.vereinsmanager.core.settings.Vereinsdaten
import de.vereinsmanager.core.store.DocumentStore as Speicher
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

/** Was beim Speichern zusätzlich geschehen soll. */
data class RechnungOptionen(
    val pdfAblegen: Boolean = true,
    /** Eine verknüpfte Buchung an Betrag und Name der Rechnung angleichen. */
    val buchungAnpassen: Boolean = false,
)

/** Angaben beim Markieren als bezahlt. */
data class BezahltAngaben(
    val datum: String,
    /** "transfer", "cash", "sepa" oder "standing_order" */
    val zahlart: String = "transfer",
    val buchungAnlegen: Boolean = true,
    /** Das Finanzkonto, auf dem das Geld einging. */
    val kontoId: String = "",
    /** Nummernkreis wie am Desktop gespeichert: "44000 - Werbung, Sponsoring & Marketing" */
    val nummernkreis: String = "",
    /** Beschriftung des Kontos, z. B. "44000 - Werbeeinnahmen …" */
    val konto: String = "",
    val skrKonto: String = "",
)

data class RechnungErgebnis(val rechnung: Rechnung, val dokumentId: String?, val pdfFehler: String?)

/** Ein PDF zu einer Rechnung erzeugen; kommt von der App (dort liegt das Zeichnen). */
typealias RechnungsPdf = (Rechnung, Absender, Vorlage) -> ByteArray

/** Einen Vorschlag für Nummernkreis und Konto der Einnahme, je steuerlicher Sphäre. */
data class KontoVorschlag(val nummernkreis: String, val konto: String, val skrKonto: String)

object Rechnungen {
    const val BEREICH = "invoices"
    private const val DOKUMENTE = "documents"
    const val UNTERORDNER = "Ausgangsrechnungen"

    private fun s(v: String) = JsonPrimitive(v)
    private fun t(o: JsonObject?, k: String) = (o?.get(k) as? JsonPrimitive)?.takeIf { it !is JsonNull }?.contentOrNull.orEmpty()

    fun alle(store: Speicher): List<Rechnung> =
        store.all(BEREICH).map { it.toRechnung() }.sortedWith(compareByDescending<Rechnung> { it.datum }.thenByDescending { it.nummer })

    fun neueId(): String = "inv-" + System.currentTimeMillis() + "-" + Zeit.zufall(4)

    private fun neuePosition(ust: Int = 19) = PositionForm(id = "item-" + System.currentTimeMillis() + "-" + Zeit.zufall(3), ust = ust)

    /** Ein neues Formular mit den Vorgaben der Vorlage. */
    fun neu(store: Speicher, heute: LocalDate = LocalDate.now()): RechnungForm {
        val v = Vorlagen.lesen(store)
        return RechnungForm(
            id = neueId(), nummer = RechnungsRegeln.naechsteNummer(alle(store).map { it.nummer }, heute.year), datum = heute.toString(),
            leistungsdatum = heute.toString(), zahlungszielTage = v.zahlungszielTage, faellig = RechnungsRegeln.faellig(heute.toString(), v.zahlungszielTage),
            einleitung = v.einleitung, schluss = v.schluss, positionen = listOf(neuePosition()),
        )
    }

    fun von(r: Rechnung): RechnungForm = RechnungForm(
        id = r.id, nummer = r.nummer, datum = r.datum, leistungsdatum = r.leistungsdatum, zahlungszielTage = r.zahlungszielTage, faellig = r.faellig,
        status = r.status, sphaere = r.sphaere, empfaengerArt = r.empfaengerArt, empfaengerId = r.empfaengerId.orEmpty(), name = r.name, firma = r.firma,
        ansprechpartner = r.ansprechpartner, strasse = r.adresse.street, hausnummer = r.adresse.houseNumber, plz = r.adresse.zip, ort = r.adresse.city,
        land = r.adresse.country.ifEmpty { "Deutschland" }, email = r.email, telefon = r.telefon, titel = r.titel, betreff = r.betreff,
        einleitung = r.einleitung, schluss = r.schluss, kleinunternehmer = r.kleinunternehmer, notiz = r.notiz,
        positionen = r.positionen.map { PositionForm(it.id, it.text, RechnungsRegeln.mengeText(it.menge), it.einheit, BuchungRegeln.betragText(it.preis), it.ust) }
            .ifEmpty { listOf(neuePosition()) },
    )

    fun neuePositionFuer(f: RechnungForm): PositionForm = neuePosition(if (f.kleinunternehmer) 0 else 19)

    fun mitMitglied(f: RechnungForm, m: Member): RechnungForm = f.copy(
        empfaengerArt = "member", empfaengerId = m.id, name = "${m.firstName} ${m.lastName}".trim(), firma = "", ansprechpartner = "",
        strasse = m.street, hausnummer = m.houseNumber, plz = m.zip, ort = m.city, land = m.country.ifEmpty { "Deutschland" }, email = m.email, telefon = m.phone,
    )

    /** Ein Kontakt aus dem Bereich `contacts` (als JSON, wie am Desktop). */
    fun mitKontakt(f: RechnungForm, c: JsonObject): RechnungForm {
        val a = c["address"] as? JsonObject
        val cp = c["contactPerson"] as? JsonObject
        val ansprech = if (cp != null && (t(cp, "firstName").isNotEmpty() || t(cp, "lastName").isNotEmpty())) {
            val anrede = t(cp, "salutation").let { if (it.isNotEmpty()) "$it " else "" }
            val rolle = t(cp, "roleOrPosition").let { if (it.isNotEmpty()) " ($it)" else "" }
            "z. Hd. $anrede${t(cp, "firstName")} ${t(cp, "lastName")}$rolle".replace(Regex("\\s+"), " ").trim()
        } else ""
        val firma = t(c, "companyName").ifEmpty { if (t(c, "personType") == "legal") t(c, "displayName") else "" }
        return f.copy(
            empfaengerArt = "contact", empfaengerId = t(c, "id"), name = t(c, "displayName").ifEmpty { t(c, "companyName") }, firma = firma, ansprechpartner = ansprech,
            strasse = t(a, "street"), hausnummer = t(a, "houseNumber"), plz = t(a, "zip"), ort = t(a, "city"), land = t(a, "country").ifEmpty { "Deutschland" },
            email = t(c, "email"), telefon = t(c, "phone").ifEmpty { t(c, "mobile") },
        )
    }

    /** Kontakte zur Auswahl: Kennung und Anzeigename. */
    fun kontakte(store: Speicher): List<Pair<String, String>> =
        store.all("contacts").map { t(it, "id") to t(it, "displayName").ifEmpty { t(it, "companyName") } }.filter { it.first.isNotEmpty() && it.second.isNotEmpty() }.sortedBy { it.second.lowercase() }

    fun pruefen(store: Speicher, f: RechnungForm): String? {
        if (f.name.isBlank() && f.firma.isBlank()) return "Bitte einen Empfänger angeben."
        if (f.datum.isBlank()) return "Bitte das Rechnungsdatum eingeben."
        if (f.positionen.isEmpty()) return "Bitte mindestens eine Position hinzufügen."
        f.positionen.forEachIndexed { i, p ->
            if (p.text.isBlank()) return "Position ${i + 1}: Bitte eine Bezeichnung eingeben."
            if (RechnungsRegeln.parseMenge(p.menge)?.let { it.signum() > 0 } != true) return "Position ${i + 1}: Die Menge muss eine Zahl größer 0 sein."
            if (RechnungsRegeln.parsePreis(p.preis) == null) return "Position ${i + 1}: Bitte einen gültigen Einzelpreis eingeben."
        }
        val summen = RechnungsRegeln.berechnen(f.positionen, f.kleinunternehmer)
        if (summen.brutto.signum() < 0) return "Der Rechnungsbetrag darf nicht negativ sein."
        val nr = f.nummer.trim()
        if (nr.isNotEmpty() && alle(store).any { it.id != f.id && it.nummer.trim().equals(nr, ignoreCase = true) }) return "Die Rechnungsnummer $nr gibt es schon. Bitte eine andere wählen."
        return null
    }

    fun verknuepfteBuchung(store: Speicher, r: Rechnung): JsonObject? = r.buchungId?.let { store.get(Finance.BUCHUNGEN, it) }

    /** Würde das Speichern den Betrag ändern, der in der verknüpften Buchung steht? */
    fun buchungBetroffen(store: Speicher, f: RechnungForm): Boolean {
        val alt = store.get(BEREICH, f.id)?.toRechnung() ?: return false
        val b = verknuepfteBuchung(store, alt) ?: return false
        val neu = RechnungsRegeln.berechnen(f.positionen, f.kleinunternehmer).brutto
        val bisher = (b["amount"] as? JsonPrimitive)?.contentOrNull?.toBigDecimalOrNull()?.abs() ?: return false
        return bisher.compareTo(neu) != 0
    }

    private fun positionenJson(l: List<Position>): JsonArray = JsonArray(
        l.map { p ->
            JsonObject(
                linkedMapOf(
                    "id" to s(p.id), "position" to JsonPrimitive(p.nummer), "description" to s(p.text), "quantity" to RechnungsRegeln.json(p.menge),
                    "unit" to s(p.einheit), "unitPrice" to RechnungsRegeln.json(p.preis), "vatRate" to JsonPrimitive(p.ust), "totalPrice" to RechnungsRegeln.json(p.summe),
                ),
            )
        },
    )

    /**
     * Legt eine Rechnung an oder ändert sie. Unbekannte Felder und Zahlungsangaben (bezahlt am, Zahlart, verknüpfte Buchung)
     * bleiben erhalten – der Desktop wirft sie beim Speichern weg. Das PDF liegt im Ordner „Belege <Jahr> / Ausgangsrechnungen“
     * und wird bei erneutem Speichern ersetzt statt verdoppelt.
     */
    fun speichern(
        store: Speicher, files: FileStore, f: RechnungForm, opt: RechnungOptionen, pdf: RechnungsPdf?,
        now: ZonedDateTime = ZonedDateTime.now(),
    ): RechnungErgebnis {
        pruefen(store, f)?.let { throw IllegalArgumentException(it) }
        val stamp = Zeit.stempel(now)
        val summen = RechnungsRegeln.berechnen(f.positionen, f.kleinunternehmer)
        val alt = store.get(BEREICH, f.id)
        val nummer = f.nummer.trim().ifEmpty { RechnungsRegeln.naechsteNummer(alle(store).map { it.nummer }, f.datum.take(4).toIntOrNull() ?: now.year) }
        val m = LinkedHashMap<String, JsonElement>(alt ?: JsonObject(emptyMap()))
        m.putAll(
            mapOf(
                "id" to s(f.id), "invoiceNumber" to s(nummer), "date" to s(f.datum),
                "deliveryDate" to s(f.leistungsdatum.ifEmpty { f.datum }), "dueDate" to s(f.faellig.ifEmpty { f.datum }), "status" to s(f.status),
                "taxSphere" to s(f.sphaere), "recipientType" to s(f.empfaengerArt),
                "recipientName" to s(f.name.trim()),
                "recipientAddress" to JsonObject(
                    linkedMapOf(
                        "street" to s(f.strasse.trim()), "houseNumber" to s(f.hausnummer.trim()), "zip" to s(f.plz.trim()),
                        "city" to s(f.ort.trim()), "country" to s(f.land.trim().ifEmpty { "Deutschland" }),
                    ),
                ),
                "title" to s(f.titel.trim().ifEmpty { "Rechnung" }), "subject" to s(f.betreff.trim()),
                "items" to positionenJson(summen.positionen),
                "subtotalNet" to RechnungsRegeln.json(summen.netto),
                "vatAmounts" to JsonObject(summen.ustJeSatz.entries.associate { it.key.toString() to RechnungsRegeln.json(it.value) }),
                "totalVat" to RechnungsRegeln.json(summen.ustGesamt), "totalAmount" to RechnungsRegeln.json(summen.brutto),
                "paymentTermsDays" to JsonPrimitive(f.zahlungszielTage), "smallBusiness" to JsonPrimitive(f.kleinunternehmer),
                "createdAt" to (alt?.get("createdAt") ?: s(stamp)), "updatedAt" to s(stamp),
            ),
        )
        fun optional(k: String, v: String) { if (v.isBlank()) m.remove(k) else m[k] = s(v.trim()) }
        if (f.empfaengerId.isEmpty()) m.remove("recipientId") else m["recipientId"] = s(f.empfaengerId)
        optional("recipientCompany", f.firma); optional("recipientContactPerson", f.ansprechpartner)
        optional("recipientEmail", f.email); optional("recipientPhone", f.telefon)
        optional("introText", f.einleitung); optional("outroText", f.schluss); optional("notes", f.notiz)

        // Verknüpfte Buchung angleichen
        val buchungId = alt?.toRechnung()?.buchungId?.takeIf { store.get(Finance.BUCHUNGEN, it) != null }
        var pdfFehler: String? = null
        var bytes: ByteArray? = null
        val vorlaeufig = JsonObject(m).toRechnung()
        if (opt.pdfAblegen && pdf != null) {
            try { bytes = pdf(vorlaeufig, Absender.lesen(store.get(Vereinsdaten.BEREICH, Vereinsdaten.ID)), Vorlagen.lesen(store)) }
            catch (e: Throwable) { pdfFehler = e.message ?: e.javaClass.simpleName }
        }
        val neueDatei = bytes?.let { BackupPaket.neueKennung(files).also { id -> files.putBytes(id, it) } }
        var dokId: String? = alt?.toRechnung()?.dokumentId
        var alteDatei: String? = null
        try {
            store.transaction {
                if (opt.buchungAnpassen && buchungId != null) {
                    val b = store.get(Finance.BUCHUNGEN, buchungId)!!
                    val bm = LinkedHashMap<String, JsonElement>(b)
                    bm["amount"] = RechnungsRegeln.json(summen.brutto)
                    bm["partner"] = s(vorlaeufig.anzeigeName)
                    bm["bookingText"] = s(buchungsText(vorlaeufig))
                    bm["updatedAt"] = s(stamp)
                    // Aufteilung und Umsatzsteuer passen nicht mehr zum neuen Betrag: die Buchung wird einfach
                    bm.remove("splits"); bm["isSplit"] = JsonPrimitive(false)
                    bm["vatRate"] = JsonPrimitive(summen.positionen.map { it.ust }.distinct().singleOrNull() ?: 0)
                    store.put(Finance.BUCHUNGEN, buchungId, JsonObject(bm))
                }
                if (neueDatei != null) { // neueDatei gibt es nur, wenn das PDF (bytes) erzeugt wurde
                    val id = dokId?.takeIf { it.isNotEmpty() } ?: "doc-inv-${f.id}"
                    val altDoc = store.get(DOKUMENTE, id)
                    alteDatei = altDoc?.let { t(it, "fileId") }?.takeIf { it.isNotEmpty() }
                    val jahr = f.datum.take(4).takeIf { it.length == 4 && it.all(Char::isDigit) }
                    val jahrOrdner = Belege.zielOrdner(store, jahr, stamp)
                    val ordner = Belege.unterordner(store, jahrOrdner, UNTERORDNER, "Ausgangsrechnungen des Geschäftsjahres", stamp)
                    val d = LinkedHashMap<String, JsonElement>(altDoc ?: JsonObject(emptyMap()))
                    val dateiName = "Rechnung_${nummer.replace(Regex("[^A-Za-z0-9_-]"), "_")}.pdf"
                    d.putAll(
                        mapOf(
                            "id" to s(id), "title" to s("Ausgangsrechnung $nummer - ${vorlaeufig.anzeigeName}"),
                            "fileName" to s(dateiName), "fileType" to s("application/pdf"), "fileSize" to JsonPrimitive(bytes!!.size.toLong()),
                            "fileId" to s(neueDatei), "category" to s("belege"), "folderId" to s(ordner),
                            "date" to s(f.datum), "uploadDate" to s(stamp),
                            "tags" to JsonArray(listOf("Rechnung", "Ausgangsrechnung", f.status, f.sphaere).map { s(it) }),
                            "notes" to s("Ausgangsrechnung über ${de.vereinsmanager.core.export.Export.fixed2(summen.brutto)} €. Status: ${f.status}"),
                            "isReceipt" to JsonPrimitive(true),
                            "createdAt" to (altDoc?.get("createdAt") ?: s(stamp)), "updatedAt" to s(stamp),
                        ),
                    )
                    if (buchungId != null) d["transactionId"] = s(buchungId) else d.remove("transactionId")
                    if (f.empfaengerArt == "member" && f.empfaengerId.isNotEmpty()) { d["memberId"] = s(f.empfaengerId); d["memberName"] = s(f.name.trim()) } else { d.remove("memberId"); d.remove("memberName") }
                    d.remove("dataUrl")
                    d.remove("archiv") // neue Datei: Vermerk „im Jahresarchiv“ gilt nicht mehr (R4c)
                    store.put(DOKUMENTE, id, JsonObject(d))
                    m["documentId"] = s(id)
                    dokId = id
                }
                store.put(BEREICH, f.id, JsonObject(m))
            }
        } catch (e: Throwable) {
            if (neueDatei != null) files.delete(neueDatei)
            throw e
        }
        val ad = alteDatei
        if (ad != null && ad != neueDatei && ad !in Dateiverwaltung.referenziert(store)) files.delete(ad)
        return RechnungErgebnis(JsonObject(m).toRechnung(), dokId, pdfFehler)
    }

    fun buchungsText(r: Rechnung): String = "Rechnung ${r.nummer}" + if (r.betreff.isNotBlank()) ": ${r.betreff}" else ""

    /** Vorschlag für Nummernkreis und Konto der Einnahme (der Anwender kann ihn ändern). */
    fun kontoVorschlag(sphaere: String): KontoVorschlag {
        val (haupt, konto) = when (sphaere) {
            "ideell" -> "40800" to "40890"
            "vermoegen" -> "46000" to "46900"
            "zweckbetrieb" -> "41000" to "41000"
            else -> "44000" to "44000"
        }
        val m = de.vereinsmanager.core.skr42.Skr42.findMain(haupt)!!
        val sub = m.subCategories.first { it.code == konto }
        return KontoVorschlag(BuchungRegeln.nummernkreisText(m), "${sub.code} - ${sub.name}", sub.code)
    }

    private fun eindeutigeBelegNummer(store: Speicher, basis: String): String {
        val vorhanden = store.all(Finance.BUCHUNGEN).map { t(it, "documentNumber") }.toSet()
        if (basis !in vorhanden) return basis
        var n = 2
        while ("$basis-$n" in vorhanden) n++
        return "$basis-$n"
    }

    /**
     * Markiert die Rechnung als bezahlt und legt auf Wunsch die Einnahmebuchung an (am Desktop gibt es sie nicht). Brutto-Betrag;
     * bei mehreren Steuersätzen wird die Buchung je Satz aufgeteilt. Gibt die Buchungskennung zurück, falls angelegt.
     */
    fun bezahlen(store: Speicher, id: String, a: BezahltAngaben, now: ZonedDateTime = ZonedDateTime.now()): String? {
        val alt = store.get(BEREICH, id) ?: throw IllegalArgumentException("Die Rechnung gibt es nicht mehr.")
        val r = alt.toRechnung()
        if (r.status == "cancelled") throw IllegalArgumentException("Eine stornierte Rechnung kann nicht bezahlt werden.")
        if (a.datum.isBlank()) throw IllegalArgumentException("Bitte das Zahldatum eingeben.")
        if (a.buchungAnlegen && store.get(Finance.KONTEN, a.kontoId) == null) throw IllegalArgumentException("Bitte ein Konto für die Buchung wählen.")
        if (a.buchungAnlegen && (a.nummernkreis.isBlank() || a.skrKonto.isBlank())) throw IllegalArgumentException("Bitte Nummernkreis und Konto der Einnahme wählen.")
        val stamp = Zeit.stempel(now)
        var buchungId: String? = null
        store.transaction {
            if (a.buchungAnlegen && r.buchungId?.let { store.get(Finance.BUCHUNGEN, it) } == null) {
                val tid = "tx-inv-$id-" + Zeit.zufall(4)
                val saetze = r.positionen.map { it.ust }.distinct().sorted()
                val teile = if (saetze.size > 1) saetze.map { satz ->
                    val netto = r.positionen.filter { it.ust == satz }.fold(BigDecimal.ZERO) { x, p -> x + p.summe }
                    val brutto = (netto + netto * BigDecimal(satz) / BigDecimal(100)).setScale(2, RoundingMode.HALF_UP)
                    TeilForm(
                        id = "teil-" + Zeit.zufall(6), betrag = BuchungRegeln.betragText(brutto), text = "${buchungsText(r)} ($satz % USt)",
                        sphaere = r.sphaere, nummernkreis = a.nummernkreis, konto = a.konto, skrKonto = a.skrKonto, ust = satz,
                    )
                } else emptyList()
                val bf = BuchungForm(
                    id = tid, datum = a.datum, betrag = BuchungRegeln.betragText(r.brutto), art = "income", kontoId = a.kontoId,
                    belegNummer = eindeutigeBelegNummer(store, r.nummer), text = buchungsText(r), partner = r.anzeigeName, sphaere = r.sphaere,
                    nummernkreis = a.nummernkreis, konto = a.konto, skrKonto = a.skrKonto, ust = saetze.singleOrNull() ?: 0,
                    notiz = "Zahlung der Rechnung ${r.nummer}", aufgeteilt = teile.isNotEmpty(), teile = teile,
                )
                store.put(Finance.BUCHUNGEN, tid, BuchungDokument.build(bf, null, now))
                buchungId = tid
            }
            val m = LinkedHashMap<String, JsonElement>(alt)
            m["status"] = s("paid"); m["paidAt"] = s(a.datum); m["paymentMethod"] = s(a.zahlart); m["updatedAt"] = s(stamp)
            if (buchungId != null) m["linkedTransactionId"] = s(buchungId!!)
            store.put(BEREICH, id, JsonObject(m))
            if (buchungId != null) r.dokumentId?.let { did -> store.get(DOKUMENTE, did)?.let { d -> store.put(DOKUMENTE, did, JsonObject(LinkedHashMap<String, JsonElement>(d).also { it["transactionId"] = s(buchungId!!) })) } }
        }
        return buchungId
    }

    /** Setzt eine bezahlte Rechnung zurück auf „offen“. Die Buchung wird gelöscht oder nur gelöst. */
    fun zuruecksetzen(store: Speicher, files: FileStore, id: String, buchungMitLoeschen: Boolean, now: ZonedDateTime = ZonedDateTime.now()) {
        val alt = store.get(BEREICH, id) ?: return
        val r = alt.toRechnung()
        val m = LinkedHashMap<String, JsonElement>(alt)
        m["status"] = s("open"); m.remove("paidAt"); m.remove("paymentMethod"); m.remove("linkedTransactionId"); m["updatedAt"] = s(Zeit.stempel(now))
        store.put(BEREICH, id, JsonObject(m))
        if (buchungMitLoeschen) r.buchungId?.let { if (store.get(Finance.BUCHUNGEN, it) != null) Belege.buchungLoeschen(store, files, it) }
    }

    fun stornieren(store: Speicher, id: String, now: ZonedDateTime = ZonedDateTime.now()) {
        val alt = store.get(BEREICH, id) ?: return
        if (t(alt, "status") == "paid") throw IllegalArgumentException("Eine bezahlte Rechnung kann erst nach dem Zurücksetzen auf „offen“ storniert werden.")
        val m = LinkedHashMap<String, JsonElement>(alt)
        m["status"] = s("cancelled"); m["updatedAt"] = s(Zeit.stempel(now))
        store.put(BEREICH, id, JsonObject(m))
    }

    /** Löscht die Rechnung samt abgelegtem PDF; die Buchung nur auf Wunsch. */
    fun loeschen(store: Speicher, files: FileStore, id: String, buchungMitLoeschen: Boolean) {
        val r = store.get(BEREICH, id)?.toRechnung() ?: return
        store.delete(BEREICH, id)
        r.dokumentId?.let { DokumentStore.loeschen(store, files, listOf(it)) }
        if (buchungMitLoeschen) r.buchungId?.let { if (store.get(Finance.BUCHUNGEN, it) != null) Belege.buchungLoeschen(store, files, it) }
    }

    /**
     * Sammellöschen wie am Desktop (Code-Prüfung C2): Die Rechnungen und ihre abgelegten PDFs werden gelöscht, verknüpfte
     * Buchungen bleiben stehen. Unbekannte Kennungen werden übergangen.
     */
    fun loeschenMehrere(store: Speicher, files: FileStore, ids: Collection<String>) {
        for (id in ids) loeschen(store, files, id, buchungMitLoeschen = false)
    }
}
