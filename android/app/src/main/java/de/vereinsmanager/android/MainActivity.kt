package de.vereinsmanager.android

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Scaffold
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import de.vereinsmanager.android.ui.HomeScreen
import de.vereinsmanager.android.ui.MemberDetailScreen
import de.vereinsmanager.android.ui.MemberFormScreen
import de.vereinsmanager.android.ui.MaterialOverviewScreen
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
                BackHandler(enabled = stack.size > 1) { stack = stack.dropLast(1) }
                Scaffold(modifier = Modifier.fillMaxSize()) { inner ->
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
                            model, page.id, onEdit = { stack = stack + Page.MemberEdit(page.id) },
                            onMaterialOverview = { stack = stack + Page.MaterialOverview },
                            onDeleted = { stack = stack.filter { it !is Page.Member && it !is Page.MemberEdit } }, modifier = m,
                        )
                        is Page.MemberEdit -> MemberFormScreen(model, page.id, onDone = { stack = stack.dropLast(1) }, modifier = m)
                        Page.MaterialOverview -> MaterialOverviewScreen(model, modifier = m)
                        Page.MemberImport -> MemberImportScreen(model, onDone = { stack = stack.dropLast(1) }, modifier = m)
                        Page.Probes -> ProbeScreen(m)
                    }
                }
            }
        }
    }
}
