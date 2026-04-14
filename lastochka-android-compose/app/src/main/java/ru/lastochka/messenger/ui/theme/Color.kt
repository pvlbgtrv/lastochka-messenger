package ru.lastochka.messenger.ui.theme

import androidx.compose.ui.graphics.Color

// ─── Brand colors (from lastochka-ui) ────────────────────────────
val BrandPrimary = Color(0xFF5B5EF4)    // индиго
val BrandPrimaryDark = Color(0xFF4338CA)
val BrandSecondary = Color(0xFF7B61FF)  // фиолетовый
val BrandSecondaryDark = Color(0xFF5C45D6)
val BrandAccent = Color(0xFFFFD93D)     // солнечный

// ─── Light theme colors ─────────────────────────────────────────
val Background = Color(0xFFEFEFF3)
val Surface = Color(0xFFFFFFFF)
val SurfaceVariant = Color(0xFFF5F5F5)
val OnSurface = Color(0xFF1A1A1A)
val OnSurfaceVariant = Color(0xFF666666)
val Outline = Color(0xFFE0E0E0)

// ─── Message bubbles (light) ────────────────────────────────────
val BubbleOwn = Color(0xFFEEF2FF)       // индиго-светлый (свои)
val BubblePeer = Color(0xFFFFFFFF)      // белый (чужие)
val BubbleOwnText = Color(0xFF1A1A1A)
val BubblePeerText = Color(0xFF1A1A1A)

// ─── Dark theme colors ──────────────────────────────────────────
val BackgroundDark = Color(0xFF0E1621)
val SurfaceDark = Color(0xFF17212B)
val SurfaceVariantDark = Color(0xFF1E2C3A)
val OnSurfaceDark = Color(0xFFF5F5F5)
val OnSurfaceVariantDark = Color(0xFF9E9E9E)
val OutlineDark = Color(0xFF2B3A4A)

// ─── Message bubbles (dark) ─────────────────────────────────────
val BubbleOwnDark = Color(0xFF2B5278)
val BubblePeerDark = Color(0xFF182533)
val BubbleOwnTextDark = Color(0xFFE8E8E8)
val BubblePeerTextDark = Color(0xFFE8E8E8)

// ─── Status colors ──────────────────────────────────────────────
val Online = Color(0xFF40C040)
val ReadReceipt = BrandPrimary
val SentReceipt = Color(0xFF9E9E9E)
val SelectionOverlay = Color(0x2F3F51B5)

// ─── Avatar palette ─────────────────────────────────────────────
val AvatarColors = listOf(
    Color(0xFF5B5EF4), Color(0xFF7B61FF), Color(0xFF2E86DE),
    Color(0xFF3BAFFF), Color(0xFF4CAF50), Color(0xFFFFD93D),
    Color(0xFFFF6B6B), Color(0xFFFF9F43), Color(0xFFA29BFE),
    Color(0xFFFD79A8), Color(0xFF00CEC9), Color(0xFFE17055),
    Color(0xFF6C5CE7), Color(0xFF00B894), Color(0xFFFDCB6E),
    Color(0xFFE84393)
)
