package de.vereinsmanager.android.ui

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.graphics.vector.PathParser
import androidx.compose.ui.unit.dp

/**
 * Die Piktogramme der Desktop-Version (Bibliothek „Lucide", ISC-Lizenz), als Vektorgrafiken.
 * Erzeugt aus den Original-Strichzeichnungen; nicht von Hand ändern.
 * Lucide: Copyright (c) Lucide Contributors, ISC-Lizenz (https://lucide.dev/license).
 */
object Lucide {
    val Menu: ImageVector by lazy { strich("Menu",
        "M 4 5 h 16",
        "M 4 12 h 16",
        "M 4 19 h 16"
    ) }
    val ArrowLeft: ImageVector by lazy { strich("ArrowLeft",
        "m 12 19 -7 -7 7 -7",
        "M 19 12 H 5"
    ) }
    val ChevronDown: ImageVector by lazy { strich("ChevronDown",
        "m 6 9 6 6 6 -6"
    ) }
    val ChevronRight: ImageVector by lazy { strich("ChevronRight",
        "m 9 18 6 -6 -6 -6"
    ) }
    val LayoutDashboard: ImageVector by lazy { strich("LayoutDashboard",
        "M 4 3 H 9 a 1 1 0 0 1 1 1 V 11 a 1 1 0 0 1 -1 1 H 4 a 1 1 0 0 1 -1 -1 V 4 a 1 1 0 0 1 1 -1 Z",
        "M 15 3 H 20 a 1 1 0 0 1 1 1 V 7 a 1 1 0 0 1 -1 1 H 15 a 1 1 0 0 1 -1 -1 V 4 a 1 1 0 0 1 1 -1 Z",
        "M 15 12 H 20 a 1 1 0 0 1 1 1 V 20 a 1 1 0 0 1 -1 1 H 15 a 1 1 0 0 1 -1 -1 V 13 a 1 1 0 0 1 1 -1 Z",
        "M 4 16 H 9 a 1 1 0 0 1 1 1 V 20 a 1 1 0 0 1 -1 1 H 4 a 1 1 0 0 1 -1 -1 V 17 a 1 1 0 0 1 1 -1 Z"
    ) }
    val Users: ImageVector by lazy { strich("Users",
        "M 16 21 v -2 a 4 4 0 0 0 -4 -4 H 6 a 4 4 0 0 0 -4 4 v 2",
        "M 16 3.128 a 4 4 0 0 1 0 7.744",
        "M 22 21 v -2 a 4 4 0 0 0 -3 -3.87",
        "M 5 7 a 4 4 0 1 0 8 0 a 4 4 0 1 0 -8 0 Z"
    ) }
    val Wallet: ImageVector by lazy { strich("Wallet",
        "M 19 7 V 4 a 1 1 0 0 0 -1 -1 H 5 a 2 2 0 0 0 0 4 h 15 a 1 1 0 0 1 1 1 v 4 h -3 a 2 2 0 0 0 0 4 h 3 a 1 1 0 0 0 1 -1 v -2 a 1 1 0 0 0 -1 -1",
        "M 3 5 v 14 a 2 2 0 0 0 2 2 h 15 a 1 1 0 0 0 1 -1 v -4"
    ) }
    val Contact: ImageVector by lazy { strich("Contact",
        "M 16 2 v 2",
        "M 7 21 v -2 a 2 2 0 0 1 2 -2 h 6 a 2 2 0 0 1 2 2 v 2",
        "M 8 2 v 2",
        "M 9 10 a 3 3 0 1 0 6 0 a 3 3 0 1 0 -6 0 Z",
        "M 5 3 H 19 a 2 2 0 0 1 2 2 V 19 a 2 2 0 0 1 -2 2 H 5 a 2 2 0 0 1 -2 -2 V 5 a 2 2 0 0 1 2 -2 Z"
    ) }
    val CalendarDays: ImageVector by lazy { strich("CalendarDays",
        "M 8 2 v 3",
        "M 16 2 v 3",
        "M 5 3 H 19 a 2 2 0 0 1 2 2 V 19 a 2 2 0 0 1 -2 2 H 5 a 2 2 0 0 1 -2 -2 V 5 a 2 2 0 0 1 2 -2 Z",
        "M 3 9 h 18",
        "M 8 13 h .01",
        "M 12 13 h .01",
        "M 16 13 h .01",
        "M 8 17 h .01",
        "M 12 17 h .01",
        "M 16 17 h .01"
    ) }
    val ScrollText: ImageVector by lazy { strich("ScrollText",
        "M 15 12 h -5",
        "M 15 8 h -5",
        "M 19 17 V 5 a 2 2 0 0 0 -2 -2 H 4",
        "M 8 21 h 12 a 2 2 0 0 0 2 -2 v -1 a 1 1 0 0 0 -1 -1 H 11 a 1 1 0 0 0 -1 1 v 1 a 2 2 0 1 1 -4 0 V 5 a 2 2 0 1 0 -4 0 v 2 a 1 1 0 0 0 1 1 h 3"
    ) }
    val MapPin: ImageVector by lazy { strich("MapPin",
        "M 20 10 c 0 4.993 -5.539 10.193 -7.399 11.799 a 1 1 0 0 1 -1.202 0 C 9.539 20.193 4 14.993 4 10 a 8 8 0 0 1 16 0",
        "M 15 10 a 3 3 0 1 1 -6 0 a 3 3 0 1 1 6 0"
    ) }
    val Package: ImageVector by lazy { strich("Package",
        "M 11 21.73 a 2 2 0 0 0 2 0 l 7 -4 A 2 2 0 0 0 21 16 V 8 a 2 2 0 0 0 -1 -1.73 l -7 -4 a 2 2 0 0 0 -2 0 l -7 4 A 2 2 0 0 0 3 8 v 8 a 2 2 0 0 0 1 1.73 z",
        "M 12 22 V 12",
        "M 3.29 7 L 12 12 L 20.71 7",
        "m 7.5 4.27 9 5.15"
    ) }
    val FolderArchive: ImageVector by lazy { strich("FolderArchive",
        "M 13 19 a 2 2 0 1 0 4 0 a 2 2 0 1 0 -4 0 Z",
        "M 20.9 19.8 A 2 2 0 0 0 22 18 V 8 a 2 2 0 0 0 -2 -2 h -7.9 a 2 2 0 0 1 -1.69 -.9 L 9.6 3.9 A 2 2 0 0 0 7.93 3 H 4 a 2 2 0 0 0 -2 2 v 13 a 2 2 0 0 0 2 2 h 5.1",
        "M 15 11 v -1",
        "M 15 17 v -2"
    ) }
    val Settings: ImageVector by lazy { strich("Settings",
        "M 9.671 4.136 a 2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1 -2.33 4.033 2.34 2.34 0 0 0 -3.319 1.915 2.34 2.34 0 0 1 -4.659 0 2.34 2.34 0 0 0 -3.32 -1.915 2.34 2.34 0 0 1 -2.33 -4.033 2.34 2.34 0 0 0 0 -3.831 A 2.34 2.34 0 0 1 6.35 6.051 a 2.34 2.34 0 0 0 3.319 -1.915",
        "M 9 12 a 3 3 0 1 0 6 0 a 3 3 0 1 0 -6 0 Z"
    ) }
    val FileSignature: ImageVector by lazy { strich("FileSignature",
        "M 14.364 13.634 a 2 2 0 0 0 -.506 .854 l -.837 2.87 a .5 .5 0 0 0 .62 .62 l 2.87 -.837 a 2 2 0 0 0 .854 -.506 l 4.013 -4.009 a 1 1 0 0 0 -3.004 -3.004 z",
        "M 14.487 7.858 A 1 1 0 0 1 14 7 V 2",
        "M 20 19.645 V 20 a 2 2 0 0 1 -2 2 H 6 a 2 2 0 0 1 -2 -2 V 4 a 2 2 0 0 1 2 -2 h 8 a 2.4 2.4 0 0 1 1.704 .706 l 2.516 2.516",
        "M 8 18 h 1"
    ) }
    val BarChart3: ImageVector by lazy { strich("BarChart3",
        "M 3 3 v 16 a 2 2 0 0 0 2 2 h 16",
        "M 18 17 V 9",
        "M 13 17 V 5",
        "M 8 17 v -3"
    ) }
    val CreditCard: ImageVector by lazy { strich("CreditCard",
        "M 4 5 H 20 a 2 2 0 0 1 2 2 V 17 a 2 2 0 0 1 -2 2 H 4 a 2 2 0 0 1 -2 -2 V 7 a 2 2 0 0 1 2 -2 Z",
        "M 2 10 L 22 10",
        "M 6 14 h 2"
    ) }
    val FileSpreadsheet: ImageVector by lazy { strich("FileSpreadsheet",
        "M 6 22 a 2 2 0 0 1 -2 -2 V 4 a 2 2 0 0 1 2 -2 h 8 a 2.4 2.4 0 0 1 1.704 .706 l 3.588 3.588 A 2.4 2.4 0 0 1 20 8 v 12 a 2 2 0 0 1 -2 2 z",
        "M 14 2 v 5 a 1 1 0 0 0 1 1 h 5",
        "M 8 13 h 2",
        "M 14 13 h 2",
        "M 8 17 h 2",
        "M 14 17 h 2"
    ) }
    val FileText: ImageVector by lazy { strich("FileText",
        "M 6 22 a 2 2 0 0 1 -2 -2 V 4 a 2 2 0 0 1 2 -2 h 8 a 2.4 2.4 0 0 1 1.704 .706 l 3.588 3.588 A 2.4 2.4 0 0 1 20 8 v 12 a 2 2 0 0 1 -2 2 z",
        "M 14 2 v 5 a 1 1 0 0 0 1 1 h 5",
        "M 10 9 H 8",
        "M 16 13 H 8",
        "M 16 17 H 8"
    ) }
    val HeartHandshake: ImageVector by lazy { strich("HeartHandshake",
        "M 19.414 14.414 C 21 12.828 22 11.5 22 9.5 a 5.5 5.5 0 0 0 -9.591 -3.676 .6 .6 0 0 1 -.818 .001 A 5.5 5.5 0 0 0 2 9.5 c 0 2.3 1.5 4 3 5.5 l 5.535 5.362 a 2 2 0 0 0 2.879 .052 2.12 2.12 0 0 0 -.004 -3 2.124 2.124 0 1 0 3 -3 2.124 2.124 0 0 0 3.004 0 2 2 0 0 0 0 -2.828 l -1.881 -1.882 a 2.41 2.41 0 0 0 -3.409 0 l -1.71 1.71 a 2 2 0 0 1 -2.828 0 2 2 0 0 1 0 -2.828 l 2.823 -2.762"
    ) }
    val PieChart: ImageVector by lazy { strich("PieChart",
        "M 21 12 c .552 0 1.005 -.449 .95 -.998 a 10 10 0 0 0 -8.953 -8.951 c -.55 -.055 -.998 .398 -.998 .95 v 8 a 1 1 0 0 0 1 1 z",
        "M 21.21 15.89 A 10 10 0 1 1 8 2.83"
    ) }

    private fun strich(name: String, vararg pfade: String): ImageVector {
        val b = ImageVector.Builder(name, 24.dp, 24.dp, 24f, 24f)
        for (d in pfade) {
            b.addPath(
                pathData = PathParser().parsePathString(d).toNodes(),
                stroke = SolidColor(Color.Black),
                strokeLineWidth = 2f,
                strokeLineCap = StrokeCap.Round,
                strokeLineJoin = StrokeJoin.Round,
            )
        }
        return b.build()
    }
}
