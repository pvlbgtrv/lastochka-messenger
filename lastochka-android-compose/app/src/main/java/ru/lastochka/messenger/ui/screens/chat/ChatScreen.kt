package ru.lastochka.messenger.ui.screens.chat

import android.content.Context
import android.content.pm.PackageManager
import android.net.Uri
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.*
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.*
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.*
import androidx.compose.ui.input.pointer.PointerInputScope
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import androidx.hilt.navigation.compose.hiltViewModel
import coil.compose.AsyncImage
import coil.request.ImageRequest
import kotlinx.coroutines.launch
import ru.lastochka.messenger.data.UiMessage
import ru.lastochka.messenger.ui.components.*
import ru.lastochka.messenger.viewmodel.ChatViewModel
import ru.lastochka.messenger.viewmodel.MessageActionType
import java.io.File
import java.util.*

/**
 * Экран чата.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ChatScreen(
    topicName: String,
    topicTitle: String,
    onBack: () -> Unit,
    onOpenContactInfo: () -> Unit,
    viewModel: ChatViewModel = hiltViewModel()
) {
    val messages by viewModel.messages.collectAsState()
    val topicTitle by viewModel.topicTitle.collectAsState()
    val isTyping by viewModel.isTyping.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
    val isSendingImage by viewModel.isSendingImage.collectAsState()
    val imageUploadProgress by viewModel.imageUploadProgress.collectAsState()

    // Action states
    val selectedMessage by viewModel.selectedMessage.collectAsState()
    val replyToMessage by viewModel.replyToMessage.collectAsState()
    val editingMessage by viewModel.editingMessage.collectAsState()

    var inputText by remember { mutableStateOf("") }
    var selectedImageUri by remember { mutableStateOf<Uri?>(null) }
    val listState = rememberLazyListState()
    val scope = rememberCoroutineScope()
    val context = LocalContext.current

    // Fullscreen image viewer
    var viewingImageUri by remember { mutableStateOf<String?>(null) }

    // Launcher для выбора изображения из галереи
    val pickMedia = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri ->
        if (uri != null) {
            selectedImageUri = uri
        }
    }

    // Launcher для камеры — сохраняет фото в cache-директорию
    var cameraImageUri by remember { mutableStateOf<Uri?>(null) }
    var cameraImageFile by remember { mutableStateOf<File?>(null) }
    val takePhotoLauncher = rememberLauncherForActivityResult(ActivityResultContracts.TakePicture()) { success ->
        if (success && cameraImageUri != null) {
            selectedImageUri = cameraImageUri
        }
        cameraImageUri = null
        cameraImageFile = null
    }

    // Launcher для запроса разрешения CAMERA
    var pendingCameraAction by remember { mutableStateOf(false) }
    val requestCameraPermission = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { isGranted ->
        if (isGranted && pendingCameraAction) {
            pendingCameraAction = false
            doLaunchCamera(context, takePhotoLauncher) { uri, file ->
                cameraImageUri = uri
                cameraImageFile = file
            }
        } else if (!isGranted) {
            Toast.makeText(
                context,
                "Разрешение на использование камеры отклонено. Выберите фото из галереи.",
                Toast.LENGTH_LONG
            ).show()
        }
    }

    fun launchCamera() {
        when {
            ContextCompat.checkSelfPermission(context, android.Manifest.permission.CAMERA) ==
                    PackageManager.PERMISSION_GRANTED -> {
                doLaunchCamera(context, takePhotoLauncher) { uri, file ->
                    cameraImageUri = uri
                    cameraImageFile = file
                }
            }
            else -> {
                // Запрашиваем разрешение
                pendingCameraAction = true
                requestCameraPermission.launch(android.Manifest.permission.CAMERA)
            }
        }
    }

    // Debounce для typing indicator — не чаще 1 раза в 500ms
    var lastTypingTime by remember { mutableLongStateOf(0L) }

    fun onTextChanged(newText: String) {
        inputText = newText
        val now = System.currentTimeMillis()
        if (now - lastTypingTime > 500 && newText.isNotBlank()) {
            viewModel.sendTyping()
            lastTypingTime = now
        }
    }

    // Автоскролл
    LaunchedEffect(messages.size) {
        if (messages.isNotEmpty()) {
            listState.animateScrollToItem(messages.size)
        }
    }

    // Пагинация: загрузка при скролле к началу
    LaunchedEffect(listState.firstVisibleItemIndex) {
        if (listState.firstVisibleItemIndex == 0 && listState.firstVisibleItemScrollOffset < 50) {
            viewModel.loadMoreMessages()
        }
    }

    // Показывать FAB "Вниз", если проскроллили вверх
    val showScrollToBottom by remember {
        derivedStateOf {
            listState.firstVisibleItemIndex > 0 || listState.firstVisibleItemScrollOffset > 100
        }
    }

    LaunchedEffect(Unit) {
        viewModel.markAllRead()
    }

    // BottomSheet для действий с сообщениями
    val sheetState = rememberModalBottomSheetState()
    var showSheet by remember { mutableStateOf(false) }

    // BottomSheet для выбора источника медиа (галерея / камера)
    var showMediaSourceSheet by remember { mutableStateOf(false) }

    LaunchedEffect(selectedMessage) {
        if (selectedMessage != null) {
            showSheet = true
        } else {
            showSheet = false
        }
    }

    val currentSelectedMessage = selectedMessage
    if (showSheet && currentSelectedMessage != null) {
        ModalBottomSheet(
            onDismissRequest = {
                showSheet = false
                viewModel.dismissActionMenu()
            },
            sheetState = sheetState
        ) {
            Column(modifier = Modifier.padding(bottom = 24.dp)) {
                SheetAction(Icons.Default.Reply, "Ответить") {
                    viewModel.executeAction(MessageActionType.REPLY)
                    showSheet = false
                }
                SheetAction(Icons.Default.ContentCopy, "Копировать") {
                    viewModel.executeAction(MessageActionType.COPY)
                    showSheet = false
                }
                if (currentSelectedMessage.isOwn) {
                    SheetAction(Icons.Default.Edit, "Редактировать") {
                        viewModel.executeAction(MessageActionType.EDIT)
                        showSheet = false
                    }
                    SheetAction(Icons.Default.Delete, "Удалить", color = Color(0xFFEF5350)) {
                        viewModel.executeAction(MessageActionType.DELETE)
                        showSheet = false
                    }
                }
            }
        }
    }

    // Sheet выбора источника медиа
    if (showMediaSourceSheet) {
        ModalBottomSheet(
            onDismissRequest = { showMediaSourceSheet = false },
            sheetState = sheetState
        ) {
            Column(modifier = Modifier.padding(bottom = 24.dp)) {
                SheetAction(Icons.Default.PhotoLibrary, "Галерея") {
                    showMediaSourceSheet = false
                    pickMedia.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly))
                }
                SheetAction(Icons.Default.PhotoCamera, "Камера") {
                    showMediaSourceSheet = false
                    launchCamera()
                }
            }
        }
    }

    Scaffold(
        topBar = {
            ChatHeader(
                name = topicTitle,
                statusText = if (isTyping) "печатает…" else "был(а) недавно",
                isOnline = false,
                onBack = onBack,
                onCall = {},
                onMore = {},
                onClick = onOpenContactInfo
            )
        },
        bottomBar = {
            Column {
                // Reply Preview
                val currentReplyMsg = replyToMessage
                AnimatedVisibility(visible = currentReplyMsg != null) {
                    val msg = currentReplyMsg ?: return@AnimatedVisibility
                    ReplyPreview(
                        message = msg,
                        onClose = { viewModel.clearReply() }
                    )
                }

                // Image Preview
                val currentImageUri = selectedImageUri
                AnimatedVisibility(visible = currentImageUri != null) {
                    val uri = currentImageUri ?: return@AnimatedVisibility
                    ImagePreviewBar(
                        imageUri = uri,
                        onClear = { selectedImageUri = null },
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                    )
                }

                MessageInput(
                    text = inputText,
                    onTextChanged = ::onTextChanged,
                    onSend = {
                        val uri = selectedImageUri
                        if (uri != null) {
                            val mimeType = context.contentResolver.getType(uri)
                            val extension = mimeType?.substringAfter('/') ?: "jpg"
                            val fileName = "image_${System.currentTimeMillis()}.$extension"
                            viewModel.sendImageMessage(uri, mimeType ?: "image/jpeg", fileName, inputText)
                            selectedImageUri = null
                            inputText = ""
                        } else if (inputText.isNotBlank()) {
                            viewModel.sendMessage(inputText)
                            inputText = ""
                        }
                    },
                    onAttach = {
                        showMediaSourceSheet = true
                    },
                    replyToMessage = replyToMessage
                )
            }
        },
        floatingActionButton = {
            // FAB "Вниз"
            AnimatedVisibility(visible = showScrollToBottom) {
                FloatingActionButton(
                    onClick = {
                        scope.launch {
                            listState.animateScrollToItem(messages.size)
                        }
                    },
                    containerColor = MaterialTheme.colorScheme.secondaryContainer,
                    contentColor = MaterialTheme.colorScheme.onSecondaryContainer,
                    modifier = Modifier.padding(bottom = 16.dp)
                ) {
                    Icon(Icons.Default.KeyboardArrowDown, "Вниз")
                }
            }
        }
    ) { padding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(Color(0xFFE5DDD5)) // Telegram-like background color
                .padding(padding)
        ) {
            if (isLoading) {
                CircularProgressIndicator(modifier = Modifier.align(Alignment.Center))
            } else if (messages.isEmpty()) {
                EmptyChatState()
            } else {
                ChatMessagesList(
                    messages = messages,
                    listState = listState,
                    onLongClick = { msg -> viewModel.onMessageLongClick(msg) },
                    onSwipeReply = { msg -> viewModel.replyToMessageExternally(msg) },
                    onImageClick = { uri -> viewingImageUri = uri }
                )
            }

            // Progress overlay при отправке изображения
            if (isSendingImage) {
                Surface(
                    modifier = Modifier
                        .align(Alignment.BottomCenter)
                        .fillMaxWidth(),
                    color = MaterialTheme.colorScheme.surface.copy(alpha = 0.95f),
                    shadowElevation = 8.dp
                ) {
                    Column(
                        modifier = Modifier.padding(16.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        LinearProgressIndicator(
                            progress = imageUploadProgress,
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(4.dp),
                            color = MaterialTheme.colorScheme.primary,
                            trackColor = MaterialTheme.colorScheme.surfaceVariant
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            text = "Отправка изображения... ${(imageUploadProgress * 100).toInt()}%",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }
        }

        // Fullscreen image viewer
        val viewingUri = viewingImageUri
        if (viewingUri != null) {
            FullscreenImageViewer(
                imageUrl = viewingUri,
                onDismiss = { viewingImageUri = null }
            )
        }
    }
}

@Composable
fun SheetAction(icon: androidx.compose.ui.graphics.vector.ImageVector, label: String, color: Color = LocalContentColor.current, onClick: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(16.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(icon, contentDescription = label, tint = color)
        Spacer(modifier = Modifier.width(16.dp))
        Text(label, color = color, fontWeight = FontWeight.Medium)
    }
}

@Composable
fun ReplyPreview(message: UiMessage, onClose: () -> Unit) {
    Surface(
        color = MaterialTheme.colorScheme.surfaceVariant,
        modifier = Modifier.fillMaxWidth()
    ) {
        Row(
            modifier = Modifier.padding(start = 16.dp, end = 8.dp, top = 8.dp, bottom = 8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .width(4.dp)
                    .height(32.dp)
                    .background(MaterialTheme.colorScheme.primary, shape = MaterialTheme.shapes.small)
            )
            Spacer(modifier = Modifier.width(12.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text("Ответ на сообщение", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.primary)
                Text(message.content, style = MaterialTheme.typography.bodyMedium, maxLines = 1, overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis)
            }
            IconButton(onClick = onClose) {
                Icon(Icons.Default.Close, "Закрыть")
            }
        }
    }
}

@Composable
fun ChatMessagesList(
    messages: List<UiMessage>,
    listState: androidx.compose.foundation.lazy.LazyListState,
    onLongClick: (UiMessage) -> Unit,
    onSwipeReply: (UiMessage) -> Unit,
    onImageClick: (String) -> Unit
) {
    val messagesWithDividers = remember(messages) {
        buildList {
            var lastDate: Date? = null
            messages.forEach { msg ->
                val msgDate = msg.timestamp.toDayStart()
                if (msgDate != lastDate) {
                    add(UiMessageWrapper.Divider(msgDate))
                    lastDate = msgDate
                }
                add(UiMessageWrapper.Message(msg))
            }
        }
    }

    fun isLastInGroup(index: Int): Boolean {
        val current = messagesWithDividers.getOrNull(index) as? UiMessageWrapper.Message ?: return true
        val next = messagesWithDividers.getOrNull(index + 1)
        return when (next) {
            is UiMessageWrapper.Divider -> true
            is UiMessageWrapper.Message -> next.message.isOwn != current.message.isOwn
            null -> true
        }
    }

    fun isFirstInGroup(index: Int): Boolean {
        val current = messagesWithDividers.getOrNull(index) as? UiMessageWrapper.Message ?: return true
        val prev = messagesWithDividers.getOrNull(index - 1)
        return when (prev) {
            is UiMessageWrapper.Divider -> true
            is UiMessageWrapper.Message -> prev.message.isOwn != current.message.isOwn
            null -> true
        }
    }

    LazyColumn(
        state = listState,
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(vertical = 8.dp)
    ) {
        itemsIndexed(
            items = messagesWithDividers,
            key = { index, item ->
                when (item) {
                    is UiMessageWrapper.Message -> "msg_${item.message.seqId}"
                    is UiMessageWrapper.Divider -> "div_${item.date.time}"
                }
            }
        ) { index, wrapper ->
            when (wrapper) {
                is UiMessageWrapper.Message -> {
                    MessageBubble(
                        message = wrapper.message,
                        isFirstInGroup = isFirstInGroup(index),
                        isLastInGroup = isLastInGroup(index),
                        onLongClick = { onLongClick(wrapper.message) },
                        onSwipeReply = { onSwipeReply(wrapper.message) },
                        onImageClick = onImageClick
                    )
                }
                is UiMessageWrapper.Divider -> {
                    DateDivider(date = wrapper.date)
                }
            }
        }
    }
}

@Composable
fun EmptyChatState() {
    Box(
        modifier = Modifier.fillMaxSize(),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(text = "👋", fontSize = 48.sp, modifier = Modifier.padding(bottom = 16.dp))
            Text(text = "Нет сообщений", style = MaterialTheme.typography.bodyLarge, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Text(text = "Начните диалог!", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

// ─── Helpers ────────────────────────────────────────────────────

private fun Date.toDayStart(): Date {
    val cal = Calendar.getInstance()
    cal.time = this
    cal.set(Calendar.HOUR_OF_DAY, 0)
    cal.set(Calendar.MINUTE, 0)
    cal.set(Calendar.SECOND, 0)
    cal.set(Calendar.MILLISECOND, 0)
    return cal.time
}

sealed class UiMessageWrapper {
    data class Message(val message: UiMessage) : UiMessageWrapper()
    data class Divider(val date: Date) : UiMessageWrapper()
}

/**
 * Превью выбранного изображения перед отправкой.
 */
