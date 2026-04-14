package ru.lastochka.messenger.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import ru.lastochka.messenger.data.ChatRepository
import javax.inject.Inject

/**
 * ViewModel для экрана профиля.
 */
@HiltViewModel
class ProfileViewModel @Inject constructor(
    private val repository: ChatRepository
) : ViewModel() {

    private val _name = MutableStateFlow("")
    val name: StateFlow<String> = _name.asStateFlow()

    private val _bio = MutableStateFlow("")
    val bio: StateFlow<String> = _bio.asStateFlow()

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    init {
        loadProfile()
    }

    private fun loadProfile() {
        viewModelScope.launch {
            try {
                val result = repository.getMyProfile()
                if (result.isSuccess) {
                    val profile = result.getOrNull()
                    _name.value = profile?.displayName ?: ""
                    _bio.value = profile?.bio ?: ""
                }
            } catch (e: Exception) {
                // Ошибка загрузки — оставляем пустые значения
            }
        }
    }

    fun updateName(newName: String) {
        _name.value = newName
    }

    fun updateBio(newBio: String) {
        _bio.value = newBio
    }

    suspend fun saveProfile() {
        _isLoading.value = true
        try {
            val result = repository.updateProfile(name.value, bio.value)
            if (result.isFailure) {
                // Handle error if needed
            }
        } finally {
            _isLoading.value = false
        }
    }
}
