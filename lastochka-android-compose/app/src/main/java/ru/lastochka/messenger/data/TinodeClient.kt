package ru.lastochka.messenger.data

import android.content.Context
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import ru.lastochka.messenger.data.model.*
import timber.log.Timber
import okhttp3.HttpUrl
import java.util.*
import java.util.concurrent.ConcurrentHashMap
import kotlin.coroutines.resume
import kotlin.coroutines.suspendCoroutine

class TinodeClient(
    private val context: Context,
    appName: String,
    private val apiKey: String,
    private val hostName: String,
    private val useTLS: Boolean
) {
    private val prefs = context.getSharedPreferences("tinode_prefs", Context.MODE_PRIVATE)
    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private val httpClient = TinodeHttpClient(context, apiKey, hostName, appName, useTLS)

    /** Получить base URL для загрузки файлов */
    fun getFileBaseUrl(): String {
        val scheme = if (useTLS) "https" else "http"
        return "$scheme://$hostName"
    }

    /** Имя хоста сервера (для проверки URL в interceptor) */
    val serverHostName: String
        get() = hostName

    /** Построить URL для скачивания файла.
     * Возвращает ТОЛЬКО путь файла (без auth-параметров).
     * Авторизация добавляется через OkHttp Interceptor в ImageLoader.
     */
    fun buildFileDownloadUrl(fileUrl: String): String {
        if (fileUrl.startsWith("http")) return fileUrl
        val baseUrl = getFileBaseUrl()
        return "$baseUrl$fileUrl"
    }

    /** Получить API key для заголовков HTTP запросов */
    fun getApiKey(): String = apiKey

    /** Получить токен авторизации для заголовков HTTP запросов */
    fun getAuthToken(): String? {
        return httpClient.authToken ?: prefs.getString("auth_token", null)
    }

    private val _events = MutableSharedFlow<TinodeEvent>(extraBufferCapacity = 128)
    val events: SharedFlow<TinodeEvent> = _events

    // Connection state — StateFlow вместо callback-паттерна
    private val _connectionState = MutableStateFlow<TinodeConnState>(TinodeConnState.Disconnected)
    val connectionState: StateFlow<TinodeConnState> = _connectionState.asStateFlow()

    private var currentTopicName: String? = null
    var myUid: String? = null
        private set

    // StateFlow для myUid
    private val _myUid = MutableStateFlow<String?>(null)
    val myUidFlow: StateFlow<String?> = _myUid.asStateFlow()

    // Блокировка автологина при ручном входе
    @Volatile
    private var manualLoginInProgress = false

    // Deferred для me-topic subscriptions
    private var meSubsDeferred: CompletableDeferred<List<MetaSub>>? = null
    private val meSubsMutex = Mutex()
    private val connectMutex = Mutex()

    // Deferreds для получения участников топика (группы)
    private val topicMemberDeferreds = ConcurrentHashMap<String, CompletableDeferred<List<ContactInfo>>>()

    init {
        // Restore myUid from prefs и инициализируем StateFlow
        val savedUid = prefs.getString("my_uid", null)
        myUid = savedUid
        _myUid.value = savedUid

        httpClient.setEventCallback { msg ->
            scope.launch {
                when (msg.type) {
                    MsgType.DATA -> msg.data?.let { _events.emit(TinodeEvent.NewMessage(it)) }
                    MsgType.PRES -> msg.pres?.let { _events.emit(TinodeEvent.Presence(it)) }
                    MsgType.INFO -> msg.info?.let { _events.emit(TinodeEvent.Info(it)) }
                    MsgType.META -> {
                        msg.meta?.let { meta ->
                            Timber.d("META received: topic='${meta.topic}', desc=${meta.desc != null}, sub=${meta.sub?.size ?: 0}, pub=${meta.`public` != null}")
                            if (meta.topic == "fnd") {
                                processFndResults(meta)
                            }
                            // Обрабатываем meta для me-топика
                            meSubsMutex.withLock {
                                val currentDeferred = meSubsDeferred
                                if (meta.topic == "me" && currentDeferred?.isActive == true) {
                                    val subs = meta.sub ?: emptyList()
                                    Timber.d("META for 'me': ${subs.size} subs, completing deferred")
                                    currentDeferred.complete(subs)
                                    meSubsDeferred = null
                                }
                            }
                            // Обрабатываем участников группы
                            meta.topic?.let { t ->
                                val memberDeferred = topicMemberDeferreds[t]
                                if (memberDeferred?.isActive == true && !meta.sub.isNullOrEmpty()) {
                                    val members = meta.sub.mapNotNull { s ->
                                        val uid = s.user ?: return@mapNotNull null
                                        ContactInfo(
                                            topicName = uid,
                                            displayName = s.`public`?.fn ?: uid,
                                            avatar = s.`public`?.photo,
                                            isGroup = false,
                                            muted = s.acs?.want?.contains("N") == true
                                        )
                                    }
                                    if (members.isNotEmpty()) {
                                        Timber.d("META for group '$t': ${members.size} members")
                                        memberDeferred.complete(members)
                                    }
                                }
                            }
                            _events.emit(TinodeEvent.Meta(meta))
                        }
                    }
                    MsgType.CTRL -> msg.ctrl?.let { _events.emit(TinodeEvent.Control(it)) }
                    else -> {}
                }
            }
        }
        // Restore myUid from prefs
        myUid = prefs.getString("my_uid", null)
    }

    suspend fun connect() {
        // ВАЖНО: обработчик запускаем ДО mutex, чтобы не пропустить событие Connected
        // (SharedFlow не реплейзит события новым коллекторам)
        ensureConnectionHandler()
        
        // Запускаем подключение через mutex чтобы избежать дублирования
        connectMutex.withLock {
            if (httpClient.isConnected) {
                Timber.d("Already connected, skipping connect()")
                return@withLock
            }
            Timber.d("Connecting to Tinode server...")
            httpClient.connect()
        }
    }

    // Отдельный поток для обработки событий соединения
    private var connectionHandlerStarted = false
    private fun ensureConnectionHandler() {
        if (connectionHandlerStarted) return
        connectionHandlerStarted = true
        scope.launch {
            httpClient.connectionEvents.collect { event ->
                when (event) {
                    is ConnectionEvent.Connected -> {
                        Timber.d("WebSocket connected")
                        // sendHi() — неблокирующе (просто отправляем JSON)
                        sendHiAsync()
                        httpClient.isAuthenticated = false
                        _connectionState.value = TinodeConnState.Connected
                        // Автологин — только если есть сохранённый токен
                        // И НЕ если manualLoginInProgress (пользователь входит вручную)
                        if (!manualLoginInProgress) {
                            launch { autoLoginInternal() }
                        }
                    }
                    is ConnectionEvent.Disconnected -> {
                        Timber.d("WebSocket disconnected")
                        _connectionState.value = TinodeConnState.Disconnected
                    }
                    is ConnectionEvent.Authenticated -> {
                        Timber.d("WebSocket authenticated")
                        _connectionState.value = TinodeConnState.Authenticated
                    }
                    is ConnectionEvent.Error -> {
                        Timber.e("WebSocket connection error")
                        _connectionState.value = TinodeConnState.Error
                    }
                }
            }
        }
    }

    /**
     * Неблокирующая отправка hi — просто отправляем JSON без ожидания ответа.
     */
    private fun sendHiAsync() {
        try {
            httpClient.sendHiNonBlocking()
        } catch (e: Exception) {
            // Игнорируем — ответ придёт позже
        }
    }

    /**
     * Дождаться подключения (макс. 5 секунд).
     * НЕ вызывает connect() — только ждёт.
     */
    private suspend fun awaitConnection(): Boolean {
        if (_connectionState.value == TinodeConnState.Connected ||
            _connectionState.value == TinodeConnState.Authenticated) return true

        // Если был в Error — сбрасываем и просим вызывающего переподключиться
        if (_connectionState.value == TinodeConnState.Error) {
            Timber.d("awaitConnection: in Error state, resetting")
            httpClient.disconnect()
            _connectionState.value = TinodeConnState.Disconnected
        }

        // НЕ вызываем connect() — только ждём
        // Ждём пока подключение установится (макс 5 сек)
        val startTime = System.currentTimeMillis()
        while (System.currentTimeMillis() - startTime < 5000) {
            val state = _connectionState.value
            if (state == TinodeConnState.Connected || state == TinodeConnState.Authenticated) {
                Timber.d("awaitConnection: connection established, state=$state")
                return true
            }
            if (state == TinodeConnState.Error) {
                Timber.e("awaitConnection: entered Error state")
                return false
            }
            delay(100)
        }
        Timber.w("awaitConnection: timeout after 5 seconds, state=${_connectionState.value}")
        return false
    }

    private suspend fun autoLoginInternal() {
        // Не делаем автологин если пользователь входит вручную
        if (manualLoginInProgress) {
            Timber.d("autoLoginInternal: skipped, manual login in progress")
            return
        }
        // Не делаем автологин если уже авторизованы (чтобы не сбить сессию)
        if (httpClient.isAuthenticated) {
            Timber.d("autoLoginInternal: skipped, already authenticated")
            return
        }

        Timber.d("autoLoginInternal: attempting auto-login")
        val token = prefs.getString("auth_token", null)
        val uid = prefs.getString("my_uid", null)
        if (token != null && uid != null) {
            try {
                withTimeout(5000) {
                    val r = httpClient.loginToken(token)
                    if (r.ctrl?.code in 200..299) {
                        httpClient.authToken = token
                        httpClient.myUid = uid
                        httpClient.isAuthenticated = true
                        myUid = uid
                        _myUid.value = uid
                        _connectionState.value = TinodeConnState.Authenticated
                        Timber.d("autoLoginInternal: success, uid=$uid")
                    } else {
                        Timber.w("autoLoginInternal: failed, code=${r.ctrl?.code}")
                    }
                    // Если токен не подошёл — НЕ очищаем (можем сбить ручной логин)
                }
            } catch (e: Exception) {
                Timber.e(e, "autoLoginInternal: exception")
                // НЕ очищаем — можем сбить ручной логин
            }
        } else {
            Timber.d("autoLoginInternal: no saved token/uid")
        }
    }

    // ─── Auth ────────────────────────────────────────────────────

    suspend fun login(username: String, password: String): Result<Unit> {
        manualLoginInProgress = true
        try {
            // Если УЖЕ авторизованы — не логинимся заново
            if (_connectionState.value == TinodeConnState.Authenticated && httpClient.isAuthenticated) {
                myUid = httpClient.myUid ?: username
                _myUid.value = this@TinodeClient.myUid
                return Result.success(Unit)
            }
            // Подключаемся если ещё не подключены
            connect()
            if (!awaitConnection()) return Result.failure(Exception("Нет подключения к серверу. Проверьте интернет-соединение."))
            return try {
                withTimeout(10_000) {
                    val r = httpClient.login(username, password)
                    if (r.ctrl?.code == 200) {
                        httpClient.isAuthenticated = true
                        saveAuth(httpClient.authToken, httpClient.myUid)
                        myUid = httpClient.myUid ?: username
                        _myUid.value = this@TinodeClient.myUid
                        _connectionState.value = TinodeConnState.Authenticated
                        Result.success(Unit)
                    } else Result.failure(Exception(r.ctrl?.text ?: "Ошибка входа"))
                }
            } catch (e: TimeoutCancellationException) {
                Result.failure(Exception("Сервер не отвечает. Попробуйте снова."))
            } catch (e: Exception) { Result.failure(e) }
        } finally {
            manualLoginInProgress = false
        }
    }

    suspend fun register(username: String, password: String, displayName: String): Result<Unit> {
        connect()
        if (!awaitConnection()) return Result.failure(Exception("Нет подключения к серверу. Проверьте интернет-соединение."))
        return try {
            withTimeout(10_000) {
                val r = httpClient.register(username, password, displayName)
                if (r.ctrl?.code in 200..299) {
                    saveAuth(httpClient.authToken, httpClient.myUid)
                    myUid = httpClient.myUid ?: username
                    _myUid.value = this@TinodeClient.myUid
                    _connectionState.value = TinodeConnState.Authenticated
                    Result.success(Unit)
                } else Result.failure(Exception(r.ctrl?.text ?: "Ошибка регистрации"))
            }
        } catch (e: TimeoutCancellationException) {
            Result.failure(Exception("Сервер не отвечает. Попробуйте снова."))
        } catch (e: Exception) { Result.failure(e) }
    }

    suspend fun registerWithFullProfile(
        username: String, password: String, displayName: String,
        email: String, phone: String
    ): Result<Unit> {
        connect()
        if (!awaitConnection()) return Result.failure(Exception("Нет подключения к серверу. Проверьте интернет-соединение."))
        return try {
            withTimeout(10_000) {
                val r = httpClient.registerWithFullProfile(username, password, displayName, email, phone)
                if (r.ctrl?.code in 200..299) {
                    saveAuth(httpClient.authToken, httpClient.myUid)
                    myUid = httpClient.myUid ?: username
                    _myUid.value = this@TinodeClient.myUid
                    _connectionState.value = TinodeConnState.Authenticated
                    Result.success(Unit)
                } else Result.failure(Exception(r.ctrl?.text ?: "Ошибка регистрации"))
            }
        } catch (e: TimeoutCancellationException) {
            Result.failure(Exception("Сервер не отвечает. Попробуйте снова."))
        } catch (e: Exception) { Result.failure(e) }
    }

    fun logout() {
        currentTopicName?.let { httpClient.leave(it) }
        currentTopicName = null
        // Полный сброс auth-состояния HTTP клиента
        httpClient.authToken = null
        httpClient.myUid = null
        httpClient.isAuthenticated = false
        // Очистка локальных prefs
        clearAuth()
        myUid = null
        _myUid.value = null
        httpClient.disconnect()
        _connectionState.value = TinodeConnState.Disconnected
    }

    suspend fun autoLogin(): Result<Unit> {
        // Подключаемся если ещё не подключены
        connectMutex.withLock {
            if (!httpClient.isConnected) {
                Timber.d("autoLogin: connecting...")
                httpClient.connect()
                ensureConnectionHandler()
            }
        }
        
        // Ждём пока подключение установится
        if (!awaitConnection()) {
            Timber.w("autoLogin: awaitConnection returned false")
            return Result.failure(Exception("Нет подключения к серверу"))
        }

        return try {
            val token = prefs.getString("auth_token", null)
            if (token != null) {
                val r = httpClient.loginToken(token)
                if (r.ctrl?.code in 200..299) {
                    saveAuth(httpClient.authToken, httpClient.myUid)
                    myUid = httpClient.myUid
                    _myUid.value = httpClient.myUid
                    _connectionState.value = TinodeConnState.Authenticated
                    Result.success(Unit)
                } else { clearAuth(); Result.failure(Exception("Token auth failed")) }
            } else Result.failure(Exception("No saved token"))
        } catch (e: Exception) { Result.failure(e) }
    }

    // ─── Me Topic (contacts) ────────────────────────────────────

    /**
     * Получить список подписок (контактов) из me-топика.
     */
    suspend fun getMeTopic(): List<MetaSub> {
        Timber.d("getMeTopic: calling awaitConnection()")
        if (!awaitConnection()) {
            Timber.w("getMeTopic: awaitConnection returned false")
            return emptyList()
        }

        // Быстрая проверка — если уже есть pending запрос, ждём его
        val existingDeferred = meSubsMutex.withLock {
            meSubsDeferred.takeIf { it?.isActive == true }
        }
        if (existingDeferred != null) {
            Timber.d("getMeTopic: pending request exists, waiting for it")
            return try {
                withTimeout(10_000) { existingDeferred.await() }
            } catch (e: Exception) {
                Timber.e(e, "getMeTopic: wait timeout")
                meSubsMutex.withLock { meSubsDeferred = null }
                emptyList()
            }
        }

        Timber.d("getMeTopic: creating new deferred and subscribing")
        val deferred = CompletableDeferred<List<MetaSub>>()
        meSubsMutex.withLock {
            meSubsDeferred = deferred
        }

        // 1. Подписываемся на me (если ещё не подписаны)
        httpClient.subscribe("me", null)
        Timber.d("getMeTopic: subscribe sent")

        // Даём серверу время обработать subscribe
        delay(500)

        // 2. Запрашиваем подписки через getMeta
        val subId = generateId()
        val getMetaSub = ClientMsgGet(get = GetPacket(
            id = subId,
            topic = "me",
            what = "sub"
        ))
        httpClient.sendWithDirectCallback(getMetaSub, subId)
        Timber.d("getMeTopic: getMeta sent, id=$subId")

        // Ждём meta СНАРУЖИ мьютекса — callback сможет его захватить
        return try {
            val subs = withTimeout(10_000) {
                deferred.await()
            }
            Timber.d("getMeTopic: got ${subs.size} subs")
            subs
        } catch (e: Exception) {
            Timber.e(e, "getMeTopic: timeout/exception")
            meSubsMutex.withLock { meSubsDeferred = null }
            emptyList()
        }
    }

    /**
     * Преобразовать подписки в список контактов для UI.
     */
    fun getContacts(subs: List<MetaSub>): List<ContactInfo> =
        subs.filter { it.topic != null && it.topic != "me" && it.topic?.startsWith("chn") != true }.mapNotNull { s ->
            val tn = s.topic ?: return@mapNotNull null
            val isGroup = tn.startsWith("grp") || tn.startsWith("nch")
            ContactInfo(
                topicName = tn,
                displayName = s.`public`?.fn ?: tn,
                avatar = s.`public`?.photo,
                lastMessage = null,
                timestamp = s.lastSeen?.recv?.let { Date(it) },
                unread = s.unread,
                isGroup = isGroup,
                muted = s.acs?.want?.contains("N") == true,
                pinned = false
            )
        }

    // ─── Search (FND topic) ─────────────────────────────────────

    private var fndDeferred: CompletableDeferred<List<ContactInfo>>? = null
    private val fndMutex = Mutex()
    // Флаг: true — ожидаем результаты после setMeta, false — игнорируем meta от подписки
    @Volatile private var fndResultsRequested = false

    /**
     * Определить тег поиска FND по запросу.
     * Телефон (начинается с +7/8/7 и 10-11 цифр) → "tel:79991234567"
     * Иначе → "basic:<query>"
     */
    private fun buildFndTag(query: String): String {
        val digits = query.replace("[^\\d]".toRegex(), "")
        val looksLikePhone = digits.length >= 10 &&
            (query.trimStart().startsWith("+") || query.trimStart().first().isDigit())
        if (looksLikePhone) {
            val normalized = when {
                digits.startsWith("8") && digits.length == 11 -> "7" + digits.drop(1)
                digits.startsWith("7") && digits.length == 11 -> digits
                digits.length == 10 -> "7$digits"
                else -> digits
            }
            return "tel:$normalized"
        }
        return "basic:$query"
    }

    /**
     * Поиск пользователей по логину, имени или телефону через FND-топик.
     * Поддерживает форматы: +79991234567, 89991234567, 79991234567, имя, логин.
     */
    suspend fun searchUsers(query: String): List<ContactInfo> {
        if (!awaitConnection()) return emptyList()
        if (query.length < 2) return emptyList()

        return fndMutex.withLock {
            fndResultsRequested = false
            try {
                val deferred = CompletableDeferred<List<ContactInfo>>()
                fndDeferred = deferred

                // Подписываемся на fnd topic (или переподписываемся, если уже подписаны)
                val r = httpClient.subscribe("fnd", MetaGetPacket(
                    desc = MetaGetDesc(),
                    sub = MetaGetSub()
                ))
                if (r.ctrl?.code !in 200..299) {
                    fndDeferred = null
                    return@withLock emptyList<ContactInfo>()
                }

                val tag = buildFndTag(query)
                Timber.d("searchUsers: query='$query', tag='$tag'")

                // Устанавливаем поисковый запрос. После этого сервер пришлёт META с результатами.
                fndResultsRequested = true
                httpClient.setMeta("fnd", MetaSetPacket(
                    desc = MetaSetDesc(tags = listOf(tag))
                ))

                // Ждём результат с таймаутом
                withTimeout(6000) { deferred.await() }
            } catch (e: TimeoutCancellationException) {
                Timber.w("searchUsers: timeout for query='$query'")
                fndDeferred = null
                emptyList()
            } catch (e: Exception) {
                Timber.e(e, "searchUsers: error")
                fndDeferred = null
                emptyList()
            } finally {
                fndResultsRequested = false
                fndDeferred = null
            }
        }
    }

    /**
     * Обработать результаты поиска из META события FND-топика.
     * Вызывается из event callback при получении META от FND.
     */
    fun processFndResults(meta: MetaPacket?) {
        // Игнорируем META от подписки на fnd — ждём только ответ на setMeta с тегами
        if (!fndResultsRequested) return

        val results = meta?.sub?.mapNotNull { s ->
            val tn = s.topic ?: s.user ?: return@mapNotNull null
            if (tn != "me" && tn != "fnd") {
                ContactInfo(
                    topicName = tn,
                    displayName = s.`public`?.fn ?: s.user ?: tn,
                    avatar = s.`public`?.photo,
                    isGroup = tn.startsWith("grp") || tn.startsWith("nch")
                )
            } else null
        } ?: emptyList()

        Timber.d("processFndResults: ${results.size} results")
        fndDeferred?.complete(results)
    }

    /**
     * Создать P2P чат с пользователем.
     */
    suspend fun startChatWithUser(topicName: String): Result<Unit> {
        return subscribeTopic(topicName)
    }

    /**
     * Загрузить сообщения старше указанного seqId.
     * Возвращает список DataPacket для сохранения в Room.
     */
    suspend fun loadMessagesBefore(topicName: String, beforeSeq: Int, limit: Int): List<DataPacket> {
        if (!awaitConnection()) return emptyList()
        return try {
            // Запрашиваем данные у сервера
            val response = httpClient.getData(topicName, since = 0, limit = limit)
            // Tinode возвращает meta с данными, но для getData ответ — это meta
            // Сообщения приходят через DATA события в event flow
            // Поэтому просто возвращаем пустой список — сообщения добавятся через listenForMessages
            emptyList()
        } catch (e: Exception) {
            emptyList()
        }
    }

    // ─── Topic operations ───────────────────────────────────────

    suspend fun subscribeTopic(topicName: String): Result<Unit> {
        currentTopicName?.let { httpClient.leave(it) }
        currentTopicName = topicName
        return try {
            val r = httpClient.subscribe(topicName, MetaGetPacket(
                desc = MetaGetDesc(),
                sub = MetaGetSub(),
                data = MetaGetData(0, 50)
            ))
            if (r.ctrl?.code in 200..299) Result.success(Unit)
            else Result.failure(Exception(r.ctrl?.text ?: "Subscribe failed"))
        } catch (e: Exception) { Result.failure(e) }
    }

    suspend fun getTopicTitle(topicName: String): String {
        if (!awaitConnection()) return topicName
        return try {
            val r = httpClient.getMeta(topicName, "desc")
            r.meta?.`public`?.fn ?: topicName
        } catch (e: Exception) { topicName }
    }

    suspend fun loadMoreMessages(topicName: String, sinceSeq: Int): List<DataPacket> {
        return try {
            httpClient.getData(topicName, since = sinceSeq, limit = 50)
            emptyList()
        } catch (e: Exception) { emptyList() }
    }

    // ─── Messaging ──────────────────────────────────────────────

    fun sendTextMessage(topicName: String, text: String) {
        httpClient.publish(topicName, text)
    }

    /**
     * Отправить сообщение с изображением.
     * 1. Загружает файл на сервер
     * 2. Отправляет pub с Drafty-форматом
     */
    suspend fun sendImageMessage(
        topicName: String,
        imageUri: android.net.Uri,
        mimeType: String,
        fileName: String,
        caption: String = ""
    ): Result<String> {
        return try {
            // 1. Загружаем файл
            val fileUrl = httpClient.uploadFile(imageUri, mimeType, fileName)
            Timber.d("Image uploaded: $fileUrl")

            // 2. Формируем Drafty контент
            val draftyContent = PubContentDrafty(
                txt = if (caption.isNotEmpty()) caption else " ",
                ent = listOf(
                    DraftyEntity(
                        tp = "EX",
                        `data` = DraftyData(
                            mime = mimeType,
                            name = fileName,
                            ref = fileUrl,
                            size = getImageSize(imageUri)
                        )
                    )
                ),
                fmt = listOf(
                    DraftyFmt(
                        at = if (caption.isEmpty()) 0 else caption.length,
                        len = 1,
                        key = 0
                    )
                )
            )

            // 3. Сериализуем в JSON для отправки
            val contentJson = httpClient.gson.toJson(draftyContent)

            // 4. Отправляем pub с extra attachments
            val extra = PubExtra(attachments = listOf(fileUrl))
            httpClient.publishWithContent(topicName, contentJson, "text/x-drafty", extra)

            Result.success(fileUrl)
        } catch (e: Exception) {
            Timber.e(e, "Failed to send image message")
            Result.failure(e)
        }
    }

    /**
     * Отправить сообщение с изображением и прогрессом загрузки.
     */
    suspend fun sendImageMessageWithProgress(
        topicName: String,
        imageUri: android.net.Uri,
        mimeType: String,
        fileName: String,
        caption: String = "",
        fileSize: Long = 0,
        onProgress: (Float) -> Unit
    ): Result<String> {
        return try {
            // 1. Загружаем файл с прогрессом
            val fileUrl = httpClient.uploadFileWithProgress(imageUri, mimeType, fileName, onProgress)
            Timber.d("Image uploaded: $fileUrl")

            // Размер: переданный или из URI
            val actualSize = if (fileSize > 0) fileSize else getImageSize(imageUri)

            // 2. Формируем Drafty контент
            val draftyContent = PubContentDrafty(
                txt = if (caption.isNotEmpty()) caption else " ",
                ent = listOf(
                    DraftyEntity(
                        tp = "EX",
                        `data` = DraftyData(
                            mime = mimeType,
                            name = fileName,
                            ref = fileUrl,
                            size = actualSize
                        )
                    )
                ),
                fmt = listOf(
                    DraftyFmt(
                        at = if (caption.isEmpty()) 0 else caption.length,
                        len = 1,
                        key = 0
                    )
                )
            )

            // 3. Сериализуем в JSON для отправки
            val contentJson = httpClient.gson.toJson(draftyContent)

            // 4. Отправляем pub — без extra, вся информация уже в Drafty ent[]
            httpClient.publishWithContent(topicName, contentJson, "text/x-drafty")

            Result.success(fileUrl)
        } catch (e: Exception) {
            Timber.e(e, "Failed to send image message")
            Result.failure(e)
        }
    }

    private fun getImageSize(uri: android.net.Uri): Long {
        return try {
            context.contentResolver.openAssetFileDescriptor(uri, "r")?.length ?: 0L
        } catch (e: Exception) {
            0L
        }
    }

    fun markAsRead(topicName: String, seq: Int) {
        httpClient.noteRead(topicName, seq)
    }

    fun sendTyping(topicName: String) {
        httpClient.sendTyping(topicName)
    }

    fun leaveTopic(topicName: String) {
        httpClient.leave(topicName)
        if (currentTopicName == topicName) currentTopicName = null
    }

    /**
     * Удалить сообщение на сервере.
     */
    suspend fun deleteMessage(topicName: String, seqId: Int): Result<Unit> {
        if (!awaitConnection()) return Result.failure(Exception("Нет подключения"))
        return try {
            httpClient.deleteMessage(topicName, seqId)
            Result.success(Unit)
        } catch (e: Exception) { Result.failure(e) }
    }

    /**
     * Редактировать сообщение на сервере.
     */
    fun editMessage(topicName: String, seqId: Int, newText: String) {
        httpClient.editMessage(topicName, seqId, newText)
    }

    // ─── Groups & Channels ──────────────────────────────────────

    /**
     * Создать группу.
     * Использует subscribe("new", ...) для создания нового топика.
     */
    suspend fun createGroup(name: String, description: String, members: List<String>): Result<String> {
        if (!awaitConnection()) return Result.failure(Exception("Нет подключения к серверу"))
        return try {
            // Подписываемся на "new" — сервер создаст новый топик и вернёт его имя
            val r = httpClient.subscribe("new", MetaGetPacket(desc = MetaGetDesc()))
            if (r.ctrl?.code !in 200..299) return Result.failure(Exception(r.ctrl?.text ?: "Create group failed"))
            
            val topicName = r.ctrl?.topic
            if (topicName == null) return Result.failure(Exception("Сервер не вернул имя топика"))
            
            // Устанавливаем название группы и описание
            httpClient.setMeta(topicName, MetaSetPacket(
                desc = MetaSetDesc(
                    public = TheCard(fn = name, photo = null)
                )
            ))
            
            // Добавляем участников
            members.forEach { userId ->
                httpClient.setMeta(topicName, MetaSetPacket(
                    sub = MetaSetSub(user = userId, mode = "JRWPA")
                ))
            }
            
            Result.success(topicName)
        } catch (e: Exception) { Result.failure(e) }
    }

    /**
     * Получить список участников группы.
     * Подписывается на топик и ждёт META с sub-списком.
     */
    suspend fun getGroupMembers(topicName: String): List<ContactInfo> {
        if (!awaitConnection()) return emptyList()
        val deferred = CompletableDeferred<List<ContactInfo>>()
        topicMemberDeferreds[topicName] = deferred
        return try {
            httpClient.subscribe(topicName, MetaGetPacket(
                desc = MetaGetDesc(),
                sub = MetaGetSub()
            ))
            withTimeout(8000) { deferred.await() }
        } catch (e: Exception) {
            Timber.e(e, "getGroupMembers: error for $topicName")
            emptyList()
        } finally {
            topicMemberDeferreds.remove(topicName)
        }
    }

    /**
     * Добавить участника в группу.
     */
    suspend fun addGroupMember(topicName: String, userId: String): Result<Unit> {
        if (!awaitConnection()) return Result.failure(Exception("Нет подключения к серверу"))
        return try {
            httpClient.setMeta(topicName, MetaSetPacket(
                sub = MetaSetSub(user = userId, mode = "JRWPA")
            ))
            Result.success(Unit)
        } catch (e: Exception) { Result.failure(e) }
    }

    /**
     * Удалить участника из группы.
     */
    suspend fun removeGroupMember(topicName: String, userId: String): Result<Unit> {
        if (!awaitConnection()) return Result.failure(Exception("Нет подключения к серверу"))
        return try {
            httpClient.setMeta(topicName, MetaSetPacket(
                sub = MetaSetSub(user = userId, mode = "")
            ))
            Result.success(Unit)
        } catch (e: Exception) { Result.failure(e) }
    }

    /**
     * Покинуть группу (отписаться).
     */
    suspend fun leaveGroup(topicName: String): Result<Unit> {
        if (!awaitConnection()) return Result.failure(Exception("Нет подключения к серверу"))
        return try {
            httpClient.leaveAndUnsub(topicName)
            if (currentTopicName == topicName) currentTopicName = null
            Result.success(Unit)
        } catch (e: Exception) { Result.failure(e) }
    }

    /**
     * Обновить название и описание группы.
     */
    suspend fun updateGroupInfo(topicName: String, name: String, description: String): Result<Unit> {
        if (!awaitConnection()) return Result.failure(Exception("Нет подключения к серверу"))
        return try {
            httpClient.setMeta(topicName, MetaSetPacket(
                desc = MetaSetDesc(
                    public = TheCard(fn = name),
                    private = if (description.isNotBlank()) PrivateData(note = description) else null
                )
            ))
            Result.success(Unit)
        } catch (e: Exception) { Result.failure(e) }
    }

    // ─── Profile ────────────────────────────────────────────────

    /**
     * Проверить доступность username через FND-топик.
     */
    suspend fun checkUsername(username: String): Result<Boolean> {
        if (!awaitConnection()) return Result.success(true)
        if (username.length < 3) return Result.success(true)
        
        return try {
            val results = searchUsers(username)
            // Если нашёлся пользователь с таким же логином — он занят
            val isTaken = results.any { it.displayName.equals(username, ignoreCase = true) }
            Result.success(!isTaken)
        } catch (e: Exception) {
            Result.success(true) // При ошибке считаем свободным
        }
    }

    suspend fun checkEmailAvailability(email: String): Result<Boolean> = Result.success(true)
    suspend fun checkPhoneAvailability(phone: String): Result<Boolean> = Result.success(true)

    /**
     * Обновить профиль пользователя (имя + bio).
     * Передаёт displayName в fn и bio в note через me-топик.
     */
    suspend fun updateProfile(displayName: String, bio: String): Result<Unit> {
        if (!awaitConnection()) return Result.failure(Exception("Нет подключения к серверу"))
        return try {
            httpClient.subscribe("me", MetaGetPacket(desc = MetaGetDesc()))
            httpClient.setMeta("me", MetaSetPacket(
                desc = MetaSetDesc(
                    public = TheCard(fn = displayName, photo = null),
                    private = PrivateData(note = bio)
                )
            ))
            Result.success(Unit)
        } catch (e: Exception) { Result.failure(e) }
    }

    /**
     * Сменить пароль.
     * В Tinode: acc message с user="me" и новым secret.
     */
    suspend fun changePassword(oldPassword: String, newPassword: String): Result<Unit> {
        if (!awaitConnection()) return Result.failure(Exception("Нет подключения к серверу"))
        return try {
            val myLogin = myUid ?: return Result.failure(Exception("Неизвестный пользователь"))
            httpClient.changePassword(myLogin, oldPassword, newPassword)
            Result.success(Unit)
        } catch (e: Exception) { Result.failure(e) }
    }

    /**
     * Получить информацию о текущем пользователе.
     * Читает displayName из me-топика desc.public.fn.
     */
    suspend fun getMyProfile(): Result<UserProfile> {
        if (!awaitConnection()) return Result.failure(Exception("Нет подключения к серверу"))
        return try {
            val r = httpClient.subscribe("me", MetaGetPacket(
                desc = MetaGetDesc(),
                sub = null
            ))

            // Имя хранится в meta.desc.public.fn или meta.public.fn
            val displayName = r.meta?.desc?.`public`?.fn
                ?: r.meta?.`public`?.fn
                ?: ""

            // Bio хранится в meta.desc.private.note
            val bio = (r.meta?.desc?.`private` as? Map<*, *>)?.get("note") as? String

            Result.success(UserProfile(
                uid = myUid ?: "",
                displayName = displayName,
                avatar = r.meta?.desc?.`public`?.photo
                    ?: r.meta?.`public`?.photo,
                bio = bio
            ))
        } catch (e: Exception) { Result.failure(e) }
    }

    /**
     * Обновить аватар пользователя.
     * Отправляет base64-изображение через setMeta me-топика.
     */
    suspend fun updateAvatar(base64Photo: String): Result<Unit> {
        if (!awaitConnection()) return Result.failure(Exception("Нет подключения к серверу"))
        return try {
            httpClient.setMeta("me", MetaSetPacket(
                desc = MetaSetDesc(
                    public = TheCard(photo = base64Photo)
                )
            ))
            Result.success(Unit)
        } catch (e: Exception) { Result.failure(e) }
    }

    // ─── Helpers ────────────────────────────────────────────────

    // isAuthenticated теперь приватный — используйте SessionRepository.authState
    private fun isAuthenticated(): Boolean = httpClient.isAuthenticated

    fun hasSavedToken(): Boolean = prefs.getString("auth_token", null) != null

    fun disconnect() {
        httpClient.disconnect()
        _connectionState.value = TinodeConnState.Disconnected
    }

    private fun saveAuth(token: String?, uid: String?) {
        prefs.edit().putString("auth_token", token).putString("my_uid", uid).apply()
    }

    private fun clearAuth() {
        prefs.edit().remove("auth_token").remove("my_uid").apply()
    }

    private fun generateId(): String {
        val bytes = ByteArray(8)
        kotlin.random.Random.nextBytes(bytes)
        return bytes.joinToString("") { "%02x".format(it) }
    }
}

