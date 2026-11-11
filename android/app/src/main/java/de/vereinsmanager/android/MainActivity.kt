package de.vereinsmanager.android

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.WindowInsets
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
import de.vereinsmanager.android.ui.BeitragslaufScreen
import de.vereinsmanager.android.ui.BelegAnsichtScreen
import de.vereinsmanager.android.ui.EinstellungenScreen
import de.vereinsmanager.android.ui.EuerScreen
import de.vereinsmanager.android.ui.RechnungDetailScreen
import de.vereinsmanager.android.ui.VorschauScreen
import de.vereinsmanager.android.ui.RechnungFormScreen
import de.vereinsmanager.android.ui.RechnungenScreen
import de.vereinsmanager.android.ui.RechnungsVorlageScreen
import de.vereinsmanager.android.ui.SpendeDetailScreen
import de.vereinsmanager.android.ui.SpendeFormScreen
import de.vereinsmanager.android.ui.SpendenScreen
import de.vereinsmanager.android.ui.BuchungDetailScreen
import de.vereinsmanager.android.ui.BuchungFormScreen
import de.vereinsmanager.android.ui.BuchungenScreen
import de.vereinsmanager.android.ui.DokumentAnsichtScreen
import de.vereinsmanager.android.ui.DokumentDetailScreen
import de.vereinsmanager.android.ui.DokumentFormScreen
import de.vereinsmanager.android.ui.DokumenteScreen
import de.vereinsmanager.android.ui.KontakteScreen
import de.vereinsmanager.android.ui.KontaktDetailScreen
import de.vereinsmanager.android.ui.KontaktFormScreen
import de.vereinsmanager.android.ui.KontenScreen
import de.vereinsmanager.android.ui.Kopfzeile
import de.vereinsmanager.android.ui.MenueInhalt
import de.vereinsmanager.android.ui.Ziel
import kotlinx.coroutines.launch
import de.vereinsmanager.android.ui.HomeScreen
import de.vereinsmanager.android.ui.MemberDetailScreen
import de.vereinsmanager.android.ui.MemberFormScreen
import de.vereinsmanager.android.ui.MaterialOverviewScreen
import de.vereinsmanager.android.ui.MemberAnalyticsScreen
import de.vereinsmanager.android.ui.BuchungImportScreen
import de.vereinsmanager.android.ui.KontaktImportScreen
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
    data object BuchungImport : Page
    data object KontaktImport : Page
    data object MaterialOverview : Page
    data object MemberAnalytics : Page
    data object Transactions : Page
    data class Transaction(val id: String) : Page
    /** [partner]: Vorbelegung des Zahlungspartners bei einer neuen Buchung (z. B. aus einem Kontakt). */
    data class TransactionEdit(val id: String?, val partner: String? = null) : Page
    data class BelegAnsicht(val id: String) : Page
    data object Accounts : Page
    data object Sepa : Page
    data object Euer : Page
    data object Rechnungen : Page
    data class Rechnung(val id: String) : Page
    /** id == null: neue Rechnung */
    data class RechnungEdit(val id: String?, val kontaktId: String? = null) : Page
    data object RechnungsVorlage : Page
    /** PDF zu einem Eintrag ansehen; [art] "rechnung" oder "spende" (weitere kommen in AppModel.vorschauDatei dazu). */
    data class Vorschau(val art: String, val id: String) : Page
    data object Spenden : Page
    data class Spende(val id: String) : Page
    data class SpendeEdit(val id: String?) : Page
    data object Contacts : Page
    data class Contact(val id: String) : Page
    /** id == null: neuer Kontakt */
    data class ContactEdit(val id: String?) : Page
    data object Settings : Page
    /** folderId == null: oberste Ebene. Jeder Ordner ist eine eigene Seite auf dem Stapel. */
    data class Documents(val folderId: String?) : Page
    data class Document(val id: String) : Page
    /** id == null: neues Dokument (dann ist ordnerId der Ordner, in dem es angelegt wird). */
    data class DocumentEdit(val id: String?, val ordnerId: String?) : Page
    data class DocumentView(val id: String) : Page
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
                        Ziel.BUCHUNGEN -> listOf(Page.Home, Page.Transactions)
                        Ziel.DOKUMENTE -> listOf(Page.Home, Page.Documents(null))
                        Ziel.BEITRAGSLAUF -> listOf(Page.Home, Page.Sepa)
                        Ziel.EUER -> listOf(Page.Home, Page.Euer)
                        Ziel.RECHNUNGEN -> listOf(Page.Home, Page.Rechnungen)
                        Ziel.SPENDEN -> listOf(Page.Home, Page.Spenden)
                        Ziel.KONTAKTE -> listOf(Page.Home, Page.Contacts)
                        Ziel.EINSTELLUNGEN -> listOf(Page.Home, Page.Settings)
                        else -> stack // noch nicht gebaut; das Menü zeigt dafür einen Hinweis
                    }
                    scope.launch { drawerState.close() }
                }

                val menue: @Composable () -> Unit = {
                    MenueInhalt(model.clubName, aktivesZiel(page), onWahl = ::geheZu)
                }
                val inhalt: @Composable () -> Unit = {
                    val oberste = page is Page.Home || page is Page.Members || page is Page.MemberAnalytics || page is Page.Transactions || (page is Page.Documents && page.folderId == null) || page is Page.Sepa || page is Page.Euer || page is Page.Rechnungen || page is Page.Spenden || page is Page.Contacts || (page is Page.Settings && stack.size <= 2) || page is Page.Probes
                    Scaffold(
                        modifier = Modifier.fillMaxSize(),
                        topBar = {
                            Kopfzeile(
                                titel = seitenTitel(page, model),
                                zurueck = !oberste,
                                mitMenueKnopf = !breit,
                                onZurueck = { stack = stack.dropLast(1) },
                                onMenue = { scope.launch { if (drawerState.isOpen) drawerState.close() else drawerState.open() } },
                            )
                        },
                    ) { inner ->
                      // Das Menü liegt unter der Kopfzeile, damit der Menü-Knopf zum Schließen sichtbar bleibt.
                      val seite: @Composable () -> Unit = {
                        val m = Modifier
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
                            Page.Transactions -> BuchungenScreen(
                                model, onOpen = { stack = stack + Page.Transaction(it) },
                                onNew = { stack = stack + Page.TransactionEdit(null) }, onKonten = { stack = stack + Page.Accounts }, onImport = { stack = stack + Page.BuchungImport }, modifier = m,
                            )
                            is Page.Transaction -> BuchungDetailScreen(
                                model, page.id, onEdit = { stack = stack + Page.TransactionEdit(page.id) },
                                onBeleg = { stack = stack + Page.BelegAnsicht(page.id) },
                                onRechnung = { stack = stack + Page.Rechnung(it) }, onSpende = { stack = stack + Page.Spende(it) },
                                onDeleted = { stack = stack.filter { it !is Page.Transaction && it !is Page.TransactionEdit && it !is Page.BelegAnsicht } }, modifier = m,
                            )
                            is Page.BelegAnsicht -> BelegAnsichtScreen(model, page.id, modifier = m)
            is Page.TransactionEdit -> BuchungFormScreen(model, page.id, onDone = { stack = stack.dropLast(1) }, modifier = m, vorPartner = page.partner)
                            Page.Accounts -> KontenScreen(model, modifier = m)
                            Page.Sepa -> BeitragslaufScreen(model, onEinstellungen = { stack = stack + Page.Settings }, modifier = m)
                            Page.Settings -> EinstellungenScreen(model, modifier = m)
                            Page.Euer -> EuerScreen(model, modifier = m)
                            Page.Rechnungen -> RechnungenScreen(
                                model, onOpen = { stack = stack + Page.Rechnung(it) }, onNew = { stack = stack + Page.RechnungEdit(null) },
                                onVorlage = { stack = stack + Page.RechnungsVorlage }, modifier = m,
                            )
                            is Page.Rechnung -> RechnungDetailScreen(
                                model, page.id, onEdit = { stack = stack + Page.RechnungEdit(page.id) },
                                onAnsehen = { stack = stack + Page.Vorschau("rechnung", page.id) },
                                onDeleted = { stack = stack.filter { it !is Page.Rechnung && it !is Page.RechnungEdit && it !is Page.Vorschau } }, modifier = m,
                            )
                            is Page.RechnungEdit -> RechnungFormScreen(model, page.id, onDone = { stack = stack.dropLast(1) }, modifier = m, kontaktId = page.kontaktId)
                            Page.RechnungsVorlage -> RechnungsVorlageScreen(model, onDone = { stack = stack.dropLast(1) }, modifier = m)
                            is Page.Vorschau -> VorschauScreen(model, page.art, page.id, modifier = m)
                            Page.Contacts -> KontakteScreen(model, onOpen = { stack = stack + Page.Contact(it) }, onNew = { stack = stack + Page.ContactEdit(null) }, onImport = { stack = stack + Page.KontaktImport }, modifier = m)
                            Page.BuchungImport -> BuchungImportScreen(model, onDone = { stack = stack.dropLast(1) }, modifier = m)
                            Page.KontaktImport -> KontaktImportScreen(model, onDone = { stack = stack.dropLast(1) }, modifier = m)
                            is Page.Contact -> KontaktDetailScreen(
                                model, page.id, onEdit = { stack = stack + Page.ContactEdit(page.id) },
                                onBuchung = { name -> stack = stack + Page.TransactionEdit(null, name) },
                                onRechnung = { kid -> stack = stack + Page.RechnungEdit(null, kid) },
                                onOpenBuchung = { stack = stack + Page.Transaction(it) }, onOpenRechnung = { stack = stack + Page.Rechnung(it) },
                                onDeleted = { stack = stack.filter { it !is Page.Contact && it !is Page.ContactEdit } }, modifier = m,
                            )
                            is Page.ContactEdit -> KontaktFormScreen(model, page.id, onDone = { stack = stack.dropLast(1) }, modifier = m)
                            Page.Spenden -> SpendenScreen(model, onOpen = { stack = stack + Page.Spende(it) }, onNew = { stack = stack + Page.SpendeEdit(null) }, modifier = m)
                            is Page.Spende -> SpendeDetailScreen(
                                model, page.id, onEdit = { stack = stack + Page.SpendeEdit(page.id) },
                                onAnsehen = { stack = stack + Page.Vorschau("spende", page.id) },
                                onDeleted = { stack = stack.filter { it !is Page.Spende && it !is Page.SpendeEdit && it !is Page.Vorschau } }, modifier = m,
                            )
                            is Page.SpendeEdit -> SpendeFormScreen(model, page.id, onDone = { stack = stack.dropLast(1) }, modifier = m)
            is Page.Documents -> DokumenteScreen(
                                model, page.folderId, onOpenFolder = { stack = stack + Page.Documents(it) },
                                onJump = { ids -> stack = listOf(Page.Home, Page.Documents(null)) + ids.map { Page.Documents(it) } },
                                onOpenDoc = { stack = stack + Page.Document(it) },
                                onNewDoc = { stack = stack + Page.DocumentEdit(null, it) }, modifier = m,
                            )
                            is Page.Document -> DokumentDetailScreen(
                                model, page.id, onEdit = { stack = stack + Page.DocumentEdit(page.id, null) },
                                onAnzeigen = { stack = stack + Page.DocumentView(page.id) },
                                onDeleted = { stack = stack.filter { it !is Page.Document && it !is Page.DocumentEdit && it !is Page.DocumentView } }, modifier = m,
                            )
                            is Page.DocumentEdit -> DokumentFormScreen(model, page.id, page.ordnerId, onDone = { stack = stack.dropLast(1) }, modifier = m)
                            is Page.DocumentView -> DokumentAnsichtScreen(model, page.id, modifier = m)
                            Page.Probes -> ProbeScreen(m)
                        }
                      }
                      if (breit) {
                          Box(Modifier.padding(inner)) { seite() }
                      } else {
                          ModalNavigationDrawer(
                              drawerState = drawerState,
                              modifier = Modifier.padding(inner),
                              drawerContent = { ModalDrawerSheet(windowInsets = WindowInsets(0, 0, 0, 0)) { menue() } },
                              content = seite,
                          )
                      }
                    }
                }

                if (breit) {
                    Row(Modifier.fillMaxSize()) {
                        PermanentDrawerSheet(Modifier.width(300.dp)) { menue() }
                        Row(Modifier.weight(1f)) { inhalt() }
                    }
                } else {
                    inhalt()
                }
            }
        }
    }
}

