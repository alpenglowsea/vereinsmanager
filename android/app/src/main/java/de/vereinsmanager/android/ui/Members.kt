package de.vereinsmanager.android.ui

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.text.selection.SelectionContainer
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.snapshotFlow
import de.vereinsmanager.core.members.Iban
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.height
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.layout
import androidx.compose.ui.unit.Constraints
import kotlin.math.roundToInt
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.input.nestedscroll.NestedScrollConnection
import androidx.compose.ui.input.nestedscroll.NestedScrollSource
import androidx.compose.ui.input.nestedscroll.nestedScroll
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
import de.vereinsmanager.android.export.PdfWriter
import de.vereinsmanager.android.export.rememberExporter
import de.vereinsmanager.core.export.Stammblatt
import de.vereinsmanager.core.export.Export
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
internal fun FilterMenu(label: String, options: Map<String, String>, selected: String?, onSelect: (String?) -> Unit) {
    var open by remember { mutableStateOf(false) }
    FilterChip(
        selected = selected != null, onClick = { open = true },
        label = { Text(if (selected == null) label else "$label: ${options[selected] ?: selected}", maxLines = 1, softWrap = false) },
    )
    DropdownMenu(open, { open = false }) {
        DropdownMenuItem(text = { Text("Alle") }, onClick = { onSelect(null); open = false })
        options.forEach { (k, v) -> DropdownMenuItem(text = { Text(v) }, onClick = { onSelect(k); open = false }) }
    }
}

