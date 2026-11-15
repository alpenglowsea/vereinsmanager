package de.vereinsmanager.android.ui

import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.relocation.bringIntoViewRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Checkbox
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Icon
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.material3.Surface
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberDatePickerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import de.vereinsmanager.android.AppModel
import de.vereinsmanager.core.members.FormTab
import de.vereinsmanager.core.members.MemberForm
import de.vereinsmanager.core.members.MemberLabels
import de.vereinsmanager.core.members.MemberRules
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneOffset

internal val TAB_NAMES = linkedMapOf(
    FormTab.BASIS to "Basis", FormTab.KONTAKT to "Kontakt", FormTab.MITGLIEDSCHAFT to "Mitgliedschaft",
    FormTab.ZAHLUNG to "Zahlung", FormTab.NOTIZEN to "Notizen",
)
internal val GENDERS = linkedMapOf("none" to "Keine Angabe", "m" to "Männlich", "w" to "Weiblich", "d" to "Divers")
internal val RELATIONS = linkedMapOf("Mutter" to "Mutter", "Vater" to "Vater", "Gesetzlicher Vormund" to "Gesetzlicher Vormund")
internal val STATUS_FORM = linkedMapOf(
    "active" to "Aktiv", "passive" to "Passiv", "honorary" to "Ehrenmitglied", "suspended" to "Ruhend",
    "terminated" to "Gekündigt / Ausgetreten",
)
internal val TYPE_FORM = linkedMapOf(
    "full" to "Vollmitglied (Erwachsene)", "youth" to "Jugend / Kind", "reduced" to "Ermäßigt (Student/Rentner)",
    "family" to "Familienbeitrag", "supporting" to "Fördermitglied / Sponsor", "honorary" to "Ehrenmitglied (beitragsfrei)",
    "ausgetreten" to "Ausgetreten",
)
internal val PERIOD_FORM = linkedMapOf(
    "monthly" to "Monatlich", "quarterly" to "Vierteljährlich (Quartal)", "half_yearly" to "Halbjährlich",
    "yearly" to "Jährlich", "none" to "Beitragsfrei (0,00 €)",
)
internal val PAYMENT_ORDER = listOf("sepa", "transfer", "standing_order", "cash", "exempt")

@Composable
internal fun Feld(
    label: String, value: String, onChange: (String) -> Unit, error: String? = null, enabled: Boolean = true,
    keyboard: KeyboardType = KeyboardType.Text, singleLine: Boolean = true, hinweis: String? = null,
    transformation: VisualTransformation = VisualTransformation.None, fokus: Boolean = false,
) {
    val unten = error ?: hinweis
    // fokus = true: Das Feld wird beim Erscheinen in den sichtbaren Bereich geholt und bekommt den Cursor (Sprung aus anderen Seiten).
    val anforderung = remember { androidx.compose.ui.focus.FocusRequester() }
    val sichtbar = remember { androidx.compose.foundation.relocation.BringIntoViewRequester() }
    if (fokus) androidx.compose.runtime.LaunchedEffect(Unit) {
        kotlinx.coroutines.delay(250)
        try { sichtbar.bringIntoView() } catch (e: Exception) { }
        try { anforderung.requestFocus() } catch (e: Exception) { }
    }
    OutlinedTextField(
        value = value, onValueChange = onChange, label = { Text(label) }, enabled = enabled, singleLine = singleLine,
        isError = error != null, keyboardOptions = KeyboardOptions(keyboardType = keyboard), visualTransformation = transformation,
        supportingText = if (unten != null) { { Text(unten) } } else null,
        shape = RoundedCornerShape(16.dp),
        colors = OutlinedTextFieldDefaults.colors(
            focusedBorderColor = MaterialTheme.colorScheme.primary, unfocusedBorderColor = MaterialTheme.colorScheme.outline.copy(alpha = 0.6f),
        ),
        modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp)
            .then(if (fokus) Modifier.bringIntoViewRequester(sichtbar).focusRequester(anforderung) else Modifier),
    )
}

