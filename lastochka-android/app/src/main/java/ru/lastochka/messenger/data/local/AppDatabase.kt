package ru.lastochka.messenger.data.local

import android.content.Context
import androidx.room.*
import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase
import kotlinx.coroutines.flow.Flow
import java.util.Date

// ─── Entities ────────────────────────────────────────────────────

@Entity(tableName = "messages")
data class MessageEntity(
    @PrimaryKey
    val seqId: Int,
    val topicName: String,
    val from: String,
    val senderName: String,
    val content: String,       // Plain text from Drafty
    val rawContent: String,    // JSON Drafty
    val timestamp: Long,
    val isOwn: Boolean,
    val isRead: Boolean,
    val isEdited: Boolean,
    val hasAttachment: Boolean,
    val attachmentType: String?,  // "image", "video", "file", "audio"
    val attachmentUrl: String?,
    val replyToSeq: Int? = null,
    val replyToContent: String? = null
)

@Entity(tableName = "contacts")
data class ContactEntity(
    @PrimaryKey
    val topicName: String,
    val displayName: String,
    val avatar: String?,
    val lastMessage: String?,
    val lastMessageTime: Long,
    val unread: Int,
    val isGroup: Boolean,
    val muted: Boolean,
    val pinned: Boolean
)

@Entity(tableName = "typing_indicators")
data class TypingEntity(
    @PrimaryKey
    val topicName: String,
    val who: String,
    val timestamp: Long
)

// ─── DAOs ────────────────────────────────────────────────────────

@Dao
interface MessageDao {
    @Query("SELECT * FROM messages WHERE topicName = :topicName ORDER BY timestamp ASC, seqId ASC")
    fun getMessagesForTopic(topicName: String): Flow<List<MessageEntity>>

    @Query("SELECT * FROM messages WHERE topicName = :topicName ORDER BY timestamp ASC, seqId ASC LIMIT :limit OFFSET :offset")
    suspend fun getMessagesPaged(topicName: String, limit: Int, offset: Int): List<MessageEntity>

    @Query("SELECT MAX(seqId) FROM messages WHERE topicName = :topicName")
    suspend fun getMaxSeq(topicName: String): Int?

    @Query("SELECT * FROM messages WHERE topicName = :topicName ORDER BY timestamp DESC, seqId DESC LIMIT 1")
    suspend fun getLatestMessage(topicName: String): MessageEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertMessages(messages: List<MessageEntity>)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertMessage(message: MessageEntity)

    @Query("DELETE FROM messages WHERE seqId = :seqId")
    suspend fun deleteMessageBySeqId(seqId: Int)

    @Query("UPDATE messages SET content = :content, isEdited = :isEdited WHERE seqId = :seqId")
    suspend fun updateMessageContent(seqId: Int, content: String, isEdited: Boolean)

    @Query("DELETE FROM messages WHERE topicName = :topicName")
    suspend fun clearTopicMessages(topicName: String)

    @Query("UPDATE messages SET isRead = 1 WHERE topicName = :topicName AND isOwn = 0")
    suspend fun markAllRead(topicName: String)

    @Query("UPDATE messages SET attachmentUrl = :url, timestamp = :now WHERE seqId = :seqId")
    suspend fun updateAttachmentUrl(seqId: Int, url: String, now: Long = System.currentTimeMillis())

    @Query("UPDATE messages SET attachmentUrl = :url, attachmentType = :type, hasAttachment = 1, timestamp = :now WHERE seqId = :seqId")
    suspend fun updateAttachmentFull(seqId: Int, url: String, type: String, now: Long = System.currentTimeMillis())

    @Query(
        "DELETE FROM messages " +
            "WHERE topicName = :topicName AND isOwn = 1 AND seqId < 0 AND (" +
            "(:attachmentUrl IS NOT NULL AND attachmentUrl = :attachmentUrl) OR " +
            "(:attachmentUrl IS NULL AND hasAttachment = 0 AND content = :content)" +
            ")"
    )
    suspend fun deleteOwnOptimisticDuplicate(topicName: String, content: String, attachmentUrl: String?)

    /** Обновить URL вложения в последней собственной записи чата (для echo с сервера) */
    @Query("UPDATE messages SET attachmentUrl = :url WHERE topicName = :topic AND isOwn = 1 AND hasAttachment = 1 AND seqId < 0")
    suspend fun updateLastOwnAttachmentUrl(topic: String, url: String)
}

@Dao
interface ContactDao {
    @Query("SELECT * FROM contacts ORDER BY pinned DESC, lastMessageTime DESC")
    fun getAllContacts(): Flow<List<ContactEntity>>

    @Query("SELECT * FROM contacts WHERE topicName = :topicName")
    suspend fun getContact(topicName: String): ContactEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertContacts(contacts: List<ContactEntity>)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertContact(contact: ContactEntity)

    @Query("UPDATE contacts SET unread = 0 WHERE topicName = :topicName")
    suspend fun clearUnread(topicName: String)
}

@Dao
interface TypingDao {
    @Query("SELECT * FROM typing_indicators WHERE topicName = :topicName")
    fun getTypingForTopic(topicName: String): Flow<List<TypingEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertTyping(typing: TypingEntity)

    @Query("DELETE FROM typing_indicators WHERE topicName = :topicName AND who = :who")
    suspend fun removeTyping(topicName: String, who: String)

    @Query("DELETE FROM typing_indicators WHERE timestamp < :threshold")
    suspend fun clearExpired(threshold: Long)
}

// ─── Migration V1 → V2 ─────────────────────────────────────────

/**
 * Миграция: добавляем поля replyToSeq и replyToContent в messages.
 * Эти поля нужны для функции "ответ на сообщение".
 */
val MIGRATION_1_2 = object : Migration(1, 2) {
    override fun migrate(database: SupportSQLiteDatabase) {
        database.execSQL("ALTER TABLE messages ADD COLUMN replyToSeq INTEGER")
        database.execSQL("ALTER TABLE messages ADD COLUMN replyToContent TEXT")
    }
}

// ─── Database ────────────────────────────────────────────────────

@Database(
    entities = [MessageEntity::class, ContactEntity::class, TypingEntity::class],
    version = 2,
    exportSchema = false
)
abstract class AppDatabase : RoomDatabase() {
    abstract fun messageDao(): MessageDao
    abstract fun contactDao(): ContactDao
    abstract fun typingDao(): TypingDao

    companion object {
        @Volatile
        private var INSTANCE: AppDatabase? = null

        fun getInstance(context: Context): AppDatabase {
            return INSTANCE ?: synchronized(this) {
                val instance = Room.databaseBuilder(
                    context.applicationContext,
                    AppDatabase::class.java,
                    "lastochka_db"
                )
                    .addMigrations(MIGRATION_1_2)
                    .build()
                INSTANCE = instance
                instance
            }
        }
    }
}
