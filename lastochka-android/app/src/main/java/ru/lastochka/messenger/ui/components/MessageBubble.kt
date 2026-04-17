package ru.lastochka.messenger.ui.components

import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.DoneAll
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
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
import ru.lastochka.messenger.LastochkaApp
import ru.lastochka.messenger.data.UiMessage
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale
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
    var offsetX by remember { mutableFloatStateOf(0f) }
    val maxOffset = 92f
    val timeFormat = remember { SimpleDateFormat("HH:mm", Locale("ru")) }

    val ownShape = when {
        isLastInGroup -> RoundedCornerShape(18.dp, 18.dp, 18.dp, 6.dp)
        else -> RoundedCornerShape(18.dp, 18.dp, 6.dp, 6.dp)
    }
    val peerShape = when {
        isLastInGroup -> RoundedCornerShape(18.dp, 18.dp, 6.dp, 18.dp)
        else -> RoundedCornerShape(18.dp, 18.dp, 6.dp, 6.dp)
    }

    val bubbleModifier = Modifier
        .clip(if (message.isOwn) ownShape else peerShape)
        .background(
            if (message.isOwn) {
                Brush.linearGradient(listOf(Color(0xFFEEF2FF), Color(0xFFE0E7FF)))
            } else {
                Brush.linearGradient(listOf(Color.White, Color(0xFFF8FAFC)))
            }
        )
        .widthIn(max = 290.dp)
        .padding(horizontal = 12.dp, vertical = 8.dp)

    Column(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 12.dp, vertical = if (isFirstInGroup) 8.dp else 2.dp)
            .offset { IntOffset(offsetX.roundToInt(), 0) }
            .pointerInput(Unit) {
                detectHorizontalDragGestures(
                    onHorizontalDrag = { _, dragAmount ->
                        if (dragAmount > 0) {
                            offsetX = (offsetX + dragAmount).coerceIn(0f, maxOffset)
                        }
                    },
                    onDragEnd = {
                        if (offsetX > maxOffset * 0.5f) onSwipeReply?.invoke()
                        offsetX = 0f
                    }
                )
            }
            .combinedClickable(onClick = {}, onLongClick = onLongClick ?: {}),
        horizontalAlignment = if (message.isOwn) Alignment.End else Alignment.Start
    ) {
        if (showSender && !message.isOwn) {
            Text(
                text = message.senderName,
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.primary,
                modifier = Modifier.padding(start = 4.dp, bottom = 2.dp)
            )
        }

        Box(modifier = bubbleModifier) {
            Column {
                if (message.replyToContent != null) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(bottom = 6.dp)
                            .background(
                                MaterialTheme.colorScheme.primary.copy(alpha = 0.08f),
                                shape = RoundedCornerShape(8.dp)
                            )
                            .padding(horizontal = 8.dp, vertical = 6.dp),
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        Box(
                            modifier = Modifier
                                .width(3.dp)
                                .height(30.dp)
                                .background(MaterialTheme.colorScheme.primary, RoundedCornerShape(2.dp))
                        )
                        Column {
                            Text("Ответ", fontSize = 11.sp, color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.SemiBold)
                            Text(
                                text = message.replyToContent,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                                fontSize = 11.sp,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                }

                if (message.hasAttachment) {
                    MessageAttachmentImage(message = message, onImageClick = onImageClick)
                    if (message.content.isNotBlank()) {
                        Spacer(modifier = Modifier.height(4.dp))
                    }
                }

                if (message.content.isNotBlank() && message.content != " ") {
                    Text(
                        text = message.content,
                        style = MaterialTheme.typography.bodyMedium,
                        color = Color(0xFF111827),
                        modifier = Modifier.padding(end = 46.dp)
                    )
                }

                Row(
                    modifier = Modifier
                        .align(Alignment.End)
                        .padding(top = 4.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(2.dp)
                ) {
                    if (message.isEdited) {
                        Text("ред.", fontSize = 10.sp, color = Color(0xFF94A3B8))
                    }
                    Text(timeFormat.format(message.timestamp), fontSize = 11.sp, color = Color(0xFF94A3B8))
                    if (message.isOwn) {
                        Icon(
                            imageVector = if (message.isRead) Icons.Default.DoneAll else Icons.Default.Check,
                            contentDescription = null,
                            tint = if (message.isRead) MaterialTheme.colorScheme.primary else Color(0xFF94A3B8),
                            modifier = Modifier.size(14.dp)
                        )
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun MessageAttachmentImage(
    message: UiMessage,
    onImageClick: ((String) -> Unit)?
) {
    val context = LocalContext.current
    val imageData = if (message.attachmentUrl?.startsWith("data:") == true) {
        message.attachmentUrl
    } else {
        message.attachmentUrl?.let {
            (context.applicationContext as LastochkaApp).tinodeClient.buildFileDownloadUrl(it)
        }
    }

    if (imageData == null) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(90.dp)
                .clip(RoundedCornerShape(10.dp))
                .background(Color(0xFFE5E7EB)),
            contentAlignment = Alignment.Center
        ) {
            Text("Отправка...", color = Color(0xFF6B7280), fontSize = 12.sp)
        }
        return
    }

    SubcomposeAsyncImage(
        model = ImageRequest.Builder(context).data(imageData).crossfade(true).build(),
        contentDescription = null,
        modifier = Modifier
            .fillMaxWidth()
            .heightIn(max = 260.dp)
            .clip(RoundedCornerShape(12.dp))
            .combinedClickable(
                onClick = { onImageClick?.invoke(imageData) },
                onLongClick = {}
            ),
        contentScale = ContentScale.Fit,
        loading = {
            Box(modifier = Modifier.fillMaxWidth().height(120.dp), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(modifier = Modifier.size(24.dp), strokeWidth = 2.dp)
            }
        }
    )
}

@Composable
fun DateDivider(date: Date, modifier: Modifier = Modifier) {
    val today = Calendar.getInstance()
    val msgDay = Calendar.getInstance().apply { time = date }
    val label = when {
        today.get(Calendar.YEAR) == msgDay.get(Calendar.YEAR) &&
            today.get(Calendar.DAY_OF_YEAR) == msgDay.get(Calendar.DAY_OF_YEAR) -> "Сегодня"
        else -> SimpleDateFormat("dd MMMM yyyy", Locale("ru")).format(date)
    }

    Box(
        modifier = modifier
            .fillMaxWidth()
            .padding(vertical = 10.dp),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = label,
            fontSize = 12.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier
                .clip(RoundedCornerShape(999.dp))
                .background(MaterialTheme.colorScheme.surface.copy(alpha = 0.72f))
                .padding(horizontal = 10.dp, vertical = 5.dp)
        )
    }
}
