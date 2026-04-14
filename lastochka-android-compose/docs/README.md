# Документация Ласточка Android

## Индекс

| Файл | Описание |
|------|----------|
| [MIGRATION.md](MIGRATION.md) | Миграция с tinodesdk на собственный HTTP-клиент |
| [CHANGELOG.md](../CHANGELOG.md) | История изменений |
| [README.md](../README.md) | Общее описание проекта |

## Структура данных

### Data Layer
```
data/
├── TinodeHttpClient.kt    # Низкоуровневый WebSocket-клиент
├── TinodeClient.kt        # Высокоуровневый клиент (сессия + auth)
├── ChatRepository.kt      # Repository: Tinode + Room
├── local/
│   └── AppDatabase.kt     # Room DB (messages, contacts)
└── model/
    └── TinodeProtocol.kt  # Модели Tinode-протокола
```

### UI Layer
```
ui/
├── screens/
│   ├── auth/
│   │   ├── LoginScreen.kt
│   │   └── RegisterScreen.kt
│   ├── chat/
│   │   └── ChatScreen.kt
│   └── chatlist/
│       └── ChatListScreen.kt
├── components/
│   ├── Avatar.kt
│   ├── ChatItem.kt
│   ├── ChatHeader.kt
│   ├── MessageBubble.kt
│   └── MessageInput.kt
└── theme/
    ├── Color.kt
    ├── Theme.kt
    └── Type.kt
```

### ViewModel Layer
```
viewmodel/
├── AuthViewModel.kt
├── ChatListViewModel.kt
└── ChatViewModel.kt
```

## Технологии

- **UI:** Jetpack Compose + Material 3
- **DI:** Hilt 2.52
- **DB:** Room 2.6.1
- **Networking:** OkHttp 4.12.0 (WebSocket)
- **Serialization:** Gson 2.11.0
- **Async:** Kotlin Coroutines + Flow
- **Build:** Gradle 8.7, Kotlin 1.9.25

## Сборка

```bash
cd dev/lastochka-android-compose
gradlew.bat assembleDebug
```

Результат: `app/build/outputs/apk/debug/app-debug.apk` (22 MB)
