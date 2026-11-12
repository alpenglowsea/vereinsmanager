package de.vereinsmanager.android.ui

import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationDrawerItem
import androidx.compose.material3.NavigationDrawerItemDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.luminance
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp

/** Alle Menüpunkte. Reihenfolge, Namen und Piktogramme wie in der Desktop-Version. */
enum class Ziel(val titel: String, val icon: ImageVector, val farbe: Farbe, val fertig: Boolean) {
    START("Dashboard", Lucide.LayoutDashboard, Farbe.BLAU, true),
    MITGLIEDER("Mitgliederverwaltung", Lucide.Users, Farbe.BLAU, true),
    ANTRAEGE("Neues Mitglied aufnehmen", Lucide.FileSignature, Farbe.BLAU, true),
    MITGLIEDER_AUSWERTUNG("Mitglieder-Auswertung", Lucide.BarChart3, Farbe.BLAU, true),
    BUCHUNGEN("Buchungen & Journal", Lucide.Wallet, Farbe.GRUEN, true),
    BEITRAGSLAUF("Beitragslauf", Lucide.CreditCard, Farbe.GRUEN, true),
    EUER("EÜR / GuV", Lucide.FileSpreadsheet, Farbe.GRUEN, true),
    RECHNUNGEN("Rechnungen", Lucide.FileText, Farbe.GRUEN, true),
    SPENDEN("Spenden", Lucide.HeartHandshake, Farbe.GRUEN, true),
    FINANZ_AUSWERTUNG("Finanz-Auswertungen", Lucide.PieChart, Farbe.GRUEN, true),
    KONTAKTE("Kontakte", Lucide.Contact, Farbe.TUERKIS, true),
    KALENDER("Kalender", Lucide.CalendarDays, Farbe.INDIGO, true),
    SITZUNGEN("Sitzungen", Lucide.ScrollText, Farbe.ROSE, false),
    INVENTAR("Inventar", Lucide.Package, Farbe.LILA, true),
    DOKUMENTE("Dokumente", Lucide.FolderArchive, Farbe.BERNSTEIN, true),
    EINSTELLUNGEN("Einstellungen", Lucide.Settings, Farbe.GRAU, true),
}

/** Die Farben der Desktop-Piktogramme. Hell etwas dunkler getönt, damit sie auf weißem Grund lesbar bleiben. */
enum class Farbe(val dunkel: Color, val hell: Color) {
    BLAU(Color(0xFF60A5FA), Color(0xFF2563EB)),
    GRUEN(Color(0xFF34D399), Color(0xFF059669)),
    TUERKIS(Color(0xFF22D3EE), Color(0xFF0891B2)),
    INDIGO(Color(0xFF818CF8), Color(0xFF4F46E5)),
    ROSE(Color(0xFFFB7185), Color(0xFFE11D48)),
    LILA(Color(0xFFC084FC), Color(0xFF9333EA)),
    BERNSTEIN(Color(0xFFFBBF24), Color(0xFFD97706)),
    GRAU(Color(0xFF94A3B8), Color(0xFF64748B)),
}

@Composable
private fun Farbe.aktuell(): Color =
    if (MaterialTheme.colorScheme.surface.luminance() < 0.5f) dunkel else hell

