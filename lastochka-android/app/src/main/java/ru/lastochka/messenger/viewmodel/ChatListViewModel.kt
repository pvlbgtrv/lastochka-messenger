package ru.lastochka.messenger.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import ru.lastochka.messenger.data.ChatRepository
import ru.lastochka.messenger.data.ContactInfo
import ru.lastochka.messenger.data.TinodeEvent
import ru.lastochka.messenger.data.model.MetaSub
import timber.log.Timber
import javax.inject.Inject

/**
 * ViewModel списка чатов.
 */
@HiltViewModel
class ChatListViewModel @Inject constructor(
    private val repository: ChatRepository
) : ViewModel() {

    private val _contacts = MutableStateFlow<List<ContactInfo>>(emptyList())
    val contacts: StateFlow<List<ContactInfo>> = _contacts.asStateFlow()

    /**
     * Суммарное количество непрочитанных сообщений.
     * Используется для badge на табле "Чаты".
     */
    val totalUnread: StateFlow<Int> = _contacts
        .map { contacts -> contacts.sumOf { it.unread.coerceAtLeast(0) } }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), 0)

    private val _searchQuery = MutableStateFlow("")
    val searchQuery: StateFlow<String> = _searchQuery.asStateFlow()

    // Фильтрованный список для UI
    val filteredContacts: StateFlow<List<ContactInfo>> = combine(_contacts, _searchQuery) { contacts, query ->
        if (query.isBlank()) contacts
        else contacts.filter { it.displayName.contains(query, ignoreCase = true) }
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    private val _isLoading = MutableStateFlow(true)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error.asStateFlow()

    private var subs: List<MetaSub> = emptyList()

    init {
        loadContacts()
        listenForUpdates()
    }

    fun onSearchQueryChanged(query: String) {
        _searchQuery.value = query
    }

    private fun loadContacts() {
        viewModelScope.launch {
            try {
                Timber.d("ChatListViewModel: loadContacts started")
                _isLoading.value = true
                subs = repository.getMeTopic()
                Timber.d("ChatListViewModel: getMeTopic returned ${subs.size} subs")

                // Не считаем SESSION_EXPIRED если только что залогинились.
                // Даём серверу время отправить данные. Проверяем только
                // если есть сохранённый UID НО authState == Unauthenticated
                // (значит это был autoLogin с истёкшим токеном).
                val authState = repository.authState.first()
                if (subs.isEmpty() && authState !is ru.lastochka.messenger.data.AuthState.Authenticated) {
                    Timber.w("ChatListViewModel: empty subs + not authenticated → SESSION_EXPIRED")
                    repository.logout()
                    _error.value = "SESSION_EXPIRED"
                }

                delay(500)
                refreshContacts()
                _isLoading.value = false
                Timber.d("ChatListViewModel: loadContacts finished, ${_contacts.value.size} contacts")
            } catch (e: Exception) {
                Timber.e(e, "ChatListViewModel: loadContacts error")
                _error.value = e.message
                _isLoading.value = false
            }
        }
    }

    private suspend fun refreshContacts() {
        val contacts = repository.getContactsFromSubs(subs)
        _contacts.value = repository.enrichContactsWithLastMessages(contacts)
    }

    private fun listenForUpdates() {
        viewModelScope.launch {
            repository.events.collect { event ->
                when (event) {
                    is TinodeEvent.Meta -> {
                        // Мета-событие ТОЛЬКО для me-топика — обновляем контакты
                        if (event.data.topic == "me") {
                            val newSubs = event.data.sub
                            if (newSubs != null) {
                                subs = newSubs
                                refreshContacts()
                                Timber.d("ChatListViewModel: updated contacts from meta event (${subs.size} subs)")
                            }
                        }
                    }
                    is TinodeEvent.Presence -> {
                        // Изменение присутствия — просто обновляем UI из текущих subs
                        refreshContacts()
                    }
                    else -> {}
                }
            }
        }
    }

    fun refresh() {
        viewModelScope.launch {
            refreshContacts()
        }
    }

    fun clearError() {
        _error.value = null
    }

    /**
     * Явная перезагрузка списка чатов.
     * Нужна после логина/восстановления сессии, чтобы не зависеть только от init-блока.
     */
    fun reloadContacts() {
        loadContacts()
    }
}