@Composable
fun ImagePreviewBar(
    imageUri: Uri,
    onClear: () -> Unit,
    modifier: Modifier = Modifier
) {
    Surface(
        modifier = modifier.fillMaxWidth(),
        shape = MaterialTheme.shapes.medium,
        tonalElevation = 2.dp
    ) {
        Row(
            modifier = Modifier.padding(8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Thumbnail
            AsyncImage(
                model = imageUri,
                contentDescription = "Выбранное изображение",
                modifier = Modifier
                    .size(48.dp)
                    .clip(MaterialTheme.shapes.small),
                contentScale = ContentScale.Crop
            )

            Spacer(modifier = Modifier.width(8.dp))

            // File name hint
            Text(
                text = "Изображение",
                style = MaterialTheme.typography.bodySmall,
                modifier = Modifier.weight(1f)
            )

            // Clear button
            IconButton(onClick = onClear) {
                Icon(Icons.Default.Close, "Удалить", tint = MaterialTheme.colorScheme.error)
            }
        }
    }
}

/**
 * Полноэкранный просмотр изображения с pinch-to-zoom.
 */
@Composable
fun FullscreenImageViewer(
    imageUrl: String,
    onDismiss: () -> Unit
) {
    val context = LocalContext.current
    var scale by remember { mutableFloatStateOf(1f) }
    var offsetX by remember { mutableFloatStateOf(0f) }
    var offsetY by remember { mutableFloatStateOf(0f) }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black)
            .clickable(onClick = onDismiss)
    ) {
        // Кнопка закрытия
        IconButton(
            onClick = onDismiss,
            modifier = Modifier
                .align(Alignment.TopEnd)
                .padding(16.dp)
                .background(Color.Black.copy(alpha = 0.5f), shape = MaterialTheme.shapes.small)
        ) {
            Icon(Icons.Default.Close, "Закрыть", tint = Color.White)
        }

        // Изображение с pinch-to-zoom
        AsyncImage(
            model = ImageRequest.Builder(context)
                .data(imageUrl)
                .crossfade(true)
                .build(),
            contentDescription = "Полноэкранный просмотр",
            modifier = Modifier
                .fillMaxSize()
                .graphicsLayer {
                    scaleX = scale
                    scaleY = scale
                    translationX = offsetX
                    translationY = offsetY
                }
                .pointerInput(Unit) {
                    detectPinchZoom { centroid, pan, zoom ->
                        scale = (scale * zoom).coerceIn(1f, 5f)
                        if (scale > 1f) {
                            offsetX += pan.x
                            offsetY += pan.y
                        } else {
                            offsetX = 0f
                            offsetY = 0f
                        }
                    }
                }
                .pointerInput(Unit) {
                    detectTapGestures(
                        onDoubleTap = {
                            if (scale > 1f) {
                                scale = 1f
                                offsetX = 0f
                                offsetY = 0f
                            } else {
                                scale = 3f
                            }
                        }
                    )
                },
            contentScale = ContentScale.Fit
        )
    }
}

