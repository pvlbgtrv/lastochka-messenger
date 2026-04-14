# Сводка изменений

## Дата
2026-04-03

## Созданные файлы

| Файл | Описание |
|------|----------|
| `app/src/main/java/ru/lastochka/messenger/data/TinodeHttpClient.kt` | Новый WebSocket-клиент на OkHttp |
| `app/src/main/java/ru/lastochka/messenger/data/model/TinodeProtocol.kt` | Модели Tinode-протокола (300 строк) |
| `app/src/main/res/values-night/colors.xml` | Цвета splash для тёмной темы |
| `app/src/main/res/drawable-mdpi/logo_src.png` | Splash иконка 120×120 |
| `app/src/main/res/drawable-hdpi/logo_src.png` | Splash иконка 180×180 |
| `app/src/main/res/drawable-xhdpi/logo_src.png` | Splash иконка 240×240 |
| `app/src/main/res/drawable-xxhdpi/logo_src.png` | Splash иконка 360×360 |
| `app/src/main/res/drawable-xxxhdpi/logo_src.png` | Splash иконка 480×480 |
| `app/src/main/res/mipmap-mdpi/ic_launcher_foreground.png` | Иконка приложения 48×48 |
| `app/src/main/res/mipmap-hdpi/ic_launcher_foreground.png` | Иконка приложения 72×72 |
| `app/src/main/res/mipmap-xhdpi/ic_launcher_foreground.png` | Иконка приложения 96×96 |
| `app/src/main/res/mipmap-xxhdpi/ic_launcher_foreground.png` | Иконка приложения 144×144 |
| `app/src/main/res/mipmap-xxxhdpi/ic_launcher_foreground.png` | Иконка приложения 192×192 |
| `app/src/main/res/mipmap-xxxhdpi/ic_launcher_play_store.png` | Иконка Play Store 512×512 |
| `CHANGELOG.md` | История изменений |
| `docs/README.md` | Индекс документации |
| `docs/MIGRATION.md` | Руководство по миграции с tinodesdk |

## Изменённые файлы

| Файл | Изменения |
|------|-----------|
| `build.gradle.kts` | Убран kapt, добавлен KSP + Hilt plugin; Kotlin 1.9.25 |
| `settings.gradle.kts` | Убран модуль `:tinodesdk` |
| `app/build.gradle.kts` | Убран tinodesdk, добавлены OkHttp + Material; kapt → ksp |
| `app/src/main/java/.../data/TinodeClient.kt` | Полностью переписан: callback-based state, OkHttp |
| `app/src/main/java/.../data/ChatRepository.kt` | Убраны tinodesdk импорты, добавлен markAsRead |
| `app/src/main/java/.../viewmodel/ChatListViewModel.kt` | Убраны tinodesdk импорты, getContactsFromSubs |
| `app/src/main/java/.../viewmodel/ChatViewModel.kt` | Убраны tinodesdk импорты, parseTimestamp |
| `app/src/main/java/.../ui/components/Avatar.kt` | Исправлен fontSize (.sp вместо .dp), добавлен sp импорт |
| `app/src/main/java/.../ui/components/ChatItem.kt` | Исправлены импорты Done/DoneAll (filled) |
| `app/src/main/java/.../ui/components/MessageBubble.kt` | Исправлены импорты Done/DoneAll (filled) |
| `app/src/main/java/.../ui/screens/auth/LoginScreen.kt` | Добавлен импорт sp |
| `app/src/main/java/.../ui/screens/auth/RegisterScreen.kt` | Добавлены verticalScroll/rememberScrollState импорты; LockReset→Lock; @OptIn |
| `app/src/main/java/.../ui/screens/chat/ChatScreen.kt` | Добавлены dp/sp импорты |
| `app/src/main/java/.../ui/screens/chatlist/ChatListScreen.kt` | Добавлен sp импорт |
| `app/src/main/res/values/colors.xml` | Добавлен colorSplashScreenBackground |
| `app/src/main/res/drawable/splash_screen.xml` | Без изменений (ссылается на logo_src.png) |
| `tinodesdk/build.gradle.kts` | Добавлены Jackson, Java-WebSocket, ICU4J, buildConfig |
| `README.md` | Полностью переписан под новую архитектуру |

## Удалённые файлы

| Файл | Причина |
|------|---------|
| `app/src/main/res/drawable/logo_splash.xml` | Заменён на PNG иконки |

## Удалённые модули

| Модуль | Причина |
|--------|---------|
| `:tinodesdk` | Заменён на собственный TinodeHttpClient |

## Статистика

- **Строк кода добавлено:** ~1200 (TinodeProtocol + TinodeHttpClient + TinodeClient)
- **Строк кода удалено:** ~0 (tinodesdk оставлен в проекте, но не подключён)
- **Файлов создано:** 17
- **Файлов изменено:** 17
- **Файлов удалено:** 1
- **APK размер:** 22.5 MB
- **Время сборки:** ~30 секунд (после clean)

## Зависимости

### Добавлены
```kotlin
implementation("com.squareup.okhttp3:okhttp:4.12.0")
implementation("com.google.android.material:material:1.12.0")
implementation("com.google.devtools.ksp") // plugin
```

### Удалены
```kotlin
implementation(project(":tinodesdk"))
// tinodesdk зависимости (остались в модуле, но не используются):
implementation("com.fasterxml.jackson.core:jackson-core:2.17.2")
implementation("com.fasterxml.jackson.core:jackson-databind:2.17.2")
implementation("com.fasterxml.jackson.core:jackson-annotations:2.17.2")
implementation("org.java-websocket:Java-WebSocket:1.5.7")
implementation("com.ibm.icu:icu4j:75.1")
```

### Обновлены
| Зависимость | Старая версия | Новая версия |
|-------------|---------------|--------------|
| Kotlin | 1.9.24 | 1.9.25 |
| Compose Compiler | 1.5.14 | 1.5.15 |
| Room compiler | kapt | ksp |
| Hilt compiler | kapt | ksp |
