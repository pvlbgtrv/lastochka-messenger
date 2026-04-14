package ru.lastochka.messenger.viewmodel

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import ru.lastochka.messenger.data.ChatRepository
import ru.lastochka.messenger.data.TinodeEvent
import ru.lastochka.messenger.data.UiMessage
import ru.lastochka.messenger.data.local.AppDatabase
import ru.lastochka.messenger.data.local.MessageEntity
import ru.lastochka.messenger.util.ImageCompressor
import timber.log.Timber
import java.util.*
import javax.inject.Inject

/**
 * Тип действия с сообщением.
 */
enum class MessageActionType {
    REPLY, COPY, EDIT, DELETE
}

/**
 * ViewModel экрана чата.
 */
@HiltViewModel
class ChatViewModel @Inject constructor(
    @ApplicationContext private val context: Context,
    private val repository: ChatRepository,
    private val database: AppDatabase,
    savedStateHandle: SavedStateHandle
) : ViewModel() {

    private val topicName: String = checkNotNull(savedStateHandle["topicName"])

    private val _messages = MutableStateFlow<List<UiMessage>>(emptyList())
    val messages: StateFlow<List<UiMessage>> = _messages.asStateFlow()

    private val _topicTitle = MutableStateFlow("")
    val topicTitle: StateFlow<String> = _topicTitle.asStateFlow()

    private val _isTyping = MutableStateFlow(false)
    val isTyping: StateFlow<Boolean> = _isTyping.asStateFlow()

    // Job для авто-скрытия typing indicator — отменяется при новом kp
    private var typingHideJob: kotlinx.coroutines.Job? = null

    private val _isLoading = MutableStateFlow(true)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error.asStateFlow()

    // State for message actions
    private val _selectedMessage = MutableStateFlow<UiMessage?>(null)
    val selectedMessage: StateFlow<UiMessage?> = _selectedMessage.asStateFlow()

    private val _replyToMessage = MutableStateFlow<UiMessage?>(null)
    val replyToMessage: StateFlow<UiMessage?> = _replyToMessage.asStateFlow()

    private val _editingMessage = MutableStateFlow<UiMessage?>(null)
    val editingMessage: StateFlow<UiMessage?> = _editingMessage.asStateFlow()

    init {
        loadTopic()
        loadMessages()
        listenForMessages()
    }

    private fun loadTopic() {
        viewModelScope.launch {
            _topicTitle.value = repository.getTopicTitle(topicName)
        }
    }

    private fun loadMessages() {
        viewModelScope.launch {
            _isLoading.value = true
            try {
                repository.subscribeTopic(topicName)

                database.messageDao().getMessagesForTopic(topicName).collect { entities ->
                    _messages.value = entities.map { entity ->
                        UiMessage(
                            seqId = entity.seqId,
                            from = entity.from,
                            senderName = entity.senderName,
                            content = entity.content,
                            timestamp = Date(entity.timestamp),
                            isOwn = entity.isOwn,
                            isRead = entity.isRead,
                            isEdited = entity.isEdited,
                            hasAttachment = entity.hasAttachment,
                            attachmentUrl = entity.attachmentUrl,
                            replyToContent = entity.replyToContent
                        )
                    }
                    _isLoading.value = false
                }
            } catch (e: Exception) {
                _error.value = e.message
                _isLoading.value = false
            }
        }
    }

    private fun listenForMessages() {
        viewModelScope.launch {
            repository.events.collect { event ->
                when (event) {
                    is TinodeEvent.NewMessage -> {
                        val data = event.data
                        if (data.topic == topicName) {
                            // Эхо своего сообщения — обновляем локальную запись с tempSeqId на реальный seqId
                            val myUid = repository.myUid
                            if (data.from == myUid) {
                                // Эхо своего сообщения — просто пропускаем.
                                // Для текстовых сообщений: Room уже получил его из listenForMessages → saveMessageFromServer.
                                // Для изображений: URL уже сохранён в upload-функции через updateAttachmentFull(tempSeqId, ...).
                                // updateLastOwnAttachmentUrl УДАЛЁН — он обновлял ВСЕ сообщения с seqId < 0,
                                // заменяя разные картинки одной и той же (баг #2).
                                return@collect
                            }
                            saveMessageFromServer(data)
                            repository.markAsRead(topicName, data.seq)
                        }
                    }
                    is TinodeEvent.Info -> {
                        val info = event.data
                        if (info.topic == topicName && info.what == "kp") {
                            _isTyping.value = true
                            // Отменяем предыдущий таймер скрытия
                            typingHideJob?.cancel()
                            typingHideJob = viewModelScope.launch {
                                kotlinx.coroutines.delay(3000)
                                _isTyping.value = false
                            }
                        }
                    }
                    else -> {}
                }
            }
        }
    }

    private suspend fun saveMessageFromServer(data: ru.lastochka.messenger.data.model.DataPacket) {
        val content = data.content?.txt ?: ""

        // Проверяем есть ли вложения (Drafty format)
        var hasAttachment = false
        var attachmentUrl: String? = null
        var attachmentType: String? = null
        var attachmentBase64: String? = null

        val entities = data.content?.ent
        if (!entities.isNullOrEmpty()) {
            val firstEntity = entities.firstOrNull()
            val entityData = firstEntity?.`data`
            attachmentUrl = entityData?.ref
            attachmentType = entityData?.mime

            // Case 1: ref (URL from server upload)
            if (attachmentUrl != null) {
                hasAttachment = true
            }
            // Case 2: val (inline base64 — from web client)
            else if (entityData?.val_str != null) {
                val mime = entityData.mime ?: "image/jpeg"
                attachmentUrl = "data:${mime};base64,${entityData.val_str}"
                attachmentBase64 = attachmentUrl
                hasAttachment = true
            }
        }

        // Проверим extra attachments
        if (!hasAttachment) {
            val extraUrls = data.extra?.attachments
            if (!extraUrls.isNullOrEmpty()) {
                attachmentUrl = extraUrls.first()
                attachmentType = "image/jpeg"
                hasAttachment = true
            }
        }

        // Определяем sender name
        val senderName = if (data.from == repository.myUid) {
            "Я"
        } else {
            data.from ?: ""
        }

        val entity = MessageEntity(
            seqId = data.seq,
            topicName = topicName,
            from = data.from ?: "",
            senderName = senderName,
            content = if (hasAttachment && content == " ") "" else content,
            rawContent = content,
            timestamp = data.ts?.let { parseTimestamp(it) } ?: System.currentTimeMillis(),
            isOwn = data.from == repository.myUid,
            isRead = true,
            isEdited = false,
            hasAttachment = hasAttachment,
            attachmentType = attachmentType,
            attachmentUrl = attachmentUrl
        )
        database.messageDao().insertMessage(entity)
    }

    // ─── Message Actions ────────────────────────────────────────────

    fun onMessageLongClick(message: UiMessage) {
        _selectedMessage.value = message
    }

    fun dismissActionMenu() {
        _selectedMessage.value = null
    }

    fun executeAction(action: MessageActionType) {
        val msg = _selectedMessage.value ?: return
        when (action) {
            MessageActionType.COPY -> copyMessage(msg)
            MessageActionType.REPLY -> replyToMessage(msg)
            MessageActionType.EDIT -> editMessage(msg)
            MessageActionType.DELETE -> deleteMessage(msg)
        }
        _selectedMessage.value = null
    }

    private fun copyMessage(message: UiMessage) {
        val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
        val clip = ClipData.newPlainText("message", message.content)
        clipboard.setPrimaryClip(clip)
    }

    private fun replyToMessage(message: UiMessage) {
        _replyToMessage.value = message
    }

    fun replyToMessageExternally(message: UiMessage) {
        _replyToMessage.value = message
    }

    fun clearReply() {
        _replyToMessage.value = null
    }

    private fun editMessage(message: UiMessage) {
        if (message.isOwn) {
            _editingMessage.value = message
        }
    }

    fun clearEdit() {
        _editingMessage.value = null
    }

    /**
     * Отредактировать сообщение.
     */
    fun editMessage(seqId: Int, newText: String) {
        viewModelScope.launch {
            try {
                repository.editMessage(topicName, seqId, newText)
                // Обновить локально
                database.messageDao().updateMessageContent(seqId, newText, isEdited = true)
                _editingMessage.value = null
            } catch (e: Exception) {
                _error.value = "Ошибка редактирования: ${e.message}"
            }
        }
    }

    private fun deleteMessage(message: UiMessage) {
        if (!message.isOwn) return
        viewModelScope.launch {
            try {
                // Удалить с сервера
                val result = repository.deleteMessage(topicName, message.seqId)
                if (result.isSuccess) {
                    // Удалить из локальной БД
                    database.messageDao().deleteMessageBySeqId(message.seqId)
                } else {
                    _error.value = "Ошибка удаления: ${result.exceptionOrNull()?.message}"
                }
            } catch (e: Exception) {
                _error.value = "Ошибка удаления: ${e.message}"
            }
        }
    }

    // ─── Pagination ────────────────────────────────────────────

    /**
     * Загрузить больше сообщений (при скролле вверх).
     * Сервер отправляет DATA сообщения → event flow → listenForMessages → Room.
     */
    fun loadMoreMessages() {
        viewModelScope.launch {
            val currentMessages = _messages.value
            if (currentMessages.isEmpty()) return@launch

            val minSeq = currentMessages.minOfOrNull { it.seqId } ?: return@launch
            repository.loadMessagesBefore(topicName, minSeq, limit = 50)
        }
    }

    fun sendMessage(text: String) {
        if (text.isBlank()) return
        viewModelScope.launch {
            try {
                repository.sendTextMessage(topicName, text)

                val tempId = -(System.currentTimeMillis() % 100000).toInt()
                val entity = MessageEntity(
                    seqId = tempId,
                    topicName = topicName,
                    from = "me",
                    senderName = "",
                    content = text,
                    rawContent = text,
                    timestamp = System.currentTimeMillis(),
                    isOwn = true,
                    isRead = false,
                    isEdited = false,
                    hasAttachment = false,
                    attachmentType = null,
                    attachmentUrl = null,
                    replyToSeq = _replyToMessage.value?.seqId,
                    replyToContent = _replyToMessage.value?.content
                )
                database.messageDao().insertMessage(entity)
                
                // Clear reply state
                _replyToMessage.value = null
            } catch (e: Exception) {
                _error.value = e.message
            }
        }
    }

    // State for image sending
    private val _isSendingImage = MutableStateFlow(false)
    val isSendingImage: StateFlow<Boolean> = _isSendingImage.asStateFlow()

    // Progress 0.0..1.0
    private val _imageUploadProgress = MutableStateFlow(0f)
    val imageUploadProgress: StateFlow<Float> = _imageUploadProgress.asStateFlow()

    fun sendImageMessage(
        imageUri: android.net.Uri,
        mimeType: String,
        fileName: String,
        caption: String = ""
    ) {
        viewModelScope.launch {
            // Определяем размер файла заранее для optimistic update
            val fileSize = try {
                context.contentResolver.openAssetFileDescriptor(imageUri, "r")?.length ?: 0L
            } catch (e: Exception) { 0L }

            // Текст для отобра в UI: caption или "[Изображение]"
            val displayText = if (caption.isNotBlank()) caption else ""

            // Optimistic update: сохраняем локальное сообщение ДО отправки
            val tempSeqId = -(System.currentTimeMillis() % 100000).toInt()
            val replyTo = _replyToMessage.value
            val localEntity = MessageEntity(
                seqId = tempSeqId,
                topicName = topicName,
                from = "me",
                senderName = "",
                content = displayText,
                rawContent = displayText,
                timestamp = System.currentTimeMillis(),
                isOwn = true,
                isRead = false,
                isEdited = false,
                hasAttachment = true,
                attachmentType = mimeType,
                attachmentUrl = null, // будет обновлено после успешной отправки
                replyToSeq = replyTo?.seqId,
                replyToContent = replyTo?.content
            )
            database.messageDao().insertMessage(localEntity)
            _replyToMessage.value = null

            try {
                _isSendingImage.value = true
                _imageUploadProgress.value = 0f

                // 1. Compress image (если нужно)
                val compressed = ImageCompressor.compressImage(context, imageUri)
                val compressedUri = android.net.Uri.fromFile(compressed.file)
                val effectiveMimeType = compressed.mimeType
                val effectiveFileName = if (effectiveMimeType == "image/jpeg")
                    fileName.substringBeforeLast('.') + ".jpg" else fileName

                if (compressed.wasCompressed) {
                    Timber.d(
                        "Image compressed: ${compressed.originalSize} → ${compressed.compressedSize} " +
                            "(${compressed.compressionPercent}% saved)"
                    )
                }

                // 2. Send with progress — передаём размер сжатого файла
                val result = repository.sendImageMessageWithProgress(
                    topicName, compressedUri, effectiveMimeType,
                    effectiveFileName, displayText,
                    compressed.compressedSize
                ) { progress ->
                    _imageUploadProgress.value = progress
                }

                // 3. Clean up temp file
                compressed.file.delete()

                if (result.isSuccess) {
                    val serverUrl = result.getOrNull()
                    Timber.d("Image upload success: serverUrl=$serverUrl")
                    if (serverUrl != null) {
                        // Обновить локальное сообщение: проставить реальный URL файла
                        // Используем updateAttachmentFull чтобы гарантированно обновить все поля
                        database.messageDao().updateAttachmentFull(tempSeqId, serverUrl, mimeType)
                        Timber.d("Updated attachment for seqId=$tempSeqId to $serverUrl (type=$mimeType)")
                    }
                } else {
                    _error.value = "Ошибка отправки изображения: ${result.exceptionOrNull()?.message}"
                    Timber.e(result.exceptionOrNull(), "Image upload failed")
                }
            } catch (e: Exception) {
                _error.value = "Ошибка: ${e.message}"
                Timber.e(e, "sendImageMessage failed")
            } finally {
                _isSendingImage.value = false
                _imageUploadProgress.value = 0f
            }
        }
    }

    fun sendTyping() {
        repository.sendTyping(topicName)
    }

    fun markAllRead() {
        viewModelScope.launch {
            val maxSeq = database.messageDao().getMaxSeq(topicName)
            if (maxSeq != null) {
                repository.markAsRead(topicName, maxSeq)
                database.messageDao().markAllRead(topicName)
            }
        }
    }

    fun clearError() {
        _error.value = null
    }

    private fun parseTimestamp(ts: String): Long {
        return try {
            val format = java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", java.util.Locale.US)
            format.timeZone = java.util.TimeZone.getTimeZone("UTC")
            format.parse(ts)?.time ?: System.currentTimeMillis()
        } catch (e: Exception) {
            System.currentTimeMillis()
        }
    }
}
