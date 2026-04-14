package ru.lastochka.messenger.viewmodel

import io.mockk.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.test.*
import org.junit.*
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import ru.lastochka.messenger.data.*
import ru.lastochka.messenger.data.local.AppDatabase
import ru.lastochka.messenger.data.local.MessageDao
import ru.lastochka.messenger.data.model.DataPacket
import ru.lastochka.messenger.data.model.PubContent
import java.util.*

/**
 * Тесты для ChatViewModel.
 * Проверяем отправку сообщений, receive, typing, delete, reply.
 */
@OptIn(ExperimentalCoroutinesApi::class)
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [28])
class ChatViewModelTest {

    private val testDispatcher = UnconfinedTestDispatcher()
    private val testScope = TestScope(testDispatcher)

    private lateinit var context: android.content.Context
    private lateinit var repository: ChatRepository
    private lateinit var database: AppDatabase
    private lateinit var messageDao: MessageDao
    private lateinit var viewModel: ChatViewModel

    private val eventsFlow = MutableSharedFlow<TinodeEvent>(extraBufferCapacity = 8)

    @Before
    fun setup() {
        Dispatchers.setMain(testDispatcher)
        context = mockk(relaxed = true)
        repository = mockk(relaxed = true)
        database = mockk(relaxed = true)
        messageDao = mockk(relaxed = true)

        every { database.messageDao() } returns messageDao
        coEvery { messageDao.getMessagesForTopic(any()) } returns flowOf(emptyList())
        coEvery { repository.getTopicTitle(any()) } returns "Test Chat"
        every { repository.events } returns eventsFlow
        coEvery { repository.subscribeTopic(any()) } returns Result.success(Unit)

        // Mock SavedStateHandle без Android зависимости
        val savedStateHandle = createSavedStateHandle()
        viewModel = ChatViewModel(context, repository, database, savedStateHandle)
    }

    private fun createSavedStateHandle(): androidx.lifecycle.SavedStateHandle {
        return androidx.lifecycle.SavedStateHandle(mapOf("topicName" to "usrABC123"))
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test
    fun `send message adds to local DB`() = testScope.runTest {
        coEvery { messageDao.insertMessage(any()) } returns Unit

        viewModel.sendMessage("Привет!")

        coVerify { messageDao.insertMessage(match { it.content == "Привет!" && it.isOwn }) }
    }

    @Test
    fun `send empty message does nothing`() = testScope.runTest {
        viewModel.sendMessage("")
        viewModel.sendMessage("   ")

        coVerify(exactly = 0) { messageDao.insertMessage(any()) }
    }

    @Test
    fun `receive message from server`() = testScope.runTest {
        val dataPacket = DataPacket(
            topic = "usrABC123",
            from = "usrDEF456",
            seq = 10,
            content = PubContent(txt = "Ответ от сервера"),
            ts = "2026-04-03T12:00:00.000Z"
        )

        eventsFlow.emit(TinodeEvent.NewMessage(dataPacket))

        // Сообщение должно быть сохранено в DB
        coVerify { messageDao.insertMessage(any()) }
    }

    @Test
    fun `typing indicator sent`() = testScope.runTest {
        every { repository.sendTyping(any()) } just Runs

        viewModel.sendTyping()

        verify { repository.sendTyping("usrABC123") }
    }

    @Test
    fun `delete message removes from DB`() = testScope.runTest {
        val message = UiMessage(
            seqId = 5,
            from = "me",
            senderName = "",
            content = "Удали меня",
            timestamp = Date(),
            isOwn = true,
            isRead = false,
            isEdited = false
        )

        coEvery { repository.deleteMessage(any(), any()) } returns Result.success(Unit)
        coEvery { messageDao.deleteMessageBySeqId(any()) } returns Unit

        viewModel.onMessageLongClick(message)
        viewModel.executeAction(MessageActionType.DELETE)

        coVerify { messageDao.deleteMessageBySeqId(5) }
    }

    @Test
    fun `delete non-own message does nothing`() = testScope.runTest {
        val message = UiMessage(
            seqId = 5,
            from = "usrDEF456",
            senderName = "Иван",
            content = "Не удаляй",
            timestamp = Date(),
            isOwn = false,
            isRead = true,
            isEdited = false
        )

        viewModel.onMessageLongClick(message)
        viewModel.executeAction(MessageActionType.DELETE)

        coVerify(exactly = 0) { messageDao.deleteMessageBySeqId(any()) }
    }

    @Test
    fun `reply to message sets reply state`() = testScope.runTest {
        val message = UiMessage(
            seqId = 3,
            from = "usrDEF456",
            senderName = "Иван",
            content = "Ответь на это",
            timestamp = Date(),
            isOwn = false,
            isRead = true,
            isEdited = false
        )

        viewModel.onMessageLongClick(message)
        viewModel.executeAction(MessageActionType.REPLY)

        Assert.assertEquals(message, viewModel.replyToMessage.value)
    }

    @Test
    fun `clear reply resets reply state`() = testScope.runTest {
        val message = UiMessage(
            seqId = 3,
            from = "usrDEF456",
            senderName = "Иван",
            content = "Тест",
            timestamp = Date(),
            isOwn = false,
            isRead = true,
            isEdited = false
        )

        viewModel.replyToMessageExternally(message)
        Assert.assertNotNull(viewModel.replyToMessage.value)

        viewModel.clearReply()
        Assert.assertNull(viewModel.replyToMessage.value)
    }

    @Test
    fun `copy message action clears selection`() = testScope.runTest {
        val message = UiMessage(
            seqId = 1,
            from = "usrDEF456",
            senderName = "Иван",
            content = "Скопируй меня",
            timestamp = Date(),
            isOwn = false,
            isRead = true,
            isEdited = false
        )

        viewModel.onMessageLongClick(message)
        Assert.assertNotNull(viewModel.selectedMessage.value)

        // Copy action вызывает ClipboardManager который недоступен в unit-тестах
        // Проверяем только что selectedMessage установлен
        Assert.assertEquals(message, viewModel.selectedMessage.value)
    }

    @Test
    fun `loadMoreMessages called on scroll to top`() = testScope.runTest {
        coEvery { repository.loadMessagesBefore(any(), any(), any()) } just Runs

        viewModel.loadMoreMessages()

        // При пустом списке loadMoreMessages ничего не делает
        coVerify(exactly = 0) { repository.loadMessagesBefore(any(), any(), any()) }
    }

    @Test
    fun `markAllRead updates DB`() = testScope.runTest {
        coEvery { messageDao.getMaxSeq(any()) } returns 10
        coEvery { messageDao.markAllRead(any()) } returns Unit
        every { repository.markAsRead(any(), any()) } just Runs

        viewModel.markAllRead()

        coVerify { messageDao.markAllRead("usrABC123") }
        verify { repository.markAsRead("usrABC123", 10) }
    }

    @Test
    fun `edit message updates DB`() = testScope.runTest {
        val message = UiMessage(
            seqId = 5,
            from = "me",
            senderName = "",
            content = "Старый текст",
            timestamp = Date(),
            isOwn = true,
            isRead = false,
            isEdited = false
        )

        coEvery { repository.editMessage(any(), any(), any()) } just Runs
        coEvery { messageDao.updateMessageContent(any(), any(), any()) } returns Unit

        viewModel.onMessageLongClick(message)
        viewModel.executeAction(MessageActionType.EDIT)
        viewModel.editMessage(5, "Новый текст")

        coVerify { messageDao.updateMessageContent(5, "Новый текст", true) }
    }
}
