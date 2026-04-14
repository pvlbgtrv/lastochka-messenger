package ru.lastochka.messenger.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import ru.lastochka.messenger.data.SessionRepository
import javax.inject.Inject

/**
 * ViewModel экрана входа/регистрации.
 */
@HiltViewModel
class AuthViewModel @Inject constructor(
    private val sessionRepository: SessionRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow<AuthUiState>(AuthUiState.Idle)
    val uiState: StateFlow<AuthUiState> = _uiState.asStateFlow()

    private val _authSuccess = MutableSharedFlow<Unit>(extraBufferCapacity = 1)
    val authSuccess: SharedFlow<Unit> = _authSuccess.asSharedFlow()

    /**
     * Попытка автологина по сохранённому токену.
     */
    fun tryAutoLogin() {
        viewModelScope.launch {
            val result = sessionRepository.autoLogin()
            if (result.isSuccess) {
                _authSuccess.emit(Unit)
            }
        }
    }

    /**
     * Войти по логину/паролю.
     * Использует SessionRepository — сохраняет UID в DataStore.
     */
    fun login(username: String, password: String) {
        viewModelScope.launch {
            _uiState.value = AuthUiState.Loading
            val result = sessionRepository.login(username, password)
            _uiState.value = if (result.isSuccess) {
                _authSuccess.emit(Unit)
                AuthUiState.Success
            } else {
                AuthUiState.Error(result.exceptionOrNull()?.message ?: "Ошибка входа")
            }
        }
    }

    /**
     * Зарегистрировать нового пользователя.
     */
    fun register(username: String, password: String, displayName: String) {
        viewModelScope.launch {
            _uiState.value = AuthUiState.Loading
            val result = sessionRepository.register(username, password, displayName)
            _uiState.value = if (result.isSuccess) {
                _authSuccess.emit(Unit)
                AuthUiState.Success
            } else {
                val msg = result.exceptionOrNull()?.message ?: "Ошибка регистрации"
                AuthUiState.Error(msg)
            }
        }
    }

    /**
     * Зарегистрировать нового пользователя с полным профилем (email, телефон).
     */
    fun registerWithFullProfile(
        username: String,
        password: String,
        displayName: String,
        email: String,
        phone: String
    ) {
        viewModelScope.launch {
            _uiState.value = AuthUiState.Loading
            val result = sessionRepository.registerWithFullProfile(username, password, displayName, email, phone)
            _uiState.value = if (result.isSuccess) {
                _authSuccess.emit(Unit)
                AuthUiState.Success
            } else {
                val msg = result.exceptionOrNull()?.message ?: "Ошибка регистрации"
                AuthUiState.Error(msg)
            }
        }
    }

    /**
     * Проверить свободен ли username.
     */
    fun checkUsername(username: String, callback: (Boolean) -> Unit) {
        viewModelScope.launch {
            val result = sessionRepository.tinodeClient.checkUsername(username)
            callback(result.getOrDefault(true))
        }
    }

    /**
     * Проверить свободен ли email.
     */
    fun checkEmailAvailability(email: String, callback: (Boolean) -> Unit) {
        viewModelScope.launch {
            val result = sessionRepository.tinodeClient.checkEmailAvailability(email)
            callback(result.getOrDefault(true))
        }
    }

    /**
     * Проверить свободен ли телефон.
     */
    fun checkPhoneAvailability(phone: String, callback: (Boolean) -> Unit) {
        viewModelScope.launch {
            val result = sessionRepository.tinodeClient.checkPhoneAvailability(phone)
            callback(result.getOrDefault(true))
        }
    }

    fun resetState() {
        _uiState.value = AuthUiState.Idle
    }
}

sealed class AuthUiState {
    data object Idle : AuthUiState()
    data object Loading : AuthUiState()
    data object Success : AuthUiState()
    data class Error(val message: String) : AuthUiState()
}
