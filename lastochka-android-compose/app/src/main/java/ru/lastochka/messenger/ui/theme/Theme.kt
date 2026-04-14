package ru.lastochka.messenger.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color

// ─── Lastochka ColorScheme ───────────────────────────────────────

private val LightColorScheme = lightColorScheme(
    primary = BrandPrimary,
    onPrimary = Color.White,
    primaryContainer = BubbleOwn,
    onPrimaryContainer = BubbleOwnText,
    secondary = BrandSecondary,
    onSecondary = Color.White,
    surface = Surface,
    onSurface = OnSurface,
    surfaceVariant = SurfaceVariant,
    onSurfaceVariant = OnSurfaceVariant,
    background = Background,
    onBackground = OnSurface,
    outline = Outline,
    outlineVariant = Outline,
    error = Color(0xFFB71C1C)
)

private val DarkColorScheme = darkColorScheme(
    primary = BrandPrimary,
    onPrimary = Color.White,
    primaryContainer = BubbleOwnDark,
    onPrimaryContainer = BubbleOwnTextDark,
    secondary = BrandSecondary,
    onSecondary = Color.White,
    surface = SurfaceDark,
    onSurface = OnSurfaceDark,
    surfaceVariant = SurfaceVariantDark,
    onSurfaceVariant = OnSurfaceVariantDark,
    background = BackgroundDark,
    onBackground = OnSurfaceDark,
    outline = OutlineDark,
    outlineVariant = OutlineDark,
    error = Color(0xFFCF6679)
)

// ─── Bubble colors (локально для чата) ───────────────────────────

data class BubbleColors(
    val own: Color,
    val ownText: Color,
    val peer: Color,
    val peerText: Color
)

private val LightBubbleColors = BubbleColors(
    own = BubbleOwn,
    ownText = BubbleOwnText,
    peer = BubblePeer,
    peerText = BubblePeerText
)

private val DarkBubbleColors = BubbleColors(
    own = BubbleOwnDark,
    ownText = BubbleOwnTextDark,
    peer = BubblePeerDark,
    peerText = BubblePeerTextDark
)

val LocalBubbleColors = staticCompositionLocalOf { LightBubbleColors }

// ─── Theme ───────────────────────────────────────────────────────

@Composable
fun LastochkaTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit
) {
    val colorScheme = if (darkTheme) DarkColorScheme else LightColorScheme
    val bubbleColors = if (darkTheme) DarkBubbleColors else LightBubbleColors

    MaterialTheme(
        colorScheme = colorScheme,
        typography = Typography
    ) {
        CompositionLocalProvider(LocalBubbleColors provides bubbleColors) {
            content()
        }
    }
}
