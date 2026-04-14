package ru.lastochka.messenger.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import ru.lastochka.messenger.data.ChatRepository
import ru.lastochka.messenger.data.ContactInfo
import javax.inject.Inject

/**
 * ViewModel для поиска пользователей и создания нового чата.
 */
@HiltViewModel
class NewChatViewModel @Inject constructor(
    private val repository: ChatRepository
) : ViewModel() {

    private val _searchResults = MutableStateFlow<List<ContactInfo>>(emptyList())
    val searchResults: StateFlow<List<ContactInfo>> = _searchResults.asStateFlow()

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private var searchJob: Job? = null

    /**
     * Поиск пользователей по запросу с debounce.
     */
    fun search(query: String) {
        searchJob?.cancel()
        
        if (query.length < 2) {
            _searchResults.value = emptyList()
            return
        }

        searchJob = viewModelScope.launch {
            delay(400) // Debounce
            _isLoading.value = true
            try {
                val results = repository.searchUsers(query)
                _searchResults.value = results
            } catch (e: Exception) {
                _searchResults.value = emptyList()
            } finally {
                _isLoading.value = false
            }
        }
    }

    /**
     * Начать чат с выбранным пользователем.
     */
    suspend fun startChat(topicName: String): Result<Unit> {
        return repository.startChatWithUser(topicName)
    }

    fun clearResults() {
        _searchResults.value = emptyList()
        searchJob?.cancel()
    }
}
