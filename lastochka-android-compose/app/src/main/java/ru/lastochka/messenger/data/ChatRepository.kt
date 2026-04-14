package ru.lastochka.messenger.data

import kotlinx.coroutines.flow.Flow
import ru.lastochka.messenger.data.local.AppDatabase
import ru.lastochka.messenger.data.local.ContactEntity
import ru.lastochka.messenger.data.local.MessageEntity

/**
 * Repository — единая точка доступа к данным (Tinode + Room).
 */
class ChatRepository(
    private val tinodeClient: TinodeClient,
    private val database: AppDatabase,
    private val sessionRepository: SessionRepository
) {
    // ─── Messages ───────────────────────────────────────────────

    fun getMessages(topicName: String): Flow<List<MessageEntity>> {
        return database.messageDao().getMessagesForTopic(topicName)
    }

    suspend fun saveMessage(entity: MessageEntity) {
        database.messageDao().insertMessage(entity)
    }

    suspend fun saveMessages(entities: List<MessageEntity>) {
        database.messageDao().insertMessages(entities)
    }

    suspend fun markAllRead(topicName: String) {
        database.messageDao().markAllRead(topicName)
        val maxSeq = database.messageDao().getMaxSeq(topicName)
        if (maxSeq != null) {
            tinodeClient.markAsRead(topicName, maxSeq)
        }
    }

    // ─── Contacts ────────────────────────────────────────────────

    fun getContacts(): Flow<List<ContactEntity>> {
        return database.contactDao().getAllContacts()
    }

    suspend fun saveContacts(contacts: List<ContactEntity>) {
        database.contactDao().insertContacts(contacts)
    }

    suspend fun clearUnread(topicName: String) {
        database.contactDao().clearUnread(topicName)
    }

    // ─── Session / Auth (делегирование SessionRepository) ───────

    val authState: Flow<AuthState>
        get() = sessionRepository.authState

    val myUid: String?
        get() = sessionRepository.myUid

    fun isAuthenticated(): Boolean = sessionRepository.isAuthenticated

    val connectionState: Flow<TinodeConnState>
        get() = sessionRepository.connectionState

    suspend fun login(username: String, password: String): Result<Unit> {
        return sessionRepository.login(username, password)
    }

    suspend fun register(username: String, password: String, displayName: String): Result<Unit> {
        return sessionRepository.register(username, password, displayName)
    }

    suspend fun registerWithFullProfile(
        username: String, password: String, displayName: String,
        email: String, phone: String
    ): Result<Unit> {
        return sessionRepository.registerWithFullProfile(username, password, displayName, email, phone)
    }

    suspend fun autoLogin(): Result<Unit> {
        return sessionRepository.autoLogin()
    }

    suspend fun logout() {
        sessionRepository.logout()
    }

    fun hasSavedToken(): Boolean = sessionRepository.isAuthenticated

    // ─── Tinode operations ───────────────────────────────────────

    suspend fun subscribeTopic(topicName: String): Result<Unit> {
        return tinodeClient.subscribeTopic(topicName)
    }

    suspend fun getMeTopic(): List<ru.lastochka.messenger.data.model.MetaSub> {
        return tinodeClient.getMeTopic()
    }

    fun getContactsFromSubs(subs: List<ru.lastochka.messenger.data.model.MetaSub>): List<ContactInfo> {
        return tinodeClient.getContacts(subs)
    }

    suspend fun getTopicTitle(topicName: String): String {
        return tinodeClient.getTopicTitle(topicName)
    }

    fun sendTextMessage(topicName: String, text: String) {
        tinodeClient.sendTextMessage(topicName, text)
    }

    suspend fun sendImageMessage(
        topicName: String,
        imageUri: android.net.Uri,
        mimeType: String,
        fileName: String,
        caption: String = ""
    ): Result<String> {
        return tinodeClient.sendImageMessage(topicName, imageUri, mimeType, fileName, caption)
    }

    suspend fun sendImageMessageWithProgress(
        topicName: String,
        imageUri: android.net.Uri,
        mimeType: String,
        fileName: String,
        caption: String = "",
        fileSize: Long = 0,
        onProgress: (Float) -> Unit
    ): Result<String> {
        return tinodeClient.sendImageMessageWithProgress(
            topicName, imageUri, mimeType, fileName, caption, fileSize, onProgress
        )
    }

    fun sendTyping(topicName: String) {
        tinodeClient.sendTyping(topicName)
    }

    fun markAsRead(topicName: String, seq: Int) {
        tinodeClient.markAsRead(topicName, seq)
    }

    suspend fun searchUsers(query: String): List<ContactInfo> {
        return tinodeClient.searchUsers(query)
    }

    suspend fun startChatWithUser(topicName: String): Result<Unit> {
        return tinodeClient.startChatWithUser(topicName)
    }

    suspend fun loadMessagesBefore(topicName: String, beforeSeq: Int, limit: Int) {
        tinodeClient.loadMessagesBefore(topicName, beforeSeq, limit)
        // Сообщения приходят через event flow и сохраняются в Room через ChatViewModel
    }

    suspend fun deleteMessage(topicName: String, seqId: Int): Result<Unit> {
        return tinodeClient.deleteMessage(topicName, seqId)
    }

    fun editMessage(topicName: String, seqId: Int, newText: String) {
        tinodeClient.editMessage(topicName, seqId, newText)
    }

    suspend fun updateProfile(name: String, bio: String): Result<Unit> {
        return tinodeClient.updateProfile(name, bio)
    }

    suspend fun getMyProfile(): Result<ru.lastochka.messenger.data.UserProfile> {
        return tinodeClient.getMyProfile()
    }

    suspend fun createGroup(name: String, description: String, members: List<String>): Result<String> {
        return tinodeClient.createGroup(name, description, members)
    }

    val events = tinodeClient.events
}
