package de.vereinsmanager.core.sepa

import java.math.BigDecimal
import java.math.BigInteger
import java.math.RoundingMode
import java.text.Normalizer
import java.time.Clock
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneOffset
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter
import kotlin.random.Random

/**
 * SEPA-Lastschrift. Kotlin-Fassung von src/services/sepaService.ts (ohne PDF-Protokoll).
 *
 * Bewusste Abweichung vom Desktop: Beträge sind BigDecimal statt Gleitkommazahl, damit
 * Summen exakt sind. Das Ergebnis ist dasselbe, außer in seltenen Randfällen, in denen die
 * Desktop-Rundung wegen der Gleitkommadarstellung danebenliegt.
 */
object SepaService {

    private val STANDARD_LENGTHS = mapOf(
        "DE" to 22, "AT" to 20, "CH" to 21, "FR" to 27, "NL" to 18,
        "IT" to 27, "ES" to 24, "BE" to 16, "LU" to 20,
    )

    fun validateIban(rawIban: String?): IbanCheck {
        if (rawIban.isNullOrEmpty()) return IbanCheck(false, "", "", "IBAN fehlt")
        val clean = rawIban.uppercase().replace(Regex("[^A-Z0-9]"), "")
        if (clean.length < 15 || clean.length > 34) {
            return IbanCheck(false, clean, clean.take(2), "Ungültige Länge (15-34 Zeichen erforderlich)")
        }
        val country = clean.take(2)
        val std = STANDARD_LENGTHS[country]
        if (std != null && clean.length != std) {
            return IbanCheck(
                false, clean, country,
                "IBAN für $country muss genau $std Zeichen lang sein (aktuell: ${clean.length})",
            )
        }
        val rearranged = clean.substring(4) + clean.substring(0, 4)
        val numeric = buildString {
            for (ch in rearranged) {
                if (ch in 'A'..'Z') append(ch.code - 55) else append(ch)
            }
        }
        val ok = BigInteger(numeric).mod(BigInteger.valueOf(97)) == BigInteger.ONE
        val formatted = clean.chunked(4).joinToString(" ")
        return IbanCheck(ok, formatted, country, if (ok) null else "Ungültige IBAN-Prüfziffer")
    }

    private val BIC_REGEX = Regex("^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$")

    /** BIC ist optional (reine IBAN-Zahlung im SEPA-Raum): leer gilt als gültig. */
    fun validateBic(bic: String?): Boolean {
        if (bic == null || bic.isBlank()) return true
        return BIC_REGEX.matches(bic.uppercase().trim())
    }

    /** Zeichensatz nach EPC/ISO 20022: Umlaute ausschreiben, Akzente abbilden, Rest entfernen. */
    fun sanitizeText(text: String?, maxLength: Int = 140): String {
        if (text.isNullOrEmpty()) return ""
        var res = text
            .replace("Ä", "Ae").replace("Ö", "Oe").replace("Ü", "Ue")
            .replace("ä", "ae").replace("ö", "oe").replace("ü", "ue")
            .replace("ß", "ss").replace("&", "+")
        res = Normalizer.normalize(res, Normalizer.Form.NFD)
            .replace(Regex("[\\u0300-\\u036f]"), "")
            // Kein (?U): Android kennt die Option nicht und stürzt ab. Die Unicode-Leerzeichen stehen deshalb ausdrücklich da.
            .replace(Regex("[\\s\\u00A0\\u1680\\u2000-\\u200A\\u2028\\u2029\\u202F\\u205F\\u3000]+"), " ")
            .replace(Regex("[^A-Za-z0-9/\\-?:().,'+ ]"), "")
            .trim()
        if (maxLength > 0 && res.length > maxLength) res = res.substring(0, maxLength)
        return res
    }

    fun escapeXml(unsafe: String?): String {
        if (unsafe.isNullOrEmpty()) return ""
        return unsafe.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
            .replace("\"", "&quot;").replace("'", "&apos;")
    }

    private val ISO_DATE = Regex("^\\d{4}-\\d{2}-\\d{2}$")