// ─── Events & States ────────────────────────────────────────────

sealed class TinodeEvent {
    data class NewMessage(val data: DataPacket) : TinodeEvent()
    data class Presence(val data: PresPacket) : TinodeEvent()
    data class Info(val data: InfoPacket) : TinodeEvent()
    data class Meta(val data: MetaPacket) : TinodeEvent()
    data class Control(val data: CtrlPacket) : TinodeEvent()
}

enum class TinodeConnState { Disconnected, Connecting, Connected, Authenticated, Error }

data class ContactInfo(
    val topicName: String,
    val displayName: String,
    val avatar: String? = null,
    val lastMessage: String? = null,
    val timestamp: Date? = null,
    val unread: Int = 0,
    val isGroup: Boolean = false,
    val muted: Boolean = false,
    val pinned: Boolean = false,
    val isOnline: Boolean = false
)

data class UiMessage(
    val seqId: Int,
    val from: String,
    val senderName: String,
    val content: String,
    val timestamp: Date,
    val isOwn: Boolean,
    val isRead: Boolean,
    val isEdited: Boolean,
    val hasAttachment: Boolean = false,
    val attachmentUrl: String? = null,
    val replyToContent: String? = null
)

data class UserProfile(
    val uid: String,
    val displayName: String,
    val avatar: String?,
    val bio: String? = null
)
