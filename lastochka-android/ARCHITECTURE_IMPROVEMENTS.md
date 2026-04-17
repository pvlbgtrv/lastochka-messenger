# Улучшения архитектуры мобильного приложения

> Дата: 4 апреля 2026 г.

## Резюме изменений

Выполнены все 5 рекомендаций по улучшению архитектуры Android-приложения «Ласточка».

---

## 1. ✅ Splash Screen

**Проблема:** При запуске приложения на секунду появлялся основной интерфейс, затем экран авторизации.

**Решение:**

### Добавлена зависимость
```kotlin
// app/build.gradle.kts
implementation("androidx.core:core-splashscreen:1.0.1")
```

### Создана тема для Splash Screen
- `res/values/themes.xml` — `Theme.App.Starting` (Android 12+)
- `res/values-night/themes.xml` — ночная тема
- Использует `Theme.SplashScreen` с `windowSplashScreenAnimatedIcon`

### Обновлён AndroidManifest
```xml
android:theme="@style/Theme.App.Starting"
```

### Интеграция в MainActivity
```kotlin
override fun onCreate(savedInstanceState: Bundle?) {
    val splashScreen = installSplashScreen()
    super.onCreate(savedInstanceState)
    
    var keepSplashOnScreen = true
    splashScreen.setKeepOnScreenCondition { keepSplashOnScreen }
    
    LaunchedEffect(authState) {
        keepSplashOnScreen = false
    }
}
```

**Результат:** Плавный переход от splash к основному интерфейсу без мигания.

---

## 2. ✅ Единый источник правды для auth

**Проблема:** `TinodeClient.isAuthenticated` и `SessionRepository.authState` создавали дублирование и путаницу.

**Решение:**

### Изменения в TinodeClient
```kotlin
// Было: публичный метод
fun isAuthenticated(): Boolean = httpClient.isAuthenticated

// Стало: приватный метод (для внутренней логики)
private fun isAuthenticated(): Boolean = httpClient.isAuthenticated
```

### SessionRepository — единственный источник правды
```kotlin
sealed class AuthState {
    data object Unauthenticated : AuthState()
    data class Authenticated(val uid: String) : AuthState()
    data object SessionExpired : AuthState()
}

val authState: StateFlow<AuthState>
val isAuthenticated: Boolean // proxy-свойство
```

### ChatRepository делегирует SessionRepository
```kotlin
fun isAuthenticated(): Boolean = sessionRepository.isAuthenticated
val authState: Flow<AuthState> = sessionRepository.authState
```

**Результат:** Чёткая иерархия — `SessionRepository` → `ChatRepository` → UI.

---

## 3. ✅ Retry logic с exponential backoff

**Проблема:** Сетевые операции не повторялись при временных сбоях.

**Решение:**

### Создан утилитарный класс
`util/RetryWithBackoff.kt`:

```kotlin
suspend fun <T> retryWithBackoff(
    maxRetries: Int = 3,
    initialDelayMs: Long = 1_000L,
    maxDelayMs: Long = 30_000L,
    backoffFactor: Double = 2.0,
    shouldRetry: (Throwable) -> Boolean = { true },
    block: suspend () -> T
): Result<T>
```

### Предустановленные политики
```kotlin
RetryPolicy.Quick        // 2 retry, 500ms-2s (для auth)
RetryPolicy.Network      // 3 retry, 1s-10s (для сети)
RetryPolicy.Conservative // 5 retry, 2s-30s (для критичных операций)
```

### Интеграция в SessionRepository
```kotlin
suspend fun login(username: String, password: String): Result<Unit> {
    return RetryPolicy.Quick {
        tinodeClient.login(username, password)
    }
}

suspend fun autoLogin(): Result<Unit> {
    return RetryPolicy.Network(
        shouldRetry = { e ->
            // Не retry если токен недействителен
            e.message?.contains("401") != true
        }
    ) {
        tinodeClient.autoLogin()
    }
}
```

**Результат:** Устойчивость к временным сбоям сети, автоматические повторные попытки.

---

## 4. ✅ Тесты для SessionRepository

**Созданные файлы:**

### SessionRepositoryTest.kt (13 тестов)
- `initial state is Unauthenticated`
- `login success updates auth state`
- `login failure keeps Unauthenticated`
- `register success updates auth state`
- `register failure keeps Unauthenticated`
- `logout sets state to Unauthenticated`
- `autoLogin success updates auth state`
- `autoLogin failure keeps Unauthenticated`
- `isAuthenticated returns correct value`
- `myUid returns current uid`
- `connectionState delegates to tinodeClient`
- `registerWithFullProfile success`
- `hasSavedToken returns true when authenticated`

### RetryWithBackoffTest.kt (10 тестов)
- `success on first attempt`
- `retries on failure and eventually succeeds`
- `fails after max retries exhausted`
- `shouldRetry predicate controls retry`
- `RetryPolicy Quick/Network/Conservative`
- `RetryPolicy invoke operator`
- `exponential backoff increases delay`
- `maxDelayMs caps the delay`

**Итого:** 23 новых теста + существующие 34 = **57 тестов**

**Команда запуска:**
```bash
./gradlew :app:testDebugUnitTest
```

---

## 5. ✅ Логирование с Timber

