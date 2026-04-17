package ru.lastochka.messenger.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.*
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import ru.lastochka.messenger.ui.theme.AvatarColors

/**
 * Аватар с инициалами и цветовым хешем (как в lastochka-ui).
 */
@Composable
fun Avatar(
    name: String,
    modifier: Modifier = Modifier,
    size: Dp = 48.dp,
    avatarUrl: String? = null,
    showOnlineIndicator: Boolean = false,
    isOnline: Boolean = false
) {
    Box(modifier = modifier.size(size)) {
        // Аватар
        if (!avatarUrl.isNullOrBlank()) {
            AsyncImage(
                model = avatarUrl,
                contentDescription = name,
                modifier = Modifier
                    .fillMaxSize()
                    .clip(CircleShape),
                contentScale = ContentScale.Crop
            )
        } else {
            val colorIndex = remember(name) {
                (name.hashCode().and(0x7FFFFFFF)) % AvatarColors.size
            }
            val bgColor = remember(colorIndex) {
                AvatarColors[colorIndex]
            }
            val initials = remember(name) {
                name.split(" ")
                    .take(2)
                    .mapNotNull { it.firstOrNull()?.uppercase() }
                    .joinToString("")
            }

            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .clip(CircleShape)
                    .background(bgColor),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = initials,
                    color = Color.White,
                    fontSize = (size.value * 0.38f).sp,
                    fontWeight = FontWeight.SemiBold,
                    textAlign = TextAlign.Center
                )
            }
        }

        // Индикатор онлайн
        if (showOnlineIndicator) {
            Box(
                modifier = Modifier
                    .size((size.value * 0.28f).dp)
                    .align(Alignment.BottomEnd)
                    .clip(CircleShape)
                    .background(if (isOnline) Color(0xFF40C040) else Color(0xFFBBBB66))
                    .border(1.5.dp, MaterialTheme.colorScheme.surface, CircleShape)
            )
        }
    }
}

/**
 * Аватар поменьше (для списка чатов).
 */
@Composable
fun AvatarSmall(
    name: String,
    modifier: Modifier = Modifier,
    avatarUrl: String? = null,
    isOnline: Boolean = false
) {
    Avatar(
        name = name,
        modifier = modifier,
        size = 48.dp,
        avatarUrl = avatarUrl,
        showOnlineIndicator = true,
        isOnline = isOnline
    )
}

/**
 * Аватар побольше (для хедера чата).
 */
@Composable
fun AvatarLarge(
    name: String,
    modifier: Modifier = Modifier,
    avatarUrl: String? = null,
    isOnline: Boolean = false
) {
    Avatar(
        name = name,
        modifier = modifier,
        size = 40.dp,
        avatarUrl = avatarUrl,
        showOnlineIndicator = true,
        isOnline = isOnline
    )
}
