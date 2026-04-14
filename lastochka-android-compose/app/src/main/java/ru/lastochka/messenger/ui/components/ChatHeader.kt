package ru.lastochka.messenger.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.*
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp

/**
 * Хедер чата (как в lastochka-ui ChatHeader).
 *
 * Показывает: аватар, имя, статус (онлайн/typing), кнопки действий.
 */
@Composable
fun ChatHeader(
    name: String,
    statusText: String?,
    isOnline: Boolean,
    avatarUrl: String? = null,
    onBack: () -> Unit,
    onCall: () -> Unit,
    onMore: () -> Unit,
    onClick: (() -> Unit)? = null,
    modifier: Modifier = Modifier
) {
    Surface(
        modifier = modifier.fillMaxWidth(),
        color = MaterialTheme.colorScheme.surface,
        tonalElevation = 1.dp
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 4.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Кнопка назад
            IconButton(onClick = onBack) {
                Icon(
                    imageVector = Icons.Default.ArrowBack,
                    contentDescription = "Назад",
                    tint = MaterialTheme.colorScheme.onSurface
                )
            }

            // Аватар + Имя (Кликабельная область)
            Row(
                modifier = Modifier
                    .weight(1f)
                    .clickable(enabled = onClick != null, onClick = onClick ?: {})
                    .padding(horizontal = 4.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                AvatarLarge(
                    name = name,
                    avatarUrl = avatarUrl,
                    isOnline = isOnline
                )

                Column(
                    modifier = Modifier.padding(horizontal = 8.dp)
                ) {
                    Text(
                        text = name,
                        style = MaterialTheme.typography.titleMedium.copy(
                            fontWeight = FontWeight.SemiBold
                        ),
                        color = MaterialTheme.colorScheme.onSurface,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )

                    if (statusText != null) {
                        Text(
                            text = statusText,
                            style = MaterialTheme.typography.bodySmall,
                            color = if (isOnline)
                                androidx.compose.ui.graphics.Color(0xFF40C040)
                            else
                                MaterialTheme.colorScheme.onSurfaceVariant,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                    }
                }
            }

            // Кнопка звонка
            IconButton(onClick = onCall) {
                Icon(
                    imageVector = Icons.Default.Call,
                    contentDescription = "Позвонить",
                    tint = MaterialTheme.colorScheme.primary
                )
            }

            // Кнопка видеозвонка
            IconButton(onClick = onCall) {
                Icon(
                    imageVector = Icons.Default.Videocam,
                    contentDescription = "Видеозвонок",
                    tint = MaterialTheme.colorScheme.primary
                )
            }

            // Меню
            IconButton(onClick = onMore) {
                Icon(
                    imageVector = Icons.Default.MoreVert,
                    contentDescription = "Ещё",
                    tint = MaterialTheme.colorScheme.onSurface
                )
            }
        }
    }
}