    /** Datum als JJJJ-MM-TT. Ein vollständiger Zeitstempel wird in UTC auf sein Datum gekürzt. */
    fun formatDate(date: String, clock: Clock = Clock.systemUTC()): String {
        if (ISO_DATE.matches(date)) return date
        runCatching { return Instant.parse(date).atZone(ZoneOffset.UTC).toLocalDate().toString() }
        runCatching { return java.time.OffsetDateTime.parse(date).withOffsetSameInstant(ZoneOffset.UTC).toLocalDate().toString() }
        runCatching { return LocalDate.parse(date.take(10)).toString() }
        return LocalDate.now(clock).toString()
    }

    private fun round2(x: BigDecimal) = x.setScale(2, RoundingMode.HALF_UP)

    private fun div(fee: BigDecimal, n: Long) = round2(fee.divide(BigDecimal(n), 10, RoundingMode.HALF_UP))
    private fun mul(fee: BigDecimal, n: Long) = round2(fee.multiply(BigDecimal(n)))

    /** Betrag, der in einem Lauf dieser Periode eingezogen wird. */
    fun calculateCollectionAmount(member: SepaMember, filter: SepaPeriodFilter): BigDecimal {
        val raw = member.feeAmount ?: BigDecimal.ZERO
        if (raw.signum() <= 0) return BigDecimal.ZERO
        val p = member.feePeriod
        when (filter) {
            SepaPeriodFilter.MONTHLY_1, SepaPeriodFilter.MONTHLY_15, SepaPeriodFilter.MONTHLY_ALL -> when (p) {
                "monthly" -> return raw
                "yearly" -> return div(raw, 12)
                "quarterly" -> return div(raw, 3)
                "half_yearly" -> return div(raw, 6)
            }
            SepaPeriodFilter.QUARTERLY -> when (p) {
                "quarterly" -> return raw
                "yearly" -> return div(raw, 4)
                "monthly" -> return mul(raw, 3)
                "half_yearly" -> return div(raw, 2)
            }
            SepaPeriodFilter.HALF_YEARLY -> when (p) {
                "half_yearly" -> return raw
                "yearly" -> return div(raw, 2)
                "monthly" -> return mul(raw, 6)
                "quarterly" -> return mul(raw, 2)
            }
            SepaPeriodFilter.YEARLY -> when (p) {
                "yearly" -> return raw
                "monthly" -> return mul(raw, 12)
                "quarterly" -> return mul(raw, 4)
                "half_yearly" -> return mul(raw, 2)
            }
        }
        return raw
    }

    private fun isEligible(m: SepaMember, filter: SepaPeriodFilter): Boolean {
        if (m.status == "terminated" || m.status == "suspended") return false
        if (m.paymentMethod != "sepa") return false
        val dueDay = m.monthlyDueDay?.takeIf { it != 0 } ?: 1
        return when (filter) {
            SepaPeriodFilter.MONTHLY_1 -> m.feePeriod == "monthly" && dueDay == 1
            SepaPeriodFilter.MONTHLY_15 -> m.feePeriod == "monthly" && dueDay == 15
            SepaPeriodFilter.MONTHLY_ALL -> m.feePeriod == "monthly"
            SepaPeriodFilter.QUARTERLY -> m.feePeriod == "quarterly"
            SepaPeriodFilter.HALF_YEARLY -> m.feePeriod == "half_yearly"
            SepaPeriodFilter.YEARLY -> m.feePeriod == "yearly"
        }
    }

    private val PLACEHOLDER = Regex("\\{(\\w+)\\}")

