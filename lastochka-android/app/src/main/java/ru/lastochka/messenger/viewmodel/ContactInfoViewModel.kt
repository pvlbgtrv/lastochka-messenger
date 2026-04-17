package ru.lastochka.messenger.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import ru.lastochka.messenger.data.ChatRepository
import javax.inject.Inject

/**
 * ViewModel для экрана информации о контакте.
 */
@HiltViewModel
class ContactInfoViewModel @Inject constructor(
    private val repository: ChatRepository
) : ViewModel() {

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    init {
        // Загрузка данных контакта
    }

    fun deleteChat() {
        viewModelScope.launch {
            // TODO: Реализация удаления чата
        }
    }
}
