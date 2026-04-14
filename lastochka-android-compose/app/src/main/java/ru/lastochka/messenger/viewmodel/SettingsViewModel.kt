package ru.lastochka.messenger.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.launch
import ru.lastochka.messenger.data.ChatRepository
import javax.inject.Inject

/**
 * ViewModel для экрана настроек.
 */
@HiltViewModel
class SettingsViewModel @Inject constructor(
    private val repository: ChatRepository
) : ViewModel() {

    suspend fun logout() {
        repository.logout()
    }
}