**Проблема:** Использование `println` и `android.util.Log` без единой стратегии.

**Решение:**

### Добавлена зависимость
```kotlin
implementation("com.jakewharton.timber:timber:5.0.1")
```

### Инициализация в LastochkaApp
```kotlin
override fun onCreate() {
    if (BuildConfig.DEBUG) {
        Timber.plant(Timber.DebugTree())
    } else {
        // Production: Timber.plant(CrashlyticsTree())
    }
    Timber.d("LastochkaApp onCreate")
}
```

### Замена в TinodeHttpClient
```kotlin
// Было:
e.printStackTrace()
println("WebSocket onFailure: ...")

// Стало:
Timber.e(e, "Failed to parse WebSocket message")
Timber.e(t, "WebSocket onFailure: code=$statusCode, message=$errorMsg")
```

### Замена в TinodeClient
```kotlin
Timber.d("Connecting to Tinode server...")
Timber.d("WebSocket connected")
Timber.e("WebSocket connection error")
```

### Замена в SessionRepository
```kotlin
// Было:
android.util.Log.d("SessionRepository", "login result: $result")

// Стало:
Timber.d("Attempting login for user: $username")
Timber.d("Login result: $result, myUid=${tinodeClient.myUid}")
Timber.w("Login failed: ${result.exceptionOrNull()?.message}")
```

**Результат:** Структурированное логирование с тегами, автоматическое отключение в production.

---

## Изменённые файлы

| Файл | Изменения |
|---|---|
| `LastochkaApp.kt` | +Timber, убран `connect()` |
| `MainActivity.kt` | +SplashScreen API |
| `SessionRepository.kt` | +Timber, +Retry, +autoLogin в init |
| `TinodeClient.kt` | +Timber, -публичный isAuthenticated, +connect в autoLogin |
| `TinodeHttpClient.kt` | +Timber |
| `ChatRepository.kt` | Без изменений (уже делегировал) |
| `build.gradle.kts` | +core-splashscreen, +timber |
| `AndroidManifest.xml` | Theme.App.Starting |
| `themes.xml` | Theme.App.Starting |
| `themes.xml (night)` | Ночная тема для splash |

## Новые файлы

| Файл | Описание |
|---|---|
| `util/RetryWithBackoff.kt` | Утилита retry с exponential backoff |
| `data/SessionRepositoryTest.kt` | 13 тестов для SessionRepository |
| `util/RetryWithBackoffTest.kt` | 10 тестов для retry утилиты |

---

## Итоговая архитектура

```
┌─────────────────────────────────────────────────┐
│              UI Layer                            │
│  MainActivity (SplashScreen + NavHost)           │
│  LoginScreen → AuthViewModel                     │
│  ChatListScreen → ChatListViewModel              │
│  ChatScreen → ChatViewModel                      │
├─────────────────────────────────────────────────┤
│           Domain / ViewModel Layer               │
│  AuthViewModel ──┐                               │
│  ChatListViewModel┼──> ChatRepository            │
│  ChatViewModel ──┘        ↓                      │
├─────────────────────────────────────────────────┤
│              Data Layer                          │
│  SessionRepository (единственный auth source)    │
│     ├─ RetryPolicy (автоматические retry)        │
│     ├─ DataStore (persist UID)                   │
│     └─ TinodeClient                              │
│           ├─ TinodeHttpClient (WebSocket)        │
│           └─ Timber (логирование)                │
│  ChatRepository (делегирует SessionRepository)   │
│  AppDatabase (Room кэш)                          │
├─────────────────────────────────────────────────┤
│           Infrastructure                         │
│  NetworkMonitor (автореконнект)                  │
│  FCM Service (push-уведомления)                  │
│  Timber DebugTree (dev) / CrashlyticsTree (prod) │
└─────────────────────────────────────────────────┘
```

---

## Поток авторизации (исправленный)

```
1. LastochkaApp.onCreate()
   └─> Plant Timber (debug only)
   └─> Инициализация TinodeClient (без подключения)
   
2. SessionRepository init (@Inject)
   └─> loadUid() → есть UID?
   └─> autoLogin() с RetryPolicy.Network
   
3. TinodeClient.autoLogin()
   └─> connect() если не подключён
   └─> awaitConnection()
   └─> httpClient.loginToken(token)
   
4. SessionRepository._authState
   └─> Authenticated(uid) при успехе
   └─> Unauthenticated при неудаче
   
5. MainActivity
   └─> SplashScreen ждёт authState
   └─> Authenticated → MainAppScreen
   └─> Unauthenticated → LoginScreen
   
✨ Без мигания!
```

---

## Рекомендации для дальнейшего улучшения

1. **Добавить CrashlyticsTree** для production сбоев
2. **Интеграция с FCM** для push-уведомлений
3. **EncryptedSharedPreferences** для хранения токена
4. **Прогулка по графу навигации** — добавить deep links
5. **Compose Previews** для всех UI компонентов
6. **Benchmark тесты** для проверки производительности

---

## Команды для проверки

```bash
# Сборка
./gradlew :app:assembleDebug

# Тесты
./gradlew :app:testDebugUnitTest

# Проверка компиляции
./gradlew :app:compileDebugKotlin

# Lint
./gradlew :app:lintDebug
```
