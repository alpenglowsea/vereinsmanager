package de.vereinsmanager.android.ui

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.Checkbox
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import de.vereinsmanager.android.AppModel
import de.vereinsmanager.core.members.Member
import de.vereinsmanager.core.members.MemberFilter
import de.vereinsmanager.core.members.MemberLabels
import de.vereinsmanager.core.members.MemberList
import de.vereinsmanager.core.members.SortKey
import java.text.NumberFormat
import java.time.LocalDate
import java.util.Locale

private val SORT_LABELS = linkedMapOf(
    SortKey.NUMBER to "Nr.", SortKey.NAME to "Name", SortKey.STATUS to "Status", SortKey.DEPARTMENT to "Sparte",
    SortKey.ENTRY to "Eintritt", SortKey.CITY to "Ort", SortKey.FEE to "Beitrag", SortKey.PAYMENT to "Zahlart",
)

fun euro(v: java.math.BigDecimal): String = NumberFormat.getCurrencyInstance(Locale.GERMANY).format(v)

fun deDate(iso: String): String = try {
    LocalDate.parse(iso).let { "%02d.%02d.%04d".format(it.dayOfMonth, it.monthValue, it.year) }
} catch (e: Exception) { iso }

@Composable
private fun FilterMenu(label: String, options: Map<String, String>, selected: String?, onSelect: (String?) -> Unit) {
    var open by remember { mutableStateOf(false) }
    FilterChip(
        selected = selected != null, onClick = { open = true },
        label = { Text(if (selected == null) label else "$label: ${options[selected] ?: selected}") },
    )
    DropdownMenu(open, { open = false }) {
        DropdownMenuItem(text = { Text("Alle") }, onClick = { onSelect(null); open = false })
        options.forEach { (k, v) -> DropdownMenuItem(text = { Text(v) }, onClick = { onSelect(k); open = false }) }
    }
}