private fun seitenTitel(p: Page, model: AppModel): String = when (p) {
    Page.Home -> "Dashboard"
    Page.Members -> "Mitgliederverwaltung"
    is Page.Member -> "Mitglied"
    is Page.MemberEdit -> if (p.id == null) "Neues Mitglied" else "Mitglied bearbeiten"
    Page.MemberImport -> "CSV-Import"
    Page.BuchungImport -> "Buchungen importieren"
    Page.KontaktImport -> "Kontakte importieren"
    Page.MaterialOverview -> "Ausgeteiltes Material"
    Page.MemberAnalytics -> "Mitglieder-Auswertung"
    Page.Transactions -> "Buchungen & Journal"
    is Page.Transaction -> "Buchung"
    is Page.BelegAnsicht -> "Beleg"
    Page.Accounts -> "Konten & Kassen"
    Page.Sepa -> "Beitragslauf"
    Page.Euer -> "EÜR / GuV"
    Page.Rechnungen -> "Rechnungen"
    is Page.Rechnung -> "Rechnung"
    is Page.RechnungEdit -> if (p.id == null) "Neue Rechnung" else "Rechnung bearbeiten"
    Page.RechnungsVorlage -> "Rechnungsvorlage"
    is Page.Vorschau -> "PDF ansehen"
    Page.Spenden -> "Spenden"
    is Page.Spende -> "Zuwendungsbestätigung"
    is Page.SpendeEdit -> if (p.id == null) "Neue Bestätigung" else "Bestätigung bearbeiten"
    Page.Contacts -> "Kontakte"
    is Page.Contact -> "Kontakt"
    is Page.ContactEdit -> if (p.id == null) "Neuer Kontakt" else "Kontakt bearbeiten"
    Page.Settings -> "Einstellungen"
    is Page.TransactionEdit -> if (p.id == null) "Neue Buchung" else "Buchung bearbeiten"
    is Page.Documents -> if (p.folderId == null) "Dokumente" else model.ordner.firstOrNull { it.id == p.folderId }?.name ?: "Ordner"
    is Page.Document -> "Dokument"
    is Page.DocumentEdit -> if (p.id == null) "Neues Dokument" else "Dokument bearbeiten"
    is Page.DocumentView -> "Dokument anzeigen"
    Page.Probes -> "Proben"
}

