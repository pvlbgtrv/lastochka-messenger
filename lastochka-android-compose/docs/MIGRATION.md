# Миграция с Tinode SDK на собственный HTTP-клиент

## Обзор

Проект `lastochka-android-compose` был переведён с использования внешней библиотеки `tinodesdk` на собственную реализацию HTTP/WebSocket клиента на базе OkHttp.

### Причины миграции

1. **tinodesdk не собирался** — зависимости Jackson, ICU4J, Java-WebSocket не были указаны в `build.gradle.kts`
2. **API SDK устарел** — код приложения использовал методы, которых нет в актуальной версии SDK
3. **Конфликт версий** — Kotlin 1.9.25 несовместим с Compose Compiler 1.5.14, а kapt падал с ошибками stub generation
4. **Избыточность** — SDK тянул 100+ файлов Java-кода, из которых приложению нужны ~15 методов

## Архитектура нового клиента

```
┌─────────────────────────────────────────────┐
│  UI Layer (Compose Screens + ViewModels)    │
│  ─ ChatListScreen, ChatScreen, AuthScreen   │
├─────────────────────────────────────────────┤
│  ChatRepository                             │
│  ─ Единая точка доступа: TinodeClient + Room│
├─────────────────────────────────────────────┤
│  TinodeClient (high-level)                  │
│  ─ Управление сессией, авторизация, топики   │
│  ─ Flow событий: events (SharedFlow)        │
│  ─ Callback состояния: observeConnectionState│
├─────────────────────────────────────────────┤
│  TinodeHttpClient (low-level)               │
│  ─ OkHttp WebSocket: wss://host/ws           │
│  ─ JSON сериализация: Gson                   │
│  ─ ID генерация, Base64, timeout handling    │
├─────────────────────────────────────────────┤
│  TinodeProtocol (data models)               │
│  ─ Client: Hi, Acc, Login, Sub, Pub, Note    │
│  ─ Server: Ctrl, Data, Meta, Pres, Info      │
└─────────────────────────────────────────────┘
```

## Протокол Tinode (WebSocket)

### Инициализация сессии
```
Client → { "id": "abc123", "hi": { "ver": "1", "ua": "lastochka-android/1.0" } }
Server ← { "ctrl": { "id": "abc123", "code": 200 } }
```

### Аутентификация (login)
```
Client → { "id": "def456", "login": { "scheme": "basic", "secret": "base64(user:pass)" } }
Server ← { "ctrl": { "id": "def456", "code": 200, "params": { "user": "usr...", "token": "..." } } }
```

### Регистрация (acc)
```
Client → { "id": "ghi789", "acc": { "user": "username", "scheme": "basic", "secret": "base64(user:pass)", "login": true, "desc": { "public": { "fn": "Display Name" } } } }
Server ← { "ctrl": { "id": "ghi789", "code": 201, "params": { "user": "usr...", "token": "..." } } }
```

### Подписка на топик (sub)
```
Client → { "id": "jkl012", "sub": { "topic": "usrAbCdEf", "get": { "data": { "since": 0, "limit": 50 } } } }
Server ← { "ctrl": { "id": "jkl012", "code": 200 } }
Server ← { "data": { "topic": "usrAbCdEf", "from": "usrOther", "seq": 5, "content": { "txt": "Hello!" } } }
```

### Отправка сообщения (pub)
```
Client → { "id": "mno345", "pub": { "topic": "usrAbCdEf", "content": { "txt": "Hi there!" } } }
Server ← { "ctrl": { "id": "mno345", "code": 200 } }
```

### Typing indicator (note)
```
Client → { "id": "pqr678", "note": { "topic": "usrAbCdEf", "what": "kp" } }
```

### Read receipt (note)
```
Client → { "id": "stu901", "note": { "topic": "usrAbCdEf", "what": "read", "seq": 5 } }
```

### Мета-запрос (get)
```
Client → { "id": "vwx234", "get": { "topic": "me", "desc": {}, "sub": {} } }
Server ← { "meta": { "id": "vwx234", "topic": "me", "sub": [ { "topic": "usrAbCdEf", "unread": 3, "public": { "fn": "Chat Name" } }, ... ] } }
```

## Модели данных

### Client Messages
| Класс | Назначение |
|-------|-----------|
| `ClientMsgHi` | Инициализация сессии |
| `ClientMsgAcc` | Регистрация нового пользователя |
| `ClientMsgLogin` | Вход по логину/паролю или токену |
| `ClientMsgSub` | Подписка на топик (чат) |
| `ClientMsgPub` | Отправка сообщения |
| `ClientMsgNote` | Typing indicator / read receipt |
| `ClientMsgLeave` | Покидание топика |
| `ClientMsgGet` | Запрос метаданных |
| `ClientMsgSet` | Обновление метаданных |