@Composable
internal fun Auswahl(label: String, options: Map<String, String>, value: String, enabled: Boolean = true, onChange: (String) -> Unit) {
    var open by remember { mutableStateOf(false) }
    Column(Modifier.fillMaxWidth().padding(vertical = 4.dp)) {
        Text(label, style = MaterialTheme.typography.labelMedium)
        OutlinedButton(
            onClick = { open = true }, enabled = enabled, modifier = Modifier.fillMaxWidth().height(52.dp),
            shape = RoundedCornerShape(16.dp), border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.6f)),
            contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 16.dp),
        ) {
            Text(options[value] ?: value.ifEmpty { "–" }, Modifier.weight(1f), maxLines = 1, overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis)
            Icon(Lucide.ChevronDown, null, Modifier.size(18.dp))
        }
        DropdownMenu(open, { open = false }) {
            options.forEach { (k, v) -> DropdownMenuItem(text = { Text(v) }, onClick = { onChange(k); open = false }) }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun DatumFeld(label: String, iso: String, error: String? = null, optional: Boolean = false, onChange: (String) -> Unit) {
    var open by remember { mutableStateOf(false) }
    Column(Modifier.fillMaxWidth().padding(vertical = 4.dp)) {
        Text(label, style = MaterialTheme.typography.labelMedium)
        Row(verticalAlignment = Alignment.CenterVertically) {
            OutlinedButton(
                onClick = { open = true }, modifier = Modifier.height(52.dp), shape = RoundedCornerShape(16.dp),
                border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.6f)),
            ) { Text(if (iso.isEmpty()) "Datum wählen" else deDate(iso)) }
            if (optional && iso.isNotEmpty()) TextButton(onClick = { onChange("") }) { Text("Löschen") }
        }
        if (error != null) Text(error, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
    }
    if (open) {
        val start = try { LocalDate.parse(iso) } catch (e: Exception) { LocalDate.now() }
        val state = rememberDatePickerState(initialSelectedDateMillis = start.atStartOfDay(ZoneOffset.UTC).toInstant().toEpochMilli())
        DatePickerDialog(
            onDismissRequest = { open = false },
            confirmButton = {
                TextButton(onClick = {
                    state.selectedDateMillis?.let { onChange(Instant.ofEpochMilli(it).atZone(ZoneOffset.UTC).toLocalDate().toString()) }
                    open = false
                }) { Text("Übernehmen") }
            },
            dismissButton = { TextButton(onClick = { open = false }) { Text("Abbrechen") } },
        ) { DatePicker(state = state) }
    }
}