/** Der Inhalt des Menüs; derselbe für die ausklappbare Schublade (Handy) und die feste Spalte (Tablet). */
@Composable
fun MenueInhalt(vereinsname: String, aktiv: Ziel?, onWahl: (Ziel) -> Unit) {
    val context = LocalContext.current
    var mitgliederOffen by remember { mutableStateOf(true) }
    var finanzenOffen by remember { mutableStateOf(true) }

    @Composable
    fun punkt(z: Ziel, eingerueckt: Boolean = false) {
        NavigationDrawerItem(
            label = { Text(z.titel) },
            icon = { Icon(z.icon, null, Modifier.size(22.dp), tint = z.farbe.aktuell()) },
            selected = z == aktiv,
            onClick = {
                if (z.fertig) onWahl(z)
                else Toast.makeText(context, "${z.titel}: kommt in einer späteren Phase.", Toast.LENGTH_SHORT).show()
            },
            badge = { if (!z.fertig) Text("bald", style = MaterialTheme.typography.labelSmall) },
            modifier = Modifier
                .padding(NavigationDrawerItemDefaults.ItemPadding)
                .padding(start = if (eingerueckt) 16.dp else 0.dp)
                .alpha(if (z.fertig) 1f else 0.55f),
        )
    }

    @Composable
    fun gruppe(titel: String, icon: ImageVector, farbe: Farbe, offen: Boolean, umschalten: () -> Unit) {
        NavigationDrawerItem(
            label = { Text(titel, fontWeight = FontWeight.SemiBold) },
            icon = { Icon(icon, null, Modifier.size(22.dp), tint = farbe.aktuell()) },
            selected = false,
            onClick = umschalten,
            badge = { Icon(if (offen) Lucide.ChevronDown else Lucide.ChevronRight, null, Modifier.size(18.dp)) },
            modifier = Modifier.padding(NavigationDrawerItemDefaults.ItemPadding),
        )
    }

    Column(Modifier.verticalScroll(rememberScrollState()).padding(vertical = 12.dp)) {
        Text(
            if (vereinsname.isEmpty()) "VereinsManager" else vereinsname,
            style = MaterialTheme.typography.titleMedium,
            modifier = Modifier.padding(horizontal = 28.dp, vertical = 12.dp),
        )
        HorizontalDivider(Modifier.padding(horizontal = 16.dp, vertical = 4.dp))
        punkt(Ziel.START)

        gruppe("Mitglieder", Lucide.Users, Farbe.BLAU, mitgliederOffen) { mitgliederOffen = !mitgliederOffen }
        if (mitgliederOffen) {
            punkt(Ziel.MITGLIEDER, true)
            punkt(Ziel.ANTRAEGE, true)
            punkt(Ziel.MITGLIEDER_AUSWERTUNG, true)
        }

        gruppe("Finanzen", Lucide.Wallet, Farbe.GRUEN, finanzenOffen) { finanzenOffen = !finanzenOffen }
        if (finanzenOffen) {
            punkt(Ziel.BUCHUNGEN, true)
            punkt(Ziel.BEITRAGSLAUF, true)
            punkt(Ziel.EUER, true)
            punkt(Ziel.RECHNUNGEN, true)
            punkt(Ziel.SPENDEN, true)
            punkt(Ziel.FINANZ_AUSWERTUNG, true)
        }

        punkt(Ziel.KONTAKTE)
        punkt(Ziel.KALENDER)
        punkt(Ziel.SITZUNGEN)
        punkt(Ziel.INVENTAR)
        punkt(Ziel.DOKUMENTE)
        HorizontalDivider(Modifier.padding(horizontal = 16.dp, vertical = 4.dp))
        punkt(Ziel.EINSTELLUNGEN)
    }
}

/** Schmale Kopfzeile: links der Menü-Knopf, auf Unterseiten daneben der Zurück-Pfeil, dann der Seitenname. */
@Composable
fun Kopfzeile(titel: String, zurueck: Boolean, mitMenueKnopf: Boolean, onZurueck: () -> Unit, onMenue: () -> Unit) {
    Row(
        Modifier
            .fillMaxWidth()
            .background(MaterialTheme.colorScheme.surface)
            .windowInsetsPadding(WindowInsets.statusBars)
            .height(48.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.Start,
    ) {
        // Das Menü ist auf jeder Seite erreichbar (außer am Tablet, wo es dauerhaft steht); der Zurück-Pfeil kommt auf Unterseiten dazu.
        if (mitMenueKnopf) {
            IconButton(onClick = onMenue) { Icon(Lucide.Menu, "Menü öffnen", Modifier.size(24.dp)) }
        }
        if (zurueck) {
            IconButton(onClick = onZurueck) { Icon(Lucide.ArrowLeft, "Zurück", Modifier.size(24.dp)) }
        }
        if (!mitMenueKnopf && !zurueck) Spacer(Modifier.width(16.dp))
        Text(titel, style = MaterialTheme.typography.titleMedium, maxLines = 1)
    }
}

