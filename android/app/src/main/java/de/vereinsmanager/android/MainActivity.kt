package de.vereinsmanager.android

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material3.DrawerValue
import androidx.compose.material3.ModalDrawerSheet
import androidx.compose.material3.ModalNavigationDrawer
import androidx.compose.material3.PermanentDrawerSheet
import androidx.compose.material3.Scaffold
import androidx.compose.material3.rememberDrawerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.unit.dp
import de.vereinsmanager.android.ui.Kopfzeile
import de.vereinsmanager.android.ui.MenueInhalt
import de.vereinsmanager.android.ui.Ziel
import kotlinx.coroutines.launch
import de.vereinsmanager.android.ui.HomeScreen
import de.vereinsmanager.android.ui.MemberDetailScreen
import de.vereinsmanager.android.ui.MemberFormScreen
import de.vereinsmanager.android.ui.MaterialOverviewScreen
import de.vereinsmanager.android.ui.MemberAnalyticsScreen
import de.vereinsmanager.android.ui.MemberImportScreen
import de.vereinsmanager.android.ui.MemberListScreen
import de.vereinsmanager.android.ui.theme.VereinsManagerTheme

/** Einfache Seitenfolge; die Rückwärts-Geste geht eine Seite zurück. */
sealed interface Page {
    data object Home : Page
    data object Members : Page
    data class Member(val id: String) : Page
    /** id == null: neues Mitglied */
    data class MemberEdit(val id: String?) : Page
    data object MemberImport : Page
    data object MaterialOverview : Page
    data object MemberAnalytics : Page
    data object Probes : Page
}

class MainActivity : ComponentActivity() {
    private lateinit var model: AppModel

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        model = AppModel(applicationContext)
        setContent {
            VereinsManagerTheme {
                var stack by remember { mutableStateOf<List<Page>>(listOf(Page.Home)) }
                val page = stack.last()
                val drawerState = rememberDrawerState(DrawerValue.Closed)
                val scope = rememberCoroutineScope()
                // Ab 840 dp Breite (Tablet) steht das Menü dauerhaft als Spalte da, sonst fährt es von links ein.
                val breit = LocalConfiguration.current.screenWidthDp >= 840

                BackHandler(enabled = stack.size > 1) { stack = stack.dropLast(1) }
                BackHandler(enabled = drawerState.isOpen) { scope.launch { drawerState.close() } }

                fun geheZu(z: Ziel) {
                    stack = when (z) {
                        Ziel.START -> listOf(Page.Home)
                        Ziel.MITGLIEDER -> listOf(Page.Home, Page.Members)
                        Ziel.MITGLIEDER_AUSWERTUNG -> listOf(Page.Home, Page.MemberAnalytics)
                        else -> stack // noch nicht gebaut; das Menü zeigt dafür einen Hinweis
                    }
                    scope.launch { drawerState.close() }
                }

                val menue: @Composable () -> Unit = {
                    MenueInhalt(model.clubName, aktivesZiel(page), onWahl = ::geheZu)
                }
                val inhalt: @Composable () -> Unit = {
                    val oberste = page is Page.Home || page is Page.Members || page is Page.MemberAnalytics || page is Page.Probes
                    Scaffold(
                        modifier = Modifier.fillMaxSize(),
                        topBar = {
                            Kopfzeile(
                                titel = seitenTitel(page),
                                zurueck = !oberste,
                                mitMenueKnopf = !breit && oberste,
                                onKnopf = {
                                    if (oberste) scope.launch { drawerState.open() } else stack = stack.dropLast(1)
                                },
                            )
                        },
                    ) { inner ->
                        val m = Modifier.padding(inner)
                        when (page) {
                            Page.Home -> HomeScreen(
                                model, onMembers = { stack = stack + Page.Members }, onProbes = { stack = stack + Page.Probes }, modifier = m,
                            )
                            Page.Members -> MemberListScreen(
                                model, onOpen = { stack = stack + Page.Member(it) }, onNew = { stack = stack + Page.MemberEdit(null) },
                                onImport = { stack = stack + Page.MemberImport }, modifier = m,
                            )
                            is Page.Member -> MemberDetailScreen(
                                model, page.id, onEdit = { id -> stack = stack + Page.MemberEdit(id) },
                                onPage = { id -> stack = stack.dropLast(1) + Page.Member(id) },
                                onMaterialOverview = { stack = stack + Page.MaterialOverview },
                                onDeleted = { stack = stack.filter { it !is Page.Member && it !is Page.MemberEdit } }, modifier = m,
                            )
                            is Page.MemberEdit -> MemberFormScreen(model, page.id, onDone = { stack = stack.dropLast(1) }, modifier = m)
                            Page.MemberAnalytics -> MemberAnalyticsScreen(model, modifier = m)
                            Page.MaterialOverview -> MaterialOverviewScreen(model, modifier = m)
                            Page.MemberImport -> MemberImportScreen(model, onDone = { stack = stack.dropLast(1) }, modifier = m)
                            Page.Probes -> ProbeScreen(m)
                        }
                    }
                }

                if (breit) {
                    Row(Modifier.fillMaxSize()) {
                        PermanentDrawerSheet(Modifier.width(300.dp)) { menue() }
                        Row(Modifier.weight(1f)) { inhalt() }
                    }
                } else {
                    ModalNavigationDrawer(
                        drawerState = drawerState,
                        drawerContent = { ModalDrawerSheet { menue() } },
                        content = inhalt,
                    )
                }
            }
        }
    }
}

private fun seitenTitel(p: Page): String = when (p) {
    Page.Home -> "Dashboard"
    Page.Members -> "Mitgliederverwaltung"
    is Page.Member -> "Mitglied"
    is Page.MemberEdit -> if (p.id == null) "Neues Mitglied" else "Mitglied bearbeiten"
    Page.MemberImport -> "CSV-Import"
    Page.MaterialOverview -> "Ausgeteiltes Material"
    Page.MemberAnalytics -> "Mitglieder-Auswertung"
    Page.Probes -> "Proben"
}

/** Welcher Menüpunkt zur aktuellen Seite gehört (wird im Menü hervorgehoben). */
private fun aktivesZiel(p: Page): Ziel? = when (p) {
    Page.Home -> Ziel.START
    Page.Members, is Page.Member, is Page.MemberEdit, Page.MemberImport, Page.MaterialOverview -> Ziel.MITGLIEDER
    Page.MemberAnalytics -> Ziel.MITGLIEDER_AUSWERTUNG
    Page.Probes -> null
}