    /** Baut die Einzugsposten aus dem Mitgliederbestand. [clock] und [random] sind für Tests austauschbar. */
    fun buildCollectionItems(
        members: List<SepaMember>,
        config: SepaRunConfig,
        clock: Clock = Clock.systemDefaultZone(),
        random: Random = Random.Default,
    ): List<SepaItem> {
        val filter = config.periodFilter
        val today = LocalDate.now(clock)
        val targetYear = config.targetYear?.takeIf { it != 0 } ?: today.year
        val targetMonth = config.targetMonth?.takeIf { it != 0 } ?: today.monthValue
        val monthStr = targetMonth.toString().padStart(2, '0')

        return members.filter { isEligible(it, filter) }.map { m ->
            val amount = calculateCollectionAmount(m, filter)
            val errors = mutableListOf<String>()

            val ibanCheck = validateIban(m.iban ?: "")
            if (!ibanCheck.isValid) errors.add(ibanCheck.error ?: "Ungültige IBAN")
            if (!m.bic.isNullOrEmpty() && !validateBic(m.bic)) errors.add("Ungültiger BIC-Code")

            val mandateRef = m.mandateReference?.trim()?.takeIf { it.isNotEmpty() } ?: "MANDAT-${m.memberNumber}"
            val mandateDate = m.mandateDate?.takeIf { it.isNotEmpty() } ?: m.entryDate ?: ""
            if (mandateDate.isEmpty()) errors.add("Datum der Mandatsunterzeichnung fehlt")

            val accountHolder = (m.accountHolder?.takeIf { it.isNotEmpty() } ?: "${m.firstName} ${m.lastName}").trim()
            if (accountHolder.isEmpty()) errors.add("Kontoinhaber fehlt")
            if (amount.signum() <= 0) errors.add("Beitrag ist 0,00 €")

            var periodLabel = "$monthStr/$targetYear"
            when (filter) {
                SepaPeriodFilter.QUARTERLY ->
                    periodLabel = "Q${config.targetQuarter ?: ((targetMonth + 2) / 3)}/$targetYear"
                SepaPeriodFilter.HALF_YEARLY ->
                    periodLabel = "H${config.targetHalfYear ?: (if (targetMonth <= 6) 1 else 2)}/$targetYear"
                SepaPeriodFilter.YEARLY -> periodLabel = "$targetYear"
                else -> {}
            }

            val name = "${m.lastName}, ${m.firstName}"
            val dept = m.department ?: ""
            val placeholders = mapOf(
                "PERIOD" to periodLabel, "period" to periodLabel,
                "month" to monthStr, "MONTH" to monthStr,
                "MEMBER_NO" to m.memberNumber, "memberNumber" to m.memberNumber,
                "NAME" to name, "name" to name,
                "YEAR" to targetYear.toString(), "year" to targetYear.toString(),
                "DEPT" to dept, "department" to dept,
            )
            val template = config.remittanceTemplate?.takeIf { it.isNotEmpty() }
                ?: "Mitgliedsbeitrag {PERIOD} {MEMBER_NO} {NAME}"
            val custom = PLACEHOLDER.replace(template) { r -> placeholders[r.groupValues[1]] ?: r.value }
            val remittance = sanitizeText(custom, 140)

            val endToEnd = "E2E-${m.memberNumber}-$targetYear$monthStr-${random.nextInt(1000)}"
                .replace(Regex("[^a-zA-Z0-9-]"), "")

            val valid = errors.isEmpty()
            SepaItem(
                memberId = m.id,
                memberNumber = m.memberNumber,
                memberName = name,
                accountHolder = accountHolder,
                iban = (m.iban ?: "").uppercase().replace(Regex("\\s"), ""),
                bic = (m.bic ?: "").uppercase().trim(),
                bankName = m.bankName,
                mandateReference = mandateRef,
                mandateDate = formatDate(mandateDate, clock),
                sequenceType = m.mandateSequenceType ?: "RCUR",
                amount = amount,
                feePeriod = m.feePeriod,
                department = m.department,
                monthlyDueDay = m.monthlyDueDay?.takeIf { it != 0 } ?: (if (filter == SepaPeriodFilter.MONTHLY_15) 15 else 1),
                remittanceInfo = remittance,
                endToEndId = endToEnd,
                isValid = valid,
                validationErrors = errors,
                selected = valid,
            )
        }
    }

    /** Dieselbe Auswahl für XML und Protokoll: ausgewählt, gültig, Betrag über null. */
    fun activeItems(items: List<SepaItem>): List<SepaItem> =
        items.filter { it.selected && it.isValid && it.amount.signum() > 0 }

