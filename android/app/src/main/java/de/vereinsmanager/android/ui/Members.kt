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
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.Spacer
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
import androidx.compose.foundation.lazy.itemsIndexed
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
import androidx.compose.material3.TextField
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Surface
import androidx.compose.foundation.clickable
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.sp
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
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

/** Kurze Zahlart für die Karten der Mitgliederliste, damit die Zeile nicht abgeschnitten wird. */
private val ZAHLART_KURZ = mapOf("sepa" to "SEPA", "transfer" to "Überweisung", "cash" to "Bar", "standing_order" to "Dauerauftrag")

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
        shape = RoundedCornerShape(12.dp),
        colors = FilterChipDefaults.filterChipColors(selectedContainerColor = MaterialTheme.colorScheme.primaryContainer, selectedLabelColor = MaterialTheme.colorScheme.onPrimaryContainer),
        border = FilterChipDefaults.filterChipBorder(enabled = true, selected = selected != null, borderColor = MaterialTheme.colorScheme.outlineVariant, selectedBorderColor = MaterialTheme.colorScheme.primaryContainer),
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
    var exportOpen by remember { mutableStateOf(false) }

    val stats = remember(model.members, model.departments) { MemberList.stats(model.members, model.departments) }
    val shown = remember(model.members, filter, sortKey, ascending) {
        MemberList.sort(MemberList.filter(model.members, filter), sortKey, ascending)
    }
    val exporter = rememberExporter(model) { info = it }
    val heute = LocalDate.now().toString()
    val deptOptions = remember(model.departments) { model.departments.associateWith { it } }

    // Einklappender Kopf (gemeinsames Verhalten für alle Listen, siehe EinklappKopf.kt).
    val listState = rememberLazyListState()
    val kopf = rememberKopfZustand(listState)
    LaunchedEffect(shown) { model.ansicht = shown.map { it.id } }

    Column(modifier.padding(horizontal = 16.dp).nestedScroll(kopf.verfolgung)) {
        if (info.isNotEmpty()) Text(info, modifier = Modifier.padding(top = 8.dp))
        Box(
            Modifier.einklappbar(kopf),
        ) {
            Column {
                Row(Modifier.fillMaxWidth().padding(top = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    KopfKnopf("Neues Mitglied", onNew, Modifier.weight(1f), primaer = true)
                    KopfKnopf("CSV-Import", onImport, Modifier.weight(1f))
                    KopfKnopf("Export", { exportOpen = true }, Modifier.weight(1f), enabled = !selecting)
                }
                if (!selecting && info.isEmpty() && model.members.isNotEmpty()) {
                    Text("Tipp: Mitglied lange antippen, um mehrere auszuwählen.", style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(top = 8.dp))
                }
                Text("Mitglieder", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.ExtraBold, modifier = Modifier.padding(top = 12.dp))
                Row(Modifier.fillMaxWidth().padding(top = 8.dp).height(androidx.compose.foundation.layout.IntrinsicSize.Min), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    val sc = MaterialTheme.colorScheme
                    val gleich = Modifier.weight(1f).fillMaxHeight()
                    StatKachel("Gesamt", "${stats.total}", "alle Mitglieder", sc.secondaryContainer, sc.onSecondaryContainer, gleich)
                    StatKachel("Aktiv", "${stats.active}", "${stats.activePercent} %", sc.primaryContainer, sc.onPrimaryContainer, gleich)
                    StatKachel("Passiv", "${stats.passive}", "${stats.passivePercent} %", sc.tertiaryContainer, sc.onTertiaryContainer, gleich)
                }
                TextField(
                    filter.search, { filter = filter.copy(search = it) }, placeholder = { Text("Mitglied suchen …") },
                    singleLine = true, shape = RoundedCornerShape(28.dp),
                    colors = TextFieldDefaults.colors(
                        focusedContainerColor = MaterialTheme.colorScheme.surfaceContainer, unfocusedContainerColor = MaterialTheme.colorScheme.surfaceContainer,
                        focusedIndicatorColor = Color.Transparent, unfocusedIndicatorColor = Color.Transparent,
                    ),
                    modifier = Modifier.fillMaxWidth().padding(top = 12.dp),
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
        Spacer(Modifier.height(6.dp))
        if (model.members.isEmpty()) Text("Keine Mitglieder. Spielen Sie auf der Startseite eine Sicherung ein.", Modifier.padding(top = 16.dp))
        LazyColumn(state = listState, contentPadding = PaddingValues(bottom = 96.dp)) {
            itemsIndexed(shown, key = { _, m -> m.id }) { i, m ->
                MemberRow(
                    m, nr = i, erste = i == 0, letzte = i == shown.lastIndex, selecting = selecting, checked = m.id in selected,
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
    if (exportOpen) {
        androidx.compose.material3.AlertDialog(
            onDismissRequest = { exportOpen = false },
            title = { Text("Exportieren") },
            text = { Text("${shown.size} angezeigte Mitglieder exportieren als:") },
            confirmButton = {
                TextButton({
                    exportOpen = false
                    val liste = shown
                    exporter.csv("mitglieder_${Export.dateiname(model.vereinsname())}_$heute.csv") { Export.mitgliederCsv(liste) }
                }) { Text("CSV (Tabelle)") }
            },
            dismissButton = {
                TextButton({
                    exportOpen = false
                    val liste = shown
                    exporter.pdf("mitgliederliste_${Export.dateiname(model.vereinsname())}_$heute.pdf") { Export.mitgliederPdf(liste, model.vereinsname(), LocalDate.now()) }
                }) { Text("PDF (Liste)") }
            },
        )
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

/** Knopf der obersten Zeile: gleich hoch und gleich breit, die Beschriftung darf auf zwei Zeilen umbrechen (nichts wird abgeschnitten). */
@Composable
internal fun KopfKnopf(text: String, onClick: () -> Unit, modifier: Modifier = Modifier, enabled: Boolean = true, primaer: Boolean = false) {
    val rand = PaddingValues(horizontal = 6.dp, vertical = 0.dp)
    val inhalt: @Composable androidx.compose.foundation.layout.RowScope.() -> Unit = {
        Text(text, maxLines = 2, textAlign = androidx.compose.ui.text.style.TextAlign.Center, style = MaterialTheme.typography.labelLarge, lineHeight = 16.sp)
    }
    if (primaer) Button(onClick = onClick, modifier = modifier.height(48.dp), enabled = enabled, contentPadding = rand, content = inhalt)
    else OutlinedButton(onClick = onClick, modifier = modifier.height(48.dp), enabled = enabled, contentPadding = rand, content = inhalt)
}

/** Eine farbige Kennzahl-Kachel (Titel, große Zahl, optional eine Zeile darunter). */
@Composable
internal fun StatKachel(titel: String, zahl: String, unter: String?, flaeche: Color, text: Color, modifier: Modifier = Modifier, groesse: androidx.compose.ui.unit.TextUnit = 30.sp) {
    Column(modifier.clip(RoundedCornerShape(22.dp)).background(flaeche).padding(horizontal = 10.dp, vertical = 10.dp)) {
        Text(titel, color = text, style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.Bold, maxLines = 1)
        Text(zahl, color = text, fontSize = groesse, fontWeight = FontWeight.ExtraBold, maxLines = 1, softWrap = false)
        if (unter != null) Text(unter, color = text.copy(alpha = 0.75f), style = MaterialTheme.typography.bodySmall, maxLines = 2)
    }
}

/** Das farbige Status-Schild (Aktiv, Passiv, Ehrenmitglied …) – in der Liste und in der Detailansicht gleich. */
@Composable
internal fun StatusSchild(status: String) {
    val s = MaterialTheme.colorScheme
    val (flaeche, text) = when (status) {
        "active" -> s.primaryContainer to s.onPrimaryContainer
        "honorary" -> s.tertiaryContainer to s.onTertiaryContainer
        "terminated", "suspended" -> s.errorContainer to s.onErrorContainer
        else -> s.secondaryContainer to s.onSecondaryContainer
    }
    Text(
        MemberLabels.STATUS[status] ?: status, color = text, style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.Bold,
        maxLines = 1, softWrap = false,
        modifier = Modifier.clip(RoundedCornerShape(10.dp)).background(flaeche).padding(horizontal = 10.dp, vertical = 5.dp),
    )
}

/** Weiche, umrandete Karte um einen Abschnitt der Mitglieder-Detailansicht; [titel] steht oben in der Hauptfarbe. */
@Composable
internal fun DetailKarte(titel: String? = null, modifier: Modifier = Modifier, content: @Composable androidx.compose.foundation.layout.ColumnScope.() -> Unit) {
    val s = MaterialTheme.colorScheme
    Surface(
        shape = RoundedCornerShape(24.dp), color = s.surface, border = BorderStroke(1.5.dp, s.outlineVariant),
        modifier = modifier.fillMaxWidth().padding(vertical = 5.dp),
    ) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            if (titel != null) Text(titel, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.ExtraBold, color = s.primary, modifier = Modifier.padding(bottom = 4.dp))
            content()
        }
    }
}

@Composable
internal fun TabChip(text: String, selected: Boolean, onClick: () -> Unit) {
    val s = MaterialTheme.colorScheme
    FilterChip(
        selected = selected, onClick = onClick, label = { Text(text, maxLines = 1, softWrap = false) }, shape = RoundedCornerShape(12.dp),
        colors = FilterChipDefaults.filterChipColors(selectedContainerColor = s.primaryContainer, selectedLabelColor = s.onPrimaryContainer),
        border = FilterChipDefaults.filterChipBorder(enabled = true, selected = selected, borderColor = s.outlineVariant, selectedBorderColor = s.primaryContainer),
    )
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun MemberRow(m: Member, nr: Int, erste: Boolean, letzte: Boolean, selecting: Boolean, checked: Boolean, onLongClick: () -> Unit, onClick: () -> Unit) {
    val s = MaterialTheme.colorScheme
    // Karten liegen dicht übereinander: nur die erste und die letzte haben große Rundungen oben bzw. unten.
    val form = RoundedCornerShape(topStart = if (erste) 28.dp else 10.dp, topEnd = if (erste) 28.dp else 10.dp, bottomStart = if (letzte) 28.dp else 10.dp, bottomEnd = if (letzte) 28.dp else 10.dp)
    Surface(
        shape = form, color = if (checked) s.primaryContainer.copy(alpha = 0.45f) else s.surface,
        border = BorderStroke(1.5.dp, if (checked) s.primary else s.outlineVariant),
        modifier = Modifier.fillMaxWidth().padding(bottom = 6.dp).clip(form).combinedClickable(onClick = onClick, onLongClick = onLongClick),
    ) {
        Row(Modifier.padding(horizontal = 14.dp, vertical = 12.dp), verticalAlignment = Alignment.CenterVertically) {
            if (selecting) Checkbox(checked, { onClick() })
            else Marke(m.displayName, nr, 48.dp)
            Column(Modifier.weight(1f).padding(horizontal = 12.dp)) {
                Text(m.displayName.ifEmpty { "(ohne Namen)" }, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                val line = listOf(
                    m.number.takeIf { it.isNotEmpty() }?.let { "Nr. $it" },
                    m.department.takeIf { it.isNotEmpty() },
                    MemberLabels.TYPE_FILTER[m.type],
                ).filterNotNull().joinToString(" · ")
                if (line.isNotEmpty()) Text(line, style = MaterialTheme.typography.bodySmall, color = s.onSurfaceVariant, maxLines = 1, overflow = TextOverflow.Ellipsis)
                val fee = if (m.paymentMethod == "exempt" || m.feePeriod == "none") "beitragsfrei"
                else "${euro(m.fee)} ${MemberLabels.FEE_PERIOD_SHORT[m.feePeriod] ?: ""}".trim()
                val zahl = if (m.paymentMethod == "exempt") null else ZAHLART_KURZ[m.paymentMethod] ?: MemberLabels.PAYMENT[m.paymentMethod]
                Text(fee + (zahl?.let { " · $it" } ?: ""), style = MaterialTheme.typography.bodySmall, color = s.onSurfaceVariant, maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
            StatusSchild(m.status)
        }
    }
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
    val sc = MaterialTheme.colorScheme
    val today = LocalDate.now()
    val age = MemberList.age(m.birthDate, today)
    val dauer = MemberList.membershipDuration(m.entryDate, today)
    val bank = m.raw["bankDetails"] as? kotlinx.serialization.json.JsonObject
    fun bk(k: String) = (bank?.get(k) as? kotlinx.serialization.json.JsonPrimitive)?.content.orEmpty()
    val beitrag = if (m.paymentMethod == "exempt" || m.feePeriod == "none") "beitragsfrei" else "${euro(m.fee)} ${MemberLabels.FEE_PERIOD[m.feePeriod] ?: ""}".trim()
    val name = listOf(m.firstName, m.lastName).filter { it.isNotEmpty() }.joinToString(" ").ifEmpty { "(ohne Namen)" }
    Column(modifier.padding(horizontal = 16.dp).verticalScroll(rememberScrollState())) {
        Row(Modifier.fillMaxWidth().padding(top = 12.dp), verticalAlignment = Alignment.CenterVertically) {
            Marke(name, (m.id.hashCode() and 0x7fffffff), 72.dp)
            Column(Modifier.weight(1f).padding(start = 16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text(name, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.ExtraBold)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                    StatusSchild(m.status)
                    MemberLabels.TYPE_DETAIL[m.type]?.let { Text(it, style = MaterialTheme.typography.bodyMedium, color = sc.onSurfaceVariant, maxLines = 1, overflow = TextOverflow.Ellipsis) }
                }
            }
        }
        val beitragZahl = if (beitrag == "beitragsfrei") "frei" else euro(m.fee)
        val beitragUnter = if (beitrag == "beitragsfrei") "beitragsfrei" else (MemberLabels.FEE_PERIOD[m.feePeriod] ?: "").lowercase().trim()
        BoxWithConstraints(Modifier.fillMaxWidth().padding(top = 14.dp)) {
            // Eine gemeinsame Schriftgröße für alle drei Zahlen, so groß wie die längste (meist der Beitrag mit €) noch in die Kachel passt.
            val innen = (maxWidth - 16.dp) / 3 - 20.dp
            val laengste = maxOf(age?.toString()?.length ?: 0, 4, beitragZahl.length)
            val g = minOf(28f, innen.value / (laengste * 0.62f)).coerceAtLeast(14f).sp
            Row(Modifier.fillMaxWidth().height(androidx.compose.foundation.layout.IntrinsicSize.Min), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                val gleich = Modifier.weight(1f).fillMaxHeight()
                StatKachel("Alter", age?.toString() ?: "–", "Jahre", sc.secondaryContainer, sc.onSecondaryContainer, gleich, g)
                StatKachel("Dabei seit", m.entryDate.take(4).ifEmpty { "–" }, dauer?.takeIf { it.isNotBlank() }, sc.primaryContainer, sc.onPrimaryContainer, gleich, g)
                StatKachel("Beitrag", beitragZahl, beitragUnter, sc.tertiaryContainer, sc.onTertiaryContainer, gleich, g)
            }
        }
        Row(Modifier.padding(top = 12.dp).horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            listOf("Details", "Material", "Dokumente", "Historie").forEachIndexed { i, s -> TabChip(s, tab == i) { tab = i } }
        }
        Spacer(Modifier.height(6.dp))
        if (tab == 1) MemberMaterialTab(model, m, onMaterialOverview)
        if (tab == 2) {
            val docs = model.dokumente.filter { it.mitgliedId == m.id }.sortedByDescending { it.datum }
            Text("Dokumente (${docs.size})", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.ExtraBold)
            if (docs.isEmpty()) Text("Zu diesem Mitglied sind keine Dokumente abgelegt.", style = MaterialTheme.typography.bodyMedium, color = sc.onSurfaceVariant)
            docs.forEach { d ->
                Surface(
                    shape = RoundedCornerShape(20.dp), color = sc.surface, border = BorderStroke(1.5.dp, sc.outlineVariant),
                    modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp).clip(RoundedCornerShape(20.dp)).clickable { onOpenDoc(d.id) },
                ) {
                    Column(Modifier.fillMaxWidth().padding(14.dp)) {
                        Text(d.titel.ifEmpty { d.dateiName }, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
                        Text(listOf(if (d.datum.isNotEmpty()) deDate(d.datum) else "", d.dateiName).filter { it.isNotEmpty() }.joinToString(" · "), style = MaterialTheme.typography.bodySmall, color = sc.onSurfaceVariant)
                    }
                }
            }
        }
        if (tab == 3) MemberHistoryTab(model, m)
        if (tab == 0) {
            @Composable fun row(label: String, value: String) { if (value.isNotBlank()) Field(label, value) }
            val anschrift = listOf("${m.street} ${m.houseNumber}".trim(), "${m.zip} ${m.city}".trim(), m.country).filter { it.isNotEmpty() }.joinToString("\n")
            DetailKarte("Mitgliedschaft") {
                row("Mitgliedsnummer", m.number)
                row("Sparte", m.department)
                row("Eintritt", deDate(m.entryDate).takeIf { m.entryDate.isNotEmpty() } ?: "")
                row("Austritt", deDate(m.exitDate).takeIf { m.exitDate.isNotEmpty() } ?: "")
            }
            DetailKarte("Person") {
                row("Geburtsdatum", if (m.birthDate.isNotEmpty()) deDate(m.birthDate) + (age?.let { " ($it Jahre)" } ?: "") else "")
                row("Geschlecht", MemberLabels.GENDER[m.gender] ?: "")
                row("Anschrift", anschrift)
            }
            if (m.phone.isNotBlank() || m.email.isNotBlank()) DetailKarte("Kontakt") {
                KontaktLink("Telefon", m.phone, LinkArt.TELEFON)
                KontaktLink("E-Mail", m.email, LinkArt.MAIL)
            }
            DetailKarte("Beitrag und Zahlung") {
                row("Beitrag", beitrag)
                row("Zahlart", MemberLabels.PAYMENT[m.paymentMethod] ?: "")
            }
            if (listOf("accountHolder", "bankName", "iban", "bic", "mandateReference", "mandateDate").any { bk(it).isNotBlank() }) DetailKarte("Bankverbindung") {
                row("Kontoinhaber", bk("accountHolder"))
                row("Kreditinstitut", bk("bankName"))
                if (bk("iban").isNotBlank()) {
                    SelectionContainer { Field("IBAN (lang antippen zum Kopieren)", Iban.gruppiert(bk("iban"))) }
                }
                row("BIC", bk("bic"))
                row("Mandatsreferenz", bk("mandateReference"))
                row("Mandatsdatum", if (bk("mandateDate").isNotEmpty()) deDate(bk("mandateDate")) else "")
            }
            if (m.notes.isNotBlank()) DetailKarte("Notizen") { Field("", m.notes) }
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
                Modifier.padding(top = 12.dp, bottom = 16.dp),
            )
        }
    }
    if (deleting) DeleteMemberDialog(model, remember(m.id) { listOf(m) }, onDismiss = { deleting = false }, onDeleted = onDeleted)
}

@Composable
private fun Field(label: String, value: String) {
    Column(Modifier.padding(vertical = 4.dp)) {
        if (label.isNotEmpty()) Text(label, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(value, style = MaterialTheme.typography.bodyLarge)
    }
}
