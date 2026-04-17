package ru.lastochka.messenger.data

import android.content.Context
import com.google.gson.Gson
import com.google.gson.GsonBuilder
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.*
import okhttp3.*
import okhttp3.EventListener
import okhttp3.Handshake
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull
import okio.BufferedSink
import ru.lastochka.messenger.data.model.*
import timber.log.Timber
import java.io.File
import java.util.*
import java.util.concurrent.TimeUnit
import kotlin.coroutines.resume
import kotlin.coroutines.suspendCoroutine
import kotlin.random.Random

/**
 * Низкоуровневый клиент Tinode: WebSocket для real-time.
 */
class TinodeHttpClient(
    private val context: Context,
    private val apiKey: String,
    private val hostName: String,
    private val appName: String,
    private val useTLS: Boolean = true
) {
    val gson: Gson = GsonBuilder()
        // НЕ включаем null поля — пустые объекты {} для sub/desc
        .registerTypeAdapter(PubContent::class.java, PubContentDeserializer)
        .registerTypeAdapter(TheCard::class.java, TheCardDeserializer)
        .create()
    private var webSocket: WebSocket? = null
    private val _connectionEvents = MutableSharedFlow<ConnectionEvent>(extraBufferCapacity = 8)

    @Volatile var authToken: String? = null
    @Volatile var myUid: String? = null
    @Volatile var isConnected = false
    @Volatile var isAuthenticated = false

    private val pendingRequests = mutableMapOf<String, (ServerMessage) -> Unit>()
    private var _eventCallback: ((ServerMessage) -> Unit)? = null
    private val scope = CoroutineScope(Dispatchers.IO + Job())

    val connectionEvents: SharedFlow<ConnectionEvent> = _connectionEvents

    fun setEventCallback(callback: (ServerMessage) -> Unit) {
        _eventCallback = callback
    }

    // ─── Connection ─────────────────────────────────────────────

    fun connect() {
        if (isConnected) return
        val scheme = if (useTLS) "wss" else "ws"
        val wsUrl = "$scheme://$hostName/v0/channels?apikey=$apiKey"
        Timber.d("Connecting to $wsUrl")
        val request = Request.Builder()
            .url(wsUrl)
            .build()

        val listener = object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) {
                isConnected = true
                scope.launch { _connectionEvents.emit(ConnectionEvent.Connected) }
            }

            override fun onMessage(webSocket: WebSocket, text: String) {
                try {
                    val msg = gson.fromJson(text, ServerMessage::class.java)
                    Timber.d("<<< RAW: ${text.take(200)}")
                    Timber.d("<<< TYPE: ${msg.type}, id=${msg.ctrl?.id ?: msg.data?.topic ?: msg.meta?.topic ?: "unknown"}")
                    when (msg.type) {
                        MsgType.CTRL -> {
                            val ctrl = msg.ctrl ?: run {
                                Timber.w("CTRL message without ctrl field: $text")
                                return
                            }
                            ctrl.id?.let { id ->
                                pendingRequests.remove(id)?.invoke(msg)
                            }
                            ctrl.params?.token?.let { token -> authToken = token }
                            ctrl.params?.user?.let { uid -> myUid = uid }
                            // ВАЖНО: НЕ ставим isAuthenticated здесь — только в login()!
                            // hi() возвращает 200, но это НЕ аутентификация
                        }
                        MsgType.DATA, MsgType.META, MsgType.PRES, MsgType.INFO -> {
                            _eventCallback?.invoke(msg)
                        }
                        else -> {}
                    }
                } catch (e: Exception) {
                    Timber.e(e, "Failed to parse WebSocket message")
                }
            }

            override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
                isConnected = false
                isAuthenticated = false
                authToken = null
                myUid = null
                scope.launch { _connectionEvents.emit(ConnectionEvent.Disconnected) }
            }

            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                val errorMsg = response?.message ?: t.message ?: "Unknown error"
                val statusCode = response?.code ?: 0
                Timber.e(t, "WebSocket onFailure: code=$statusCode, message=$errorMsg")
                isConnected = false
                isAuthenticated = false
                authToken = null
                myUid = null
                scope.launch { _connectionEvents.emit(ConnectionEvent.Error(t)) }
            }
        }

        val client = OkHttpClient.Builder()
            .pingInterval(30, TimeUnit.SECONDS)
            .eventListener(object : EventListener() {
                override fun dnsStart(call: Call, domainName: String) {
                    Timber.d("WS dnsStart: $domainName")
                }
                override fun dnsEnd(call: Call, domainName: String, inetAddressList: List<java.net.InetAddress>) {
                    Timber.d("WS dnsEnd: ${inetAddressList.map { it.hostAddress }}")
                }
                override fun connectStart(call: Call, inetSocketAddress: java.net.InetSocketAddress, proxy: java.net.Proxy) {
                    Timber.d("WS connectStart: ${inetSocketAddress.hostName}:${inetSocketAddress.port}")
                }
                override fun secureConnectStart(call: Call) {
                    Timber.d("WS secureConnectStart (TLS handshake)")
                }
                override fun secureConnectEnd(call: Call, handshake: Handshake?) {
                    Timber.d("WS secureConnectEnd: ${handshake?.tlsVersion}")
                }
                override fun connectFailed(call: Call, inetSocketAddress: java.net.InetSocketAddress, proxy: java.net.Proxy, protocol: okhttp3.Protocol?, ioe: java.io.IOException) {
                    Timber.e(ioe, "WS connectFailed: ${inetSocketAddress.hostName}:${inetSocketAddress.port}")
                }
                override fun callFailed(call: Call, ioe: java.io.IOException) {
                    Timber.e(ioe, "WS callFailed: ${ioe.message}")
                }
            })
            .build()

        webSocket = client.newWebSocket(request, listener)
    }

    fun disconnect() {
        webSocket?.close(1000, "Client disconnect")
        webSocket = null
        isConnected = false
        isAuthenticated = false
        authToken = null
        myUid = null
    }

    // ─── Messages ──────────────────────────────────────────────

    fun send(message: Any): String {
        val json = gson.toJson(message)
        Timber.d(">>> RAW: ${json.take(150)}")
        webSocket?.send(json)
        // Extract ID from the nested message structure (hi.id, acc.id, login.id, etc.)
        return extractMessageId(message)
    }

    /**
     * Отправить сообщение и ждать ответа по id (без suspend).
     */
    fun sendWithDirectCallback(message: Any, id: String) {
        pendingRequests[id] = { msg ->
            Timber.d("Direct callback received for id=$id")
        }
        val json = gson.toJson(message)
        Timber.d(">>> RAW: ${json.take(150)}")
        webSocket?.send(json)
    }

    private fun extractMessageId(message: Any): String {
        // Try to extract ID from common Tinode message structures
        val json = gson.toJsonTree(message).asJsonObject
        // Check for nested id fields: hi.id, acc.id, login.id, sub.id, pub.id, note.id, leave.id, get.id, set.id
        for (key in listOf("hi", "acc", "login", "sub", "pub", "note", "leave", "get", "set")) {
            val nested = json.get(key)
            if (nested != null && nested.isJsonObject) {
                val id = nested.asJsonObject.get("id")
                if (id != null && !id.isJsonNull) {
                    return id.asString
                }
            }
        }
        // Fallback: generate ID if not found
        return generateId()
    }

    private suspend fun sendWithCallback(message: Any): ServerMessage = suspendCancellableCoroutine { cont ->
        if (!isConnected) {
            cont.resumeWith(Result.failure(Exception("Нет подключения к серверу")))
            return@suspendCancellableCoroutine
        }
        
        val id = send(message)
        pendingRequests[id] = { msg ->
            cont.resume(msg, null)
        }
        scope.launch {
            delay(30_000)
            if (!cont.isCompleted) {
                pendingRequests.remove(id)
                cont.resumeWith(Result.failure(Exception("Сервер не отвечает. Проверьте интернет-соединение.")))
            }
        }
    }

    // ─── API methods ────────────────────────────────────────────

    suspend fun sendHi(): ServerMessage {
        val msg = ClientMsgHi(hi = HiPacket(id = generateId()))
        return sendWithCallback(msg)
    }

    /**
     * Неблокирующая отправка hi — просто отправляем JSON.
     */
    fun sendHiNonBlocking() {
        val msg = ClientMsgHi(hi = HiPacket(id = generateId()))
        send(msg)
    }

    suspend fun register(username: String, password: String, displayName: String): ServerMessage {
        val msg = ClientMsgAcc(
            acc = AccPacket(
                id = generateId(),
                user = "new",
                scheme = "basic",
                secret = base64Encode("$username:$password"),
                login = true,
                desc = DescPacket(`public` = TheCard(fn = displayName))
            )
        )
        return sendWithCallback(msg)
    }

    suspend fun registerWithFullProfile(
        username: String,
        password: String,
        displayName: String,
        email: String,
        phone: String
    ): ServerMessage {
        // НЕ отправляем tags при регистрации — сервер отклоняет 403
        // Теги можно установить позже через setMeta("me")
        val tags: List<String>? = null

        val credentials = mutableListOf<Credential>()
        if (email.isNotBlank()) {
            credentials.add(Credential(meth = "email", val_str = email, done = false))
        }

        val msg = ClientMsgAcc(
            acc = AccPacket(
                id = generateId(),
                user = "new",
                scheme = "basic",
                secret = base64Encode("$username:$password"),
                login = true,
                desc = DescPacket(`public` = TheCard(fn = displayName)),
                tags = tags,
                cred = credentials.ifEmpty { null }
            )
        )
        return sendWithCallback(msg)
    }

    suspend fun login(username: String, password: String): ServerMessage {
        val msg = ClientMsgLogin(
            login = LoginPacket(id = generateId(), scheme = "basic", secret = base64Encode("$username:$password"))
        )
        return sendWithCallback(msg)
    }

    suspend fun loginToken(token: String): ServerMessage {
        val msg = ClientMsgLogin(
            login = LoginPacket(id = generateId(), scheme = "token", secret = token)
        )
        return sendWithCallback(msg)
    }

    suspend fun subscribe(topicName: String, get: MetaGetPacket? = null): ServerMessage {
        val msg = ClientMsgSub(sub = SubPacket(id = generateId(), topic = topicName, get = get))
        return sendWithCallback(msg)
    }

    suspend fun getData(topicName: String, since: Int = 0, limit: Int = 100): ServerMessage {
        val msg = ClientMsgGet(
            get = GetPacket(
                id = generateId(),
                topic = topicName,
                data = MetaGetData(since = since, limit = limit),
                what = "data"
            )
        )
        return sendWithCallback(msg)
    }

    suspend fun getMeta(topicName: String, what: String = "desc sub"): ServerMessage {
        val msg = ClientMsgGet(get = GetPacket(id = generateId(), topic = topicName, what = what))
        // Для get запросов сервер возвращает ctrl + meta как отдельные сообщения
        // sendWithCallback дождётся ctrl, а meta придёт через event callback
        return try {
            withTimeout(10_000) {
                sendWithCallback(msg)
            }
        } catch (e: Exception) {
            // Если ctrl не пришёл (таймаут) — пробуем ещё раз
            Timber.w(e, "getMeta sendWithCallback timeout, retrying...")
            send(msg)  // Отправляем ещё раз
            delay(500) // Даём время на ответ
            ServerMessage() // Возвращаем пустой — meta придёт через callback
        }
    }

    suspend fun setMeta(topicName: String, set: MetaSetPacket): ServerMessage {
        val msg = ClientMsgSet(set = SetPacket(id = generateId(), topic = topicName, desc = set.desc, sub = set.sub))
        return sendWithCallback(msg)
    }

    fun publish(topicName: String, text: String) {
        send(ClientMsgPub(pub = PubPacket(id = generateId(), topic = topicName, content = PubContent(txt = text))))
    }

    /**
     * Отправить сообщение с Drafty контентом и extra attachments.
     */
    fun publishWithContent(topicName: String, contentJson: String, mime: String, extra: PubExtra? = null) {
        // Сериализуем вручную чтобы отправить правильный JSON
        val pubPacket = mutableMapOf<String, Any>(
            "id" to generateId(),
            "topic" to topicName,
            "head" to mapOf("mime" to mime),
            "content" to gson.fromJson(contentJson, Map::class.java)
        )
        // extra.attachments — опционально, для garbage collection на сервере
        extra?.let {
            pubPacket["extra"] = mapOf("attachments" to it.attachments)
        }
        val msg = mapOf("pub" to pubPacket)
        val json = gson.toJson(msg)
        Timber.d(">>> Pub with attachments: ${json.take(200)}...")
        webSocket?.send(json)
    }

    fun sendTyping(topicName: String) {
        send(ClientMsgNote(note = NotePacket(id = generateId(), topic = topicName, what = "kp")))
    }

    fun noteRead(topicName: String, seq: Int) {
        send(ClientMsgNote(note = NotePacket(id = generateId(), topic = topicName, what = "read", seq = seq)))
    }

    fun leave(topicName: String) {
        send(ClientMsgLeave(leave = LeavePacket(id = generateId(), topic = topicName)))
    }

    fun leaveAndUnsub(topicName: String) {
        send(ClientMsgLeave(leave = LeavePacket(id = generateId(), topic = topicName, unsub = true)))
    }

    /**
     * Смена пароля текущего пользователя.
     * Tinode: acc message с user="me" и новым secret.
     */
    suspend fun changePassword(username: String, oldPassword: String, newPassword: String): ServerMessage {
        val msg = ClientMsgAcc(
            acc = AccPacket(
                id = generateId(),
                user = "me",
                scheme = "basic",
                secret = base64Encode("$username:$newPassword"),
                login = false
            )
        )
        return sendWithCallback(msg)
    }

    /**
     * Удалить сообщение (del message).
     * Tinode: del message с hard=true для полного удаления.
     */
    suspend fun deleteMessage(topicName: String, seqId: Int): ServerMessage {
        val msg = ClientMsgDel(del = DelPacket(
            id = generateId(),
            topic = topicName,
            seq = DelSeq(first = seqId, last = seqId),
            hard = true
        ))
        return sendWithCallback(msg)
    }

    /**
     * Редактировать сообщение (pub с head.replace).
     * Tinode: pub message с head.replace = seqId оригинала.
     */
    fun editMessage(topicName: String, seqId: Int, newText: String) {
        val msg = ClientMsgPub(pub = PubPacket(
            id = generateId(),
            topic = topicName,
            content = PubContent(txt = newText),
            head = PubHead(replaces = seqId.toString())
        ))
        send(msg)
    }

    // ─── Helpers ────────────────────────────────────────────────

    private fun generateId(): String {
        val bytes = ByteArray(8)
        Random.nextBytes(bytes)
        return bytes.joinToString("") { "%02x".format(it) }
    }

    private fun base64Encode(input: String): String {
        return Base64.getEncoder().encodeToString(input.toByteArray(Charsets.UTF_8))
    }

    // ─── File Upload ─────────────────────────────────────────────

    /**
     * Загрузить файл на сервер Tinode через HTTP POST multipart.
     * Возвращает URL файла относительно /v0/file/s/.
     */
    suspend fun uploadFile(uri: android.net.Uri, mimeType: String, fileName: String): String {
        val scheme = if (useTLS) "https" else "http"
        val httpUrl = okhttp3.HttpUrl.Builder()
            .scheme(scheme)
            .host(hostName)
            .addEncodedPathSegments("v0/file/u/")
            .addQueryParameter("apikey", apiKey)
            .addQueryParameter("auth", "token")
            .addQueryParameter("secret", authToken ?: "")
            .build()
        Timber.d("Uploading file to $httpUrl, mime=$mimeType, name=$fileName")

        return uploadFileToUrl(uri, mimeType, fileName, httpUrl.toString())
    }

    /**
     * Загрузить файл с прогресс-колбэком через SDK LargeFileHelper.
     * Колбэк возвращает прогресс 0.0..1.0.
     */
    suspend fun uploadFileWithProgress(
        uri: android.net.Uri,
        mimeType: String,
        fileName: String,
        onProgress: (Float) -> Unit
    ): String {
        // Используем HttpUrl.Builder для корректного URL-encoding параметров
        val scheme = if (useTLS) "https" else "http"
        val httpUrl = okhttp3.HttpUrl.Builder()
            .scheme(scheme)
            .host(hostName)
            .addEncodedPathSegments("v0/file/u/")
            .addQueryParameter("apikey", apiKey)
            .addQueryParameter("auth", "token")
            .addQueryParameter("secret", authToken ?: "")
            .build()
        val uploadUrl = httpUrl.toString()
        Timber.d("Uploading file with progress: $uploadUrl")

        return uploadFileToUrlWithProgress(uri, mimeType, fileName, uploadUrl, onProgress)
    }

    /**
     * Загрузить файл на конкретный URL.
     */
    private suspend fun uploadFileToUrl(
        uri: android.net.Uri,
        mimeType: String,
        fileName: String,
        url: String
    ): String {
        // Читаем файл в ByteArray
        val fileBytes = context.contentResolver.openInputStream(uri)?.use { it.readBytes() }
            ?: throw Exception("Cannot read file: $uri")

        return uploadFileBytesToUrl(fileBytes, mimeType, fileName, url)
    }

    /**
     * Загрузить ByteArray на указанный URL (поддерживает редиректы).
     * Tinode требует RFC 2388 multipart/form-data.
     */
    private suspend fun uploadFileBytesToUrl(
        fileBytes: ByteArray,
        mimeType: String,
        fileName: String,
        url: String
    ): String {
        // RFC 2388 multipart/form-data — ожидаемый формат Tinode
        val multipartBody = MultipartBody.Builder()
            .setType(MultipartBody.FORM)
            .addFormDataPart("file", fileName, fileBytes.toRequestBody(mimeType.toMediaType()))
            .build()

        val request = Request.Builder()
            .url(url)
            .post(multipartBody)
            .build()

        OkHttpClient.Builder()
            .connectTimeout(30, TimeUnit.SECONDS)
            .readTimeout(60, TimeUnit.SECONDS)
            .writeTimeout(60, TimeUnit.SECONDS)
            .followRedirects(false)
            .build()
            .newCall(request).execute().use { response ->
                return when (response.code) {
                    200 -> {
                        val body = response.body?.string() ?: ""
                        Timber.d("Upload response: $body")
                        val ctrl = gson.fromJson(body, ServerMessage::class.java).ctrl
                        val fileUrl = ctrl?.params?.url
                            ?: throw Exception("No file URL in response. Response: $body")
                        normalizeFileUrl(fileUrl)
                    }
                    307, 302 -> {
                        val redirectUrl = response.header("Location")
                            ?: throw Exception("No redirect URL in ${response.code} response")
                        Timber.d("Upload redirect ${response.code} to $redirectUrl")
                        uploadFileBytesToUrl(fileBytes, mimeType, fileName, redirectUrl)
                    }
                    else -> {
                        val errorBody = response.body?.string() ?: ""
                        Timber.e("Upload failed: ${response.code} ${response.message}, body: $errorBody")
                        throw Exception("Upload failed: ${response.code} ${response.message}. Server: $errorBody")
                    }
                }
            }
    }

    /**
     * Загрузить файл с прогресс-колбэком.
     */
    private suspend fun uploadFileToUrlWithProgress(
        uri: android.net.Uri,
        mimeType: String,
        fileName: String,
        url: String,
        onProgress: (Float) -> Unit
    ): String {
        // Читаем файл в ByteArray
        val fileBytes = context.contentResolver.openInputStream(uri)?.use { it.readBytes() }
            ?: return Result.failure<String>(Exception("Cannot open file")).getOrThrow()

        // Строим multipart через OkHttp Builder (RFC 2388)
        val multipartBody = MultipartBody.Builder()
            .setType(MultipartBody.FORM)
            .addFormDataPart("file", fileName, fileBytes.toRequestBody(mimeType.toMediaType()))
            .build()

        // Буферизуем multipart body для подсчёта размера и захватываем Content-Type с boundary
        val buffer = okio.Buffer()
        multipartBody.writeTo(buffer)
        val bodyBytes = buffer.readByteArray()
        val totalBytes = bodyBytes.size.toLong()
        val contentType = multipartBody.contentType() // multipart/form-data; boundary=...

        return uploadBytesWithProgress(bodyBytes, totalBytes, contentType, url, onProgress)
    }

    /**
     * Отправить ByteArray с прогресс-колбэком (поддержка редиректов).
     * Tinode требует RFC 2388 multipart/form-data.
     */
    private suspend fun uploadBytesWithProgress(
        bodyBytes: ByteArray,
        totalBytes: Long,
        contentType: okhttp3.MediaType?,
        url: String,
        onProgress: (Float) -> Unit
    ): String = suspendCoroutine { cont ->
        val progressRequestBody = object : RequestBody() {
            override fun contentType() = contentType
            override fun contentLength() = totalBytes
            override fun writeTo(sink: okio.BufferedSink) {
                val chunkSize = 32768L // 32KB chunks
                var offset = 0L
                val total = bodyBytes.size.toLong()

                while (offset < total) {
                    val toWrite = minOf(chunkSize, total - offset)
                    sink.write(bodyBytes, offset.toInt(), toWrite.toInt())
                    offset += toWrite
                    val progress = if (totalBytes > 0) offset.toFloat() / totalBytes else 0f
                    onProgress(progress.coerceIn(0f, 0.99f))
                }
                onProgress(1f)
            }
        }

        val request = Request.Builder()
            .url(url)
            .post(progressRequestBody)
            .build()

        OkHttpClient.Builder()
            .connectTimeout(30, TimeUnit.SECONDS)
            .readTimeout(120, TimeUnit.SECONDS)
            .writeTimeout(120, TimeUnit.SECONDS)
            .followRedirects(false)
            .build()
            .newCall(request).enqueue(object : okhttp3.Callback {
                override fun onFailure(call: okhttp3.Call, e: java.io.IOException) {
                    cont.resumeWith(Result.failure(Exception("Upload failed: ${e.message}", e)))
                }

                override fun onResponse(call: okhttp3.Call, response: okhttp3.Response) {
                    response.use { resp ->
                        try {
                            when (resp.code) {
                                200 -> {
                                    val responseBody = resp.body?.string() ?: ""
                                    Timber.d("Upload response: $responseBody")
                                    val ctrl = gson.fromJson(responseBody, ServerMessage::class.java).ctrl
                                    val fileUrl = ctrl?.params?.url
                                    if (fileUrl != null) {
                                        Timber.d("File URL received: $fileUrl")
                                        cont.resumeWith(Result.success(normalizeFileUrl(fileUrl)))
                                    } else {
                                        Timber.e("No file URL in response! ctrl.params: ${ctrl?.params}")
                                        cont.resumeWith(Result.failure(Exception("No file URL in response")))
                                    }
                                }
                                301, 302, 307 -> {
                                    val location = resp.header("Location")
                                        ?: throw Exception("No redirect URL for ${resp.code}")
                                    val redirectUrl = resp.request.url.resolve(location)?.toString()
                                        ?: throw Exception("Failed to resolve redirect URL: $location")
                                    Timber.d("Upload redirect ${resp.code} → $redirectUrl")
                                    // Рекурсивно отправляем те же байты на redirect URL
                                    runBlocking {
                                        try {
                                            val result = uploadBytesWithProgress(
                                                bodyBytes, totalBytes, contentType, redirectUrl, onProgress
                                            )
                                            cont.resumeWith(Result.success(result))
                                        } catch (e: Exception) {
                                            cont.resumeWith(Result.failure(e))
                                        }
                                    }
                                }
                                else -> {
                                    val errorBody = resp.body?.string() ?: ""
                                    Timber.e("Upload failed: ${resp.code} ${resp.message}, body: $errorBody")
                                    cont.resumeWith(Result.failure(
                                        Exception("Upload failed: ${resp.code} ${resp.message}. Server: $errorBody")
                                    ))
                                }
                            }
                        } catch (e: Exception) {
                            cont.resumeWith(Result.failure(e))
                        }
                    }
                }
            })
    }

    /**
     * Нормализовать URL файла — относительный в путь /v0/file/s/...
     */
    private fun normalizeFileUrl(url: String): String {
        return when {
            url.startsWith("/v0/file/s/") -> url
            url.startsWith("./") -> "/v0/file/s/${url.substring(2)}"
            url.startsWith("http") -> {
                url.toHttpUrlOrNull()?.encodedPath ?: url
            }
            else -> "/v0/file/s/$url"
        }
    }
}

sealed class ConnectionEvent {
    data object Connected : ConnectionEvent()
    data object Disconnected : ConnectionEvent()
    data object Authenticated : ConnectionEvent()
    data class Error(val throwable: Throwable) : ConnectionEvent()
}
