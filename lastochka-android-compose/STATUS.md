# Ласточка Android (Compose) — Статус разработки

> Новый Android-клиент, переписанный с нуля на Jetpack Compose.
> Заменяет старый Tindroid-форк (`dev/lastochka-android/`).

**Путь проекта:** `dev/lastochka-android-compose/`
**Последнее обновление:** 2026-04-03

---

## ✅ Сделано

### Инфраструктура
- [x] Создана папка проекта `dev/lastochka-android-compose/`
- [x] Gradle wrapper (8.7, совместим с AGP 8.3.2)
- [x] `settings.gradle.kts`, `build.gradle.kts` (корневой + app + tinodesdk)
- [x] `gradle.properties`, `local.properties` (Android SDK настроен)
- [x] ProGuard правила

### Tinode SDK
- [x] Скопирован модуль `tinodesdk/` из старого проекта (69 Java-файлов)
- [x] `build.gradle.kts` для SDK модуля
- [x] `consumer-rules.pro`, `proguard-rules.pro`

### Слой данных
- [x] `TinodeClient.kt` — обёртка над Tinode SDK (login, register, subscribe, sendMessage, events)
- [x] `ChatRepository.kt` — Repository pattern (Tinode + Room)
- [x] `AppDatabase.kt` — Room DB: `MessageEntity`, `ContactEntity`, `TypingEntity` + DAOs

### ViewModel
- [x] `AuthViewModel.kt` — вход, регистрация, проверка username, автологин
- [x] `ChatListViewModel.kt` — загрузка контактов из MeTopic, обновление через события
- [x] `ChatViewModel.kt` — сообщения чата, отправка, typing, read receipts

### Навигация
- [x] `Screen.kt` — маршруты: Login, Register, ChatList, Chat, Profile, NewChat
- [x] `MainActivity.kt` — NavHost с проверкой авторизации

### UI — Тема (lastochka-ui стиль)
- [x] `Color.kt` — 40+ цветов (бренд, light/dark, bubble, статусы, аватары)
- [x] `Type.kt` — типографика (display, headline, title, body, label)
- [x] `Theme.kt` — Material 3 + LocalBubbleColors для light/dark

### UI — Компоненты
- [x] `Avatar.kt` — аватар с инициалами, цветовым хешем (16 цветов), online-индикатор
- [x] `ChatItem.kt` — элемент списка чатов (аватар, имя, превью, время, badge unread, muted)
- [x] `MessageBubble.kt` — пузырь сообщения (скругление 18px, хвостик, статус ✓/✓✓, разделитель дат)
- [x] `MessageInput.kt` — поле ввода (скрепка, текст, кнопка отправки/микрофон)
- [x] `ChatHeader.kt` — хедер чата (назад, аватар, имя, статус, звонок, видео, меню)

### UI — Экраны
- [x] `LoginScreen.kt` — вход (логотип, username, пароль, show/hide, error, ссылка на регистрацию)
- [x] `RegisterScreen.kt` — регистрация (имя, username с проверкой, пароль, подтверждение)
- [x] `ChatListScreen.kt` — список чатов (Empty state, LazyColumn, FAB, error snackbar)
- [x] `ChatScreen.kt` — экран чата (ChatHeader, LazyColumn с bubble, DateDivider, MessageInput)

### DI
- [x] `AppModule.kt` — Hilt: Database, TinodeClient, Repository
- [x] `@HiltAndroidApp` на `LastochkaApp`
- [x] `@AndroidEntryPoint` на `MainActivity`
- [x] `@HiltViewModel` на все 3 ViewModel

### Ресурсы
- [x] `colors.xml` — все цвета (light/dark/bubble/status)
- [x] `strings.xml` — 40+ строк (RU)
- [x] `themes.xml` — LaunchScreen + AppTheme
- [x] `AndroidManifest.xml` — permissions, activity, splash theme
- [x] mipmap иконки (mdpi–xxxhdpi) — логотип Ласточки
- [x] `ic_launcher.xml` / `ic_launcher_round.xml` — adaptive icon
- [x] `splash_screen.xml` — splash с логотипом

### Документация
- [x] `README.md` — архитектура, стек, цвета, сборка, roadmap

### Итого: **22 Kotlin файла**, ~2500 строк кода

