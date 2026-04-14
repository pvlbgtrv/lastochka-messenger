package ru.lastochka.messenger.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import ru.lastochka.messenger.data.ChatRepository
import ru.lastochka.messenger.data.ContactInfo
import javax.inject.Inject

/**
 * ViewModel для создания группы.
 */
@HiltViewModel
class CreateGroupViewModel @Inject constructor(
    private val repository: ChatRepository
) : ViewModel() {

    private val _groupName = MutableStateFlow("")
    val groupName: StateFlow<String> = _groupName.asStateFlow()

    private val _description = MutableStateFlow("")
    val description: StateFlow<String> = _description.asStateFlow()

    private val _contacts = MutableStateFlow<List<ContactInfo>>(emptyList())
    val contacts: StateFlow<List<ContactInfo>> = _contacts.asStateFlow()

    private val _selectedMembers = MutableStateFlow<List<ContactInfo>>(emptyList())
    val selectedMembers: StateFlow<List<ContactInfo>> = _selectedMembers.asStateFlow()

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    init {
        loadContacts()
    }

    private fun loadContacts() {
        viewModelScope.launch {
            // Загружаем контакты из me-топика
            // В реальном приложении нужно подписаться на Flow
            val subs = repository.getMeTopic()
            _contacts.value = repository.getContactsFromSubs(subs)
        }
    }

    fun updateGroupName(name: String) {
        _groupName.value = name
    }

    fun updateDescription(desc: String) {
        _description.value = desc
    }

    fun toggleMember(contact: ContactInfo) {
        val current = _selectedMembers.value
        if (current.contains(contact)) {
            _selectedMembers.value = current - contact
        } else {
            _selectedMembers.value = current + contact
        }
    }

    fun createGroup(onSuccess: (String) -> Unit) {
        viewModelScope.launch {
            _isLoading.value = true
            try {
                val members = _selectedMembers.value.map { it.topicName }
                val result = repository.createGroup(groupName.value, description.value, members)
                if (result.isSuccess) {
                    onSuccess(result.getOrNull() ?: "")
                }
            } finally {
                _isLoading.value = false
            }
        }
    }
}