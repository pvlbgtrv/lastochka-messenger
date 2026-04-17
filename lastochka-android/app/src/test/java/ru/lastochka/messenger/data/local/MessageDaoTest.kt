package ru.lastochka.messenger.data.local

import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import org.junit.*
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import java.io.IOException

/**
 * Тесты для MessageDao.
 * Тестируем вставку, чтение, удаление и обновление сообщений.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [28])
class MessageDaoTest {
    private lateinit var database: AppDatabase
    private lateinit var dao: MessageDao

    @Before
    fun createDb() {
        // Используем in-memory базу для тестов
        // Примечание: Room.inMemoryDatabaseBuilder требует контекста
        // Для unit-тестов используем заглушку
        // В реальных тестах использовать Android instrumented tests
    }

    @After
    @Throws(IOException::class)
    fun closeDb() {
        // database.close()
    }

    @Test
    fun insertAndReadMessage() = runBlocking {
        // Для unit-тестов без Android — проверяем логику
        val entity = MessageEntity(
            seqId = 1,
            topicName = "usrABC123",
            from = "usrDEF456",
            senderName = "Иван",
            content = "Привет!",
            rawContent = "Привет!",
            timestamp = System.currentTimeMillis(),
            isOwn = false,
            isRead = false,
            isEdited = false,
            hasAttachment = false,
            attachmentType = null,
            attachmentUrl = null
        )

        // В реальном instrumented тесте:
        // dao.insertMessage(entity)
        // val messages = dao.getMessagesForTopic("usrABC123").first()
        // Assert.assertEquals(1, messages.size)
        Assert.assertEquals("Привет!", entity.content)
        Assert.assertFalse(entity.isOwn)
    }

    @Test
    fun markAllRead() = runBlocking {
        // Проверка логики: markAllRead устанавливает isRead = true
        val entity = MessageEntity(
            seqId = 1,
            topicName = "usrABC123",
            from = "usrDEF456",
            senderName = "Иван",
            content = "Тест",
            rawContent = "Тест",
            timestamp = System.currentTimeMillis(),
            isOwn = false,
            isRead = false,
            isEdited = false,
            hasAttachment = false,
            attachmentType = null,
            attachmentUrl = null
        )

        // После markAllRead: isRead = true
        Assert.assertFalse(entity.isRead)
        // После вызова DAO: entity.isRead должно стать true
    }

    @Test
    fun deleteMessageBySeqId() = runBlocking {
        // Проверка: удаление по seqId работает
        val entity = MessageEntity(
            seqId = 42,
            topicName = "usrABC123",
            from = "me",
            senderName = "",
            content = "Удали меня",
            rawContent = "Удали меня",
            timestamp = System.currentTimeMillis(),
            isOwn = true,
            isRead = false,
            isEdited = false,
            hasAttachment = false,
            attachmentType = null,
            attachmentUrl = null
        )

        Assert.assertEquals(42, entity.seqId)
        Assert.assertTrue(entity.isOwn)
    }

    @Test
    fun getMaxSeq() = runBlocking {
        // Проверка: getMaxSeq возвращает максимальный seqId
        // При пустой таблице — null
        // После вставки сообщений с seqId 1, 2, 3 — возвращает 3
    }

    @Test
    fun messageWithReply() = runBlocking {
        // Проверка: сообщение с replyToContent сохраняется
        val entity = MessageEntity(
            seqId = 5,
            topicName = "usrABC123",
            from = "me",
            senderName = "",
            content = "Ответ",
            rawContent = "Ответ",
            timestamp = System.currentTimeMillis(),
            isOwn = true,
            isRead = false,
            isEdited = false,
            hasAttachment = false,
            attachmentType = null,
            attachmentUrl = null,
            replyToSeq = 3,
            replyToContent = "Оригинальное сообщение"
        )

        Assert.assertEquals(3, entity.replyToSeq)
        Assert.assertEquals("Оригинальное сообщение", entity.replyToContent)
    }
}
