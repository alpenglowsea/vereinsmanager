package de.vereinsmanager.android.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.luminance
import androidx.compose.ui.unit.dp

private val HellSchema = lightColorScheme(
    primary = Wiese, onPrimary = Color.White,
    primaryContainer = WieseHell, onPrimaryContainer = WieseDunkelText,
    secondary = Color(0xFF52634F), onSecondary = Color.White,
    secondaryContainer = Salbei, onSecondaryContainer = SalbeiText,
    tertiary = Color(0xFF7A5C00), onTertiary = Color.White,
    tertiaryContainer = Sonne, onTertiaryContainer = SonneText,
    background = Papier, onBackground = Tinte,
    surface = Papier, onSurface = Tinte,
    surfaceVariant = Color(0xFFDCE5DA), onSurfaceVariant = TintenGrau,
    surfaceContainerLowest = Color.White, surfaceContainerLow = Color(0xFFF5F8F1),
    surfaceContainer = Color(0xFFEEF3EA), surfaceContainerHigh = Color(0xFFE8EEE3), surfaceContainerHighest = Color(0xFFE3EBD6),
    outline = RandMittel, outlineVariant = Rand,
)

private val DunkelSchema = darkColorScheme(
    primary = NachtGruen, onPrimary = NachtGruenText,
    primaryContainer = NachtGruenFlaeche, onPrimaryContainer = WieseHell,
    secondary = Color(0xFFB9CCB9), onSecondary = Color(0xFF243427),
    secondaryContainer = NachtSalbei, onSecondaryContainer = NachtSalbeiText,
    tertiary = NachtGelb, onTertiary = Color(0xFF3E2E00),
    tertiaryContainer = NachtGelbFlaeche, onTertiaryContainer = Sonne,
    background = NachtGrund, onBackground = NachtText,
    surface = NachtGrund, onSurface = NachtText,
    surfaceVariant = Color(0xFF3F4941), onSurfaceVariant = NachtGrau,
    surfaceContainerLowest = Color(0xFF0A0F0C), surfaceContainerLow = Color(0xFF141B16),
    surfaceContainer = Color(0xFF18201B), surfaceContainerHigh = Color(0xFF222B25), surfaceContainerHighest = Color(0xFF2D362F),
    outline = Color(0xFF89938A), outlineVariant = Color(0xFF3F4941),
)

/** Großzügige Rundungen: Karten und Felder sind weich, nicht eckig. */
private val Formen = Shapes(
    extraSmall = RoundedCornerShape(8.dp),
    small = RoundedCornerShape(12.dp),
    medium = RoundedCornerShape(20.dp),
    large = RoundedCornerShape(28.dp),
    extraLarge = RoundedCornerShape(36.dp),
)

/**
 * Das Erscheinungsbild folgt der Geräteeinstellung (hell/dunkel). Die Farben sind fest („Wiese“) und nicht mehr vom
 * Hintergrundbild des Telefons abgeleitet, damit die App auf jedem Gerät gleich aussieht.
 */
@Composable
fun VereinsManagerTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit,
) {
    MaterialTheme(
        colorScheme = if (darkTheme) DunkelSchema else HellSchema,
        typography = Typography,
        shapes = Formen,
        content = content,
    )
}

/** Die Farbe der Navigationsleiste: hell tiefes Waldgrün, dunkel etwas heller als der Grund. */
@Composable
fun leistenFarbe(): Color =
    if (MaterialTheme.colorScheme.surface.luminance() < 0.5f) MaterialTheme.colorScheme.surfaceContainerHigh else WaldLeiste

/** Schrift und Beschriftung auf der Leiste. */
@Composable
fun leistenText(): Color =
    if (MaterialTheme.colorScheme.surface.luminance() < 0.5f) MaterialTheme.colorScheme.onSurfaceVariant else Color(0xFFB7C6BA)

/** Beschriftung des gewählten Platzes auf der Leiste. */
@Composable
fun leistenAktivText(): Color =
    if (MaterialTheme.colorScheme.surface.luminance() < 0.5f) MaterialTheme.colorScheme.onSurface else Papier