/** Anlegen (id == null) und Bearbeiten eines Mitglieds. Die Verknüpfungsregeln stecken im Kern ([MemberRules]). */
@Composable
fun MemberFormScreen(model: AppModel, id: String?, onDone: () -> Unit, modifier: Modifier = Modifier) {
    val existing = remember(id) { id?.let { i -> model.members.firstOrNull { it.id == i } } }
    var f by remember(id) {
        mutableStateOf(
            existing?.let { MemberRules.von(it) } ?: MemberRules.neu(model.naechsteNummer(), model.departments, LocalDate.now()),
        )
    }
    var tab by remember { mutableStateOf(FormTab.BASIS) }
    // Nach dem ersten Speichern-Versuch wird laufend neu geprüft: Behobene Fehler verschwinden sofort.
    var versucht by remember { mutableStateOf(false) }
    var saveError by remember { mutableStateOf<String?>(null) }
    val today = LocalDate.now()
    val others = remember(id, model.members) { model.members.filter { it.id != id }.map { it.number } }
    val errors = if (versucht) MemberRules.validate(f, others) else emptyMap()
    val departmentOptions = remember(model.departments, f.department) {
        val list = model.departments.toMutableList()
        if (f.department.isNotEmpty() && f.department !in list) list.add(f.department)
        list.associateWith { it }
    }

    val sc = MaterialTheme.colorScheme
    val reiter = TAB_NAMES.keys.toList()
    val nr = reiter.indexOf(tab)
    val fehlerReiter = MemberRules.ersterFehlerReiter(errors)
    // Alles scrollt zusammen: Die Knöpfe stehen am Ende der Seite und sind bei geöffneter Tastatur durch Hinunterscrollen erreichbar.
    Column(modifier.verticalScroll(rememberScrollState()).padding(horizontal = 16.dp)) {
        Text(
            if (existing == null) "Neues Mitglied" else "Mitglied bearbeiten",
            style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.ExtraBold, modifier = Modifier.padding(top = 8.dp, bottom = 8.dp),
        )
        // Fortschritt wie im Aufnahmeantrag; hier darf man jeden Abschnitt direkt antippen. Rot = hier fehlt etwas.
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            reiter.forEachIndexed { i, t ->
                val farbe = when {
                    t == fehlerReiter -> sc.error
                    i < nr -> sc.primary
                    i == nr -> sc.tertiaryContainer
                    else -> sc.outlineVariant
                }
                Box(Modifier.weight(1f).height(28.dp).clickable { tab = t }, contentAlignment = Alignment.Center) {
                    Box(Modifier.fillMaxWidth().height(8.dp).clip(RoundedCornerShape(4.dp)).background(farbe))
                }
            }
        }
        Text(
            "Schritt ${nr + 1} von ${reiter.size} · ${TAB_NAMES[tab]}" + if (fehlerReiter != null && fehlerReiter != tab) " · Angaben fehlen bei „${TAB_NAMES[fehlerReiter]}“" else "",
            style = MaterialTheme.typography.titleSmall, color = if (fehlerReiter != null && fehlerReiter != tab) sc.error else sc.onSurfaceVariant,
            modifier = Modifier.padding(top = 2.dp, bottom = 6.dp),
        )
        Column(Modifier.padding(bottom = 8.dp)) {
          Surface(shape = RoundedCornerShape(28.dp), color = sc.surface, border = BorderStroke(1.5.dp, sc.outlineVariant), modifier = Modifier.fillMaxWidth()) {
           Column(Modifier.padding(16.dp)) {
            when (tab) {
                FormTab.BASIS -> {
                    Feld("Mitgliedsnummer *", f.number, { f = f.copy(number = it) }, errors["memberNumber"])
                    Feld("Vorname *", f.firstName, { f = MemberRules.setFirstName(f, it) }, errors["firstName"])
                    Feld("Nachname *", f.lastName, { f = MemberRules.setLastName(f, it) }, errors["lastName"])
                    Auswahl("Geschlecht", GENDERS, f.gender.ifEmpty { "none" }) { f = f.copy(gender = it) }
                    DatumFeld("Geburtsdatum", f.birthDate, optional = true) { f = f.copy(birthDate = it) }
                    Feld("Staatsangehörigkeit", f.nationality, { f = f.copy(nationality = it) })
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Checkbox(f.isMinor, { f = f.copy(isMinor = it) })
                        Text("Mitglied ist minderjährig")
                    }
                    if (f.isMinor) {
                        Text("Gesetzlicher Vertreter", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.ExtraBold, color = sc.primary, modifier = Modifier.padding(top = 8.dp))
                        Feld("Name", f.guardianName, { f = f.copy(guardianName = it) })
                        Auswahl("Beziehung", RELATIONS, f.guardianRelation) { f = f.copy(guardianRelation = it) }
                        Feld("Telefon", f.guardianPhone, { f = f.copy(guardianPhone = it) }, keyboard = KeyboardType.Phone)
                        Feld("E-Mail", f.guardianEmail, { f = f.copy(guardianEmail = it) }, keyboard = KeyboardType.Email)
                    }
                }
                FormTab.KONTAKT -> {
                    Feld("Straße", f.street, { f = f.copy(street = it) })
                    Feld("Hausnummer", f.houseNumber, { f = f.copy(houseNumber = it) })
                    Feld("PLZ", f.zip, { f = f.copy(zip = it) }, keyboard = KeyboardType.Number)
                    Feld("Ort", f.city, { f = f.copy(city = it) })
                    Feld("Land", f.country, { f = f.copy(country = it) })
                    Feld("Telefon", f.phone, { f = f.copy(phone = it) }, keyboard = KeyboardType.Phone)
                    Feld("E-Mail", f.email, { f = f.copy(email = it) }, keyboard = KeyboardType.Email)
                }
                FormTab.MITGLIEDSCHAFT -> {
                    Auswahl("Sparte", departmentOptions, f.department) { f = f.copy(department = it) }
                    Auswahl("Status", STATUS_FORM, f.status) { f = MemberRules.setStatus(f, it, today) }
                    Auswahl("Mitgliedschaftstyp", TYPE_FORM, f.type) { f = MemberRules.setType(f, it, today) }
                    DatumFeld("Eintrittsdatum *", f.entryDate, errors["entryDate"]) { f = f.copy(entryDate = it) }
                    DatumFeld(
                        if (f.status == "terminated") "Austrittsdatum (wirksam zum)" else "Austrittsdatum (optional)",
                        f.exitDate, optional = true,
                    ) { f = f.copy(exitDate = it) }
                    Feld(
                        "Beitrag (€)", f.fee, { f = f.copy(fee = it) }, enabled = !f.isFeeLocked, keyboard = KeyboardType.Decimal,
                        hinweis = if (f.isFeeLocked) "Gesperrt: Der Beitrag ist 0 bei Kündigung, Austritt oder beitragsfreier Zahlweise." else null,
                    )
                    Auswahl("Zahlungsweise", PERIOD_FORM, f.feePeriod, enabled = !f.isPeriodLocked) { f = MemberRules.setFeePeriod(f, it) }
                    if (f.isPeriodLocked) Text("Gesperrt, solange das Mitglied gekündigt bzw. ausgetreten ist.", style = MaterialTheme.typography.bodySmall)
                    if (f.feePeriod == "monthly") DueDay(f) { f = it }
                }
                FormTab.ZAHLUNG -> {
                    Text("Zahlungsart", style = MaterialTheme.typography.labelMedium)
                    Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        PAYMENT_ORDER.forEach { p ->
                            TabChip(MemberLabels.PAYMENT[p] ?: p, f.paymentMethod == p) { f = MemberRules.setPayment(f, p) }
                        }
                    }
                    if (f.paymentMethod == "exempt") {
                        Text(
                            "Mitglied ist beitragsfrei gestellt. Es werden keine Beiträge erhoben, Bankdaten sind nicht nötig.",
                            modifier = Modifier.padding(top = 12.dp),
                        )
                        TextButton(onClick = { f = MemberRules.setPayment(f, "sepa") }) { Text("Beitragspflicht wieder aktivieren (SEPA-Lastschrift)") }
                    }
                    if (f.paymentMethod == "sepa") {
                        Text("SEPA-Lastschrift", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.ExtraBold, color = sc.primary, modifier = Modifier.padding(top = 12.dp))
                        Feld("Kontoinhaber *", f.accountHolder, { f = f.copy(accountHolder = it) }, errors["accountHolder"])
                        Feld("Kreditinstitut / Bankname", f.bankName, { f = f.copy(bankName = it) })
                        Feld(
                            "IBAN *", f.iban, { f = MemberRules.setIban(f, it) }, errors["iban"],
                            hinweis = MemberRules.ibanHinweis(f.iban), transformation = IbanTransformation,
                        )
                        Feld("BIC (optional bei SEPA)", f.bic, { f = f.copy(bic = it.uppercase().replace(" ", "")) })
                        if (f.feePeriod == "monthly") DueDay(f) { f = it }
                        DatumFeld("Datum der Lastschriftermächtigung", f.mandateDate, optional = true) { f = f.copy(mandateDate = it) }
                        Feld("Mandatsreferenz", f.mandateReference, { f = f.copy(mandateReference = it) })
                        Auswahl("Mandatsfolge", MemberLabels.MANDATE_SEQUENCE, f.mandateSequenceType) { f = f.copy(mandateSequenceType = it) }
                    }
                }
                FormTab.NOTIZEN -> {
                    Feld("Notizen", f.notes, { f = f.copy(notes = it) }, singleLine = false)
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Checkbox(f.dataPrivacyConsent, { f = f.copy(dataPrivacyConsent = it) })
                        Text("DSGVO-Datenschutzeinwilligung liegt vor", modifier = Modifier.weight(1f))
                    }
                }
            }
           }
          }
        }
        if (saveError != null) Text(saveError!!, color = MaterialTheme.colorScheme.error)
        if (errors.isNotEmpty()) Text("Bitte die markierten Angaben ergänzen.", color = MaterialTheme.colorScheme.error)
        Row(Modifier.fillMaxWidth().padding(top = 4.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedButton(onClick = { reiter.getOrNull(nr - 1)?.let { tab = it } }, enabled = nr > 0, modifier = Modifier.weight(1f).height(48.dp)) { Text("Zurück") }
            OutlinedButton(onClick = { reiter.getOrNull(nr + 1)?.let { tab = it } }, enabled = nr < reiter.size - 1, modifier = Modifier.weight(1f).height(48.dp)) { Text("Weiter") }
        }
        Row(Modifier.fillMaxWidth().padding(top = 8.dp, bottom = 12.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedButton(onClick = onDone, modifier = Modifier.weight(1f).height(52.dp)) { Text("Abbrechen") }
            Button(
                enabled = !model.busy,
                modifier = Modifier.weight(1f).height(52.dp),
                onClick = {
                    versucht = true
                    val ziel = MemberRules.ersterFehlerReiter(MemberRules.validate(f, others))
                    if (ziel != null) {
                        tab = ziel
                    } else {
                        saveError = null
                        model.saveMember(f) { fehler -> if (fehler == null) onDone() else saveError = "Speichern fehlgeschlagen: $fehler" }
                    }
                },
            ) { Text("Speichern") }
        }
    }
}