---

## 🚧 В процессе / предстоит

### Критично для MVP
- [ ] **Собрать проект** — проверить компиляцию (`gradlew assembleDebug`) — **ГОТОВО К СБОРКЕ после перезагрузки консоли**
- [ ] **Сохранение/восстановление токена** — `autoLogin()` должен работать при перезапуске

### Чат (базовый)
- [ ] **Загрузка истории сообщений** — подгрузка старых сообщений при скролле вверх
- [ ] **Отправка Drafty** — сейчас отправляется plain text, нужен полноценный Drafty
- [ ] **Отображение senderName** — резолвить имя отправителя из контактов
- [ ] **Реакция на входящие сообщения** — обновление UI через Tinode events

### Чат (продвинутый)
- [ ] **Голосовые сообщения** — запись, воспроизведение, waveform
- [ ] **Файловые вложения** — фото, видео, документы (CameraX, MediaStore)
- [ ] **Редактирование/удаление** сообщений
- [ ] **Пересылка** сообщений
- [ ] **Reply** на сообщение
- [ ] **Поиск** по сообщениям

### Группы и каналы
- [ ] **Создание группы** — выбор участников, название, аватар
- [ ] **Групповой чат** — отображение имён отправителей
- [ ] **Каналы** — read-only подписчики

### Звонки
- [ ] **WebRTC** — аудио/видео звонки (из старого Tindroid)
- [ ] **Push-уведомления** — FCM для входящих звонков и сообщений

### Настройки
- [ ] **Экран профиля** — имя, аватар, смена пароля
- [ ] **Настройки уведомлений** — звук, вибрация, мут
- [ ] **Тема** — переключение light/dark/system

### Инфраструктура
- [ ] **Push-уведомления FCM** — фоновые уведомления
- [ ] **Фоновая синхронизация** — WorkManager
- [ ] **Обработка offline** — очередь отправки, кеш

---

## 📦 Зависимости

| Библиотека | Версия |
|------------|--------|
| Kotlin | 1.9.24 |
| Compose BOM | 2024.06.00 |
| Material 3 | (из BOM) |
| Room | 2.6.1 |
| Hilt | 2.52 |
| Navigation Compose | 2.8.3 |
| Coil | 2.7.0 |
| Coroutines | 1.8.1 |
| DataStore | 1.1.1 |
| Gson | 2.11.0 |
| Tinode SDK | форк Tinode |

---

## 🔧 Команды

```bash
cd dev/lastochka-android-compose

# Сборка (Windows)
gradlew.bat assembleDebug
gradlew.bat assembleRelease

# Установка на устройство
gradlew.bat installDebug

# Запуск
gradlew.bat installDebug & adb shell am start -n ru.lastochka.messenger/.MainActivity

# Лог
adb logcat -s Lastochka Tinode
```

---

## 🎨 Дизайн-соответствие с lastochka-ui

| lastochka-ui | Android Compose | Статус |
|--------------|-----------------|--------|
| Bubble свои `#EEF2FF` | `BubbleOwn` | ✅ |
| Bubble чужие `#FFFFFF` | `BubblePeer` | ✅ |
| Скругление 18px | `RoundedCornerShape(18.dp)` | ✅ |
| Хвостик bubble | `bottomEnd=4dp` / `bottomStart=4dp` | ✅ |
| Статус ✓/✓✓ | `Done` / `DoneAll` icons | ✅ |
| Аватар + инициалы | `Avatar` composable | ✅ |
| Разделитель дат | `DateDivider` | ✅ |
| Input скруглённый | `MessageInput` | ✅ |
| Тёмная тема | `LastochkaTheme(darkTheme)` | ✅ |

---

## 📝 Примечания

1. **Windows** — используйте `gradlew.bat` вместо `./gradlew`
2. **Tinode SDK** — Java-код, работает через PromisedReply (async pattern), нужно адаптировать под Kotlin coroutines
3. **Room** — используется Flow для реактивных обновлений UI
4. **Drafty** — формат rich-контента Tinode, пока отправляется plain text
5. **Оффлайн** — Room кеш + Tinode SDK LocalData
6. **Hilt** — полностью настроен (@HiltAndroidApp, @AndroidEntryPoint, @HiltViewModel)