/** Welcher Menüpunkt zur aktuellen Seite gehört (wird im Menü hervorgehoben). */
private fun aktivesZiel(p: Page): Ziel? = when (p) {
    Page.Home -> Ziel.START
    Page.Members, is Page.Member, is Page.MemberEdit, Page.MemberImport, Page.MaterialOverview -> Ziel.MITGLIEDER
    Page.MemberAnalytics -> Ziel.MITGLIEDER_AUSWERTUNG
    Page.Transactions, is Page.Transaction, is Page.TransactionEdit, is Page.BelegAnsicht, Page.Accounts, Page.BuchungImport -> Ziel.BUCHUNGEN
    is Page.Documents, is Page.Document, is Page.DocumentEdit, is Page.DocumentView -> Ziel.DOKUMENTE
    Page.Sepa -> Ziel.BEITRAGSLAUF
    Page.Euer -> Ziel.EUER
    Page.Rechnungen, is Page.Rechnung, is Page.RechnungEdit, Page.RechnungsVorlage -> Ziel.RECHNUNGEN
    is Page.Vorschau -> if (p.art == "rechnung") Ziel.RECHNUNGEN else Ziel.SPENDEN
    Page.Spenden, is Page.Spende, is Page.SpendeEdit -> Ziel.SPENDEN
    Page.Contacts, is Page.Contact, is Page.ContactEdit, Page.KontaktImport -> Ziel.KONTAKTE
    Page.Settings -> Ziel.EINSTELLUNGEN
    Page.Probes -> null
}
