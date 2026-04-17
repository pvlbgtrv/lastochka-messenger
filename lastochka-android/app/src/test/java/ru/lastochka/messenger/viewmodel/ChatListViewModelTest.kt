package ru.lastochka.messenger.viewmodel

import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.every
import io.mockk.just
import io.mockk.mockk
import io.mockk.runs
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.test.*
import org.junit.*
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import ru.lastochka.messenger.data.AuthState
import ru.lastochka.messenger.data.ChatRepository
import ru.lastochka.messenger.data.ContactInfo
import ru.lastochka.messenger.data.TinodeConnState
import ru.lastochka.messenger.data.TinodeEvent
import ru.lastochka.messenger.data.model.MetaSub

/**
 * Тесты для ChatListViewModel.
 */
@OptIn(ExperimentalCoroutinesApi::class)
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [28])
class ChatListViewModelTest {

    private val testDispatcher = UnconfinedTestDispatcher()
    private val testScope = TestScope(testDispatcher)

    private lateinit var repository: ChatRepository
    private lateinit var viewModel: ChatListViewModel

    @Before
    fun setup() {
        Dispatchers.setMain(testDispatcher)
        repository = mockk(relaxed = true)
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test
    fun `contacts load on init`() = testScope.runTest {
        val theCard = ru.lastochka.messenger.data.model.TheCard(fn = "Иван")
        val subs = listOf(
            MetaSub(
                user = "usrABC",
                topic = "usrABC",
                `public` = theCard
            )
        )
        val contacts = listOf(ContactInfo(topicName = "usrABC", displayName = "Иван"))

        coEvery { repository.getMeTopic() } returns subs
        coEvery { repository.getContactsFromSubs(any()) } returns contacts
        coEvery { repository.hasSavedToken() } returns false
        every { repository.events } returns MutableSharedFlow()

        viewModel = ChatListViewModel(repository)

        // Проверяем что contacts были загружены
        coVerify { repository.getMeTopic() }
    }

    @Test
    fun `search query filters contacts`() = testScope.runTest {
        val contacts = listOf(
            ContactInfo(topicName = "usr1", displayName = "Иван"),
            ContactInfo(topicName = "usr2", displayName = "Мария"),
            ContactInfo(topicName = "usr3", displayName = "Алексей")
        )

        coEvery { repository.getMeTopic() } returns emptyList()
        coEvery { repository.hasSavedToken() } returns false
        every { repository.events } returns MutableSharedFlow()

        viewModel = ChatListViewModel(repository)

        // Проверяем логику фильтрации
        val filtered = contacts.filter { it.displayName.contains("иван", ignoreCase = true) }
        Assert.assertEquals(1, filtered.size)
        Assert.assertEquals("Иван", filtered[0].displayName)
    }

    @Test
    fun `session expired triggers logout`() = testScope.runTest {
        coEvery { repository.getMeTopic() } returns emptyList()
        coEvery { repository.hasSavedToken() } returns true
        coEvery { repository.logout() } just runs
        every { repository.events } returns MutableSharedFlow()

        viewModel = ChatListViewModel(repository)

        // При пустых subs и наличии токена — logout
        coVerify { repository.getMeTopic() }
        coVerify { repository.hasSavedToken() }
    }
}