/**
 * Обнаружение pinch-to-zoom жестов.
 */
private suspend fun PointerInputScope.detectPinchZoom(
    onGesture: (centroid: androidx.compose.ui.geometry.Offset, pan: androidx.compose.ui.geometry.Offset, zoom: Float) -> Unit
) {
    forEachGesture {
        awaitPointerEventScope {
            awaitFirstDown()
        }
        awaitPointerEventScope {
            var zoom = 1f
            var pan = androidx.compose.ui.geometry.Offset.Zero
            var pastTouchSlop = false
            val touchSlop = viewConfiguration.touchSlop
            var lockedToPanZoom = false

            do {
                val event = awaitPointerEvent()
                val canceled = event.changes.any { it.isConsumed }
                if (!canceled) {
                    val zoomChange = event.calculateZoom()
                    val panChange = event.calculatePan()

                    if (!pastTouchSlop) {
                        zoom *= zoomChange
                        pan += panChange
                        val centroidSize = event.calculateCentroidSize(useCurrent = false)
                        val zoomMotion = (1f - zoom) * centroidSize.toFloat()
                        val panMotion = pan.getDistance()
                        if (zoomMotion > touchSlop || panMotion > touchSlop) {
                            pastTouchSlop = true
                            lockedToPanZoom = true
                        }
                    }

                    if (pastTouchSlop) {
                        if (lockedToPanZoom) {
                            onGesture(event.calculateCentroid(useCurrent = false), panChange, zoomChange)
                            event.changes.forEach { change -> if (change.positionChanged()) change.consume() }
                        }
                    }
                }
            } while (!canceled && event.changes.any { it.pressed })
        }
    }
}

// ─── Camera helpers ─────────────────────────────────────────────

private fun doLaunchCamera(
    context: Context,
    takePhotoLauncher: androidx.activity.result.ActivityResultLauncher<Uri>,
    onFileReady: (Uri, File) -> Unit
) {
    val cacheDir = context.cacheDir
    val photoFile = File.createTempFile("camera_", ".jpg", cacheDir)
    val uri = FileProvider.getUriForFile(
        context,
        "${context.packageName}.fileprovider",
        photoFile
    )
    onFileReady(uri, photoFile)
    takePhotoLauncher.launch(uri)
}
