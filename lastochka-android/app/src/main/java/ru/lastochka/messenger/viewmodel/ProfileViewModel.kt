package ru.lastochka.messenger.viewmodel

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import ru.lastochka.messenger.data.ChatRepository
import java.io.File
import java.io.FileOutputStream
import javax.inject.Inject

/**
 * ViewModel для экрана профиля.
 */
@HiltViewModel
class ProfileViewModel @Inject constructor(
    private val repository: ChatRepository,
    @ApplicationContext private val context: Context
) : ViewModel() {

    private val _uid = MutableStateFlow("")
    val uid: StateFlow<String> = _uid.asStateFlow()

    private val _name = MutableStateFlow("")
    val name: StateFlow<String> = _name.asStateFlow()

    private val _bio = MutableStateFlow("")
    val bio: StateFlow<String> = _bio.asStateFlow()

    private val _avatar = MutableStateFlow<String?>(null)
    val avatar: StateFlow<String?> = _avatar.asStateFlow()

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error.asStateFlow()

    private val _saved = MutableStateFlow(false)
    val saved: StateFlow<Boolean> = _saved.asStateFlow()

    init {
        loadProfile()
    }

    private fun loadProfile() {
        viewModelScope.launch {
            try {
                val result = repository.getMyProfile()
                if (result.isSuccess) {
                    val profile = result.getOrNull()
                    _uid.value = profile?.uid.orEmpty()
                    _name.value = profile?.displayName ?: ""
                    _bio.value = profile?.bio ?: ""
                    _avatar.value = profile?.avatar
                } else {
                    _uid.value = repository.myUid.orEmpty()
                }
            } catch (e: Exception) {
                _uid.value = repository.myUid.orEmpty()
            }
        }
    }

    fun updateName(newName: String) {
        _name.value = newName
    }

    fun updateBio(newBio: String) {
        _bio.value = newBio
    }

    suspend fun saveProfile(newAvatarUri: Uri?, removeAvatar: Boolean) {
        _isLoading.value = true
        _error.value = null
        _saved.value = false
        try {
            var photoUrl = if (removeAvatar) null else _avatar.value
            if (!removeAvatar && newAvatarUri != null) {
                val prepared = prepareAvatarUpload(newAvatarUri)
                val fileName = "avatar_${System.currentTimeMillis()}.jpg"
                val avatarResult = repository.updateAvatar(
                    imageUri = prepared,
                    mimeType = "image/jpeg",
                    fileName = fileName
                )
                if (avatarResult.isSuccess) {
                    photoUrl = avatarResult.getOrNull()
                    _avatar.value = photoUrl
                } else {
                    _error.value = avatarResult.exceptionOrNull()?.message ?: "Не удалось загрузить аватар"
                    return
                }
            }
            val result = repository.updateProfile(
                name = name.value.trim(),
                bio = bio.value.trim(),
                photoUrl = photoUrl
            )
            if (result.isFailure) {
                _error.value = result.exceptionOrNull()?.message ?: "Не удалось сохранить профиль"
            } else {
                _saved.value = true
            }
        } finally {
            _isLoading.value = false
        }
    }

    fun consumeSavedFlag() {
        _saved.value = false
    }

    fun clearError() {
        _error.value = null
    }

    private suspend fun prepareAvatarUpload(sourceUri: Uri): Uri = withContext(Dispatchers.IO) {
        val input = context.contentResolver.openInputStream(sourceUri)
            ?: throw IllegalStateException("Не удалось открыть изображение")
        val original = input.use { BitmapFactory.decodeStream(it) }
            ?: throw IllegalStateException("Не удалось декодировать изображение")

        val side = minOf(original.width, original.height)
        val left = (original.width - side) / 2
        val top = (original.height - side) / 2
        val cropped = Bitmap.createBitmap(original, left, top, side, side)
        if (cropped !== original) original.recycle()

        val size = 768
        val scaled = if (cropped.width != size || cropped.height != size) {
            Bitmap.createScaledBitmap(cropped, size, size, true).also {
                if (it !== cropped) cropped.recycle()
            }
        } else {
            cropped
        }

        val file = File(context.cacheDir, "avatar_upload_${System.currentTimeMillis()}.jpg")
        FileOutputStream(file).use { out ->
            scaled.compress(Bitmap.CompressFormat.JPEG, 88, out)
        }
        scaled.recycle()
        Uri.fromFile(file)
    }
}