@Composable
fun MemberListScreen(model: AppModel, onOpen: (String) -> Unit, onNew: () -> Unit, modifier: Modifier = Modifier) {
    var filter by remember { mutableStateOf(MemberFilter()) }
    var sortKey by remember { mutableStateOf(SortKey.NAME) }
    var ascending by remember { mutableStateOf(true) }
    var sortOpen by remember { mutableStateOf(false) }
    var selecting by remember { mutableStateOf(false) }
    var selected by remember { mutableStateOf<Set<String>>(emptySet()) }
    var bulkOpen by remember { mutableStateOf(false) }
    var deleteOpen by remember { mutableStateOf(false) }
    var info by remember { mutableStateOf("") }

    val stats = remember(model.members, model.departments) { MemberList.stats(model.members, model.departments) }
    val shown = remember(model.members, filter, sortKey, ascending) {
        MemberList.sort(MemberList.filter(model.members, filter), sortKey, ascending)
    }
    val deptOptions = remember(model.departments) { model.departments.associateWith { it } }

    Column(modifier.padding(horizontal = 16.dp)) {
        Row(Modifier.fillMaxWidth().padding(top = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Button(onClick = onNew, modifier = Modifier.weight(1f)) { Text("Neues Mitglied") }
            OutlinedButton(
                onClick = { selecting = !selecting; selected = emptySet(); info = "" },
                modifier = Modifier.weight(1f),
            ) { Text(if (selecting) "Auswahl beenden" else "Auswählen") }
        }
        if (selecting) {
            Text("${selected.size} ausgewählt", style = MaterialTheme.typography.titleSmall, modifier = Modifier.padding(top = 8.dp))
            Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedButton(onClick = { selected = shown.map { it.id }.toSet() }) { Text("Alle angezeigten") }
                OutlinedButton(onClick = { selected = emptySet() }, enabled = selected.isNotEmpty()) { Text("Keine") }
                Button(onClick = { bulkOpen = true }, enabled = selected.isNotEmpty()) { Text("Bearbeiten") }
                OutlinedButton(onClick = { deleteOpen = true }, enabled = selected.isNotEmpty()) { Text("Löschen") }
            }
        }
        if (info.isNotEmpty()) Text(info, modifier = Modifier.padding(top = 8.dp))
        Row(Modifier.fillMaxWidth().padding(top = 8.dp), horizontalArrangement = Arrangement.spacedBy(16.dp)) {
            Column { Text("Mitglieder", style = MaterialTheme.typography.labelMedium); Text("${stats.total}", style = MaterialTheme.typography.titleLarge) }
            Column { Text("Aktiv", style = MaterialTheme.typography.labelMedium); Text("${stats.active} (${stats.activePercent} %)", style = MaterialTheme.typography.titleLarge) }
            Column { Text("Passiv", style = MaterialTheme.typography.labelMedium); Text("${stats.passive} (${stats.passivePercent} %)", style = MaterialTheme.typography.titleLarge) }
        }
        Text(
            stats.departments.filter { it.count > 0 }.joinToString("  ·  ") { "${it.name} ${it.count}" },
            style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(top = 4.dp),
        )
        OutlinedTextField(
            filter.search, { filter = filter.copy(search = it) }, label = { Text("Suchen") },
            singleLine = true, modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
        )
        Row(Modifier.horizontalScroll(rememberScrollState()).padding(vertical = 4.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            FilterMenu("Status", MemberLabels.STATUS, filter.status) { filter = filter.copy(status = it) }
            FilterMenu("Sparte", deptOptions, filter.department) { filter = filter.copy(department = it) }
            FilterMenu("Typ", MemberLabels.TYPE_FILTER, filter.type) { filter = filter.copy(type = it) }
            FilterMenu("Zahlart", MemberLabels.PAYMENT, filter.payment) { filter = filter.copy(payment = it) }
        }
        Row {
            TextButton(onClick = { sortOpen = true }) { Text("Sortiert nach ${SORT_LABELS[sortKey]}") }
            TextButton(onClick = { ascending = !ascending }) { Text(if (ascending) "aufsteigend ↑" else "absteigend ↓") }
            DropdownMenu(sortOpen, { sortOpen = false }) {
                SORT_LABELS.forEach { (k, v) -> DropdownMenuItem(text = { Text(v) }, onClick = { sortKey = k; sortOpen = false }) }
            }
        }
        Text("${shown.size} von ${model.members.size} angezeigt", style = MaterialTheme.typography.bodySmall)
        HorizontalDivider(Modifier.padding(vertical = 4.dp))
        if (model.members.isEmpty()) Text("Keine Mitglieder. Spielen Sie auf der Startseite eine Sicherung ein.", Modifier.padding(top = 16.dp))
        LazyColumn {
            items(shown, key = { it.id }) { m ->
                MemberRow(
                    m, selecting = selecting, checked = m.id in selected,
                ) {
                    if (selecting) {
                        selected = if (m.id in selected) selected - m.id else selected + m.id
                    } else {
                        onOpen(m.id)
                    }
                }
            }
        }
    }
    val chosen = model.members.filter { it.id in selected }
    if (bulkOpen && chosen.isNotEmpty()) {
        BulkEditDialog(model, chosen, onDismiss = { bulkOpen = false }, onDone = {
            bulkOpen = false; info = it; selected = emptySet(); selecting = false
        })
    }
    if (deleteOpen && chosen.isNotEmpty()) {
        DeleteMemberDialog(model, chosen, onDismiss = { deleteOpen = false }, onDeleted = {
            deleteOpen = false; info = "${chosen.size} Mitglied(er) gelöscht."; selected = emptySet(); selecting = false
        })
    }
}

@Composable
private fun MemberRow(m: Member, selecting: Boolean, checked: Boolean, onClick: () -> Unit) {
    Row(Modifier.fillMaxWidth().clickable(onClick = onClick).padding(vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
    if (selecting) Checkbox(checked, { onClick() })
    Column(Modifier.weight(1f)) {
        Row {
            Text(m.displayName.ifEmpty { "(ohne Namen)" }, style = MaterialTheme.typography.titleMedium, modifier = Modifier.weight(1f))
            Text(MemberLabels.STATUS[m.status] ?: m.status, style = MaterialTheme.typography.labelLarge)
        }
        val line = listOf(
            m.number.takeIf { it.isNotEmpty() }?.let { "Nr. $it" },
            m.department.takeIf { it.isNotEmpty() },
            MemberLabels.TYPE_FILTER[m.type],
        ).filterNotNull().joinToString(" · ")
        Text(line, style = MaterialTheme.typography.bodySmall)
        val fee = if (m.paymentMethod == "exempt" || m.feePeriod == "none") "beitragsfrei"
        else "${euro(m.fee)} ${MemberLabels.FEE_PERIOD_SHORT[m.feePeriod] ?: ""}".trim()
        Text(fee + (MemberLabels.PAYMENT[m.paymentMethod]?.let { " · $it" } ?: ""), style = MaterialTheme.typography.bodySmall)
    }
    }
    HorizontalDivider()
}

@Composable
fun MemberDetailScreen(model: AppModel, id: String, onEdit: () -> Unit, onDeleted: () -> Unit, modifier: Modifier = Modifier) {
    var deleting by remember { mutableStateOf(false) }
    val m = model.members.firstOrNull { it.id == id }
    if (m == null) { Text("Mitglied nicht gefunden.", modifier.padding(16.dp)); return }
    Column(modifier.padding(16.dp).verticalScroll(rememberScrollState())) {
        Text(listOf(m.firstName, m.lastName).filter { it.isNotEmpty() }.joinToString(" "), style = MaterialTheme.typography.headlineSmall)
        val today = LocalDate.now()
        val age = MemberList.age(m.birthDate, today)
        val dauer = MemberList.membershipDuration(m.entryDate, today)
        Text(listOfNotNull(MemberLabels.STATUS[m.status], MemberLabels.TYPE_DETAIL[m.type], dauer).joinToString(" · "))
        HorizontalDivider(Modifier.padding(vertical = 8.dp))
        @Composable fun row(label: String, value: String) { if (value.isNotBlank()) Field(label, value) }
        row("Mitgliedsnummer", m.number)
        row("Sparte", m.department)
        row("Eintritt", deDate(m.entryDate).takeIf { m.entryDate.isNotEmpty() } ?: "")
        row("Austritt", deDate(m.exitDate).takeIf { m.exitDate.isNotEmpty() } ?: "")
        row("Geburtsdatum", if (m.birthDate.isNotEmpty()) deDate(m.birthDate) + (age?.let { " ($it Jahre)" } ?: "") else "")
        row("Geschlecht", MemberLabels.GENDER[m.gender] ?: "")
        row("Anschrift", listOf("${m.street} ${m.houseNumber}".trim(), "${m.zip} ${m.city}".trim(), m.country).filter { it.isNotEmpty() }.joinToString("\n"))
        row("Telefon", m.phone)
        row("E-Mail", m.email)
        row("Beitrag", if (m.paymentMethod == "exempt" || m.feePeriod == "none") "beitragsfrei" else "${euro(m.fee)} ${MemberLabels.FEE_PERIOD[m.feePeriod] ?: ""}".trim())
        row("Zahlart", MemberLabels.PAYMENT[m.paymentMethod] ?: "")
        row("Notizen", m.notes)
        Row(Modifier.padding(top = 16.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Button(onClick = onEdit) { Text("Bearbeiten") }
            OutlinedButton(onClick = { deleting = true }) { Text("Löschen") }
        }
    }
    if (deleting) DeleteMemberDialog(model, remember(m.id) { listOf(m) }, onDismiss = { deleting = false }, onDeleted = onDeleted)
}

@Composable
private fun Field(label: String, value: String) {
    Column(Modifier.padding(vertical = 4.dp)) {
        Text(label, style = MaterialTheme.typography.labelMedium)
        Text(value)
    }
}