    /** pain.008.001.02 (Basislastschrift). Wirft, wenn kein gültiger Posten ausgewählt ist. */
    fun generateSepaXml(
        config: SepaRunConfig,
        items: List<SepaItem>,
        now: ZonedDateTime = ZonedDateTime.now(),
        random: Random = Random.Default,
    ): String {
        val active = activeItems(items)
        if (active.isEmpty()) throw IllegalStateException("Keine gültigen Lastschriftposten ausgewählt.")

        val total = round2(active.fold(BigDecimal.ZERO) { s, i -> s + i.amount })
        val count = active.size
        val creDtTm = now.withZoneSameInstant(ZoneOffset.UTC).format(DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss"))
        val msgId = "MSG-" + now.format(DateTimeFormatter.ofPattern("yyyyMMdd-HHmmss")) + "-" + random.nextInt(1000)
        val pmtInfId = "PMT-${config.periodFilter.wire}-${config.targetYear}-${config.executionDate}"

        val creditorIban = config.creditorIban.uppercase().replace(Regex("\\s"), "")
        val creditorBic = config.creditorBic?.uppercase()?.trim()
        val creditorId = config.creditorId.uppercase().trim()
        val clubName = sanitizeText(config.creditorName.ifEmpty { "Verein" }, 70)

        val tx = active.joinToString("\n") { item ->
            val debtorName = sanitizeText(item.accountHolder, 70)
            val remittance = sanitizeText(item.remittanceInfo, 140)
            val debtorIban = item.iban.uppercase().replace(Regex("\\s"), "")
            val debtorBic = item.bic.uppercase().trim()
            """      <DrctDbtTxInf>
        <PmtId>
          <EndToEndId>${escapeXml(item.endToEndId)}</EndToEndId>
        </PmtId>
        <InstdAmt Ccy="EUR">${round2(item.amount).toPlainString()}</InstdAmt>
        <DrctDbtTx>
          <MndtRltdInf>
            <MndtId>${escapeXml(item.mandateReference)}</MndtId>
            <DtOfSgntr>${formatDate(item.mandateDate)}</DtOfSgntr>
          </MndtRltdInf>
        </DrctDbtTx>
        <DbtrAgt>
          <FinInstnId>
            ${if (debtorBic.isNotEmpty()) "<BIC>$debtorBic</BIC>" else "<Othr><Id>NOTPROVIDED</Id></Othr>"}
          </FinInstnId>
        </DbtrAgt>
        <Dbtr>
          <Nm>${escapeXml(debtorName)}</Nm>
        </Dbtr>
        <DbtrAcct>
          <Id>
            <IBAN>$debtorIban</IBAN>
          </Id>
        </DbtrAcct>
        <RmtInf>
          <Ustrd>${escapeXml(remittance)}</Ustrd>
        </RmtInf>
      </DrctDbtTxInf>"""
        }

        val totalStr = total.toPlainString()
        return """<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.008.001.02" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="urn:iso:std:iso:20022:tech:xsd:pain.008.001.02 pain.008.001.02.xsd">
  <CstmrDrctDbtInitn>
    <GrpHdr>
      <MsgId>${escapeXml(msgId)}</MsgId>
      <CreDtTm>$creDtTm</CreDtTm>
      <NbOfTxs>$count</NbOfTxs>
      <CtrlSum>$totalStr</CtrlSum>
      <InitgPty>
        <Nm>${escapeXml(clubName)}</Nm>
      </InitgPty>
    </GrpHdr>
    <PmtInf>
      <PmtInfId>${escapeXml(pmtInfId)}</PmtInfId>
      <PmtMtd>DD</PmtMtd>
      <BtchBookg>true</BtchBookg>
      <NbOfTxs>$count</NbOfTxs>
      <CtrlSum>$totalStr</CtrlSum>
      <PmtTpInf>
        <SvcLvl>
          <Cd>SEPA</Cd>
        </SvcLvl>
        <LclInstrm>
          <Cd>CORE</Cd>
        </LclInstrm>
        <SeqTp>RCUR</SeqTp>
      </PmtTpInf>
      <ReqdColltnDt>${formatDate(config.executionDate)}</ReqdColltnDt>
      <Cdtr>
        <Nm>${escapeXml(clubName)}</Nm>
      </Cdtr>
      <CdtrAcct>
        <Id>
          <IBAN>$creditorIban</IBAN>
        </Id>
      </CdtrAcct>
      <CdtrAgt>
        <FinInstnId>
          ${if (!creditorBic.isNullOrEmpty()) "<BIC>$creditorBic</BIC>" else "<Othr><Id>NOTPROVIDED</Id></Othr>"}
        </FinInstnId>
      </CdtrAgt>
      <CdtrSchmeId>
        <Id>
          <PrvtId>
            <Othr>
              <Id>${escapeXml(creditorId)}</Id>
              <SchmeNm>
                <Prtry>SEPA</Prtry>
              </SchmeNm>
            </Othr>
          </PrvtId>
        </Id>
      </CdtrSchmeId>
$tx
    </PmtInf>
  </CstmrDrctDbtInitn>
</Document>"""
    }
}
