package ru.lastochka.messenger.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.*
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.unit.dp

/**
 * Поле ввода сообщения (как в lastochka-ui MessageInput).
 *
 * Стиль: скруглённое, светлый фон, иконка отправки справа.
 */
@Composable
fun MessageInput(
    text: String,
    onTextChanged: (String) -> Unit,
    onSend: () -> Unit,
    onAttach: () -> Unit,
    modifier: Modifier = Modifier,
    placeholder: String = "Сообщение…",
    replyToMessage: ru.lastochka.messenger.data.UiMessage? = null
) {
    var isFocused by remember { mutableStateOf(false) }

    Row(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 8.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        // Кнопка скрепки
        IconButton(
            onClick = onAttach,
            modifier = Modifier.size(40.dp)
        ) {
            Icon(
                imageVector = Icons.Default.AttachFile,
                contentDescription = "Прикрепить",
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.size(24.dp)
            )
        }

        Spacer(modifier = Modifier.width(8.dp))

        // Поле ввода
        Surface(
            modifier = Modifier.weight(1f),
            shape = RoundedCornerShape(24.dp),
            color = MaterialTheme.colorScheme.surfaceVariant,
            tonalElevation = 0.dp
        ) {
            BasicTextField(
                value = text,
                onValueChange = onTextChanged,
                textStyle = TextStyle(
                    color = MaterialTheme.colorScheme.onSurface,
                    fontSize = MaterialTheme.typography.bodyLarge.fontSize
                ),
                cursorBrush = SolidColor(MaterialTheme.colorScheme.primary),
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 12.dp)
                    .onFocusChanged { isFocused = it.isFocused },
                decorationBox = { innerTextField ->
                    Box {
                        if (text.isEmpty()) {
                            Text(
                                text = placeholder,
                                style = MaterialTheme.typography.bodyLarge,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                        innerTextField()
                    }
                },
                maxLines = 6
            )
        }

        Spacer(modifier = Modifier.width(8.dp))

        // Кнопка отправки / микрофон
        IconButton(
            onClick = {
                if (text.isNotBlank()) {
                    onSend()
                }
            },
            modifier = Modifier
                .size(40.dp)
                .clip(CircleShape)
                .background(
                    if (text.isNotBlank())
                        MaterialTheme.colorScheme.primary
                    else
                        MaterialTheme.colorScheme.surfaceVariant
                )
        ) {
            Icon(
                imageVector = if (text.isNotBlank())
                    Icons.Default.Send
                else
                    Icons.Default.Mic,
                contentDescription = if (text.isNotBlank()) "Отправить" else "Голосовое",
                tint = if (text.isNotBlank())
                    Color.White
                else
                    MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.size(20.dp)
            )
        }
    }
}
