# Lastochka Android (Compose)

Мессенджер «Ласточка» для Android — **Jetpack Compose** + собственный Tinode HTTP-клиент.

## Архитектура

```
MVVM + Repository pattern

UI (Compose) → ViewModel → Repository → TinodeHttpClient (OkHttp WebSocket) + Room DB
```

## Структура

```
app/src/main/java/ru/lastochka/messenger/
├── LastochkaApp.kt            — Application, инициализация
├── MainActivity.kt            — Точка входа, навигация
├── data/
│   ├── TinodeClient.kt        — Высокоуровневый клиент (сессия + auth)
│   ├── TinodeHttpClient.kt    — Низкоуровневый WebSocket-клиент (OkHttp)
│   ├── ChatRepository.kt      — Repository
│   ├── local/
│   │   └── AppDatabase.kt     — Room DB
│   └── model/
│       └── TinodeProtocol.kt  — Модели Tinode-протокола
├── viewmodel/
│   ├── AuthViewModel.kt       — Вход/регистрация
│   ├── ChatListViewModel.kt   — Список чатов
│   └── ChatViewModel.kt       — Экран чата
├── navigation/
│   └── Screen.kt              — Маршруты навигации
├── di/
│   └── AppModule.kt           — Hilt модули
└── ui/
    ├── screens/
    │   ├── auth/              — LoginScreen, RegisterScreen
    │   ├── chat/              — ChatScreen
    │   └── chatlist/          — ChatListScreen
    ├── components/            — Avatar, ChatItem, MessageBubble, ...
    └── theme/                 — Color, Theme, Type
```

## Технологии

| Компонент | Технология |
|-----------|-----------|
| **UI** | Jetpack Compose + Material 3 |
| **DI** | Hilt 2.52 + KSP |
| **DB** | Room 2.6.1 + KSP |
| **Networking** | OkHttp 4.12.0 (WebSocket) |
| **Serialization** | Gson 2.11.0 |
| **Async** | Kotlin Coroutines + Flow |
| **Build** | Gradle 8.7, Kotlin 1.9.25 |

## Быстрый старт

### Требования
- JDK 17+ (Android Studio JDK или системная)
- Android SDK 35 (compileSdk), minSdk 26
- Gradle 8.7

### Сборка

```bash
# Windows
set JAVA_HOME=C:\Program Files\Android\Android Studio\jbr
set PATH=%JAVA_HOME%\bin;%PATH%
cd dev\lastochka-android-compose
gradlew.bat assembleDebug

# Linux/macOS
export JAVA_HOME=/path/to/android-studio/jbr
cd dev/lastochka-android-compose
./gradlew assembleDebug
```

Результат: `app/build/outputs/apk/debug/app-debug.apk` (~22 MB)

### Запуск на эмуляторе

```bash
adb install app/build/outputs/apk/debug/app-debug.apk
adb shell am start -n ru.lastochka.messenger/.MainActivity
```

## Конфигурация сервера

Сервер настраивается в `app/build.gradle.kts`:

```kotlin
debug {
    resValue("string", "default_host_name", "app.lastochka-m.ru")
    resValue("string", "default_api_key", "AQEAAAABAAD_...")
}
```

Для локальной разработки измените `hostName` на `localhost:6060` и `useTLS = false`.

## Протокол

Приложение использует **Tinode** протокол поверх WebSocket:

- **Подключение:** `wss://host/ws` + header `X-Tinode-APIKey`
- **Аутентификация:** `basic` (логин/пароль) или `token`
- **Сообщения:** plain text `{"txt": "..."}` (Drafty пока не поддерживается)

Подробная документация: [docs/MIGRATION.md](docs/MIGRATION.md)

## Иконка приложения

- **Источник:** `Brand/logo2.png` (ласточка, градиент blue→purple)
- **Формат:** Adaptive Icons (Android 8+)
- **Плотности:** mdpi (48px), hdpi (72px), xhdpi (96px), xxhdpi (144px), xxxhdpi (192px)
- **Play Store:** 512×512px
- **Splash:** PNG в 5 плотностях (120–480px)

## Известные ограничения

- Только текстовые сообщения (нет Drafty, файлов, изображений)
- Нет push-уведомлений
- Нет видеозвонков
- Нет E2E шифрования

## Планы

- [ ] Drafty парсер для форматированных сообщений
- [ ] Загрузка файлов/изображений
- [ ] Push-уведомления (Firebase)
- [ ] Offline-кэш сообщений
- [ ] Видеозвонки (WebRTC)

## Лицензия

Apache-2.0 (форк HuLa + Tinode)

© 2026 Ласточка