### Server Messages
| Класс | Назначение |
|-------|-----------|
| `CtrlPacket` | Ответ управления (code 200 = OK, 201 = Created) |
| `DataPacket` | Входящее сообщение (content.txt) |
| `MetaPacket` | Метаданные (список чатов из `me`) |
| `PresPacket` | Присутствие (online/offline) |
| `InfoPacket` | Typing / read уведомления |

## Ключевые файлы

| Файл | Описание |
|------|----------|
| `TinodeHttpClient.kt` | Низкоуровневый WebSocket-клиент (OkHttp) |
| `TinodeClient.kt` | Высокоуровневый клиент (сессия, auth, state) |
| `TinodeProtocol.kt` | Все модели протокола |
| `ChatRepository.kt` | Repository: TinodeClient + Room DB |
| `TinodeClient.kt` (app) | Обёртка для UI с Flow событий |

## Изменения в зависимостях

### Удалены
```kotlin
implementation(project(":tinodesdk"))
```

### Добавлены
```kotlin
implementation("com.squareup.okhttp3:okhttp:4.12.0")
implementation("com.google.android.material:material:1.12.0")
```

### Изменены
| Зависимость | Было | Стало |
|-------------|------|-------|
| Kotlin | 1.9.24 | 1.9.25 |
| Compose Compiler | 1.5.14 | 1.5.15 |
| Room compiler | `kapt` | `ksp` |
| Hilt compiler | `kapt` | `ksp` |

## Сборка проекта

```bash
# Установка JAVA_HOME (если не задана)
set JAVA_HOME=C:\Program Files\Android\Android Studio\jbr

# Сборка debug APK
cd D:\Projects\Messenger\dev\lastochka-android-compose
gradlew.bat assembleDebug

# Результат: app/build/outputs/apk/debug/app-debug.apk
```

## API клиента

### Подключение
```kotlin
val client = TinodeClient(
    context = context,
    appName = "Ласточка",
    apiKey = "AQEAAAABAAD_...",
    hostName = "app.lastochka-m.ru",
    useTLS = true
)
client.connect()
```

### Авторизация
```kotlin
// Вход
val result = client.login(username, password)

// Регистрация
val result = client.register(username, password, displayName)

// Проверка username
val free = client.checkUsername(username)
```

### Работа с чатами
```kotlin
// Список чатов
val subs = client.getMeTopic()
val contacts = client.getContacts(subs)

// Подписка на чат
client.subscribeTopic(topicName)

// Отправка сообщения
client.sendTextMessage(topicName, "Hello!")

// Typing indicator
client.sendTyping(topicName)

// Read receipt
client.markAsRead(topicName, seqId)
```

### Наблюдение за событиями
```kotlin
// Поток входящих сообщений
lifecycleScope.launch {
    client.events.collect { event ->
        when (event) {
            is TinodeEvent.NewMessage -> handleNewMessage(event.data)
            is TinodeEvent.Presence -> handlePresence(event.data)
            is TinodeEvent.Meta -> handleMeta(event.data)
            else -> {}
        }
    }
}

// Состояние подключения (callback)
client.observeConnectionState { state ->
    when (state) {
        TinodeConnState.Connected -> showConnected()
        TinodeConnState.Authenticated -> showAuthenticated()
        TinodeConnState.Disconnected -> showDisconnected()
        TinodeConnState.Error -> showError()
        else -> {}
    }
}
```

## Миграция с tinodesdk

| Старый API (tinodesdk) | Новый API (TinodeClient) |
|------------------------|--------------------------|
| `tinode.loginBasic(user, pass, true)` | `client.login(user, pass)` |
| `tinode.registerNewBasic(...)` | `client.register(user, pass, name)` |
| `tinode.getMeTopic()` | `client.getMeTopic()` |
| `topic.publish(Drafty().plain(text))` | `client.sendTextMessage(topic, text)` |
| `topic.noteRead(seq)` | `client.markAsRead(topic, seq)` |
| `topic.noteKeyPress()` | `client.sendTyping(topic)` |
| `tinode.setListener { ... }` | `client.events.collect { ... }` |
| `tinode.isAuthRequired && tinode.authToken != null` | `client.isAuthenticated()` |
| `tinode.disconnect()` | `client.disconnect()` |

## Известные ограничения

1. **Нет поддержки Drafty** — сообщения отправляются как plain text (`{"txt": "..."}`)
2. **Нет загрузки файлов** — только текстовые сообщения
3. **Нет видеозвонков** — протокол сигнализации не реализован
4. **Нет push-уведомлений** — Firebase Messaging не подключён
5. **Нет локального кэширования сообщений** — используется только Room для прочитанных

## Планы

- [ ] Добавить Drafty парсер для форматированных сообщений
- [ ] Загрузка и отправка файлов/изображений
- [ ] Push-уведомления через Firebase
- [ ] Offline-кэш сообщений
- [ ] Видеозвонки (WebRTC)
- [ ] Шифрование E2E
