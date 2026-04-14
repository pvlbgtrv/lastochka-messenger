package ru.lastochka.messenger.ui.components

import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Done
import androidx.compose.material.icons.filled.DoneAll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.*
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.SubcomposeAsyncImage
import coil.request.ImageRequest
import timber.log.Timber
import ru.lastochka.messenger.LastochkaApp
import ru.lastochka.messenger.data.UiMessage
import ru.lastochka.messenger.ui.theme.LocalBubbleColors
import ru.lastochka.messenger.ui.theme.ReadReceipt
import ru.lastochka.messenger.ui.theme.SentReceipt
import java.text.SimpleDateFormat
import java.util.*
import kotlin.math.roundToInt

@OptIn(ExperimentalFoundationApi::class)
@Composable
fun MessageBubble(
    message: UiMessage,
    modifier: Modifier = Modifier,
    isFirstInGroup: Boolean = false,
    isLastInGroup: Boolean = false,
    showSender: Boolean = false,
    onLongClick: (() -> Unit)? = null,
    onSwipeReply: (() -> Unit)? = null,
    onImageClick: ((String) -> Unit)? = null
) {
    val bubbleColors = LocalBubbleColors.current
    val timeFormat = SimpleDateFormat("HH:mm", Locale.getDefault())

    val bgColor = if (message.isOwn) bubbleColors.own else bubbleColors.peer
    val textColor = if (message.isOwn) bubbleColors.ownText else bubbleColors.peerText

    // State for swipe offset
    var offsetX by remember { mutableFloatStateOf(0f) }
    val maxOffset = 100f

    val bubbleShape = when {
        message.isOwn -> when {
            isLastInGroup -> RoundedCornerShape(topStart = 18.dp, topEnd = 18.dp, bottomStart = 18.dp, bottomEnd = 4.dp)
            else -> RoundedCornerShape(topStart = 18.dp, topEnd = 18.dp, bottomStart = 4.dp, bottomEnd = 4.dp)
        }
        else -> when {
            isLastInGroup -> RoundedCornerShape(topStart = 18.dp, topEnd = 18.dp, bottomStart = 4.dp, bottomEnd = 18.dp)
            else -> RoundedCornerShape(topStart = 4.dp, topEnd = 18.dp, bottomStart = 4.dp, bottomEnd = 4.dp)
        }
    }

    val alignment = if (message.isOwn) Alignment.End else Alignment.Start

    Column(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 12.dp, vertical = if (isFirstInGroup) 8.dp else 2.dp)
            .offset { IntOffset(offsetX.roundToInt(), 0) }
            .pointerInput(Unit) {
                detectHorizontalDragGestures(
                    onDragEnd = {
                        if (offsetX > maxOffset / 2) {
                            onSwipeReply?.invoke()
                        }
                        offsetX = 0f
                    },
                    onHorizontalDrag = { _, dragAmount ->
                        if (dragAmount > 0) { // Only allow swipe right
                            offsetX = (offsetX + dragAmount).coerceIn(0f, maxOffset)
                        }
                    }
                )
            }
            .combinedClickable(onClick = {}, onLongClick = onLongClick ?: {}),
        horizontalAlignment = alignment
    ) {
        if (showSender && !message.isOwn) {
            Text(
                text = message.senderName,
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.primary,
                modifier = Modifier.padding(start = 4.dp, bottom = 2.dp)
            )
        }

        Box(
            modifier = Modifier
                .clip(bubbleShape)
                .background(bgColor)
                .padding(horizontal = 12.dp, vertical = 8.dp)
                .widthIn(max = 280.dp)
        ) {
            Column {
                // Reply Quote
                if (message.replyToContent != null) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(bottom = 4.dp)
                            .background(Color(0xFFE0E0E0).copy(alpha = 0.3f), shape = RoundedCornerShape(4.dp))
                            .padding(start = 8.dp, end = 8.dp, top = 4.dp, bottom = 4.dp)
                    ) {
                        Row {
                            Box(
                                modifier = Modifier
                                    .width(3.dp)
                                    .fillMaxHeight()
                                    .background(MaterialTheme.colorScheme.primary, shape = RoundedCornerShape(2.dp))
                            )
                            Spacer(modifier = Modifier.width(6.dp))
                            Column {
                                Text("Ответ", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.Bold)
                                Text(message.replyToContent, style = MaterialTheme.typography.bodySmall, color = textColor.copy(alpha = 0.7f), maxLines = 2, overflow = TextOverflow.Ellipsis)
                            }
                        }
                    }
                }

                // Image attachment
                if (message.hasAttachment) {
                    val context = LocalContext.current
                    Timber.d("MessageBubble: hasAttachment=true, seqId=${message.seqId}, attachmentUrl=${message.attachmentUrl?.take(50)}")

                    if (message.attachmentUrl != null) {
                        // Determine if this is a data URL (base64 inline) or a server URL
                        val imageData = if (message.attachmentUrl.startsWith("data:")) {
                            // Inline base64 image from web client
                            message.attachmentUrl
                        } else {
                            // Server URL — build full download URL with auth headers
                            val app = context.applicationContext as LastochkaApp
                            app.tinodeClient.buildFileDownloadUrl(message.attachmentUrl)
                        }
                        Timber.d("MessageBubble: loading image, isBase64=${imageData.startsWith("data:")}, isOwn=${message.isOwn}")

                        SubcomposeAsyncImage(
                            model = ImageRequest.Builder(context)
                                .data(imageData)
                                .crossfade(true)
                                .listener(
                                    onSuccess = { _, result ->
                                        Timber.d("MessageBubble: image loaded successfully, size=${result.drawable?.intrinsicWidth}x${result.drawable?.intrinsicHeight}")
                                    },
                                    onError = { _, result ->
                                        Timber.e("MessageBubble: image load failed: ${result.throwable?.message}")
                                    }
                                )
                                .build(),
                            contentDescription = "Вложение",
                            modifier = Modifier
                                .fillMaxWidth()
                                .heightIn(max = 300.dp)
                                .clip(RoundedCornerShape(8.dp))
                                .background(Color(0xFFCCCCCC))
                                .padding(bottom = 4.dp)
                                .clickable(enabled = onImageClick != null) {
                                    onImageClick?.invoke(imageData)
                                },
                            contentScale = ContentScale.Fit,
                            loading = {
                                Box(
                                    modifier = Modifier.fillMaxSize(),
                                    contentAlignment = Alignment.Center
                                ) {
                                    CircularProgressIndicator(
                                        modifier = Modifier.size(24.dp),
                                        strokeWidth = 2.dp
                                    )
                                }
                            },
                            error = {
                                val exc = it.result?.throwable
                                Box(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .height(100.dp)
                                        .clickable { exc?.printStackTrace() },
                                    contentAlignment = Alignment.Center
                                ) {
                                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                        Text(
                                            text = "Ошибка загрузки",
                                            style = MaterialTheme.typography.bodySmall,
                                            color = Color.Gray
                                        )
                                        exc?.message?.let { msg ->
                                            Text(
                                                text = msg.take(50),
                                                style = MaterialTheme.typography.labelSmall,
                                                color = Color.Red,
                                                modifier = Modifier.padding(top = 4.dp)
                                            )
                                        }
                                    }
                                }
                            }
                        )
                    } else {
                        // Placeholder: показываем иконку при отправке
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .heightIn(max = 200.dp)
                                .clip(RoundedCornerShape(8.dp))
                                .background(Color(0xFFE0E0E0))
                                .padding(32.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                Text(
                                    text = "📷",
                                    fontSize = 32.sp,
                                    modifier = Modifier.padding(bottom = 8.dp)
                                )
                                Spacer(modifier = Modifier.height(8.dp))
                                Text(
                                    text = "Отправка...",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = Color.Gray
                                )
                            }
                        }
                    }
                }

                // Text content (если есть caption)
                if (message.content.isNotBlank() && message.content != " ") {
                    Text(
                        text = message.content,
                        style = MaterialTheme.typography.bodyLarge.copy(color = textColor),
                        modifier = Modifier.padding(end = 48.dp)
                    )
                }

                Row(
                    modifier = Modifier.align(Alignment.End).padding(top = 4.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(2.dp)
                ) {
                    if (message.isEdited) {
                        Text(text = "ред.", style = MaterialTheme.typography.labelSmall, color = textColor.copy(alpha = 0.6f))
                    }
                    Text(
                        text = timeFormat.format(message.timestamp),
                        style = MaterialTheme.typography.labelSmall,
                        color = textColor.copy(alpha = 0.6f)
                    )
                    if (message.isOwn) {
                        Icon(
                            imageVector = if (message.isRead) Icons.Filled.DoneAll else Icons.Filled.Done,
                            contentDescription = null,
                            tint = if (message.isRead) ReadReceipt else SentReceipt,
                            modifier = Modifier.size(14.dp)
                        )
                    }
                }
            }
        }
    }
}

/**
 * Разделитель дат.
 */
@Composable
fun DateDivider(date: Date, modifier: Modifier = Modifier) {
    val today = Calendar.getInstance()
    val messageDate = Calendar.getInstance().apply { time = date }

    val label = when {
        today.get(Calendar.YEAR) == messageDate.get(Calendar.YEAR) &&
                today.get(Calendar.DAY_OF_YEAR) == messageDate.get(Calendar.DAY_OF_YEAR) -> "Сегодня"
        today.get(Calendar.YEAR) == messageDate.get(Calendar.YEAR) &&
                today.get(Calendar.DAY_OF_YEAR) - messageDate.get(Calendar.DAY_OF_YEAR) == 1 -> "Вчера"
        else -> SimpleDateFormat("dd MMMM yyyy", Locale("ru")).format(date)
    }

    Box(
        modifier = modifier.fillMaxWidth().padding(vertical = 16.dp),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.labelMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier
                .background(color = MaterialTheme.colorScheme.surfaceVariant, shape = RoundedCornerShape(12.dp))
                .padding(horizontal = 16.dp, vertical = 6.dp)
        )
    }
}
