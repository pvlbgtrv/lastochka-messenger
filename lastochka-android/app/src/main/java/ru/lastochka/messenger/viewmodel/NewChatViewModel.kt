package ru.lastochka.messenger.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import ru.lastochka.messenger.data.ChatRepository
import ru.lastochka.messenger.data.ContactInfo
import ru.lastochka.messenger.data.local.ContactEntity
import java.util.Date
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

    private fun normalizeText(value: String?): String = value?.trim()?.lowercase() ?: ""
    private fun normalizeDigits(value: String?): String = value?.replace("[^\\d]".toRegex(), "") ?: ""

    private fun contactEntityToInfo(entity: ContactEntity): ContactInfo = ContactInfo(
        topicName = entity.topicName,
        displayName = entity.displayName,
        avatar = entity.avatar,
        lastMessage = entity.lastMessage,
        timestamp = Date(entity.lastMessageTime),
        unread = entity.unread,
        isGroup = entity.isGroup,
        muted = entity.muted,
        pinned = entity.pinned
    )

    private fun localMatch(entity: ContactEntity, query: String): Boolean {
        val q = normalizeText(query)
        if (q.isBlank()) return true
        val qDigits = normalizeDigits(q)
        val name = normalizeText(entity.displayName)
        val topic = normalizeText(entity.topicName)
        return name.contains(q) || topic.contains(q) || (qDigits.isNotBlank() && normalizeDigits(entity.topicName).contains(qDigits))
    }

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
                val localFromDb = repository.getContacts().first()
                    .filter { localMatch(it, query) }
                    .map { contactEntityToInfo(it) }
                val localFromMeTopic = runCatching {
                    val subs = repository.getMeTopic()
                    repository.getContactsFromSubs(subs).filter {
                        localMatch(
                            ContactEntity(
                                topicName = it.topicName,
                                displayName = it.displayName,
                                avatar = it.avatar,
                                lastMessage = it.lastMessage,
                                lastMessageTime = it.timestamp?.time ?: 0L,
                                unread = it.unread,
                                isGroup = it.isGroup,
                                muted = it.muted,
                                pinned = it.pinned
                            ),
                            query
                        )
                    }
                }.getOrDefault(emptyList())
                val remoteResults = repository.searchUsers(query)
                val merged = LinkedHashMap<String, ContactInfo>()
                localFromDb.forEach { merged[it.topicName] = it }
                localFromMeTopic.forEach { merged.putIfAbsent(it.topicName, it) }
                remoteResults.forEach { merged.putIfAbsent(it.topicName, it) }
                _searchResults.value = merged.values.toList()
            } catch (e: CancellationException) {
                // Нормально при debounce: не затираем результаты отменённым job.
                throw e
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
