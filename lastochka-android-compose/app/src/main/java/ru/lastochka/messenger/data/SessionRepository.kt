package ru.lastochka.messenger.data

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.*
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.*
import ru.lastochka.messenger.service.NetworkMonitor
import ru.lastochka.messenger.util.RetryPolicy
import timber.log.Timber
import javax.inject.Inject
import javax.inject.Singleton

private val Context.dataStore: DataStore<Preferences> by preferencesDataStore(name = "session")

sealed class AuthState {
    data object Unauthenticated : AuthState()
    data class Authenticated(val uid: String) : AuthState()
    data object SessionExpired : AuthState()
}

/**
 * Простой и надёжный auth-менеджер.
 *
 * Принципы:
 * 1. _authState — единственный источник правды
 * 2. login() → при успехе СРАЗУ _authState = Authenticated
 * 3. DataStore — только для автологина при перезапуске
 * 4. Никаких combine, race condition и сложных flow
 */
@Singleton
class SessionRepository @Inject constructor(
    private val context: Context,
    val tinodeClient: TinodeClient,
    private val networkMonitor: NetworkMonitor
) {
    private val dataStore: DataStore<Preferences> = context.dataStore
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    // ─── Auth State — полностью независим от connectionState ─

    private val _authState = MutableStateFlow<AuthState>(AuthState.Unauthenticated)
    val authState: StateFlow<AuthState> = _authState.asStateFlow()

    // ─── Proxy-свойства ──────────────────────────────────────

    val myUid: String? get() = tinodeClient.myUid
    val isAuthenticated: Boolean
        get() = _authState.value is AuthState.Authenticated
    val connectionState: StateFlow<TinodeConnState> = tinodeClient.connectionState

    init {
        // НЕ зависим от connectionState для authState.
        // authState управляется ТОЛЬКО через login()/logout()/autoLogin()
        scope.launch {
            val savedUid = loadUid()
            if (savedUid != null) {
                // Есть сохранённая сессия — пробуем автологин
                // autoLogin() сам подключится и обновит _authState
                autoLogin()
            }
        }

        // При восстановлении сети — переподключаемся если были авторизованы
        scope.launch {
            networkMonitor.isConnected.collect { connected ->
                if (connected && _authState.value is AuthState.Authenticated) {
                    if (tinodeClient.connectionState.value == TinodeConnState.Disconnected) {
                        autoLogin()
                    }
                }
            }
        }
    }

    // ─── Auth Operations ─────────────────────────────────────

    suspend fun login(username: String, password: String): Result<Unit> {
        Timber.d("Attempting login for user: $username")
        val result = tinodeClient.login(username, password)
        Timber.d("Login result: $result, myUid=${tinodeClient.myUid}")
        if (result.isSuccess) {
            val uid = tinodeClient.myUid ?: username
            Timber.d("Setting authState = Authenticated($uid)")
            _authState.value = AuthState.Authenticated(uid)
            saveUid(uid)
        } else {
            Timber.w("Login failed: ${result.exceptionOrNull()?.message}")
        }
        return result
    }

    suspend fun register(username: String, password: String, displayName: String): Result<Unit> {
        Timber.d("Attempting registration for user: $username")
        val result = tinodeClient.register(username, password, displayName)
        if (result.isSuccess) {
            val uid = tinodeClient.myUid ?: username
            Timber.d("Registration successful, uid=$uid")
            saveUid(uid)
            _authState.value = AuthState.Authenticated(uid)
        } else {
            Timber.w("Registration failed: ${result.exceptionOrNull()?.message}")
        }
        return result
    }

    suspend fun registerWithFullProfile(
        username: String, password: String, displayName: String,
        email: String, phone: String
    ): Result<Unit> {
        Timber.d("Attempting registration with full profile for user: $username")
        val result = tinodeClient.registerWithFullProfile(username, password, displayName, email, phone)
        if (result.isSuccess) {
            val uid = tinodeClient.myUid ?: username
            saveUid(uid)
            _authState.value = AuthState.Authenticated(uid)
        } else {
            Timber.w("Registration failed: ${result.exceptionOrNull()?.message}")
        }
        return result
    }

    suspend fun logout() {
        Timber.w("logout() called! Clearing auth state")
        tinodeClient.logout()
        clearUid()
        _authState.value = AuthState.Unauthenticated
    }

    suspend fun autoLogin(): Result<Unit> {
        val policy = RetryPolicy(
            maxRetries = 3,
            initialDelayMs = 1_000L,
            maxDelayMs = 10_000L,
            backoffFactor = 2.0,
            shouldRetry = { e ->
                // Не retry если токен недействителен
                e.message?.contains("401", ignoreCase = true) != true &&
                e.message?.contains("token", ignoreCase = true) != true
            }
        )
        return policy.invoke {
            val result = tinodeClient.autoLogin()
            if (result.isSuccess) {
                val uid = tinodeClient.myUid ?: loadUid() ?: ""
                saveUid(uid)
                _authState.value = AuthState.Authenticated(uid)
            } else {
                clearUid()
            }
            result
        }
    }

    // ─── Persistence ─────────────────────────────────────────

    fun hasSavedToken(): Boolean = _authState.value is AuthState.Authenticated

    /** Проверить есть ли сохранённая сессия (UID в DataStore). */
    suspend fun hasSavedSession(): Boolean {
        return try {
            dataStore.data.first()[KEY_UID] != null
        } catch (_: Exception) {
            false
        }
    }

    private suspend fun saveUid(uid: String) {
        try {
            dataStore.edit { it[KEY_UID] = uid }
        } catch (_: Exception) {}
    }

    private suspend fun loadUid(): String? {
        return try {
            dataStore.data.first()[KEY_UID]
        } catch (_: Exception) {
            null
        }
    }

    private suspend fun clearUid() {
        try {
            dataStore.edit { it.remove(KEY_UID) }
        } catch (_: Exception) {}
    }

    companion object {
        private val KEY_UID = stringPreferencesKey("my_uid")
    }
}