@Composable
private fun DueDay(f: MemberForm, onChange: (MemberForm) -> Unit) {
    Column(Modifier.padding(vertical = 4.dp)) {
        Text("Einzugstag beim monatlichen Beitrag", style = MaterialTheme.typography.labelMedium)
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            TabChip("1. des Monats", f.monthlyDueDay == 1) { onChange(f.copy(monthlyDueDay = 1)) }
            TabChip("15. des Monats", f.monthlyDueDay == 15) { onChange(f.copy(monthlyDueDay = 15)) }
        }
    }
}


/** Zeigt die IBAN in Vierergruppen an, während sie ohne Leerzeichen gespeichert bleibt. */
internal object IbanTransformation : VisualTransformation {
    override fun filter(text: androidx.compose.ui.text.AnnotatedString): androidx.compose.ui.text.input.TransformedText {
        val roh = text.text
        val sb = StringBuilder()
        roh.forEachIndexed { i, c -> if (i > 0 && i % 4 == 0) sb.append(' '); sb.append(c) }
        val abbildung = object : androidx.compose.ui.text.input.OffsetMapping {
            override fun originalToTransformed(offset: Int) = if (offset <= 0) 0 else offset + (offset - 1) / 4
            override fun transformedToOriginal(offset: Int) = (offset - offset / 5).coerceIn(0, roh.length)
        }
        return androidx.compose.ui.text.input.TransformedText(androidx.compose.ui.text.AnnotatedString(sb.toString()), abbildung)
    }
}