@Composable
fun MemberListScreen(model: AppModel, onOpen: (String) -> Unit, onNew: () -> Unit, onImport: () -> Unit, modifier: Modifier = Modifier) {
    var filter by remember { mutableStateOf(MemberFilter()) }
    var sortKey by remember { mutableStateOf(SortKey.NAME) }
    var ascending by remember { mutableStateOf(true) }
    var sortOpen by remember { mutableStateOf(false) }
    var selected by remember { mutableStateOf<Set<String>>(emptySet()) }
    val selecting = selected.isNotEmpty()
    // Zurück-Geste beendet zuerst die Auswahl, erst danach verlässt sie die Liste.
    BackHandler(enabled = selecting) { selected = emptySet() }
    var bulkOpen by remember { mutableStateOf(false) }
    var deleteOpen by remember { mutableStateOf(false) }
    var info by remember { mutableStateOf("") }

    val stats = remember(model.members, model.departments) { MemberList.stats(model.members, model.departments) }
    val shown = remember(model.members, filter, sortKey, ascending) {
        MemberList.sort(MemberList.filter(model.members, filter), sortKey, ascending)
    }
    val exporter = rememberExporter(model) { info = it }
    val heute = LocalDate.now().toString()
    val deptOptions = remember(model.departments) { model.departments.associateWith { it } }

    // Der Kopf schrumpft und verblasst im Takt des Scrollens (langsam beim Hinunterscrollen) und kommt beim
    // Hinaufscrollen schneller wieder (doppelte Geschwindigkeit).
    val listState = rememberLazyListState()
    val kopfHoehe = remember { IntArray(1) }
    var kopfVersatz by remember { mutableFloatStateOf(0f) } // 0 = ganz sichtbar, -Höhe = ganz eingeklappt
    val scrollVerfolgung = remember(listState) {
        object : NestedScrollConnection {
            override fun onPreScroll(available: Offset, source: NestedScrollSource): Offset {
                val dy = available.y
                if (dy < 0f) {
                    if (kopfVersatz <= -kopfHoehe[0]) return Offset.Zero
                    if (kopfVersatz == 0f && !listState.canScrollForward) return Offset.Zero
                    val neu = (kopfVersatz + dy).coerceAtLeast(-kopfHoehe[0].toFloat())
                    val verbraucht = neu - kopfVersatz
                    kopfVersatz = neu
                    return Offset(0f, verbraucht)
                } else if (dy > 0f) {
                    if (kopfVersatz >= 0f) return Offset.Zero
                    val neu = (kopfVersatz + dy * 2f).coerceAtMost(0f)
                    val verbraucht = (neu - kopfVersatz) / 2f
                    kopfVersatz = neu
                    return Offset(0f, verbraucht)
                }
                return Offset.Zero
            }
        }
    }
    LaunchedEffect(shown) { model.ansicht = shown.map { it.id } }

    Column(modifier.padding(horizontal = 16.dp).nestedScroll(scrollVerfolgung)) {
        if (info.isNotEmpty()) Text(info, modifier = Modifier.padding(top = 8.dp))
        Box(
            Modifier.clipToBounds()
                .layout { measurable, constraints ->
                    val p = measurable.measure(constraints.copy(minHeight = 0, maxHeight = Constraints.Infinity))
                    kopfHoehe[0] = p.height
                    val sichtbar = (p.height + kopfVersatz).roundToInt().coerceIn(0, p.height)
                    layout(p.width, sichtbar) { p.placeRelative(0, kopfVersatz.roundToInt().coerceIn(-p.height, 0)) }
                }
                .graphicsLayer {
                    val h = kopfHoehe[0].coerceAtLeast(1)
                    alpha = (1f + 1.5f * kopfVersatz / h).coerceIn(0f, 1f)
                },
        ) {
            Column {
                Row(Modifier.fillMaxWidth().padding(top = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    KompaktKnopf("Neues Mitglied", onNew, Modifier.weight(1f), primaer = true)
                    KompaktKnopf("CSV-Import", onImport, Modifier.weight(1f))
                }
                if (!selecting && info.isEmpty() && model.members.isNotEmpty()) {
                    Text("Tipp: Mitglied lange antippen, um mehrere auszuwählen.", style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(top = 8.dp))
                }
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
                Row(Modifier.horizontalScroll(rememberScrollState()).padding(bottom = 4.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    KompaktKnopf("Sortiert nach ${SORT_LABELS[sortKey]}", { sortOpen = true })
                    KompaktKnopf(if (ascending) "aufsteigend ↑" else "absteigend ↓", { ascending = !ascending })
                    DropdownMenu(sortOpen, { sortOpen = false }) {
                        SORT_LABELS.forEach { (k, v) -> DropdownMenuItem(text = { Text(v) }, onClick = { sortKey = k; sortOpen = false }) }
                    }
                }
                if (!selecting) Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    KompaktKnopf("CSV-Export", {
                        val liste = shown
                        exporter.csv("mitglieder_${Export.dateiname(model.vereinsname())}_$heute.csv") { Export.mitgliederCsv(liste) }
                    })
                    KompaktKnopf("PDF-Liste", {
                        val liste = shown
                        exporter.pdf("mitgliederliste_${Export.dateiname(model.vereinsname())}_$heute.pdf") { Export.mitgliederPdf(liste, model.vereinsname(), LocalDate.now()) }
                    })
                }
            }
        }
        if (selecting) {
            // Auswahlleiste: sitzt an der Stelle der Export-Knöpfe und bleibt beim Scrollen stehen.
            Row(Modifier.horizontalScroll(rememberScrollState()).padding(vertical = 2.dp), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                Text("${selected.size} gewählt", style = MaterialTheme.typography.labelLarge)
                KompaktKnopf("Alle angezeigten", { selected = shown.map { it.id }.toSet() })
                KompaktKnopf("Keine", { selected = emptySet() })
                KompaktKnopf("Bearbeiten", { bulkOpen = true }, primaer = true)
                KompaktKnopf("Löschen", { deleteOpen = true })
                KompaktKnopf("CSV", {
                    val auswahl = model.members.filter { it.id in selected }
                    exporter.csv("mitglieder_${auswahl.size}_ausgewaehlt.csv") { Export.mitgliederCsv(auswahl) }
                })
                KompaktKnopf("PDF", {
                    val auswahl = model.members.filter { it.id in selected }
                    exporter.pdf("mitglieder_$heute.pdf") { Export.mitgliederPdf(auswahl, model.vereinsname(), LocalDate.now()) }
                })
            }
        }
        Text("${shown.size} von ${model.members.size} angezeigt (Export: die angezeigten)", style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(top = 4.dp))
        HorizontalDivider(Modifier.padding(vertical = 4.dp))
        if (model.members.isEmpty()) Text("Keine Mitglieder. Spielen Sie auf der Startseite eine Sicherung ein.", Modifier.padding(top = 16.dp))
        LazyColumn(state = listState) {
            items(shown, key = { it.id }) { m ->
                MemberRow(
                    m, selecting = selecting, checked = m.id in selected,
                    onLongClick = { if (m.id !in selected) selected = selected + m.id; info = "" },
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
            bulkOpen = false; info = it; selected = emptySet()
        })
    }
    if (deleteOpen && chosen.isNotEmpty()) {
        DeleteMemberDialog(model, chosen, onDismiss = { deleteOpen = false }, onDeleted = {
            deleteOpen = false; info = "${chosen.size} Mitglied(er) gelöscht."; selected = emptySet()
        })
    }
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun MemberRow(m: Member, selecting: Boolean, checked: Boolean, onLongClick: () -> Unit, onClick: () -> Unit) {
    Row(
        Modifier.fillMaxWidth().combinedClickable(onClick = onClick, onLongClick = onLongClick).padding(vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
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

/** Detailansicht mit seitlichem Blättern durch die Mitglieder in der Reihenfolge der Liste. */
@Composable
fun MemberDetailScreen(
    model: AppModel, startId: String, onEdit: (String) -> Unit, onDeleted: () -> Unit, onMaterialOverview: () -> Unit,
    onPage: (String) -> Unit, modifier: Modifier = Modifier, onOpenDoc: (String) -> Unit = {},
) {
    val ids = remember(model.ansicht, model.members, startId) {
        val vorhanden = model.members.map { it.id }.toSet()
        val basis = model.ansicht.filter { it in vorhanden }
        if (startId in basis) basis else listOf(startId)
    }
    val pager = rememberPagerState(initialPage = ids.indexOf(startId).coerceAtLeast(0)) { ids.size }
    val aktuelleIds by rememberUpdatedState(ids)
    val aktuellStart by rememberUpdatedState(startId)
    LaunchedEffect(pager) {
        snapshotFlow { pager.settledPage }.collect { i ->
            val id = aktuelleIds.getOrNull(i)
            if (id != null && id != aktuellStart) onPage(id)
        }
    }
    HorizontalPager(state = pager, modifier = modifier, key = { ids.getOrNull(it) ?: it }) { i ->
        val id = ids[i]
        MemberDetailPage(model, id, onEdit = { onEdit(id) }, onDeleted = onDeleted, onMaterialOverview = onMaterialOverview, onOpenDoc = onOpenDoc)
    }
}

@Composable
private fun MemberDetailPage(model: AppModel, id: String, onEdit: () -> Unit, onDeleted: () -> Unit, onMaterialOverview: () -> Unit, modifier: Modifier = Modifier, onOpenDoc: (String) -> Unit = {}) {
    var deleting by remember { mutableStateOf(false) }
    var tab by remember { mutableStateOf(0) }
    var stammInfo by remember { mutableStateOf("") }
    val exporter = rememberExporter(model) { stammInfo = it }
    val m = model.members.firstOrNull { it.id == id }
    if (m == null) { Text("Mitglied nicht gefunden.", modifier.padding(16.dp)); return }
    Column(modifier.padding(16.dp).verticalScroll(rememberScrollState())) {
        Text(listOf(m.firstName, m.lastName).filter { it.isNotEmpty() }.joinToString(" "), style = MaterialTheme.typography.headlineSmall)
        val today = LocalDate.now()
        val age = MemberList.age(m.birthDate, today)
        val dauer = MemberList.membershipDuration(m.entryDate, today)
        Text(listOfNotNull(MemberLabels.STATUS[m.status], MemberLabels.TYPE_DETAIL[m.type], dauer).joinToString(" · "))
        Row(Modifier.padding(top = 8.dp).horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            listOf("Details", "Material", "Dokumente", "Historie").forEachIndexed { i, s -> FilterChip(tab == i, { tab = i }, label = { Text(s, maxLines = 1, softWrap = false) }) }
        }
        HorizontalDivider(Modifier.padding(vertical = 8.dp))
        if (tab == 1) MemberMaterialTab(model, m, onMaterialOverview)
        if (tab == 2) {
            val docs = model.dokumente.filter { it.mitgliedId == m.id }.sortedByDescending { it.datum }
            Text("Dokumente (${docs.size})", style = MaterialTheme.typography.titleMedium)
            if (docs.isEmpty()) Text("Zu diesem Mitglied sind keine Dokumente abgelegt.", style = MaterialTheme.typography.bodyMedium)
            docs.forEach { d ->
                TextButton(onClick = { onOpenDoc(d.id) }, modifier = Modifier.fillMaxWidth()) {
                    Column(Modifier.fillMaxWidth()) {
                        Text(d.titel.ifEmpty { d.dateiName }, style = MaterialTheme.typography.bodyLarge)
                        Text(listOf(if (d.datum.isNotEmpty()) deDate(d.datum) else "", d.dateiName).filter { it.isNotEmpty() }.joinToString(" · "), style = MaterialTheme.typography.bodySmall)
                    }
                }
            }
        }
        if (tab == 3) MemberHistoryTab(model, m)
        if (tab == 0) {
            @Composable fun row(label: String, value: String) { if (value.isNotBlank()) Field(label, value) }
            row("Mitgliedsnummer", m.number)
            row("Sparte", m.department)
            row("Eintritt", deDate(m.entryDate).takeIf { m.entryDate.isNotEmpty() } ?: "")
            row("Austritt", deDate(m.exitDate).takeIf { m.exitDate.isNotEmpty() } ?: "")
            row("Geburtsdatum", if (m.birthDate.isNotEmpty()) deDate(m.birthDate) + (age?.let { " ($it Jahre)" } ?: "") else "")
            row("Geschlecht", MemberLabels.GENDER[m.gender] ?: "")
            row("Anschrift", listOf("${m.street} ${m.houseNumber}".trim(), "${m.zip} ${m.city}".trim(), m.country).filter { it.isNotEmpty() }.joinToString("\n"))
            KontaktLink("Telefon", m.phone, LinkArt.TELEFON)
            KontaktLink("E-Mail", m.email, LinkArt.MAIL)
            row("Beitrag", if (m.paymentMethod == "exempt" || m.feePeriod == "none") "beitragsfrei" else "${euro(m.fee)} ${MemberLabels.FEE_PERIOD[m.feePeriod] ?: ""}".trim())
            row("Zahlart", MemberLabels.PAYMENT[m.paymentMethod] ?: "")
            val bank = m.raw["bankDetails"] as? kotlinx.serialization.json.JsonObject
            fun bk(k: String) = (bank?.get(k) as? kotlinx.serialization.json.JsonPrimitive)?.content.orEmpty()
            row("Kontoinhaber", bk("accountHolder"))
            row("Kreditinstitut", bk("bankName"))
            if (bk("iban").isNotBlank()) {
                SelectionContainer { Field("IBAN (lang antippen zum Kopieren)", Iban.gruppiert(bk("iban"))) }
            }
            row("BIC", bk("bic"))
            row("Mandatsreferenz", bk("mandateReference"))
            row("Mandatsdatum", if (bk("mandateDate").isNotEmpty()) deDate(bk("mandateDate")) else "")
            row("Notizen", m.notes)
            if (stammInfo.isNotEmpty()) Text(stammInfo, style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(top = 8.dp))
            Aktionsleiste(
                listOf(
                    Aktion("Bearbeiten", onEdit, primaer = true),
                    Aktion("Löschen", { deleting = true }),
                    Aktion("Stammblatt (PDF)", {
                        val d = Stammblatt.erstellen(m, model.store.get("settings", "main"), LocalDate.now())
                        exporter.pdfSchreiber(d.dateiname) { out -> PdfWriter.stammblatt(d, out) }
                    }),
                ),
                Modifier.padding(top = 16.dp),
            )
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
